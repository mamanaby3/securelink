import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID, MinLength, Matches, ValidateIf } from 'class-validator';

// Garder l'enum pour la compatibilité avec l'entité
export enum Sector {
  BANQUE = 'BANQUE',
  NOTAIRE = 'NOTAIRE',
  ASSURANCE = 'ASSURANCE',
  HUISSIER = 'HUISSIER',
}

export class CreateOrganisationDto {
  @ApiProperty({
    description: 'ID du secteur d\'activité (depuis la base de données)',
    example: 'sector-uuid-123',
  })
  @IsUUID()
  @IsNotEmpty({ message: 'Le secteur est requis' })
  sectorId: string;

  @ApiProperty({
    description: 'Nom de l\'organisation',
    example: 'Banque Populaire',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Email de l\'administrateur (optionnel). Si fourni, un utilisateur administrateur sera créé pour cette organisation.',
    example: 'admin@organisation.com',
    required: false,
  })
  @IsEmail()
  @IsOptional()
  adminEmail?: string;

  @ApiProperty({
    description: 'Numéro de téléphone avec indicatif pays (format: +XXX...)',
    example: '+221775698088',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: 'Le numéro de téléphone doit commencer par un indicatif pays (ex: +221775698088)',
  })
  phone?: string;

  @ApiProperty({
    description: 'Logo de l\'organisation (base64 ou URL)',
    required: false,
  })
  @IsString()
  @IsOptional()
  logo?: string;

  @ApiProperty({
    description: 'Mot de passe de l\'administrateur (minimum 8 caractères, avec majuscule, minuscule, chiffre et caractère spécial). Requis seulement si adminEmail est fourni. Si non fourni, un mot de passe sera généré automatiquement.',
    example: 'AdminPass123!',
    minLength: 8,
    required: false,
  })
  @ValidateIf((o) => o.adminEmail !== undefined && o.adminEmail !== null)
  @IsString()
  @IsOptional()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial',
  })
  adminPassword?: string;
}







