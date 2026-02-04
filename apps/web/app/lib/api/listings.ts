import { api } from "~/lib/api-client";
import { withRetry, parseApiError, ApiError } from "~/lib/api-error";
import type {
  Listing,
  CreateListingRequest,
  UpdateListingRequest,
  ListingSearchParams,
  ListingSearchResponse,
  Category,
} from "~/types/listing";

// Circuit breaker for search requests
import { CircuitBreaker } from "~/lib/api-error";
const searchCircuitBreaker = new CircuitBreaker(5, 30000);

export const listingsApi = {
  async searchListings(
    params: ListingSearchParams
  ): Promise<ListingSearchResponse> {
    return searchCircuitBreaker.execute(async () => {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });

      return withRetry(
        () =>
          api.get<ListingSearchResponse>(
            `/listings/search?${queryParams.toString()}`
          ),
        { maxRetries: 2, delayMs: 500 }
      );
    });
  },

  async getListingById(id: string): Promise<Listing> {
    return withRetry(() => api.get<Listing>(`/listings/${id}`), {
      maxRetries: 2,
    });
  },

  async getListingsByOwnerId(ownerId: string): Promise<ListingSearchResponse> {
    return api.get<ListingSearchResponse>(`/listings?ownerId=${ownerId}`);
  },

  async getFavoriteListings(userId: string): Promise<Listing[]> {
    return api.get<Listing[]>(`/favorites?userId=${userId}`);
  },

  async addFavorite(listingId: string): Promise<void> {
    return api.post<void>(`/favorites`, { listingId });
  },

  async removeFavorite(listingId: string): Promise<void> {
    return api.delete<void>(`/favorites/${listingId}`);
  },

  async getRecommendations(userId: string): Promise<Listing[]> {
    return api.get<Listing[]>(`/listings/recommendations?userId=${userId}`);
  },

  async getMyListings(): Promise<Listing[]> {
    return api.get<Listing[]>("/listings/my-listings");
  },

  async createListing(data: CreateListingRequest): Promise<Listing> {
    return api.post<Listing>("/listings", data);
  },

  async updateListing(
    id: string,
    data: UpdateListingRequest
  ): Promise<Listing> {
    return api.patch<Listing>(`/listings/${id}`, data);
  },

  async deleteListing(id: string): Promise<void> {
    return api.delete<void>(`/listings/${id}`);
  },

  async uploadImages(id: string, files: File[]): Promise<{ urls: string[] }> {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("images", file);
    });
    return api.post<{ urls: string[] }>(`/listings/${id}/images`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },

  async deleteImage(id: string, imageUrl: string): Promise<void> {
    return api.delete<void>(`/listings/${id}/images`, {
      data: { imageUrl },
    });
  },

  async getCategories(): Promise<Category[]> {
    return api.get<Category[]>("/categories");
  },

  async getFeaturedListings(): Promise<Listing[]> {
    return api.get<Listing[]>("/listings/featured");
  },

  async getNearbyListings(
    lat: number,
    lng: number,
    radius: number
  ): Promise<Listing[]> {
    return api.get<Listing[]>(
      `/listings/nearby?lat=${lat}&lng=${lng}&radius=${radius}`
    );
  },

  async updateAvailability(
    id: string,
    availability: "available" | "rented" | "maintenance"
  ): Promise<Listing> {
    return api.patch<Listing>(`/listings/${id}/availability`, {
      availability,
    });
  },
};

// Re-export error utilities for convenience
export { parseApiError, type ApiError };
