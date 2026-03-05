import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { CreateDocumentTypeDto } from './dto/create-document-type.dto';
import { UpdateDocumentTypeDto } from './dto/update-document-type.dto';
import { UpdateDocumentTypeStatusDto } from './dto/update-document-type-status.dto';
import { UsersProfileService } from '../users/users-profile.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrganisationRoles } from '../auth/decorators/organisation-roles.decorator';
import { OrganisationRoleGuard } from '../auth/guards/organisation-role.guard';
import { UserRole, OrganisationRole } from '../auth/dto/register.dto';
import { DocumentType, DocumentStatus } from '../users/entities/user-document.entity';


@Controller('documents')
@UseGuards(JwtAuthGuard, RolesGuard, OrganisationRoleGuard)
@ApiBearerAuth('JWT-auth')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly usersProfileService: UsersProfileService,
  ) {}

  @Post('types')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiTags('Admin')
  @ApiOperation({ 
    summary: 'Créer un nouveau type de document',
    description: 'Créer un nouveau type de document dans la bibliothèque de référence. **Rôle requis : ADMIN uniquement**\n\n**Paramètres :**\n- **Titre** : Nom du type de document (ex: Carte d\'identité)\n- **Date d\'expiration** : Ce document a-t-il une date d\'expiration ?\n- **Vérification d\'identité** : Ce document sert-il à vérifier l\'identité ?'
  })
  @ApiResponse({ status: 201, description: 'Type de document créé avec succès' })
  @ApiResponse({ status: 403, description: 'Accès refusé - Rôle ADMIN requis' })
  createType(@Body() createDocumentTypeDto: CreateDocumentTypeDto) {
    return this.documentsService.create(createDocumentTypeDto);
  }

  @Get('types')
  @Roles(UserRole.ADMIN, UserRole.ORGANISATION)
  @OrganisationRoles(OrganisationRole.SUPERVISEUR, OrganisationRole.ADMINISTRATION)
  @ApiTags('Admin', 'Organisations')
  @ApiOperation({ 
    summary: 'Obtenir la liste des types de documents',
    description: 'Liste tous les types de documents disponibles dans la bibliothèque. **Rôles autorisés:** ADMIN, ORGANISATION (SUPERVISEUR, ADMINISTRATION)'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Liste des types de documents',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string', example: 'Carte d\'identité' },
          hasExpirationDate: { type: 'boolean', example: true },
          isForIdentityVerification: { type: 'boolean', example: true },
          isActive: { type: 'boolean', example: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  findAllTypes() {
    return this.documentsService.findAll();
  }

  @Get('types/:id')
  @Roles(UserRole.ADMIN, UserRole.ORGANISATION)
  @OrganisationRoles(OrganisationRole.SUPERVISEUR, OrganisationRole.ADMINISTRATION)
  @ApiTags('Admin', 'Organisations')
  @ApiOperation({ 
    summary: 'Obtenir un type de document',
    description: 'Récupère les détails d\'un type de document spécifique. **Rôles autorisés:** ADMIN, ORGANISATION (SUPERVISEUR, ADMINISTRATION)'
  })
  @ApiParam({ name: 'id', description: 'ID du type de document' })
  @ApiResponse({ 
    status: 200, 
    description: 'Type de document',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string', example: 'Carte d\'identité' },
        hasExpirationDate: { type: 'boolean', example: true },
        isForIdentityVerification: { type: 'boolean', example: true },
        isActive: { type: 'boolean', example: true },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Type de document non trouvé' })
  findOneType(@Param('id') id: string) {
    return this.documentsService.findOne(id);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiTags('Admin')
  @ApiOperation({
    summary: 'Lister tous les documents (Admin)',
    description: `Liste tous les documents uploadés avec possibilité de filtrer.

## ⚠️ Important :
**Seuls les CLIENTs ont des documents.** Les agents, superviseurs et administrateurs d'organisation n'ont pas de documents.

Cet endpoint retourne donc uniquement les documents des clients du système.

**Rôle requis : ADMIN uniquement**`
  })
  @ApiQuery({ 
    name: 'userId', 
    required: false, 
    description: 'Filtrer par ID utilisateur (doit être un CLIENT pour avoir des résultats)' 
  })
  @ApiQuery({ 
    name: 'type', 
    required: false, 
    enum: ['CARTE_IDENTITE', 'CERTIFICAT_NATIONALITE', 'EXTRAIT_NAISSANCE', 'PASSEPORT', 'PERMIS_CONDUIRE', 'AUTRE'],
    description: 'Filtrer par type de document' 
  })
  @ApiQuery({ 
    name: 'status', 
    required: false, 
    enum: ['EN_ATTENTE', 'VALIDE', 'REJETE', 'EN_VERIFICATION'],
    description: 'Filtrer par statut de vérification' 
  })
  @ApiQuery({ 
    name: 'isVerified', 
    required: false, 
    description: 'Filtrer par vérification (true/false)' 
  })
  @ApiResponse({
    status: 200,
    description: 'Liste de tous les documents (uniquement ceux des clients)',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'doc-123' },
          userId: { type: 'string', example: 'user-456', description: 'ID du client propriétaire' },
          user: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              email: { type: 'string' },
            },
            description: 'Informations du client propriétaire du document'
          },
          type: { 
            type: 'string', 
            enum: ['CARTE_IDENTITE', 'CERTIFICAT_NATIONALITE', 'EXTRAIT_NAISSANCE', 'PASSEPORT', 'PERMIS_CONDUIRE', 'AUTRE'],
            example: 'CARTE_IDENTITE'
          },
          fileName: { type: 'string', example: 'cni.pdf' },
          filePath: { type: 'string', example: 'uploads/documents/user-456/cni.pdf' },
          fileSize: { type: 'string', example: '2.5 MB' },
          mimeType: { type: 'string', example: 'application/pdf' },
          status: { 
            type: 'string', 
            enum: ['EN_ATTENTE', 'VALIDE', 'REJETE', 'EN_VERIFICATION'],
            example: 'VALIDE'
          },
          issueDate: { type: 'string', format: 'date', nullable: true, example: '2020-01-15' },
          expirationDate: { type: 'string', format: 'date', nullable: true, example: '2030-01-15' },
          rejectionReason: { type: 'string', nullable: true, description: 'Raison du rejet si status = REJETE' },
          isVerified: { type: 'boolean', example: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Accès refusé - Rôle ADMIN requis' })
  findAllDocuments(
    @Query('userId') userId?: string,
    @Query('type') type?: DocumentType,
    @Query('status') status?: DocumentStatus,
    @Query('isVerified') isVerified?: string,
  ) {
    const isVerifiedBool = isVerified === 'true' ? true : isVerified === 'false' ? false : undefined;
    return this.usersProfileService.findAllDocuments(userId, type, status, isVerifiedBool);
  }

  @Patch('types/:id')
  @Roles(UserRole.ADMIN)
  @ApiTags('Admin')
  @ApiOperation({ 
    summary: 'Modifier un type de document',
    description: 'Modifier les propriétés d\'un type de document (titre, durée de validité, vérification d\'identité, statut). **Rôle requis : ADMIN uniquement**'
  })
  @ApiParam({ name: 'id', description: 'ID du type de document' })
  @ApiResponse({ status: 200, description: 'Type de document modifié avec succès' })
  @ApiResponse({ status: 403, description: 'Accès refusé - Rôle ADMIN requis' })
  @ApiResponse({ status: 404, description: 'Type de document non trouvé' })
  updateType(@Param('id') id: string, @Body() updateDocumentTypeDto: UpdateDocumentTypeDto) {
    return this.documentsService.update(id, updateDocumentTypeDto);
  }

  @Patch('types/:id/status')
  @Roles(UserRole.ADMIN)
  @ApiTags('Admin')
  @ApiOperation({ 
    summary: 'Activer/Désactiver un type de document',
    description: 'Changer le statut d\'un type de document (actif/inactif). Un type de document inactif ne sera plus disponible pour les nouveaux formulaires. **Rôle requis : ADMIN uniquement**'
  })
  @ApiParam({ name: 'id', description: 'ID du type de document' })
  @ApiResponse({ 
    status: 200, 
    description: 'Statut du type de document mis à jour',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string', example: 'Carte d\'identité' },
        hasExpirationDate: { type: 'boolean', example: true },
        isForIdentityVerification: { type: 'boolean', example: true },
        isActive: { type: 'boolean', example: false },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Accès refusé - Rôle ADMIN requis' })
  @ApiResponse({ status: 404, description: 'Type de document non trouvé' })
  @ApiResponse({ status: 400, description: 'Données invalides - isActive doit être un boolean' })
  updateTypeStatus(@Param('id') id: string, @Body() updateStatusDto: UpdateDocumentTypeStatusDto) {
    return this.documentsService.updateStatus(id, updateStatusDto.isActive);
  }

  @Delete('types/:id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiTags('Admin')
  @ApiOperation({ 
    summary: 'Supprimer un type de document',
    description: 'Supprimer définitivement un type de document de la bibliothèque. **Rôle requis : ADMIN**'
  })
  @ApiParam({ name: 'id', description: 'ID du type de document' })
  @ApiResponse({ status: 204, description: 'Type de document supprimé avec succès' })
  @ApiResponse({ status: 403, description: 'Accès refusé - Rôle ADMIN requis' })
  @ApiResponse({ status: 404, description: 'Type de document non trouvé' })
  removeType(@Param('id') id: string) {
    return this.documentsService.remove(id);
  }
}



