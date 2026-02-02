/**
 * Generic Admin Framework
 *
 * A modern, data-driven approach for building admin interfaces.
 * Inspired by the gharbatai admin portal's schema-driven architecture,
 * but enhanced with modern React patterns, TypeScript, and better extensibility.
 */

import type { MRT_ColumnDef } from "material-react-table";
import type { ReactNode } from "react";
import { Chip } from "@mui/material";

type UnknownRecord = Record<string, unknown>;

// ============================================================================
// Core Types
// ============================================================================

export type FieldType =
  | "text"
  | "email"
  | "number"
  | "select"
  | "textarea"
  | "date"
  | "datetime"
  | "boolean"
  | "json"
  | "password"
  | "url"
  | "color"
  | "file"
  | "multiselect"
  | "reference";
export type ActionType = "create" | "edit" | "view" | "delete" | "custom";
export type ViewMode = "table" | "form" | "detail" | "kanban" | "calendar";

export type FormMode = "create" | "edit" | "view";

export interface ValidationRule {
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  email?: boolean;
  url?: boolean;
  custom?: (value: unknown, formData: Record<string, unknown>) => string | null;
  message?: string;
}

export interface FieldConfig<T extends object = Record<string, unknown>> {
  key: keyof T | string;
  label: string;
  type: FieldType;
  description?: string;
  placeholder?: string;
  helperText?: string;
  defaultValue?: unknown;
  validation?: ValidationRule;

  // Select/Multiselect options
  options?: Array<{ value: string; label: string; disabled?: boolean }>;

  // Reference field for relationships
  reference?: {
    entity: string;
    displayField: string;
    valueField: string;
    filter?: Record<string, unknown>;
  };

  // UI configuration
  hidden?: boolean | ((mode: FormMode, data: T) => boolean);
  disabled?: boolean | ((mode: FormMode, data: T) => boolean);
  readOnly?: boolean | ((mode: FormMode, data: T) => boolean);

  // Layout
  gridColumn?: number; // Number of columns to span (1-12)
  order?: number;
  rows?: number; // Number of rows for textarea fields

  // Custom rendering
  render?: (value: unknown, record: T, mode: FormMode) => ReactNode;
  renderForm?: (props: {
    value: unknown;
    onChange: (value: unknown) => void;
    onBlur: () => void;
    error?: string;
    disabled?: boolean;
    formData: Record<string, unknown>;
  }) => ReactNode;
}

export interface FilterConfig<T extends object = Record<string, unknown>> {
  key: keyof T | string;
  label: string;
  type: FieldType;
  operator:
    | "eq"
    | "neq"
    | "gt"
    | "gte"
    | "lt"
    | "lte"
    | "contains"
    | "startsWith"
    | "endsWith"
    | "in"
    | "between";
  options?: Array<{ value: string; label: string }>;
  defaultValue?: unknown;
}

export interface BulkAction<T = UnknownRecord> {
  id: string;
  label: string;
  icon?: ReactNode;
  color?: "primary" | "secondary" | "success" | "error" | "warning" | "info";
  variant?: "contained" | "outlined" | "text";
  requiresSelection?: boolean;
  confirmation?: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
  };
  handler: (
    selectedIds: string[],
    selectedRecords: T[]
  ) => Promise<void> | void;
  visible?: (records: T[]) => boolean;
}

export interface RowAction<T extends object = Record<string, unknown>> {
  id: string;
  label: string;
  icon?: ReactNode;
  color?: "primary" | "secondary" | "success" | "error" | "warning" | "info";
  visible?: (record: T) => boolean;
  disabled?: (record: T) => boolean;
  confirmation?: {
    title: string;
    message: string | ((record: T) => string);
    confirmLabel?: string;
    cancelLabel?: string;
  };
  handler: (record: T) => Promise<void> | void;
}

export interface RelatedSection<T extends object = Record<string, unknown>> {
  id: string;
  title: string;
  entity: string;
  foreignKey: string;
  columns: Array<{
    key: string;
    label: string;
    render?: (value: unknown, row: T) => ReactNode;
  }>;
  actions?: RowAction<T>[];
  emptyMessage?: string;
  fetchData: (parentId: string) => Promise<T[]>;
}

export interface StatConfig<T extends object = Record<string, unknown>> {
  id: string;
  label: string;
  value: string | number | ((data: T[]) => string | number);
  change?: {
    value: number;
    label?: string;
    type: "increase" | "decrease" | "neutral";
  };
  color: "primary" | "secondary" | "success" | "error" | "warning" | "info";
  icon?: ReactNode;
  format?: "number" | "currency" | "percentage" | "date";
  currency?: string;
}

export interface PaginationConfig {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface SortConfig {
  field: string;
  direction: "asc" | "desc";
}

export interface TableState {
  pagination: PaginationConfig;
  sorting: SortConfig[];
  filters: Record<string, unknown>;
  search: string;
  selectedIds: string[];
}

// ============================================================================
// Entity Configuration
// ============================================================================

export interface EntityConfig<T extends object = Record<string, unknown>> {
  // Identification
  name: string;
  pluralName: string;
  slug: string;
  description?: string;
  icon?: ReactNode;

  // API Configuration
  api: {
    baseEndpoint: string;
    listEndpoint?: string;
    createEndpoint?: string;
    updateEndpoint?: (id: string) => string;
    deleteEndpoint?: (id: string) => string;
    getEndpoint?: (id: string) => string;
  };

  // Data Configuration
  fields: FieldConfig<T>[];
  filters?: FilterConfig<T>[];

  // Table Configuration
  columns: MRT_ColumnDef<T>[];
  defaultSort?: SortConfig;
  defaultPageSize?: number;
  pageSizeOptions?: number[];
  enableRowSelection?: boolean;
  enableColumnFilters?: boolean;
  enableGlobalFilter?: boolean;
  enableSorting?: boolean;
  enablePagination?: boolean;
  enableExport?: boolean;

  // Form Configuration
  formLayout?: "single" | "double" | "triple" | "custom";
  formSections?: Array<{
    title: string;
    description?: string;
    fields: string[]; // Field keys
    collapsible?: boolean;
    defaultExpanded?: boolean;
  }>;

  // Actions
  bulkActions?: BulkAction<T>[];
  rowActions?: RowAction<T>[];

  // Related Data
  relatedSections?: RelatedSection<T>[];

  // Stats
  stats?: StatConfig<T>[];

  // Permissions
  permissions?: {
    create?: boolean | (() => boolean);
    read?: boolean | (() => boolean);
    update?: boolean | (() => boolean);
    delete?: boolean | (() => boolean);
    export?: boolean | (() => boolean);
  };

  // Hooks
  hooks?: {
    beforeCreate?: (data: Partial<T>) => Promise<Partial<T>> | Partial<T>;
    afterCreate?: (data: T) => Promise<void> | void;
    beforeUpdate?: (
      id: string,
      data: Partial<T>
    ) => Promise<Partial<T>> | Partial<T>;
    afterUpdate?: (data: T) => Promise<void> | void;
    beforeDelete?: (id: string) => Promise<boolean> | boolean;
    afterDelete?: (id: string) => Promise<void> | void;
    onError?: (error: Error, action: ActionType) => void;
  };

  // Transformers
  transformers?: {
    list?: (data: UnknownRecord[]) => T[];
    detail?: (data: UnknownRecord) => T;
    create?: (data: Partial<T>) => UnknownRecord;
    update?: (data: Partial<T>) => UnknownRecord;
  };
}

// ============================================================================
// Registry
// ============================================================================

class EntityRegistry {
  private entities: Map<string, EntityConfig<UnknownRecord>> = new Map();

  register<T extends object>(config: EntityConfig<T>): void {
    this.entities.set(config.slug, config as EntityConfig<UnknownRecord>);
  }

  get<T extends object>(slug: string): EntityConfig<T> | undefined {
    return this.entities.get(slug) as EntityConfig<T> | undefined;
  }

  getAll(): EntityConfig<UnknownRecord>[] {
    return Array.from(this.entities.values());
  }

  has(slug: string): boolean {
    return this.entities.has(slug);
  }

  unregister(slug: string): boolean {
    return this.entities.delete(slug);
  }
}

export const entityRegistry = new EntityRegistry();

// ============================================================================
// Helper Functions
// ============================================================================

export function createEntityConfig<T extends object>(
  config: EntityConfig<T>
): EntityConfig<T> {
  return config;
}

export function registerEntity<T extends object>(config: EntityConfig<T>): void {
  entityRegistry.register(config);
}

export function getEntityConfig<T extends object>(slug: string): EntityConfig<T> | undefined {
  return entityRegistry.get<T>(slug);
}

// ============================================================================
// Default Column Generators
// ============================================================================

export function createIdColumn<T extends object>(): MRT_ColumnDef<T> {
  return {
    accessorKey: "id" as string & {},
    header: "ID",
    size: 80,
    enableSorting: true,
  } as MRT_ColumnDef<T>;
}

export function createStatusColumn<T extends object>(
  accessorKey: string = "status",
  options?: {
    label?: string;
    colorMap?: Record<
      string,
      "success" | "error" | "warning" | "info" | "default"
    >;
  }
): MRT_ColumnDef<T> {
  const colorMap = options?.colorMap || {
    ACTIVE: "success",
    ENABLED: "success",
    VERIFIED: "success",
    COMPLETED: "success",
    PENDING: "warning",
    PROCESSING: "warning",
    PENDING_REVIEW: "warning",
    INACTIVE: "default",
    DISABLED: "default",
    FAILED: "error",
    CANCELLED: "error",
    BANNED: "error",
  };

  return {
    accessorKey: accessorKey as string & {},
    header: options?.label || "Status",
    size: 120,
    Cell: ({ row }) => {
      const original = row.original as Record<string, unknown>;
      const rawValue = original[accessorKey];
      const displayValue =
        typeof rawValue === "string" ? rawValue : String(rawValue ?? "");
      const color = colorMap[displayValue] || "default";
      return <Chip label={displayValue} color={color} size="small" />;
    },
  } as MRT_ColumnDef<T>;
}

export function createDateColumn<T extends object>(
  accessorKey: string = "createdAt",
  options?: { label?: string; format?: "date" | "datetime" | "relative" }
): MRT_ColumnDef<T> {
  return {
    accessorKey: accessorKey as string & {},
    header: options?.label || "Created",
    size: 150,
    Cell: ({ row }) => {
      const original = row.original as Record<string, unknown>;
      const value = original[accessorKey] as string | undefined;
      if (!value) return "-";

      const date = new Date(value);

      switch (options?.format) {
        case "datetime":
          return date.toLocaleString();
        case "relative":
          return getRelativeTime(date);
        case "date":
        default:
          return date.toLocaleDateString();
      }
    },
  };
}

export function createActionsColumn<T extends object>(
  _actions: RowAction<T>[]
): MRT_ColumnDef<T> {
  return {
    id: "actions",
    header: "Actions",
    size: 120,
    enableSorting: false,
    enableColumnFilter: false,
  } as MRT_ColumnDef<T>;
}

// ============================================================================
// Utility Functions
// ============================================================================

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 30) return date.toLocaleDateString();
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}

export function validateField<T extends object>(
  field: FieldConfig<T>,
  value: unknown,
  formData: Record<string, unknown>
): string | null {
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
    case "email": {
      if (validation.email !== false) {
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const stringValue =
          typeof value === "string" ? value : String(value ?? "");
        if (!emailPattern.test(stringValue)) {
          return validation.message || "Please enter a valid email address";
        }
      }
      break;
    }

    case "url": {
      if (validation.url !== false) {
        try {
          new URL(String(value ?? ""));
        } catch {
          return validation.message || "Please enter a valid URL";
        }
      }
      break;
    }

    case "number": {
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
    }

    case "text":
    case "textarea": {
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
  }

  // Custom validation
  if (validation.custom) {
    return validation.custom(value, formData);
  }

  return null;
}

export function transformFormData<T extends object = Record<string, unknown>>(
  fields: FieldConfig<T>[],
  data: Record<string, unknown>,
  direction: "toApi" | "fromApi"
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  fields.forEach((field) => {
    const value = data[field.key as string];

    if (direction === "toApi") {
      // Transform from form to API
      switch (field.type) {
        case "date": {
          const dateInput =
            typeof value === "string" || typeof value === "number" || value instanceof Date
              ? value
              : String(value ?? "");
          result[field.key as string] = value
            ? new Date(dateInput).toISOString()
            : null;
          break;
        }
        case "datetime": {
          const dateInput =
            typeof value === "string" || typeof value === "number" || value instanceof Date
              ? value
              : String(value ?? "");
          result[field.key as string] = value
            ? new Date(dateInput).toISOString()
            : null;
          break;
        }
          break;
        case "number":
          result[field.key as string] = value !== "" ? Number(value) : null;
          break;
        case "boolean":
          result[field.key as string] = Boolean(value);
          break;
        case "json":
          result[field.key as string] =
            typeof value === "string" ? JSON.parse(value) : value;
          break;
        default:
          result[field.key as string] = value;
      }
    } else {
      // Transform from API to form
      switch (field.type) {
        case "date": {
          const dateInput =
            typeof value === "string" || typeof value === "number" || value instanceof Date
              ? value
              : String(value ?? "");
          result[field.key as string] = value
            ? new Date(dateInput).toISOString().split("T")[0]
            : "";
          break;
        }
        case "datetime": {
          const dateInput =
            typeof value === "string" || typeof value === "number" || value instanceof Date
              ? value
              : String(value ?? "");
          result[field.key as string] = value
            ? new Date(dateInput).toISOString().slice(0, 16)
            : "";
          break;
        }
          break;
        case "json":
          result[field.key as string] =
            typeof value === "object" ? JSON.stringify(value, null, 2) : value;
          break;
        default:
          result[field.key as string] = value;
      }
    }
  });

  return result;
}

// ============================================================================
// Export Types for Components
// ============================================================================

export interface GenericAdminPageProps {
  entitySlug: string;
  initialView?: ViewMode;
}

export interface GenericDataTableProps<T extends object = Record<string, unknown>> {
  entityConfig: EntityConfig<T>;
  data: T[];
  loading?: boolean;
  error?: string | null;
  state: TableState;
  onStateChange: (state: Partial<TableState>) => void;
  onCreate?: () => void;
  onEdit?: (record: T) => void;
  onView?: (record: T) => void;
  onDelete?: (record: T) => void;
}

export interface GenericDataFormProps<T extends object = Record<string, unknown>> {
  entityConfig: EntityConfig<T>;
  mode: "create" | "edit" | "view";
  data?: T;
  loading?: boolean;
  error?: string | null;
  onSubmit: (data: Partial<T>) => Promise<void> | void;
  onCancel: () => void;
}

export interface GenericDetailViewProps<T extends object = Record<string, unknown>> {
  entityConfig: EntityConfig<T>;
  data: T;
  loading?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onBack: () => void;
}
