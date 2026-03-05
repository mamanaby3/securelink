import { ApiProperty } from '@nestjs/swagger';

export class FormStatisticsDto {
  @ApiProperty({ description: 'Total de formulaires créés ce mois', example: 3 })
  totalThisMonth: number;

  @ApiProperty({ description: 'Total de tous les formulaires', example: 15 })
  total: number;

  @ApiProperty({ description: 'Nombre de formulaires en brouillon (DRAFT)', example: 1 })
  draft: number;

  @ApiProperty({ description: 'Nombre de formulaires actifs (ONLINE)', example: 2 })
  active: number;

  @ApiProperty({ description: 'Nombre de formulaires hors ligne (OFFLINE)', example: 0 })
  offline: number;

  @ApiProperty({ description: 'Pourcentage de changement ce mois pour le total', example: '+12%', nullable: true })
  totalChangeThisMonth?: string;

  @ApiProperty({ description: 'Pourcentage de changement ce mois pour les brouillons', example: '+12%', nullable: true })
  draftChangeThisMonth?: string;

  @ApiProperty({ description: 'Pourcentage de changement ce mois pour les actifs', example: '+12%', nullable: true })
  activeChangeThisMonth?: string;
}







