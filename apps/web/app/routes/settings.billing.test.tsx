import { AxiosError } from "axios";
import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

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
  revalidate: vi.fn(),
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
    children: ReactNode;
    to: string;
    [k: string]: unknown;
  }) => <a href={to} {...(p as Record<string, unknown>)}>{children}</a>,
  useLoaderData: () => (mocks.useLoaderData as () => unknown)(),
  useRevalidator: () => ({ revalidate: mocks.revalidate }),
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
  UnifiedButton: ({ children, ...props }: { children: ReactNode; [k: string]: unknown }) => (
    <button {...(props as Record<string, unknown>)}>{children}</button>
  ),
  RouteErrorBoundary: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("~/components/ui/card", () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
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
import { clientLoader, getBillingPartialLoadError } from "./settings.billing";
import SettingsBillingPage from "./settings.billing";

const authUser = { id: "u1", email: "billing@test.com", role: "owner" };
const mockBalance = { balance: 15000, pendingBalance: 2500, currency: "USD" };
const mockTxs = {
  transactions: [
    {
      id: "tx1",
      type: "CREDIT",
      amount: 5000,
      currency: "USD",
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
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });

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
    expect(result.balanceError).toBeNull();
    expect(result.transactionsError).toBeNull();
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
    expect(result.balanceError).toBe("Network error");
  });

  it("captures actionable transaction warnings when recent transactions fail", async () => {
    (mocks.getUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce(authUser);
    (mocks.getBalance as ReturnType<typeof vi.fn>).mockResolvedValue(mockBalance);
    (mocks.getTransactions as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("transactions offline"),
    );
    const req = { headers: new Headers() } as unknown as Request;
    const result = (await clientLoader({
      request: req,
      params: {},
      context: {},
    } as Parameters<typeof clientLoader>[0])) as Record<string, unknown>;
    expect(result.transactionsError).toBe("transactions offline");
  });

  it("maps offline balance failures to actionable copy", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });
    (mocks.getUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce(authUser);
    (mocks.getBalance as ReturnType<typeof vi.fn>).mockRejectedValue(
      new AxiosError("Network Error", "ERR_NETWORK"),
    );
    (mocks.getTransactions as ReturnType<typeof vi.fn>).mockResolvedValue(mockTxs);

    const req = { headers: new Headers() } as unknown as Request;
    const result = (await clientLoader({
      request: req,
      params: {},
      context: {},
    } as Parameters<typeof clientLoader>[0])) as Record<string, unknown>;

    expect(result.balanceError).toBe(
      "You appear to be offline. Reconnect and try loading your balance again.",
    );
  });

  it("maps timeout transaction failures to actionable copy", async () => {
    (mocks.getUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce(authUser);
    (mocks.getBalance as ReturnType<typeof vi.fn>).mockResolvedValue(mockBalance);
    (mocks.getTransactions as ReturnType<typeof vi.fn>).mockRejectedValue(
      new AxiosError("timeout", "ECONNABORTED"),
    );

    const req = { headers: new Headers() } as unknown as Request;
    const result = (await clientLoader({
      request: req,
      params: {},
      context: {},
    } as Parameters<typeof clientLoader>[0])) as Record<string, unknown>;

    expect(result.transactionsError).toBe(
      "Loading recent transactions timed out. Try again.",
    );
  });
});

describe("getBillingPartialLoadError", () => {
  it("preserves backend response messages", () => {
    expect(
      getBillingPartialLoadError(
        { response: { data: { message: "Billing ledger is rebuilding" } } },
        "your balance",
      ),
    ).toBe("Billing ledger is rebuilding");
  });

  it("maps network failures to actionable copy", () => {
    expect(
      getBillingPartialLoadError(
        new AxiosError("Network Error", "ERR_NETWORK"),
        "recent transactions",
      ),
    ).toBe("We could not load recent transactions right now. Try again in a moment.");
  });
});

describe("SettingsBillingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
    (mocks.useLoaderData as ReturnType<typeof vi.fn>).mockReturnValue({
      user: authUser,
      balance: mockBalance,
      transactions: mockTxs.transactions,
      balanceError: null,
      transactionsError: null,
    });
  });

  it("renders Billing & Payments heading", () => {
    render(<SettingsBillingPage />);
    expect(screen.getByText("Billing & Payments")).toBeInTheDocument();
  });

  it("renders Available Balance with formatted amount", () => {
    render(<SettingsBillingPage />);
    expect(screen.getByText("Available Balance")).toBeInTheDocument();
    expect(screen.getByText("$15,000")).toBeInTheDocument();
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
      balanceError: null,
      transactionsError: null,
    });
    render(<SettingsBillingPage />);
    expect(screen.getByText("No transactions yet.")).toBeInTheDocument();
  });

  it("renders partial-load warning banner with retry affordance", () => {
    (mocks.useLoaderData as ReturnType<typeof vi.fn>).mockReturnValue({
      user: authUser,
      balance: null,
      transactions: [],
      balanceError: "Loading your balance timed out. Try again.",
      transactionsError: "We could not load recent transactions right now. Try again in a moment.",
    });
    render(<SettingsBillingPage />);
    expect(screen.getByText("Some billing information is temporarily unavailable.")).toBeInTheDocument();
    expect(screen.getByText("Loading your balance timed out. Try again.")).toBeInTheDocument();
    expect(screen.getByText("We could not load recent transactions right now. Try again in a moment.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(mocks.revalidate).toHaveBeenCalledTimes(1);
  });

  it("renders a transactions-unavailable state when transactions fail", () => {
    (mocks.useLoaderData as ReturnType<typeof vi.fn>).mockReturnValue({
      user: authUser,
      balance: mockBalance,
      transactions: [],
      balanceError: null,
      transactionsError: "transactions offline",
    });
    render(<SettingsBillingPage />);
    expect(screen.getByText("Recent transactions are temporarily unavailable.")).toBeInTheDocument();
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

  it("hides owner-only actions for renters", () => {
    (mocks.useLoaderData as ReturnType<typeof vi.fn>).mockReturnValue({
      user: { ...authUser, role: "renter" },
      balance: mockBalance,
      transactions: mockTxs.transactions,
    });
    render(<SettingsBillingPage />);
    expect(
      screen.queryByRole("link", { name: /view all/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Payout Settings")
    ).not.toBeInTheDocument();
  });

  it("renders Payout Settings section linking to /dashboard/owner/earnings", () => {
    render(<SettingsBillingPage />);
    const earningsLink = screen.getByRole("link", { name: /Manage payouts/i });
    expect(earningsLink).toHaveAttribute("href", "/dashboard/owner/earnings");
  });
});
