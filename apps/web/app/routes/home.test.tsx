import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
const IconStub = vi.hoisted(() => (props: any) => <span data-testid="icon-stub" />);
vi.mock("lucide-react", () => ({
  Home: IconStub, Car: IconStub, Music: IconStub, PartyPopper: IconStub,
  Armchair: IconStub, Shirt: IconStub, Search: IconStub, Star: IconStub,
  MapPin: IconStub, Shield: IconStub, CreditCard: IconStub, CheckCircle: IconStub,
  LayoutDashboard: IconStub, Calendar: IconStub, MessageSquare: IconStub,
  Heart: IconStub, Camera: IconStub, Wrench: IconStub, Package: IconStub,
  ParkingSquare: IconStub, Dumbbell: IconStub, Building2: IconStub,
}));

/* ------------------------------------------------------------------ */
const mocks = {
  getFeaturedListings: vi.fn(),
  searchListings: vi.fn(),
};

vi.mock("react-router", () => ({
  Link: ({ children, to, ...p }: any) => <a href={to} {...p}>{children}</a>,
  useLoaderData: () => ({ featuredListings: [] }),
  useNavigate: () => vi.fn(),
  useNavigation: () => ({ state: "idle" }),
  createCookieSessionStorage: () => ({ getSession: vi.fn(), commitSession: vi.fn(), destroySession: vi.fn() }),
  redirect: (url: string) => new Response(null, { status: 302, headers: { Location: url } }),
}));
vi.mock("~/utils/auth", () => ({ getUser: vi.fn() }));
vi.mock("~/hooks/useFavorites", () => ({ favoritesKeys: { all: ["favorites"] } }));
vi.mock("~/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("~/lib/api/listings", () => ({
  listingsApi: {
    getFeaturedListings: (...a: any[]) => mocks.getFeaturedListings(...a),
    searchListings: (...a: any[]) => mocks.searchListings(...a),
  },
}));
vi.mock("~/lib/store/auth", () => {
  const state = { user: null, isAuthenticated: false };
  const useAuthStore: any = (sel?: (s: any) => any) => sel ? sel(state) : state;
  useAuthStore.getState = () => state;
  return { useAuthStore };
});
vi.mock("~/components/ui", () => ({
  UnifiedButton: ({ children, ...p }: any) => <button {...p}>{children}</button>,
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));

import { clientLoader } from "./home";

beforeEach(() => vi.clearAllMocks());

describe("clientLoader", () => {
  it("returns featured listings", async () => {
    const listings = Array.from({ length: 10 }, (_, i) => ({ id: `l${i}` }));
    mocks.getFeaturedListings.mockResolvedValue(listings);

    const r = (await clientLoader()) as any;
    expect(r.featuredListings).toHaveLength(8); // capped at 8
  });

  it("falls back to searchListings on featured failure", async () => {
    mocks.getFeaturedListings.mockRejectedValue(new Error("fail"));
    mocks.searchListings.mockResolvedValue({ listings: [{ id: "l1" }] });

    const r = (await clientLoader()) as any;
    expect(r.featuredListings).toHaveLength(1);
    expect(mocks.searchListings).toHaveBeenCalledWith(expect.objectContaining({ limit: 8 }));
  });

  it("returns empty array on double failure", async () => {
    mocks.getFeaturedListings.mockRejectedValue(new Error("fail"));
    mocks.searchListings.mockRejectedValue(new Error("fail2"));

    const r = (await clientLoader()) as any;
    expect(r.featuredListings).toEqual([]);
  });
});
