import { ApiProperty } from '@nestjs/swagger';

export class ExpiringDocumentDto {
  @ApiProperty({ description: 'ID du document' })
  id: string;

  @ApiProperty({ description: 'Type de document', example: 'Carte d\'identité' })
  type: string;

  @ApiProperty({ description: 'Date d\'expiration', example: '2026-02-20' })
  expirationDate: Date;

  @ApiProperty({ description: 'Statut du document', example: 'EN_VERIFICATION' })
  status: string;

  @ApiProperty({ description: 'Jours restants avant expiration', example: 15 })
  daysUntilExpiration: number;
}








