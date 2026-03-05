import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class UpdateDocumentDto {
  @ApiProperty({
    description: 'Date de délivrance au format DD/MM/YYYY',
    example: '27/01/2022',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Matches(/^\d{2}\/\d{2}\/\d{4}$/, {
    message: 'La date doit être au format DD/MM/YYYY',
  })
  issueDate?: string;

  @ApiProperty({
    description: 'Date d\'expiration au format DD/MM/YYYY',
    example: '27/12/2027',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Matches(/^\d{2}\/\d{2}\/\d{4}$/, {
    message: 'La date doit être au format DD/MM/YYYY',
  })
  expirationDate?: string;
}








