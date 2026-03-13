import { ApiProperty } from '@nestjs/swagger';

export enum NotificationType {
  DOCUMENT_EXPIRING = 'DOCUMENT_EXPIRING',
  DOCUMENT_VALIDATED = 'DOCUMENT_VALIDATED',
  REQUEST_VALIDATED = 'REQUEST_VALIDATED',
  REQUEST_REJECTED = 'REQUEST_REJECTED',
  VERIFICATION_PENDING = 'VERIFICATION_PENDING',
  DOCUMENT_REJECTED = 'DOCUMENT_REJECTED',
}

export enum NotificationSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  SUCCESS = 'SUCCESS',
}

export class NotificationDto {
  @ApiProperty({ description: 'ID de la notification' })
  id: string;

  @ApiProperty({ description: 'Type de notification', enum: NotificationType })
  type: NotificationType;

  @ApiProperty({ description: 'Sévérité de la notification', enum: NotificationSeverity })
  severity: NotificationSeverity;

  @ApiProperty({ description: 'Titre de la notification', example: 'Carte d\'identité expire bientôt' })
  title: string;

  @ApiProperty({ description: 'Message de la notification', example: 'Votre carte d\'identité expire dans 15 jours, renouvelé dès maintenant.' })
  message: string;

  @ApiProperty({ description: 'Date de la notification' })
  date: Date;

  @ApiProperty({ description: 'Temps écoulé depuis la notification', example: 'Aujourd\'hui, 07:35' })
  timeAgo: string;

  @ApiProperty({ description: 'ID de l\'élément lié (demande ou document)', required: false })
  relatedId?: string;

  @ApiProperty({ description: 'Type d\'élément lié', required: false, example: 'document' })
  relatedType?: string;

  @ApiProperty({ description: 'Indique si la notification a été lue', default: false })
  isRead: boolean;
}











