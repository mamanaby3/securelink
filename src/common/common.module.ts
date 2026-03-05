import { Module, Global } from '@nestjs/common';
import { EmailService } from './services/email.service';
import { SmsService } from './services/sms.service';

@Global()
@Module({
  providers: [EmailService, SmsService],
  exports: [EmailService, SmsService],
})
export class CommonModule {}





