import { Money } from './money';

describe('Money value object', () => {
  describe('factory methods', () => {
    it('fromMajor converts to minor units', () => {
      const m = Money.fromMajor(15.5, 'USD');
      expect(m.amount).toBe(1550);
      expect(m.currency).toBe('USD');
    });

    it('fromMinor stores exact minor units', () => {
      const m = Money.fromMinor(1550, 'USD');
      expect(m.amount).toBe(1550);
    });

    it('handles zero-decimal currencies (JPY)', () => {
      const m = Money.fromMajor(1000, 'JPY');
      expect(m.amount).toBe(1000);
    });

    it('handles three-decimal currencies (BHD)', () => {
      const m = Money.fromMajor(1.234, 'BHD');
      expect(m.amount).toBe(1234);
    });

    it('zero creates a zero-value instance', () => {
      const m = Money.zero('EUR');
      expect(m.amount).toBe(0);
      expect(m.isZero()).toBe(true);
    });

    it('fromJSON deserializes', () => {
      const m = Money.fromJSON({ amount: 999, currency: 'GBP' });
      expect(m.amount).toBe(999);
      expect(m.currency).toBe('GBP');
    });
  });

  describe('arithmetic', () => {
    it('add', () => {
      const a = Money.fromMinor(100, 'USD');
      const b = Money.fromMinor(200, 'USD');
      expect(a.add(b).amount).toBe(300);
    });

    it('subtract', () => {
      const a = Money.fromMinor(500, 'USD');
      const b = Money.fromMinor(200, 'USD');
      expect(a.subtract(b).amount).toBe(300);
    });

    it('multiply rounds correctly', () => {
      const m = Money.fromMinor(1000, 'USD');
      expect(m.multiply(0.13).amount).toBe(130);
    });

    it('multiply rounds half-up', () => {
      const m = Money.fromMinor(333, 'USD');
      expect(m.multiply(0.1).amount).toBe(33); // 33.3 rounds to 33
    });

    it('allocate distributes remainder to first parts', () => {
      const m = Money.fromMinor(100, 'USD');
      const parts = m.allocate(3);
      expect(parts.map((p) => p.amount)).toEqual([34, 33, 33]);
    });

    it('negate', () => {
      const m = Money.fromMinor(100, 'USD');
      expect(m.negate().amount).toBe(-100);
    });

    it('abs', () => {
      const m = Money.fromMinor(-100, 'USD');
      expect(m.abs().amount).toBe(100);
    });

    it('throws on currency mismatch for add', () => {
      const a = Money.fromMinor(100, 'USD');
      const b = Money.fromMinor(100, 'EUR');
      expect(() => a.add(b)).toThrow('Currency mismatch');
    });
  });

  describe('comparison', () => {
    it('equals', () => {
      const a = Money.fromMinor(100, 'USD');
      const b = Money.fromMinor(100, 'USD');
      expect(a.equals(b)).toBe(true);
    });

    it('not equals with different amount', () => {
      const a = Money.fromMinor(100, 'USD');
      const b = Money.fromMinor(200, 'USD');
      expect(a.equals(b)).toBe(false);
    });

    it('greaterThan', () => {
      const a = Money.fromMinor(200, 'USD');
      const b = Money.fromMinor(100, 'USD');
      expect(a.greaterThan(b)).toBe(true);
    });

    it('lessThan', () => {
      const a = Money.fromMinor(100, 'USD');
      const b = Money.fromMinor(200, 'USD');
      expect(a.lessThan(b)).toBe(true);
    });

    it('isPositive / isNegative', () => {
      expect(Money.fromMinor(1, 'USD').isPositive()).toBe(true);
      expect(Money.fromMinor(-1, 'USD').isNegative()).toBe(true);
      expect(Money.fromMinor(0, 'USD').isPositive()).toBe(false);
    });
  });

  describe('conversion', () => {
    it('toMajor for USD', () => {
      expect(Money.fromMinor(1550, 'USD').toMajor()).toBe(15.5);
    });

    it('toMajor for JPY', () => {
      expect(Money.fromMinor(1000, 'JPY').toMajor()).toBe(1000);
    });

    it('toJSON', () => {
      expect(Money.fromMinor(1550, 'USD').toJSON()).toEqual({
        amount: 1550,
        currency: 'USD',
      });
    });

    it('toString', () => {
      expect(Money.fromMinor(1550, 'USD').toString()).toBe('USD 15.50');
      expect(Money.fromMinor(1000, 'JPY').toString()).toBe('JPY 1000');
    });
  });
});
