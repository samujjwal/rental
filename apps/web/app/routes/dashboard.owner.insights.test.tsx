import { describe, it, expect, vi, beforeEach } from "vitest";

/* ─── Mocks ───────────────────────────────────────────────────────── */
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getInsights: vi.fn(),
  redirect: vi.fn((url: string) => new Response(null, { status: 302, headers: { Location: url } })),
  useLoaderData: vi.fn(),
}));

vi.mock("react-router", () => ({
  useLoaderData: () => mocks.useLoaderData(),
  redirect: mocks.redirect,
  Link: ({ children, to, ...p }: any) => <a href={to} {...p}>{children}</a>,
}));
vi.mock("~/utils/auth", () => ({
  getUser: (...a: any[]) => mocks.getUser(...a),
}));
vi.mock("~/lib/api/analytics", () => ({
  analyticsApi: {
    getInsights: (...a: any[]) => mocks.getInsights(...a),
  },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
const IconStub = vi.hoisted(() => (props: any) => <span data-testid="icon-stub" />);
vi.mock("lucide-react", () => ({
  Lightbulb: IconStub,
  TrendingUp: IconStub,
  TrendingDown: IconStub,
  Calendar: IconStub,
  Users: IconStub,
  Target: IconStub,
  Zap: IconStub,
  AlertTriangle: IconStub,
  CheckCircle: IconStub,
  ArrowRight: IconStub,
  BarChart2: IconStub,
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
vi.mock("~/config/navigation", () => ({
  ownerNavSections: [],
}));

import { clientLoader } from "./dashboard.owner.insights";

beforeEach(() => vi.clearAllMocks());

/* ================================================================== */
/*  clientLoader – auth + role gating                                  */
/* ================================================================== */
describe("dashboard.owner.insights clientLoader", () => {
  it("redirects unauthenticated users", async () => {
    mocks.getUser.mockResolvedValue(null);
    const r = await clientLoader({
      request: new Request("http://localhost/dashboard/owner/insights"),
    } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/auth/login");
  });

  it("redirects renters to /dashboard", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "renter" });
    const r = await clientLoader({
      request: new Request("http://localhost/dashboard/owner/insights"),
    } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/dashboard");
  });

  it("returns insights data for owner", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    mocks.getInsights.mockResolvedValue({
      score: 85,
      insights: [{ id: "i1", text: "Improve photos" }],
      seasonalTrends: [],
      competitorAnalysis: {
        averagePrice: 3000,
        yourPrice: 2800,
        pricePosition: "below",
        recommendation: "Good pricing",
      },
      customerSegments: [],
      optimizations: [],
    });
    const r = (await clientLoader({
      request: new Request("http://localhost/dashboard/owner/insights"),
    } as any)) as any;
    expect(r.data.score).toBe(85);
    expect(r.error).toBeNull();
  });

  it("handles API error gracefully", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    mocks.getInsights.mockRejectedValue(new Error("Analytics unavailable"));
    const r = (await clientLoader({
      request: new Request("http://localhost/dashboard/owner/insights"),
    } as any)) as any;
    expect(r.error).toBeTruthy();
  });

  it("handles null/missing insight data safely", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "admin" });
    mocks.getInsights.mockResolvedValue(null);
    const r = (await clientLoader({
      request: new Request("http://localhost/dashboard/owner/insights"),
    } as any)) as any;
    expect(r.data.score).toBe(0);
    expect(r.data.insights).toEqual([]);
  });
});
