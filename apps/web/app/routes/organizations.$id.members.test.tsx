import { describe, it, expect, vi, beforeEach } from "vitest";

/* ─── Mocks ───────────────────────────────────────────────────────── */
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getMyOrganizations: vi.fn(),
  getOrganization: vi.fn(),
  getMembers: vi.fn(),
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
    getMembers: (...a: any[]) => mocks.getMembers(...a),
  },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock("~/config/locale", () => ({
  APP_LOCALE: "en-NP",
}));
vi.mock("~/lib/utils", () => ({
  cn: (...a: any[]) => a.filter(Boolean).join(" "),
}));
vi.mock("~/components/ui", () => ({
  PageSkeleton: () => <div data-testid="skeleton" />,
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("~/components/ui/error-state", () => ({
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));

import { clientLoader } from "./organizations.$id.members";

const VALID_UUID = "a1b2c3d4-e5f6-1234-a5b6-c7d8e9f0a1b2";

beforeEach(() => vi.clearAllMocks());

/* ================================================================== */
/*  clientLoader                                                       */
/* ================================================================== */
describe("organizations.$id.members clientLoader", () => {
  it("redirects unauthenticated users", async () => {
    mocks.getUser.mockResolvedValue(null);
    const r = await clientLoader({
      params: { id: VALID_UUID },
      request: new Request("http://localhost/organizations/" + VALID_UUID + "/members"),
    } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/auth/login");
  });

  it("redirects on invalid UUID", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    const r = await clientLoader({
      params: { id: "not-a-uuid" },
      request: new Request("http://localhost/organizations/not-a-uuid/members"),
    } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/organizations");
  });

  it("redirects when user has no access to org", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    mocks.getMyOrganizations.mockResolvedValue({ organizations: [{ id: "other-org" }] });
    const r = await clientLoader({
      params: { id: VALID_UUID },
      request: new Request("http://localhost/organizations/" + VALID_UUID + "/members"),
    } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/organizations");
  });

  it("returns organization with members for authorized user", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    mocks.getMyOrganizations.mockResolvedValue({
      organizations: [{ id: VALID_UUID }],
    });
    mocks.getOrganization.mockResolvedValue({ id: VALID_UUID, name: "My Org" });
    mocks.getMembers.mockResolvedValue({
      members: [
        { userId: "u1", role: "OWNER", name: "Owner" },
        { userId: "u2", role: "MEMBER", name: "Member" },
      ],
    });
    const r = (await clientLoader({
      params: { id: VALID_UUID },
      request: new Request("http://localhost/organizations/" + VALID_UUID + "/members"),
    } as any)) as any;
    expect(r.organization.members).toHaveLength(2);
    expect(r.canManageMembers).toBe(true);
    expect(r.currentUserId).toBe("u1");
  });

  it("admin bypasses membership check", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "admin" });
    mocks.getOrganization.mockResolvedValue({ id: VALID_UUID, name: "Org" });
    mocks.getMembers.mockResolvedValue({ members: [] });
    const r = (await clientLoader({
      params: { id: VALID_UUID },
      request: new Request("http://localhost/organizations/" + VALID_UUID + "/members"),
    } as any)) as any;
    expect(r.canManageMembers).toBe(true);
  });
});
