import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { UsersProfileService } from './users-profile.service';
import { RequestsService } from '../requests/requests.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../auth/dto/register.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CLIENT)
@ApiBearerAuth('JWT-auth')
@ApiTags('Clients')
export class ClientsController {
  constructor(
    private readonly usersProfileService: UsersProfileService,
    private readonly requestsService: RequestsService,
  ) { }

  @Get('archives')
  @ApiOperation({
    summary: 'Mes archives',
    description: 'Retourne l\'historique des demandes et documents du client, triés par date (plus récent en premier). **Rôle requis : CLIENT**'
  })
  @ApiQuery({ name: 'type', required: false, description: 'Filtrer par type (requests, documents, all). Par défaut: all' })
  @ApiQuery({ name: 'status', required: false, description: 'Filtrer par statut (pour les demandes: EN_ATTENTE, EN_COURS, VALIDEE, REJETEE)' })
  @ApiResponse({ status: 200, description: 'Historique des demandes et documents' })
  async getArchives(
    @CurrentUser() user: any,
    @Query('type') type?: string,
    @Query('status') status?: string,
  ) {
    const userId = user.userId;
    const archives: any = {
      requests: [],
      documents: [],
    };

    // Récupérer uniquement les demandes en brouillon (non soumises)
    if (!type || type === 'requests' || type === 'all') {
      const drafts = await this.requestsService.findDraftsByClient(userId);
      archives.requests = drafts.map((req) => ({
        id: req.id,
        type: 'request',
        title: req.formName || 'Brouillon',
        organisationName: req.organisation?.name || req.organisationName,
        status: req.status,
        date: req.updatedAt, // Date de dernière modification
        requestNumber: req.requestNumber,
        currentStep: this.getCurrentStepFromDraft(req),
      }));
    }

    // Récupérer les documents
    if (!type || type === 'documents' || type === 'all') {
      const documents = await this.usersProfileService.getUserDocuments(userId);
      archives.documents = documents.map((doc) => ({
        id: doc.id,
        type: 'document',
        title: this.getDocumentTitle(doc.type),
        status: doc.status,
        date: doc.createdAt,
        expirationDate: doc.expirationDate,
      }));
    }

    // Trier par date (plus récent en premier)
    const allItems = [...archives.requests, ...archives.documents].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    return {
      total: allItems.length,
      items: allItems,
    };
  }

  @Get('recent-requests')
  @ApiOperation({
    summary: 'Demandes récentes (avec filtres et recherche)',
    description:
      'Retourne les demandes récentes du client.\n\n' +
      '**Filtres** (paramètres optionnels) :\n' +
      '- `status` : statut de la demande\n' +
      '- `category` : secteur d\'activité (BANQUE, NOTAIRE, ASSURANCE, HUISSIER)\n' +
      '- `institution` : nom de l\'organisation (recherche partielle)\n' +
      '- `type` : type / nom du formulaire (recherche partielle)\n\n' +
      '**Recherche** :\n' +
      '- `search` : recherche globale dans le numéro de demande (ex. DEM-998), le nom de l\'institution et le type de formulaire.\n\n' +
      '**Rôle requis : CLIENT**',
  })
  @ApiQuery({ name: 'limit', required: false, type: String, description: 'Nombre de demandes à retourner (défaut: 5, max: 50)', example: '10' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['EN_ATTENTE', 'EN_COURS', 'VALIDEE', 'REJETEE'],
    description: 'Filtre : statut de la demande',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    enum: ['BANQUE', 'NOTAIRE', 'ASSURANCE', 'HUISSIER'],
    description: 'Filtre : secteur d\'activité de l\'organisation',
  })
  @ApiQuery({ name: 'institution', required: false, type: String, description: 'Filtre : nom de l\'organisation (recherche partielle)', example: 'ICI' })
  @ApiQuery({ name: 'type', required: false, type: String, description: 'Filtre : type ou nom du formulaire (recherche partielle)', example: 'virement' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Recherche : numéro (DEM-xxx), institution, type de formulaire', example: 'DEM-998' })
  @ApiResponse({ status: 200, description: 'Liste des demandes récentes' })
  async getRecentRequests(
    @CurrentUser() user: any,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('institution') institution?: string,
    @Query('type') type?: string,
    @Query('search') search?: string,
  ) {
    const limitNum = Math.min(limit ? parseInt(limit, 10) : 5, 50);
    const filters = [status, category, institution, type, search].some(Boolean)
      ? { status, category, institution, type, search }
      : undefined;
    const requests = await this.requestsService.findRecentByClient(user.userId, limitNum, filters);

    return requests.map((req) => ({
      id: req.id,
      requestNumber: req.requestNumber,
      institution: req.organisation?.name ?? req.organisationName ?? 'N/A',
      category: this.getCategoryFromOrganisationSector(req.organisation?.sector) ?? this.getCategoryFromSector(req.formType),
      type: req.formName,
      date: req.submittedAt,
      status: req.status,
      timeAgo: this.getTimeAgo(req.submittedAt),
    }));
  }

  @Get('expiring-documents')
  @ApiOperation({
    summary: 'Documents expirant bientôt',
    description: 'Retourne les documents qui expirent dans les 60 prochains jours. **Rôle requis : CLIENT**'
  })
  @ApiQuery({ name: 'days', required: false, description: 'Nombre de jours avant expiration (par défaut: 60)' })
  @ApiResponse({ status: 200, description: 'Liste des documents expirant bientôt' })
  async getExpiringDocuments(
    @CurrentUser() user: any,
    @Query('days') days?: string,
  ) {
    const daysThreshold = days ? parseInt(days, 10) : 60;
    return this.usersProfileService.getExpiringDocuments(user.userId, daysThreshold);
  }

  @Get('statistics')
  @ApiOperation({
    summary: 'Statistiques du dashboard',
    description: 'Retourne les statistiques des demandes du client pour le dashboard (total, en attente, en cours, validées, rejetées). **Rôle requis : CLIENT**'
  })
  @ApiResponse({ status: 200, description: 'Statistiques des demandes' })
  async getStatistics(@CurrentUser() user: any) {
    return this.requestsService.getClientStatistics(user.userId);
  }

  @Get('notifications')
  @ApiOperation({
    summary: 'Alertes et notifications',
    description: 'Retourne toutes les notifications du client (documents expirant, demandes validées/rejetées, etc.). **Rôle requis : CLIENT**'
  })
  @ApiQuery({ name: 'unreadOnly', required: false, description: 'Retourner uniquement les notifications non lues (true/false)' })
  @ApiResponse({ status: 200, description: 'Liste des notifications' })
  async getNotifications(
    @CurrentUser() user: any,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    const userId = user.userId;
    const notifications: any[] = [];

    // 1. Documents expirant bientôt
    const expiringDocuments = await this.usersProfileService.getExpiringDocuments(userId, 60);
    expiringDocuments.forEach((doc) => {
      if (doc.daysUntilExpiration <= 15) {
        notifications.push({
          id: `doc-exp-${doc.id}`,
          type: 'DOCUMENT_EXPIRING',
          severity: 'ERROR',
          title: `${doc.type} expire bientôt`,
          message: `Votre ${doc.type.toLowerCase()} expire dans ${doc.daysUntilExpiration} jour${doc.daysUntilExpiration > 1 ? 's' : ''}, renouvelé dès maintenant.`,
          date: new Date(),
          timeAgo: 'Aujourd\'hui',
          relatedId: doc.id,
          relatedType: 'document',
          isRead: false,
        });
      }
    });

    // 2. Documents validés
    const documents = await this.usersProfileService.getUserDocuments(userId);
    documents
      .filter((doc) => doc.status === 'VALIDE' && doc.updatedAt)
      .forEach((doc) => {
        const updatedDate = new Date(doc.updatedAt);
        notifications.push({
          id: `doc-val-${doc.id}`,
          type: 'DOCUMENT_VALIDATED',
          severity: 'SUCCESS',
          title: `${this.getDocumentTitle(doc.type)} validé`,
          message: `Votre ${this.getDocumentTitle(doc.type).toLowerCase()} a été validé avec succès. score: 98%`,
          date: updatedDate,
          timeAgo: this.getTimeAgo(updatedDate),
          relatedId: doc.id,
          relatedType: 'document',
          isRead: false,
        });
      });

    // 2b. Documents rejetés
    documents
      .filter((doc) => doc.status === 'REJETE' && doc.updatedAt)
      .forEach((doc) => {
        const updatedDate = new Date(doc.updatedAt);
        notifications.push({
          id: `doc-rej-${doc.id}`,
          type: 'DOCUMENT_REJECTED',
          severity: 'ERROR',
          title: `${this.getDocumentTitle(doc.type)} rejeté`,
          message: doc.rejectionReason
            ? `Votre ${this.getDocumentTitle(doc.type).toLowerCase()} a été rejeté. ${doc.rejectionReason}`
            : `Votre ${this.getDocumentTitle(doc.type).toLowerCase()} a été rejeté. Veuillez le renouveler.`,
          date: updatedDate,
          timeAgo: this.getTimeAgo(updatedDate),
          relatedId: doc.id,
          relatedType: 'document',
          isRead: false,
        });
      });

    // 2c. Documents en attente de vérification (demande de complément)
    documents
      .filter((doc) => doc.status === 'EN_VERIFICATION' && doc.rejectionReason)
      .forEach((doc) => {
        const updatedDate = doc.updatedAt ? new Date(doc.updatedAt) : new Date(doc.createdAt);
        notifications.push({
          id: `doc-pending-${doc.id}`,
          type: 'VERIFICATION_PENDING',
          severity: 'WARNING',
          title: `${this.getDocumentTitle(doc.type)} - Complément requis`,
          message: doc.rejectionReason || `Des informations complémentaires sont requises pour votre ${this.getDocumentTitle(doc.type).toLowerCase()}`,
          date: updatedDate,
          timeAgo: this.getTimeAgo(updatedDate),
          relatedId: doc.id,
          relatedType: 'document',
          isRead: false,
        });
      });

    // 3. Demandes validées/rejetées
    const requests = await this.requestsService.findByClient(userId);
    requests.forEach((req) => {
      if (req.status === 'VALIDEE' && req.processedAt) {
        notifications.push({
          id: `req-val-${req.id}`,
          type: 'REQUEST_VALIDATED',
          severity: 'SUCCESS',
          title: 'Demande validée',
          message: `Votre demande ${req.requestNumber} a été validée avec succès.`,
          date: new Date(req.processedAt),
          timeAgo: this.getTimeAgo(new Date(req.processedAt)),
          relatedId: req.id,
          relatedType: 'request',
          isRead: false,
        });
      } else if (req.status === 'REJETEE' && req.processedAt) {
        notifications.push({
          id: `req-rej-${req.id}`,
          type: 'REQUEST_REJECTED',
          severity: 'ERROR',
          title: 'Demande rejetée',
          message: `Votre demande ${req.requestNumber} a été rejetée.`,
          date: new Date(req.processedAt),
          timeAgo: this.getTimeAgo(new Date(req.processedAt)),
          relatedId: req.id,
          relatedType: 'request',
          isRead: false,
        });
      } else if (req.status === 'EN_COURS') {
        notifications.push({
          id: `req-proc-${req.id}`,
          type: 'VERIFICATION_PENDING',
          severity: 'WARNING',
          title: 'Vérification en attente',
          message: `Validation en cours pour votre ${req.formName.toLowerCase()} ${req.organisationName || ''}`,
          date: new Date(req.submittedAt),
          timeAgo: this.getTimeAgo(new Date(req.submittedAt)),
          relatedId: req.id,
          relatedType: 'request',
          isRead: false,
        });
      }
    });

    // Trier par date (plus récent en premier)
    notifications.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Filtrer les non lues si demandé
    if (unreadOnly === 'true') {
      return notifications.filter((n) => !n.isRead);
    }

    return notifications;
  }

  /**
   * Détermine l'étape actuelle d'un brouillon
   */
  private getCurrentStepFromDraft(request: any): number {
    if (!request.organisationId) return 1; // Étape 1 : Organisation
    if (!request.formId) return 1; // Étape 1 : Organisation
    if (!request.formData || Object.keys(request.formData).length === 0) return 2; // Étape 2 : Formulaire
    return 3; // Étape 3 : Documents (prêt pour soumission)
  }

  /**
   * Obtient le titre d'un document à partir de son type
   */
  private getDocumentTitle(type: string): string {
    const titles: { [key: string]: string } = {
      'CARTE_IDENTITE': 'Carte d\'identité',
      'CERTIFICAT_NATIONALITE': 'Certificat de nationalité',
      'EXTRAIT_NAISSANCE': 'Extrait de naissance',
      'AUTRE': 'Autre document',
    };
    return titles[type] || 'Document';
  }

  /**
   * Secteur d'activité de l'organisation → libellé affiché (category)
   */
  private getCategoryFromOrganisationSector(sector?: string): string | null {
    if (!sector) return null;
    const labels: { [key: string]: string } = {
      'BANQUE': 'Banque',
      'NOTAIRE': 'Notaire',
      'ASSURANCE': 'Assurance',
      'HUISSIER': 'Huissier',
    };
    return labels[sector] ?? null;
  }

  /**
   * Fallback: catégorie à partir du type de formulaire (si pas d'organisation/secteur)
   */
  private getCategoryFromSector(formType?: string): string {
    if (!formType) return 'Autre';
    const categories: { [key: string]: string } = {
      'TRANSACTION': 'Banque',
      'ACCOUNT': 'Banque',
      'LOAN': 'Banque',
      'INSURANCE': 'Assurance',
      'NOTARIAL': 'Notaire',
      'BAILIFF': 'Huissier',
    };
    return categories[formType] || 'Autre';
  }

  /**
   * Calcule le temps écoulé depuis une date
   */
  private getTimeAgo(date: Date | string): string {
    const now = new Date();
    const past = new Date(date);
    const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Il y a quelques secondes';
    if (diffInSeconds < 3600) return `Il y a ${Math.floor(diffInSeconds / 60)} minute${Math.floor(diffInSeconds / 60) > 1 ? 's' : ''}`;
    if (diffInSeconds < 86400) return `Il y a ${Math.floor(diffInSeconds / 3600)} heure${Math.floor(diffInSeconds / 3600) > 1 ? 's' : ''}`;
    if (diffInSeconds < 604800) return `Il y a ${Math.floor(diffInSeconds / 86400)} jour${Math.floor(diffInSeconds / 86400) > 1 ? 's' : ''}`;
    if (diffInSeconds < 2592000) return `Il y a ${Math.floor(diffInSeconds / 604800)} semaine${Math.floor(diffInSeconds / 604800) > 1 ? 's' : ''}`;
    return `Il y a ${Math.floor(diffInSeconds / 2592000)} mois`;
  }
}

