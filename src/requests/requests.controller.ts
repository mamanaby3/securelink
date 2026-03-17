import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
  Patch,
  ForbiddenException,
  BadRequestException,
  UploadedFile,
  UseInterceptors,
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
import { RequestsService } from './requests.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { SaveDraftRequestDto } from './dto/save-draft-request.dto';
import { RejectRequestDto } from './dto/reject-request.dto';
import { RequestAdditionalDocumentsDto } from './dto/request-additional-documents.dto';
import { VerifyRequestOtpDto } from './dto/verify-request-otp.dto';
import { UpdateRequestEmailDto } from './dto/update-request-email.dto';
import { RequestStatus } from './entities/request.entity';
import { RequestStatisticsDto } from './dto/request-statistics.dto';
import { JwtOrUploadTokenGuard } from './guards/jwt-or-upload-token.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrganisationRoles } from '../auth/decorators/organisation-roles.decorator';
import { OrganisationRoleGuard } from '../auth/guards/organisation-role.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole, OrganisationRole } from '../auth/dto/register.dto';

@Controller('requests')
@UseGuards(JwtOrUploadTokenGuard, RolesGuard, OrganisationRoleGuard)
@ApiBearerAuth('JWT-auth')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) { }

  @Post('draft')
  @Roles(UserRole.CLIENT)
  @HttpCode(HttpStatus.CREATED)
  @ApiTags('Clients')
  @ApiOperation({
    summary: 'Sauvegarder un brouillon de demande (processus par étapes)',
    description: `Sauvegarde ou met à jour un brouillon de demande lors du processus de création par étapes.

**Processus par étapes :**
1. **Étape 1 : Organisation** - Le client sélectionne une organisation
2. **Étape 2 : Formulaire** - Le client sélectionne un formulaire et le remplit
3. **Étape 3 : Documents** - Le client vérifie les documents requis
4. **Soumission** - Le client soumet la demande via \`POST /api/requests/:id/submit\`

**Utilisation :**
- Pour créer un nouveau brouillon : \`POST /api/requests/draft\` (sans \`draftId\`)
- Pour mettre à jour un brouillon existant : \`POST /api/requests/draft?draftId={id}\`

**Les brouillons sont visibles dans "Mes archives"**

**Rôle requis : CLIENT**`
  })
  @ApiQuery({
    name: 'draftId',
    required: false,
    description: 'ID du brouillon existant à mettre à jour (optionnel)'
  })
  @ApiResponse({
    status: 201,
    description: 'Brouillon sauvegardé avec succès',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        requestNumber: { type: 'string', example: 'DEM-992' },
        status: { type: 'string', example: 'BROUILLON' },
        currentStep: { type: 'number', example: 2, description: 'Étape actuelle (1, 2 ou 3)' },
        message: { type: 'string', example: 'Brouillon sauvegardé avec succès' },
      },
    },
  })
  async saveDraft(
    @Body() draftDto: SaveDraftRequestDto,
    @CurrentUser() user: any,
    @Query('draftId') draftId?: string,
  ) {
    const draft = await this.requestsService.saveDraft(user.userId, draftDto, draftId);

    // Déterminer l'étape actuelle
    let currentStep = 1;
    if (draft.organisationId) currentStep = 2;
    if (draft.formId && draft.formData) currentStep = 3;

    return {
      ...draft,
      currentStep,
      message: 'Brouillon sauvegardé avec succès. Vous pouvez continuer plus tard.',
    };
  }

  @Post(':id/submit')
  @Roles(UserRole.CLIENT)
  @HttpCode(HttpStatus.OK)
  @ApiTags('Clients')
  @ApiOperation({
    summary: 'Soumettre une demande (finaliser le brouillon)',
    description: `Soumet une demande en brouillon. Le processus est le suivant :

1. **Vérification des documents requis** : Le système vérifie automatiquement que le client a tous les documents requis

2. **Génération et envoi d'OTP** : Un code OTP de 6 chiffres est généré et envoyé par email au client

3. **Vérification OTP requise** : La demande passe en statut EN_ATTENTE mais nécessite la vérification de l'OTP via \`POST /api/requests/:id/verify-otp\` pour être finalisée

**Rôle requis : CLIENT**`
  })
  @ApiParam({ name: 'id', description: 'ID du brouillon à soumettre' })
  @ApiResponse({
    status: 200,
    description: 'Demande soumise avec succès. Un code OTP a été envoyé par email.',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        requestNumber: { type: 'string', example: 'DEM-992' },
        status: { type: 'string', example: 'EN_ATTENTE' },
        otpVerified: { type: 'boolean', example: false },
        verificationEmail: { type: 'string', example: 'client@email.com' },
        message: { type: 'string', example: 'Un code OTP de 6 chiffres a été envoyé à votre adresse email' },
      },
    },
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Documents requis manquants ou non validés, formulaire non disponible, ou demande déjà soumise',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { 
          type: 'string', 
          example: 'Vous devez avoir tous les documents requis validés pour soumettre cette demande. Documents manquants ou non validés : Carte d\'identité, Contrat de travail. Veuillez uploader et faire valider ces documents avant de soumettre votre demande.' 
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Brouillon non trouvé' })
  async submitRequest(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body('verificationEmail') verificationEmail?: string,
  ) {
    const userId = user?.userId ?? user?.sub;
    if (!userId) {
      throw new ForbiddenException('Utilisateur non identifié');
    }
    // Vérifier que le client ne peut soumettre que ses propres brouillons
    const draft = await this.requestsService.findOne(id);
    if (draft.clientId !== userId) {
      throw new ForbiddenException('Vous ne pouvez soumettre que vos propres demandes');
    }

    const request = await this.requestsService.submitRequest(id, verificationEmail);

    return {
      ...request,
      message: `Un code OTP de 6 chiffres a été envoyé à ${request.verificationEmail ?? 'votre adresse'}. Veuillez le vérifier pour finaliser votre demande.`,
    };
  }

  @Post()
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiTags('Clients')
  @ApiOperation({
    summary: 'Créer une nouvelle demande (méthode directe - dépréciée; sinon on peut l utiliser )',
    description: `⚠️ **Méthode dépréciée** : Utilisez plutôt le processus par étapes :
- \`POST /api/requests/draft\` pour sauvegarder un brouillon
- \`POST /api/requests/:id/submit\` pour soumettre le brouillon

Cette méthode crée directement une demande soumise (ancien comportement).

**Rôles requis : CLIENT, ADMIN**`
  })
  @ApiResponse({
    status: 201,
    description: 'Demande créée avec succès. Un code OTP a été envoyé par email.',
  })
  @ApiResponse({ status: 400, description: 'Documents requis manquants ou formulaire non disponible' })
  async create(
    @Body() createRequestDto: CreateRequestDto,
    @CurrentUser() user: any,
    @Body('verificationEmail') verificationEmail?: string,
  ) {
    // Pour les clients, utiliser automatiquement leur ID depuis le token
    if (user.role === UserRole.CLIENT) {
      createRequestDto.clientId = user.userId;
    }

    const request = await this.requestsService.create(createRequestDto, verificationEmail);

    return {
      ...request,
      message: `Un code OTP de 6 chiffres a été envoyé à ${request.verificationEmail}. Veuillez le vérifier pour finaliser votre demande.`,
    };
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.ORGANISATION, UserRole.CLIENT)
  @OrganisationRoles(OrganisationRole.AGENT, OrganisationRole.SUPERVISEUR, OrganisationRole.ADMINISTRATION)
  @ApiTags('Clients', 'Organisations')
  @ApiOperation({
    summary: 'Obtenir la liste des demandes',
    description: '**Pour CLIENT:** Retourne uniquement les demandes du client connecté.\n**Pour ORGANISATION:** Retourne les demandes de leur organisation.\n**Pour ADMIN:** Retourne toutes les demandes.\n**Rôles autorisés:** ADMIN, ORGANISATION (avec AGENT/SUPERVISEUR/ADMINISTRATION), CLIENT'
  })
  @ApiQuery({ name: 'organisationId', required: false, description: 'Filtrer par organisation (ADMIN uniquement)' })
  @ApiQuery({ name: 'status', required: false, description: 'Filtrer par statut (EN_ATTENTE, EN_COURS, VALIDEE, REJETEE)' })
  @ApiQuery({ name: 'formType', required: false, description: 'Filtrer par type de formulaire' })
  @ApiQuery({ name: 'page', required: false, description: 'Numéro de page (1-based), pour pagination client' })
  @ApiQuery({ name: 'limit', required: false, description: 'Nombre par page (défaut 10)' })
  @ApiQuery({ name: 'search', required: false, description: 'Recherche (numéro, formulaire, organisation)' })
  @ApiResponse({ status: 200, description: 'Liste des demandes (ou { items, total, page, limit } pour client avec pagination)' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  async findAll(
    @Query('organisationId') organisationId?: string,
    @Query('status') status?: string,
    @Query('formType') formType?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @CurrentUser() user?: any,
  ) {
    // Pour les clients : liste paginée avec recherche
    if (user?.role === UserRole.CLIENT) {
      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 10));
      const { items, total } = await this.requestsService.findByClientPaginated(user.userId, {
        page: pageNum,
        limit: limitNum,
        search: search || undefined,
        status: status || undefined,
        formType: formType || undefined,
      });
      return { items, total, page: pageNum, limit: limitNum };
    }

    // Pour les organisations, filtrer par leur organisation
    if (user?.role === UserRole.ORGANISATION && user.organisationId) {
      return await this.requestsService.findByOrganisation(user.organisationId, status, formType);
    }

    // Pour ADMIN ou si organisationId est spécifié
    if (organisationId) {
      return this.requestsService.findByOrganisation(organisationId, status, formType);
    }

    return this.requestsService.findAll(status, formType);
  }

  @Get('statistics')
  @Roles(UserRole.ADMIN, UserRole.ORGANISATION, UserRole.CLIENT)
  @OrganisationRoles(OrganisationRole.AGENT, OrganisationRole.SUPERVISEUR, OrganisationRole.ADMINISTRATION)
  @ApiTags('Clients', 'Organisations')
  @ApiOperation({
    summary: 'Obtenir les statistiques des demandes',
    description: '**Pour CLIENT:** Statistiques de ses propres demandes uniquement.\n**Pour ORGANISATION:** Statistiques des demandes de leur organisation.\n**Pour ADMIN:** Statistiques de toutes les demandes.\nRetourne le total, en attente, en cours, validées et rejetées'
  })
  @ApiResponse({ status: 200, description: 'Statistiques des demandes', type: RequestStatisticsDto })
  getStatistics(@CurrentUser() user?: any) {
    // Pour les clients, statistiques de leurs demandes uniquement
    if (user?.role === UserRole.CLIENT) {
      return this.requestsService.getClientStatistics(user.userId);
    }

    // Pour les organisations, statistiques de leur organisation
    if (user?.role === UserRole.ORGANISATION && user.organisationId) {
      return this.requestsService.getOrganisationStatistics(user.organisationId);
    }

    // Pour ADMIN, toutes les statistiques
    return this.requestsService.getStatistics();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.ORGANISATION, UserRole.CLIENT)
  @OrganisationRoles(OrganisationRole.AGENT, OrganisationRole.SUPERVISEUR, OrganisationRole.ADMINISTRATION)
  @ApiTags('Clients', 'Organisations')
  @ApiOperation({
    summary: 'Obtenir les détails d\'une demande',
    description: '**Pour CLIENT:** Peut uniquement voir ses propres demandes.\n**Pour ORGANISATION:** Peut voir les demandes de leur organisation.\n**Pour ADMIN:** Peut voir toutes les demandes.'
  })
  @ApiParam({ name: 'id', description: 'ID de la demande' })
  @ApiResponse({ status: 200, description: 'Détails de la demande' })
  @ApiResponse({ status: 403, description: 'Accès refusé - Vous ne pouvez pas voir cette demande' })
  @ApiResponse({ status: 404, description: 'Demande non trouvée' })
  async findOne(@Param('id') id: string, @CurrentUser() user?: any) {
    const request = await this.requestsService.findOne(id);

    // Vérifier les permissions
    if (user?.role === UserRole.CLIENT && request.clientId !== user.userId) {
      throw new ForbiddenException('Vous ne pouvez pas voir cette demande');
    }

    if (user?.role === UserRole.ORGANISATION && request.organisationId !== user.organisationId) {
      throw new ForbiddenException('Vous ne pouvez pas voir cette demande');
    }

    return request;
  }

  @Get('draft/:id')
  @Roles(UserRole.CLIENT)
  @ApiTags('Clients')
  @ApiOperation({
    summary: 'Récupérer un brouillon de demande',
    description: `Récupère les détails d'un brouillon de demande pour continuer le processus de création par étapes.

**Rôle requis : CLIENT**`
  })
  @ApiParam({ name: 'id', description: 'ID du brouillon' })
  @ApiResponse({
    status: 200,
    description: 'Détails du brouillon',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        requestNumber: { type: 'string', nullable: true },
        status: { type: 'string', example: 'BROUILLON' },
        organisationId: { type: 'string', nullable: true },
        formId: { type: 'string', nullable: true },
        formData: { type: 'object', nullable: true },
        beneficiary: { type: 'object', nullable: true },
        amount: { type: 'number', nullable: true },
        currentStep: { type: 'number', example: 2, description: 'Étape actuelle (1, 2 ou 3)' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Brouillon non trouvé' })
  @ApiResponse({ status: 403, description: 'Accès refusé - Vous ne pouvez voir que vos propres brouillons' })
  async getDraft(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    const draft = await this.requestsService.findOne(id);

    // Vérifier que c'est bien un brouillon du client
    if (draft.clientId !== user.userId) {
      throw new ForbiddenException('Vous ne pouvez voir que vos propres brouillons');
    }

    if (draft.status !== RequestStatus.BROUILLON) {
      throw new BadRequestException('Cette demande n\'est pas un brouillon');
    }

    // Déterminer l'étape actuelle
    let currentStep = 1;
    if (draft.organisationId) currentStep = 2;
    if (draft.formId && draft.formData) currentStep = 3;

    return {
      ...draft,
      currentStep,
    };
  }

  @Delete('draft/:id')
  @Roles(UserRole.CLIENT)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiTags('Clients')
  @ApiOperation({
    summary: 'Supprimer un brouillon de demande',
    description: `Supprime un brouillon de demande non soumis.

**Rôle requis : CLIENT**`
  })
  @ApiParam({ name: 'id', description: 'ID du brouillon à supprimer' })
  @ApiResponse({ status: 204, description: 'Brouillon supprimé avec succès' })
  @ApiResponse({ status: 404, description: 'Brouillon non trouvé' })
  @ApiResponse({ status: 403, description: 'Accès refusé - Vous ne pouvez supprimer que vos propres brouillons' })
  @ApiResponse({ status: 400, description: 'Impossible de supprimer une demande déjà soumise' })
  async deleteDraft(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    const draft = await this.requestsService.findOne(id);

    // Vérifier que c'est bien un brouillon du client
    if (draft.clientId !== user.userId) {
      throw new ForbiddenException('Vous ne pouvez supprimer que vos propres brouillons');
    }

    if (draft.status !== RequestStatus.BROUILLON) {
      throw new BadRequestException('Impossible de supprimer une demande déjà soumise');
    }

    await this.requestsService.remove(id);
  }

  @Post(':id/verify-otp')
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiTags('Clients')
  @ApiOperation({
    summary: 'Vérifier le code OTP d\'une demande',
    description: `Vérifie le code OTP de 6 chiffres reçu par email pour finaliser la soumission de la demande.

**Processus :**
1. Le client soumet une demande → reçoit un code OTP par email
2. Le client vérifie le code OTP via cet endpoint
3. Une fois vérifié, la demande est finalisée et peut être traitée par l'organisation

**Rôles requis : CLIENT, ADMIN**`
  })
  @ApiParam({ name: 'id', description: 'ID de la demande' })
  @ApiResponse({
    status: 200,
    description: 'Code OTP vérifié avec succès. La demande est maintenant finalisée.',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Code OTP vérifié avec succès. Votre demande a été finalisée.' },
        request: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            requestNumber: { type: 'string' },
            otpVerified: { type: 'boolean', example: true },
            status: { type: 'string', example: 'EN_ATTENTE' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Code OTP incorrect, expiré ou déjà vérifié' })
  @ApiResponse({ status: 404, description: 'Demande non trouvée' })
  async verifyOtp(
    @Param('id') id: string,
    @Body() verifyOtpDto: VerifyRequestOtpDto,
    @CurrentUser() user: any,
  ) {
    // Vérifier que le client ne peut vérifier que ses propres demandes
    const request = await this.requestsService.findOne(id);
    if (user.role === UserRole.CLIENT && request.clientId !== user.userId) {
      throw new ForbiddenException('Vous ne pouvez vérifier que vos propres demandes');
    }

    const verifiedRequest = await this.requestsService.verifyOtp(id, verifyOtpDto.otp);

    return {
      message: 'Code OTP vérifié avec succès. Votre demande a été finalisée et sera traitée par l\'organisation.',
      request: {
        id: verifiedRequest.id,
        requestNumber: verifiedRequest.requestNumber,
        otpVerified: verifiedRequest.otpVerified,
        status: verifiedRequest.status,
      },
    };
  }

  @Patch(':id/update-email')
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiTags('Clients')
  @ApiOperation({
    summary: 'Modifier l\'adresse email pour recevoir le code OTP',
    description: `Modifie l'adresse email utilisée pour recevoir le code OTP et envoie un nouveau code à la nouvelle adresse.

**Rôles requis : CLIENT, ADMIN**`
  })
  @ApiParam({ name: 'id', description: 'ID de la demande' })
  @ApiResponse({
    status: 200,
    description: 'Email modifié avec succès. Un nouveau code OTP a été envoyé.',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Email modifié avec succès. Un nouveau code OTP a été envoyé.' },
        verificationEmail: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Demande déjà vérifiée ou email invalide' })
  @ApiResponse({ status: 404, description: 'Demande non trouvée' })
  async updateEmail(
    @Param('id') id: string,
    @Body() updateEmailDto: UpdateRequestEmailDto,
    @CurrentUser() user: any,
  ) {
    // Vérifier que le client ne peut modifier que ses propres demandes
    const request = await this.requestsService.findOne(id);
    if (user.role === UserRole.CLIENT && request.clientId !== user.userId) {
      throw new ForbiddenException('Vous ne pouvez modifier que vos propres demandes');
    }

    const updatedRequest = await this.requestsService.updateVerificationEmail(id, updateEmailDto.email);

    return {
      message: `Email modifié avec succès. Un nouveau code OTP a été envoyé à ${updateEmailDto.email}.`,
      verificationEmail: updatedRequest.verificationEmail,
    };
  }

  @Post(':id/resend-otp')
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiTags('Clients')
  @ApiOperation({
    summary: 'Renvoyer le code OTP',
    description: `Renvoie un nouveau code OTP de 6 chiffres à l'adresse email de vérification.

**Rôles requis : CLIENT, ADMIN**`
  })
  @ApiParam({ name: 'id', description: 'ID de la demande' })
  @ApiResponse({
    status: 200,
    description: 'Code OTP renvoyé avec succès',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Un nouveau code OTP a été envoyé à votre adresse email.' },
        verificationEmail: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Demande déjà vérifiée ou aucun email de vérification' })
  @ApiResponse({ status: 404, description: 'Demande non trouvée' })
  async resendOtp(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    // Vérifier que le client ne peut renvoyer l'OTP que pour ses propres demandes
    const request = await this.requestsService.findOne(id);
    if (user.role === UserRole.CLIENT && request.clientId !== user.userId) {
      throw new ForbiddenException('Vous ne pouvez renvoyer l\'OTP que pour vos propres demandes');
    }

    const updatedRequest = await this.requestsService.resendOtp(id);

    return {
      message: `Un nouveau code OTP a été envoyé à ${updatedRequest.verificationEmail}.`,
      verificationEmail: updatedRequest.verificationEmail,
    };
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.ORGANISATION)
  @OrganisationRoles(OrganisationRole.AGENT, OrganisationRole.SUPERVISEUR, OrganisationRole.ADMINISTRATION)
  @ApiTags('Organisations')
  @ApiOperation({
    summary: 'Mettre à jour le statut d\'une demande',
    description: '**Rôles requis :** ADMIN, ORGANISATION (avec AGENT/SUPERVISEUR/ADMINISTRATION)'
  })
  @ApiParam({ name: 'id', description: 'ID de la demande' })
  @ApiResponse({ status: 200, description: 'Statut mis à jour' })
  async updateStatus(@Param('id') id: string, @Body('status') status: RequestStatus) {
    return this.requestsService.updateStatus(id, status);
  }

  @Post(':id/start')
  @Roles(UserRole.ADMIN, UserRole.ORGANISATION)
  @OrganisationRoles(OrganisationRole.AGENT, OrganisationRole.SUPERVISEUR, OrganisationRole.ADMINISTRATION)
  @ApiTags('Organisations')
  @ApiOperation({
    summary: 'Démarrer le processus de traitement d\'une demande',
    description: 'Passe la demande de "EN_ATTENTE" à "EN_COURS". Le demandeur sera notifié. **Rôles requis :** ADMIN, ORGANISATION (avec AGENT/SUPERVISEUR/ADMINISTRATION)'
  })
  @ApiParam({ name: 'id', description: 'ID de la demande' })
  @ApiResponse({ status: 200, description: 'Processus démarré avec succès' })
  @ApiResponse({ status: 400, description: 'La demande doit être en attente' })
  @ApiResponse({ status: 404, description: 'Demande non trouvée' })
  startProcess(@Param('id') id: string, @CurrentUser() user: any) {
    return this.requestsService.startProcess(id, user.userId);
  }

  @Post(':id/validate')
  @Roles(UserRole.ADMIN, UserRole.ORGANISATION)
  @OrganisationRoles(OrganisationRole.SUPERVISEUR, OrganisationRole.ADMINISTRATION)
  @ApiTags('Organisations')
  @ApiOperation({
    summary: 'Valider une demande',
    description: 'Valider définitivement une demande. Le demandeur sera notifié par email. **Rôles requis :** ADMIN, ORGANISATION (avec SUPERVISEUR ou ADMINISTRATION)'
  })
  @ApiParam({ name: 'id', description: 'ID de la demande' })
  @ApiResponse({ status: 200, description: 'Demande validée avec succès' })
  @ApiResponse({ status: 404, description: 'Demande non trouvée' })
  async validate(@Param('id') id: string, @CurrentUser() user: any) {
    return this.requestsService.validate(id, user.userId);
  }

  @Post(':id/reject')
  @Roles(UserRole.ADMIN, UserRole.ORGANISATION)
  @OrganisationRoles(OrganisationRole.SUPERVISEUR, OrganisationRole.ADMINISTRATION)
  @ApiTags('Organisations')
  @ApiOperation({
    summary: 'Rejeter une demande',
    description: 'Rejeter une demande avec un motif. Le demandeur recevra cette information par email. **Rôles requis :** ADMIN, ORGANISATION (avec SUPERVISEUR ou ADMINISTRATION)'
  })
  @ApiParam({ name: 'id', description: 'ID de la demande' })
  @ApiResponse({ status: 200, description: 'Demande rejetée avec succès' })
  @ApiResponse({ status: 404, description: 'Demande non trouvée' })
  async reject(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() rejectDto: RejectRequestDto,
  ) {
    return this.requestsService.reject(id, rejectDto.reason, user.userId);
  }

  @Get(':id/upload-token')
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiTags('Clients')
  @ApiOperation({
    summary: 'Obtenir un token court terme pour l’upload du PDF depuis l’éditeur (cross-origin)',
    description: `Retourne un JWT court terme à passer en query à l’éditeur PDF (paramètre \`uploadToken\`). L’éditeur l’envoie en header \`X-Upload-Token\` sur POST/PUT \`upload-filled-pdf\` pour authentifier la requête sans cookie cross-origin. **Rôles :** CLIENT (pour ses demandes) ou ADMIN.`,
  })
  @ApiParam({ name: 'id', description: 'ID de la demande (brouillon)' })
  @ApiResponse({ status: 200, description: 'Token d’upload (à passer à l’éditeur PDF)' })
  async getUploadToken(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    const uploadToken = await this.requestsService.getUploadToken(id, user.userId, user.role);
    return { uploadToken };
  }

  @Post(':id/upload-filled-pdf')
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  @ApiTags('Clients')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Uploader le vrai PDF rempli de la demande',
    description: `Permet d'attacher le **vrai PDF rempli** (provenant d'une application externe comme un éditeur de PDF) à une demande existante.

Le fichier est stocké dans MinIO et devient le formulaire officiel de la demande du client (champ submittedForm.pdfUrl).

**Rôles :** CLIENT (pour ses propres demandes) ou ADMIN.`,
  })
  @ApiParam({ name: 'id', description: 'ID de la demande' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'PDF rempli de la demande (contrat signé, formulaire complété, etc.)',
        },
        label: { type: 'string', description: 'Nom du document (ex. Contrat, Renseignements) pour multi-PDF' },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'PDF rempli attaché avec succès à la demande',
  })
  async uploadFilledPdf(
    @Param('id') id: string,
    @UploadedFile() file: any,
    @Body('label') label: string | undefined,
    @CurrentUser() user: any,
  ) {
    const request = await this.requestsService.findOne(id);

    if (user.role === UserRole.CLIENT && request.clientId !== user.userId) {
      throw new ForbiddenException('Vous ne pouvez attacher un PDF que pour vos propres demandes');
    }

    const updatedRequest = await this.requestsService.uploadFilledPdf(id, {
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    }, label);

    return {
      id: updatedRequest.id,
      requestNumber: updatedRequest.requestNumber,
      submittedForm: updatedRequest.submittedForm,
      submittedForms: updatedRequest.submittedForms,
      message: 'PDF rempli attaché avec succès à la demande.',
    };
  }

  @Put(':id/upload-filled-pdf')
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  @ApiTags('Clients')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Mettre à jour le PDF rempli de la demande',
    description: `Même logique que POST : remplace le PDF rempli déjà attaché (retour dans l'éditeur puis nouvelle sauvegarde). **Rôles :** CLIENT (pour ses propres demandes) ou ADMIN.`,
  })
  @ApiParam({ name: 'id', description: 'ID de la demande' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'PDF rempli (version modifiée)' },
        label: { type: 'string', description: 'Nom du document pour multi-PDF' },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 200, description: 'PDF rempli mis à jour avec succès' })
  async updateFilledPdf(
    @Param('id') id: string,
    @UploadedFile() file: any,
    @Body('label') label: string | undefined,
    @CurrentUser() user: any,
  ) {
    const request = await this.requestsService.findOne(id);
    if (user.role === UserRole.CLIENT && request.clientId !== user.userId) {
      throw new ForbiddenException('Vous ne pouvez attacher un PDF que pour vos propres demandes');
    }
    const updatedRequest = await this.requestsService.uploadFilledPdf(id, {
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    }, label);
    return {
      id: updatedRequest.id,
      requestNumber: updatedRequest.requestNumber,
      submittedForm: updatedRequest.submittedForm,
      submittedForms: updatedRequest.submittedForms,
      message: 'PDF rempli mis à jour avec succès.',
    };
  }

  @Post(':id/request-additional-documents')
  @Roles(UserRole.ADMIN, UserRole.ORGANISATION)
  @OrganisationRoles(OrganisationRole.AGENT, OrganisationRole.SUPERVISEUR, OrganisationRole.ADMINISTRATION)
  @ApiTags('Organisations')
  @ApiOperation({
    summary: 'Demander des documents complémentaires',
    description: 'Demander au client de fournir des documents manquants ou à mettre à jour. Le client recevra une notification par email avec la liste des documents demandés. **Rôles requis :** ADMIN, ORGANISATION (avec AGENT/SUPERVISEUR/ADMINISTRATION)'
  })
  @ApiParam({ name: 'id', description: 'ID de la demande' })
  @ApiResponse({ status: 200, description: 'Demande de documents envoyée avec succès' })
  @ApiResponse({ status: 404, description: 'Demande non trouvée' })
  async requestAdditionalDocuments(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() requestDto: RequestAdditionalDocumentsDto,
  ) {
    return this.requestsService.requestAdditionalDocuments(
      id,
      requestDto.documents,
      requestDto.message,
      user.userId,
    );
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiTags('Admin')
  @ApiOperation({
    summary: 'Supprimer une demande',
    description: '**Rôle requis :** ADMIN uniquement'
  })
  @ApiParam({ name: 'id', description: 'ID de la demande' })
  @ApiResponse({ status: 204, description: 'Demande supprimée' })
  remove(@Param('id') id: string) {
    return this.requestsService.remove(id);
  }
}

