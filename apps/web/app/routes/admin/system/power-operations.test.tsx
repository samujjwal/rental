import { describe, it, expect, vi, beforeEach } from "vitest";

const IconStub = vi.hoisted(() => (props: any) => <span data-testid="icon" />);
const m = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
}));

vi.mock("react-router", () => ({
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

vi.mock("~/utils/auth", () => ({
  requireAdmin: (...a: any[]) => m.requireAdmin(...a),
}));

vi.mock("~/lib/api/admin", () => ({
  adminApi: {},
}));

vi.mock("~/components/ui", () => ({
  UnifiedButton: ({ children, ...p }: any) => <button {...p}>{children}</button>,
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => ({
  Database: IconStub, HardDrive: IconStub, Search: IconStub,
  AlertTriangle: IconStub, ChevronDown: IconStub, Loader2: IconStub,
  CheckCircle: IconStub, AlertCircle: IconStub, X: IconStub,
}));

import { clientLoader } from "./power-operations";

describe("admin/system/power-operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireAdmin.mockResolvedValue(undefined);
  });

  it("calls requireAdmin and returns null", async () => {
    const res = await clientLoader({ request: new Request("http://l/") } as any);
    expect(m.requireAdmin).toHaveBeenCalled();
    expect(res).toBeNull();
  });
});
