import { describe, it, expect, vi, beforeEach } from "vitest";

const IconStub = vi.hoisted(() => (props: any) => <span data-testid="icon" />);
const m = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getSession: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("react-router", () => ({
  useParams: vi.fn(() => ({ entity: "users" })),
  useLoaderData: vi.fn(() => ({ user: {}, accessToken: "t", refreshToken: "r" })),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
  redirect: (...a: any[]) => m.redirect(...a),
}));

vi.mock("~/utils/auth", () => ({
  requireAdmin: (...a: any[]) => m.requireAdmin(...a),
  getSession: (...a: any[]) => m.getSession(...a),
}));

vi.mock("~/lib/store/auth", () => ({
  useAuthStore: vi.fn(() => ({})),
}));

vi.mock("~/hooks/useAdminEntity", () => ({
  useAdminEntity: vi.fn(() => ({ data: [], loading: false })),
}));

vi.mock("~/components/admin/enhanced", () => ({
  EnhancedDataTable: () => <div data-testid="data-table" />,
  EnhancedForm: () => <div data-testid="form" />,
}));

vi.mock("~/components/ui", () => ({
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => ({
  ChevronRight: IconStub, Loader2: IconStub,
}));

import { clientLoader } from "./[entity]";

describe("admin/entities/[entity]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireAdmin.mockResolvedValue({ id: "u1", role: "admin" });
    m.getSession.mockResolvedValue({
      get: (k: string) => (k === "accessToken" ? "tok" : "ref"),
    });
    m.redirect.mockImplementation((url: string) => new Response(null, { status: 302, headers: { Location: url } }));
  });

  it("redirects for invalid entity", async () => {
    const res = await clientLoader({
      request: new Request("http://l/admin/entities/invalid"),
    } as any);
    expect(m.redirect).toHaveBeenCalledWith("/admin");
  });

  it("loads for valid entity (users)", async () => {
    const res = await clientLoader({
      request: new Request("http://l/admin/entities/users"),
    } as any);
    expect(res).toEqual(
      expect.objectContaining({ accessToken: "tok", refreshToken: "ref" })
    );
  });

  it("loads for valid entity (listings)", async () => {
    const res = await clientLoader({
      request: new Request("http://l/admin/entities/listings"),
    } as any);
    expect(m.requireAdmin).toHaveBeenCalled();
  });

  it("loads for valid entity (bookings)", async () => {
    await clientLoader({
      request: new Request("http://l/admin/entities/bookings"),
    } as any);
    expect(m.requireAdmin).toHaveBeenCalled();
  });
});
