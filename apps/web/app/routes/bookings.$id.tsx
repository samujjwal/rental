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
import { reviewsApi } from "~/lib/api/reviews";
import { BookingStatus } from "~/lib/shared-types";
import { redirect, useRevalidator, useSearchParams } from "react-router";
import type { Booking } from "~/types/booking";
import { format } from "date-fns";
import { useAuthStore } from "~/lib/store/auth";
import { useEffect, useState, useCallback } from "react";
import { getUser } from "~/utils/auth";
import { SuccessCelebration } from "~/components/animations/SuccessCelebration";
import { useTranslation } from "react-i18next";
import { toast } from "~/lib/toast";

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

const getInitials = (firstName?: string, lastName?: string | null) => {
  const first = firstName?.[0] || "";
  const last = lastName?.[0] || "";
  return (first + last).toUpperCase() || "U";
};

export async function clientLoader({ params, request }: LoaderFunctionArgs) {
  console.log("[bookings.$id clientLoader] START", params.id);
  const user = await getUser(request);
  console.log("[bookings.$id clientLoader] user:", user ? `${user.id} (${user.role})` : "null");
  if (!user) {
    console.log("[bookings.$id clientLoader] no user → redirect /auth/login");
    throw redirect("/auth/login");
  }

  const bookingId = params.id;
  if (!isUuid(bookingId)) {
    console.log("[bookings.$id clientLoader] invalid uuid → redirect /bookings");
    throw redirect("/bookings");
  }

  try {
    const booking = await bookingsApi.getBookingById(bookingId);
    console.log("[bookings.$id clientLoader] booking:", booking.id, "ownerId:", booking.ownerId, "renterId:", booking.renterId);
    const isParticipant =
      booking.ownerId === user.id || booking.renterId === user.id || user.role === "admin";
    console.log("[bookings.$id clientLoader] isParticipant:", isParticipant, "user.id:", user.id);
    if (!isParticipant) {
      console.log("[bookings.$id clientLoader] not participant → redirect /bookings");
      throw redirect("/bookings");
    }
    return { booking };
  } catch (error) {
    if (error instanceof Response) throw error; // re-throw redirects
    console.error("[bookings.$id clientLoader] catch error:", error);
    throw redirect("/bookings");
  }
}

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
    return {
      error:
        (error &&
          typeof error === "object" &&
          "response" in error &&
          (error as { response?: { data?: { message?: string } } }).response
            ?.data?.message) ||
        "Action failed",
    };
  }
}

const STATUS_COLORS: Record<string, string> = {
  pending_owner_approval: "bg-yellow-100 text-yellow-800",
  pending_payment: "bg-orange-100 text-orange-800",
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  active: "bg-green-100 text-green-800",
  return_requested: "bg-amber-100 text-amber-800",
  completed: "bg-muted text-foreground",
  settled: "bg-muted text-foreground",
  cancelled: "bg-red-100 text-red-800",
  payment_failed: "bg-red-100 text-red-800",
  disputed: "bg-red-100 text-red-800",
  refunded: "bg-blue-100 text-blue-800",
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  paid: "bg-green-100 text-green-800",
  refunded: "bg-blue-100 text-blue-800",
  failed: "bg-red-100 text-red-800",
};

const TIMELINE_STEPS = [
  { status: "pending_owner_approval", label: "Booking Requested", icon: Clock },
  { status: "pending_payment", label: "Pending Payment", icon: Clock },
  { status: "confirmed", label: "Confirmed", icon: CheckCircle },
  { status: "active", label: "In Progress", icon: Package },
  { status: "return_requested", label: "Return Requested", icon: FileText },
  { status: "completed", label: "Completed", icon: CheckCircle },
];

export default function BookingDetail() {
  const { t } = useTranslation();
  const { booking } = useLoaderData<{ booking: Booking }>();
  const actionData = useActionData<{ success?: string; error?: string }>();

  // Show toast for action results and close modal on success
  useEffect(() => {
    if (actionData?.success) {
      toast.success(actionData.success);
      setShowCancelModal(false);
      setCancelReason("");
    }
    if (actionData?.error) toast.error(actionData.error);
  }, [actionData]);
  const navigate = useNavigate();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelIntent, setCancelIntent] = useState<"cancel" | "reject" | "reject_return">("cancel");
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  const [searchParams] = useSearchParams();
  const revalidator = useRevalidator();
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [paymentVerifyTimedOut, setPaymentVerifyTimedOut] = useState(false);

  const normalizedStatus = normalizeStatus(booking.status);
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

  // Check for successful payment redirect
  useEffect(() => {
    const paymentSuccess = searchParams.get("payment") === "success";
    const needsVerification =
      normalizedStatus === "pending_payment" ||
      String(booking.paymentStatus).toUpperCase() === "PENDING";

    if (paymentSuccess && needsVerification) {
      setIsVerifyingPayment(true);
      setPaymentVerifyTimedOut(false);
      
      // Poll for status update
      const interval = setInterval(() => {
        revalidator.revalidate();
      }, 2000);

      // Stop polling after 30 seconds and surface recovery guidance
      const timeout = setTimeout(() => {
        clearInterval(interval);
        setIsVerifyingPayment(false);
        setPaymentVerifyTimedOut(true);
      }, 30000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    } else if (normalizedStatus === "confirmed" && isVerifyingPayment) {
      setIsVerifyingPayment(false);
      setPaymentVerifyTimedOut(false);
      setShowCelebration(true);
    }
  }, [searchParams, normalizedStatus, booking.paymentStatus, revalidator, isVerifyingPayment]);

  // Get current user from auth store to determine ownership
  const { user } = useAuthStore();
  const currentUserId = user?.id || "";

  // Determine user role in this booking
  const isOwner = booking.ownerId === currentUserId;

  const normalizedPaymentStatus = String(booking.paymentStatus || "").toLowerCase();
  const canConfirm = isOwner && normalizedStatus === "pending_owner_approval";
  const canReject = isOwner && normalizedStatus === "pending_owner_approval";
  const canCancel = ["confirmed", "pending_owner_approval", "pending_payment"].includes(normalizedStatus);
  const canStart = isOwner && normalizedStatus === "confirmed";
  const canComplete = isOwner && normalizedStatus === "return_requested";
  const canRejectReturn = isOwner && normalizedStatus === "return_requested";
  const canRequestReturn = !isOwner && normalizedStatus === "active";
  const canReview = ["completed", "settled"].includes(normalizedStatus) && !booking.review;
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
              {/* Horizontal stepper — scrollable on small screens */}
              <div className="overflow-x-auto pb-2">
                <div className="flex items-center min-w-max">
                  {TIMELINE_STEPS.map((step, index) => {
                    const Icon = step.icon;
                    const isCompleted = currentStepIndex >= 0 && index < currentStepIndex;
                    const isCurrent = index === currentStepIndex;
                    const isPending = currentStepIndex < 0 || index > currentStepIndex;

                    return (
                      <div key={step.status} className="flex items-center">
                        {/* Step node */}
                        <div className="flex flex-col items-center gap-1.5">
                          <div
                            className={`flex items-center justify-center w-9 h-9 rounded-full border-2 transition-all ${
                              isCompleted
                                ? "bg-primary border-primary text-primary-foreground"
                                : isCurrent
                                ? "bg-background border-primary text-primary ring-4 ring-primary/20"
                                : "bg-muted border-border text-muted-foreground"
                            }`}
                          >
                            {isCompleted ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : (
                              <Icon className="w-4 h-4" />
                            )}
                          </div>
                          <span
                            className={`text-xs font-medium text-center max-w-[72px] leading-tight ${
                              isCurrent
                                ? "text-primary"
                                : isCompleted
                                ? "text-foreground"
                                : "text-muted-foreground"
                            }`}
                          >
                            {step.label}
                          </span>
                        </div>
                        {/* Connector line */}
                        {index < TIMELINE_STEPS.length - 1 && (
                          <div
                            className={`h-0.5 w-10 sm:w-14 mx-1 rounded-full transition-all ${
                              isCompleted ? "bg-primary" : "bg-border"
                            }`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              {currentStepIndex >= 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  {t('bookings.details.currentStatus', 'Current status')}:{" "}
                  <span className="font-medium text-primary">
                    {TIMELINE_STEPS[currentStepIndex]?.label ?? normalizedStatus.replace(/_/g, " ")}
                  </span>
                </p>
              ) : ["cancelled", "disputed", "refunded", "payment_failed"].includes(normalizedStatus) ? (
                <div className="mt-4 flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive font-medium">
                    {normalizedStatus === "cancelled"
                      ? t('bookings.details.cancelledNote', 'This booking was cancelled. No further actions are available.')
                      : normalizedStatus === "disputed"
                      ? t('bookings.details.disputedNote', 'A dispute has been filed. Our team will review and contact both parties within 2–3 business days.')
                      : normalizedStatus === "refunded"
                      ? t('bookings.details.refundedNote', 'This booking has been refunded. Funds should appear within 5–7 business days.')
                      : t('bookings.details.paymentFailedNote', 'Payment failed. Use the "Retry Payment" button below to try again before the booking is auto-cancelled.')}
                  </p>
                </div>
              ) : null}
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
                {!isOwner && ["pending_payment", "payment_failed"].includes(normalizedStatus) && (
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

                {["confirmed", "active", "return_requested", "completed", "settled"].includes(normalizedStatus) && (
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
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-base"
                    >
                      {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                      <span>{t('bookings.actions.confirmBooking', 'Confirm Booking')}</span>
                    </button>
                  </Form>
                )}

                {canStart && (
                  <Form method="post">
                    <input type="hidden" name="intent" value="start" />
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-base"
                    >
                      {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                      <span>{t('bookings.actions.startRental', 'Start Rental')}</span>
                    </button>
                  </Form>
                )}

                {canRequestReturn && (
                  <Form method="post">
                    <input type="hidden" name="intent" value="request_return" />
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-base"
                    >
                      {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                      <span>{t('bookings.actions.requestReturn', 'Request Return')}</span>
                    </button>
                  </Form>
                )}

                {canComplete && (
                  <Form method="post">
                    <input type="hidden" name="intent" value="complete" />
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-base"
                    >
                      {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                      <span>{t('bookings.actions.approveReturn', 'Approve Return')}</span>
                    </button>
                  </Form>
                )}

                {canRejectReturn && (
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
      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-foreground mb-4">
              {cancelIntent === "reject" ? t('bookings.actions.declineBooking', 'Decline Booking') : cancelIntent === "reject_return" ? t('bookings.actions.reportDamage', 'Report Damage') : t('bookings.details.cancelBooking')}
            </h3>
            <p className="text-muted-foreground mb-4">
              {cancelIntent === "reject_return"
                ? t('bookings.reportDamagePrompt', 'Please describe the damage or issue found during return inspection:')
                : t('bookings.cancelReasonPrompt', 'Please provide a reason for this action:')}
            </p>
            <Form method="post">
              <input type="hidden" name="intent" value={cancelIntent} />
              <textarea
                name="reason"
                value={cancelReason}
                onChange={(e) =>
                  setCancelReason(e.target.value.slice(0, MAX_BOOKING_REASON_LENGTH))
                }
                rows={4}
                className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-4"
                placeholder={t('bookings.cancelPlaceholder', 'Enter cancellation reason...')}
                required
              />
              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCancelModal(false);
                    setCancelReason("");
                  }}
                  className="px-4 py-2 border border-border text-foreground rounded-lg hover:bg-background"
                >
                  {t('bookings.keepBooking', 'Keep Booking')}
                </button>
                <button
                  type="submit"
                  disabled={!cancelReason.trim() || isSubmitting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? t('bookings.processing', 'Processing...') : cancelIntent === "reject" ? t('bookings.actions.declineBooking', 'Decline Booking') : cancelIntent === "reject_return" ? t('bookings.actions.reportDamage', 'Report Damage') : t('bookings.details.cancelBooking')}
                </button>
              </div>
            </Form>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Form method="post" className="bg-card rounded-lg p-6 max-w-md w-full mx-4">
            <input type="hidden" name="intent" value="review" />
            <h3 className="text-xl font-bold text-foreground mb-4">
              {t('bookings.details.leaveReview')}
            </h3>
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
              />
            </div>
            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="px-4 py-2 border border-border text-foreground rounded-lg hover:bg-background"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !review.trim()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('reviews.submitReview')}
              </button>
            </div>
          </Form>
        </div>
      )}
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };

