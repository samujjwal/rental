import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import type { ComponentType } from "react";
import { useMemo } from "react";
import { useLoaderData, Link, redirect, useRevalidator } from "react-router";
import { useTranslation } from "react-i18next";
import { useDashboardState } from "~/hooks/useDashboardState";
import {
  Package,
  Calendar,
  Heart,
  Star,
  Clock,
  CheckCircle,
  XCircle,
  MapPin,
  Search,
  TrendingUp,
  ArrowRight,
  CreditCard,
  MessageSquare,
  BarChart3,
  Settings,
  HelpCircle,
  User,
} from "lucide-react";
import { requireUser } from "~/utils/auth";
import { bookingsApi } from "~/lib/api/bookings";
import { getFavorites } from "~/lib/api/favorites";
import { listingsApi } from "~/lib/api/listings";
import { CompactFavoriteButton } from "~/components/favorites";
import type { Booking } from "~/types/booking";
import type { Listing } from "~/types/listing";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  RouteErrorBoundary,
  ProgressiveDisclosure,
  CollapsibleSection,
  ContextualHelp,
  FirstTimeHelp,
  UnifiedButton,
} from "~/components/ui";
import { PortalPageLayout } from "~/components/layout";
import { RecentActivity } from "~/components/dashboard/RecentActivity";
import { DashboardCustomizer } from "~/components/dashboard/DashboardCustomizer";
import { MobileDashboardNavigation } from "~/components/mobile";
import { cn } from "~/lib/utils";
import { formatCurrency } from "~/lib/utils";
import { renterNavSections } from "~/config/navigation";
import { useDashboardPreferences } from "~/hooks/useDashboardPreferences";
import { notificationsApi } from "~/lib/api/notifications";
import { messagingApi } from "~/lib/api/messaging";
import { requestNavigation } from "~/lib/navigation";
import { ApiErrorType, getActionableErrorMessage } from "~/lib/api-error";

export const meta: MetaFunction = () => {
  return [{ title: "Renter Dashboard | GharBatai Rentals" }];
};

const safeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const safeStatusKey = (value: unknown, fallback = "PENDING"): string => {
  const status = typeof value === "string" ? value.trim() : "";
  return (status || fallback).toUpperCase();
};
const safeLocationLabel = (location: unknown): string => {
  if (typeof location === "string") {
    return location.trim() || "Location";
  }
  if (location && typeof location === "object" && "city" in location) {
    const city = String((location as { city?: unknown }).city || "").trim();
    return city || "Location";
  }
  return "Location";
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

const getRenterDashboardLoadError = (
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
    return `You appear to be offline. Reconnect and try loading the renter dashboard again.${sectionSuffix}`;
  }

  return getActionableErrorMessage(
    error,
    `Unable to load the renter dashboard right now.${sectionSuffix}`,
    {
      [ApiErrorType.OFFLINE]: `You appear to be offline. Reconnect and try loading the renter dashboard again.${sectionSuffix}`,
      [ApiErrorType.TIMEOUT_ERROR]: `Loading the renter dashboard timed out. Try again.${sectionSuffix}`,
      [ApiErrorType.NETWORK_ERROR]: `We could not reach the dashboard service. Try again in a moment.${sectionSuffix}`,
    }
  );
};

export async function clientLoader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  if (user.role === "admin") {
    return redirect("/admin");
  }
  if (user.role !== "renter") {
    return redirect("/dashboard/owner");
  }

  try {
    const results = await Promise.allSettled([
      bookingsApi.getMyBookings(),
      getFavorites(),
      listingsApi.searchListings({ limit: 4 }),
      notificationsApi.getUnreadCount(),
      messagingApi.getUnreadCount(),
    ]);

    const settled = <T,>(r: PromiseSettledResult<T>, fallback: T): T =>
      r.status === "fulfilled" ? r.value : fallback;

    const bookingsResponse = settled(results[0], []);
    const favoritesResponse = settled(results[1], { favorites: [] } as any);
    const recommendationsResponse = settled(results[2], {
      listings: [],
    } as any);
    const unreadNotifs = settled(results[3], { count: 0 });
    const unreadMsgs = settled(results[4], { count: 0 });

    const failedSections = results
      .map((r, i) =>
        r.status === "rejected"
          ? [
              "bookings",
              "favorites",
              "recommendations",
              "notifications",
              "messages",
            ][i]
          : null
      )
      .filter(Boolean) as string[];
    const firstRejectedReason = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    )?.reason;

    const bookings = Array.isArray(bookingsResponse) ? bookingsResponse : [];
    const favoritesRaw = Array.isArray(favoritesResponse.favorites)
      ? favoritesResponse.favorites
      : [];
    const recommendationsRaw = Array.isArray(recommendationsResponse.listings)
      ? recommendationsResponse.listings
      : [];

    const normalizeStatus = (status: unknown) => safeStatusKey(status);

    // Detect bookings that urgently need payment action
    const urgentBookings = bookings.filter((b) => {
      const status = normalizeStatus(b.status);
      return status === "PENDING_PAYMENT" || status === "PAYMENT_FAILED";
    });
    const urgentPaymentBookingId: string | null = urgentBookings.length > 0
      ? String(urgentBookings[0].id || "")
      : null;

    const favorites: Array<Listing & { savedAt: string }> = favoritesRaw.map(
      (favorite: { listing: Listing; createdAt: string }) => ({
        ...favorite.listing,
        savedAt: favorite.createdAt,
      })
    );
    const recommendations: Listing[] = recommendationsRaw as Listing[];

    // Calculate statistics
    const upcomingBookings = bookings.filter((b) => {
      const status = normalizeStatus(b.status);
      return (
        status === "CONFIRMED" &&
        new Date(String(b.startDate || "")).getTime() > Date.now()
      );
    }).length;
    const activeBookings = bookings.filter((b) => {
      const status = normalizeStatus(b.status);
      return (
        status === "IN_PROGRESS" || status === "AWAITING_RETURN_INSPECTION"
      );
    }).length;
    const completedBookings = bookings.filter((b) => {
      const status = normalizeStatus(b.status);
      return status === "COMPLETED" || status === "SETTLED";
    }).length;
    const totalSpent = bookings
      .filter((b) => {
        const status = normalizeStatus(b.status);
        return status === "COMPLETED" || status === "SETTLED";
      })
      .reduce((sum, b) => sum + safeNumber(b.totalAmount ?? b.totalPrice), 0);

    const stats = {
      upcomingBookings,
      activeBookings,
      completedBookings,
      totalSpent,
      favoriteCount: favorites.length,
    };

    // Get recent bookings
    const recentBookings = bookings
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, 5);

    return {
      stats,
      recentBookings,
      favorites: favorites.slice(0, 3),
      recommendations: recommendations.slice(0, 4),
      unreadNotifications:
        typeof unreadNotifs?.count === "number" ? unreadNotifs.count : 0,
      unreadMessages:
        typeof unreadMsgs?.count === "number" ? unreadMsgs.count : 0,
      urgentPaymentBookingId,
      failedSections,
      error:
        failedSections.length > 0
          ? getRenterDashboardLoadError(firstRejectedReason, failedSections)
          : null,
    };
  } catch (error) {
    return {
      stats: {
        upcomingBookings: 0,
        activeBookings: 0,
        completedBookings: 0,
        totalSpent: 0,
        favoriteCount: 0,
      },
      recentBookings: [],
      favorites: [],
      recommendations: [],
      unreadNotifications: 0,
      unreadMessages: 0,
      urgentPaymentBookingId: null,
      error: getRenterDashboardLoadError(error),
    };
  }
}

function StatCard({
  icon: Icon,
  label,
  value,
  variant = "default",
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
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
        </div>
        <p className="text-sm text-muted-foreground mb-1">{label}</p>
        <p className="text-2xl font-bold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function BookingCard({ booking }: { booking: Booking }) {
  const statusConfig = {
    PENDING: { variant: "warning" as const, icon: Clock, label: "Pending" },
    PENDING_PAYMENT: {
      variant: "warning" as const,
      icon: Clock,
      label: "Pending Payment",
    },
    PENDING_OWNER_APPROVAL: {
      variant: "warning" as const,
      icon: Clock,
      label: "Pending Approval",
    },
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
    COMPLETED: {
      variant: "success" as const,
      icon: CheckCircle,
      label: "Completed",
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
    PAYMENT_FAILED: {
      variant: "destructive" as const,
      icon: XCircle,
      label: "Payment Failed",
    },
    SETTLED: {
      variant: "success" as const,
      icon: CheckCircle,
      label: "Settled",
    },
  };

  const normalizedStatus = safeStatusKey(booking.status);
  const config =
    statusConfig[normalizedStatus as keyof typeof statusConfig] ||
    statusConfig.PENDING;
  const StateIcon = config.icon;
  const bookingStartAt = new Date(String(booking.startDate || "")).getTime();
  const isUpcoming =
    Number.isFinite(bookingStartAt) && bookingStartAt > Date.now();
  const isActive = normalizedStatus === "IN_PROGRESS";

  const locationStr = safeLocationLabel(booking.listing?.location);
  const listingTitle = safeText(booking.listing?.title, "Listing");
  const bookingId = safeText(booking.id);
  const listingImage =
    booking.listing?.images?.[0] ??
    (booking.listing as { photos?: string[] } | undefined)?.photos?.[0];

  return (
    <Link
      to={bookingId ? `/bookings/${bookingId}` : "/bookings"}
      className="block bg-card border rounded-lg p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex gap-4">
        {/* Image */}
        <div className="w-20 h-20 rounded-lg bg-muted flex-shrink-0 overflow-hidden">
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
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-semibold text-foreground line-clamp-1">
              {listingTitle}
            </h3>
            <Badge variant={config.variant} className="whitespace-nowrap ml-2">
              <StateIcon className="w-3 h-3 mr-1" />
              {config.label}
            </Badge>
          </div>

          <div className="space-y-1">
            <div className="flex items-center text-sm text-muted-foreground">
              <Calendar className="w-4 h-4 mr-2" />
              {safeDateLabel(booking.startDate, "MMM d")} -{" "}
              {safeDateLabel(booking.endDate, "MMM d, yyyy")}
            </div>
            <div className="flex items-center text-sm text-muted-foreground">
              <MapPin className="w-4 h-4 mr-2" />
              {locationStr}
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <span className="font-semibold text-primary">
              {formatCurrency(
                safeNumber(booking.totalAmount ?? booking.totalPrice)
              )}
            </span>
            {isActive && (
              <span className="text-xs text-primary font-medium">
                Active Now
              </span>
            )}
            {isUpcoming && normalizedStatus === "CONFIRMED" && (
              <span className="text-xs text-success font-medium">Upcoming</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function ListingCard({
  listing,
  showFavorite = false,
}: {
  listing: Listing;
  showFavorite?: boolean;
}) {
  const listingTitle = safeText(listing.title, "Listing");
  const locationStr = safeLocationLabel(listing.location);
  const listingId = safeText(listing.id);

  return (
    <Link
      to={listingId ? `/listings/${listingId}` : "/listings"}
      className="bg-card border rounded-lg overflow-hidden hover:shadow-lg transition-shadow block"
    >
      <div className="aspect-video bg-muted relative">
        {listing.images?.[0] ? (
          <img
            src={listing.images[0]}
            alt={listingTitle}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-12 h-12 text-muted-foreground" />
          </div>
        )}
        {showFavorite && (
          <div className="absolute top-2 right-2">
            <CompactFavoriteButton listingId={listing.id} />
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-foreground mb-1 line-clamp-1">
          {listingTitle}
        </h3>
        <p className="text-sm text-muted-foreground mb-2 flex items-center">
          <MapPin className="w-4 h-4 mr-1" />
          {locationStr}
        </p>
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
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function RenterDashboardRoute() {
  const { t } = useTranslation();
  const revalidator = useRevalidator();
  const {
    stats,
    recentBookings,
    favorites,
    recommendations,
    unreadNotifications,
    unreadMessages,
    urgentPaymentBookingId,
    error,
    failedSections,
  } = useLoaderData<typeof clientLoader>();
  const totalSpent = safeNumber(stats.totalSpent);
  
  // P0.1 FIX: Consolidated state management to prevent race conditions and stale closures
  // All derived state is computed atomically in a single useMemo
  const { userActivityLevel, showFirstTimeHelp, personalizedRecommendations } = useDashboardState(recentBookings);
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
  const navWithBadges = renterNavSections.map((section) => ({
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
        id: "renter-personalized-actions",
        title: "Quick Actions",
        description: "Personalized actions based on your activity",
        className: "xl:col-span-2",
        content: (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-primary" />
                {personalizedRecommendations.title}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {personalizedRecommendations.description}
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  to={personalizedRecommendations.actionUrl}
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-center font-medium"
                >
                  {personalizedRecommendations.actionText}
                </Link>
                {urgentPaymentBookingId && (
                  <Link
                    to={`/checkout/${urgentPaymentBookingId}`}
                    className="flex-1 px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors text-center font-medium"
                  >
                    Complete Payment
                  </Link>
                )}
                {stats.upcomingBookings > 0 && (
                  <Link
                    to="/bookings"
                    className="flex-1 px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors text-center font-medium"
                  >
                    View Upcoming
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        ),
      },
      {
        id: "renter-overview",
        title: "Overview metrics",
        description: "Track upcoming reservations, favorites, and completed rentals.",
        className: "xl:col-span-3",
        content: (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            <StatCard
              icon={Calendar}
              label={t("bookings.upcoming", "Upcoming Bookings")}
              value={stats.upcomingBookings}
              variant="info"
            />
            <StatCard
              icon={Package}
              label={t("dashboard.stats.activeBookings")}
              value={stats.activeBookings}
            />
            <StatCard
              icon={CheckCircle}
              label={t("dashboard.stats.completedBookings", "Completed Bookings")}
              value={stats.completedBookings}
              variant="success"
            />
            <StatCard
              icon={Heart}
              label={t("dashboard.stats.favorites", "Favorites")}
              value={stats.favoriteCount}
              variant="warning"
            />
          </div>
        ),
      },
      {
        id: "renter-bookings",
        title: "Recent bookings",
        description: "Stay on top of pickup windows, returns, and booking health.",
        className: "xl:col-span-2",
        content: (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t("dashboard.myBookings")}</CardTitle>
              <Link
                to="/bookings"
                className="text-sm text-primary hover:text-primary/90 font-medium"
              >
                {t("common.viewAll")} →
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentBookings.length > 0 ? (
                  recentBookings.map((booking) => (
                    <BookingCard key={booking.id} booking={booking} />
                  ))
                ) : (
                  <div className="text-center py-12">
                    <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">
                      {t("bookings.empty")}
                    </p>
                    <Link
                      to="/search"
                      className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                    >
                      <Search className="w-5 h-5 mr-2" />
                      {t("nav.browseRentals", "Browse Rentals")}
                    </Link>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ),
      },
      {
        id: "renter-spending",
        title: "Spending summary",
        description: "Watch total spend, active rentals, and completed booking count.",
        className: "xl:col-span-1",
        content: (
          <Card>
            <CardHeader>
              <CardTitle>
                {t("dashboard.spendingSummary", "Spending Summary")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-muted-foreground">
                    {t("dashboard.stats.totalSpent", "Total Spent")}
                  </span>
                  <span className="text-xl font-bold text-primary">
                    {formatCurrency(totalSpent)}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-muted-foreground">
                    {t("dashboard.stats.completedRentals", "Completed Rentals")}
                  </span>
                  <span className="font-semibold text-foreground">
                    {stats.completedBookings}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">
                    {t("dashboard.stats.activeBookings")}
                  </span>
                  <span className="font-semibold text-foreground">
                    {stats.activeBookings}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ),
      },
      {
        id: "renter-recommendations",
        title: "Recommendations",
        description: "Keep a strong discovery lane on the dashboard.",
        className: "xl:col-span-2",
        content: (
          <ProgressiveDisclosure
            title="Recommended for You"
            description="Personalized recommendations based on your activity"
            defaultExpanded={userActivityLevel === "new"}
            variant="compact"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recommendations.length > 0 ? (
                recommendations.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))
              ) : (
                <div className="col-span-2 text-center py-8">
                  <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No recommendations available
                  </p>
                </div>
              )}
            </div>
          </ProgressiveDisclosure>
        ),
      },
      {
        id: "renter-favorites",
        title: "Favorites",
        description: "Keep saved listings close to the dashboard.",
        className: "xl:col-span-1",
        content: (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                {t("dashboard.myFavorites", "My Favorites")}
              </CardTitle>
              <Link
                to="/favorites"
                className="text-sm text-primary hover:text-primary/90 font-medium"
              >
                {t("common.viewAll")} →
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {favorites.length > 0 ? (
                  favorites.map((listing) =>
                    (() => {
                      const listingId = safeText(listing.id);
                      const listingTitle = safeText(listing.title, "Listing");
                      const listingImage =
                        listing.images?.[0] ??
                        (listing as { photos?: string[] }).photos?.[0];
                      return (
                        <Link
                          key={listing.id}
                          to={
                            listingId ? `/listings/${listingId}` : "/listings"
                          }
                          className="flex gap-3 p-2 rounded-lg hover:bg-accent transition-colors"
                        >
                          <div className="w-16 h-16 rounded-lg bg-muted flex-shrink-0 overflow-hidden">
                            {listingImage ? (
                              <img
                                src={listingImage}
                                alt={listingTitle}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="w-6 h-6 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-foreground line-clamp-1 text-sm">
                              {listingTitle}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              ${safeNumber(
                                (
                                  listing as {
                                    pricePerDay?: unknown;
                                    basePrice?: unknown;
                                  }
                                ).basePrice ??
                                  (listing as { basePrice?: unknown }).basePrice
                              )}
                              /day
                            </p>
                          </div>
                        </Link>
                      );
                    })()
                  )
                ) : (
                  <div className="text-center py-6">
                    <Heart className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {t("dashboard.noFavoritesYet", "No favorites yet")}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ),
      },
      {
        id: "renter-activity-feed",
        title: "Recent activity",
        description: "Review payment, booking, and review events in one place.",
        className: "xl:col-span-1",
        content: <RecentActivity limit={8} showViewAll={false} emptyState="compact" />,
      },
      {
        id: "renter-owner-cta",
        title: "Become an owner",
        description: "Promote the owner conversion path without overwhelming the main flow.",
        className: "xl:col-span-1",
        content: (
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="p-2 rounded-full bg-primary/15 flex-shrink-0">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm">
                    {t("dashboard.becomeOwner.title", "Turn your stuff into income")}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("dashboard.becomeOwner.desc", "List items you own and earn money from rentals.")}
                  </p>
                </div>
              </div>
              <Link
                to="/listings/new"
                className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                {t("dashboard.becomeOwner.cta", "Start Listing")}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </CardContent>
          </Card>
        ),
      },
    ],
    [
      favorites,
      recentBookings,
      recommendations,
      stats.activeBookings,
      stats.completedBookings,
      stats.favoriteCount,
      stats.upcomingBookings,
      t,
      totalSpent,
    ]
  );
  const {
    orderedSections,
    hiddenIds,
    pinnedIds,
    togglePinned,
    toggleHidden,
    resetPreferences,
  } = useDashboardPreferences("renter-dashboard-layout", customizableSections);
  const visibleSections = orderedSections.filter(
    (section) => !hiddenIds.has(section.id)
  );

  // Mobile navigation items
  const mobileNavItems = [
    { icon: Search, label: 'Search', href: '/search' },
    { icon: Heart, label: 'Favorites', href: '/favorites', badge: favorites.length },
    { icon: MessageSquare, label: 'Messages', href: '/messages', badge: unreadMessages },
    { icon: Calendar, label: 'Bookings', href: '/bookings' },
    { icon: User, label: 'Profile', href: '/profile' },
  ];

  return (
    <PortalPageLayout
      title={t("dashboard.renterPortal", "Renter Portal")}
      description="Track your bookings, favorites, and messages in one place"
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
            to="/search"
            className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Search className="mr-2 h-4 w-4" />
            {t("nav.browseRentals", "Browse Rentals")}
          </Link>
        </div>
      }
    >
      {/* Mobile Navigation - Only visible on mobile */}
      <MobileDashboardNavigation items={mobileNavItems} className="md:hidden mb-4" />
      
      {/* First-time help for new users */}
      {showFirstTimeHelp && (
        <FirstTimeHelp
          title="Welcome to Your Dashboard!"
          description="This is your personal hub for managing rentals, favorites, and messages. Start by browsing items or create your first booking."
          action={{
            label: "Browse Items",
            onClick: () => requestNavigation("/search")
          }}
          onDismiss={() => {
            // Could persist dismissal in localStorage
          }}
        />
      )}
      
      {/* Urgent payment alert */}
      {urgentPaymentBookingId && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-4">
          <TrendingUp className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-destructive">
              {t("dashboard.paymentRequired", "Payment Required")}
            </p>
            <p className="text-sm text-destructive/80 mt-0.5">
              {t("dashboard.paymentRequiredDesc", "A booking is waiting for payment. Complete payment to confirm your reservation.")}
            </p>
          </div>
          <Link
            to={`/checkout/${urgentPaymentBookingId}`}
            className="shrink-0 px-4 py-2 bg-destructive text-destructive-foreground rounded-md text-sm font-medium hover:bg-destructive/90 transition-colors"
          >
            {t("bookings.details.payNow", "Pay Now")}
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

// Error boundary for route errors
export { RouteErrorBoundary as ErrorBoundary };
