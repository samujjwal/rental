import React from "react";
import { useForm, type FormOptions } from "@tanstack/react-form";
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Button,
  Typography,
  Paper,
  Alert,
  Snackbar,
  Chip,
  FormHelperText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Add as AddIcon,
  ExpandMore as ExpandMoreIcon,
} from "@mui/icons-material";

// Field configuration types
interface FieldConfig {
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
    | "url";
  required?: boolean;
  placeholder?: string;
  helperText?: string;
  options?: Array<{ value: string; label: string; disabled?: boolean }>;
  multiple?: boolean;
  multiline?: boolean;
  rows?: number;
  defaultValue?: any;
  disabled?: boolean;
  gridColumn?: number; // 1-12 for Material-UI grid
  section?: string;
}

interface FormSection {
  title: string;
  description?: string;
  fields: string[];
  defaultExpanded?: boolean;
  collapsible?: boolean;
}

interface ModernTanStackFormProps<T extends Record<string, any>> {
  mode: "create" | "edit" | "view";
  fields: FieldConfig[];
  sections?: FormSection[];
  initialValues?: Partial<T>;
  onSubmit: (values: T) => Promise<void> | void;
  onCancel: () => void;
  loading?: boolean;
  error?: string | null;
  title?: string;
  description?: string;
  submitText?: string;
  cancelText?: string;
  disabled?: boolean;
  className?: string;
}

export function ModernTanStackForm<T extends Record<string, any>>({
  mode,
  fields,
  sections,
  initialValues,
  onSubmit,
  onCancel,
  loading = false,
  error,
  title,
  description,
  submitText,
  cancelText,
  disabled = false,
  className,
}: ModernTanStackFormProps<T>) {
  const [showSuccess, setShowSuccess] = React.useState(false);
  const isReadOnly = mode === "view";
  const isDisabled = loading || disabled || isReadOnly;

  // Create form instance
  const form = useForm({
    defaultValues: (initialValues || {}) as T,
    onSubmit: async ({ value }) => {
      try {
        await onSubmit(value);
        setShowSuccess(true);
        if (mode === "create") {
          form.reset();
        }
      } catch (err) {
        console.error("Form submission failed:", err);
      }
    },
  });

  // Render field based on configuration
  const renderField = (fieldConfig: FieldConfig) => {
    const isFieldDisabled = isDisabled || fieldConfig.disabled;

    const commonProps = {
      label: fieldConfig.label,
      placeholder: fieldConfig.placeholder,
      disabled: isFieldDisabled,
      required: fieldConfig.required,
      helperText: fieldConfig.helperText,
      size: "small" as const,
      fullWidth: true,
    };

    switch (fieldConfig.type) {
      case "textarea":
        return (
          <Box
            key={fieldConfig.name}
            sx={{
              flex: `1 1 ${fieldConfig.gridColumn ? Math.min(fieldConfig.gridColumn * 4, 12) * 8.33 : 100}%`,
              minWidth: 0,
            }}
          >
            <form.Field name={fieldConfig.name as any}>
              {(fieldApi) => (
                <TextField
                  {...commonProps}
                  multiline
                  rows={fieldConfig.rows || 4}
                  value={fieldApi.state.value ?? ""}
                  onChange={(e) => fieldApi.handleChange(e.target.value as any)}
                  onBlur={() => fieldApi.handleBlur()}
                  error={!!fieldApi.state.meta.errors?.length}
                  helperText={
                    commonProps.helperText || fieldApi.state.meta.errors?.[0]
                  }
                />
              )}
            </form.Field>
          </Box>
        );

      case "number":
        return (
          <Box
            key={fieldConfig.name}
            sx={{
              flex: `1 1 ${fieldConfig.gridColumn ? Math.min(fieldConfig.gridColumn * 4, 12) * 8.33 : 100}%`,
              minWidth: 0,
            }}
          >
            <form.Field name={fieldConfig.name as any}>
              {(fieldApi) => (
                <TextField
                  {...commonProps}
                  type="number"
                  value={fieldApi.state.value ?? ""}
                  onChange={(e) =>
                    fieldApi.handleChange(
                      e.target.value === ""
                        ? ""
                        : (Number(e.target.value) as any)
                    )
                  }
                  onBlur={() => fieldApi.handleBlur()}
                  error={!!fieldApi.state.meta.errors?.length}
                  helperText={
                    commonProps.helperText || fieldApi.state.meta.errors?.[0]
                  }
                />
              )}
            </form.Field>
          </Box>
        );

      case "select":
        return (
          <Box
            key={fieldConfig.name}
            sx={{
              flex: `1 1 ${fieldConfig.gridColumn ? Math.min(fieldConfig.gridColumn * 4, 12) * 8.33 : 100}%`,
              minWidth: 0,
            }}
          >
            <form.Field name={fieldConfig.name as any}>
              {(fieldApi) => (
                <FormControl
                  fullWidth
                  size="small"
                  disabled={isFieldDisabled}
                  required={fieldConfig.required}
                >
                  <InputLabel>{fieldConfig.label}</InputLabel>
                  <Select
                    value={
                      fieldApi.state.value ?? (fieldConfig.multiple ? [] : "")
                    }
                    onChange={(e) =>
                      fieldApi.handleChange(e.target.value as any)
                    }
                    onBlur={() => fieldApi.handleBlur()}
                    multiple={fieldConfig.multiple}
                    displayEmpty
                    renderValue={
                      fieldConfig.multiple
                        ? (selected) => (
                            <Box
                              sx={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 0.5,
                              }}
                            >
                              {(selected as string[]).map((value) => {
                                const option = fieldConfig.options?.find(
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
                            const option = fieldConfig.options?.find(
                              (opt) => opt.value === selected
                            );
                            return option?.label || String(selected);
                          }
                    }
                  >
                    {fieldConfig.options?.map((option) => (
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
              )}
            </form.Field>
          </Box>
        );

      case "boolean":
        return (
          <Box
            key={fieldConfig.name}
            sx={{
              flex: `1 1 ${fieldConfig.gridColumn ? Math.min(fieldConfig.gridColumn * 4, 12) * 8.33 : 100}%`,
              minWidth: 0,
            }}
          >
            <form.Field name={fieldConfig.name as any}>
              {(fieldApi) => (
                <FormControlLabel
                  control={
                    <Switch
                      checked={Boolean(fieldApi.state.value)}
                      onChange={(e) =>
                        fieldApi.handleChange(e.target.checked as any)
                      }
                      disabled={isFieldDisabled}
                      size="small"
                    />
                  }
                  label={fieldConfig.label}
                />
              )}
            </form.Field>
          </Box>
        );

      case "date":
        return (
          <Box
            key={fieldConfig.name}
            sx={{
              flex: `1 1 ${fieldConfig.gridColumn ? Math.min(fieldConfig.gridColumn * 4, 12) * 8.33 : 100}%`,
              minWidth: 0,
            }}
          >
            <form.Field name={fieldConfig.name as any}>
              {(fieldApi) => {
                // Format date for input (yyyy-MM-dd)
                const formatDateForInput = (dateValue: any) => {
                  if (!dateValue) return "";
                  if (typeof dateValue === "string") {
                    // Handle ISO dates and other formats
                    const date = new Date(dateValue);
                    if (isNaN(date.getTime())) return dateValue; // Return as-is if invalid
                    return date.toISOString().split("T")[0];
                  }
                  return dateValue;
                };

                return (
                  <TextField
                    {...commonProps}
                    type="date"
                    value={formatDateForInput(fieldApi.state.value)}
                    onChange={(e) =>
                      fieldApi.handleChange(e.target.value as any)
                    }
                    onBlur={() => fieldApi.handleBlur()}
                    label={fieldConfig.label}
                    InputLabelProps={{ shrink: true }}
                  />
                );
              }}
            </form.Field>
          </Box>
        );

      case "email":
      case "url":
      default:
        return (
          <Box
            key={fieldConfig.name}
            sx={{
              flex: `1 1 ${fieldConfig.gridColumn ? Math.min(fieldConfig.gridColumn * 4, 12) * 8.33 : 100}%`,
              minWidth: 0,
            }}
          >
            <form.Field name={fieldConfig.name as any}>
              {(fieldApi) => (
                <TextField
                  {...commonProps}
                  type={fieldConfig.type}
                  value={fieldApi.state.value ?? ""}
                  onChange={(e) => fieldApi.handleChange(e.target.value as any)}
                  onBlur={() => fieldApi.handleBlur()}
                  error={!!fieldApi.state.meta.errors?.length}
                  helperText={
                    commonProps.helperText || fieldApi.state.meta.errors?.[0]
                  }
                />
              )}
            </form.Field>
          </Box>
        );
    }
  };

  // Group fields by section
  const fieldsBySection = React.useMemo(() => {
    if (!sections || sections.length === 0) {
      return { "": fields };
    }

    const grouped: Record<string, FieldConfig[]> = {};

    // Initialize sections
    sections.forEach((section) => {
      grouped[section.title] = [];
    });

    // Add fields to sections
    fields.forEach((field) => {
      const sectionTitle = field.section || "";
      if (!grouped[sectionTitle]) {
        grouped[sectionTitle] = [];
      }
      grouped[sectionTitle].push(field);
    });

    return grouped;
  }, [fields, sections]);

  // Render form sections
  const renderSections = () => {
    const sectionEntries = Object.entries(fieldsBySection);

    if (sectionEntries.length === 1 && !sectionEntries[0][0]) {
      // Single section without grouping
      return (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
          {sectionEntries[0][1].map(renderField)}
        </Box>
      );
    }

    // Multiple sections with accordions
    return sectionEntries.map(([sectionTitle, sectionFields]) => {
      const sectionConfig = sections?.find((s) => s.title === sectionTitle);

      if (!sectionConfig) {
        return (
          <Box key={sectionTitle} sx={{ mb: 3 }}>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
              {sectionFields.map(renderField)}
            </Box>
          </Box>
        );
      }

      return (
        <Accordion
          key={sectionTitle}
          defaultExpanded={sectionConfig.defaultExpanded !== false}
          disabled={!sectionConfig.collapsible}
          sx={{ mb: 2 }}
        >
          <AccordionSummary
            expandIcon={sectionConfig.collapsible ? <ExpandMoreIcon /> : null}
            sx={{
              backgroundColor: "grey.50",
              "&.Mui-expanded": {
                minHeight: 48,
              },
            }}
          >
            <Box>
              <Typography variant="subtitle1" fontWeight={600}>
                {sectionTitle}
              </Typography>
              {sectionConfig.description && (
                <Typography variant="caption" color="text.secondary">
                  {sectionConfig.description}
                </Typography>
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
              {sectionFields.map(renderField)}
            </Box>
          </AccordionDetails>
        </Accordion>
      );
    });
  };

  return (
    <Box className={className}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          {title ||
            `${mode === "create" ? "Create" : mode === "edit" ? "Edit" : "View"} Item`}
        </Typography>

        {description && (
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        )}

        {/* Mode indicator */}
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
          sx={{ mt: 1 }}
        />
      </Box>

      {/* Error display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Form */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          {renderSections()}

          {/* Actions */}
          {!isReadOnly && (
            <Box
              sx={{
                mt: 3,
                display: "flex",
                gap: 2,
                justifyContent: "flex-end",
              }}
            >
              <Button
                variant="outlined"
                startIcon={<CancelIcon />}
                onClick={onCancel}
                disabled={loading}
              >
                {cancelText || "Cancel"}
              </Button>
              <Button
                type="submit"
                variant="contained"
                startIcon={<SaveIcon />}
                disabled={loading}
              >
                {loading
                  ? "Saving..."
                  : submitText || (mode === "create" ? "Create" : "Save")}
              </Button>
            </Box>
          )}
        </form>
      </Paper>

      {/* Success message */}
      <Snackbar
        open={showSuccess}
        autoHideDuration={3000}
        onClose={() => setShowSuccess(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert severity="success" onClose={() => setShowSuccess(false)}>
          {mode === "create"
            ? "Item created successfully"
            : "Item updated successfully"}
        </Alert>
      </Snackbar>
    </Box>
  );
}
