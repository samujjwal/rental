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
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '3479', 10),
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

  // Frontend URLs
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3401',
  corsOrigins: (process.env.CORS_ORIGINS || '*').split(','),

  // Security
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),
  DEV_LOGIN_ENABLED: process.env.DEV_LOGIN_ENABLED === 'true',
  DEV_LOGIN_SECRET: process.env.DEV_LOGIN_SECRET,

  // Stripe keys (root-level export for service injection)
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  RESEND_API_KEY: process.env.RESEND_API_KEY,

  // Development login (dev only)
  devLogin: {
    enabled: process.env.DEV_LOGIN_ENABLED === 'true',
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
});
