import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, Matches } from 'class-validator';

export class UpdateRequestEmailDto {
  @ApiProperty({
    description: 'Nouvelle adresse email pour recevoir le code OTP',
    example: 'nouveau@email.com',
  })
  @IsNotEmpty({ message: 'L\'email est requis' })
  @IsEmail({}, { message: 'Format d\'email invalide' })
  @Matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, {
    message: 'Format d\'email invalide. Utilisez le format: exemple@domaine.com',
  })
  email: string;
}







