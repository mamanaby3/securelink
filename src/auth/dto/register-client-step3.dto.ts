import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength, Matches, IsBoolean } from 'class-validator';

export class RegisterClientStep3Dto {
  @ApiProperty({
    description: 'Token de session de l\'étape précédente',
    example: 'session-token-123',
  })
  @IsString()
  @IsNotEmpty({ message: 'Le token de session est requis' })
  sessionToken: string;

  @ApiProperty({
    description: 'Mot de passe (minimum 8 caractères, avec majuscule, minuscule, chiffre et caractère spécial)',
    example: 'SecurePass123!',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe est requis' })
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial',
  })
  password: string;

  @ApiProperty({
    description: 'Confirmation du mot de passe',
    example: 'SecurePass123!',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty({ message: 'La confirmation du mot de passe est requise' })
  @MinLength(8, { message: 'La confirmation du mot de passe doit contenir au moins 8 caractères' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'La confirmation du mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial',
  })
  confirmPassword: string;

  @ApiProperty({
    description: 'Acceptation des conditions d\'utilisation et de la politique de confidentialité',
    example: true,
  })
  @IsBoolean()
  @IsNotEmpty({ message: 'Vous devez accepter les conditions d\'utilisation' })
  acceptTerms: boolean;
}








