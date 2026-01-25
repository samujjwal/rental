import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ResendEmailService } from './resend-email.service';
import { EmailService } from './email.service';

@Module({
  imports: [ConfigModule],
  providers: [ResendEmailService, EmailService],
  exports: [ResendEmailService, EmailService],
})
export class EmailModule {}
