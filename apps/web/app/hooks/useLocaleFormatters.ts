import { useCallback, useMemo } from "react";
import { useLocaleStore } from "~/lib/store/locale";
import { APP_CURRENCY, APP_TIMEZONE } from "~/config/locale";
import {
  getCurrencyDecimals,
  getCurrencyIntlLocale,
  type SupportedCurrency,
} from "@rental-portal/shared-types";

/**
 * Returns locale-aware formatting functions that react to language and currency changes.
 * Uses the user's selected language and preferred currency from the Zustand store.
 */
export function useLocaleFormatters(overrideCurrency?: string) {
  const language = useLocaleStore((s) => s.language);
  const storeCurrency = useLocaleStore((s) => s.currency);

  // Map language to Intl locale. For Nepali, use "ne-NP"; for English, use currency-specific locale.
  const currency = (overrideCurrency ?? storeCurrency ?? APP_CURRENCY) as SupportedCurrency;
  const intlLocale = useMemo(() => {
    if (language === "ne") return "ne-NP";
    return getCurrencyIntlLocale(currency);
  }, [language, currency]);

  const formatCurrency = useCallback(
    (value: number, currencyOverride?: string) => {
      const curr = (currencyOverride ?? currency).trim().toUpperCase();
      try {
        return new Intl.NumberFormat(intlLocale, {
          style: "currency",
          currency: curr,
          minimumFractionDigits: 0,
          maximumFractionDigits: getCurrencyDecimals(curr),
        }).format(value);
      } catch {
        return value.toLocaleString(intlLocale, {
          minimumFractionDigits: 0,
          maximumFractionDigits: getCurrencyDecimals(curr),
        });
      }
    },
    [intlLocale, currency],
  );

  const formatNumber = useCallback(
    (value: number) => new Intl.NumberFormat(intlLocale).format(value),
    [intlLocale],
  );

  const formatDate = useCallback(
    (date: Date | string) => {
      const d = typeof date === "string" ? new Date(date) : date;
      return new Intl.DateTimeFormat(intlLocale, {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: APP_TIMEZONE,
      }).format(d);
    },
    [intlLocale],
  );

  const formatDateTime = useCallback(
    (date: Date | string) => {
      const d = typeof date === "string" ? new Date(date) : date;
      return new Intl.DateTimeFormat(intlLocale, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: APP_TIMEZONE,
      }).format(d);
    },
    [intlLocale],
  );

  const formatRelativeTime = useCallback(
    (date: Date | string) => {
      const d = typeof date === "string" ? new Date(date) : date;
      const diff = Date.now() - d.getTime();
      const rtf = new Intl.RelativeTimeFormat(intlLocale, { numeric: "auto" });

      const seconds = Math.floor(diff / 1000);
      if (seconds < 60) return rtf.format(-seconds, "second");
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return rtf.format(-minutes, "minute");
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return rtf.format(-hours, "hour");
      const days = Math.floor(hours / 24);
      if (days < 30) return rtf.format(-days, "day");
      const months = Math.floor(days / 30);
      if (months < 12) return rtf.format(-months, "month");
      return rtf.format(-Math.floor(months / 12), "year");
    },
    [intlLocale],
  );

  return {
    language,
    intlLocale,
    formatCurrency,
    formatNumber,
    formatDate,
    formatDateTime,
    formatRelativeTime,
  };
}
