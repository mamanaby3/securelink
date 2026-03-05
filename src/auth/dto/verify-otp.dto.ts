import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({
    description: 'Email de l\'utilisateur',
    example: 'user@example.com',
  })
  @IsNotEmpty({ message: 'L\'email est requis' })
  @IsEmail({}, { message: 'Format d\'email invalide' })
  @Matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, {
    message: 'Format d\'email invalide. Utilisez le format: exemple@domaine.com',
  })
  email: string;

  @ApiProperty({
    description: 'Code OTP reçu par email',
    example: '1234',
    minLength: 4,
    maxLength: 4,
  })
  @IsString()
  @IsNotEmpty({ message: 'Le code OTP est requis' })
  @Length(4, 4, { message: 'Le code OTP doit contenir exactement 4 chiffres' })
  @Matches(/^\d{4}$/, {
    message: 'Le code OTP doit contenir uniquement des chiffres',
  })
  otp: string;
}

