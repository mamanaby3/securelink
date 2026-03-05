import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { User } from './entities/user.entity';
import { Organisation } from '../organisations/entities/organisation.entity';
import { Request } from '../requests/entities/request.entity';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [
    PassportModule,
    TypeOrmModule.forFeature([User, Organisation, Request]),
    AuditLogsModule,
    SecurityModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const isProduction = configService.get('NODE_ENV') === 'production';
        const jwtSecret = configService.get('JWT_SECRET');

        // En production, JWT_SECRET est obligatoire
        if (isProduction && (!jwtSecret || jwtSecret === 'your-secret-key-change-in-production')) {
          throw new Error('JWT_SECRET doit être défini en production et différent de la valeur par défaut');
        }

        return {
          secret: jwtSecret || 'your-secret-key-change-in-production', // Valeur par défaut uniquement en dev
          signOptions: {
            expiresIn: configService.get('JWT_EXPIRATION', '15m'),
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, LocalStrategy],
  exports: [AuthService],
})
export class AuthModule { }



