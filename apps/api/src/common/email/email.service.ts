import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ResendEmailService } from './resend-email.service';

/**
 * EmailService delegates all sending to ResendEmailService.
 * Maintains the simple (to, subject, html) signature for backward compatibility
 * with auth, disputes, and organizations modules.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly emailEnabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly resendEmailService: ResendEmailService,
  ) {
    const nodeEnv = this.configService.get<string>('NODE_ENV') || process.env.NODE_ENV || 'development';
    const envValue = this.configService.get<boolean | string>('EMAIL_ENABLED');
    this.emailEnabled = this.parseBoolean(envValue, nodeEnv !== 'test');
  }

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    if (!this.emailEnabled) {
      return;
    }

    if (!to) {
      this.logger.warn('Skipping email send: recipient is missing');
      return;
    }

    try {
      await this.resendEmailService.sendEmail({ to, subject, html });
      this.logger.log(`Email sent to ${to} with subject: ${subject}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${error}`);
    }
  }

  async sendPasswordResetEmail(to: string, resetToken: string): Promise<void> {
    const appUrl = this.configService.get('FRONTEND_URL') || this.configService.get('APP_URL') || 'http://localhost:3401';
    const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;
    const subject = 'Password Reset Request';
    const html = `
      <h1>Password Reset Request</h1>
      <p>You have requested to reset your password.</p>
      <p>Click the link below to reset it:</p>
      <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
      <p>Or copy and paste this URL:</p>
      <p style="word-break: break-all;">${resetUrl}</p>
      <p>If you did not request this, please ignore this email.</p>
      <p>This link will expire in 1 hour.</p>
    `;

    await this.sendEmail(to, subject, html);
  }

  async sendWelcomeEmail(userData: any): Promise<void> {
    const to = userData.email;
    const subject = 'Welcome to GharBatai!';
    const html = `
      <h1>Welcome to GharBatai!</h1>
      <p>Hello ${userData.firstName || 'there'},</p>
      <p>Thank you for joining GharBatai - Nepal's premier rental platform.</p>
      <p>We're excited to help you find your perfect rental!</p>
    `;

    await this.sendEmail(to, subject, html);
  }

  async sendBookingConfirmationEmail(bookingData: any): Promise<void> {
    const to = bookingData.email;
    const subject = 'Booking Confirmation';
    const html = `
      <h1>Booking Confirmed!</h1>
      <p>Your booking has been confirmed.</p>
      <p>Booking ID: ${bookingData.bookingId}</p>
      <p>Listing: ${bookingData.listingTitle}</p>
      <p>Dates: ${bookingData.startDate} to ${bookingData.endDate}</p>
    `;

    await this.sendEmail(to, subject, html);
  }

  async sendPaymentReceiptEmail(paymentData: any): Promise<void> {
    const to = paymentData.email;
    const subject = 'Payment Receipt';
    const html = `
      <h1>Payment Receipt</h1>
      <p>Thank you for your payment of ${paymentData.amount} ${paymentData.currency}.</p>
      <p>Transaction ID: ${paymentData.transactionId}</p>
    `;

    await this.sendEmail(to, subject, html);
  }

  async sendTemplateEmail(to: string, templateName: string, data: any): Promise<void> {
    const templates: Record<string, string> = {
      'booking-confirmation': 'Your booking has been confirmed!',
      'welcome': 'Welcome to our platform!',
      'default': 'Template email'
    };

    const subject = templateName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const html = `<h1>${templates[templateName] || templates.default}</h1><p>${JSON.stringify(data)}</p>`;

    await this.sendEmail(to, subject, html);
  }

  async getDeliveryStatus(deliveryId: string): Promise<any> {
    // Stub implementation
    return {
      deliveryId,
      status: 'delivered',
      timestamp: new Date(),
    };
  }

  async trackDelivery(deliveryId: string, eventData: any): Promise<{ success: boolean }> {
    // Stub implementation
    this.logger.debug('Delivery event tracked', { deliveryId, eventData });
    return { success: true };
  }

  private parseBoolean(value: boolean | string | undefined, defaultValue: boolean): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes'].includes(normalized)) return true;
      if (['false', '0', 'no'].includes(normalized)) return false;
    }
    return defaultValue;
  }
}
