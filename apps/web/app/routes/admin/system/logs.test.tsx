import { describe, it, expect, vi, beforeEach } from "vitest";
import { AxiosError } from "axios";

const IconStub = vi.hoisted(() => (props: any) => <span data-testid="icon" />);
const m = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getSystemLogs: vi.fn(),
}));

vi.mock("react-router", () => ({
  useLoaderData: vi.fn(() => ({ logs: [], error: null })),
  useRevalidator: vi.fn(() => ({ revalidate: vi.fn() })),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

vi.mock("~/utils/auth", () => ({
  requireAdmin: (...a: any[]) => m.requireAdmin(...a),
}));

vi.mock("~/lib/api/admin", () => ({
  adminApi: {
    getSystemLogs: (...a: any[]) => m.getSystemLogs(...a),
  },
}));

vi.mock("~/components/ui", () => ({
  UnifiedButton: ({ children, ...p }: any) => <button {...p}>{children}</button>,
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => ({
  Activity: IconStub, AlertCircle: IconStub, AlertTriangle: IconStub,
  Info: IconStub, Bug: IconStub, Search: IconStub, Filter: IconStub,
  Download: IconStub, RefreshCw: IconStub,
}));

import { clientLoader, getSystemLogsLoadError } from "./logs";

describe("admin/system/logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireAdmin.mockResolvedValue(undefined);
  });

  it("returns system logs", async () => {
    const logs = [{ timestamp: "2024-01-01", level: "info", message: "boot" }];
    m.getSystemLogs.mockResolvedValue({ logs });
    const res = await clientLoader({ request: new Request("http://l/") } as any);
    expect(res.logs).toEqual(logs);
    expect(res.error).toBeNull();
    expect(m.getSystemLogs).toHaveBeenCalledWith({ limit: 100 });
  });

  it("returns error on failure", async () => {
    m.getSystemLogs.mockRejectedValue(new Error("denied"));
    const res = await clientLoader({ request: new Request("http://l/") } as any);
    expect(res.logs).toEqual([]);
    expect(res.error).toBe("denied");
  });

  it("returns actionable offline loader copy", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });
    m.getSystemLogs.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));
    const res = await clientLoader({ request: new Request("http://l/") } as any);
    expect(res.error).toBe("You appear to be offline. Reconnect and try again.");
  });
});

describe("admin/system/logs loader helper", () => {
  it("keeps plain thrown errors when provided", () => {
    expect(getSystemLogsLoadError(new Error("denied"))).toBe("denied");
  });
});
