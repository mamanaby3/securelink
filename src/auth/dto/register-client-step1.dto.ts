import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, IsEnum, Matches } from 'class-validator';

export enum Gender {
  HOMME = 'HOMME',
  FEMME = 'FEMME',
  AUTRE = 'AUTRE',
}

export enum MaritalStatus {
  CELIBATAIRE = 'CELIBATAIRE',
  MARIE = 'MARIE',
  DIVORCE = 'DIVORCE',
  VEUF = 'VEUF',
  CONCUBINAGE = 'CONCUBINAGE',
}

export class RegisterClientStep1Dto {
  @ApiProperty({
    description: 'Nom de famille',
    example: 'Faye',
  })
  @IsString()
  @IsNotEmpty({ message: 'Le nom est requis' })
  lastName: string;

  @ApiProperty({
    description: 'Prénom',
    example: 'Lamine',
  })
  @IsString()
  @IsNotEmpty({ message: 'Le prénom est requis' })
  firstName: string;

  @ApiProperty({
    description: 'Email de l\'utilisateur',
    example: 'lamine.faye@example.com',
  })
  @IsEmail({}, { message: 'Email invalide' })
  @IsNotEmpty({ message: 'L\'email est requis' })
  @Matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, {
    message: 'Format d\'email invalide',
  })
  email: string;

  @ApiProperty({
    description: 'Numéro de téléphone avec indicatif pays (format: +XXX...)',
    example: '+221775698088',
  })
  @IsString()
  @IsNotEmpty({ message: 'Le numéro de téléphone est requis' })
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: 'Le numéro de téléphone doit commencer par un indicatif pays (ex: +221775698088)',
  })
  phone: string;

  @ApiProperty({
    description: 'Adresse de l\'utilisateur',
    example: 'Yoff',
  })
  @IsString()
  @IsNotEmpty({ message: 'L\'adresse est requise' })
  address: string;

  @ApiProperty({
    description: 'Date de naissance au format jj/mm/aaaa',
    example: '15/03/1990',
  })
  @IsString()
  @IsNotEmpty({ message: 'La date de naissance est requise' })
  @Matches(/^\d{2}\/\d{2}\/\d{4}$/, {
    message: 'Format de date invalide. Utilisez jj/mm/aaaa',
  })
  dateOfBirth: string;

  @ApiProperty({
    description: 'Genre de l\'utilisateur',
    enum: Gender,
    example: Gender.FEMME,
  })
  @IsEnum(Gender, { message: 'Genre invalide' })
  @IsNotEmpty({ message: 'Le genre est requis' })
  gender: Gender;

  @ApiProperty({
    description: 'Situation matrimoniale',
    enum: MaritalStatus,
    example: MaritalStatus.CELIBATAIRE,
  })
  @IsEnum(MaritalStatus, { message: 'Situation matrimoniale invalide' })
  @IsNotEmpty({ message: 'La situation matrimoniale est requise' })
  maritalStatus: MaritalStatus;
}






