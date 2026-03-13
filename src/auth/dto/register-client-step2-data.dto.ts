import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsEnum, Matches } from 'class-validator';
import { Gender, MaritalStatus } from './register-client-step2.dto';

export class RegisterClientStep2DataDto {
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











