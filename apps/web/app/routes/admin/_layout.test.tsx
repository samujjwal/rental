import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
}));

vi.mock("react-router", () => ({
  Outlet: () => <div data-testid="outlet" />,
}));

vi.mock("~/utils/auth", () => ({
  requireAdmin: (...a: any[]) => m.requireAdmin(...a),
}));

vi.mock("~/components/admin/AdminNavigation", () => ({
  default: () => <nav data-testid="admin-nav" />,
}));

vi.mock("~/components/admin/AdminErrorBoundary", () => ({
  default: ({ children }: any) => <div data-testid="admin-error">{children}</div>,
}));

import { clientLoader } from "./_layout";

describe("admin/_layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireAdmin.mockResolvedValue(undefined);
  });

  it("calls requireAdmin and returns null", async () => {
    const res = await clientLoader({ request: new Request("http://l/admin") } as any);
    expect(m.requireAdmin).toHaveBeenCalled();
    expect(res).toBeNull();
  });
});
