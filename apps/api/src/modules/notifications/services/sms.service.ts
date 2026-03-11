import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SmsOptions {
  to: string;
  message: string;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private twilioClient: any = null;

  constructor(private readonly config: ConfigService) {}

  /**
   * Send SMS
   * In production: Use Twilio, AWS SNS, or similar
   */
  async sendSms(options: SmsOptions): Promise<{ success: boolean; sid?: string }> {
    return this.sendWithRetry(options);
  }

  /**
   * Retry wrapper with exponential back-off for SMS delivery.
   * Only retries on transient errors (rate limits, temporary failures).
   * Non-transient errors (invalid number, auth failure) fail immediately.
   */
  private async sendWithRetry(
    options: SmsOptions,
    maxRetries = 2,
  ): Promise<{ success: boolean; sid?: string }> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const provider = this.config.get('SMS_PROVIDER', 'twilio');
        if (provider === 'twilio') {
          return await this.sendViaTwilio(options);
        } else if (provider === 'sns') {
          return await this.sendViaSNS(options);
        }
        this.logger.warn('No SMS provider configured');
        return { success: false };
      } catch (error: any) {
        // Classify error: only retry on transient errors
        const isTransient = this.isTransientSmsError(error);
        this.logger.error(`SMS attempt ${attempt + 1}/${maxRetries + 1} failed (transient: ${isTransient})`, error);

        if (!isTransient || attempt === maxRetries) {
          return { success: false };
        }
        const delay = Math.min(1000 * 2 ** attempt, 4000);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    return { success: false };
  }

  /**
   * Classify SMS errors as transient (retryable) or permanent (non-retryable).
   * Twilio error codes: https://www.twilio.com/docs/api/errors
   */
  private isTransientSmsError(error: any): boolean {
    // Twilio error codes that are transient
    const transientCodes = [
      20429, // Rate limit
      20500, // Internal server error
      20503, // Service unavailable
      30002, // Account suspended (temporary)
      30008, // Unknown error (may be transient)
    ];

    // Non-transient codes: invalid number, unverified, blocked, etc.
    const nonTransientCodes = [
      21211, // Invalid phone number
      21614, // Not a mobile number
      21408, // Permission not enabled
      21610, // Blacklisted number
      21612, // Not a valid phone number
    ];

    const errorCode = error?.code || error?.status;

    if (nonTransientCodes.includes(errorCode)) return false;
    if (transientCodes.includes(errorCode)) return true;

    // HTTP status codes: 429 and 5xx are transient
    const status = error?.status || error?.statusCode;
    if (status === 429 || (status >= 500 && status < 600)) return true;

    // Default: assume non-transient to avoid wasting retries
    return false;
  }

  /**
   * Send SMS via Twilio (singleton client, throws on transient errors for retry)
   */
  private async sendViaTwilio(options: SmsOptions): Promise<{ success: boolean; sid?: string }> {
    if (!this.twilioClient) {
      const twilio = require('twilio');
      this.twilioClient = twilio(
        this.config.get('TWILIO_ACCOUNT_SID'),
        this.config.get('TWILIO_AUTH_TOKEN'),
      );
    }

    try {
      const message = await this.twilioClient.messages.create({
        body: options.message,
        from: this.config.get('TWILIO_PHONE_NUMBER'),
        to: options.to,
      });

      this.logger.log(`SMS sent via Twilio: ${message.sid}`);
      return { success: true, sid: message.sid };
    } catch (error: any) {
      // Classify and re-throw transient errors for retry
      if (this.isTransientSmsError(error)) {
        throw error; // Will be caught by sendWithRetry for retry
      }
      // Non-transient: log and return failure without retry
      this.logger.error(`Twilio SMS permanent error (code: ${error?.code}): ${error?.message}`, error);
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
        region: this.config.get('AWS_REGION') || this.config.get('aws.region'),
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
  formatPhoneNumber(phone: string, countryCode: string = '+977'): string {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');

    // If it starts with country code, return as-is
    const codeDigits = countryCode.replace('+', '');
    if (digits.startsWith(codeDigits)) {
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
