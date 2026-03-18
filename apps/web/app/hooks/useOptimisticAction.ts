import { useState, useCallback, useRef } from 'react';

export interface OptimisticAction<TData, TResult> {
  id: string;
  execute: () => Promise<TResult>;
  optimisticData: TData;
  rollback?: () => void;
}

interface OptimisticState<TData> {
  [key: string]: TData;
}

/**
 * P0.2 FIX: Optimistic updates hook with automatic rollback on failure
 * Provides immediate UI feedback while maintaining data consistency
 */
export function useOptimisticAction<TData = any, TResult = any>() {
  const [optimisticState, setOptimisticState] = useState<OptimisticState<TData>>({});
  const [errors, setErrors] = useState<Record<string, Error>>({});
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  const executeOptimistic = useCallback(
    async (action: OptimisticAction<TData, TResult>): Promise<TResult> => {
      const { id, execute, optimisticData, rollback } = action;

      // Cancel any pending action with the same ID
      const existingController = abortControllersRef.current.get(id);
      if (existingController) {
        existingController.abort();
      }

      // Create new abort controller for this action
      const abortController = new AbortController();
      abortControllersRef.current.set(id, abortController);

      // Apply optimistic update immediately
      setOptimisticState((prev) => ({
        ...prev,
        [id]: optimisticData,
      }));

      // Clear any previous error for this action
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[id];
        return newErrors;
      });

      try {
        // Execute the actual operation
        const result = await execute();

        // If not aborted, clear optimistic state (real data should replace it)
        if (!abortController.signal.aborted) {
          setOptimisticState((prev) => {
            const newState = { ...prev };
            delete newState[id];
            return newState;
          });
          abortControllersRef.current.delete(id);
        }

        return result;
      } catch (error) {
        // If not aborted, rollback optimistic update
        if (!abortController.signal.aborted) {
          setOptimisticState((prev) => {
            const newState = { ...prev };
            delete newState[id];
            return newState;
          });

          // Execute custom rollback if provided
          if (rollback) {
            rollback();
          }

          // Store error for UI display
          setErrors((prev) => ({
            ...prev,
            [id]: error instanceof Error ? error : new Error(String(error)),
          }));

          abortControllersRef.current.delete(id);
        }

        throw error;
      }
    },
    []
  );

  const clearOptimistic = useCallback((id: string) => {
    setOptimisticState((prev) => {
      const newState = { ...prev };
      delete newState[id];
      return newState;
    });

    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[id];
      return newErrors;
    });

    const controller = abortControllersRef.current.get(id);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(id);
    }
  }, []);

  const clearAllOptimistic = useCallback(() => {
    setOptimisticState({});
    setErrors({});
    
    // Abort all pending operations
    abortControllersRef.current.forEach((controller) => controller.abort());
    abortControllersRef.current.clear();
  }, []);

  const getOptimisticData = useCallback(
    (id: string): TData | undefined => {
      return optimisticState[id];
    },
    [optimisticState]
  );

  const getError = useCallback(
    (id: string): Error | undefined => {
      return errors[id];
    },
    [errors]
  );

  const hasOptimisticUpdate = useCallback(
    (id: string): boolean => {
      return id in optimisticState;
    },
    [optimisticState]
  );

  return {
    optimisticState,
    errors,
    executeOptimistic,
    clearOptimistic,
    clearAllOptimistic,
    getOptimisticData,
    getError,
    hasOptimisticUpdate,
  };
}
