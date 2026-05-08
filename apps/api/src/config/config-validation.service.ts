/**
 * Configuration Validation Service
 * 
 * Centralizes configuration validation with required/forbidden env vars by environment.
 * App fails fast for unsafe/missing production config.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface EnvVarRule {
  name: string;
  required: boolean;
  forbidden: boolean;
  environments: ('development' | 'test' | 'e2e' | 'production')[];
  description: string;
  validator?: (value: string) => boolean;
  errorMessage?: string;
}

@Injectable()
export class ConfigValidationService {
  private readonly logger = new Logger(ConfigValidationService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Validate all configuration rules for the current environment
   * Throws an error if validation fails
   */
  validate(): void {
    const nodeEnv = this.configService.get('NODE_ENV', 'development');
    this.logger.log(`Validating configuration for environment: ${nodeEnv}`);

    const rules = this.getConfigRules();
    const errors: string[] = [];

    for (const rule of rules) {
      if (!rule.environments.includes(nodeEnv as any)) {
        continue; // Rule not applicable to this environment
      }

      const value = this.configService.get(rule.name);

      // Check forbidden variables
      if (rule.forbidden && value !== undefined && value !== '' && value !== 'false') {
        errors.push(
          `Forbidden environment variable set: ${rule.name} (${rule.description}). ` +
          `This must not be set in ${nodeEnv} environment.`
        );
      }

      // Check required variables
      if (rule.required && (value === undefined || value === '')) {
        errors.push(
          `Required environment variable missing: ${rule.name} (${rule.description}). ` +
          `This must be set in ${nodeEnv} environment.`
        );
      }

      // Run custom validator if provided
      if (rule.validator && value !== undefined && value !== '') {
        if (!rule.validator(value)) {
          errors.push(
            `Invalid value for ${rule.name}: ${rule.errorMessage || 'validation failed'}. ` +
            `Current value: ${this.redactSensitiveValue(rule.name, value)}`
          );
        }
      }
    }

    if (errors.length > 0) {
      const errorMessage = `Configuration validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`;
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    this.logger.log('Configuration validation passed');
  }

  /**
   * Get all configuration rules
   */
  private getConfigRules(): EnvVarRule[] {
    return [
      // Critical security variables (required in all environments except test)
      {
        name: 'JWT_SECRET',
        required: true,
        forbidden: false,
        environments: ['development', 'production'],
        description: 'JWT signing secret',
        validator: (value) => value.length >= 32,
        errorMessage: 'JWT_SECRET must be at least 32 characters',
      },
      {
        name: 'DATABASE_URL',
        required: true,
        forbidden: false,
        environments: ['development', 'test', 'e2e', 'production'],
        description: 'Database connection string',
      },
      {
        name: 'REDIS_HOST',
        required: true,
        forbidden: false,
        environments: ['development', 'test', 'e2e', 'production'],
        description: 'Redis host',
      },
      {
        name: 'REDIS_PORT',
        required: true,
        forbidden: false,
        environments: ['development', 'test', 'e2e', 'production'],
        description: 'Redis port',
        validator: (value) => !isNaN(parseInt(value, 10)),
        errorMessage: 'REDIS_PORT must be a valid number',
      },

      // Payment configuration (required in production)
      {
        name: 'STRIPE_SECRET_KEY',
        required: true,
        forbidden: false,
        environments: ['production'],
        description: 'Stripe secret key',
        validator: (value) => value.startsWith('sk_'),
        errorMessage: 'STRIPE_SECRET_KEY must start with "sk_"',
      },
      {
        name: 'STRIPE_WEBHOOK_SECRET',
        required: true,
        forbidden: false,
        environments: ['production'],
        description: 'Stripe webhook secret',
      },
      {
        name: 'STRIPE_PUBLISHABLE_KEY',
        required: true,
        forbidden: false,
        environments: ['production'],
        description: 'Stripe publishable key',
        validator: (value) => value.startsWith('pk_'),
        errorMessage: 'STRIPE_PUBLISHABLE_KEY must start with "pk_"',
      },

      // Payment test bypass (forbidden in production)
      {
        name: 'STRIPE_TEST_BYPASS',
        required: false,
        forbidden: true,
        environments: ['production'],
        description: 'Stripe test payment bypass flag',
      },

      // Frontend URL (required in production)
      {
        name: 'FRONTEND_URL',
        required: true,
        forbidden: false,
        environments: ['production'],
        description: 'Frontend application URL',
        validator: (value) => value.startsWith('https://'),
        errorMessage: 'FRONTEND_URL must use HTTPS in production',
      },

      // CORS origins (no wildcard in production)
      {
        name: 'CORS_ORIGINS',
        required: true,
        forbidden: false,
        environments: ['production'],
        description: 'CORS allowed origins',
        validator: (value) => !value.includes('*'),
        errorMessage: 'CORS_ORIGINS must not contain wildcard (*) in production',
      },

      // Email configuration (required in production)
      {
        name: 'EMAIL_FROM',
        required: true,
        forbidden: false,
        environments: ['production'],
        description: 'Email sender address',
        validator: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        errorMessage: 'EMAIL_FROM must be a valid email address',
      },
      {
        name: 'SENDGRID_API_KEY',
        required: true,
        forbidden: false,
        environments: ['production'],
        description: 'SendGrid API key',
      },

      // AWS configuration (required in production for file uploads)
      {
        name: 'AWS_ACCESS_KEY_ID',
        required: true,
        forbidden: false,
        environments: ['production'],
        description: 'AWS access key ID',
      },
      {
        name: 'AWS_SECRET_ACCESS_KEY',
        required: true,
        forbidden: false,
        environments: ['production'],
        description: 'AWS secret access key',
      },
      {
        name: 'AWS_S3_BUCKET',
        required: true,
        forbidden: false,
        environments: ['production'],
        description: 'AWS S3 bucket name',
      },

      // Development login (forbidden in production)
      {
        name: 'DEV_LOGIN_ENABLED',
        required: false,
        forbidden: true,
        environments: ['production'],
        description: 'Development login bypass flag',
      },
      {
        name: 'DEV_LOGIN_SECRET',
        required: false,
        forbidden: true,
        environments: ['production'],
        description: 'Development login secret',
      },

      // Admin disputes email (required in production)
      {
        name: 'ADMIN_DISPUTES_EMAIL',
        required: true,
        forbidden: false,
        environments: ['production'],
        description: 'Admin disputes notification email',
        validator: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        errorMessage: 'ADMIN_DISPUTES_EMAIL must be a valid email address',
      },

      // Platform configuration (required in production)
      {
        name: 'BRAND_NAME',
        required: true,
        forbidden: false,
        environments: ['production'],
        description: 'Brand name',
      },
      {
        name: 'BRAND_SUPPORT_EMAIL',
        required: true,
        forbidden: false,
        environments: ['production'],
        description: 'Brand support email',
        validator: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        errorMessage: 'BRAND_SUPPORT_EMAIL must be a valid email address',
      },

      // Environment validation
      {
        name: 'NODE_ENV',
        required: true,
        forbidden: false,
        environments: ['development', 'test', 'e2e', 'production'],
        description: 'Node environment',
        validator: (value) => ['development', 'test', 'e2e', 'production'].includes(value),
        errorMessage: 'NODE_ENV must be one of: development, test, e2e, production',
      },
    ];
  }

  /**
   * Redact sensitive values for logging
   */
  private redactSensitiveValue(name: string, value: string): string {
    const sensitivePatterns = ['SECRET', 'KEY', 'TOKEN', 'PASSWORD', 'API_KEY'];
    const isSensitive = sensitivePatterns.some((pattern) => 
      name.toUpperCase().includes(pattern)
    );
    
    if (isSensitive) {
      return `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
    }
    return value;
  }

  /**
   * Validate configuration for a specific environment (for testing)
   */
  validateForEnvironment(env: string): { valid: boolean; errors: string[] } {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = env;
    
    try {
      this.validate();
      return { valid: true, errors: [] };
    } catch (error) {
      return {
        valid: false,
        errors: error instanceof Error ? error.message.split('\n') : ['Unknown error'],
      };
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  }
}
