import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSectorDto {
  @ApiProperty({
    description: 'Nom du secteur',
    example: 'Banque',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Description du secteur',
    example: 'Toutes les institutions financières proposant des services bancaires et crédits.',
  })
  @IsString()
  @IsOptional()
  description?: string;
}













