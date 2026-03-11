import { describe, it, expect, vi, beforeEach } from "vitest";

const IconStub = vi.hoisted(() => (props: any) => <span data-testid="icon" />);
const m = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getAdminAnalytics: vi.fn(),
}));

vi.mock("react-router", () => ({
  useLoaderData: vi.fn(() => ({ analytics: null, range: "30d", error: null })),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

vi.mock("~/utils/auth", () => ({
  requireAdmin: (...a: any[]) => m.requireAdmin(...a),
}));

vi.mock("~/utils/adminAnalytics", () => ({
  getAdminAnalytics: (...a: any[]) => m.getAdminAnalytics(...a),
  AnalyticsRange: {},
}));

vi.mock("~/components/ui", () => ({
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => ({
  AlertCircle: IconStub, AlertTriangle: IconStub, Info: IconStub,
}));

import { clientLoader } from "./analytics";

describe("admin/analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireAdmin.mockResolvedValue(undefined);
  });

  it("defaults range to 30d", async () => {
    m.getAdminAnalytics.mockResolvedValue({ data: "ok" });
    const res = await clientLoader({ request: new Request("http://l/admin/analytics") } as any);
    expect(m.getAdminAnalytics).toHaveBeenCalledWith(expect.anything(), "30d");
    expect(res.range).toBe("30d");
    expect(res.analytics).toEqual({ data: "ok" });
    expect(res.error).toBeNull();
  });

  it("uses valid range from query param", async () => {
    m.getAdminAnalytics.mockResolvedValue({});
    await clientLoader({ request: new Request("http://l/admin/analytics?range=7d") } as any);
    expect(m.getAdminAnalytics).toHaveBeenCalledWith(expect.anything(), "7d");
  });

  it("falls back to 30d for invalid range", async () => {
    m.getAdminAnalytics.mockResolvedValue({});
    await clientLoader({ request: new Request("http://l/admin/analytics?range=999d") } as any);
    expect(m.getAdminAnalytics).toHaveBeenCalledWith(expect.anything(), "30d");
  });

  it("returns error on failure", async () => {
    m.getAdminAnalytics.mockRejectedValue(new Error("timeout"));
    const res = await clientLoader({ request: new Request("http://l/admin/analytics") } as any);
    expect(res.analytics).toBeNull();
    expect(res.error).toBe("timeout");
  });
});
