import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { APP_CURRENCY, APP_LOCALE, APP_TIMEZONE } from "~/config/locale";
import { getCurrencyDecimals, getCurrencySymbol } from "@rental-portal/shared-types";

/**
 * Utility function to merge Tailwind CSS classes with proper precedence.
 * Combines clsx for conditional classes and tailwind-merge for deduplication.
 *
 * @example
 * cn("px-4 py-2", isActive && "bg-blue-500", className)
 * // Returns: "px-4 py-2 bg-blue-500" (with proper merging)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number as currency using the platform's configured locale & currency.
 * Both `locale` and `currency` can be overridden per-call.
 */
export function formatCurrency(
  value: number,
  currency: string = APP_CURRENCY,
  locale: string = APP_LOCALE,
): string {
  const code = currency.trim().toUpperCase();
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: getCurrencyDecimals(code),
    }).format(value);
  } catch {
    return `${getCurrencySymbol(code, locale)} ${value.toLocaleString(APP_LOCALE, {
      minimumFractionDigits: 0,
      maximumFractionDigits: getCurrencyDecimals(code),
    })}`.trim();
  }
}

/**
 * Format a number with commas using the platform locale.
 * Pass a locale override for dynamic i18n support.
 */
export function formatNumber(value: number, locale: string = APP_LOCALE): string {
  return new Intl.NumberFormat(locale).format(value);
}

/**
 * Format a date to a readable string using the platform locale.
 * Pass a locale override for dynamic i18n support.
 */
export function formatDate(date: Date | string, locale: string = APP_LOCALE): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: APP_TIMEZONE,
  }).format(d);
}

/**
 * Format a date with time using the platform locale.
 * Pass a locale override for dynamic i18n support.
 */
export function formatDateTime(date: Date | string, locale: string = APP_LOCALE): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIMEZONE,
  }).format(d);
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

/**
 * Generate initials from a name
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Check if a color is light or dark (for determining text color)
 * Returns true if the color is light (should use dark text)
 */
export function isLightColor(hexColor: string): boolean {
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128;
}
