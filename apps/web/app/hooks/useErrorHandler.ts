import { useState, useCallback, useEffect } from 'react';
import { toast } from '~/lib/toast';

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface AppError {
  id: string;
  message: string;
  severity: ErrorSeverity;
  code?: string;
  timestamp: Date;
  context?: ErrorContext;
  originalError?: Error;
  recoverable: boolean;
  retryable: boolean;
}

export interface ErrorHandlerOptions {
  showToast?: boolean;
  logToConsole?: boolean;
  reportToService?: boolean;
  onError?: (error: AppError) => void;
}

/**
 * P2.3 FIX: Unified error handling strategy
 * Provides consistent error handling, logging, and user feedback
 */
export function useErrorHandler(options: ErrorHandlerOptions = {}) {
  const {
    showToast = true,
    logToConsole = true,
    reportToService = false,
    onError,
  } = options;

  const [errors, setErrors] = useState<AppError[]>([]);
  const [lastError, setLastError] = useState<AppError | null>(null);

  const generateErrorId = useCallback(() => {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const classifyError = useCallback((error: Error | unknown): ErrorSeverity => {
    if (error instanceof Error) {
      // Network errors
      if (error.message.includes('fetch') || error.message.includes('network')) {
        return 'warning';
      }
      // Authentication errors
      if (error.message.includes('auth') || error.message.includes('unauthorized')) {
        return 'critical';
      }
      // Validation errors
      if (error.message.includes('validation') || error.message.includes('invalid')) {
        return 'info';
      }
    }
    return 'error';
  }, []);

  const isRetryable = useCallback((error: Error | unknown): boolean => {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      // Network errors are typically retryable
      if (message.includes('network') || message.includes('timeout')) {
        return true;
      }
      // Server errors (5xx) are retryable
      if (message.includes('500') || message.includes('503')) {
        return true;
      }
      // Rate limit errors are retryable after delay
      if (message.includes('rate limit') || message.includes('429')) {
        return true;
      }
    }
    return false;
  }, []);

  const isRecoverable = useCallback((error: Error | unknown): boolean => {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      // Critical auth errors are not recoverable
      if (message.includes('unauthorized') || message.includes('forbidden')) {
        return false;
      }
      // Data corruption errors are not recoverable
      if (message.includes('corrupt') || message.includes('invalid state')) {
        return false;
      }
    }
    return true;
  }, []);

  const handleError = useCallback(
    (error: Error | unknown, context?: ErrorContext): AppError => {
      const appError: AppError = {
        id: generateErrorId(),
        message: error instanceof Error ? error.message : String(error),
        severity: classifyError(error),
        code: error instanceof Error ? (error as any).code : undefined,
        timestamp: new Date(),
        context,
        originalError: error instanceof Error ? error : undefined,
        recoverable: isRecoverable(error),
        retryable: isRetryable(error),
      };

      // Update state
      setErrors((prev) => [...prev, appError]);
      setLastError(appError);

      // Log to console in development
      if (logToConsole && process.env.NODE_ENV === 'development') {
        console.error('[Error Handler]', {
          ...appError,
          stack: appError.originalError?.stack,
        });
      }

      // Show toast notification
      if (showToast) {
        const toastMessage = getErrorMessage(appError);
        switch (appError.severity) {
          case 'critical':
          case 'error':
            toast.error(toastMessage);
            break;
          case 'warning':
            toast.warning(toastMessage);
            break;
          case 'info':
            toast.info(toastMessage);
            break;
        }
      }

      // Report to error tracking service
      if (reportToService && appError.severity !== 'info') {
        reportError(appError);
      }

      // Call custom error handler
      if (onError) {
        onError(appError);
      }

      return appError;
    },
    [
      generateErrorId,
      classifyError,
      isRecoverable,
      isRetryable,
      logToConsole,
      showToast,
      reportToService,
      onError,
    ]
  );

  const clearError = useCallback((errorId: string) => {
    setErrors((prev) => prev.filter((e) => e.id !== errorId));
    setLastError((prev) => (prev?.id === errorId ? null : prev));
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors([]);
    setLastError(null);
  }, []);

  const getErrorsByComponent = useCallback(
    (component: string) => {
      return errors.filter((e) => e.context?.component === component);
    },
    [errors]
  );

  const hasErrors = errors.length > 0;
  const hasCriticalErrors = errors.some((e) => e.severity === 'critical');

  return {
    errors,
    lastError,
    hasErrors,
    hasCriticalErrors,
    handleError,
    clearError,
    clearAllErrors,
    getErrorsByComponent,
  };
}

/**
 * Get user-friendly error message
 */
function getErrorMessage(error: AppError): string {
  // Custom messages for common errors
  const errorMessages: Record<string, string> = {
    'Network request failed': 'Unable to connect. Please check your internet connection.',
    'Failed to fetch': 'Unable to load data. Please try again.',
    'Unauthorized': 'Your session has expired. Please log in again.',
    'Forbidden': 'You do not have permission to perform this action.',
    'Not found': 'The requested resource was not found.',
    'Validation error': 'Please check your input and try again.',
    'Rate limit exceeded': 'Too many requests. Please wait a moment and try again.',
  };

  // Check for known error patterns
  for (const [pattern, message] of Object.entries(errorMessages)) {
    if (error.message.includes(pattern)) {
      return message;
    }
  }

  // Return original message for unknown errors
  return error.message || 'An unexpected error occurred. Please try again.';
}

/**
 * Report error to tracking service (placeholder for actual implementation)
 */
function reportError(error: AppError): void {
  // In production, this would send to Sentry, LogRocket, etc.
  if (typeof window !== 'undefined' && (window as any).errorTracker) {
    (window as any).errorTracker.captureException(error.originalError || error.message, {
      level: error.severity,
      tags: {
        component: error.context?.component,
        action: error.context?.action,
      },
      extra: {
        errorId: error.id,
        context: error.context,
        timestamp: error.timestamp,
      },
    });
  }
}

/**
 * Hook for handling async errors with automatic error handling
 */
export function useAsyncErrorHandler<T = any>(
  asyncFn: (...args: any[]) => Promise<T>,
  context?: ErrorContext
) {
  const { handleError } = useErrorHandler();
  const [isLoading, setIsLoading] = useState(false);

  const execute = useCallback(
    async (...args: any[]): Promise<T | null> => {
      setIsLoading(true);
      try {
        const result = await asyncFn(...args);
        return result;
      } catch (error) {
        handleError(error, context);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [asyncFn, context, handleError]
  );

  return { execute, isLoading };
}

/**
 * Global error boundary hook
 */
export function useGlobalErrorHandler() {
  const { handleError: handleAppError } = useErrorHandler({
    showToast: true,
    logToConsole: true,
    reportToService: true,
  });

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      event.preventDefault();
      handleAppError(event.reason, {
        component: 'Global',
        action: 'Unhandled Promise Rejection',
      });
    };

    const handleGlobalError = (event: ErrorEvent) => {
      event.preventDefault();
      handleAppError(event.error, {
        component: 'Global',
        action: 'Unhandled Error',
      });
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleGlobalError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleGlobalError);
    };
  }, [handleAppError]);
}
