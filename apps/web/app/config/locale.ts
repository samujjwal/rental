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

import {
  DEFAULT_CURRENCY,
  DEFAULT_LOCALE,
  DEFAULT_MAP_CENTER,
  DEFAULT_TIMEZONE,
  PHONE_PLACEHOLDER as _PHONE_PLACEHOLDER,
  PLATFORM_COUNTRY_CODE,
} from "@rental-portal/shared-types";

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
  getViteEnv('VITE_APP_CURRENCY') || DEFAULT_CURRENCY;

/** ISO 3166-1 alpha-2 country code */
export const APP_COUNTRY_CODE: string =
  getViteEnv('VITE_APP_COUNTRY') || PLATFORM_COUNTRY_CODE;

/** IANA timezone */
export const APP_TIMEZONE: string =
  getViteEnv('VITE_APP_TIMEZONE') || DEFAULT_TIMEZONE;

/** Default map center coordinates [lat, lng] */
export const APP_MAP_CENTER: [number, number] = DEFAULT_MAP_CENTER;

/** Phone number placeholder shown in forms */
export const APP_PHONE_PLACEHOLDER: string = _PHONE_PLACEHOLDER;

/** Shorthand ISO locale tag for the web app (e.g. "en") */
export const APP_SHORT_LOCALE: string = DEFAULT_LOCALE;

/** Short BCP 47 lang tag for <html lang> (env-overridable) */
export const APP_LANG: string =
  getViteEnv('VITE_APP_LANG') || APP_SHORT_LOCALE;
