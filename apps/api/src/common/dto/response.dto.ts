/**
 * Standard Response DTOs
 * 
 * Provides consistent response structures across all API endpoints.
 * Ensures web and mobile clients consume predictable contracts.
 */

import { ApiProperty } from '@nestjs/swagger';

/**
 * Standard pagination response wrapper
 */
export class PaginatedResponseDto<T> {
  @ApiProperty({ description: 'Array of items' })
  data: T[];

  @ApiProperty({ description: 'Total number of items matching the query' })
  total: number;

  @ApiProperty({ description: 'Current page number (1-indexed)' })
  page: number;

  @ApiProperty({ description: 'Number of items per page' })
  limit: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages: number;

  @ApiProperty({ description: 'Whether there are more items after this page' })
  hasMore: boolean;

  @ApiProperty({ description: 'Cursor for the next page (if using cursor pagination)', required: false })
  nextCursor?: string;

  @ApiProperty({ description: 'Cursor for the previous page (if using cursor pagination)', required: false })
  previousCursor?: string;
}

/**
 * Standard success response wrapper
 */
export class SuccessResponseDto<T> {
  @ApiProperty({ description: 'Response data' })
  data: T;

  @ApiProperty({ description: 'Success message', required: false })
  message?: string;

  @ApiProperty({ description: 'Request correlation ID for tracing', required: false })
  correlationId?: string;
}

/**
 * Standard error response
 */
export class ErrorResponseDto {
  @ApiProperty({ description: 'HTTP status code' })
  statusCode: number;

  @ApiProperty({ description: 'Error code for programmatic handling' })
  code: string;

  @ApiProperty({ description: 'Human-readable error message' })
  message: string;

  @ApiProperty({ description: 'Detailed error information', required: false })
  details?: any;

  @ApiProperty({ description: 'Field-specific validation errors', required: false })
  errors?: Record<string, string[]>;

  @ApiProperty({ description: 'Request correlation ID for tracing', required: false })
  correlationId?: string;

  @ApiProperty({ description: 'Timestamp of the error' })
  timestamp: string;

  @ApiProperty({ description: 'Request path that caused the error' })
  path: string;
}

/**
 * Standard pagination query parameters
 */
export class PaginationQueryDto {
  @ApiProperty({ description: 'Page number (1-indexed)', required: false, default: 1, minimum: 1 })
  page?: number;

  @ApiProperty({ description: 'Number of items per page', required: false, default: 20, minimum: 1, maximum: 100 })
  limit?: number;

  @ApiProperty({ description: 'Sort field', required: false })
  sortBy?: string;

  @ApiProperty({ description: 'Sort direction', required: false, enum: ['asc', 'desc'] })
  sortOrder?: 'asc' | 'desc';

  @ApiProperty({ description: 'Cursor for cursor-based pagination', required: false })
  cursor?: string;
}

/**
 * Helper to create a paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
  nextCursor?: string,
  previousCursor?: string,
): PaginatedResponseDto<T> {
  const totalPages = Math.ceil(total / limit);
  return {
    data,
    total,
    page,
    limit,
    totalPages,
    hasMore: page < totalPages,
    nextCursor,
    previousCursor,
  };
}

/**
 * Helper to create a success response
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  correlationId?: string,
): SuccessResponseDto<T> {
  const response: SuccessResponseDto<T> = { data };
  if (message) response.message = message;
  if (correlationId) response.correlationId = correlationId;
  return response;
}

/**
 * Helper to create an error response
 */
export function createErrorResponse(
  statusCode: number,
  code: string,
  message: string,
  details?: any,
  errors?: Record<string, string[]>,
  correlationId?: string,
  path?: string,
): ErrorResponseDto {
  return {
    statusCode,
    code,
    message,
    details,
    errors,
    correlationId,
    timestamp: new Date().toISOString(),
    path: path || '',
  };
}

/**
 * Common error codes
 */
export enum ErrorCode {
  // Validation errors (400)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',
  
  // Authorization errors (401, 403)
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  
  // Not found errors (404)
  NOT_FOUND = 'NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  
  // Conflict errors (409)
  CONFLICT = 'CONFLICT',
  RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',
  
  // Business logic errors (422)
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  INVALID_STATE_TRANSITION = 'INVALID_STATE_TRANSITION',
  OPERATION_NOT_ALLOWED = 'OPERATION_NOT_ALLOWED',
  
  // Rate limiting (429)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // Server errors (500)
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  PAYMENT_ERROR = 'PAYMENT_ERROR',
  
  // Service unavailable (503)
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  MAINTENANCE_MODE = 'MAINTENANCE_MODE',
}
