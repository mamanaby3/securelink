import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsString, IsOptional, MaxLength } from 'class-validator';

export class RequestAdditionalDocumentsDto {
  @ApiProperty({
    description: 'Liste des documents manquants ou à mettre à jour',
    example: ['Contrat de travail', 'Relevé bancaire (3 derniers mois)', 'Déclaration de revenus 2025'],
    type: [String],
    required: true,
  })
  @IsArray()
  @IsNotEmpty({ message: 'Au moins un document doit être sélectionné' })
  @IsString({ each: true, message: 'Chaque document doit être une chaîne de caractères' })
  documents: string[];

  @ApiProperty({
    description: 'Message au client (facultatif)',
    example: 'Ajoutez toute instruction ou clarification supplémentaire...',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000, { message: 'Le message ne peut pas dépasser 1000 caractères' })
  message?: string;
}








