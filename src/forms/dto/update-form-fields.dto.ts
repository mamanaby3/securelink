import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, ValidateNested, IsString, IsBoolean, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class EditableFieldDto {
  @ApiProperty({
    description: 'Nom du champ (identifiant unique)',
    example: 'beneficiary_name',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Type de champ (text, number, email, date, checkbox, radio, select)',
    example: 'text',
  })
  @IsString()
  type: string;

  @ApiProperty({
    description: 'Indique si le champ est obligatoire',
    example: true,
  })
  @IsBoolean()
  required: boolean;

  @ApiProperty({
    description: 'Label du champ (affiché à l\'utilisateur)',
    example: 'Nom du bénéficiaire',
    required: false,
  })
  @IsString()
  @IsOptional()
  label?: string;

  @ApiProperty({
    description: 'Placeholder du champ',
    example: 'Entrez le nom du bénéficiaire',
    required: false,
  })
  @IsString()
  @IsOptional()
  placeholder?: string;

  @ApiProperty({
    description: 'Position X du champ dans le PDF (en points, depuis le bas gauche)',
    example: 100,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  x?: number;

  @ApiProperty({
    description: 'Position Y du champ dans le PDF (en points, depuis le bas gauche)',
    example: 700,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  y?: number;

  @ApiProperty({
    description: 'Largeur du champ (en points)',
    example: 200,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  width?: number;

  @ApiProperty({
    description: 'Hauteur du champ (en points)',
    example: 20,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  height?: number;

  @ApiProperty({
    description: 'Numéro de page où ajouter le champ (0 = première page)',
    example: 0,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  page?: number;
}

export class UpdateFormFieldsDto {
  @ApiProperty({
    description: 'Liste des champs modifiables du formulaire',
    type: [EditableFieldDto],
    required: false,
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => EditableFieldDto)
  editableFields?: EditableFieldDto[];

  @ApiProperty({
    description: 'Liste des IDs des documents requis',
    type: [String],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  requiredDocuments?: string[];
}

