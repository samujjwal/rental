import { describe, it, expect, vi, beforeEach } from "vitest";

/* ─── Mocks ───────────────────────────────────────────────────────── */
const IconStub = vi.hoisted(() => (props: any) => (
  <span data-testid="icon-stub" />
));
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  redirect: vi.fn(
    (url: string) =>
      new Response("", { status: 302, headers: { Location: url } }),
  ),
}));

vi.mock("react-router", () => ({
  useLoaderData: vi.fn(() => ({ user: { firstName: "Test" } })),
  redirect: mocks.redirect,
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));
vi.mock("~/utils/auth", () => ({
  getUser: (...a: any[]) => mocks.getUser(...a),
}));
vi.mock("~/lib/store/auth", () => ({
  useAuthStore: () => ({ user: null }),
}));
vi.mock("lucide-react", () => ({
  Home: IconStub,
  Search: IconStub,
  Calendar: IconStub,
  MessageSquare: IconStub,
  Package: IconStub,
  Banknote: IconStub,
}));
vi.mock("~/components/ui", () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("~/components/layout", () => ({
  PortalPageLayout: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("~/lib/utils", () => ({
  cn: (...a: any[]) => a.filter(Boolean).join(" "),
}));

import { clientLoader } from "./dashboard";

beforeEach(() => vi.clearAllMocks());

/* ================================================================== */
/*  clientLoader – redirect logic                                      */
/* ================================================================== */
describe("dashboard clientLoader", () => {
  it("redirects unauthenticated users to login", async () => {
    mocks.getUser.mockResolvedValue(null);
    const r = await clientLoader({
      request: new Request("http://localhost/dashboard"),
    } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/auth/login");
  });

  it("redirects admin to /admin", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "admin" });
    const r = await clientLoader({
      request: new Request("http://localhost/dashboard"),
    } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/admin");
  });

  it("redirects owner to /dashboard/owner", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    const r = await clientLoader({
      request: new Request("http://localhost/dashboard"),
    } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/dashboard/owner");
  });

  it("redirects renter to /dashboard/renter", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "renter" });
    const r = await clientLoader({
      request: new Request("http://localhost/dashboard"),
    } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/dashboard/renter");
  });

  it("returns user for unrecognized role (fallback)", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "guest" });
    const r = (await clientLoader({
      request: new Request("http://localhost/dashboard"),
    } as any)) as any;
    expect(r.user.role).toBe("guest");
  });
});
