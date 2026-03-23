import { describe, it, expect, vi, beforeEach } from "vitest";
import { AxiosError } from "axios";

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
  UnifiedButton: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  Dialog: ({ open, children }: any) => (open ? <div>{children}</div> : null),
  DialogFooter: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("~/components/ui/error-state", () => ({
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));

import { clientLoader, getOrganizationMembersMutationError, getOrganizationMembersLoadError } from "./organizations.$id.members";

const VALID_ID = "ckx1234567890abcdefghijkl";

beforeEach(() => vi.clearAllMocks());

beforeEach(() => {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: true,
  });
});

/* ================================================================== */
/*  clientLoader                                                       */
/* ================================================================== */
describe("organizations.$id.members clientLoader", () => {
  it("redirects unauthenticated users", async () => {
    mocks.getUser.mockResolvedValue(null);
    const r = await clientLoader({
      params: { id: VALID_ID },
      request: new Request("http://localhost/organizations/" + VALID_ID + "/members"),
    } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/auth/login");
  });

  it("redirects on invalid organization id", async () => {
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
      params: { id: VALID_ID },
      request: new Request("http://localhost/organizations/" + VALID_ID + "/members"),
    } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/organizations");
  });

  it("returns organization with members for authorized user", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    mocks.getMyOrganizations.mockResolvedValue({
      organizations: [{ id: VALID_ID }],
    });
    mocks.getOrganization.mockResolvedValue({ id: VALID_ID, name: "My Org" });
    mocks.getMembers.mockResolvedValue({
      members: [
        { userId: "u1", role: "OWNER", name: "Owner" },
        { userId: "u2", role: "MEMBER", name: "Member" },
      ],
    });
    const r = (await clientLoader({
      params: { id: VALID_ID },
      request: new Request("http://localhost/organizations/" + VALID_ID + "/members"),
    } as any)) as any;
    expect(r.organization.members).toHaveLength(2);
    expect(r.canManageMembers).toBe(true);
    expect(r.currentUserId).toBe("u1");
  });

  it("admin bypasses membership check", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "admin" });
    mocks.getOrganization.mockResolvedValue({ id: VALID_ID, name: "Org" });
    mocks.getMembers.mockResolvedValue({ members: [] });
    const r = (await clientLoader({
      params: { id: VALID_ID },
      request: new Request("http://localhost/organizations/" + VALID_ID + "/members"),
    } as any)) as any;
    expect(r.canManageMembers).toBe(true);
  });
});

describe("organizations.$id.members mutation errors", () => {
  it("preserves backend response messages", () => {
    expect(
      getOrganizationMembersMutationError(
        { response: { data: { message: "Invite already pending for this email" } } },
        "Unable to send invite. Please try again."
      )
    ).toBe("Invite already pending for this email");
  });

  it("returns actionable offline copy", () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });

    expect(
      getOrganizationMembersMutationError(
        new AxiosError("Network Error", "ERR_NETWORK"),
        "Unable to send invite. Please try again."
      )
    ).toBe("You appear to be offline. Reconnect and try again.");
  });

  it("returns timeout-specific copy", () => {
    expect(
      getOrganizationMembersMutationError(
        new AxiosError("timeout", "ECONNABORTED"),
        "Unable to send invite. Please try again."
      )
    ).toBe("This request timed out. Try again.");
  });

  it("returns conflict-specific copy without a backend message", () => {
    expect(
      getOrganizationMembersMutationError(
        new AxiosError("Conflict", undefined, undefined, undefined, {
          status: 409,
          statusText: "Conflict",
          headers: {},
          config: { headers: {} } as any,
          data: {},
        } as any),
        "Unable to send invite. Please try again."
      )
    ).toBe("This organization changed while you were working. Refresh and try again.");
  });
});

describe("organizations.$id.members loader error", () => {
  it("returns actionable offline copy", () => {
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false });
    expect(
      getOrganizationMembersLoadError(new AxiosError("Network Error", "ERR_NETWORK"))
    ).toBe("You appear to be offline. Reconnect and try again.");
  });

  it("returns timeout-specific copy", () => {
    expect(
      getOrganizationMembersLoadError(new AxiosError("timeout", "ECONNABORTED"))
    ).toBe("Loading members timed out. Try again.");
  });

  it("loader returns in-page error for network failure", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "admin" });
    mocks.getOrganization.mockRejectedValue(new AxiosError("timeout", "ECONNABORTED"));
    mocks.getMembers.mockRejectedValue(new AxiosError("timeout", "ECONNABORTED"));
    const r = await clientLoader({
      params: { id: VALID_ID },
      request: new Request("http://localhost/organizations/" + VALID_ID + "/members"),
    } as any) as any;
    expect(r.organization).toBeNull();
    expect(r.canManageMembers).toBe(false);
    expect(typeof r.error).toBe("string");
    expect(r.error).toContain("timed out");
  });

  it("loader still redirects when user has no access to org", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    mocks.getMyOrganizations.mockResolvedValue({ organizations: [{ id: "other-org" }] });
    const r = await clientLoader({
      params: { id: VALID_ID },
      request: new Request("http://localhost/organizations/" + VALID_ID + "/members"),
    } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/organizations");
  });
});
