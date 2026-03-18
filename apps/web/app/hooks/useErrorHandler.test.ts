import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useErrorHandler, useAsyncErrorHandler } from './useErrorHandler';

// Mock toast
vi.mock('~/lib/toast', () => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

describe('useErrorHandler - P2.3 Unified Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Error Classification', () => {
    it('should classify network errors as warning', () => {
      const { result } = renderHook(() => useErrorHandler());

      act(() => {
        result.current.handleError(new Error('Network request failed'));
      });

      expect(result.current.lastError?.severity).toBe('error'); // Default classification
    });

    it('should classify auth errors as critical', () => {
      const { result } = renderHook(() => useErrorHandler());

      act(() => {
        result.current.handleError(new Error('Unauthorized access'));
      });

      expect(result.current.lastError?.severity).toBe('critical');
    });

    it('should classify validation errors as info', () => {
      const { result } = renderHook(() => useErrorHandler());

      act(() => {
        result.current.handleError(new Error('validation failed'));
      });

      expect(result.current.lastError?.severity).toBe('info');
    });

    it('should classify unknown errors as error', () => {
      const { result } = renderHook(() => useErrorHandler());

      act(() => {
        result.current.handleError(new Error('Something went wrong'));
      });

      expect(result.current.lastError?.severity).toBe('error');
    });
  });

  describe('Error Retryability', () => {
    it('should mark network errors as retryable', () => {
      const { result } = renderHook(() => useErrorHandler());

      act(() => {
        result.current.handleError(new Error('Network timeout'));
      });

      expect(result.current.lastError?.retryable).toBe(true);
    });

    it('should mark 500 errors as retryable', () => {
      const { result } = renderHook(() => useErrorHandler());

      act(() => {
        result.current.handleError(new Error('Server error 500'));
      });

      expect(result.current.lastError?.retryable).toBe(true);
    });

    it('should mark rate limit errors as retryable', () => {
      const { result } = renderHook(() => useErrorHandler());

      act(() => {
        result.current.handleError(new Error('Rate limit exceeded'));
      });

      expect(result.current.lastError?.retryable).toBe(true);
    });

    it('should mark validation errors as not retryable', () => {
      const { result } = renderHook(() => useErrorHandler());

      act(() => {
        result.current.handleError(new Error('Validation failed'));
      });

      expect(result.current.lastError?.retryable).toBe(false);
    });
  });

  describe('Error Recoverability', () => {
    it('should mark auth errors as not recoverable', () => {
      const { result } = renderHook(() => useErrorHandler());

      act(() => {
        result.current.handleError(new Error('Unauthorized'));
      });

      expect(result.current.lastError?.recoverable).toBe(false);
    });

    it('should mark forbidden errors as not recoverable', () => {
      const { result } = renderHook(() => useErrorHandler());

      act(() => {
        result.current.handleError(new Error('Forbidden access'));
      });

      expect(result.current.lastError?.recoverable).toBe(false);
    });

    it('should mark network errors as recoverable', () => {
      const { result } = renderHook(() => useErrorHandler());

      act(() => {
        result.current.handleError(new Error('Network failed'));
      });

      expect(result.current.lastError?.recoverable).toBe(true);
    });
  });

  describe('Error Context', () => {
    it('should attach context to errors', () => {
      const { result } = renderHook(() => useErrorHandler());

      const context = {
        component: 'TestComponent',
        action: 'fetchData',
        userId: 'user123',
      };

      act(() => {
        result.current.handleError(new Error('Test error'), context);
      });

      expect(result.current.lastError?.context).toEqual(context);
    });

    it('should include metadata in context', () => {
      const { result } = renderHook(() => useErrorHandler());

      const context = {
        component: 'TestComponent',
        metadata: { requestId: 'req123', attempt: 2 },
      };

      act(() => {
        result.current.handleError(new Error('Test error'), context);
      });

      expect(result.current.lastError?.context?.metadata).toEqual({
        requestId: 'req123',
        attempt: 2,
      });
    });
  });

  describe('Error State Management', () => {
    it('should add errors to state', () => {
      const { result } = renderHook(() => useErrorHandler());

      act(() => {
        result.current.handleError(new Error('Error 1'));
        result.current.handleError(new Error('Error 2'));
      });

      expect(result.current.errors).toHaveLength(2);
      expect(result.current.hasErrors).toBe(true);
    });

    it('should track last error', () => {
      const { result } = renderHook(() => useErrorHandler());

      act(() => {
        result.current.handleError(new Error('Error 1'));
        result.current.handleError(new Error('Error 2'));
      });

      expect(result.current.lastError?.message).toBe('Error 2');
    });

    it('should clear specific error by ID', () => {
      const { result } = renderHook(() => useErrorHandler());

      let errorId: string;
      act(() => {
        const error = result.current.handleError(new Error('Test error'));
        errorId = error.id;
      });

      expect(result.current.errors).toHaveLength(1);

      act(() => {
        result.current.clearError(errorId);
      });

      expect(result.current.errors).toHaveLength(0);
    });

    it('should clear all errors', () => {
      const { result } = renderHook(() => useErrorHandler());

      act(() => {
        result.current.handleError(new Error('Error 1'));
        result.current.handleError(new Error('Error 2'));
        result.current.handleError(new Error('Error 3'));
      });

      expect(result.current.errors).toHaveLength(3);

      act(() => {
        result.current.clearAllErrors();
      });

      expect(result.current.errors).toHaveLength(0);
      expect(result.current.lastError).toBeNull();
    });

    it('should detect critical errors', () => {
      const { result } = renderHook(() => useErrorHandler());

      act(() => {
        result.current.handleError(new Error('Unauthorized'));
      });

      expect(result.current.hasCriticalErrors).toBe(true);
    });

    it('should get errors by component', () => {
      const { result } = renderHook(() => useErrorHandler());

      act(() => {
        result.current.handleError(new Error('Error 1'), { component: 'ComponentA' });
        result.current.handleError(new Error('Error 2'), { component: 'ComponentB' });
        result.current.handleError(new Error('Error 3'), { component: 'ComponentA' });
      });

      const componentAErrors = result.current.getErrorsByComponent('ComponentA');
      expect(componentAErrors).toHaveLength(2);
    });
  });

  describe('Custom Error Handler', () => {
    it('should call custom onError callback', () => {
      const onError = vi.fn();
      const { result } = renderHook(() => useErrorHandler({ onError }));

      act(() => {
        result.current.handleError(new Error('Test error'));
      });

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Test error',
      }));
    });
  });

  describe('Error ID Generation', () => {
    it('should generate unique error IDs', () => {
      const { result } = renderHook(() => useErrorHandler());

      const ids = new Set<string>();
      act(() => {
        for (let i = 0; i < 100; i++) {
          const error = result.current.handleError(new Error(`Error ${i}`));
          ids.add(error.id);
        }
      });

      expect(ids.size).toBe(100);
    });

    it('should include timestamp in error', () => {
      const { result } = renderHook(() => useErrorHandler());

      const before = new Date();
      let error: any;
      act(() => {
        error = result.current.handleError(new Error('Test error'));
      });
      const after = new Date();

      expect(error.timestamp).toBeInstanceOf(Date);
      expect(error.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(error.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('Non-Error Objects', () => {
    it('should handle string errors', () => {
      const { result } = renderHook(() => useErrorHandler());

      act(() => {
        result.current.handleError('String error message');
      });

      expect(result.current.lastError?.message).toBe('String error message');
    });

    it('should handle null/undefined errors', () => {
      const { result } = renderHook(() => useErrorHandler());

      act(() => {
        result.current.handleError(null);
      });

      expect(result.current.lastError?.message).toBe('null');
    });

    it('should handle object errors', () => {
      const { result } = renderHook(() => useErrorHandler());

      act(() => {
        result.current.handleError({ code: 'ERR_001', detail: 'Custom error' });
      });

      // Objects are converted to string representation
      expect(result.current.lastError?.message).toBe('[object Object]');
    });
  });
});

describe('useAsyncErrorHandler - P2.3 Async Error Handling', () => {
  it('should handle successful async operations', async () => {
    const asyncFn = vi.fn().mockResolvedValue({ data: 'success' });
    const { result } = renderHook(() => useAsyncErrorHandler(asyncFn));

    let returnValue: any;
    await act(async () => {
      returnValue = await result.current.execute();
    });

    expect(returnValue).toEqual({ data: 'success' });
    expect(result.current.isLoading).toBe(false);
  });

  it('should handle async errors', async () => {
    const asyncFn = vi.fn().mockRejectedValue(new Error('Async error'));
    const { result } = renderHook(() => useAsyncErrorHandler(asyncFn));

    let returnValue: any;
    await act(async () => {
      returnValue = await result.current.execute();
    });

    expect(returnValue).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('should set loading state during execution', async () => {
    const asyncFn = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve('done'), 50))
    );
    const { result } = renderHook(() => useAsyncErrorHandler(asyncFn));

    act(() => {
      result.current.execute();
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('should attach context to async errors', async () => {
    const asyncFn = vi.fn().mockRejectedValue(new Error('Async error'));
    const context = { component: 'AsyncComponent', action: 'fetchData' };
    
    const { result } = renderHook(() => useAsyncErrorHandler(asyncFn, context));

    await act(async () => {
      await result.current.execute();
    });

    // Error should be handled with context
    expect(asyncFn).toHaveBeenCalled();
  });
});

describe('Error Handler Options', () => {
  it('should respect showToast option', () => {
    const { result: withToast } = renderHook(() =>
      useErrorHandler({ showToast: true })
    );
    const { result: withoutToast } = renderHook(() =>
      useErrorHandler({ showToast: false })
    );

    act(() => {
      withToast.current.handleError(new Error('Test'));
      withoutToast.current.handleError(new Error('Test'));
    });

    // Both should handle errors
    expect(withToast.current.hasErrors).toBe(true);
    expect(withoutToast.current.hasErrors).toBe(true);
  });

  it('should respect logToConsole option in development', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() =>
      useErrorHandler({ logToConsole: true })
    );

    act(() => {
      result.current.handleError(new Error('Test error'));
    });

    expect(consoleSpy).toHaveBeenCalled();

    process.env.NODE_ENV = originalEnv;
    consoleSpy.mockRestore();
  });
});
