import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { ClientsController } from './clients.controller';
import { UsersProfileService } from './users-profile.service';
import { DocumentExpirationService } from './document-expiration.service';
import { User } from '../auth/entities/user.entity';
import { UserDocument } from './entities/user-document.entity';
import { UserIdentityDocument } from './entities/user-identity-document.entity';
import { Organisation } from '../organisations/entities/organisation.entity';
import { RequestsModule } from '../requests/requests.module';
import { SecurityModule } from '../security/security.module';
import { DocumentType } from '../documents/entities/document-type.entity';
import { VerificationsModule } from '../verifications/verifications.module';
import { CommonModule } from '../common/common.module';
import { Role } from '../settings/entities/role.entity';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserDocument, UserIdentityDocument, Organisation, DocumentType, Role]),
    RequestsModule,
    SecurityModule,
    VerificationsModule,
    CommonModule,
    AuditLogsModule,
  ],
  controllers: [UsersController, ClientsController],
  providers: [UsersService, UsersProfileService, DocumentExpirationService],
  exports: [UsersService, UsersProfileService],
})
export class UsersModule { }



