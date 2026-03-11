import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

/* ------------------------------------------------------------------ */
/*  lucide-react                                                       */
/* ------------------------------------------------------------------ */
const IconStub = vi.hoisted(() => (props: any) => (
  <span data-testid="icon-stub" />
));
vi.mock("lucide-react", () => ({
  AlertTriangle: IconStub,
  Clock: IconStub,
  MessageCircle: IconStub,
  CheckCircle: IconStub,
  XCircle: IconStub,
  Calendar: IconStub,
  Package: IconStub,
  ChevronRight: IconStub,
  Banknote: IconStub,
  HelpCircle: IconStub,
  FileWarning: IconStub,
  Star: IconStub,
  CreditCard: IconStub,
}));

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */
const mocks: Record<string, any> = {
  getUser: vi.fn(),
  getMyDisputes: vi.fn(),
  redirect: vi.fn((url: string) => {
    return new Response(null, { status: 302, headers: { Location: url } });
  }),
  useLoaderData: vi.fn(),
  useSearchParams: vi.fn(() => [new URLSearchParams(), vi.fn()]),
};

vi.mock("react-router", () => ({
  Link: ({ children, to, ...p }: any) => <a href={to} {...p}>{children}</a>,
  redirect: (...a: any[]) => mocks.redirect(...a),
  useLoaderData: () => mocks.useLoaderData(),
  useSearchParams: () => mocks.useSearchParams(),
}));
vi.mock("~/utils/auth", () => ({
  getUser: (...a: any[]) => mocks.getUser(...a),
}));
vi.mock("~/lib/api/disputes", () => ({
  disputesApi: {
    getMyDisputes: (...a: any[]) => mocks.getMyDisputes(...a),
  },
}));
vi.mock("date-fns", () => ({
  format: (d: any, p: string) => "2024-01-01",
}));
vi.mock("~/lib/utils", () => ({ cn: (...a: string[]) => a.filter(Boolean).join(" ") }));
vi.mock("~/components/ui", () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  Badge: ({ children }: any) => <span>{children}</span>,
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
  Pagination: () => <nav data-testid="pagination" />,
  UnifiedButton: ({ children, ...p }: any) => <button {...p}>{children}</button>,
}));
vi.mock("~/components/ui/skeleton", () => ({
  StatCardSkeleton: () => <div />,
  Skeleton: () => <div />,
}));

import { clientLoader } from "./disputes";

const authUser = { id: "u1", email: "u@test.com", role: "renter" };

beforeEach(() => vi.clearAllMocks());

/* ================================================================== */
/*  clientLoader                                                       */
/* ================================================================== */
describe("clientLoader", () => {
  it("redirects unauthenticated", async () => {
    mocks.getUser.mockResolvedValue(null);
    const r = await clientLoader({
      request: new Request("http://localhost/disputes"),
    } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/auth/login");
  });

  it("returns disputes with stats", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    const disputes = [
      { id: "1", status: "OPEN" },
      { id: "2", status: "UNDER_REVIEW" },
      { id: "3", status: "RESOLVED" },
    ];
    mocks.getMyDisputes.mockResolvedValue({ disputes, total: 3 });
    const r = (await clientLoader({
      request: new Request("http://localhost/disputes"),
    } as any)) as any;
    expect(r.disputes).toHaveLength(3);
    expect(r.stats.total).toBe(3);
    expect(r.stats.open).toBe(1);
    expect(r.stats.inProgress).toBe(1);
    expect(r.stats.resolved).toBe(1);
    expect(r.error).toBeNull();
  });

  it("passes status filter from query param", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getMyDisputes.mockResolvedValue({ disputes: [], total: 0 });
    await clientLoader({
      request: new Request("http://localhost/disputes?status=OPEN"),
    } as any);
    expect(mocks.getMyDisputes).toHaveBeenCalledWith(
      expect.objectContaining({ status: "OPEN", page: 1, limit: 10 })
    );
  });

  it("ignores invalid status filter", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getMyDisputes.mockResolvedValue({ disputes: [], total: 0 });
    await clientLoader({
      request: new Request("http://localhost/disputes?status=HACKED"),
    } as any);
    expect(mocks.getMyDisputes).toHaveBeenCalledWith(
      expect.objectContaining({ status: undefined })
    );
  });

  it("clamps page ≥ 1", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getMyDisputes.mockResolvedValue({ disputes: [], total: 0 });
    await clientLoader({
      request: new Request("http://localhost/disputes?page=-5"),
    } as any);
    expect(mocks.getMyDisputes).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1 })
    );
  });

  it("returns empty state on API error", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getMyDisputes.mockRejectedValue(new Error("fail"));
    const r = (await clientLoader({
      request: new Request("http://localhost/disputes"),
    } as any)) as any;
    expect(r.disputes).toEqual([]);
    expect(r.stats.total).toBe(0);
    expect(r.error).toBeTruthy();
  });
});
