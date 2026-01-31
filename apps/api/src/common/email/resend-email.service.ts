import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
}

@Injectable()
export class ResendEmailService {
  private readonly logger = new Logger(ResendEmailService.name);
  private readonly resend: Resend;
  private readonly defaultFrom: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY not configured. Email functionality will be disabled.');
    }
    this.resend = new Resend(apiKey);
    this.defaultFrom = this.configService.get<string>('EMAIL_FROM') || 'noreply@resend.dev';
  }

  async sendEmail(options: SendEmailOptions): Promise<{ id: string } | null> {
    try {
      const { data, error } = await this.resend.emails.send({
        from: options.from || this.defaultFrom,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
        cc: options.cc ? (Array.isArray(options.cc) ? options.cc : [options.cc]) : undefined,
        bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]) : undefined,
      });

      if (error) {
        this.logger.error('Failed to send email via Resend', error);
        return null;
      }

      this.logger.log(`Email sent successfully: ${data.id}`);
      return { id: data.id };
    } catch (error) {
      this.logger.error('Error sending email via Resend', error);
      return null;
    }
  }

  async sendVerificationEmail(to: string, verificationUrl: string): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Verify Your Email</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #4F46E5;">Verify Your Email Address</h1>
            <p>Thank you for registering with our Rental Portal!</p>
            <p>Please click the button below to verify your email address:</p>
            <div style="margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Verify Email
              </a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="color: #666; word-break: break-all;">${verificationUrl}</p>
            <p style="margin-top: 30px; color: #666; font-size: 14px;">
              If you didn't create an account, please ignore this email.
            </p>
          </div>
        </body>
      </html>
    `;

    const result = await this.sendEmail({
      to,
      subject: 'Verify Your Email Address',
      html,
      text: `Verify your email by visiting: ${verificationUrl}`,
    });

    return result !== null;
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Reset Your Password</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #4F46E5;">Reset Your Password</h1>
            <p>We received a request to reset your password.</p>
            <p>Click the button below to reset your password:</p>
            <div style="margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Reset Password
              </a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="color: #666; word-break: break-all;">${resetUrl}</p>
            <p style="margin-top: 30px; color: #666; font-size: 14px;">
              If you didn't request a password reset, please ignore this email. This link will expire in 1 hour.
            </p>
          </div>
        </body>
      </html>
    `;

    const result = await this.sendEmail({
      to,
      subject: 'Reset Your Password',
      html,
      text: `Reset your password by visiting: ${resetUrl}`,
    });

    return result !== null;
  }

  async sendBookingNotification(
    to: string,
    bookingDetails: {
      bookingId: string;
      itemName: string;
      startDate: string;
      endDate: string;
      totalAmount: number;
    },
  ): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Booking Confirmation</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #4F46E5;">Booking Confirmation</h1>
            <p>Your booking has been confirmed!</p>
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Booking ID:</strong> ${bookingDetails.bookingId}</p>
              <p><strong>Item:</strong> ${bookingDetails.itemName}</p>
              <p><strong>Start Date:</strong> ${bookingDetails.startDate}</p>
              <p><strong>End Date:</strong> ${bookingDetails.endDate}</p>
              <p><strong>Total Amount:</strong> $${bookingDetails.totalAmount.toFixed(2)}</p>
            </div>
            <p>You can view your booking details in your dashboard.</p>
            <p style="margin-top: 30px; color: #666; font-size: 14px;">
              Thank you for using our Rental Portal!
            </p>
          </div>
        </body>
      </html>
    `;

    const result = await this.sendEmail({
      to,
      subject: `Booking Confirmation - ${bookingDetails.itemName}`,
      html,
      text: `Your booking for ${bookingDetails.itemName} from ${bookingDetails.startDate} to ${bookingDetails.endDate} has been confirmed. Total: $${bookingDetails.totalAmount.toFixed(2)}`,
    });

    return result !== null;
  }
}
