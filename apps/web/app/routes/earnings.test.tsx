import { describe, it, expect, vi, beforeEach } from "vitest";

/* ─── Mocks ───────────────────────────────────────────────────────── */
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  redirect: vi.fn((url: string) => new Response(null, { status: 302, headers: { Location: url } })),
}));

vi.mock("react-router", () => ({
  redirect: mocks.redirect,
}));
vi.mock("~/utils/auth", () => ({
  getUser: (...a: any[]) => mocks.getUser(...a),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock("~/components/ui", () => ({
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));

import { clientLoader } from "./earnings";

beforeEach(() => vi.clearAllMocks());

/* ================================================================== */
/*  clientLoader – redirect logic                                      */
/* ================================================================== */
describe("earnings clientLoader", () => {
  it("redirects unauthenticated users to login with redirect", async () => {
    mocks.getUser.mockResolvedValue(null);
    const r = await clientLoader({
      request: new Request("http://localhost/earnings"),
    } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe(
      "/auth/login?redirect=/earnings",
    );
  });

  it("redirects owner to /dashboard/owner/earnings", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    const r = await clientLoader({
      request: new Request("http://localhost/earnings"),
    } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe(
      "/dashboard/owner/earnings",
    );
  });

  it("redirects admin to /dashboard/owner/earnings", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "admin" });
    const r = await clientLoader({
      request: new Request("http://localhost/earnings"),
    } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe(
      "/dashboard/owner/earnings",
    );
  });

  it("redirects renter to /dashboard/renter", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "renter" });
    const r = await clientLoader({
      request: new Request("http://localhost/earnings"),
    } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/dashboard/renter");
  });
});
