import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectRequestDto {
  @ApiProperty({
    description: 'Motif du rejet de la demande',
    example: 'Documents incomplets, photo de mauvaise qualité...',
    required: true,
  })
  @IsString()
  @IsNotEmpty({ message: 'Le motif du rejet est requis' })
  @MaxLength(1000, { message: 'Le motif ne peut pas dépasser 1000 caractères' })
  reason: string;
}











