import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { RequestsService } from './requests.service';
import { RequestsController } from './requests.controller';
import { Request } from './entities/request.entity';
import { User } from '../auth/entities/user.entity';
import { Form } from '../forms/entities/form.entity';
import { UserDocument } from '../users/entities/user-document.entity';
import { DocumentType } from '../documents/entities/document-type.entity';
import { AuthModule } from '../auth/auth.module';
import { JwtOrUploadTokenGuard } from './guards/jwt-or-upload-token.guard';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Request, User, Form, UserDocument, DocumentType]),
    AuthModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET') || 'your-secret-key-change-in-production',
        signOptions: { expiresIn: config.get('JWT_EXPIRATION', '15m') },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [RequestsController],
  providers: [RequestsService, JwtOrUploadTokenGuard],
  exports: [RequestsService],
})
export class RequestsModule {}




