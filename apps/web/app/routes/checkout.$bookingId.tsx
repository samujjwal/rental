import type {
  MetaFunction,
  LoaderFunctionArgs,
  ActionFunctionArgs,
} from "react-router";
import {
  useLoaderData,
  useNavigate,
  redirect,
  useActionData,
  useRevalidator,
} from "react-router";
import { useState } from "react";
import { RouteErrorBoundary } from "~/components/ui";
import {
  ArrowLeft,
  CreditCard,
  Lock,
  Calendar,
  Package,
  User,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { bookingsApi } from "~/lib/api/bookings";
import { paymentsApi } from "~/lib/api/payments";
import type { Booking } from "~/types/booking";
import { format } from "date-fns";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { getUser } from "~/utils/auth";
import { formatCurrency } from "~/lib/utils";
import { useTranslation } from "react-i18next";
import { isAppEntityId } from "~/utils/entity-id";
import { withTimeout } from "~/lib/async";
import { getActionableErrorMessage, ApiErrorType } from "~/lib/api-error";
import { UnifiedButton } from "~/components/ui";

export const meta: MetaFunction = () => {
  return [{ title: "Checkout | GharBatai Rentals" }];
};

const MIN_STRIPE_CLIENT_SECRET_LENGTH = 20;
const safeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const safeDateLabel = (value: unknown, pattern: string): string => {
  const date = typeof value === "number" ? new Date(value) : new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? "Date unavailable" : format(date, pattern);
};
const safeStatus = (value: unknown): string =>
  String(value || "").toUpperCase();
const safeText = (value: unknown): string =>
  typeof value === "string" ? value : "";
const safeTime = (value: unknown): number => {
  const date = typeof value === "number" ? new Date(value) : new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? Number.NaN : date.getTime();
};

const getCheckoutLoadError = (error: unknown): string => {
  const responseMessage =
    error &&
    typeof error === "object" &&
    "response" in error &&
    typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message === "string"
      ? String((error as { response?: { data?: { message?: string } } }).response?.data?.message)
      : null;

  if (responseMessage) {
    return responseMessage;
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You appear to be offline. Reconnect and try loading checkout again.";
  }

  return getActionableErrorMessage(error, "Unable to load checkout right now.", {
    [ApiErrorType.OFFLINE]: "You appear to be offline. Reconnect and try loading checkout again.",
    [ApiErrorType.TIMEOUT_ERROR]: "Loading checkout timed out. Try again.",
    [ApiErrorType.NETWORK_ERROR]: "We could not reach the payment service. Try again in a moment.",
  });
};

export const getCheckoutPaymentError = (
  error: unknown,
  fallbackMessage = "Payment failed"
): string => {
  const responseMessage =
    error &&
    typeof error === "object" &&
    "response" in error &&
    typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message === "string"
      ? String((error as { response?: { data?: { message?: string } } }).response?.data?.message)
      : null;

  if (responseMessage) {
    return responseMessage;
  }

  const directMessage =
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
      ? String((error as { message: string }).message).trim()
      : "";

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You are offline. Reconnect before submitting payment.";
  }

  const actionableMessage = getActionableErrorMessage(error, fallbackMessage, {
    [ApiErrorType.TIMEOUT_ERROR]:
      "Payment confirmation is taking longer than expected. Check your booking status before retrying to avoid duplicate charges.",
    [ApiErrorType.OFFLINE]:
      "You are offline. Reconnect before submitting payment.",
    [ApiErrorType.NETWORK_ERROR]:
      "We could not reach the payment service. Please try again.",
  });

  const genericMessages = new Set([
    "network error",
    "timeout",
    "payment failed",
    "payment processing failed",
  ]);

  if (directMessage && !genericMessages.has(directMessage.toLowerCase())) {
    return directMessage;
  }

  return actionableMessage;
};

// Load Stripe outside component to avoid recreating on every render
const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "";
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

export async function clientLoader({ params, request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  if (!user) {
    return redirect("/auth/login");
  }

  const bookingId = params.bookingId;
  if (!isAppEntityId(bookingId)) {
    throw redirect("/bookings");
  }

  try {
    const booking = await bookingsApi.getBookingById(bookingId);
    const canAccessCheckout =
      booking.renterId === user.id || user.role === "admin";
    if (!canAccessCheckout) {
      throw redirect(`/bookings/${bookingId}`);
    }
    const normalizedStatus = safeStatus(booking.status);

    // Check if booking is in correct status for payment
    if (!["PENDING_PAYMENT", "PAYMENT_FAILED"].includes(normalizedStatus)) {
      throw redirect(`/bookings/${bookingId}`);
    }

    if (!stripePublishableKey) {
      return {
        booking,
        clientSecret: null,
        stripePublishableKey,
        error: "Payment is temporarily unavailable right now. Please try again later.",
      };
    }

    try {
      const { clientSecret } = await paymentsApi.createPaymentIntent(bookingId);
      if (
        typeof clientSecret !== "string" ||
        clientSecret.trim().length < MIN_STRIPE_CLIENT_SECRET_LENGTH
      ) {
        return {
          booking,
          clientSecret: null,
          stripePublishableKey,
          error: "We could not prepare payment right now. Try again.",
        };
      }

      return {
        booking,
        clientSecret: clientSecret.trim(),
        stripePublishableKey,
      };
    } catch (error) {
      if (error instanceof Response) throw error;
      return {
        booking,
        clientSecret: null,
        stripePublishableKey,
        error: getCheckoutLoadError(error),
      };
    }
  } catch (error) {
    if (error instanceof Response) throw error;
    return {
      booking: null,
      clientSecret: null,
      stripePublishableKey,
      error: getCheckoutLoadError(error),
    };
  }
}

export async function clientAction({ request, params }: ActionFunctionArgs) {
  const user = await getUser(request);
  if (!user) {
    return redirect("/auth/login");
  }

  const bookingId = params.bookingId;
  if (!isAppEntityId(bookingId)) {
    return { error: "Booking ID is required" };
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const allowedIntents = new Set(["confirm-payment", "cancel"]);
  if (!allowedIntents.has(intent)) {
    return { error: "Invalid action" };
  }

  try {
    const booking = await bookingsApi.getBookingById(bookingId);
    const canAccessCheckout =
      booking.renterId === user.id || user.role === "admin";
    if (!canAccessCheckout) {
      return { error: "You are not authorized to update this checkout." };
    }
    const normalizedStatus = safeStatus(booking.status);
    if (
      intent === "confirm-payment" &&
      !["PENDING_PAYMENT"].includes(normalizedStatus)
    ) {
      return { error: "This booking is no longer awaiting payment." };
    }

    if (intent === "confirm-payment") {
      // F-35 fix: Verify that payment actually succeeded server-side before
      // redirecting to the success page.  Client-side Stripe callbacks can be
      // spoofed or replayed; the authoritative source is the payment status API.
      try {
        const paymentStatus = await paymentsApi.getBookingPaymentStatus(bookingId);
        const successStatuses = ['COMPLETED', 'SUCCEEDED', 'PAID', 'CAPTURED'];
        if (!successStatuses.includes(paymentStatus.paymentStatus?.toUpperCase?.())) {
          return { error: `Payment has not been completed (status: ${paymentStatus.paymentStatus}). Please try again.` };
        }
      } catch {
        return { error: 'Could not verify payment status. Please contact support.' };
      }
      return redirect(`/bookings/${bookingId}?payment=success`);
    }

    if (intent === "cancel") {
      // Actually cancel the booking so it doesn't remain in PENDING_PAYMENT state
      try {
        await bookingsApi.cancelBooking(bookingId, "Cancelled during checkout");
      } catch {
        // If cancel fails (e.g., booking already cancelled), still redirect
      }
      return redirect(`/bookings/${bookingId}`);
    }

    return { error: "Invalid action" };
  } catch (error) {
    return {
      error: getCheckoutPaymentError(error),
    };
  }
}

function CheckoutForm({ booking }: { booking: Booking }) {
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();
  // G4 fix: track whether the Stripe Elements iframe has finished loading.
  // Stripe's PaymentElement fires an onReady callback when the card form is mounted.
  const [stripeReady, setStripeReady] = useState(false);
  const navigate = useNavigate();
  const actionData = useActionData<typeof clientAction>();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const bookingId = safeText(booking.id);
  const paymentCtaDisabled = !stripe || !elements || !stripeReady || isProcessing;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements || !stripeReady) {
      setErrorMessage(
        t(
          "checkout.paymentFormLoading",
          "The payment form is still loading. Wait a moment and try again."
        )
      );
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const { error } = await withTimeout(
        stripe.confirmPayment({
          elements,
          confirmParams: {
            return_url: `${typeof window !== "undefined" ? window.location.origin : ""}${bookingId ? `/bookings/${bookingId}?payment=success` : "/bookings"}`,  
          },
        }),
        60_000,
        t(
          "checkout.paymentTimedOut",
          "Payment confirmation is taking longer than expected. Check your booking status before retrying to avoid duplicate charges."
        )
      );

      if (error) {
        setErrorMessage(getCheckoutPaymentError(error));
        setIsProcessing(false);
      }
    } catch (err) {
      setErrorMessage(getCheckoutPaymentError(err, t("checkout.paymentFailed", "Payment processing failed")));
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-card rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center text-foreground">
          <CreditCard className="w-5 h-5 mr-2" />
          {t("checkout.paymentInformation")}
        </h2>

        {/* G4 fix: skeleton shown while Stripe's iframe initialises (typically 1-3 s).
            PaymentElement fires onReady once the card fields are interactive. */}
        {!stripeReady && (
          <div className="space-y-3 animate-pulse" aria-hidden="true">
            <div className="h-12 rounded-md bg-muted" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-12 rounded-md bg-muted" />
              <div className="h-12 rounded-md bg-muted" />
            </div>
          </div>
        )}
        <PaymentElement
          onReady={() => setStripeReady(true)}
          className={stripeReady ? undefined : "hidden"}
        />

        {errorMessage && (
          <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-start">
            <AlertCircle className="w-5 h-5 text-destructive mr-2 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{errorMessage}</p>
          </div>
        )}

        {actionData?.error && (
          <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-start">
            <AlertCircle className="w-5 h-5 text-destructive mr-2 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{actionData.error}</p>
          </div>
        )}

        <div className="mt-6 flex items-center text-sm text-muted-foreground">
          <Lock className="w-4 h-4 mr-2" />
          <span>{t("checkout.paymentsSecure")}</span>
        </div>
      </div>

      <div className="flex gap-4">
        <UnifiedButton
          type="button"
          onClick={() => navigate(bookingId ? `/bookings/${bookingId}` : "/bookings")}
          variant="outline"
          fullWidth
          disabled={isProcessing}
        >
          {t("common.cancel")}
        </UnifiedButton>
        <UnifiedButton
          type="submit"
          disabled={paymentCtaDisabled}
          fullWidth
          loading={isProcessing}
        >
          {isProcessing ? (
            t("checkout.processing")
          ) : (
            <>
              <CreditCard className="w-5 h-5 mr-2" />
              {t("checkout.payAmount", { amount: formatCurrency(safeNumber(booking.totalAmount)) })}
            </>
          )}
        </UnifiedButton>
      </div>
    </form>
  );
}

export default function CheckoutRoute() {
  const { t } = useTranslation();
  const { booking, clientSecret, error } = useLoaderData<typeof clientLoader>();
  const navigate = useNavigate();
  const revalidator = useRevalidator();

  if (!booking) {
    return (
      <div className="min-h-screen bg-background py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-card rounded-lg shadow-md p-8 text-center space-y-4">
            <AlertCircle className="w-10 h-10 mx-auto text-muted-foreground" />
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">Checkout unavailable</h1>
              <p className="text-sm text-muted-foreground">
                {error || "Unable to load checkout right now."}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <UnifiedButton type="button" onClick={() => revalidator.revalidate()}>
                Try Again
              </UnifiedButton>
              <UnifiedButton
                type="button"
                variant="outline"
                onClick={() => navigate("/bookings")}
              >
                Back to Bookings
              </UnifiedButton>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const bookingId = safeText(booking.id);

  const startAt = safeTime(booking.startDate);
  const endAt = safeTime(booking.endDate);
  const bookingDaysRaw = (endAt - startAt) / (1000 * 60 * 60 * 24);
  const bookingDays = Number.isFinite(bookingDaysRaw)
    ? Math.max(0, Math.ceil(bookingDaysRaw))
    : 0;
  const pricing = booking.pricing || {
    subtotal: safeNumber(booking.subtotal),
    serviceFee: safeNumber(booking.serviceFee),
    deliveryFee: safeNumber(booking.deliveryFee),
    securityDeposit: safeNumber(booking.securityDeposit),
    totalAmount: safeNumber(booking.totalAmount),
  };

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate(bookingId ? `/bookings/${bookingId}` : "/bookings")}
            className="flex items-center text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            {t("checkout.backToBooking")}
          </button>
          <h1 className="text-3xl font-bold text-foreground">{t("checkout.title")}</h1>
          <p className="mt-2 text-muted-foreground">
            {t("checkout.subtitle")}
          </p>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-4">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-success flex items-center justify-center">
                <CheckCircle className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-medium text-success">{t("checkout.step1", "Request")}</span>
            </div>
            <div className="flex-1 h-px bg-success/40" />
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                <span className="text-xs font-bold text-primary-foreground">2</span>
              </div>
              <span className="text-sm font-medium text-primary">{t("checkout.step2", "Payment")}</span>
            </div>
            <div className="flex-1 h-px bg-muted" />
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                <span className="text-xs font-medium text-muted-foreground">3</span>
              </div>
              <span className="text-sm text-muted-foreground">{t("checkout.step3", "Confirmed")}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-card rounded-lg shadow-md p-6 sticky top-6">
              <h2 className="text-lg font-semibold mb-4 text-foreground">
                {t("checkout.orderSummary")}
              </h2>

              <div className="space-y-4">
                {/* Listing Info */}
                <div className="flex items-start">
                  <Package className="w-5 h-5 text-muted-foreground mr-3 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-foreground">
                      {booking.listing?.title || t("checkout.item")}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {booking.listing?.location?.city || t("listings.filters.category")}
                    </p>
                  </div>
                </div>

                {/* Owner Info */}
                <div className="flex items-start">
                  <User className="w-5 h-5 text-muted-foreground mr-3 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">{t("checkout.owner")}</p>
                    <p className="font-medium text-foreground">
                      {booking.owner
                        ? `${booking.owner.firstName}${
                            booking.owner.lastName
                              ? ` ${booking.owner.lastName}`
                              : ""
                          }`
                        : t("checkout.owner")}
                    </p>
                  </div>
                </div>

                {/* Dates */}
                <div className="flex items-start">
                  <Calendar className="w-5 h-5 text-muted-foreground mr-3 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">
                      {t("checkout.rentalPeriod")}
                    </p>
                    <p className="font-medium text-foreground">
                      {safeDateLabel(startAt, "MMM d, yyyy")} -{" "}
                      {safeDateLabel(endAt, "MMM d, yyyy")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t("checkout.daysCount", { count: bookingDays })}
                    </p>
                  </div>
                </div>

                {/* Pricing Breakdown */}
                <div className="border-t border-border pt-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">{t("checkout.subtotal")}</span>
                    <span className="text-foreground">
                      {formatCurrency(safeNumber(pricing.subtotal))}
                    </span>
                  </div>
                  {safeNumber(pricing.serviceFee) > 0 && (
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">{t("checkout.serviceFee")}</span>
                      <span className="text-foreground">
                        {formatCurrency(safeNumber(pricing.serviceFee))}
                      </span>
                    </div>
                  )}
                  {safeNumber(pricing.deliveryFee) > 0 && (
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">{t("checkout.deliveryFee")}</span>
                      <span className="text-foreground">
                        {formatCurrency(safeNumber(pricing.deliveryFee))}
                      </span>
                    </div>
                  )}
                  {safeNumber(pricing.securityDeposit) > 0 && (
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">
                        {t("checkout.securityDeposit")}
                      </span>
                      <span className="text-foreground">
                        {formatCurrency(safeNumber(pricing.securityDeposit))}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
                    <span className="text-foreground">{t("checkout.total")}</span>
                    <span className="text-primary">
                      {formatCurrency(safeNumber(pricing.totalAmount))}
                    </span>
                  </div>
                </div>

                {/* Security Info */}
                <div className="bg-success/10 border border-success/20 rounded-md p-3">
                  <div className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-success mr-2 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-success">
                        {t("checkout.protectedPayment")}
                      </p>
                      <p className="text-xs text-success/80 mt-1">
                        {t("checkout.protectedPaymentDesc")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Form */}
          <div className="lg:col-span-2">
            {clientSecret ? (
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <CheckoutForm booking={booking} />
              </Elements>
            ) : (
              <div className="bg-card rounded-lg shadow-md p-6">
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-start">
                  <AlertCircle className="w-5 h-5 text-destructive mr-2 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive">
                    {error || t("checkout.paymentSetupFailed")}
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <UnifiedButton type="button" onClick={() => revalidator.revalidate()}>
                    Try Again
                  </UnifiedButton>
                  <UnifiedButton
                    type="button"
                    variant="outline"
                    onClick={() => navigate(bookingId ? `/bookings/${bookingId}` : "/bookings")}
                  >
                    Back to Booking
                  </UnifiedButton>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };
