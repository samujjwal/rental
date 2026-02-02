/**
 * Core types for the admin system
 * Provides type safety and consistency across all admin components
 */

// ============================================================================
// Base Types
// ============================================================================

export type SortDirection = "asc" | "desc";
export type SortState<T> = {
  key: keyof T;
  direction: SortDirection;
};

export type PaginationState = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type FilterValue =
  | string
  | number
  | boolean
  | string[]
  | { from?: string; to?: string };
export type FilterState = Record<string, FilterValue>;

// ============================================================================
// Data Table Types
// ============================================================================

export interface Column<T extends Record<string, any>> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
  width?: string;
  minWidth?: string;
  maxWidth?: string;
  align?: "left" | "center" | "right";
  className?: string;
  headerClassName?: string;
  cellClassName?: string;
  searchable?: boolean;
  filterable?: boolean;
  resizable?: boolean;
  pinned?: "left" | "right";
}

export interface Action<T> {
  id: string;
  label: string | ((row: T) => string);
  icon?: React.ReactNode | ((row: T) => React.ReactNode);
  onClick?: (row: T, event?: React.MouseEvent) => void | Promise<void>;
  to?: string | ((row: T) => string);
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
  disabled?: boolean | ((row: T) => boolean);
  show?: (row: T) => boolean;
  className?: string;
  tooltip?: string | ((row: T) => string);
  confirm?: {
    title: string | ((row: T) => string);
    message: string | ((row: T) => string);
    confirmText?: string;
    cancelText?: string;
  };
  loading?: boolean | ((row: T) => boolean);
}

export interface StatCard {
  id: string;
  label: string;
  value: string | number;
  change?: {
    value: string;
    type: "increase" | "decrease" | "neutral";
    period?: string;
  };
  color?: "blue" | "green" | "yellow" | "red" | "purple" | "gray";
  icon?: React.ReactNode;
  loading?: boolean;
  error?: string;
  onClick?: () => void;
}

export interface EmptyState {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
    variant?: "default" | "outline";
  };
  illustration?: string; // URL to illustration image
}

export interface LoadingState {
  message?: string;
  skeleton?: boolean;
  overlay?: boolean;
}

export interface ErrorState {
  title?: string;
  message: string;
  code?: string | number;
  retry?: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// ============================================================================
// Filter Types
// ============================================================================

export interface FilterField {
  key: string;
  label: string;
  type:
    | "text"
    | "select"
    | "multiselect"
    | "date"
    | "daterange"
    | "number"
    | "boolean"
    | "search";
  options?: Array<{
    value: string;
    label: string;
    disabled?: boolean;
    group?: string;
  }>;
  placeholder?: string;
  defaultValue?: FilterValue;
  validation?: {
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    custom?: (value: FilterValue) => string | null;
  };
  dependencies?: Array<{
    field: string;
    condition: (value: FilterValue, dependentValue: FilterValue) => boolean;
    action?: "show" | "hide" | "enable" | "disable";
  }>;
  searchable?: boolean;
  clearable?: boolean;
  loading?: boolean;
  error?: string;
  description?: string;
  icon?: React.ReactNode;
  group?: string;
  order?: number;
}

export interface FilterGroup {
  id: string;
  title: string;
  description?: string;
  fields: FilterField[];
  expanded?: boolean;
  collapsible?: boolean;
  className?: string;
  order?: number;
}

// ============================================================================
// Admin Layout Types
// ============================================================================

export interface BreadcrumbItem {
  label: string;
  href?: string;
  active?: boolean;
  disabled?: boolean;
}

export interface PageAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void | Promise<void>;
  to?: string;
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  tooltip?: string;
  badge?: string | number;
  className?: string;
}

export interface AdminPageConfig {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: PageAction[];
  stats?: StatCard[];
  headerActions?: React.ReactNode;
  loading?: boolean;
  error?: string;
  className?: string;
  containerClassName?: string;
}

// ============================================================================
// API Types
// ============================================================================

export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  success: boolean;
  errors?: string[];
  warnings?: string[];
  meta?: {
    pagination?: PaginationState;
    filters?: FilterState;
    sort?: SortState<any>;
    stats?: Record<string, any>;
  };
}

export interface ApiError {
  code: string | number;
  message: string;
  details?: Record<string, any>;
  stack?: string;
  timestamp: string;
}

// ============================================================================
// Hook Types
// ============================================================================

export interface UseDataTableOptions<T extends Record<string, any>> {
  data: T[];
  columns: Column<T>[];
  actions?: Action<T>[];
  filters?: FilterField[];
  stats?: StatCard[];
  pagination?: Partial<PaginationState>;
  sorting?: Partial<SortState<T>>;
  selection?: {
    enabled?: boolean;
    multiple?: boolean;
    preserveSelection?: boolean;
  };
  onRowClick?: (row: T, event: React.MouseEvent) => void;
  onSelectionChange?: (selectedIds: string[], selectedRows: T[]) => void;
  onFiltersChange?: (filters: FilterState) => void;
  onSortChange?: (sort: SortState<T>) => void;
  onPageChange?: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  initialFilters?: FilterState;
  initialSort?: SortState<T>;
  initialPage?: number;
  initialLimit?: number;
  debounceMs?: number;
  virtualScrolling?: boolean;
  rowHeight?: number;
  maxHeight?: number;
}

export interface UseDataTableReturn<T> {
  // Data
  data: T[];
  filteredData: T[];
  sortedData: T[];
  paginatedData: T[];

  // State
  filters: FilterState;
  sort: SortState<T>;
  pagination: PaginationState;
  selectedIds: Set<string>;
  selectedRows: T[];

  // Loading states
  loading: boolean;
  filtering: boolean;
  sorting: boolean;

  // Actions
  setFilters: (filters: FilterState) => void;
  setSort: (sort: SortState<T>) => void;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  toggleRowSelection: (id: string) => void;
  selectAllRows: () => void;
  clearSelection: () => void;
  resetFilters: () => void;

  // Computed
  isAllSelected: boolean;
  isIndeterminate: boolean;
  hasActiveFilters: boolean;
  totalPages: number;

  // Event handlers
  handleFilterChange: (key: string, value: FilterValue) => void;
  handleSort: (key: keyof T) => void;
  handleRowClick: (row: T, event: React.MouseEvent) => void;
}

// ============================================================================
// Component Props Types
// ============================================================================

export interface DataTableProps<T extends Record<string, any>> extends Omit<
  UseDataTableOptions<T>,
  "maxHeight"
> {
  className?: string;
  tableClassName?: string;
  headerClassName?: string;
  bodyClassName?: string;
  rowClassName?: string | ((row: T, index: number) => string);
  cellClassName?: string | ((column: Column<T>, row: T, value: any) => string);
  emptyState?: EmptyState;
  loadingState?: LoadingState;
  errorState?: ErrorState;
  showHeader?: boolean;
  showFooter?: boolean;
  showPagination?: boolean;
  showFilters?: boolean;
  showStats?: boolean;
  stickyHeader?: boolean;
  striped?: boolean;
  hoverable?: boolean;
  compact?: boolean;
  borderless?: boolean;
  resizable?: boolean;
  virtualScrolling?: boolean;
  height?: string | number;
  maxHeight?: string | number;
  minWidth?: string | number;
  "aria-label"?: string;
  "aria-describedby"?: string;
}

export interface GenericFiltersProps {
  groups: FilterGroup[];
  initialFilters?: FilterState;
  onFiltersChange?: (filters: FilterState) => void;
  onReset?: () => void;
  onClear?: (key: string) => void;
  showActiveFilters?: boolean;
  showReset?: boolean;
  showClearAll?: boolean;
  collapsible?: boolean;
  className?: string;
  loading?: boolean;
  disabled?: boolean;
  debounceMs?: number;
  "aria-label"?: string;
}

export interface AdminPageLayoutProps extends AdminPageConfig {
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  padding?: "sm" | "md" | "lg" | "xl";
  sidebar?: React.ReactNode;
  footer?: React.ReactNode;
  showBreadcrumb?: boolean;
  showHeader?: boolean;
  showStats?: boolean;
}

// ============================================================================
// Utility Types
// ============================================================================

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type OptionalFields<T, K extends keyof T> = Omit<T, K> &
  Partial<Pick<T, K>>;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type EventHandler<T = void> = (event: T) => void;
export type AsyncEventHandler<T = void> = (event: T) => Promise<void>;

export type ComponentWithRef<T, P = Record<string, unknown>> =
  React.ForwardRefExoticComponent<
  P & React.RefAttributes<T>
>;

export type CreateComponentProps<T> = {
  [K in keyof T]: T[K];
} & {
  className?: string;
  children?: React.ReactNode;
};

// ============================================================================
// Theme Types
// ============================================================================

export type ColorVariant =
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "error"
  | "info";
export type SizeVariant = "xs" | "sm" | "md" | "lg" | "xl";
export type Variant =
  | "default"
  | "outline"
  | "ghost"
  | "destructive"
  | "secondary";

export interface ThemeColors {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  gray: string;
}

export interface ThemeConfig {
  colors: ThemeColors;
  borderRadius: string;
  fontSize: Record<SizeVariant, string>;
  spacing: Record<SizeVariant, string>;
  breakpoints: Record<SizeVariant, string>;
}

// ============================================================================
// Export All Types
// ============================================================================

export type {
  // Re-export commonly used external types
  ReactNode,
  ComponentType,
  MouseEvent,
  ChangeEvent,
  FocusEvent,
  KeyboardEvent,
} from "react";
