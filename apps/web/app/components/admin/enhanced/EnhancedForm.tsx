/**
 * Enhanced Form Component
 * Stepped wizard form with smart validation and auto-save
 */

import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  Box,
  Paper,
  Stepper,
  Step,
  StepLabel,
  Button,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Checkbox,
  Alert,
  Snackbar,
  CircularProgress,
  Chip,
  FormHelperText,
  Divider,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  ArrowBack as BackIcon,
  ArrowForward as NextIcon,
  Check as CheckIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Autorenew as AutoSaveIcon,
} from "@mui/icons-material";
import { useForm } from "@tanstack/react-form";

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
  defaultValue?: any;
  disabled?: boolean;
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    custom?: (value: any) => string | null;
  };
  dependencies?: string[];
  showIf?: (formData: any) => boolean;
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
  initialData?: Record<string, any>;
  mode?: "create" | "edit" | "view";
  layout?: "steps" | "sections" | "single";
  onSubmit: (data: Record<string, any>) => Promise<void> | void;
  onCancel?: () => void;
  enableAutoSave?: boolean;
  autoSaveInterval?: number;
  onAutoSave?: (data: Record<string, any>) => Promise<void> | void;
  title?: string;
  submitLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
}

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
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const isViewMode = mode === "view";
  const isSteppedLayout = layout === "steps" && steps && steps.length > 0;
  const currentStepConfig = isSteppedLayout ? steps[activeStep] : null;
  const currentFields = isSteppedLayout
    ? currentStepConfig?.fields || []
    : fields || [];

  // Form instance
  const form = useForm({
    defaultValues: initialData,
    onSubmit: async ({ value }) => {
      try {
        await onSubmit(value);
        setShowSuccess(true);
        setFormErrors({});
      } catch (error) {
        setShowError(true);
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to submit form"
        );
      }
    },
  });

  // Validate field
  const validateField = useCallback(
    (field: FieldConfig, value: any): string | null => {
      if (
        field.required &&
        (value === null || value === undefined || value === "")
      ) {
        return `${field.label} is required`;
      }

      if (field.validation) {
        const { min, max, minLength, maxLength, pattern, custom } =
          field.validation;

        if (typeof value === "number") {
          if (min !== undefined && value < min) {
            return `${field.label} must be at least ${min}`;
          }
          if (max !== undefined && value > max) {
            return `${field.label} must be at most ${max}`;
          }
        }

        if (typeof value === "string") {
          if (minLength !== undefined && value.length < minLength) {
            return `${field.label} must be at least ${minLength} characters`;
          }
          if (maxLength !== undefined && value.length > maxLength) {
            return `${field.label} must be at most ${maxLength} characters`;
          }
          if (pattern && !pattern.test(value)) {
            return `${field.label} format is invalid`;
          }
        }

        if (custom) {
          return custom(value);
        }
      }

      return null;
    },
    []
  );

  // Validate current step
  const validateStep = useCallback(() => {
    const errors: Record<string, string> = {};
    const formData = form.state.values;

    currentFields.forEach((field) => {
      if (field.showIf && !field.showIf(formData)) {
        return;
      }

      const value = formData[field.name];
      const error = validateField(field, value);
      if (error) {
        errors[field.name] = error;
      }
    });

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [currentFields, form.state.values, validateField]);

  // Handle next step
  const handleNext = useCallback(() => {
    if (validateStep()) {
      setActiveStep((prev) => prev + 1);
    }
  }, [validateStep]);

  // Handle back step
  const handleBack = useCallback(() => {
    setActiveStep((prev) => prev - 1);
  }, []);

  // Auto-save functionality
  useEffect(() => {
    if (!enableAutoSave || !onAutoSave || isViewMode) return;

    const autoSaveTimer = setInterval(async () => {
      const formData = form.state.values;
      if (Object.keys(formData).length > 0) {
        setAutoSaving(true);
        try {
          await onAutoSave(formData);
          setLastSaved(new Date());
        } catch (error) {
          console.error("Auto-save failed:", error);
        } finally {
          setAutoSaving(false);
        }
      }
    }, autoSaveInterval);

    return () => clearInterval(autoSaveTimer);
  }, [
    enableAutoSave,
    onAutoSave,
    autoSaveInterval,
    form.state.values,
    isViewMode,
  ]);

  // Render field
  const renderField = useCallback(
    (field: FieldConfig) => {
      const formData = form.state.values;

      if (field.showIf && !field.showIf(formData)) {
        return null;
      }

      const fieldError = formErrors[field.name];
      const isDisabled = field.disabled || isViewMode;

      return (
        <form.Field
          key={field.name}
          name={field.name as any}
          validators={{
            onChange: ({ value }) => validateField(field, value),
          }}
        >
          {(fieldApi) => {
            const commonProps = {
              fullWidth: true,
              size: "small" as const,
              disabled: isDisabled,
              error: !!fieldError,
              helperText: fieldError || field.helperText,
              label: field.label,
              required: field.required,
            };

            switch (field.type) {
              case "select":
                return (
                  <FormControl {...commonProps}>
                    <InputLabel>{field.label}</InputLabel>
                    <Select
                      value={fieldApi.state.value ?? (field.multiple ? [] : "")}
                      onChange={(e) =>
                        fieldApi.handleChange(e.target.value as any)
                      }
                      onBlur={() => fieldApi.handleBlur()}
                      multiple={field.multiple}
                      displayEmpty
                      renderValue={
                        field.multiple
                          ? (selected) => (
                              <Box
                                sx={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: 0.5,
                                }}
                              >
                                {(selected as string[]).map((value) => {
                                  const option = field.options?.find(
                                    (opt) => opt.value === value
                                  );
                                  return (
                                    <Chip
                                      key={value}
                                      label={option?.label || value}
                                      size="small"
                                    />
                                  );
                                })}
                              </Box>
                            )
                          : (selected) => {
                              if (!selected) return "";
                              const option = field.options?.find(
                                (opt) => opt.value === selected
                              );
                              return option?.label || String(selected);
                            }
                      }
                    >
                      {field.options?.map((option) => (
                        <MenuItem
                          key={option.value}
                          value={option.value}
                          disabled={option.disabled}
                        >
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                    {commonProps.helperText && (
                      <FormHelperText>{commonProps.helperText}</FormHelperText>
                    )}
                  </FormControl>
                );

              case "boolean":
                return (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={!!fieldApi.state.value}
                        onChange={(e) =>
                          fieldApi.handleChange(e.target.checked)
                        }
                        disabled={isDisabled}
                      />
                    }
                    label={field.label}
                  />
                );

              case "date":
                return (
                  <TextField
                    {...commonProps}
                    type="date"
                    value={
                      fieldApi.state.value
                        ? new Date(fieldApi.state.value)
                            .toISOString()
                            .split("T")[0]
                        : ""
                    }
                    onChange={(e) =>
                      fieldApi.handleChange(e.target.value as any)
                    }
                    onBlur={() => fieldApi.handleBlur()}
                    InputLabelProps={{ shrink: true }}
                  />
                );

              case "textarea":
                return (
                  <TextField
                    {...commonProps}
                    multiline
                    rows={field.rows || 4}
                    value={fieldApi.state.value ?? ""}
                    onChange={(e) =>
                      fieldApi.handleChange(e.target.value as any)
                    }
                    onBlur={() => fieldApi.handleBlur()}
                    placeholder={field.placeholder}
                  />
                );

              case "number":
                return (
                  <TextField
                    {...commonProps}
                    type="number"
                    value={fieldApi.state.value ?? ""}
                    onChange={(e) =>
                      fieldApi.handleChange(
                        e.target.value ? Number(e.target.value) : null
                      )
                    }
                    onBlur={() => fieldApi.handleBlur()}
                    placeholder={field.placeholder}
                    inputProps={{
                      min: field.validation?.min,
                      max: field.validation?.max,
                    }}
                  />
                );

              default:
                return (
                  <TextField
                    {...commonProps}
                    type={field.type}
                    value={fieldApi.state.value ?? ""}
                    onChange={(e) =>
                      fieldApi.handleChange(e.target.value as any)
                    }
                    onBlur={() => fieldApi.handleBlur()}
                    placeholder={field.placeholder}
                  />
                );
            }
          }}
        </form.Field>
      );
    },
    [form, formErrors, isViewMode, validateField]
  );

  const isLastStep = isSteppedLayout && activeStep === (steps?.length || 0) - 1;
  const canGoNext = isSteppedLayout && !isLastStep;
  const canGoBack = isSteppedLayout && activeStep > 0;

  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      {/* Title and Auto-save indicator */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        {title && (
          <Typography variant="h5" fontWeight={600}>
            {title}
          </Typography>
        )}
        {enableAutoSave && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {autoSaving ? (
              <>
                <CircularProgress size={16} />
                <Typography variant="caption" color="text.secondary">
                  Saving...
                </Typography>
              </>
            ) : lastSaved ? (
              <>
                <CheckIcon fontSize="small" color="success" />
                <Typography variant="caption" color="text.secondary">
                  Saved {lastSaved.toLocaleTimeString()}
                </Typography>
              </>
            ) : null}
          </Box>
        )}
      </Box>

      {/* Stepper */}
      {isSteppedLayout && steps && (
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((step, index) => (
            <Step key={step.id}>
              <StepLabel
                optional={
                  step.optional ? (
                    <Typography variant="caption">Optional</Typography>
                  ) : undefined
                }
              >
                {step.title}
              </StepLabel>
            </Step>
          ))}
        </Stepper>
      )}

      {/* Step description */}
      {isSteppedLayout && currentStepConfig?.description && (
        <Alert severity="info" sx={{ mb: 3 }}>
          {currentStepConfig.description}
        </Alert>
      )}

      {/* Form fields */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (isSteppedLayout && !isLastStep) {
            handleNext();
          } else {
            form.handleSubmit();
          }
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {currentFields.map(renderField)}
        </Box>

        {/* Actions */}
        <Box sx={{ display: "flex", justifyContent: "space-between", mt: 4 }}>
          <Box sx={{ display: "flex", gap: 1 }}>
            {canGoBack && (
              <Button
                startIcon={<BackIcon />}
                onClick={handleBack}
                disabled={loading}
              >
                Back
              </Button>
            )}
          </Box>

          <Box sx={{ display: "flex", gap: 1 }}>
            {onCancel && (
              <Button
                startIcon={<CancelIcon />}
                onClick={onCancel}
                disabled={loading}
              >
                {cancelLabel}
              </Button>
            )}

            {canGoNext ? (
              <Button
                variant="contained"
                endIcon={<NextIcon />}
                onClick={handleNext}
                disabled={loading}
              >
                Next
              </Button>
            ) : (
              <Button
                type="submit"
                variant="contained"
                startIcon={
                  loading ? <CircularProgress size={20} /> : <SaveIcon />
                }
                disabled={loading || isViewMode}
              >
                {submitLabel}
              </Button>
            )}
          </Box>
        </Box>
      </form>

      {/* Success/Error Snackbars */}
      <Snackbar
        open={showSuccess}
        autoHideDuration={3000}
        onClose={() => setShowSuccess(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" onClose={() => setShowSuccess(false)}>
          Form submitted successfully!
        </Alert>
      </Snackbar>

      <Snackbar
        open={showError}
        autoHideDuration={5000}
        onClose={() => setShowError(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="error" onClose={() => setShowError(false)}>
          {errorMessage}
        </Alert>
      </Snackbar>
    </Paper>
  );
};

export default EnhancedForm;
