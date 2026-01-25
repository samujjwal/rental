export default () => ({
  port: parseInt(process.env.PORT || '3400', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

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
    secret: process.env.JWT_SECRET || 'change-me-in-production',
    accessTokenExpiry: process.env.JWT_ACCESS_TOKEN_EXPIRY || '15m',
    refreshTokenExpiry: process.env.JWT_REFRESH_TOKEN_EXPIRY || '7d',
  },

  // Stripe
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    platformFeePercentage: parseFloat(process.env.STRIPE_PLATFORM_FEE_PERCENTAGE || '10'),
  },

  // AWS
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    s3Bucket: process.env.AWS_S3_BUCKET,
  },

  // Email
  email: {
    from: process.env.EMAIL_FROM || 'noreply@rentalportal.com',
    sendgridApiKey: process.env.SENDGRID_API_KEY,
  },

  // Frontend URLs
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3401',
  corsOrigins: (process.env.CORS_ORIGINS || '*').split(','),

  // Elasticsearch
  elasticsearch: {
    node: process.env.ELASTICSEARCH_NODE || 'http://localhost:3492',
    username: process.env.ELASTICSEARCH_USERNAME,
    password: process.env.ELASTICSEARCH_PASSWORD,
  },

  // Security
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),

  // Rate limiting
  rateLimit: {
    ttl: parseInt(process.env.RATE_LIMIT_TTL || '60', 10),
    limit: parseInt(process.env.RATE_LIMIT || '100', 10),
  },
});
