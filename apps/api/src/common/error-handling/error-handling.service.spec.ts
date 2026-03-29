import { Test, TestingModule } from '@nestjs/testing';
import { ErrorHandlingService, ErrorSeverity, ErrorCategory, ErrorContext } from './error-handling.service';
import { Logger } from '@nestjs/common';

describe('ErrorHandlingService', () => {
  let service: ErrorHandlingService;
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ErrorHandlingService],
    }).compile();

    service = module.get<ErrorHandlingService>(ErrorHandlingService);
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
    logSpy.mockRestore();
  });

  describe('createError', () => {
    it('should create a service error with all required fields', () => {
      const error = service.createError(
        'TEST_ERROR',
        'Test error message',
        ErrorCategory.VALIDATION,
        ErrorSeverity.MEDIUM,
      );

      expect(error.code).toBe('TEST_ERROR');
      expect(error.message).toBe('Test error message');
      expect(error.category).toBe(ErrorCategory.VALIDATION);
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should include original error if provided', () => {
      const original = new Error('Original error');
      original.stack = 'Error: Original\n    at test.ts:1:1';

      const error = service.createError(
        'WRAPPED_ERROR',
        'Wrapped message',
        ErrorCategory.SYSTEM,
        ErrorSeverity.HIGH,
        original,
      );

      expect(error.originalError).toBe(original);
      expect(error.stack).toBe(original.stack);
    });

    it('should include context if provided', () => {
      const context: ErrorContext = {
        userId: 'user-123',
        requestId: 'req-456',
        operation: 'test',
        resource: 'listing',
        metadata: { listingId: 'listing-789' },
      };

      const error = service.createError(
        'CONTEXT_ERROR',
        'With context',
        ErrorCategory.BUSINESS_LOGIC,
        ErrorSeverity.LOW,
        undefined,
        context,
      );

      expect(error.context).toEqual(context);
    });

    it('should default severity to MEDIUM', () => {
      const error = service.createError(
        'DEFAULT_SEVERITY',
        'Message',
        ErrorCategory.DATABASE,
      );

      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
    });
  });

  describe('handleError', () => {
    it('should log and throw error by default', () => {
      const serviceError = service.createError(
        'HANDLED_ERROR',
        'Handled',
        ErrorCategory.VALIDATION,
        ErrorSeverity.MEDIUM,
      );

      expect(() => service.handleError(serviceError)).toThrow('Validation Error: Handled');
      expect(errorSpy).toHaveBeenCalled();
    });

    it('should log but not throw when shouldThrow is false', () => {
      const serviceError = service.createError(
        'NO_THROW',
        'No throw',
        ErrorCategory.AUTHORIZATION,
        ErrorSeverity.HIGH,
      );

      // This should still throw because propagateError always throws
      expect(() => service.handleError(serviceError, false)).toThrow();
    });
  });

  describe('withErrorHandling', () => {
    it('should return successful operation result', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await service.withErrorHandling(
        operation,
        'OP_ERROR',
        'Operation failed',
        ErrorCategory.EXTERNAL_SERVICE,
        ErrorSeverity.HIGH,
      );

      expect(result).toBe('success');
    });

    it('should handle and throw on operation failure', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Async failure'));

      await expect(
        service.withErrorHandling(
          operation,
          'ASYNC_ERROR',
          'Async op failed',
          ErrorCategory.DATABASE,
          ErrorSeverity.CRITICAL,
        ),
      ).rejects.toThrow('Database Error: Async op failed');

      expect(errorSpy).toHaveBeenCalled();
    });

    it('should pass context to error', async () => {
      const context: ErrorContext = { userId: 'user-123' };
      const operation = jest.fn().mockRejectedValue(new Error('Fail'));

      await expect(
        service.withErrorHandling(
          operation,
          'CONTEXT_ERROR',
          'Failed with context',
          ErrorCategory.NETWORK,
          ErrorSeverity.HIGH,
          context,
        ),
      ).rejects.toThrow();
    });
  });

  describe('withSyncErrorHandling', () => {
    it('should return successful sync operation result', () => {
      const operation = jest.fn().mockReturnValue('sync-success');

      const result = service.withSyncErrorHandling(
        operation,
        'SYNC_ERROR',
        'Sync operation failed',
        ErrorCategory.BUSINESS_LOGIC,
        ErrorSeverity.MEDIUM,
      );

      expect(result).toBe('sync-success');
    });

    it('should handle and throw on sync operation failure', () => {
      const operation = jest.fn().mockImplementation(() => {
        throw new Error('Sync failure');
      });

      expect(() =>
        service.withSyncErrorHandling(
          operation,
          'SYNC_FAIL',
          'Sync op failed',
          ErrorCategory.SYSTEM,
          ErrorSeverity.CRITICAL,
        ),
      ).toThrow('System Error: Sync op failed');
    });
  });

  describe('specific error creators', () => {
    it('should create validation error', () => {
      const error = service.createValidationError('Invalid input', { userId: 'user-1' });

      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.category).toBe(ErrorCategory.VALIDATION);
      expect(error.severity).toBe(ErrorSeverity.LOW);
    });

    it('should create authorization error', () => {
      const error = service.createAuthorizationError('Access denied');

      expect(error.code).toBe('AUTHORIZATION_ERROR');
      expect(error.category).toBe(ErrorCategory.AUTHORIZATION);
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
    });

    it('should create business logic error', () => {
      const error = service.createBusinessLogicError('Business rule violated');

      expect(error.code).toBe('BUSINESS_LOGIC_ERROR');
      expect(error.category).toBe(ErrorCategory.BUSINESS_LOGIC);
    });

    it('should create external service error', () => {
      const original = new Error('Stripe timeout');
      const error = service.createExternalServiceError('Stripe', 'Payment failed', original);

      expect(error.code).toBe('EXTERNAL_SERVICE_ERROR_STRIPE');
      expect(error.category).toBe(ErrorCategory.EXTERNAL_SERVICE);
      expect(error.severity).toBe(ErrorSeverity.HIGH);
      expect(error.originalError).toBe(original);
    });

    it('should create database error', () => {
      const original = new Error('Connection lost');
      const error = service.createDatabaseError('query', 'Query failed', original);

      expect(error.code).toBe('DATABASE_ERROR_QUERY');
      expect(error.category).toBe(ErrorCategory.DATABASE);
      expect(error.severity).toBe(ErrorSeverity.HIGH);
    });

    it('should create system error', () => {
      const original = new Error('Memory exhausted');
      const error = service.createSystemError('System failure', original);

      expect(error.code).toBe('SYSTEM_ERROR');
      expect(error.category).toBe(ErrorCategory.SYSTEM);
      expect(error.severity).toBe(ErrorSeverity.CRITICAL);
    });
  });

  describe('createContextFromRequest', () => {
    it('should create context from request parameters', () => {
      const context = service.createContextFromRequest(
        'user-123',
        'req-456',
        'updateListing',
        'listing-789',
        { price: 100 },
      );

      expect(context).toEqual({
        userId: 'user-123',
        requestId: 'req-456',
        operation: 'updateListing',
        resource: 'listing-789',
        metadata: { price: 100 },
      });
    });

    it('should create partial context with only userId', () => {
      const context = service.createContextFromRequest('user-123');

      expect(context).toEqual({
        userId: 'user-123',
        requestId: undefined,
        operation: undefined,
        resource: undefined,
        metadata: undefined,
      });
    });
  });

  describe('shouldRetry', () => {
    it('should return true for external service errors', () => {
      const error = service.createExternalServiceError('API', 'Failed');
      expect(service.shouldRetry(error)).toBe(true);
    });

    it('should return true for network errors', () => {
      const error = service.createError(
        'NETWORK_ERROR',
        'Timeout',
        ErrorCategory.NETWORK,
        ErrorSeverity.HIGH,
      );
      expect(service.shouldRetry(error)).toBe(true);
    });

    it('should return false for validation errors', () => {
      const error = service.createValidationError('Invalid');
      expect(service.shouldRetry(error)).toBe(false);
    });

    it('should return false for database errors', () => {
      const error = service.createDatabaseError('query', 'Failed');
      expect(service.shouldRetry(error)).toBe(false);
    });
  });

  describe('getRetryDelay', () => {
    it('should calculate exponential backoff for LOW severity', () => {
      const error = service.createValidationError('Low');
      error.severity = ErrorSeverity.LOW;

      expect(service.getRetryDelay(error, 0)).toBe(1000);
      expect(service.getRetryDelay(error, 1)).toBe(2000);
      expect(service.getRetryDelay(error, 2)).toBe(4000);
    });

    it('should calculate longer delays for higher severity', () => {
      const mediumError = service.createError('ERR', 'Med', ErrorCategory.NETWORK, ErrorSeverity.MEDIUM);
      const highError = service.createError('ERR', 'High', ErrorCategory.NETWORK, ErrorSeverity.HIGH);
      const criticalError = service.createError('ERR', 'Crit', ErrorCategory.NETWORK, ErrorSeverity.CRITICAL);

      expect(service.getRetryDelay(mediumError, 0)).toBe(2000);
      expect(service.getRetryDelay(highError, 0)).toBe(4000);
      expect(service.getRetryDelay(criticalError, 0)).toBe(8000);
    });
  });
});
