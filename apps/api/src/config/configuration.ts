function splitEnvList(rawValue: string | undefined, fallback: string[]): string[] {
  if (!rawValue) {
    return [...fallback];
  }

  const values = Array.from(
    new Set(
      rawValue
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );

  return values.length > 0 ? values : [...fallback];
}

/**
 * Safe configuration getter that returns undefined in production
 * if environment variable is not set (no hardcoded defaults for production)
 */
function getConfig<T>(envVar: string | undefined, fallback: T, isProduction: boolean): T | undefined {
  if (envVar !== undefined && envVar !== '') {
    return envVar as unknown as T;
  }
  // In production, don't use fallbacks for critical config
  if (isProduction) {
    return undefined;
  }
  return fallback;
}

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

export default () => ({
  port: parseInt(process.env.PORT || '3400', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Brand — white-label support; override per deployment
  brand: {
    name: process.env.BRAND_NAME || 'GharBatai',
    legalName: process.env.BRAND_LEGAL_NAME || 'GharBatai Pvt. Ltd.',
    supportEmail: process.env.BRAND_SUPPORT_EMAIL || 'support@gharbatai.com',
    logoUrl: process.env.BRAND_LOGO_URL || '',
  },

  // Platform locale / i18n
  platform: {
    country: process.env.PLATFORM_COUNTRY_CODE || process.env.PLATFORM_COUNTRY || 'NP',
    defaultLocale: process.env.DEFAULT_LOCALE || 'en',
    supportedLocales: splitEnvList(process.env.SUPPORTED_LOCALES, ['en', 'ne']),
    defaultCurrency: process.env.DEFAULT_CURRENCY || 'NPR',
    supportedCurrencies: splitEnvList(process.env.SUPPORTED_CURRENCIES, ['NPR', 'USD', 'INR']),
    defaultTimezone: process.env.DEFAULT_TIMEZONE || 'Asia/Kathmandu',
  },

  // Database
  database: {
    url: process.env.DATABASE_URL,
  },

  // Redis
  redis: {
    host: isProduction
      ? process.env.REDIS_HOST // No fallback in production
      : (process.env.REDIS_HOST || 'localhost'),
    port: parseInt(
      isProduction
        ? (process.env.REDIS_PORT || '6379') // Standard Redis port in production
        : (process.env.REDIS_PORT || '3479'),
      10,
    ),
    password: process.env.REDIS_PASSWORD,
    ttl: parseInt(process.env.REDIS_TTL || '3600', 10),
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET, // No fallback — startup will throw if absent (see main.ts)
    accessTokenExpiry: process.env.JWT_ACCESS_TOKEN_EXPIRY || '15m',
    refreshTokenExpiry: process.env.JWT_REFRESH_TOKEN_EXPIRY || '7d',
  },

  // Fees — single source of truth for all fee calculations
  fees: {
    platformFeePercent: parseFloat(process.env.PLATFORM_FEE_PERCENT || '10'),
    serviceFeePercent: parseFloat(process.env.SERVICE_FEE_PERCENT || '5'),
  },

  // Stripe
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  },

  // AWS
  aws: {
    region: process.env.AWS_REGION || 'ap-south-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    s3Bucket: process.env.AWS_S3_BUCKET,
  },

  // Email
  email: {
    from: process.env.EMAIL_FROM, // No fallback — require explicit sender address to ensure SPF/DKIM pass
    sendgridApiKey: process.env.SENDGRID_API_KEY,
    adminDisputesEmail: process.env.ADMIN_DISPUTES_EMAIL,
  },

  // Frontend URLs - NO localhost defaults in production
  frontendUrl: isProduction
    ? process.env.FRONTEND_URL // Must be explicitly set in production
    : (process.env.FRONTEND_URL || 'http://localhost:3401'),
  corsOrigins: isProduction
    ? (process.env.CORS_ORIGINS || '').split(',').filter(Boolean) // No wildcard in production
    : (process.env.CORS_ORIGINS || '*').split(','),

  // Security
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),
  DEV_LOGIN_ENABLED: isDevelopment && process.env.DEV_LOGIN_ENABLED === 'true', // Only in development
  DEV_LOGIN_SECRET: process.env.DEV_LOGIN_SECRET,

  // Stripe keys (root-level export for service injection)
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  RESEND_API_KEY: process.env.RESEND_API_KEY,

  // Development login (dev only) - explicitly disabled in production
  devLogin: {
    enabled: isDevelopment && process.env.DEV_LOGIN_ENABLED === 'true',
    secret: process.env.DEV_LOGIN_SECRET,
    allowedIps: process.env.DEV_LOGIN_ALLOWED_IPS || '',
  },

  // Rate limiting
  rateLimit: {
    ttl: parseInt(process.env.RATE_LIMIT_TTL || '60', 10),
    limit: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },

  // CDN endpoints (overridable per environment)
  cdn: {
    apSouth1: process.env.CDN_AP_SOUTH_1 || 'cdn.gharbatai.com',
    apSoutheast1: process.env.CDN_AP_SOUTHEAST_1 || 'cdn-sea.gharbatai.com',
    usEast1: process.env.CDN_US_EAST_1 || 'cdn-us.gharbatai.com',
    euWest1: process.env.CDN_EU_WEST_1 || 'cdn-eu.gharbatai.com',
  },

  // Geocoding
  geo: {
    providerUrl: process.env.GEO_PROVIDER_URL || 'https://photon.komoot.io',
    fallbackUrl:
      process.env.GEO_PROVIDER_FALLBACK_URL ||
      'https://nominatim.openstreetmap.org',
    userAgent:
      process.env.GEO_USER_AGENT ||
      `${process.env.BRAND_NAME || 'GharBatai'} (${process.env.BRAND_SUPPORT_EMAIL || 'support@gharbatai.com'})`,
    defaultLimit: parseInt(process.env.GEO_DEFAULT_LIMIT || '8', 10),
  },

  // Default cancellation policy tiers applied when the PolicyEngine has no listing-specific rules.
  // Operators should configure per-listing or global PolicyEngine rules to override these.
  // Tiers are evaluated in order; the first matching tier wins.
  // Format: JSON array of { minHoursBefore, maxHoursBefore (null = open-ended), refundPercentage, label }
  defaultCancellationPolicy: JSON.parse(
    process.env.DEFAULT_CANCELLATION_POLICY ||
      JSON.stringify([
        { minHoursBefore: 48, maxHoursBefore: null, refundPercentage: 1.0, label: 'Cancelled more than 48 hours before start — full refund' },
        { minHoursBefore: 24, maxHoursBefore: 48, refundPercentage: 0.5, label: 'Cancelled 24–48 hours before start — 50% refund' },
        { minHoursBefore: 0, maxHoursBefore: 24, refundPercentage: 0.0, label: 'Cancelled less than 24 hours before start — no refund' },
      ]),
  ),

  // ============================================================================
  // NEW: Payment Provider Priority and Failover Configuration
  // ============================================================================
  paymentProviders: {
    // Provider priority configuration - defines which provider to use by default per market
    priority: JSON.parse(
      process.env.PAYMENT_PROVIDER_PRIORITY ||
        JSON.stringify([
          { provider: 'stripe', priority: 1, enabled: true, markets: ['US', 'GB', 'CA', 'AU', 'GLOBAL'] },
          { provider: 'esewa', priority: 2, enabled: true, markets: ['NP'] },
          { provider: 'khalti', priority: 3, enabled: true, markets: ['NP'] },
          { provider: 'razorpay', priority: 2, enabled: true, markets: ['IN'] },
          { provider: 'bkash', priority: 2, enabled: true, markets: ['BD'] },
        ]),
    ),
    // Enable automatic failover to next provider on failure
    enableFailover: process.env.PAYMENT_ENABLE_FAILOVER !== 'false', // default true
    // Maximum retry attempts per provider before failover
    maxRetries: parseInt(process.env.PAYMENT_MAX_RETRIES || '3', 10),
    // Circuit breaker configuration
    circuitBreaker: {
      enabled: process.env.PAYMENT_CIRCUIT_BREAKER_ENABLED !== 'false', // default true
      failureThreshold: parseInt(process.env.PAYMENT_CIRCUIT_BREAKER_THRESHOLD || '5', 10),
      resetTimeoutMs: parseInt(process.env.PAYMENT_CIRCUIT_BREAKER_TIMEOUT || '60000', 10), // 1 minute
    },
  },

  // ============================================================================
  // NEW: Market-Specific Escrow Configuration
  // ============================================================================
  escrow: {
    // Market-specific escrow configurations
    markets: JSON.parse(
      process.env.ESCROW_MARKET_CONFIG ||
        JSON.stringify({
          US: {
            defaultHoldDays: 3,
            autoReleaseHours: 48,
            requiresVerification: true,
            disputeResolutionDays: 7,
            partialReleaseEnabled: true,
            depositDeductionEnabled: true,
          },
          NP: {
            defaultHoldDays: 1,
            autoReleaseHours: 24,
            requiresVerification: false,
            disputeResolutionDays: 3,
            partialReleaseEnabled: false, // Simpler escrow for Nepal market
            depositDeductionEnabled: true,
          },
          DEFAULT: {
            defaultHoldDays: 2,
            autoReleaseHours: 48,
            requiresVerification: true,
            disputeResolutionDays: 5,
            partialReleaseEnabled: true,
            depositDeductionEnabled: true,
          },
        }),
    ),
    // Global escrow settings
    maxHoldDays: parseInt(process.env.ESCROW_MAX_HOLD_DAYS || '30', 10),
    enableAutoRelease: process.env.ESCROW_ENABLE_AUTO_RELEASE !== 'false', // default true
    enableManualOverride: process.env.ESCROW_ENABLE_MANUAL_OVERRIDE !== 'false', // default true
  },

  // ============================================================================
  // NEW: Enhanced Runtime Security Policy Configuration
  // ============================================================================
  security: {
    // Session configuration
    session: {
      // Cache TTL for session validation (seconds) - reduced for quick revocation
      cacheTtlSeconds: parseInt(process.env.SESSION_CACHE_TTL_SECONDS || '5', 10),
      // Absolute session timeout (hours)
      absoluteTimeoutHours: parseInt(process.env.SESSION_ABSOLUTE_TIMEOUT_HOURS || '24', 10),
      // Idle timeout (minutes)
      idleTimeoutMinutes: parseInt(process.env.SESSION_IDLE_TIMEOUT_MINUTES || '30', 10),
      // Maximum concurrent sessions per user
      maxConcurrentSessions: parseInt(process.env.SESSION_MAX_CONCURRENT || '5', 10),
    },

    // Password policy
    passwordPolicy: {
      minLength: parseInt(process.env.PASSWORD_MIN_LENGTH || '8', 10),
      requireUppercase: process.env.PASSWORD_REQUIRE_UPPERCASE !== 'false', // default true
      requireLowercase: process.env.PASSWORD_REQUIRE_LOWERCASE !== 'false', // default true
      requireNumbers: process.env.PASSWORD_REQUIRE_NUMBERS !== 'false', // default true
      requireSpecialChars: process.env.PASSWORD_REQUIRE_SPECIAL !== 'false', // default true
      maxAgeDays: parseInt(process.env.PASSWORD_MAX_AGE_DAYS || '90', 10), // 0 = no expiry
      preventReuseCount: parseInt(process.env.PASSWORD_PREVENT_REUSE || '5', 10),
    },

    // MFA configuration
    mfa: {
      enabled: process.env.MFA_ENABLED === 'true', // default false (opt-in)
      requiredForRoles: splitEnvList(process.env.MFA_REQUIRED_ROLES, ['ADMIN', 'SUPER_ADMIN']),
      methods: splitEnvList(process.env.MFA_METHODS, ['TOTP', 'SMS', 'EMAIL']),
      backupCodesCount: parseInt(process.env.MFA_BACKUP_CODES_COUNT || '10', 10),
    },

    // Account lockout
    lockout: {
      maxAttempts: parseInt(process.env.LOCKOUT_MAX_ATTEMPTS || '5', 10),
      durationMinutes: parseInt(process.env.LOCKOUT_DURATION_MINUTES || '30', 10),
      resetAfterMinutes: parseInt(process.env.LOCKOUT_RESET_AFTER_MINUTES || '60', 10),
    },

    // Audit and compliance
    audit: {
      enabled: process.env.AUDIT_ENABLED !== 'false', // default true
      logSensitiveOperations: process.env.AUDIT_LOG_SENSITIVE === 'true', // default false
      retentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS || '365', 10),
    },

    // Admin roles - centralized definition
    adminRoles: splitEnvList(process.env.ADMIN_ROLES, [
      'ADMIN',
      'SUPER_ADMIN',
      'OPERATIONS_ADMIN',
      'FINANCE_ADMIN',
      'SUPPORT_ADMIN',
    ]),
  },

  // ============================================================================
  // NEW: Payment Webhook Configuration
  // ============================================================================
  webhooks: {
    payment: {
      // Maximum retry attempts for webhook processing
      maxRetries: parseInt(process.env.WEBHOOK_MAX_RETRIES || '5', 10),
      // Retry delay configuration (exponential backoff)
      baseDelayMs: parseInt(process.env.WEBHOOK_BASE_DELAY_MS || '1000', 10),
      maxDelayMs: parseInt(process.env.WEBHOOK_MAX_DELAY_MS || '60000', 10),
      // Dead letter queue configuration
      deadLetterQueueEnabled: process.env.WEBHOOK_DLQ_ENABLED !== 'false', // default true
      dlqMaxAgeHours: parseInt(process.env.WEBHOOK_DLQ_MAX_AGE_HOURS || '168', 10), // 7 days
      // Idempotency window (seconds)
      idempotencyWindowSeconds: parseInt(process.env.WEBHOOK_IDEMPOTENCY_WINDOW || '86400', 10), // 24 hours
    },
  },
});
