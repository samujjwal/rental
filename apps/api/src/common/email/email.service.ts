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

  /**
   * Sanitize HTML content to prevent XSS in emails
   */
  private sanitizeHtml(input: string): string {
    return input
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"')
      .replace(/'/g, '&#x27;');
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    try {
      if (!to) {
        throw new Error('Email recipient is required');
      }

      if (!this.isValidEmail(to)) {
        throw new Error('Invalid email format');
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
      throw error;
    }
  }

  async sendPasswordResetEmail(to: string, resetToken: string): Promise<void> {
    const appUrl = this.configService.get('APP_URL') || 'http://localhost:3400';
    // Sanitize the token to prevent XSS in email
    const sanitizedToken = this.sanitizeHtml(resetToken);
    const resetUrl = `${appUrl}/auth/reset-password?token=${encodeURIComponent(resetToken)}`;
    const subject = 'Password Reset Request';
    const html = `
      <h1>Password Reset Request</h1>
      <p>You have requested to reset your password.</p>
      <p>Click the link below to reset it:</p>
      <a href="${resetUrl}">Reset Password</a>
      <p>Or copy and paste this URL:</p>
      <p style="word-break: break-all;">${this.sanitizeHtml(resetUrl)}</p>
      <p>If you did not request this, please ignore this email.</p>
      <p>This link will expire in 1 hour.</p>
    `;

    await this.sendEmail(to, subject, html);
  }
}
