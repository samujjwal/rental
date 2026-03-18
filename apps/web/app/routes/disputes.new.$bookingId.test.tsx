import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  lucide-react                                                       */
/* ------------------------------------------------------------------ */
const IconStub = vi.hoisted(() => (props: any) => (
  <span data-testid="icon-stub" />
));
vi.mock("lucide-react", () => ({
  ArrowLeft: IconStub,
  AlertCircle: IconStub,
  Upload: IconStub,
  X: IconStub,
  FileText: IconStub,
  Image: IconStub,
}));

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */
const mocks: Record<string, any> = {
  getUser: vi.fn(),
  getBookingById: vi.fn(),
  createDispute: vi.fn(),
  uploadImage: vi.fn(),
  uploadDocument: vi.fn(),
  redirect: vi.fn((url: string) => {
    return new Response(null, { status: 302, headers: { Location: url } });
  }),
};

vi.mock("react-router", () => ({
  Form: ({ children, ...p }: any) => <form {...p}>{children}</form>,
  Link: ({ children, to, ...p }: any) => <a href={to} {...p}>{children}</a>,
  redirect: (...a: any[]) => mocks.redirect(...a),
  useLoaderData: () => ({}),
  useActionData: () => null,
  useNavigate: () => vi.fn(),
}));
vi.mock("~/utils/auth", () => ({
  getUser: (...a: any[]) => mocks.getUser(...a),
}));
vi.mock("~/lib/api/disputes", () => ({
  disputesApi: {
    createDispute: (...a: any[]) => mocks.createDispute(...a),
  },
}));
vi.mock("~/lib/api/bookings", () => ({
  bookingsApi: {
    getBookingById: (...a: any[]) => mocks.getBookingById(...a),
  },
}));
vi.mock("~/lib/api/upload", () => ({
  uploadApi: {
    uploadImage: (...a: any[]) => mocks.uploadImage(...a),
    uploadDocument: (...a: any[]) => mocks.uploadDocument(...a),
  },
}));
vi.mock("~/lib/utils", () => ({ cn: (...a: string[]) => a.filter(Boolean).join(" ") }));
vi.mock("~/components/ui", () => ({
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));

/* ------------------------------------------------------------------ */
const validId = "11111111-1111-1111-8111-111111111111";
const validCuid = "ckx1234567890abcdefghijkl";

function makeFormReq(fields: Record<string, string>, files?: { name: string; file: File }[]) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  if (files) {
    for (const f of files) fd.append(f.name, f.file);
  }
  return { formData: () => Promise.resolve(fd) } as unknown as Request;
}

import { clientLoader, clientAction } from "./disputes.new.$bookingId";

const authUser = { id: "u1", email: "u@test.com", role: "renter" };
const booking = {
  id: validId,
  ownerId: "owner1",
  renterId: "u1",
  totalAmount: 5000,
  status: "COMPLETED",
};

beforeEach(() => vi.clearAllMocks());

/* ================================================================== */
/*  clientLoader                                                       */
/* ================================================================== */
describe("clientLoader", () => {
  it("redirects unauthenticated", async () => {
    mocks.getUser.mockResolvedValue(null);
    const r = await clientLoader({
      request: new Request("http://localhost/disputes/new/" + validId),
      params: { bookingId: validId },
    } as any);
    expect((r as Response).headers.get("Location")).toBe("/auth/login");
  });

  it("redirects on invalid booking id", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    const r = await clientLoader({
      request: new Request("http://localhost/disputes/new/bad"),
      params: { bookingId: "bad" },
    } as any);
    expect((r as Response).headers.get("Location")).toBe("/bookings");
  });

  it("returns booking for participant", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getBookingById.mockResolvedValue(booking);
    const r = await clientLoader({
      request: new Request("http://localhost/disputes/new/" + validId),
      params: { bookingId: validId },
    } as any);
    expect(r).toEqual({ booking });
  });

  it("returns booking for owner participants too", async () => {
    mocks.getUser.mockResolvedValue({ ...authUser, id: "owner1", role: "owner" });
    mocks.getBookingById.mockResolvedValue(booking);
    const r = await clientLoader({
      request: new Request("http://localhost/disputes/new/" + validId),
      params: { bookingId: validId },
    } as any);
    expect(r).toEqual({ booking });
  });

  it("accepts valid CUID booking ids", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getBookingById.mockResolvedValue({ ...booking, id: validCuid });
    const r = await clientLoader({
      request: new Request("http://localhost/disputes/new/" + validCuid),
      params: { bookingId: validCuid },
    } as any);
    expect(r).toEqual({ booking: { ...booking, id: validCuid } });
  });

  it("redirects non-participant", async () => {
    mocks.getUser.mockResolvedValue({ ...authUser, id: "stranger" });
    mocks.getBookingById.mockResolvedValue(booking);
    const r = await clientLoader({
      request: new Request("http://localhost/disputes/new/" + validId),
      params: { bookingId: validId },
    } as any);
    expect((r as Response).headers.get("Location")).toBe("/bookings");
  });
});

/* ================================================================== */
/*  clientAction                                                       */
/* ================================================================== */
describe("clientAction", () => {
  it("redirects unauthenticated", async () => {
    mocks.getUser.mockResolvedValue(null);
    const r = await clientAction({
      request: makeFormReq({ type: "OTHER" }),
      params: { bookingId: validId },
    } as any);
    expect((r as Response).headers.get("Location")).toBe("/auth/login");
  });

  it("rejects invalid bookingId UUID", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    const r = await clientAction({
      request: makeFormReq({ type: "OTHER" }),
      params: { bookingId: "bad" },
    } as any);
    expect((r as any).error).toMatch(/booking id/i);
  });

  it("rejects missing required fields", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    const r = await clientAction({
      request: makeFormReq({ intent: "create" }),
      params: { bookingId: validId },
    } as any);
    expect((r as any).error).toMatch(/required/i);
  });

  it("rejects invalid dispute type", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    const r = await clientAction({
      request: makeFormReq({
        type: "INVALID_TYPE",
        title: "Test",
        description: "Test description",
      }),
      params: { bookingId: validId },
    } as any);
    expect((r as any).error).toMatch(/invalid dispute type/i);
  });

  it("rejects negative amount", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    const r = await clientAction({
      request: makeFormReq({
        type: "PROPERTY_DAMAGE",
        title: "Damage",
        description: "Broken window",
        requestedAmount: "-100",
      }),
      params: { bookingId: validId },
    } as any);
    expect((r as any).error).toMatch(/valid positive number/i);
  });

  it("rejects amount exceeding max", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    const r = await clientAction({
      request: makeFormReq({
        type: "PROPERTY_DAMAGE",
        title: "Damage",
        description: "Broken window",
        requestedAmount: "2000000",
      }),
      params: { bookingId: validId },
    } as any);
    expect((r as any).error).toMatch(/too large/i);
  });

  it("rejects amount exceeding booking total", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getBookingById.mockResolvedValue({ ...booking, totalAmount: 100 });
    const r = await clientAction({
      request: makeFormReq({
        type: "PROPERTY_DAMAGE",
        title: "Damage",
        description: "Broken window",
        requestedAmount: "500",
      }),
      params: { bookingId: validId },
    } as any);
    expect((r as any).error).toMatch(/exceed booking total/i);
  });

  it("creates dispute successfully and redirects", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getBookingById.mockResolvedValue(booking);
    mocks.createDispute.mockResolvedValue({});
    const r = await clientAction({
      request: makeFormReq({
        type: "REFUND_REQUEST",
        title: "Refund please",
        description: "Item not as described",
        requestedAmount: "1000",
      }),
      params: { bookingId: validId },
    } as any);
    // Should redirect
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe(
      `/bookings/${validId}?disputeCreated=true`
    );
    expect(mocks.createDispute).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: validId,
        type: "REFUND_REQUEST",
        title: "Refund please",
        description: "Item not as described",
        amount: 1000,
      })
    );
  });

  it("allows owners to create disputes for their booking", async () => {
    mocks.getUser.mockResolvedValue({ id: "owner1", email: "owner@test.com", role: "owner" });
    mocks.getBookingById.mockResolvedValue(booking);
    mocks.createDispute.mockResolvedValue({});
    const r = await clientAction({
      request: makeFormReq({
        type: "MISSING_ITEMS",
        title: "Accessory missing",
        description: "The charger was not returned",
      }),
      params: { bookingId: validId },
    } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe(
      `/bookings/${validId}?disputeCreated=true`
    );
    expect(mocks.createDispute).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: validId,
        type: "MISSING_ITEMS",
        title: "Accessory missing",
      })
    );
  });

  it("handles API error", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getBookingById.mockResolvedValue(booking);
    mocks.createDispute.mockRejectedValue({
      response: { data: { message: "Duplicate dispute" } },
    });
    const r = await clientAction({
      request: makeFormReq({
        type: "OTHER",
        title: "Test",
        description: "Test description",
      }),
      params: { bookingId: validId },
    } as any);
    expect((r as any).error).toBe("Duplicate dispute");
  });
});
