import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength, Matches } from 'class-validator';

export enum UserRole {
  ADMIN = 'ADMIN',
  ORGANISATION = 'ORGANISATION',
  CLIENT = 'CLIENT',
}

export enum OrganisationRole {
  AGENT = 'AGENT',
  SUPERVISEUR = 'SUPERVISEUR',
  ADMINISTRATION = 'ADMINISTRATION',
}

export enum UserType {
  NOTAIRE = 'NOTAIRE',
  BANQUE = 'BANQUE',
  ASSURANCE = 'ASSURANCE',
  HUISSIER = 'HUISSIER',
  CLIENT = 'CLIENT',
}

export class RegisterDto {
  @ApiProperty({
    description: 'Nom complet de l\'utilisateur',
    example: 'Moussa Ly',
  })
  @IsString()
  @IsNotEmpty({ message: 'Le nom est requis' })
  name: string;

  @ApiProperty({
    description: 'Email de l\'utilisateur',
    example: 'moussa.ly@securelink.com',
  })
  @IsEmail({}, { message: 'Email invalide' })
  @IsNotEmpty({ message: 'L\'email est requis' })
  email: string;

  @ApiProperty({
    description: 'Mot de passe (minimum 8 caractères, avec majuscule, minuscule, chiffre et caractère spécial)',
    example: 'SecurePass123!',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe est requis' })
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial',
  })
  password: string;

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
    description: 'Rôle de l\'utilisateur',
    enum: UserRole,
    example: UserRole.CLIENT,
  })
  @IsEnum(UserRole, { message: 'Rôle invalide' })
  @IsNotEmpty({ message: 'Le rôle est requis' })
  role: UserRole;

  @ApiProperty({
    description: 'Type d\'utilisateur (pour organisations)',
    enum: UserType,
    example: UserType.BANQUE,
    required: false,
  })
  @IsEnum(UserType)
  @IsOptional()
  type?: UserType;

  @ApiProperty({
    description: 'ID de l\'organisation (si l\'utilisateur est lié à une organisation)',
    example: 'org-123',
    required: false,
  })
  @IsString()
  @IsOptional()
  organisationId?: string;
}



