import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  HttpException,
  StreamableFile,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UsersService } from './users.service';
import { UsersProfileService } from './users-profile.service';
import { RequestsService } from '../requests/requests.service';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateOrganisationUserDto } from './dto/create-organisation-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { UploadIdentityDocumentDto } from './dto/upload-identity-document.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrganisationRoles } from '../auth/decorators/organisation-roles.decorator';
import { OrganisationRoleGuard } from '../auth/guards/organisation-role.guard';
import { UserRole, OrganisationRole } from '../auth/dto/register.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { RequestStatus } from '../requests/entities/request.entity';
import { DocumentStatus } from './entities/user-document.entity';
import { MinioService } from '../storage/minio.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly usersProfileService: UsersProfileService,
    private readonly requestsService: RequestsService,
    private readonly minioService: MinioService,
  ) { }

  @Post()
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiTags('Admin')
  @ApiOperation({
    summary: 'Créer un utilisateur d\'organisation (Admin)',
    description: 'Créer un utilisateur pour une organisation avec un mot de passe temporaire. **L\'admin ne peut créer que des employés d\'organisations (AGENT, SUPERVISEUR, ADMINISTRATION), pas de clients.**\n\n**📋 Champs requis :**\n- `name`: Nom complet de l\'utilisateur\n- `email`: Email de l\'utilisateur\n- `organisationId`: ID de l\'organisation (obligatoire)\n- `organisationRole`: **Type/Rôle de l\'utilisateur** (`AGENT`, `SUPERVISEUR`, `ADMINISTRATION`) - **OBLIGATOIRE**\n\n**📋 Champs automatiques (ne pas fournir) :**\n- `role`: **Automatiquement** `"ORGANISATION"`\n- `type`: **Automatiquement** déduit du secteur de l\'organisation (BANQUE, NOTAIRE, ASSURANCE, HUISSIER)\n\n**💡 Explication :**\n- L\'admin choisit le **type/rôle** de l\'employé : AGENT, SUPERVISEUR ou ADMINISTRATION\n- Le `type` (secteur d\'activité) est automatiquement déterminé selon l\'organisation sélectionnée\n- Le `role` (niveau application) est automatiquement `"ORGANISATION"`\n\n**⚠️ Important :**\n- Les clients s\'inscrivent eux-mêmes via `/api/auth/register`\n- Le champ `type` est ignoré s\'il est fourni (sera remplacé par le secteur de l\'organisation)\n- Le champ `role` est ignoré s\'il est fourni (sera forcé à `"ORGANISATION"`)\n\n**Rôle requis:** ADMIN uniquement'
  })
  @ApiResponse({
    status: 201,
    description: 'Utilisateur créé avec succès',
    schema: {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string' },
            role: { type: 'string' },
            organisationId: { type: 'string' },
            organisationRole: { type: 'string' },
          },
        },
        temporaryPassword: {
          type: 'string',
          description: 'Mot de passe temporaire (à envoyer par email en production)',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Requête invalide - organisationId obligatoire ou tentative de créer un client' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  @ApiResponse({ status: 409, description: 'Email déjà utilisé' })
  @ApiResponse({ status: 404, description: 'Organisation non trouvée' })
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Post('organisation')
  @Roles(UserRole.ORGANISATION)
  @UseGuards(JwtAuthGuard, RolesGuard, OrganisationRoleGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiTags('Organisations')
  @ApiOperation({
    summary: 'Créer un utilisateur pour l\'organisation',
    description: 'Créer un utilisateur pour votre organisation. L\'utilisateur sera automatiquement lié à votre organisation avec le rôle sélectionné (Agent, Superviseur, Administration).\n\n**Rôle requis:** ORGANISATION (avec organisationId dans le token)\n\n**Note importante:**\n- Le `type` de l\'utilisateur est automatiquement déduit du `sector` de votre organisation\n- Vous n\'avez pas besoin de fournir `type` ni `organisationId` dans le body\n- Si vous êtes ADMIN, utilisez l\'endpoint POST /api/users à la place\n\n**Rôles disponibles:**\n- **Agent:** Consulter et traiter les demandes\n- **Superviseur:** + Validation finale + Supervision de l\'équipe\n- **Administration:** + Gérer les utilisateurs de l\'organisation'
  })
  @ApiBody({ type: CreateOrganisationUserDto })
  @ApiResponse({
    status: 201,
    description: 'Utilisateur créé avec succès',
    schema: {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' },
            role: { type: 'string', example: 'ORGANISATION' },
            organisationId: { type: 'string' },
            organisationRole: { type: 'string', enum: ['AGENT', 'SUPERVISEUR', 'ADMINISTRATION'] },
            isActive: { type: 'boolean' },
          },
        },
        temporaryPassword: {
          type: 'string',
          description: 'Mot de passe temporaire (à envoyer par email en production)',
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Accès refusé - Rôle ORGANISATION requis' })
  @ApiResponse({ status: 409, description: 'Email déjà utilisé' })
  @ApiResponse({ status: 404, description: 'Organisation non trouvée' })
  async createOrganisationUser(
    @Body() createUserDto: CreateOrganisationUserDto,
    @CurrentUser() user: any,
  ) {
    // L'organisationId est automatiquement celui de l'utilisateur connecté
    if (!user.organisationId) {
      throw new BadRequestException(
        'Vous devez être lié à une organisation pour créer un utilisateur. ' +
        'Si vous êtes ADMIN, utilisez l\'endpoint POST /api/users à la place. ' +
        'Si vous êtes ORGANISATION, vérifiez que votre compte a bien un organisationId dans la base de données.'
      );
    }
    return this.usersService.createOrganisationUser(createUserDto, user.organisationId);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.ORGANISATION)
  @OrganisationRoles(OrganisationRole.SUPERVISEUR, OrganisationRole.ADMINISTRATION)
  @UseGuards(JwtAuthGuard, RolesGuard, OrganisationRoleGuard)
  @ApiTags('Admin', 'Organisations')
  @ApiOperation({
    summary: 'Obtenir la liste de tous les utilisateurs',
    description: 'Liste tous les utilisateurs (clients + employés + admin) avec filtres optionnels. **Pour ADMIN:** Permet de voir tous les utilisateurs du système. **Pour ORGANISATION:** Permet de voir tous les utilisateurs (utile pour la gestion globale). **Note:** Pour obtenir uniquement les employés d\'une organisation spécifique, utilisez `GET /api/organisations/:id/users`. **Rôles autorisés:** ADMIN, ORGANISATION (avec SUPERVISEUR ou ADMINISTRATION)'
  })
  @ApiQuery({ name: 'status', required: false, description: 'Filtrer par statut (active/inactive)' })
  @ApiQuery({ name: 'type', required: false, description: 'Filtrer par type (NOTAIRE, BANQUE, ASSURANCE, HUISSIER, CLIENT)' })
  @ApiQuery({ name: 'role', required: false, description: 'Filtrer par rôle application (ADMIN, ORGANISATION, CLIENT)' })
  @ApiResponse({
    status: 200,
    description: 'Liste des utilisateurs',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string' },
          role: { type: 'string', enum: ['ADMIN', 'ORGANISATION', 'CLIENT'] },
          type: { type: 'string', enum: ['NOTAIRE', 'BANQUE', 'ASSURANCE', 'HUISSIER', 'CLIENT'], nullable: true },
          organisationRole: { type: 'string', enum: ['AGENT', 'SUPERVISEUR', 'ADMINISTRATION'], nullable: true },
          organisationId: { type: 'string', nullable: true },
          isActive: { type: 'boolean' },
          isEmailVerified: { type: 'boolean' },
          lastLogin: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  findAll(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('role') role?: string,
  ) {
    return this.usersService.findAll(status, type, role);
  }

  @Get('statistics')
  @Roles(UserRole.ADMIN)
  @OrganisationRoles(OrganisationRole.SUPERVISEUR, OrganisationRole.ADMINISTRATION)
  @UseGuards(JwtAuthGuard, RolesGuard, OrganisationRoleGuard)
  @ApiTags('Admin')
  @ApiOperation({
    summary: 'Obtenir les statistiques des utilisateurs',
    description: 'Retourne les statistiques globales des utilisateurs. **Rôles autorisés:** ADMIN, SUPERVISEUR (organisation), ADMINISTRATION (organisation)'
  })
  @ApiResponse({ status: 200, description: 'Statistiques des utilisateurs' })
  async getStatistics() {
    return this.usersService.getStatistics();
  }

  @Get('admin/documents/:documentId/file')
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiTags('Admin')
  @ApiOperation({
    summary: 'Fichier d’un document (admin – vérifications)',
    description: 'Retourne le fichier d’un document pour affichage dans la page de vérification. **Rôle requis : ADMIN**',
  })
  @ApiParam({ name: 'documentId', description: 'ID du document (UserDocument)' })
  @ApiResponse({ status: 200, description: 'Fichier binaire' })
  @ApiResponse({ status: 404, description: 'Document non trouvé' })
  async getDocumentFileAdmin(@Param('documentId') documentId: string) {
    const { buffer, mimeType } = await this.usersProfileService.getDocumentFileForAdmin(documentId);
    return new StreamableFile(buffer, { type: mimeType });
  }

  @Get('admin/identity-documents/:documentId/file')
  @Roles(UserRole.ADMIN, UserRole.ORGANISATION)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiTags('Admin')
  @ApiOperation({
    summary: 'Fichier d’un document d’identité (recto/verso/selfie)',
    description: 'Retourne le fichier pour affichage dans la vérification. **Rôles : ADMIN, ORGANISATION**',
  })
  @ApiParam({ name: 'documentId', description: 'ID du document d’identité (UserIdentityDocument)' })
  @ApiResponse({ status: 200, description: 'Fichier binaire' })
  @ApiResponse({ status: 404, description: 'Document non trouvé' })
  async getIdentityDocumentFileAdmin(@Param('documentId') documentId: string) {
    const { buffer, mimeType } = await this.usersProfileService.getIdentityDocumentFileForAdmin(documentId);
    return new StreamableFile(buffer, { type: mimeType });
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.ORGANISATION)
  @OrganisationRoles(OrganisationRole.SUPERVISEUR, OrganisationRole.ADMINISTRATION)
  @UseGuards(JwtAuthGuard, RolesGuard, OrganisationRoleGuard)
  @ApiTags('Admin', 'Organisations')
  @ApiOperation({
    summary: 'Obtenir les détails d\'un utilisateur',
    description: 'Retourne les détails complets d\'un utilisateur. **Pour ADMIN:** Permet de voir les détails de n\'importe quel utilisateur. **Pour ORGANISATION:** Permet de voir les détails des utilisateurs de leur organisation. **Rôles autorisés:** ADMIN, ORGANISATION (avec SUPERVISEUR ou ADMINISTRATION)'
  })
  @ApiParam({ name: 'id', description: 'ID de l\'utilisateur' })
  @ApiResponse({ status: 200, description: 'Détails de l\'utilisateur' })
  @ApiResponse({ status: 404, description: 'Utilisateur non trouvé' })
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Get(':id/overview')
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiTags('Admin')
  @ApiOperation({
    summary: 'Obtenir la vue d\'ensemble d\'un utilisateur',
    description: 'Retourne la vue d\'ensemble complète d\'un utilisateur incluant ses statistiques (demandes, documents, etc.). **Rôle requis : ADMIN**'
  })
  @ApiParam({ name: 'id', description: 'ID de l\'utilisateur' })
  @ApiResponse({
    status: 200,
    description: 'Vue d\'ensemble de l\'utilisateur',
    schema: {
      type: 'object',
      properties: {
        user: { type: 'object', description: 'Informations de l\'utilisateur' },
        statistics: {
          type: 'object',
          properties: {
            requests: {
              type: 'object',
              properties: {
                total: { type: 'number' },
                pending: { type: 'number' },
                inProgress: { type: 'number' },
                validated: { type: 'number' },
                rejected: { type: 'number' },
              },
            },
            documents: {
              type: 'object',
              properties: {
                total: { type: 'number' },
                validated: { type: 'number' },
                pending: { type: 'number' },
                rejected: { type: 'number' },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Utilisateur non trouvé' })
  async getUserOverview(@Param('id') id: string) {
    const user = await this.usersService.findOne(id);
    const requests = await this.requestsService.findByClient(id);
    const documents = await this.usersProfileService.getUserDocuments(id);

    // Statistiques des demandes
    const requestStats = {
      total: requests.length,
      pending: requests.filter((r) => r.status === RequestStatus.EN_ATTENTE).length,
      inProgress: requests.filter((r) => r.status === RequestStatus.EN_COURS).length,
      validated: requests.filter((r) => r.status === RequestStatus.VALIDEE).length,
      rejected: requests.filter((r) => r.status === RequestStatus.REJETEE).length,
    };

    // Statistiques des documents
    const documentStats = {
      total: documents.length,
      validated: documents.filter((d) => d.status === DocumentStatus.VALIDE).length,
      pending: documents.filter((d) => d.status === DocumentStatus.EN_ATTENTE).length,
      rejected: documents.filter((d) => d.status === DocumentStatus.REJETE).length,
    };

    return {
      user: {
        id: user.id,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        type: user.type,
        organisationRole: user.organisationRole,
        organisationId: user.organisationId,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
      },
      statistics: {
        requests: requestStats,
        documents: documentStats,
      },
    };
  }

  @Get(':id/requests')
  @Roles(UserRole.ADMIN, UserRole.CLIENT, UserRole.ORGANISATION)
  @UseGuards(JwtAuthGuard, RolesGuard, OrganisationRoleGuard)
  @ApiTags('Admin', 'Clients', 'Organisations')
  @ApiOperation({
    summary: 'Obtenir les demandes d\'un utilisateur',
    description: `Liste les demandes selon le **rôle** de l'utilisateur. La logique est automatiquement adaptée :

##  Logique par rôle :

###   **CLIENT**
Retourne **ses propres demandes** (qu'il a créées)
- Critère : \`clientId = userId\`
- Cas d'usage : Voir l'historique de ses demandes

###   **AGENT** (Organisation)
Retourne **les demandes qu'il a traitées** (qu'il a démarrées)
- Critère : \`processedBy = userId\`
- Cas d'usage : Voir son travail, les demandes qu'il a prises en charge
- Note : Le champ \`processedBy\` est rempli automatiquement lors de \`POST /api/requests/{id}/start\`

###   **SUPERVISEUR** (Organisation)
Retourne :
- Les demandes qu'il a **validées** (\`validatedBy = userId\`)
- **PLUS** toutes les demandes de son organisation (\`organisationId = user.organisationId\`)
- Cas d'usage : Voir ses validations + superviser toutes les demandes de l'organisation
- Note : Le champ \`validatedBy\` est rempli automatiquement lors de \`POST /api/requests/{id}/validate\`

###   **ADMINISTRATION** (Organisation)
Retourne **toutes les demandes de son organisation**
- Critère : \`organisationId = user.organisationId\`
- Cas d'usage : Vue globale de toutes les demandes reçues par l'organisation

###  **ADMIN** (Système)
Par défaut, retourne les demandes du client (pour compatibilité)

##  Flux de traitement :
1. **Client** crée une demande → \`status = "EN_ATTENTE"\`, \`clientId = userId\`
2. **Agent** démarre le traitement → \`status = "EN_COURS"\`, \`processedBy = agentId\`
3. **Superviseur** valide → \`status = "VALIDEE"\`, \`validatedBy = supervisorId\`

**Rôles autorisés:** ADMIN, CLIENT, ORGANISATION`
  })
  @ApiParam({
    name: 'id',
    description: 'ID de l\'utilisateur. La logique de retour dépend automatiquement du rôle de cet utilisateur.'
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['EN_ATTENTE', 'EN_COURS', 'VALIDEE', 'REJETEE'],
    description: 'Filtrer par statut de la demande'
  })
  @ApiQuery({
    name: 'formType',
    required: false,
    description: 'Filtrer par type de formulaire (TRANSACTION, DEMANDE, DECLARATION, RESILIATION)'
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des demandes selon le rôle de l\'utilisateur',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'req-123' },
          requestNumber: { type: 'string', example: 'DEM-992' },
          formName: { type: 'string', example: 'Demande de virement' },
          formType: { type: 'string', enum: ['TRANSACTION', 'DEMANDE', 'DECLARATION', 'RESILIATION'] },
          status: { type: 'string', enum: ['EN_ATTENTE', 'EN_COURS', 'VALIDEE', 'REJETEE'] },
          clientId: { type: 'string', description: 'ID du client qui a créé la demande' },
          clientName: { type: 'string', example: 'Moussa Ndiaye' },
          organisationId: { type: 'string', description: 'ID de l\'organisation qui traite la demande' },
          organisationName: { type: 'string', example: 'Banque Populaire' },
          processedBy: { type: 'string', nullable: true, description: 'ID de l\'agent qui a traité la demande' },
          validatedBy: { type: 'string', nullable: true, description: 'ID du superviseur qui a validé la demande' },
          submittedAt: { type: 'string', format: 'date-time' },
          processedAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Utilisateur non trouvé'
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé - Rôle non autorisé'
  })
  async getUserRequests(
    @Param('id') id: string,
    @Query('status') status?: string,
    @Query('formType') formType?: string,
  ) {
    // Récupérer l'utilisateur pour connaître son rôle
    const user = await this.usersService.findOne(id);

    // Logique selon le rôle
    if (user.role === UserRole.CLIENT) {
      // CLIENT : Ses propres demandes
      return this.requestsService.findByClient(id, status, formType);
    } else if (user.role === UserRole.ORGANISATION && user.organisationId) {
      // Utilisateur d'organisation
      if (user.organisationRole === OrganisationRole.AGENT) {
        // AGENT : Demandes qu'il a traitées
        return this.requestsService.findByProcessor(id, status, formType);
      } else if (user.organisationRole === OrganisationRole.SUPERVISEUR) {
        // SUPERVISEUR : Demandes qu'il a validées + toutes les demandes de l'organisation
        return this.requestsService.findBySupervisor(id, user.organisationId, status, formType);
      } else if (user.organisationRole === OrganisationRole.ADMINISTRATION) {
        // ADMINISTRATION : Toutes les demandes de l'organisation
        return this.requestsService.findByOrganisation(user.organisationId, status, formType);
      }
    }

    // Par défaut (ADMIN ou cas non géré) : retourner les demandes du client
    return this.requestsService.findByClient(id, status, formType);
  }

  @Get('admin/:id/documents')
  @Roles(UserRole.ADMIN, UserRole.CLIENT, UserRole.ORGANISATION)
  @UseGuards(JwtAuthGuard, RolesGuard, OrganisationRoleGuard)
  @ApiTags('Admin', 'Clients', 'Organisations')
  @ApiOperation({
    summary: 'Obtenir les documents d\'un utilisateur',
    description: `Liste les documents d'un utilisateur. **Important : Seuls les CLIENTs ont des documents.**

##  Logique par rôle :

###   **CLIENT**
Peut voir **ses propres documents** uniquement
- Critère : \`userId = id\` (l'ID doit correspondre à l'utilisateur connecté)
- Cas d'usage : Consulter ses documents uploadés, vérifier leur statut

### 🔧 **AGENT / 👔 SUPERVISEUR / 🏢 ADMINISTRATION** (Organisation)
Peuvent voir **les documents des clients** (pour vérification)
- Critère : L'utilisateur ciblé doit être un CLIENT
- Cas d'usage : Vérifier les documents d'un client lors du traitement d'une demande
- Note : Si l'utilisateur ciblé n'est pas un CLIENT, retourne un tableau vide

### 🔑 **ADMIN** (Système)
Peut voir **les documents de n'importe quel utilisateur**
- Cas d'usage : Administration, audit, support

## ⚠️ Important :
- **Seuls les CLIENTs peuvent avoir des documents** (upload de documents)
- Les agents, superviseurs et administrateurs d'organisation **n'ont pas de documents**
- Si vous interrogez les documents d'un agent/superviseur/admin, vous obtiendrez un tableau vide

**Rôles autorisés:** ADMIN, CLIENT, ORGANISATION`
  })
  @ApiParam({
    name: 'id',
    description: 'ID de l\'utilisateur. Pour les CLIENTs, doit correspondre à l\'utilisateur connecté. Pour les ORGANISATION, peut être l\'ID d\'un client.'
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des documents de l\'utilisateur (vide si l\'utilisateur n\'est pas un CLIENT)',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'doc-123' },
          userId: { type: 'string', example: 'user-456', description: 'ID du client propriétaire du document' },
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
  @ApiResponse({
    status: 404,
    description: 'Utilisateur non trouvé'
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé - Un CLIENT ne peut voir que ses propres documents'
  })
  async getUserDocumentsById(@Param('id') id: string, @CurrentUser() currentUser: User) {
    // Vérifier que l'utilisateur existe
    const user = await this.usersService.findOne(id);

    // Si l'utilisateur ciblé n'est pas un CLIENT, retourner un tableau vide
    // (car seuls les clients ont des documents)
    if (user.role !== UserRole.CLIENT) {
      return [];
    }

    // Si c'est un CLIENT qui demande ses propres documents, vérifier l'accès
    if (currentUser.role === UserRole.CLIENT && currentUser.id !== id) {
      throw new ForbiddenException('Vous ne pouvez voir que vos propres documents');
    }

    // Retourner avec URLs d'aperçu présignées pour l'admin (miniatures)
    return this.usersProfileService.getUserDocumentsWithPreviews(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.ORGANISATION)
  @UseGuards(JwtAuthGuard, RolesGuard, OrganisationRoleGuard)
  @UseInterceptors(FileInterceptor('profilePicture'))
  @ApiConsumes('multipart/form-data')
  @ApiTags('Admin', 'Organisations')
  @ApiOperation({
    summary: 'Mettre à jour un utilisateur',
    description: 'Mettre à jour les informations d\'un utilisateur, y compris sa photo de profil. **Rôles autorisés:** ADMIN, ORGANISATION'
  })
  @ApiParam({ name: 'id', description: 'ID de l\'utilisateur' })
  @ApiResponse({ status: 200, description: 'Utilisateur mis à jour' })
  @ApiResponse({ status: 404, description: 'Utilisateur non trouvé' })
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @UploadedFile() profilePicture?: any,
  ) {
    if (profilePicture) {
      // Sauvegarder la photo de profil dans un dossier
      const profilePicturePath = await this.usersService.saveProfilePicture(id, profilePicture);
      // Ajouter le chemin de la photo au DTO
      (updateUserDto as any).profilePicture = profilePicturePath;
    }
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiTags('Admin')
  @ApiOperation({
    summary: 'Supprimer un utilisateur',
    description: 'Supprimer définitivement un utilisateur. **Rôle requis : ADMIN**'
  })
  @ApiParam({ name: 'id', description: 'ID de l\'utilisateur' })
  @ApiResponse({ status: 204, description: 'Utilisateur supprimé' })
  @ApiResponse({ status: 404, description: 'Utilisateur non trouvé' })
  async remove(@Param('id') id: string) {
    await this.usersService.remove(id);
  }

  @Post(':id/activate')
  @Roles(UserRole.ADMIN, UserRole.ORGANISATION)
  @UseGuards(JwtAuthGuard, RolesGuard, OrganisationRoleGuard)
  @ApiTags('Admin', 'Organisations')
  @ApiOperation({
    summary: 'Activer un utilisateur',
    description: 'Activer un utilisateur désactivé. **Rôles autorisés:** ADMIN, ORGANISATION'
  })
  @ApiParam({ name: 'id', description: 'ID de l\'utilisateur' })
  @ApiResponse({ status: 200, description: 'Utilisateur activé' })
  @ApiResponse({ status: 404, description: 'Utilisateur non trouvé' })
  async activate(@Param('id') id: string) {
    return this.usersService.activate(id);
  }

  @Post(':id/deactivate')
  @Roles(UserRole.ADMIN, UserRole.ORGANISATION)
  @UseGuards(JwtAuthGuard, RolesGuard, OrganisationRoleGuard)
  @ApiTags('Admin', 'Organisations')
  @ApiOperation({
    summary: 'Désactiver un utilisateur',
    description: 'Désactiver un utilisateur (il ne pourra plus se connecter). **Rôles autorisés:** ADMIN, ORGANISATION'
  })
  @ApiParam({ name: 'id', description: 'ID de l\'utilisateur' })
  @ApiResponse({ status: 200, description: 'Utilisateur désactivé' })
  @ApiResponse({ status: 404, description: 'Utilisateur non trouvé' })
  async deactivate(@Param('id') id: string) {
    return this.usersService.deactivate(id);
  }

  // ========== Endpoints pour la complétion du profil client ==========

  @Get('profile/document-types')
  @Roles(UserRole.CLIENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiTags('Clients')
  @ApiOperation({
    summary: 'Obtenir les types de documents disponibles',
    description: `Retourne tous les types de documents créés par l'admin et disponibles pour upload.

Chaque type indique :
- Si il est requis pour compléter l'inscription
- Si il a une date d'expiration
- Si il sert à vérifier l'identité
- Le type enum correspondant pour l'upload

**Rôle requis : CLIENT**`,
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des types de documents disponibles',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'doc-type-123' },
          title: { type: 'string', example: 'Carte d\'identité' },
          hasExpirationDate: { type: 'boolean', example: true },
          isForIdentityVerification: { type: 'boolean', example: true },
          mappedType: { type: 'string', enum: ['CARTE_IDENTITE', 'CERTIFICAT_NATIONALITE', 'EXTRAIT_NAISSANCE', 'AUTRE'] },
          isRequired: { type: 'boolean', example: true },
        },
      },
    },
  })
  async getAvailableDocumentTypes(@CurrentUser() user: any) {
    return this.usersProfileService.getAvailableDocumentTypes();
  }

  @Get('profile/completion')
  @Roles(UserRole.CLIENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiTags('Clients')
  @ApiOperation({
    summary: 'Obtenir le pourcentage de complétion du profil',
    description: `Retourne le pourcentage de complétion du profil basé sur les documents requis définis par l'admin.

**Calcul de la complétion :**
- **50%** après inscription (base)
- **+50%** répartis progressivement sur les documents requis

**Exemple avec 3 documents requis :**
- 0 document uploadé : **50%**
- 1 document uploadé : **66.67%** (50% + 16.67%)
- 2 documents uploadés : **83.33%** (50% + 33.33%)
- 3 documents uploadés : **100%** (50% + 50%)

**Important :**
- La complétion augmente dès qu'un document est uploadé (même en attente de validation)
- Chaque document requis ajoute : **50% ÷ nombre de documents requis**
- Les documents requis sont ceux définis par l'admin dans les paramètres de sécurité

**Rôle requis : CLIENT**`,
  })
  @ApiResponse({
    status: 200,
    description: 'Informations de complétion du profil',
    schema: {
      type: 'object',
      properties: {
        completion: { type: 'number', example: 50 },
        requiredDocuments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              label: { type: 'string' },
              isUploaded: { type: 'boolean' },
              status: { type: 'string', nullable: true },
              documentId: { type: 'string', nullable: true },
              uploadedAt: { type: 'string', nullable: true },
            },
          },
        },
        uploadedDocuments: { type: 'array' },
      },
    },
  })
  async getProfileCompletion(@CurrentUser() user: any) {
    return this.usersProfileService.getProfileCompletionInfo(user.userId);
  }

  @Post('profile/documents')
  @Roles(UserRole.CLIENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiTags('Clients')
  @ApiOperation({
    summary: 'Uploader un document pour compléter le profil',
    description: `Upload un document. Le client ne peut uploader QUE les types de documents créés par l'admin.

**Important :**
- Utilisez \`GET /api/users/profile/document-types\` pour voir les types disponibles
- Utilisez l'\`id\` du type de document (pas l'enum)
- Seuls les types de documents actifs créés par l'admin sont acceptés

**Rôle requis : CLIENT**`,
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'documentTypeId'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Fichier à uploader (PDF, JPG, PNG, max 10 MB)',
        },
        documentTypeId: {
          type: 'string',
          format: 'uuid',
          description: 'ID du type de document créé par l\'admin (obligatoire)',
          example: 'doc-type-123',
        },
        issueDate: {
          type: 'string',
          description: 'Date de délivrance (jj/mm/aaaa) - Optionnel',
        },
        expirationDate: {
          type: 'string',
          description: 'Date d\'expiration (jj/mm/aaaa) - Optionnel',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Document uploadé avec succès',
  })
  @ApiResponse({ status: 400, description: 'Fichier invalide ou trop volumineux' })
  async uploadDocument(
    @CurrentUser() user: any,
    @UploadedFile() file: any,
    @Body() uploadDto: UploadDocumentDto,
  ) {
    if (!file) {
      throw new Error('Fichier requis');
    }
    return this.usersProfileService.uploadDocument(user.userId, file, uploadDto);
  }

  @Get('profile/documents')
  @Roles(UserRole.CLIENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiTags('Clients')
  @ApiOperation({
    summary: 'Récupérer tous les documents du profil',
    description: 'Liste tous les documents uploadés par l\'utilisateur. **Rôle requis : CLIENT**',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des documents',
  })
  async getUserDocuments(@CurrentUser() user: any) {
    return this.usersProfileService.getUserDocumentsWithPreviews(user.userId);
  }

  @Get('profile/documents/:documentId/file')
  @Roles(UserRole.CLIENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiTags('Clients')
  @ApiOperation({
    summary: 'Fichier d’un document (aperçu)',
    description: 'Retourne le fichier pour affichage (miniature). **Rôle requis : CLIENT**',
  })
  @ApiParam({ name: 'documentId', description: 'ID du document' })
  @ApiResponse({ status: 200, description: 'Fichier binaire' })
  @ApiResponse({ status: 404, description: 'Document non trouvé' })
  async getDocumentFile(@CurrentUser() user: any, @Param('documentId') documentId: string) {
    const { buffer, mimeType } = await this.usersProfileService.getDocumentFile(user.userId, documentId);
    return new StreamableFile(buffer, { type: mimeType });
  }

  @Delete('profile/documents/:documentId')
  @Roles(UserRole.CLIENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiTags('Clients')
  @ApiOperation({
    summary: 'Supprimer un document',
    description: 'Supprime un document du profil. **Rôle requis : CLIENT**',
  })
  @ApiParam({ name: 'documentId', description: 'ID du document' })
  @ApiResponse({ status: 204, description: 'Document supprimé' })
  @ApiResponse({ status: 404, description: 'Document non trouvé' })
  async deleteDocument(@CurrentUser() user: any, @Param('documentId') documentId: string) {
    await this.usersProfileService.deleteDocument(user.userId, documentId);
    return { message: 'Document supprimé avec succès' };
  }

  @Post('profile/identity-documents')
  @Roles(UserRole.CLIENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiConsumes('multipart/form-data')
  @ApiTags('Clients')
  @ApiOperation({
    summary: 'Upload document d’identité (recto, verso ou selfie)',
    description: 'Upload un des 3 documents pour la vérification d’identité. **Ne fait pas partie des types de documents du profil.** kind = RECTO | VERSO | SELFIE. **Rôle : CLIENT**',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'kind'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'Fichier (JPG, PNG, PDF, max 10 MB)' },
        kind: { type: 'string', enum: ['RECTO', 'VERSO', 'SELFIE'], description: 'Slot : recto CNI, verso CNI ou selfie' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Document d’identité uploadé' })
  @ApiResponse({ status: 400, description: 'Fichier invalide ou kind invalide' })
  async uploadIdentityDocument(
    @CurrentUser() user: any,
    @UploadedFile() file: any,
    @Body() dto: UploadIdentityDocumentDto,
  ) {
    if (!file) throw new BadRequestException('Fichier requis');
    if (!dto?.kind || !['RECTO', 'VERSO', 'SELFIE'].includes(dto.kind)) {
      throw new BadRequestException('kind est requis : RECTO, VERSO ou SELFIE');
    }
    const userId = user?.userId ?? user?.sub ?? user?.id;
    if (!userId) throw new BadRequestException('Utilisateur non identifié');
    try {
      return await this.usersProfileService.uploadIdentityDocument(userId, file, dto.kind);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException({
        message: 'Erreur lors de l\'upload du document d\'identité.',
        error: err?.message ?? String(err),
      });
    }
  }

  @Get('profile/identity-documents')
  @Roles(UserRole.CLIENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiTags('Clients')
  @ApiOperation({
    summary: 'Liste des documents d’identité (recto, verso, selfie)',
    description: 'Retourne les 3 slots éventuellement uploadés. **Rôle : CLIENT**',
  })
  @ApiResponse({ status: 200, description: 'Liste des documents d’identité' })
  async getIdentityDocuments(@CurrentUser() user: any) {
    return this.usersProfileService.getIdentityDocuments(user.userId);
  }

  @Get('profile/identity-documents/:documentId/file')
  @Roles(UserRole.CLIENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiTags('Clients')
  @ApiOperation({
    summary: 'Fichier d’un document d’identité (aperçu)',
    description: 'Retourne le fichier pour affichage. **Rôle : CLIENT**',
  })
  @ApiParam({ name: 'documentId', description: 'ID du document d’identité' })
  @ApiResponse({ status: 200, description: 'Fichier binaire' })
  @ApiResponse({ status: 404, description: 'Document non trouvé' })
  async getIdentityDocumentFile(
    @CurrentUser() user: any,
    @Param('documentId') documentId: string,
  ) {
    const { buffer, mimeType } = await this.usersProfileService.getIdentityDocumentFile(user.userId, documentId);
    return new StreamableFile(buffer, { type: mimeType });
  }

  @Get('me/profile-picture')
  @Roles(UserRole.CLIENT, UserRole.ADMIN, UserRole.ORGANISATION)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiTags('Clients', 'Admin', 'Organisations')
  @ApiOperation({
    summary: 'Récupérer ma photo de profil (blob)',
    description: 'Retourne la photo de profil de l’utilisateur connecté (si elle existe).',
  })
  @ApiResponse({ status: 200, description: 'Fichier image' })
  @ApiResponse({ status: 404, description: 'Aucune photo de profil' })
  async getMyProfilePicture(@CurrentUser() user: any) {
    const u = await this.usersService.findOne(user.userId);
    const rel = (u as any)?.profilePicture as string | undefined;
    if (!rel || !rel.startsWith('profiles/')) {
      throw new HttpException('Aucune photo de profil', 404);
    }
    const fileName = path.basename(rel);
    const fullPath = path.join(process.cwd(), 'uploads', 'profiles', fileName);
    let buffer: Buffer | null = null;
    if (fs.existsSync(fullPath)) {
      buffer = fs.readFileSync(fullPath);
    } else {
      // Fallback MinIO (si stockage disque non persistant)
      try {
        buffer = await this.minioService.getFile(rel);
      } catch (_) {
        buffer = null;
      }
    }
    if (!buffer) {
      throw new HttpException('Fichier introuvable', 404);
    }
    const ext = path.extname(fileName).toLowerCase();
    const mimeType =
      ext === '.png' ? 'image/png' :
      ext === '.webp' ? 'image/webp' :
      'image/jpeg';
    return new StreamableFile(buffer, { type: mimeType });
  }

  @Patch('me/profile')
  @Roles(UserRole.CLIENT, UserRole.ADMIN, UserRole.ORGANISATION)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseInterceptors(FileInterceptor('profilePicture'))
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth('JWT-auth')
  @ApiTags('Clients', 'Admin', 'Organisations')
  @ApiOperation({
    summary: 'Mettre à jour mon profil (route non ambiguë)',
    description: 'Même logique que PATCH /users/profile, mais évite le conflit avec PATCH /users/:id. **Rôles : CLIENT, ADMIN, ORGANISATION**',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        phone: { type: 'string' },
        email: { type: 'string' },
        address: { type: 'string' },
        maritalStatus: { type: 'string' },
        profilePicture: { type: 'string', format: 'binary' },
      },
    },
  })
  async updateMyProfile(
    @CurrentUser() user: any,
    @Body() updateProfileDto: UpdateProfileDto,
    @UploadedFile() profilePicture?: any,
  ) {
    if (profilePicture) {
      const profilePicturePath = await this.usersService.saveProfilePicture(user.userId, profilePicture);
      (updateProfileDto as any).profilePicture = profilePicturePath;
    }
    return this.usersService.updateProfile(user.userId, updateProfileDto);
  }

  @Patch('profile')
  @Roles(UserRole.CLIENT, UserRole.ADMIN, UserRole.ORGANISATION)
  // IMPORTANT: le client doit pouvoir modifier son propre profil.
  // OrganisationRoleGuard ne doit pas s'appliquer ici (sinon blocage des CLIENT).
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseInterceptors(FileInterceptor('profilePicture'))
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth('JWT-auth')
  @ApiTags('Clients', 'Admin', 'Organisations')
  @ApiOperation({
    summary: 'Mettre à jour mon profil',
    description: 'Permet à un utilisateur de mettre à jour ses informations personnelles (prénom, nom, téléphone, email, adresse, situation matrimoniale) et sa photo de profil. **Rôles autorisés : CLIENT, ADMIN, ORGANISATION**'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        phone: { type: 'string' },
        email: { type: 'string' },
        address: { type: 'string' },
        maritalStatus: { type: 'string' },
        profilePicture: {
          type: 'string',
          format: 'binary',
          description: 'Photo de profil (JPG, PNG, WEBP, max 5 MB)',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Profil mis à jour avec succès' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  @ApiResponse({ status: 409, description: 'Email déjà utilisé' })
  async updateProfile(
    @CurrentUser() user: any,
    @Body() updateProfileDto: UpdateProfileDto,
    @UploadedFile() profilePicture?: any,
  ) {
    if (profilePicture) {
      // Sauvegarder la photo de profil dans un dossier
      const profilePicturePath = await this.usersService.saveProfilePicture(user.userId, profilePicture);
      // Ajouter le chemin de la photo au DTO
      (updateProfileDto as any).profilePicture = profilePicturePath;
    }
    return this.usersService.updateProfile(user.userId, updateProfileDto);
  }

  @Patch('profile/documents/:id')
  @Roles(UserRole.CLIENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiTags('Clients')
  @ApiOperation({
    summary: 'Modifier un document',
    description: 'Modifier les dates de délivrance et/ou d\'expiration d\'un document existant. Le fichier n\'est pas modifié. Si le document était validé, il repasse en attente de validation. **Rôle requis : CLIENT**'
  })
  @ApiParam({ name: 'id', description: 'ID du document' })
  @ApiBody({ type: UpdateDocumentDto })
  @ApiResponse({ status: 200, description: 'Document modifié avec succès' })
  @ApiResponse({ status: 403, description: 'Accès refusé - Rôle CLIENT requis' })
  @ApiResponse({ status: 404, description: 'Document non trouvé' })
  async updateDocument(
    @Param('id') documentId: string,
    @CurrentUser() user: any,
    @Body() updateDocumentDto: UpdateDocumentDto,
  ) {
    return this.usersProfileService.updateDocument(user.userId, documentId, updateDocumentDto);
  }

}

