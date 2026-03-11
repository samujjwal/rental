/**
 * Currency formatting utility for the mobile app.
 * Imports config from the shared-types single source of truth.
 */
import {
  CURRENCY_CONFIG,
  CURRENCY_INTL_LOCALE,
  DEFAULT_CURRENCY,
  type SupportedCurrency,
} from '@rental-portal/shared-types';

/**
 * Format an amount as a currency string.
 * Uses the platform's configured default currency when none is specified.
 */
export function formatCurrency(
  amount: number | undefined | null,
  currencyCode?: string,
): string {
  if (amount == null || Number.isNaN(amount)) return '';
  const code = (currencyCode ?? DEFAULT_CURRENCY) as SupportedCurrency;
  const config = CURRENCY_CONFIG[code] ?? CURRENCY_CONFIG[DEFAULT_CURRENCY];
  const locale = CURRENCY_INTL_LOCALE[code] ?? 'en-IN';
  const formatted = amount.toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: config.decimals,
  });
  return config.symbolPosition === 'before'
    ? `${config.symbol} ${formatted}`
    : `${formatted} ${config.symbol}`;
}

/**
 * Return just the currency symbol for a given code.
 */
export function getCurrencySymbol(currencyCode?: string): string {
  const code = (currencyCode ?? DEFAULT_CURRENCY) as SupportedCurrency;
  return CURRENCY_CONFIG[code]?.symbol ?? CURRENCY_CONFIG[DEFAULT_CURRENCY].symbol;
}

export { DEFAULT_CURRENCY };
