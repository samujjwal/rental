import { Decimal } from '@prisma/client/runtime/client';

/**
 * Convert Decimal to number safely
 */
export function toNumber(value: Decimal | number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value) || 0;
  return value.toNumber();
}

/**
 * Convert Decimal to number or null
 */
export function toNumberOrNull(value: Decimal | number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value) || null;
  return value.toNumber();
}

/**
 * Safely perform arithmetic with Decimal values
 */
export function decimalAdd(
  a: Decimal | number | string | null | undefined,
  b: Decimal | number | string | null | undefined,
): number {
  return toNumber(a) + toNumber(b);
}

export function decimalSubtract(
  a: Decimal | number | string | null | undefined,
  b: Decimal | number | string | null | undefined,
): number {
  return toNumber(a) - toNumber(b);
}

export function decimalMultiply(
  a: Decimal | number | string | null | undefined,
  b: Decimal | number | string | null | undefined,
): number {
  return toNumber(a) * toNumber(b);
}

export function decimalDivide(
  a: Decimal | number | string | null | undefined,
  b: Decimal | number | string | null | undefined,
): number {
  const divisor = toNumber(b);
  if (divisor === 0) {
    return 0; // Guard against division by zero — return 0 instead of Infinity/NaN
  }
  return toNumber(a) / divisor;
}

export function decimalCompare(
  a: Decimal | number | string | null | undefined,
  operator: '>' | '<' | '>=' | '<=' | '===' | '!==',
  b: Decimal | number | string | null | undefined,
): boolean {
  const numA = toNumber(a);
  const numB = toNumber(b);

  switch (operator) {
    case '>':
      return numA > numB;
    case '<':
      return numA < numB;
    case '>=':
      return numA >= numB;
    case '<=':
      return numA <= numB;
    case '===':
      return numA === numB;
    case '!==':
      return numA !== numB;
    default:
      return false;
  }
}
