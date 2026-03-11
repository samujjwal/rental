import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockApi, mockWithRetry, mockCircuitBreakerExecute } = vi.hoisted(() => {
  const execute = vi.fn((fn: (...args: any[]) => any) => fn());
  return {
    mockApi: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
    mockWithRetry: vi.fn((fn: (...args: any[]) => any) => fn()),
    mockCircuitBreakerExecute: execute,
  };
});

vi.mock("~/lib/api-client", () => ({
  api: mockApi,
  apiClient: mockApi,
}));

vi.mock("~/lib/api-error", () => {
  class MockCircuitBreaker {
    constructor() {}
    execute(fn: (...args: any[]) => any) {
      return mockCircuitBreakerExecute(fn);
    }
  }
  return {
    withRetry: mockWithRetry,
    parseApiError: vi.fn((e: any) => e),
    ApiError: class ApiError extends Error {},
    CircuitBreaker: MockCircuitBreaker,
  };
});

import { listingsApi } from "./listings";

const makeSearchResponse = (results: any[] = [], total = 0) => ({
  results,
  total,
  page: 1,
  size: 20,
});

describe("listingsApi", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("searchListings", () => {
    it("calls search endpoint with query", async () => {
      mockApi.get.mockResolvedValue(makeSearchResponse([], 0));
      await listingsApi.searchListings({ query: "bike" });
      expect(mockApi.get).toHaveBeenCalledWith(
        expect.stringContaining("/search?query=bike"),
      );
    });

    it("maps search response to ListingSearchResponse", async () => {
      mockApi.get.mockResolvedValue(
        makeSearchResponse(
          [
            {
              id: "l1",
              title: "Mountain Bike",
              description: "desc",
              slug: "mountain-bike",
              categoryName: "Sports",
              categorySlug: "sports",
              city: "Kathmandu",
              state: "Bagmati",
              country: "Nepal",
              basePrice: 500,
              currency: "NPR",
              photos: ["p1.jpg"],
              ownerName: "Ram Sharma",
              ownerRating: 4.5,
              averageRating: 4.2,
              totalReviews: 10,
            },
          ],
          1,
        ),
      );
      const result = await listingsApi.searchListings({ query: "bike" });
      expect(result.listings).toHaveLength(1);
      expect(result.listings[0].title).toBe("Mountain Bike");
      expect(result.listings[0].location.city).toBe("Kathmandu");
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it("appends sort param", async () => {
      mockApi.get.mockResolvedValue(makeSearchResponse());
      await listingsApi.searchListings({
        query: "tent",
        sortBy: "price-asc",
      });
      expect(mockApi.get).toHaveBeenCalledWith(
        expect.stringContaining("sort=price_asc"),
      );
    });

    it("appends price filters", async () => {
      mockApi.get.mockResolvedValue(makeSearchResponse());
      await listingsApi.searchListings({
        query: "camera",
        minPrice: 100,
        maxPrice: 1000,
      });
      const url = mockApi.get.mock.calls[0][0] as string;
      expect(url).toContain("minPrice=100");
      expect(url).toContain("maxPrice=1000");
    });

    it("passes geo params for geo search", async () => {
      mockApi.get.mockResolvedValue(makeSearchResponse([{ id: "l1" }], 1));
      await listingsApi.searchListings({
        query: "drill",
        lat: 27.7,
        lng: 85.3,
        radius: 10,
      });
      const url = mockApi.get.mock.calls[0][0] as string;
      expect(url).toContain("lat=27.7");
      expect(url).toContain("lon=85.3");
      expect(url).toContain("radius=10");
    });

    it("uses circuit breaker for search", async () => {
      mockApi.get.mockResolvedValue(makeSearchResponse());
      await listingsApi.searchListings({ query: "test" });
      expect(mockCircuitBreakerExecute).toHaveBeenCalled();
    });
  });

  describe("CRUD operations", () => {
    it("getListingById fetches by id", async () => {
      mockApi.get.mockResolvedValue({ id: "l1", title: "Bike" });
      const result = await listingsApi.getListingById("l1");
      expect(mockApi.get).toHaveBeenCalledWith("/listings/l1");
      expect(result.title).toBe("Bike");
    });

    it("getListingsByOwnerId fetches owner listings", async () => {
      mockApi.get.mockResolvedValue({ listings: [] });
      await listingsApi.getListingsByOwnerId("owner1");
      expect(mockApi.get).toHaveBeenCalledWith(
        "/listings?ownerId=owner1",
      );
    });

    it("getMyListings fetches current user listings", async () => {
      mockApi.get.mockResolvedValue([]);
      await listingsApi.getMyListings();
      expect(mockApi.get).toHaveBeenCalledWith("/listings/my-listings");
    });

    it("createListing posts listing data", async () => {
      mockApi.post.mockResolvedValue({ id: "new-l" });
      await listingsApi.createListing({ title: "New" } as any);
      expect(mockApi.post).toHaveBeenCalledWith("/listings", { title: "New" });
    });

    it("updateListing patches listing", async () => {
      mockApi.patch.mockResolvedValue({ id: "l1" });
      await listingsApi.updateListing("l1", { title: "Updated" } as any);
      expect(mockApi.patch).toHaveBeenCalledWith("/listings/l1", {
        title: "Updated",
      });
    });

    it("deleteListing sends delete", async () => {
      mockApi.delete.mockResolvedValue(undefined);
      await listingsApi.deleteListing("l1");
      expect(mockApi.delete).toHaveBeenCalledWith("/listings/l1");
    });
  });

  describe("lifecycle operations", () => {
    it("publishListing posts publish", async () => {
      mockApi.post.mockResolvedValue(undefined);
      await listingsApi.publishListing("l1");
      expect(mockApi.post).toHaveBeenCalledWith("/listings/l1/publish");
    });

    it("pauseListing posts pause", async () => {
      mockApi.post.mockResolvedValue(undefined);
      await listingsApi.pauseListing("l1");
      expect(mockApi.post).toHaveBeenCalledWith("/listings/l1/pause");
    });

    it("activateListing posts activate", async () => {
      mockApi.post.mockResolvedValue(undefined);
      await listingsApi.activateListing("l1");
      expect(mockApi.post).toHaveBeenCalledWith("/listings/l1/activate");
    });
  });

  describe("favorites", () => {
    it("getFavoriteListings returns mapped favorites", async () => {
      mockApi.get.mockResolvedValue({
        favorites: [
          {
            createdAt: "2025-01-01",
            listing: { id: "l1", title: "Bike" },
          },
        ],
      });
      const result = await listingsApi.getFavoriteListings("u1");
      expect(mockApi.get).toHaveBeenCalledWith("/favorites");
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Bike");
    });

    it("addFavorite posts listing id", async () => {
      mockApi.post.mockResolvedValue(undefined);
      await listingsApi.addFavorite("l1");
      expect(mockApi.post).toHaveBeenCalledWith("/favorites", {
        listingId: "l1",
      });
    });

    it("removeFavorite deletes by listing id", async () => {
      mockApi.delete.mockResolvedValue(undefined);
      await listingsApi.removeFavorite("l1");
      expect(mockApi.delete).toHaveBeenCalledWith("/favorites/l1");
    });
  });

  describe("images", () => {
    it("uploadImages posts FormData", async () => {
      mockApi.post.mockResolvedValue({ urls: ["url1"] });
      const file = new File(["content"], "photo.jpg", {
        type: "image/jpeg",
      });
      const result = await listingsApi.uploadImages("l1", [file]);
      expect(mockApi.post).toHaveBeenCalledWith(
        "/listings/l1/images",
        expect.any(FormData),
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      expect(result.urls).toEqual(["url1"]);
    });

    it("deleteImage sends delete with imageUrl", async () => {
      mockApi.delete.mockResolvedValue(undefined);
      await listingsApi.deleteImage("l1", "http://img.jpg");
      expect(mockApi.delete).toHaveBeenCalledWith("/listings/l1/images", {
        data: { imageUrl: "http://img.jpg" },
      });
    });
  });

  describe("discovery", () => {
    it("getCategories fetches categories", async () => {
      mockApi.get.mockResolvedValue([{ id: "c1", name: "Sports" }]);
      const cats = await listingsApi.getCategories();
      expect(mockApi.get).toHaveBeenCalledWith("/categories");
      expect(cats).toHaveLength(1);
    });

    it("getFeaturedListings handles array response", async () => {
      mockApi.get.mockResolvedValue([{ id: "l1" }]);
      const result = await listingsApi.getFeaturedListings(4);
      expect(mockApi.get).toHaveBeenCalledWith("/listings/featured?limit=4");
      expect(result).toHaveLength(1);
    });

    it("getFeaturedListings handles paginated response", async () => {
      mockApi.get.mockResolvedValue({
        listings: [{ id: "l1" }],
        total: 1,
      });
      const result = await listingsApi.getFeaturedListings();
      expect(result).toHaveLength(1);
    });

    it("getNearbyListings passes geo params", async () => {
      mockApi.get.mockResolvedValue([]);
      await listingsApi.getNearbyListings(27.7, 85.3, 5);
      expect(mockApi.get).toHaveBeenCalledWith(
        "/listings/nearby?lat=27.7&lng=85.3&radius=5",
      );
    });

    it("getRecommendations fetches listings", async () => {
      mockApi.get.mockResolvedValue({ listings: [{ id: "l1" }] });
      const result = await listingsApi.getRecommendations("u1");
      expect(result).toHaveLength(1);
    });
  });

  describe("advanced", () => {
    it("updateAvailability patches status", async () => {
      mockApi.patch.mockResolvedValue({ id: "l1", availability: "rented" });
      await listingsApi.updateAvailability("l1", "rented");
      expect(mockApi.patch).toHaveBeenCalledWith(
        "/listings/l1/availability",
        { availability: "rented" },
      );
    });

    it("getPriceSuggestion builds query params", async () => {
      mockApi.get.mockResolvedValue({ averagePrice: 500, suggestedRange: { low: 400, high: 600 } });
      await listingsApi.getPriceSuggestion({
        categoryId: "c1",
        city: "Kathmandu",
        condition: "good",
      });
      const url = mockApi.get.mock.calls[0][0] as string;
      expect(url).toContain("categoryId=c1");
      expect(url).toContain("city=Kathmandu");
      expect(url).toContain("condition=good");
    });
  });
});
