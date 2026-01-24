import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ResendEmailService } from './resend-email.service';

@Module({
  imports: [ConfigModule],
  providers: [ResendEmailService],
  exports: [ResendEmailService],
})
export class EmailModule {}
