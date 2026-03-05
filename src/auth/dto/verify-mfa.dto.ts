import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';

export class VerifyMfaDto {
  @ApiProperty({
    description: 'Token temporaire reçu après la première étape de connexion',
    example: 'temp-token-123456',
  })
  @IsString()
  @IsNotEmpty({ message: 'Le token temporaire est requis' })
  tempToken: string;

  @ApiProperty({
    description: 'Code OTP à 6 chiffres reçu par email',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty({ message: 'Le code OTP est requis' })
  @Length(6, 6, { message: 'Le code OTP doit contenir exactement 6 chiffres' })
  @Matches(/^\d{6}$/, { message: 'Le code OTP doit contenir uniquement des chiffres' })
  otpCode: string;
}








