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
    country: process.env.PLATFORM_COUNTRY || 'NP',
    defaultLocale: process.env.DEFAULT_LOCALE || 'en',
    supportedLocales: (process.env.SUPPORTED_LOCALES || 'en').split(','),
    defaultCurrency: process.env.DEFAULT_CURRENCY || 'NPR',
    supportedCurrencies: (process.env.SUPPORTED_CURRENCIES || 'NPR').split(','),
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
  },

  // Frontend URLs
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3401',
  corsOrigins: (process.env.CORS_ORIGINS || '*').split(','),

  // Security
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),

  // Rate limiting
  rateLimit: {
    ttl: parseInt(process.env.RATE_LIMIT_TTL || '60', 10),
    limit: parseInt(process.env.RATE_LIMIT || '100', 10),
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
});
