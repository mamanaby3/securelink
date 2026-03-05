import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  type?: string;
  organisationId?: string;
  organisationRole?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    const jwtSecret = process.env.JWT_SECRET;
    const isProduction = process.env.NODE_ENV === 'production';

    // En production, JWT_SECRET est obligatoire
    if (isProduction && (!jwtSecret || jwtSecret === 'your-secret-key-change-in-production')) {
      throw new Error('JWT_SECRET doit être défini en production et différent de la valeur par défaut');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret || 'your-secret-key-change-in-production', // Valeur par défaut uniquement en dev
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.authService.validateUserById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Utilisateur non autorisé ou inactif');
    }
    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      type: user.type,
      organisationId: user.organisationId,
      organisationRole: user.organisationRole,
    };
  }
}



