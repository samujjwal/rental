/**
 * Mobile i18n module — lightweight internationalization for React Native.
 *
 * Uses a simple key-value lookup with interpolation support.
 * No external dependencies required (no react-i18next weight in the bundle).
 *
 * Usage:
 *   import { t, setLocale, getLocale } from '../i18n';
 *   const label = t('auth.login'); // "Log In"
 *   const msg = t('search.resultsCount', { count: 42 }); // "42 results"
 */

import en from './locales/en.json';
import ne from './locales/ne.json';

type TranslationMap = Record<string, any>;

const translations: Record<string, TranslationMap> = {
  en,
  ne,
};

let currentLocale = 'en';

/**
 * Auto-detect device locale and set the app language.
 * Call this once at app startup (e.g. in App.tsx useEffect).
 */
export function detectAndSetLocale(): void {
  try {
    // Use expo-localization if available, otherwise fall back to 'en'
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getLocales } = require('expo-localization');
    const locales = getLocales();
    if (locales?.length > 0) {
      const deviceLang = locales[0].languageCode; // e.g. 'ne', 'en'
      if (deviceLang && translations[deviceLang]) {
        currentLocale = deviceLang;
      }
    }
  } catch {
    // expo-localization not available — keep default
  }
}

/**
 * Set the active locale. If unknown, falls back to 'en'.
 */
export function setLocale(locale: string): void {
  currentLocale = translations[locale] ? locale : 'en';
}

/**
 * Get the current active locale.
 */
export function getLocale(): string {
  return currentLocale;
}

/**
 * Register a new locale's translation map at runtime.
 * Call this to add a new language (e.g. after lazy-loading from server).
 */
export function registerLocale(locale: string, map: TranslationMap): void {
  translations[locale] = map;
}

/**
 * Translate a dotted key (e.g. 'auth.login') with optional interpolation.
 * Falls back to English, then to the raw key.
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const value = resolve(translations[currentLocale], key)
    ?? resolve(translations.en, key)
    ?? key;

  if (!params) return value;

  return value.replace(/\{\{(\w+)\}\}/g, (_, k) =>
    params[k] !== undefined ? String(params[k]) : `{{${k}}}`,
  );
}

function resolve(map: TranslationMap | undefined, key: string): string | undefined {
  if (!map) return undefined;
  const parts = key.split('.');
  let current: any = map;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return typeof current === 'string' ? current : undefined;
}
