import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestsService } from './requests.service';
import { RequestsController } from './requests.controller';
import { Request } from './entities/request.entity';
import { User } from '../auth/entities/user.entity';
import { Form } from '../forms/entities/form.entity';
import { UserDocument } from '../users/entities/user-document.entity';
import { DocumentType } from '../documents/entities/document-type.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Request, User, Form, UserDocument, DocumentType])],
  controllers: [RequestsController],
  providers: [RequestsService],
  exports: [RequestsService],
})
export class RequestsModule {}




