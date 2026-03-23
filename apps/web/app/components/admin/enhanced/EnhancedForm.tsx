/**
 * Enhanced Form Component
 * Stepped wizard form with smart validation and auto-save — pure Tailwind
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  Save,
  X,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { APP_LOCALE } from "~/config/locale";

export interface FieldConfig {
  name: string;
  label: string;
  type:
    | "text"
    | "number"
    | "select"
    | "boolean"
    | "date"
    | "textarea"
    | "email"
    | "url"
    | "password";
  required?: boolean;
  placeholder?: string;
  helperText?: string;
  options?: Array<{
    value: string | number;
    label: string;
    disabled?: boolean;
  }>;
  multiple?: boolean;
  multiline?: boolean;
  rows?: number;
  defaultValue?: unknown;
  disabled?: boolean;
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    custom?: (value: unknown) => string | null;
  };
  dependencies?: string[];
  showIf?: (formData: unknown) => boolean;
}

export interface FormStep {
  id: string;
  title: string;
  description?: string;
  fields: FieldConfig[];
  optional?: boolean;
}

interface EnhancedFormProps {
  steps?: FormStep[];
  fields?: FieldConfig[];
  initialData?: Record<string, unknown>;
  mode?: "create" | "edit" | "view";
  layout?: "steps" | "sections" | "single";
  onSubmit: (data: Record<string, unknown>) => Promise<void> | void;
  onCancel?: () => void;
  enableAutoSave?: boolean;
  autoSaveInterval?: number;
  onAutoSave?: (data: Record<string, unknown>) => Promise<void> | void;
  title?: string;
  submitLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
}

/* ─── Input class helper ─── */
const inputCls = (hasError: boolean) =>
  `w-full rounded-md border px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed ${
    hasError ? "border-destructive" : "border-input"
  } bg-background`;

export const EnhancedForm: React.FC<EnhancedFormProps> = ({
  steps,
  fields,
  initialData = {},
  mode = "create",
  layout = "single",
  onSubmit,
  onCancel,
  enableAutoSave = false,
  autoSaveInterval = 3000,
  onAutoSave,
  title,
  submitLabel = "Submit",
  cancelLabel = "Cancel",
  loading = false,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isViewMode = mode === "view";
  const isSteppedLayout = layout === "steps" && steps && steps.length > 0;
  const currentStepConfig = isSteppedLayout ? steps[activeStep] : null;
  const currentFields = isSteppedLayout ? currentStepConfig?.fields || [] : fields || [];

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), toast.type === "success" ? 3000 : 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const form = useForm({
    defaultValues: initialData,
  });

  const handleFormSubmit = useCallback(async (value: Record<string, unknown>) => {
    try {
      await onSubmit(value);
      setToast({ type: "success", message: "Form submitted successfully!" });
      setFormErrors({});
    } catch (error) {
      setToast({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to submit form",
      });
    }
  }, [onSubmit]);

  const runAutoSave = useCallback(async () => {
    if (!onAutoSave) return;

    const formData = form.getValues();
    if (Object.keys(formData).length === 0) return;

    setAutoSaving(true);
    try {
      await onAutoSave(formData);
      setLastSaved(new Date());
    } catch (error) {
      console.error("Auto-save failed:", error);
    } finally {
      setAutoSaving(false);
    }
  }, [form, onAutoSave]);

  const validateField = useCallback(
    (field: FieldConfig, value: unknown): string | null => {
      if (field.required && (value === null || value === undefined || value === "")) {
        return `${field.label} is required`;
      }
      if (field.validation) {
        const { min, max, minLength, maxLength, pattern, custom } = field.validation;
        if (typeof value === "number") {
          if (min !== undefined && value < min) return `${field.label} must be at least ${min}`;
          if (max !== undefined && value > max) return `${field.label} must be at most ${max}`;
        }
        if (typeof value === "string") {
          if (minLength !== undefined && value.length < minLength) return `${field.label} must be at least ${minLength} characters`;
          if (maxLength !== undefined && value.length > maxLength) return `${field.label} must be at most ${maxLength} characters`;
          if (pattern && !pattern.test(value)) return `${field.label} format is invalid`;
        }
        if (custom) return custom(value);
      }
      return null;
    },
    []
  );

  const validateStep = useCallback(() => {
    const errors: Record<string, string> = {};
    const formData = form.getValues();
    currentFields.forEach((field) => {
      if (field.showIf && !field.showIf(formData)) return;
      const value = formData[field.name];
      const error = validateField(field, value);
      if (error) errors[field.name] = error;
    });
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [currentFields, form, validateField]);

  const handleNext = useCallback(() => { if (validateStep()) setActiveStep((prev) => prev + 1); }, [validateStep]);
  const handleBack = useCallback(() => { setActiveStep((prev) => prev - 1); }, []);

  useEffect(() => {
    if (!enableAutoSave || !onAutoSave || isViewMode) return;

    const clearPendingAutoSave = () => {
      if (autoSaveTimeoutRef.current !== null) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
    };

    const subscription = form.watch(() => {
      clearPendingAutoSave();
      autoSaveTimeoutRef.current = setTimeout(() => {
        autoSaveTimeoutRef.current = null;
        void runAutoSave();
      }, autoSaveInterval);
    });

    return () => {
      subscription.unsubscribe();
      clearPendingAutoSave();
    };
  }, [autoSaveInterval, enableAutoSave, form, isViewMode, onAutoSave, runAutoSave]);

  const renderField = useCallback(
    (field: FieldConfig) => {
      const formData = form.getValues();
      if (field.showIf && !field.showIf(formData)) return null;
      const fieldError = formErrors[field.name];
      const isDisabled = field.disabled || isViewMode;

      return (
        <Controller
          key={field.name}
          name={field.name}
          control={form.control}
          rules={{
            validate: (value) => {
              const err = validateField(field, value);
              return err ?? true;
            },
          }}
          render={({ field: rhfField }) => {
            const hasError = !!fieldError;

            switch (field.type) {
              case "select":
                return (
                  <div>
                    <label className="block text-sm font-medium mb-1.5">
                      {field.label}
                      {field.required && <span className="text-destructive ml-0.5">*</span>}
                    </label>
                    {field.multiple ? (
                      <select
                        multiple
                        className={inputCls(hasError)}
                        value={Array.isArray(rhfField.value) ? (rhfField.value as string[]) : []}
                        onChange={(e) => {
                          const selected = Array.from(e.target.selectedOptions, (o) => o.value);
                          rhfField.onChange(selected);
                        }}
                        onBlur={rhfField.onBlur}
                        disabled={isDisabled}
                      >
                        {field.options?.map((opt) => (
                          <option key={opt.value} value={opt.value} disabled={opt.disabled}>{opt.label}</option>
                        ))}
                      </select>
                    ) : (
                      <select
                        className={inputCls(hasError)}
                        value={String(rhfField.value ?? "")}
                        onChange={(e) => rhfField.onChange(e.target.value)}
                        onBlur={rhfField.onBlur}
                        disabled={isDisabled}
                      >
                        <option value="">Select...</option>
                        {field.options?.map((opt) => (
                          <option key={opt.value} value={opt.value} disabled={opt.disabled}>{opt.label}</option>
                        ))}
                      </select>
                    )}
                    {(fieldError || field.helperText) && (
                      <p className={`text-xs mt-1 ${hasError ? "text-destructive" : "text-muted-foreground"}`}>
                        {fieldError || field.helperText}
                      </p>
                    )}
                  </div>
                );

              case "boolean":
                return (
                  <label className="flex items-center gap-3 cursor-pointer">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!!rhfField.value}
                      disabled={isDisabled}
                      onClick={() => rhfField.onChange(!rhfField.value)}
                      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors disabled:opacity-50 ${
                        rhfField.value ? "bg-primary" : "bg-input"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform ${
                          rhfField.value ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                    <span className="text-sm">{field.label}</span>
                  </label>
                );

              case "date":
                return (
                  <div>
                    <label className="block text-sm font-medium mb-1.5">
                      {field.label}
                      {field.required && <span className="text-destructive ml-0.5">*</span>}
                    </label>
                    <input
                      type="date"
                      className={inputCls(hasError)}
                      value={
                        rhfField.value && typeof rhfField.value !== "object"
                          ? new Date(rhfField.value as string | number).toISOString().split("T")[0]
                          : ""
                      }
                      onChange={(e) => rhfField.onChange(e.target.value)}
                      onBlur={rhfField.onBlur}
                      disabled={isDisabled}
                    />
                    {(fieldError || field.helperText) && (
                      <p className={`text-xs mt-1 ${hasError ? "text-destructive" : "text-muted-foreground"}`}>
                        {fieldError || field.helperText}
                      </p>
                    )}
                  </div>
                );

              case "textarea":
                return (
                  <div>
                    <label className="block text-sm font-medium mb-1.5">
                      {field.label}
                      {field.required && <span className="text-destructive ml-0.5">*</span>}
                    </label>
                    <textarea
                      className={inputCls(hasError)}
                      rows={field.rows || 4}
                      value={String(rhfField.value ?? "")}
                      onChange={(e) => rhfField.onChange(e.target.value)}
                      onBlur={rhfField.onBlur}
                      placeholder={field.placeholder}
                      disabled={isDisabled}
                    />
                    {(fieldError || field.helperText) && (
                      <p className={`text-xs mt-1 ${hasError ? "text-destructive" : "text-muted-foreground"}`}>
                        {fieldError || field.helperText}
                      </p>
                    )}
                  </div>
                );

              case "number":
                return (
                  <div>
                    <label className="block text-sm font-medium mb-1.5">
                      {field.label}
                      {field.required && <span className="text-destructive ml-0.5">*</span>}
                    </label>
                    <input
                      type="number"
                      className={inputCls(hasError)}
                      value={String(rhfField.value ?? "")}
                      onChange={(e) => rhfField.onChange(e.target.value ? Number(e.target.value) : null)}
                      onBlur={rhfField.onBlur}
                      placeholder={field.placeholder}
                      min={field.validation?.min}
                      max={field.validation?.max}
                      disabled={isDisabled}
                    />
                    {(fieldError || field.helperText) && (
                      <p className={`text-xs mt-1 ${hasError ? "text-destructive" : "text-muted-foreground"}`}>
                        {fieldError || field.helperText}
                      </p>
                    )}
                  </div>
                );

              default:
                return (
                  <div>
                    <label className="block text-sm font-medium mb-1.5">
                      {field.label}
                      {field.required && <span className="text-destructive ml-0.5">*</span>}
                    </label>
                    <input
                      type={field.type}
                      className={inputCls(hasError)}
                      value={String(rhfField.value ?? "")}
                      onChange={(e) => rhfField.onChange(e.target.value)}
                      onBlur={rhfField.onBlur}
                      placeholder={field.placeholder}
                      disabled={isDisabled}
                    />
                    {(fieldError || field.helperText) && (
                      <p className={`text-xs mt-1 ${hasError ? "text-destructive" : "text-muted-foreground"}`}>
                        {fieldError || field.helperText}
                      </p>
                    )}
                  </div>
                );
            }
          }}
        />
      );
    },
    [form, formErrors, isViewMode, validateField]
  );

  const isLastStep = isSteppedLayout && activeStep === (steps?.length || 0) - 1;
  const canGoNext = isSteppedLayout && !isLastStep;
  const canGoBack = isSteppedLayout && activeStep > 0;

  return (
    <div className="rounded-lg border bg-card shadow-sm p-6">
      {/* Title and Auto-save indicator */}
      <div className="flex items-center justify-between mb-6">
        {title && <h2 className="text-xl font-semibold">{title}</h2>}
        {enableAutoSave && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {autoSaving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : lastSaved ? (
              <>
                <Check className="h-3.5 w-3.5 text-green-600" />
                <span>Saved {lastSaved.toLocaleTimeString(APP_LOCALE)}</span>
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* Stepper */}
      {isSteppedLayout && steps && (
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          {steps.map((step, idx) => (
            <React.Fragment key={step.id}>
              {idx > 0 && <div className={`flex-1 h-0.5 min-w-[24px] ${idx <= activeStep ? "bg-primary" : "bg-border"}`} />}
              <div className="flex items-center gap-2 shrink-0">
                <div
                  className={`flex items-center justify-center h-8 w-8 rounded-full text-xs font-medium ${
                    idx < activeStep
                      ? "bg-primary text-primary-foreground"
                      : idx === activeStep
                      ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {idx < activeStep ? <Check className="h-4 w-4" /> : idx + 1}
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium leading-tight">{step.title}</p>
                  {step.optional && <p className="text-xs text-muted-foreground">Optional</p>}
                </div>
              </div>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Step description */}
      {isSteppedLayout && currentStepConfig?.description && (
        <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800 px-4 py-3 text-sm text-blue-700 dark:text-blue-300 mb-4">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {currentStepConfig.description}
        </div>
      )}

      {/* Form fields */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (isSteppedLayout && !isLastStep) handleNext();
          else form.handleSubmit(handleFormSubmit)(e);
        }}
      >
        <div className="flex flex-col gap-4">{currentFields.map(renderField)}</div>

        {/* Actions */}
        <div className="flex justify-between mt-6">
          <div className="flex gap-2">
            {canGoBack && (
              <button
                type="button"
                onClick={handleBack}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-md border hover:bg-muted disabled:opacity-50"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-md border hover:bg-muted disabled:opacity-50"
              >
                <X className="h-4 w-4" /> {cancelLabel}
              </button>
            )}
            {canGoNext ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Next <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading || isViewMode}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {submitLabel}
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <div
            className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm ${
              toast.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200 dark:bg-green-950 dark:text-green-200"
                : "bg-red-50 text-red-800 border border-red-200 dark:bg-red-950 dark:text-red-200"
            }`}
          >
            {toast.type === "success" ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {toast.message}
            <button type="button" onClick={() => setToast(null)} className="ml-2 p-0.5 rounded hover:bg-black/10">&times;</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedForm;
