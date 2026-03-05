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
} from '@nestjs/common';
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
import { OrganisationsService } from './organisations.service';
import { CreateOrganisationDto } from './dto/create-organisation.dto';
import { UpdateOrganisationDto } from './dto/update-organisation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrganisationRoles } from '../auth/decorators/organisation-roles.decorator';
import { OrganisationRoleGuard } from '../auth/guards/organisation-role.guard';
import { UserRole, OrganisationRole } from '../auth/dto/register.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NotificationDto } from '../users/dto/notification.dto';

@Controller('organisations')
@UseGuards(JwtAuthGuard, RolesGuard, OrganisationRoleGuard)
@ApiBearerAuth('JWT-auth')
export class OrganisationsController {
    constructor(private readonly organisationsService: OrganisationsService) { }

    @Get('create-options')
    @Roles(UserRole.ADMIN)
    @ApiTags('Admin')
    @ApiOperation({
        summary: 'Obtenir les options pour créer une organisation',
        description: `Retourne les secteurs disponibles depuis la base de données pour créer une organisation.

**Rôle requis : ADMIN**`
    })
    @ApiResponse({
        status: 200,
        description: 'Options pour créer une organisation',
        schema: {
            type: 'object',
            properties: {
                sectors: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            name: { type: 'string', example: 'Banque' },
                            description: { type: 'string', nullable: true },
                        },
                    },
                },
            },
        },
    })
    @ApiResponse({ status: 403, description: 'Accès refusé - Rôle ADMIN requis' })
    async getCreateOptions() {
        return this.organisationsService.getCreateOptions();
    }

    @Post()
    @Roles(UserRole.ADMIN)
    @HttpCode(HttpStatus.CREATED)
    @UseInterceptors(FileInterceptor('logo'))
    @ApiConsumes('multipart/form-data')
    @ApiTags('Admin')
    @ApiOperation({
        summary: 'Créer une nouvelle organisation',
        description: `Créer une nouvelle organisation avec logo. 

**Création de l'administrateur (optionnel) :** Si \`adminEmail\` est fourni, un utilisateur administrateur sera automatiquement créé avec cet email. Cet utilisateur aura le rôle \`ORGANISATION\` avec \`organisationRole: ADMINISTRATION\` et sera lié à l'organisation créée. Si \`adminEmail\` n'est pas fourni, aucune utilisateur ne sera créé.

**Mot de passe :** Si un administrateur est créé, vous pouvez fournir un mot de passe personnalisé via \`adminPassword\` (minimum 8 caractères avec majuscule, minuscule, chiffre et caractère spécial). Si non fourni, un mot de passe sécurisé sera généré automatiquement. Le mot de passe sera hashé avant stockage en base de données et envoyé en clair par email à l'administrateur avec son email et le nom de l'organisation.

**Important :** Le \`sectorId\` doit être un ID de secteur valide depuis la base de données. Utilisez \`GET /api/organisations/create-options\` ou \`GET /api/settings/sectors\` pour obtenir la liste des secteurs disponibles.

**Rôle requis : ADMIN**`
    })
    @ApiBody({
        schema: {
            type: 'object',
            required: ['sectorId', 'name'],
            properties: {
                sectorId: {
                    type: 'string',
                    format: 'uuid',
                    description: 'ID du secteur d\'activité (récupéré depuis GET /api/settings/sectors ou GET /api/forms/create-options)',
                    example: 'sector-uuid-123',
                },
                name: {
                    type: 'string',
                    description: 'Nom de l\'organisation',
                    example: 'Banque Populaire',
                },
                adminEmail: {
                    type: 'string',
                    format: 'email',
                    description: 'Email de l\'administrateur (optionnel). Si fourni, un utilisateur administrateur sera créé pour cette organisation.',
                    example: 'admin@organisation.com',
                },
                phone: {
                    type: 'string',
                    description: 'Numéro de téléphone',
                    example: '+221 77 123 45 67',
                },
                logo: {
                    type: 'string',
                    format: 'binary',
                    description: 'Logo de l\'organisation (JPG, PNG, max 5 MB)',
                },
                adminPassword: {
                    type: 'string',
                    description: 'Mot de passe de l\'administrateur (optionnel, min 8 caractères avec majuscule, minuscule, chiffre et caractère spécial). Si non fourni, un mot de passe sera généré automatiquement.',
                    example: 'AdminPass123!',
                    minLength: 8,
                },
            },
        },
    })
    @ApiResponse({
        status: 201,
        description: 'Organisation créée avec succès. Si adminEmail a été fourni, un utilisateur administrateur a été créé automatiquement.',
        schema: {
            type: 'object',
            properties: {
                organisation: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        sector: { type: 'string' },
                        adminEmail: { type: 'string', nullable: true },
                        phone: { type: 'string', nullable: true },
                        logo: { type: 'string', nullable: true },
                        isActive: { type: 'boolean' },
                        registrationDate: { type: 'string', format: 'date-time' },
                    },
                },
                adminUser: {
                    type: 'object',
                    nullable: true,
                    description: 'Utilisateur administrateur créé (présent seulement si adminEmail a été fourni)',
                    properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        email: { type: 'string' },
                        role: { type: 'string', example: 'ORGANISATION' },
                        organisationRole: { type: 'string', example: 'ADMINISTRATION' },
                        organisationId: { type: 'string' },
                    },
                },
                temporaryPassword: {
                    type: 'string',
                    nullable: true,
                    description: 'Mot de passe temporaire pour l\'administrateur (présent seulement si un utilisateur a été créé, à envoyer par email en production)',
                },
            },
        },
    })
    @ApiResponse({ status: 409, description: 'Email déjà utilisé' })
    @ApiResponse({ status: 403, description: 'Accès refusé - Rôle ADMIN requis' })
    async create(
        @Body() createOrganisationDto: CreateOrganisationDto,
        @UploadedFile() logo?: any,
    ) {
        if (logo) {
            // Sauvegarder le logo dans un dossier
            const logoPath = await this.organisationsService.saveLogo(logo);
            createOrganisationDto.logo = logoPath;
        }
        return this.organisationsService.create(createOrganisationDto);
    }

    @Get()
    @Roles(UserRole.ADMIN, UserRole.CLIENT)
    @OrganisationRoles(OrganisationRole.SUPERVISEUR, OrganisationRole.ADMINISTRATION)
    @ApiTags('Clients', 'Admin')
    @ApiOperation({
        summary: 'Obtenir la liste des organisations',
        description: 'Liste les organisations avec filtres optionnels. **Pour CLIENT:** Permet de sélectionner une organisation lors de la création d\'une demande. **Pour ADMIN/ORGANISATION:** Peut être utilisé pour rechercher une organisation lors de la création d\'un utilisateur. **Rôles autorisés:** ADMIN, CLIENT, ORGANISATION (avec SUPERVISEUR ou ADMINISTRATION)'
    })
    @ApiQuery({ name: 'sector', required: false, description: 'Filtrer par secteur (BANQUE, NOTAIRE, ASSURANCE, HUISSIER)' })
    @ApiQuery({ name: 'isActive', required: false, description: 'Filtrer par statut actif (true/false)' })
    @ApiQuery({ name: 'search', required: false, description: 'Rechercher par nom ou email' })
    @ApiResponse({ status: 200, description: 'Liste des organisations' })
    @ApiResponse({ status: 403, description: 'Accès refusé' })
    async findAll(
        @Query('sector') sector?: string,
        @Query('isActive') isActive?: string,
        @Query('search') search?: string,
    ) {
        const isActiveBool = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
        return this.organisationsService.findAll(sector, isActiveBool, search);
    }

    @Get(':id')
    @Roles(UserRole.ADMIN, UserRole.ORGANISATION)
    @OrganisationRoles(OrganisationRole.SUPERVISEUR, OrganisationRole.ADMINISTRATION)
    @ApiTags('Admin', 'Organisations')
    @ApiOperation({
        summary: 'Obtenir les détails d\'une organisation',
        description: 'Retourne les détails complets d\'une organisation avec ses utilisateurs, formulaires et demandes. **Pour ADMIN:** Permet de voir les détails de n\'importe quelle organisation. **Pour ORGANISATION:** Permet de voir les détails de leur propre organisation. **Rôles autorisés:** ADMIN, ORGANISATION (avec SUPERVISEUR ou ADMINISTRATION)'
    })
    @ApiParam({ name: 'id', description: 'ID de l\'organisation' })
    @ApiResponse({ status: 200, description: 'Détails de l\'organisation' })
    @ApiResponse({ status: 404, description: 'Organisation non trouvée' })
    @ApiResponse({ status: 403, description: 'Accès refusé' })
    async findOne(@Param('id') id: string) {
        return this.organisationsService.findOne(id);
    }

    @Patch(':id')
    @Roles(UserRole.ADMIN)
    @UseInterceptors(FileInterceptor('logo'))
    @ApiConsumes('multipart/form-data')
    @ApiTags('Admin')
    @ApiOperation({
        summary: 'Mettre à jour une organisation',
        description: 'Mettre à jour les informations d\'une organisation. Si un nouveau logo est fourni, l\'ancien sera remplacé. **Rôle requis : ADMIN**'
    })
    @ApiParam({ name: 'id', description: 'ID de l\'organisation' })
    @ApiResponse({ status: 200, description: 'Organisation mise à jour' })
    @ApiResponse({ status: 404, description: 'Organisation non trouvée' })
    async update(
        @Param('id') id: string,
        @Body() updateOrganisationDto: UpdateOrganisationDto,
        @UploadedFile() logo?: any,
    ) {
        if (logo) {
            // Sauvegarder le nouveau logo dans un dossier
            const logoPath = await this.organisationsService.saveLogo(logo);
            updateOrganisationDto.logo = logoPath;
        }
        return this.organisationsService.update(id, updateOrganisationDto);
    }

    @Delete(':id')
    @Roles(UserRole.ADMIN)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiTags('Admin')
    @ApiOperation({
        summary: 'Supprimer une organisation',
        description: 'Supprimer définitivement une organisation. **Rôle requis : ADMIN**'
    })
    @ApiParam({ name: 'id', description: 'ID de l\'organisation' })
    @ApiResponse({ status: 204, description: 'Organisation supprimée' })
    @ApiResponse({ status: 404, description: 'Organisation non trouvée' })
    async remove(@Param('id') id: string) {
        await this.organisationsService.remove(id);
    }

    @Post(':id/activate')
    @Roles(UserRole.ADMIN)
    @ApiTags('Admin')
    @ApiOperation({
        summary: 'Activer une organisation',
        description: 'Activer une organisation désactivée. **Rôle requis : ADMIN**'
    })
    @ApiParam({ name: 'id', description: 'ID de l\'organisation' })
    @ApiResponse({ status: 200, description: 'Organisation activée' })
    @ApiResponse({ status: 404, description: 'Organisation non trouvée' })
    async activate(@Param('id') id: string) {
        return this.organisationsService.activate(id);
    }

    @Post(':id/deactivate')
    @Roles(UserRole.ADMIN)
    @ApiTags('Admin')
    @ApiOperation({
        summary: 'Désactiver une organisation',
        description: 'Désactiver une organisation (elle ne pourra plus recevoir de demandes). **Rôle requis : ADMIN**'
    })
    @ApiParam({ name: 'id', description: 'ID de l\'organisation' })
    @ApiResponse({ status: 200, description: 'Organisation désactivée' })
    @ApiResponse({ status: 404, description: 'Organisation non trouvée' })
    async deactivate(@Param('id') id: string) {
        return this.organisationsService.deactivate(id);
    }

    @Get(':id/statistics')
    @Roles(UserRole.ADMIN, UserRole.ORGANISATION)
    @OrganisationRoles(OrganisationRole.SUPERVISEUR, OrganisationRole.ADMINISTRATION)
    @ApiTags('Admin', 'Organisations')
    @ApiOperation({
        summary: 'Obtenir les statistiques d\'une organisation',
        description: 'Retourne les statistiques complètes (demandes, utilisateurs, formulaires). **Pour ADMIN:** Permet de voir les statistiques de n\'importe quelle organisation. **Pour ORGANISATION:** Permet de voir les statistiques de leur propre organisation. **Rôles autorisés:** ADMIN, ORGANISATION (avec SUPERVISEUR ou ADMINISTRATION)'
    })
    @ApiParam({ name: 'id', description: 'ID de l\'organisation' })
    @ApiResponse({ status: 200, description: 'Statistiques de l\'organisation' })
    async getStatistics(@Param('id') id: string) {
        return this.organisationsService.getStatistics(id);
    }

    @Get(':id/dashboard/statistics')
    @Roles(UserRole.ADMIN, UserRole.ORGANISATION)
    @OrganisationRoles(OrganisationRole.AGENT, OrganisationRole.SUPERVISEUR, OrganisationRole.ADMINISTRATION)
    @ApiTags('Organisations')
    @ApiOperation({
        summary: 'Statistiques du dashboard (demandes uniquement)',
        description: 'Retourne uniquement les statistiques des demandes pour le dashboard (cartes de métriques). Exclut les brouillons et les demandes avec OTP non vérifié. **Rôles autorisés:** ADMIN, ORGANISATION (avec AGENT, SUPERVISEUR ou ADMINISTRATION)'
    })
    @ApiParam({ name: 'id', description: 'ID de l\'organisation' })
    @ApiResponse({ status: 200, description: 'Statistiques des demandes' })
    async getDashboardStatistics(@Param('id') id: string, @CurrentUser() user?: any) {
        // Vérifier que l'organisation peut voir ses propres statistiques
        if (user?.role === UserRole.ORGANISATION && user.organisationId !== id) {
            throw new BadRequestException('Vous ne pouvez voir que les statistiques de votre propre organisation');
        }
        const stats = await this.organisationsService.getStatistics(id);
        return stats.requests;
    }

    @Get(':id/dashboard/recent-requests')
    @Roles(UserRole.ADMIN, UserRole.ORGANISATION)
    @OrganisationRoles(OrganisationRole.AGENT, OrganisationRole.SUPERVISEUR, OrganisationRole.ADMINISTRATION)
    @ApiTags('Organisations')
    @ApiOperation({
        summary: 'Demandes récentes pour le dashboard',
        description: 'Retourne les demandes récentes de l\'organisation (par défaut, les 5 plus récentes). Exclut les brouillons et les demandes avec OTP non vérifié. **Rôles autorisés:** ADMIN, ORGANISATION (avec AGENT, SUPERVISEUR ou ADMINISTRATION)'
    })
    @ApiParam({ name: 'id', description: 'ID de l\'organisation' })
    @ApiQuery({ name: 'limit', required: false, description: 'Nombre de demandes à retourner (par défaut: 5)' })
    @ApiResponse({ status: 200, description: 'Liste des demandes récentes' })
    async getDashboardRecentRequests(
        @Param('id') id: string,
        @Query('limit') limit?: string,
        @CurrentUser() user?: any,
    ) {
        // Vérifier que l'organisation peut voir ses propres demandes
        if (user?.role === UserRole.ORGANISATION && user.organisationId !== id) {
            throw new BadRequestException('Vous ne pouvez voir que les demandes de votre propre organisation');
        }
        const limitNum = limit ? parseInt(limit, 10) : 5;
        return this.organisationsService.getRecentRequests(id, limitNum);
    }

    @Get(':id/dashboard/requests-by-type')
    @Roles(UserRole.ADMIN, UserRole.ORGANISATION)
    @OrganisationRoles(OrganisationRole.AGENT, OrganisationRole.SUPERVISEUR, OrganisationRole.ADMINISTRATION)
    @ApiTags('Organisations')
    @ApiOperation({
        summary: 'Requêtes par type (pour graphique)',
        description: 'Retourne les statistiques des demandes groupées par type de formulaire (pour afficher le graphique "Requêtes par type"). Exclut les brouillons et les demandes avec OTP non vérifié. **Rôles autorisés:** ADMIN, ORGANISATION (avec AGENT, SUPERVISEUR ou ADMINISTRATION)'
    })
    @ApiParam({ name: 'id', description: 'ID de l\'organisation' })
    @ApiResponse({ status: 200, description: 'Statistiques par type de demande' })
    async getDashboardRequestsByType(
        @Param('id') id: string,
        @CurrentUser() user?: any,
    ) {
        // Vérifier que l'organisation peut voir ses propres statistiques
        if (user?.role === UserRole.ORGANISATION && user.organisationId !== id) {
            throw new BadRequestException('Vous ne pouvez voir que les statistiques de votre propre organisation');
        }
        return this.organisationsService.getRequestsByType(id);
    }

    @Get(':id/dashboard/recent-activity')
    @Roles(UserRole.ADMIN, UserRole.ORGANISATION)
    @OrganisationRoles(OrganisationRole.AGENT, OrganisationRole.SUPERVISEUR, OrganisationRole.ADMINISTRATION)
    @ApiTags('Organisations')
    @ApiOperation({
        summary: 'Activité récente pour le dashboard',
        description: 'Retourne l\'activité récente de l\'organisation (soumissions, validations, traitements de demandes). Par défaut, les 10 dernières activités. **Rôles autorisés:** ADMIN, ORGANISATION (avec AGENT, SUPERVISEUR ou ADMINISTRATION)'
    })
    @ApiParam({ name: 'id', description: 'ID de l\'organisation' })
    @ApiQuery({ name: 'limit', required: false, description: 'Nombre d\'activités à retourner (par défaut: 10)' })
    @ApiResponse({ status: 200, description: 'Liste des activités récentes' })
    async getDashboardRecentActivity(
        @Param('id') id: string,
        @Query('limit') limit?: string,
        @CurrentUser() user?: any,
    ) {
        // Vérifier que l'organisation peut voir sa propre activité
        if (user?.role === UserRole.ORGANISATION && user.organisationId !== id) {
            throw new BadRequestException('Vous ne pouvez voir que l\'activité de votre propre organisation');
        }
        const limitNum = limit ? parseInt(limit, 10) : 10;
        return this.organisationsService.getRecentActivity(id, limitNum);
    }

    @Get(':id/requests')
    @Roles(UserRole.ADMIN, UserRole.ORGANISATION)
    @OrganisationRoles(OrganisationRole.AGENT, OrganisationRole.SUPERVISEUR, OrganisationRole.ADMINISTRATION)
    @ApiTags('Admin', 'Organisations')
    @ApiOperation({
        summary: 'Obtenir les demandes d\'une organisation',
        description: 'Liste toutes les demandes reçues par l\'organisation avec filtres. **Pour ADMIN:** Permet de voir toutes les demandes d\'une organisation spécifique. **Pour ORGANISATION:** Permet de voir les demandes de leur propre organisation. **Rôles autorisés:** ADMIN, ORGANISATION (avec AGENT, SUPERVISEUR ou ADMINISTRATION)'
    })
    @ApiParam({ name: 'id', description: 'ID de l\'organisation' })
    @ApiQuery({ name: 'status', required: false, description: 'Filtrer par statut (EN_ATTENTE, EN_COURS, VALIDEE, REJETEE)' })
    @ApiQuery({ name: 'formType', required: false, description: 'Filtrer par type de formulaire' })
    @ApiResponse({ status: 200, description: 'Liste des demandes' })
    async getRequests(
        @Param('id') id: string,
        @Query('status') status?: string,
        @Query('formType') formType?: string,
    ) {
        return this.organisationsService.getRequests(id, status as any, formType);
    }

    @Get(':id/users')
    @Roles(UserRole.ADMIN, UserRole.ORGANISATION)
    @OrganisationRoles(OrganisationRole.SUPERVISEUR, OrganisationRole.ADMINISTRATION)
    @ApiTags('Admin', 'Organisations')
    @ApiOperation({
        summary: 'Obtenir les employés d\'une organisation',
        description: 'Liste tous les **employés** (AGENT, SUPERVISEUR, ADMINISTRATION) de l\'organisation. **Pour ADMIN:** Permet de voir tous les employés d\'une organisation spécifique. **Pour ORGANISATION:** Permet de voir les employés de leur propre organisation. **Note:** Les clients (CLIENT) ne sont pas inclus dans cette liste. **Rôles autorisés:** ADMIN, ORGANISATION (avec SUPERVISEUR ou ADMINISTRATION)'
    })
    @ApiParam({ name: 'id', description: 'ID de l\'organisation' })
    @ApiQuery({ name: 'status', required: false, description: 'Filtrer par statut (active/inactive)' })
    @ApiQuery({ name: 'role', required: false, description: 'Filtrer par rôle organisation (AGENT, SUPERVISEUR, ADMINISTRATION)' })
    @ApiResponse({ status: 200, description: 'Liste des utilisateurs' })
    async getUsers(
        @Param('id') id: string,
        @Query('status') status?: string,
        @Query('role') role?: string,
    ) {
        return this.organisationsService.getUsers(id, status, role);
    }

    @Get(':id/forms')
    @Roles(UserRole.ADMIN, UserRole.ORGANISATION)
    @OrganisationRoles(OrganisationRole.AGENT, OrganisationRole.SUPERVISEUR, OrganisationRole.ADMINISTRATION)
    @ApiTags('Admin', 'Organisations')
    @ApiOperation({
        summary: 'Obtenir les formulaires disponibles d\'une organisation',
        description: 'Liste tous les formulaires créés pour l\'organisation avec leurs détails (champs modifiables, documents requis, statut). **Pour ADMIN:** Permet de voir tous les formulaires d\'une organisation spécifique. **Pour ORGANISATION:** Permet de voir les formulaires de leur propre organisation. **Rôles autorisés:** ADMIN, ORGANISATION (avec AGENT, SUPERVISEUR ou ADMINISTRATION)'
    })
    @ApiParam({ name: 'id', description: 'ID de l\'organisation' })
    @ApiQuery({ name: 'status', required: false, description: 'Filtrer par statut (ONLINE, OFFLINE, DRAFT)' })
    @ApiQuery({ name: 'sector', required: false, description: 'Filtrer par secteur (BANQUE, NOTAIRE, ASSURANCE, HUISSIER)' })
    @ApiResponse({
        status: 200,
        description: 'Liste des formulaires avec détails complets',
        schema: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    name: { type: 'string', example: 'Demande de virement' },
                    version: { type: 'string', example: '2.1' },
                    formType: { type: 'string', example: 'TRANSACTION' },
                    status: { type: 'string', example: 'ONLINE' },
                    editableFields: {
                        type: 'array',
                        description: 'Champs modifiables du formulaire',
                        items: { type: 'object' },
                    },
                    requiredDocuments: {
                        type: 'array',
                        description: 'IDs des documents requis',
                        items: { type: 'string' },
                    },
                    createdAt: { type: 'string', format: 'date-time' },
                },
            },
        },
    })
    async getForms(
        @Param('id') id: string,
        @Query('status') status?: string,
        @Query('sector') sector?: string,
    ) {
        return this.organisationsService.getForms(id, status as any, sector);
    }

    @Get(':id/notifications')
    @Roles(UserRole.ADMIN, UserRole.ORGANISATION)
    @OrganisationRoles(OrganisationRole.AGENT, OrganisationRole.SUPERVISEUR, OrganisationRole.ADMINISTRATION)
    @ApiTags('Organisations')
    @ApiOperation({
        summary: 'Obtenir les notifications pour l\'organisation',
        description: `Retourne toutes les notifications pertinentes pour l'organisation.
Les notifications incluent :
- Demandes en attente de traitement pour cette organisation
- Demandes validées récemment
- Documents en attente de vérification pour les clients de l'organisation
- Documents expirant bientôt pour les clients de l'organisation

**Pour ADMIN:** Permet de voir les notifications de n'importe quelle organisation.
**Pour ORGANISATION:** Permet de voir les notifications de leur propre organisation.

**Rôles autorisés:** ADMIN, ORGANISATION (avec AGENT, SUPERVISEUR ou ADMINISTRATION)`
    })
    @ApiParam({ name: 'id', description: 'ID de l\'organisation' })
    @ApiQuery({
        name: 'unreadOnly',
        required: false,
        type: Boolean,
        description: 'Retourner uniquement les notifications non lues (true/false)',
    })
    @ApiResponse({
        status: 200,
        description: 'Liste des notifications',
        type: [NotificationDto],
    })
    @ApiResponse({ status: 403, description: 'Accès refusé' })
    async getNotifications(
        @Param('id') id: string,
        @Query('unreadOnly') unreadOnly?: string,
        @CurrentUser() user?: any,
    ): Promise<NotificationDto[]> {
        // Vérifier que l'organisation peut voir ses propres notifications
        if (user?.role === UserRole.ORGANISATION && user.organisationId !== id) {
            throw new BadRequestException('Vous ne pouvez voir que les notifications de votre propre organisation');
        }

        const unreadOnlyBool = unreadOnly === 'true';
        return this.organisationsService.getOrganisationNotifications(id, unreadOnlyBool);
    }
}

