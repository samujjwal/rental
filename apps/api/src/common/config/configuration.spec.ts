import configuration from './configuration';

describe('configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns a config object', () => {
    const config = configuration();
    expect(config).toBeDefined();
    expect(typeof config).toBe('object');
  });

  it('defaults port to 3400', () => {
    delete process.env.PORT;
    const config = configuration();
    expect(config.port).toBe(3400);
  });

  it('parses PORT from env', () => {
    process.env.PORT = '4000';
    const config = configuration();
    expect(config.port).toBe(4000);
  });

  it('defaults nodeEnv to development', () => {
    delete process.env.NODE_ENV;
    const config = configuration();
    expect(config.nodeEnv).toBe('development');
  });

  it('defaults platform country to NP', () => {
    const config = configuration();
    expect(config.platform.country).toBe('NP');
  });

  it('defaults currency to NPR', () => {
    const config = configuration();
    expect(config.platform.defaultCurrency).toBe('NPR');
  });

  it('splits supported locales', () => {
    process.env.SUPPORTED_LOCALES = 'en,ne,hi';
    const config = configuration();
    expect(config.platform.supportedLocales).toEqual(['en', 'ne', 'hi']);
  });

  it('defaults JWT expiry to 7d', () => {
    const config = configuration();
    expect(config.jwt.expiresIn).toBe('7d');
  });

  it('maps AWS config from env', () => {
    process.env.AWS_REGION = 'ap-south-1';
    process.env.AWS_S3_BUCKET = 'test-bucket';
    const config = configuration();
    expect(config.aws.region).toBe('ap-south-1');
    expect(config.aws.s3.bucket).toBe('test-bucket');
  });

  it('defaults CORS origins to localhost', () => {
    delete process.env.CORS_ORIGINS;
    const config = configuration();
    expect(config.cors.origins).toContain('http://localhost:3401');
  });

  it('parses CORS_ORIGINS from env', () => {
    process.env.CORS_ORIGINS = 'https://gharbatai.com,https://admin.gharbatai.com';
    const config = configuration();
    expect(config.cors.origins).toEqual(['https://gharbatai.com', 'https://admin.gharbatai.com']);
  });

  it('defaults upload max file size to 10MB', () => {
    delete process.env.MAX_FILE_SIZE;
    const config = configuration();
    expect(config.upload.maxFileSize).toBe(10485760);
  });

  it('defaults timezone to Asia/Kathmandu', () => {
    const config = configuration();
    expect(config.platform.defaultTimezone).toBe('Asia/Kathmandu');
  });

  it('maps Stripe keys from env', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    const config = configuration();
    expect(config.stripe.secretKey).toBe('sk_test_123');
  });

  it('defaults email provider to smtp', () => {
    const config = configuration();
    expect(config.email.provider).toBe('smtp');
  });

  it('maps rate limit defaults', () => {
    delete process.env.RATE_LIMIT_TTL;
    delete process.env.RATE_LIMIT_MAX;
    const config = configuration();
    expect(config.rateLimit.ttl).toBe(60);
    expect(config.rateLimit.max).toBe(100);
  });
});
