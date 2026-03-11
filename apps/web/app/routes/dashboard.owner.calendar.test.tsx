import { describe, it, expect, vi, beforeEach } from "vitest";

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
  useLoaderData: () => ({ bookings: [], listings: [] }),
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
  PortalPageLayout: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("~/config/navigation", () => ({ ownerNavSections: [] }));

import { clientLoader } from "./dashboard.owner.calendar";

const ownerUser = { id: "u1", role: "owner" };

beforeEach(() => vi.clearAllMocks());

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
});
