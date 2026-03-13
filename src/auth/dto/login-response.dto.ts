import { ApiProperty } from '@nestjs/swagger';

export class LoginResponseDto {
  @ApiProperty({
    description: 'Indique si l\'authentification MFA est requise',
    example: true,
  })
  requiresMFA: boolean;

  @ApiProperty({
    description: 'Token temporaire (si MFA requis) ou JWT access token (si MFA non requis)',
    example: 'temp-token-123456',
    required: false,
  })
  tempToken?: string;

  @ApiProperty({
    description: 'JWT Access Token (si MFA non requis ou après vérification MFA)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    required: false,
  })
  accessToken?: string;

  @ApiProperty({
    description: 'JWT Refresh Token (si MFA non requis ou après vérification MFA)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    required: false,
  })
  refreshToken?: string;

  @ApiProperty({
    description: 'Informations de l\'utilisateur (si MFA non requis ou après vérification MFA)',
    required: false,
  })
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}











