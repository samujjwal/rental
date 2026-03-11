import { useState, useEffect, useRef, useCallback } from "react";
import { Globe } from "lucide-react";
import { cn } from "~/lib/utils";
import i18next from "i18next";

const LANGUAGE_STORAGE_KEY = "language-preference";

export interface Language {
  code: string;
  label: string;
  nativeLabel: string;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "ne", label: "Nepali", nativeLabel: "नेपाली" },
];

const DEFAULT_LANGUAGE = "en";

function getStoredLanguage(): string {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored && SUPPORTED_LANGUAGES.some((l) => l.code === stored)) {
    return stored;
  }
  return DEFAULT_LANGUAGE;
}

function applyLanguage(code: string) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = code;
  localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
  // Sync with i18next so all t() calls update
  if (i18next.isInitialized && i18next.language !== code) {
    i18next.changeLanguage(code);
  }
}

/**
 * Hook to manage language state.
 * Syncs with localStorage, <html lang="">, and i18next.
 */
export function useLanguage() {
  const [language, setLanguageState] = useState(DEFAULT_LANGUAGE);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = getStoredLanguage();
    setLanguageState(stored);
    applyLanguage(stored);
  }, []);

  const setLanguage = useCallback((code: string) => {
    setLanguageState(code);
    applyLanguage(code);
  }, []);

  return { language, setLanguage, mounted };
}

export interface LanguageSelectorProps {
  size?: "sm" | "md";
  className?: string;
  /** Show only the globe icon (useful in tight spaces) */
  iconOnly?: boolean;
}

/**
 * Language selector dropdown — toggles between English and Nepali.
 * Persists selection in localStorage and updates `<html lang="">`.
 */
export function LanguageSelector({
  size = "sm",
  className,
  iconOnly = false,
}: LanguageSelectorProps) {
  const { language, setLanguage, mounted } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === language);
  const sizeClasses = size === "sm" ? "text-sm" : "text-base";

  if (!mounted) {
    return (
      <div
        className={cn(
          "p-2 text-muted-foreground",
          sizeClasses,
          className,
        )}
      >
        <Globe className={size === "sm" ? "w-4 h-4" : "w-5 h-5"} />
      </div>
    );
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex items-center gap-1.5 rounded-md transition-colors",
          "text-muted-foreground hover:text-foreground hover:bg-muted/50",
          size === "sm" ? "p-2" : "px-3 py-2",
          sizeClasses,
        )}
        aria-label={`Language: ${currentLang?.label ?? "English"}. Click to change.`}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Globe className={size === "sm" ? "w-4 h-4" : "w-5 h-5"} />
        {!iconOnly && (
          <span className="hidden sm:inline font-medium">
            {currentLang?.nativeLabel ?? "English"}
          </span>
        )}
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Select language"
          className="absolute right-0 top-full mt-1 z-50 min-w-[140px] rounded-lg border bg-card shadow-lg py-1 animate-in fade-in-0 zoom-in-95"
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              role="option"
              aria-selected={language === lang.code}
              onClick={() => {
                setLanguage(lang.code);
                setOpen(false);
              }}
              className={cn(
                "w-full flex items-center justify-between gap-3 px-3 py-2 text-sm transition-colors",
                language === lang.code
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-foreground hover:bg-muted",
              )}
            >
              <span>{lang.nativeLabel}</span>
              <span className="text-xs text-muted-foreground">{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default LanguageSelector;
