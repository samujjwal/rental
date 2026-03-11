import { getLocalizedMessage } from './messages';

describe('getLocalizedMessage', () => {
  it('returns English message by default', () => {
    expect(getLocalizedMessage('auth.invalidCredentials')).toBe(
      'Invalid credentials',
    );
  });

  it('returns Nepali message when locale is ne', () => {
    expect(getLocalizedMessage('auth.invalidCredentials', 'ne')).toContain(
      'अमान्य',
    );
  });

  it('falls back to English for unknown locale', () => {
    expect(
      getLocalizedMessage('auth.invalidCredentials', 'fr' as any),
    ).toBe('Invalid credentials');
  });

  it('returns key for unknown message key', () => {
    expect(getLocalizedMessage('unknown.key' as any)).toBe('unknown.key');
  });
});
