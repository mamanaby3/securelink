import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganisationsService } from './organisations.service';
import { OrganisationsController } from './organisations.controller';
import { Organisation } from './entities/organisation.entity';
import { User } from '../auth/entities/user.entity';
import { Request } from '../requests/entities/request.entity';
import { Form } from '../forms/entities/form.entity';
import { UserDocument } from '../users/entities/user-document.entity';
import { Verification } from '../verifications/entities/verification.entity';
import { Sector } from '../settings/entities/sector.entity';
import { CommonModule } from '../common/common.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Organisation, User, Request, Form, UserDocument, Verification, Sector]),
    CommonModule,
    SettingsModule,
  ],
  controllers: [OrganisationsController],
  providers: [OrganisationsService],
  exports: [OrganisationsService],
})
export class OrganisationsModule {}



