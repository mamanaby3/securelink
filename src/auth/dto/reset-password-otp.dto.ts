import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength, Matches, Length } from 'class-validator';

export class ResetPasswordOtpDto {
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
    description: 'Code OTP vérifié',
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

  @ApiProperty({
    description: 'Nouveau mot de passe (minimum 8 caractères, avec majuscule, minuscule, chiffre et caractère spécial)',
    example: 'NewSecurePass123!',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty({ message: 'Le nouveau mot de passe est requis' })
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial',
  })
  newPassword: string;

  @ApiProperty({
    description: 'Confirmation du nouveau mot de passe (doit correspondre au nouveau mot de passe)',
    example: 'NewSecurePass123!',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty({ message: 'La confirmation du mot de passe est requise' })
  @MinLength(8, { message: 'La confirmation du mot de passe doit contenir au moins 8 caractères' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'La confirmation du mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial',
  })
  confirmPassword: string;
}

