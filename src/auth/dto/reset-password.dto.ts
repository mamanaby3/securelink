import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Token de réinitialisation',
    example: 'reset-token-123456',
  })
  @IsString()
  @IsNotEmpty({ message: 'Le token est requis' })
  token: string;

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
}













