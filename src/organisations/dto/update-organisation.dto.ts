import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { Sector } from './create-organisation.dto';

export class UpdateOrganisationDto {
  @ApiProperty({
    description: 'Secteur d\'activité',
    enum: Sector,
    required: false,
  })
  @IsEnum(Sector)
  @IsOptional()
  sector?: Sector;

  @ApiProperty({
    description: 'Nom de l\'organisation',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'Email de l\'administrateur',
    required: false,
  })
  @IsEmail()
  @IsOptional()
  adminEmail?: string;

  @ApiProperty({
    description: 'Numéro de téléphone',
    required: false,
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({
    description: 'Logo de l\'organisation',
    required: false,
  })
  @IsString()
  @IsOptional()
  logo?: string;
}










