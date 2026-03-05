import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';

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
}






