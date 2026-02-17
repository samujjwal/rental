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

export const meta: MetaFunction = () => {
  return [{ title: "Checkout | GharBatai Rentals" }];
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value: string | undefined): value is string =>
  Boolean(value && UUID_PATTERN.test(value));
const MIN_STRIPE_CLIENT_SECRET_LENGTH = 20;
const safeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const safeDateLabel = (value: unknown, pattern: string): string => {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? "Date unavailable" : format(date, pattern);
};
const safeStatus = (value: unknown): string =>
  String(value || "").toUpperCase();
const safeText = (value: unknown): string =>
  typeof value === "string" ? value : "";
const safeTime = (value: unknown): number => {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? Number.NaN : date.getTime();
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
  if (!isUuid(bookingId)) {
    throw redirect("/bookings");
  }

  try {
    if (!stripePublishableKey) {
      throw redirect(`/bookings/${bookingId}`);
    }

    const booking = await bookingsApi.getBookingById(bookingId);
    const canAccessCheckout =
      booking.renterId === user.id || user.role === "admin";
    if (!canAccessCheckout) {
      throw redirect(`/bookings/${bookingId}`);
    }
    const normalizedStatus = safeStatus(booking.status);

    // Check if booking is in correct status for payment
    if (!["PENDING_PAYMENT", "PENDING", "PAYMENT_FAILED"].includes(normalizedStatus)) {
      throw redirect(`/bookings/${bookingId}`);
    }

    // Create payment intent
    const { clientSecret } = await paymentsApi.createPaymentIntent(bookingId);
    if (
      typeof clientSecret !== "string" ||
      clientSecret.trim().length < MIN_STRIPE_CLIENT_SECRET_LENGTH
    ) {
      throw redirect(`/bookings/${bookingId}`);
    }

    return {
      booking,
      clientSecret: clientSecret.trim(),
      stripePublishableKey,
    };
  } catch (error) {
    console.error("Failed to load checkout:", error);
    throw redirect("/bookings");
  }
}

export async function clientAction({ request, params }: ActionFunctionArgs) {
  const user = await getUser(request);
  if (!user) {
    return redirect("/auth/login");
  }

  const bookingId = params.bookingId;
  if (!isUuid(bookingId)) {
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
      !["PENDING_PAYMENT", "PENDING"].includes(normalizedStatus)
    ) {
      return { error: "This booking is no longer awaiting payment." };
    }

    if (intent === "confirm-payment") {
      // Payment confirmation is handled by Stripe on client-side
      // This action can be used for additional server-side validation
      return redirect(`/bookings/${bookingId}?payment=success`);
    }

    if (intent === "cancel") {
      return redirect(`/bookings/${bookingId}`);
    }

    return { error: "Invalid action" };
  } catch (error) {
    console.error("Checkout action error:", error);
    return { error: error instanceof Error ? error.message : "Payment failed" };
  }
}

function CheckoutForm({ booking }: { booking: Booking }) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const actionData = useActionData<typeof clientAction>();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const bookingId = safeText(booking.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}${bookingId ? `/bookings/${bookingId}?payment=success` : "/bookings"}`,
        },
      });

      if (error) {
        setErrorMessage(error.message || "Payment failed");
        setIsProcessing(false);
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Payment processing failed"
      );
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-card rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center text-foreground">
          <CreditCard className="w-5 h-5 mr-2" />
          Payment Information
        </h2>

        <PaymentElement />

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
          <span>Payments are secure and encrypted</span>
        </div>
      </div>

      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => navigate(bookingId ? `/bookings/${bookingId}` : "/bookings")}
          className="flex-1 px-6 py-3 border border-input rounded-md text-foreground hover:bg-muted transition-colors"
          disabled={isProcessing}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || isProcessing}
          className="flex-1 px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="w-5 h-5 mr-2" />
              Pay ${safeNumber(booking.totalAmount).toFixed(2)}
            </>
          )}
        </button>
      </div>
    </form>
  );
}

export default function CheckoutRoute() {
  const { booking, clientSecret } = useLoaderData<typeof clientLoader>();
  const navigate = useNavigate();
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
            Back to Booking
          </button>
          <h1 className="text-3xl font-bold text-foreground">Checkout</h1>
          <p className="mt-2 text-muted-foreground">
            Complete your booking payment
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-card rounded-lg shadow-md p-6 sticky top-6">
              <h2 className="text-lg font-semibold mb-4 text-foreground">
                Order Summary
              </h2>

              <div className="space-y-4">
                {/* Listing Info */}
                <div className="flex items-start">
                  <Package className="w-5 h-5 text-muted-foreground mr-3 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-foreground">
                      {booking.listing?.title || "Item"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {booking.listing?.location?.city || "Category"}
                    </p>
                  </div>
                </div>

                {/* Owner Info */}
                <div className="flex items-start">
                  <User className="w-5 h-5 text-muted-foreground mr-3 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Owner</p>
                    <p className="font-medium text-foreground">
                      {booking.owner
                        ? `${booking.owner.firstName}${
                            booking.owner.lastName
                              ? ` ${booking.owner.lastName}`
                              : ""
                          }`
                        : "Owner"}
                    </p>
                  </div>
                </div>

                {/* Dates */}
                <div className="flex items-start">
                  <Calendar className="w-5 h-5 text-muted-foreground mr-3 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">
                      Rental Period
                    </p>
                    <p className="font-medium text-foreground">
                      {safeDateLabel(startAt, "MMM d, yyyy")} -{" "}
                      {safeDateLabel(endAt, "MMM d, yyyy")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {bookingDays} days
                    </p>
                  </div>
                </div>

                {/* Pricing Breakdown */}
                <div className="border-t border-border pt-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="text-foreground">
                      ${safeNumber(pricing.subtotal).toFixed(2)}
                    </span>
                  </div>
                  {safeNumber(pricing.serviceFee) > 0 && (
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Service Fee</span>
                      <span className="text-foreground">
                        ${safeNumber(pricing.serviceFee).toFixed(2)}
                      </span>
                    </div>
                  )}
                  {safeNumber(pricing.deliveryFee) > 0 && (
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Delivery Fee</span>
                      <span className="text-foreground">
                        ${safeNumber(pricing.deliveryFee).toFixed(2)}
                      </span>
                    </div>
                  )}
                  {safeNumber(pricing.securityDeposit) > 0 && (
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">
                        Security Deposit
                      </span>
                      <span className="text-foreground">
                        ${safeNumber(pricing.securityDeposit).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
                    <span className="text-foreground">Total</span>
                    <span className="text-primary">
                      ${safeNumber(pricing.totalAmount).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Security Info */}
                <div className="bg-success/10 border border-success/20 rounded-md p-3">
                  <div className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-success mr-2 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-success">
                        Protected Payment
                      </p>
                      <p className="text-xs text-success/80 mt-1">
                        Your payment is secured by Stripe and protected by our
                        platform guarantee.
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
                    Payment setup failed. Please return to bookings and try again.
                  </p>
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
