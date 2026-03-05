import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { OrganisationsModule } from './organisations/organisations.module';
import { UsersModule } from './users/users.module';
import { FormsModule } from './forms/forms.module';
import { DocumentsModule } from './documents/documents.module';
import { VerificationsModule } from './verifications/verifications.module';
import { RequestsModule } from './requests/requests.module';
import { SettingsModule } from './settings/settings.module';
import { SecurityModule } from './security/security.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { CommonModule } from './common/common.module';
import { AdminModule } from './admin/admin.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    // Rate limiting global pour protéger contre les attaques DDoS et brute force
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            name: 'short',
            ttl: 1000, // 1 seconde
            limit: configService.get<number>('THROTTLE_SHORT_LIMIT', 10), // 10 requêtes par seconde
          },
          {
            name: 'medium',
            ttl: 10000, // 10 secondes
            limit: configService.get<number>('THROTTLE_MEDIUM_LIMIT', 50), // 50 requêtes par 10 secondes
          },
          {
            name: 'long',
            ttl: 60000, // 1 minute
            limit: configService.get<number>('THROTTLE_LONG_LIMIT', 100), // 100 requêtes par minute
          },
        ],
      }),
    }),
    CommonModule,
    DatabaseModule,
    AuthModule,
    OrganisationsModule,
    UsersModule,
    FormsModule,
    DocumentsModule,
    VerificationsModule,
    RequestsModule,
    SettingsModule,
    SecurityModule,
    AuditLogsModule,
    AdminModule,
    StorageModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Appliquer le rate limiting globalement
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

