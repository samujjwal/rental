import { describe, it, expect, vi, beforeEach } from "vitest";

const IconStub = vi.hoisted(() => (props: any) => <span data-testid="icon" />);
const m = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getEnvironmentVariables: vi.fn(),
}));

vi.mock("react-router", () => ({
  useLoaderData: vi.fn(() => ({ variables: [], environment: "development", error: null })),
  useRevalidator: vi.fn(() => ({ revalidate: vi.fn() })),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

vi.mock("~/utils/auth", () => ({
  requireAdmin: (...a: any[]) => m.requireAdmin(...a),
}));

vi.mock("~/lib/api/admin", () => ({
  adminApi: {
    getEnvironmentVariables: (...a: any[]) => m.getEnvironmentVariables(...a),
  },
}));

vi.mock("~/components/ui", () => ({
  UnifiedButton: ({ children, ...p }: any) => <button {...p}>{children}</button>,
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => ({
  Terminal: IconStub, RefreshCw: IconStub, Copy: IconStub, CheckCircle: IconStub,
  AlertTriangle: IconStub, Server: IconStub, Database: IconStub, Cloud: IconStub,
  Lock: IconStub, Eye: IconStub, EyeOff: IconStub, Info: IconStub,
}));

import { clientLoader } from "./environment";

describe("admin/system/environment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireAdmin.mockResolvedValue(undefined);
  });

  it("returns variables and environment", async () => {
    const variables = [{ key: "DB_URL", value: "pg://", category: "database", sensitive: false }];
    m.getEnvironmentVariables.mockResolvedValue({ variables, environment: "production" });
    const res = await clientLoader({ request: new Request("http://l/") } as any);
    expect(res.variables).toEqual(variables);
    expect(res.environment).toBe("production");
    expect(res.error).toBeNull();
  });

  it("falls back on error", async () => {
    m.getEnvironmentVariables.mockRejectedValue(new Error("denied"));
    const res = await clientLoader({ request: new Request("http://l/") } as any);
    expect(res.variables).toEqual([]);
    expect(res.environment).toBe("unknown");
    expect(res.error).toBe("denied");
  });
});
