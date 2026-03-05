import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormsService } from './forms.service';
import { FormsController } from './forms.controller';
import { Form } from './entities/form.entity';
import { Organisation } from '../organisations/entities/organisation.entity';
import { DocumentType } from '../documents/entities/document-type.entity';
import { Sector } from '../settings/entities/sector.entity';
import { FormType as FormTypeEntity } from '../settings/entities/form-type.entity';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Form, Organisation, DocumentType, Sector, FormTypeEntity]),
    SettingsModule,
  ],
  controllers: [FormsController],
  providers: [FormsService],
  exports: [FormsService],
})
export class FormsModule {}



