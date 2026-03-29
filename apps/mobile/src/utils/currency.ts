/**
 * Currency formatting utility for the mobile app.
 * Imports config from the shared-types single source of truth.
 */
import {
  getCurrencyConfig,
  getCurrencyIntlLocale,
  getDefaultCurrency,
  type SupportedCurrency,
} from '@rental-portal/shared-types';

const DEFAULT_CURRENCY = getDefaultCurrency() as SupportedCurrency;

/**
 * Format an amount as a currency string.
 * Uses the platform's configured default currency when none is specified.
 */
export function formatCurrency(
  amount: number | undefined | null,
  currencyCode?: string,
): string {
  if (amount == null || Number.isNaN(amount)) return '';
  const code = (currencyCode ?? DEFAULT_CURRENCY).trim().toUpperCase() as SupportedCurrency;
  const config = getCurrencyConfig(code);
  const locale = getCurrencyIntlLocale(code);

  try {
    const formatted = amount.toLocaleString(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: config.decimals,
    });
    return config.symbolPosition === 'before'
      ? `${config.symbol} ${formatted}`
      : `${formatted} ${config.symbol}`;
  } catch {
    return `${config.symbol} ${String(amount)}`.trim();
  }
}

/**
 * Return just the currency symbol for a given code.
 */
export function getCurrencySymbol(currencyCode?: string): string {
  const code = (currencyCode ?? DEFAULT_CURRENCY).trim().toUpperCase() as SupportedCurrency;
  return getCurrencyConfig(code).symbol;
}

export { DEFAULT_CURRENCY };
