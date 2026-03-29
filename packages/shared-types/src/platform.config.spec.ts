describe('platform.config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.SUPPORTED_LOCALES;
    delete process.env.DEFAULT_LOCALE;
    delete process.env.SUPPORTED_CURRENCIES;
    delete process.env.DEFAULT_CURRENCY;
    delete process.env.DEFAULT_TIMEZONE;
    delete process.env.PLATFORM_COUNTRY;
    delete process.env.PLATFORM_COUNTRY_CODE;
    delete process.env.PLATFORM_COUNTRY_NAME;
    delete process.env.PHONE_COUNTRY_CODE;
    delete process.env.PHONE_PLACEHOLDER;
    delete process.env.DEFAULT_MAP_CENTER_LAT;
    delete process.env.DEFAULT_MAP_CENTER_LNG;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function loadModule() {
    return require('./platform.config') as typeof import('./platform.config');
  }

  it('returns aligned fallback defaults', () => {
    const platform = loadModule();
    const config = platform.getPlatformConfig();

    expect(config.supportedLocales).toEqual(['en', 'ne']);
    expect(config.defaultLocale).toBe('en');
    expect(config.supportedCurrencies).toEqual(['NPR', 'USD', 'INR']);
    expect(config.defaultCurrency).toBe('NPR');
    expect(config.defaultTimezone).toBe('Asia/Kathmandu');
    expect(config.platformCountryCode).toBe('NP');
    expect(config.platformCountryName).toBe('Nepal');
    expect(config.phoneCountryCode).toBe('+977');
    expect(config.phonePlaceholder).toBe('+977 9812345678');
    expect(config.defaultMapCenter).toEqual([27.7172, 85.324]);
  });

  it('normalizes locale and currency lists from env', () => {
    process.env.SUPPORTED_LOCALES = 'en, ne, , en';
    process.env.SUPPORTED_CURRENCIES = 'npr, usd, , NPR';

    const platform = loadModule();

    expect(platform.getSupportedLocales()).toEqual(['en', 'ne']);
    expect(platform.getSupportedCurrencies()).toEqual(['NPR', 'USD']);
  });

  it('prefers PLATFORM_COUNTRY_CODE and PLATFORM_COUNTRY_NAME when both are set', () => {
    process.env.PLATFORM_COUNTRY = 'Nepal';
    process.env.PLATFORM_COUNTRY_CODE = 'NP';
    process.env.PLATFORM_COUNTRY_NAME = 'Nepal';

    const platform = loadModule();

    expect(platform.getPlatformCountryCode()).toBe('NP');
    expect(platform.getPlatformCountryName()).toBe('Nepal');
  });

  it('uses legacy PLATFORM_COUNTRY as a name fallback, not a code', () => {
    process.env.PLATFORM_COUNTRY = 'Nepal';

    const platform = loadModule();

    expect(platform.getPlatformCountryCode()).toBe('NP');
    expect(platform.getPlatformCountryName()).toBe('Nepal');
  });

  it('builds dynamic currency metadata for supported currencies outside the legacy map', () => {
    process.env.DEFAULT_CURRENCY = 'EUR';
    process.env.SUPPORTED_CURRENCIES = 'EUR,USD';

    const platform = loadModule();

    expect(platform.getDefaultCurrency()).toBe('EUR');
    expect(platform.CURRENCY_CONFIG.EUR).toBeDefined();
    expect(platform.CURRENCY_CONFIG.EUR.code).toBe('EUR');
    expect(platform.getCurrencyConfig('EUR').decimals).toBe(2);
  });

  it('falls back safely when formatCurrency receives invalid locale or currency', () => {
    const platform = loadModule();

    expect(() => platform.formatCurrency(15.5, 'bad', 'bad-locale')).not.toThrow();
    expect(platform.formatCurrency(15.5, 'bad', 'bad-locale')).toContain('15');
  });

  it('exposes non-empty locale labels for active web consumers', () => {
    const platform = loadModule();

    expect(platform.LOCALE_LABELS.en).toBe('English');
    expect(platform.LOCALE_NATIVE_LABELS.ne).toBe('नेपाली');
  });

  it('accepts env-driven map center overrides', () => {
    process.env.DEFAULT_MAP_CENTER_LAT = '40.7128';
    process.env.DEFAULT_MAP_CENTER_LNG = '-74.006';

    const platform = loadModule();

    expect(platform.getDefaultMapCenter()).toEqual([40.7128, -74.006]);
  });
});