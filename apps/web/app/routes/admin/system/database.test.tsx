import { describe, it, expect, vi, beforeEach } from "vitest";

const IconStub = vi.hoisted(() => (props: any) => <span data-testid="icon" />);
const m = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getSystemHealth: vi.fn(),
  getDatabaseInfo: vi.fn(),
  runDatabaseVacuum: vi.fn(),
  runDatabaseAnalyze: vi.fn(),
  clearCache: vi.fn(),
}));

vi.mock("react-router", () => ({
  useLoaderData: vi.fn(() => ({ health: null, dbInfo: null, error: null })),
  useActionData: vi.fn(() => null),
  useNavigation: vi.fn(() => ({ state: "idle", formData: null })),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
  Form: ({ children, ...p }: any) => <form {...p}>{children}</form>,
}));

vi.mock("~/utils/auth", () => ({
  requireAdmin: (...a: any[]) => m.requireAdmin(...a),
}));

vi.mock("~/lib/api/admin", () => ({
  adminApi: {
    getSystemHealth: (...a: any[]) => m.getSystemHealth(...a),
    getDatabaseInfo: (...a: any[]) => m.getDatabaseInfo(...a),
    runDatabaseVacuum: (...a: any[]) => m.runDatabaseVacuum(...a),
    runDatabaseAnalyze: (...a: any[]) => m.runDatabaseAnalyze(...a),
    clearCache: (...a: any[]) => m.clearCache(...a),
  },
}));

vi.mock("~/components/ui", () => ({
  UnifiedButton: ({ children, ...p }: any) => <button {...p}>{children}</button>,
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => ({
  Database: IconStub, RefreshCw: IconStub, Trash2: IconStub, CheckCircle: IconStub,
  XCircle: IconStub, Loader2: IconStub, AlertTriangle: IconStub, HardDrive: IconStub,
  Activity: IconStub, Server: IconStub, Zap: IconStub,
}));

import { clientLoader, clientAction } from "../system/database";

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return { formData: () => Promise.resolve(fd) } as unknown as Request;
}

describe("admin/system/database", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireAdmin.mockResolvedValue(undefined);
  });

  /* loader */
  describe("clientLoader", () => {
    it("returns health + dbInfo on success", async () => {
      const health = { status: "healthy" };
      const dbInfo = { size: "1GB" };
      m.getSystemHealth.mockResolvedValue(health);
      m.getDatabaseInfo.mockResolvedValue(dbInfo);
      const res = await clientLoader({ request: new Request("http://l/") } as any);
      expect(res.health).toEqual(health);
      expect(res.dbInfo).toEqual(dbInfo);
      expect(res.error).toBeNull();
    });

    it("returns error on failure", async () => {
      m.getSystemHealth.mockRejectedValue(new Error("timeout"));
      const res = await clientLoader({ request: new Request("http://l/") } as any);
      expect(res.health).toBeNull();
      expect(res.error).toBe("timeout");
    });
  });

  /* action */
  describe("clientAction", () => {
    it("rejects unknown intent", async () => {
      const res = await clientAction({ request: form({ intent: "drop" }) } as any);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/unknown/i);
    });

    it("requires confirmation", async () => {
      const res = await clientAction({
        request: form({ intent: "vacuum", confirmed: "false" }),
      } as any);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/confirm/i);
    });

    /* vacuum */
    it("vacuum succeeds", async () => {
      m.runDatabaseVacuum.mockResolvedValue({});
      const res = await clientAction({
        request: form({ intent: "vacuum", confirmed: "true" }),
      } as any);
      expect(res.success).toBe(true);
      expect(res.message).toMatch(/vacuum/i);
    });

    it("vacuum handles error", async () => {
      m.runDatabaseVacuum.mockRejectedValue({ response: { data: { message: "locked" } } });
      const res = await clientAction({
        request: form({ intent: "vacuum", confirmed: "true" }),
      } as any);
      expect(res.success).toBe(false);
      expect(res.error).toBe("locked");
    });

    /* analyze */
    it("analyze succeeds", async () => {
      m.runDatabaseAnalyze.mockResolvedValue({});
      const res = await clientAction({
        request: form({ intent: "analyze", confirmed: "true" }),
      } as any);
      expect(res.success).toBe(true);
      expect(res.message).toMatch(/analysis/i);
    });

    /* clearCache */
    it("clearCache succeeds", async () => {
      m.clearCache.mockResolvedValue({});
      const res = await clientAction({
        request: form({ intent: "clearCache", confirmed: "true" }),
      } as any);
      expect(res.success).toBe(true);
      expect(res.message).toMatch(/cache.*clear/i);
    });

    it("clearCache handles error", async () => {
      m.clearCache.mockRejectedValue(new Error("oops"));
      const res = await clientAction({
        request: form({ intent: "clearCache", confirmed: "true" }),
      } as any);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/clear.*cache/i);
    });
  });
});
