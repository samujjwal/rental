import { describe, it, expect, vi, beforeEach } from "vitest";

const IconStub = vi.hoisted(() => (props: any) => <span data-testid="icon" />);
const m = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getHighRiskUsers: vi.fn(),
}));

vi.mock("react-router", () => ({
  useLoaderData: vi.fn(() => ({ riskUsers: [], error: null })),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

vi.mock("~/utils/auth", () => ({
  requireAdmin: (...a: any[]) => m.requireAdmin(...a),
}));

vi.mock("~/lib/api/fraud", () => ({
  fraudApi: {
    getHighRiskUsers: (...a: any[]) => m.getHighRiskUsers(...a),
  },
}));

vi.mock("~/components/ui", () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
  UnifiedButton: ({ children, ...p }: any) => <button {...p}>{children}</button>,
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => ({
  AlertTriangle: IconStub, ShieldAlert: IconStub,
}));

import { clientLoader } from "./fraud";

describe("admin/fraud", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireAdmin.mockResolvedValue(undefined);
  });

  it("returns risk users on success", async () => {
    const riskUsers = [{ user: { id: "u1" }, check: { riskScore: 80 } }];
    m.getHighRiskUsers.mockResolvedValue(riskUsers);
    const res = await clientLoader({ request: new Request("http://l/admin/fraud") } as any);
    expect(res.riskUsers).toEqual(riskUsers);
    expect(res.error).toBeNull();
    expect(m.getHighRiskUsers).toHaveBeenCalledWith(50);
  });

  it("returns empty with error on failure", async () => {
    m.getHighRiskUsers.mockRejectedValue(new Error("x"));
    const res = await clientLoader({ request: new Request("http://l/admin/fraud") } as any);
    expect(res.riskUsers).toEqual([]);
    expect(res.error).toMatch(/fraud/i);
  });
});
