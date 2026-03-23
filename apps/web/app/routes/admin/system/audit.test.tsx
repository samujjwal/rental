import { AxiosError } from "axios";
import { describe, it, expect, vi, beforeEach } from "vitest";

const IconStub = vi.hoisted(() => (props: any) => <span data-testid="icon" />);
const m = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getAuditLogs: vi.fn(),
}));

vi.mock("react-router", () => ({
  useLoaderData: vi.fn(() => ({ logs: [], total: 0, page: 1, limit: 25, error: null })),
  useSearchParams: vi.fn(() => [new URLSearchParams(), vi.fn()]),
  useRevalidator: vi.fn(() => ({ revalidate: vi.fn() })),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

vi.mock("~/utils/auth", () => ({
  requireAdmin: (...a: any[]) => m.requireAdmin(...a),
}));

vi.mock("~/lib/api/admin", () => ({
  adminApi: {
    getAuditLogs: (...a: any[]) => m.getAuditLogs(...a),
  },
  AuditLogEntry: {},
}));

vi.mock("~/components/ui", () => ({
  UnifiedButton: ({ children, ...p }: any) => <button {...p}>{children}</button>,
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => ({
  AlertCircle: IconStub, Search: IconStub,
}));

import { clientLoader, getAuditLogsLoadError } from "./audit";

describe("admin/system/audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireAdmin.mockResolvedValue(undefined);
  });

  it("returns audit logs with default pagination", async () => {
    const logs = [{ id: "l1", action: "login" }];
    m.getAuditLogs.mockResolvedValue({ logs, total: 1, page: 1, limit: 25 });
    const res = await clientLoader({ request: new Request("http://l/admin/system/audit") } as any);
    expect(res.logs).toEqual(logs);
    expect(res.total).toBe(1);
    expect(res.error).toBeNull();
    expect(m.getAuditLogs).toHaveBeenCalledWith({ page: 1, limit: 25, action: undefined, userId: undefined });
  });

  it("parses pagination & filter params", async () => {
    m.getAuditLogs.mockResolvedValue({ logs: [], total: 0, page: 2, limit: 50 });
    await clientLoader({
      request: new Request("http://l/admin/system/audit?page=2&limit=50&action=login&userId=u1"),
    } as any);
    expect(m.getAuditLogs).toHaveBeenCalledWith({ page: 2, limit: 50, action: "login", userId: "u1" });
  });

  it("clamps invalid page/limit to defaults", async () => {
    m.getAuditLogs.mockResolvedValue({ logs: [], total: 0 });
    await clientLoader({
      request: new Request("http://l/admin/system/audit?page=-5&limit=999"),
    } as any);
    expect(m.getAuditLogs).toHaveBeenCalledWith({ page: 1, limit: 25, action: undefined, userId: undefined });
  });

  it("returns error on failure", async () => {
    m.getAuditLogs.mockRejectedValue(new Error("timeout"));
    const res = await clientLoader({ request: new Request("http://l/admin/system/audit") } as any);
    expect(res.logs).toEqual([]);
    expect(res.error).toBe("timeout");
  });

  it("uses actionable offline copy on loader failure", async () => {
    const previousOnline = navigator.onLine;
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });
    m.getAuditLogs.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));

    const res = await clientLoader({ request: new Request("http://l/admin/system/audit") } as any);

    expect(res.error).toBe("You appear to be offline. Reconnect and try again.");

    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: previousOnline,
    });
  });

  it("preserves plain thrown error messages in helper", () => {
    expect(getAuditLogsLoadError(new Error("backend unavailable"))).toBe("backend unavailable");
  });
});
