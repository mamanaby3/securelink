import { ApiProperty } from '@nestjs/swagger';

export class RequestStatisticsDto {
  @ApiProperty({
    description: 'Total de demandes',
    example: 315,
  })
  total: number;

  @ApiProperty({
    description: 'Demandes en attente',
    example: 42,
  })
  pending: number;

  @ApiProperty({
    description: 'Demandes en cours',
    example: 18,
  })
  inProgress: number;

  @ApiProperty({
    description: 'Demandes validées',
    example: 234,
  })
  validated: number;

  @ApiProperty({
    description: 'Demandes rejetées',
    example: 3,
  })
  rejected: number;

  @ApiProperty({
    description: 'Pourcentage de changement ce mois',
    example: '+12%',
  })
  totalChangeThisMonth?: string;

  @ApiProperty({
    description: 'Pourcentage de changement pour les validées',
    example: '-3.1%',
  })
  validatedChangeThisMonth?: string;

  @ApiProperty({
    description: 'Pourcentage de changement pour les rejetées',
    example: '+15.3%',
  })
  rejectedChangeThisMonth?: string;
}













