import { describe, it, expect, vi, beforeEach } from "vitest";

const IconStub = vi.hoisted(() => (props: any) => <span data-testid="icon" />);
const m = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getAdminAnalytics: vi.fn(),
  getAuditLogs: vi.fn(),
}));

vi.mock("react-router", () => ({
  useLoaderData: vi.fn(() => ({ analytics: null, activities: [], error: null })),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

vi.mock("~/utils/auth", () => ({
  requireAdmin: (...a: any[]) => m.requireAdmin(...a),
}));

vi.mock("~/utils/adminAnalytics", () => ({
  getAdminAnalytics: (...a: any[]) => m.getAdminAnalytics(...a),
}));

vi.mock("~/lib/api/admin", () => ({
  adminApi: {
    getAuditLogs: (...a: any[]) => m.getAuditLogs(...a),
  },
}));

vi.mock("~/components/ui", () => ({
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("~/components/admin/ActivityFeed", () => ({
  ActivityFeed: () => <div data-testid="activity-feed" />,
}));

vi.mock("lucide-react", () => ({
  ArrowRight: IconStub, Users: IconStub, Home: IconStub, Calendar: IconStub,
  Banknote: IconStub, Shield: IconStub, TrendingUp: IconStub, CheckCircle: IconStub,
  LayoutDashboard: IconStub, Gavel: IconStub, BarChart3: IconStub,
  AlertTriangle: IconStub, AlertCircle: IconStub,
}));

import { clientLoader } from "./_index";

describe("admin/_index", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireAdmin.mockResolvedValue({ id: "u1", role: "admin" });
  });

  it("returns analytics + activities on success", async () => {
    const analytics = { totalUsers: 100, totalRevenue: 5000 };
    const logs = [
      { id: "log1", entity: "user", action: "create", userEmail: "a@b.com", entityId: "e1", createdAt: "2024-01-01" },
    ];
    m.getAdminAnalytics.mockResolvedValue(analytics);
    m.getAuditLogs.mockResolvedValue({ logs });

    const res = await clientLoader({ request: new Request("http://l/admin") } as any);
    expect(res.analytics).toEqual(analytics);
    expect(res.activities).toHaveLength(1);
    expect(res.activities[0].type).toBe("user");
    expect(res.error).toBeNull();
  });

  it("returns error on failure", async () => {
    m.getAdminAnalytics.mockRejectedValue(new Error("down"));
    const res = await clientLoader({ request: new Request("http://l/admin") } as any);
    expect(res.analytics).toBeNull();
    expect(res.error).toBe("down");
  });

  it("uses generic error message for non-Error throws", async () => {
    m.getAdminAnalytics.mockRejectedValue("str");
    const res = await clientLoader({ request: new Request("http://l/admin") } as any);
    expect(res.error).toMatch(/failed/i);
  });

  it("maps severity from action", async () => {
    m.getAdminAnalytics.mockResolvedValue({});
    m.getAuditLogs.mockResolvedValue({
      logs: [
        { id: "1", entity: "user", action: "delete_user", userEmail: "a@b.com", entityId: "e1", createdAt: "2024-01-01" },
        { id: "2", entity: "listing", action: "create_listing", userEmail: "b@c.com", entityId: "e2", createdAt: "2024-01-01" },
      ],
    });
    const res = await clientLoader({ request: new Request("http://l/admin") } as any);
    expect(res.activities[0].severity).toBe("error"); // delete → error
    expect(res.activities[1].severity).toBe("success"); // create → success
  });
});
