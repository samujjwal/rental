import {
  QueryClient,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "./toast";

/**
 * Optimistic update utilities for React Query
 * Provides instant UI feedback while API calls are in progress
 * Based on UX Improvement Guide recommendations
 */

interface OptimisticUpdateOptions<TData, TVariables> {
  queryKey: string[];
  mutationFn: (variables: TVariables) => Promise<TData>;
  updateFn: (oldData: TData | undefined, variables: TVariables) => TData;
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: (data: TData) => void;
  onError?: (error: unknown) => void;
}

/**
 * Create a mutation with optimistic updates
 */
export function useOptimisticMutation<TData, TVariables>({
  queryKey,
  mutationFn,
  updateFn,
  successMessage,
  errorMessage,
  onSuccess,
  onError,
}: OptimisticUpdateOptions<TData, TVariables>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,

    // Optimistic update
    onMutate: async (variables) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous value
      const previousData = queryClient.getQueryData<TData>(queryKey);

      // Optimistically update
      if (previousData) {
        queryClient.setQueryData<TData>(
          queryKey,
          updateFn(previousData, variables)
        );
      }

      return { previousData };
    },

    // Rollback on error
    onError: (error, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }

      if (errorMessage) {
        toast.error(errorMessage);
      }

      onError?.(error);
    },

    // Refetch on success
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey });

      if (successMessage) {
        toast.success(successMessage);
      }

      onSuccess?.(data);
    },
  });
}

/**
 * Optimistic update for adding an item to a list
 */
export function useOptimisticAdd<TItem>(
  queryKey: string[],
  addFn: (item: Partial<TItem>) => Promise<TItem>,
  options: {
    successMessage?: string;
    errorMessage?: string;
  } = {}
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addFn,
    onMutate: async (newItem) => {
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<TItem[]>(queryKey);

      if (previousData) {
        queryClient.setQueryData<TItem[]>(queryKey, [
          ...previousData,
          { ...newItem, id: `temp-${Date.now()}` } as TItem,
        ]);
      }

      return { previousData };
    },
    onError: (error, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      if (options.errorMessage) {
        toast.error(options.errorMessage);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      if (options.successMessage) {
        toast.success(options.successMessage);
      }
    },
  });
}

/**
 * Optimistic update for updating an item in a list
 */
export function useOptimisticUpdate<TItem extends { id: string }>(
  queryKey: string[],
  updateFn: (id: string, updates: Partial<TItem>) => Promise<TItem>,
  options: {
    successMessage?: string;
    errorMessage?: string;
  } = {}
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<TItem> }) =>
      updateFn(id, updates),
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<TItem[]>(queryKey);

      if (previousData) {
        queryClient.setQueryData<TItem[]>(
          queryKey,
          previousData.map((item) =>
            item.id === id ? { ...item, ...updates } : item
          )
        );
      }

      return { previousData };
    },
    onError: (error, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      if (options.errorMessage) {
        toast.error(options.errorMessage);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      if (options.successMessage) {
        toast.success(options.successMessage);
      }
    },
  });
}

/**
 * Optimistic update for removing an item from a list
 */
export function useOptimisticRemove<TItem extends { id: string }>(
  queryKey: string[],
  removeFn: (id: string) => Promise<void>,
  options: {
    successMessage?: string;
    errorMessage?: string;
  } = {}
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeFn,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<TItem[]>(queryKey);

      if (previousData) {
        queryClient.setQueryData<TItem[]>(
          queryKey,
          previousData.filter((item) => item.id !== id)
        );
      }

      return { previousData };
    },
    onError: (error, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      if (options.errorMessage) {
        toast.error(options.errorMessage);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      if (options.successMessage) {
        toast.success(options.successMessage);
      }
    },
  });
}

/**
 * Optimistic update for toggling a boolean property
 */
export function useOptimisticToggle<TItem extends { id: string }>(
  queryKey: string[],
  toggleFn: (id: string, property: keyof TItem) => Promise<TItem>,
  options: {
    successMessage?: string;
    errorMessage?: string;
  } = {}
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, property }: { id: string; property: keyof TItem }) =>
      toggleFn(id, property),
    onMutate: async ({ id, property }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<TItem[]>(queryKey);

      if (previousData) {
        queryClient.setQueryData<TItem[]>(
          queryKey,
          previousData.map((item) =>
            item.id === id ? { ...item, [property]: !item[property] } : item
          )
        );
      }

      return { previousData };
    },
    onError: (error, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      if (options.errorMessage) {
        toast.error(options.errorMessage);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      if (options.successMessage) {
        toast.success(options.successMessage);
      }
    },
  });
}

/**
 * Prefetch data for faster navigation
 */
export function prefetchQuery<TData>(
  queryClient: QueryClient,
  queryKey: string[],
  queryFn: () => Promise<TData>
) {
  return queryClient.prefetchQuery({
    queryKey,
    queryFn,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Invalidate multiple queries at once
 */
export function invalidateQueries(
  queryClient: QueryClient,
  queryKeys: string[][]
) {
  return Promise.all(
    queryKeys.map((key) => queryClient.invalidateQueries({ queryKey: key }))
  );
}
