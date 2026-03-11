import { Injectable, Logger } from '@nestjs/common';

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum ErrorCategory {
  VALIDATION = 'VALIDATION',
  AUTHORIZATION = 'AUTHORIZATION',
  BUSINESS_LOGIC = 'BUSINESS_LOGIC',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  DATABASE = 'DATABASE',
  SYSTEM = 'SYSTEM',
  NETWORK = 'NETWORK',
}

export interface ErrorContext {
  userId?: string;
  requestId?: string;
  operation?: string;
  resource?: string;
  metadata?: Record<string, any>;
}

export interface ServiceError {
  code: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  originalError?: Error;
  context?: ErrorContext;
  timestamp: Date;
  stack?: string;
}

@Injectable()
export class ErrorHandlingService {
  private readonly logger = new Logger(ErrorHandlingService.name);

  /**
   * Create a structured service error
   */
  createError(
    code: string,
    message: string,
    category: ErrorCategory,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    originalError?: Error,
    context?: ErrorContext,
  ): ServiceError {
    const serviceError: ServiceError = {
      code,
      message,
      category,
      severity,
      originalError,
      context,
      timestamp: new Date(),
    };

    if (originalError?.stack) {
      serviceError.stack = originalError.stack;
    }

    return serviceError;
  }

  /**
   * Handle and log service errors with proper propagation
   */
  handleError(error: ServiceError, shouldThrow = true): never {
    this.logError(error);

    if (shouldThrow) {
      this.propagateError(error);
    }

    // This should never be reached due to propagateError
    throw error;
  }

  /**
   * Wrap async operations with error handling
   */
  async withErrorHandling<T>(
    operation: () => Promise<T>,
    errorCode: string,
    errorMessage: string,
    category: ErrorCategory,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context?: ErrorContext,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const serviceError = this.createError(
        errorCode,
        errorMessage,
        category,
        severity,
        error as Error,
        context,
      );
      
      this.handleError(serviceError);
    }
  }

  /**
   * Wrap sync operations with error handling
   */
  withSyncErrorHandling<T>(
    operation: () => T,
    errorCode: string,
    errorMessage: string,
    category: ErrorCategory,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context?: ErrorContext,
  ): T {
    try {
      return operation();
    } catch (error) {
      const serviceError = this.createError(
        errorCode,
        errorMessage,
        category,
        severity,
        error as Error,
        context,
      );
      
      this.handleError(serviceError);
    }
  }

  /**
   * Create specific error types
   */
  createValidationError(message: string, context?: ErrorContext): ServiceError {
    return this.createError(
      'VALIDATION_ERROR',
      message,
      ErrorCategory.VALIDATION,
      ErrorSeverity.LOW,
      undefined,
      context,
    );
  }

  createAuthorizationError(message: string, context?: ErrorContext): ServiceError {
    return this.createError(
      'AUTHORIZATION_ERROR',
      message,
      ErrorCategory.AUTHORIZATION,
      ErrorSeverity.MEDIUM,
      undefined,
      context,
    );
  }

  createBusinessLogicError(message: string, context?: ErrorContext): ServiceError {
    return this.createError(
      'BUSINESS_LOGIC_ERROR',
      message,
      ErrorCategory.BUSINESS_LOGIC,
      ErrorSeverity.MEDIUM,
      undefined,
      context,
    );
  }

  createExternalServiceError(
    serviceName: string,
    message: string,
    originalError?: Error,
    context?: ErrorContext,
  ): ServiceError {
    return this.createError(
      `EXTERNAL_SERVICE_ERROR_${serviceName.toUpperCase()}`,
      message,
      ErrorCategory.EXTERNAL_SERVICE,
      ErrorSeverity.HIGH,
      originalError,
      context,
    );
  }

  createDatabaseError(
    operation: string,
    message: string,
    originalError?: Error,
    context?: ErrorContext,
  ): ServiceError {
    return this.createError(
      `DATABASE_ERROR_${operation.toUpperCase()}`,
      message,
      ErrorCategory.DATABASE,
      ErrorSeverity.HIGH,
      originalError,
      context,
    );
  }

  createSystemError(message: string, originalError?: Error, context?: ErrorContext): ServiceError {
    return this.createError(
      'SYSTEM_ERROR',
      message,
      ErrorCategory.SYSTEM,
      ErrorSeverity.CRITICAL,
      originalError,
      context,
    );
  }

  /**
   * Log errors with appropriate level based on severity
   */
  private logError(error: ServiceError): void {
    const logMessage = `[${error.category}] ${error.code}: ${error.message}`;
    const logContext = {
      ...error.context,
      timestamp: error.timestamp,
      originalError: error.originalError?.message,
    };

    switch (error.severity) {
      case ErrorSeverity.LOW:
        this.logger.log(logMessage, logContext);
        break;
      case ErrorSeverity.MEDIUM:
        this.logger.warn(logMessage, logContext);
        break;
      case ErrorSeverity.HIGH:
        this.logger.error(logMessage, logContext);
        break;
      case ErrorSeverity.CRITICAL:
        this.logger.error(`🚨 CRITICAL: ${logMessage}`, logContext);
        break;
    }
  }

  /**
   * Propagate errors to appropriate HTTP exceptions
   */
  private propagateError(error: ServiceError): never {
    switch (error.category) {
      case ErrorCategory.VALIDATION:
        throw new Error(`Validation Error: ${error.message}`);
      
      case ErrorCategory.AUTHORIZATION:
        throw new Error(`Authorization Error: ${error.message}`);
      
      case ErrorCategory.BUSINESS_LOGIC:
        throw new Error(`Business Logic Error: ${error.message}`);
      
      case ErrorCategory.EXTERNAL_SERVICE:
        throw new Error(`External Service Error: ${error.message}`);
      
      case ErrorCategory.DATABASE:
        throw new Error(`Database Error: ${error.message}`);
      
      case ErrorCategory.SYSTEM:
        throw new Error(`System Error: ${error.message}`);
      
      case ErrorCategory.NETWORK:
        throw new Error(`Network Error: ${error.message}`);
      
      default:
        throw new Error(`Unknown Error: ${error.message}`);
    }
  }

  /**
   * Create error context from request
   */
  createContextFromRequest(
    userId?: string,
    requestId?: string,
    operation?: string,
    resource?: string,
    metadata?: Record<string, any>,
  ): ErrorContext {
    return {
      userId,
      requestId,
      operation,
      resource,
      metadata,
    };
  }

  /**
   * Check if error should be retried
   */
  shouldRetry(error: ServiceError): boolean {
    // Retry on external service and network errors
    return [ErrorCategory.EXTERNAL_SERVICE, ErrorCategory.NETWORK].includes(
      error.category,
    );
  }

  /**
   * Get retry delay based on error severity
   */
  getRetryDelay(error: ServiceError, attempt: number): number {
    const baseDelay = 1000; // 1 second
    
    switch (error.severity) {
      case ErrorSeverity.LOW:
        return baseDelay * Math.pow(2, attempt); // Exponential backoff
      case ErrorSeverity.MEDIUM:
        return baseDelay * Math.pow(2, attempt) * 2;
      case ErrorSeverity.HIGH:
        return baseDelay * Math.pow(2, attempt) * 4;
      case ErrorSeverity.CRITICAL:
        return baseDelay * Math.pow(2, attempt) * 8;
      default:
        return baseDelay * Math.pow(2, attempt);
    }
  }
}
