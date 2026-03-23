import { AxiosError } from "axios";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const IconStub = vi.hoisted(() => (props: any) => <span data-testid="icon-stub" />);
const mocks = vi.hoisted(() => ({
  searchListings: vi.fn(),
  getCategories: vi.fn(),
  useLoaderData: vi.fn(),
  useSearchParams: vi.fn(() => [new URLSearchParams(), vi.fn()]),
  useNavigation: vi.fn(() => ({ state: "idle" })),
  useSubmit: vi.fn(() => vi.fn()),
  useNavigate: vi.fn(() => vi.fn()),
  useRevalidator: vi.fn(() => ({ revalidate: vi.fn() })),
}));

vi.mock("react-router", () => ({
  useLoaderData: () => mocks.useLoaderData(),
  useSearchParams: () => mocks.useSearchParams(),
  useNavigation: () => mocks.useNavigation(),
  useSubmit: () => mocks.useSubmit(),
  useNavigate: () => mocks.useNavigate(),
  useRevalidator: () => mocks.useRevalidator(),
  Form: ({ children, ...props }: any) => <form {...props}>{children}</form>,
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("~/lib/api/listings", () => ({
  listingsApi: {
    searchListings: (...args: any[]) => mocks.searchListings(...args),
    getCategories: (...args: any[]) => mocks.getCategories(...args),
  },
}));

vi.mock("~/lib/api/geo", () => ({
  geoApi: {
    searchLocation: vi.fn(),
    reverseGeocode: vi.fn(),
  },
}));

vi.mock("~/lib/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

vi.mock("~/hooks/useDebounce", () => ({
  useDebounce: (val: any) => val,
}));

vi.mock("~/components/ui", () => ({
  UnifiedButton: ({ children, leftIcon, rightIcon, loading, ...props }: any) => (
    <button {...props}>
      {loading ? <span data-testid="loading-spinner" /> : leftIcon}
      {children}
      {!loading ? rightIcon : null}
    </button>
  ),
  Badge: ({ children }: any) => <span>{children}</span>,
  CardGridSkeleton: () => <div data-testid="skeleton" />,
  EmptyStatePresets: {
    NoSearchResults: () => <div data-testid="empty-state">No results</div>,
  },
  FilterPresets: () => <div data-testid="filter-presets" />,
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
  Alert: ({ children, title, message }: any) => <div role="alert">{title}{message}{children}</div>,
}));

vi.mock("~/components/map/ListingsMap", () => ({
  ListingsMap: () => <div data-testid="map" />,
}));

vi.mock("~/components/search/LocationAutocomplete", () => ({
  LocationAutocomplete: (props: any) => (
    <input data-testid="location-autocomplete" />
  ),
}));

vi.mock("~/components/search/SearchListingCards", () => ({
  SearchListingCard: ({ listing }: any) => (
    <div data-testid="listing-card">{listing.title}</div>
  ),
  SearchListingListItem: ({ listing }: any) => (
    <div data-testid="listing-list-item">{listing.title}</div>
  ),
  SearchListingCompactCard: ({ listing }: any) => (
    <div data-testid="listing-compact">{listing.title}</div>
  ),
}));

vi.mock("~/components/search/SearchFiltersSidebar", () => ({
  SearchFiltersSidebar: () => <div data-testid="filters-sidebar" />,
}));

vi.mock("lucide-react", () => ({
  Search: IconStub, SlidersHorizontal: IconStub, X: IconStub,
  Grid3X3: IconStub, List: IconStub, Map: IconStub,
}));

// ─── Import after mocks ─────────────────────────────────────────────────────

import SearchPage, { clientLoader, getSearchResultsError } from "./search";

// ─── Helper function tests ──────────────────────────────────────────────────

// The helper functions (normalizeBounds, boundsEqual, safeNumber, etc.) are
// module-scoped. We test them indirectly through clientLoader and via the
// behaviour they drive in the component.

describe("search route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });

  // ── clientLoader tests ────────────────────────────────────────────────

  describe("clientLoader", () => {
    it("returns search results for basic query", async () => {
      const results = {
        listings: [{ id: "1", title: "Camera" }],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
      mocks.searchListings.mockResolvedValue(results);
      mocks.getCategories.mockResolvedValue(["electronics"]);

      const data = await clientLoader({
        request: new Request("http://localhost/search?query=camera"),
      } as any);

      expect(data.results).toEqual(results);
      expect(data.error).toBeNull();
      expect(mocks.searchListings).toHaveBeenCalledWith(
        expect.objectContaining({ query: "camera" })
      );
    });

    it("accepts the legacy q parameter from global navigation", async () => {
      mocks.searchListings.mockResolvedValue({
        listings: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });
      mocks.getCategories.mockResolvedValue([]);

      await clientLoader({
        request: new Request("http://localhost/search?q=camera"),
      } as any);

      expect(mocks.searchListings).toHaveBeenCalledWith(
        expect.objectContaining({ query: "camera" })
      );
    });

    it("normalizes search params", async () => {
      mocks.searchListings.mockResolvedValue({
        listings: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });
      mocks.getCategories.mockResolvedValue([]);

      await clientLoader({
        request: new Request(
          "http://localhost/search?query=test&minPrice=100&maxPrice=200&condition=good"
        ),
      } as any);

      expect(mocks.searchListings).toHaveBeenCalledWith(
        expect.objectContaining({
          query: "test",
          minPrice: 100,
          maxPrice: 200,
          condition: "good",
        })
      );
    });

    it("swaps min/max price when min > max", async () => {
      mocks.searchListings.mockResolvedValue({
        listings: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });
      mocks.getCategories.mockResolvedValue([]);

      await clientLoader({
        request: new Request(
          "http://localhost/search?minPrice=200&maxPrice=100"
        ),
      } as any);

      expect(mocks.searchListings).toHaveBeenCalledWith(
        expect.objectContaining({
          minPrice: 100,
          maxPrice: 200,
        })
      );
    });

    it("rejects invalid condition values", async () => {
      mocks.searchListings.mockResolvedValue({
        listings: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });
      mocks.getCategories.mockResolvedValue([]);

      await clientLoader({
        request: new Request(
          "http://localhost/search?condition=invalid"
        ),
      } as any);

      expect(mocks.searchListings).toHaveBeenCalledWith(
        expect.objectContaining({
          condition: undefined,
        })
      );
    });

    it("handles valid sortBy values", async () => {
      mocks.searchListings.mockResolvedValue({
        listings: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });
      mocks.getCategories.mockResolvedValue([]);

      await clientLoader({
        request: new Request("http://localhost/search?sortBy=price-asc"),
      } as any);

      expect(mocks.searchListings).toHaveBeenCalledWith(
        expect.objectContaining({ sortBy: "price-asc" })
      );
    });

    it("rejects invalid sortBy values", async () => {
      mocks.searchListings.mockResolvedValue({
        listings: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });
      mocks.getCategories.mockResolvedValue([]);

      await clientLoader({
        request: new Request("http://localhost/search?sortBy=invalid"),
      } as any);

      expect(mocks.searchListings).toHaveBeenCalledWith(
        expect.objectContaining({ sortBy: undefined })
      );
    });

    it("validates lat/lng ranges", async () => {
      mocks.searchListings.mockResolvedValue({
        listings: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });
      mocks.getCategories.mockResolvedValue([]);

      await clientLoader({
        request: new Request(
          "http://localhost/search?lat=27.7172&lng=85.3240"
        ),
      } as any);

      expect(mocks.searchListings).toHaveBeenCalledWith(
        expect.objectContaining({
          lat: 27.7172,
          lng: 85.324,
        })
      );
    });

    it("rejects out-of-range lat/lng", async () => {
      mocks.searchListings.mockResolvedValue({
        listings: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });
      mocks.getCategories.mockResolvedValue([]);

      await clientLoader({
        request: new Request(
          "http://localhost/search?lat=200&lng=300"
        ),
      } as any);

      expect(mocks.searchListings).toHaveBeenCalledWith(
        expect.objectContaining({
          lat: undefined,
          lng: undefined,
        })
      );
    });

    it("clamps radius to 1-500", async () => {
      mocks.searchListings.mockResolvedValue({
        listings: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });
      mocks.getCategories.mockResolvedValue([]);

      await clientLoader({
        request: new Request("http://localhost/search?radius=1000"),
      } as any);

      expect(mocks.searchListings).toHaveBeenCalledWith(
        expect.objectContaining({ radius: 500 })
      );
    });

    it("defaults page to 1 for invalid values", async () => {
      mocks.searchListings.mockResolvedValue({
        listings: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });
      mocks.getCategories.mockResolvedValue([]);

      await clientLoader({
        request: new Request("http://localhost/search?page=-1"),
      } as any);

      expect(mocks.searchListings).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1 })
      );
    });

    it("floors page to integer", async () => {
      mocks.searchListings.mockResolvedValue({
        listings: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });
      mocks.getCategories.mockResolvedValue([]);

      await clientLoader({
        request: new Request("http://localhost/search?page=2.7"),
      } as any);

      expect(mocks.searchListings).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 })
      );
    });

    it("handles boolean params (instantBooking, delivery)", async () => {
      mocks.searchListings.mockResolvedValue({
        listings: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });
      mocks.getCategories.mockResolvedValue([]);

      await clientLoader({
        request: new Request(
          "http://localhost/search?instantBooking=true&delivery=true"
        ),
      } as any);

      expect(mocks.searchListings).toHaveBeenCalledWith(
        expect.objectContaining({
          instantBooking: true,
          delivery: true,
        })
      );
    });

    it("handles search error gracefully", async () => {
      mocks.searchListings.mockRejectedValue(new Error("API error"));

      const data = await clientLoader({
        request: new Request("http://localhost/search"),
      } as any);

      expect(data.error).toBeTruthy();
      expect(data.results.listings).toEqual([]);
      expect(data.results.total).toBe(0);
    });

    it("returns actionable offline loader copy", async () => {
      const previousOnline = navigator.onLine;
      Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        value: false,
      });
      mocks.searchListings.mockRejectedValue(
        new AxiosError("Network Error", "ERR_NETWORK")
      );

      const data = await clientLoader({
        request: new Request("http://localhost/search"),
      } as any);

      expect(data.error).toBe(
        "You appear to be offline. Reconnect and try loading search results again."
      );

      Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        value: previousOnline,
      });
    });

    it("returns timeout-specific loader copy", async () => {
      mocks.searchListings.mockRejectedValue(
        new AxiosError("timeout", "ECONNABORTED")
      );

      const data = await clientLoader({
        request: new Request("http://localhost/search"),
      } as any);

      expect(data.error).toBe("Loading search results timed out. Try again.");
    });

    it("handles category failure gracefully", async () => {
      mocks.searchListings.mockResolvedValue({
        listings: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });
      mocks.getCategories.mockRejectedValue(new Error("fail"));

      const data = await clientLoader({
        request: new Request("http://localhost/search"),
      } as any);

      expect(data.categories).toEqual([]);
      expect(data.error).toBeNull();
    });

    it("truncates query at MAX_SEARCH_QUERY_LENGTH", async () => {
      mocks.searchListings.mockResolvedValue({
        listings: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });
      mocks.getCategories.mockResolvedValue([]);

      const longQuery = "a".repeat(200);
      await clientLoader({
        request: new Request(
          `http://localhost/search?query=${longQuery}`
        ),
      } as any);

      const callArgs = mocks.searchListings.mock.calls[0][0];
      expect(callArgs.query.length).toBeLessThanOrEqual(120);
    });
  });

  // ── Component render tests ────────────────────────────────────────────

  describe("SearchPage component", () => {
    beforeEach(() => {
      mocks.useSearchParams.mockReturnValue([new URLSearchParams(), vi.fn()]);
      mocks.useNavigation.mockReturnValue({ state: "idle" });
      mocks.useNavigate.mockReturnValue(vi.fn());
      mocks.useRevalidator.mockReturnValue({ revalidate: vi.fn() });
    });

    it("renders search results", () => {
      mocks.useLoaderData.mockReturnValue({
        results: {
          listings: [
            {
              id: "1",
              title: "DSLR Camera",
              basePrice: 500,
              currency: "NPR",
              images: [],
              location: { city: "Kathmandu" },
              averageRating: 4.5,
            },
          ],
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
        categories: [],
        searchParams: {},
        error: null,
      });
      render(<SearchPage />);
      expect(screen.getByText(/DSLR Camera/)).toBeInTheDocument();
    });

    it("shows error alert when search fails", () => {
      mocks.useLoaderData.mockReturnValue({
        results: {
          listings: [],
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
        },
        categories: [],
        searchParams: {},
        error: "Failed to load search results.",
      });
      render(<SearchPage />);
      expect(screen.getByText(/Failed to load/i)).toBeInTheDocument();
    });

    it("renders empty state when no results", () => {
      mocks.useLoaderData.mockReturnValue({
        results: {
          listings: [],
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
        },
        categories: [],
        searchParams: { query: "nonexistent" },
        error: null,
      });
      render(<SearchPage />);
      // Either empty state or "no results" text
      const el =
        screen.queryByTestId("empty-state") ||
        screen.queryByText(/No results|no listings/i);
      expect(el).toBeTruthy();
    });

    it("renders multiple listings", () => {
      mocks.useLoaderData.mockReturnValue({
        results: {
          listings: [
            {
              id: "1",
              title: "Camera",
              basePrice: 500,
              currency: "NPR",
              images: [],
              location: { city: "Kathmandu" },
            },
            {
              id: "2",
              title: "Bike",
              basePrice: 300,
              currency: "NPR",
              images: [],
              location: { city: "Pokhara" },
            },
          ],
          total: 2,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
        categories: [
          { id: "electronics", name: "Electronics", slug: "electronics" },
          { id: "vehicles", name: "Vehicles", slug: "vehicles" },
        ],
        searchParams: {},
        error: null,
      });
      render(<SearchPage />);
      expect(screen.getByText(/Camera/)).toBeInTheDocument();
      expect(screen.getByText(/Bike/)).toBeInTheDocument();
    });

    it("does not carry saved map-only mode into a non-map saved view", async () => {
      localStorage.setItem("searchViewMode", "grid");
      localStorage.setItem("searchMapOnly", "true");

      mocks.useLoaderData.mockReturnValue({
        results: {
          listings: [
            {
              id: "1",
              title: "Camera",
              basePrice: 500,
              currency: "NPR",
              images: [],
              photos: [],
              location: { city: "Kathmandu", coordinates: { lat: 27.7172, lng: 85.324 } },
            },
          ],
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
        categories: [],
        searchParams: {},
        error: null,
      });

      render(<SearchPage />);

      fireEvent.click(screen.getByRole("button", { name: "Map view" }));

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Map only" })).toBeInTheDocument();
      });
    });

    it("enters map view when the saved view is map", async () => {
      localStorage.setItem("searchViewMode", "map");
      localStorage.setItem("searchMapOnly", "true");

      mocks.useLoaderData.mockReturnValue({
        results: {
          listings: [
            {
              id: "1",
              title: "Camera",
              basePrice: 500,
              currency: "NPR",
              images: [],
              photos: [],
              location: { city: "Kathmandu", coordinates: { lat: 27.7172, lng: 85.324 } },
            },
          ],
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
        categories: [],
        searchParams: {},
        error: null,
      });

      render(<SearchPage />);

      fireEvent.click(screen.getByRole("button", { name: "Map view" }));

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Map only" })).toBeInTheDocument();
      });
    });
  });

  describe("error helpers", () => {
    it("preserves plain thrown errors", () => {
      expect(getSearchResultsError(new Error("search unavailable"))).toBe(
        "search unavailable"
      );
    });

    it("uses actionable offline copy", () => {
      const previousOnline = navigator.onLine;
      Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        value: false,
      });

      expect(getSearchResultsError(new Error("Network Error"))).toBe(
        "You appear to be offline. Reconnect and try loading search results again."
      );

      Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        value: previousOnline,
      });
    });

    it("uses timeout-specific copy", () => {
      expect(getSearchResultsError(new AxiosError("timeout", "ECONNABORTED"))).toBe(
        "Loading search results timed out. Try again."
      );
    });
  });
});
