import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
const IconStub = vi.hoisted(() => (props: any) => <span data-testid="icon-stub" />);
vi.mock("lucide-react", () => ({
  User: IconStub, Calendar: IconStub, Star: IconStub, Package: IconStub,
  MessageCircle: IconStub, Shield: IconStub, Clock: IconStub,
}));

/* ------------------------------------------------------------------ */
const mocks: Record<string, any> = {
  getUserById: vi.fn(),
  getListingsByOwnerId: vi.fn(),
  getPublicUserReviews: vi.fn(),
  redirect: vi.fn((url: string) => new Response(null, { status: 302, headers: { Location: url } })),
};

vi.mock("react-router", () => ({
  Link: ({ children, to, ...p }: any) => <a href={to} {...p}>{children}</a>,
  redirect: (...a: any[]) => mocks.redirect(...a),
  useLoaderData: () => ({}),
  createCookieSessionStorage: () => ({ getSession: vi.fn(), commitSession: vi.fn(), destroySession: vi.fn() }),
}));
vi.mock("~/lib/api/users", () => ({
  usersApi: { getUserById: (...a: any[]) => mocks.getUserById(...a) },
}));
vi.mock("~/lib/api/listings", () => ({
  listingsApi: { getListingsByOwnerId: (...a: any[]) => mocks.getListingsByOwnerId(...a) },
}));
vi.mock("~/lib/api/reviews", () => ({
  reviewsApi: { getPublicUserReviews: (...a: any[]) => mocks.getPublicUserReviews(...a) },
}));
vi.mock("date-fns", () => ({ format: () => "2024-01-01" }));
vi.mock("~/lib/utils", () => ({ cn: (...a: string[]) => a.filter(Boolean).join(" ") }));
vi.mock("~/components/ui", () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  Badge: ({ children }: any) => <span>{children}</span>,
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("~/lib/store/auth", () => {
  const state = { user: null, isAuthenticated: false };
  const useAuthStore: any = (sel?: (s: any) => any) => sel ? sel(state) : state;
  useAuthStore.getState = () => state;
  return { useAuthStore };
});
vi.mock("~/types/listing", () => ({}));
vi.mock("~/types/review", () => ({}));

const validId = "ckx1234567890abcdefghijkl";

import { clientLoader } from "./profile.$userId";

beforeEach(() => vi.clearAllMocks());

describe("clientLoader", () => {
  it("throws redirect on invalid UUID", async () => {
    try {
      await clientLoader({ params: { userId: "bad" }, request: new Request("http://localhost") } as any);
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(Response);
      expect((e as Response).headers.get("Location")).toBe("/");
    }
  });

  it("returns user profile with computed stats", async () => {
    mocks.getUserById.mockResolvedValue({ id: validId, firstName: "John" });
    mocks.getListingsByOwnerId.mockResolvedValue({
      listings: [
        { id: "l1", status: "AVAILABLE" },
        { id: "l2", status: "RENTED" },
      ],
    });
    mocks.getPublicUserReviews.mockResolvedValue({
      reviews: [
        { overallRating: 5 },
        { overallRating: 3 },
      ],
    });

    const r = (await clientLoader({ params: { userId: validId }, request: new Request("http://localhost") } as any)) as any;
    expect(r.user.firstName).toBe("John");
    expect(r.stats.totalListings).toBe(2);
    expect(r.stats.activeListings).toBe(1);
    expect(r.stats.averageRating).toBe(4);
    expect(r.stats.totalReviews).toBe(2);
  });

  it("throws redirect on API error", async () => {
    mocks.getUserById.mockRejectedValue(new Error("Not found"));
    try {
      await clientLoader({ params: { userId: validId }, request: new Request("http://localhost") } as any);
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(Response);
      expect((e as Response).headers.get("Location")).toBe("/");
    }
  });
});
