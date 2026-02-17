import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import type { ComponentType } from "react";
import { useLoaderData, Link, redirect } from "react-router";
import {
  Package,
  Calendar,
  DollarSign,
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
} from "~/components/ui";
import { PageContainer, PageHeader, DashboardSidebar } from "~/components/layout";
import type { SidebarSection } from "~/components/layout";
import { cn } from "~/lib/utils";
import { PageSkeleton } from "~/components/ui/skeleton";
import { ownerNavSections } from "~/config/navigation";
import { notificationsApi } from "~/lib/api/notifications";
import { messagingApi } from "~/lib/api/messaging";

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
  if (user.role !== "owner") {
    return redirect("/dashboard/renter");
  }

  try {
    const [rawListings, rawBookings, rawEarnings, rawStats, unreadNotifs, unreadMsgs] = await Promise.all([
      listingsApi.getMyListings(),
      bookingsApi.getOwnerBookings(),
      paymentsApi.getEarnings(),
      usersApi.getUserStats(),
      notificationsApi.getUnreadCount().catch(() => ({ count: 0 })),
      messagingApi.getUnreadCount().catch(() => ({ count: 0 })),
    ]);
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
      pendingEarnings: safeNumber(rawEarnings?.amount),
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
      unreadNotifications: typeof unreadNotifs?.count === "number" ? unreadNotifs.count : 0,
      unreadMessages: typeof unreadMsgs?.count === "number" ? unreadMsgs.count : 0,
    };
  } catch (error) {
    console.error("Failed to load owner dashboard:", error);
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
      error: "Failed to load owner dashboard data",
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
    PENDING_OWNER_APPROVAL: { variant: "warning" as const, icon: Clock, label: "Pending Approval" },
    PENDING_PAYMENT: { variant: "warning" as const, icon: Clock, label: "Pending Payment" },
    PENDING: { variant: "warning" as const, icon: Clock, label: "Pending" },
    CONFIRMED: { variant: "success" as const, icon: CheckCircle, label: "Confirmed" },
    IN_PROGRESS: { variant: "default" as const, icon: Package, label: "In Progress" },
    AWAITING_RETURN_INSPECTION: { variant: "warning" as const, icon: Clock, label: "Return Requested" },
    COMPLETED: { variant: "success" as const, icon: CheckCircle, label: "Completed" },
    SETTLED: { variant: "success" as const, icon: CheckCircle, label: "Settled" },
    CANCELLED: { variant: "destructive" as const, icon: XCircle, label: "Cancelled" },
    DISPUTED: { variant: "destructive" as const, icon: XCircle, label: "Disputed" },
    REFUNDED: { variant: "destructive" as const, icon: XCircle, label: "Refunded" },
  };

  const statusKey = String(booking.status || "PENDING").toUpperCase();
  const config =
    statusConfig[statusKey as keyof typeof statusConfig] || statusConfig.PENDING;
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
          <h3 className="font-semibold text-foreground mb-1">
            {listingTitle}
          </h3>
          <p className="text-sm text-muted-foreground">
            {renterFirstName}{renterLastName ? ` ${renterLastName}` : ""}
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
          ${safeNumber(booking.totalAmount ?? booking.totalPrice).toFixed(2)}
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
            ${listing.pricePerDay}/day
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
  const { stats, listings, recentBookings, unreadNotifications, unreadMessages, error } = useLoaderData<typeof clientLoader>();
  const pendingEarnings = safeNumber(stats.pendingEarnings);
  const totalEarnings = safeNumber(stats.totalEarnings);
  const averageRating = safeNumber(stats.averageRating);

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
          title="Owner Dashboard"
          description="Manage your listings, bookings, and earnings"
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
                icon={Package}
                label="Active Listings"
                value={`${stats.activeListings}/${stats.totalListings}`}
              />
              <StatCard
                icon={DollarSign}
                label="Pending Earnings"
                value={`$${pendingEarnings.toFixed(2)}`}
                variant="success"
              />
              <StatCard
                icon={Calendar}
                label="Active Bookings"
                value={stats.activeBookings}
                variant="info"
              />
              <StatCard
                icon={Star}
                label="Avg Rating"
                value={averageRating.toFixed(1)}
                trend={`${stats.totalReviews} reviews`}
                variant="warning"
              />
            </div>

            {/* Pending Actions */}
            {stats.pendingBookings > 0 && (
              <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 flex items-start">
                <AlertCircle className="w-5 h-5 text-warning mr-3 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground mb-1">
                    Action Required
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
                  Review Now
                </Link>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Main Content */}
              <div className="lg:col-span-2 space-y-8">
                {/* Recent Bookings */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Recent Bookings</CardTitle>
                    <Link
                      to="/bookings"
                      className="text-sm text-primary hover:text-primary/90 font-medium flex items-center"
                    >
                      View All
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
                          <p className="text-muted-foreground">No bookings yet</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* My Listings */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>My Listings</CardTitle>
                    <div className="flex gap-3">
                      <Link
                        to="/listings"
                        className="text-sm text-primary hover:text-primary/90 font-medium flex items-center"
                      >
                        View All
                        <ArrowUpRight className="w-4 h-4 ml-1" />
                      </Link>
                      <Link
                        to="/listings/new"
                        className="inline-flex items-center justify-center h-9 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        New Listing
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {listings.length > 0 ? (
                        listings.map((listing: Listing) => (
                          <ListingCard key={listing.id} listing={listing} />
                        ))
                      ) : (
                        <div className="col-span-2 text-center py-8">
                          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                          <p className="text-muted-foreground mb-4">
                            No listings yet
                          </p>
                          <Link
                            to="/listings/new"
                            className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                          >
                            <Plus className="w-5 h-5 mr-2" />
                            Create Your First Listing
                          </Link>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar Content */}
              <div className="space-y-6">
                {/* Earnings Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle>Earnings Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center pb-3 border-b">
                        <span className="text-muted-foreground">Total Earned</span>
                        <span className="text-xl font-bold text-success">
                          ${totalEarnings.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pb-3 border-b">
                        <span className="text-muted-foreground">Pending</span>
                        <span className="text-lg font-semibold text-warning">
                          ${pendingEarnings.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">
                          Completed Rentals
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
                      View Earnings Details
                    </Link>
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Link
                        to="/listings/new"
                        className="flex items-center w-full px-4 py-3 text-left text-foreground hover:bg-accent rounded-md transition-colors"
                      >
                        <Plus className="w-5 h-5 mr-3 text-primary" />
                        Create New Listing
                      </Link>
                      <Link
                        to="/dashboard/owner/calendar"
                        className="flex items-center w-full px-4 py-3 text-left text-foreground hover:bg-accent rounded-md transition-colors"
                      >
                        <Calendar className="w-5 h-5 mr-3 text-primary" />
                        View Calendar
                      </Link>
                      <Link
                        to="/messages"
                        className="flex items-center w-full px-4 py-3 text-left text-foreground hover:bg-accent rounded-md transition-colors"
                      >
                        <MessageCircle className="w-5 h-5 mr-3 text-primary" />
                        View Messages
                      </Link>
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

export { RouteErrorBoundary as ErrorBoundary };
