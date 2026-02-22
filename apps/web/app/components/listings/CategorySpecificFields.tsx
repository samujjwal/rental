/**
 * Dynamic form fields that change based on the selected category.
 * Renders input controls (text, number, select, boolean, multiselect) from
 * the category field definitions in ~/lib/category-fields.ts.
 */

import { useMemo } from "react";
import {
  getCategoryFields,
  groupCategoryFields,
  type CategoryField,
} from "~/lib/category-fields";

interface CategorySpecificFieldsProps {
  /** Current category slug (e.g. "car", "apartment", "clothing-costumes") */
  categorySlug: string | undefined | null;
  /** Current values keyed by field key */
  values: Record<string, unknown>;
  /** Called when a field value changes */
  onChange: (key: string, value: unknown) => void;
  /** Validation errors keyed by field key */
  errors?: Record<string, string>;
}

export function CategorySpecificFields({
  categorySlug,
  values,
  onChange,
  errors,
}: CategorySpecificFieldsProps) {
  const fields = useMemo(() => getCategoryFields(categorySlug), [categorySlug]);
  const groups = useMemo(() => groupCategoryFields(fields), [fields]);

  if (fields.length === 0) return null;

  return (
    <div className="space-y-6 mt-6">
      <div className="border-t border-border pt-6">
        <h3 className="text-lg font-semibold text-foreground mb-1">
          Category-Specific Details
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Fill in the details specific to this type of listing
        </p>
      </div>
      {groups.map((group) => (
        <div key={group.label}>
          <h4 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wider text-muted-foreground">
            {group.label}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {group.fields.map((field) => (
              <FieldControl
                key={field.key}
                field={field}
                value={values[field.key]}
                onChange={(val) => onChange(field.key, val)}
                error={errors?.[field.key]}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Individual field renderer
// ---------------------------------------------------------------------------

function FieldControl({
  field,
  value,
  onChange,
  error,
}: {
  field: CategoryField;
  value: unknown;
  onChange: (val: unknown) => void;
  error?: string;
}) {
  const inputClass =
    "w-full rounded-lg border border-input bg-background px-4 py-3 text-sm focus:ring-2 focus:ring-ring focus:border-transparent transition-colors";

  const label = (
    <label className="block text-sm font-medium text-foreground mb-1.5">
      {field.label}
      {field.required && <span className="text-destructive ml-0.5">*</span>}
      {field.unit && (
        <span className="text-xs text-muted-foreground ml-1">({field.unit})</span>
      )}
    </label>
  );

  switch (field.type) {
    case "text":
      return (
        <div>
          {label}
          <input
            type="text"
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className={inputClass}
          />
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </div>
      );

    case "number":
      return (
        <div>
          {label}
          <input
            type="number"
            value={value === undefined || value === null || value === "" ? "" : Number(value)}
            onChange={(e) => {
              const v = e.target.value;
              onChange(v === "" ? undefined : Number(v));
            }}
            placeholder={field.placeholder}
            min={field.min}
            max={field.max}
            className={inputClass}
          />
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </div>
      );

    case "select":
      return (
        <div>
          {label}
          <select
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value || undefined)}
            className={inputClass}
          >
            <option value="">Select…</option>
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </div>
      );

    case "boolean":
      return (
        <div className="flex items-center gap-2 pt-7">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
            id={`cat-field-${field.key}`}
          />
          <label
            htmlFor={`cat-field-${field.key}`}
            className="text-sm font-medium text-foreground cursor-pointer"
          >
            {field.label}
          </label>
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </div>
      );

    case "multiselect":
      return (
        <div className="md:col-span-2">
          {label}
          <div className="flex flex-wrap gap-2 mt-1">
            {field.options?.map((opt) => {
              const checked = Array.isArray(value) && value.includes(opt.value);
              return (
                <label
                  key={opt.value}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                    checked
                      ? "bg-primary/10 border-primary text-primary"
                      : "border-input text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={() => {
                      const current = Array.isArray(value) ? [...value] : [];
                      const next = checked
                        ? current.filter((v) => v !== opt.value)
                        : [...current, opt.value];
                      onChange(next);
                    }}
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </div>
      );

    default:
      return null;
  }
}
