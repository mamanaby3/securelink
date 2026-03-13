import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'Email de l\'utilisateur',
    example: 'user@securelink.com',
  })
  @IsEmail({}, { message: 'Email invalide' })
  @IsNotEmpty({ message: 'L\'email est requis' })
  email: string;
}













