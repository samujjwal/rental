import { describe, it, expect, vi, beforeEach } from "vitest";

/* ─── Mocks ───────────────────────────────────────────────────────── */
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getMyOrganizations: vi.fn(),
  getOrganization: vi.fn(),
  redirect: vi.fn((url: string) => new Response(null, { status: 302, headers: { Location: url } })),
}));

vi.mock("react-router", () => ({
  useLoaderData: vi.fn(),
  useRevalidator: vi.fn(() => ({ revalidate: vi.fn(), state: "idle" })),
  redirect: mocks.redirect,
  Link: ({ children, to, ...p }: any) => <a href={to} {...p}>{children}</a>,
}));
vi.mock("~/utils/auth", () => ({
  getUser: (...a: any[]) => mocks.getUser(...a),
}));
vi.mock("~/lib/api/organizations", () => ({
  organizationsApi: {
    getMyOrganizations: (...a: any[]) => mocks.getMyOrganizations(...a),
    getOrganization: (...a: any[]) => mocks.getOrganization(...a),
  },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
const IconStub = vi.hoisted(() => (props: any) => <span data-testid="icon-stub" />);
vi.mock("lucide-react", () => ({
  MapPin: IconStub,
  Star: IconStub,
  AlertCircle: IconStub,
}));
vi.mock("~/lib/utils", () => ({
  cn: (...a: any[]) => a.filter(Boolean).join(" "),
  formatCurrency: (v: number) => `NPR ${v}`,
}));
vi.mock("~/components/ui", () => ({
  UnifiedButton: ({ children, ...p }: any) => <button {...p}>{children}</button>,
  Badge: ({ children }: any) => <span>{children}</span>,
  PageSkeleton: () => <div />,
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("~/components/ui/error-state", () => ({
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));

import { clientLoader } from "./organizations.$id.listings";

const VALID_UUID = "a1b2c3d4-e5f6-1234-a5b6-c7d8e9f0a1b2";

beforeEach(() => vi.clearAllMocks());

/* ================================================================== */
/*  clientLoader                                                       */
/* ================================================================== */
describe("organizations.$id.listings clientLoader", () => {
  it("redirects unauthenticated users", async () => {
    mocks.getUser.mockResolvedValue(null);
    const r = await clientLoader({
      params: { id: VALID_UUID },
      request: new Request("http://localhost/organizations/" + VALID_UUID + "/listings"),
    } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/auth/login");
  });

  it("redirects on invalid UUID", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    const r = await clientLoader({
      params: { id: "not-uuid" },
      request: new Request("http://localhost/organizations/not-uuid/listings"),
    } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/organizations");
  });

  it("redirects when user has no access", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    mocks.getMyOrganizations.mockResolvedValue({ organizations: [] });
    const r = await clientLoader({
      params: { id: VALID_UUID },
      request: new Request("http://localhost/organizations/" + VALID_UUID + "/listings"),
    } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/organizations");
  });

  it("returns organization for authorized user", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    mocks.getMyOrganizations.mockResolvedValue({
      organizations: [{ id: VALID_UUID }],
    });
    mocks.getOrganization.mockResolvedValue({
      id: VALID_UUID,
      name: "Test Org",
      listings: [{ id: "l1", title: "Apartment" }],
    });
    const r = (await clientLoader({
      params: { id: VALID_UUID },
      request: new Request("http://localhost/organizations/" + VALID_UUID + "/listings"),
    } as any)) as any;
    expect(r.organization.name).toBe("Test Org");
    expect(r.error).toBeNull();
  });

  it("admin bypasses membership check", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "admin" });
    mocks.getOrganization.mockResolvedValue({ id: VALID_UUID, name: "Org" });
    const r = (await clientLoader({
      params: { id: VALID_UUID },
      request: new Request("http://localhost/organizations/" + VALID_UUID + "/listings"),
    } as any)) as any;
    expect(r.organization.name).toBe("Org");
  });

  it("handles API error", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    mocks.getMyOrganizations.mockResolvedValue({
      organizations: [{ id: VALID_UUID }],
    });
    mocks.getOrganization.mockRejectedValue(new Error("Connection lost"));
    const r = (await clientLoader({
      params: { id: VALID_UUID },
      request: new Request("http://localhost/organizations/" + VALID_UUID + "/listings"),
    } as any)) as any;
    expect(r.error).toBe("Connection lost");
    expect(r.organization).toBeNull();
  });
});
