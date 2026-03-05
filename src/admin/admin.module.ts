import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminStatisticsService } from './admin-statistics.service';
import { AdminExportService } from './admin-export.service';
import { Form } from '../forms/entities/form.entity';
import { DocumentType } from '../documents/entities/document-type.entity';
import { Request } from '../requests/entities/request.entity';
import { UserDocument } from '../users/entities/user-document.entity';
import { User } from '../auth/entities/user.entity';
import { Organisation } from '../organisations/entities/organisation.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Form, DocumentType, Request, UserDocument, User, Organisation]),
    UsersModule,
  ],
  controllers: [AdminController],
  providers: [AdminStatisticsService, AdminExportService],
  exports: [AdminStatisticsService, AdminExportService],
})
export class AdminModule {}

