import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateFormFieldDto {
  @ApiProperty({
    description: 'Nom du champ',
    example: 'Nom du bénéficiaire',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Label du champ',
    example: 'Nom du bénéficiaire',
  })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiProperty({
    description: 'Type de champ (text, number, email, etc.)',
    example: 'text',
  })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({
    description: 'Le champ est-il requis ?',
    example: true,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  required?: boolean;

  @ApiProperty({
    description: 'Le champ est-il modifiable ?',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  editable?: boolean;
}










