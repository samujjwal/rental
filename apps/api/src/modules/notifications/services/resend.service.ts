import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { PrismaService } from '@/common/prisma/prisma.service';
import { escapeHtml } from '@/common/utils/sanitize';
import { formatCurrency } from '@rental-portal/shared-types';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  templateId?: string;
  templateData?: Record<string, any>;
  attachments?: Array<{
    filename: string;
    content?: string | Buffer;
    path?: string;
  }>;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  variables: string[];
  category: 'transactional' | 'marketing' | 'notification';
}

export interface EmailDeliveryEvent {
  emailId: string;
  to: string;
  event: 'processed' | 'delivered' | 'open' | 'click' | 'bounce' | 'spamreport' | 'unsubscribe';
  timestamp: Date;
  metadata?: Record<string, any>;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend;
  private readonly brandName: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.brandName = this.config.get('brand.name', 'Rental Portal');
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      this.logger.warn('Resend API key not configured');
      return;
    }

    this.resend = new Resend(apiKey);
  }

  /**
   * Send email using Resend
   */
  async sendEmail(options: EmailOptions): Promise<{ messageId: string; status: string }> {
    try {
      const from = this.config.get('EMAIL_FROM') || 'noreply@rentalportal.com';
      const fromName = this.config.get('EMAIL_FROM_NAME') || this.config.get('brand.name', 'Rental Portal');
      const fromAddress = `${fromName} <${from}>`;

      const emailData: any = {
        from: fromAddress,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
      };

      if (options.html) {
        emailData.html = options.html;
      }
      if (options.text) {
        emailData.text = options.text;
      }
      if (options.attachments) {
        emailData.attachments = options.attachments;
      }

      const response = await this.sendWithRetry(emailData);

      // Log delivery event
      await this.logDeliveryEvent({
        emailId: response.data?.id || 'unknown',
        to: Array.isArray(options.to) ? options.to[0] : options.to,
        event: 'processed',
        timestamp: new Date(),
        metadata: { subject: options.subject },
      });

      this.logger.log(`Email sent successfully: ${response.data?.id}`);

      return {
        messageId: response.data?.id || 'unknown',
        status: 'sent',
      };
    } catch (error) {
      this.logger.error('Failed to send email', error);
      throw error;
    }
  }

  /**
   * Retry wrapper for Resend API calls with exponential back-off.
   * Retries up to {@link maxRetries} times on transient / rate-limit errors.
   */
  private async sendWithRetry(
    emailData: Parameters<Resend['emails']['send']>[0],
    maxRetries = 3,
  ): ReturnType<Resend['emails']['send']> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.resend.emails.send(emailData);
      } catch (err: any) {
        lastError = err;
        const status = err?.statusCode ?? err?.status;
        // Only retry on 429 (rate-limit) or 5xx server errors
        const retryable = status === 429 || (status >= 500 && status < 600);
        if (!retryable || attempt === maxRetries) throw err;
        const delay = Math.min(1000 * 2 ** attempt, 8000);
        this.logger.warn(`Resend attempt ${attempt + 1} failed (${status}), retrying in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw lastError;
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(user: {
    email: string;
    firstName: string;
    lastName: string;
  }): Promise<void> {
    await this.sendEmail({
      to: user.email,
      subject: `Welcome to ${this.brandName}!`,
      html: `
        <h2>Welcome to ${this.brandName}, ${escapeHtml(user.firstName)}!</h2>
        <p>We're excited to have you join our community of renters and owners.</p>
        <p>Get started by exploring our listings or posting your first item for rent.</p>
        <p>
          <a href="${this.config.get('FRONTEND_URL')}/login" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Get Started
          </a>
        </p>
        <p>Best regards,<br>The ${this.brandName} Team</p>
      `,
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(
    user: { email: string; firstName: string },
    resetToken: string,
  ): Promise<void> {
    const resetUrl = `${this.config.get('FRONTEND_URL')}/reset-password?token=${resetToken}`;

    await this.sendEmail({
      to: user.email,
      subject: 'Reset Your Password',
      html: `
        <h2>Password Reset Request</h2>
        <p>Hi ${escapeHtml(user.firstName)},</p>
        <p>You requested to reset your password. Click the link below to reset it:</p>
        <p>
          <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Reset Password
          </a>
        </p>
        <p>This link will expire in 10 minutes for security reasons.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <p>Best regards,<br>The ${this.brandName} Team</p>
      `,
    });
  }

  /**
   * Send booking confirmation email
   */
  async sendBookingConfirmationEmail(
    user: { email: string; firstName: string },
    booking: {
      id: string;
      listingTitle: string;
      startDate: Date;
      endDate: Date;
      totalPrice: number;
      currency: string;
    },
  ): Promise<void> {
    await this.sendEmail({
      to: user.email,
      subject: 'Booking Confirmed!',
      html: `
        <h2>Booking Confirmed!</h2>
        <p>Hi ${escapeHtml(user.firstName)},</p>
        <p>Your booking has been confirmed. Here are the details:</p>
        <div style="border: 1px solid #ddd; padding: 15px; margin: 15px 0;">
          <h3>${escapeHtml(booking.listingTitle)}</h3>
          <p><strong>Booking ID:</strong> ${escapeHtml(booking.id)}</p>
          <p><strong>Start Date:</strong> ${booking.startDate.toLocaleDateString(undefined)}</p>
          <p><strong>End Date:</strong> ${booking.endDate.toLocaleDateString(undefined)}</p>
          <p><strong>Total Price:</strong> ${formatCurrency(booking.totalPrice, booking.currency)}</p>
        </div>
        <p>
          <a href="${this.config.get('FRONTEND_URL')}/bookings/${booking.id}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            View Booking Details
          </a>
        </p>
        <p>Best regards,<br>The ${this.brandName} Team</p>
      `,
    });
  }

  /**
   * Send booking request to owner
   */
  async sendBookingRequestEmail(
    owner: { email: string; firstName: string },
    booking: {
      id: string;
      renterName: string;
      listingTitle: string;
      startDate: Date;
      endDate: Date;
      totalPrice: number;
      currency: string;
      message?: string;
    },
  ): Promise<void> {
    await this.sendEmail({
      to: owner.email,
      subject: 'New Booking Request!',
      html: `
        <h2>New Booking Request</h2>
        <p>Hi ${escapeHtml(owner.firstName)},</p>
        <p>You have received a new booking request for your listing:</p>
        <div style="border: 1px solid #ddd; padding: 15px; margin: 15px 0;">
          <h3>${escapeHtml(booking.listingTitle)}</h3>
          <p><strong>Renter:</strong> ${escapeHtml(booking.renterName)}</p>
          <p><strong>Start Date:</strong> ${booking.startDate.toLocaleDateString(undefined)}</p>
          <p><strong>End Date:</strong> ${booking.endDate.toLocaleDateString(undefined)}</p>
          <p><strong>Total Price:</strong> ${formatCurrency(booking.totalPrice, booking.currency)}</p>
          ${booking.message ? `<p><strong>Message:</strong> ${escapeHtml(booking.message)}</p>` : ''}
        </div>
        <p>
          <a href="${this.config.get('FRONTEND_URL')}/dashboard/bookings" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Manage Booking
          </a>
        </p>
        <p>Best regards,<br>The ${this.brandName} Team</p>
      `,
    });
  }

  /**
   * Send payment confirmation email
   */
  async sendPaymentConfirmationEmail(
    user: { email: string; firstName: string },
    payment: {
      bookingId: string;
      amount: number;
      currency: string;
      paymentMethod: string;
    },
  ): Promise<void> {
    await this.sendEmail({
      to: user.email,
      subject: 'Payment Confirmed',
      html: `
        <h2>Payment Confirmed</h2>
        <p>Hi ${escapeHtml(user.firstName)},</p>
        <p>Your payment has been processed successfully:</p>
        <div style="border: 1px solid #ddd; padding: 15px; margin: 15px 0;">
          <p><strong>Booking ID:</strong> ${escapeHtml(payment.bookingId)}</p>
          <p><strong>Amount:</strong> ${formatCurrency(payment.amount, payment.currency)}</p>
          <p><strong>Payment Method:</strong> ${escapeHtml(payment.paymentMethod)}</p>
        </div>
        <p>
          <a href="${this.config.get('FRONTEND_URL')}/bookings/${payment.bookingId}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            View Booking Details
          </a>
        </p>
        <p>Best regards,<br>The ${this.brandName} Team</p>
      `,
    });
  }

  /**
   * Send review reminder email
   */
  async sendReviewReminderEmail(
    user: { email: string; firstName: string },
    booking: {
      id: string;
      listingTitle: string;
      ownerName: string;
      completedDate: Date;
    },
  ): Promise<void> {
    await this.sendEmail({
      to: user.email,
      subject: 'Leave a Review',
      html: `
        <h2>Share Your Experience</h2>
        <p>Hi ${escapeHtml(user.firstName)},</p>
        <p>Your recent rental has been completed. Please share your experience:</p>
        <div style="border: 1px solid #ddd; padding: 15px; margin: 15px 0;">
          <h3>${escapeHtml(booking.listingTitle)}</h3>
          <p><strong>Owner:</strong> ${escapeHtml(booking.ownerName)}</p>
          <p><strong>Completed:</strong> ${booking.completedDate.toLocaleDateString(undefined)}</p>
        </div>
        <p>
          <a href="${this.config.get('FRONTEND_URL')}/reviews/new?bookingId=${booking.id}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Leave a Review
          </a>
        </p>
        <p>Best regards,<br>The ${this.brandName} Team</p>
      `,
    });
  }

  /**
   * Send organization invitation email
   */
  async sendOrganizationInvitationEmail(
    email: string,
    organization: { name: string; inviterName: string },
    invitationToken: string,
  ): Promise<void> {
    const invitationUrl = `${this.config.get('FRONTEND_URL')}/invite?token=${invitationToken}`;

    await this.sendEmail({
      to: email,
      subject: `Invitation to join ${organization.name}`,
      html: `
        <h2>Organization Invitation</h2>
        <p>You've been invited to join <strong>${escapeHtml(organization.name)}</strong> on ${this.brandName}.</p>
        <p><strong>Invited by:</strong> ${escapeHtml(organization.inviterName)}</p>
        <p>
          <a href="${invitationUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Accept Invitation
          </a>
        </p>
        <p>This invitation will expire in 7 days.</p>
        <p>Best regards,<br>The ${this.brandName} Team</p>
      `,
    });
  }

  /**
   * Test email configuration
   */
  async testEmailConfiguration(): Promise<{ success: boolean; message: string }> {
    try {
      const testEmail = this.config.get<string>('TEST_EMAIL');
      if (!testEmail) {
        return { success: false, message: 'Test email not configured' };
      }

      await this.sendEmail({
        to: testEmail,
        subject: `${this.brandName} - Email Configuration Test`,
        html: `
          <h2>Email Configuration Test</h2>
          <p>This is a test email to verify that the Resend integration is working correctly.</p>
          <p>Timestamp: ${new Date().toISOString()}</p>
          <p>Environment: ${this.config.get('NODE_ENV')}</p>
        `,
      });

      return { success: true, message: 'Test email sent successfully' };
    } catch (error) {
      this.logger.error('Email configuration test failed', error);
      return { success: false, message: error.message };
    }
  }

  private async logDeliveryEvent(event: EmailDeliveryEvent): Promise<void> {
    try {
      // For now, just log the event
      // In production, save to database
      this.logger.log(`Email event: ${event.event} for ${event.to}`);
    } catch (error) {
      this.logger.error('Failed to log delivery event', error);
    }
  }
}
