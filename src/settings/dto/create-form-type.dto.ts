import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateFormTypeDto {
  @ApiProperty({
    description: 'Nom du type de formulaire',
    example: 'Demande',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Description du type de formulaire',
    example: 'Toutes les institutions financières proposant des services bancaires et crédits.',
  })
  @IsString()
  @IsOptional()
  description?: string;
}










