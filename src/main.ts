import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as express from 'express';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');
  const isProduction = process.env.NODE_ENV === 'production';

  // ========== SÉCURITÉ : Vérification des variables d'environnement critiques ==========
  if (isProduction) {
    const requiredEnvVars = ['JWT_SECRET', 'DB_HOST', 'DB_PASSWORD'];
    const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);
    
    if (missingVars.length > 0) {
      logger.error(`❌ Variables d'environnement manquantes en production: ${missingVars.join(', ')}`);
      logger.error('L\'application ne peut pas démarrer sans ces variables.');
      process.exit(1);
    }

    if (process.env.JWT_SECRET === 'your-secret-key-change-in-production') {
      logger.error('❌ JWT_SECRET doit être changé en production !');
      process.exit(1);
    }
  }

  // ========== SÉCURITÉ : Helmet.js pour les headers de sécurité ==========
  app.use(
    helmet({
      contentSecurityPolicy: isProduction ? undefined : false, // Désactivé en dev pour Swagger
      crossOriginEmbedderPolicy: false, // Nécessaire pour certains endpoints
    }),
  );

  // Configuration pour extraire la vraie IP même derrière un proxy
  // Trust proxy permet à Express de lire les headers X-Forwarded-For
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.getInstance().set('trust proxy', true);

  // Servir les fichiers statiques (logos, documents)
  httpAdapter.use('/uploads', express.static('uploads'));

  // ========== SÉCURITÉ : Configuration CORS via variables d'environnement ==========
  const allowedOrigins = isProduction
    ? (process.env.CORS_ORIGINS?.split(',') || [])
    : [
        'http://localhost:3000',
        'http://localhost:8080',
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:4200',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:8080',
        'http://127.0.0.1:5173',
      ];

  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Upload-Token', 'X-Forwarded-For', 'X-Real-IP', 'CF-Connecting-IP'],
    credentials: true,
    maxAge: 86400, // Cache preflight requests for 24 hours
  });

  // Préfixe global pour toutes les routes
  app.setGlobalPrefix('api');

  // ========== SÉCURITÉ : Configuration de la validation globale ==========
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Supprime les propriétés non définies dans les DTOs
      forbidNonWhitelisted: true, // Rejette les requêtes avec des propriétés non autorisées
      transform: true, // Transforme automatiquement les types
      transformOptions: {
        enableImplicitConversion: true,
      },
      disableErrorMessages: isProduction, // Masque les messages d'erreur détaillés en production
    }),
  );

  // ========== Swagger : en dev toujours, en prod si ENABLE_SWAGGER=true ==========
  const enableSwagger = !isProduction || process.env.ENABLE_SWAGGER === 'true';
  if (enableSwagger) {
    const config = new DocumentBuilder()
      .setTitle('Secure Link API')
      .setDescription(`
        API documentation for Secure Link project
        
        ##   
        Les endpoints sont organisés en 4 sections :
        - **Authentification** : Pour tous les utilisateurs (inscription, connexion, réinitialisation)
        - **Clients** : Endpoints spécifiques aux clients (profil, documents, demandes)
        - **Organisations** : Endpoints pour les organisations (gestion, utilisateurs, formulaires, demandes)
        - **Admin** : Endpoints réservés aux administrateurs (organisations, paramètres, sécurité, audit)
        
        ##   Utilisation:
        Utilisez le bouton "Authorize" en haut à droite pour ajouter votre token JWT.
        Les endpoints protégés nécessitent un token valide et le rôle approprié.
      `)
      .setVersion('1.0')
      .addTag('Authentification', 'Endpoints d\'authentification pour tous les utilisateurs')
      .addTag('Clients', 'Endpoints spécifiques aux clients')
      .addTag('Organisations', 'Endpoints pour les organisations')
      .addTag('Admin', 'Endpoints réservés aux administrateurs')
      .addTag('Formulaires (Admin)', `**Création de formulaire**

- **Un seul endpoint pour créer :** \`POST /forms\` (multipart) — envoie en une fois : name, version, sectorId, formTypeId, organisationId, description, requiredDocuments, **pdfFile** (modèle), **attachmentFiles** (PDFs annexes), **labels** (ex. Contrat, Renseignements).
- **Options (listes) :** \`GET /forms/create-options\` pour secteurs, types, organisations, documentTypes.
- **Ensuite :** \`PATCH /forms/:id/fields\` pour ajuster les champs, \`PATCH /forms/:id/activate\` (admin), puis \`PATCH /forms/:id/status\` (organisation, ONLINE/OFFLINE). Une fois **ONLINE**, le formulaire est figé.`)
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'Authorization',
          description: 'Enter JWT token (obtenu via /auth/login). Ne pas inclure "Bearer", juste le token.',
          in: 'header',
        },
        'JWT-auth',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      jsonDocumentUrl: 'api/api-doc.json',
    });
    logger.log('  Swagger UI: /api/docs — OpenAPI JSON: /api/api-doc.json (import Postman/Insomnia)');
  } else {
    logger.warn('  Swagger désactivé (en prod : définir ENABLE_SWAGGER=true pour l’activer)');
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  logger.log(`  Application démarrée sur le port ${port}`);
  logger.log(`  Environnement: ${isProduction ? 'PRODUCTION' : 'DÉVELOPPEMENT'}`);
  
  if (enableSwagger) {
    logger.log(`  Swagger: http://localhost:${port}/api/docs | OpenAPI JSON: http://localhost:${port}/api/api-doc.json`);
  }
}

bootstrap();

