import type { UseFormRegister, FieldErrors } from "react-hook-form";
import { TrendingUp } from "lucide-react";
import { formatCurrency } from "~/lib/utils";
import { APP_CURRENCY } from "~/config/locale";

interface PriceSuggestion {
  sampleSize: number;
  averagePrice: number;
  medianPrice: number;
  suggestedRange: { low: number; high: number };
}

interface PricingStepProps {
  register: UseFormRegister<any>;
  errors: FieldErrors<any>;
  priceSuggestion?: PriceSuggestion | null;
  onUseSuggestedPrice?: (price: number) => void;
}

export function PricingStep({
  register,
  errors,
  priceSuggestion,
  onUseSuggestedPrice,
}: PricingStepProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground mb-6">
        Pricing & Condition
      </h2>

      {/* Price Suggestion Banner */}
      {priceSuggestion && (
        <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
          <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-blue-900 dark:text-blue-100">
              Price suggestion based on {priceSuggestion.sampleSize} similar
              listing{priceSuggestion.sampleSize !== 1 ? "s" : ""}
            </p>
            <p className="text-blue-700 dark:text-blue-300 mt-1">
              Suggested range:{" "}
              <strong>
                {formatCurrency(priceSuggestion.suggestedRange.low)} –{" "}
                {formatCurrency(priceSuggestion.suggestedRange.high)}/day
              </strong>{" "}
              (avg {formatCurrency(priceSuggestion.averagePrice)}, median{" "}
              {formatCurrency(priceSuggestion.medianPrice)})
            </p>
            {onUseSuggestedPrice && (
              <button
                type="button"
                className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                onClick={() =>
                  onUseSuggestedPrice(priceSuggestion.medianPrice)
                }
              >
                Use median price ({formatCurrency(priceSuggestion.medianPrice)})
              </button>
            )}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          {`Price per Day * (${APP_CURRENCY})`}
        </label>
        <input
          {...register("basePrice", { valueAsNumber: true })}
          type="number"
          min="1"
          step="0.01"
          placeholder="25.00"
          className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
        />
        {errors.basePrice && (
          <p className="mt-1 text-sm text-destructive">
            {(errors.basePrice as any).message}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            {`Price per Week (${APP_CURRENCY})`}
          </label>
          <input
            {...register("pricePerWeek", { valueAsNumber: true })}
            type="number"
            min="0"
            step="0.01"
            placeholder="150.00"
            className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            {`Price per Month (${APP_CURRENCY})`}
          </label>
          <input
            {...register("pricePerMonth", { valueAsNumber: true })}
            type="number"
            min="0"
            step="0.01"
            placeholder="500.00"
            className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          {`Security Deposit * (${APP_CURRENCY})`}
        </label>
        <input
          {...register("securityDeposit", { valueAsNumber: true })}
          type="number"
          min="0"
          step="0.01"
          placeholder="100.00"
          className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
        />
        {errors.securityDeposit && (
          <p className="mt-1 text-sm text-destructive">
            {(errors.securityDeposit as any).message}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Condition *
        </label>
        <select
          {...register("condition")}
          className="w-full px-4 py-3 border border-input rounded-lg bg-background capitalize focus:ring-2 focus:ring-ring transition-colors"
        >
          <option value="">Select condition</option>
          <option value="new">New</option>
          <option value="like-new">Like New</option>
          <option value="good">Good</option>
          <option value="fair">Fair</option>
          <option value="poor">Poor</option>
        </select>
        {errors.condition && (
          <p className="mt-1 text-sm text-destructive">
            {(errors.condition as any).message}
          </p>
        )}
      </div>
    </div>
  );
}
