import { useState, useCallback, useRef, useEffect } from 'react';

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncState<TData, TError = Error> {
  status: AsyncStatus;
  data: TData | null;
  error: TError | null;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  isIdle: boolean;
}

export interface AsyncStateActions<TData, TError = Error> {
  execute: (operation: () => Promise<TData>) => Promise<TData>;
  reset: () => void;
  setData: (data: TData) => void;
  setError: (error: TError) => void;
}

/**
 * P1.2 FIX: Comprehensive async state management with proper loading states
 * Handles all states: idle, loading, success, error with proper transitions
 */
export function useAsyncState<TData = any, TError = Error>(
  initialData: TData | null = null
): AsyncState<TData, TError> & AsyncStateActions<TData, TError> {
  const [status, setStatus] = useState<AsyncStatus>('idle');
  const [data, setData] = useState<TData | null>(initialData);
  const [error, setError] = useState<TError | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Cleanup: abort any pending operations
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const execute = useCallback(async (operation: () => Promise<TData>): Promise<TData> => {
    // Cancel any pending operation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    // Set loading state
    if (isMountedRef.current) {
      setStatus('loading');
      setError(null);
    }

    try {
      const result = await operation();

      // Only update state if component is still mounted and operation wasn't aborted
      if (isMountedRef.current && !abortControllerRef.current.signal.aborted) {
        setData(result);
        setStatus('success');
        setError(null);
      }

      return result;
    } catch (err) {
      // Only update state if component is still mounted and operation wasn't aborted
      if (isMountedRef.current && !abortControllerRef.current.signal.aborted) {
        const errorObj = err as TError;
        setError(errorObj);
        setStatus('error');
      }

      throw err;
    } finally {
      abortControllerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    // Abort any pending operation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (isMountedRef.current) {
      setStatus('idle');
      setData(initialData);
      setError(null);
    }
  }, [initialData]);

  const setDataCallback = useCallback((newData: TData) => {
    if (isMountedRef.current) {
      setData(newData);
      setStatus('success');
      setError(null);
    }
  }, []);

  const setErrorCallback = useCallback((newError: TError) => {
    if (isMountedRef.current) {
      setError(newError);
      setStatus('error');
    }
  }, []);

  return {
    status,
    data,
    error,
    isLoading: status === 'loading',
    isSuccess: status === 'success',
    isError: status === 'error',
    isIdle: status === 'idle',
    execute,
    reset,
    setData: setDataCallback,
    setError: setErrorCallback,
  };
}

/**
 * P1.2 FIX: Multi-state async management for parallel operations
 * Handles multiple async operations with individual state tracking
 */
export function useMultiAsyncState<TData = any, TError = Error>() {
  const [states, setStates] = useState<Record<string, AsyncState<TData, TError>>>({});

  const execute = useCallback(
    async (key: string, operation: () => Promise<TData>): Promise<TData> => {
      // Set loading state
      setStates((prev) => ({
        ...prev,
        [key]: {
          status: 'loading',
          data: prev[key]?.data || null,
          error: null,
          isLoading: true,
          isSuccess: false,
          isError: false,
          isIdle: false,
        },
      }));

      try {
        const result = await operation();

        setStates((prev) => ({
          ...prev,
          [key]: {
            status: 'success',
            data: result,
            error: null,
            isLoading: false,
            isSuccess: true,
            isError: false,
            isIdle: false,
          },
        }));

        return result;
      } catch (err) {
        const errorObj = err as TError;

        setStates((prev) => ({
          ...prev,
          [key]: {
            status: 'error',
            data: prev[key]?.data || null,
            error: errorObj,
            isLoading: false,
            isSuccess: false,
            isError: true,
            isIdle: false,
          },
        }));

        throw err;
      }
    },
    []
  );

  const reset = useCallback((key: string) => {
    setStates((prev) => {
      const newStates = { ...prev };
      delete newStates[key];
      return newStates;
    });
  }, []);

  const resetAll = useCallback(() => {
    setStates({});
  }, []);

  const getState = useCallback(
    (key: string): AsyncState<TData, TError> => {
      return (
        states[key] || {
          status: 'idle',
          data: null,
          error: null,
          isLoading: false,
          isSuccess: false,
          isError: false,
          isIdle: true,
        }
      );
    },
    [states]
  );

  const isAnyLoading = Object.values(states).some((state) => state.isLoading);
  const hasAnyError = Object.values(states).some((state) => state.isError);
  const allSuccess = Object.values(states).every((state) => state.isSuccess);

  return {
    states,
    execute,
    reset,
    resetAll,
    getState,
    isAnyLoading,
    hasAnyError,
    allSuccess,
  };
}
