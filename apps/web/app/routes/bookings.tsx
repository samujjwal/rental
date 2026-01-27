import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link, useSearchParams } from "react-router";
import { useState } from "react";
import {
    Calendar,
    Package,
    MapPin,
    Clock,
    DollarSign,
    MessageSquare,
    X,
    CheckCircle,
    AlertCircle,
} from "lucide-react";
import { bookingsApi } from "~/lib/api/bookings";
import type { Booking } from "~/types/booking";
import { format } from "date-fns";

export const meta: MetaFunction = () => {
    return [
        { title: "My Bookings - Universal Rental Portal" },
        { name: "description", content: "Manage your rental bookings" },
    ];
};

export async function loader({ request }: LoaderFunctionArgs) {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") || undefined;
    const view = url.searchParams.get("view") || "renter";

    try {
        const bookings =
            view === "owner"
                ? await bookingsApi.getOwnerBookings(status)
                : await bookingsApi.getMyBookings(status);
        return { bookings, view, status };
    } catch (error) {
        console.error("Bookings error:", error);
        return { bookings: [], view, status };
    }
}

const STATUS_COLORS = {
    pending: "bg-yellow-100 text-yellow-800",
    confirmed: "bg-blue-100 text-blue-800",
    active: "bg-green-100 text-green-800",
    completed: "bg-gray-100 text-gray-800",
    cancelled: "bg-red-100 text-red-800",
    disputed: "bg-orange-100 text-orange-800",
};

const STATUS_ICONS = {
    pending: Clock,
    confirmed: CheckCircle,
    active: Package,
    completed: CheckCircle,
    cancelled: X,
    disputed: AlertCircle,
};

export default function BookingsPage() {
    const { bookings, view, status } = useLoaderData<typeof loader>();
    const [searchParams, setSearchParams] = useSearchParams();
    const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelReason, setCancelReason] = useState("");

    const handleViewChange = (newView: string) => {
        setSearchParams({ view: newView });
    };

    const handleStatusFilter = (newStatus: string) => {
        const params = new URLSearchParams(searchParams);
        if (newStatus) {
            params.set("status", newStatus);
        } else {
            params.delete("status");
        }
        setSearchParams(params);
    };

    const handleCancelBooking = async () => {
        if (!selectedBooking || !cancelReason) return;

        try {
            await bookingsApi.cancelBooking(selectedBooking.id, cancelReason);
            setShowCancelModal(false);
            setCancelReason("");
            window.location.reload();
        } catch (error) {
            console.error("Cancel error:", error);
            alert("Failed to cancel booking. Please try again.");
        }
    };

    const handleConfirmBooking = async (bookingId: string) => {
        try {
            await bookingsApi.confirmBooking(bookingId);
            window.location.reload();
        } catch (error) {
            console.error("Confirm error:", error);
            alert("Failed to confirm booking. Please try again.");
        }
    };

    const handleCompleteBooking = async (bookingId: string) => {
        try {
            await bookingsApi.completeBooking(bookingId);
            window.location.reload();
        } catch (error) {
            console.error("Complete error:", error);
            alert("Failed to complete booking. Please try again.");
        }
    };

    const formatDate = (dateString: string) => {
        return format(new Date(dateString), "MMM d, yyyy");
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <Link to="/" className="text-xl font-bold text-primary-600">
                            Rental Portal
                        </Link>
                        <Link
                            to="/dashboard"
                            className="text-sm text-gray-700 hover:text-gray-900"
                        >
                            Dashboard
                        </Link>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* View Toggle */}
                <div className="mb-6">
                    <div className="flex items-center gap-2 bg-white rounded-lg border p-1">
                        <button
                            onClick={() => handleViewChange("renter")}
                            className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors ${view === "renter"
                                ? "bg-primary-600 text-white"
                                : "text-gray-600 hover:bg-gray-100"
                                }`}
                        >
                            My Rentals
                        </button>
                        <button
                            onClick={() => handleViewChange("owner")}
                            className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors ${view === "owner"
                                ? "bg-primary-600 text-white"
                                : "text-gray-600 hover:bg-gray-100"
                                }`}
                        >
                            My Listings
                        </button>
                    </div>
                </div>

                {/* Status Filters */}
                <div className="mb-6">
                    <div className="flex items-center gap-2 overflow-x-auto pb-2">
                        <button
                            onClick={() => handleStatusFilter("")}
                            className={`px-4 py-2 rounded-lg whitespace-nowrap ${!status
                                ? "bg-primary-600 text-white"
                                : "bg-white text-gray-700 border hover:bg-gray-50"
                                }`}
                        >
                            All
                        </button>
                        {["pending", "confirmed", "active", "completed", "cancelled"].map(
                            (s) => (
                                <button
                                    key={s}
                                    onClick={() => handleStatusFilter(s)}
                                    className={`px-4 py-2 rounded-lg capitalize whitespace-nowrap ${status === s
                                        ? "bg-primary-600 text-white"
                                        : "bg-white text-gray-700 border hover:bg-gray-50"
                                        }`}
                                >
                                    {s}
                                </button>
                            )
                        )}
                    </div>
                </div>

                {/* Bookings List */}
                {bookings.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
                        <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">
                            No bookings found
                        </h3>
                        <p className="text-gray-600 mb-4">
                            {view === "renter"
                                ? "Start browsing and book your first rental"
                                : "Your listings don't have any bookings yet"}
                        </p>
                        <Link
                            to={view === "renter" ? "/search" : "/listings/new"}
                            className="inline-block px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
                        >
                            {view === "renter" ? "Browse Rentals" : "Create Listing"}
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {bookings.map((booking) => {
                            const StatusIcon = STATUS_ICONS[booking.status];
                            const isRenter = view === "renter";
                            const otherUser = isRenter ? booking.owner : booking.renter;

                            return (
                                <div
                                    key={booking.id}
                                    className="bg-white rounded-lg shadow-sm border overflow-hidden hover:shadow-md transition-shadow"
                                >
                                    <div className="p-6">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <h3 className="text-lg font-semibold text-gray-900">
                                                        {booking.listing.title}
                                                    </h3>
                                                    <span
                                                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[booking.status]
                                                            }`}
                                                    >
                                                        <StatusIcon className="w-4 h-4" />
                                                        {booking.status}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-4 text-sm text-gray-600">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="w-4 h-4" />
                                                        {formatDate(booking.startDate)} -{" "}
                                                        {formatDate(booking.endDate)}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-4 h-4" />
                                                        {booking.totalDays} days
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <DollarSign className="w-4 h-4" />$
                                                        {booking.totalAmount}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Listing Image */}
                                            <Link
                                                to={`/listings/${booking.listingId}`}
                                                className="w-24 h-24 bg-gray-200 rounded-lg overflow-hidden shrink-0"
                                            >
                                                {booking.listing.images[0] ? (
                                                    <img
                                                        src={booking.listing.images[0]}
                                                        alt={booking.listing.title}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <Package className="w-8 h-8 text-gray-400" />
                                                    </div>
                                                )}
                                            </Link>
                                        </div>

                                        {/* Other User Info */}
                                        <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
                                            <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                                                {otherUser.avatar ? (
                                                    <img
                                                        src={otherUser.avatar}
                                                        alt={otherUser.firstName}
                                                        className="w-full h-full rounded-full object-cover"
                                                    />
                                                ) : (
                                                    <span className="text-lg font-bold text-gray-600">
                                                        {otherUser.firstName[0]}
                                                    </span>
                                                )}
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-gray-900">
                                                    {isRenter ? "Owner" : "Renter"}:{" "}
                                                    {otherUser.firstName} {otherUser.lastName}
                                                </div>
                                                {otherUser.rating && (
                                                    <div className="text-sm text-gray-600">
                                                        ⭐ {otherUser.rating.toFixed(1)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Delivery Info */}
                                        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                                            <div>
                                                <span className="text-gray-600">Delivery Method:</span>
                                                <span className="ml-2 font-medium capitalize">
                                                    {booking.deliveryMethod}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-gray-600">Payment Status:</span>
                                                <span
                                                    className={`ml-2 font-medium capitalize ${booking.paymentStatus === "paid"
                                                        ? "text-green-600"
                                                        : "text-yellow-600"
                                                        }`}
                                                >
                                                    {booking.paymentStatus}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex items-center gap-3 pt-4 border-t">
                                            <Link
                                                to={`/messages?booking=${booking.id}`}
                                                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                                            >
                                                <MessageSquare className="w-4 h-4" />
                                                Message
                                            </Link>

                                            {isRenter && booking.status === "pending" && (
                                                <button
                                                    onClick={() => {
                                                        setSelectedBooking(booking);
                                                        setShowCancelModal(true);
                                                    }}
                                                    className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                                                >
                                                    <X className="w-4 h-4" />
                                                    Cancel
                                                </button>
                                            )}

                                            {!isRenter && booking.status === "pending" && (
                                                <>
                                                    <button
                                                        onClick={() => handleConfirmBooking(booking.id)}
                                                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                                                    >
                                                        <CheckCircle className="w-4 h-4" />
                                                        Confirm
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setSelectedBooking(booking);
                                                            setShowCancelModal(true);
                                                        }}
                                                        className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                                                    >
                                                        <X className="w-4 h-4" />
                                                        Decline
                                                    </button>
                                                </>
                                            )}

                                            {booking.status === "active" && (
                                                <button
                                                    onClick={() => handleCompleteBooking(booking.id)}
                                                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                                                >
                                                    <CheckCircle className="w-4 h-4" />
                                                    Mark as Completed
                                                </button>
                                            )}

                                            <Link
                                                to={`/bookings/${booking.id}`}
                                                className="ml-auto text-primary-600 hover:text-primary-700 font-medium"
                                            >
                                                View Details
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Cancel Modal */}
            {showCancelModal && selectedBooking && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-md w-full p-6">
                        <h3 className="text-xl font-semibold text-gray-900 mb-4">
                            Cancel Booking
                        </h3>
                        <p className="text-gray-600 mb-4">
                            Are you sure you want to cancel this booking? This action cannot
                            be undone.
                        </p>
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Reason for cancellation
                            </label>
                            <textarea
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                rows={4}
                                placeholder="Please provide a reason..."
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => {
                                    setShowCancelModal(false);
                                    setCancelReason("");
                                }}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                Keep Booking
                            </button>
                            <button
                                onClick={handleCancelBooking}
                                disabled={!cancelReason}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Cancel Booking
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
