import { AxiosError } from "axios";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const IconStub = vi.hoisted(() => (props: any) => <span data-testid="icon-stub" />);
const mocks = vi.hoisted(() => ({
  getListingById: vi.fn(),
  getCategories: vi.fn(),
  useLoaderData: vi.fn(),
  useNavigate: vi.fn(() => vi.fn()),
  navigate: vi.fn(),
  createConversation: vi.fn(),
  calculatePrice: vi.fn(),
  checkAvailability: vi.fn(),
  createBooking: vi.fn(),
  getReviewsForListing: vi.fn(),
}));

vi.mock("react-router", () => ({
  useLoaderData: () => mocks.useLoaderData(),
  useNavigate: () => mocks.navigate,
  useRevalidator: () => ({ revalidate: vi.fn(), state: "idle" }),
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("~/lib/api/listings", () => ({
  listingsApi: {
    getListingById: (...args: any[]) => mocks.getListingById(...args),
    getCategoryFieldDefinitions: vi.fn().mockResolvedValue([]),
  },
  groupCategoryFieldDefinitions: vi.fn(() => []),
  formatCategoryFieldValue: vi.fn((_field: any, v: unknown) => String(v ?? '')),
}));

vi.mock("~/lib/api/bookings", () => ({
  bookingsApi: {
    calculatePrice: (...args: any[]) => mocks.calculatePrice(...args),
    checkAvailability: (...args: any[]) => mocks.checkAvailability(...args),
    createBooking: (...args: any[]) => mocks.createBooking(...args),
  },
}));

vi.mock("~/lib/api/messaging", () => ({
  messagingApi: {
    createConversation: (...args: any[]) => mocks.createConversation(...args),
  },
}));

vi.mock("~/lib/api/reviews", () => ({
  reviewsApi: {
    getReviewsByListing: vi.fn(),
    getReviewsForListing: (...args: any[]) => mocks.getReviewsForListing(...args),
  },
}));

vi.mock("~/lib/category-context", () => ({
  getCategoryContext: vi.fn(() => ({
    color: "blue",
    icon: "Camera",
    pricePeriodLabel: "per day",
    distanceUnit: "km",
    rulesHeading: "Rules",
    ownerLabel: "Owner",
    showGuestCount: false,
    guestLabel: "Guests",
    messagePlaceholder: "Write a message...",
    depositReturnText: "Deposit will be returned after inspection",
  })),
}));

vi.mock("~/lib/utils", () => ({
  formatCurrency: (v: number) => `NPR ${v}`,
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

vi.mock("~/lib/store/auth", () => {
  const state = { user: { id: "user-1", role: "renter" }, isAuthenticated: true };
  const useAuthStore: any = (sel?: (s: any) => any) => sel ? sel(state) : state;
  useAuthStore.getState = () => state;
  return { useAuthStore };
});

vi.mock("~/components/ui", () => ({
  UnifiedButton: ({ children, fullWidth, loading, leftIcon, rightIcon, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
  Badge: ({ children }: any) => <span>{children}</span>,
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
}));

vi.mock("~/components/ui/skeleton", () => ({
  Skeleton: () => <div data-testid="skeleton" />,
  CardSkeleton: () => <div data-testid="card-skeleton" />,
}));

vi.mock("~/components/ui/ListingGallery", () => ({
  ListingGallery: ({ images }: any) => (
    <div data-testid="gallery">{images?.length || 0} images</div>
  ),
}));

vi.mock("~/components/favorites", () => ({
  FavoriteButton: () => <button data-testid="fav-btn">❤</button>,
}));

vi.mock("lucide-react", () => {
  const icons: Record<string, any> = {};
  const names = [
    "MapPin", "Shield", "Star", "Truck", "CheckCircle", "ChevronLeft", "ChevronRight",
    "Info", "MessageCircle", "Share2", "Tag", "Navigation", "Package", "ExternalLink",
    "AlertCircle", "Expand", "Loader2", "Mic", "MicOff", "Trash2", "TrendingUp",
    "Upload", "ZoomIn", "Heart", "Calendar", "Clock", "X",
  ];
  for (const n of names) icons[n] = IconStub;
  return icons;
});

// ─── Import after mocks ─────────────────────────────────────────────────────

import ListingDetail, {
  clientLoader,
  getListingAvailabilityError,
  getListingBookingError,
  getListingContactOwnerError,
  getListingLoadError,
  getListingPriceCalculationError,
  getListingReviewsError,
} from "./listings.$id";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeListing(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    title: "DSLR Camera for Rent",
    description: "Professional grade camera",
    basePrice: 500,
    currency: "NPR",
    images: ["img1.jpg", "img2.jpg"],
    location: { city: "Kathmandu", state: "Bagmati", lat: 27.7, lng: 85.3 },
    ownerId: "owner-1",
    owner: { firstName: "Sita", lastName: "Shrestha", avatar: null },
    category: { name: "Electronics", slug: "electronics" },
    condition: "like-new",
    averageRating: 4.5,
    reviewCount: 12,
    deliveryAvailable: true,
    instantBooking: false,
    status: "AVAILABLE",
    ...overrides,
  };
}

async function renderListingDetail(overrides: Record<string, unknown> = {}) {
  const listing = makeListing(overrides);
  mocks.useLoaderData.mockReturnValue({ listing, categoryFieldDefs: [], error: null });
  render(<ListingDetail />);
  await waitFor(() => {
    expect(mocks.getReviewsForListing).toHaveBeenCalledWith(listing.id, 1, 5);
  });
  return listing;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("listings.$id route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getReviewsForListing.mockResolvedValue({ reviews: [], total: 0 });
    mocks.createConversation.mockReset();
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });

  // ── clientLoader tests ────────────────────────────────────────────────

  describe("clientLoader", () => {
    it("loads listing with valid UUID", async () => {
      const listing = makeListing();
      mocks.getListingById.mockResolvedValue(listing);
      const result = await clientLoader({
        params: { id: "11111111-1111-1111-1111-111111111111" },
      } as any);
      expect(result).toMatchObject({ listing, error: null });
      expect((result as any).categoryFieldDefs).toBeDefined();
    });

    it("accepts SAFE_ID_PATTERN id", async () => {
      const listing = makeListing();
      mocks.getListingById.mockResolvedValue(listing);
      const result = await clientLoader({
        params: { id: "ABC123-valid_id" },
      } as any);
      expect(result).toMatchObject({ listing, error: null });
      expect(mocks.getListingById).toHaveBeenCalledWith("ABC123-valid_id");
    });

    it("throws 404 for invalid id", async () => {
      await expect(
        clientLoader({ params: { id: "!!!" } } as any)
      ).rejects.toThrow();
    });

    it("throws 404 for empty id", async () => {
      await expect(
        clientLoader({ params: { id: "" } } as any)
      ).rejects.toThrow();
    });

    it("throws 404 for undefined id", async () => {
      await expect(
        clientLoader({ params: {} } as any)
      ).rejects.toThrow();
    });

    it("throws 404 for too short id", async () => {
      await expect(
        clientLoader({ params: { id: "abc" } } as any)
      ).rejects.toThrow();
    });

    it("throws 404 on genuine 404 API error", async () => {
      const err = new AxiosError("Not Found", undefined, undefined, undefined, {
        status: 404,
        statusText: "Not Found",
        headers: {},
        config: { headers: {} } as any,
        data: {},
      } as any);
      mocks.getListingById.mockRejectedValue(err);
      await expect(
        clientLoader({
          params: { id: "11111111-1111-1111-1111-111111111111" },
        } as any)
      ).rejects.toThrow();
    });

    it("returns in-page error for transient network failure", async () => {
      mocks.getListingById.mockRejectedValue(new Error("Network Error"));
      const result = await clientLoader({
        params: { id: "11111111-1111-1111-1111-111111111111" },
      } as any) as any;
      expect(result.listing).toBeNull();
      expect(typeof result.error).toBe("string");
    });

    it("returns in-page error for timeout", async () => {
      mocks.getListingById.mockRejectedValue(new AxiosError("timeout", "ECONNABORTED"));
      const result = await clientLoader({
        params: { id: "11111111-1111-1111-1111-111111111111" },
      } as any) as any;
      expect(result.listing).toBeNull();
      expect(result.error).toContain("timed out");
    });
  });

  // ── Component render tests ────────────────────────────────────────────

  describe("ListingDetail component", () => {
    it("renders listing title", async () => {
      await renderListingDetail();
      expect(screen.getByText(/DSLR Camera for Rent/)).toBeInTheDocument();
    });

    it("renders listing description", async () => {
      await renderListingDetail();
      expect(screen.getByText(/Professional grade camera/)).toBeInTheDocument();
    });

    it("renders gallery component", async () => {
      await renderListingDetail();
      expect(screen.getByTestId("gallery")).toBeInTheDocument();
    });

    it("renders location", async () => {
      await renderListingDetail();
      expect(screen.getAllByText(/Kathmandu/).length).toBeGreaterThan(0);
    });

    it("renders pricing", async () => {
      await renderListingDetail();
      expect(screen.getAllByText(/500/).length).toBeGreaterThan(0);
    });

    it("handles listing with no images", async () => {
      await renderListingDetail({ images: [] });
      expect(screen.getByText(/DSLR Camera/)).toBeInTheDocument();
    });

    it("handles missing location", async () => {
      await renderListingDetail({ location: {} });
      expect(screen.getByText(/DSLR Camera/)).toBeInTheDocument();
    });

    it("shows contextual in-page recovery copy when contacting the owner fails", async () => {
      await renderListingDetail();
      mocks.createConversation.mockRejectedValue(new Error("boom"));

      fireEvent.click(screen.getByRole("button", { name: /Message Owner/i }));

      await waitFor(() => {
        expect(
          screen.getByText(
            "Unable to start a conversation for this listing right now. Try again."
          )
        ).toBeInTheDocument();
      });
    });
  });

  describe("error helpers", () => {
    it("preserves backend booking messages", () => {
      expect(
        getListingBookingError(
          { response: { data: { message: "Selected dates are no longer available" } } },
          "fallback"
        )
      ).toBe("Selected dates are no longer available");
    });

    it("uses actionable booking offline copy", () => {
      const online = window.navigator.onLine;
      Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        value: false,
      });

      expect(getListingBookingError(new Error("Network Error"), "fallback")).toBe(
        "You appear to be offline. Reconnect and try creating the booking again."
      );

      Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        value: online,
      });
    });

    it("uses timeout-specific booking copy", () => {
      expect(
        getListingBookingError(new AxiosError("timeout", "ECONNABORTED"), "fallback")
      ).toBe("Booking creation timed out. Try again.");
    });

    it("uses actionable contact-owner offline copy", () => {
      const online = window.navigator.onLine;
      Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        value: false,
      });

      expect(getListingContactOwnerError(new Error("Network Error"), "fallback")).toBe(
        "You appear to be offline. Reconnect and try contacting the owner again."
      );

      Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        value: online,
      });
    });

    it("uses conflict-specific contact-owner copy", () => {
      expect(
        getListingContactOwnerError(
          new AxiosError("Conflict", undefined, undefined, undefined, {
            status: 409,
            statusText: "Conflict",
            headers: {},
            config: { headers: {} } as any,
            data: {},
          } as any),
          "fallback"
        )
      ).toBe("This conversation was already created. Open your messages and try again.");
    });

    it("uses contextual contact-owner fallback copy for unknown errors", () => {
      expect(
        getListingContactOwnerError(
          new Error("boom"),
          "Unable to start a conversation for this listing right now. Try again."
        )
      ).toBe("Unable to start a conversation for this listing right now. Try again.");
    });

    it("uses actionable availability offline copy", () => {
      const online = window.navigator.onLine;
      Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        value: false,
      });

      expect(getListingAvailabilityError(new Error("Network Error"), "fallback")).toBe(
        "You appear to be offline. Reconnect and try checking availability again."
      );

      Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        value: online,
      });
    });

    it("uses timeout-specific availability copy", () => {
      expect(
        getListingAvailabilityError(new AxiosError("timeout", "ECONNABORTED"), "fallback")
      ).toBe("Availability check timed out. Try again.");
    });

    it("preserves backend price calculation messages", () => {
      expect(
        getListingPriceCalculationError(
          { response: { data: { message: "Promo code is no longer valid" } } },
          "fallback"
        )
      ).toBe("Promo code is no longer valid");
    });

    it("uses conflict-specific price calculation copy", () => {
      expect(
        getListingPriceCalculationError(
          new AxiosError("Conflict", undefined, undefined, undefined, {
            status: 409,
            statusText: "Conflict",
            headers: {},
            config: { headers: {} } as any,
            data: {},
          } as any),
          "fallback"
        )
      ).toBe("Pricing changed while you were checking. Try again.");
    });

    it("uses actionable reviews offline copy", () => {
      const online = window.navigator.onLine;
      Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        value: false,
      });

      expect(getListingReviewsError(new Error("Network Error"), "fallback")).toBe(
        "You appear to be offline. Reconnect and try loading reviews again."
      );

      Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        value: online,
      });
    });

    it("uses timeout-specific reviews copy", () => {
      expect(
        getListingReviewsError(new AxiosError("timeout", "ECONNABORTED"), "fallback")
      ).toBe("Loading reviews timed out. Try again.");
    });

    it("getListingLoadError: uses actionable offline copy", () => {
      Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        value: false,
      });
      expect(getListingLoadError(new Error("Network Error"))).toBe(
        "You appear to be offline. Reconnect and try loading this listing again."
      );
    });

    it("getListingLoadError: uses timeout-specific copy", () => {
      expect(
        getListingLoadError(new AxiosError("timeout", "ECONNABORTED"))
      ).toBe("Loading this listing timed out. Try again.");
    });

    it("getListingLoadError: preserves backend response message", () => {
      expect(
        getListingLoadError({
          response: { data: { message: "Listing is not published" } },
        })
      ).toBe("Listing is not published");
    });
  });

  describe("ListingDetail loader error state", () => {
    it("renders retry button and error message when listing is null", async () => {
      mocks.useLoaderData.mockReturnValue({
        listing: null,
        error: "Loading this listing timed out. Try again.",
      });
      render(<ListingDetail />);
      expect(screen.getByText("Loading this listing timed out. Try again.")).toBeInTheDocument();
      // Retry button and back link are present (text depends on i18n key resolution)
      expect(screen.getByRole("button")).toBeInTheDocument();
      expect(screen.getByRole("link")).toBeInTheDocument();
    });
  });
});
