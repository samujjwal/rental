import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

import { getErrorMessage } from '../../common/utils/error.utils';

@Injectable()
export class EmailService {
  private transporter?: nodemailer.Transporter;
  private readonly emailEnabled: boolean;
  private readonly smtpConfigured: boolean;
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {
    const nodeEnv = this.configService.get<string>('NODE_ENV') || process.env.NODE_ENV || 'development';
    this.emailEnabled = this.parseBoolean(
      this.configService.get<boolean | string>('EMAIL_ENABLED'),
      nodeEnv !== 'test',
    );

    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpPort = Number(this.configService.get<number | string>('SMTP_PORT') || 587);
    const smtpSecure = this.parseBoolean(
      this.configService.get<boolean | string>('SMTP_SECURE'),
      false,
    );
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPassword = this.configService.get<string>('SMTP_PASSWORD');
    const hasAuth = Boolean(smtpUser && smtpPassword);

    this.smtpConfigured = Boolean(smtpHost);

    if (!this.emailEnabled) {
      this.logger.log('Email delivery disabled via EMAIL_ENABLED=false');
      return;
    }

    if (!this.smtpConfigured) {
      this.logger.warn('SMTP is not configured; email delivery will be skipped');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: hasAuth
        ? {
            user: smtpUser,
            pass: smtpPassword,
          }
        : undefined,
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
    if (!this.emailEnabled) {
      return;
    }

    if (!this.smtpConfigured || !this.transporter) {
      return;
    }

    if (!to) {
      this.logger.warn('Skipping email send: recipient is missing');
      return;
    }

    if (!this.isValidEmail(to)) {
      this.logger.warn(`Skipping email send: invalid recipient format (${to})`);
      return;
    }

    try {
      const from = this.configService.get('SMTP_FROM') || 'noreply@rentals.com';

      await this.transporter.sendMail({
        from,
        to,
        subject,
        html,
      });

      this.logger.log(`Email sent to ${to} with subject: ${subject}`);
    } catch (error) {
      const message = getErrorMessage(error);
      this.logger.error(`Failed to send email to ${to}: ${message}`);
    }
  }

  private parseBoolean(value: boolean | string | undefined, defaultValue: boolean): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
        return true;
      }
      if (normalized === 'false' || normalized === '0' || normalized === 'no') {
        return false;
      }
    }

    return defaultValue;
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
