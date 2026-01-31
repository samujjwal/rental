import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Typography,
  Paper,
  Divider,
  Alert,
  Snackbar,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  FormHelperText,
  FormControlLabel,
  Switch,
  Stack,
  IconButton,
  Tooltip,
  useTheme,
} from "@mui/material";
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  ExpandMore as ExpandMoreIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";
import type {
  EntityConfig,
  FieldConfig,
  ValidationRule,
} from "~/lib/admin/entity-framework";

interface EntityFormProps<T extends Record<string, any> = any> {
  entityConfig: EntityConfig<T>;
  mode: "create" | "edit" | "view";
  data?: T;
  loading?: boolean;
  error?: string | null;
  onSubmit: (data: Partial<T>) => Promise<void> | void;
  onCancel: () => void;
  onChange?: (data: Partial<T>, isValid: boolean) => void;
}

export function EntityForm<T extends Record<string, any> = any>({
  entityConfig,
  mode,
  data,
  loading = false,
  error,
  onSubmit,
  onCancel,
  onChange,
}: EntityFormProps<T>) {
  const theme = useTheme();
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({});

  const isReadOnly = mode === "view";
  const isDisabled = loading || isReadOnly;

  // Initialize form data
  useEffect(() => {
    const initialData: Record<string, any> = {};

    entityConfig.fields.forEach((field) => {
      if (data && field.key in data) {
        initialData[field.key as string] = transformValueFromApi(
          data[field.key as string],
          field.type
        );
      } else if (field.defaultValue !== undefined) {
        initialData[field.key as string] = field.defaultValue;
      } else {
        initialData[field.key as string] = getDefaultValueForType(field.type);
      }
    });

    setFormData(initialData);
    setErrors({});
    setTouched({});

    // Initialize expanded sections
    if (entityConfig.formSections) {
      const sections: Record<string, boolean> = {};
      entityConfig.formSections.forEach((section, index) => {
        sections[section.title] = section.defaultExpanded !== false;
      });
      setExpandedSections(sections);
    }
  }, [data, entityConfig.fields, entityConfig.formSections, mode]);

  // Notify parent of changes
  useEffect(() => {
    const transformedData = transformDataToApi(formData, entityConfig.fields);
    const isValid = validateFormInternal(transformedData);
    onChange?.(transformedData, isValid);
  }, [formData]);

  // Validation
  const validateField = useCallback(
    (field: FieldConfig, value: any): string | null => {
      const { validation } = field;
      if (!validation) return null;

      // Required check
      if (
        validation.required &&
        (value === undefined || value === null || value === "")
      ) {
        return validation.message || `${field.label} is required`;
      }

      if (value === undefined || value === null || value === "") {
        return null;
      }

      // Type-specific validations
      switch (field.type) {
        case "email":
          if (validation.email !== false) {
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailPattern.test(value)) {
              return validation.message || "Please enter a valid email address";
            }
          }
          break;

        case "url":
          if (validation.url !== false) {
            try {
              new URL(value);
            } catch {
              return validation.message || "Please enter a valid URL";
            }
          }
          break;

        case "number":
          const num = Number(value);
          if (validation.min !== undefined && num < validation.min) {
            return (
              validation.message ||
              `${field.label} must be at least ${validation.min}`
            );
          }
          if (validation.max !== undefined && num > validation.max) {
            return (
              validation.message ||
              `${field.label} must be no more than ${validation.max}`
            );
          }
          break;

        case "text":
        case "textarea":
          const str = String(value);
          if (
            validation.minLength !== undefined &&
            str.length < validation.minLength
          ) {
            return (
              validation.message ||
              `${field.label} must be at least ${validation.minLength} characters`
            );
          }
          if (
            validation.maxLength !== undefined &&
            str.length > validation.maxLength
          ) {
            return (
              validation.message ||
              `${field.label} must be no more than ${validation.maxLength} characters`
            );
          }
          if (validation.pattern && !new RegExp(validation.pattern).test(str)) {
            return validation.message || `${field.label} format is invalid`;
          }
          break;
      }

      // Custom validation
      if (validation.custom) {
        return validation.custom(value, formData);
      }

      return null;
    },
    [formData]
  );

  const validateFormInternal = useCallback(
    (data: Record<string, any>): boolean => {
      const newErrors: Record<string, string> = {};
      let isValid = true;

      entityConfig.fields.forEach((field) => {
        const error = validateField(field, data[field.key as string]);
        if (error) {
          newErrors[field.key as string] = error;
          isValid = false;
        }
      });

      setErrors(newErrors);
      return isValid;
    },
    [entityConfig.fields, validateField]
  );

  const validateForm = (): boolean => {
    const transformedData = transformDataToApi(formData, entityConfig.fields);
    return validateFormInternal(transformedData);
  };

  // Field change handlers
  const handleFieldChange = (fieldKey: string, value: any) => {
    setFormData((prev) => ({ ...prev, [fieldKey]: value }));

    // Validate on change if field is touched
    if (touched[fieldKey]) {
      const field = entityConfig.fields.find((f) => f.key === fieldKey);
      if (field) {
        const error = validateField(field, value);
        setErrors((prev) => ({
          ...prev,
          [fieldKey]: error || "",
        }));
      }
    }
  };

  const handleFieldBlur = (fieldKey: string) => {
    setTouched((prev) => ({ ...prev, [fieldKey]: true }));

    const field = entityConfig.fields.find((f) => f.key === fieldKey);
    if (field) {
      const error = validateField(field, formData[fieldKey]);
      setErrors((prev) => ({
        ...prev,
        [fieldKey]: error || "",
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      // Mark all fields as touched to show errors
      const allTouched: Record<string, boolean> = {};
      entityConfig.fields.forEach((f) => {
        allTouched[f.key as string] = true;
      });
      setTouched(allTouched);
      return;
    }

    try {
      const transformedData = transformDataToApi(formData, entityConfig.fields);

      // Apply before hooks
      if (mode === "create" && entityConfig.hooks?.beforeCreate) {
        const hookedData =
          await entityConfig.hooks.beforeCreate(transformedData);
        Object.assign(transformedData, hookedData);
      } else if (mode === "edit" && entityConfig.hooks?.beforeUpdate) {
        const hookedData = await entityConfig.hooks.beforeUpdate(
          data?.id || "",
          transformedData
        );
        Object.assign(transformedData, hookedData);
      }

      await onSubmit(transformedData);

      // Apply after hooks
      if (mode === "create" && entityConfig.hooks?.afterCreate) {
        await entityConfig.hooks.afterCreate(transformedData as T);
      } else if (mode === "edit" && entityConfig.hooks?.afterUpdate) {
        await entityConfig.hooks.afterUpdate(transformedData as T);
      }

      setShowSuccess(true);

      if (mode === "create") {
        // Reset form after successful create
        const resetData: Record<string, any> = {};
        entityConfig.fields.forEach((field) => {
          resetData[field.key as string] =
            field.defaultValue ?? getDefaultValueForType(field.type);
        });
        setFormData(resetData);
        setTouched({});
        setErrors({});
      }
    } catch (err) {
      console.error("Form submission failed:", err);
      if (entityConfig.hooks?.onError) {
        entityConfig.hooks.onError(
          err as Error,
          mode === "create" ? "create" : "edit"
        );
      }
    }
  };

  // Render field based on type
  const renderField = (field: FieldConfig) => {
    const value = formData[field.key as string];
    const error = errors[field.key as string];
    const hasError = Boolean(error && touched[field.key as string]);

    // Check visibility
    if (
      typeof field.hidden === "function"
        ? field.hidden(mode, data as T)
        : field.hidden
    ) {
      return null;
    }

    const isFieldDisabled =
      typeof field.disabled === "function"
        ? field.disabled(mode, data as T)
        : field.disabled || isDisabled;

    const isFieldReadOnly =
      typeof field.readOnly === "function"
        ? field.readOnly(mode, data as T)
        : field.readOnly || isReadOnly;

    // Custom render
    if (field.renderForm) {
      return field.renderForm({
        value,
        onChange: (v) => handleFieldChange(field.key as string, v),
        onBlur: () => handleFieldBlur(field.key as string),
        error: hasError ? error : undefined,
        disabled: isFieldDisabled,
        formData,
      });
    }

    const commonProps = {
      fullWidth: true,
      disabled: isFieldDisabled,
      error: hasError,
      helperText: hasError ? error : field.helperText,
      onBlur: () => handleFieldBlur(field.key as string),
      size: "small" as const,
    };

    switch (field.type) {
      case "text":
      case "email":
      case "url":
      case "password":
        return (
          <TextField
            {...commonProps}
            label={field.label}
            type={field.type}
            value={value || ""}
            onChange={(e) =>
              handleFieldChange(field.key as string, e.target.value)
            }
            placeholder={field.placeholder}
            required={field.validation?.required}
          />
        );

      case "number":
        return (
          <TextField
            {...commonProps}
            label={field.label}
            type="number"
            value={value ?? ""}
            onChange={(e) =>
              handleFieldChange(
                field.key as string,
                e.target.value === "" ? "" : Number(e.target.value)
              )
            }
            placeholder={field.placeholder}
            required={field.validation?.required}
            inputProps={{
              min: field.validation?.min,
              max: field.validation?.max,
            }}
          />
        );

      case "textarea":
        return (
          <TextField
            {...commonProps}
            label={field.label}
            multiline
            rows={field.rows || 4}
            value={value || ""}
            onChange={(e) =>
              handleFieldChange(field.key as string, e.target.value)
            }
            placeholder={field.placeholder}
            required={field.validation?.required}
          />
        );

      case "select":
        return (
          <FormControl {...commonProps}>
            <InputLabel>{field.label}</InputLabel>
            <Select
              value={value || ""}
              onChange={(e) =>
                handleFieldChange(field.key as string, e.target.value)
              }
              label={field.label}
              required={field.validation?.required}
              readOnly={isFieldReadOnly}
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

      case "multiselect":
        return (
          <FormControl {...commonProps}>
            <InputLabel>{field.label}</InputLabel>
            <Select
              multiple
              value={Array.isArray(value) ? value : []}
              onChange={(e) =>
                handleFieldChange(field.key as string, e.target.value)
              }
              label={field.label}
              required={field.validation?.required}
              readOnly={isFieldReadOnly}
              renderValue={(selected) => (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {(selected as string[]).map((val) => {
                    const option = field.options?.find((o) => o.value === val);
                    return (
                      <Chip
                        key={val}
                        label={option?.label || val}
                        size="small"
                      />
                    );
                  })}
                </Box>
              )}
            >
              {field.options?.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
            {commonProps.helperText && (
              <FormHelperText>{commonProps.helperText}</FormHelperText>
            )}
          </FormControl>
        );

      case "date":
        return (
          <TextField
            {...commonProps}
            label={field.label}
            type="date"
            value={value || ""}
            onChange={(e) =>
              handleFieldChange(field.key as string, e.target.value)
            }
            InputLabelProps={{ shrink: true }}
            required={field.validation?.required}
            inputProps={{ readOnly: isFieldReadOnly }}
          />
        );

      case "datetime":
        return (
          <TextField
            {...commonProps}
            label={field.label}
            type="datetime-local"
            value={value || ""}
            onChange={(e) =>
              handleFieldChange(field.key as string, e.target.value)
            }
            InputLabelProps={{ shrink: true }}
            required={field.validation?.required}
            inputProps={{ readOnly: isFieldReadOnly }}
          />
        );

      case "boolean":
        return (
          <FormControl {...commonProps} component="fieldset">
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(value)}
                  onChange={(e) =>
                    handleFieldChange(field.key as string, e.target.checked)
                  }
                  disabled={isFieldDisabled}
                  readOnly={isFieldReadOnly}
                />
              }
              label={field.label}
            />
            {commonProps.helperText && (
              <FormHelperText>{commonProps.helperText}</FormHelperText>
            )}
          </FormControl>
        );

      case "json":
        return (
          <TextField
            {...commonProps}
            label={field.label}
            multiline
            rows={field.rows || 6}
            value={
              typeof value === "object"
                ? JSON.stringify(value, null, 2)
                : value || ""
            }
            onChange={(e) => {
              try {
                const jsonValue = e.target.value
                  ? JSON.parse(e.target.value)
                  : null;
                handleFieldChange(field.key as string, jsonValue);
              } catch {
                handleFieldChange(field.key as string, e.target.value);
              }
            }}
            placeholder={field.placeholder || "Enter valid JSON"}
            required={field.validation?.required}
            inputProps={{
              style: { fontFamily: "monospace" },
              readOnly: isFieldReadOnly,
            }}
          />
        );

      case "color":
        return (
          <TextField
            {...commonProps}
            label={field.label}
            type="color"
            value={value || "#000000"}
            onChange={(e) =>
              handleFieldChange(field.key as string, e.target.value)
            }
            InputLabelProps={{ shrink: true }}
            required={field.validation?.required}
            inputProps={{ readOnly: isFieldReadOnly }}
          />
        );

      default:
        return (
          <TextField
            {...commonProps}
            label={field.label}
            value={value || ""}
            onChange={(e) =>
              handleFieldChange(field.key as string, e.target.value)
            }
            placeholder={field.placeholder}
            required={field.validation?.required}
            inputProps={{ readOnly: isFieldReadOnly }}
          />
        );
    }
  };

  // Render form sections
  const renderSections = () => {
    if (!entityConfig.formSections || entityConfig.formSections.length === 0) {
      // Render all fields in a single grid
      return (
        <Grid container spacing={3}>
          {entityConfig.fields.map((field) => (
            <Grid
              item
              xs={12}
              md={field.gridColumn ? Math.min(field.gridColumn * 4, 12) : 12}
              key={field.key as string}
            >
              {renderField(field)}
            </Grid>
          ))}
        </Grid>
      );
    }

    // Render fields in sections
    return entityConfig.formSections.map((section) => (
      <Accordion
        key={section.title}
        expanded={expandedSections[section.title]}
        onChange={(_, expanded) => {
          setExpandedSections((prev) => ({
            ...prev,
            [section.title]: expanded,
          }));
        }}
        defaultExpanded={section.defaultExpanded !== false}
        disabled={!section.collapsible}
        sx={{ mb: 2 }}
      >
        <AccordionSummary
          expandIcon={section.collapsible ? <ExpandMoreIcon /> : null}
          sx={{
            backgroundColor: theme.palette.grey[50],
            "&.Mui-expanded": {
              minHeight: 48,
            },
          }}
        >
          <Box>
            <Typography variant="subtitle1" fontWeight={600}>
              {section.title}
            </Typography>
            {section.description && (
              <Typography variant="caption" color="text.secondary">
                {section.description}
              </Typography>
            )}
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            {section.fields.map((fieldKey) => {
              const field = entityConfig.fields.find((f) => f.key === fieldKey);
              if (!field) return null;
              return (
                <Grid
                  item
                  xs={12}
                  md={
                    field.gridColumn ? Math.min(field.gridColumn * 4, 12) : 12
                  }
                  key={fieldKey}
                >
                  {renderField(field)}
                </Grid>
              );
            })}
          </Grid>
        </AccordionDetails>
      </Accordion>
    ));
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          {mode === "create"
            ? `Create ${entityConfig.name}`
            : mode === "edit"
              ? `Edit ${entityConfig.name}`
              : `${entityConfig.name} Details`}
        </Typography>

        {entityConfig.description && (
          <Typography variant="body2" color="text.secondary">
            {entityConfig.description}
          </Typography>
        )}
      </Box>

      {/* Mode indicator */}
      <Box sx={{ mb: 3 }}>
        <Chip
          icon={
            mode === "edit" ? (
              <EditIcon />
            ) : mode === "view" ? (
              <ViewIcon />
            ) : (
              <AddIcon />
            )
          }
          label={
            mode === "create"
              ? "Creating New"
              : mode === "edit"
                ? "Editing"
                : "View Only"
          }
          color={mode === "view" ? "default" : "primary"}
          size="small"
        />
      </Box>

      {/* Error display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <Paper sx={{ p: 3, mb: 3 }}>{renderSections()}</Paper>

        {/* Actions */}
        {!isReadOnly && (
          <Paper
            sx={{ p: 2, display: "flex", gap: 2, justifyContent: "flex-end" }}
          >
            <Button
              variant="outlined"
              startIcon={<CancelIcon />}
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              startIcon={<SaveIcon />}
              disabled={loading}
              loading={loading}
            >
              {mode === "create" ? "Create" : "Save Changes"}
            </Button>
          </Paper>
        )}
      </form>

      {/* Success message */}
      <Snackbar
        open={showSuccess}
        autoHideDuration={3000}
        onClose={() => setShowSuccess(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert severity="success" onClose={() => setShowSuccess(false)}>
          {mode === "create"
            ? `${entityConfig.name} created successfully`
            : `${entityConfig.name} updated successfully`}
        </Alert>
      </Snackbar>
    </Box>
  );
}

// Helper functions
function transformValueFromApi(value: any, type: string): any {
  if (value === null || value === undefined) return "";

  switch (type) {
    case "date":
      return new Date(value).toISOString().split("T")[0];
    case "datetime":
      return new Date(value).toISOString().slice(0, 16);
    case "json":
      return typeof value === "object" ? JSON.stringify(value, null, 2) : value;
    default:
      return value;
  }
}

function transformDataToApi(
  data: Record<string, any>,
  fields: FieldConfig[]
): Record<string, any> {
  const result: Record<string, any> = {};

  fields.forEach((field) => {
    const value = data[field.key as string];

    switch (field.type) {
      case "date":
      case "datetime":
        result[field.key as string] = value
          ? new Date(value).toISOString()
          : null;
        break;
      case "number":
        result[field.key as string] = value !== "" ? Number(value) : null;
        break;
      case "boolean":
        result[field.key as string] = Boolean(value);
        break;
      case "json":
        try {
          result[field.key as string] =
            typeof value === "string" ? JSON.parse(value) : value;
        } catch {
          result[field.key as string] = value;
        }
        break;
      default:
        result[field.key as string] = value;
    }
  });

  return result;
}

function getDefaultValueForType(type: string): any {
  switch (type) {
    case "text":
    case "email":
    case "url":
    case "password":
    case "textarea":
    case "date":
    case "datetime":
    case "color":
      return "";
    case "number":
      return "";
    case "boolean":
      return false;
    case "select":
      return "";
    case "multiselect":
      return [];
    case "json":
      return "{}";
    default:
      return "";
  }
}

export default EntityForm;
