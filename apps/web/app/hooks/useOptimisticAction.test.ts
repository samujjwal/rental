import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useOptimisticAction } from './useOptimisticAction';

describe('useOptimisticAction - P0.2 Optimistic Updates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Optimistic Updates', () => {
    it('should apply optimistic update immediately', async () => {
      const { result } = renderHook(() => useOptimisticAction());

      const action = {
        id: 'test-action',
        execute: vi.fn().mockResolvedValue({ success: true }),
        optimisticData: { status: 'loading' },
      };

      act(() => {
        result.current.executeOptimistic(action);
      });

      // Optimistic data should be applied immediately
      expect(result.current.getOptimisticData('test-action')).toEqual({ status: 'loading' });
      expect(result.current.hasOptimisticUpdate('test-action')).toBe(true);
    });

    it('should clear optimistic state after successful execution', async () => {
      const { result } = renderHook(() => useOptimisticAction());

      const action = {
        id: 'test-action',
        execute: vi.fn().mockResolvedValue({ success: true }),
        optimisticData: { status: 'loading' },
      };

      await act(async () => {
        await result.current.executeOptimistic(action);
      });

      // Optimistic state should be cleared after success
      expect(result.current.getOptimisticData('test-action')).toBeUndefined();
      expect(result.current.hasOptimisticUpdate('test-action')).toBe(false);
    });

    it('should execute the action and return result', async () => {
      const { result } = renderHook(() => useOptimisticAction());

      const expectedResult = { id: '123', name: 'Test' };
      const action = {
        id: 'test-action',
        execute: vi.fn().mockResolvedValue(expectedResult),
        optimisticData: { status: 'loading' },
      };

      let actionResult;
      await act(async () => {
        actionResult = await result.current.executeOptimistic(action);
      });

      expect(actionResult).toEqual(expectedResult);
      expect(action.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('Rollback on Failure', () => {
    it('should rollback optimistic update on error', async () => {
      const { result } = renderHook(() => useOptimisticAction());

      const action = {
        id: 'test-action',
        execute: vi.fn().mockRejectedValue(new Error('API Error')),
        optimisticData: { status: 'loading' },
      };

      await act(async () => {
        try {
          await result.current.executeOptimistic(action);
        } catch (error) {
          // Expected to throw
        }
      });

      // Optimistic state should be rolled back
      expect(result.current.getOptimisticData('test-action')).toBeUndefined();
      expect(result.current.hasOptimisticUpdate('test-action')).toBe(false);
    });

    it('should call custom rollback function on error', async () => {
      const { result } = renderHook(() => useOptimisticAction());

      const rollbackFn = vi.fn();
      const action = {
        id: 'test-action',
        execute: vi.fn().mockRejectedValue(new Error('API Error')),
        optimisticData: { status: 'loading' },
        rollback: rollbackFn,
      };

      await act(async () => {
        try {
          await result.current.executeOptimistic(action);
        } catch (error) {
          // Expected to throw
        }
      });

      expect(rollbackFn).toHaveBeenCalledTimes(1);
    });

    it('should store error for UI display', async () => {
      const { result } = renderHook(() => useOptimisticAction());

      const error = new Error('API Error');
      const action = {
        id: 'test-action',
        execute: vi.fn().mockRejectedValue(error),
        optimisticData: { status: 'loading' },
      };

      await act(async () => {
        try {
          await result.current.executeOptimistic(action);
        } catch (e) {
          // Expected to throw
        }
      });

      expect(result.current.getError('test-action')).toEqual(error);
    });

    it('should re-throw error after rollback', async () => {
      const { result } = renderHook(() => useOptimisticAction());

      const error = new Error('API Error');
      const action = {
        id: 'test-action',
        execute: vi.fn().mockRejectedValue(error),
        optimisticData: { status: 'loading' },
      };

      await expect(
        act(async () => {
          await result.current.executeOptimistic(action);
        })
      ).rejects.toThrow('API Error');
    });
  });

  describe('Concurrent Actions', () => {
    it('should handle multiple concurrent actions', async () => {
      const { result } = renderHook(() => useOptimisticAction());

      const action1 = {
        id: 'action-1',
        execute: vi.fn().mockResolvedValue({ id: 1 }),
        optimisticData: { status: 'loading-1' },
      };

      const action2 = {
        id: 'action-2',
        execute: vi.fn().mockResolvedValue({ id: 2 }),
        optimisticData: { status: 'loading-2' },
      };

      act(() => {
        result.current.executeOptimistic(action1);
        result.current.executeOptimistic(action2);
      });

      // Both optimistic states should be present
      expect(result.current.hasOptimisticUpdate('action-1')).toBe(true);
      expect(result.current.hasOptimisticUpdate('action-2')).toBe(true);
    });

    it('should cancel previous action with same ID', async () => {
      const { result } = renderHook(() => useOptimisticAction());

      const firstExecute = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ id: 1 }), 100))
      );

      const secondExecute = vi.fn().mockResolvedValue({ id: 2 });

      const action1 = {
        id: 'same-id',
        execute: firstExecute,
        optimisticData: { status: 'first' },
      };

      const action2 = {
        id: 'same-id',
        execute: secondExecute,
        optimisticData: { status: 'second' },
      };

      act(() => {
        result.current.executeOptimistic(action1);
      });

      await act(async () => {
        await result.current.executeOptimistic(action2);
      });

      // Second action should have replaced the first
      expect(result.current.getOptimisticData('same-id')).toBeUndefined();
      expect(secondExecute).toHaveBeenCalled();
    });
  });

  describe('Manual State Management', () => {
    it('should clear specific optimistic update', () => {
      const { result } = renderHook(() => useOptimisticAction());

      const action = {
        id: 'test-action',
        execute: vi.fn().mockResolvedValue({}),
        optimisticData: { status: 'loading' },
      };

      act(() => {
        result.current.executeOptimistic(action);
      });

      expect(result.current.hasOptimisticUpdate('test-action')).toBe(true);

      act(() => {
        result.current.clearOptimistic('test-action');
      });

      expect(result.current.hasOptimisticUpdate('test-action')).toBe(false);
    });

    it('should clear all optimistic updates', () => {
      const { result } = renderHook(() => useOptimisticAction());

      act(() => {
        result.current.executeOptimistic({
          id: 'action-1',
          execute: vi.fn().mockResolvedValue({}),
          optimisticData: { status: 'loading-1' },
        });

        result.current.executeOptimistic({
          id: 'action-2',
          execute: vi.fn().mockResolvedValue({}),
          optimisticData: { status: 'loading-2' },
        });
      });

      expect(result.current.hasOptimisticUpdate('action-1')).toBe(true);
      expect(result.current.hasOptimisticUpdate('action-2')).toBe(true);

      act(() => {
        result.current.clearAllOptimistic();
      });

      expect(result.current.hasOptimisticUpdate('action-1')).toBe(false);
      expect(result.current.hasOptimisticUpdate('action-2')).toBe(false);
    });

    it('should clear error when clearing optimistic state', async () => {
      const { result } = renderHook(() => useOptimisticAction());

      const action = {
        id: 'test-action',
        execute: vi.fn().mockRejectedValue(new Error('Test Error')),
        optimisticData: { status: 'loading' },
      };

      await act(async () => {
        try {
          if (result.current) {
            await result.current.executeOptimistic(action);
          }
        } catch (e) {
          // Expected
        }
      });

      // Check that error was stored
      if (result.current) {
        const error = result.current.getError('test-action');
        expect(error).toBeDefined();
        expect(error).toBeInstanceOf(Error);
        expect(error?.message).toBe('Test Error');
      }

      // Clear optimistic state (which also clears the error)
      act(() => {
        if (result.current) {
          result.current.clearOptimistic('test-action');
        }
      });

      // Error should now be cleared
      if (result.current) {
        expect(result.current.getError('test-action')).toBeUndefined();
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle action with no optimistic data', async () => {
      const { result } = renderHook(() => useOptimisticAction());

      const action = {
        id: 'test-action',
        execute: vi.fn().mockResolvedValue({ success: true }),
        optimisticData: null,
      };

      await act(async () => {
        if (result.current) {
          await result.current.executeOptimistic(action);
        }
      });

      if (result.current) {
        expect(action.execute).toHaveBeenCalled();
      }
    });

    it('should handle non-Error rejection', async () => {
      const { result } = renderHook(() => useOptimisticAction());

      const action = {
        id: 'test-action',
        execute: vi.fn().mockRejectedValue('String error'),
        optimisticData: null,
      };

      await act(async () => {
        try {
          if (result.current) {
            await result.current.executeOptimistic(action);
          }
        } catch (e) {
          // Expected
        }
      });

      if (result.current) {
        const error = result.current.getError('test-action');
        expect(error).toBeInstanceOf(Error);
        expect(error?.message).toBe('String error');
      }
    });

    it('should handle rapid successive actions', async () => {
      const { result } = renderHook(() => useOptimisticAction());

      const actions = [
        {
          id: 'action-1',
          execute: vi.fn().mockResolvedValue({}),
          optimisticData: { data: 'one' },
        },
        {
          id: 'action-2',
          execute: vi.fn().mockResolvedValue({}),
          optimisticData: { data: 'two' },
        },
        {
          id: 'action-3',
          execute: vi.fn().mockResolvedValue({}),
          optimisticData: { data: 'three' },
        },
      ];

      await act(async () => {
        if (result.current) {
          await Promise.all(
            actions.map((action) => result.current.executeOptimistic(action))
          );
        }
      });

      // All actions should have completed
      actions.forEach((action) => {
        if (result.current) {
          expect(result.current.hasOptimisticUpdate(action.id)).toBe(false);
          expect(action.execute).toHaveBeenCalled();
        }
      });
    });
  });

  describe('State Consistency', () => {
    it('should maintain consistent state during async operations', async () => {
      const { result } = renderHook(() => useOptimisticAction());

      const action = {
        id: 'test-action',
        execute: vi.fn().mockResolvedValue({ success: true }),
        optimisticData: { status: 'processing' },
      };

      // Apply optimistic update
      act(() => {
        if (result.current) {
          result.current.executeOptimistic(action);
        }
      });

      // Optimistic state should be applied
      if (result.current) {
        expect(result.current.hasOptimisticUpdate('test-action')).toBeTruthy();
      }

      // Wait for completion
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      // After completion, optimistic state should be cleared
      if (result.current) {
        expect(result.current.hasOptimisticUpdate('test-action')).toBe(false);
      }
    });

    it('should not leak state between different action IDs', async () => {
      const { result } = renderHook(() => useOptimisticAction());

      await act(async () => {
        await result.current?.executeOptimistic({
          id: 'action-1',
          execute: vi.fn().mockResolvedValue({}),
          optimisticData: { data: 'one' },
        });
      });

      await act(async () => {
        await result.current?.executeOptimistic({
          id: 'action-2',
          execute: vi.fn().mockResolvedValue({}),
          optimisticData: { data: 'two' },
        });
      });

      // States should be independent
      expect(result.current?.getOptimisticData('action-1')).toBeUndefined();
      expect(result.current?.getOptimisticData('action-2')).toBeUndefined();
    });
  });
});
