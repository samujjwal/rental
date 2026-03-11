import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const IconStub = vi.hoisted(() => (props: any) => (
  <span data-testid="icon-stub" />
));
const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  getMyBookings: vi.fn(),
  getFavorites: vi.fn(),
  searchListings: vi.fn(),
  getUnreadNotifCount: vi.fn(),
  getUnreadMsgCount: vi.fn(),
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
vi.mock("~/lib/api/bookings", () => ({
  bookingsApi: { getMyBookings: () => mocks.getMyBookings() },
}));
vi.mock("~/lib/api/favorites", () => ({
  getFavorites: () => mocks.getFavorites(),
}));
vi.mock("~/lib/api/listings", () => ({
  listingsApi: { searchListings: () => mocks.searchListings() },
}));
vi.mock("~/lib/api/notifications", () => ({
  notificationsApi: { getUnreadCount: () => mocks.getUnreadNotifCount() },
}));
vi.mock("~/lib/api/messaging", () => ({
  messagingApi: { getUnreadCount: () => mocks.getUnreadMsgCount() },
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
vi.mock("date-fns", () => ({ format: () => "Jan 1, 2025" }));
vi.mock("~/components/ui", () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
  Badge: ({ children }: any) => <span>{children}</span>,
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("~/components/ui/skeleton", () => ({ PageSkeleton: () => <div /> }));
vi.mock("~/components/layout", () => ({
  PageContainer: ({ children }: any) => <div>{children}</div>,
  PageHeader: ({ title }: any) => <h1>{title}</h1>,
  DashboardSidebar: () => <nav />,
  PortalPageLayout: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("~/components/favorites", () => ({
  CompactFavoriteButton: () => <button />,
}));
vi.mock("~/config/navigation", () => ({ renterNavSections: [] }));
vi.mock("lucide-react", () => ({
  Package: IconStub,
  Calendar: IconStub,
  Heart: IconStub,
  Star: IconStub,
  Clock: IconStub,
  CheckCircle: IconStub,
  XCircle: IconStub,
  MapPin: IconStub,
  Search: IconStub,
  TrendingUp: IconStub,
  ArrowRight: IconStub,
}));

import RenterDashboard, { clientLoader } from "./dashboard.renter";

describe("dashboard.renter route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getMyBookings.mockResolvedValue([]);
    mocks.getFavorites.mockResolvedValue({ favorites: [] });
    mocks.searchListings.mockResolvedValue({ listings: [] });
    mocks.getUnreadNotifCount.mockResolvedValue({ count: 0 });
    mocks.getUnreadMsgCount.mockResolvedValue({ count: 0 });
  });

  describe("clientLoader", () => {
    it("redirects admin to /admin", async () => {
      mocks.requireUser.mockResolvedValue({ id: "u1", role: "admin" });
      const r = await clientLoader({
        request: new Request("http://localhost"),
      } as any) as any;
      expect((r as Response).headers.get("Location")).toBe("/admin");
    });

    it("redirects owner to /dashboard/owner", async () => {
      mocks.requireUser.mockResolvedValue({ id: "u1", role: "owner" });
      const r = await clientLoader({
        request: new Request("http://localhost"),
      } as any) as any;
      expect((r as Response).headers.get("Location")).toBe("/dashboard/owner");
    });

    it("loads data for renter", async () => {
      mocks.requireUser.mockResolvedValue({ id: "u1", role: "renter" });
      mocks.getMyBookings.mockResolvedValue([
        {
          id: "b1",
          status: "CONFIRMED",
          startDate: "2099-12-01",
          createdAt: "2025-01-01",
          totalAmount: 1000,
        },
        {
          id: "b2",
          status: "IN_PROGRESS",
          createdAt: "2025-01-02",
          totalAmount: 2000,
        },
        {
          id: "b3",
          status: "COMPLETED",
          createdAt: "2025-01-03",
          totalAmount: 3000,
        },
      ]);
      mocks.getFavorites.mockResolvedValue({
        favorites: [{ listing: { id: "l1" }, createdAt: "2025-01-01" }],
      });
      const r = await clientLoader({
        request: new Request("http://localhost"),
      } as any) as any;
      expect(r.stats.upcomingBookings).toBe(1);
      expect(r.stats.activeBookings).toBe(1);
      expect(r.stats.completedBookings).toBe(1);
      expect(r.stats.totalSpent).toBe(3000);
      expect(r.stats.favoriteCount).toBe(1);
    });

    it("handles API failures gracefully", async () => {
      mocks.requireUser.mockResolvedValue({ id: "u1", role: "renter" });
      mocks.getMyBookings.mockRejectedValue(new Error("fail"));
      mocks.getFavorites.mockRejectedValue(new Error("fail"));
      const r = await clientLoader({
        request: new Request("http://localhost"),
      } as any) as any;
      expect(r.stats.upcomingBookings).toBe(0);
      expect(r.failedSections).toContain("bookings");
      expect(r.failedSections).toContain("favorites");
    });

    it("limits recent bookings to 5", async () => {
      mocks.requireUser.mockResolvedValue({ id: "u1", role: "renter" });
      const bookings = Array.from({ length: 10 }, (_, i) => ({
        id: `b${i}`,
        status: "CONFIRMED",
        createdAt: `2025-01-${String(i + 1).padStart(2, "0")}`,
      }));
      mocks.getMyBookings.mockResolvedValue(bookings);
      const r = await clientLoader({
        request: new Request("http://localhost"),
      } as any) as any;
      expect(r.recentBookings).toHaveLength(5);
    });

    it("calculates totalSpent from completed bookings", async () => {
      mocks.requireUser.mockResolvedValue({ id: "u1", role: "renter" });
      mocks.getMyBookings.mockResolvedValue([
        {
          id: "b1",
          status: "COMPLETED",
          totalAmount: 500,
          createdAt: "2025-01-01",
        },
        {
          id: "b2",
          status: "SETTLED",
          totalPrice: 300,
          createdAt: "2025-01-02",
        },
        {
          id: "b3",
          status: "PENDING",
          totalAmount: 1000,
          createdAt: "2025-01-03",
        },
      ]);
      const r = await clientLoader({
        request: new Request("http://localhost"),
      } as any) as any;
      // Only completed + settled counted, uses totalAmount ?? totalPrice
      expect(r.stats.totalSpent).toBe(800);
    });
  });

  describe("RenterDashboard component", () => {
    it("renders dashboard", () => {
      mocks.useLoaderData.mockReturnValue({
        stats: {
          upcomingBookings: 1,
          activeBookings: 2,
          completedBookings: 5,
          totalSpent: 5000,
          favoriteCount: 3,
        },
        recentBookings: [],
        favorites: [],
        recommendations: [],
        unreadNotifications: 0,
        unreadMessages: 0,
        failedSections: [],
      });
      render(<RenterDashboard />);
      expect(
        screen.getAllByText(/dashboard|bookings|favorites/i).length
      ).toBeGreaterThan(0);
    });
  });
});
