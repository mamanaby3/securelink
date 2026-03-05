import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { OrganisationRole } from '../../auth/dto/register.dto';

export class CreateOrganisationUserDto {
  @ApiProperty({
    description: 'Nom complet de l\'utilisateur',
    example: 'Moussa Ndiaye',
  })
  @IsString()
  @IsNotEmpty({ message: 'Le nom est requis' })
  name: string;

  @ApiProperty({
    description: 'Email de l\'utilisateur',
    example: 'admin@organisation.com',
  })
  @IsEmail({}, { message: 'Email invalide' })
  @IsNotEmpty({ message: 'L\'email est requis' })
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
    description: 'Rôle de l\'utilisateur au niveau organisation\n- AGENT: Consulter et traiter les demandes\n- SUPERVISEUR: + Validation finale + Supervision de l\'équipe\n- ADMINISTRATION: + Gérer les utilisateurs',
    enum: OrganisationRole,
    example: OrganisationRole.AGENT,
  })
  @IsEnum(OrganisationRole, { message: 'Rôle organisation invalide' })
  @IsNotEmpty({ message: 'Le rôle organisation est requis' })
  organisationRole: OrganisationRole;
}

