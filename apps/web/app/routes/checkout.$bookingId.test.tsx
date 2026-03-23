import { AxiosError } from "axios";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

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
  getBookingPaymentStatus: vi.fn(),
  cancelBooking: vi.fn(),
  useLoaderData: vi.fn(() => ({})),
  useActionData: vi.fn(() => null),
  useRevalidator: vi.fn(() => ({ revalidate: vi.fn(), state: "idle" })),
  navigate: vi.fn(),
  redirect: vi.fn((url: string) => new Response(null, { status: 302, headers: { Location: url } })),
};

vi.mock("react-router", () => ({
  redirect: (...a: any[]) => mocks.redirect(...a),
  useLoaderData: () => mocks.useLoaderData(),
  useNavigate: () => mocks.navigate,
  useActionData: () => mocks.useActionData(),
  useRevalidator: () => mocks.useRevalidator(),
}));
vi.mock("~/utils/auth", () => ({ getUser: (...a: any[]) => mocks.getUser(...a) }));
vi.mock("~/lib/api/bookings", () => ({
  bookingsApi: {
    getBookingById: (...a: any[]) => mocks.getBookingById(...a),
    cancelBooking: (...a: any[]) => mocks.cancelBooking(...a),
  },
}));
vi.mock("~/lib/api/payments", () => ({
  paymentsApi: {
    createPaymentIntent: (...a: any[]) => mocks.createPaymentIntent(...a),
    getBookingPaymentStatus: (...a: any[]) => mocks.getBookingPaymentStatus(...a),
  },
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
  UnifiedButton: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrOptions?: unknown) =>
      typeof fallbackOrOptions === "string" ? fallbackOrOptions : key,
  }),
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
  mocks.getBookingPaymentStatus.mockResolvedValue({ paymentStatus: "PAID" });
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: true,
  });
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

  it("returns fallback loader data when payment setup times out", async () => {
    const { clientLoader } = await loadRouteModule();
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getBookingById.mockResolvedValue(booking);
    mocks.createPaymentIntent.mockRejectedValue(new AxiosError("timeout", "ECONNABORTED"));

    const result = (await clientLoader({
      request: new Request("http://localhost/checkout/" + validId),
      params: { bookingId: validId },
    } as any)) as any;

    expect(result).toEqual(
      expect.objectContaining({
        booking: expect.objectContaining({ id: validId }),
        clientSecret: null,
        error: "Loading checkout timed out. Try again.",
      })
    );
  });
});

describe("CheckoutRoute recovery UI", () => {
  it("renders retry UI when checkout data is unavailable", async () => {
    const { default: CheckoutRoute } = await loadRouteModule();
    const revalidate = vi.fn();
    mocks.useRevalidator.mockReturnValue({ revalidate, state: "idle" });
    mocks.useLoaderData.mockReturnValue({
      booking: null,
      clientSecret: null,
      error: "Loading checkout timed out. Try again.",
    });

    render(<CheckoutRoute />);

    expect(screen.getByText("Checkout unavailable")).toBeInTheDocument();
    expect(screen.getByText("Loading checkout timed out. Try again.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(revalidate).toHaveBeenCalledTimes(1);
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
    mocks.getBookingPaymentStatus.mockResolvedValue({ paymentStatus: "PAID" });
    const r = await clientAction({ request: makeFormReq({ intent: "confirm-payment" }), params: { bookingId: validId } } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe(`/bookings/${validId}?payment=success`);
  });

  it("accepts CUID booking ids", async () => {
    const { clientAction } = await loadRouteModule();
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getBookingById.mockResolvedValue({ ...booking, id: validCuid });
    mocks.getBookingPaymentStatus.mockResolvedValue({ paymentStatus: "CAPTURED" });
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
    mocks.cancelBooking.mockResolvedValue(undefined);
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

  it("returns timeout-specific payment copy", async () => {
    const { clientAction } = await loadRouteModule();
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getBookingById.mockRejectedValue(new AxiosError("timeout", "ECONNABORTED"));

    const r = await clientAction({
      request: makeFormReq({ intent: "confirm-payment" }),
      params: { bookingId: validId },
    } as any);

    expect((r as any).error).toBe(
      "Payment confirmation is taking longer than expected. Check your booking status before retrying to avoid duplicate charges."
    );
  });

  it("returns offline-specific payment copy", async () => {
    const previousOnline = navigator.onLine;
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });
    const { clientAction } = await loadRouteModule();
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getBookingById.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));

    const r = await clientAction({
      request: makeFormReq({ intent: "confirm-payment" }),
      params: { bookingId: validId },
    } as any);

    expect((r as any).error).toBe(
      "You are offline. Reconnect before submitting payment."
    );

    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: previousOnline,
    });
  });

  it("preserves backend payment errors", async () => {
    const { clientAction } = await loadRouteModule();
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getBookingById.mockRejectedValue({
      response: { data: { message: "Payment session already expired" } },
    });

    const r = await clientAction({
      request: makeFormReq({ intent: "confirm-payment" }),
      params: { bookingId: validId },
    } as any);

    expect((r as any).error).toBe("Payment session already expired");
  });

  it("keeps specific non-transport payment messages", async () => {
    const { getCheckoutPaymentError } = await loadRouteModule();

    expect(getCheckoutPaymentError({ message: "Your card was declined." })).toBe(
      "Your card was declined."
    );
  });

  it("maps network-style messages to actionable offline copy", async () => {
    const previousOnline = navigator.onLine;
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });
    const { getCheckoutPaymentError } = await loadRouteModule();

    expect(getCheckoutPaymentError({ message: "Network Error" })).toBe(
      "You are offline. Reconnect before submitting payment."
    );

    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: previousOnline,
    });
  });

  it("maps timeout payment errors to the shared recovery copy", async () => {
    const { getCheckoutPaymentError } = await loadRouteModule();

    expect(
      getCheckoutPaymentError(new AxiosError("timeout", "ECONNABORTED"))
    ).toBe(
      "Payment confirmation is taking longer than expected. Check your booking status before retrying to avoid duplicate charges."
    );
  });
});
