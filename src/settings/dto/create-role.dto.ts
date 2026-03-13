import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({
    description: 'Nom du rôle',
    example: 'Admin',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Description du rôle',
    example: 'Gère l\'ensemble de la plateforme : création et suppression de comptes...',
  })
  @IsString()
  @IsOptional()
  description?: string;
}













