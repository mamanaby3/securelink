import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength, ValidateIf, IsEmail, Matches } from 'class-validator';

export class LoginClientDto {
  @ApiProperty({
    description: 'Email du client (optionnel si phone est fourni)',
    example: 'toulaye.wele@example.com',
    required: false,
  })
  @ValidateIf((o) => !o.phone)
  @IsNotEmpty({ message: 'L\'email ou le numéro de téléphone est requis' })
  @IsEmail({}, { message: 'Format d\'email invalide' })
  @IsString()
  email?: string;

  @ApiProperty({
    description: 'Numéro de téléphone du client avec indicatif pays (format: +XXX...) - optionnel si email est fourni',
    example: '+221775698088',
    required: false,
  })
  @ValidateIf((o) => !o.email)
  @IsNotEmpty({ message: 'L\'email ou le numéro de téléphone est requis' })
  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: 'Le numéro de téléphone doit commencer par un indicatif pays (ex: +221775698088)',
  })
  phone?: string;

  @ApiProperty({
    description: 'Mot de passe',
    example: 'Passer@123',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe est requis' })
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  password: string;
}

