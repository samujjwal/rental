import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ResendEmailService } from './resend-email.service';
import { EmailService } from './email.service';

/**
 * Legacy email module used by auth, disputes, and organizations.
 * For new code, prefer {@link NotificationsModule} which has retry logic,
 * delivery event logging, and richer templates.
 */
@Module({
  imports: [ConfigModule],
  providers: [ResendEmailService, EmailService],
  exports: [ResendEmailService, EmailService],
})
export class EmailModule {}
