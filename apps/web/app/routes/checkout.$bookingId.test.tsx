import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  lucide-react                                                       */
/* ------------------------------------------------------------------ */
const IconStub = vi.hoisted(() => (props: any) => (
  <span data-testid="icon-stub" />
));
vi.mock("lucide-react", () => ({
  ArrowLeft: IconStub, CreditCard: IconStub, Lock: IconStub, Calendar: IconStub,
  Package: IconStub, User: IconStub, CheckCircle: IconStub, AlertCircle: IconStub,
  Loader2: IconStub,
}));

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */
const mocks: Record<string, any> = {
  getUser: vi.fn(),
  getBookingById: vi.fn(),
  createPaymentIntent: vi.fn(),
  redirect: vi.fn((url: string) => new Response(null, { status: 302, headers: { Location: url } })),
};

vi.mock("react-router", () => ({
  redirect: (...a: any[]) => mocks.redirect(...a),
  useLoaderData: () => ({}),
  useNavigate: () => vi.fn(),
  useActionData: () => null,
}));
vi.mock("~/utils/auth", () => ({ getUser: (...a: any[]) => mocks.getUser(...a) }));
vi.mock("~/lib/api/bookings", () => ({
  bookingsApi: { getBookingById: (...a: any[]) => mocks.getBookingById(...a) },
}));
vi.mock("~/lib/api/payments", () => ({
  paymentsApi: { createPaymentIntent: (...a: any[]) => mocks.createPaymentIntent(...a) },
}));
vi.mock("~/types/booking", () => ({}));
vi.mock("date-fns", () => ({ format: () => "2024-01-01" }));
vi.mock("@stripe/stripe-js", () => ({ loadStripe: () => null }));
vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: any) => <div>{children}</div>,
  PaymentElement: () => <div />,
  useStripe: () => null,
  useElements: () => null,
}));
vi.mock("~/components/ui", () => ({
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));

const validId = "11111111-1111-1111-8111-111111111111";
const validCuid = "ckx1234567890abcdefghijkl";

function makeFormReq(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return { formData: () => Promise.resolve(fd) } as unknown as Request;
}

const loadRouteModule = async () => import("./checkout.$bookingId");

const authUser = { id: "u1", role: "renter" };
const booking = { id: validId, renterId: "u1", ownerId: "o1", status: "PENDING_PAYMENT", totalAmount: 5000 };

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  vi.stubEnv("VITE_STRIPE_PUBLISHABLE_KEY", "pk_test_123");
});

/* ================================================================== */
/*  clientLoader                                                       */
/* ================================================================== */
describe("clientLoader", () => {
  it("loads checkout for pending payment bookings", async () => {
    const { clientLoader } = await loadRouteModule();
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getBookingById.mockResolvedValue(booking);
    mocks.createPaymentIntent.mockResolvedValue({
      clientSecret: "cs_test_abcdefghijklmnopqrstuvwxyz",
    });

    const result = (await clientLoader({
      request: new Request("http://localhost/checkout/" + validId),
      params: { bookingId: validId },
    } as any)) as any;

    expect(result.booking.id).toBe(validId);
    expect(result.clientSecret).toBe("cs_test_abcdefghijklmnopqrstuvwxyz");
    expect(mocks.createPaymentIntent).toHaveBeenCalledWith(validId);
  });

  it("allows retry checkout for payment-failed bookings", async () => {
    const { clientLoader } = await loadRouteModule();
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getBookingById.mockResolvedValue({ ...booking, status: "PAYMENT_FAILED" });
    mocks.createPaymentIntent.mockResolvedValue({
      clientSecret: "cs_test_retry_abcdefghijklmnopqrstuvwxyz",
    });

    const result = (await clientLoader({
      request: new Request("http://localhost/checkout/" + validId),
      params: { bookingId: validId },
    } as any)) as any;

    expect(result.booking.status).toBe("PAYMENT_FAILED");
    expect(result.clientSecret).toBe("cs_test_retry_abcdefghijklmnopqrstuvwxyz");
    expect(mocks.createPaymentIntent).toHaveBeenCalledWith(validId);
  });
});

/* ================================================================== */
/*  clientAction                                                       */
/* ================================================================== */
describe("clientAction", () => {
  it("redirects unauthenticated", async () => {
    const { clientAction } = await loadRouteModule();
    mocks.getUser.mockResolvedValue(null);
    const r = await clientAction({ request: makeFormReq({ intent: "confirm-payment" }), params: { bookingId: validId } } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/auth/login");
  });

  it("rejects invalid bookingId UUID", async () => {
    const { clientAction } = await loadRouteModule();
    mocks.getUser.mockResolvedValue(authUser);
    const r = await clientAction({ request: makeFormReq({ intent: "confirm-payment" }), params: { bookingId: "bad" } } as any);
    expect((r as any).error).toMatch(/booking id/i);
  });

  it("rejects unknown intent", async () => {
    const { clientAction } = await loadRouteModule();
    mocks.getUser.mockResolvedValue(authUser);
    const r = await clientAction({ request: makeFormReq({ intent: "hack" }), params: { bookingId: validId } } as any);
    expect((r as any).error).toBe("Invalid action");
  });

  it("blocks non-renter non-admin", async () => {
    const { clientAction } = await loadRouteModule();
    mocks.getUser.mockResolvedValue({ id: "stranger", role: "renter" });
    mocks.getBookingById.mockResolvedValue(booking);
    const r = await clientAction({ request: makeFormReq({ intent: "confirm-payment" }), params: { bookingId: validId } } as any);
    expect((r as any).error).toMatch(/not authorized/i);
  });

  it("blocks confirm-payment on wrong status", async () => {
    const { clientAction } = await loadRouteModule();
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getBookingById.mockResolvedValue({ ...booking, status: "COMPLETED" });
    const r = await clientAction({ request: makeFormReq({ intent: "confirm-payment" }), params: { bookingId: validId } } as any);
    expect((r as any).error).toMatch(/no longer awaiting/i);
  });

  it("redirects on successful confirm-payment", async () => {
    const { clientAction } = await loadRouteModule();
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getBookingById.mockResolvedValue(booking);
    const r = await clientAction({ request: makeFormReq({ intent: "confirm-payment" }), params: { bookingId: validId } } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe(`/bookings/${validId}?payment=success`);
  });

  it("accepts CUID booking ids", async () => {
    const { clientAction } = await loadRouteModule();
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getBookingById.mockResolvedValue({ ...booking, id: validCuid });
    const r = await clientAction({
      request: makeFormReq({ intent: "confirm-payment" }),
      params: { bookingId: validCuid },
    } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe(
      `/bookings/${validCuid}?payment=success`
    );
  });

  it("redirects on cancel", async () => {
    const { clientAction } = await loadRouteModule();
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getBookingById.mockResolvedValue(booking);
    const r = await clientAction({ request: makeFormReq({ intent: "cancel" }), params: { bookingId: validId } } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe(`/bookings/${validId}`);
  });

  it("handles API error", async () => {
    const { clientAction } = await loadRouteModule();
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getBookingById.mockRejectedValue(new Error("Booking not found"));
    const r = await clientAction({ request: makeFormReq({ intent: "confirm-payment" }), params: { bookingId: validId } } as any);
    expect((r as any).error).toBe("Booking not found");
  });
});
