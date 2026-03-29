/**
 * Platform configuration with validated runtime getters.
 *
 * This module still exposes deprecated constants for compatibility, but new
 * code should prefer getter functions so configuration is normalized on access.
 *
 * Until the DB-backed config tables fully replace env-based configuration, the
 * fallback defaults intentionally match the current production baseline.
 */

import { getCurrencyDecimals } from './currency.utils';

type RuntimeEnv = Record<string, string | undefined>;

interface CurrencyLegacyConfig {
  code: string;
  symbol: string;
  symbolNe?: string;
  name: string;
  nameNe: string;
  decimals: number;
  symbolPosition: 'before' | 'after';
}

export interface PlatformRuntimeConfig {
  supportedLocales: string[];
  defaultLocale: string;
  supportedCurrencies: string[];
  defaultCurrency: string;
  defaultTimezone: string;
  platformCountryCode: string;
  platformCountryName: string;
  phoneCountryCode: string;
  phonePlaceholder: string;
  defaultMapCenter: [number, number];
  localeLabels: Record<string, string>;
  localeNativeLabels: Record<string, string>;
  currencyConfig: Record<string, CurrencyLegacyConfig>;
  currencyIntlLocale: Record<string, string>;
}

const FALLBACK_LOCALES = ['en', 'ne'] as const;
const FALLBACK_CURRENCIES = ['NPR', 'USD', 'INR'] as const;
const FALLBACK_DEFAULT_LOCALE = 'en';
const FALLBACK_DEFAULT_CURRENCY = 'NPR';
const FALLBACK_DEFAULT_TIMEZONE = 'Asia/Kathmandu';
const FALLBACK_COUNTRY_CODE = 'NP';
const FALLBACK_COUNTRY_NAME = 'Nepal';
const FALLBACK_PHONE_COUNTRY_CODE = '+977';
const FALLBACK_PHONE_PLACEHOLDER = '+977 9812345678';
const FALLBACK_MAP_CENTER: [number, number] = [27.7172, 85.324];

const KNOWN_LOCALE_LABELS: Record<string, string> = {
  en: 'English',
  ne: 'Nepali',
};

const KNOWN_LOCALE_NATIVE_LABELS: Record<string, string> = {
  en: 'English',
  ne: 'नेपाली',
};

const KNOWN_CURRENCY_CONFIG: Record<string, CurrencyLegacyConfig> = {
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

const KNOWN_CURRENCY_INTL_LOCALES: Record<string, string> = {
  NPR: 'en-IN',
  USD: 'en-US',
  INR: 'en-IN',
};

function getRuntimeEnv(): RuntimeEnv {
  if (typeof process === 'undefined' || !process.env) {
    return {};
  }
  return process.env as RuntimeEnv;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function parseList(
  rawValue: string | undefined,
  normalizeItem: (value: string) => string | undefined,
  fallback: readonly string[],
): string[] {
  if (!rawValue) {
    return [...fallback];
  }

  const values = unique(
    rawValue
      .split(',')
      .map((entry) => normalizeItem(entry))
      .filter((entry): entry is string => Boolean(entry)),
  );

  return values.length > 0 ? values : [...fallback];
}

function normalizeLocale(locale: string | undefined): string | undefined {
  const trimmed = locale?.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    new Intl.NumberFormat(trimmed).format(1);
    return trimmed;
  } catch {
    return undefined;
  }
}

function normalizeCurrencyCode(currency: string | undefined): string | undefined {
  const trimmed = currency?.trim().toUpperCase();
  if (!trimmed || !/^[A-Z]{3}$/.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

function normalizeCountryCode(countryCode: string | undefined): string | undefined {
  const trimmed = countryCode?.trim().toUpperCase();
  if (!trimmed || !/^[A-Z]{2}$/.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

function normalizeCountryName(countryName: string | undefined): string | undefined {
  const trimmed = countryName?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeTimeZone(timeZone: string | undefined): string | undefined {
  const trimmed = timeZone?.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    new Intl.DateTimeFormat('en', { timeZone: trimmed }).format(new Date());
    return trimmed;
  } catch {
    return undefined;
  }
}

function normalizePhoneCountryCode(phoneCountryCode: string | undefined): string | undefined {
  const trimmed = phoneCountryCode?.trim();
  if (!trimmed || !/^\+\d{1,4}$/.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

function normalizeMapCoordinate(
  rawValue: string | undefined,
  min: number,
  max: number,
): number | undefined {
  if (!rawValue) {
    return undefined;
  }

  const value = Number(rawValue);
  if (!Number.isFinite(value) || value < min || value > max) {
    return undefined;
  }

  return value;
}

function getSafeCurrencySymbol(currencyCode: string, locale: string): string {
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
    }).formatToParts(0);
    return parts.find((part) => part.type === 'currency')?.value ?? currencyCode;
  } catch {
    return currencyCode;
  }
}

function inferSymbolPosition(currencyCode: string, locale: string): 'before' | 'after' {
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
    }).formatToParts(1);
    const currencyIndex = parts.findIndex((part) => part.type === 'currency');
    const integerIndex = parts.findIndex((part) => part.type === 'integer');
    if (currencyIndex !== -1 && integerIndex !== -1 && currencyIndex > integerIndex) {
      return 'after';
    }
  } catch {
    return 'before';
  }

  return 'before';
}

function buildLocaleLabels(locales: readonly string[]): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const locale of locales) {
    labels[locale] = KNOWN_LOCALE_LABELS[locale] ?? locale;
  }
  return labels;
}

function buildLocaleNativeLabels(locales: readonly string[]): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const locale of locales) {
    labels[locale] = KNOWN_LOCALE_NATIVE_LABELS[locale] ?? locale;
  }
  return labels;
}

function buildPhonePlaceholder(phoneCountryCode: string): string {
  if (phoneCountryCode === FALLBACK_PHONE_COUNTRY_CODE) {
    return FALLBACK_PHONE_PLACEHOLDER;
  }
  return `${phoneCountryCode} 555 123 4567`;
}

function buildCurrencyConfigEntry(currencyCode: string, defaultLocale: string): CurrencyLegacyConfig {
  const knownConfig = KNOWN_CURRENCY_CONFIG[currencyCode];
  if (knownConfig) {
    return knownConfig;
  }

  return {
    code: currencyCode,
    symbol: getSafeCurrencySymbol(currencyCode, defaultLocale),
    name: currencyCode,
    nameNe: currencyCode,
    decimals: getCurrencyDecimals(currencyCode),
    symbolPosition: inferSymbolPosition(currencyCode, defaultLocale),
  };
}

function buildCurrencyConfigMap(currencies: readonly string[], defaultLocale: string): Record<string, CurrencyLegacyConfig> {
  const config: Record<string, CurrencyLegacyConfig> = {};
  for (const currency of currencies) {
    config[currency] = buildCurrencyConfigEntry(currency, defaultLocale);
  }
  return config;
}

function buildCurrencyIntlLocaleMap(currencies: readonly string[], defaultLocale: string): Record<string, string> {
  const config: Record<string, string> = {};
  for (const currency of currencies) {
    config[currency] = KNOWN_CURRENCY_INTL_LOCALES[currency] ?? defaultLocale;
  }
  return config;
}

export function getPlatformConfig(env: RuntimeEnv = getRuntimeEnv()): PlatformRuntimeConfig {
  const supportedLocales = parseList(env.SUPPORTED_LOCALES, normalizeLocale, FALLBACK_LOCALES);
  const defaultLocale = normalizeLocale(env.DEFAULT_LOCALE) ?? FALLBACK_DEFAULT_LOCALE;
  if (!supportedLocales.includes(defaultLocale)) {
    supportedLocales.unshift(defaultLocale);
  }

  const supportedCurrencies = parseList(
    env.SUPPORTED_CURRENCIES,
    normalizeCurrencyCode,
    FALLBACK_CURRENCIES,
  );
  const defaultCurrency =
    normalizeCurrencyCode(env.DEFAULT_CURRENCY) ?? FALLBACK_DEFAULT_CURRENCY;
  if (!supportedCurrencies.includes(defaultCurrency)) {
    supportedCurrencies.unshift(defaultCurrency);
  }

  const platformCountryCode =
    normalizeCountryCode(env.PLATFORM_COUNTRY_CODE) ??
    normalizeCountryCode(env.PLATFORM_COUNTRY) ??
    FALLBACK_COUNTRY_CODE;

  const platformCountryName =
    normalizeCountryName(env.PLATFORM_COUNTRY_NAME) ??
    (normalizeCountryCode(env.PLATFORM_COUNTRY) ? undefined : normalizeCountryName(env.PLATFORM_COUNTRY)) ??
    FALLBACK_COUNTRY_NAME;

  const phoneCountryCode =
    normalizePhoneCountryCode(env.PHONE_COUNTRY_CODE) ?? FALLBACK_PHONE_COUNTRY_CODE;

  const defaultMapLat =
    normalizeMapCoordinate(env.DEFAULT_MAP_CENTER_LAT ?? env.DEFAULT_MAP_LATITUDE, -90, 90) ??
    FALLBACK_MAP_CENTER[0];
  const defaultMapLng =
    normalizeMapCoordinate(env.DEFAULT_MAP_CENTER_LNG ?? env.DEFAULT_MAP_LONGITUDE, -180, 180) ??
    FALLBACK_MAP_CENTER[1];

  const currencyKeys = unique([
    ...supportedCurrencies,
    defaultCurrency,
    ...Object.keys(KNOWN_CURRENCY_CONFIG),
  ]);

  return {
    supportedLocales,
    defaultLocale,
    supportedCurrencies,
    defaultCurrency,
    defaultTimezone:
      normalizeTimeZone(env.DEFAULT_TIMEZONE) ?? FALLBACK_DEFAULT_TIMEZONE,
    platformCountryCode,
    platformCountryName,
    phoneCountryCode,
    phonePlaceholder:
      normalizeCountryName(env.PHONE_PLACEHOLDER) ?? buildPhonePlaceholder(phoneCountryCode),
    defaultMapCenter: [defaultMapLat, defaultMapLng],
    localeLabels: buildLocaleLabels(supportedLocales),
    localeNativeLabels: buildLocaleNativeLabels(supportedLocales),
    currencyConfig: buildCurrencyConfigMap(currencyKeys, defaultLocale),
    currencyIntlLocale: buildCurrencyIntlLocaleMap(currencyKeys, defaultLocale),
  };
}

// ─── Supported Locales (loaded from env / DB at runtime) ─────────────────────

export function getSupportedLocales(): string[] {
  return getPlatformConfig().supportedLocales;
}

export function getDefaultLocale(): string {
  return getPlatformConfig().defaultLocale;
}

// ─── Supported Currencies (loaded from env / DB at runtime) ──────────────────

export function getSupportedCurrencies(): string[] {
  return getPlatformConfig().supportedCurrencies;
}

export function getDefaultCurrency(): string {
  return getPlatformConfig().defaultCurrency;
}

// ─── Timezone ────────────────────────────────────────────────────────────────

export function getDefaultTimezone(): string {
  return getPlatformConfig().defaultTimezone;
}

// ─── Country ─────────────────────────────────────────────────────────────────

export function getPlatformCountryCode(): string {
  return getPlatformConfig().platformCountryCode;
}

export function getPlatformCountryName(): string {
  return getPlatformConfig().platformCountryName;
}

export function getPhoneCountryCode(): string {
  return getPlatformConfig().phoneCountryCode;
}

export function getPhonePlaceholder(): string {
  return getPlatformConfig().phonePlaceholder;
}

export function getDefaultMapCenter(): [number, number] {
  return getPlatformConfig().defaultMapCenter;
}

export function getLocaleLabels(): Record<string, string> {
  return getPlatformConfig().localeLabels;
}

export function getLocaleNativeLabels(): Record<string, string> {
  return getPlatformConfig().localeNativeLabels;
}

export function getCurrencyConfig(currencyCode?: string): CurrencyLegacyConfig {
  const config = getPlatformConfig();
  const code = normalizeCurrencyCode(currencyCode) ?? config.defaultCurrency;
  return config.currencyConfig[code] ?? buildCurrencyConfigEntry(code, config.defaultLocale);
}

export function getCurrencyIntlLocale(currencyCode?: string): string {
  const config = getPlatformConfig();
  const code = normalizeCurrencyCode(currencyCode) ?? config.defaultCurrency;
  return config.currencyIntlLocale[code] ?? config.defaultLocale;
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
  const code = normalizeCurrencyCode(currency) ?? getDefaultCurrency();
  const decimals = getCurrencyDecimals(code);
  const displayLocale = normalizeLocale(locale) ?? getCurrencyIntlLocale(code);

  try {
    return new Intl.NumberFormat(displayLocale, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    }).format(amount);
  } catch {
    const rounded = amount.toLocaleString(getDefaultLocale(), {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    });
    return `${getCurrencySymbol(code, displayLocale)} ${rounded}`.trim();
  }
}

/**
 * Return just the symbol for a given currency code using Intl (no hardcoded map).
 */
export function getCurrencySymbol(currencyCode?: string, locale?: string): string {
  const code = normalizeCurrencyCode(currencyCode) ?? getDefaultCurrency();
  const displayLocale = normalizeLocale(locale) ?? getCurrencyIntlLocale(code);
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

/** @deprecated Use getPlatformCountryName() or read from CountryConfig table */
export const PLATFORM_COUNTRY = getPlatformCountryName();

/** @deprecated Use getPhoneCountryCode() or read from CountryConfig table */
export const PHONE_COUNTRY_CODE = getPhoneCountryCode();

/** @deprecated Use getPhonePlaceholder() or config service */
export const PHONE_PLACEHOLDER = getPhonePlaceholder();

/** @deprecated Use getDefaultMapCenter() or DB-backed map center */
export const DEFAULT_MAP_CENTER: [number, number] = getDefaultMapCenter();

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
}> = getPlatformConfig().currencyConfig;

export const CURRENCY_INTL_LOCALE: Record<string, string> =
  getPlatformConfig().currencyIntlLocale;

export const LOCALE_LABELS: Record<string, string> = getLocaleLabels();
export const LOCALE_NATIVE_LABELS: Record<string, string> = getLocaleNativeLabels();

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
