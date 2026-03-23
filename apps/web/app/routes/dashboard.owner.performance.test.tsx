import { AxiosError } from "axios";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

/* ─── Mocks ───────────────────────────────────────────────────────── */
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getPerformanceMetrics: vi.fn(),
  redirect: vi.fn((url: string) => new Response(null, { status: 302, headers: { Location: url } })),
  useLoaderData: vi.fn(),
  revalidate: vi.fn(),
  setSearchParams: vi.fn(),
}));

vi.mock("react-router", () => ({
  useLoaderData: () => mocks.useLoaderData(),
  useSearchParams: () => [new URLSearchParams(), mocks.setSearchParams],
  useRevalidator: () => ({ revalidate: mocks.revalidate }),
  useLocation: () => ({ pathname: "/dashboard/owner/performance" }),
  redirect: mocks.redirect,
  Link: ({ children, to, ...p }: any) => <a href={to} {...p}>{children}</a>,
}));
vi.mock("~/utils/auth", () => ({
  getUser: (...a: any[]) => mocks.getUser(...a),
}));
vi.mock("~/lib/api/analytics", () => ({
  analyticsApi: {
    getPerformanceMetrics: (...a: any[]) => mocks.getPerformanceMetrics(...a),
  },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
const IconStub = vi.hoisted(() => (props: any) => <span data-testid="icon-stub" />);
vi.mock("lucide-react", () => ({
  TrendingUp: IconStub,
  TrendingDown: IconStub,
  BarChart3: IconStub,
  Calendar: IconStub,
  Banknote: IconStub,
  Star: IconStub,
  Eye: IconStub,
  Clock: IconStub,
  ArrowUpRight: IconStub,
  ArrowDownRight: IconStub,
  Info: IconStub,
}));
vi.mock("~/components/ui", () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
  CardDescription: ({ children }: any) => <div>{children}</div>,
  UnifiedButton: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("~/components/layout", () => ({
  PortalPageLayout: ({ banner, children, actions }: any) => <div>{banner}{actions}{children}</div>,
}));
vi.mock("~/lib/utils", () => ({
  cn: (...a: any[]) => a.filter(Boolean).join(" "),
  formatCurrency: (v: number) => `NPR ${v}`,
}));
vi.mock("~/config/locale", () => ({
  APP_LOCALE: "en-NP",
}));
vi.mock("~/config/navigation", () => ({
  ownerNavSections: [],
}));

import OwnerPerformancePage, { clientLoader, getOwnerPerformanceLoadError } from "./dashboard.owner.performance";

beforeEach(() => vi.clearAllMocks());

beforeEach(() => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  mocks.useLoaderData.mockReturnValue({ metrics: null, error: null, period: "30days" });
});

/* ================================================================== */
/*  clientLoader – auth + role gating + period validation               */
/* ================================================================== */
describe("dashboard.owner.performance clientLoader", () => {
  it("redirects unauthenticated users", async () => {
    mocks.getUser.mockResolvedValue(null);
    const r = await clientLoader({
      request: new Request("http://localhost/dashboard/owner/performance"),
    } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/auth/login");
  });

  it("redirects renter to /dashboard", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "renter" });
    const r = await clientLoader({
      request: new Request("http://localhost/dashboard/owner/performance"),
    } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/dashboard");
  });

  it("returns performance metrics for owner", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    mocks.getPerformanceMetrics.mockResolvedValue({
      overview: {
        totalViews: 1200,
        viewsChange: 5,
        totalBookings: 10,
        bookingsChange: 2,
        conversionRate: 0.8,
        conversionChange: 0.1,
        averageRating: 4.5,
        ratingChange: 0.2,
      },
      earnings: { total: 50000, thisMonth: 5000, lastMonth: 4500 },
    });
    const r = (await clientLoader({
      request: new Request("http://localhost/dashboard/owner/performance"),
    } as any)) as any;
    expect(r.metrics.overview.totalViews).toBe(1200);
    expect(r.error).toBeNull();
  });

  it("handles API error gracefully", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    mocks.getPerformanceMetrics.mockRejectedValue(new Error("Service down"));
    const r = (await clientLoader({
      request: new Request("http://localhost/dashboard/owner/performance"),
    } as any)) as any;
    expect(r.error).toBeTruthy();
  });

  it("uses actionable offline copy on loader failure", async () => {
    const previousOnline = navigator.onLine;
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    mocks.getPerformanceMetrics.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));

    const r = (await clientLoader({
      request: new Request("http://localhost/dashboard/owner/performance"),
    } as any)) as any;

    expect(r.error).toBe("You appear to be offline. Reconnect and try again.");

    Object.defineProperty(navigator, "onLine", { configurable: true, value: previousOnline });
  });

  it("uses timeout-specific copy on loader failure", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    mocks.getPerformanceMetrics.mockRejectedValue(new AxiosError("timeout", "ECONNABORTED"));

    const r = (await clientLoader({
      request: new Request("http://localhost/dashboard/owner/performance"),
    } as any)) as any;

    expect(r.error).toBe("Loading performance data timed out. Try again.");
  });

  it("defaults to 30days period for invalid period param", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    mocks.getPerformanceMetrics.mockResolvedValue({
      overview: {},
      earnings: {},
    });
    await clientLoader({
      request: new Request("http://localhost/dashboard/owner/performance?period=invalid"),
    } as any);
    expect(mocks.getPerformanceMetrics).toHaveBeenCalledWith("30days");
  });

  it("passes valid period parameter", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    mocks.getPerformanceMetrics.mockResolvedValue({
      overview: {},
      earnings: {},
    });
    await clientLoader({
      request: new Request("http://localhost/dashboard/owner/performance?period=90days"),
    } as any);
    expect(mocks.getPerformanceMetrics).toHaveBeenCalledWith("90days");
  });

  it("preserves plain thrown error messages in helper", () => {
    expect(getOwnerPerformanceLoadError(new Error("performance unavailable"))).toBe(
      "performance unavailable"
    );
  });
});

describe("OwnerPerformancePage recovery UI", () => {
  it("revalidates from the error banner", () => {
    mocks.useLoaderData.mockReturnValue({ metrics: null, error: "Loading performance data timed out. Try again.", period: "30days" });

    render(<OwnerPerformancePage />);

    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(mocks.revalidate).toHaveBeenCalledTimes(1);
  });
});
