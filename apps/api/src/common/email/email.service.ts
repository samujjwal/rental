import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST'),
      port: this.configService.get('SMTP_PORT'),
      secure: this.configService.get('SMTP_SECURE') === 'true',
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASSWORD'),
      },
    });
  }

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    try {
      if (!to) {
        throw new Error('Email recipient is required');
      }

      const from = this.configService.get('SMTP_FROM') || 'noreply@rentals.com';

      await this.transporter.sendMail({
        from,
        to,
        subject,
        html,
      });

      this.logger.log(`Email sent to ${to} with subject: ${subject}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${error.message}`, error.stack);
      // We might want to rethrow or handle gracefully depending on the requirement.
      // For now, logging error is sufficient to avoid crashing the flow if email fails (unless it's critical).
      throw error;
    }
  }

  async sendPasswordResetEmail(to: string, resetToken: string): Promise<void> {
    const appUrl = this.configService.get('APP_URL') || 'http://localhost:3400';
    const resetUrl = `${appUrl}/auth/reset-password?token=${resetToken}`;
    const subject = 'Password Reset Request';
    const html = `
      <h1>Password Reset Request</h1>
      <p>You have requested to reset your password.</p>
      <p>Click the link below to reset it:</p>
      <a href="${resetUrl}">${resetUrl}</a>
      <p>If you did not request this, please ignore this email.</p>
    `;

    await this.sendEmail(to, subject, html);
  }
}
