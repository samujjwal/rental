import { toast } from "./toast";

/**
 * Enhanced error handling utilities
 * Provides user-friendly error messages and recovery options
 * Based on UX Improvement Guide recommendations
 */

export interface ErrorHandlerOptions {
  showToast?: boolean;
  onRetry?: () => void;
  customMessage?: string;
}

/**
 * Map HTTP status codes to user-friendly messages
 */
const ERROR_MESSAGES: Record<number, string> = {
  400: "Please check your input and try again.",
  401: "Your session has expired. Please log in again.",
  403: "You don't have permission to perform this action.",
  404: "The requested resource could not be found.",
  409: "This action conflicts with existing data. Please refresh and try again.",
  422: "Please check your input.",
  429: "You're making too many requests. Please wait a moment and try again.",
  500: "Our servers are experiencing issues. We're working to fix this.",
  503: "Service temporarily unavailable. Please try again in a few minutes.",
};

/**
 * Get user-friendly error message from error object
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }

  return "An unexpected error occurred. Please try again.";
}

/**
 * Get user-friendly error message from HTTP response
 */
export function getHttpErrorMessage(status: number, errorData?: any): string {
  if (errorData?.message) {
    return errorData.message;
  }

  return (
    ERROR_MESSAGES[status] || "An unexpected error occurred. Please try again."
  );
}

/**
 * Handle API errors with user-friendly messages
 */
export function handleApiError(
  error: unknown,
  options: ErrorHandlerOptions = {}
) {
  const { showToast = true, onRetry, customMessage } = options;

  let message = customMessage || getErrorMessage(error);
  let description: string | undefined;

  // Extract status code if available
  if (error && typeof error === "object" && "status" in error) {
    const status = error.status as number;
    message = getHttpErrorMessage(status, error);
  }

  // Handle network errors
  if (error instanceof TypeError && error.message.includes("fetch")) {
    message = "Unable to connect to the server";
    description = "Please check your internet connection and try again.";
  }

  if (showToast) {
    toast.error(
      message,
      description,
      onRetry
        ? {
            label: "Retry",
            onClick: onRetry,
          }
        : undefined
    );
  }

  return message;
}

/**
 * Handle form validation errors
 */
export function handleValidationError(
  errors: Record<string, string[]> | string[]
) {
  if (Array.isArray(errors)) {
    const message = errors[0] || "Please check your input";
    toast.error("Validation Error", message);
    return;
  }

  const firstError = Object.values(errors)[0]?.[0];
  if (firstError) {
    toast.error("Validation Error", firstError);
  }
}

/**
 * Handle authentication errors
 */
export function handleAuthError(error: unknown) {
  const message = getErrorMessage(error);

  if (
    message.includes("session") ||
    message.includes("expired") ||
    message.includes("unauthorized")
  ) {
    toast.error("Session Expired", "Please log in again to continue.", {
      label: "Log In",
      onClick: () => {
        window.location.href = "/auth/login";
      },
    });
    return;
  }

  toast.error("Authentication Error", message);
}

/**
 * Handle payment errors
 */
export function handlePaymentError(error: unknown, onRetry?: () => void) {
  const message = getErrorMessage(error);

  toast.error(
    "Payment Failed",
    message ||
      "Your payment couldn't be processed. Please check your card details or try a different payment method.",
    onRetry
      ? {
          label: "Try Again",
          onClick: onRetry,
        }
      : undefined
  );
}

/**
 * Wrap async function with error handling
 */
export function withErrorHandler<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: ErrorHandlerOptions = {}
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      handleApiError(error, options);
      throw error;
    }
  }) as T;
}
