import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import {
  useLoaderData,
  Link,
  useSearchParams,
  useNavigation,
  useRevalidator,
} from "react-router";
import { redirect } from "react-router";
import { useState, useMemo } from "react";
import {
  Calendar,
  Package,
  Clock,
  Banknote,
  MessageSquare,
  X,
  CheckCircle,
  AlertCircle,
  Star,
} from "lucide-react";
import { bookingsApi } from "~/lib/api/bookings";
import { BookingStatus } from "~/lib/shared-types";
import type { Booking } from "~/types/booking";
import { useAuthStore } from "~/lib/store/auth";
import { format } from "date-fns";
import { cn } from "~/lib/utils";
import { formatCurrency } from "~/lib/utils";
import { getUser } from "~/utils/auth";
import { toast } from "~/lib/toast";
import { useTranslation } from "react-i18next";
import { PortalPageLayout } from "~/components/layout";
import {
  getPortalNavSections,
  resolvePortalNavRole,
} from "~/config/navigation";
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
    { title: "My Bookings | GharBatai Rentals" },
    { name: "description", content: "Manage your rental bookings" },
  ];
};

export async function clientLoader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  if (!user) {
    return redirect("/auth/login");
  }
  const portalRole = resolvePortalNavRole(user.role);

  const url = new URL(request.url);
  const rawStatus = url.searchParams.get("status");
  const requestedView =
    url.searchParams.get("view") === "owner" ? "owner" : "renter";
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
    const filtered = status
      ? bookings.filter((booking) => normalizeStatus(booking.status) === status)
      : bookings;
    return {
      bookings: filtered,
      view,
      status,
      canViewOwner,
      portalRole,
      error: null,
    };
  } catch (error) {
    return {
      bookings: [],
      view,
      status,
      canViewOwner,
      portalRole,
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
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : format(date, "MMM d, yyyy");
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
  if (upper === BookingStatus.PENDING_OWNER_APPROVAL)
    return "pending_owner_approval";
  if (upper === BookingStatus.PENDING_PAYMENT) return "pending_payment";
  if (upper === BookingStatus.IN_PROGRESS) return "active";
  if (upper === BookingStatus.AWAITING_RETURN_INSPECTION)
    return "return_requested";
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
  const { t } = useTranslation();
  const statusLabel = (s: string): string => {
    const map: Record<string, string> = {
      pending_owner_approval: t("bookings.status.pendingApproval"),
      pending_payment: t("bookings.status.pendingPayment"),
      pending: t("bookings.status.pending"),
      confirmed: t("bookings.status.confirmed"),
      active: t("bookings.status.inProgress"),
      return_requested: t(
        "bookings.status.returnRequested",
        "Return Requested"
      ),
      completed: t("bookings.status.completed"),
      settled: t("bookings.status.settled", "Settled"),
      cancelled: t("bookings.status.cancelled"),
      disputed: t("bookings.status.disputed", "Disputed"),
    };
    return map[s] ?? s.replace(/_/g, " ");
  };
  const {
    bookings: serverBookings,
    view,
    status,
    canViewOwner,
    portalRole,
    error,
  } = useLoaderData<typeof clientLoader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const isLoading = navigation.state === "loading";
  const { user: currentUser } = useAuthStore();

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
    () =>
      bookings.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
      ),
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
    const normalizedReason = cancelReason
      .trim()
      .slice(0, MAX_CANCELLATION_REASON_LENGTH);
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
      setOptimisticStatuses((prev) => {
        const next = { ...prev };
        delete next[bookingId];
        return next;
      });
      toast.error("Failed to start booking. Please try again.");
    }
  };

  const handleRequestReturn = async (bookingId: string) => {
    setOptimisticStatuses((prev) => ({
      ...prev,
      [bookingId]: "AWAITING_RETURN_INSPECTION",
    }));

    try {
      await bookingsApi.requestReturn(bookingId);
      toast.success("Return requested");
      revalidator.revalidate();
    } catch (error) {
      setOptimisticStatuses((prev) => {
        const next = { ...prev };
        delete next[bookingId];
        return next;
      });
      toast.error("Failed to request return. Please try again.");
    }
  };

  const formatDate = (dateString: string) => safeDateLabel(dateString);
  const headerTitle =
    portalRole === "owner"
      ? t("bookings.ownerTitle", "Booking Center")
      : t("bookings.title", "My Bookings");
  const headerDescription =
    view === "owner"
      ? "Review requests, active rentals, and return milestones."
      : "Track reservations, payment steps, and return windows.";

  return (
    <PortalPageLayout
      title={headerTitle}
      description={headerDescription}
      sidebarSections={getPortalNavSections(portalRole)}
      banner={
        error ? (
          <Alert type="error" title="Error Loading Bookings" message={error} />
        ) : null
      }
      containerSize="large"
      contentClassName="space-y-6"
    >
      {/* View Toggle */}
      <div>
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
            {t("bookings.myRentals", "My Rentals")}
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
              {t("dashboard.myListings")}
            </button>
          ) : null}
        </div>
      </div>

      {/* Status Filters */}
      <div>
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
            {t("bookings.filterAll", "All")}
          </button>
          {[
            "pending_owner_approval",
            "pending_payment",
            "confirmed",
            "active",
            "return_requested",
            "completed",
            "cancelled",
          ].map((s) => (
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
              {statusLabel(s)}
            </button>
          ))}
        </div>
      </div>

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
            const listingImage =
              booking.listing?.images?.[0];

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
                          {statusLabel(statusKey)}
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
                          {safeNumber(booking.totalDays)}{" "}
                          {t("bookings.details.days")}
                        </span>
                        <span className="flex items-center gap-1">
                          {formatCurrency(
                            safeNumber(
                              booking.totalAmount ?? booking.totalPrice
                            )
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Listing Image — links to booking detail */}
                    <Link
                      to={bookingId ? `/bookings/${bookingId}` : "/bookings"}
                      className="w-24 h-24 bg-muted rounded-lg overflow-hidden shrink-0"
                    >
                      {listingImage ? (
                        <img
                          src={listingImage}
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
                        {isRenter
                          ? t("listings.detail.owner", "Owner")
                          : t("bookings.renter", "Renter")}
                        : {otherFirstName}
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
                        {t("listings.detail.deliveryMethod", "Delivery Method")}
                        :
                      </span>
                      <span className="ml-2 font-medium capitalize text-foreground">
                        {booking.deliveryMethod}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        {t("bookings.details.paymentStatus", "Payment Status")}:
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
                    <Link
                      to={
                        bookingId
                          ? `/messages?booking=${bookingId}`
                          : "/messages"
                      }
                    >
                      <UnifiedButton
                        variant="outline"
                        leftIcon={<MessageSquare className="w-4 h-4" />}
                      >
                        {t("bookings.actions.message", "Message")}
                      </UnifiedButton>
                    </Link>

                    {isRenter &&
                      [
                        "pending_owner_approval",
                        "pending_payment",
                        "pending",
                        "confirmed",
                      ].includes(statusKey) && (
                        <UnifiedButton
                          variant="destructive"
                          onClick={() => {
                            setSelectedBooking(booking);
                            setShowCancelModal(true);
                          }}
                          leftIcon={<X className="w-4 h-4" />}
                        >
                          {t("common.cancel")}
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
                          {t("common.confirm")}
                        </UnifiedButton>
                        <UnifiedButton
                          variant="destructive"
                          onClick={() => {
                            setSelectedBooking(booking);
                            setShowCancelModal(true);
                          }}
                          leftIcon={<X className="w-4 h-4" />}
                        >
                          {t("bookings.actions.decline", "Decline")}
                        </UnifiedButton>
                      </>
                    )}

                    {isRenter &&
                      ["pending_payment", "pending"].includes(statusKey) && (
                        <Link
                          to={
                            bookingId ? `/checkout/${bookingId}` : "/bookings"
                          }
                        >
                          <UnifiedButton
                            leftIcon={<Banknote className="w-4 h-4" />}
                          >
                            {t("bookings.details.payNow")}
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
                        {t("bookings.actions.startBooking", "Start Booking")}
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
                        {t("bookings.actions.approveReturn", "Approve Return")}
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
                        {t("bookings.actions.requestReturn", "Request Return")}
                      </UnifiedButton>
                    )}

                    {["completed", "settled"].includes(statusKey) &&
                      !(booking.review && (booking.review as any).reviewerId === currentUser?.id) && (
                        <Link
                          to={bookingId ? `/bookings/${bookingId}` : "/bookings"}
                          className="flex items-center gap-1 text-sm font-medium text-warning hover:text-warning/80 transition-colors"
                          title={t("bookings.actions.leaveReview", "Leave a Review")}
                        >
                          <Star className="w-4 h-4 fill-current" />
                          {t("bookings.actions.leaveReview", "Review")}
                        </Link>
                      )}
                    <Link
                      to={bookingId ? `/bookings/${bookingId}` : "/bookings"}
                      className="ml-auto text-primary hover:text-primary/90 font-medium transition-colors"
                    >
                      {t("bookings.actions.viewDetails", "View Details")}
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

      {/* Cancel Modal */}
      <Dialog
        open={showCancelModal && !!selectedBooking}
        onClose={() => {
          setShowCancelModal(false);
          setCancelReason("");
        }}
        title={t("bookings.details.cancelBooking")}
        description={t(
          "bookings.cancelConfirmation",
          "Are you sure you want to cancel this booking? This action cannot be undone."
        )}
        size="md"
      >
        <div className="mb-6">
          <label className="block text-sm font-medium text-foreground mb-2">
            {t("bookings.cancelReason", "Reason for cancellation")}
          </label>
          <textarea
            value={cancelReason}
            onChange={(e) =>
              setCancelReason(
                e.target.value.slice(0, MAX_CANCELLATION_REASON_LENGTH)
              )
            }
            rows={4}
            placeholder={t(
              "bookings.cancelPlaceholder",
              "Please provide a reason..."
            )}
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
            {t("bookings.keepBooking", "Keep Booking")}
          </UnifiedButton>
          <UnifiedButton
            variant="destructive"
            onClick={handleCancelBooking}
            disabled={cancelReason.trim().length === 0}
            className="flex-1"
          >
            {t("bookings.details.cancelBooking")}
          </UnifiedButton>
        </DialogFooter>
      </Dialog>
    </PortalPageLayout>
  );
}

// Error boundary for route errors
export { RouteErrorBoundary as ErrorBoundary };
