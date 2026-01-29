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
import { cn } from "~/lib/utils";
import { Button, Badge } from "~/components/ui";
import { Card, CardContent } from "~/components/ui";

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

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive" | "success" | "warning"> = {
    pending: "warning",
    confirmed: "default",
    active: "success",
    completed: "secondary",
    cancelled: "destructive",
    disputed: "destructive",
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
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="bg-card border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <Link to="/" className="text-xl font-bold text-primary">
                            Rental Portal
                        </Link>
                        <Link
                            to="/dashboard"
                            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Dashboard
                        </Link>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* View Toggle */}
                <div className="mb-6">
                    <div className="flex items-center gap-2 bg-card rounded-lg border p-1">
                        <button
                            onClick={() => handleViewChange("renter")}
                            className={cn(
                                "flex-1 px-4 py-2 rounded-md font-medium transition-colors",
                                view === "renter"
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:bg-muted"
                            )}
                        >
                            My Rentals
                        </button>
                        <button
                            onClick={() => handleViewChange("owner")}
                            className={cn(
                                "flex-1 px-4 py-2 rounded-md font-medium transition-colors",
                                view === "owner"
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:bg-muted"
                            )}
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
                            className={cn(
                                "px-4 py-2 rounded-lg whitespace-nowrap transition-colors",
                                !status
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-card text-foreground border hover:bg-muted"
                            )}
                        >
                            All
                        </button>
                        {["pending", "confirmed", "active", "completed", "cancelled"].map(
                            (s) => (
                                <button
                                    key={s}
                                    onClick={() => handleStatusFilter(s)}
                                    className={cn(
                                        "px-4 py-2 rounded-lg capitalize whitespace-nowrap transition-colors",
                                        status === s
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-card text-foreground border hover:bg-muted"
                                    )}
                                >
                                    {s}
                                </button>
                            )
                        )}
                    </div>
                </div>

                {/* Bookings List */}
                {bookings.length === 0 ? (
                    <Card className="p-12 text-center">
                        <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-foreground mb-2">
                            No bookings found
                        </h3>
                        <p className="text-muted-foreground mb-4">
                            {view === "renter"
                                ? "Start browsing and book your first rental"
                                : "Your listings don't have any bookings yet"}
                        </p>
                        <Link
                            to={view === "renter" ? "/search" : "/listings/new"}
                        >
                            <Button>
                                {view === "renter" ? "Browse Rentals" : "Create Listing"}
                            </Button>
                        </Link>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {bookings.map((booking) => {
                            const StatusIcon = STATUS_ICONS[booking.status];
                            const isRenter = view === "renter";
                            const otherUser = isRenter ? booking.owner : booking.renter;

                            return (
                                <Card key={booking.id} className="overflow-hidden hover:shadow-md transition-shadow">
                                    <CardContent className="p-6">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <h3 className="text-lg font-semibold text-foreground">
                                                        {booking.listing.title}
                                                    </h3>
                                                    <Badge variant={STATUS_VARIANTS[booking.status]} className="inline-flex items-center gap-1">
                                                        <StatusIcon className="w-3 h-3" />
                                                        {booking.status}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
                                                className="w-24 h-24 bg-muted rounded-lg overflow-hidden shrink-0"
                                            >
                                                {booking.listing.images[0] ? (
                                                    <img
                                                        src={booking.listing.images[0]}
                                                        alt={booking.listing.title}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <Package className="w-8 h-8 text-muted-foreground" />
                                                    </div>
                                                )}
                                            </Link>
                                        </div>

                                        {/* Other User Info */}
                                        <div className="flex items-center gap-3 mb-4 p-3 bg-muted rounded-lg">
                                            <div className="w-10 h-10 bg-muted-foreground/20 rounded-full flex items-center justify-center">
                                                {otherUser.avatar ? (
                                                    <img
                                                        src={otherUser.avatar}
                                                        alt={otherUser.firstName}
                                                        className="w-full h-full rounded-full object-cover"
                                                    />
                                                ) : (
                                                    <span className="text-lg font-bold text-muted-foreground">
                                                        {otherUser.firstName[0]}
                                                    </span>
                                                )}
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-foreground">
                                                    {isRenter ? "Owner" : "Renter"}:{" "}
                                                    {otherUser.firstName} {otherUser.lastName}
                                                </div>
                                                {otherUser.rating && (
                                                    <div className="text-sm text-muted-foreground">
                                                        ⭐ {otherUser.rating.toFixed(1)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Delivery Info */}
                                        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                                            <div>
                                                <span className="text-muted-foreground">Delivery Method:</span>
                                                <span className="ml-2 font-medium capitalize text-foreground">
                                                    {booking.deliveryMethod}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">Payment Status:</span>
                                                <span
                                                    className={cn(
                                                        "ml-2 font-medium capitalize",
                                                        booking.paymentStatus === "paid"
                                                            ? "text-success"
                                                            : "text-warning"
                                                    )}
                                                >
                                                    {booking.paymentStatus}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex items-center gap-3 pt-4 border-t border-border">
                                            <Link to={`/messages?booking=${booking.id}`}>
                                                <Button variant="outline" className="flex items-center gap-2">
                                                    <MessageSquare className="w-4 h-4" />
                                                    Message
                                                </Button>
                                            </Link>

                                            {isRenter && booking.status === "pending" && (
                                                <Button
                                                    variant="destructive"
                                                    onClick={() => {
                                                        setSelectedBooking(booking);
                                                        setShowCancelModal(true);
                                                    }}
                                                    className="flex items-center gap-2"
                                                >
                                                    <X className="w-4 h-4" />
                                                    Cancel
                                                </Button>
                                            )}

                                            {!isRenter && booking.status === "pending" && (
                                                <>
                                                    <Button
                                                        onClick={() => handleConfirmBooking(booking.id)}
                                                        className="flex items-center gap-2 bg-success hover:bg-success/90 text-success-foreground"
                                                    >
                                                        <CheckCircle className="w-4 h-4" />
                                                        Confirm
                                                    </Button>
                                                    <Button
                                                        variant="destructive"
                                                        onClick={() => {
                                                            setSelectedBooking(booking);
                                                            setShowCancelModal(true);
                                                        }}
                                                        className="flex items-center gap-2"
                                                    >
                                                        <X className="w-4 h-4" />
                                                        Decline
                                                    </Button>
                                                </>
                                            )}

                                            {booking.status === "active" && (
                                                <Button
                                                    onClick={() => handleCompleteBooking(booking.id)}
                                                    className="flex items-center gap-2"
                                                >
                                                    <CheckCircle className="w-4 h-4" />
                                                    Mark as Completed
                                                </Button>
                                            )}

                                            <Link
                                                to={`/bookings/${booking.id}`}
                                                className="ml-auto text-primary hover:text-primary/90 font-medium transition-colors"
                                            >
                                                View Details
                                            </Link>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Cancel Modal */}
            {showCancelModal && selectedBooking && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="max-w-md w-full">
                        <CardContent className="p-6">
                            <h3 className="text-xl font-semibold text-foreground mb-4">
                                Cancel Booking
                            </h3>
                            <p className="text-muted-foreground mb-4">
                                Are you sure you want to cancel this booking? This action cannot
                                be undone.
                            </p>
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-foreground mb-2">
                                    Reason for cancellation
                                </label>
                                <textarea
                                    value={cancelReason}
                                    onChange={(e) => setCancelReason(e.target.value)}
                                    rows={4}
                                    placeholder="Please provide a reason..."
                                    className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setShowCancelModal(false);
                                        setCancelReason("");
                                    }}
                                    className="flex-1"
                                >
                                    Keep Booking
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={handleCancelBooking}
                                    disabled={!cancelReason}
                                    className="flex-1"
                                >
                                    Cancel Booking
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
