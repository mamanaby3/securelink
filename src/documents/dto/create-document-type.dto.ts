import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDocumentTypeDto {
  @ApiProperty({
    description: 'Titre du type de document',
    example: 'Carte d\'identité',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Ce document a-t-il une date d\'expiration ?',
    example: true,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  hasExpirationDate?: boolean;

  @ApiProperty({
    description: 'Ce document sert-il à vérifier l\'identité ?',
    example: true,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isForIdentityVerification?: boolean;
}













