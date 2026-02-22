import type {
  MetaFunction,
  LoaderFunctionArgs,
  ActionFunctionArgs,
} from "react-router";
import { RouteErrorBoundary } from "~/components/ui";
import { useLoaderData, useNavigate, useActionData, Form } from "react-router";
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

export const meta: MetaFunction = () => {
  return [{ title: "Booking Details | GharBatai Rentals" }];
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value: string | undefined): value is string =>
  Boolean(value && UUID_PATTERN.test(value));
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
  const user = await getUser(request);
  if (!user) {
    throw redirect("/auth/login");
  }

  const bookingId = params.id;
  if (!isUuid(bookingId)) {
    throw redirect("/bookings");
  }

  try {
    const booking = await bookingsApi.getBookingById(bookingId);
    const isParticipant =
      booking.ownerId === user.id || booking.renterId === user.id || user.role === "admin";
    if (!isParticipant) {
      throw redirect("/bookings");
    }
    return { booking };
  } catch (error) {
    console.error("Failed to load booking:", error);
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
            !["confirmed", "pending_owner_approval"].includes(status)
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
      case "review":
        {
          if (!["completed", "settled"].includes(status)) {
            return { error: "Reviews can only be submitted after completion." };
          }
          if (booking.review) {
            return { error: "A review has already been submitted for this booking." };
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
  completed: "bg-gray-100 text-gray-800",
  settled: "bg-gray-100 text-gray-800",
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
  const { booking } = useLoaderData<{ booking: Booking }>();
  const actionData = useActionData<{ success?: string; error?: string }>();
  const navigate = useNavigate();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelIntent, setCancelIntent] = useState<"cancel" | "reject">("cancel");
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const [isSubmittingReview] = useState(false);

  const [searchParams] = useSearchParams();
  const revalidator = useRevalidator();
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

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
    totalAmount: safeNumber(booking.totalAmount),
  };

  // Check for successful payment redirect
  useEffect(() => {
    const paymentSuccess = searchParams.get("payment") === "success";
    const needsVerification =
      normalizedStatus === "pending_payment" ||
      String(booking.paymentStatus).toUpperCase() === "PENDING";

    if (paymentSuccess && needsVerification) {
      setIsVerifyingPayment(true);
      
      // Poll for status update
      const interval = setInterval(() => {
        revalidator.revalidate();
      }, 2000);

      // Stop polling after 30 seconds
      const timeout = setTimeout(() => {
        clearInterval(interval);
        setIsVerifyingPayment(false);
      }, 30000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    } else if (normalizedStatus === "confirmed" && isVerifyingPayment) {
      setIsVerifyingPayment(false);
      setShowCelebration(true);
    }
  }, [searchParams, normalizedStatus, booking.paymentStatus, revalidator]);

  // Get current user from auth store to determine ownership
  const { user } = useAuthStore();
  const currentUserId = user?.id || "";

  // Determine user role in this booking
  const isOwner = booking.ownerId === currentUserId;

  const normalizedPaymentStatus = String(booking.paymentStatus || "").toLowerCase();
  const canConfirm = isOwner && normalizedStatus === "pending_owner_approval";
  const canReject = isOwner && normalizedStatus === "pending_owner_approval";
  const canCancel = ["confirmed", "pending_owner_approval"].includes(normalizedStatus);
  const canStart = isOwner && normalizedStatus === "confirmed";
  const canComplete = isOwner && normalizedStatus === "return_requested";
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
    <div className="min-h-screen bg-gray-50">
      {/* Success Celebration */}
      <SuccessCelebration
        show={showCelebration}
        title="Booking Confirmed!"
        message="Your payment was processed successfully. The owner will be notified and your rental is confirmed."
        onClose={() => setShowCelebration(false)}
      />
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate("/bookings")}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Bookings</span>
            </button>
            <div className="flex items-center gap-4">
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[normalizedStatus] || "bg-gray-100 text-gray-800"}`}
              >
                {normalizedStatus.replace(/_/g, " ").toUpperCase()}
              </span>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${PAYMENT_STATUS_COLORS[normalizedPaymentStatus] || "bg-gray-100 text-gray-800"}`}
              >
                Payment: {normalizedPaymentStatus}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Payment Verification Banner */}
        {isVerifyingPayment && (
          <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-4 rounded-lg flex items-center gap-3 animate-pulse">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <div>
              <p className="font-semibold">Verifying your payment...</p>
              <p className="text-sm">
                Please wait while we confirm your transaction with the payment
                provider. This usually takes a few seconds.
              </p>
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
            {/* Timeline */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">
                Booking Timeline
              </h2>
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
                <div className="space-y-8">
                  {TIMELINE_STEPS.map((step, index) => {
                    const Icon = step.icon;
                    const isCompleted = index <= currentStepIndex;
                    const isCurrent = index === currentStepIndex;

                    return (
                      <div
                        key={step.status}
                        className="relative flex items-start gap-4"
                      >
                        <div
                          className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full ${
                            isCompleted
                              ? "bg-primary-600 text-white"
                              : "bg-gray-200 text-gray-400"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <p
                            className={`font-medium ${isCurrent ? "text-primary-600" : isCompleted ? "text-gray-900" : "text-gray-500"}`}
                          >
                            {step.label}
                          </p>
                          {isCurrent && (
                            <p className="text-sm text-gray-500 mt-1">
                              Current status
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Listing Details */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Listing Details
              </h2>
              <div className="flex gap-4">
                {booking.listing?.photos?.[0] && (
                  <img
                    src={booking.listing.photos[0]}
                    alt={listingTitle}
                    className="w-32 h-32 object-cover rounded-lg"
                  />
                )}
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {listingTitle}
                  </h3>
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                    {listingDescription}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
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
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Booking Information
              </h2>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center gap-2 text-gray-600 mb-2">
                    <Calendar className="w-5 h-5" />
                    <span className="font-medium">Rental Period</span>
                  </div>
                  <p className="text-gray-900">
                    {safeDateLabel(booking.startDate, "MMM d, yyyy")} -{" "}
                    {safeDateLabel(booking.endDate, "MMM d, yyyy")}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {bookingDays} days
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-gray-600 mb-2">
                    <Package className="w-5 h-5" />
                    <span className="font-medium">Delivery Method</span>
                  </div>
                  <p className="text-gray-900 capitalize">
                    {booking.deliveryMethod}
                  </p>
                  {booking.deliveryAddress && (
                    <p className="text-sm text-gray-500 mt-1">
                      {booking.deliveryAddress}
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2 text-gray-600 mb-2">
                    <Clock className="w-5 h-5" />
                    <span className="font-medium">Booking Date</span>
                  </div>
                  <p className="text-gray-900">
                    {safeDateLabel(booking.createdAt, "MMM d, yyyy h:mm a")}
                  </p>
                </div>

                {booking.specialRequests && (
                  <div>
                    <div className="flex items-center gap-2 text-gray-600 mb-2">
                      <FileText className="w-5 h-5" />
                      <span className="font-medium">Special Requests</span>
                    </div>
                    <p className="text-gray-900 text-sm">
                      {booking.specialRequests}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Details */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Payment Details
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between text-gray-600">
                  <span>Rental Amount</span>
                  <span className="font-medium">
                    ${safeNumber(pricing.subtotal).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Service Fee</span>
                  <span className="font-medium">
                    ${safeNumber(pricing.serviceFee).toFixed(2)}
                  </span>
                </div>
                {safeNumber(pricing.deliveryFee) > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Delivery Fee</span>
                    <span className="font-medium">
                      ${safeNumber(pricing.deliveryFee).toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-gray-600">
                  <span>Security Deposit</span>
                  <span className="font-medium">
                    ${safeNumber(pricing.securityDeposit).toFixed(2)}
                  </span>
                </div>
                <div className="border-t pt-3 flex justify-between text-lg font-bold text-gray-900">
                  <span>Total Paid</span>
                  <span>${safeNumber(pricing.totalAmount).toFixed(2)}</span>
                </div>
              </div>

              {String(booking.paymentStatus).toUpperCase() === "PAID" && (
                <div className="mt-4 flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span>Payment completed</span>
                </div>
              )}
            </div>

            {/* Review Section */}
            {booking.review && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Review</h2>
                <div className="flex items-center gap-1 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-5 h-5 ${
                        i < reviewRating
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-300"
                      }`}
                    />
                  ))}
                  <span className="ml-2 text-gray-600">
                    {reviewRating.toFixed(1)} out of 5
                  </span>
                </div>
                <p className="text-gray-700">{reviewComment}</p>
                <p className="text-sm text-gray-500 mt-3">
                  Reviewed on{" "}
                  {safeDateLabel(booking.review.createdAt, "MMM d, yyyy")}
                </p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Other Party Information */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                {isOwner ? "Renter" : "Owner"} Information
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
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-700">
                        {getInitials(renterFirstName, renterLastName)}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-gray-900">
                        {renterFirstName}{renterLastName ? ` ${renterLastName}` : ""}
                      </p>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm text-gray-600">
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
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-700">
                        {getInitials(ownerFirstName, ownerLastName)}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-gray-900">
                        {ownerFirstName}{ownerLastName ? ` ${ownerLastName}` : ""}
                      </p>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm text-gray-600">
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
                className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Send Message</span>
              </button>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Actions</h2>
              <div className="space-y-3">
                {["confirmed", "active", "return_requested", "completed", "settled"].includes(normalizedStatus) && (
                  <button
                    onClick={() => navigate(`/disputes/new/${booking.id}`)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50"
                  >
                    <AlertCircle className="w-4 h-4" />
                    <span>File a Dispute</span>
                  </button>
                )}

                {canConfirm && (
                  <Form method="post">
                    <input type="hidden" name="intent" value="confirm" />
                    <button
                      type="submit"
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Confirm Booking</span>
                    </button>
                  </Form>
                )}

                {canStart && (
                  <Form method="post">
                    <input type="hidden" name="intent" value="start" />
                    <button
                      type="submit"
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Start Rental</span>
                    </button>
                  </Form>
                )}

                {canRequestReturn && (
                  <Form method="post">
                    <input type="hidden" name="intent" value="request_return" />
                    <button
                      type="submit"
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Request Return</span>
                    </button>
                  </Form>
                )}

                {canComplete && (
                  <Form method="post">
                    <input type="hidden" name="intent" value="complete" />
                    <button
                      type="submit"
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Approve Return</span>
                    </button>
                  </Form>
                )}

                {canReview && (
                  <button
                    onClick={() => setShowReviewModal(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                  >
                    <Star className="w-4 h-4" />
                    <span>Leave Review</span>
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
                    <span>Decline Booking</span>
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
                    <span>Cancel Booking</span>
                  </button>
                )}

                <button
                  onClick={() => navigate(listingId ? `/listings/${listingId}` : "/listings")}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <FileText className="w-4 h-4" />
                  <span>View Listing</span>
                </button>
              </div>
            </div>

            {/* Help */}
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-blue-900 mb-1">Need Help?</h3>
                  <p className="text-sm text-blue-700">
                    Contact our support team if you have any questions or
                    concerns about this booking.
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
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              {cancelIntent === "reject" ? "Decline Booking" : "Cancel Booking"}
            </h3>
            <p className="text-gray-600 mb-4">
              Please provide a reason for this action:
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-4"
                placeholder="Enter cancellation reason..."
                required
              />
              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCancelModal(false);
                    setCancelReason("");
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Keep Booking
                </button>
                <button
                  type="submit"
                  disabled={!cancelReason.trim()}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  {cancelIntent === "reject" ? "Decline Booking" : "Cancel Booking"}
                </button>
              </div>
            </Form>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Form method="post" className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <input type="hidden" name="intent" value="review" />
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Leave a Review
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rating
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="focus:outline-none"
                  >
                    <Star
                      className={`w-8 h-8 ${
                        star <= rating
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-300"
                      }`}
                    />
                  </button>
                ))}
                <span className="ml-2 text-gray-600">{rating} out of 5</span>
              </div>
              <input type="hidden" name="rating" value={rating} />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Review
              </label>
              <textarea
                name="comment"
                value={review}
                onChange={(e) =>
                  setReview(e.target.value.slice(0, MAX_REVIEW_COMMENT_LENGTH))
                }
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Share your experience..."
                required
              />
            </div>
            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingReview || !review.trim()}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmittingReview && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit Review
              </button>
            </div>
          </Form>
        </div>
      )}
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };

