import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import type { ComponentType } from "react";
import { useState, useEffect, useMemo } from "react";
import { useLoaderData, Link, redirect, useRevalidator } from "react-router";
import { useTranslation } from "react-i18next";
import {
  Package,
  Calendar,
  Banknote,
  MessageCircle,
  AlertCircle,
  Star,
  CheckCircle,
  Clock,
  XCircle,
  Plus,
  ArrowUpRight,
} from "lucide-react";
import { requireUser } from "~/utils/auth";
import { listingsApi } from "~/lib/api/listings";
import { bookingsApi } from "~/lib/api/bookings";
import { paymentsApi } from "~/lib/api/payments";
import { usersApi } from "~/lib/api/users";
import type { Listing } from "~/types/listing";
import type { Booking } from "~/types/booking";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  RouteErrorBoundary,
  UnifiedButton,
} from "~/components/ui";
import { PortalPageLayout } from "~/components/layout";
import { RecentActivity } from "~/components/dashboard/RecentActivity";
import { DashboardCustomizer } from "~/components/dashboard/DashboardCustomizer";
import { cn } from "~/lib/utils";
import { formatCurrency } from "~/lib/utils";
import { ownerNavSections } from "~/config/navigation";
import { useDashboardPreferences } from "~/hooks/useDashboardPreferences";
import { notificationsApi } from "~/lib/api/notifications";
import { messagingApi } from "~/lib/api/messaging";
import { insuranceApi } from "~/lib/api/insurance";
import type { InsurancePolicy } from "~/lib/api/insurance";
import { ApiErrorType, getActionableErrorMessage } from "~/lib/api-error";

export const meta: MetaFunction = () => {
  return [{ title: "Owner Dashboard | GharBatai Rentals" }];
};

const safeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const safeStatusKey = (value: unknown, fallback = "PENDING"): string => {
  const status = typeof value === "string" ? value.trim() : "";
  return (status || fallback).toUpperCase();
};
const safeDateLabel = (value: unknown, pattern: string): string => {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : format(date, pattern);
};
const safeText = (value: unknown, fallback = ""): string => {
  const text = typeof value === "string" ? value : "";
  return text || fallback;
};

const getOwnerDashboardLoadError = (
  error: unknown,
  failedSections: string[] = []
): string => {
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

  const sectionSuffix =
    failedSections.length > 0
      ? ` Some sections could not be loaded: ${failedSections.join(", ")}.`
      : "";

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return `You appear to be offline. Reconnect and try loading the owner dashboard again.${sectionSuffix}`;
  }

  return getActionableErrorMessage(
    error,
    `Unable to load the owner dashboard right now.${sectionSuffix}`,
    {
      [ApiErrorType.OFFLINE]: `You appear to be offline. Reconnect and try loading the owner dashboard again.${sectionSuffix}`,
      [ApiErrorType.TIMEOUT_ERROR]: `Loading the owner dashboard timed out. Try again.${sectionSuffix}`,
      [ApiErrorType.NETWORK_ERROR]: `We could not reach the dashboard service. Try again in a moment.${sectionSuffix}`,
    }
  );
};

export async function clientLoader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  if (user.role === "admin") {
    return redirect("/admin");
  }
  if (user.role !== "owner") {
    return redirect("/dashboard/renter");
  }

  try {
    const results = await Promise.allSettled([
      listingsApi.getMyListings(),
      bookingsApi.getOwnerBookings(),
      paymentsApi.getEarnings(),
      usersApi.getUserStats(),
      notificationsApi.getUnreadCount(),
      messagingApi.getUnreadCount(),
      insuranceApi.getMyPolicies({ status: "ACTIVE" }),
    ]);

    const settled = <T,>(r: PromiseSettledResult<T>, fallback: T): T =>
      r.status === "fulfilled" ? r.value : fallback;

    const rawListings = settled(results[0], []);
    const rawBookings = settled(results[1], []);
    const rawEarnings = settled(results[2], { amount: 0 } as any);
    const rawStats = settled(results[3], {
      averageRating: 0,
      totalReviews: 0,
    } as any);
    const unreadNotifs = settled(results[4], { count: 0 });
    const unreadMsgs = settled(results[5], { count: 0 });
    const rawPolicies = settled(results[6], {
      data: [],
      pagination: { total: 0, page: 1, limit: 0, totalPages: 0 },
    } as any);

    const failedSections = results
      .map((r, i) =>
        r.status === "rejected"
          ? [
              "listings",
              "bookings",
              "earnings",
              "stats",
              "notifications",
              "messages",
              "insurance",
            ][i]
          : null
      )
      .filter(Boolean) as string[];
    const firstRejectedReason = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    )?.reason;

    // Detect soon-to-expire insurance policies (within 30 days)
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const activePolicies: InsurancePolicy[] = Array.isArray(rawPolicies?.data)
      ? rawPolicies.data
      : [];
    const expiringPolicies = activePolicies.filter((p: InsurancePolicy) => {
      const endMs = new Date(p.endDate).getTime();
      return !Number.isNaN(endMs) && endMs - now < thirtyDays && endMs > now;
    });

    const listings = Array.isArray(rawListings) ? rawListings : [];
    const bookings = Array.isArray(rawBookings) ? rawBookings : [];

    const normalizeBookingStatus = (status: unknown) => {
      const upper = safeStatusKey(status);
      if (upper === "IN_PROGRESS") return "active";
      if (upper === "AWAITING_RETURN_INSPECTION") return "return_requested";
      if (upper === "PENDING_OWNER_APPROVAL") return "pending_owner_approval";
      if (upper === "PENDING_PAYMENT") return "pending_payment";
      if (upper === "CONFIRMED") return "confirmed";
      if (upper === "COMPLETED") return "completed";
      if (upper === "SETTLED") return "settled";
      if (upper === "CANCELLED") return "cancelled";
      if (upper === "PAYMENT_FAILED") return "payment_failed";
      if (upper === "DISPUTED") return "disputed";
      if (upper === "PENDING") return "pending";
      return String(status || "").toLowerCase();
    };

    // Calculate statistics
    const activeListings = listings.filter((l: Listing) => {
      const availability = String(l.availability || "").toLowerCase();
      const status = (l.status || "").toString().toLowerCase();
      return availability === "available" || status === "available";
    }).length;
    const totalListings = listings.length;
    const pendingBookings = bookings.filter((b: Booking) => {
      const status = normalizeBookingStatus(b.status);
      return status === "pending_owner_approval";
    }).length;
    const activeBookings = bookings.filter((b: Booking) => {
      const status = normalizeBookingStatus(b.status);
      return ["confirmed", "active", "return_requested"].includes(status);
    }).length;
    const completedBookings = bookings.filter((b: Booking) => {
      const status = normalizeBookingStatus(b.status);
      return ["completed", "settled"].includes(status);
    }).length;

    const stats = {
      activeListings,
      totalListings,
      pendingBookings,
      activeBookings,
      completedBookings,
      totalEarnings: safeNumber(rawEarnings?.amount),
      pendingEarnings: bookings
        .filter((b: Booking) => {
          const status = normalizeBookingStatus(b.status);
          return ["pending_payment", "pending_owner_approval"].includes(status);
        })
        .reduce(
          (sum: number, b: Booking) =>
            sum + safeNumber(b.totalAmount ?? b.totalPrice),
          0
        ),
      averageRating: safeNumber(rawStats.averageRating),
      totalReviews: safeNumber(rawStats.totalReviews),
    };

    // Get recent bookings
    const recentBookings = bookings
      .sort(
        (a: Booking, b: Booking) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, 5);

    return {
      stats,
      listings: listings.slice(0, 6),
      recentBookings,
      userStats: rawStats,
      unreadNotifications:
        typeof unreadNotifs?.count === "number" ? unreadNotifs.count : 0,
      unreadMessages:
        typeof unreadMsgs?.count === "number" ? unreadMsgs.count : 0,
      failedSections,
      error:
        failedSections.length > 0
          ? getOwnerDashboardLoadError(firstRejectedReason, failedSections)
          : null,
      expiringInsurancePolicies: expiringPolicies,
      hasInsurance: activePolicies.length > 0,
    };
  } catch (error) {
    return {
      stats: {
        activeListings: 0,
        totalListings: 0,
        pendingBookings: 0,
        activeBookings: 0,
        completedBookings: 0,
        totalEarnings: 0,
        pendingEarnings: 0,
        averageRating: 0,
        totalReviews: 0,
      },
      listings: [],
      recentBookings: [],
      userStats: null,
      unreadNotifications: 0,
      unreadMessages: 0,
      failedSections: [],
      expiringInsurancePolicies: [],
      hasInsurance: true,
      error: getOwnerDashboardLoadError(error),
    };
  }
}

function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  variant = "default",
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  trend?: string;
  variant?: "default" | "success" | "warning" | "info";
}) {
  const variantClasses = {
    default: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    info: "bg-info/10 text-info",
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={cn("p-3 rounded-full", variantClasses[variant])}>
            <Icon className="w-6 h-6" />
          </div>
          {trend && (
            <span className="text-sm text-success flex items-center">
              <ArrowUpRight className="w-4 h-4 mr-1" />
              {trend}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-1">{label}</p>
        <p className="text-2xl font-bold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function BookingCard({ booking }: { booking: Booking }) {
  const statusConfig = {
    PENDING_OWNER_APPROVAL: {
      variant: "warning" as const,
      icon: Clock,
      label: "Pending Approval",
    },
    PENDING_PAYMENT: {
      variant: "warning" as const,
      icon: Clock,
      label: "Pending Payment",
    },
    PENDING: { variant: "warning" as const, icon: Clock, label: "Pending" },
    CONFIRMED: {
      variant: "success" as const,
      icon: CheckCircle,
      label: "Confirmed",
    },
    IN_PROGRESS: {
      variant: "default" as const,
      icon: Package,
      label: "In Progress",
    },
    AWAITING_RETURN_INSPECTION: {
      variant: "warning" as const,
      icon: Clock,
      label: "Return Requested",
    },
    COMPLETED: {
      variant: "success" as const,
      icon: CheckCircle,
      label: "Completed",
    },
    SETTLED: {
      variant: "success" as const,
      icon: CheckCircle,
      label: "Settled",
    },
    CANCELLED: {
      variant: "destructive" as const,
      icon: XCircle,
      label: "Cancelled",
    },
    DISPUTED: {
      variant: "destructive" as const,
      icon: XCircle,
      label: "Disputed",
    },
    REFUNDED: {
      variant: "destructive" as const,
      icon: XCircle,
      label: "Refunded",
    },
  };

  const statusKey = String(booking.status || "PENDING").toUpperCase();
  const config =
    statusConfig[statusKey as keyof typeof statusConfig] ||
    statusConfig.PENDING;
  const StateIcon = config.icon;
  const renterFirstName = safeText(booking.renter?.firstName, "Renter");
  const renterLastName = safeText(booking.renter?.lastName);
  const listingTitle = safeText(booking.listing?.title, "Listing");
  const bookingId = safeText(booking.id);

  return (
    <Link
      to={bookingId ? `/bookings/${bookingId}` : "/bookings"}
      className="block bg-card border rounded-lg p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-foreground mb-1">{listingTitle}</h3>
          <p className="text-sm text-muted-foreground">
            {renterFirstName}
            {renterLastName ? ` ${renterLastName}` : ""}
          </p>
        </div>
        <Badge variant={config.variant} className="flex items-center">
          <StateIcon className="w-3 h-3 mr-1" />
          {config.label}
        </Badge>
      </div>
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center text-muted-foreground">
          <Calendar className="w-4 h-4 mr-1" />
          {safeDateLabel(booking.startDate, "MMM d")} -{" "}
          {safeDateLabel(booking.endDate, "MMM d")}
        </div>
        <span className="font-semibold text-primary">
          {formatCurrency(
            safeNumber(booking.totalAmount ?? booking.totalPrice)
          )}
        </span>
      </div>
    </Link>
  );
}

function ListingCard({ listing }: { listing: Listing }) {
  const listingTitle = safeText(listing.title, "Listing");
  const availability = safeText(listing.availability, "unknown");
  const listingId = safeText(listing.id);
  return (
    <Link
      to={listingId ? `/listings/${listingId}` : "/listings"}
      className="bg-card border rounded-lg overflow-hidden hover:shadow-lg transition-shadow block"
    >
      <div className="aspect-video bg-muted relative">
        {listing.photos?.[0] ? (
          <img
            src={listing.photos[0]}
            alt={listingTitle}
            className="w-full h-full object-cover"
            crossOrigin="anonymous"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
              (e.currentTarget.nextElementSibling as HTMLElement | null)?.style.setProperty("display", "flex");
            }}
          />
        ) : null}
        <div
          className="w-full h-full flex items-center justify-center"
          style={{ display: listing.photos?.[0] ? "none" : "flex" }}
        >
          <Package className="w-12 h-12 text-muted-foreground" />
        </div>
        <span
          className={cn(
            "absolute top-2 right-2 px-2 py-1 text-white text-xs font-semibold rounded",
            availability.toLowerCase() === "available"
              ? "bg-success"
              : "bg-muted-foreground"
          )}
        >
          {availability}
        </span>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-foreground mb-2 line-clamp-1">
          {listingTitle}
        </h3>
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-primary">
            {formatCurrency(listing.basePrice)}/day
          </span>
          {listing.rating && listing.rating > 0 && (
            <div className="flex items-center">
              <Star className="w-4 h-4 text-warning fill-current" />
              <span className="ml-1 text-sm text-muted-foreground">
                {safeNumber(listing.rating).toFixed(1)}
              </span>
              <span className="ml-1 text-sm text-muted-foreground">
                ({listing.totalReviews})
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function OwnerDashboardRoute() {
  const { t } = useTranslation();
  const revalidator = useRevalidator();
  const {
    stats,
    listings,
    recentBookings,
    unreadNotifications,
    unreadMessages,
    error,
    failedSections,
    expiringInsurancePolicies,
    hasInsurance,
  } = useLoaderData<typeof clientLoader>();
  const [hasDraft, setHasDraft] = useState(false);
  useEffect(() => {
    try {
      const draft = localStorage.getItem("listingDraft_v1");
      setHasDraft(Boolean(draft));
    } catch {
      // ignore
    }
  }, []);

  const pendingEarnings = safeNumber(stats.pendingEarnings);
  const totalEarnings = safeNumber(stats.totalEarnings);
  const averageRating = safeNumber(stats.averageRating);
  const banner = error && (!failedSections || failedSections.length === 0) ? (
    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive">
      {error}
    </div>
  ) : failedSections && failedSections.length > 0 ? (
    <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
      <p className="text-sm text-warning-foreground">
        {error || `Some sections failed to load: ${failedSections.join(", ")}.`}{" "}
        <UnifiedButton
          variant="ghost"
          className="h-auto p-0 underline font-medium"
          onClick={() => revalidator.revalidate()}
        >
          Retry
        </UnifiedButton>
      </p>
    </div>
  ) : null;

  // Enrich nav items with unread badges
  const navWithBadges = ownerNavSections.map((section) => ({
    ...section,
    items: section.items.map((item) => {
      if (item.href === "/messages" && unreadMessages > 0) {
        return { ...item, badge: unreadMessages };
      }
      if (item.href === "/notifications" && unreadNotifications > 0) {
        return { ...item, badge: unreadNotifications };
      }
      return item;
    }),
  }));

  const customizableSections = useMemo(
    () => [
      {
        id: "owner-overview",
        title: "Overview metrics",
        description: "Active listings, earnings, bookings, and rating health.",
        className: "xl:col-span-3",
        content: (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            <Link to="/listings" className="block">
              <StatCard
                icon={Package}
                label={t("dashboard.stats.activeListings", "Active Listings")}
                value={`${stats.activeListings}/${stats.totalListings}`}
              />
            </Link>
            <StatCard
              icon={Banknote}
              label={t("dashboard.stats.pendingEarnings", "Pending Earnings")}
              value={formatCurrency(pendingEarnings)}
              variant="success"
            />
            <Link to="/bookings?view=owner" className="block">
              <StatCard
                icon={Calendar}
                label={t("dashboard.stats.activeBookings")}
                value={stats.activeBookings}
                variant="info"
              />
            </Link>
            <StatCard
              icon={Star}
              label={t("dashboard.stats.averageRating")}
              value={averageRating.toFixed(1)}
              trend={`${stats.totalReviews} reviews`}
              variant="warning"
            />
          </div>
        ),
      },
      {
        id: "owner-recent-bookings",
        title: "Recent bookings",
        description: "Monitor the newest requests, returns, and active rentals.",
        className: "xl:col-span-2",
        content: (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                {t("dashboard.recentBookings", "Recent Bookings")}
              </CardTitle>
              <Link
                to="/bookings"
                className="text-sm text-primary hover:text-primary/90 font-medium flex items-center"
              >
                {t("common.viewAll")}
                <ArrowUpRight className="w-4 h-4 ml-1" />
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentBookings.length > 0 ? (
                  recentBookings.map((booking: Booking) => (
                    <BookingCard key={booking.id} booking={booking} />
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      {t("bookings.empty")}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ),
      },
      {
        id: "owner-earnings-summary",
        title: "Earnings summary",
        description: "Track settled revenue, pending payout, and completed rentals.",
        className: "xl:col-span-1",
        content: (
          <Card>
            <CardHeader>
              <CardTitle>
                {t("dashboard.earningsSummary", "Earnings Summary")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-muted-foreground">
                    {t("dashboard.stats.totalEarned", "Total Earned")}
                  </span>
                  <span className="text-xl font-bold text-success">
                    {formatCurrency(totalEarnings)}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-muted-foreground">
                    {t("dashboard.stats.pending", "Pending")}
                  </span>
                  <span className="text-lg font-semibold text-warning">
                    {formatCurrency(pendingEarnings)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">
                    {t("dashboard.stats.completedRentals", "Completed Rentals")}
                  </span>
                  <span className="font-semibold text-foreground">
                    {stats.completedBookings}
                  </span>
                </div>
              </div>
              <Link
                to="/dashboard/owner/earnings"
                className="mt-6 w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-center block"
              >
                {t("dashboard.viewEarningsDetails", "View Earnings Details")}
              </Link>
            </CardContent>
          </Card>
        ),
      },
      {
        id: "owner-listings-preview",
        title: "Listings preview",
        description: "Pick up draft work, review health, and open edits faster.",
        className: "xl:col-span-2",
        content: (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t("dashboard.myListings")}</CardTitle>
              <div className="flex gap-3">
                <Link
                  to="/listings"
                  className="text-sm text-primary hover:text-primary/90 font-medium flex items-center"
                >
                  {t("common.viewAll")}
                  <ArrowUpRight className="w-4 h-4 ml-1" />
                </Link>
                <Link
                  to="/listings/new"
                  className="inline-flex items-center justify-center h-9 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {t("listings.create.newListing", "New Listing")}
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {hasDraft ? (
                <div className="mb-4 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span className="text-sm text-amber-800 font-medium">
                      {t("listings.draftExists", "You have an unsaved draft listing")}
                    </span>
                  </div>
                  <Link
                    to="/listings/new"
                    className="text-sm text-amber-700 font-semibold underline hover:text-amber-900"
                  >
                    {t("listings.resumeDraft", "Resume Draft")}
                  </Link>
                </div>
              ) : null}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {listings.length > 0 ? (
                  listings.map((listing: Listing) => (
                    <ListingCard key={listing.id} listing={listing} />
                  ))
                ) : (
                  <div className="col-span-2 text-center py-8">
                    <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">
                      {t("listings.empty", "No listings yet")}
                    </p>
                    <Link
                      to="/listings/new"
                      className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      {t(
                        "listings.create.firstListing",
                        "Create Your First Listing"
                      )}
                    </Link>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ),
      },
      {
        id: "owner-activity-feed",
        title: "Recent activity",
        description: "A live feed of booking, payment, and listing events.",
        className: "xl:col-span-1",
        content: <RecentActivity limit={8} showViewAll={false} emptyState="compact" />,
      },
      {
        id: "owner-quick-actions",
        title: "Quick actions",
        description: "Jump to the next operational task without leaving the page.",
        className: "xl:col-span-1",
        content: (
          <Card>
            <CardHeader>
              <CardTitle>
                {t("dashboard.quickActions", "Quick Actions")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Link
                  to="/listings/new"
                  className="flex items-center w-full px-4 py-3 text-left text-foreground hover:bg-accent rounded-md transition-colors"
                >
                  <Plus className="w-5 h-5 mr-3 text-primary" />
                  {t("listings.create.title")}
                </Link>
                <Link
                  to="/dashboard/owner/calendar"
                  className="flex items-center w-full px-4 py-3 text-left text-foreground hover:bg-accent rounded-md transition-colors"
                >
                  <Calendar className="w-5 h-5 mr-3 text-primary" />
                  {t("dashboard.viewCalendar", "View Calendar")}
                </Link>
                <Link
                  to="/messages"
                  className="flex items-center w-full px-4 py-3 text-left text-foreground hover:bg-accent rounded-md transition-colors"
                >
                  <MessageCircle className="w-5 h-5 mr-3 text-primary" />
                  {t("dashboard.viewMessages", "View Messages")}
                </Link>
              </div>
            </CardContent>
          </Card>
        ),
      },
    ],
    [
      averageRating,
      hasDraft,
      listings,
      pendingEarnings,
      recentBookings,
      stats.activeBookings,
      stats.activeListings,
      stats.completedBookings,
      stats.totalListings,
      stats.totalReviews,
      t,
      totalEarnings,
    ]
  );
  const {
    orderedSections,
    hiddenIds,
    pinnedIds,
    togglePinned,
    toggleHidden,
    resetPreferences,
  } = useDashboardPreferences("owner-dashboard-layout", customizableSections);
  const visibleSections = orderedSections.filter(
    (section) => !hiddenIds.has(section.id)
  );

  return (
    <PortalPageLayout
      title={t("dashboard.ownerPortal", "Owner Portal")}
      description="Manage listings, bookings, earnings, and guest activity"
      sidebarSections={navWithBadges}
      banner={banner}
      contentClassName="space-y-8"
      actions={
        <div className="flex items-center gap-2">
          <DashboardCustomizer
            sections={customizableSections}
            pinnedIds={pinnedIds}
            hiddenIds={hiddenIds}
            onTogglePinned={togglePinned}
            onToggleHidden={toggleHidden}
            onReset={resetPreferences}
          />
          <Link
            to="/listings/new"
            className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("listings.create.newListing", "New Listing")}
          </Link>
        </div>
      }
    >
      {/* Pending Actions */}
      {stats.pendingBookings > 0 && (
        <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 flex items-start">
          <AlertCircle className="w-5 h-5 text-warning mr-3 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-foreground mb-1">
              {t("dashboard.actionRequired", "Action Required")}
            </h3>
            <p className="text-sm text-muted-foreground">
              You have {stats.pendingBookings} booking
              {stats.pendingBookings !== 1 ? "s" : ""} waiting for your
              approval.
            </p>
          </div>
          <Link
            to="/bookings?view=owner&status=pending_owner_approval"
            className="px-4 py-2 bg-warning text-warning-foreground rounded-md hover:bg-warning/90 transition-colors text-sm font-medium"
          >
            {t("dashboard.reviewNow", "Review Now")}
          </Link>
        </div>
      )}

      {/* Insurance expiry alert */}
      {Array.isArray(expiringInsurancePolicies) && expiringInsurancePolicies.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-amber-900 mb-1">
              {t("dashboard.insuranceExpiringSoon", "Insurance Expiring Soon")}
            </h3>
            <p className="text-sm text-amber-800">
              {expiringInsurancePolicies.length === 1
                ? t("dashboard.insuranceExpiringSoonDesc1", `1 insurance policy expires within 30 days. Renew it to keep your listing protected.`)
                : t("dashboard.insuranceExpiringSoonDescN", `${expiringInsurancePolicies.length} insurance policies expire within 30 days. Renew them to keep your listings protected.`)}
            </p>
          </div>
          <Link
            to="/insurance"
            className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors text-sm font-medium whitespace-nowrap"
          >
            {t("dashboard.renewInsurance", "Renew Insurance")}
          </Link>
        </div>
      )}

      {/* Insurance zero-state CTA — only shown when owner has no active policies and none expiring */}
      {!hasInsurance && !(Array.isArray(expiringInsurancePolicies) && expiringInsurancePolicies.length > 0) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900 mb-1">
              {t("dashboard.noInsurance", "Protect Your Listings with Insurance")}
            </h3>
            <p className="text-sm text-blue-800">
              {t("dashboard.noInsuranceDesc", "You don't have any active insurance policies. Add insurance to protect your items and build renter trust.")}
            </p>
          </div>
          <Link
            to="/insurance"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium whitespace-nowrap"
          >
            {t("dashboard.setupInsurance", "Set Up Insurance")}
          </Link>
        </div>
      )}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {visibleSections.map((section) => (
          <div key={section.id} className={section.className}>
            {section.content}
          </div>
        ))}
      </div>
    </PortalPageLayout>
  );
}

export { RouteErrorBoundary as ErrorBoundary };
