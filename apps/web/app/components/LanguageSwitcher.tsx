import { useLocaleStore } from "~/lib/store/locale";
import { SUPPORTED_LANGUAGES } from "~/i18n";
import { getLocaleNativeLabels } from "@rental-portal/shared-types";

const LOCALE_NATIVE_LABELS = getLocaleNativeLabels();

const LANG_LABELS: Record<string, string> = {
  en: LOCALE_NATIVE_LABELS.en,
  ne: LOCALE_NATIVE_LABELS.ne,
};

export function LanguageSwitcher({ className }: { className?: string }) {
  const { language, setLanguage } = useLocaleStore();

  return (
    <select
      value={language}
      onChange={(e) => setLanguage(e.target.value as typeof language)}
      className={`rounded-md border border-input bg-background px-2 py-1 text-sm ${className ?? ""}`}
      aria-label="Select language"
    >
      {SUPPORTED_LANGUAGES.map((lang) => (
        <option key={lang} value={lang}>
          {LANG_LABELS[lang] || lang}
        </option>
      ))}
    </select>
  );
}
