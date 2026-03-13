import { ApiProperty } from '@nestjs/swagger';

export class DashboardKPIDto {
  @ApiProperty({ description: 'Total utilisateurs', example: 156 })
  totalUsers: number;

  @ApiProperty({ description: 'Pourcentage de changement ce mois', example: '+12%' })
  usersChange: string;

  @ApiProperty({ description: 'Total organisations', example: 28 })
  totalOrganisations: number;

  @ApiProperty({ description: 'Pourcentage de changement ce mois', example: '+12%' })
  organisationsChange: string;

  @ApiProperty({ description: 'Demandes en attente', example: 234 })
  pendingRequests: number;

  @ApiProperty({ description: 'Pourcentage de changement ce mois', example: '-3.1%' })
  pendingRequestsChange: string;

  @ApiProperty({ description: 'Alertes de sécurité', example: 3 })
  securityAlerts: number;

  @ApiProperty({ description: 'Pourcentage de changement vs mois dernier', example: '+15.3%' })
  securityAlertsChange: string;
}

export class WeeklyTransactionVolumeDto {
  @ApiProperty({ description: 'Jour de la semaine', example: 'Lun' })
  day: string;

  @ApiProperty({ description: 'Volume de transactions', example: 38 })
  volume: number;
}

export class UserActivityTrendDto {
  @ApiProperty({ description: 'Jour de la semaine', example: 'Lun' })
  day: string;

  @ApiProperty({ description: 'Niveau d\'activité', example: 6.5 })
  activity: number;
}

export class RecentActivityDto {
  @ApiProperty({ description: 'ID de l\'activité', example: 'activity-1' })
  id: string;

  @ApiProperty({ description: 'Type d\'activité', example: 'request_submitted' })
  type: string;

  @ApiProperty({ description: 'Titre de l\'activité', example: 'Demande de transfert soumise' })
  title: string;

  @ApiProperty({ description: 'Temps écoulé', example: 'Il y a 5 minutes' })
  timeAgo: string;

  @ApiProperty({ description: 'Date de l\'activité' })
  date: Date;

  @ApiProperty({ description: 'Icône', example: 'check' })
  icon?: string;
}

export class AdminDashboardDto {
  @ApiProperty({ description: 'Indicateurs clés de performance', type: DashboardKPIDto })
  kpis: DashboardKPIDto;

  @ApiProperty({ description: 'Volume hebdomadaire des transactions', type: [WeeklyTransactionVolumeDto] })
  weeklyTransactionVolume: WeeklyTransactionVolumeDto[];

  @ApiProperty({ description: 'Tendances de l\'activité des utilisateurs', type: [UserActivityTrendDto] })
  userActivityTrends: UserActivityTrendDto[];

  @ApiProperty({ description: 'Activité récente', type: [RecentActivityDto] })
  recentActivities: RecentActivityDto[];
}







