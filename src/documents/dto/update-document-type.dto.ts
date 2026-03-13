import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateDocumentTypeDto {
  @ApiProperty({
    description: 'Titre du type de document',
    example: 'Carte d\'identité',
    required: false,
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({
    description: 'Ce document a-t-il une date d\'expiration ?',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  hasExpirationDate?: boolean;

  @ApiProperty({
    description: 'Ce document sert-il à vérifier l\'identité ?',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isForIdentityVerification?: boolean;

  @ApiProperty({
    description: 'Statut du type de document (actif/inactif)',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}










