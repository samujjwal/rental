import { api } from "~/lib/api-client";
import { withRetry, parseApiError, ApiError } from "~/lib/api-error";
import { APP_CURRENCY } from "~/config/locale";
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

type SearchResult = {
  id: string;
  title: string;
  description: string;
  slug: string;
  categoryName: string;
  categorySlug: string;
  city: string;
  state: string;
  country: string;
  location?: { lat?: number; lon?: number };
  basePrice: number;
  currency: string;
  photos: string[];
  ownerName: string;
  ownerRating: number;
  averageRating: number;
  totalReviews: number;
  bookingMode?: string;
  condition?: Listing["condition"];
  features?: string[];
};

type SearchResponse = {
  results: SearchResult[];
  total: number;
  page: number;
  size: number;
};

function mapSearchResponse(response: SearchResponse): ListingSearchResponse {
  const size = response.size || 20;
  const listings: Listing[] = response.results.map((listing) => ({
    id: listing.id,
    ownerId: "",
    title: listing.title,
    description: listing.description,
    category: listing.categoryName || listing.categorySlug || "",
    subcategory: null,
    basePrice: Number(listing.basePrice || 0),
    pricePerWeek: null,
    pricePerMonth: null,
    currency: listing.currency || APP_CURRENCY,
    condition: listing.condition || "good",
    location: {
      address: "",
      city: listing.city || "",
      state: listing.state || "",
      country: listing.country || "",
      postalCode: "",
      coordinates: {
        lat: listing.location?.lat as number,
        lng: listing.location?.lon as number,
      },
    },
    photos: listing.photos || [],
    availability: "available",
    availabilitySchedule: { startDate: null, endDate: null },
    instantBooking: listing.bookingMode === "INSTANT_BOOK",
    deliveryOptions: { pickup: true, delivery: false, shipping: false },
    deliveryRadius: null,
    deliveryFee: null,
    securityDeposit: 0,
    minimumRentalPeriod: 1,
    maximumRentalPeriod: null,
    cancellationPolicy: "moderate",
    rules: null,
    features: listing.features || [],
    rating: listing.averageRating ?? null,
    totalReviews: listing.totalReviews ?? 0,
    totalBookings: 0,
    views: 0,
    featured: false,
    verified: false,
    owner: {
      id: "",
      firstName: listing.ownerName?.split(" ")[0] || "",
      lastName: listing.ownerName?.split(" ").slice(1).join(" ") || null,
      avatar: null,
      rating: listing.ownerRating ?? null,
      verified: false,
    },
    createdAt: "",
    updatedAt: "",
  }));

  return {
    listings,
    total: response.total,
    page: response.page || 1,
    limit: size,
    totalPages: Math.ceil(response.total / size),
  };
}

export const listingsApi = {
  async searchListings(
    params: ListingSearchParams
  ): Promise<ListingSearchResponse> {
    return searchCircuitBreaker.execute(async () => {
      const normalizedQuery =
        typeof params.query === "string" && params.query.trim()
          ? params.query.trim()
          : undefined;
      const normalizedLocation =
        typeof params.location === "string" && params.location.trim()
          ? params.location.trim()
          : undefined;
      // If user searches by location text only, treat it as a query term too.
      const effectiveQuery = normalizedQuery || normalizedLocation;
      const hasGeoSearch =
        typeof params.lat === "number" &&
        typeof params.lng === "number" &&
        typeof params.radius === "number";

      const sortMap: Record<string, string> = {
        "price-asc": "price_asc",
        "price-desc": "price_desc",
        rating: "rating",
        newest: "newest",
        popular: "relevance",
        distance: "distance",
      };

      if (hasGeoSearch) {
        const queryParams = new URLSearchParams();

        if (effectiveQuery) queryParams.append("query", String(effectiveQuery));
        if (params.category)
          queryParams.append("categoryId", String(params.category));
        if (params.lat != null) queryParams.append("lat", String(params.lat));
        if (params.lng != null) queryParams.append("lon", String(params.lng));
        if (params.radius != null)
          queryParams.append("radius", String(params.radius));
        if (params.minPrice != null)
          queryParams.append("minPrice", String(params.minPrice));
        if (params.maxPrice != null)
          queryParams.append("maxPrice", String(params.maxPrice));
        if (params.condition)
          queryParams.append("condition", String(params.condition));
        if (params.instantBooking)
          queryParams.append("bookingMode", "INSTANT_BOOK");
        if (params.delivery)
          queryParams.append("delivery", "true");
        if (params.page != null) queryParams.append("page", String(params.page));
        if (params.limit != null) queryParams.append("size", String(params.limit));
        if (params.sortBy) {
          const sortMap: Record<
            NonNullable<ListingSearchParams["sortBy"]>,
            string
          > = {
            "price-asc": "price_asc",
            "price-desc": "price_desc",
            rating: "rating",
            newest: "newest",
            popular: "relevance",
            distance: "distance",
          };
          queryParams.append("sort", sortMap[params.sortBy]);
        }

        const response = await withRetry(
          () => api.get<SearchResponse>(`/search?${queryParams.toString()}`),
          { maxRetries: 2, delayMs: 500 }
        );

        if (response.total === 0 && effectiveQuery) {
          // Retry without geo params as fallback
          const fallbackParams = new URLSearchParams();
          if (effectiveQuery) fallbackParams.append("query", effectiveQuery);
          if (params.category) fallbackParams.append("categoryId", String(params.category));
          if (params.minPrice != null) fallbackParams.append("minPrice", String(params.minPrice));
          if (params.maxPrice != null) fallbackParams.append("maxPrice", String(params.maxPrice));
          if (params.condition) fallbackParams.append("condition", String(params.condition));
          if (params.instantBooking) fallbackParams.append("bookingMode", "INSTANT_BOOK");
          if (params.delivery) fallbackParams.append("delivery", "true");
          if (params.page != null) fallbackParams.append("page", String(params.page));
          if (params.limit != null) fallbackParams.append("size", String(params.limit));
          if (params.sortBy && params.sortBy !== "distance") {
            fallbackParams.append("sort", sortMap[params.sortBy] || "relevance");
          }

          const fallback = await withRetry(
            () => api.get<SearchResponse>(`/search?${fallbackParams.toString()}`),
            { maxRetries: 2, delayMs: 500 }
          );

          return mapSearchResponse(fallback);
        }

        return mapSearchResponse(response);
      }

      // Non-geo search: also use /search
      const queryParams = new URLSearchParams();
      if (effectiveQuery) queryParams.append("query", effectiveQuery);
      if (params.category) queryParams.append("categoryId", String(params.category));
      if (params.minPrice != null) queryParams.append("minPrice", String(params.minPrice));
      if (params.maxPrice != null) queryParams.append("maxPrice", String(params.maxPrice));
      if (params.condition) queryParams.append("condition", String(params.condition));
      if (params.instantBooking) queryParams.append("bookingMode", "INSTANT_BOOK");
      if (params.delivery) queryParams.append("delivery", "true");
      if (params.page != null) queryParams.append("page", String(params.page));
      if (params.limit != null) queryParams.append("size", String(params.limit));
      if (params.sortBy) {
        queryParams.append("sort", sortMap[params.sortBy] || "relevance");
      }

      const response = await withRetry(
        () => api.get<SearchResponse>(`/search?${queryParams.toString()}`),
        { maxRetries: 2, delayMs: 500 }
      );

      return mapSearchResponse(response);
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
    const response = await api.get<{
      favorites: Array<{
        createdAt: string;
        listing: Listing;
      }>;
    }>("/favorites");
    return (response.favorites || []).map((favorite) => ({
      ...favorite.listing,
      savedAt: favorite.createdAt,
    }));
  },

  async addFavorite(listingId: string): Promise<void> {
    return api.post<void>(`/favorites`, { listingId });
  },

  async removeFavorite(listingId: string): Promise<void> {
    return api.delete<void>(`/favorites/${listingId}`);
  },

  async getRecommendations(userId: string): Promise<Listing[]> {
    const response = await api.get<{ listings: Listing[] }>(`/listings?limit=8`);
    return response.listings || [];
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

  async publishListing(id: string): Promise<void> {
    return api.post<void>(`/listings/${id}/publish`);
  },

  async pauseListing(id: string): Promise<void> {
    return api.post<void>(`/listings/${id}/pause`);
  },

  async activateListing(id: string): Promise<void> {
    return api.post<void>(`/listings/${id}/activate`);
  },

  async uploadImages(id: string, files: File[]): Promise<{ urls: string[] }> {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("photos", file);
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

  async getFeaturedListings(limit = 8): Promise<Listing[]> {
    const response = await api.get<
      Listing[] | { listings?: Listing[]; total?: number; page?: number; limit?: number }
    >(`/listings/featured?limit=${limit}`);
    if (Array.isArray(response)) {
      return response;
    }
    return Array.isArray(response.listings) ? response.listings : [];
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

  async getPriceSuggestion(params: {
    categoryId?: string;
    city?: string;
    condition?: string;
  }): Promise<{
    averagePrice: number;
    medianPrice: number;
    minPrice: number;
    maxPrice: number;
    suggestedRange: { low: number; high: number };
    sampleSize: number;
  }> {
    const searchParams = new URLSearchParams();
    if (params.categoryId) searchParams.set("categoryId", params.categoryId);
    if (params.city) searchParams.set("city", params.city);
    if (params.condition) searchParams.set("condition", params.condition);
    return api.get(`/listings/price-suggestion?${searchParams.toString()}`);
  },
};

// Re-export error utilities for convenience
export { parseApiError, type ApiError };
