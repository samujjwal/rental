import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("~/lib/api-client", () => ({
  api: mockApi,
  apiClient: mockApi,
}));

import {
  getFavorites,
  getFavoriteByListingId,
  isFavorited,
  addFavorite,
  removeFavorite,
  toggleFavorite,
  getFavoritesCount,
  bulkAddFavorites,
  bulkRemoveFavorites,
  clearAllFavorites,
} from "~/lib/api/favorites";

describe("favorites API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getFavorites calls GET /favorites with params", async () => {
    mockApi.get.mockResolvedValue({ favorites: [], total: 0 });
    await getFavorites({ page: 2, sortBy: "price" });
    expect(mockApi.get).toHaveBeenCalledWith("/favorites", {
      params: { page: 2, sortBy: "price" },
    });
  });

  it("getFavoriteByListingId returns favorite", async () => {
    mockApi.get.mockResolvedValue({ id: "f1", listingId: "l1" });
    const result = await getFavoriteByListingId("l1");
    expect(mockApi.get).toHaveBeenCalledWith("/favorites/listing/l1");
    expect(result?.id).toBe("f1");
  });

  it("getFavoriteByListingId returns null on 404", async () => {
    mockApi.get.mockRejectedValue({ response: { status: 404 } });
    const result = await getFavoriteByListingId("l1");
    expect(result).toBeNull();
  });

  it("getFavoriteByListingId rethrows non-404 errors", async () => {
    mockApi.get.mockRejectedValue({ response: { status: 500 } });
    await expect(getFavoriteByListingId("l1")).rejects.toEqual({ response: { status: 500 } });
  });

  it("isFavorited returns true when favorite exists", async () => {
    mockApi.get.mockResolvedValue({ id: "f1" });
    expect(await isFavorited("l1")).toBe(true);
  });

  it("isFavorited returns false on error", async () => {
    mockApi.get.mockRejectedValue(new Error("network"));
    expect(await isFavorited("l1")).toBe(false);
  });

  it("addFavorite posts to /favorites", async () => {
    mockApi.post.mockResolvedValue({ id: "f1" });
    await addFavorite({ listingId: "l1" });
    expect(mockApi.post).toHaveBeenCalledWith("/favorites", { listingId: "l1" });
  });

  it("removeFavorite deletes /favorites/:listingId", async () => {
    mockApi.delete.mockResolvedValue(undefined);
    await removeFavorite({ listingId: "l1" });
    expect(mockApi.delete).toHaveBeenCalledWith("/favorites/l1");
  });

  it("toggleFavorite removes when already favorited", async () => {
    mockApi.get.mockResolvedValue({ id: "f1", listingId: "l1" });
    mockApi.delete.mockResolvedValue(undefined);
    const result = await toggleFavorite("l1");
    expect(result.isFavorited).toBe(false);
    expect(mockApi.delete).toHaveBeenCalled();
  });

  it("toggleFavorite adds when not favorited", async () => {
    mockApi.get.mockRejectedValue({ response: { status: 404 } });
    mockApi.post.mockResolvedValue({ id: "f2", listingId: "l1" });
    const result = await toggleFavorite("l1");
    expect(result.isFavorited).toBe(true);
    expect(result.favorite?.id).toBe("f2");
  });

  it("getFavoritesCount returns count", async () => {
    mockApi.get.mockResolvedValue({ count: 5 });
    expect(await getFavoritesCount()).toBe(5);
  });

  it("bulkAddFavorites posts listing IDs", async () => {
    mockApi.post.mockResolvedValue([]);
    await bulkAddFavorites(["l1", "l2"]);
    expect(mockApi.post).toHaveBeenCalledWith("/favorites/bulk", { listingIds: ["l1", "l2"] });
  });

  it("bulkRemoveFavorites deletes with listing IDs", async () => {
    mockApi.delete.mockResolvedValue(undefined);
    await bulkRemoveFavorites(["l1", "l2"]);
    expect(mockApi.delete).toHaveBeenCalledWith("/favorites/bulk", {
      data: { listingIds: ["l1", "l2"] },
    });
  });

  it("clearAllFavorites deletes /favorites/all", async () => {
    mockApi.delete.mockResolvedValue(undefined);
    await clearAllFavorites();
    expect(mockApi.delete).toHaveBeenCalledWith("/favorites/all");
  });
});
