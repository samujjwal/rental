import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as SendGrid from '@sendgrid/mail';
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
  private sendGrid: SendGrid.MailService;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const apiKey = this.config.get<string>('SENDGRID_API_KEY');
    if (!apiKey) {
      this.logger.warn('SendGrid API key not configured');
      return;
    }

    SendGrid.setApiKey(apiKey);
    this.sendGrid = SendGrid;
  }

  /**
   * Send email using SendGrid
   */
  async sendEmail(options: EmailOptions): Promise<{ messageId: string; status: string }> {
    try {
      const msg = this.buildMessage(options);
      const response = await this.sendGrid.send(msg);

      // Log delivery event
      await this.logDeliveryEvent({
        emailId: response[0]?.headers?.['x-message-id'] || 'unknown',
        to: Array.isArray(options.to) ? options.to[0] : options.to,
        event: 'processed',
        timestamp: new Date(),
        metadata: { subject: options.subject, templateId: options.templateId },
      });

      this.logger.log(`Email sent successfully: ${response[0]?.headers?.['x-message-id']}`);

      return {
        messageId: response[0]?.headers?.['x-message-id'] || 'unknown',
        status: 'sent',
      };
    } catch (error) {
      this.logger.error('Failed to send email', error);
      throw error;
    }
  }

  /**
   * Send email using template
   */
  async sendTemplateEmail(
    to: string | string[],
    templateId: string,
    templateData: Record<string, any>,
  ): Promise<{ messageId: string; status: string }> {
    return this.sendEmail({
      to,
      templateId,
      templateData,
      subject: '', // Subject is handled by template
    });
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(user: {
    email: string;
    firstName: string;
    lastName: string;
  }): Promise<void> {
    await this.sendTemplateEmail(user.email, 'welcome-email', {
      firstName: user.firstName,
      lastName: user.lastName,
      loginUrl: `${this.config.get('FRONTEND_URL')}/login`,
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

    await this.sendTemplateEmail(user.email, 'password-reset', {
      firstName: user.firstName,
      resetUrl,
      resetToken,
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
    await this.sendTemplateEmail(user.email, 'booking-confirmation', {
      firstName: user.firstName,
      bookingId: booking.id,
      listingTitle: booking.listingTitle,
      startDate: booking.startDate.toISOString(),
      endDate: booking.endDate.toISOString(),
      totalPrice: booking.totalPrice,
      currency: booking.currency,
      bookingUrl: `${this.config.get('FRONTEND_URL')}/bookings/${booking.id}`,
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
    await this.sendTemplateEmail(owner.email, 'booking-request-owner', {
      firstName: owner.firstName,
      bookingId: booking.id,
      renterName: booking.renterName,
      listingTitle: booking.listingTitle,
      startDate: booking.startDate.toISOString(),
      endDate: booking.endDate.toISOString(),
      totalPrice: booking.totalPrice,
      currency: booking.currency,
      message: booking.message || '',
      manageBookingsUrl: `${this.config.get('FRONTEND_URL')}/dashboard/bookings`,
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
    await this.sendTemplateEmail(user.email, 'payment-confirmation', {
      firstName: user.firstName,
      bookingId: payment.bookingId,
      amount: payment.amount,
      currency: payment.currency,
      paymentMethod: payment.paymentMethod,
      bookingUrl: `${this.config.get('FRONTEND_URL')}/bookings/${payment.bookingId}`,
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
    await this.sendTemplateEmail(user.email, 'review-reminder', {
      firstName: user.firstName,
      bookingId: booking.id,
      listingTitle: booking.listingTitle,
      ownerName: booking.ownerName,
      completedDate: booking.completedDate.toISOString(),
      reviewUrl: `${this.config.get('FRONTEND_URL')}/reviews/new?bookingId=${booking.id}`,
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

    await this.sendTemplateEmail(email, 'organization-invitation', {
      organizationName: organization.name,
      inviterName: organization.inviterName,
      invitationUrl,
      invitationToken,
    });
  }

  /**
   * Handle SendGrid webhook events
   */
  async handleWebhook(events: EmailDeliveryEvent[]): Promise<void> {
    for (const event of events) {
      await this.logDeliveryEvent(event);

      // Handle specific events
      switch (event.event) {
        case 'bounce':
          await this.handleBounce(event);
          break;
        case 'spamreport':
          await this.handleSpamReport(event);
          break;
        case 'unsubscribe':
          await this.handleUnsubscribe(event);
          break;
      }
    }
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
          <p>This is a test email to verify that the SendGrid integration is working correctly.</p>
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

  private buildMessage(options: EmailOptions): any {
    const msg: any = {
      to: Array.isArray(options.to) ? options.to : [options.to],
      from: {
        email: this.config.get('EMAIL_FROM') || 'noreply@rentalportal.com',
        name: this.config.get('EMAIL_FROM_NAME') || 'Rental Portal',
      },
      subject: options.subject,
    };

    if (options.templateId) {
      msg.templateId = options.templateId;
      msg.dynamicTemplateData = options.templateData;
    } else {
      if (options.html) {
        msg.content = [
          {
            type: 'text/html',
            value: options.html,
          },
        ];
      }
      if (options.text) {
        msg.content = msg.content || [];
        msg.content.push({
          type: 'text/plain',
          value: options.text,
        });
      }
    }

    if (options.attachments) {
      msg.attachments = options.attachments.map((att) => ({
        filename: att.filename,
        content:
          typeof att.content === 'string' ? att.content : att.content?.toString('base64') || '',
        disposition: 'attachment',
      }));
    }

    return msg;
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

  private async handleBounce(event: EmailDeliveryEvent): Promise<void> {
    this.logger.warn(`Email bounced for ${event.to}: ${JSON.stringify(event.metadata)}`);
  }

  private async handleSpamReport(event: EmailDeliveryEvent): Promise<void> {
    this.logger.warn(`Spam report for ${event.to}: ${JSON.stringify(event.metadata)}`);
  }

  private async handleUnsubscribe(event: EmailDeliveryEvent): Promise<void> {
    this.logger.log(`Unsubscribe request for ${event.to}`);
  }
}
