import { AxiosError } from "axios";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const IconStub = vi.hoisted(() => (props: any) => (
  <span data-testid="icon-stub" />
));
const dashboardState = vi.hoisted(() => ({
  userActivityLevel: "active",
  showFirstTimeHelp: false,
  personalizedRecommendations: {
    title: "Keep exploring",
    description: "Recommended next actions",
    actionUrl: "/search",
    actionText: "Browse listings",
  },
}));
const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  getMyBookings: vi.fn(),
  getFavorites: vi.fn(),
  searchListings: vi.fn(),
  getUnreadNotifCount: vi.fn(),
  getUnreadMsgCount: vi.fn(),
  useLoaderData: vi.fn(),
  revalidate: vi.fn(),
  requestNavigation: vi.fn(),
  redirect: vi.fn(
    (url: string) =>
      new Response("", { status: 302, headers: { Location: url } })
  ),
}));

vi.mock("react-router", () => ({
  useLoaderData: () => mocks.useLoaderData(),
  useRevalidator: () => ({ revalidate: mocks.revalidate, state: "idle" }),
  redirect: mocks.redirect,
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
  useLocation: () => ({ pathname: "/" }),
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
vi.mock("~/lib/navigation", () => ({
  requestNavigation: (...args: any[]) => mocks.requestNavigation(...args),
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
  ProgressiveDisclosure: ({ children }: any) => <div>{children}</div>,
  CollapsibleSection: ({ children }: any) => <div>{children}</div>,
  ContextualHelp: ({ children }: any) => <div>{children}</div>,
  FirstTimeHelp: ({ title, action }: any) => (
    <div>
      <div>{title}</div>
      {action ? <button onClick={action.onClick}>{action.label}</button> : null}
    </div>
  ),
  UnifiedButton: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock("~/components/ui/skeleton", () => ({ PageSkeleton: () => <div /> }));
vi.mock("~/components/layout", () => ({
  PageContainer: ({ children }: any) => <div>{children}</div>,
  PageHeader: ({ title }: any) => <h1>{title}</h1>,
  DashboardSidebar: () => <nav />,
  PortalPageLayout: ({ children, banner, actions }: any) => <div>{banner}{actions}{children}</div>,
}));
vi.mock("~/components/dashboard/RecentActivity", () => ({
  RecentActivity: () => <div data-testid="recent-activity" />,
}));
vi.mock("~/components/dashboard/DashboardCustomizer", () => ({
  DashboardCustomizer: () => <div data-testid="dashboard-customizer" />,
}));
vi.mock("~/components/mobile", () => ({
  MobileDashboardNavigation: () => <div data-testid="mobile-dashboard-nav" />,
}));
vi.mock("~/hooks/useDashboardState", () => ({
  useDashboardState: () => dashboardState,
}));
vi.mock("~/hooks/useDashboardPreferences", () => ({
  useDashboardPreferences: (_key: string, sections: any[]) => ({
    orderedSections: sections,
    hiddenIds: new Set(),
    pinnedIds: new Set(),
    updatePreferences: vi.fn(),
    togglePinned: vi.fn(),
    toggleHidden: vi.fn(),
    resetPreferences: vi.fn(),
  }),
}));
vi.mock("~/components/favorites", () => ({
  CompactFavoriteButton: () => <button />,
}));
vi.mock("~/config/navigation", () => ({ renterNavSections: [] }));
vi.mock("lucide-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("lucide-react")>();
  return {
    ...actual,
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
  };
});

import RenterDashboard, { clientLoader } from "./dashboard.renter";

describe("dashboard.renter route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
    dashboardState.userActivityLevel = "active";
    dashboardState.showFirstTimeHelp = false;
    dashboardState.personalizedRecommendations = {
      title: "Keep exploring",
      description: "Recommended next actions",
      actionUrl: "/search",
      actionText: "Browse listings",
    };
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
      mocks.getMyBookings.mockRejectedValue(new AxiosError("timeout", "ECONNABORTED"));
      mocks.getFavorites.mockRejectedValue(new Error("fail"));
      const r = await clientLoader({
        request: new Request("http://localhost"),
      } as any) as any;
      expect(r.stats.upcomingBookings).toBe(0);
      expect(r.failedSections).toContain("bookings");
      expect(r.failedSections).toContain("favorites");
      expect(r.error).toBe(
        "Loading the renter dashboard timed out. Try again. Some sections could not be loaded: bookings, favorites."
      );
    });

    it("uses offline-specific copy for partial dashboard failures", async () => {
      Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        value: false,
      });
      mocks.requireUser.mockResolvedValue({ id: "u1", role: "renter" });
      mocks.getMyBookings.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));

      const r = await clientLoader({
        request: new Request("http://localhost"),
      } as any) as any;

      expect(r.error).toBe(
        "You appear to be offline. Reconnect and try loading the renter dashboard again. Some sections could not be loaded: bookings."
      );
    });

    it("preserves backend messages for partial dashboard failures", async () => {
      mocks.requireUser.mockResolvedValue({ id: "u1", role: "renter" });
      mocks.getMyBookings.mockRejectedValue({
        response: { data: { message: "Renter booking insights are recalculating" } },
      });

      const r = await clientLoader({
        request: new Request("http://localhost"),
      } as any) as any;

      expect(r.error).toBe("Renter booking insights are recalculating");
    });

    it("tracks timeout and offline failures in failedSections", async () => {
      const previousOnline = navigator.onLine;
      Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        value: false,
      });
      mocks.requireUser.mockResolvedValue({ id: "u1", role: "renter" });
      mocks.getMyBookings.mockRejectedValue(new AxiosError("timeout", "ECONNABORTED"));
      mocks.getFavorites.mockResolvedValue({ favorites: [] });
      mocks.searchListings.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));
      mocks.getUnreadNotifCount.mockResolvedValue({ count: 0 });
      mocks.getUnreadMsgCount.mockResolvedValue({ count: 0 });

      const r = await clientLoader({
        request: new Request("http://localhost"),
      } as any) as any;

      expect(r.failedSections).toContain("bookings");
      expect(r.failedSections).toContain("recommendations");
      expect(r.recentBookings).toEqual([]);
      expect(r.recommendations).toEqual([]);

      Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        value: previousOnline,
      });
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

    it("uses timeout-specific copy when dashboard loading throws before settling", async () => {
      mocks.requireUser.mockResolvedValue({ id: "u1", role: "renter" });
      mocks.getMyBookings.mockImplementation(() => {
        throw new AxiosError("timeout", "ECONNABORTED");
      });

      const r = await clientLoader({
        request: new Request("http://localhost"),
      } as any) as any;

      expect(r.error).toBe("Loading the renter dashboard timed out. Try again.");
    });

    it("uses offline-specific copy when dashboard loading throws before settling", async () => {
      Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        value: false,
      });
      mocks.requireUser.mockResolvedValue({ id: "u1", role: "renter" });
      mocks.getMyBookings.mockImplementation(() => {
        throw new AxiosError("Network Error", "ERR_NETWORK");
      });

      const r = await clientLoader({
        request: new Request("http://localhost"),
      } as any) as any;

      expect(r.error).toBe(
        "You appear to be offline. Reconnect and try loading the renter dashboard again."
      );
    });

    it("preserves backend dashboard load errors", async () => {
      mocks.requireUser.mockResolvedValue({ id: "u1", role: "renter" });
      mocks.getMyBookings.mockImplementation(() => {
        throw { response: { data: { message: "Renter dashboard is recalculating your activity" } } };
      });

      const r = await clientLoader({
        request: new Request("http://localhost"),
      } as any) as any;

      expect(r.error).toBe("Renter dashboard is recalculating your activity");
    });
  });

  it("uses app navigation for the first-time help browse action", () => {
    dashboardState.userActivityLevel = "new";
    dashboardState.showFirstTimeHelp = true;
    mocks.useLoaderData.mockReturnValue({
      stats: {
        upcomingBookings: 0,
        activeBookings: 0,
        completedBookings: 0,
        totalSpent: 0,
        favoriteCount: 0,
      },
      recentBookings: [],
      favorites: [],
      recommendations: [],
      unreadNotifications: 0,
      unreadMessages: 0,
      failedSections: [],
    });

    render(<RenterDashboard />);

    fireEvent.click(screen.getByRole("button", { name: "Browse Items" }));

    expect(mocks.requestNavigation).toHaveBeenCalledWith("/search");
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

    it("revalidates when the partial-failure retry action is clicked", () => {
      mocks.useLoaderData.mockReturnValue({
        stats: {
          upcomingBookings: 0,
          activeBookings: 0,
          completedBookings: 0,
          totalSpent: 0,
          favoriteCount: 0,
        },
        recentBookings: [],
        favorites: [],
        recommendations: [],
        unreadNotifications: 0,
        unreadMessages: 0,
        error:
          "Loading the renter dashboard timed out. Try again. Some sections could not be loaded: bookings.",
        failedSections: ["bookings"],
      });
      render(<RenterDashboard />);
      expect(
        screen.getByText(
          "Loading the renter dashboard timed out. Try again. Some sections could not be loaded: bookings."
        )
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /Retry/i }));
      expect(mocks.revalidate).toHaveBeenCalledTimes(1);
    });
  });
});
