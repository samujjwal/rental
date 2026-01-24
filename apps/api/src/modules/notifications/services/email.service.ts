import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

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

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter;

  constructor(private readonly config: ConfigService) {
    this.initializeTransporter();
  }

  /**
   * Initialize email transporter
   * In production: Use SendGrid, AWS SES, or Mailgun
   */
  private initializeTransporter(): void {
    const provider = this.config.get('EMAIL_PROVIDER', 'smtp');

    if (provider === 'sendgrid') {
      // SendGrid transport
      this.transporter = nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        auth: {
          user: 'apikey',
          pass: this.config.get('SENDGRID_API_KEY'),
        },
      });
    } else if (provider === 'ses') {
      // AWS SES transport
      const AWS = require('aws-sdk');
      AWS.config.update({
        region: this.config.get('AWS_REGION', 'us-east-1'),
        credentials: {
          accessKeyId: this.config.get('AWS_ACCESS_KEY_ID'),
          secretAccessKey: this.config.get('AWS_SECRET_ACCESS_KEY'),
        },
      });
      this.transporter = nodemailer.createTransport({
        SES: new AWS.SES({ apiVersion: '2010-12-01' }),
      });
    } else {
      // Generic SMTP
      this.transporter = nodemailer.createTransport({
        host: this.config.get('SMTP_HOST', 'localhost'),
        port: this.config.get('SMTP_PORT', 587),
        secure: this.config.get('SMTP_SECURE', false),
        auth: {
          user: this.config.get('SMTP_USER'),
          pass: this.config.get('SMTP_PASS'),
        },
      });
    }
  }

  /**
   * Send email
   */
  async sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string }> {
    try {
      const fromEmail = this.config.get('EMAIL_FROM', 'noreply@rentalportal.com');
      const fromName = this.config.get('EMAIL_FROM_NAME', 'Rental Portal');

      const mailOptions = {
        from: `${fromName} <${fromEmail}>`,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments,
      };

      const result = await this.transporter.sendMail(mailOptions);

      this.logger.log(`Email sent successfully: ${result.messageId}`);

      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error) {
      this.logger.error('Email send error', error);
      return {
        success: false,
      };
    }
  }

  /**
   * Send templated email using SendGrid dynamic templates
   */
  async sendTemplatedEmail(
    to: string,
    templateId: string,
    templateData: Record<string, any>,
  ): Promise<{ success: boolean }> {
    const provider = this.config.get('EMAIL_PROVIDER');

    if (provider === 'sendgrid') {
      return this.sendSendGridTemplate(to, templateId, templateData);
    }

    // Fallback: render template locally and send
    // In production: Implement template rendering with Handlebars/EJS
    return this.sendEmail({
      to,
      subject: templateData.subject || 'Notification',
      html: JSON.stringify(templateData),
    });
  }

  /**
   * Send email via SendGrid API with dynamic templates
   */
  private async sendSendGridTemplate(
    to: string,
    templateId: string,
    templateData: Record<string, any>,
  ): Promise<{ success: boolean }> {
    try {
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(this.config.get('SENDGRID_API_KEY'));

      const msg = {
        to,
        from: this.config.get('EMAIL_FROM', 'noreply@rentalportal.com'),
        templateId,
        dynamicTemplateData: templateData,
      };

      await sgMail.send(msg);
      this.logger.log(`SendGrid template email sent: ${templateId} to ${to}`);
      return { success: true };
    } catch (error) {
      this.logger.error('SendGrid template error', error);
      return { success: false };
    }
  }

  /**
   * Send bulk emails (for marketing, announcements)
   */
  async sendBulkEmails(
    recipients: string[],
    subject: string,
    html: string,
  ): Promise<{ success: boolean; sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    // Send in batches to avoid rate limits
    const batchSize = 100;
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);

      try {
        await this.sendEmail({
          to: batch,
          subject,
          html,
        });
        sent += batch.length;
      } catch (error) {
        failed += batch.length;
        this.logger.error(`Bulk email batch failed: ${i}-${i + batchSize}`, error);
      }

      // Rate limiting delay
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return { success: failed === 0, sent, failed };
  }

  /**
   * Verify email service configuration
   */
  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      this.logger.log('Email service connection verified');
      return true;
    } catch (error) {
      this.logger.error('Email service connection failed', error);
      return false;
    }
  }
}
