import { describe, it, expect, vi, beforeEach } from "vitest";
import { AxiosError } from "axios";

/* ─── Mocks ───────────────────────────────────────────────────────── */
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getOrganization: vi.fn(),
  getMembers: vi.fn(),
  updateOrganization: vi.fn(),
  deactivateOrganization: vi.fn(),
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
    updateOrganization: (...a: any[]) => mocks.updateOrganization(...a),
    deactivateOrganization: (...a: any[]) => mocks.deactivateOrganization(...a),
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
  UnifiedButton: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  Dialog: ({ open, children }: any) => (open ? <div>{children}</div> : null),
  DialogFooter: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("~/components/ui/error-state", () => ({
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));

import { clientLoader, clientAction, getOrganizationSettingsActionError, getOrganizationSettingsLoadError } from "./organizations.$id.settings";

const VALID_ID = "ckx1234567890abcdefghijkl";

beforeEach(() => vi.clearAllMocks());

beforeEach(() => {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: true,
  });
});

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return { formData: () => Promise.resolve(fd) } as unknown as Request;
}

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

describe("organizations.$id.settings clientAction", () => {
  beforeEach(() => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    mocks.getMembers.mockResolvedValue({
      members: [{ userId: "u1", role: "OWNER" }],
    });
  });

  it("preserves backend response messages for update failures", async () => {
    mocks.updateOrganization.mockRejectedValue({
      response: { data: { message: "Organization slug already exists" } },
    });
    const res = await clientAction({
      params: { id: VALID_ID },
      request: form({
        _action: "update",
        name: "My Org",
        emailAddress: "team@example.com",
        website: "https://example.com",
        phoneNumber: "+977123456789",
        postalCode: "44600",
        description: "Desc",
        address: "123 Main",
        city: "Kathmandu",
        state: "Bagmati",
        country: "Nepal",
      }),
    } as any);
    expect(res.success).toBe(false);
    expect(res.error).toBe("Organization slug already exists");
  });

  it("returns actionable offline copy for deactivate failures", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });
    mocks.deactivateOrganization.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));
    const res = await clientAction({
      params: { id: VALID_ID },
      request: form({ _action: "deactivate", deactivateConfirmation: "DEACTIVATE" }),
    } as any);
    expect(res.success).toBe(false);
    expect(res.error).toBe("You appear to be offline. Reconnect and try again.");
  });

  it("returns timeout-specific copy for update failures", async () => {
    mocks.updateOrganization.mockRejectedValue(new AxiosError("timeout", "ECONNABORTED"));
    const res = await clientAction({
      params: { id: VALID_ID },
      request: form({
        _action: "update",
        name: "My Org",
        emailAddress: "team@example.com",
        website: "https://example.com",
        phoneNumber: "+977123456789",
        postalCode: "44600",
        description: "Desc",
        address: "123 Main",
        city: "Kathmandu",
        state: "Bagmati",
        country: "Nepal",
      }),
    } as any);
    expect(res.success).toBe(false);
    expect(res.error).toBe("This organization request timed out. Try again.");
  });

  it("returns conflict-specific copy for update failures without backend messages", async () => {
    mocks.updateOrganization.mockRejectedValue(
      new AxiosError("Conflict", undefined, undefined, undefined, {
        status: 409,
        statusText: "Conflict",
        headers: {},
        config: { headers: {} } as any,
        data: {},
      } as any)
    );
    const res = await clientAction({
      params: { id: VALID_ID },
      request: form({
        _action: "update",
        name: "My Org",
        emailAddress: "team@example.com",
        website: "https://example.com",
        phoneNumber: "+977123456789",
        postalCode: "44600",
        description: "Desc",
        address: "123 Main",
        city: "Kathmandu",
        state: "Bagmati",
        country: "Nepal",
      }),
    } as any);
    expect(res.success).toBe(false);
    expect(res.error).toBe("This organization changed while you were editing it. Refresh and try again.");
  });
});

describe("organizations.$id.settings action helper", () => {
  it("keeps plain thrown errors when provided", () => {
    expect(getOrganizationSettingsActionError(new Error("boom"), "Failed to update organization")).toBe("boom");
  });
});

describe("organizations.$id.settings loader error", () => {
  it("returns actionable offline copy", () => {
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false });
    expect(
      getOrganizationSettingsLoadError(new AxiosError("Network Error", "ERR_NETWORK"))
    ).toBe("You appear to be offline. Reconnect and try again.");
  });

  it("returns timeout-specific copy", () => {
    expect(
      getOrganizationSettingsLoadError(new AxiosError("timeout", "ECONNABORTED"))
    ).toBe("Loading organization settings timed out. Try again.");
  });

  it("loader returns in-page error for network failure", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "admin" });
    mocks.getOrganization.mockRejectedValue(new AxiosError("timeout", "ECONNABORTED"));
    const r = await clientLoader({
      params: { id: VALID_ID },
      request: new Request("http://localhost/organizations/" + VALID_ID + "/settings"),
    } as any) as any;
    expect(r.organization).toBeNull();
    expect(typeof r.error).toBe("string");
    expect(r.error).toContain("timed out");
  });

  it("loader still redirects non-owner/non-admin", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    mocks.getMembers.mockResolvedValue({ members: [{ userId: "u1", role: "MEMBER" }] });
    const r = await clientLoader({
      params: { id: VALID_ID },
      request: new Request("http://localhost/organizations/" + VALID_ID + "/settings"),
    } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/organizations");
  });
});
