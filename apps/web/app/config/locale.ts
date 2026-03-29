/**
 * Centralized locale / currency / country configuration for the web app.
 *
 * All values are imported from the shared-types single-source-of-truth
 * (`@rental-portal/shared-types/platform.config`) and can be overridden via
 * environment variables (VITE_*) for multi-region deployments.
 *
 * Usage:
 *   import { APP_LOCALE, APP_CURRENCY } from "~/config/locale";
 */

import * as sharedPlatform from "@rental-portal/shared-types";

function resolveSharedValue<T>(
  getter: (() => T) | undefined,
  fallback: T,
): T {
  return typeof getter === "function" ? getter() : fallback;
}

// ─── Environment overrides (Vite injects these at build time) ────────────────

// Helper to safely read Vite env vars at runtime (works in SSR and client)
function getViteEnv(key: string): string | undefined {
  try {
    if (typeof import.meta !== 'undefined') {
      const meta = import.meta as unknown as Record<string, unknown>;
      const env = meta.env as Record<string, string> | undefined;
      return env?.[key];
    }
  } catch {
    // SSR or non-Vite context — ignore
  }
  return undefined;
}

/** BCP 47 / Intl locale tag used by Intl.NumberFormat, Intl.DateTimeFormat, etc. */
export const APP_LOCALE: string =
  getViteEnv('VITE_APP_LOCALE') || 'en';

/** ISO 4217 currency code */
export const APP_CURRENCY: string =
  getViteEnv('VITE_APP_CURRENCY') ||
  resolveSharedValue(sharedPlatform.getDefaultCurrency, sharedPlatform.DEFAULT_CURRENCY);

/** ISO 3166-1 alpha-2 country code */
export const APP_COUNTRY_CODE: string =
  getViteEnv('VITE_APP_COUNTRY') ||
  resolveSharedValue(sharedPlatform.getPlatformCountryCode, sharedPlatform.PLATFORM_COUNTRY_CODE);

/** IANA timezone */
export const APP_TIMEZONE: string =
  getViteEnv('VITE_APP_TIMEZONE') ||
  resolveSharedValue(sharedPlatform.getDefaultTimezone, sharedPlatform.DEFAULT_TIMEZONE);

/** Default map center coordinates [lat, lng] */
export const APP_MAP_CENTER: [number, number] = resolveSharedValue(
  sharedPlatform.getDefaultMapCenter,
  sharedPlatform.DEFAULT_MAP_CENTER,
);

/** Phone number placeholder shown in forms */
export const APP_PHONE_PLACEHOLDER: string = resolveSharedValue(
  sharedPlatform.getPhonePlaceholder,
  sharedPlatform.PHONE_PLACEHOLDER,
);

/** Shorthand ISO locale tag for the web app (e.g. "en") */
export const APP_SHORT_LOCALE: string = resolveSharedValue(
  sharedPlatform.getDefaultLocale,
  sharedPlatform.DEFAULT_LOCALE,
);

/** Short BCP 47 lang tag for <html lang> (env-overridable) */
export const APP_LANG: string =
  getViteEnv('VITE_APP_LANG') || APP_SHORT_LOCALE;
