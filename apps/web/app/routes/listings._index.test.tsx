import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const IconStub = vi.hoisted(() => (props: any) => <span data-testid="icon-stub" />);
const mocks = vi.hoisted(() => ({
  getMyListings: vi.fn(),
  getListingById: vi.fn(),
  deleteListing: vi.fn(),
  pauseListing: vi.fn(),
  activateListing: vi.fn(),
  publishListing: vi.fn(),
  getUser: vi.fn(),
  useLoaderData: vi.fn(),
  useActionData: vi.fn(),
  useSearchParams: vi.fn(() => [new URLSearchParams(), vi.fn()]),
  useRevalidator: vi.fn(() => ({ revalidate: vi.fn(), state: "idle" })),
  useNavigation: vi.fn(() => ({ state: "idle" })),
  redirect: vi.fn((url: string) => {
    return new Response("", { status: 302, headers: { Location: url } });
  }),
}));

vi.mock("react-router", () => ({
  useLoaderData: () => mocks.useLoaderData(),
  useActionData: () => mocks.useActionData(),
  useSearchParams: () => mocks.useSearchParams(),
  useRevalidator: () => mocks.useRevalidator(),
  useNavigation: () => mocks.useNavigation(),
  redirect: mocks.redirect,
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>{children}</a>
  ),
  Form: ({ children, ...props }: any) => <form {...props}>{children}</form>,
}));

vi.mock("~/lib/api/listings", () => ({
  listingsApi: {
    getMyListings: (...args: any[]) => mocks.getMyListings(...args),
    getListingById: (...args: any[]) => mocks.getListingById(...args),
    deleteListing: (...args: any[]) => mocks.deleteListing(...args),
    pauseListing: (...args: any[]) => mocks.pauseListing(...args),
    activateListing: (...args: any[]) => mocks.activateListing(...args),
    publishListing: (...args: any[]) => mocks.publishListing(...args),
  },
}));

vi.mock("~/utils/auth", () => ({
  getUser: (...args: any[]) => mocks.getUser(...args),
}));

vi.mock("~/components/ui", () => ({
  UnifiedButton: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
  Badge: ({ children }: any) => <span>{children}</span>,
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => ({
  Plus: IconStub, Search: IconStub, Grid: IconStub, List: IconStub, Edit: IconStub,
  Trash2: IconStub, Eye: IconStub, MoreVertical: IconStub, MapPin: IconStub, Star: IconStub,
  TrendingUp: IconStub, AlertCircle: IconStub, Clock: IconStub, CheckCircle: IconStub, Pause: IconStub,
}));

// ─── Import after mocks ─────────────────────────────────────────────────────

import OwnerListingsPage, { clientLoader, clientAction } from "./listings._index";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFormData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return { formData: () => Promise.resolve(fd) } as unknown as Request;
}

const validId = "11111111-1111-1111-8111-111111111111";

function makeListing(overrides: Record<string, unknown> = {}) {
  return {
    id: validId,
    title: "Camera",
    description: "Great camera",
    images: ["img.jpg"],
    status: "AVAILABLE",
    basePrice: 500,
    currency: "NPR",
    location: { city: "Kathmandu", state: "Bagmati" },
    averageRating: 4.5,
    reviewCount: 10,
    bookingsCount: 5,
    totalEarnings: 2500,
    category: { name: "Electronics" },
    createdAt: "2025-01-01",
    instantBooking: false,
    ownerId: "owner-1",
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("listings._index route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("clientLoader", () => {
    it("redirects to login when not authenticated", async () => {
      mocks.getUser.mockResolvedValue(null);
      const result = await clientLoader({
        request: new Request("http://localhost/listings"),
      } as any) as any;
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(302);
    });

    it("redirects renter to dashboard", async () => {
      mocks.getUser.mockResolvedValue({ id: "u1", role: "renter" });
      const result = await clientLoader({
        request: new Request("http://localhost/listings"),
      } as any) as any;
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).headers.get("Location")).toBe("/dashboard/renter");
    });

    it("loads listings for owner", async () => {
      mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
      mocks.getMyListings.mockResolvedValue([
        makeListing(),
        makeListing({ id: "2", status: "DRAFT", totalEarnings: 0, bookingsCount: 0 }),
      ]);
      const result = await clientLoader({
        request: new Request("http://localhost/listings"),
      } as any) as any;
      expect(result.listings).toHaveLength(2);
      expect(result.stats.total).toBe(2);
      expect(result.stats.active).toBe(1);
      expect(result.stats.draft).toBe(1);
      expect(result.error).toBeNull();
    });

    it("filters by status", async () => {
      mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
      mocks.getMyListings.mockResolvedValue([
        makeListing({ status: "AVAILABLE" }),
        makeListing({ id: "2", status: "DRAFT" }),
      ]);
      const result = await clientLoader({
        request: new Request("http://localhost/listings?status=DRAFT"),
      } as any) as any;
      expect(result.listings).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it("ignores invalid status filter", async () => {
      mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
      mocks.getMyListings.mockResolvedValue([makeListing()]);
      const result = await clientLoader({
        request: new Request("http://localhost/listings?status=INVALID"),
      } as any) as any;
      expect(result.listings).toHaveLength(1);
    });

    it("filters by search text", async () => {
      mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
      mocks.getMyListings.mockResolvedValue([
        makeListing({ title: "Camera", description: "A nice camera" }),
        makeListing({ id: "2", title: "Bicycle", description: "Mountain bike" }),
      ]);
      const result = await clientLoader({
        request: new Request("http://localhost/listings?search=camera"),
      } as any) as any;
      expect(result.listings).toHaveLength(1);
    });

    it("calculates stats correctly", async () => {
      mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
      mocks.getMyListings.mockResolvedValue([
        makeListing({ totalEarnings: 1000, bookingsCount: 3 }),
        makeListing({ id: "2", totalEarnings: 2000, bookingsCount: 7, status: "RENTED" }),
      ]);
      const result = await clientLoader({
        request: new Request("http://localhost/listings"),
      } as any) as any;
      expect(result.stats.totalEarnings).toBe(3000);
      expect(result.stats.totalBookings).toBe(10);
      expect(result.stats.rented).toBe(1);
    });

    it("handles API error gracefully", async () => {
      mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
      mocks.getMyListings.mockRejectedValue(new Error("fail"));
      const result = await clientLoader({
        request: new Request("http://localhost/listings"),
      } as any) as any;
      expect(result.listings).toEqual([]);
      expect(result.error).toBeTruthy();
    });
  });

  describe("clientAction", () => {
    it("redirects to login when not authenticated", async () => {
      mocks.getUser.mockResolvedValue(null);
      const result = await clientAction({
        request: makeFormData({ intent: "delete", listingId: validId }),
      } as any) as any;
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(302);
    });

    it("rejects unauthorized role", async () => {
      mocks.getUser.mockResolvedValue({ id: "u1", role: "renter" });
      const result = await clientAction({
        request: makeFormData({ intent: "delete", listingId: validId }),
      } as any) as any;
      expect(result.success).toBe(false);
      expect(result.message).toContain("Unauthorized");
    });

    it("rejects invalid listing ID", async () => {
      mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
      const result = await clientAction({
        request: makeFormData({ intent: "delete", listingId: "bad" }),
      } as any) as any;
      expect(result.success).toBe(false);
      expect(result.message).toContain("Listing ID");
    });

    it("rejects unknown intent", async () => {
      mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
      mocks.getListingById.mockResolvedValue({ ownerId: "owner-1" });
      const result = await clientAction({
        request: makeFormData({ intent: "hack", listingId: validId }),
      } as any) as any;
      expect(result.success).toBe(false);
      expect(result.message).toContain("Unknown");
    });

    it("checks ownership for non-admin", async () => {
      mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
      mocks.getListingById.mockResolvedValue({ ownerId: "other-owner" });
      const result = await clientAction({
        request: makeFormData({
          intent: "delete",
          listingId: validId,
          confirmed: "true",
        }),
      } as any) as any;
      expect(result.success).toBe(false);
      expect(result.message).toContain("do not own");
    });

    it("deletes listing with confirmation", async () => {
      mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
      mocks.getListingById.mockResolvedValue({ ownerId: "owner-1" });
      mocks.deleteListing.mockResolvedValue({});
      const result = await clientAction({
        request: makeFormData({
          intent: "delete",
          listingId: validId,
          confirmed: "true",
        }),
      } as any) as any;
      expect(result.success).toBe(true);
      expect(mocks.deleteListing).toHaveBeenCalledWith(validId);
    });

    it("requires confirmation for delete", async () => {
      mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
      mocks.getListingById.mockResolvedValue({ ownerId: "owner-1" });
      const result = await clientAction({
        request: makeFormData({
          intent: "delete",
          listingId: validId,
        }),
      } as any) as any;
      expect(result.success).toBe(false);
      expect(result.message).toContain("confirmation");
    });

    it("pauses listing", async () => {
      mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
      mocks.getListingById.mockResolvedValue({ ownerId: "owner-1" });
      mocks.pauseListing.mockResolvedValue({});
      const result = await clientAction({
        request: makeFormData({ intent: "pause", listingId: validId }),
      } as any) as any;
      expect(result.success).toBe(true);
    });

    it("activates listing", async () => {
      mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
      mocks.getListingById.mockResolvedValue({ ownerId: "owner-1" });
      mocks.activateListing.mockResolvedValue({});
      const result = await clientAction({
        request: makeFormData({ intent: "activate", listingId: validId }),
      } as any) as any;
      expect(result.success).toBe(true);
    });

    it("publishes listing", async () => {
      mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
      mocks.getListingById.mockResolvedValue({ ownerId: "owner-1" });
      mocks.publishListing.mockResolvedValue({});
      const result = await clientAction({
        request: makeFormData({ intent: "publish", listingId: validId }),
      } as any) as any;
      expect(result.success).toBe(true);
    });

    it("handles API error in action", async () => {
      mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
      mocks.getListingById.mockResolvedValue({ ownerId: "owner-1" });
      mocks.deleteListing.mockRejectedValue(new Error("Server error"));
      const result = await clientAction({
        request: makeFormData({
          intent: "delete",
          listingId: validId,
          confirmed: "true",
        }),
      } as any) as any;
      expect(result.success).toBe(false);
    });

    it("skips ownership check for admin", async () => {
      mocks.getUser.mockResolvedValue({ id: "admin-1", role: "admin" });
      mocks.deleteListing.mockResolvedValue({});
      const result = await clientAction({
        request: makeFormData({
          intent: "delete",
          listingId: validId,
          confirmed: "true",
        }),
      } as any) as any;
      expect(result.success).toBe(true);
      // Should not call getListingById for ownership
      expect(mocks.getListingById).not.toHaveBeenCalled();
    });
  });

  describe("OwnerListingsPage component", () => {
    beforeEach(() => {
      mocks.useActionData.mockReturnValue(null);
      mocks.useSearchParams.mockReturnValue([new URLSearchParams(), vi.fn()]);
    });

    it("renders listings", () => {
      mocks.useLoaderData.mockReturnValue({
        listings: [makeListing()],
        total: 1,
        stats: { total: 1, active: 1, rented: 0, draft: 0, unavailable: 0, totalEarnings: 2500, totalBookings: 5 },
        error: null,
      });
      render(<OwnerListingsPage />);
      expect(screen.getByText(/Camera/)).toBeInTheDocument();
    });

    it("renders error state", () => {
      mocks.useLoaderData.mockReturnValue({
        listings: [],
        total: 0,
        stats: { total: 0, active: 0, rented: 0, draft: 0, unavailable: 0, totalEarnings: 0, totalBookings: 0 },
        error: "Failed to load listings",
      });
      render(<OwnerListingsPage />);
      expect(screen.getByText(/Failed to load/i)).toBeInTheDocument();
    });

    it("renders empty state with create button", () => {
      mocks.useLoaderData.mockReturnValue({
        listings: [],
        total: 0,
        stats: { total: 0, active: 0, rented: 0, draft: 0, unavailable: 0, totalEarnings: 0, totalBookings: 0 },
        error: null,
      });
      render(<OwnerListingsPage />);
      expect(
        screen.getAllByText(/create|new listing|add listing/i).length
      ).toBeGreaterThan(0);
    });
  });
});
