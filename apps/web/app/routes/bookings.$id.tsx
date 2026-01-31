import type {
  MetaFunction,
  LoaderFunctionArgs,
  ActionFunctionArgs,
} from "react-router";
import { useLoaderData, useNavigate, useActionData, Form } from "react-router";
import { useState } from "react";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  DollarSign,
  User,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  MessageCircle,
  AlertCircle,
  FileText,
  Star,
} from "lucide-react";
import { bookingsApi } from "~/lib/api/bookings";
import { redirect } from "react-router";
import type { Booking } from "~/types/booking";
import { format } from "date-fns";

export const meta: MetaFunction = () => {
  return [{ title: "Booking Details | GharBatai Rentals" }];
};

export async function loader({ params }: LoaderFunctionArgs) {
  const bookingId = params.id;
  if (!bookingId) {
    throw redirect("/bookings");
  }

  try {
    const booking = await bookingsApi.getBookingById(bookingId);
    return { booking };
  } catch (error) {
    console.error("Failed to load booking:", error);
    throw redirect("/bookings");
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  const bookingId = params.id;
  if (!bookingId) {
    return { error: "Booking ID is required" };
  }

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  try {
    switch (intent) {
      case "confirm":
        await bookingsApi.confirmBooking(bookingId);
        return { success: "Booking confirmed successfully" };
      case "cancel":
        const reason = formData.get("reason") as string;
        await bookingsApi.cancelBooking(bookingId, reason);
        return redirect("/bookings");
      case "complete":
        await bookingsApi.completeBooking(bookingId);
        return { success: "Booking marked as complete" };
      default:
        return { error: "Invalid action" };
    }
  } catch (error: any) {
    return { error: error.response?.data?.message || "Action failed" };
  }
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  active: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
  payment_pending: "bg-orange-100 text-orange-800",
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  paid: "bg-green-100 text-green-800",
  refunded: "bg-blue-100 text-blue-800",
  failed: "bg-red-100 text-red-800",
};

const TIMELINE_STEPS = [
  { status: "pending", label: "Booking Requested", icon: Clock },
  { status: "confirmed", label: "Confirmed", icon: CheckCircle },
  { status: "active", label: "In Progress", icon: Package },
  { status: "completed", label: "Completed", icon: CheckCircle },
];

export default function BookingDetail() {
  const { booking } = useLoaderData<{ booking: Booking }>();
  const actionData = useActionData<{ success?: string; error?: string }>();
  const navigate = useNavigate();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");

  const isOwner = false; // TODO: Check if current user is the owner
  const isRenter = true; // TODO: Check if current user is the renter

  const canConfirm = isOwner && booking.status === "pending";
  const canCancel = ["pending", "confirmed"].includes(booking.status);
  const canComplete = isOwner && booking.status === "active";
  const canReview = booking.status === "completed" && !booking.review;

  const currentStepIndex = TIMELINE_STEPS.findIndex(
    (step) => step.status === booking.status
  );

  return (
    <div className="min-h-screen bg-gray-50">
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
                className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[booking.status]}`}
              >
                {booking.status.replace("_", " ").toUpperCase()}
              </span>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${PAYMENT_STATUS_COLORS[booking.paymentStatus]}`}
              >
                Payment: {booking.paymentStatus}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                {booking.listing.images && booking.listing.images[0] && (
                  <img
                    src={booking.listing.images[0]}
                    alt={booking.listing.title}
                    className="w-32 h-32 object-cover rounded-lg"
                  />
                )}
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {booking.listing.title}
                  </h3>
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                    {booking.listing.description}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {booking.listing.location?.city}
                    </span>
                    <span className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      {booking.listing.rating?.toFixed(1) || "N/A"}
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
                    {format(new Date(booking.startDate), "MMM d, yyyy")} -{" "}
                    {format(new Date(booking.endDate), "MMM d, yyyy")}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {Math.ceil(
                      (new Date(booking.endDate).getTime() -
                        new Date(booking.startDate).getTime()) /
                        (1000 * 60 * 60 * 24)
                    )}{" "}
                    days
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
                    {format(new Date(booking.createdAt), "MMM d, yyyy h:mm a")}
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
                    ${booking.pricing?.subtotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Service Fee</span>
                  <span className="font-medium">
                    ${booking.pricing?.serviceFee.toFixed(2)}
                  </span>
                </div>
                {booking.pricing?.deliveryFee && (
                  <div className="flex justify-between text-gray-600">
                    <span>Delivery Fee</span>
                    <span className="font-medium">
                      ${booking.pricing.deliveryFee.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-gray-600">
                  <span>Security Deposit</span>
                  <span className="font-medium">
                    ${booking.pricing?.securityDeposit.toFixed(2)}
                  </span>
                </div>
                <div className="border-t pt-3 flex justify-between text-lg font-bold text-gray-900">
                  <span>Total Paid</span>
                  <span>${booking.totalAmount.toFixed(2)}</span>
                </div>
              </div>

              {booking.paymentStatus === "paid" && (
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
                        i < booking.review!.rating
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-300"
                      }`}
                    />
                  ))}
                  <span className="ml-2 text-gray-600">
                    {booking.review.rating.toFixed(1)} out of 5
                  </span>
                </div>
                <p className="text-gray-700">{booking.review.comment}</p>
                <p className="text-sm text-gray-500 mt-3">
                  Reviewed on{" "}
                  {format(new Date(booking.review.createdAt), "MMM d, yyyy")}
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
                    <img
                      src={booking.renter.avatar || "/default-avatar.png"}
                      alt={booking.renter.firstName}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    <div>
                      <p className="font-medium text-gray-900">
                        {booking.renter.firstName} {booking.renter.lastName}
                      </p>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm text-gray-600">
                          {booking.renter.rating?.toFixed(1) || "New"}
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <img
                      src={booking.owner.avatar || "/default-avatar.png"}
                      alt={booking.owner.firstName}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    <div>
                      <p className="font-medium text-gray-900">
                        {booking.owner.firstName} {booking.owner.lastName}
                      </p>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm text-gray-600">
                          {booking.owner.rating?.toFixed(1) || "New"}
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

                {canComplete && (
                  <Form method="post">
                    <input type="hidden" name="intent" value="complete" />
                    <button
                      type="submit"
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Mark as Complete</span>
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

                {canCancel && (
                  <button
                    onClick={() => setShowCancelModal(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Cancel Booking</span>
                  </button>
                )}

                <button
                  onClick={() => navigate(`/listings/${booking.listing.id}`)}
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
              Cancel Booking
            </h3>
            <p className="text-gray-600 mb-4">
              Please provide a reason for cancelling this booking:
            </p>
            <Form method="post">
              <input type="hidden" name="intent" value="cancel" />
              <textarea
                name="reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-4"
                placeholder="Enter cancellation reason..."
                required
              />
              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Keep Booking
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Cancel Booking
                </button>
              </div>
            </Form>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
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
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Review
              </label>
              <textarea
                value={review}
                onChange={(e) => setReview(e.target.value)}
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
                type="button"
                onClick={() => {
                  // TODO: Submit review
                  console.log("Submit review:", { rating, review });
                  setShowReviewModal(false);
                }}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Submit Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
