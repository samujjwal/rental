import { create } from "zustand";
import i18n from "~/i18n";
import type { SupportedLanguage } from "~/i18n";
import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES, type SupportedCurrency } from "@rental-portal/shared-types";

interface LocaleState {
  language: SupportedLanguage;
  currency: SupportedCurrency;
  setLanguage: (lang: SupportedLanguage) => void;
  setCurrency: (currency: SupportedCurrency) => void;
}

function getInitialLanguage(): SupportedLanguage {
  if (typeof window === "undefined") return "en";
  const stored = localStorage.getItem("language-preference");
  if (stored === "en" || stored === "ne") return stored;
  const browser = navigator.language?.split("-")[0];
  if (browser === "ne") return "ne";
  return "en";
}

function getInitialCurrency(): SupportedCurrency {
  if (typeof window === "undefined") return DEFAULT_CURRENCY;
  const stored = localStorage.getItem("currency-preference");
  if (stored && (SUPPORTED_CURRENCIES as readonly string[]).includes(stored)) {
    return stored as SupportedCurrency;
  }
  return DEFAULT_CURRENCY;
}

export const useLocaleStore = create<LocaleState>((set) => ({
  language: getInitialLanguage(),
  currency: getInitialCurrency(),
  setLanguage: (lang: SupportedLanguage) => {
    i18n.changeLanguage(lang);
    if (typeof window !== "undefined") {
      localStorage.setItem("language-preference", lang);
      document.documentElement.lang = lang;
    }
    set({ language: lang });
  },
  setCurrency: (currency: SupportedCurrency) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("currency-preference", currency);
    }
    set({ currency });
  },
}));

// Initialize i18n language on module load
if (typeof window !== "undefined") {
  const initial = getInitialLanguage();
  i18n.changeLanguage(initial);
}
