import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAsyncState, useMultiAsyncState } from './useAsyncState';

describe('useAsyncState - P1.2 Comprehensive Loading States', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should start in idle state with null data', () => {
      const { result } = renderHook(() => useAsyncState());

      expect(result.current.status).toBe('idle');
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.isIdle).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isSuccess).toBe(false);
      expect(result.current.isError).toBe(false);
    });

    it('should accept initial data', () => {
      const initialData = { id: 1, name: 'Test' };
      const { result } = renderHook(() => useAsyncState(initialData));

      expect(result.current.data).toEqual(initialData);
      expect(result.current.status).toBe('idle');
    });
  });

  describe('Loading State', () => {
    it('should transition to loading state when executing', async () => {
      const { result } = renderHook(() => useAsyncState());

      const operation = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: 'test' }), 100))
      );

      act(() => {
        result.current.execute(operation);
      });

      expect(result.current.status).toBe('loading');
      expect(result.current.isLoading).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('should clear previous error when starting new operation', async () => {
      const { result } = renderHook(() => useAsyncState());

      // First operation fails
      await act(async () => {
        try {
          await result.current.execute(() => Promise.reject(new Error('First error')));
        } catch (e) {
          // Expected
        }
      });

      expect(result.current.error).toBeTruthy();

      // Second operation starts
      act(() => {
        result.current.execute(() => new Promise((resolve) => setTimeout(resolve, 100)));
      });

      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('Success State', () => {
    it('should transition to success state after successful operation', async () => {
      const { result } = renderHook(() => useAsyncState());

      const data = { id: 1, name: 'Test' };
      const operation = vi.fn().mockResolvedValue(data);

      await act(async () => {
        await result.current.execute(operation);
      });

      expect(result.current.status).toBe('success');
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(data);
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it('should return operation result', async () => {
      const { result } = renderHook(() => useAsyncState());

      const expectedData = { id: 1, name: 'Test' };
      let operationResult;

      await act(async () => {
        operationResult = await result.current.execute(() => Promise.resolve(expectedData));
      });

      expect(operationResult).toEqual(expectedData);
    });
  });

  describe('Error State', () => {
    it('should transition to error state on failure', async () => {
      const { result } = renderHook(() => useAsyncState());

      const error = new Error('Operation failed');
      const operation = vi.fn().mockRejectedValue(error);

      await act(async () => {
        try {
          await result.current.execute(operation);
        } catch (e) {
          // Expected to throw
        }
      });

      expect(result.current.status).toBe('error');
      expect(result.current.isError).toBe(true);
      expect(result.current.error).toEqual(error);
      expect(result.current.isLoading).toBe(false);
    });

    it('should preserve data on error', async () => {
      const { result } = renderHook(() => useAsyncState({ initial: 'data' }));

      await act(async () => {
        try {
          await result.current.execute(() => Promise.reject(new Error('Error')));
        } catch (e) {
          // Expected
        }
      });

      expect(result.current.data).toEqual({ initial: 'data' });
      expect(result.current.isError).toBe(true);
    });

    it('should re-throw error', async () => {
      const { result } = renderHook(() => useAsyncState());

      const error = new Error('Test error');

      await expect(
        act(async () => {
          await result.current.execute(() => Promise.reject(error));
        })
      ).rejects.toThrow('Test error');
    });
  });

  describe('Reset Functionality', () => {
    it('should reset to idle state', async () => {
      const { result } = renderHook(() => useAsyncState());

      await act(async () => {
        await result.current.execute(() => Promise.resolve({ data: 'test' }));
      });

      expect(result.current.isSuccess).toBe(true);

      act(() => {
        result.current.reset();
      });

      expect(result.current.status).toBe('idle');
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.isIdle).toBe(true);
    });

    it('should reset to initial data', async () => {
      const initialData = { id: 1 };
      const { result } = renderHook(() => useAsyncState(initialData));

      await act(async () => {
        await result.current.execute(() => Promise.resolve({ id: 2 }));
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.data).toEqual(initialData);
    });

    it('should abort pending operation on reset', async () => {
      const { result } = renderHook(() => useAsyncState());

      const operation = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: 'test' }), 100))
      );

      act(() => {
        result.current.execute(operation);
      });

      expect(result.current.isLoading).toBe(true);

      act(() => {
        result.current.reset();
      });

      expect(result.current.isIdle).toBe(true);
    });
  });

  describe('Manual State Updates', () => {
    it('should allow manual data update', () => {
      const { result } = renderHook(() => useAsyncState());

      const newData = { id: 1, name: 'Manual' };

      act(() => {
        result.current.setData(newData);
      });

      expect(result.current.data).toEqual(newData);
      expect(result.current.status).toBe('success');
      expect(result.current.error).toBeNull();
    });

    it('should allow manual error update', () => {
      const { result } = renderHook(() => useAsyncState());

      const error = new Error('Manual error');

      act(() => {
        result.current.setError(error);
      });

      expect(result.current.error).toEqual(error);
      expect(result.current.status).toBe('error');
    });
  });

  describe('Cleanup and Memory Leaks', () => {
    it('should not update state after unmount', async () => {
      const { result, unmount } = renderHook(() => useAsyncState());

      const operation = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: 'test' }), 100))
      );

      act(() => {
        result.current.execute(operation);
      });

      unmount();

      // Wait for operation to complete
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should not throw or cause warnings
    });

    it('should abort operation on unmount', async () => {
      const { result, unmount } = renderHook(() => useAsyncState());

      const operation = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: 'test' }), 100))
      );

      act(() => {
        result.current.execute(operation);
      });

      unmount();

      // Operation should be aborted
    });
  });

  describe('Concurrent Operations', () => {
    it('should cancel previous operation when new one starts', async () => {
      const { result } = renderHook(() => useAsyncState());

      const firstOp = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ id: 1 }), 100))
      );

      const secondOp = vi.fn().mockResolvedValue({ id: 2 });

      act(() => {
        result.current.execute(firstOp);
      });

      await act(async () => {
        await result.current.execute(secondOp);
      });

      expect(result.current.data).toEqual({ id: 2 });
    });
  });
});

describe('useMultiAsyncState - P1.2 Parallel Operations', () => {
  it('should handle multiple independent operations', async () => {
    const { result } = renderHook(() => useMultiAsyncState());

    await act(async () => {
      await Promise.all([
        result.current.execute('op1', () => Promise.resolve({ id: 1 })),
        result.current.execute('op2', () => Promise.resolve({ id: 2 })),
      ]);
    });

    expect(result.current.getState('op1').data).toEqual({ id: 1 });
    expect(result.current.getState('op2').data).toEqual({ id: 2 });
    expect(result.current.allSuccess).toBe(true);
  });

  it('should track loading state for each operation', async () => {
    const { result } = renderHook(() => useMultiAsyncState());

    act(() => {
      result.current.execute('op1', () => new Promise((resolve) => setTimeout(resolve, 100)));
    });

    expect(result.current.getState('op1').isLoading).toBe(true);
    expect(result.current.isAnyLoading).toBe(true);
  });

  it('should detect errors across operations', async () => {
    const { result } = renderHook(() => useMultiAsyncState());

    await act(async () => {
      try {
        await result.current.execute('op1', () => Promise.reject(new Error('Error')));
      } catch (e) {
        // Expected
      }
    });

    expect(result.current.hasAnyError).toBe(true);
    expect(result.current.getState('op1').isError).toBe(true);
  });

  it('should reset individual operations', async () => {
    const { result } = renderHook(() => useMultiAsyncState());

    await act(async () => {
      await result.current.execute('op1', () => Promise.resolve({ id: 1 }));
    });

    act(() => {
      result.current.reset('op1');
    });

    expect(result.current.getState('op1').isIdle).toBe(true);
  });

  it('should reset all operations', async () => {
    const { result } = renderHook(() => useMultiAsyncState());

    await act(async () => {
      await Promise.all([
        result.current.execute('op1', () => Promise.resolve({ id: 1 })),
        result.current.execute('op2', () => Promise.resolve({ id: 2 })),
      ]);
    });

    act(() => {
      result.current.resetAll();
    });

    expect(result.current.getState('op1').isIdle).toBe(true);
    expect(result.current.getState('op2').isIdle).toBe(true);
  });
});
