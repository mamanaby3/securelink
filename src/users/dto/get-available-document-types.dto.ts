import { ApiProperty } from '@nestjs/swagger';

export class AvailableDocumentTypeDto {
  @ApiProperty({
    description: 'ID du type de document',
    example: 'doc-type-123',
  })
  id: string;

  @ApiProperty({
    description: 'Titre du type de document',
    example: 'Carte d\'identité',
  })
  title: string;

  @ApiProperty({
    description: 'Le document a-t-il une date d\'expiration ?',
    example: true,
  })
  hasExpirationDate: boolean;

  @ApiProperty({
    description: 'Le document sert-il à vérifier l\'identité ?',
    example: true,
  })
  isForIdentityVerification: boolean;

  @ApiProperty({
    description: 'Type de document correspondant (enum)',
    enum: ['CARTE_IDENTITE', 'CERTIFICAT_NATIONALITE', 'EXTRAIT_NAISSANCE', 'AUTRE'],
    example: 'CARTE_IDENTITE',
  })
  mappedType: string;

  @ApiProperty({
    description: 'Le document est-il requis pour compléter l\'inscription ?',
    example: true,
  })
  isRequired: boolean;
}






