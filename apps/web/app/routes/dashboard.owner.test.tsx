import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const IconStub = vi.hoisted(() => (props: any) => (
  <span data-testid="icon-stub" />
));
const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  getMyListings: vi.fn(),
  getOwnerBookings: vi.fn(),
  getEarnings: vi.fn(),
  getUserStats: vi.fn(),
  getUnreadNotifCount: vi.fn(),
  getUnreadMsgCount: vi.fn(),
  getMyPolicies: vi.fn(),
  useLoaderData: vi.fn(),
  redirect: vi.fn(
    (url: string) =>
      new Response("", { status: 302, headers: { Location: url } })
  ),
}));

vi.mock("react-router", () => ({
  useLoaderData: () => mocks.useLoaderData(),
  redirect: mocks.redirect,
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));
vi.mock("~/utils/auth", () => ({
  requireUser: (...a: any[]) => mocks.requireUser(...a),
}));
vi.mock("~/lib/api/listings", () => ({
  listingsApi: { getMyListings: () => mocks.getMyListings() },
}));
vi.mock("~/lib/api/bookings", () => ({
  bookingsApi: { getOwnerBookings: () => mocks.getOwnerBookings() },
}));
vi.mock("~/lib/api/payments", () => ({
  paymentsApi: { getEarnings: () => mocks.getEarnings() },
}));
vi.mock("~/lib/api/users", () => ({
  usersApi: { getUserStats: () => mocks.getUserStats() },
}));
vi.mock("~/lib/api/notifications", () => ({
  notificationsApi: { getUnreadCount: () => mocks.getUnreadNotifCount() },
}));
vi.mock("~/lib/api/messaging", () => ({
  messagingApi: { getUnreadCount: () => mocks.getUnreadMsgCount() },
}));
vi.mock("~/lib/api/insurance", () => ({
  insuranceApi: { getMyPolicies: () => mocks.getMyPolicies() },
}));
vi.mock("~/lib/utils", () => ({
  cn: (...a: any[]) => a.filter(Boolean).join(" "),
  formatCurrency: (v: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "NPR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(v),
}));
vi.mock("date-fns", () => ({
  format: (d: any, p: string) => "Jan 1, 2025",
}));
vi.mock("~/components/ui", () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
  Badge: ({ children }: any) => <span>{children}</span>,
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("~/components/ui/skeleton", () => ({
  PageSkeleton: () => <div data-testid="skeleton" />,
}));
vi.mock("~/components/layout", () => ({
  PageContainer: ({ children }: any) => <div>{children}</div>,
  PageHeader: ({ title }: any) => <h1>{title}</h1>,
  DashboardSidebar: () => <nav data-testid="sidebar" />,
  PortalPageLayout: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("~/config/navigation", () => ({ ownerNavSections: [] }));
vi.mock("lucide-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("lucide-react")>();
  return {
    ...actual,
    Package: IconStub,
    Calendar: IconStub,
    Banknote: IconStub,
    MessageCircle: IconStub,
    AlertCircle: IconStub,
    Star: IconStub,
    CheckCircle: IconStub,
    Clock: IconStub,
    XCircle: IconStub,
    Plus: IconStub,
    ArrowUpRight: IconStub,
  };
});

import OwnerDashboard, { clientLoader } from "./dashboard.owner";

describe("dashboard.owner route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getMyListings.mockResolvedValue([]);
    mocks.getOwnerBookings.mockResolvedValue([]);
    mocks.getEarnings.mockResolvedValue({ amount: 0 });
    mocks.getUserStats.mockResolvedValue({ averageRating: 0, totalReviews: 0 });
    mocks.getUnreadNotifCount.mockResolvedValue({ count: 0 });
    mocks.getUnreadMsgCount.mockResolvedValue({ count: 0 });
    mocks.getMyPolicies.mockResolvedValue({
      data: [],
      pagination: { total: 0, page: 1, limit: 10, totalPages: 0 },
    });
  });

  describe("clientLoader", () => {
    it("redirects admin to /admin", async () => {
      mocks.requireUser.mockResolvedValue({ id: "u1", role: "admin" });
      const r = await clientLoader({
        request: new Request("http://localhost"),
      } as any) as any;
      expect((r as Response).headers.get("Location")).toBe("/admin");
    });

    it("redirects renter to /dashboard/renter", async () => {
      mocks.requireUser.mockResolvedValue({ id: "u1", role: "renter" });
      const r = await clientLoader({
        request: new Request("http://localhost"),
      } as any) as any;
      expect((r as Response).headers.get("Location")).toBe("/dashboard/renter");
    });

    it("loads data for owner", async () => {
      mocks.requireUser.mockResolvedValue({ id: "u1", role: "owner" });
      mocks.getMyListings.mockResolvedValue([
        { id: "l1", status: "AVAILABLE", availability: "available" },
        { id: "l2", status: "DRAFT", availability: "unavailable" },
      ]);
      mocks.getOwnerBookings.mockResolvedValue([
        { id: "b1", status: "PENDING_OWNER_APPROVAL", createdAt: "2025-01-01" },
        { id: "b2", status: "CONFIRMED", createdAt: "2025-01-02" },
        { id: "b3", status: "COMPLETED", createdAt: "2025-01-03" },
      ]);
      mocks.getEarnings.mockResolvedValue({ amount: 50000 });
      mocks.getUserStats.mockResolvedValue({
        averageRating: 4.5,
        totalReviews: 10,
      });

      const r = await clientLoader({
        request: new Request("http://localhost"),
      } as any) as any;
      expect(r.stats.totalListings).toBe(2);
      expect(r.stats.activeListings).toBe(1);
      expect(r.stats.pendingBookings).toBe(1);
      expect(r.stats.activeBookings).toBe(1);
      expect(r.stats.completedBookings).toBe(1);
      expect(r.stats.totalEarnings).toBe(50000);
      expect(r.stats.averageRating).toBe(4.5);
    });

    it("handles partial API failures gracefully", async () => {
      mocks.requireUser.mockResolvedValue({ id: "u1", role: "owner" });
      mocks.getMyListings.mockRejectedValue(new Error("fail"));
      mocks.getOwnerBookings.mockRejectedValue(new Error("fail"));

      const r = await clientLoader({
        request: new Request("http://localhost"),
      } as any) as any;
      expect(r.stats.totalListings).toBe(0);
      expect(r.stats.pendingBookings).toBe(0);
      expect(r.failedSections).toContain("listings");
      expect(r.failedSections).toContain("bookings");
    });

    it("normalizes booking statuses", async () => {
      mocks.requireUser.mockResolvedValue({ id: "u1", role: "owner" });
      mocks.getOwnerBookings.mockResolvedValue([
        { id: "b1", status: "IN_PROGRESS", createdAt: "2025-01-01" },
        {
          id: "b2",
          status: "AWAITING_RETURN_INSPECTION",
          createdAt: "2025-01-02",
        },
        { id: "b3", status: "SETTLED", createdAt: "2025-01-03" },
      ]);
      const r = await clientLoader({
        request: new Request("http://localhost"),
      } as any) as any;
      // IN_PROGRESS → active, AWAITING_RETURN_INSPECTION → return_requested (both counted as activeBookings)
      expect(r.stats.activeBookings).toBe(2);
      // SETTLED → counted as completed
      expect(r.stats.completedBookings).toBe(1);
    });

    it("limits recent bookings to 5", async () => {
      mocks.requireUser.mockResolvedValue({ id: "u1", role: "owner" });
      const bookings = Array.from({ length: 10 }, (_, i) => ({
        id: `b${i}`,
        status: "CONFIRMED",
        createdAt: `2025-01-${String(i + 1).padStart(2, "0")}`,
      }));
      mocks.getOwnerBookings.mockResolvedValue(bookings);
      const r = await clientLoader({
        request: new Request("http://localhost"),
      } as any) as any;
      expect(r.recentBookings).toHaveLength(5);
    });

    it("maps insurance policies from the API response shape", async () => {
      mocks.requireUser.mockResolvedValue({ id: "u1", role: "owner" });
      mocks.getMyPolicies.mockResolvedValue({
        data: [
          {
            id: "policy-1",
            endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
        pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
      });

      const r = await clientLoader({
        request: new Request("http://localhost"),
      } as any) as any;

      expect(r.hasInsurance).toBe(true);
      expect(r.expiringInsurancePolicies).toHaveLength(1);
    });
  });

  describe("OwnerDashboard component", () => {
    it("renders dashboard", () => {
      mocks.useLoaderData.mockReturnValue({
        stats: {
          activeListings: 2,
          totalListings: 5,
          pendingBookings: 1,
          activeBookings: 3,
          completedBookings: 10,
          totalEarnings: 50000,
          pendingEarnings: 5000,
          averageRating: 4.5,
          totalReviews: 20,
        },
        listings: [
          {
            id: "l1",
            title: "Camera",
            status: "AVAILABLE",
            images: [],
            basePrice: 500,
            averageRating: 4,
          },
        ],
        recentBookings: [],
        userStats: { averageRating: 4.5, totalReviews: 20 },
        unreadNotifications: 3,
        unreadMessages: 1,
        failedSections: [],
      });
      render(<OwnerDashboard />);
      expect(
        screen.getAllByText(/dashboard|listings|bookings/i).length
      ).toBeGreaterThan(0);
    });
  });
});
