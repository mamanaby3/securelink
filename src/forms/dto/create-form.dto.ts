import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { Sector } from '../../organisations/dto/create-organisation.dto';

// Garder les enums pour la compatibilité avec l'entité
export enum FormType {
  TRANSACTION = 'TRANSACTION',
  DEMANDE = 'DEMANDE',
  DECLARATION = 'DECLARATION',
  RESILIATION = 'RESILIATION',
}

export class CreateFormDto {
  @ApiProperty({
    description: 'Nom du formulaire',
    example: 'Demande de virement',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Version du formulaire',
    example: '1.0',
  })
  @IsString()
  @IsNotEmpty()
  version: string;

  @ApiProperty({
    description: 'Description du formulaire',
    example: 'Formulaire pour effectuer un virement bancaire',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'ID du secteur d\'activité (depuis la base de données)',
    example: 'sector-uuid-123',
  })
  @IsUUID()
  @IsNotEmpty({ message: 'Le secteur est requis' })
  sectorId: string;

  @ApiProperty({
    description: 'ID du type de formulaire (depuis la base de données)',
    example: 'form-type-uuid-123',
  })
  @IsUUID()
  @IsNotEmpty({ message: 'Le type de formulaire est requis' })
  formTypeId: string;

  @ApiProperty({
    description: 'ID de l\'organisation',
    example: 'org-123',
  })
  @IsString()
  @IsNotEmpty()
  organisationId: string;

  @ApiProperty({
    description: 'Modèle PDF (base64 ou URL)',
    required: false,
  })
  @IsString()
  @IsOptional()
  pdfTemplate?: string;

  @ApiProperty({
    description: 'Liste des IDs des types de documents requis (depuis la base de données, table document_types)',
    type: [String],
    required: false,
    example: ['doc-type-uuid-1', 'doc-type-uuid-2'],
  })
  @IsOptional()
  @IsUUID('4', { each: true, message: 'Chaque ID de document requis doit être un UUID valide' })
  requiredDocuments?: string[];

  // editableFields n'est plus nécessaire à l'étape 1
  // Les champs seront ajoutés automatiquement lors de l'upload du PDF
  // ou via PATCH /api/forms/:id/fields
  editableFields?: any[];
}



