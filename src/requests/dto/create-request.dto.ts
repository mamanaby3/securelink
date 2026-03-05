import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsNumber, IsObject } from 'class-validator';

export class BeneficiaryInfoDto {
  @ApiProperty({
    description: 'Nom du bénéficiaire',
    example: 'Oumy Ly',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Email du bénéficiaire',
    example: 'oumy.ly@gmail.com',
  })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiProperty({
    description: 'Téléphone du bénéficiaire',
    example: '70 645 87 92',
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({
    description: 'IBAN',
    example: 'SN123 4567 8900',
  })
  @IsString()
  @IsOptional()
  iban?: string;

  @ApiProperty({
    description: 'Référence (ex: Facture n°123)',
    example: 'Facture n°123',
  })
  @IsString()
  @IsOptional()
  reference?: string;
}

export class CreateRequestDto {
  @ApiProperty({
    description: 'ID du formulaire',
    example: 'form-123',
  })
  @IsString()
  @IsNotEmpty()
  formId: string;

  @ApiProperty({
    description: 'ID du client (optionnel pour CLIENT - rempli automatiquement depuis le token)',
    example: 'client-123',
    required: false,
  })
  @IsString()
  @IsOptional()
  clientId?: string;

  @ApiProperty({
    description: 'ID de l\'organisation',
    example: 'org-123',
  })
  @IsString()
  @IsNotEmpty()
  organisationId: string;


  @ApiProperty({
    description: 'Adresse email pour recevoir le code OTP (optionnel - utilise l\'email du client par défaut)',
    example: 'client@email.com',
    required: false,
  })
  @IsString()
  @IsOptional()
  verificationEmail?: string;
}
