import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches, IsUUID, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';
import { DocumentType } from '../entities/user-document.entity';

export class UploadDocumentDto {
  @ApiProperty({
    description: 'ID du type de document créé par l\'admin (obligatoire)',
    example: 'doc-type-123',
  })
  @IsUUID('4', { message: 'L\'ID du type de document doit être un UUID valide' })
  @IsNotEmpty({ message: 'L\'ID du type de document est requis' })
  documentTypeId: string;

  @ApiProperty({
    description: 'Date de délivrance au format jj/mm/aaaa',
    example: '27/01/2022',
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    // Convertir les valeurs vides, "string", null, undefined en undefined
    if (!value || value === '' || value === 'string' || value === null || value === undefined) {
      return undefined;
    }
    return value;
  })
  @ValidateIf((o) => o.issueDate !== undefined && o.issueDate !== null && o.issueDate !== '' && o.issueDate !== 'string')
  @IsString({ message: 'La date de délivrance doit être une chaîne de caractères' })
  @Matches(/^\d{2}\/\d{2}\/\d{4}$/, {
    message: 'Format de date invalide. Utilisez jj/mm/aaaa',
  })
  issueDate?: string;

  @ApiProperty({
    description: 'Date d\'expiration au format jj/mm/aaaa',
    example: '27/12/2027',
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    // Convertir les valeurs vides, "string", null, undefined en undefined
    if (!value || value === '' || value === 'string' || value === null || value === undefined) {
      return undefined;
    }
    return value;
  })
  @ValidateIf((o) => o.expirationDate !== undefined && o.expirationDate !== null && o.expirationDate !== '' && o.expirationDate !== 'string')
  @IsString({ message: 'La date d\'expiration doit être une chaîne de caractères' })
  @Matches(/^\d{2}\/\d{2}\/\d{4}$/, {
    message: 'Format de date invalide. Utilisez jj/mm/aaaa',
  })
  expirationDate?: string;
}



