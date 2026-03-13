import { ApiProperty } from '@nestjs/swagger';

export class DocumentStatisticsDto {
  @ApiProperty({ description: 'Total de types de documents créés ce mois', example: 3 })
  totalThisMonth: number;

  @ApiProperty({ description: 'Total de tous les types de documents', example: 10 })
  total: number;

  @ApiProperty({ description: 'Nombre de documents requis (isForIdentityVerification: true)', example: 2 })
  required: number;

  @ApiProperty({ description: 'Nombre de documents facultatifs (isForIdentityVerification: false)', example: 1 })
  optional: number;

  @ApiProperty({ description: 'Pourcentage de changement ce mois pour le total', example: '+12%', nullable: true })
  totalChangeThisMonth?: string;

  @ApiProperty({ description: 'Pourcentage de changement ce mois pour les documents requis', example: '+12%', nullable: true })
  requiredChangeThisMonth?: string;

  @ApiProperty({ description: 'Pourcentage de changement ce mois pour les documents facultatifs', example: '+12%', nullable: true })
  optionalChangeThisMonth?: string;
}










