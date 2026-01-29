import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { PrismaService } from '@/common/prisma/prisma.service';

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

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
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
      const fromName = this.config.get('EMAIL_FROM_NAME') || 'Rental Portal';
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

      const response = await this.resend.emails.send(emailData);

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
   * Send welcome email
   */
  async sendWelcomeEmail(user: {
    email: string;
    firstName: string;
    lastName: string;
  }): Promise<void> {
    await this.sendEmail({
      to: user.email,
      subject: 'Welcome to Rental Portal!',
      html: `
        <h2>Welcome to Rental Portal, ${user.firstName}!</h2>
        <p>We're excited to have you join our community of renters and owners.</p>
        <p>Get started by exploring our listings or posting your first item for rent.</p>
        <p>
          <a href="${this.config.get('FRONTEND_URL')}/login" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Get Started
          </a>
        </p>
        <p>Best regards,<br>The Rental Portal Team</p>
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
        <p>Hi ${user.firstName},</p>
        <p>You requested to reset your password. Click the link below to reset it:</p>
        <p>
          <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Reset Password
          </a>
        </p>
        <p>This link will expire in 10 minutes for security reasons.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <p>Best regards,<br>The Rental Portal Team</p>
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
        <p>Hi ${user.firstName},</p>
        <p>Your booking has been confirmed. Here are the details:</p>
        <div style="border: 1px solid #ddd; padding: 15px; margin: 15px 0;">
          <h3>${booking.listingTitle}</h3>
          <p><strong>Booking ID:</strong> ${booking.id}</p>
          <p><strong>Start Date:</strong> ${booking.startDate.toLocaleDateString()}</p>
          <p><strong>End Date:</strong> ${booking.endDate.toLocaleDateString()}</p>
          <p><strong>Total Price:</strong> ${booking.currency} ${booking.totalPrice}</p>
        </div>
        <p>
          <a href="${this.config.get('FRONTEND_URL')}/bookings/${booking.id}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            View Booking Details
          </a>
        </p>
        <p>Best regards,<br>The Rental Portal Team</p>
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
        <p>Hi ${owner.firstName},</p>
        <p>You have received a new booking request for your listing:</p>
        <div style="border: 1px solid #ddd; padding: 15px; margin: 15px 0;">
          <h3>${booking.listingTitle}</h3>
          <p><strong>Renter:</strong> ${booking.renterName}</p>
          <p><strong>Start Date:</strong> ${booking.startDate.toLocaleDateString()}</p>
          <p><strong>End Date:</strong> ${booking.endDate.toLocaleDateString()}</p>
          <p><strong>Total Price:</strong> ${booking.currency} ${booking.totalPrice}</p>
          ${booking.message ? `<p><strong>Message:</strong> ${booking.message}</p>` : ''}
        </div>
        <p>
          <a href="${this.config.get('FRONTEND_URL')}/dashboard/bookings" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Manage Booking
          </a>
        </p>
        <p>Best regards,<br>The Rental Portal Team</p>
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
        <p>Hi ${user.firstName},</p>
        <p>Your payment has been processed successfully:</p>
        <div style="border: 1px solid #ddd; padding: 15px; margin: 15px 0;">
          <p><strong>Booking ID:</strong> ${payment.bookingId}</p>
          <p><strong>Amount:</strong> ${payment.currency} ${payment.amount}</p>
          <p><strong>Payment Method:</strong> ${payment.paymentMethod}</p>
        </div>
        <p>
          <a href="${this.config.get('FRONTEND_URL')}/bookings/${payment.bookingId}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            View Booking Details
          </a>
        </p>
        <p>Best regards,<br>The Rental Portal Team</p>
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
        <p>Hi ${user.firstName},</p>
        <p>Your recent rental has been completed. Please share your experience:</p>
        <div style="border: 1px solid #ddd; padding: 15px; margin: 15px 0;">
          <h3>${booking.listingTitle}</h3>
          <p><strong>Owner:</strong> ${booking.ownerName}</p>
          <p><strong>Completed:</strong> ${booking.completedDate.toLocaleDateString()}</p>
        </div>
        <p>
          <a href="${this.config.get('FRONTEND_URL')}/reviews/new?bookingId=${booking.id}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Leave a Review
          </a>
        </p>
        <p>Best regards,<br>The Rental Portal Team</p>
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
        <p>You've been invited to join <strong>${organization.name}</strong> on Rental Portal.</p>
        <p><strong>Invited by:</strong> ${organization.inviterName}</p>
        <p>
          <a href="${invitationUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Accept Invitation
          </a>
        </p>
        <p>This invitation will expire in 7 days.</p>
        <p>Best regards,<br>The Rental Portal Team</p>
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
        subject: 'Rental Portal - Email Configuration Test',
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
