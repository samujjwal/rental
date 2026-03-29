import type {
  MetaFunction,
  LoaderFunctionArgs,
  ActionFunctionArgs,
} from "react-router";
import { RouteErrorBoundary } from "~/components/ui";
import { useLoaderData, useNavigate, useActionData, Form, useNavigation } from "react-router";
import { formatCurrency } from "~/lib/utils";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  MessageCircle,
  AlertCircle,
  FileText,
  Star,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { bookingsApi } from "~/lib/api/bookings";
import { paymentsApi } from "~/lib/api/payments";
import { reviewsApi } from "~/lib/api/reviews";
import { useAuthStore } from "~/lib/store/auth";
import { BookingStatus } from "~/lib/shared-types";
import { redirect, useRevalidator, useSearchParams } from "react-router";
import type { Booking } from "~/types/booking";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { getUser } from "~/utils/auth";
import { SuccessCelebration } from "~/components/animations/SuccessCelebration";
import { BookingStateMachine } from "~/components/bookings/BookingStateMachine";
import { useTranslation } from "react-i18next";
import { toast } from "~/lib/toast";
import { Dialog, DialogFooter, UnifiedButton } from "~/components/ui";
import { ApiErrorType, getActionableErrorMessage } from "~/lib/api-error";
import {
  STATUS_COLORS,
  PAYMENT_STATUS_COLORS,
  TIMELINE_STEPS,
} from "~/features/bookings/detail/booking-status-config";
import { useBookingModals } from "~/features/bookings/detail/useBookingModals";
import { useBookingActions } from "~/features/bookings/detail/useBookingActions";

type ViewerRole = "owner" | "renter" | "admin";

export const meta: MetaFunction = () => {
  return [{ title: "Booking Details | GharBatai Rentals" }];
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CUID_PATTERN = /^c[a-z0-9]{20,}$/i;
const isUuid = (value: string | undefined): value is string =>
  Boolean(value && (UUID_PATTERN.test(value) || CUID_PATTERN.test(value)));
const MAX_BOOKING_REASON_LENGTH = 1000;
const MAX_REVIEW_COMMENT_LENGTH = 1000;
const safeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const safeDateLabel = (value: unknown, pattern: string): string => {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? "Date unavailable" : format(date, pattern);
};
const safeText = (value: unknown, fallback = ""): string => {
  const text = typeof value === "string" ? value : "";
  return text || fallback;
};
const normalizeStatus = (status: unknown): string => {
  const raw = typeof status === "string" ? status : "";
  const upper = raw.toUpperCase();
  if (upper === BookingStatus.PENDING_OWNER_APPROVAL) return "pending_owner_approval";
  if (upper === BookingStatus.PENDING_PAYMENT) return "pending_payment";
  if (upper === BookingStatus.IN_PROGRESS) return "active";
  if (upper === BookingStatus.AWAITING_RETURN_INSPECTION) return "return_requested";
  if (upper === BookingStatus.CONFIRMED) return "confirmed";
  if (upper === BookingStatus.COMPLETED) return "completed";
  if (upper === BookingStatus.SETTLED) return "settled";
  if (upper === BookingStatus.CANCELLED) return "cancelled";
  if (upper === BookingStatus.DISPUTED) return "disputed";
  if (upper === BookingStatus.REFUNDED) return "refunded";
  if (upper === BookingStatus.PAYMENT_FAILED) return "payment_failed";
  if (upper === BookingStatus.PENDING) return "pending";
  return raw.toLowerCase();
};

const getFallbackTransitions = (
  normalizedStatus: string,
  viewerRole: ViewerRole
): string[] => {
  const isOwner = viewerRole === "owner";
  const isRenter = viewerRole === "renter";
  const isAdmin = viewerRole === "admin";

  switch (normalizedStatus) {
    case "pending_owner_approval":
      if (isOwner || isAdmin) return ["OWNER_APPROVE", "OWNER_REJECT"];
      if (isRenter) return ["CANCEL"];
      return [];
    case "pending_payment":
      if (isRenter || isAdmin) return ["COMPLETE_PAYMENT", "CANCEL"];
      return [];
    case "payment_failed":
      if (isRenter || isAdmin) return ["RETRY_PAYMENT"];
      return [];
    case "confirmed":
      if (isOwner || isAdmin) return ["START_RENTAL", "CANCEL", "INITIATE_DISPUTE"];
      if (isRenter) return ["CANCEL", "INITIATE_DISPUTE"];
      return [];
    case "active":
      if (isRenter || isAdmin) return ["REQUEST_RETURN", "INITIATE_DISPUTE"];
      if (isOwner) return ["INITIATE_DISPUTE"];
      return [];
    case "return_requested":
      if (isOwner || isAdmin) return ["APPROVE_RETURN", "REJECT_RETURN", "INITIATE_DISPUTE"];
      if (isRenter) return ["INITIATE_DISPUTE"];
      return [];
    case "completed":
    case "settled":
      if (isOwner || isRenter || isAdmin) return ["INITIATE_DISPUTE"];
      return [];
    default:
      return [];
  }
};

const getInitials = (firstName?: string, lastName?: string | null) => {
  const first = firstName?.[0] || "";
  const last = lastName?.[0] || "";
  return (first + last).toUpperCase() || "U";
};

const getStoredClientAuth = (): { user: { id: string; role: ViewerRole } | null; accessToken: string | null } => {
  if (typeof window === "undefined") {
    return { user: null, accessToken: null };
  }

  try {
    // F-39 fix: Use useAuthStore.getState() as the single source of truth
    // instead of directly parsing the localStorage persistence key.
    const { user: rawUser, accessToken } = useAuthStore.getState();

    const normalizedRole = (() => {
      const role = String(rawUser?.role || "").toUpperCase();
      if (role === "OWNER" || role === "HOST") return "owner" as const;
      if (role === "ADMIN" || role === "SUPER_ADMIN") return "admin" as const;
      return "renter" as const;
    })();

    return {
      accessToken: accessToken ?? null,
      user: rawUser?.id ? { id: rawUser.id, role: normalizedRole } : null,
    };
  } catch {
    return { user: null, accessToken: null };
  }
};

const getBookingDetailLoadError = (error: unknown): string => {
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
    return "You appear to be offline. Reconnect and try loading this booking again.";
  }

  return getActionableErrorMessage(error, "Unable to load this booking right now.", {
    [ApiErrorType.OFFLINE]: "You appear to be offline. Reconnect and try loading this booking again.",
    [ApiErrorType.TIMEOUT_ERROR]: "Loading this booking timed out. Try again.",
    [ApiErrorType.NETWORK_ERROR]: "We could not reach the booking service. Try again in a moment.",
  });
};

export async function clientLoader({ params, request }: LoaderFunctionArgs) {
  const storedAuth = getStoredClientAuth();
  const user = storedAuth.user ?? (await getUser(request));
  if (!user && !storedAuth.accessToken) {
    throw redirect("/auth/login");
  }

  const bookingId = params.id;
  if (!isUuid(bookingId)) {
    throw redirect("/bookings");
  }

  const activeUser = user ?? storedAuth.user;

  try {
    const booking = await bookingsApi.getBookingById(bookingId);
    const isParticipant =
      !!activeUser &&
      (booking.ownerId === activeUser.id ||
        booking.renterId === activeUser.id ||
        activeUser.role === "admin");
    if (!isParticipant) {
      throw redirect("/bookings");
    }
    const transitionResponse = await bookingsApi
      .getAvailableTransitions(bookingId)
      .catch(() => ({ availableTransitions: [] as string[] }));

    const viewerRole: ViewerRole =
      booking.ownerId === activeUser?.id
        ? "owner"
        : booking.renterId === activeUser?.id
          ? "renter"
          : "admin";

    return {
      booking,
      viewerRole,
      availableTransitions: transitionResponse.availableTransitions ?? [],
    };
  } catch (error) {
    if (error instanceof Response) throw error; // re-throw redirects
    return {
      booking: null,
      viewerRole: activeUser?.role ?? "renter",
      availableTransitions: [],
      error: getBookingDetailLoadError(error),
    };
  }
}

clientLoader.hydrate = true;

export async function clientAction({ request, params }: ActionFunctionArgs) {
  const currentUser = await getUser(request);
  if (!currentUser) {
    return redirect("/auth/login");
  }

  const bookingId = params.id;
  if (!isUuid(bookingId)) {
    return { error: "Booking ID is required" };
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const allowedIntents = new Set([
    "confirm",
    "reject",
    "cancel",
    "start",
    "request_return",
    "complete",
    "reject_return",
    "review",
  ]);
  if (!allowedIntents.has(intent)) {
    return { error: "Invalid action" };
  }

  try {
    const booking = await bookingsApi.getBookingById(bookingId);
    const status = normalizeStatus(booking.status);
    const isOwner = booking.ownerId === currentUser.id;
    const isRenter = booking.renterId === currentUser.id;
    const isAdmin = currentUser.role === "admin";

    if (!isOwner && !isRenter && !isAdmin) {
      return { error: "You are not authorized to modify this booking." };
    }

    switch (intent) {
      case "confirm":
        if (!(isOwner || isAdmin) || status !== "pending_owner_approval") {
          return { error: "Booking cannot be confirmed in its current state." };
        }
        await bookingsApi.approveBooking(bookingId);
        return { success: "Booking confirmed successfully" };
      case "reject":
        {
          if (!(isOwner || isAdmin) || status !== "pending_owner_approval") {
            return { error: "Booking cannot be rejected in its current state." };
          }
          const reason = String(formData.get("reason") || "")
            .trim()
            .slice(0, MAX_BOOKING_REASON_LENGTH);
          if (!reason) {
            return { error: "Rejection reason is required" };
          }
          await bookingsApi.rejectBooking(bookingId, reason);
          return { success: "Booking declined successfully" };
        }
      case "cancel":
        {
          if (
            !(isOwner || isRenter || isAdmin) ||
            !["confirmed", "pending_owner_approval", "pending_payment"].includes(status)
          ) {
            return { error: "Booking cannot be cancelled in its current state." };
          }
          const reason = String(formData.get("reason") || "")
            .trim()
            .slice(0, MAX_BOOKING_REASON_LENGTH);
          if (!reason) {
            return { error: "Cancellation reason is required" };
          }
          await bookingsApi.cancelBooking(bookingId, reason);
          return redirect("/bookings");
        }
      case "start":
        if (!(isOwner || isAdmin) || status !== "confirmed") {
          return { error: "Booking cannot be started in its current state." };
        }
        await bookingsApi.startBooking(bookingId);
        return { success: "Booking started" };
      case "request_return":
        if (!(isRenter || isAdmin) || status !== "active") {
          return { error: "Return cannot be requested in current booking state." };
        }
        await bookingsApi.requestReturn(bookingId);
        return { success: "Return requested" };
      case "complete":
        if (!(isOwner || isAdmin) || status !== "return_requested") {
          return { error: "Booking cannot be completed in its current state." };
        }
        await bookingsApi.approveReturn(bookingId);
        return { success: "Booking marked as complete" };
      case "reject_return":
        {
          if (!(isOwner || isAdmin) || status !== "return_requested") {
            return { error: "Return cannot be rejected in current booking state." };
          }
          const reason = String(formData.get("reason") || "")
            .trim()
            .slice(0, MAX_BOOKING_REASON_LENGTH);
          if (!reason) {
            return { error: "A reason is required to report damage." };
          }
          await bookingsApi.rejectReturn(bookingId, reason);
          return { success: "Return rejected — dispute initiated" };
        }
      case "review":
        {
          if (!["completed", "settled"].includes(status)) {
            return { error: "Reviews can only be submitted after completion." };
          }
          if (booking.review) {
            return { error: "You have already submitted a review for this booking." };
          }
          const overallRating = Number(formData.get("rating"));
          const comment = String(formData.get("comment") || "")
            .trim()
            .slice(0, MAX_REVIEW_COMMENT_LENGTH);
          if (!Number.isFinite(overallRating) || overallRating < 1 || overallRating > 5) {
            return { error: "Rating must be between 1 and 5" };
          }
          if (!comment) {
            return { error: "Review comment is required" };
          }
          const reviewType: "OWNER_TO_RENTER" | "RENTER_TO_OWNER" =
            isOwner ? "OWNER_TO_RENTER" : "RENTER_TO_OWNER";
          await reviewsApi.createReview({
            bookingId,
            reviewType,
            overallRating,
            comment,
          });
          return { success: "Review submitted successfully" };
        }
      default:
        return { error: "Invalid action" };
    }
  } catch (error: unknown) {
    const responseMessage =
      error &&
      typeof error === "object" &&
      "response" in error &&
      typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message === "string"
        ? String((error as { response?: { data?: { message?: string } } }).response?.data?.message)
        : null;

    return {
      error: responseMessage || getActionableErrorMessage(error, "Action failed", {
        [ApiErrorType.CONFLICT]: "This booking changed while you were working. We refreshed the state. Please review the latest status and try again.",
        [ApiErrorType.TIMEOUT_ERROR]: "This action is taking longer than expected. Refresh the booking to confirm the latest state before retrying.",
        [ApiErrorType.OFFLINE]: "You are offline. Reconnect and try the booking action again.",
        [ApiErrorType.NETWORK_ERROR]: "We could not reach the server. Try again in a moment.",
        [ApiErrorType.UNKNOWN_ERROR]: "Action failed",
      }),
    };
  }
}


export default function BookingDetail() {
  const { t } = useTranslation();
  const { booking, availableTransitions = [], viewerRole, error } = useLoaderData<{
    booking: Booking | null;
    availableTransitions?: string[];
    viewerRole: ViewerRole;
    error?: string;
  }>();
  const actionData = useActionData<{ success?: string; error?: string }>();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';
  const [searchParams] = useSearchParams();
  const revalidator = useRevalidator();

  const {
    showCancelModal, setShowCancelModal,
    cancelReason, setCancelReason,
    cancelIntent, setCancelIntent,
    showReviewModal, setShowReviewModal,
    rating, setRating,
    review, setReview,
    resetModals,
  } = useBookingModals();

  const { handleStateAction } = useBookingActions({
    navigate,
    setCancelIntent,
    setShowCancelModal,
    setShowReviewModal,
  });

  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [paymentVerifyTimedOut, setPaymentVerifyTimedOut] = useState(false);
  const [paymentRecoveryState, setPaymentRecoveryState] = useState<
    "action_required" | "failed" | null
  >(null);
  const [paymentRecoveryMessage, setPaymentRecoveryMessage] = useState("");

  // Show toast for action results and reset modals on success
  useEffect(() => {
    if (actionData?.success) {
      toast.success(actionData.success);
      resetModals();
      revalidator.revalidate();
    }
    if (actionData?.error) toast.error(actionData.error);
  }, [actionData, revalidator, resetModals]);

  useEffect(() => {
    if (!booking) {
      return;
    }

    const normalizedBookingStatus = normalizeStatus(booking.status);
    const paymentSuccess = searchParams.get("payment") === "success";
    const needsVerification =
      normalizedBookingStatus === "pending_payment" ||
      String(booking.paymentStatus).toUpperCase() === "PENDING";

    if (paymentSuccess && needsVerification) {
      setIsVerifyingPayment(true);
      setPaymentVerifyTimedOut(false);
      setPaymentRecoveryState(null);
      setPaymentRecoveryMessage("");

      let isActive = true;

      const checkPaymentStatus = async () => {
        try {
          const paymentStatus = await paymentsApi.getBookingPaymentStatus(booking.id);
          if (!isActive) {
            return true;
          }

          if (paymentStatus.confirmationState === "confirmed") {
            setIsVerifyingPayment(false);
            setPaymentVerifyTimedOut(false);
            setPaymentRecoveryState(null);
            setPaymentRecoveryMessage("");
            setShowCelebration(true);
            return true;
          }

          if (paymentStatus.confirmationState === "action_required") {
            setIsVerifyingPayment(false);
            setPaymentVerifyTimedOut(false);
            setPaymentRecoveryState("action_required");
            setPaymentRecoveryMessage(
              t(
                "bookings.details.paymentActionRequiredDesc",
                "Complete the additional verification requested by your payment provider, then return here to finish confirming the booking."
              )
            );
            return true;
          }

          if (paymentStatus.confirmationState === "failed") {
            setIsVerifyingPayment(false);
            setPaymentVerifyTimedOut(false);
            setPaymentRecoveryState("failed");
            setPaymentRecoveryMessage(
              paymentStatus.failureReason ||
                t(
                  "bookings.details.paymentFailedDesc",
                  "Your payment could not be confirmed. Please retry the payment to keep your booking."
                )
            );
            return true;
          }
        } catch {
          // Fall back to the loader refresh and timeout banner below.
        }

        revalidator.revalidate();
        return false;
      };

      let pollTimeout: ReturnType<typeof setTimeout> | null = null;

      const clearPollTimeout = () => {
        if (pollTimeout !== null) {
          clearTimeout(pollTimeout);
          pollTimeout = null;
        }
      };

      const pollPaymentStatus = async () => {
        const done = await checkPaymentStatus();
        if (!done && isActive) {
          pollTimeout = setTimeout(() => {
            void pollPaymentStatus();
          }, 2000);
        }
      };

      void pollPaymentStatus();

      const timeout = setTimeout(() => {
        clearPollTimeout();
        if (!isActive) return;
        setIsVerifyingPayment(false);
        setPaymentVerifyTimedOut(true);
      }, 30000);

      return () => {
        isActive = false;
        clearPollTimeout();
        clearTimeout(timeout);
      };
    } else if (normalizedBookingStatus === "confirmed" && isVerifyingPayment) {
      setIsVerifyingPayment(false);
      setPaymentVerifyTimedOut(false);
      setShowCelebration(true);
    }
  }, [booking, searchParams, revalidator, isVerifyingPayment, t]);

  if (!booking) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-card rounded-lg shadow-md p-8 text-center space-y-4">
            <AlertCircle className="w-10 h-10 mx-auto text-muted-foreground" />
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">Booking unavailable</h1>
              <p className="text-sm text-muted-foreground">
                {error || "Unable to load this booking right now."}
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

  const normalizedStatus = normalizeStatus(booking.status);
  const fallbackTransitions = getFallbackTransitions(normalizedStatus, viewerRole);
  const transitionSet = new Set(
    availableTransitions.length > 0 ? availableTransitions : fallbackTransitions
  );
  const listingTitle = safeText(booking.listing?.title, "Listing");
  const listingId = safeText(booking.listing?.id);
  const listingDescription = safeText(booking.listing?.description, "No description available.");
  const listingCity = safeText(booking.listing?.location?.city, "Location unavailable");
  const renterFirstName = safeText(booking.renter?.firstName, "Renter");
  const renterLastName = safeText(booking.renter?.lastName);
  const ownerFirstName = safeText(booking.owner?.firstName, "Owner");
  const ownerLastName = safeText(booking.owner?.lastName);
  const reviewRating = safeNumber(booking.review?.rating);
  const reviewComment = safeText(booking.review?.comment, "No review comment provided.");
  const pricing = booking.pricing || {
    subtotal: safeNumber(booking.subtotal),
    serviceFee: safeNumber(booking.serviceFee),
    deliveryFee: safeNumber(booking.deliveryFee),
    securityDeposit: safeNumber(booking.securityDeposit),
    totalAmount: safeNumber(booking.totalPrice ?? booking.totalAmount),
  };

  const isOwner = viewerRole === "owner";
  const isRenter = viewerRole === "renter";
  const isAdmin = viewerRole === "admin";
  const userRole = viewerRole;
  const messageParticipantId = safeText(isOwner ? booking.renterId : booking.ownerId);

  const normalizedPaymentStatus = String(booking.paymentStatus || "").toLowerCase();
  const canConfirm = transitionSet.has("OWNER_APPROVE");
  const canReject = transitionSet.has("OWNER_REJECT");
  const canCancel = transitionSet.has("CANCEL");
  const canStart = transitionSet.has("START_RENTAL");
  const canComplete = transitionSet.has("APPROVE_RETURN");
  const canRejectReturn = transitionSet.has("REJECT_RETURN");
  const canRequestReturn = transitionSet.has("REQUEST_RETURN");
  const canPay =
    transitionSet.has("COMPLETE_PAYMENT") || transitionSet.has("RETRY_PAYMENT");
  const canDispute =
    transitionSet.has("INITIATE_DISPUTE") ||
    ((isOwner || isRenter || isAdmin) &&
      ["confirmed", "active", "return_requested", "completed", "settled"].includes(
        normalizedStatus
      ));
  const canReview =
    (isOwner || isRenter) &&
    ["completed", "settled"].includes(normalizedStatus) &&
    !booking.review;
  const bookingDaysRaw =
    (new Date(String(booking.endDate || "")).getTime() -
      new Date(String(booking.startDate || "")).getTime()) /
    (1000 * 60 * 60 * 24);
  const bookingDays = Number.isFinite(bookingDaysRaw)
    ? Math.max(0, Math.ceil(bookingDaysRaw))
    : 0;

  const currentStepIndex = TIMELINE_STEPS.findIndex(
    (step) => step.status === normalizedStatus
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Success Celebration */}
      <SuccessCelebration
        show={showCelebration}
        title="Booking Confirmed!"
        message="Your payment was processed successfully. The owner will be notified and your rental is confirmed."
        onClose={() => setShowCelebration(false)}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate("/bookings")}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('bookings.backToBookings', 'Back to Bookings')}
          </button>
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[normalizedStatus] || "bg-muted text-muted-foreground"}`}
            >
              {normalizedStatus.replace(/_/g, " ").toUpperCase()}
            </span>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${PAYMENT_STATUS_COLORS[normalizedPaymentStatus] || "bg-muted text-muted-foreground"}`}
            >
              {t('bookings.details.paymentLabel', 'Payment')}: {normalizedPaymentStatus}
            </span>
          </div>
        </div>
        {/* Payment Verification Banner */}
        {isVerifyingPayment && (
          <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-4 rounded-lg flex items-center gap-3 animate-pulse">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <div>
              <p className="font-semibold">{t('bookings.details.verifyingPayment', 'Verifying your payment...')}</p>
              <p className="text-sm">
                {t('bookings.details.verifyingPaymentDesc', 'Please wait while we confirm your transaction with the payment provider. This usually takes a few seconds.')}
              </p>
            </div>
          </div>
        )}

        {/* Payment verification timed out — recovery guidance */}
        {paymentVerifyTimedOut && (
          <div className="mb-6 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-4 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">{t('bookings.details.paymentPendingConfirmation', 'Payment received — confirmation taking longer than expected')}</p>
              <p className="text-sm mt-1">
                {t('bookings.details.paymentPendingDesc', 'Your payment was submitted. Confirmation may take a few more minutes to process. You can refresh this page to check the latest status, or contact support if it hasn\'t confirmed within 10 minutes.')}
              </p>
            </div>
            <button
              onClick={() => { setPaymentVerifyTimedOut(false); revalidator.revalidate(); }}
              className="shrink-0 px-3 py-1.5 text-sm font-medium border border-amber-400 rounded-md hover:bg-amber-100 transition-colors"
            >
              {t('common.refresh', 'Refresh')}
            </button>
          </div>
        )}

        {paymentRecoveryState === "action_required" && (
          <div className="mb-6 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-4 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">
                {t(
                  "bookings.details.paymentActionRequired",
                  "Additional payment verification is still required"
                )}
              </p>
              <p className="text-sm mt-1">{paymentRecoveryMessage}</p>
            </div>
          </div>
        )}

        {paymentRecoveryState === "failed" && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-4 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">
                {t("bookings.details.paymentFailedTitle", "Payment confirmation failed")}
              </p>
              <p className="text-sm mt-1">{paymentRecoveryMessage}</p>
            </div>
          </div>
        )}

        {/* Success/Error Messages */}
        {actionData?.success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            {actionData.success}
          </div>
        )}
        {actionData?.error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <XCircle className="w-5 h-5" />
            {actionData.error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Booking Progress Stepper */}
            <div className="bg-card rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-foreground mb-6">
                {t('bookings.details.bookingTimeline', 'Booking Progress')}
              </h2>
              <BookingStateMachine
                currentStatus={booking.status}
                userRole={userRole}
                bookingId={booking.id}
                onStateAction={handleStateAction}
                showInlineActions={false}
              />
            </div>

            {/* Listing Details */}
            <div className="bg-card rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-foreground mb-4">
                {t('bookings.details.listingDetails', 'Listing Details')}
              </h2>
              <div className="flex gap-4">
                {booking.listing?.images?.[0] && (
                  <img
                    src={booking.listing.images[0]}
                    alt={listingTitle}
                    className="w-32 h-32 object-cover rounded-lg"
                  />
                )}
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {listingTitle}
                  </h3>
                  <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
                    {listingDescription}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {listingCity}
                    </span>
                      <span className="flex items-center gap-1">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        {safeNumber(booking.listing?.rating) > 0
                          ? safeNumber(booking.listing?.rating).toFixed(1)
                          : "N/A"}
                      </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Booking Information */}
            <div className="bg-card rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-foreground mb-4">
                {t('bookings.details.bookingInformation', 'Booking Information')}
              </h2>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <Calendar className="w-5 h-5" />
                    <span className="font-medium">{t('bookings.details.rentalPeriod', 'Rental Period')}</span>
                  </div>
                  <p className="text-foreground">
                    {safeDateLabel(booking.startDate, "MMM d, yyyy")} -{" "}
                    {safeDateLabel(booking.endDate, "MMM d, yyyy")}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {bookingDays} {t('bookings.details.days')}
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <Package className="w-5 h-5" />
                    <span className="font-medium">{t('listings.detail.deliveryMethod', 'Delivery Method')}</span>
                  </div>
                  <p className="text-foreground capitalize">
                    {booking.deliveryMethod}
                  </p>
                  {booking.deliveryAddress && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {booking.deliveryAddress}
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <Clock className="w-5 h-5" />
                    <span className="font-medium">{t('bookings.details.bookingDate', 'Booking Date')}</span>
                  </div>
                  <p className="text-foreground">
                    {safeDateLabel(booking.createdAt, "MMM d, yyyy h:mm a")}
                  </p>
                </div>

                {booking.specialRequests && (
                  <div>
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <FileText className="w-5 h-5" />
                      <span className="font-medium">{t('bookings.details.specialRequests', 'Special Requests')}</span>
                    </div>
                    <p className="text-foreground text-sm">
                      {booking.specialRequests}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Details */}
            <div className="bg-card rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-foreground mb-4">
                {t('bookings.details.paymentDetails', 'Payment Details')}
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between text-muted-foreground">
                  <span>{t('bookings.details.rentalAmount', 'Rental Amount')}</span>
                  <span className="font-medium">
                    {formatCurrency(safeNumber(pricing.subtotal))}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>{t('bookings.details.serviceFee')}</span>
                  <span className="font-medium">
                    {formatCurrency(safeNumber(pricing.serviceFee))}
                  </span>
                </div>
                {safeNumber(pricing.deliveryFee) > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t('listings.detail.deliveryFee', 'Delivery Fee')}</span>
                    <span className="font-medium">
                      {formatCurrency(safeNumber(pricing.deliveryFee))}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span>{t('listings.detail.securityDeposit')}</span>
                  <span className="font-medium">
                    {formatCurrency(safeNumber(pricing.securityDeposit))}
                  </span>
                </div>
                <div className="border-t pt-3 flex justify-between text-lg font-bold text-foreground">
                  <span>{t('bookings.details.totalPaid', 'Total Paid')}</span>
                  <span>{formatCurrency(safeNumber(pricing.totalAmount))}</span>
                </div>
              </div>

              {String(booking.paymentStatus).toUpperCase() === "PAID" && (
                <div className="mt-4 flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span>{t('bookings.details.paymentCompleted', 'Payment completed')}</span>
                </div>
              )}
            </div>

            {/* Review Section */}
            {booking.review && (
              <div className="bg-card rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-foreground mb-4">{t('bookings.details.review', 'Review')}</h2>
                <div className="flex items-center gap-1 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-5 h-5 ${
                        i < reviewRating
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted"
                      }`}
                    />
                  ))}
                  <span className="ml-2 text-muted-foreground">
                    {reviewRating.toFixed(1)} {t('bookings.details.outOf', 'out of')} 5
                  </span>
                </div>
                <p className="text-foreground">{reviewComment}</p>
                <p className="text-sm text-muted-foreground mt-3">
                  {t('bookings.details.reviewedOn', 'Reviewed on')}{" "}
                  {safeDateLabel(booking.review.createdAt, "MMM d, yyyy")}
                </p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Other Party Information */}
            <div className="bg-card rounded-lg shadow-md p-6">
              <h2 className="text-lg font-bold text-foreground mb-4">
                {isOwner ? t('bookings.renter', 'Renter') : t('listings.detail.owner', 'Owner')} {t('bookings.details.information', 'Information')}
              </h2>
              <div className="flex items-center gap-3 mb-4">
                {isOwner ? (
                  <>
                    {booking.renter?.avatar ? (
                      <img
                        src={booking.renter.avatar}
                        alt={renterFirstName}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-foreground">
                        {getInitials(renterFirstName, renterLastName)}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-foreground">
                        {renterFirstName}{renterLastName ? ` ${renterLastName}` : ""}
                      </p>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm text-muted-foreground">
                          {safeNumber(booking.renter.rating) > 0
                            ? safeNumber(booking.renter.rating).toFixed(1)
                            : "New"}
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {booking.owner?.avatar ? (
                      <img
                        src={booking.owner.avatar}
                        alt={ownerFirstName}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-foreground">
                        {getInitials(ownerFirstName, ownerLastName)}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-foreground">
                        {ownerFirstName}{ownerLastName ? ` ${ownerLastName}` : ""}
                      </p>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm text-muted-foreground">
                          {safeNumber(booking.owner.rating) > 0
                            ? safeNumber(booking.owner.rating).toFixed(1)
                            : "New"}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={() => navigate(`/messages?booking=${booking.id}`)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-background"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{t('bookings.actions.sendMessage', 'Send Message')}</span>
              </button>
            </div>

            {/* Next Required Action Banner */}
            {(() => {
              let banner: { icon: React.ReactNode; title: string; desc: string; variant: 'green' | 'blue' | 'amber' | 'red' | 'purple' } | null = null;
              if (canConfirm) {
                banner = { icon: <CheckCircle className="w-5 h-5" />, title: t('bookings.nextAction.confirmTitle', 'Action Required: Confirm or Reject'), desc: t('bookings.nextAction.confirmDesc', 'A renter is waiting. Review their request and confirm or reject below.'), variant: 'green' };
              } else if (!isOwner && normalizedStatus === 'pending_payment') {
                banner = { icon: <CheckCircle className="w-5 h-5" />, title: t('bookings.nextAction.payTitle', 'Complete Payment to Secure Your Booking'), desc: t('bookings.nextAction.payDesc', 'Your booking is reserved but not confirmed until payment is completed.'), variant: 'green' };
              } else if (!isOwner && normalizedStatus === 'payment_failed') {
                banner = { icon: <AlertCircle className="w-5 h-5" />, title: t('bookings.nextAction.retryTitle', 'Payment Failed — Retry Now'), desc: t('bookings.nextAction.retryDesc', 'Your payment did not go through. Retry to keep your booking.'), variant: 'red' };
              } else if (isOwner && normalizedStatus === 'confirmed') {
                banner = { icon: <CheckCircle className="w-5 h-5" />, title: t('bookings.nextAction.startTitle', 'Ready to Hand Over?'), desc: t('bookings.nextAction.startDesc', "When you've handed the item to the renter, mark the rental as started."), variant: 'blue' };
              } else if (!isOwner && normalizedStatus === 'active') {
                banner = { icon: <FileText className="w-5 h-5" />, title: t('bookings.nextAction.returnTitle', 'Done Using It? Request Return'), desc: t('bookings.nextAction.returnDesc', 'When you are finished, submit a return request so the owner can approve it.'), variant: 'amber' };
              } else if (isOwner && normalizedStatus === 'return_requested') {
                banner = { icon: <CheckCircle className="w-5 h-5" />, title: t('bookings.nextAction.inspectTitle', 'Inspect & Approve the Return'), desc: t('bookings.nextAction.inspectDesc', 'The renter has returned the item. Inspect it and confirm the return below.'), variant: 'green' };
              } else if (canReview) {
                banner = { icon: <Star className="w-5 h-5" />, title: t('bookings.nextAction.reviewTitle', 'Share Your Experience'), desc: t('bookings.nextAction.reviewDesc', 'Leave a review to help the community and complete your rental.'), variant: 'purple' };
              }
              if (!banner) return null;
              const colorMap = {
                green: 'bg-green-50 border-green-300 text-green-900',
                blue: 'bg-blue-50 border-blue-300 text-blue-900',
                amber: 'bg-amber-50 border-amber-300 text-amber-900',
                red: 'bg-red-50 border-red-300 text-red-900',
                purple: 'bg-purple-50 border-purple-300 text-purple-900',
              };
              const iconColorMap = {
                green: 'text-green-600', blue: 'text-blue-600', amber: 'text-amber-600', red: 'text-red-600', purple: 'text-purple-600',
              };
              return (
                <div className={`border rounded-lg p-4 ${colorMap[banner.variant]}`}>
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 flex-shrink-0 ${iconColorMap[banner.variant]}`}>{banner.icon}</span>
                    <div>
                      <p className="font-semibold text-sm">{banner.title}</p>
                      <p className="text-xs mt-0.5 opacity-80">{banner.desc}</p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Actions */}
            <div className="bg-card rounded-lg shadow-md p-6">
              <h2 className="text-lg font-bold text-foreground mb-4">{t('bookings.details.actions', 'Actions')}</h2>
              <div className="space-y-3">
                {/* Pay Now / Retry Payment */}
                {isRenter && canPay && ["pending_payment", "payment_failed"].includes(normalizedStatus) && (
                  <button
                    onClick={() => navigate(`/checkout/${booking.id}`)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold text-base"
                  >
                    <CheckCircle className="w-5 h-5" />
                    <span>{normalizedStatus === "payment_failed"
                      ? t('bookings.actions.retryPayment', 'Retry Payment')
                      : t('bookings.details.payNow', 'Pay Now')}</span>
                  </button>
                )}

                {canDispute && (
                  <button
                    onClick={() => navigate(`/disputes/new/${booking.id}`)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50"
                  >
                    <AlertCircle className="w-4 h-4" />
                    <span>{t('bookings.actions.fileDispute', 'File a Dispute')}</span>
                  </button>
                )}

                {canConfirm && (
                  <Form method="post">
                    <input type="hidden" name="intent" value="confirm" />
                    <UnifiedButton
                      type="submit"
                      disabled={isSubmitting}
                      loading={isSubmitting}
                      className="w-full font-semibold text-base"
                    >
                            {!isSubmitting ? <CheckCircle className="w-5 h-5" /> : null}
                      <span>{t('bookings.actions.confirmBooking', 'Confirm Booking')}</span>
                          </UnifiedButton>
                  </Form>
                )}

                {canStart && (
                  <Form method="post">
                    <input type="hidden" name="intent" value="start" />
                    <UnifiedButton
                      type="submit"
                      disabled={isSubmitting}
                      loading={isSubmitting}
                      className="w-full font-semibold text-base"
                    >
                      {!isSubmitting ? <CheckCircle className="w-5 h-5" /> : null}
                      <span>{t('bookings.actions.startRental', 'Start Rental')}</span>
                    </UnifiedButton>
                  </Form>
                )}

                {canRequestReturn && (
                  <Form method="post">
                    <input type="hidden" name="intent" value="request_return" />
                    <UnifiedButton
                      type="submit"
                      disabled={isSubmitting}
                      loading={isSubmitting}
                      className="w-full font-semibold text-base"
                    >
                      {!isSubmitting ? <FileText className="w-5 h-5" /> : null}
                      <span>{t('bookings.actions.requestReturn', 'Request Return')}</span>
                    </UnifiedButton>
                  </Form>
                )}

                {canComplete && (
                  <Form method="post">
                    <input type="hidden" name="intent" value="complete" />
                    <UnifiedButton
                      type="submit"
                      disabled={isSubmitting}
                      loading={isSubmitting}
                      className="w-full font-semibold text-base"
                    >
                      {!isSubmitting ? <CheckCircle className="w-5 h-5" /> : null}
                      <span>{t('bookings.actions.approveReturn', 'Approve Return')}</span>
                    </UnifiedButton>
                  </Form>
                )}

                {canRejectReturn && (
                  <>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      <p className="font-semibold">
                        {t(
                          "bookings.actions.damageVsDisputeTitle",
                          "Report Damage vs File a Dispute"
                        )}
                      </p>
                      <p className="mt-1">
                        {t(
                          "bookings.actions.damageVsDisputeDesc",
                          "Use Report Damage when the return condition is the issue. Use File a Dispute for broader problems like missing items, payout disagreements, or unresolved rental issues."
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setCancelIntent("reject_return");
                        setShowCancelModal(true);
                      }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50"
                    >
                      <AlertCircle className="w-4 h-4" />
                      <span>{t('bookings.actions.reportDamage', 'Report Damage')}</span>
                    </button>
                  </>
                )}

                {canReview && (
                  <button
                    onClick={() => setShowReviewModal(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                  >
                    <Star className="w-4 h-4" />
                    <span>{t('bookings.details.leaveReview')}</span>
                  </button>
                )}

                {canReject && (
                  <button
                    onClick={() => {
                      setCancelIntent("reject");
                      setShowCancelModal(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>{t('bookings.actions.declineBooking', 'Decline Booking')}</span>
                  </button>
                )}

                {canCancel && (
                  <button
                    onClick={() => {
                      setCancelIntent("cancel");
                      setShowCancelModal(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>{t('bookings.details.cancelBooking')}</span>
                  </button>
                )}

                <button
                  onClick={() => navigate(listingId ? `/listings/${listingId}` : "/listings")}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-background"
                >
                  <FileText className="w-4 h-4" />
                  <span>{t('bookings.details.viewListing')}</span>
                </button>
              </div>
            </div>

            {/* Help */}
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-blue-900 mb-1">{t('bookings.details.needHelp', 'Need Help?')}</h3>
                  <p className="text-sm text-blue-700">
                    {t('bookings.details.needHelpDesc', 'Contact our support team if you have any questions or concerns about this booking.')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cancel Modal */}
      <Dialog
        open={showCancelModal}
        onClose={() => {
          if (isSubmitting) {
            return;
          }
          setShowCancelModal(false);
          setCancelReason("");
        }}
        title={
          cancelIntent === "reject"
            ? t('bookings.actions.declineBooking', 'Decline Booking')
            : cancelIntent === "reject_return"
              ? t('bookings.actions.reportDamage', 'Report Damage')
              : t('bookings.details.cancelBooking')
        }
        description={
          cancelIntent === "reject_return"
            ? t('bookings.reportDamagePrompt', 'Please describe the damage or issue found during return inspection:')
            : t('bookings.cancelReasonPrompt', 'Please provide a reason for this action:')
        }
        size="md"
      >
        <Form method="post">
          <input type="hidden" name="intent" value={cancelIntent} />
          <textarea
            name="reason"
            value={cancelReason}
            onChange={(e) =>
              setCancelReason(e.target.value.slice(0, MAX_BOOKING_REASON_LENGTH))
            }
            rows={4}
            className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder={t('bookings.cancelPlaceholder', 'Enter cancellation reason...')}
            required
            disabled={isSubmitting}
          />
          <div className="mt-2 text-right text-xs text-muted-foreground">
            {cancelReason.trim().length}/{MAX_BOOKING_REASON_LENGTH}
          </div>
          <DialogFooter>
            <UnifiedButton
              type="button"
              variant="outline"
              onClick={() => {
                setShowCancelModal(false);
                setCancelReason("");
              }}
              disabled={isSubmitting}
            >
              {t('bookings.keepBooking', 'Keep Booking')}
            </UnifiedButton>
            <UnifiedButton
              type="submit"
              variant="destructive"
              disabled={!cancelReason.trim() || isSubmitting}
              loading={isSubmitting}
            >
              {cancelIntent === "reject"
                ? t('bookings.actions.declineBooking', 'Decline Booking')
                : cancelIntent === "reject_return"
                  ? t('bookings.actions.reportDamage', 'Report Damage')
                  : t('bookings.details.cancelBooking')}
            </UnifiedButton>
          </DialogFooter>
        </Form>
      </Dialog>

      {/* Review Modal */}
      <Dialog
        open={showReviewModal}
        onClose={() => {
          if (isSubmitting) {
            return;
          }
          setShowReviewModal(false);
          setReview("");
          setRating(5);
        }}
        title={t('bookings.details.leaveReview')}
        description={t('reviews.reviewPrompt', 'Share your experience with this rental.')}
        size="md"
      >
        <Form method="post">
          <input type="hidden" name="intent" value="review" />
          <div className="mb-4">
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('reviews.rating')}
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="focus:outline-none"
                  aria-label={`Rate ${star} star(s)`}
                  disabled={isSubmitting}
                >
                  <Star
                    className={`w-8 h-8 ${
                      star <= rating
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted"
                    }`}
                  />
                </button>
              ))}
              <span className="ml-2 text-muted-foreground">{rating} {t('bookings.details.outOf', 'out of')} 5</span>
            </div>
            <input type="hidden" name="rating" value={rating} />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('reviews.comment', 'Review')}
            </label>
            <textarea
              name="comment"
              value={review}
              onChange={(e) =>
                setReview(e.target.value.slice(0, MAX_REVIEW_COMMENT_LENGTH))
              }
              rows={4}
              className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Share your experience..."
              required
              disabled={isSubmitting}
            />
            <div className="mt-2 text-right text-xs text-muted-foreground">
              {review.trim().length}/{MAX_REVIEW_COMMENT_LENGTH}
            </div>
          </div>
          <DialogFooter>
            <UnifiedButton
              type="button"
              variant="outline"
              onClick={() => setShowReviewModal(false)}
              disabled={isSubmitting}
            >
              {t('common.cancel')}
            </UnifiedButton>
            <UnifiedButton
              type="submit"
              disabled={isSubmitting || !review.trim()}
              loading={isSubmitting}
            >
              {t('reviews.submitReview')}
            </UnifiedButton>
          </DialogFooter>
        </Form>
      </Dialog>
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };
