import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { UserRole, UserType, OrganisationRole } from '../../auth/dto/register.dto';

export class CreateUserDto {
  @ApiProperty({
    description: 'Nom complet de l\'utilisateur (ou sera construit à partir de firstName et lastName)',
    example: 'Moussa Ndiaye',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'Prénom',
    example: 'Moussa',
    required: false,
  })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiProperty({
    description: 'Nom de famille',
    example: 'Ndiaye',
    required: false,
  })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({
    description: 'Email de l\'utilisateur',
    example: 'admin@organisation.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

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
    description: 'Type d\'utilisateur (optionnel - sera automatiquement déterminé si non fourni). Pour CLIENT: sera automatiquement CLIENT. Pour ORGANISATION: sera automatiquement déduit du secteur de l\'organisation.',
    enum: UserType,
    example: UserType.NOTAIRE,
    required: false,
  })
  @IsEnum(UserType)
  @IsOptional()
  type?: UserType;

  @ApiProperty({
    description: 'Rôle de l\'utilisateur au niveau application (sera automatiquement forcé à ORGANISATION si organisationId est fourni)',
    enum: UserRole,
    example: UserRole.ORGANISATION,
    required: false,
  })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @ApiProperty({
    description: 'Type/Rôle de l\'utilisateur dans l\'organisation (AGENT, SUPERVISEUR, ADMINISTRATION). C\'est le champ principal que l\'admin choisit lors de la création.',
    enum: OrganisationRole,
    example: OrganisationRole.AGENT,
  })
  @IsEnum(OrganisationRole, { message: 'Le rôle organisation doit être AGENT, SUPERVISEUR ou ADMINISTRATION' })
  @IsNotEmpty({ message: 'Le rôle organisation est obligatoire' })
  organisationRole: OrganisationRole;

  @ApiProperty({
    description: 'ID de l\'organisation (obligatoire pour créer un utilisateur d\'organisation)',
    example: 'org-123',
  })
  @IsString()
  @IsNotEmpty({ message: 'L\'organisationId est obligatoire' })
  organisationId: string;
}

