import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link, useSearchParams, useNavigation, useRevalidator } from "react-router";
import { redirect } from "react-router";
import { useState, useMemo } from "react";
import {
  Calendar,
  Package,
  Clock,
  DollarSign,
  MessageSquare,
  X,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { bookingsApi } from "~/lib/api/bookings";
import { BookingStatus } from "~/lib/shared-types";
import type { Booking } from "~/types/booking";
import { format } from "date-fns";
import { cn } from "~/lib/utils";
import { getUser } from "~/utils/auth";
import { toast } from "~/lib/toast";
import {
  Badge,
  Card,
  CardContent,
  BookingCardSkeleton,
  EmptyStatePresets,
  RouteErrorBoundary,
  Alert,
  UnifiedButton,
  Pagination,
  Dialog,
  DialogFooter,
} from "~/components/ui";

export const meta: MetaFunction = () => {
  return [
    { title: "My Bookings - Universal Rental Portal" },
    { name: "description", content: "Manage your rental bookings" },
  ];
};

export async function clientLoader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  if (!user) {
    return redirect("/auth/login");
  }

  const url = new URL(request.url);
  const rawStatus = url.searchParams.get("status");
  const requestedView = url.searchParams.get("view") === "owner" ? "owner" : "renter";
  const canViewOwner = user.role === "owner" || user.role === "admin";
  const view = canViewOwner ? requestedView : "renter";
  const allowedStatuses = new Set([
    "pending_owner_approval",
    "pending_payment",
    "pending",
    "confirmed",
    "active",
    "return_requested",
    "completed",
    "settled",
    "cancelled",
    "disputed",
  ]);
  const status =
    rawStatus && allowedStatuses.has(rawStatus) ? rawStatus : undefined;

  try {
    const bookingsResponse =
      view === "owner"
        ? await bookingsApi.getOwnerBookings()
        : await bookingsApi.getMyBookings();
    const bookings = Array.isArray(bookingsResponse) ? bookingsResponse : [];
    const filtered =
      status
        ? bookings.filter((booking) => normalizeStatus(booking.status) === status)
        : bookings;
    return { bookings: filtered, view, status, canViewOwner, error: null };
  } catch (error) {
    console.error("Bookings error:", error);
    return {
      bookings: [],
      view,
      status,
      canViewOwner,
      error: "Failed to load bookings. Please try again.",
    };
  }
}

const STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "outline" | "destructive" | "success" | "warning"
> = {
  pending_owner_approval: "warning",
  pending_payment: "warning",
  pending: "warning",
  confirmed: "default",
  active: "success",
  return_requested: "warning",
  completed: "secondary",
  settled: "secondary",
  cancelled: "destructive",
  disputed: "destructive",
};

const STATUS_ICONS: Record<string, typeof Clock> = {
  pending_owner_approval: Clock,
  pending_payment: Clock,
  pending: Clock,
  confirmed: CheckCircle,
  active: Package,
  return_requested: AlertCircle,
  completed: CheckCircle,
  settled: CheckCircle,
  cancelled: X,
  disputed: AlertCircle,
};
const MAX_CANCELLATION_REASON_LENGTH = 1000;
const safeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const safeDateLabel = (value: unknown): string => {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? "Date unavailable" : format(date, "MMM d, yyyy");
};
const safeInitial = (value: unknown): string => {
  const name = typeof value === "string" ? value.trim() : "";
  return (name[0] || "U").toUpperCase();
};
const safeText = (value: unknown, fallback = ""): string => {
  const text = typeof value === "string" ? value : "";
  return text || fallback;
};

const normalizeStatus = (status: unknown) => {
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
  if (upper === BookingStatus.PAYMENT_FAILED) return "payment_failed";
  if (upper === BookingStatus.DISPUTED) return "disputed";
  if (upper === BookingStatus.PENDING) return "pending";
  return raw.toLowerCase();
};

export default function BookingsPage() {
  const { bookings: serverBookings, view, status, canViewOwner, error } = useLoaderData<typeof clientLoader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const isLoading = navigation.state === "loading";

  // Optimistic status overrides: bookingId -> optimistic status
  const [optimisticStatuses, setOptimisticStatuses] = useState<
    Partial<Record<string, Booking["status"]>>
  >({});

  // Apply optimistic statuses to bookings
  const bookings = useMemo(
    () =>
      serverBookings.map((b: Booking) => {
        const optimisticStatus = optimisticStatuses[b.id];
        return optimisticStatus ? { ...b, status: optimisticStatus } : b;
      }),
    [serverBookings, optimisticStatuses]
  );

  // Client-side pagination
  const ITEMS_PER_PAGE = 10;
  const currentPage = Math.max(1, Number(searchParams.get("page")) || 1);
  const totalPages = Math.ceil(bookings.length / ITEMS_PER_PAGE);
  const paginatedBookings = useMemo(
    () => bookings.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [bookings, currentPage]
  );

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(newPage));
    setSearchParams(params);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleViewChange = (newView: string) => {
    if (newView === "owner" && !canViewOwner) {
      return;
    }
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
    if (!selectedBooking) return;
    const normalizedReason = cancelReason.trim().slice(0, MAX_CANCELLATION_REASON_LENGTH);
    if (!normalizedReason) return;

    const bookingId = selectedBooking.id;
    const prevStatus = selectedBooking.status;

    // Optimistically update status
    setOptimisticStatuses((prev) => ({ ...prev, [bookingId]: "CANCELLED" }));
    setShowCancelModal(false);
    setCancelReason("");

    try {
      const statusKey = normalizeStatus(selectedBooking.status);
      if (view === "owner" && statusKey === "pending_owner_approval") {
        await bookingsApi.rejectBooking(bookingId, normalizedReason);
      } else {
        await bookingsApi.cancelBooking(bookingId, normalizedReason);
      }
      toast.success("Booking cancelled successfully");
      revalidator.revalidate();
    } catch (error) {
      console.error("Cancel error:", error);
      // Rollback optimistic update
      setOptimisticStatuses((prev) => {
        const next = { ...prev };
        delete next[bookingId];
        return next;
      });
      toast.error("Failed to cancel booking. Please try again.");
    }
  };

  const handleConfirmBooking = async (bookingId: string) => {
    // Optimistically update status
    setOptimisticStatuses((prev) => ({ ...prev, [bookingId]: "CONFIRMED" }));

    try {
      await bookingsApi.approveBooking(bookingId);
      toast.success("Booking confirmed");
      revalidator.revalidate();
    } catch (error) {
      console.error("Confirm error:", error);
      setOptimisticStatuses((prev) => {
        const next = { ...prev };
        delete next[bookingId];
        return next;
      });
      toast.error("Failed to confirm booking. Please try again.");
    }
  };

  const handleCompleteBooking = async (bookingId: string) => {
    setOptimisticStatuses((prev) => ({ ...prev, [bookingId]: "COMPLETED" }));

    try {
      await bookingsApi.approveReturn(bookingId);
      toast.success("Booking completed");
      revalidator.revalidate();
    } catch (error) {
      console.error("Complete error:", error);
      setOptimisticStatuses((prev) => {
        const next = { ...prev };
        delete next[bookingId];
        return next;
      });
      toast.error("Failed to complete booking. Please try again.");
    }
  };

  const handleStartBooking = async (bookingId: string) => {
    setOptimisticStatuses((prev) => ({ ...prev, [bookingId]: "IN_PROGRESS" }));

    try {
      await bookingsApi.startBooking(bookingId);
      toast.success("Booking started");
      revalidator.revalidate();
    } catch (error) {
      console.error("Start booking error:", error);
      setOptimisticStatuses((prev) => {
        const next = { ...prev };
        delete next[bookingId];
        return next;
      });
      toast.error("Failed to start booking. Please try again.");
    }
  };

  const handleRequestReturn = async (bookingId: string) => {
    setOptimisticStatuses((prev) => ({ ...prev, [bookingId]: "AWAITING_RETURN_INSPECTION" }));

    try {
      await bookingsApi.requestReturn(bookingId);
      toast.success("Return requested");
      revalidator.revalidate();
    } catch (error) {
      console.error("Request return error:", error);
      setOptimisticStatuses((prev) => {
        const next = { ...prev };
        delete next[bookingId];
        return next;
      });
      toast.error("Failed to request return. Please try again.");
    }
  };

  const formatDate = (dateString: string) => safeDateLabel(dateString);

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
            {canViewOwner ? (
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
            ) : null}
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
            {[
              "pending_owner_approval",
              "pending_payment",
              "confirmed",
              "active",
              "return_requested",
              "completed",
              "cancelled",
            ].map(
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
                  {s.replace(/_/g, " ")}
                </button>
              )
            )}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert
            type="error"
            title="Error Loading Bookings"
            message={error}
            className="mb-6"
          />
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <BookingCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && bookings.length === 0 && !error && (
          <Card className="p-12">
            <EmptyStatePresets.NoBookings />
          </Card>
        )}

        {/* Bookings List */}
        {!isLoading && bookings.length > 0 && (
          <div className="space-y-4">
            {paginatedBookings.map((booking) => {
              const statusKey = normalizeStatus(booking.status);
              const StatusIcon = STATUS_ICONS[statusKey] || Clock;
              const isRenter = view === "renter";
              const otherUser = isRenter ? booking.owner : booking.renter;
              const otherFirstName = safeText(otherUser?.firstName, "User");
              const otherLastName = safeText(otherUser?.lastName);
              const otherAvatar = safeText(otherUser?.avatar);
              const otherRating = safeNumber(otherUser?.rating);
              const listingTitle = safeText(booking.listing?.title, "Listing");
              const bookingId = safeText(booking.id);
              const listingId = safeText(booking.listingId);

              return (
                <Card
                  key={booking.id}
                  className="overflow-hidden hover:shadow-md transition-shadow"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-foreground">
                            {listingTitle}
                          </h3>
                          <Badge
                            variant={STATUS_VARIANTS[statusKey] || "secondary"}
                            className="inline-flex items-center gap-1"
                          >
                            <StatusIcon className="w-3 h-3" />
                            {statusKey.replace(/_/g, " ")}
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
                            {safeNumber(booking.totalDays)} days
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-4 h-4" />$
                            {safeNumber(booking.totalAmount ?? booking.totalPrice).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Listing Image */}
                      <Link
                        to={listingId ? `/listings/${listingId}` : "/listings"}
                        className="w-24 h-24 bg-muted rounded-lg overflow-hidden shrink-0"
                      >
                        {booking.listing.photos?.[0] ? (
                          <img
                            src={booking.listing.photos[0]}
                            alt={listingTitle}
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
                        {otherAvatar ? (
                          <img
                            src={otherAvatar}
                            alt={otherFirstName}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-lg font-bold text-muted-foreground">
                            {safeInitial(otherFirstName)}
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">
                          {isRenter ? "Owner" : "Renter"}: {otherFirstName}
                          {otherLastName ? ` ${otherLastName}` : ""}
                        </div>
                        {otherRating > 0 && (
                          <div className="text-sm text-muted-foreground">
                            ⭐ {otherRating.toFixed(1)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Delivery Info */}
                    <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">
                          Delivery Method:
                        </span>
                        <span className="ml-2 font-medium capitalize text-foreground">
                          {booking.deliveryMethod}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Payment Status:
                        </span>
                        <span
                          className={cn(
                            "ml-2 font-medium capitalize",
                            String(booking.paymentStatus).toUpperCase() === "PAID"
                              ? "text-success"
                              : "text-warning"
                          )}
                        >
                          {String(booking.paymentStatus).toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3 pt-4 border-t border-border">
                      <Link to={bookingId ? `/messages?booking=${bookingId}` : "/messages"}>
                        <UnifiedButton
                          variant="outline"
                          leftIcon={<MessageSquare className="w-4 h-4" />}
                        >
                          Message
                        </UnifiedButton>
                      </Link>

                      {isRenter && ["pending_owner_approval", "pending_payment", "pending"].includes(statusKey) && (
                        <UnifiedButton
                          variant="destructive"
                          onClick={() => {
                            setSelectedBooking(booking);
                            setShowCancelModal(true);
                          }}
                          leftIcon={<X className="w-4 h-4" />}
                        >
                          Cancel
                        </UnifiedButton>
                      )}

                      {!isRenter && statusKey === "pending_owner_approval" && (
                        <>
                          <UnifiedButton
                            onClick={() => {
                              if (bookingId) {
                                handleConfirmBooking(bookingId);
                              }
                            }}
                            variant="success"
                            leftIcon={<CheckCircle className="w-4 h-4" />}
                          >
                            Confirm
                          </UnifiedButton>
                          <UnifiedButton
                            variant="destructive"
                            onClick={() => {
                              setSelectedBooking(booking);
                              setShowCancelModal(true);
                            }}
                            leftIcon={<X className="w-4 h-4" />}
                          >
                            Decline
                          </UnifiedButton>
                        </>
                      )}

                      {isRenter && ["pending_payment", "pending"].includes(statusKey) && (
                        <Link to={bookingId ? `/checkout/${bookingId}` : "/bookings"}>
                          <UnifiedButton leftIcon={<DollarSign className="w-4 h-4" />}>
                            Pay Now
                          </UnifiedButton>
                        </Link>
                      )}

                      {!isRenter && statusKey === "confirmed" && (
                        <UnifiedButton
                          onClick={() => {
                            if (bookingId) {
                              handleStartBooking(bookingId);
                            }
                          }}
                          leftIcon={<CheckCircle className="w-4 h-4" />}
                        >
                          Start Booking
                        </UnifiedButton>
                      )}

                      {!isRenter && statusKey === "return_requested" && (
                        <UnifiedButton
                          onClick={() => {
                            if (bookingId) {
                              handleCompleteBooking(bookingId);
                            }
                          }}
                          leftIcon={<CheckCircle className="w-4 h-4" />}
                        >
                          Approve Return
                        </UnifiedButton>
                      )}

                      {isRenter && statusKey === "active" && (
                        <UnifiedButton
                          onClick={() => {
                            if (bookingId) {
                              handleRequestReturn(bookingId);
                            }
                          }}
                          leftIcon={<CheckCircle className="w-4 h-4" />}
                        >
                          Request Return
                        </UnifiedButton>
                      )}

                      <Link
                        to={bookingId ? `/bookings/${bookingId}` : "/bookings"}
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

        {/* Pagination */}
        {!isLoading && bookings.length > ITEMS_PER_PAGE && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            className="mt-6"
          />
        )}
      </div>

      {/* Cancel Modal */}
      <Dialog
        open={showCancelModal && !!selectedBooking}
        onClose={() => {
          setShowCancelModal(false);
          setCancelReason("");
        }}
        title="Cancel Booking"
        description="Are you sure you want to cancel this booking? This action cannot be undone."
        size="md"
      >
        <div className="mb-6">
          <label className="block text-sm font-medium text-foreground mb-2">
            Reason for cancellation
          </label>
          <textarea
            value={cancelReason}
            onChange={(e) =>
              setCancelReason(e.target.value.slice(0, MAX_CANCELLATION_REASON_LENGTH))
            }
            rows={4}
            placeholder="Please provide a reason..."
            className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
          />
        </div>
        <DialogFooter>
          <UnifiedButton
            variant="outline"
            onClick={() => {
              setShowCancelModal(false);
              setCancelReason("");
            }}
            className="flex-1"
          >
            Keep Booking
          </UnifiedButton>
          <UnifiedButton
            variant="destructive"
            onClick={handleCancelBooking}
            disabled={cancelReason.trim().length === 0}
            className="flex-1"
          >
            Cancel Booking
          </UnifiedButton>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

// Error boundary for route errors
export { RouteErrorBoundary as ErrorBoundary };

