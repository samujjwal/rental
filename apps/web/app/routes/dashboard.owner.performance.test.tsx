import { describe, it, expect, vi, beforeEach } from "vitest";

/* ─── Mocks ───────────────────────────────────────────────────────── */
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getPerformanceMetrics: vi.fn(),
  redirect: vi.fn((url: string) => new Response(null, { status: 302, headers: { Location: url } })),
}));

vi.mock("react-router", () => ({
  useLoaderData: vi.fn(),
  useSearchParams: vi.fn(() => [new URLSearchParams(), vi.fn()]),
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
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("~/components/layout", () => ({
  PortalPageLayout: ({ children }: any) => <div>{children}</div>,
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

import { clientLoader } from "./dashboard.owner.performance";

beforeEach(() => vi.clearAllMocks());

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
});
