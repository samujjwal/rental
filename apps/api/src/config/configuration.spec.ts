import configuration from './configuration';

describe('configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns default values when env vars not set', () => {
    delete process.env.PORT;
    delete process.env.NODE_ENV;
    const config = configuration();
    expect(config.port).toBe(3400);
    expect(config.nodeEnv).toBe('development');
  });

  it('reads PORT from environment', () => {
    process.env.PORT = '4000';
    expect(configuration().port).toBe(4000);
  });

  /* ── platform ── */

  it('returns Nepal defaults for platform', () => {
    const config = configuration();
    expect(config.platform.country).toBe('NP');
    expect(config.platform.defaultCurrency).toBe('NPR');
    expect(config.platform.defaultTimezone).toBe('Asia/Kathmandu');
    expect(config.platform.defaultLocale).toBe('en');
  });

  it('splits SUPPORTED_LOCALES into array', () => {
    process.env.SUPPORTED_LOCALES = 'en,ne,hi';
    expect(configuration().platform.supportedLocales).toEqual(['en', 'ne', 'hi']);
  });

  it('splits SUPPORTED_CURRENCIES into array', () => {
    process.env.SUPPORTED_CURRENCIES = 'NPR,USD';
    expect(configuration().platform.supportedCurrencies).toEqual(['NPR', 'USD']);
  });

  /* ── database ── */

  it('reads DATABASE_URL', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db';
    expect(configuration().database.url).toBe('postgresql://user:pass@host:5432/db');
  });

  /* ── redis ── */

  it('returns redis defaults', () => {
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    const config = configuration();
    expect(config.redis.host).toBe('localhost');
    expect(config.redis.port).toBe(3479);
    expect(config.redis.ttl).toBe(3600);
  });

  it('reads REDIS_PORT from env', () => {
    process.env.REDIS_PORT = '6379';
    expect(configuration().redis.port).toBe(6379);
  });

  /* ── jwt ── */

  it('returns jwt defaults', () => {
    delete process.env.JWT_SECRET;
    const config = configuration();
    // JWT secret has no fallback — must be set at startup via JWT_SECRET env var.
    // main.ts guards against running without it in production.
    expect(config.jwt.secret).toBeUndefined();
    expect(config.jwt.accessTokenExpiry).toBe('15m');
    expect(config.jwt.refreshTokenExpiry).toBe('7d');
  });

  /* ── stripe ── */

  it('parses platform fee percentage', () => {
    process.env.PLATFORM_FEE_PERCENT = '15';
    expect(configuration().fees.platformFeePercent).toBe(15);
  });

  it('defaults platform fee to 10', () => {
    delete process.env.PLATFORM_FEE_PERCENT;
    expect(configuration().fees.platformFeePercent).toBe(10);
  });

  /* ── AWS ── */

  it('defaults AWS region', () => {
    delete process.env.AWS_REGION;
    expect(configuration().aws.region).toBe('ap-south-1');
  });

  /* ── frontend + CORS ── */

  it('splits CORS_ORIGINS', () => {
    process.env.CORS_ORIGINS = 'http://a.com,http://b.com';
    expect(configuration().corsOrigins).toEqual(['http://a.com', 'http://b.com']);
  });

  it('defaults CORS to wildcard', () => {
    delete process.env.CORS_ORIGINS;
    expect(configuration().corsOrigins).toEqual(['*']);
  });

  /* ── rate limit ── */

  it('returns rate limit defaults', () => {
    delete process.env.RATE_LIMIT_TTL;
    delete process.env.RATE_LIMIT;
    const config = configuration();
    expect(config.rateLimit.ttl).toBe(60);
    expect(config.rateLimit.limit).toBe(100);
  });

  /* ── geo ── */

  it('returns geo defaults', () => {
    delete process.env.GEO_PROVIDER_URL;
    const config = configuration();
    expect(config.geo.providerUrl).toBe('https://photon.komoot.io');
    expect(config.geo.fallbackUrl).toContain('nominatim');
    expect(config.geo.defaultLimit).toBe(8);
    expect(config.geo.userAgent).toContain('GharBatai');
  });

  /* ── bcrypt ── */

  it('defaults bcrypt rounds to 10', () => {
    delete process.env.BCRYPT_ROUNDS;
    expect(configuration().bcryptRounds).toBe(10);
  });

  it('reads BCRYPT_ROUNDS from env', () => {
    process.env.BCRYPT_ROUNDS = '12';
    expect(configuration().bcryptRounds).toBe(12);
  });
});
