import { AxiosError } from "axios";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

/* ------------------------------------------------------------------ */
const IconStub = vi.hoisted(() => (props: any) => <span data-testid="icon-stub" />);
vi.mock("lucide-react", () => ({
  Banknote: IconStub, TrendingUp: IconStub, Calendar: IconStub, Download: IconStub,
  Filter: IconStub, ArrowUpRight: IconStub, ArrowDownRight: IconStub, Wallet: IconStub,
  CreditCard: IconStub, Clock: IconStub, AlertCircle: IconStub,
  ChevronLeft: IconStub, ChevronRight: IconStub,
}));

/* ------------------------------------------------------------------ */
const mocks: Record<string, any> = {
  getUser: vi.fn(),
  getBalance: vi.fn(),
  getEarnings: vi.fn(),
  getEarningsSummary: vi.fn(),
  getTransactions: vi.fn(),
  useLoaderData: vi.fn(() => ({})),
  setSearchParams: vi.fn(),
  revalidate: vi.fn(),
  redirect: vi.fn((url: string) => new Response(null, { status: 302, headers: { Location: url } })),
};

vi.mock("react-router", () => ({
  Link: ({ children, to, ...p }: any) => <a href={to} {...p}>{children}</a>,
  redirect: (...a: any[]) => mocks.redirect(...a),
  useLoaderData: () => mocks.useLoaderData(),
  useSearchParams: () => [new URLSearchParams("type=PAYOUT"), mocks.setSearchParams],
  useRevalidator: () => ({ revalidate: mocks.revalidate }),
}));
vi.mock("~/utils/auth", () => ({ getUser: (...a: any[]) => mocks.getUser(...a) }));
vi.mock("~/lib/api/payments", () => ({
  paymentsApi: {
    getBalance: (...a: any[]) => mocks.getBalance(...a),
    getEarnings: (...a: any[]) => mocks.getEarnings(...a),
    getEarningsSummary: (...a: any[]) => mocks.getEarningsSummary(...a),
    getTransactions: (...a: any[]) => mocks.getTransactions(...a),
  },
}));
vi.mock("date-fns", () => ({ formatDistanceToNow: () => "2 days ago" }));
vi.mock("~/lib/utils", () => ({
  cn: (...a: string[]) => a.filter(Boolean).join(" "),
  formatCurrency: (value: number) => `NPR ${value}`,
}));
vi.mock("~/components/ui", () => ({
  UnifiedButton: ({ children, asChild, ...p }: any) => {
    if (asChild) {
      return children;
    }
    return <button {...p}>{children}</button>;
  },
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("~/components/ui/skeleton", () => ({
  StatCardSkeleton: () => <div />,
  TableSkeleton: () => <div />,
}));
vi.mock("~/utils/export", () => ({ exportToCsv: vi.fn() }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

import PaymentsPage, { clientLoader } from "./payments";

const ownerUser = { id: "u1", role: "owner" };

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: true,
  });
});

/* ================================================================== */
/*  clientLoader                                                       */
/* ================================================================== */
describe("clientLoader", () => {
  it("redirects unauthenticated", async () => {
    mocks.getUser.mockResolvedValue(null);
    const r = await clientLoader({ request: new Request("http://localhost/payments") } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/auth/login");
  });

  it("redirects non-owner/non-admin to /dashboard", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "renter" });
    const r = await clientLoader({ request: new Request("http://localhost/payments") } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/dashboard");
  });

  it("loads payment data for owner", async () => {
    mocks.getUser.mockResolvedValue(ownerUser);
    mocks.getBalance.mockResolvedValue({ balance: 5000, currency: "NPR" });
    mocks.getEarnings.mockResolvedValue({ amount: 1000, currency: "NPR" });
    mocks.getEarningsSummary.mockResolvedValue({ thisMonth: 3000, lastMonth: 2000, total: 10000, currency: "NPR" });
    mocks.getTransactions.mockResolvedValue({
      transactions: [{ id: "t1", amount: 100 }],
      total: 1,
      page: 1,
      limit: 20,
    });

    const r = (await clientLoader({ request: new Request("http://localhost/payments") } as any)) as any;
    expect(r.balance.available).toBe(5000);
    expect(r.balance.pending).toBe(1000);
    expect(r.earnings.thisMonth).toBe(3000);
    expect(r.transactions).toHaveLength(1);
    expect(r.error).toBeNull();
  });

  it("passes type and status filters", async () => {
    mocks.getUser.mockResolvedValue(ownerUser);
    mocks.getBalance.mockResolvedValue({ balance: 0, currency: "USD" });
    mocks.getEarnings.mockResolvedValue({ amount: 0, currency: "USD" });
    mocks.getEarningsSummary.mockResolvedValue({ thisMonth: 0, lastMonth: 0, total: 0 });
    mocks.getTransactions.mockResolvedValue({ transactions: [], total: 0 });

    await clientLoader({ request: new Request("http://localhost/payments?type=PAYOUT&status=SETTLED") } as any);
    expect(mocks.getTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ type: "PAYOUT", status: "SETTLED" })
    );
  });

  it("ignores invalid type/status filters", async () => {
    mocks.getUser.mockResolvedValue(ownerUser);
    mocks.getBalance.mockResolvedValue({ balance: 0, currency: "USD" });
    mocks.getEarnings.mockResolvedValue({ amount: 0, currency: "USD" });
    mocks.getEarningsSummary.mockResolvedValue({ thisMonth: 0, lastMonth: 0, total: 0 });
    mocks.getTransactions.mockResolvedValue({ transactions: [], total: 0 });

    await clientLoader({ request: new Request("http://localhost/payments?type=HACK&status=HACKED") } as any);
    expect(mocks.getTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ type: undefined, status: undefined })
    );
  });

  it("handles partial API failures gracefully", async () => {
    mocks.getUser.mockResolvedValue(ownerUser);
    mocks.getBalance.mockRejectedValue(new AxiosError("timeout", "ECONNABORTED"));
    mocks.getEarnings.mockResolvedValue({ amount: 0, currency: "USD" });
    mocks.getEarningsSummary.mockResolvedValue({ thisMonth: 0, lastMonth: 0, total: 0 });
    mocks.getTransactions.mockResolvedValue({ transactions: [], total: 0 });

    const r = (await clientLoader({ request: new Request("http://localhost/payments") } as any)) as any;
    expect(r.error).toBe(
      "Loading your payment data timed out. Try again. Some sections could not be loaded: balance."
    );
    expect(r.balance.available).toBe(0);
  });

  it("returns empty state on total failure", async () => {
    mocks.getUser.mockResolvedValue(ownerUser);
    mocks.getBalance.mockRejectedValue(new AxiosError("timeout", "ECONNABORTED"));
    mocks.getEarnings.mockRejectedValue(new AxiosError("timeout", "ECONNABORTED"));
    mocks.getEarningsSummary.mockRejectedValue(new AxiosError("timeout", "ECONNABORTED"));
    mocks.getTransactions.mockRejectedValue(new AxiosError("timeout", "ECONNABORTED"));

    const r = (await clientLoader({ request: new Request("http://localhost/payments") } as any)) as any;
    expect(r.error).toBe(
      "Loading your payment data timed out. Try again. Some sections could not be loaded: balance, earnings, summary, transactions."
    );
    expect(r.transactions).toEqual([]);
  });

  it("uses offline-specific copy on partial loader failure", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });
    mocks.getUser.mockResolvedValue(ownerUser);
    mocks.getBalance.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));
    mocks.getEarnings.mockResolvedValue({ amount: 0, currency: "USD" });
    mocks.getEarningsSummary.mockResolvedValue({ thisMonth: 0, lastMonth: 0, total: 0 });
    mocks.getTransactions.mockResolvedValue({ transactions: [], total: 0 });

    const r = (await clientLoader({ request: new Request("http://localhost/payments") } as any)) as any;
    expect(r.error).toBe(
      "You appear to be offline. Reconnect and try loading your payment data again. Some sections could not be loaded: balance."
    );
  });

  it("preserves backend loader messages", async () => {
    mocks.getUser.mockResolvedValue(ownerUser);
    mocks.getBalance.mockRejectedValue({
      response: { data: { message: "Payment ledger is temporarily unavailable" } },
    });
    mocks.getEarnings.mockResolvedValue({ amount: 0, currency: "USD" });
    mocks.getEarningsSummary.mockResolvedValue({ thisMonth: 0, lastMonth: 0, total: 0 });
    mocks.getTransactions.mockResolvedValue({ transactions: [], total: 0 });

    const r = (await clientLoader({ request: new Request("http://localhost/payments") } as any)) as any;
    expect(r.error).toBe("Payment ledger is temporarily unavailable");
  });
});

describe("PaymentsPage recovery UI", () => {
  it("revalidates and clears filters from the loader error banner", () => {
    mocks.useLoaderData.mockReturnValue({
      balance: { available: 0, pending: 0, currency: "NPR" },
      earnings: { thisMonth: 0, lastMonth: 0, total: 0, currency: "NPR" },
      transactions: [],
      totalTransactions: 0,
      page: 1,
      limit: 20,
      error: "Loading your payment data timed out. Try again. Some sections could not be loaded: balance.",
    });

    render(<PaymentsPage />);

    fireEvent.click(screen.getByRole("button", { name: "common.retry" }));
    expect(mocks.revalidate).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "payments.clearFilters" }));
    expect(mocks.setSearchParams).toHaveBeenCalledWith(expect.any(URLSearchParams));
  });
});
