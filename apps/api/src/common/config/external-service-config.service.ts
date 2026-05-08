import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * External Service Configuration Validation Service
 * 
 * Validates that external service configurations are properly set before
 * allowing services to use them. This prevents runtime errors and ensures
 * production-safe configuration gates.
 * 
 * Features:
 * - Validates required API keys and secrets
 * - Disables dev-only features in production
 * - Provides feature flags for external services
 * - Logs configuration status at startup
 */
@Injectable()
export class ExternalServiceConfigService implements OnModuleInit {
  private readonly logger = new Logger(ExternalServiceConfigService.name);

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.validateConfigurations();
  }

  /**
   * Validate all external service configurations at startup
   */
  private validateConfigurations() {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    const isProduction = nodeEnv === 'production';

    this.logger.log(`Validating external service configurations for ${nodeEnv} environment`);

    // Validate payment service configuration
    this.validatePaymentConfig(isProduction);

    // Validate email service configuration
    this.validateEmailConfig(isProduction);

    // Validate SMS service configuration
    this.validateSmsConfig(isProduction);

    // Validate storage service configuration
    this.validateStorageConfig(isProduction);

    // Validate AI service configuration
    this.validateAIConfig(isProduction);

    // Validate dev-only features are disabled in production
    this.validateDevOnlyFeatures(isProduction);

    this.logger.log('External service configuration validation completed');
  }

  /**
   * Validate payment service configuration (Stripe, etc.)
   */
  private validatePaymentConfig(isProduction: boolean) {
    const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    const stripeWebhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');

    if (isProduction) {
      if (!stripeKey || stripeKey.startsWith('sk_test_')) {
        this.logger.warn('Production environment requires valid Stripe secret key (not test key)');
      }
      if (!stripeWebhookSecret) {
        this.logger.warn('Production environment requires Stripe webhook secret for security');
      }
    } else {
      if (!stripeKey) {
        this.logger.warn('Stripe secret key not configured - payment features will be disabled');
      }
    }
  }

  /**
   * Validate email service configuration (Resend, etc.)
   */
  private validateEmailConfig(isProduction: boolean) {
    const resendKey = this.configService.get<string>('RESEND_API_KEY');
    const emailFrom = this.configService.get<string>('EMAIL_FROM');
    const emailFromName = this.configService.get<string>('EMAIL_FROM_NAME');

    if (isProduction) {
      if (!resendKey) {
        this.logger.warn('Production environment requires Resend API key for email delivery');
      }
      if (!emailFrom || !emailFromName) {
        this.logger.warn('Production environment requires proper email from configuration');
      }
    } else {
      if (!resendKey) {
        this.logger.warn('Resend API key not configured - email features will be disabled');
      }
    }
  }

  /**
   * Validate SMS service configuration (Twilio, etc.)
   */
  private validateSmsConfig(isProduction: boolean) {
    const twilioAccountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    const twilioPhoneNumber = this.configService.get<string>('TWILIO_PHONE_NUMBER');

    if (isProduction) {
      if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
        this.logger.warn('Production environment requires complete Twilio configuration for SMS');
      }
    } else {
      if (!twilioAccountSid || !twilioAuthToken) {
        this.logger.warn('Twilio configuration incomplete - SMS features will be disabled');
      }
    }
  }

  /**
   * Validate storage service configuration (R2, S3, etc.)
   */
  private validateStorageConfig(isProduction: boolean) {
    const r2AccountId = this.configService.get<string>('R2_ACCOUNT_ID');
    const r2AccessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID');
    const r2SecretAccessKey = this.configService.get<string>('R2_SECRET_ACCESS_KEY');
    const r2BucketName = this.configService.get<string>('R2_BUCKET_NAME');

    if (isProduction) {
      if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey || !r2BucketName) {
        this.logger.warn('Production environment requires complete R2 storage configuration');
      }
    } else {
      if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey) {
        this.logger.warn('R2 storage configuration incomplete - file upload may be disabled');
      }
    }
  }

  /**
   * Validate AI service configuration (OpenAI, etc.)
   */
  private validateAIConfig(isProduction: boolean) {
    const openaiApiKey = this.configService.get<string>('OPENAI_API_KEY');
    const aiEnabled = this.configService.get<string>('AI_ENABLED', 'false') === 'true';

    if (!aiEnabled) {
      this.logger.log('AI features are disabled via configuration');
      return;
    }

    if (isProduction) {
      if (!openaiApiKey) {
        this.logger.warn('Production environment requires OpenAI API key when AI is enabled');
      }
    } else {
      if (!openaiApiKey) {
        this.logger.warn('OpenAI API key not configured - AI features will be disabled');
      }
    }
  }

  /**
   * Validate that dev-only features are disabled in production
   */
  private validateDevOnlyFeatures(isProduction: boolean) {
    const autoVerifyOnRegister = this.configService.get<string>('AUTO_VERIFY_ON_REGISTER', 'false') === 'true';
    const devLoginEnabled = this.configService.get<string>('DEV_LOGIN_ENABLED', 'false') === 'true';
    const seedDataEnabled = this.configService.get<string>('SEED_DATA_ENABLED', 'false') === 'true';
    const bypassPayment = this.configService.get<string>('BYPASS_PAYMENT', 'false') === 'true';

    if (isProduction) {
      if (autoVerifyOnRegister) {
        this.logger.error('SECURITY: AUTO_VERIFY_ON_REGISTER must be disabled in production');
        throw new Error('SECURITY: AUTO_VERIFY_ON_REGISTER must be disabled in production');
      }
      if (devLoginEnabled) {
        this.logger.error('SECURITY: DEV_LOGIN_ENABLED must be disabled in production');
        throw new Error('SECURITY: DEV_LOGIN_ENABLED must be disabled in production');
      }
      if (seedDataEnabled) {
        this.logger.error('SECURITY: SEED_DATA_ENABLED must be disabled in production');
        throw new Error('SECURITY: SEED_DATA_ENABLED must be disabled in production');
      }
      if (bypassPayment) {
        this.logger.error('SECURITY: BYPASS_PAYMENT must be disabled in production');
        throw new Error('SECURITY: BYPASS_PAYMENT must be disabled in production');
      }
    } else {
      if (autoVerifyOnRegister) {
        this.logger.warn('AUTO_VERIFY_ON_REGISTER is enabled (dev-only feature)');
      }
      if (devLoginEnabled) {
        this.logger.warn('DEV_LOGIN_ENABLED is enabled (dev-only feature)');
      }
      if (seedDataEnabled) {
        this.logger.warn('SEED_DATA_ENABLED is enabled (dev-only feature)');
      }
      if (bypassPayment) {
        this.logger.warn('BYPASS_PAYMENT is enabled (dev-only feature)');
      }
    }
  }

  /**
   * Check if a specific external service is enabled
   */
  isServiceEnabled(service: 'email' | 'sms' | 'payments' | 'storage' | 'ai'): boolean {
    switch (service) {
      case 'email':
        return !!this.configService.get<string>('RESEND_API_KEY');
      case 'sms':
        return !!(
          this.configService.get<string>('TWILIO_ACCOUNT_SID') &&
          this.configService.get<string>('TWILIO_AUTH_TOKEN')
        );
      case 'payments':
        return !!this.configService.get<string>('STRIPE_SECRET_KEY');
      case 'storage':
        return !!(
          this.configService.get<string>('R2_ACCOUNT_ID') &&
          this.configService.get<string>('R2_ACCESS_KEY_ID') &&
          this.configService.get<string>('R2_SECRET_ACCESS_KEY')
        );
      case 'ai':
        return this.configService.get<string>('AI_ENABLED', 'false') === 'true' &&
               !!this.configService.get<string>('OPENAI_API_KEY');
      default:
        return false;
    }
  }

  /**
   * Get a configuration value with production safety check
   * Throws error if required config is missing in production
   */
  getRequiredConfig(key: string): string {
    const value = this.configService.get<string>(key);
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

    if (!value) {
      if (isProduction) {
        throw new Error(`Required configuration ${key} is missing in production`);
      }
      this.logger.warn(`Configuration ${key} is missing - related features will be disabled`);
    }

    return value || '';
  }

  /**
   * Check if we're in production environment
   */
  isProduction(): boolean {
    return this.configService.get<string>('NODE_ENV') === 'production';
  }
}
