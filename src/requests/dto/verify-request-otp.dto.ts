import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class VerifyRequestOtpDto {
  @ApiProperty({
    description: 'Code OTP de 6 chiffres reçu par email',
    example: '123456',
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @IsNotEmpty({ message: 'Le code OTP est requis' })
  @Length(6, 6, { message: 'Le code OTP doit contenir exactement 6 chiffres' })
  @Matches(/^\d{6}$/, {
    message: 'Le code OTP doit contenir uniquement des chiffres',
  })
  otp: string;
}







