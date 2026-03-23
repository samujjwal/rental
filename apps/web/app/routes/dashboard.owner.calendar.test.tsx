import { AxiosError } from "axios";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

/* ------------------------------------------------------------------ */
const IconStub = vi.hoisted(() => (props: any) => (
  <span data-testid="icon-stub" />
));
vi.mock("lucide-react", () => ({
  ArrowLeft: IconStub,
  ChevronLeft: IconStub,
  ChevronRight: IconStub,
  Calendar: IconStub,
  Plus: IconStub,
  Clock: IconStub,
  User: IconStub,
  Banknote: IconStub,
}));

/* ------------------------------------------------------------------ */
const mocks: Record<string, any> = {
  getUser: vi.fn(),
  getOwnerBookings: vi.fn(),
  getMyListings: vi.fn(),
  useLoaderData: vi.fn(),
  revalidate: vi.fn(),
  redirect: vi.fn(
    (url: string) =>
      new Response(null, { status: 302, headers: { Location: url } })
  ),
};

vi.mock("react-router", () => ({
  Link: ({ children, to, ...p }: any) => (
    <a href={to} {...p}>
      {children}
    </a>
  ),
  redirect: (...a: any[]) => mocks.redirect(...a),
  useLoaderData: () => mocks.useLoaderData(),
  useRevalidator: () => ({ revalidate: mocks.revalidate }),
}));
vi.mock("~/utils/auth", () => ({
  getUser: (...a: any[]) => mocks.getUser(...a),
}));
vi.mock("~/lib/api/bookings", () => ({
  bookingsApi: {
    getOwnerBookings: (...a: any[]) => mocks.getOwnerBookings(...a),
  },
}));
vi.mock("~/lib/api/listings", () => ({
  listingsApi: {
    getMyListings: (...a: any[]) => mocks.getMyListings(...a),
  },
}));
vi.mock("date-fns", () => ({
  format: () => "2024-01-01",
  startOfMonth: (d: Date) => d,
  endOfMonth: (d: Date) => d,
  eachDayOfInterval: () => [],
  isSameDay: () => false,
  isSameMonth: () => true,
  isToday: () => false,
  addMonths: (d: Date) => d,
  subMonths: (d: Date) => d,
  getDay: () => 0,
}));
vi.mock("~/lib/utils", () => ({
  cn: (...a: string[]) => a.filter(Boolean).join(" "),
}));
vi.mock("~/components/ui", () => ({
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
  UnifiedButton: ({ children, ...p }: any) => (
    <button {...p}>{children}</button>
  ),
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  Badge: ({ children }: any) => <span>{children}</span>,
}));
vi.mock("~/components/layout", () => ({
  PortalPageLayout: ({ banner, children }: any) => <div>{banner}{children}</div>,
}));
vi.mock("~/config/navigation", () => ({ ownerNavSections: [] }));

import OwnerCalendarPage, { clientLoader, getOwnerCalendarLoadError } from "./dashboard.owner.calendar";

const ownerUser = { id: "u1", role: "owner" };

beforeEach(() => vi.clearAllMocks());

beforeEach(() => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  mocks.useLoaderData.mockReturnValue({ bookings: [], listings: [], error: null });
});

describe("clientLoader", () => {
  it("redirects unauthenticated", async () => {
    mocks.getUser.mockResolvedValue(null);
    const r = await clientLoader({
      request: new Request("http://localhost/dashboard/owner/calendar"),
    } as any);
    expect((r as Response).headers.get("Location")).toBe("/auth/login");
  });

  it("redirects non-owner to /dashboard", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "renter" });
    const r = await clientLoader({
      request: new Request("http://localhost/dashboard/owner/calendar"),
    } as any);
    expect((r as Response).headers.get("Location")).toBe("/dashboard");
  });

  it("returns bookings and listings for owner", async () => {
    mocks.getUser.mockResolvedValue(ownerUser);
    mocks.getOwnerBookings.mockResolvedValue([{ id: "b1" }]);
    mocks.getMyListings.mockResolvedValue([{ id: "l1" }]);

    const r = (await clientLoader({
      request: new Request("http://localhost/dashboard/owner/calendar"),
    } as any)) as any;
    expect(r.bookings).toHaveLength(1);
    expect(r.listings).toHaveLength(1);
  });

  it("returns empty arrays on API error", async () => {
    mocks.getUser.mockResolvedValue(ownerUser);
    mocks.getOwnerBookings.mockRejectedValue(new Error("fail"));
    mocks.getMyListings.mockRejectedValue(new Error("fail"));

    const r = (await clientLoader({
      request: new Request("http://localhost/dashboard/owner/calendar"),
    } as any)) as any;
    expect(r.bookings).toEqual([]);
    expect(r.listings).toEqual([]);
    expect(r.error).toBeTruthy();
  });

  it("uses actionable offline copy on loader failure", async () => {
    const previousOnline = navigator.onLine;
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    mocks.getUser.mockResolvedValue(ownerUser);
    mocks.getOwnerBookings.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));
    mocks.getMyListings.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));

    const r = (await clientLoader({
      request: new Request("http://localhost/dashboard/owner/calendar"),
    } as any)) as any;

    expect(r.error).toBe("You appear to be offline. Reconnect and try again.");

    Object.defineProperty(navigator, "onLine", { configurable: true, value: previousOnline });
  });

  it("uses timeout-specific copy on loader failure", async () => {
    mocks.getUser.mockResolvedValue(ownerUser);
    mocks.getOwnerBookings.mockRejectedValue(new AxiosError("timeout", "ECONNABORTED"));
    mocks.getMyListings.mockRejectedValue(new AxiosError("timeout", "ECONNABORTED"));

    const r = (await clientLoader({
      request: new Request("http://localhost/dashboard/owner/calendar"),
    } as any)) as any;

    expect(r.error).toBe("Loading calendar data timed out. Try again.");
  });

  it("preserves plain thrown error messages in helper", () => {
    expect(getOwnerCalendarLoadError(new Error("calendar unavailable"))).toBe("calendar unavailable");
  });
});

describe("OwnerCalendarPage recovery UI", () => {
  it("revalidates from the error banner and fallback state", () => {
    mocks.useLoaderData.mockReturnValue({ bookings: [], listings: [], error: "Loading calendar data timed out. Try again." });

    render(<OwnerCalendarPage />);

    const retryButtons = screen.getAllByRole("button", { name: "Try Again" });
    fireEvent.click(retryButtons[0]);
    fireEvent.click(retryButtons[1]);

    expect(mocks.revalidate).toHaveBeenCalledTimes(2);
  });
});
