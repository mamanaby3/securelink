import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual } from 'typeorm';
import { Form, FormStatus } from '../forms/entities/form.entity';
import { DocumentType } from '../documents/entities/document-type.entity';
import { Request, RequestStatus } from '../requests/entities/request.entity';
import { UserDocument, DocumentStatus } from '../users/entities/user-document.entity';
import { User } from '../auth/entities/user.entity';
import { UserRole } from '../auth/dto/register.dto';
import { Organisation } from '../organisations/entities/organisation.entity';
import { FormStatisticsDto } from './dto/form-statistics.dto';
import { DocumentStatisticsDto } from './dto/document-statistics.dto';
import { NotificationDto, NotificationType, NotificationSeverity } from '../users/dto/notification.dto';

@Injectable()
export class AdminStatisticsService {
  constructor(
    @InjectRepository(Form)
    private formRepository: Repository<Form>,
    @InjectRepository(DocumentType)
    private documentTypeRepository: Repository<DocumentType>,
    @InjectRepository(Request)
    private requestRepository: Repository<Request>,
    @InjectRepository(UserDocument)
    private userDocumentRepository: Repository<UserDocument>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Organisation)
    private organisationRepository: Repository<Organisation>,
  ) {}

  /**
   * Calcule le pourcentage de changement entre deux valeurs
   */
  private calculatePercentageChange(current: number, previous: number): string | null {
    if (previous === 0) {
      return current > 0 ? '+100%' : null;
    }
    const change = ((current - previous) / previous) * 100;
    if (change === 0) return null;
    const sign = change > 0 ? '+' : '';
    return `${sign}${change.toFixed(1)}%`;
  }

  /**
   * Obtient les dates de début et fin du mois en cours
   */
  private getCurrentMonthDates(): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }

  /**
   * Obtient les dates de début et fin du mois précédent
   */
  private getPreviousMonthDates(): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { start, end };
  }

  /**
   * Statistiques des formulaires pour l'admin
   */
  async getFormStatistics(): Promise<FormStatisticsDto> {
    const { start: currentMonthStart, end: currentMonthEnd } = this.getCurrentMonthDates();
    const { start: previousMonthStart, end: previousMonthEnd } = this.getPreviousMonthDates();

    // Comptes du mois en cours
    const [
      totalThisMonth,
      draftThisMonth,
      activeThisMonth,
    ] = await Promise.all([
      this.formRepository.count({
        where: {
          createdAt: Between(currentMonthStart, currentMonthEnd),
        },
      }),
      this.formRepository.count({
        where: {
          status: FormStatus.DRAFT,
          createdAt: Between(currentMonthStart, currentMonthEnd),
        },
      }),
      this.formRepository.count({
        where: {
          status: FormStatus.ONLINE,
          createdAt: Between(currentMonthStart, currentMonthEnd),
        },
      }),
    ]);

    // Comptes du mois précédent
    const [
      totalPreviousMonth,
      draftPreviousMonth,
      activePreviousMonth,
    ] = await Promise.all([
      this.formRepository.count({
        where: {
          createdAt: Between(previousMonthStart, previousMonthEnd),
        },
      }),
      this.formRepository.count({
        where: {
          status: FormStatus.DRAFT,
          createdAt: Between(previousMonthStart, previousMonthEnd),
        },
      }),
      this.formRepository.count({
        where: {
          status: FormStatus.ONLINE,
          createdAt: Between(previousMonthStart, previousMonthEnd),
        },
      }),
    ]);

    // Comptes totaux (tous les temps)
    const [
      total,
      draft,
      active,
      offline,
    ] = await Promise.all([
      this.formRepository.count(),
      this.formRepository.count({ where: { status: FormStatus.DRAFT } }),
      this.formRepository.count({ where: { status: FormStatus.ONLINE } }),
      this.formRepository.count({ where: { status: FormStatus.OFFLINE } }),
    ]);

    return {
      totalThisMonth,
      total,
      draft,
      active,
      offline,
      totalChangeThisMonth: this.calculatePercentageChange(totalThisMonth, totalPreviousMonth) || undefined,
      draftChangeThisMonth: this.calculatePercentageChange(draftThisMonth, draftPreviousMonth) || undefined,
      activeChangeThisMonth: this.calculatePercentageChange(activeThisMonth, activePreviousMonth) || undefined,
    };
  }

  /**
   * Statistiques des types de documents pour l'admin
   */
  async getDocumentStatistics(): Promise<DocumentStatisticsDto> {
    const { start: currentMonthStart, end: currentMonthEnd } = this.getCurrentMonthDates();
    const { start: previousMonthStart, end: previousMonthEnd } = this.getPreviousMonthDates();

    // Comptes du mois en cours
    const [
      totalThisMonth,
      requiredThisMonth,
      optionalThisMonth,
    ] = await Promise.all([
      this.documentTypeRepository.count({
        where: {
          createdAt: Between(currentMonthStart, currentMonthEnd),
        },
      }),
      this.documentTypeRepository.count({
        where: {
          isForIdentityVerification: true,
          createdAt: Between(currentMonthStart, currentMonthEnd),
        },
      }),
      this.documentTypeRepository.count({
        where: {
          isForIdentityVerification: false,
          createdAt: Between(currentMonthStart, currentMonthEnd),
        },
      }),
    ]);

    // Comptes du mois précédent
    const [
      totalPreviousMonth,
      requiredPreviousMonth,
      optionalPreviousMonth,
    ] = await Promise.all([
      this.documentTypeRepository.count({
        where: {
          createdAt: Between(previousMonthStart, previousMonthEnd),
        },
      }),
      this.documentTypeRepository.count({
        where: {
          isForIdentityVerification: true,
          createdAt: Between(previousMonthStart, previousMonthEnd),
        },
      }),
      this.documentTypeRepository.count({
        where: {
          isForIdentityVerification: false,
          createdAt: Between(previousMonthStart, previousMonthEnd),
        },
      }),
    ]);

    // Comptes totaux (tous les temps)
    const [
      total,
      required,
      optional,
    ] = await Promise.all([
      this.documentTypeRepository.count(),
      this.documentTypeRepository.count({ where: { isForIdentityVerification: true } }),
      this.documentTypeRepository.count({ where: { isForIdentityVerification: false } }),
    ]);

    return {
      totalThisMonth,
      total,
      required,
      optional,
      totalChangeThisMonth: this.calculatePercentageChange(totalThisMonth, totalPreviousMonth) || undefined,
      requiredChangeThisMonth: this.calculatePercentageChange(requiredThisMonth, requiredPreviousMonth) || undefined,
      optionalChangeThisMonth: this.calculatePercentageChange(optionalThisMonth, optionalPreviousMonth) || undefined,
    };
  }

  /**
   * Formate la date en "time ago" (il y a X jours, aujourd'hui, etc.)
   */
  private getTimeAgo(date: Date): string {
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) {
      const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
      if (diffInHours === 0) {
        const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
        return diffInMinutes <= 1 ? 'À l\'instant' : `Il y a ${diffInMinutes} minutes`;
      }
      return `Il y a ${diffInHours} heure${diffInHours > 1 ? 's' : ''}`;
    } else if (diffInDays === 1) {
      return 'Hier';
    } else if (diffInDays < 7) {
      return `Il y a ${diffInDays} jours`;
    } else if (diffInDays < 30) {
      const weeks = Math.floor(diffInDays / 7);
      return `Il y a ${weeks} semaine${weeks > 1 ? 's' : ''}`;
    } else {
      const months = Math.floor(diffInDays / 30);
      return `Il y a ${months} mois`;
    }
  }

  /**
   * Notifications pour l'admin
   */
  async getAdminNotifications(unreadOnly?: boolean): Promise<NotificationDto[]> {
    const notifications: NotificationDto[] = [];

    // 1. Demandes en attente de traitement (plus de 24h)
    const pendingRequests = await this.requestRepository.find({
      where: { status: RequestStatus.EN_ATTENTE },
      relations: ['form', 'client'],
      order: { createdAt: 'ASC' },
      take: 10,
    });

    pendingRequests.forEach((request) => {
      const hoursSinceCreation = Math.floor(
        (Date.now() - new Date(request.createdAt).getTime()) / (1000 * 60 * 60),
      );

      if (hoursSinceCreation >= 24) {
        notifications.push({
          id: `req-pending-${request.id}`,
          type: NotificationType.VERIFICATION_PENDING,
          severity: NotificationSeverity.WARNING,
          title: 'Demande en attente de traitement',
          message: `La demande ${request.requestNumber} est en attente depuis ${Math.floor(hoursSinceCreation / 24)} jour${Math.floor(hoursSinceCreation / 24) > 1 ? 's' : ''}`,
          date: request.createdAt,
          timeAgo: this.getTimeAgo(request.createdAt),
          relatedId: request.id,
          relatedType: 'request',
          isRead: false,
        });
      }
    });

    // 2. Documents en attente de vérification (plus de 48h)
    const pendingDocuments = await this.userDocumentRepository.find({
      where: { status: DocumentStatus.EN_ATTENTE },
      relations: ['user'],
      order: { createdAt: 'ASC' },
      take: 10,
    });

    pendingDocuments.forEach((doc) => {
      const hoursSinceCreation = Math.floor(
        (Date.now() - new Date(doc.createdAt).getTime()) / (1000 * 60 * 60),
      );

      if (hoursSinceCreation >= 48) {
        notifications.push({
          id: `doc-pending-${doc.id}`,
          type: NotificationType.VERIFICATION_PENDING,
          severity: NotificationSeverity.WARNING,
          title: 'Document en attente de vérification',
          message: `Le document ${doc.type} de ${doc.user.name} est en attente depuis ${Math.floor(hoursSinceCreation / 24)} jour${Math.floor(hoursSinceCreation / 24) > 1 ? 's' : ''}`,
          date: doc.createdAt,
          timeAgo: this.getTimeAgo(doc.createdAt),
          relatedId: doc.id,
          relatedType: 'document',
          isRead: false,
        });
      }
    });

    // 3. Documents expirant bientôt (dans les 15 prochains jours)
    const fifteenDaysFromNow = new Date();
    fifteenDaysFromNow.setDate(fifteenDaysFromNow.getDate() + 15);

    const expiringDocuments = await this.userDocumentRepository.find({
      where: {
        expirationDate: LessThanOrEqual(fifteenDaysFromNow),
        status: DocumentStatus.VALIDE,
      },
      relations: ['user'],
      order: { expirationDate: 'ASC' },
      take: 10,
    });

    expiringDocuments.forEach((doc) => {
      if (doc.expirationDate) {
        const daysUntilExpiration = Math.floor(
          (new Date(doc.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        );

        if (daysUntilExpiration >= 0 && daysUntilExpiration <= 15) {
          notifications.push({
            id: `doc-expiring-${doc.id}`,
            type: NotificationType.DOCUMENT_EXPIRING,
            severity: daysUntilExpiration <= 7 ? NotificationSeverity.ERROR : NotificationSeverity.WARNING,
            title: 'Document expirant bientôt',
            message: `Le document ${doc.type} de ${doc.user.name} expire dans ${daysUntilExpiration} jour${daysUntilExpiration > 1 ? 's' : ''}`,
            date: new Date(),
            timeAgo: 'Aujourd\'hui',
            relatedId: doc.id,
            relatedType: 'document',
            isRead: false,
          });
        }
      }
    });

    // 4. Organisations inactives (pas de demande depuis 30 jours)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const organisations = await this.organisationRepository.find({
      where: { isActive: true },
    });

    for (const org of organisations) {
      const recentRequests = await this.requestRepository.count({
        where: {
          organisationId: org.id,
          createdAt: Between(thirtyDaysAgo, new Date()),
        },
      });

      if (recentRequests === 0) {
        const lastRequest = await this.requestRepository.findOne({
          where: { organisationId: org.id },
          order: { createdAt: 'DESC' },
        });

        if (lastRequest) {
          const daysSinceLastRequest = Math.floor(
            (Date.now() - new Date(lastRequest.createdAt).getTime()) / (1000 * 60 * 60 * 24),
          );

          if (daysSinceLastRequest >= 30) {
            notifications.push({
              id: `org-inactive-${org.id}`,
              type: NotificationType.VERIFICATION_PENDING,
              severity: NotificationSeverity.INFO,
              title: 'Organisation inactive',
              message: `L'organisation ${org.name} n'a pas reçu de demande depuis ${daysSinceLastRequest} jours`,
              date: lastRequest.createdAt,
              timeAgo: this.getTimeAgo(lastRequest.createdAt),
              relatedId: org.id,
              relatedType: 'organisation',
              isRead: false,
            });
          }
        }
      }
    }

    // 5. Utilisateurs inactifs (pas de connexion depuis 90 jours)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const inactiveUsers = await this.userRepository.find({
      where: {
        isActive: true,
        lastLogin: LessThanOrEqual(ninetyDaysAgo),
      },
      take: 10,
    });

    inactiveUsers.forEach((user) => {
      if (user.lastLogin) {
        notifications.push({
          id: `user-inactive-${user.id}`,
          type: NotificationType.VERIFICATION_PENDING,
          severity: NotificationSeverity.INFO,
          title: 'Utilisateur inactif',
          message: `L'utilisateur ${user.name} ne s'est pas connecté depuis ${Math.floor((Date.now() - new Date(user.lastLogin).getTime()) / (1000 * 60 * 60 * 24))} jours`,
          date: user.lastLogin,
          timeAgo: this.getTimeAgo(user.lastLogin),
          relatedId: user.id,
          relatedType: 'user',
          isRead: false,
        });
      }
    });

    // Trier par date (plus récent en premier)
    notifications.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Filtrer les non lues si demandé
    if (unreadOnly) {
      return notifications.filter((n) => !n.isRead);
    }

    return notifications;
  }

  /**
   * Obtient toutes les données du dashboard admin
   */
  async getDashboard() {
    const { start: currentMonthStart, end: currentMonthEnd } = this.getCurrentMonthDates();
    const { start: previousMonthStart, end: previousMonthEnd } = this.getPreviousMonthDates();

    // KPIs
    const [
      totalUsers,
      totalUsersPreviousMonth,
      totalOrganisations,
      totalOrganisationsPreviousMonth,
      pendingRequests,
      pendingRequestsPreviousMonth,
      securityAlerts,
      securityAlertsPreviousMonth,
    ] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({
        where: {
          createdAt: Between(previousMonthStart, previousMonthEnd),
        },
      }),
      this.organisationRepository.count(),
      this.organisationRepository.count({
        where: {
          createdAt: Between(previousMonthStart, previousMonthEnd),
        },
      }),
      this.requestRepository
        .createQueryBuilder('request')
        .where('request.status = :status', { status: RequestStatus.EN_ATTENTE })
        .andWhere('(request.otpVerified = true OR request.otpVerified IS NOT NULL)')
        .getCount(),
      this.requestRepository
        .createQueryBuilder('request')
        .where('request.status = :status', { status: RequestStatus.EN_ATTENTE })
        .andWhere('(request.otpVerified = true OR request.otpVerified IS NOT NULL)')
        .andWhere('request.createdAt BETWEEN :startDate AND :endDate', {
          startDate: previousMonthStart,
          endDate: previousMonthEnd,
        })
        .getCount(),
      this.userDocumentRepository.count({
        where: {
          status: DocumentStatus.EN_ATTENTE,
        },
      }),
      this.userDocumentRepository.count({
        where: {
          status: DocumentStatus.EN_ATTENTE,
          createdAt: Between(previousMonthStart, previousMonthEnd),
        },
      }),
    ]);

    // Volume hebdomadaire des transactions (7 derniers jours)
    const weeklyTransactionVolume = await this.getWeeklyTransactionVolume();

    // Tendances de l'activité des utilisateurs (7 derniers jours)
    const userActivityTrends = await this.getUserActivityTrends();

    // Activité récente
    const recentActivities = await this.getRecentActivities();

    return {
      kpis: {
        totalUsers,
        usersChange: this.calculatePercentageChange(totalUsers, totalUsersPreviousMonth) || '+0%',
        totalOrganisations,
        organisationsChange: this.calculatePercentageChange(totalOrganisations, totalOrganisationsPreviousMonth) || '+0%',
        pendingRequests,
        pendingRequestsChange: this.calculatePercentageChange(pendingRequests, pendingRequestsPreviousMonth) || '+0%',
        securityAlerts,
        securityAlertsChange: this.calculatePercentageChange(securityAlerts, securityAlertsPreviousMonth) || '+0%',
      },
      weeklyTransactionVolume,
      userActivityTrends,
      recentActivities,
    };
  }

  /**
   * Obtient le volume hebdomadaire des transactions (7 derniers jours)
   */
  private async getWeeklyTransactionVolume() {
    const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    const volumes: { day: string; volume: number }[] = [];

    // Calculer les dates pour les 7 derniers jours
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 6); // 7 jours incluant aujourd'hui
    startOfWeek.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
      const dayStart = new Date(startOfWeek);
      dayStart.setDate(startOfWeek.getDate() + i);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const dayOfWeek = dayStart.getDay();
      const dayName = days[dayOfWeek === 0 ? 6 : dayOfWeek - 1]; // Convertir dimanche (0) à 6

      const volume = await this.requestRepository
        .createQueryBuilder('request')
        .where(
          '(request.status != :draftStatus AND NOT (request.status = :enAttenteStatus AND (request.otpVerified = false OR request.otpVerified IS NULL)))',
          {
            draftStatus: RequestStatus.BROUILLON,
            enAttenteStatus: RequestStatus.EN_ATTENTE,
          },
        )
        .andWhere('request.createdAt BETWEEN :startDate AND :endDate', {
          startDate: dayStart,
          endDate: dayEnd,
        })
        .getCount();

      volumes.push({
        day: dayName,
        volume,
      });
    }

    return volumes;
  }

  /**
   * Obtient les tendances de l'activité des utilisateurs (7 derniers jours)
   */
  private async getUserActivityTrends() {
    const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    const trends: { day: string; activity: number }[] = [];

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 6);
    startOfWeek.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
      const dayStart = new Date(startOfWeek);
      dayStart.setDate(startOfWeek.getDate() + i);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const dayOfWeek = dayStart.getDay();
      const dayName = days[dayOfWeek === 0 ? 6 : dayOfWeek - 1];

      // Compter les connexions (lastLogin) et les actions (créations de demandes, uploads de documents)
      const [logins, requests, documents] = await Promise.all([
        this.userRepository.count({
          where: {
            lastLogin: Between(dayStart, dayEnd),
          },
        }),
        this.requestRepository
          .createQueryBuilder('request')
          .where(
            '(request.status != :draftStatus AND NOT (request.status = :enAttenteStatus AND (request.otpVerified = false OR request.otpVerified IS NULL)))',
            {
              draftStatus: RequestStatus.BROUILLON,
              enAttenteStatus: RequestStatus.EN_ATTENTE,
            },
          )
          .andWhere('request.createdAt BETWEEN :startDate AND :endDate', {
            startDate: dayStart,
            endDate: dayEnd,
          })
          .getCount(),
        this.userDocumentRepository.count({
          where: {
            createdAt: Between(dayStart, dayEnd),
          },
        }),
      ]);

      // Calculer un score d'activité (logins + requests + documents)
      const activity = logins + requests + documents;

      trends.push({
        day: dayName,
        activity,
      });
    }

    return trends;
  }

  /**
   * Obtient les activités récentes
   */
  private async getRecentActivities() {
    const activities: Array<{
      id: string;
      type: string;
      title: string;
      timeAgo: string;
      date: Date;
      icon?: string;
    }> = [];

    // Demandes récentes (10 dernières)
    const recentRequests = await this.requestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.client', 'client')
      .leftJoinAndSelect('request.form', 'form')
      .where(
        '(request.status != :draftStatus AND NOT (request.status = :enAttenteStatus AND (request.otpVerified = false OR request.otpVerified IS NULL)))',
        {
          draftStatus: RequestStatus.BROUILLON,
          enAttenteStatus: RequestStatus.EN_ATTENTE,
        },
      )
      .orderBy('request.submittedAt', 'DESC')
      .addOrderBy('request.createdAt', 'DESC')
      .limit(5)
      .getMany();

    recentRequests.forEach((req) => {
      activities.push({
        id: `request-${req.id}`,
        type: 'request_submitted',
        title: `Demande ${req.requestNumber || req.id.substring(0, 8)} soumise`,
        timeAgo: this.getTimeAgo(req.submittedAt || req.createdAt),
        date: req.submittedAt || req.createdAt,
        icon: 'check',
      });
    });

    // Organisations récemment créées (5 dernières)
    const recentOrganisations = await this.organisationRepository.find({
      order: { createdAt: 'DESC' },
      take: 3,
    });

    recentOrganisations.forEach((org) => {
      activities.push({
        id: `org-${org.id}`,
        type: 'organisation_created',
        title: `Nouvelle organisation ${org.name} créée`,
        timeAgo: this.getTimeAgo(org.createdAt),
        date: org.createdAt,
        icon: 'building',
      });
    });

    // Utilisateurs récemment créés (5 derniers)
    const recentUsers = await this.userRepository.find({
      order: { createdAt: 'DESC' },
      take: 2,
    });

    recentUsers.forEach((user) => {
      activities.push({
        id: `user-${user.id}`,
        type: 'user_created',
        title: `Nouvel utilisateur ${user.name || user.email} créé`,
        timeAgo: this.getTimeAgo(user.createdAt),
        date: user.createdAt,
        icon: 'user',
      });
    });

    // Trier par date (plus récent en premier)
    activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Retourner les 10 plus récentes
    return activities.slice(0, 10);
  }
}

