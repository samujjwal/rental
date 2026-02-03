import { api as apiClient } from "~/lib/api-client";

/**
 * Favorites API Client
 * Handles all favorite-related API operations
 */

export interface Favorite {
  id: string;
  userId: string;
  listingId: string;
  createdAt: string;
  listing?: {
    id: string;
    title: string;
    description: string;
    basePrice: number;
    category: string;
    images: string[];
    location: {
      city: string;
      state: string;
      country: string;
    };
    status: string;
  };
}

export interface FavoritesResponse {
  favorites: Favorite[];
  total: number;
  page: number;
  limit: number;
}

export interface AddFavoriteRequest {
  listingId: string;
}

export interface RemoveFavoriteRequest {
  listingId: string;
}

/**
 * Get all favorites for the current user
 */
export async function getFavorites(params?: {
  page?: number;
  limit?: number;
  sortBy?: "createdAt" | "price" | "title";
  sortOrder?: "asc" | "desc";
  category?: string;
}): Promise<FavoritesResponse> {
  return await apiClient.get<FavoritesResponse>("/favorites", {
    params,
  });
}

/**
 * Get favorite by listing ID
 */
export async function getFavoriteByListingId(
  listingId: string
): Promise<Favorite | null> {
  try {
    return await apiClient.get<Favorite>(`/favorites/listing/${listingId}`);
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Check if listing is favorited
 */
export async function isFavorited(listingId: string): Promise<boolean> {
  try {
    const favorite = await getFavoriteByListingId(listingId);
    return favorite !== null;
  } catch (error) {
    return false;
  }
}

/**
 * Add listing to favorites
 */
export async function addFavorite(
  request: AddFavoriteRequest
): Promise<Favorite> {
  return await apiClient.post<Favorite>("/favorites", request);
}

/**
 * Remove listing from favorites
 */
export async function removeFavorite(
  request: RemoveFavoriteRequest
): Promise<void> {
  await apiClient.delete(`/favorites/listing/${request.listingId}`);
}

/**
 * Toggle favorite status
 */
export async function toggleFavorite(listingId: string): Promise<{
  isFavorited: boolean;
  favorite?: Favorite;
}> {
  const favorite = await getFavoriteByListingId(listingId);

  if (favorite) {
    await removeFavorite({ listingId });
    return { isFavorited: false };
  } else {
    const newFavorite = await addFavorite({ listingId });
    return { isFavorited: true, favorite: newFavorite };
  }
}

/**
 * Get favorites count
 */
export async function getFavoritesCount(): Promise<number> {
  const data = await apiClient.get<{ count: number }>("/favorites/count");
  return data.count;
}

/**
 * Bulk add favorites
 */
export async function bulkAddFavorites(
  listingIds: string[]
): Promise<Favorite[]> {
  return await apiClient.post<Favorite[]>("/favorites/bulk", {
    listingIds,
  });
}

/**
 * Bulk remove favorites
 */
export async function bulkRemoveFavorites(listingIds: string[]): Promise<void> {
  await apiClient.delete("/favorites/bulk", {
    data: { listingIds },
  });
}

/**
 * Clear all favorites
 */
export async function clearAllFavorites(): Promise<void> {
  await apiClient.delete("/favorites/all");
}
