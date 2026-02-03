import { api } from "./api-client";
import { handleApiError, getHttpErrorMessage } from "./error-handler";
import { toast } from "./toast";

/**
 * Enhanced API utilities with retry logic and better error handling
 * Wraps the base API client with production-grade features
 */

interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  retryableStatuses?: number[];
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  retryDelay: 1000,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: any, retryableStatuses: number[]): boolean {
  if (!error.response) {
    // Network errors are retryable
    return true;
  }
  return retryableStatuses.includes(error.response.status);
}

/**
 * Wrap API call with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries, retryDelay, retryableStatuses } = {
    ...DEFAULT_RETRY_OPTIONS,
    ...options,
  };

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries!; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (
        attempt < maxRetries! &&
        isRetryableError(error, retryableStatuses!)
      ) {
        const delay = retryDelay! * Math.pow(2, attempt); // Exponential backoff
        await sleep(delay);
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

/**
 * Enhanced GET request with error handling
 */
export async function apiGet<T>(
  url: string,
  options: {
    showErrorToast?: boolean;
    retryOptions?: RetryOptions;
  } = {}
): Promise<T> {
  const { showErrorToast = true, retryOptions } = options;

  try {
    return await withRetry(() => api.get<T>(url), retryOptions);
  } catch (error) {
    if (showErrorToast) {
      handleApiError(error);
    }
    throw error;
  }
}

/**
 * Enhanced POST request with error handling
 */
export async function apiPost<T>(
  url: string,
  data?: unknown,
  options: {
    showErrorToast?: boolean;
    showSuccessToast?: boolean;
    successMessage?: string;
    retryOptions?: RetryOptions;
  } = {}
): Promise<T> {
  const {
    showErrorToast = true,
    showSuccessToast = false,
    successMessage,
    retryOptions,
  } = options;

  try {
    const result = await withRetry(() => api.post<T>(url, data), retryOptions);

    if (showSuccessToast && successMessage) {
      toast.success(successMessage);
    }

    return result;
  } catch (error) {
    if (showErrorToast) {
      handleApiError(error);
    }
    throw error;
  }
}

/**
 * Enhanced PUT request with error handling
 */
export async function apiPut<T>(
  url: string,
  data?: unknown,
  options: {
    showErrorToast?: boolean;
    showSuccessToast?: boolean;
    successMessage?: string;
    retryOptions?: RetryOptions;
  } = {}
): Promise<T> {
  const {
    showErrorToast = true,
    showSuccessToast = false,
    successMessage,
    retryOptions,
  } = options;

  try {
    const result = await withRetry(() => api.put<T>(url, data), retryOptions);

    if (showSuccessToast && successMessage) {
      toast.success(successMessage);
    }

    return result;
  } catch (error) {
    if (showErrorToast) {
      handleApiError(error);
    }
    throw error;
  }
}

/**
 * Enhanced PATCH request with error handling
 */
export async function apiPatch<T>(
  url: string,
  data?: unknown,
  options: {
    showErrorToast?: boolean;
    showSuccessToast?: boolean;
    successMessage?: string;
    retryOptions?: RetryOptions;
  } = {}
): Promise<T> {
  const {
    showErrorToast = true,
    showSuccessToast = false,
    successMessage,
    retryOptions,
  } = options;

  try {
    const result = await withRetry(() => api.patch<T>(url, data), retryOptions);

    if (showSuccessToast && successMessage) {
      toast.success(successMessage);
    }

    return result;
  } catch (error) {
    if (showErrorToast) {
      handleApiError(error);
    }
    throw error;
  }
}

/**
 * Enhanced DELETE request with error handling
 */
export async function apiDelete<T>(
  url: string,
  options: {
    showErrorToast?: boolean;
    showSuccessToast?: boolean;
    successMessage?: string;
    retryOptions?: RetryOptions;
  } = {}
): Promise<T> {
  const {
    showErrorToast = true,
    showSuccessToast = false,
    successMessage,
    retryOptions,
  } = options;

  try {
    const result = await withRetry(() => api.delete<T>(url), retryOptions);

    if (showSuccessToast && successMessage) {
      toast.success(successMessage);
    }

    return result;
  } catch (error) {
    if (showErrorToast) {
      handleApiError(error);
    }
    throw error;
  }
}

/**
 * Batch API requests with progress tracking
 */
export async function apiBatch<T>(
  requests: Array<() => Promise<T>>,
  options: {
    onProgress?: (completed: number, total: number) => void;
    concurrency?: number;
  } = {}
): Promise<T[]> {
  const { onProgress, concurrency = 5 } = options;
  const results: T[] = [];
  let completed = 0;

  for (let i = 0; i < requests.length; i += concurrency) {
    const batch = requests.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map((req) => req()));
    results.push(...batchResults);

    completed += batch.length;
    if (onProgress) {
      onProgress(completed, requests.length);
    }
  }

  return results;
}
