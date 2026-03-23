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
import type { Booking, BookingTransition } from "~/types/booking";
import { useAuthStore } from "~/lib/store/auth";
import { format } from "date-fns";
import { cn } from "~/lib/utils";
import { formatCurrency } from "~/lib/utils";
import { getUser } from "~/utils/auth";
import { toast } from "~/lib/toast";
import { useTranslation } from "react-i18next";
import { ApiErrorType, getActionableErrorMessage } from "~/lib/api-error";
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

type BookingWithTransitions = Booking & {
  availableTransitions: BookingTransition[];
};

type BookingModalIntent = "cancel" | "reject";

export function getBookingsActionError(
  error: unknown,
  fallbackMessage: string
): string {
  const responseMessage =
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message === "string"
      ? (error as { response: { data: { message: string } } }).response.data.message
      : null;

  return (
    responseMessage ||
    getActionableErrorMessage(error, fallbackMessage, {
      [ApiErrorType.CONFLICT]: "This booking changed while you were working. Refresh and review the latest status before trying again.",
      [ApiErrorType.OFFLINE]: "You appear to be offline. Reconnect and try again.",
      [ApiErrorType.TIMEOUT_ERROR]: "The booking request timed out. Refresh and try again.",
      [ApiErrorType.NETWORK_ERROR]: "We could not reach the server. Try again in a moment.",
    })
  );
}

export function getBookingsLoadError(error: unknown): string {
  const responseMessage =
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message === "string"
      ? (error as { response: { data: { message: string } } }).response.data.message
      : null;

  if (responseMessage) {
    return responseMessage;
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You appear to be offline. Reconnect and try loading bookings again.";
  }

  return getActionableErrorMessage(error, "Failed to load bookings. Please try again.", {
    [ApiErrorType.OFFLINE]: "You appear to be offline. Reconnect and try loading bookings again.",
    [ApiErrorType.TIMEOUT_ERROR]: "Loading bookings timed out. Try again.",
    [ApiErrorType.NETWORK_ERROR]: "We could not reach the booking service. Try again in a moment.",
  });
}

export function getBookingsUnavailableActionError(
  intent: BookingModalIntent
): string {
  if (intent === "reject") {
    return "This booking request no longer needs a decline action. Refresh and review the latest booking status.";
  }

  return "This booking can no longer be cancelled from the list. Refresh and review the latest booking status.";
}

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
    "payment_failed",
    "refunded",
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
    const bookingsWithTransitions: BookingWithTransitions[] = await Promise.all(
      filtered.map(async (booking) => {
        const transitions = booking.id
          ? await bookingsApi
              .getAvailableTransitions(booking.id)
              .catch(() => ({ availableTransitions: [] }))
          : { availableTransitions: [] };
        return {
          ...booking,
          availableTransitions: Array.isArray(transitions.availableTransitions)
            ? transitions.availableTransitions
            : [],
        };
      })
    );
    return {
      bookings: bookingsWithTransitions,
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
      error: getBookingsLoadError(error),
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
  payment_failed: "destructive",
  refunded: "secondary",
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
  payment_failed: AlertCircle,
  refunded: Banknote,
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
  if (upper === BookingStatus.REFUNDED) return "refunded";
  if (upper === BookingStatus.DISPUTED) return "disputed";
  if (upper === BookingStatus.PENDING) return "pending";
  return raw.toLowerCase();
};

const getBookingStateGuidance = (
  statusKey: string,
  isRenter: boolean
): { title: string; description: string; tone: string } => {
  switch (statusKey) {
    case "pending_owner_approval":
      return isRenter
        ? {
            title: "Waiting for owner approval",
            description: "The owner still needs to accept this request before payment can be completed.",
            tone: "border-yellow-200 bg-yellow-50 text-yellow-900",
          }
        : {
            title: "Decision needed",
            description: "Review the request, then confirm or decline so the renter knows the next step.",
            tone: "border-yellow-200 bg-yellow-50 text-yellow-900",
          };
    case "pending_payment":
      return {
        title: "Payment still required",
        description: "This booking is not confirmed until payment is completed.",
        tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
      };
    case "payment_failed":
      return {
        title: "Payment failed",
        description: "Retry payment to keep the booking active before it expires.",
        tone: "border-red-200 bg-red-50 text-red-900",
      };
    case "confirmed":
      return isRenter
        ? {
            title: "Booking confirmed",
            description: "Coordinate pickup or delivery with the owner. The owner will start the rental after handoff.",
            tone: "border-blue-200 bg-blue-50 text-blue-900",
          }
        : {
            title: "Ready for handoff",
            description: "Start the booking once the renter has received the item.",
            tone: "border-blue-200 bg-blue-50 text-blue-900",
          };
    case "active":
      return isRenter
        ? {
            title: "Rental in progress",
            description: "When you are done, request return so the owner can inspect the item.",
            tone: "border-amber-200 bg-amber-50 text-amber-900",
          }
        : {
            title: "Rental in progress",
            description: "Keep an eye on messages and be ready for the renter's return request.",
            tone: "border-amber-200 bg-amber-50 text-amber-900",
          };
    case "return_requested":
      return isRenter
        ? {
            title: "Waiting for inspection",
            description: "The owner still needs to inspect the return and approve it.",
            tone: "border-amber-200 bg-amber-50 text-amber-900",
          }
        : {
            title: "Inspect the return",
            description: "Approve the return if everything looks right, or report damage if something is wrong.",
            tone: "border-amber-200 bg-amber-50 text-amber-900",
          };
    case "completed":
      return {
        title: "Return approved",
        description: "This rental is complete. Settlement or any follow-up review comes next.",
        tone: "border-slate-200 bg-slate-50 text-slate-900",
      };
    case "settled":
      return {
        title: "Fully settled",
        description: "Funds and return flow are complete for this booking.",
        tone: "border-slate-200 bg-slate-50 text-slate-900",
      };
    case "refunded":
      return {
        title: "Refund completed",
        description: "The payment has been refunded and no further booking action is required.",
        tone: "border-sky-200 bg-sky-50 text-sky-900",
      };
    case "disputed":
      return {
        title: "Operator review in progress",
        description: "A dispute is open. Use the booking details page to follow updates and next steps.",
        tone: "border-rose-200 bg-rose-50 text-rose-900",
      };
    case "cancelled":
      return {
        title: "Booking cancelled",
        description: "This booking is closed. Open the details page if you need refund or dispute history.",
        tone: "border-slate-200 bg-slate-50 text-slate-900",
      };
    default:
      return {
        title: "Booking update",
        description: "Open the booking details page to see the latest state and actions.",
        tone: "border-slate-200 bg-slate-50 text-slate-900",
      };
  }
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
      payment_failed: t("bookings.status.paymentFailed", "Payment Failed"),
      refunded: t("bookings.status.refunded", "Refunded"),
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
  const [selectedBooking, setSelectedBooking] = useState<BookingWithTransitions | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [modalIntent, setModalIntent] = useState<BookingModalIntent>("cancel");
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);
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
      serverBookings.map((b: BookingWithTransitions) => {
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

  const closeCancelModal = () => {
    if (pendingActionKey) {
      return;
    }
    setShowCancelModal(false);
    setSelectedBooking(null);
    setCancelReason("");
    setModalIntent("cancel");
  };

  const openCancelModal = (
    booking: BookingWithTransitions,
    intent: BookingModalIntent
  ) => {
    if (pendingActionKey) {
      return;
    }
    setSelectedBooking(booking);
    setModalIntent(intent);
    setCancelReason("");
    setShowCancelModal(true);
  };

  const runBookingAction = async ({
    bookingId,
    intent,
    optimisticStatus,
    action,
    successMessage,
    fallbackErrorMessage,
  }: {
    bookingId: string;
    intent: string;
    optimisticStatus: Booking["status"];
    action: () => Promise<unknown>;
    successMessage: string;
    fallbackErrorMessage: string;
  }) => {
    const actionKey = `${bookingId}:${intent}`;
    if (pendingActionKey) {
      return;
    }

    setPendingActionKey(actionKey);
    setOptimisticStatuses((prev) => ({ ...prev, [bookingId]: optimisticStatus }));

    try {
      await action();
      toast.success(successMessage);
      revalidator.revalidate();
    } catch (error) {
      setOptimisticStatuses((prev) => {
        const next = { ...prev };
        delete next[bookingId];
        return next;
      });
      toast.error(getBookingsActionError(error, fallbackErrorMessage));
    } finally {
      setPendingActionKey(null);
    }
  };

  const handleCancelBooking = async () => {
    if (!selectedBooking) return;
    const normalizedReason = cancelReason
      .trim()
      .slice(0, MAX_CANCELLATION_REASON_LENGTH);
    if (!normalizedReason) return;

    const bookingId = selectedBooking.id;
    const transitionSet = new Set<BookingTransition>(
      selectedBooking.availableTransitions ?? []
    );
    const actionIntent = modalIntent === "reject" ? "reject" : "cancel";

    closeCancelModal();

    if (actionIntent === "reject" && transitionSet.has("OWNER_REJECT")) {
      await runBookingAction({
        bookingId,
        intent: actionIntent,
        optimisticStatus: "CANCELLED",
        action: () => bookingsApi.rejectBooking(bookingId, normalizedReason),
        successMessage: "Booking declined successfully",
        fallbackErrorMessage: "Failed to decline booking. Please try again.",
      });
      return;
    }

    if (transitionSet.has("CANCEL")) {
      await runBookingAction({
        bookingId,
        intent: actionIntent,
        optimisticStatus: "CANCELLED",
        action: () => bookingsApi.cancelBooking(bookingId, normalizedReason),
        successMessage: "Booking cancelled successfully",
        fallbackErrorMessage: "Failed to cancel booking. Please try again.",
      });
      return;
    }

    toast.error(getBookingsUnavailableActionError(actionIntent));
  };

  const handleConfirmBooking = async (bookingId: string) => {
    await runBookingAction({
      bookingId,
      intent: "confirm",
      optimisticStatus: "CONFIRMED",
      action: () => bookingsApi.approveBooking(bookingId),
      successMessage: "Booking confirmed",
      fallbackErrorMessage: "Failed to confirm booking. Please try again.",
    });
  };

  const handleCompleteBooking = async (bookingId: string) => {
    await runBookingAction({
      bookingId,
      intent: "complete",
      optimisticStatus: "COMPLETED",
      action: () => bookingsApi.approveReturn(bookingId),
      successMessage: "Booking completed",
      fallbackErrorMessage: "Failed to complete booking. Please try again.",
    });
  };

  const handleStartBooking = async (bookingId: string) => {
    await runBookingAction({
      bookingId,
      intent: "start",
      optimisticStatus: "IN_PROGRESS",
      action: () => bookingsApi.startBooking(bookingId),
      successMessage: "Booking started",
      fallbackErrorMessage: "Failed to start booking. Please try again.",
    });
  };

  const handleRequestReturn = async (bookingId: string) => {
    await runBookingAction({
      bookingId,
      intent: "request_return",
      optimisticStatus: "AWAITING_RETURN_INSPECTION",
      action: () => bookingsApi.requestReturn(bookingId),
      successMessage: "Return requested",
      fallbackErrorMessage: "Failed to request return. Please try again.",
    });
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
          <div className="space-y-3">
            <Alert type="error" title="Error Loading Bookings" message={error} />
            <UnifiedButton variant="outline" onClick={() => revalidator.revalidate()}>
              {t("errors.tryAgain", "Try Again")}
            </UnifiedButton>
          </div>
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
            "payment_failed",
            "confirmed",
            "active",
            "return_requested",
            "completed",
            "settled",
            "refunded",
            "disputed",
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
          {status ? (
            <EmptyStatePresets.NoBookingsFiltered
              statusLabel={statusLabel(status)}
              onClearFilter={() => handleStatusFilter("")}
            />
          ) : (
            <EmptyStatePresets.NoBookings />
          )}
        </Card>
      )}

      {/* Bookings List */}
      {!isLoading && bookings.length > 0 && (
        <div className="space-y-4">
          {paginatedBookings.map((booking) => {
            const statusKey = normalizeStatus(booking.status);
            const StatusIcon = STATUS_ICONS[statusKey] || Clock;
            const isRenter = view === "renter";
            const transitionSet = new Set<BookingTransition>(
              booking.availableTransitions ?? []
            );
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
            const guidance = getBookingStateGuidance(statusKey, isRenter);
            const paymentStatusLabel = String(booking.paymentStatus).toUpperCase();
            const bookingActionPending =
              pendingActionKey !== null && pendingActionKey.startsWith(`${bookingId}:`);
            const paymentStatusTone =
              paymentStatusLabel === "PAID"
                ? "text-success"
                : paymentStatusLabel === "REFUNDED"
                ? "text-blue-700"
                : paymentStatusLabel === "FAILED"
                ? "text-destructive"
                : "text-warning";

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
                          paymentStatusTone
                        )}
                      >
                        {paymentStatusLabel}
                      </span>
                    </div>
                  </div>

                  <div className={cn("mb-4 rounded-lg border px-4 py-3", guidance.tone)}>
                    <p className="text-sm font-semibold">{guidance.title}</p>
                    <p className="mt-1 text-sm opacity-90">{guidance.description}</p>
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
                        disabled={bookingActionPending}
                      >
                        {t("bookings.actions.message", "Message")}
                      </UnifiedButton>
                    </Link>

                    {transitionSet.has("CANCEL") && (
                        <UnifiedButton
                          variant="destructive"
                          onClick={() => openCancelModal(booking, "cancel")}
                          leftIcon={<X className="w-4 h-4" />}
                          disabled={bookingActionPending}
                        >
                          {t("common.cancel")}
                        </UnifiedButton>
                      )}

                    {transitionSet.has("OWNER_APPROVE") && (
                      <>
                        <UnifiedButton
                          onClick={() => {
                            if (bookingId) {
                              void handleConfirmBooking(bookingId);
                            }
                          }}
                          variant="success"
                          leftIcon={<CheckCircle className="w-4 h-4" />}
                          loading={pendingActionKey === `${bookingId}:confirm`}
                          disabled={bookingActionPending}
                        >
                          {t("common.confirm")}
                        </UnifiedButton>
                        <UnifiedButton
                          variant="destructive"
                          onClick={() => openCancelModal(booking, "reject")}
                          leftIcon={<X className="w-4 h-4" />}
                          disabled={bookingActionPending}
                        >
                          {t("bookings.actions.decline", "Decline")}
                        </UnifiedButton>
                      </>
                    )}

                    {isRenter &&
                      ["pending_payment", "payment_failed", "pending"].includes(statusKey) && (
                        <Link
                          to={
                            bookingId ? `/checkout/${bookingId}` : "/bookings"
                          }
                        >
                          <UnifiedButton
                            leftIcon={<Banknote className="w-4 h-4" />}
                            disabled={bookingActionPending}
                          >
                            {statusKey === "payment_failed"
                              ? t("bookings.actions.retryPayment", "Retry Payment")
                              : t("bookings.details.payNow")}
                          </UnifiedButton>
                        </Link>
                      )}

                    {transitionSet.has("START_RENTAL") && (
                      <UnifiedButton
                        onClick={() => {
                          if (bookingId) {
                            void handleStartBooking(bookingId);
                          }
                        }}
                        leftIcon={<CheckCircle className="w-4 h-4" />}
                        loading={pendingActionKey === `${bookingId}:start`}
                        disabled={bookingActionPending}
                      >
                        {t("bookings.actions.startBooking", "Start Booking")}
                      </UnifiedButton>
                    )}

                    {transitionSet.has("APPROVE_RETURN") && (
                      <UnifiedButton
                        onClick={() => {
                          if (bookingId) {
                            void handleCompleteBooking(bookingId);
                          }
                        }}
                        leftIcon={<CheckCircle className="w-4 h-4" />}
                        loading={pendingActionKey === `${bookingId}:complete`}
                        disabled={bookingActionPending}
                      >
                        {t("bookings.actions.approveReturn", "Approve Return")}
                      </UnifiedButton>
                    )}

                    {transitionSet.has("REQUEST_RETURN") && (
                      <UnifiedButton
                        onClick={() => {
                          if (bookingId) {
                            void handleRequestReturn(bookingId);
                          }
                        }}
                        leftIcon={<CheckCircle className="w-4 h-4" />}
                        loading={pendingActionKey === `${bookingId}:request_return`}
                        disabled={bookingActionPending}
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
        onClose={closeCancelModal}
        title={
          modalIntent === "reject"
            ? t("bookings.actions.decline", "Decline")
            : t("bookings.details.cancelBooking")
        }
        description={
          modalIntent === "reject"
            ? t(
                "bookings.declineConfirmation",
                "Declining this request will close the current booking request for the renter."
              )
            : t(
                "bookings.cancelConfirmation",
                "Are you sure you want to cancel this booking? This action cannot be undone."
              )
        }
        size="md"
      >
        <div className="mb-6">
          <label className="block text-sm font-medium text-foreground mb-2">
            {modalIntent === "reject"
              ? t("bookings.declineReason", "Reason for declining")
              : t("bookings.cancelReason", "Reason for cancellation")}
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
            disabled={pendingActionKey !== null}
            className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
          />
          <div className="mt-2 text-right text-xs text-muted-foreground">
            {cancelReason.trim().length}/{MAX_CANCELLATION_REASON_LENGTH}
          </div>
        </div>
        <DialogFooter>
          <UnifiedButton
            variant="outline"
            onClick={closeCancelModal}
            className="flex-1"
            disabled={pendingActionKey !== null}
          >
            {t("bookings.keepBooking", "Keep Booking")}
          </UnifiedButton>
          <UnifiedButton
            variant="destructive"
            onClick={() => void handleCancelBooking()}
            disabled={cancelReason.trim().length === 0 || pendingActionKey !== null}
            loading={pendingActionKey !== null}
            className="flex-1"
          >
            {modalIntent === "reject"
              ? t("bookings.actions.decline", "Decline")
              : t("bookings.details.cancelBooking")}
          </UnifiedButton>
        </DialogFooter>
      </Dialog>
    </PortalPageLayout>
  );
}

// Error boundary for route errors
export { RouteErrorBoundary as ErrorBoundary };
