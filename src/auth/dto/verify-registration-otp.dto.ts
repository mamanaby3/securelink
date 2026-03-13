import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class VerifyRegistrationOtpDto {
  @ApiProperty({
    description: 'Token de session de l\'étape 1',
    example: 'session-token-123',
  })
  @IsString()
  @IsNotEmpty({ message: 'Le token de session est requis' })
  sessionToken: string;

  @ApiProperty({
    description: 'Code OTP reçu par email et SMS',
    example: '1234',
  })
  @IsString()
  @IsNotEmpty({ message: 'Le code OTP est requis' })
  @Matches(/^\d{4}$/, {
    message: 'Le code OTP doit contenir exactement 4 chiffres',
  })
  otp: string;
}



