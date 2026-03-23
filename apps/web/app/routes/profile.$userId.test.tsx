import { AxiosError } from "axios";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

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
  useLoaderData: vi.fn(),
  navigate: vi.fn(),
  revalidate: vi.fn(),
  redirect: vi.fn((url: string) => new Response(null, { status: 302, headers: { Location: url } })),
};

vi.mock("react-router", () => ({
  Link: ({ children, to, ...p }: any) => <a href={to} {...p}>{children}</a>,
  redirect: (...a: any[]) => mocks.redirect(...a),
  useLoaderData: () => mocks.useLoaderData(),
  useNavigate: () => mocks.navigate,
  useRevalidator: () => ({ revalidate: mocks.revalidate, state: "idle" }),
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
  UnifiedButton: ({ children, ...props }: any) => <button {...props}>{children}</button>,
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

import ProfileRoute, { clientLoader, getProfileLoadError } from "./profile.$userId";

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: true,
  });
});

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
    const r = (await clientLoader({ params: { userId: validId }, request: new Request("http://localhost") } as any)) as any;
    expect(r.user).toBeNull();
    expect(r.error).toBe("Not found");
  });

  it("returns actionable offline error on loader failure", async () => {
    const previousOnline = navigator.onLine;
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });
    mocks.getUserById.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));

    const r = (await clientLoader({ params: { userId: validId }, request: new Request("http://localhost") } as any)) as any;
    expect(r.error).toBe("You appear to be offline. Reconnect and try loading this profile again.");

    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: previousOnline,
    });
  });

  it("returns timeout-specific error on loader failure", async () => {
    mocks.getUserById.mockRejectedValue(new AxiosError("timeout", "ECONNABORTED"));

    const r = (await clientLoader({ params: { userId: validId }, request: new Request("http://localhost") } as any)) as any;
    expect(r.error).toBe("Loading this profile timed out. Try again.");
  });
});

describe("ProfileRoute component", () => {
  it("renders retryable fallback UI when the profile failed to load", () => {
    mocks.useLoaderData.mockReturnValue({
      user: null,
      listings: [],
      reviews: [],
      stats: {
        totalListings: 0,
        activeListings: 0,
        averageRating: 0,
        totalReviews: 0,
      },
      error: "Loading this profile timed out. Try again.",
    });

    render(<ProfileRoute />);

    expect(screen.getByText("Profile unavailable")).toBeInTheDocument();
    expect(screen.getByText("Loading this profile timed out. Try again.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(mocks.revalidate).toHaveBeenCalledTimes(1);
  });
});

describe("getProfileLoadError", () => {
  it("preserves backend response messages", () => {
    expect(
      getProfileLoadError({ response: { data: { message: "Profile is temporarily unavailable" } } })
    ).toBe("Profile is temporarily unavailable");
  });

  it("uses actionable offline copy", () => {
    const previousOnline = navigator.onLine;
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });

    expect(getProfileLoadError(new Error("Network Error"))).toBe(
      "You appear to be offline. Reconnect and try loading this profile again."
    );

    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: previousOnline,
    });
  });

  it("uses timeout-specific copy", () => {
    expect(getProfileLoadError(new AxiosError("timeout", "ECONNABORTED"))).toBe(
      "Loading this profile timed out. Try again."
    );
  });
});
