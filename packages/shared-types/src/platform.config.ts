/**
 * Platform Configuration — Country-agnostic, data-driven configuration system.
 *
 * This file provides DYNAMIC configuration that reads from environment variables
 * and database tables (CountryConfig, CurrencyConfig, LocaleConfig) at runtime.
 *
 * NO hardcoded country, currency, locale, or timezone constants.
 * All values are resolved from: env vars → DB config → fallback defaults.
 *
 * Seed data (NEPAL_LOCATIONS, NEPALI_FIRST_NAMES, etc.) has been moved to
 * packages/database/prisma/seed.ts where it belongs.
 */

import { getCurrencyDecimals } from './currency.utils';

// ─── Supported Locales (loaded from env / DB at runtime) ─────────────────────

/**
 * Get supported locales from environment or provide reasonable defaults.
 * In production, these should come from the LocaleConfig table.
 */
export function getSupportedLocales(): string[] {
  if (typeof process !== 'undefined' && process.env?.SUPPORTED_LOCALES) {
    return process.env.SUPPORTED_LOCALES.split(',').map((s) => s.trim());
  }
  return ['en']; // Bare minimum: English
}

/**
 * Get the default locale from environment.
 */
export function getDefaultLocale(): string {
  if (typeof process !== 'undefined' && process.env?.DEFAULT_LOCALE) {
    return process.env.DEFAULT_LOCALE;
  }
  return 'en';
}

// ─── Supported Currencies (loaded from env / DB at runtime) ──────────────────

/**
 * Get supported currencies from environment or provide reasonable defaults.
 * In production, these should come from the CurrencyConfig table.
 */
export function getSupportedCurrencies(): string[] {
  if (typeof process !== 'undefined' && process.env?.SUPPORTED_CURRENCIES) {
    return process.env.SUPPORTED_CURRENCIES.split(',').map((s) => s.trim());
  }
  return ['USD']; // Bare minimum: US Dollar
}

/**
 * Get the default currency from environment.
 */
export function getDefaultCurrency(): string {
  if (typeof process !== 'undefined' && process.env?.DEFAULT_CURRENCY) {
    return process.env.DEFAULT_CURRENCY;
  }
  return 'USD';
}

// ─── Timezone ────────────────────────────────────────────────────────────────

/**
 * Get the default timezone from environment.
 */
export function getDefaultTimezone(): string {
  if (typeof process !== 'undefined' && process.env?.DEFAULT_TIMEZONE) {
    return process.env.DEFAULT_TIMEZONE;
  }
  return 'UTC';
}

// ─── Country ─────────────────────────────────────────────────────────────────

/**
 * Get the platform country code from environment.
 */
export function getPlatformCountryCode(): string {
  if (typeof process !== 'undefined' && process.env?.PLATFORM_COUNTRY) {
    return process.env.PLATFORM_COUNTRY;
  }
  return '';
}

/**
 * Get phone country code from environment.
 */
export function getPhoneCountryCode(): string {
  if (typeof process !== 'undefined' && process.env?.PHONE_COUNTRY_CODE) {
    return process.env.PHONE_COUNTRY_CODE;
  }
  return '';
}

// ─── Currency Formatting (uses Intl — no hardcoded symbols) ──────────────────

/**
 * Format an amount as a currency string using `Intl.NumberFormat`.
 * Works in Node, browsers, and React Native.
 * Uses ISO 4217 currency code to determine formatting — NO hardcoded symbols.
 *
 * @param amount  - numeric value
 * @param currency - ISO 4217 code (defaults to platform default currency)
 * @param locale - BCP 47 locale string (defaults to platform default locale)
 * @returns formatted string, e.g. "NPR 1,500" or "$25.00"
 */
export function formatCurrency(
  amount: number | undefined | null,
  currency?: string,
  locale?: string,
): string {
  if (amount == null || Number.isNaN(amount)) return '';
  const code = currency || getDefaultCurrency();
  const decimals = getCurrencyDecimals(code);
  // Use the provided locale, or try to infer a reasonable one
  const displayLocale = locale || getDefaultLocale();
  return new Intl.NumberFormat(displayLocale, {
    style: 'currency',
    currency: code,
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(amount);
}

/**
 * Return just the symbol for a given currency code using Intl (no hardcoded map).
 */
export function getCurrencySymbol(currencyCode?: string, locale?: string): string {
  const code = currencyCode || getDefaultCurrency();
  const displayLocale = locale || getDefaultLocale();
  try {
    const parts = new Intl.NumberFormat(displayLocale, {
      style: 'currency',
      currency: code,
    }).formatToParts(0);
    return parts.find((p) => p.type === 'currency')?.value ?? code;
  } catch {
    return code;
  }
}

// ─── Legacy Compatibility Exports ────────────────────────────────────────────
// These are provided for backward compatibility during migration.
// They read from environment variables instead of being hardcoded.
// Services should migrate to using ConfigService or the DB-backed
// CountryConfig/CurrencyConfig/LocaleConfig tables.

/** @deprecated Use getSupportedLocales() or read from LocaleConfig table */
export const SUPPORTED_LOCALES = getSupportedLocales();
export type SupportedLocale = string;

/** @deprecated Use getDefaultLocale() or read from config */
export const DEFAULT_LOCALE = getDefaultLocale();
export const FALLBACK_LOCALE = 'en';

/** @deprecated Use getSupportedCurrencies() or read from CurrencyConfig table */
export const SUPPORTED_CURRENCIES = getSupportedCurrencies();
export type SupportedCurrency = string;

/** @deprecated Use getDefaultCurrency() or read from config */
export const DEFAULT_CURRENCY = getDefaultCurrency();

/** @deprecated Use getDefaultTimezone() or read from config */
export const DEFAULT_TIMEZONE = getDefaultTimezone();

/** @deprecated Use getPlatformCountryCode() or read from config */
export const PLATFORM_COUNTRY_CODE = getPlatformCountryCode();

/** @deprecated Use env var or read from CountryConfig table */
export const PLATFORM_COUNTRY = (typeof process !== 'undefined' && process.env?.PLATFORM_COUNTRY_NAME) || '';

/** @deprecated Use getPhoneCountryCode() or read from CountryConfig table */
export const PHONE_COUNTRY_CODE = getPhoneCountryCode();

/** @deprecated Remove hardcoded placeholder */
export const PHONE_PLACEHOLDER = '';

/** @deprecated Use DB-backed map center per country */
export const DEFAULT_MAP_CENTER: [number, number] = [0, 0];

// ─── Legacy Currency Config (backward compat) ───────────────────────────────
// These should be read from CurrencyConfig DB table in production.

export const CURRENCY_CONFIG: Record<string, {
  code: string;
  symbol: string;
  symbolNe?: string;
  name: string;
  nameNe: string;
  decimals: number;
  symbolPosition: 'before' | 'after';
}> = {
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    nameNe: 'अमेरिकी डलर',
    decimals: 2,
    symbolPosition: 'before',
  },
  NPR: {
    code: 'NPR',
    symbol: 'Rs.',
    symbolNe: 'रु',
    name: 'Nepalese Rupee',
    nameNe: 'नेपाली रुपैयाँ',
    decimals: 2,
    symbolPosition: 'before',
  },
  INR: {
    code: 'INR',
    symbol: '₹',
    name: 'Indian Rupee',
    nameNe: 'भारतीय रुपैयाँ',
    decimals: 2,
    symbolPosition: 'before',
  },
};

export const CURRENCY_INTL_LOCALE: Record<string, string> = {
  NPR: 'en-IN',
  USD: 'en-US',
  INR: 'en-IN',
};

export const LOCALE_LABELS: Record<string, string> = {};
export const LOCALE_NATIVE_LABELS: Record<string, string> = {};

// ─── Seed Data Types (structures preserved, data moved to seed.ts) ──────────

export interface NepalLocation {
  city: string;
  cityNe: string;
  state: string;
  stateNe: string;
  latitude: number;
  longitude: number;
  zipCode: string;
}

/** @deprecated Use seed data instead */
export const NEPAL_LOCATIONS: NepalLocation[] = [];
export const NEPAL_TOLES: string[] = [];
export const NEPALI_FIRST_NAMES: string[] = [];
export const NEPALI_LAST_NAMES: string[] = [];
export const LISTING_TITLES: Record<string, any> = {};
export const LISTING_DESCRIPTIONS: Record<string, any> = {};
export const LISTING_RULES: Record<string, any> = {};
export const AMENITIES_BILINGUAL: Array<{ en: string; ne: string }> = [];
export const VEHICLE_TYPES: string[] = [];
export const EQUIPMENT_TYPES: string[] = [];
