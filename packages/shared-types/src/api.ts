// ============================================================================
// API Response Envelope Types
// Shared contract between frontend API modules and backend controllers
// ============================================================================

/** Standard paginated response wrapper */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

/** Standard API error response */
export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  error?: string;
  timestamp?: string;
  path?: string;
}

/** Standard API success response for mutations */
export interface ApiSuccessResponse<T = void> {
  success: boolean;
  message?: string;
  data?: T;
}

/** Sort direction */
export type SortDirection = 'asc' | 'desc';

/** Base query params for list endpoints */
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDirection?: SortDirection;
}

/** Date range filter */
export interface DateRangeFilter {
  startDate?: string;
  endDate?: string;
}
