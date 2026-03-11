import { describe, it, expect, vi, beforeEach } from "vitest";

/* ─── Mocks ───────────────────────────────────────────────────────── */
const IconStub = vi.hoisted(() => (props: any) => <span data-testid="icon-stub" />);

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getPendingListings: vi.fn(),
  approveListing: vi.fn(),
  rejectListing: vi.fn(),
  useLoaderData: vi.fn(),
  useActionData: vi.fn(),
  useNavigation: vi.fn(() => ({ state: "idle" })),
}));

vi.mock("react-router", () => ({
  useLoaderData: () => mocks.useLoaderData(),
  useActionData: () => mocks.useActionData(),
  useNavigation: () => mocks.useNavigation(),
  Form: ({ children, ...p }: any) => <form {...p}>{children}</form>,
}));
vi.mock("~/utils/auth", () => ({
  requireAdmin: (...a: any[]) => mocks.requireAdmin(...a),
}));
vi.mock("~/lib/api/admin", () => ({
  adminApi: {
    getPendingListings: (...a: any[]) => mocks.getPendingListings(...a),
    approveListing: (...a: any[]) => mocks.approveListing(...a),
    rejectListing: (...a: any[]) => mocks.rejectListing(...a),
  },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock("lucide-react", () => ({
  CheckCircle: IconStub,
  XCircle: IconStub,
  Home: IconStub,
  User: IconStub,
  Calendar: IconStub,
  DollarSign: IconStub,
  Loader2: IconStub,
  ClipboardList: IconStub,
  AlertTriangle: IconStub,
}));
vi.mock("~/components/ui", () => ({
  UnifiedButton: ({ children, ...p }: any) => <button {...p}>{children}</button>,
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("~/lib/utils", () => ({
  cn: (...a: any[]) => a.filter(Boolean).join(" "),
  formatCurrency: (v: number) => `NPR ${v}`,
  formatDate: (d: any) => "2025-01-01",
}));

import { clientLoader, clientAction } from "./listings";

beforeEach(() => vi.clearAllMocks());

/* ================================================================== */
/*  clientLoader                                                       */
/* ================================================================== */
describe("admin/listings clientLoader", () => {
  it("calls requireAdmin", async () => {
    mocks.requireAdmin.mockResolvedValue(undefined);
    mocks.getPendingListings.mockResolvedValue({ listings: [], total: 0 });
    await clientLoader({ request: new Request("http://localhost/admin/listings") } as any);
    expect(mocks.requireAdmin).toHaveBeenCalled();
  });

  it("returns listings on success", async () => {
    mocks.requireAdmin.mockResolvedValue(undefined);
    mocks.getPendingListings.mockResolvedValue({
      listings: [{ id: "l1", title: "Test" }],
      total: 1,
    });
    const r = (await clientLoader({
      request: new Request("http://localhost/admin/listings"),
    } as any)) as any;
    expect(r.listings).toHaveLength(1);
    expect(r.total).toBe(1);
    expect(r.error).toBeNull();
  });

  it("handles error gracefully", async () => {
    mocks.requireAdmin.mockResolvedValue(undefined);
    mocks.getPendingListings.mockRejectedValue(new Error("Server error"));
    const r = (await clientLoader({
      request: new Request("http://localhost/admin/listings"),
    } as any)) as any;
    expect(r.listings).toEqual([]);
    expect(r.error).toBe("Server error");
  });
});

/* ================================================================== */
/*  clientAction                                                       */
/* ================================================================== */
describe("admin/listings clientAction", () => {
  const actionRequest = (body: FormData) =>
    new Request("http://localhost/admin/listings", { method: "POST", body });

  it("approves listing", async () => {
    mocks.requireAdmin.mockResolvedValue(undefined);
    mocks.approveListing.mockResolvedValue({});
    const fd = new FormData();
    fd.append("intent", "approve");
    fd.append("listingId", "l1");
    const r = (await clientAction({ request: actionRequest(fd) } as any)) as any;
    expect(r.success).toBe(true);
    expect(mocks.approveListing).toHaveBeenCalledWith("l1");
  });

  it("rejects listing with reason", async () => {
    mocks.requireAdmin.mockResolvedValue(undefined);
    mocks.rejectListing.mockResolvedValue({});
    const fd = new FormData();
    fd.append("intent", "reject");
    fd.append("listingId", "l1");
    fd.append("reason", "Bad photos");
    const r = (await clientAction({ request: actionRequest(fd) } as any)) as any;
    expect(r.success).toBe(true);
    expect(mocks.rejectListing).toHaveBeenCalledWith("l1", "Bad photos");
  });

  it("handles unknown intent", async () => {
    mocks.requireAdmin.mockResolvedValue(undefined);
    const fd = new FormData();
    fd.append("intent", "delete");
    fd.append("listingId", "l1");
    const r = (await clientAction({ request: actionRequest(fd) } as any)) as any;
    expect(r.success).toBe(false);
    expect(r.error).toBe("Unknown action");
  });

  it("handles API error", async () => {
    mocks.requireAdmin.mockResolvedValue(undefined);
    mocks.approveListing.mockRejectedValue(new Error("Approval failed"));
    const fd = new FormData();
    fd.append("intent", "approve");
    fd.append("listingId", "l1");
    const r = (await clientAction({ request: actionRequest(fd) } as any)) as any;
    expect(r.success).toBe(false);
    expect(r.error).toBe("Approval failed");
  });
});
