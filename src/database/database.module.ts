import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from '../auth/entities/user.entity';
import { Organisation } from '../organisations/entities/organisation.entity';
import { Form } from '../forms/entities/form.entity';
import { DocumentType } from '../documents/entities/document-type.entity';
import { Verification } from '../verifications/entities/verification.entity';
import { Request } from '../requests/entities/request.entity';
import { AuditLog } from '../audit-logs/entities/audit-log.entity';
import { UserDocument } from '../users/entities/user-document.entity';
import { UserIdentityDocument } from '../users/entities/user-identity-document.entity';
import { SecuritySettings } from '../security/entities/security-settings.entity';
import { Sector } from '../settings/entities/sector.entity';
import { FormType } from '../settings/entities/form-type.entity';
import { Role } from '../settings/entities/role.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get('DB_PORT', 5432),
        username: configService.get('DB_USERNAME', 'postgres'),
        password: configService.get('DB_PASSWORD', 'postgres'),
        database: configService.get('DB_NAME', 'securelink'),
        entities: [
          User,
          Organisation,
          Form,
          DocumentType,
          Verification,
          Request,
          AuditLog,
          UserDocument,
          UserIdentityDocument,
          SecuritySettings,
          Sector,
          FormType,
          Role,
        ],
        synchronize: configService.get('NODE_ENV') === 'development', // Ne pas utiliser en production
        logging: configService.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule { }



