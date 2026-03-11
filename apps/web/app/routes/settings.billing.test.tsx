import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

/* ------------------------------------------------------------------ */
/*  lucide-react stubs                                                 */
/* ------------------------------------------------------------------ */
const IconStub = vi.hoisted(() => () => <span data-testid="icon-stub" />);
vi.mock("lucide-react", () => ({
  Shield: IconStub,
  User: IconStub,
  Bell: IconStub,
  CreditCard: IconStub,
  Banknote: IconStub,
  Receipt: IconStub,
  ArrowUpRight: IconStub,
  CheckCircle: IconStub,
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
  getBalance: vi.fn(),
  getTransactions: vi.fn(),
};

vi.mock("react-router", () => ({
  redirect: (...a: unknown[]) =>
    (mocks.redirect as (...args: unknown[]) => unknown)(...a),
  Link: ({
    children,
    to,
    ...p
  }: {
    children: unknown;
    to: string;
    [k: string]: unknown;
  }) => <a href={to} {...(p as Record<string, unknown>)}>{children}</a>,
  useLoaderData: () => (mocks.useLoaderData as () => unknown)(),
}));

vi.mock("~/utils/auth", () => ({
  getUser: (...a: unknown[]) =>
    (mocks.getUser as (...args: unknown[]) => unknown)(...a),
}));

vi.mock("~/lib/api/payments", () => ({
  paymentsApi: {
    getBalance: (...a: unknown[]) =>
      (mocks.getBalance as (...args: unknown[]) => unknown)(...a),
    getTransactions: (...a: unknown[]) =>
      (mocks.getTransactions as (...args: unknown[]) => unknown)(...a),
  },
}));

vi.mock("~/components/ui", () => ({
  RouteErrorBoundary: ({ children }: { children: unknown }) => (
    <div>{children}</div>
  ),
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
import { clientLoader } from "./settings.billing";
import SettingsBillingPage from "./settings.billing";

const authUser = { id: "u1", email: "billing@test.com", role: "owner" };
const mockBalance = { balance: 15000, pendingBalance: 2500 };
const mockTxs = {
  transactions: [
    {
      id: "tx1",
      type: "CREDIT",
      amount: 5000,
      description: "Booking payout",
      createdAt: "2026-03-01T00:00:00Z",
      status: "POSTED",
    },
  ],
  total: 1,
};

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */
describe("settings.billing — clientLoader", () => {
  beforeEach(() => vi.clearAllMocks());

  it("redirects to /auth/login when unauthenticated", async () => {
    (mocks.getUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    (mocks.getBalance as ReturnType<typeof vi.fn>).mockResolvedValue(mockBalance);
    (mocks.getTransactions as ReturnType<typeof vi.fn>).mockResolvedValue(mockTxs);
    const req = { headers: new Headers() } as unknown as Request;
    const result = await clientLoader({
      request: req,
      params: {},
      context: {},
    } as Parameters<typeof clientLoader>[0]);
    expect(mocks.redirect).toHaveBeenCalledWith("/auth/login");
    expect((result as Response).status).toBe(302);
  });

  it("returns user, balance, and transactions when authenticated", async () => {
    (mocks.getUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce(authUser);
    (mocks.getBalance as ReturnType<typeof vi.fn>).mockResolvedValue(mockBalance);
    (mocks.getTransactions as ReturnType<typeof vi.fn>).mockResolvedValue(mockTxs);
    const req = { headers: new Headers() } as unknown as Request;
    const result = (await clientLoader({
      request: req,
      params: {},
      context: {},
    } as Parameters<typeof clientLoader>[0])) as Record<string, unknown>;
    expect(result.user).toEqual(authUser);
    expect(result.balance).toEqual(mockBalance);
    expect(Array.isArray(result.transactions)).toBe(true);
  });

  it("degrades gracefully when balance fetch fails", async () => {
    (mocks.getUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce(authUser);
    (mocks.getBalance as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network error"),
    );
    (mocks.getTransactions as ReturnType<typeof vi.fn>).mockResolvedValue(mockTxs);
    const req = { headers: new Headers() } as unknown as Request;
    const result = (await clientLoader({
      request: req,
      params: {},
      context: {},
    } as Parameters<typeof clientLoader>[0])) as Record<string, unknown>;
    expect(result.balance).toBeNull();
  });
});

describe("SettingsBillingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mocks.useLoaderData as ReturnType<typeof vi.fn>).mockReturnValue({
      user: authUser,
      balance: mockBalance,
      transactions: mockTxs.transactions,
    });
  });

  it("renders Billing & Payments heading", () => {
    render(<SettingsBillingPage />);
    expect(screen.getByText("Billing & Payments")).toBeInTheDocument();
  });

  it("renders Available Balance with formatted amount", () => {
    render(<SettingsBillingPage />);
    expect(screen.getByText("Available Balance")).toBeInTheDocument();
    // $150.00 from 15000 cents
    expect(screen.getByText("$150.00")).toBeInTheDocument();
  });

  it("renders Recent Transactions section", () => {
    render(<SettingsBillingPage />);
    expect(screen.getByText("Recent Transactions")).toBeInTheDocument();
    expect(screen.getByText("Booking payout")).toBeInTheDocument();
  });

  it("renders empty state when no transactions", () => {
    (mocks.useLoaderData as ReturnType<typeof vi.fn>).mockReturnValue({
      user: authUser,
      balance: mockBalance,
      transactions: [],
    });
    render(<SettingsBillingPage />);
    expect(screen.getByText("No transactions yet.")).toBeInTheDocument();
  });

  it("renders sidebar navigation links", () => {
    render(<SettingsBillingPage />);
    const hrefs = screen
      .getAllByRole("link")
      .map((l) => l.getAttribute("href"));
    expect(hrefs).toContain("/settings/profile");
    expect(hrefs).toContain("/settings/notifications");
    expect(hrefs).toContain("/settings/security");
  });

  it("highlights Billing as the active nav item", () => {
    render(<SettingsBillingPage />);
    const billingLink = screen
      .getAllByRole("link")
      .find((el) => el.getAttribute("href") === "/settings/billing");
    expect(billingLink?.className).toContain("text-primary");
  });

  it("renders View all link to /payments", () => {
    render(<SettingsBillingPage />);
    const links = screen
      .getAllByRole("link")
      .filter((l) => l.getAttribute("href") === "/payments");
    expect(links.length).toBeGreaterThan(0);
  });

  it("renders Payout Settings section linking to /dashboard/owner/earnings", () => {
    render(<SettingsBillingPage />);
    const earningsLink = screen.getByRole("link", { name: /Manage payouts/i });
    expect(earningsLink).toHaveAttribute("href", "/dashboard/owner/earnings");
  });
});
