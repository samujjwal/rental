import { getErrorMessage, getErrorDetails } from './error.utils';

describe('error.utils', () => {
  describe('getErrorMessage', () => {
    it('extracts message from Error instance', () => {
      expect(getErrorMessage(new Error('Something failed'))).toBe('Something failed');
    });

    it('returns string errors as-is', () => {
      expect(getErrorMessage('raw error string')).toBe('raw error string');
    });

    it('stringifies non-Error objects', () => {
      expect(getErrorMessage(42)).toBe('42');
    });

    it('stringifies null', () => {
      expect(getErrorMessage(null)).toBe('null');
    });

    it('stringifies undefined', () => {
      expect(getErrorMessage(undefined)).toBe('undefined');
    });
  });

  describe('getErrorDetails', () => {
    it('returns message and stack from Error', () => {
      const err = new Error('test');
      const details = getErrorDetails(err);
      expect(details.message).toBe('test');
      expect(details.stack).toBeDefined();
      expect(details.stack).toContain('Error: test');
    });

    it('returns stringified message for non-Error', () => {
      const details = getErrorDetails('plain string');
      expect(details.message).toBe('plain string');
      expect(details.stack).toBeUndefined();
    });

    it('returns stringified message for numbers', () => {
      const details = getErrorDetails(404);
      expect(details.message).toBe('404');
      expect(details.stack).toBeUndefined();
    });
  });
});
