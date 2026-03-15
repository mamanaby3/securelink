import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VerificationsService } from './verifications.service';
import { VerificationsController } from './verifications.controller';
import { Verification } from './entities/verification.entity';
import { User } from '../auth/entities/user.entity';
import { UserDocument } from '../users/entities/user-document.entity';
import { UserIdentityDocument } from '../users/entities/user-identity-document.entity';
import { DocumentType } from '../documents/entities/document-type.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Verification, User, UserDocument, UserIdentityDocument, DocumentType])],
  controllers: [VerificationsController],
  providers: [VerificationsService],
  exports: [VerificationsService],
})
export class VerificationsModule { }



