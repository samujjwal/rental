import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const IconStub = vi.hoisted(() => (props: any) => <span data-testid="icon-stub" />);
const mocks = vi.hoisted(() => ({
  getListingById: vi.fn(),
  getCategories: vi.fn(),
  useLoaderData: vi.fn(),
  useNavigate: vi.fn(() => vi.fn()),
  navigate: vi.fn(),
}));

vi.mock("react-router", () => ({
  useLoaderData: () => mocks.useLoaderData(),
  useNavigate: () => mocks.navigate,
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("~/lib/api/listings", () => ({
  listingsApi: {
    getListingById: (...args: any[]) => mocks.getListingById(...args),
  },
}));

vi.mock("~/lib/api/bookings", () => ({
  bookingsApi: {
    calculateBooking: vi.fn(),
    createBooking: vi.fn(),
  },
}));

vi.mock("~/lib/api/reviews", () => ({
  reviewsApi: { getReviewsByListing: vi.fn(), getReviewsForListing: vi.fn() },
}));

vi.mock("~/lib/category-fields", () => ({
  getCategoryFields: vi.fn(() => []),
  groupCategoryFields: vi.fn(() => ({})),
  formatFieldValue: vi.fn((v: unknown) => String(v)),
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
  UnifiedButton: ({ children, ...props }: any) => (
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

import ListingDetail, { clientLoader } from "./listings.$id";

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

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("listings.$id route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── clientLoader tests ────────────────────────────────────────────────

  describe("clientLoader", () => {
    it("loads listing with valid UUID", async () => {
      const listing = makeListing();
      mocks.getListingById.mockResolvedValue(listing);
      const result = await clientLoader({
        params: { id: "11111111-1111-1111-1111-111111111111" },
      } as any);
      expect(result).toEqual({ listing });
    });

    it("accepts SAFE_ID_PATTERN id", async () => {
      const listing = makeListing();
      mocks.getListingById.mockResolvedValue(listing);
      const result = await clientLoader({
        params: { id: "ABC123-valid_id" },
      } as any);
      expect(result).toEqual({ listing });
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

    it("throws 404 on API error", async () => {
      mocks.getListingById.mockRejectedValue(new Error("Not found"));
      await expect(
        clientLoader({
          params: { id: "11111111-1111-1111-1111-111111111111" },
        } as any)
      ).rejects.toThrow();
    });
  });

  // ── Component render tests ────────────────────────────────────────────

  describe("ListingDetail component", () => {
    it("renders listing title", () => {
      mocks.useLoaderData.mockReturnValue({ listing: makeListing() });
      render(<ListingDetail />);
      expect(screen.getByText(/DSLR Camera for Rent/)).toBeInTheDocument();
    });

    it("renders listing description", () => {
      mocks.useLoaderData.mockReturnValue({ listing: makeListing() });
      render(<ListingDetail />);
      expect(screen.getByText(/Professional grade camera/)).toBeInTheDocument();
    });

    it("renders gallery component", () => {
      mocks.useLoaderData.mockReturnValue({ listing: makeListing() });
      render(<ListingDetail />);
      expect(screen.getByTestId("gallery")).toBeInTheDocument();
    });

    it("renders location", () => {
      mocks.useLoaderData.mockReturnValue({ listing: makeListing() });
      render(<ListingDetail />);
      expect(screen.getAllByText(/Kathmandu/).length).toBeGreaterThan(0);
    });

    it("renders pricing", () => {
      mocks.useLoaderData.mockReturnValue({ listing: makeListing() });
      render(<ListingDetail />);
      expect(screen.getAllByText(/500/).length).toBeGreaterThan(0);
    });

    it("handles listing with no images", () => {
      mocks.useLoaderData.mockReturnValue({
        listing: makeListing({ images: [] }),
      });
      render(<ListingDetail />);
      expect(screen.getByText(/DSLR Camera/)).toBeInTheDocument();
    });

    it("handles missing location", () => {
      mocks.useLoaderData.mockReturnValue({
        listing: makeListing({ location: {} }),
      });
      render(<ListingDetail />);
      expect(screen.getByText(/DSLR Camera/)).toBeInTheDocument();
    });
  });
});
