describe('mobile currency utils', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('formats supported currencies outside the old hardcoded map', () => {
    process.env.DEFAULT_CURRENCY = 'EUR';
    process.env.SUPPORTED_CURRENCIES = 'EUR,USD';

    const currencyUtils = require('../../utils/currency') as typeof import('../../utils/currency');

    expect(currencyUtils.DEFAULT_CURRENCY).toBe('EUR');
    expect(currencyUtils.formatCurrency(12.5)).toContain('12');
    expect(currencyUtils.getCurrencySymbol('EUR')).toBeTruthy();
  });

  it('returns an empty string for nullish amounts', () => {
    const currencyUtils = require('../../utils/currency') as typeof import('../../utils/currency');

    expect(currencyUtils.formatCurrency(null)).toBe('');
    expect(currencyUtils.formatCurrency(undefined)).toBe('');
  });
});