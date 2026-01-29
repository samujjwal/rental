import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';
import { PrismaService } from '@/common/prisma/prisma.service';

export interface SmsOptions {
  to: string;
  body: string;
  from?: string;
  statusCallback?: string;
  applicationSid?: string;
}

export interface SmsDeliveryEvent {
  sid: string;
  to: string;
  from: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'undelivered' | 'received';
  timestamp: Date;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface SmsTemplate {
  id: string;
  name: string;
  content: string;
  variables: string[];
  category: 'transactional' | 'marketing' | 'notification';
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private twilioClient: Twilio;
  private fromNumber: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const accountSid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.config.get<string>('TWILIO_AUTH_TOKEN');
    const fromNumber = this.config.get<string>('TWILIO_PHONE_NUMBER');

    if (!accountSid || !authToken) {
      this.logger.warn('Twilio credentials not configured');
      return;
    }

    this.twilioClient = new Twilio(accountSid, authToken);
    this.fromNumber = fromNumber || '';
  }

  /**
   * Send SMS message
   */
  async sendSms(options: SmsOptions): Promise<{ sid: string; status: string }> {
    try {
      const message = await this.twilioClient.messages.create({
        to: options.to,
        body: options.body,
        from: options.from || this.fromNumber,
        statusCallback:
          options.statusCallback || `${this.config.get('API_URL')}/webhooks/sms/status`,
        applicationSid: options.applicationSid,
      });

      // Log delivery event
      await this.logDeliveryEvent({
        sid: message.sid,
        to: options.to,
        from: options.from || this.fromNumber,
        status: 'queued',
        timestamp: new Date(),
      });

      this.logger.log(`SMS sent successfully: ${message.sid}`);

      return {
        sid: message.sid,
        status: message.status,
      };
    } catch (error) {
      this.logger.error('Failed to send SMS', error);
      throw error;
    }
  }

  /**
   * Send verification code
   */
  async sendVerificationCode(
    phone: string,
    code: string,
    purpose: 'login' | 'phone_verification' = 'phone_verification',
  ): Promise<void> {
    await this.sendSms({
      to: phone,
      body: `Your ${purpose.replace('_', ' ').toUpperCase()} code is: ${code}. Valid for 10 minutes.`,
    });
  }

  /**
   * Send booking confirmation SMS
   */
  async sendBookingConfirmationSms(
    phone: string,
    booking: {
      id: string;
      listingTitle: string;
      startDate: Date;
      endDate: Date;
      totalPrice: number;
      currency: string;
    },
  ): Promise<void> {
    await this.sendSms({
      to: phone,
      body: `Booking confirmed! ${booking.listingTitle} from ${booking.startDate.toLocaleDateString()} to ${booking.endDate.toLocaleDateString()}. Total: ${booking.currency} ${booking.totalPrice}. Booking ID: ${booking.id}`,
    });
  }

  /**
   * Handle Twilio webhook events
   */
  async handleWebhook(eventData: any): Promise<void> {
    try {
      const event: SmsDeliveryEvent = {
        sid: eventData.MessageSid || eventData.sid,
        to: eventData.To || eventData.to,
        from: eventData.From || eventData.from,
        status: eventData.MessageStatus || eventData.status,
        timestamp: new Date(),
        errorCode: eventData.ErrorCode,
        errorMessage: eventData.ErrorMessage,
        metadata: {
          accountSid: eventData.AccountSid,
          messagingServiceSid: eventData.MessagingServiceSid,
        },
      };

      await this.logDeliveryEvent(event);

      // Handle specific events
      switch (event.status) {
        case 'failed':
        case 'undelivered':
          await this.handleDeliveryFailure(event);
          break;
        case 'delivered':
          await this.handleDeliverySuccess(event);
          break;
      }
    } catch (error) {
      this.logger.error('Failed to handle SMS webhook', error);
    }
  }

  /**
   * Get SMS delivery status
   */
  async getSmsStatus(sid: string): Promise<SmsDeliveryEvent | null> {
    try {
      const message = await this.twilioClient.messages(sid).fetch();

      return {
        sid: message.sid,
        to: message.to,
        from: message.from,
        status: message.status as any,
        timestamp: message.dateCreated,
        errorCode: message.errorCode?.toString(),
        errorMessage: message.errorMessage,
      };
    } catch (error) {
      this.logger.error(`Failed to get SMS status for ${sid}`, error);
      return null;
    }
  }

  /**
   * Test SMS configuration
   */
  async testSmsConfiguration(): Promise<{ success: boolean; message: string }> {
    try {
      const testPhone = this.config.get<string>('TEST_PHONE');
      if (!testPhone) {
        return { success: false, message: 'Test phone number not configured' };
      }

      await this.sendSms({
        to: testPhone,
        body: 'Rental Portal - SMS Configuration Test\nThis is a test message to verify that the Twilio integration is working correctly.',
      });

      return { success: true, message: 'Test SMS sent successfully' };
    } catch (error) {
      this.logger.error('SMS configuration test failed', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Validate phone number
   */
  async validatePhoneNumber(
    phone: string,
  ): Promise<{ valid: boolean; formatted?: string; country?: string }> {
    try {
      const lookup = await this.twilioClient.lookups.v2
        .phoneNumbers(phone)
        .fetch({ fields: 'countryCode' });

      return {
        valid: true,
        formatted: lookup.phoneNumber,
        country: lookup.countryCode,
      };
    } catch (error) {
      return { valid: false };
    }
  }

  private async logDeliveryEvent(event: SmsDeliveryEvent): Promise<void> {
    try {
      // For now, just log the event
      // In production, save to database
      this.logger.log(`SMS event: ${event.status} for ${event.to} (${event.sid})`);
    } catch (error) {
      this.logger.error('Failed to log SMS delivery event', error);
    }
  }

  private async handleDeliveryFailure(event: SmsDeliveryEvent): Promise<void> {
    this.logger.warn(
      `SMS delivery failed for ${event.to}: ${event.errorMessage} (${event.errorCode})`,
    );
  }

  private async handleDeliverySuccess(event: SmsDeliveryEvent): Promise<void> {
    this.logger.log(`SMS delivered successfully to ${event.to} (${event.sid})`);
  }
}
