import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsNumber, IsObject } from 'class-validator';
import { BeneficiaryInfoDto } from './create-request.dto';

export class SaveDraftRequestDto {
  @ApiProperty({
    description: 'ID du formulaire (étape 2)',
    example: 'form-123',
    required: false,
  })
  @IsString()
  @IsOptional()
  formId?: string;

  @ApiProperty({
    description: 'ID de l\'organisation (étape 1)',
    example: 'org-123',
    required: false,
  })
  @IsString()
  @IsOptional()
  organisationId?: string;

  @ApiProperty({
    description: 'Informations sur le bénéficiaire (étape 2)',
    required: false,
  })
  @IsObject()
  @IsOptional()
  beneficiary?: BeneficiaryInfoDto;

  @ApiProperty({
    description: 'Montant de la demande (étape 2)',
    example: 1000.50,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  amount?: number;

  @ApiProperty({
    description: 'Données du formulaire rempli par le client (étape 2)',
    required: false,
  })
  @IsObject()
  @IsOptional()
  formData?: any;
}




