import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
const IconStub = vi.hoisted(() => (props: any) => (
  <span data-testid="icon-stub" />
));
vi.mock("lucide-react", () => ({
  Heart: IconStub,
  MapPin: IconStub,
  Star: IconStub,
  Trash2: IconStub,
  Search: IconStub,
  Grid: IconStub,
  List: IconStub,
  Loader2: IconStub,
  ChevronLeft: IconStub,
  ChevronRight: IconStub,
}));

/* ------------------------------------------------------------------ */
const mocks: Record<string, any> = {
  getUser: vi.fn(),
  getFavoriteListings: vi.fn(),
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
  useLoaderData: () => ({ favorites: [], error: null }),
  useRevalidator: () => ({ revalidate: vi.fn() }),
}));
vi.mock("~/utils/auth", () => ({
  getUser: (...a: any[]) => mocks.getUser(...a),
}));
vi.mock("~/lib/api/listings", () => ({
  listingsApi: {
    getFavoriteListings: (...a: any[]) => mocks.getFavoriteListings(...a),
  },
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("~/hooks/useFavorites", () => ({
  favoritesKeys: { all: ["favorites"] },
}));
vi.mock("~/components/ui", () => ({
  Button: ({ children, ...p }: any) => <button {...p}>{children}</button>,
  Badge: ({ children }: any) => <span>{children}</span>,
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("~/components/layout", () => ({
  PortalPageLayout: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("~/config/navigation", () => ({
  getPortalNavSections: () => [],
  resolvePortalNavRole: () => "renter",
}));
vi.mock("~/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { clientLoader } from "./favorites";

const authUser = { id: "u1", role: "renter" };

beforeEach(() => vi.clearAllMocks());

describe("clientLoader", () => {
  it("redirects unauthenticated", async () => {
    mocks.getUser.mockResolvedValue(null);
    const r = await clientLoader({
      request: new Request("http://localhost/favorites"),
    } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/auth/login");
  });

  it("returns favorites array", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getFavoriteListings.mockResolvedValue([
      { id: "l1", title: "Bike" },
      { id: "l2", title: "Car" },
    ]);
    const r = (await clientLoader({
      request: new Request("http://localhost/favorites"),
    } as any)) as any;
    expect(r.favorites).toHaveLength(2);
    expect(r.error).toBeNull();
  });

  it("ensures result is array even if API returns non-array", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getFavoriteListings.mockResolvedValue("not-an-array");
    const r = (await clientLoader({
      request: new Request("http://localhost/favorites"),
    } as any)) as any;
    expect(r.favorites).toEqual([]);
  });

  it("returns empty array on API error", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getFavoriteListings.mockRejectedValue(new Error("fail"));
    const r = (await clientLoader({
      request: new Request("http://localhost/favorites"),
    } as any)) as any;
    expect(r.favorites).toEqual([]);
    expect(r.error).toBeTruthy();
  });
});
