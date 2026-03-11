import type {
  UseFormRegister,
  FieldErrors,
} from "react-hook-form";

interface LocationStepProps {
  register: UseFormRegister<any>;
  errors: FieldErrors<any>;
}

export function LocationStep({ register, errors }: LocationStepProps) {
  const locationErrors = (errors as any).location;
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground mb-6">Location</h2>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Address *
        </label>
        <input
          {...register("location.address")}
          type="text"
          maxLength={200}
          placeholder="123 Main Street"
          className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
        />
        {locationErrors?.address && (
          <p className="mt-1 text-sm text-destructive">
            {locationErrors.address.message}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            City *
          </label>
          <input
            {...register("location.city")}
            type="text"
            maxLength={80}
            placeholder="Kathmandu"
            className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
          />
          {locationErrors?.city && (
            <p className="mt-1 text-sm text-destructive">
              {locationErrors.city.message}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            State *
          </label>
          <input
            {...register("location.state")}
            type="text"
            maxLength={80}
            placeholder="Bagmati"
            className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
          />
          {locationErrors?.state && (
            <p className="mt-1 text-sm text-destructive">
              {locationErrors.state.message}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Country *
          </label>
          <input
            {...register("location.country")}
            type="text"
            maxLength={80}
            placeholder="Nepal"
            className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
          />
          {locationErrors?.country && (
            <p className="mt-1 text-sm text-destructive">
              {locationErrors.country.message}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Postal Code *
          </label>
          <input
            {...register("location.postalCode")}
            type="text"
            maxLength={20}
            placeholder="44600"
            className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
          />
          {locationErrors?.postalCode && (
            <p className="mt-1 text-sm text-destructive">
              {locationErrors.postalCode.message}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Latitude *
          </label>
          <input
            {...register("location.coordinates.lat", {
              valueAsNumber: true,
            })}
            type="number"
            step="any"
            placeholder="27.7172"
            className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Longitude *
          </label>
          <input
            {...register("location.coordinates.lng", {
              valueAsNumber: true,
            })}
            type="number"
            step="any"
            placeholder="85.3240"
            className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
          />
        </div>
      </div>
    </div>
  );
}
