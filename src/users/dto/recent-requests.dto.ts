import { ApiProperty } from '@nestjs/swagger';

export class RecentRequestDto {
  @ApiProperty({ description: 'ID de la demande' })
  id: string;

  @ApiProperty({ description: 'Numéro de la demande', example: 'DEM-992' })
  requestNumber: string;

  @ApiProperty({ description: 'Nom de l\'institution', example: 'Sonatel' })
  institution: string;

  @ApiProperty({ description: 'Catégorie/Secteur', example: 'Télécom' })
  category: string;

  @ApiProperty({ description: 'Type de demande', example: 'Abonnement internet' })
  type: string;

  @ApiProperty({ description: 'Date de soumission' })
  date: Date;

  @ApiProperty({ description: 'Statut de la demande', example: 'EN_ATTENTE' })
  status: string;

  @ApiProperty({ description: 'Temps écoulé depuis la soumission', example: 'il y a 2 heures' })
  timeAgo: string;
}








