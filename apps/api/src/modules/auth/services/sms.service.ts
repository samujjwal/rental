import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * SMS Service — sends OTP/verification codes via Twilio.
 *
 * Required env vars:
 *   TWILIO_ACCOUNT_SID - Twilio account SID
 *   TWILIO_AUTH_TOKEN  - Twilio auth token
 *   TWILIO_FROM_NUMBER - Twilio phone number (e.g. +1234567890)
 *
 * When TWILIO_ACCOUNT_SID is absent, falls back to logging the OTP
 * (development mode).
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private client: any; // Twilio client (lazy-loaded)
  private readonly fromNumber: string;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    const sid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const token = this.config.get<string>('TWILIO_AUTH_TOKEN');
    this.fromNumber = this.config.get<string>('TWILIO_FROM_NUMBER', '');
    this.enabled = !!(sid && token && this.fromNumber);

    if (this.enabled) {
      try {
         
        const twilio = require('twilio');
        this.client = twilio(sid, token);
        this.logger.log('Twilio SMS provider initialized');
      } catch {
        this.logger.warn('twilio package not installed — SMS will be logged only');
        this.enabled = false;
      }
    } else {
      this.logger.warn(
        'Twilio credentials not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER). ' +
        'SMS OTPs will be logged to console.',
      );
    }
  }

  /**
   * Send an SMS message. Falls back to console logging when Twilio is not configured.
   */
  async sendSms(to: string, body: string): Promise<{ success: boolean; sid?: string }> {
    if (!this.enabled || !this.client) {
      this.logger.log(`[DEV SMS] To: ${to} | Body: ${body}`);
      return { success: true };
    }

    try {
      const message = await this.client.messages.create({
        to,
        from: this.fromNumber,
        body,
      });
      this.logger.log(`SMS sent to ${to} — SID: ${message.sid}`);
      return { success: true, sid: message.sid };
    } catch (error: any) {
      this.logger.error(`Failed to send SMS to ${to}: ${error.message}`);
      return { success: false };
    }
  }

  /**
   * Send a phone verification OTP.
   */
  async sendOtp(phone: string, otp: string): Promise<{ success: boolean }> {
    const body = `Your GharBatai verification code is: ${otp}. It expires in 5 minutes.`;
    return this.sendSms(phone, body);
  }
}
