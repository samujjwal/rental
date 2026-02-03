import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getFavorites,
  getFavoriteByListingId,
  addFavorite,
  removeFavorite,
  toggleFavorite,
  getFavoritesCount,
  bulkAddFavorites,
  bulkRemoveFavorites,
  clearAllFavorites,
  type Favorite,
  type FavoritesResponse,
} from "~/lib/api/favorites";
import { toast } from "~/lib/toast";
import { useAuthStore } from "~/lib/store/auth";

/**
 * Query keys for favorites
 */
export const favoritesKeys = {
  all: ["favorites"] as const,
  lists: () => [...favoritesKeys.all, "list"] as const,
  list: (params?: any) => [...favoritesKeys.lists(), params] as const,
  details: () => [...favoritesKeys.all, "detail"] as const,
  detail: (listingId: string) =>
    [...favoritesKeys.details(), listingId] as const,
  count: () => [...favoritesKeys.all, "count"] as const,
};

/**
 * Hook to get all favorites
 */
export function useFavorites(params?: {
  page?: number;
  limit?: number;
  sortBy?: "createdAt" | "price" | "title";
  sortOrder?: "asc" | "desc";
  category?: string;
}) {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: favoritesKeys.list(params),
    queryFn: () => getFavorites(params),
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to check if listing is favorited
 */
export function useIsFavorited(listingId: string) {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: favoritesKeys.detail(listingId),
    queryFn: () => getFavoriteByListingId(listingId),
    enabled: isAuthenticated && !!listingId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to get favorites count
 */
export function useFavoritesCount() {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: favoritesKeys.count(),
    queryFn: getFavoritesCount,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to add favorite with optimistic update
 */
export function useAddFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addFavorite,
    onMutate: async ({ listingId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: favoritesKeys.detail(listingId),
      });
      await queryClient.cancelQueries({ queryKey: favoritesKeys.lists() });
      await queryClient.cancelQueries({ queryKey: favoritesKeys.count() });

      // Snapshot previous values
      const previousFavorite = queryClient.getQueryData(
        favoritesKeys.detail(listingId)
      );
      const previousList = queryClient.getQueryData(favoritesKeys.lists());
      const previousCount = queryClient.getQueryData(favoritesKeys.count());

      // Optimistically update detail
      queryClient.setQueryData(favoritesKeys.detail(listingId), {
        id: "temp-id",
        listingId,
        userId: "temp-user-id",
        createdAt: new Date().toISOString(),
      });

      // Optimistically update count
      if (typeof previousCount === "number") {
        queryClient.setQueryData(favoritesKeys.count(), previousCount + 1);
      }

      return { previousFavorite, previousList, previousCount };
    },
    onError: (error, { listingId }, context) => {
      // Rollback on error
      if (context?.previousFavorite !== undefined) {
        queryClient.setQueryData(
          favoritesKeys.detail(listingId),
          context.previousFavorite
        );
      }
      if (context?.previousCount !== undefined) {
        queryClient.setQueryData(favoritesKeys.count(), context.previousCount);
      }
      toast.error("Failed to add favorite");
    },
    onSuccess: (data, { listingId }) => {
      // Update with real data
      queryClient.setQueryData(favoritesKeys.detail(listingId), data);
      toast.success("Added to favorites");
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: favoritesKeys.lists() });
      queryClient.invalidateQueries({ queryKey: favoritesKeys.count() });
    },
  });
}

/**
 * Hook to remove favorite with optimistic update
 */
export function useRemoveFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeFavorite,
    onMutate: async ({ listingId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: favoritesKeys.detail(listingId),
      });
      await queryClient.cancelQueries({ queryKey: favoritesKeys.lists() });
      await queryClient.cancelQueries({ queryKey: favoritesKeys.count() });

      // Snapshot previous values
      const previousFavorite = queryClient.getQueryData(
        favoritesKeys.detail(listingId)
      );
      const previousCount = queryClient.getQueryData(favoritesKeys.count());

      // Optimistically remove
      queryClient.setQueryData(favoritesKeys.detail(listingId), null);

      // Optimistically update count
      if (typeof previousCount === "number") {
        queryClient.setQueryData(
          favoritesKeys.count(),
          Math.max(0, previousCount - 1)
        );
      }

      return { previousFavorite, previousCount };
    },
    onError: (error, { listingId }, context) => {
      // Rollback on error
      if (context?.previousFavorite !== undefined) {
        queryClient.setQueryData(
          favoritesKeys.detail(listingId),
          context.previousFavorite
        );
      }
      if (context?.previousCount !== undefined) {
        queryClient.setQueryData(favoritesKeys.count(), context.previousCount);
      }
      toast.error("Failed to remove favorite");
    },
    onSuccess: (data, { listingId }) => {
      toast.success("Removed from favorites");
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: favoritesKeys.lists() });
      queryClient.invalidateQueries({ queryKey: favoritesKeys.count() });
    },
  });
}

/**
 * Hook to toggle favorite with optimistic update
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ listingId }: { listingId: string }) =>
      toggleFavorite(listingId),
    onMutate: async ({ listingId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: favoritesKeys.detail(listingId),
      });
      await queryClient.cancelQueries({ queryKey: favoritesKeys.count() });

      // Snapshot previous values
      const previousFavorite = queryClient.getQueryData(
        favoritesKeys.detail(listingId)
      );
      const previousCount = queryClient.getQueryData(favoritesKeys.count());

      // Optimistically toggle
      const isFavorited = previousFavorite !== null;
      if (isFavorited) {
        queryClient.setQueryData(favoritesKeys.detail(listingId), null);
        if (typeof previousCount === "number") {
          queryClient.setQueryData(
            favoritesKeys.count(),
            Math.max(0, previousCount - 1)
          );
        }
      } else {
        queryClient.setQueryData(favoritesKeys.detail(listingId), {
          id: "temp-id",
          listingId,
          userId: "temp-user-id",
          createdAt: new Date().toISOString(),
        });
        if (typeof previousCount === "number") {
          queryClient.setQueryData(favoritesKeys.count(), previousCount + 1);
        }
      }

      return { previousFavorite, previousCount, isFavorited };
    },
    onError: (error, { listingId }, context) => {
      // Rollback on error
      if (context?.previousFavorite !== undefined) {
        queryClient.setQueryData(
          favoritesKeys.detail(listingId),
          context.previousFavorite
        );
      }
      if (context?.previousCount !== undefined) {
        queryClient.setQueryData(favoritesKeys.count(), context.previousCount);
      }
      toast.error("Failed to update favorite");
    },
    onSuccess: (data, { listingId }, context) => {
      // Update with real data
      if (data.isFavorited && data.favorite) {
        queryClient.setQueryData(
          favoritesKeys.detail(listingId),
          data.favorite
        );
      } else {
        queryClient.setQueryData(favoritesKeys.detail(listingId), null);
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: favoritesKeys.lists() });
      queryClient.invalidateQueries({ queryKey: favoritesKeys.count() });
    },
  });
}

/**
 * Hook to bulk add favorites
 */
export function useBulkAddFavorites() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: bulkAddFavorites,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: favoritesKeys.all });
      toast.success("Added to favorites");
    },
    onError: () => {
      toast.error("Failed to add favorites");
    },
  });
}

/**
 * Hook to bulk remove favorites
 */
export function useBulkRemoveFavorites() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: bulkRemoveFavorites,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: favoritesKeys.all });
      toast.success("Removed from favorites");
    },
    onError: () => {
      toast.error("Failed to remove favorites");
    },
  });
}

/**
 * Hook to clear all favorites
 */
export function useClearAllFavorites() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: clearAllFavorites,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: favoritesKeys.all });
      toast.success("All favorites cleared");
    },
    onError: () => {
      toast.error("Failed to clear favorites");
    },
  });
}
