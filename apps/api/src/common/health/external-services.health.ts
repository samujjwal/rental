import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';

/**
 * Health indicator for external services that may be optional.
 * Reports "degraded" (up with warning) rather than "down" when
 * a non-critical integration is missing.
 */
@Injectable()
export class ExternalServicesHealthIndicator extends HealthIndicator {
  constructor(private readonly config: ConfigService) {
    super();
  }

  /**
   * Checks availability of the email provider (Resend).
   * Missing RESEND_API_KEY → degraded (system still works, emails silently skipped).
   */
  async checkEmailProvider(): Promise<HealthIndicatorResult> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const isConfigured = !!apiKey && apiKey.length > 0;

    if (isConfigured) {
      return this.getStatus('email_provider', true, {
        provider: 'resend',
        status: 'configured',
      });
    }

    // Not configured — report as degraded (up with warning)
    return this.getStatus('email_provider', true, {
      provider: 'resend',
      status: 'degraded',
      reason: 'RESEND_API_KEY not configured — email sending disabled',
    });
  }

  /**
   * Checks availability of the SMS/OTP provider (Twilio).
   * Missing TWILIO_ACCOUNT_SID → degraded.
   */
  async checkSmsProvider(): Promise<HealthIndicatorResult> {
    const accountSid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const isConfigured = !!accountSid && accountSid.length > 0;

    if (isConfigured) {
      return this.getStatus('sms_provider', true, {
        provider: 'twilio',
        status: 'configured',
      });
    }

    return this.getStatus('sms_provider', true, {
      provider: 'twilio',
      status: 'degraded',
      reason: 'TWILIO_ACCOUNT_SID not configured — SMS/OTP disabled',
    });
  }

  /**
   * Checks availability of the payment provider (Stripe).
   * Missing STRIPE_SECRET_KEY → critical (not just degraded).
   */
  async checkPaymentProvider(): Promise<HealthIndicatorResult> {
    const apiKey = this.config.get<string>('STRIPE_SECRET_KEY');
    const isConfigured = !!apiKey && apiKey.length > 0;

    if (isConfigured) {
      return this.getStatus('payment_provider', true, {
        provider: 'stripe',
        status: 'configured',
      });
    }

    const result = this.getStatus('payment_provider', false, {
      provider: 'stripe',
      status: 'down',
      reason: 'STRIPE_SECRET_KEY not configured — payments disabled',
    });
    throw new HealthCheckError('Payment provider not configured', result);
  }

  /**
   * Aggregated check of all external services.
   * Returns individual status for each provider.
   */
  async checkAll(): Promise<HealthIndicatorResult> {
    const results: HealthIndicatorResult = {};

    const [email, sms] = await Promise.all([
      this.checkEmailProvider(),
      this.checkSmsProvider(),
    ]);

    Object.assign(results, email, sms);

    try {
      const payment = await this.checkPaymentProvider();
      Object.assign(results, payment);
    } catch (error) {
      if (error instanceof HealthCheckError) {
        Object.assign(results, error.causes);
      }
    }

    return results;
  }
}
