import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';

export class SetupPasswordDto {
  @ApiProperty({
    description: 'Token de création de mot de passe reçu par email',
    example: 'pwd-setup-1234567890-abc123',
  })
  @IsString()
  @IsNotEmpty({ message: 'Le token est requis' })
  token: string;

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
}



