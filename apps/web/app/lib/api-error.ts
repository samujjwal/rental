import { AxiosError } from 'axios';

/**
 * API Error Types
 */
export enum ApiErrorType {
  OFFLINE = 'OFFLINE',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Standardized API Error
 */
export interface ApiError {
  type: ApiErrorType;
  message: string;
  statusCode?: number;
  details?: Record<string, string[]>;
  retryable: boolean;
}

/**
 * Error messages for different error types
 */
const ERROR_MESSAGES: Record<ApiErrorType, string> = {
  [ApiErrorType.OFFLINE]: 'You appear to be offline. Check your connection and try again.',
  [ApiErrorType.NETWORK_ERROR]: 'Unable to connect to the server. Please check your internet connection.',
  [ApiErrorType.TIMEOUT_ERROR]: 'The request took too long. Please try again.',
  [ApiErrorType.UNAUTHORIZED]: 'You need to sign in to access this resource.',
  [ApiErrorType.FORBIDDEN]: 'You do not have permission to access this resource.',
  [ApiErrorType.NOT_FOUND]: 'The requested resource was not found.',
  [ApiErrorType.CONFLICT]: 'This data changed while you were working. Refresh and try again.',
  [ApiErrorType.VALIDATION_ERROR]: 'Please check your input and try again.',
  [ApiErrorType.SERVER_ERROR]: 'Something went wrong on our end. Please try again later.',
  [ApiErrorType.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again.',
};

/**
 * Parse Axios error into standardized ApiError
 */
export function parseApiError(error: unknown): ApiError {
  if (error instanceof AxiosError) {
    // Network errors (no response received)
    if (!error.response) {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return {
          type: ApiErrorType.OFFLINE,
          message: ERROR_MESSAGES[ApiErrorType.OFFLINE],
          retryable: true,
        };
      }
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return {
          type: ApiErrorType.TIMEOUT_ERROR,
          message: ERROR_MESSAGES[ApiErrorType.TIMEOUT_ERROR],
          retryable: true,
        };
      }
      return {
        type: ApiErrorType.NETWORK_ERROR,
        message: ERROR_MESSAGES[ApiErrorType.NETWORK_ERROR],
        retryable: true,
      };
    }

    const status = error.response.status;
    const data = error.response.data;

    switch (status) {
      case 401:
        return {
          type: ApiErrorType.UNAUTHORIZED,
          message: data?.message || ERROR_MESSAGES[ApiErrorType.UNAUTHORIZED],
          statusCode: status,
          retryable: false,
        };
      case 403:
        return {
          type: ApiErrorType.FORBIDDEN,
          message: data?.message || ERROR_MESSAGES[ApiErrorType.FORBIDDEN],
          statusCode: status,
          retryable: false,
        };
      case 404:
        return {
          type: ApiErrorType.NOT_FOUND,
          message: data?.message || ERROR_MESSAGES[ApiErrorType.NOT_FOUND],
          statusCode: status,
          retryable: false,
        };
      case 409:
        return {
          type: ApiErrorType.CONFLICT,
          message: data?.message || ERROR_MESSAGES[ApiErrorType.CONFLICT],
          statusCode: status,
          retryable: true,
        };
      case 422:
      case 400:
        return {
          type: ApiErrorType.VALIDATION_ERROR,
          message: data?.message || ERROR_MESSAGES[ApiErrorType.VALIDATION_ERROR],
          statusCode: status,
          details: data?.errors,
          retryable: false,
        };
      case 500:
      case 502:
      case 503:
      case 504:
        return {
          type: ApiErrorType.SERVER_ERROR,
          message: data?.message || ERROR_MESSAGES[ApiErrorType.SERVER_ERROR],
          statusCode: status,
          retryable: true,
        };
      default:
        return {
          type: ApiErrorType.UNKNOWN_ERROR,
          message: data?.message || ERROR_MESSAGES[ApiErrorType.UNKNOWN_ERROR],
          statusCode: status,
          retryable: true,
        };
    }
  }

  // Non-Axios errors
  if (error instanceof Error) {
    return {
      type: ApiErrorType.UNKNOWN_ERROR,
      message: error.message || ERROR_MESSAGES[ApiErrorType.UNKNOWN_ERROR],
      retryable: true,
    };
  }

  return {
    type: ApiErrorType.UNKNOWN_ERROR,
    message: ERROR_MESSAGES[ApiErrorType.UNKNOWN_ERROR],
    retryable: true,
  };
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: ApiError): boolean {
  return error.retryable;
}

/**
 * Get user-friendly error message
 */
export function getErrorMessage(error: unknown): string {
  const apiError = parseApiError(error);
  return apiError.message;
}

export function isApiErrorType(error: unknown, type: ApiErrorType): boolean {
  return parseApiError(error).type === type;
}

export function isApiErrorStatus(error: unknown, statusCode: number): boolean {
  return parseApiError(error).statusCode === statusCode;
}

export function isConflictError(error: unknown): boolean {
  return isApiErrorType(error, ApiErrorType.CONFLICT) || isApiErrorStatus(error, 409);
}

export function isTimeoutError(error: unknown): boolean {
  return isApiErrorType(error, ApiErrorType.TIMEOUT_ERROR);
}

export function isOfflineError(error: unknown): boolean {
  return isApiErrorType(error, ApiErrorType.OFFLINE);
}

export function isNetworkError(error: unknown): boolean {
  const parsed = parseApiError(error);
  return parsed.type === ApiErrorType.NETWORK_ERROR || parsed.type === ApiErrorType.OFFLINE;
}

export function getActionableErrorMessage(
  error: unknown,
  fallbackMessage = ERROR_MESSAGES[ApiErrorType.UNKNOWN_ERROR],
  overrides?: Partial<Record<ApiErrorType, string>>
): string {
  const parsed = parseApiError(error);
  return overrides?.[parsed.type] || parsed.message || fallbackMessage;
}

/**
 * API request with automatic retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    delayMs?: number;
    onRetry?: (attempt: number, error: ApiError) => void;
  } = {}
): Promise<T> {
  const { maxRetries = 3, delayMs = 1000, onRetry } = options;
  
  let lastError: ApiError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = parseApiError(error);
      
      // Don't retry non-retryable errors
      if (!lastError.retryable || attempt === maxRetries) {
        throw lastError;
      }
      
      // Exponential backoff
      const backoffDelay = delayMs * Math.pow(2, attempt);
      
      if (onRetry) {
        onRetry(attempt + 1, lastError);
      }
      
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }
  
  throw lastError!;
}

/**
 * Circuit breaker for API calls
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime: number | null = null;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private failureThreshold = 5,
    private resetTimeoutMs = 30000
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - (this.lastFailureTime || 0) > this.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }
  
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
}

export default parseApiError;
