import { describe, it, expect, vi, beforeEach } from "vitest";

const IconStub = vi.hoisted(() => (props: any) => <span data-testid="icon" />);
const m = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getGeneralSettings: vi.fn(),
  getSystemHealth: vi.fn(),
  getDatabaseInfo: vi.fn(),
}));

vi.mock("react-router", () => ({
  useLoaderData: vi.fn(() => ({})),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

vi.mock("~/utils/auth", () => ({
  requireAdmin: (...a: any[]) => m.requireAdmin(...a),
}));

vi.mock("~/lib/api/admin", () => ({
  adminApi: {
    getGeneralSettings: (...a: any[]) => m.getGeneralSettings(...a),
    getSystemHealth: (...a: any[]) => m.getSystemHealth(...a),
    getDatabaseInfo: (...a: any[]) => m.getDatabaseInfo(...a),
  },
}));

vi.mock("~/components/ui", () => ({
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => ({
  Settings: IconStub, Zap: IconStub, Database: IconStub, Bell: IconStub,
  Mail: IconStub, Server: IconStub, Shield: IconStub, Key: IconStub,
  Activity: IconStub, HardDrive: IconStub, LucideIcon: IconStub,
}));

import { clientLoader } from "./_index";

describe("admin/system/_index", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireAdmin.mockResolvedValue(undefined);
  });

  it("returns all three data sources on success", async () => {
    const gs = { siteName: "Test" };
    const sh = { status: "healthy" };
    const db = { size: "500MB" };
    m.getGeneralSettings.mockResolvedValue(gs);
    m.getSystemHealth.mockResolvedValue(sh);
    m.getDatabaseInfo.mockResolvedValue(db);
    const res = await clientLoader({ request: new Request("http://l/") } as any);
    expect(res.generalSettings).toEqual(gs);
    expect(res.systemHealth).toEqual(sh);
    expect(res.databaseInfo).toEqual(db);
    expect(res.error).toBeNull();
  });

  it("returns nulls + error on failure", async () => {
    m.getGeneralSettings.mockRejectedValue(new Error("oops"));
    const res = await clientLoader({ request: new Request("http://l/") } as any);
    expect(res.generalSettings).toBeNull();
    expect(res.systemHealth).toBeNull();
    expect(res.error).toBe("oops");
  });
});
