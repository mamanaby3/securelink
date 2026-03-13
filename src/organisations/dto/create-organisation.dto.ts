import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export enum Sector {
  BANQUE = 'BANQUE',
  NOTAIRE = 'NOTAIRE',
  ASSURANCE = 'ASSURANCE',
  HUISSIER = 'HUISSIER',
}

export class CreateOrganisationDto {
  @ApiProperty({
    description: 'Nom de l\'organisation',
    example: 'Banque XYZ',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'ID du secteur (depuis la table sectors)',
    example: 'uuid-du-secteur',
  })
  @IsUUID()
  sectorId: string;

  @ApiProperty({
    description: 'Email de l\'administrateur de l\'organisation',
    required: false,
  })
  @IsEmail()
  @IsOptional()
  adminEmail?: string;

  @ApiProperty({
    description: 'Mot de passe de l\'admin (optionnel, un mot de passe temporaire sera généré si absent)',
    required: false,
  })
  @IsString()
  @IsOptional()
  adminPassword?: string;

  @ApiProperty({
    description: 'Numéro de téléphone',
    required: false,
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({
    description: 'Logo (chemin ou base64)',
    required: false,
  })
  @IsString()
  @IsOptional()
  logo?: string;
}
