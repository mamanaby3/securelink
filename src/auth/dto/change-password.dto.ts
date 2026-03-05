import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Ancien mot de passe de l\'utilisateur',
    example: 'OldPassword123!',
  })
  @IsString()
  @IsNotEmpty({ message: 'L\'ancien mot de passe est requis' })
  oldPassword: string;

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



