import React, { useState, useEffect } from 'react';
import {
  useForm,
  type FieldValues,
  type Path,
  type Resolver,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { cn } from '~/lib/utils';
import { AlertCircle, CheckCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: string) => string | null;
}

interface FieldConfig {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'tel' | 'textarea';
  placeholder?: string;
  validation: ValidationRule;
  helperText?: string;
  autoComplete?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface SmartFormProps<TFieldValues extends FieldValues = FieldValues> {
  schema: z.ZodType<TFieldValues, any, any>;
  fields: FieldConfig[];
  onSubmit: (data: TFieldValues) => void | Promise<void>;
  loading?: boolean;
  className?: string;
  submitText?: string;
  submitVariant?: 'primary' | 'secondary';
  realTimeValidation?: boolean;
  showProgress?: boolean;
}

interface FieldValidation {
  isValid: boolean;
  message: string | null;
  isDirty: boolean;
}

export function SmartForm<TFieldValues extends FieldValues = FieldValues>({
  schema,
  fields,
  onSubmit,
  loading = false,
  className,
  submitText,
  submitVariant = 'primary',
  realTimeValidation = true,
  showProgress = false
}: SmartFormProps<TFieldValues>) {
  const { t } = useTranslation();
  const [fieldValidations, setFieldValidations] = useState<Record<string, FieldValidation>>({});
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, touchedFields, isValid, isDirty },
    trigger,
    watch
  } = useForm<TFieldValues>({
    resolver: zodResolver(schema as any) as Resolver<TFieldValues>,
    mode: realTimeValidation ? 'onChange' : 'onSubmit',
    reValidateMode: 'onChange'
  });

  // Watch all field values for real-time validation
  const watchedValues = watch();

  // Real-time validation effect
  useEffect(() => {
    if (!realTimeValidation) return;

    const validateField = async (fieldName: Path<TFieldValues>) => {
      const isFieldValid = await trigger(fieldName);
      const errorMessage = errors[fieldName]?.message as string | undefined;
      setFieldValidations(prev => ({
        ...prev,
        [fieldName]: {
          isValid: isFieldValid,
          message: isFieldValid ? null : errorMessage || 'Invalid input',
          isDirty: true
        }
      }));
    };

    // Validate all fields that have been touched
    Object.keys(watchedValues).forEach(fieldName => {
      const typedFieldName = fieldName as Path<TFieldValues>;
      if (
        (touchedFields as Record<string, boolean | undefined>)[fieldName] ||
        fieldValidations[fieldName]?.isDirty
      ) {
        void validateField(typedFieldName);
      }
    });
  }, [watchedValues, touchedFields, errors, trigger, realTimeValidation]);

  const togglePasswordVisibility = (fieldName: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [fieldName]: !prev[fieldName]
    }));
  };

  const getFieldValidation = (fieldName: string): FieldValidation => {
    return fieldValidations[fieldName] || { isValid: false, message: null, isDirty: false };
  };

  const getProgressPercentage = () => {
    const totalFields = fields.length;
    const validFields = fields.filter(field => {
      const validation = getFieldValidation(field.name);
      return validation.isValid && watchedValues[field.name];
    }).length;
    return totalFields > 0 ? (validFields / totalFields) * 100 : 0;
  };

  const renderField = (field: FieldConfig) => {
    const registration = register(
      field.name as Path<TFieldValues>,
      field.type === 'number'
        ? {
            setValueAs: (value) =>
              value === '' || value == null ? 0 : Number(value),
          }
        : undefined
    );
    const validation = getFieldValidation(field.name);
    const hasError = !!errors[field.name];
    const isFocused = focusedField === field.name;
    const showPassword = showPasswords[field.name];

    const fieldClasses = cn(
      'w-full px-3 py-2 border rounded-md transition-all duration-200',
      'focus:outline-none focus:ring-2 focus:ring-offset-0',
      field.icon && 'pl-10',
      hasError
        ? 'border-destructive focus:ring-destructive/20 bg-destructive/5'
        : validation.isValid && validation.isDirty
        ? 'border-success focus:ring-success/20 bg-success/5'
        : isFocused
        ? 'border-primary focus:ring-primary/20 bg-primary/5'
        : 'border-input bg-background',
      loading && 'opacity-50 cursor-not-allowed'
    );

    const renderInput = () => {
      switch (field.type) {
        case 'textarea':
          return (
            <textarea
              {...registration}
              id={field.name}
              placeholder={field.placeholder}
              className={cn(fieldClasses, 'resize-none min-h-[100px]')}
              disabled={loading}
              onFocus={() => setFocusedField(field.name)}
              onBlur={(event) => {
                registration.onBlur(event);
                setFocusedField(null);
              }}
            />
          );

        case 'password':
          return (
            <div className="relative">
              <input
                {...registration}
                id={field.name}
                type={showPassword ? 'text' : 'password'}
                placeholder={field.placeholder}
                className={cn(fieldClasses, 'pr-10')}
                disabled={loading}
                autoComplete={field.autoComplete}
                onFocus={() => setFocusedField(field.name)}
                onBlur={(event) => {
                  registration.onBlur(event);
                  setFocusedField(null);
                }}
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility(field.name)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                disabled={loading}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          );

        default:
          return (
            <input
              {...registration}
              id={field.name}
              type={field.type}
              placeholder={field.placeholder}
              className={fieldClasses}
              disabled={loading}
              autoComplete={field.autoComplete}
              onFocus={() => setFocusedField(field.name)}
              onBlur={(event) => {
                registration.onBlur(event);
                setFocusedField(null);
              }}
            />
          );
      }
    };

    return (
      <div key={field.name} className="space-y-2">
        <label htmlFor={field.name} className="block text-sm font-medium text-foreground">
          {field.label}
          {field.validation.required && (
            <span aria-hidden="true" className="text-destructive ml-1">
              *
            </span>
          )}
        </label>

        <div className="relative">
          {field.icon && (
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
              <field.icon className="w-4 h-4" />
            </div>
          )}

          {renderInput()}
        </div>

        {/* Validation feedback */}
        <div className="min-h-[20px]">
          {hasError && (
            <div className="flex items-center gap-1 text-sm text-destructive animate-in slide-in-from-top-1">
              <AlertCircle className="w-3 h-3" />
              <span>{errors[field.name]?.message as string}</span>
            </div>
          )}
          {!hasError && validation.isValid && validation.isDirty && (
            <div className="flex items-center gap-1 text-sm text-success animate-in slide-in-from-top-1">
              <CheckCircle className="w-3 h-3" />
              <span>{t('form.valid', 'Valid')}</span>
            </div>
          )}
          {field.helperText && !hasError && !validation.isDirty && (
            <div className="text-sm text-muted-foreground">
              {field.helperText}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <form
      onSubmit={handleSubmit(async (data) => {
        await onSubmit(data);
      })}
      className={cn('space-y-6', className)}
    >
      {/* Progress indicator */}
      {showProgress && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{t('form.completion', 'Form completion')}</span>
            <span>{Math.round(getProgressPercentage())}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>
        </div>
      )}

      {/* Form fields */}
      <div className="space-y-4">
        {fields.map(renderField)}
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={loading || (realTimeValidation && isDirty && !isValid)}
        className={cn(
          'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-md font-medium transition-all duration-200',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          submitVariant === 'primary'
            ? 'bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-2 focus:ring-primary/20'
            : 'bg-secondary text-secondary-foreground hover:bg-secondary/80 focus:ring-2 focus:ring-secondary/20'
        )}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {submitText || t('form.submit', 'Submit')}
      </button>

      {/* Form status */}
      {realTimeValidation && isDirty && (
        <div className="text-center text-sm text-muted-foreground">
          {isValid
            ? t('form.readyToSubmit', 'Ready to submit')
            : t('form.fixErrors', 'Please fix the errors above')}
        </div>
      )}
    </form>
  );
}
