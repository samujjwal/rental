import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

/* ------------------------------------------------------------------ */
/*  lucide-react — stubbed named exports                               */
/* ------------------------------------------------------------------ */
const IconStub = vi.hoisted(() => () => <span data-testid="icon-stub" />);
vi.mock("lucide-react", () => ({
  Shield: IconStub,
  User: IconStub,
  Bell: IconStub,
  CreditCard: IconStub,
  Lock: IconStub,
  Key: IconStub,
  Smartphone: IconStub,
  AlertCircle: IconStub,
  CheckCircle: IconStub,
  Eye: IconStub,
  EyeOff: IconStub,
}));

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */
const mocks: Record<string, unknown> = {
  getUser: vi.fn(),
  redirect: vi.fn((url: string) =>
    new Response(null, { status: 302, headers: { Location: url } }),
  ),
  useLoaderData: vi.fn(),
  useActionData: vi.fn(() => undefined),
  useNavigation: vi.fn(() => ({ state: "idle" })),
};

vi.mock("react-router", () => ({
  redirect: (...a: unknown[]) => (mocks.redirect as (...args: unknown[]) => unknown)(...a),
  Link: ({ children, to, ...p }: { children: unknown; to: string; [k: string]: unknown }) => (
    <a href={to} {...(p as Record<string, unknown>)}>{children}</a>
  ),
  Form: ({ children, ...p }: { children: unknown; [k: string]: unknown }) => (
    <form {...(p as Record<string, unknown>)}>{children}</form>
  ),
  useLoaderData: () => (mocks.useLoaderData as () => unknown)(),
  useActionData: () => (mocks.useActionData as () => unknown)(),
  useNavigation: () => (mocks.useNavigation as () => unknown)(),
}));

vi.mock("~/utils/auth", () => ({
  getUser: (...a: unknown[]) => (mocks.getUser as (...args: unknown[]) => unknown)(...a),
}));

vi.mock("~/lib/api/auth", () => ({
  authApi: { changePassword: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("~/components/ui", () => ({
  RouteErrorBoundary: ({ children }: { children: unknown }) => <div>{children}</div>,
}));

vi.mock("~/components/ui/card", () => ({
  Card: ({ children }: { children: unknown }) => <div>{children}</div>,
  CardContent: ({ children }: { children: unknown }) => <div>{children}</div>,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
    i18n: { language: "en" },
  }),
}));

/* ------------------------------------------------------------------ */
/*  Import route under test                                            */
/* ------------------------------------------------------------------ */
import { clientLoader } from "./settings.security";
import SettingsSecurityPage from "./settings.security";

const authUser = { id: "u1", email: "security@test.com", role: "renter" };

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */
describe("settings.security — clientLoader", () => {
  beforeEach(() => vi.clearAllMocks());

  it("redirects to /auth/login when unauthenticated", async () => {
    (mocks.getUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const req = { headers: new Headers() } as unknown as Request;
    const result = await clientLoader({ request: req, params: {}, context: {} } as Parameters<typeof clientLoader>[0]);
    expect(mocks.redirect).toHaveBeenCalledWith("/auth/login");
    expect((result as Response).status).toBe(302);
  });

  it("returns user data when authenticated", async () => {
    (mocks.getUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce(authUser);
    const req = { headers: new Headers() } as unknown as Request;
    const result = await clientLoader({ request: req, params: {}, context: {} } as Parameters<typeof clientLoader>[0]);
    expect(result).toEqual({ user: authUser });
  });
});

describe("SettingsSecurityPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mocks.useLoaderData as ReturnType<typeof vi.fn>).mockReturnValue({ user: authUser });
    (mocks.useActionData as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    (mocks.useNavigation as ReturnType<typeof vi.fn>).mockReturnValue({ state: "idle" });
  });

  it("renders Security Settings heading", () => {
    render(<SettingsSecurityPage />);
    expect(screen.getByText("Security Settings")).toBeInTheDocument();
  });

  it("renders Change Password section with form fields", () => {
    render(<SettingsSecurityPage />);
    expect(screen.getByText("Change Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Current Password")).toBeInTheDocument();
    expect(screen.getByLabelText("New Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm New Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Update Password/i })).toBeInTheDocument();
  });

  it("renders Two-Factor Authentication section with Enable 2FA link", () => {
    render(<SettingsSecurityPage />);
    expect(screen.getByText("Two-Factor Authentication")).toBeInTheDocument();
    const twoFaLink = screen.getByRole("link", { name: /Enable 2FA/i });
    expect(twoFaLink).toHaveAttribute("href", "/auth/mfa/setup");
  });

  it("renders Active Sessions with user email", () => {
    render(<SettingsSecurityPage />);
    expect(screen.getByText("Active Sessions")).toBeInTheDocument();
    expect(screen.getByText(authUser.email)).toBeInTheDocument();
  });

  it("renders settings sidebar navigation links", () => {
    render(<SettingsSecurityPage />);
    const links = screen.getAllByRole("link");
    const hrefs = links.map((l) => l.getAttribute("href"));
    expect(hrefs).toContain("/settings/profile");
    expect(hrefs).toContain("/settings/notifications");
    expect(hrefs).toContain("/settings/billing");
  });

  it("highlights Security as the active nav item", () => {
    render(<SettingsSecurityPage />);
    const securityLink = screen
      .getAllByRole("link")
      .find((el) => el.getAttribute("href") === "/settings/security");
    expect(securityLink?.className).toContain("text-primary");
  });

  it("shows success message when action returns success", () => {
    (mocks.useActionData as ReturnType<typeof vi.fn>).mockReturnValue({ success: true });
    render(<SettingsSecurityPage />);
    expect(screen.getByText("Password updated successfully.")).toBeInTheDocument();
  });

  it("shows error message when action returns error", () => {
    (mocks.useActionData as ReturnType<typeof vi.fn>).mockReturnValue({
      error: "Passwords do not match.",
    });
    render(<SettingsSecurityPage />);
    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
  });

  it("shows loading state while submitting", () => {
    (mocks.useNavigation as ReturnType<typeof vi.fn>).mockReturnValue({ state: "submitting" });
    render(<SettingsSecurityPage />);
    expect(screen.getByRole("button", { name: /Saving/i })).toBeInTheDocument();
  });
});
