import { AxiosError } from "axios";
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
const IconStub = vi.hoisted(() => (props: any) => (
  <span data-testid="icon-stub" />
));
vi.mock("lucide-react", () => ({
  Banknote: IconStub,
  Clock: IconStub,
  CheckCircle: IconStub,
  ArrowUpRight: IconStub,
  ArrowDownRight: IconStub,
  CreditCard: IconStub,
  Loader2: IconStub,
  Download: IconStub,
}));

/* ------------------------------------------------------------------ */
const mocks: Record<string, any> = {
  getUser: vi.fn(),
  getBalance: vi.fn(),
  getEarnings: vi.fn(),
  getTransactions: vi.fn(),
  getPayouts: vi.fn(),
  requestPayout: vi.fn(),
  redirect: vi.fn(
    (url: string) =>
      new Response(null, { status: 302, headers: { Location: url } })
  ),
};

vi.mock("react-router", () => ({
  Form: ({ children, ...p }: any) => <form {...p}>{children}</form>,
  Link: ({ children, to, ...p }: any) => (
    <a href={to} {...p}>
      {children}
    </a>
  ),
  redirect: (...a: any[]) => mocks.redirect(...a),
  useLoaderData: () => ({}),
  useActionData: () => null,
  useNavigation: () => ({ state: "idle" }),
  useRevalidator: () => ({ revalidate: vi.fn() }),
}));
vi.mock("~/utils/auth", () => ({
  getUser: (...a: any[]) => mocks.getUser(...a),
}));
vi.mock("~/lib/api/payments", () => ({
  paymentsApi: {
    getBalance: (...a: any[]) => mocks.getBalance(...a),
    getEarnings: (...a: any[]) => mocks.getEarnings(...a),
    getTransactions: (...a: any[]) => mocks.getTransactions(...a),
    getPayouts: (...a: any[]) => mocks.getPayouts(...a),
    requestPayout: (...a: any[]) => mocks.requestPayout(...a),
  },
}));
vi.mock("date-fns", () => ({ format: () => "2024-01-01" }));
vi.mock("~/lib/utils", () => ({
  cn: (...a: string[]) => a.filter(Boolean).join(" "),
}));
vi.mock("~/components/ui", () => ({
  UnifiedButton: ({ children, loading, ...p }: any) => (
    <button {...p}>{loading ? <span data-testid="loading-spinner" /> : null}{children}</button>
  ),
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
  Dialog: ({ open, children }: any) => (open ? <div>{children}</div> : null),
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
}));
vi.mock("~/components/ui/skeleton", () => ({
  StatCardSkeleton: () => <div />,
  Skeleton: () => <div />,
}));
vi.mock("~/utils/export", () => ({ exportToCsv: vi.fn() }));
vi.mock("~/components/layout", () => ({
  PortalPageLayout: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("~/config/navigation", () => ({ ownerNavSections: [] }));

function makeFormReq(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return { formData: () => Promise.resolve(fd) } as unknown as Request;
}

import {
  clientLoader,
  clientAction,
  getOwnerEarningsError,
  getOwnerEarningsLoadError,
} from "./dashboard.owner.earnings";

const ownerUser = { id: "u1", role: "owner" };

beforeEach(() => vi.clearAllMocks());

beforeEach(() => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
});

/* ================================================================== */
/*  clientLoader                                                       */
/* ================================================================== */
describe("clientLoader", () => {
  it("redirects unauthenticated", async () => {
    mocks.getUser.mockResolvedValue(null);
    const r = await clientLoader({
      request: new Request("http://localhost/dashboard/owner/earnings"),
    } as any);
    expect((r as Response).headers.get("Location")).toBe("/auth/login");
  });

  it("redirects non-owner to /dashboard", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "renter" });
    const r = await clientLoader({
      request: new Request("http://localhost/dashboard/owner/earnings"),
    } as any);
    expect((r as Response).headers.get("Location")).toBe("/dashboard");
  });

  it("loads earnings data for owner", async () => {
    mocks.getUser.mockResolvedValue(ownerUser);
    mocks.getBalance.mockResolvedValue({ balance: 5000, currency: "NPR" });
    mocks.getEarnings.mockResolvedValue({ amount: 2000, currency: "NPR" });
    mocks.getTransactions.mockResolvedValue({ transactions: [{ id: "t1" }] });
    mocks.getPayouts.mockResolvedValue({ payouts: [{ id: "p1" }] });

    const r = (await clientLoader({
      request: new Request("http://localhost/dashboard/owner/earnings"),
    } as any)) as any;
    expect(r.transactions).toHaveLength(1);
    expect(r.payouts).toHaveLength(1);
  });

  it("handles partial failures gracefully", async () => {
    mocks.getUser.mockResolvedValue(ownerUser);
    mocks.getBalance.mockRejectedValue(new AxiosError("timeout", "ECONNABORTED"));
    mocks.getEarnings.mockResolvedValue({ amount: 0, currency: "USD" });
    mocks.getTransactions.mockResolvedValue({ transactions: [] });
    mocks.getPayouts.mockResolvedValue({ payouts: [] });

    const r = (await clientLoader({
      request: new Request("http://localhost/dashboard/owner/earnings"),
    } as any)) as any;
    expect(r.error).toBe(
      "Earnings request timed out. Try again. Some sections could not be loaded: balance."
    );
  });

  it("uses actionable offline copy on partial loader failure", async () => {
    const previousOnline = navigator.onLine;
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    mocks.getUser.mockResolvedValue(ownerUser);
    mocks.getBalance.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));
    mocks.getEarnings.mockResolvedValue({ amount: 0, currency: "USD" });
    mocks.getTransactions.mockResolvedValue({ transactions: [] });
    mocks.getPayouts.mockResolvedValue({ payouts: [] });

    const r = (await clientLoader({
      request: new Request("http://localhost/dashboard/owner/earnings"),
    } as any)) as any;

    expect(r.error).toBe(
      "You appear to be offline. Reconnect and try again. Some sections could not be loaded: balance."
    );

    Object.defineProperty(navigator, "onLine", { configurable: true, value: previousOnline });
  });

  it("preserves backend messages on partial loader failure", async () => {
    mocks.getUser.mockResolvedValue(ownerUser);
    mocks.getBalance.mockRejectedValue({
      response: { data: { message: "Payout ledger is recalculating" } },
    });
    mocks.getEarnings.mockResolvedValue({ amount: 0, currency: "USD" });
    mocks.getTransactions.mockResolvedValue({ transactions: [] });
    mocks.getPayouts.mockResolvedValue({ payouts: [] });

    const r = (await clientLoader({
      request: new Request("http://localhost/dashboard/owner/earnings"),
    } as any)) as any;

    expect(r.error).toBe("Payout ledger is recalculating");
  });

  it("uses actionable offline copy on full loader failure", async () => {
    const previousOnline = navigator.onLine;
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    mocks.getUser.mockResolvedValue(ownerUser);
    mocks.getBalance.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));
    mocks.getEarnings.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));
    mocks.getTransactions.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));
    mocks.getPayouts.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));

    const r = (await clientLoader({
      request: new Request("http://localhost/dashboard/owner/earnings"),
    } as any)) as any;

    expect(r.error).toBe(
      "You appear to be offline. Reconnect and try again. Some sections could not be loaded: balance, earnings, transactions, payouts."
    );

    Object.defineProperty(navigator, "onLine", { configurable: true, value: previousOnline });
  });

  it("uses timeout-specific copy on full loader failure", async () => {
    mocks.getUser.mockResolvedValue(ownerUser);
    mocks.getBalance.mockRejectedValue(new AxiosError("timeout", "ECONNABORTED"));
    mocks.getEarnings.mockRejectedValue(new AxiosError("timeout", "ECONNABORTED"));
    mocks.getTransactions.mockRejectedValue(new AxiosError("timeout", "ECONNABORTED"));
    mocks.getPayouts.mockRejectedValue(new AxiosError("timeout", "ECONNABORTED"));

    const r = (await clientLoader({
      request: new Request("http://localhost/dashboard/owner/earnings"),
    } as any)) as any;

    expect(r.error).toBe(
      "Earnings request timed out. Try again. Some sections could not be loaded: balance, earnings, transactions, payouts."
    );
  });
});

/* ================================================================== */
/*  clientAction                                                       */
/* ================================================================== */
describe("clientAction", () => {
  it("redirects unauthenticated", async () => {
    mocks.getUser.mockResolvedValue(null);
    const r = await clientAction({
      request: makeFormReq({ intent: "requestPayout", amount: "100" }),
    } as any);
    expect((r as Response).headers.get("Location")).toBe("/auth/login");
  });

  it("redirects non-owner", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "renter" });
    const r = await clientAction({
      request: makeFormReq({ intent: "requestPayout", amount: "100" }),
    } as any);
    expect((r as Response).headers.get("Location")).toBe("/dashboard");
  });

  it("rejects unknown intent", async () => {
    mocks.getUser.mockResolvedValue(ownerUser);
    const r = await clientAction({
      request: makeFormReq({ intent: "hack" }),
    } as any);
    expect((r as any).success).toBe(false);
  });

  it("rejects invalid amount format", async () => {
    mocks.getUser.mockResolvedValue(ownerUser);
    const r = await clientAction({
      request: makeFormReq({ intent: "requestPayout", amount: "abc" }),
    } as any);
    expect((r as any).success).toBe(false);
    expect((r as any).error).toMatch(/valid number|invalid payout/i);
  });

  it("rejects zero amount", async () => {
    mocks.getUser.mockResolvedValue(ownerUser);
    const r = await clientAction({
      request: makeFormReq({ intent: "requestPayout", amount: "0" }),
    } as any);
    expect((r as any).success).toBe(false);
  });

  it("rejects amount exceeding max", async () => {
    mocks.getUser.mockResolvedValue(ownerUser);
    const r = await clientAction({
      request: makeFormReq({ intent: "requestPayout", amount: "2000000" }),
    } as any);
    expect((r as any).success).toBe(false);
  });

  it("rejects amount exceeding available balance", async () => {
    mocks.getUser.mockResolvedValue(ownerUser);
    mocks.getEarnings.mockResolvedValue({ amount: 50 });
    const r = await clientAction({
      request: makeFormReq({ intent: "requestPayout", amount: "100" }),
    } as any);
    expect((r as any).success).toBe(false);
    expect((r as any).error).toMatch(/insufficient|exceed/i);
  });

  it("requests payout successfully", async () => {
    mocks.getUser.mockResolvedValue(ownerUser);
    mocks.getEarnings.mockResolvedValue({ amount: 5000 });
    mocks.requestPayout.mockResolvedValue({});
    const r = await clientAction({
      request: makeFormReq({ intent: "requestPayout", amount: "100" }),
    } as any);
    expect((r as any).success).toBe(true);
    expect(mocks.requestPayout).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 100 })
    );
  });

  it("preserves backend payout error messages", async () => {
    mocks.getUser.mockResolvedValue(ownerUser);
    mocks.getEarnings.mockResolvedValue({ amount: 5000 });
    mocks.requestPayout.mockRejectedValue({
      response: { data: { message: "Bank account verification required" } },
    });
    const r = await clientAction({
      request: makeFormReq({ intent: "requestPayout", amount: "100" }),
    } as any);
    expect((r as any).success).toBe(false);
    expect((r as any).error).toBe("Bank account verification required");
  });

  it("uses actionable offline copy for payout failures", async () => {
    const previousOnline = navigator.onLine;
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    mocks.getUser.mockResolvedValue(ownerUser);
    mocks.getEarnings.mockResolvedValue({ amount: 5000 });
    mocks.requestPayout.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));

    const r = await clientAction({
      request: makeFormReq({ intent: "requestPayout", amount: "100" }),
    } as any);

    expect((r as any).success).toBe(false);
    expect((r as any).error).toBe("You appear to be offline. Reconnect and try again.");

    Object.defineProperty(navigator, "onLine", { configurable: true, value: previousOnline });
  });

  it("uses timeout-specific copy for payout failures", async () => {
    mocks.getUser.mockResolvedValue(ownerUser);
    mocks.getEarnings.mockResolvedValue({ amount: 5000 });
    mocks.requestPayout.mockRejectedValue(new AxiosError("timeout", "ECONNABORTED"));

    const r = await clientAction({
      request: makeFormReq({ intent: "requestPayout", amount: "100" }),
    } as any);

    expect((r as any).success).toBe(false);
    expect((r as any).error).toBe("Earnings request timed out. Try again.");
  });

  it("uses conflict-specific copy for payout failures without backend messages", async () => {
    mocks.getUser.mockResolvedValue(ownerUser);
    mocks.getEarnings.mockResolvedValue({ amount: 5000 });
    mocks.requestPayout.mockRejectedValue(
      new AxiosError("Conflict", undefined, undefined, undefined, {
        status: 409,
        statusText: "Conflict",
        headers: {},
        config: { headers: {} } as any,
        data: {},
      } as any)
    );

    const r = await clientAction({
      request: makeFormReq({ intent: "requestPayout", amount: "100" }),
    } as any);

    expect((r as any).success).toBe(false);
    expect((r as any).error).toBe("Your payout balance changed. Refresh and try again.");
  });

  it("preserves backend response messages in helper", () => {
    expect(
      getOwnerEarningsError({ response: { data: { message: "Payout queue paused" } } }, "fallback")
    ).toBe("Payout queue paused");
  });

  it("uses timeout-specific loader helper copy", () => {
    expect(
      getOwnerEarningsLoadError(new AxiosError("timeout", "ECONNABORTED"), ["balance"])
    ).toBe(
      "Earnings request timed out. Try again. Some sections could not be loaded: balance."
    );
  });
});
