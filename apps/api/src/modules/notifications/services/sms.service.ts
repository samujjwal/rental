import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SmsOptions {
  to: string;
  message: string;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Send SMS
   * In production: Use Twilio, AWS SNS, or similar
   */
  async sendSms(options: SmsOptions): Promise<{ success: boolean; sid?: string }> {
    try {
      const provider = this.config.get('SMS_PROVIDER', 'twilio');

      if (provider === 'twilio') {
        return this.sendViaTwilio(options);
      } else if (provider === 'sns') {
        return this.sendViaSNS(options);
      }

      this.logger.warn('No SMS provider configured');
      return { success: false };
    } catch (error) {
      this.logger.error('SMS send error', error);
      return { success: false };
    }
  }

  /**
   * Send SMS via Twilio
   */
  private async sendViaTwilio(options: SmsOptions): Promise<{ success: boolean; sid?: string }> {
    try {
      const twilio = require('twilio');
      const client = twilio(
        this.config.get('TWILIO_ACCOUNT_SID'),
        this.config.get('TWILIO_AUTH_TOKEN'),
      );

      const message = await client.messages.create({
        body: options.message,
        from: this.config.get('TWILIO_PHONE_NUMBER'),
        to: options.to,
      });

      this.logger.log(`SMS sent via Twilio: ${message.sid}`);
      return { success: true, sid: message.sid };
    } catch (error) {
      this.logger.error('Twilio SMS error', error);
      return { success: false };
    }
  }

  /**
   * Send SMS via AWS SNS
   */
  private async sendViaSNS(options: SmsOptions): Promise<{ success: boolean; sid?: string }> {
    try {
      const AWS = require('aws-sdk');
      const sns = new AWS.SNS({
        region: this.config.get('AWS_REGION', 'us-east-1'),
        credentials: {
          accessKeyId: this.config.get('AWS_ACCESS_KEY_ID'),
          secretAccessKey: this.config.get('AWS_SECRET_ACCESS_KEY'),
        },
      });

      const params = {
        Message: options.message,
        PhoneNumber: options.to,
        MessageAttributes: {
          'AWS.SNS.SMS.SMSType': {
            DataType: 'String',
            StringValue: 'Transactional',
          },
        },
      };

      const result = await sns.publish(params).promise();

      this.logger.log(`SMS sent via SNS: ${result.MessageId}`);
      return { success: true, sid: result.MessageId };
    } catch (error) {
      this.logger.error('SNS SMS error', error);
      return { success: false };
    }
  }

  /**
   * Send OTP SMS
   */
  async sendOTP(phoneNumber: string, otp: string): Promise<{ success: boolean }> {
    const message = `Your verification code is: ${otp}. Valid for 10 minutes.`;
    return this.sendSms({ to: phoneNumber, message });
  }

  /**
   * Send bulk SMS
   */
  async sendBulkSms(
    recipients: string[],
    message: string,
  ): Promise<{ success: boolean; sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const recipient of recipients) {
      const result = await this.sendSms({ to: recipient, message });
      if (result.success) {
        sent++;
      } else {
        failed++;
      }

      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return { success: failed === 0, sent, failed };
  }

  /**
   * Format phone number to E.164 format
   */
  formatPhoneNumber(phone: string, countryCode: string = '+1'): string {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');

    // If it starts with country code, return as-is
    if (digits.startsWith(countryCode.replace('+', ''))) {
      return `+${digits}`;
    }

    // Otherwise, prepend country code
    return `${countryCode}${digits}`;
  }

  /**
   * Validate phone number format
   */
  validatePhoneNumber(phone: string): boolean {
    // Basic E.164 validation
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phone);
  }
}
