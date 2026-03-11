import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

/* ------------------------------------------------------------------ */
/*  lucide-react                                                       */
/* ------------------------------------------------------------------ */
const IconStub = vi.hoisted(() => (props: any) => (
  <span data-testid="icon-stub" />
));
vi.mock("lucide-react", () => ({
  AlertCircle: IconStub,
  ArrowLeft: IconStub,
  Calendar: IconStub,
  CheckCircle: IconStub,
  FileText: IconStub,
  MessageCircle: IconStub,
  Send: IconStub,
  XCircle: IconStub,
}));

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */
const mocks: Record<string, any> = {
  getUser: vi.fn(),
  getDisputeById: vi.fn(),
  respondToDispute: vi.fn(),
  closeDispute: vi.fn(),
  redirect: vi.fn((url: string) => {
    return new Response(null, { status: 302, headers: { Location: url } });
  }),
  useLoaderData: vi.fn(),
  useActionData: vi.fn(),
  useRevalidator: vi.fn(() => ({ revalidate: vi.fn() })),
};

vi.mock("react-router", () => ({
  Form: ({ children, ...p }: any) => <form {...p}>{children}</form>,
  Link: ({ children, to, ...p }: any) => (
    <a href={to} {...p}>{children}</a>
  ),
  redirect: (...a: any[]) => mocks.redirect(...a),
  useLoaderData: () => mocks.useLoaderData(),
  useActionData: () => mocks.useActionData(),
  useRevalidator: () => mocks.useRevalidator(),
}));
vi.mock("~/utils/auth", () => ({
  getUser: (...a: any[]) => mocks.getUser(...a),
}));
vi.mock("~/lib/api/disputes", () => ({
  disputesApi: {
    getDisputeById: (...a: any[]) => mocks.getDisputeById(...a),
    respondToDispute: (...a: any[]) => mocks.respondToDispute(...a),
    closeDispute: (...a: any[]) => mocks.closeDispute(...a),
  },
}));
vi.mock("~/lib/store/auth", () => {
  const state = { user: { id: "u1", role: "renter" }, isAuthenticated: true };
  const useAuthStore: any = (sel?: (s: any) => any) =>
    sel ? sel(state) : state;
  useAuthStore.getState = () => state;
  return { useAuthStore };
});
vi.mock("date-fns", () => ({
  format: (d: any, p: string) => "2024-01-01",
}));
vi.mock("~/lib/utils", () => ({ cn: (...a: string[]) => a.filter(Boolean).join(" ") }));
vi.mock("~/components/ui", () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  UnifiedButton: ({ children, ...p }: any) => <button {...p}>{children}</button>,
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));

/* ------------------------------------------------------------------ */
/*  Helper                                                             */
/* ------------------------------------------------------------------ */
function makeFormReq(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return { formData: () => Promise.resolve(fd) } as unknown as Request;
}

const validId = "11111111-1111-1111-8111-111111111111";

import { clientLoader, clientAction } from "./disputes.$id";

const authUser = { id: "u1", email: "u@test.com", role: "renter" };
const dispute = {
  id: validId,
  status: "OPEN",
  title: "Damage Report",
  description: "Scratched",
  initiator: { id: "u1", email: "u@test.com" },
  defendant: { id: "u2", email: "d@test.com" },
  type: "PROPERTY_DAMAGE",
  createdAt: "2024-01-01",
};

beforeEach(() => vi.clearAllMocks());

/* ================================================================== */
/*  clientLoader                                                       */
/* ================================================================== */
describe("clientLoader", () => {
  it("redirects unauthenticated to /auth/login", async () => {
    mocks.getUser.mockResolvedValue(null);
    const r = await clientLoader({
      request: new Request("http://localhost/disputes/" + validId),
      params: { id: validId },
    } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/auth/login");
  });

  it("redirects on invalid UUID", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    const r = await clientLoader({
      request: new Request("http://localhost/disputes/bad"),
      params: { id: "bad" },
    } as any);
    expect((r as Response).headers.get("Location")).toBe("/disputes");
  });

  it("returns dispute for participant", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getDisputeById.mockResolvedValue(dispute);
    const r = await clientLoader({
      request: new Request("http://localhost/disputes/" + validId),
      params: { id: validId },
    } as any);
    expect(r).toEqual({ dispute });
  });

  it("redirects non-participant non-admin", async () => {
    mocks.getUser.mockResolvedValue({ ...authUser, id: "stranger" });
    mocks.getDisputeById.mockResolvedValue(dispute);
    const r = await clientLoader({
      request: new Request("http://localhost/disputes/" + validId),
      params: { id: validId },
    } as any);
    expect((r as Response).headers.get("Location")).toBe("/disputes");
  });

  it("allows admin to view any dispute", async () => {
    mocks.getUser.mockResolvedValue({ ...authUser, id: "admin1", role: "admin" });
    mocks.getDisputeById.mockResolvedValue(dispute);
    const r = await clientLoader({
      request: new Request("http://localhost/disputes/" + validId),
      params: { id: validId },
    } as any);
    expect(r).toEqual({ dispute });
  });
});

/* ================================================================== */
/*  clientAction — respond                                             */
/* ================================================================== */
describe("clientAction — respond", () => {
  it("rejects invalid intent", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    const r = await clientAction({
      request: makeFormReq({ intent: "hack" }),
      params: { id: validId },
    } as any);
    expect((r as any).error).toBe("Invalid action");
  });

  it("blocks respond on CLOSED dispute", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getDisputeById.mockResolvedValue({ ...dispute, status: "CLOSED" });
    const r = await clientAction({
      request: makeFormReq({ intent: "respond", message: "hello" }),
      params: { id: validId },
    } as any);
    expect((r as any).error).toMatch(/closed disputes/i);
  });

  it("rejects empty message", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getDisputeById.mockResolvedValue(dispute);
    const r = await clientAction({
      request: makeFormReq({ intent: "respond", message: "   " }),
      params: { id: validId },
    } as any);
    expect((r as any).error).toMatch(/message is required/i);
  });

  it("sends response successfully", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getDisputeById.mockResolvedValue(dispute);
    mocks.respondToDispute.mockResolvedValue({});
    const r = await clientAction({
      request: makeFormReq({ intent: "respond", message: "My response" }),
      params: { id: validId },
    } as any);
    expect((r as any).success).toBe("Response sent");
    expect(mocks.respondToDispute).toHaveBeenCalledWith(validId, "My response");
  });
});

/* ================================================================== */
/*  clientAction — close                                               */
/* ================================================================== */
describe("clientAction — close", () => {
  it("blocks non-initiator close", async () => {
    mocks.getUser.mockResolvedValue({ ...authUser, id: "u2" }); // defendant
    mocks.getDisputeById.mockResolvedValue(dispute);
    const r = await clientAction({
      request: makeFormReq({ intent: "close", reason: "Done" }),
      params: { id: validId },
    } as any);
    expect((r as any).error).toMatch(/only the dispute initiator/i);
  });

  it("blocks close on already-closed dispute", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getDisputeById.mockResolvedValue({ ...dispute, status: "RESOLVED" });
    const r = await clientAction({
      request: makeFormReq({ intent: "close", reason: "Done" }),
      params: { id: validId },
    } as any);
    expect((r as any).error).toMatch(/already closed/i);
  });

  it("rejects empty reason", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getDisputeById.mockResolvedValue(dispute);
    const r = await clientAction({
      request: makeFormReq({ intent: "close", reason: " " }),
      params: { id: validId },
    } as any);
    expect((r as any).error).toMatch(/reason is required/i);
  });

  it("closes dispute successfully", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getDisputeById.mockResolvedValue(dispute);
    mocks.closeDispute.mockResolvedValue({});
    const r = await clientAction({
      request: makeFormReq({ intent: "close", reason: "Resolved offline" }),
      params: { id: validId },
    } as any);
    expect((r as any).success).toBe("Dispute closed");
    expect(mocks.closeDispute).toHaveBeenCalledWith(validId, "Resolved offline");
  });

  it("handles API error", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getDisputeById.mockResolvedValue(dispute);
    mocks.closeDispute.mockRejectedValue({
      response: { data: { message: "Server error" } },
    });
    const r = await clientAction({
      request: makeFormReq({ intent: "close", reason: "Done" }),
      params: { id: validId },
    } as any);
    expect((r as any).error).toBe("Server error");
  });
});
