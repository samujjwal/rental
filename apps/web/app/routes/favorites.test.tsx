import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AxiosError } from "axios";

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
  removeFavorite: vi.fn(),
  invalidateQueries: vi.fn(),
  revalidate: vi.fn(),
  useLoaderData: vi.fn(),
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
vi.mock("~/lib/api/listings", () => ({
  listingsApi: {
    getFavoriteListings: (...a: any[]) => mocks.getFavoriteListings(...a),
    removeFavorite: (...a: any[]) => mocks.removeFavorite(...a),
  },
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));
vi.mock("~/hooks/useFavorites", () => ({
  favoritesKeys: { all: ["favorites"] },
}));
vi.mock("~/components/ui", () => ({
  Button: ({ children, ...p }: any) => <button {...p}>{children}</button>,
  Badge: ({ children }: any) => <span>{children}</span>,
  Dialog: ({ children, open }: any) => (open ? <div>{children}</div> : null),
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("~/components/ui/empty-state", () => ({
  EmptyStatePresets: {
    NoFavorites: () => <div data-testid="empty-favorites" />,
    NoFavoritesFiltered: () => <div data-testid="empty-favorites-filtered" />,
  },
}));
vi.mock("~/components/layout", () => ({
  PortalPageLayout: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("~/config/navigation", () => ({
  getPortalNavSections: () => [],
  resolvePortalNavRole: () => "renter",
}));
vi.mock("~/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import {
  default as FavoritesPage,
  clientLoader,
  getFavoritesLoadError,
  getFavoriteRemovalError,
} from "./favorites";

const makeFavorite = (overrides: Record<string, unknown> = {}) => ({
  id: "listing-1",
  title: "Camera",
  description: "Mirrorless camera",
  images: [],
  basePrice: 500,
  currency: "NPR",
  location: { city: "Kathmandu", state: "Bagmati" },
  averageRating: 4.5,
  reviewCount: 12,
  category: { name: "Electronics" },
  owner: { firstName: "Sam", lastName: "Owner" },
  instantBooking: false,
  deliveryAvailable: false,
  ...overrides,
});

const authUser = { id: "u1", role: "renter" };

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: true,
  });
  mocks.useLoaderData.mockReturnValue({
    favorites: [],
    portalRole: "renter",
    error: null,
  });
});

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

  it("returns actionable offline copy on loader failure", async () => {
    const previousOnline = navigator.onLine;
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getFavoriteListings.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));

    const r = (await clientLoader({
      request: new Request("http://localhost/favorites"),
    } as any)) as any;

    expect(r.error).toBe("You appear to be offline. Reconnect and try again.");

    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: previousOnline,
    });
  });
});

describe("favorites error helpers", () => {
  it("preserves backend removal messages", () => {
    expect(
      getFavoriteRemovalError(
        { response: { data: { message: "Listing is already removed" } } },
        "fallback"
      )
    ).toBe("Listing is already removed");
  });

  it("uses actionable offline copy for removal failures", () => {
    const previousOnline = navigator.onLine;
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });

    expect(getFavoriteRemovalError(new AxiosError("Network Error", "ERR_NETWORK"), "fallback")).toBe(
      "You appear to be offline. Reconnect and try again."
    );

    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: previousOnline,
    });
  });

  it("keeps plain thrown load errors when provided", () => {
    expect(getFavoritesLoadError(new Error("favorites unavailable"))).toBe(
      "favorites unavailable"
    );
  });

  it("uses timeout-specific copy for loader failures", () => {
    expect(
      getFavoritesLoadError(new AxiosError("timeout", "ECONNABORTED"))
    ).toBe("Loading favorites timed out. Try again.");
  });
});

describe("FavoritesPage component", () => {
  it("revalidates from the full-page loader error state", () => {
    mocks.useLoaderData.mockReturnValue({
      favorites: [],
      portalRole: "renter",
      error: "Loading favorites timed out. Try again.",
    });

    render(<FavoritesPage />);

    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(mocks.revalidate).toHaveBeenCalledTimes(1);
  });

  it("closes a stale removal dialog after loader data refresh removes that listing", () => {
    const favorite = makeFavorite();
    mocks.useLoaderData.mockReturnValue({
      favorites: [favorite],
      portalRole: "renter",
      error: null,
    });

    const { rerender } = render(<FavoritesPage />);

    const initialButtons = screen.getAllByRole("button");
    fireEvent.click(initialButtons[1]);

    const listButtons = screen.getAllByRole("button");
    fireEvent.click(listButtons[2]);

    expect(screen.getAllByText("Camera").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Remove from favorites" }).length
    ).toBeGreaterThan(1);

    mocks.useLoaderData.mockReturnValue({
      favorites: [],
      portalRole: "renter",
      error: null,
    });

    rerender(<FavoritesPage />);

    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    expect(
      screen.queryAllByRole("button", { name: "Remove from favorites" })
    ).toHaveLength(0);
  });

  it("reconciles pagination after a filtered search shrinks the result set", () => {
    mocks.useLoaderData.mockReturnValue({
      favorites: Array.from({ length: 13 }, (_, index) =>
        makeFavorite({
          id: `listing-${index + 1}`,
          title: index === 12 ? "Tripod" : `Camera ${index + 1}`,
        })
      ),
      portalRole: "renter",
      error: null,
    });

    render(<FavoritesPage />);

    const pageButtons = screen.getAllByRole("button");
    fireEvent.click(pageButtons[pageButtons.length - 1]);

    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Tripod" },
    });

    expect(screen.queryByText("Page 2 of 2")).not.toBeInTheDocument();
    expect(screen.queryByText("Camera 1")).not.toBeInTheDocument();
    expect(screen.getByText("Tripod")).toBeInTheDocument();
  });
});
