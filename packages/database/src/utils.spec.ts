import { toNumber, toNumberOrNull, decimalAdd, decimalSubtract, decimalMultiply, decimalDivide, decimalCompare } from './utils';

// Create a mock Decimal-like object (matches Prisma Decimal interface)
function mockDecimal(value: number) {
  return { toNumber: () => value };
}

describe('toNumber', () => {
  it('returns 0 for null', () => {
    expect(toNumber(null)).toBe(0);
  });

  it('returns 0 for undefined', () => {
    expect(toNumber(undefined)).toBe(0);
  });

  it('passes through number values', () => {
    expect(toNumber(42)).toBe(42);
    expect(toNumber(0)).toBe(0);
    expect(toNumber(-3.14)).toBe(-3.14);
  });

  it('parses string values', () => {
    expect(toNumber('100')).toBe(100);
    expect(toNumber('3.14')).toBe(3.14);
  });

  it('returns 0 for non-numeric strings', () => {
    expect(toNumber('abc')).toBe(0);
    expect(toNumber('')).toBe(0);
  });

  it('calls toNumber() on Decimal-like objects', () => {
    expect(toNumber(mockDecimal(99.5) as any)).toBe(99.5);
  });
});

describe('toNumberOrNull', () => {
  it('returns null for null', () => {
    expect(toNumberOrNull(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(toNumberOrNull(undefined)).toBeNull();
  });

  it('passes through number values', () => {
    expect(toNumberOrNull(42)).toBe(42);
    expect(toNumberOrNull(0)).toBe(0);
  });

  it('parses valid string values', () => {
    expect(toNumberOrNull('100')).toBe(100);
  });

  it('returns null for non-numeric strings', () => {
    expect(toNumberOrNull('abc')).toBeNull();
  });

  it('calls toNumber() on Decimal-like objects', () => {
    expect(toNumberOrNull(mockDecimal(5) as any)).toBe(5);
  });
});

describe('decimalAdd', () => {
  it('adds two numbers', () => {
    expect(decimalAdd(10, 20)).toBe(30);
  });

  it('handles null values as 0', () => {
    expect(decimalAdd(null, 5)).toBe(5);
    expect(decimalAdd(10, null)).toBe(10);
  });

  it('handles string values', () => {
    expect(decimalAdd('10', '20')).toBe(30);
  });

  it('handles mixed types', () => {
    expect(decimalAdd(mockDecimal(10) as any, '5')).toBe(15);
  });
});

describe('decimalSubtract', () => {
  it('subtracts two numbers', () => {
    expect(decimalSubtract(30, 10)).toBe(20);
  });

  it('handles null values', () => {
    expect(decimalSubtract(null, 5)).toBe(-5);
    expect(decimalSubtract(10, null)).toBe(10);
  });

  it('handles negative results', () => {
    expect(decimalSubtract(5, 10)).toBe(-5);
  });
});

describe('decimalMultiply', () => {
  it('multiplies two numbers', () => {
    expect(decimalMultiply(5, 3)).toBe(15);
  });

  it('handles null values (treats as 0)', () => {
    expect(decimalMultiply(null, 5)).toBe(0);
    expect(decimalMultiply(5, null)).toBe(0);
  });

  it('handles string values', () => {
    expect(decimalMultiply('2.5', '4')).toBe(10);
  });
});

describe('decimalDivide', () => {
  it('divides two numbers', () => {
    expect(decimalDivide(10, 2)).toBe(5);
  });

  it('handles division by zero (returns 0 guard)', () => {
    expect(decimalDivide(10, 0)).toBe(0);
  });

  it('handles null numerator (0/x = 0)', () => {
    expect(decimalDivide(null, 5)).toBe(0);
  });

  it('handles string values', () => {
    expect(decimalDivide('9', '3')).toBe(3);
  });
});

describe('decimalCompare', () => {
  it('compares with >', () => {
    expect(decimalCompare(10, '>', 5)).toBe(true);
    expect(decimalCompare(5, '>', 10)).toBe(false);
    expect(decimalCompare(5, '>', 5)).toBe(false);
  });

  it('compares with <', () => {
    expect(decimalCompare(5, '<', 10)).toBe(true);
    expect(decimalCompare(10, '<', 5)).toBe(false);
  });

  it('compares with >=', () => {
    expect(decimalCompare(10, '>=', 10)).toBe(true);
    expect(decimalCompare(10, '>=', 5)).toBe(true);
    expect(decimalCompare(5, '>=', 10)).toBe(false);
  });

  it('compares with <=', () => {
    expect(decimalCompare(5, '<=', 10)).toBe(true);
    expect(decimalCompare(5, '<=', 5)).toBe(true);
    expect(decimalCompare(10, '<=', 5)).toBe(false);
  });

  it('compares with ===', () => {
    expect(decimalCompare(5, '===', 5)).toBe(true);
    expect(decimalCompare(5, '===', 10)).toBe(false);
  });

  it('compares with !==', () => {
    expect(decimalCompare(5, '!==', 10)).toBe(true);
    expect(decimalCompare(5, '!==', 5)).toBe(false);
  });

  it('handles null values (treated as 0)', () => {
    expect(decimalCompare(null, '===', 0)).toBe(true);
    expect(decimalCompare(null, '>', 0)).toBe(false);
  });

  it('handles Decimal-like objects', () => {
    expect(decimalCompare(mockDecimal(10) as any, '>', mockDecimal(5) as any)).toBe(true);
  });

  it('returns false for unknown operator', () => {
    expect(decimalCompare(5, 'invalid' as any, 5)).toBe(false);
  });
});
