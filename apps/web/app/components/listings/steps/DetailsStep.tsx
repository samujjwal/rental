import type {
  UseFormRegister,
  FieldErrors,
} from "react-hook-form";
import { APP_CURRENCY } from "~/config/locale";

interface DetailsStepProps {
  register: UseFormRegister<any>;
  errors: FieldErrors<any>;
  showDeliveryFields: boolean;
}

export function DetailsStep({
  register,
  errors,
  showDeliveryFields,
}: DetailsStepProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground mb-6">
        Rental Details
      </h2>

      <div>
        <label className="block text-sm font-medium text-foreground mb-3">
          Delivery Options *
        </label>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              {...register("deliveryOptions.pickup")}
              type="checkbox"
              className="w-4 h-4 text-primary rounded border-input focus:ring-ring"
            />
            <span className="text-foreground">Pickup</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              {...register("deliveryOptions.delivery")}
              type="checkbox"
              className="w-4 h-4 text-primary rounded border-input focus:ring-ring"
            />
            <span className="text-foreground">Delivery</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              {...register("deliveryOptions.shipping")}
              type="checkbox"
              className="w-4 h-4 text-primary rounded border-input focus:ring-ring"
            />
            <span className="text-foreground">Shipping</span>
          </label>
        </div>
      </div>

      {showDeliveryFields && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Delivery Radius (km)
            </label>
            <input
              {...register("deliveryRadius", {
                valueAsNumber: true,
              })}
              type="number"
              min="0"
              placeholder="10"
              className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {`Delivery Fee (${APP_CURRENCY})`}
            </label>
            <input
              {...register("deliveryFee", { valueAsNumber: true })}
              type="number"
              min="0"
              step="0.01"
              placeholder="15.00"
              className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Minimum Rental Period (days) *
          </label>
          <input
            {...register("minimumRentalPeriod", {
              valueAsNumber: true,
            })}
            type="number"
            min="1"
            placeholder="1"
            className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
          />
          {errors.minimumRentalPeriod && (
            <p className="mt-1 text-sm text-destructive">
              {(errors.minimumRentalPeriod as any).message}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Maximum Rental Period (days)
          </label>
          <input
            {...register("maximumRentalPeriod", {
              valueAsNumber: true,
            })}
            type="number"
            min="1"
            placeholder="30"
            className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Cancellation Policy *
        </label>
        <select
          {...register("cancellationPolicy")}
          className="w-full px-4 py-3 border border-input rounded-lg bg-background capitalize focus:ring-2 focus:ring-ring transition-colors"
        >
          <option value="flexible">Flexible</option>
          <option value="moderate">Moderate</option>
          <option value="strict">Strict</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Rental Rules
        </label>
        <textarea
          {...register("rules")}
          rows={4}
          maxLength={1000}
          placeholder="Any specific rules or requirements..."
          className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
        />
      </div>

      <div>
        <label className="flex items-center gap-2">
          <input
            {...register("instantBooking")}
            type="checkbox"
            className="w-4 h-4 text-primary rounded border-input focus:ring-ring"
          />
          <span className="text-sm font-medium text-foreground">
            Allow instant booking (no approval needed)
          </span>
        </label>
      </div>
    </div>
  );
}
