import { AxiosError } from "axios";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

/* ─── Mocks ───────────────────────────────────────────────────────── */
const IconStub = vi.hoisted(() => (props: any) => <span data-testid="icon-stub" />);

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createOrganization: vi.fn(),
  useActionData: vi.fn(),
  useNavigation: vi.fn(() => ({ state: "idle" })),
  useNavigate: vi.fn(() => vi.fn()),
  redirect: vi.fn((url: string) => new Response(null, { status: 302, headers: { Location: url } })),
}));

vi.mock("react-router", () => ({
  useActionData: () => mocks.useActionData(),
  useNavigation: () => mocks.useNavigation(),
  useNavigate: () => mocks.useNavigate(),
  useSubmit: () => vi.fn(),
  redirect: mocks.redirect,
  Form: ({ children, ...p }: any) => <form {...p}>{children}</form>,
  Link: ({ children, to, ...p }: any) => <a href={to} {...p}>{children}</a>,
}));
vi.mock("~/utils/auth", () => ({
  getUser: (...a: any[]) => mocks.getUser(...a),
}));
vi.mock("~/lib/api/organizations", () => ({
  organizationsApi: {
    createOrganization: (...a: any[]) => mocks.createOrganization(...a),
  },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock("~/config/locale", () => ({
  APP_PHONE_PLACEHOLDER: "+977-XXXXXXXXXX",
}));
vi.mock("lucide-react", () => ({
  ArrowLeft: IconStub,
  Building2: IconStub,
  Users: IconStub,
  Shield: IconStub,
  CheckCircle: IconStub,
  Loader2: IconStub,
}));
vi.mock("~/components/ui", () => ({
  UnifiedButton: ({ children, ...p }: any) => <button {...p}>{children}</button>,
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("~/lib/utils", () => ({
  cn: (...a: any[]) => a.filter(Boolean).join(" "),
}));

import {
  clientLoader,
  clientAction,
  getCreateOrganizationError,
  default as OrganizationsNew,
} from "./organizations.new";

beforeEach(() => vi.clearAllMocks());

/* ================================================================== */
/*  clientLoader                                                       */
/* ================================================================== */
describe("clientLoader", () => {
  it("redirects unauthenticated users", async () => {
    mocks.getUser.mockResolvedValue(null);
    const r = await clientLoader({
      request: new Request("http://localhost/organizations/new"),
    } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/auth/login");
  });

  it("returns null for authenticated users", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    const r = await clientLoader({
      request: new Request("http://localhost/organizations/new"),
    } as any);
    expect(r).toBeNull();
  });
});

/* ================================================================== */
/*  clientAction                                                       */
/* ================================================================== */
describe("clientAction", () => {
  const buildFormData = (fields: Record<string, string>) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    return fd;
  };

  const actionRequest = (body: FormData) =>
    new Request("http://localhost/organizations/new", {
      method: "POST",
      body,
    });

  it("redirects unauthenticated users", async () => {
    mocks.getUser.mockResolvedValue(null);
    const fd = buildFormData({ intent: "create-organization", name: "Test", businessType: "LLC", email: "t@t.com" });
    const r = await clientAction({ request: actionRequest(fd) } as any);
    expect(r).toBeInstanceOf(Response);
  });

  it("returns error for invalid intent", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    const fd = buildFormData({ intent: "update", name: "Test" });
    const r = (await clientAction({ request: actionRequest(fd) } as any)) as any;
    expect(r.error).toBe("Invalid request.");
  });

  it("returns error for missing business type", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    const fd = buildFormData({ intent: "create-organization", name: "Test Org", email: "t@t.com" });
    const r = (await clientAction({ request: actionRequest(fd) } as any)) as any;
    expect(r.error).toContain("business type");
  });

  it("returns error for short organization name", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    const fd = buildFormData({
      intent: "create-organization",
      name: "A",
      businessType: "LLC",
      email: "t@test.com",
    });
    const r = (await clientAction({ request: actionRequest(fd) } as any)) as any;
    expect(r.error).toContain("at least 2");
  });

  it("returns error for invalid email", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    const fd = buildFormData({
      intent: "create-organization",
      name: "Good Org",
      businessType: "LLC",
      email: "not-an-email",
    });
    const r = (await clientAction({ request: actionRequest(fd) } as any)) as any;
    expect(r.error).toContain("email");
  });

  it("creates organization successfully", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    mocks.createOrganization.mockResolvedValue({ id: "org1", slug: "good-org" });
    const fd = buildFormData({
      intent: "create-organization",
      name: "Good Org",
      businessType: "LLC",
      email: "org@test.com",
    });
    const r = await clientAction({ request: actionRequest(fd) } as any);
    // Should redirect to the new org page
    expect(r).toBeInstanceOf(Response);
  });

  it("preserves backend validation messages", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    mocks.createOrganization.mockRejectedValue({
      response: { data: { message: "Organization slug already exists" } },
    });
    const fd = buildFormData({
      intent: "create-organization",
      name: "Good Org",
      businessType: "LLC",
      email: "org@test.com",
    });
    const r = (await clientAction({ request: actionRequest(fd) } as any)) as any;
    expect(r.error).toBe("Organization slug already exists");
  });

  it("uses actionable offline copy on request failure", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    mocks.createOrganization.mockRejectedValue(new Error("Network Error"));
    const online = window.navigator.onLine;
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });

    const fd = buildFormData({
      intent: "create-organization",
      name: "Good Org",
      businessType: "LLC",
      email: "org@test.com",
    });
    const r = (await clientAction({ request: actionRequest(fd) } as any)) as any;
    expect(r.error).toBe(
      "You appear to be offline. Reconnect and try creating the organization again."
    );

    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: online,
    });
  });

  it("uses timeout-specific copy on request failure", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    mocks.createOrganization.mockRejectedValue(new AxiosError("timeout", "ECONNABORTED"));

    const fd = buildFormData({
      intent: "create-organization",
      name: "Good Org",
      businessType: "LLC",
      email: "org@test.com",
    });
    const r = (await clientAction({ request: actionRequest(fd) } as any)) as any;
    expect(r.error).toBe("Creating the organization is taking too long. Try again.");
  });

  it("uses conflict-specific copy without a backend message", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    mocks.createOrganization.mockRejectedValue(
      new AxiosError("Conflict", undefined, undefined, undefined, {
        status: 409,
        statusText: "Conflict",
        headers: {},
        config: { headers: {} } as any,
        data: {},
      } as any)
    );

    const fd = buildFormData({
      intent: "create-organization",
      name: "Good Org",
      businessType: "LLC",
      email: "org@test.com",
    });
    const r = (await clientAction({ request: actionRequest(fd) } as any)) as any;
    expect(r.error).toBe(
      "An organization with these details already exists. Review the form and try again."
    );
  });
});

describe("organizations.new component", () => {
  it("uses the configured phone placeholder", () => {
    render(<OrganizationsNew />);
    fireEvent.click(screen.getByLabelText(/limited liability company/i));
    fireEvent.click(screen.getByRole("button", { name: "common.next" }));
    expect(screen.getByPlaceholderText("+977-XXXXXXXXXX")).toBeInTheDocument();
  });
});

describe("getCreateOrganizationError", () => {
  it("preserves plain thrown errors", () => {
    expect(getCreateOrganizationError(new Error("Permission denied"), "fallback")).toBe(
      "Permission denied"
    );
  });
});
