import { AxiosError } from "axios";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

/* ─── Mocks ───────────────────────────────────────────────────────── */
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getMyOrganizations: vi.fn(),
  useLoaderData: vi.fn(),
  redirect: vi.fn((url: string) => new Response(null, { status: 302, headers: { Location: url } })),
}));

vi.mock("react-router", () => ({
  useLoaderData: () => mocks.useLoaderData(),
  redirect: mocks.redirect,
  Link: ({ children, to, ...p }: any) => <a href={to} {...p}>{children}</a>,
}));
vi.mock("~/utils/auth", () => ({
  getUser: (...a: any[]) => mocks.getUser(...a),
}));
vi.mock("~/lib/api/organizations", () => ({
  organizationsApi: {
    getMyOrganizations: (...a: any[]) => mocks.getMyOrganizations(...a),
  },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock("~/components/ui", () => ({
  UnifiedButton: ({ children, ...p }: any) => <button {...p}>{children}</button>,
  Badge: ({ children }: any) => <span>{children}</span>,
  Card: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  CardContent: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  PageSkeleton: () => <div data-testid="skeleton" />,
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("~/components/ui/error-state", () => ({
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));

import { clientLoader, getOrganizationsIndexLoadError } from "./organizations._index";

beforeEach(() => vi.clearAllMocks());

/* ================================================================== */
/*  clientLoader                                                       */
/* ================================================================== */
describe("clientLoader", () => {
  it("redirects unauthenticated users to login", async () => {
    mocks.getUser.mockResolvedValue(null);
    const r = await clientLoader({
      request: new Request("http://localhost/organizations"),
    } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/auth/login");
  });

  it("returns organizations on success", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    mocks.getMyOrganizations.mockResolvedValue({
      organizations: [{ id: "o1", name: "Org A" }],
    });
    const r = (await clientLoader({
      request: new Request("http://localhost/organizations"),
    } as any)) as any;
    expect(r.organizations).toHaveLength(1);
    expect(r.error).toBeNull();
  });

  it("handles API error gracefully", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    mocks.getMyOrganizations.mockRejectedValue(new Error("Network failure"));
    const r = (await clientLoader({
      request: new Request("http://localhost/organizations"),
    } as any)) as any;
    expect(r.organizations).toEqual([]);
    expect(r.error).toBe("Network failure");
  });

  it("uses actionable offline copy on loader failure", async () => {
    const previousOnline = navigator.onLine;
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    mocks.getMyOrganizations.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));

    const r = (await clientLoader({
      request: new Request("http://localhost/organizations"),
    } as any)) as any;

    expect(r.error).toBe("You appear to be offline. Reconnect and try again.");

    Object.defineProperty(navigator, "onLine", { configurable: true, value: previousOnline });
  });

  it("handles non-array organizations safely", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    mocks.getMyOrganizations.mockResolvedValue({ organizations: null });
    const r = (await clientLoader({
      request: new Request("http://localhost/organizations"),
    } as any)) as any;
    expect(r.organizations).toEqual([]);
    expect(r.error).toBeNull();
  });

  it("preserves plain thrown error messages in helper", () => {
    expect(getOrganizationsIndexLoadError(new Error("org service unavailable"))).toBe(
      "org service unavailable"
    );
  });
});

/* ================================================================== */
/*  Component rendering                                                */
/* ================================================================== */
describe("OrganizationsIndex component", () => {
  it("renders empty state when no organizations", async () => {
    mocks.useLoaderData.mockReturnValue({ organizations: [], error: null });
    const { default: OrganizationsIndex } = await import("./organizations._index");
    render(<OrganizationsIndex />);
    expect(screen.getByText("organizations.title")).toBeTruthy();
    expect(screen.getByText("organizations.empty")).toBeTruthy();
  });

  it("renders organization cards", async () => {
    mocks.useLoaderData.mockReturnValue({
      organizations: [
        { id: "o1", name: "Org A", slug: "org-a", verificationStatus: "VERIFIED" },
        { id: "o2", name: "Org B", slug: "org-b", verificationStatus: "PENDING" },
      ],
      error: null,
    });
    const { default: OrganizationsIndex } = await import("./organizations._index");
    render(<OrganizationsIndex />);
    expect(screen.getByText("Org A")).toBeTruthy();
    expect(screen.getByText("Org B")).toBeTruthy();
  });

  it("renders error banner", async () => {
    mocks.useLoaderData.mockReturnValue({
      organizations: [],
      error: "Something went wrong",
    });
    const { default: OrganizationsIndex } = await import("./organizations._index");
    render(<OrganizationsIndex />);
    expect(screen.getByText("Something went wrong")).toBeTruthy();
  });
});
