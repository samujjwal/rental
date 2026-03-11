import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  useFavorites,
  useIsFavorited,
  useFavoritesCount,
  useAddFavorite,
  useRemoveFavorite,
  favoritesKeys,
} from "./useFavorites";

// Mock API calls
vi.mock("~/lib/api/favorites", () => ({
  getFavorites: vi.fn(),
  getFavoriteByListingId: vi.fn(),
  addFavorite: vi.fn(),
  removeFavorite: vi.fn(),
  toggleFavorite: vi.fn(),
  getFavoritesCount: vi.fn(),
  bulkAddFavorites: vi.fn(),
  bulkRemoveFavorites: vi.fn(),
  clearAllFavorites: vi.fn(),
}));

vi.mock("~/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock auth store
let mockIsAuthenticated = true;
vi.mock("~/lib/store/auth", () => ({
  useAuthStore: () => ({ isAuthenticated: mockIsAuthenticated }),
}));

import {
  getFavorites,
  getFavoriteByListingId,
  addFavorite,
  removeFavorite,
  getFavoritesCount,
} from "~/lib/api/favorites";
import { toast } from "~/lib/toast";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("favoritesKeys", () => {
  it("generates stable query keys", () => {
    expect(favoritesKeys.all).toEqual(["favorites"]);
    expect(favoritesKeys.lists()).toEqual(["favorites", "list"]);
    expect(favoritesKeys.detail("l1")).toEqual(["favorites", "detail", "l1"]);
    expect(favoritesKeys.count()).toEqual(["favorites", "count"]);
  });
});

describe("useFavorites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAuthenticated = true;
  });

  it("fetches favorites when authenticated", async () => {
    vi.mocked(getFavorites).mockResolvedValue({ favorites: [], total: 0, page: 1, limit: 20 });

    const { result } = renderHook(() => useFavorites(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getFavorites).toHaveBeenCalled();
  });

  it("does not fetch when unauthenticated", () => {
    mockIsAuthenticated = false;

    const { result } = renderHook(() => useFavorites(), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(getFavorites).not.toHaveBeenCalled();
  });

  it("passes params to getFavorites", async () => {
    vi.mocked(getFavorites).mockResolvedValue({ favorites: [], total: 0, page: 1, limit: 20 });

    const params = { page: 2, limit: 10, sortBy: "price" as const };
    renderHook(() => useFavorites(params), { wrapper: createWrapper() });

    await waitFor(() =>
      expect(getFavorites).toHaveBeenCalledWith(params)
    );
  });
});

describe("useIsFavorited", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAuthenticated = true;
  });

  it("checks if listing is favorited", async () => {
    vi.mocked(getFavoriteByListingId).mockResolvedValue({ id: "fav1", listingId: "l1", userId: "u1", createdAt: new Date().toISOString() });

    const { result } = renderHook(() => useIsFavorited("l1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // Hook passes through the full API response — assert on the fields that matter
    expect(result.current.data).toMatchObject({ id: "fav1", listingId: "l1" });
  });

  it("does not fetch with empty listingId", () => {
    const { result } = renderHook(() => useIsFavorited(""), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("useFavoritesCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAuthenticated = true;
  });

  it("fetches count when authenticated", async () => {
    vi.mocked(getFavoritesCount).mockResolvedValue(5);

    const { result } = renderHook(() => useFavoritesCount(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBe(5));
  });
});

describe("useAddFavorite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAuthenticated = true;
  });

  it("adds favorite and shows success toast", async () => {
    vi.mocked(addFavorite).mockResolvedValue({ id: "fav1", listingId: "l1", userId: "u1", createdAt: new Date().toISOString() });

    const { result } = renderHook(() => useAddFavorite(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ listingId: "l1" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(addFavorite).toHaveBeenCalledWith(
      expect.objectContaining({ listingId: "l1" }),
      expect.anything(),
    );
    expect(toast.success).toHaveBeenCalledWith("Added to favorites");
  });

  it("shows error toast on failure", async () => {
    vi.mocked(addFavorite).mockRejectedValue(new Error("fail"));

    const { result } = renderHook(() => useAddFavorite(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ listingId: "l1" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Failed to add favorite");
  });
});

describe("useRemoveFavorite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAuthenticated = true;
  });

  it("removes favorite and shows success toast", async () => {
    vi.mocked(removeFavorite).mockResolvedValue(undefined);

    const { result } = renderHook(() => useRemoveFavorite(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ listingId: "l1" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(removeFavorite).toHaveBeenCalledWith(
      expect.objectContaining({ listingId: "l1" }),
      expect.anything(),
    );
    expect(toast.success).toHaveBeenCalledWith("Removed from favorites");
  });

  it("shows error toast on failure", async () => {
    vi.mocked(removeFavorite).mockRejectedValue(new Error("fail"));

    const { result } = renderHook(() => useRemoveFavorite(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ listingId: "l1" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Failed to remove favorite");
  });
});
