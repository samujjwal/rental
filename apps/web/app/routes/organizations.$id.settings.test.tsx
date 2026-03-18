import { describe, it, expect, vi, beforeEach } from "vitest";

/* ─── Mocks ───────────────────────────────────────────────────────── */
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getOrganization: vi.fn(),
  getMembers: vi.fn(),
  redirect: vi.fn((url: string) => new Response(null, { status: 302, headers: { Location: url } })),
}));

vi.mock("react-router", () => ({
  useLoaderData: vi.fn(),
  useActionData: vi.fn(),
  useNavigate: vi.fn(() => vi.fn()),
  Form: ({ children, ...p }: any) => <form {...p}>{children}</form>,
  Link: ({ children, to, ...p }: any) => <a href={to} {...p}>{children}</a>,
  redirect: mocks.redirect,
}));
vi.mock("~/utils/auth", () => ({
  getUser: (...a: any[]) => mocks.getUser(...a),
}));
vi.mock("~/lib/api/organizations", () => ({
  organizationsApi: {
    getOrganization: (...a: any[]) => mocks.getOrganization(...a),
    getMembers: (...a: any[]) => mocks.getMembers(...a),
    updateOrganization: vi.fn(),
  },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock("~/config/locale", () => ({
  APP_PHONE_PLACEHOLDER: "+977-XXXXXXXXXX",
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

import { clientLoader } from "./organizations.$id.settings";

const VALID_ID = "ckx1234567890abcdefghijkl";

beforeEach(() => vi.clearAllMocks());

/* ================================================================== */
/*  clientLoader                                                       */
/* ================================================================== */
describe("organizations.$id.settings clientLoader", () => {
  it("redirects unauthenticated users", async () => {
    mocks.getUser.mockResolvedValue(null);
    const r = await clientLoader({
      params: { id: VALID_ID },
      request: new Request("http://localhost/organizations/" + VALID_ID + "/settings"),
    } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/auth/login");
  });

  it("redirects on invalid organization id", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    const r = await clientLoader({
      params: { id: "bad-id" },
      request: new Request("http://localhost/organizations/bad-id/settings"),
    } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/organizations");
  });

  it("redirects non-owner/non-admin members", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    mocks.getMembers.mockResolvedValue({
      members: [{ userId: "u1", role: "MEMBER" }],
    });
    const r = await clientLoader({
      params: { id: VALID_ID },
      request: new Request("http://localhost/organizations/" + VALID_ID + "/settings"),
    } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/organizations");
  });

  it("allows admin users regardless of membership", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "admin" });
    mocks.getOrganization.mockResolvedValue({ id: VALID_ID, name: "Test Org" });
    const r = (await clientLoader({
      params: { id: VALID_ID },
      request: new Request("http://localhost/organizations/" + VALID_ID + "/settings"),
    } as any)) as any;
    expect(r.organization.name).toBe("Test Org");
  });

  it("allows OWNER role member", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    mocks.getMembers.mockResolvedValue({
      members: [{ userId: "u1", role: "OWNER" }],
    });
    mocks.getOrganization.mockResolvedValue({ id: VALID_ID, name: "My Org" });
    const r = (await clientLoader({
      params: { id: VALID_ID },
      request: new Request("http://localhost/organizations/" + VALID_ID + "/settings"),
    } as any)) as any;
    expect(r.organization.name).toBe("My Org");
  });
});
