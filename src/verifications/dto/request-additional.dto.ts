import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsString, IsOptional, MaxLength, IsEnum } from 'class-validator';

export enum AdditionalInfoReason {
  IMAGE_FLOUE = 'IMAGE_FLOUE',
  PIECE_EXPIREE = 'PIECE_EXPIREE',
  NUMERO_ILLISIBLE = 'NUMERO_ILLISIBLE',
  MAUVAIS_DOCUMENT = 'MAUVAIS_DOCUMENT',
  INFORMATION_INCOHERENTES = 'INFORMATION_INCOHERENTES',
}

export class RequestAdditionalDto {
  @ApiProperty({
    description: 'Raisons de la demande de complément',
    enum: AdditionalInfoReason,
    isArray: true,
    example: [AdditionalInfoReason.IMAGE_FLOUE, AdditionalInfoReason.NUMERO_ILLISIBLE],
    required: true,
  })
  @IsArray()
  @IsNotEmpty({ message: 'Au moins une raison doit être sélectionnée' })
  @IsEnum(AdditionalInfoReason, { each: true, message: 'Raison invalide' })
  reasons: AdditionalInfoReason[];

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








