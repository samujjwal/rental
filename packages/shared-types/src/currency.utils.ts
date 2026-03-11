/**
 * Currency utilities — zero-decimal and multi-decimal currency handling.
 *
 * This module provides conversion functions for Stripe (and other payment
 * providers) that require amounts in the smallest currency unit (e.g. cents).
 *
 * ISO 4217 currencies have different decimal places:
 *   - 0 decimals: JPY, KRW, VND, CLP, ISK, UGX, RWF, BIF, GNF, PYG, XOF, XAF
 *   - 2 decimals: USD, EUR, GBP, NPR, INR, AUD, CAD, etc. (most currencies)
 *   - 3 decimals: BHD, KWD, OMR, TND, JOD
 *
 * This is the SINGLE source of truth for currency decimal metadata.
 * It replaces all hardcoded `amount * 100` / `amount / 100` conversions.
 */

// ─── Zero-Decimal Currencies (ISO 4217) ──────────────────────────────────────
const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW',
  'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);

// ─── Three-Decimal Currencies (ISO 4217) ─────────────────────────────────────
const THREE_DECIMAL_CURRENCIES = new Set([
  'BHD', 'JOD', 'KWD', 'OMR', 'TND',
]);

/**
 * Get the number of decimal places for a currency code (ISO 4217).
 * Falls back to 2 decimals for unknown currencies (the most common case).
 */
export function getCurrencyDecimals(currencyCode: string): number {
  const upper = currencyCode.toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(upper)) return 0;
  if (THREE_DECIMAL_CURRENCIES.has(upper)) return 3;
  return 2;
}

/**
 * Convert a human-readable amount to the smallest currency unit (e.g. cents).
 * Used when sending amounts TO payment providers like Stripe.
 *
 * @example
 *   toMinorUnits(15.50, 'USD') => 1550
 *   toMinorUnits(1000, 'JPY')  => 1000  (JPY has 0 decimal places)
 *   toMinorUnits(1.234, 'BHD') => 1234  (BHD has 3 decimal places)
 */
export function toMinorUnits(amount: number, currencyCode: string): number {
  const decimals = getCurrencyDecimals(currencyCode);
  const factor = Math.pow(10, decimals);
  return Math.round(amount * factor);
}

/**
 * Convert from smallest currency unit back to human-readable amount.
 * Used when receiving amounts FROM payment providers like Stripe.
 *
 * @example
 *   fromMinorUnits(1550, 'USD')  => 15.50
 *   fromMinorUnits(1000, 'JPY')  => 1000
 *   fromMinorUnits(1234, 'BHD')  => 1.234
 */
export function fromMinorUnits(minorAmount: number, currencyCode: string): number {
  const decimals = getCurrencyDecimals(currencyCode);
  const factor = Math.pow(10, decimals);
  return minorAmount / factor;
}

/**
 * Round an amount to the correct number of decimal places for a currency.
 *
 * @example
 *   roundForCurrency(15.505, 'USD') => 15.51
 *   roundForCurrency(1000.4, 'JPY') => 1000
 */
export function roundForCurrency(amount: number, currencyCode: string): number {
  const decimals = getCurrencyDecimals(currencyCode);
  const factor = Math.pow(10, decimals);
  return Math.round(amount * factor) / factor;
}
