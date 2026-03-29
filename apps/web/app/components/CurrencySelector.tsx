import { useLocaleStore } from "~/lib/store/locale";
import {
  getSupportedCurrencies,
  getCurrencySymbol,
  type SupportedCurrency,
} from "@rental-portal/shared-types";
import { cn } from "~/lib/utils";

const SUPPORTED_CURRENCIES = getSupportedCurrencies();

/**
 * Build dynamic labels from Intl.NumberFormat — NO hardcoded symbols.
 */
function getCurrencyLabel(code: string): string {
  const symbol = getCurrencySymbol(code);
  return symbol !== code ? `${symbol} ${code}` : code;
}

export function CurrencySelector({ className }: { className?: string }) {
  const currency = useLocaleStore((s) => s.currency);
  const setCurrency = useLocaleStore((s) => s.setCurrency);

  return (
    <select
      value={currency}
      onChange={(e) => setCurrency(e.target.value as SupportedCurrency)}
      className={cn(
        "text-xs rounded border border-input bg-background px-1.5 py-1",
        "text-muted-foreground hover:text-foreground cursor-pointer",
        "focus:outline-none focus:ring-1 focus:ring-ring",
        className,
      )}
      aria-label="Select currency"
    >
      {SUPPORTED_CURRENCIES.map((code) => (
        <option key={code} value={code}>
          {getCurrencyLabel(code)}
        </option>
      ))}
    </select>
  );
}
