import React from 'react';
import { Skeleton } from '~/components/ui/skeleton';
import { ErrorState } from '~/components/ui/error-state';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '~/lib/utils';

/**
 * Data Loading State Type
 */
export type DataLoadingState =
  | 'idle'
  | 'loading'
  | 'partial'      // Some data loaded, some pending
  | 'complete'
  | 'error'
  | 'empty';

/**
 * Partial Data Loading Options
 */
interface PartialDataOptions<T> {
  requiredFields?: (keyof T)[];  // Fields that must be present for "complete" state
  minRequiredFields?: number;    // Minimum number of fields required
}

/**
 * Hook for managing partial data loading states
 * Handles graceful degradation when API returns incomplete data
 */
export function usePartialDataLoader<T extends Record<string, unknown>>(
  options: PartialDataOptions<T> = {}
) {
  const { requiredFields = [], minRequiredFields = 1 } = options;

  const [data, setData] = React.useState<Partial<T> | null>(null);
  const [state, setState] = React.useState<DataLoadingState>('idle');
  const [error, setError] = React.useState<Error | null>(null);
  const [loadedFields, setLoadedFields] = React.useState<(keyof T)[]>([]);

  /**
   * Determine if data is sufficiently loaded based on required fields
   */
  const determineLoadingState = React.useCallback((
    newData: Partial<T>,
    isComplete: boolean
  ): DataLoadingState => {
    if (!newData || Object.keys(newData).length === 0) {
      return isComplete ? 'empty' : 'loading';
    }

    const presentFields = Object.keys(newData).filter(
      key => newData[key] !== undefined && newData[key] !== null
    ) as (keyof T)[];

    // Check if all required fields are present
    const requiredFieldsPresent = requiredFields.every(
      field => presentFields.includes(field)
    );

    // Check if minimum field count is met
    const meetsMinimumFields = presentFields.length >= minRequiredFields;

    if (isComplete && requiredFieldsPresent && meetsMinimumFields) {
      return 'complete';
    } else if (meetsMinimumFields) {
      return 'partial';
    } else {
      return 'loading';
    }
  }, [requiredFields, minRequiredFields]);

  /**
   * Update data with partial loading support
   */
  const updateData = React.useCallback((
    newData: Partial<T> | null,
    isComplete: boolean = false,
    error: Error | null = null
  ) => {
    if (error) {
      setError(error);
      setState('error');
      return;
    }

    if (!newData) {
      setData(null);
      setState(isComplete ? 'empty' : 'loading');
      return;
    }

    // Merge with existing data
    const mergedData = { ...data, ...newData } as Partial<T>;
    setData(mergedData);

    // Update loaded fields
    const presentFields = Object.keys(mergedData).filter(
      key => mergedData[key] !== undefined && mergedData[key] !== null
    ) as (keyof T)[];
    setLoadedFields(presentFields);

    // Determine new state
    const newState = determineLoadingState(mergedData, isComplete);
    setState(newState);
  }, [data, determineLoadingState]);

  /**
   * Check if a specific field is loaded
   */
  const isFieldLoaded = React.useCallback((field: keyof T): boolean => {
    return loadedFields.includes(field);
  }, [loadedFields]);

  /**
   * Get loaded data or fallback
   */
  const getField = React.useCallback(<K extends keyof T>(
    field: K,
    fallback?: T[K]
  ): T[K] | undefined => {
    return data?.[field] !== undefined ? (data[field] as T[K]) : fallback;
  }, [data]);

  /**
   * Reset the loader
   */
  const reset = React.useCallback(() => {
    setData(null);
    setState('idle');
    setError(null);
    setLoadedFields([]);
  }, []);

  return {
    data,
    state,
    error,
    loadedFields,
    isFieldLoaded,
    getField,
    updateData,
    reset,
    isLoading: state === 'loading',
    isPartial: state === 'partial',
    isComplete: state === 'complete',
    isError: state === 'error',
    isEmpty: state === 'empty'
  };
}

/**
 * Props for PartialDataContainer component
 */
interface PartialDataContainerProps<T> {
  state: DataLoadingState;
  data: Partial<T> | null;
  error: Error | null;
  children: (data: Partial<T>, isPartial: boolean) => React.ReactNode;
  loadingComponent?: React.ReactNode;
  partialComponent?: React.ReactNode;
  errorComponent?: React.ReactNode;
  emptyComponent?: React.ReactNode;
  className?: string;
  onRetry?: () => void;
}

/**
 * Container component for handling partial data states
 * Provides consistent UI for loading, partial, error, and empty states
 */
export function PartialDataContainer<T extends Record<string, unknown>>({
  state,
  data,
  error,
  children,
  loadingComponent,
  partialComponent,
  errorComponent,
  emptyComponent,
  className,
  onRetry
}: PartialDataContainerProps<T>) {
  // Loading state
  if (state === 'idle' || state === 'loading') {
    if (loadingComponent) {
      return <>{loadingComponent}</>;
    }
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>Loading...</span>
        </div>
        <PartialDataSkeleton />
      </div>
    );
  }

  // Error state
  if (state === 'error') {
    if (errorComponent) {
      return <>{errorComponent}</>;
    }
    return (
      <ErrorState
        title="Failed to Load Data"
        message={error?.message || "We couldn't load the required information. Please try again."}
        icon={<AlertCircle className="h-8 w-8" />}
        onRetry={onRetry}
        className={className}
      />
    );
  }

  // Empty state
  if (state === 'empty' || !data) {
    if (emptyComponent) {
      return <>{emptyComponent}</>;
    }
    return (
      <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
        <div className="rounded-full bg-muted p-4">
          <AlertCircle className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-lg font-medium">No Data Available</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          There's nothing to show here yet.
        </p>
      </div>
    );
  }

  // Partial state - show data with warning
  if (state === 'partial') {
    return (
      <div className={className}>
        {partialComponent || (
          <div className="mb-4 rounded-md border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-900 dark:bg-yellow-900/20">
            <div className="flex items-start gap-3">
              <RefreshCw className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-600 dark:text-yellow-400" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Some information is still loading
                </p>
                <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-300">
                  We're fetching the latest details. Some features may be limited until everything loads.
                </p>
              </div>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="text-xs font-medium text-yellow-800 underline hover:text-yellow-900 dark:text-yellow-200 dark:hover:text-yellow-100"
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        )}
        {children(data, true)}
      </div>
    );
  }

  // Complete state
  return (
    <div className={className}>
      {children(data, false)}
    </div>
  );
}

/**
 * Skeleton component for partial data loading
 */
function PartialDataSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton variant="text" className="h-8 w-3/4" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Skeleton variant="text" className="h-4 w-20" />
          <Skeleton variant="rounded" className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton variant="text" className="h-4 w-20" />
          <Skeleton variant="rounded" className="h-10 w-full" />
        </div>
      </div>
      <Skeleton variant="rounded" className="h-32 w-full" />
      <div className="flex gap-4">
        <Skeleton variant="rounded" className="h-10 w-32" />
        <Skeleton variant="rounded" className="h-10 w-32" />
      </div>
    </div>
  );
}

/**
 * HOC for adding partial data handling to any component
 */
export function withPartialDataHandling<
  T extends Record<string, unknown>,
  P extends { data: T }
>(
  Component: React.ComponentType<P>,
  _options: PartialDataOptions<T> = {}
) {
  return function WrappedComponent(
    props: Omit<P, 'data'> & {
      dataLoader: ReturnType<typeof usePartialDataLoader<T>>;
      loadingComponent?: React.ReactNode;
      partialComponent?: React.ReactNode;
      errorComponent?: React.ReactNode;
      emptyComponent?: React.ReactNode;
      className?: string;
      onRetry?: () => void;
    }
  ) {
    const {
      dataLoader,
      loadingComponent,
      partialComponent,
      errorComponent,
      emptyComponent,
      className,
      onRetry,
      ...componentProps
    } = props;

    return (
      <PartialDataContainer<T>
        state={dataLoader.state}
        data={dataLoader.data}
        error={dataLoader.error}
        className={className}
        onRetry={onRetry}
        loadingComponent={loadingComponent}
        partialComponent={partialComponent}
        errorComponent={errorComponent}
        emptyComponent={emptyComponent}
      >
        {(data) => (
          <Component
            {...componentProps as unknown as P}
            data={data as T}
          />
        )}
      </PartialDataContainer>
    );
  };
}

export default PartialDataContainer;
