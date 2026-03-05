import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { ClientsController } from './clients.controller';
import { UsersProfileService } from './users-profile.service';
import { DocumentExpirationService } from './document-expiration.service';
import { User } from '../auth/entities/user.entity';
import { UserDocument } from './entities/user-document.entity';
import { Organisation } from '../organisations/entities/organisation.entity';
import { RequestsModule } from '../requests/requests.module';
import { SecurityModule } from '../security/security.module';
import { DocumentType } from '../documents/entities/document-type.entity';
import { VerificationsModule } from '../verifications/verifications.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserDocument, Organisation, DocumentType]),
    RequestsModule,
    SecurityModule,
    VerificationsModule,
    CommonModule,
  ],
  controllers: [UsersController, ClientsController],
  providers: [UsersService, UsersProfileService, DocumentExpirationService],
  exports: [UsersService, UsersProfileService],
})
export class UsersModule { }



