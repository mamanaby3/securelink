import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsBoolean, IsArray, IsOptional, Min, Max } from 'class-validator';

export class UpdateSecuritySettingsDto {
  @ApiProperty({
    description: 'Durée d\'expiration de session en minutes',
    example: 15,
    minimum: 5,
    maximum: 1440, // 24 heures
    required: false,
  })
  @IsInt()
  @Min(5)
  @Max(1440)
  @IsOptional()
  sessionExpirationMinutes?: number;

  @ApiProperty({
    description: 'Nombre maximum de tentatives de connexion',
    example: 5,
    minimum: 3,
    maximum: 10,
    required: false,
  })
  @IsInt()
  @Min(3)
  @Max(10)
  @IsOptional()
  maxLoginAttempts?: number;

  @ApiProperty({
    description: 'Durée de verrouillage en minutes après échecs de connexion',
    example: 15,
    minimum: 5,
    maximum: 60,
    required: false,
  })
  @IsInt()
  @Min(5)
  @Max(60)
  @IsOptional()
  lockoutDurationMinutes?: number;

  @ApiProperty({
    description: 'Exiger la vérification d\'email',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  requireEmailVerification?: boolean;

  @ApiProperty({
    description: 'Exiger des documents pour compléter l\'inscription',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  requireDocumentsForRegistration?: boolean;

  @ApiProperty({
    description: 'IDs des types de documents requis pour l\'inscription',
    type: [String],
    example: ['doc-type-1', 'doc-type-2'],
    required: false,
  })
  @IsArray()
  @IsOptional()
  requiredDocumentsForRegistration?: string[];
}
