import { Controller, Get, UseGuards, Query, Res, Param, Post, Body } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../auth/dto/register.dto';
import { RequestStatus } from '../requests/entities/request.entity';
import { AdminStatisticsService } from './admin-statistics.service';
import { AdminExportService } from './admin-export.service';
import { FormStatisticsDto } from './dto/form-statistics.dto';
import { DocumentStatisticsDto } from './dto/document-statistics.dto';
import { NotificationDto } from '../users/dto/notification.dto';
import { AdminDashboardDto } from './dto/admin-dashboard.dto';
import { UsersService } from '../users/users.service';
import { EmailService } from '../common/services/email.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
@ApiTags('Admin')
export class AdminController {
  constructor(
    private readonly adminStatisticsService: AdminStatisticsService,
    private readonly adminExportService: AdminExportService,
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
  ) {}

  @Get('dashboard')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Obtenir le tableau de bord complet de l\'admin',
    description: `Retourne toutes les données du tableau de bord pour l'administrateur :
- KPIs (Utilisateurs totaux, Organisations totales, Demandes en attente, Alertes de sécurité)
- Volume hebdomadaire des transactions (7 derniers jours)
- Tendances de l'activité des utilisateurs (7 derniers jours)
- Activité récente (demandes, organisations, utilisateurs)

**Rôle requis : ADMIN**`
  })
  @ApiResponse({
    status: 200,
    description: 'Données du tableau de bord',
    type: AdminDashboardDto,
  })
  @ApiResponse({ status: 403, description: 'Accès refusé - Rôle ADMIN requis' })
  async getDashboard(): Promise<AdminDashboardDto> {
    return this.adminStatisticsService.getDashboard();
  }

  @Get('statistics/forms')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Obtenir les statistiques des formulaires',
    description: `Retourne les statistiques complètes des formulaires pour l'admin :
- Total de formulaires créés ce mois
- Total de tous les formulaires
- Nombre de formulaires en brouillon (DRAFT)
- Nombre de formulaires actifs (ONLINE)
- Nombre de formulaires hors ligne (OFFLINE)
- Pourcentages de changement par rapport au mois précédent

**Rôle requis : ADMIN**`
  })
  @ApiResponse({
    status: 200,
    description: 'Statistiques des formulaires',
    type: FormStatisticsDto,
  })
  @ApiResponse({ status: 403, description: 'Accès refusé - Rôle ADMIN requis' })
  async getFormStatistics(): Promise<FormStatisticsDto> {
    return this.adminStatisticsService.getFormStatistics();
  }

  @Get('statistics/documents')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Obtenir les statistiques des types de documents',
    description: `Retourne les statistiques complètes des types de documents pour l'admin :
- Total de types de documents créés ce mois
- Total de tous les types de documents
- Nombre de documents requis (isForIdentityVerification: true)
- Nombre de documents facultatifs (isForIdentityVerification: false)
- Pourcentages de changement par rapport au mois précédent

**Rôle requis : ADMIN**`
  })
  @ApiResponse({
    status: 200,
    description: 'Statistiques des types de documents',
    type: DocumentStatisticsDto,
  })
  @ApiResponse({ status: 403, description: 'Accès refusé - Rôle ADMIN requis' })
  async getDocumentStatistics(): Promise<DocumentStatisticsDto> {
    return this.adminStatisticsService.getDocumentStatistics();
  }

  @Get('notifications')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Obtenir les notifications pour l\'admin',
    description: `Retourne toutes les notifications pertinentes pour l'administrateur système.
Les notifications incluent :
- Demandes en attente de traitement (plus de 24h)
- Documents en attente de vérification (plus de 48h)
- Documents expirant bientôt (dans les 15 prochains jours)
- Organisations inactives (pas de demande depuis 30 jours)
- Utilisateurs inactifs (pas de connexion depuis 90 jours)

**Rôle requis : ADMIN**`
  })
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
  @ApiResponse({ status: 403, description: 'Accès refusé - Rôle ADMIN requis' })
  async getNotifications(@Query('unreadOnly') unreadOnly?: string): Promise<NotificationDto[]> {
    const unreadOnlyBool = unreadOnly === 'true';
    return this.adminStatisticsService.getAdminNotifications(unreadOnlyBool);
  }

  @Get('export/dashboard/excel')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Exporter le tableau de bord en Excel',
    description: `Exporte les statistiques du tableau de bord (demandes, utilisateurs, organisations) en format Excel.

**Rôle requis : ADMIN**`
  })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['month', 'week', 'all'],
    description: 'Période d\'export (month: ce mois, week: cette semaine, all: toutes les périodes)',
  })
  @ApiResponse({
    status: 200,
    description: 'Fichier Excel téléchargé',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Accès refusé - Rôle ADMIN requis' })
  async exportDashboardToExcel(
    @Res() res: Response,
    @Query('period') period?: 'month' | 'week' | 'all',
  ): Promise<void> {
    const buffer = await this.adminExportService.exportDashboardToExcel(period);
    const filename = `tableau-de-bord-${new Date().toISOString().split('T')[0]}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get('export/dashboard/pdf')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Exporter le tableau de bord en PDF',
    description: `Exporte les statistiques du tableau de bord (demandes, utilisateurs, organisations) en format PDF.

**Rôle requis : ADMIN**`
  })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['month', 'week', 'all'],
    description: 'Période d\'export (month: ce mois, week: cette semaine, all: toutes les périodes)',
  })
  @ApiResponse({
    status: 200,
    description: 'Fichier PDF téléchargé',
    content: {
      'application/pdf': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Accès refusé - Rôle ADMIN requis' })
  async exportDashboardToPDF(
    @Res() res: Response,
    @Query('period') period?: 'month' | 'week' | 'all',
  ): Promise<void> {
    const buffer = await this.adminExportService.exportDashboardToPDF(period);
    const filename = `tableau-de-bord-${new Date().toISOString().split('T')[0]}.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get('export/requests/excel')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Exporter les demandes en Excel',
    description: `Exporte la liste des demandes en format Excel avec filtres optionnels.

**Rôle requis : ADMIN**`
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: RequestStatus,
    description: 'Filtrer par statut de demande',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Date de début (format: YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'Date de fin (format: YYYY-MM-DD)',
  })
  @ApiResponse({
    status: 200,
    description: 'Fichier Excel téléchargé',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Accès refusé - Rôle ADMIN requis' })
  async exportRequestsToExcel(
    @Res() res: Response,
    @Query('status') status?: RequestStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<void> {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    
    const buffer = await this.adminExportService.exportRequestsToExcel(status, start, end);
    const filename = `demandes-${new Date().toISOString().split('T')[0]}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get('export/users/excel')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Exporter les utilisateurs en Excel',
    description: `Exporte la liste des utilisateurs en format Excel avec filtre optionnel par rôle.

**Rôle requis : ADMIN**`
  })
  @ApiQuery({
    name: 'role',
    required: false,
    enum: UserRole,
    description: 'Filtrer par rôle d\'utilisateur',
  })
  @ApiResponse({
    status: 200,
    description: 'Fichier Excel téléchargé',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Accès refusé - Rôle ADMIN requis' })
  async exportUsersToExcel(
    @Res() res: Response,
    @Query('role') role?: UserRole,
  ): Promise<void> {
    const buffer = await this.adminExportService.exportUsersToExcel(role);
    const filename = `utilisateurs-${new Date().toISOString().split('T')[0]}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get('export/organisations/excel')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Exporter les organisations en Excel',
    description: `Exporte la liste des organisations en format Excel.

**Rôle requis : ADMIN**`
  })
  @ApiResponse({
    status: 200,
    description: 'Fichier Excel téléchargé',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Accès refusé - Rôle ADMIN requis' })
  async exportOrganisationsToExcel(@Res() res: Response): Promise<void> {
    const buffer = await this.adminExportService.exportOrganisationsToExcel();
    const filename = `organisations-${new Date().toISOString().split('T')[0]}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Post('users/:identifier/reset-password')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Réinitialiser le mot de passe d\'un utilisateur',
    description: `Génère un nouveau mot de passe temporaire pour un utilisateur et l'envoie par email.
L'identifiant peut être l'ID de l'utilisateur ou son email.

**Rôle requis : ADMIN**`
  })
  @ApiParam({
    name: 'identifier',
    description: 'ID ou email de l\'utilisateur',
    example: 'user-id-123 ou user@example.com',
  })
  @ApiResponse({
    status: 200,
    description: 'Mot de passe réinitialisé avec succès',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Mot de passe réinitialisé avec succès' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            name: { type: 'string' },
          },
        },
        temporaryPassword: {
          type: 'string',
          description: 'Nouveau mot de passe temporaire (également envoyé par email)',
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Utilisateur non trouvé' })
  @ApiResponse({ status: 403, description: 'Accès refusé - Rôle ADMIN requis' })
  async resetUserPassword(@Param('identifier') identifier: string) {
    const result = await this.usersService.resetUserPassword(identifier);
    
    // Envoyer l'email avec le nouveau mot de passe temporaire
    try {
      await this.emailService.sendPasswordResetEmail(
        result.user.email,
        result.user.name || result.user.email,
        result.temporaryPassword,
      );
    } catch (error) {
      // Ne pas faire échouer la requête si l'email échoue
      console.error(`Erreur lors de l'envoi de l'email à ${result.user.email}:`, error);
    }

    return {
      message: 'Mot de passe réinitialisé avec succès. Le nouveau mot de passe temporaire a été envoyé par email.',
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
      },
      temporaryPassword: result.temporaryPassword, // Retourné dans la réponse pour référence
    };
  }
}

