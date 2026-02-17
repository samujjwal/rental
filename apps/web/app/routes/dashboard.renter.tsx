import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import type { ComponentType } from "react";
import { useLoaderData, Link, redirect } from "react-router";
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
} from "lucide-react";
import { requireUser } from "~/utils/auth";
import { bookingsApi } from "~/lib/api/bookings";
import { getFavorites } from "~/lib/api/favorites";
import { listingsApi } from "~/lib/api/listings";
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
} from "~/components/ui";
import { PageContainer, PageHeader, DashboardSidebar } from "~/components/layout";
import type { SidebarSection } from "~/components/layout";
import { cn } from "~/lib/utils";
import { PageSkeleton } from "~/components/ui/skeleton";
import { renterNavSections } from "~/config/navigation";
import { notificationsApi } from "~/lib/api/notifications";
import { messagingApi } from "~/lib/api/messaging";

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
  return Number.isNaN(date.getTime()) ? "Date unavailable" : format(date, pattern);
};
const safeText = (value: unknown, fallback = ""): string => {
  const text = typeof value === "string" ? value : "";
  return text || fallback;
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
    const [bookingsResponse, favoritesResponse, recommendationsResponse, unreadNotifs, unreadMsgs] = await Promise.all([
      bookingsApi.getMyBookings(),
      getFavorites(),
      listingsApi.searchListings({ limit: 4 }),
      notificationsApi.getUnreadCount().catch(() => ({ count: 0 })),
      messagingApi.getUnreadCount().catch(() => ({ count: 0 })),
    ]);
    const bookings = Array.isArray(bookingsResponse) ? bookingsResponse : [];
    const favoritesRaw = Array.isArray(favoritesResponse.favorites)
      ? favoritesResponse.favorites
      : [];
    const recommendationsRaw = Array.isArray(recommendationsResponse.listings)
      ? recommendationsResponse.listings
      : [];

    const favorites = favoritesRaw.map((favorite) => ({
      ...favorite.listing,
      savedAt: favorite.createdAt,
    }));
    const recommendations = recommendationsRaw;

    const normalizeStatus = (status: unknown) => safeStatusKey(status);

    // Calculate statistics
    const upcomingBookings = bookings.filter((b) => {
      const status = normalizeStatus(b.status);
      return status === "CONFIRMED" && new Date(String(b.startDate || "")).getTime() > Date.now();
    }).length;
    const activeBookings = bookings.filter((b) => {
      const status = normalizeStatus(b.status);
      return status === "IN_PROGRESS" || status === "AWAITING_RETURN_INSPECTION";
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
      unreadNotifications: typeof unreadNotifs?.count === "number" ? unreadNotifs.count : 0,
      unreadMessages: typeof unreadMsgs?.count === "number" ? unreadMsgs.count : 0,
    };
  } catch (error) {
    console.error("Failed to load renter dashboard:", error);
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
      error: "Failed to load renter dashboard data",
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
    PENDING_PAYMENT: { variant: "warning" as const, icon: Clock, label: "Pending Payment" },
    PENDING_OWNER_APPROVAL: { variant: "warning" as const, icon: Clock, label: "Pending Approval" },
    CONFIRMED: {
      variant: "success" as const,
      icon: CheckCircle,
      label: "Confirmed",
    },
    IN_PROGRESS: { variant: "default" as const, icon: Package, label: "In Progress" },
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
    SETTLED: { variant: "success" as const, icon: CheckCircle, label: "Settled" },
  };

  const normalizedStatus = safeStatusKey(booking.status);
  const config =
    statusConfig[normalizedStatus as keyof typeof statusConfig] || statusConfig.PENDING;
  const StateIcon = config.icon;
  const bookingStartAt = new Date(String(booking.startDate || "")).getTime();
  const isUpcoming = Number.isFinite(bookingStartAt) && bookingStartAt > Date.now();
  const isActive = normalizedStatus === "IN_PROGRESS";

  const locationStr = safeLocationLabel(booking.listing?.location);
  const listingTitle = safeText(booking.listing?.title, "Listing");
  const bookingId = safeText(booking.id);

  return (
    <Link
      to={bookingId ? `/bookings/${bookingId}` : "/bookings"}
      className="block bg-card border rounded-lg p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex gap-4">
        {/* Image */}
        <div className="w-20 h-20 rounded-lg bg-muted flex-shrink-0 overflow-hidden">
          {booking.listing?.images?.[0] ? (
            <img
              src={booking.listing.images[0]}
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
              ${safeNumber(booking.totalAmount ?? booking.totalPrice).toFixed(2)}
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
          <div className="absolute top-2 right-2 p-2 bg-card rounded-full">
            <Heart className="w-5 h-5 text-destructive fill-current" />
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
            ${listing.pricePerDay}/day
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
  const { stats, recentBookings, favorites, recommendations, unreadNotifications, unreadMessages, error } =
    useLoaderData<typeof clientLoader>();
  const totalSpent = safeNumber(stats.totalSpent);

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

  return (
    <div className="min-h-screen bg-background py-8">
      <PageContainer>
        {error ? (
          <div className="mb-6 bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive">
            {error}
          </div>
        ) : null}
        {/* Header */}
        <PageHeader
          title="Renter Dashboard"
          description="Track your bookings and discover new items"
          className="mb-8"
        />

        <div className="flex gap-8">
          {/* Sidebar Navigation */}
          <DashboardSidebar sections={navWithBadges} />

          {/* Main Content */}
          <div className="flex-1 space-y-8">
            {/* Statistics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                icon={Calendar}
                label="Upcoming Bookings"
                value={stats.upcomingBookings}
                variant="info"
              />
              <StatCard
                icon={Package}
                label="Active Rentals"
                value={stats.activeBookings}
              />
              <StatCard
                icon={CheckCircle}
                label="Completed Bookings"
                value={stats.completedBookings}
                variant="success"
              />
              <StatCard
                icon={Heart}
                label="Favorites"
                value={stats.favoriteCount}
                variant="warning"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Main Content */}
              <div className="lg:col-span-2 space-y-8">
                {/* My Bookings */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>My Bookings</CardTitle>
                    <Link
                      to="/bookings"
                      className="text-sm text-primary hover:text-primary/90 font-medium"
                    >
                      View All →
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
                            No bookings yet
                          </p>
                          <Link
                            to="/search"
                            className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                          >
                            <Search className="w-5 h-5 mr-2" />
                            Start Browsing
                          </Link>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Recommended for You */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center">
                      <TrendingUp className="w-5 h-5 mr-2 text-primary" />
                      Recommended for You
                    </CardTitle>
                    <Link
                      to="/search"
                      className="text-sm text-primary hover:text-primary/90 font-medium"
                    >
                      Explore More →
                    </Link>
                  </CardHeader>
                  <CardContent>
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
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar Content */}
              <div className="space-y-6">
                {/* Spending Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle>Spending Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center pb-3 border-b">
                        <span className="text-muted-foreground">Total Spent</span>
                        <span className="text-xl font-bold text-primary">
                          ${totalSpent.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pb-3 border-b">
                        <span className="text-muted-foreground">
                          Completed Rentals
                        </span>
                        <span className="font-semibold text-foreground">
                          {stats.completedBookings}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">
                          Active Bookings
                        </span>
                        <span className="font-semibold text-foreground">
                          {stats.activeBookings}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* My Favorites */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>My Favorites</CardTitle>
                    <Link
                      to="/favorites"
                      className="text-sm text-primary hover:text-primary/90 font-medium"
                    >
                      View All →
                    </Link>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {favorites.length > 0 ? (
                        favorites.map((listing) => (
                          (() => {
                            const listingId = safeText(listing.id);
                            const listingTitle = safeText(listing.title, "Listing");
                            return (
                              <Link
                                key={listing.id}
                                to={listingId ? `/listings/${listingId}` : "/listings"}
                                className="flex gap-3 p-2 rounded-lg hover:bg-accent transition-colors"
                              >
                                <div className="w-16 h-16 rounded-lg bg-muted flex-shrink-0 overflow-hidden">
                                  {listing.images?.[0] ? (
                                    <img
                                      src={listing.images[0]}
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
                                    ${listing.pricePerDay}/day
                                  </p>
                                </div>
                              </Link>
                            );
                          })()
                        ))
                      ) : (
                        <div className="text-center py-6">
                          <Heart className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">
                            No favorites yet
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}

// Error boundary for route errors
export { RouteErrorBoundary as ErrorBoundary };
