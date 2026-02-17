import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import type { ComponentType } from "react";
import { useLoaderData, Link, redirect } from "react-router";
import { useState } from "react";
import {
  User,
  Calendar,
  Star,
  Package,
  MessageCircle,
  Shield,
  Clock,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { usersApi } from "~/lib/api/users";
import { listingsApi } from "~/lib/api/listings";
import { reviewsApi } from "~/lib/api/reviews";
import { useAuthStore } from "~/lib/store/auth";
import type { Listing } from "~/types/listing";
import type { Review } from "~/types/review";
import { format } from "date-fns";
import { RouteErrorBoundary } from "~/components/ui";

export const meta: MetaFunction<typeof clientLoader> = ({ data }) => {
  const firstName = data?.user?.firstName || "";
  const lastName = data?.user?.lastName || "";
  const titleName = `${firstName} ${lastName}`.trim();
  return [
    {
      title: `${titleName || "User"} Profile | GharBatai Rentals`,
    },
  ];
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value: string | undefined): value is string =>
  Boolean(value && UUID_PATTERN.test(value));
const safeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const safeDateLabel = (value: unknown, pattern: string): string => {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? "Unknown" : format(date, pattern);
};
const safeText = (value: unknown, fallback = ""): string => {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
};
const safeInitial = (value: unknown): string => {
  const text = safeText(value, "U");
  return text.charAt(0).toUpperCase();
};

export async function clientLoader({ params }: LoaderFunctionArgs) {
  const userId = params.userId;
  if (!isUuid(userId)) {
    throw redirect("/");
  }

  try {
    const [user, listingsResponse, reviewsResponse] = await Promise.all([
      usersApi.getUserById(userId),
      listingsApi.getListingsByOwnerId(userId),
      reviewsApi.getPublicUserReviews(userId),
    ]);

    const listings = Array.isArray(listingsResponse.listings)
      ? listingsResponse.listings
      : [];
    const reviews = Array.isArray(reviewsResponse.reviews)
      ? reviewsResponse.reviews
      : [];

    // Calculate statistics
    const totalListings = listings.length;
    const activeListings = listings.filter((l) => l.status === "AVAILABLE").length;
    const averageRating =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + (r.overallRating ?? r.rating ?? 0), 0) / reviews.length
        : 0;
    const totalReviews = reviews.length;

    return {
      user,
      listings,
      reviews,
      stats: {
        totalListings,
        activeListings,
        averageRating,
        totalReviews,
      },
    };
  } catch (error) {
    console.error("Failed to load user profile:", error);
    throw redirect("/");
  }
}

function StatCard({
  icon: Icon,
  label,
  value,
  color = "primary",
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  color?: string;
}) {
  const colorClasses: Record<string, { bg: string; text: string }> = {
    primary: { bg: "bg-primary/10", text: "text-primary" },
    yellow: { bg: "bg-yellow-100", text: "text-yellow-600" },
    green: { bg: "bg-success/10", text: "text-success" },
    blue: { bg: "bg-blue-100", text: "text-blue-600" },
  };

  const colors = colorClasses[color] || colorClasses.primary;

  return (
    <div className="bg-card rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-1">{label}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
        </div>
        <div className={cn("p-3 rounded-full", colors.bg)}>
          <Icon className={cn("w-6 h-6", colors.text)} />
        </div>
      </div>
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const ratingValue = review.overallRating ?? review.rating ?? 0;
  const reviewerFirstName = safeText(review.reviewer?.firstName, "User");
  const reviewerLastName = safeText(review.reviewer?.lastName);
  const reviewerFullName = `${reviewerFirstName}${reviewerLastName ? ` ${reviewerLastName}` : ""}`;
  const reviewedListingTitle = safeText(review.listing?.title, "Listing");
  const reviewedListingId = safeText(review.listing?.id);
  return (
    <div className="bg-card rounded-lg shadow-md p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <User className="w-6 h-6 text-muted-foreground" />
          </div>
          <div className="ml-3">
            <p className="font-medium text-foreground">
              {reviewerFullName}
            </p>
            <p className="text-sm text-muted-foreground">
              {safeDateLabel(review.createdAt, "MMM d, yyyy")}
            </p>
          </div>
        </div>
        <div className="flex items-center">
          <Star className="w-5 h-5 text-yellow-400 fill-current" />
          <span className="ml-1 font-semibold text-foreground">
            {safeNumber(ratingValue).toFixed(1)}
          </span>
        </div>
      </div>
      <p className="text-foreground/80">{review.comment}</p>
      {review.listing && (
        <Link
          to={reviewedListingId ? `/listings/${reviewedListingId}` : "/listings"}
          className="mt-3 text-sm text-primary hover:text-primary/80 flex items-center"
        >
          <Package className="w-4 h-4 mr-1" />
          {reviewedListingTitle}
        </Link>
      )}
    </div>
  );
}

function ListingCard({ listing }: { listing: Listing }) {
  const listingTitle = safeText(listing.title, "Listing");
  const listingId = safeText(listing.id);
  return (
    <Link
      to={listingId ? `/listings/${listingId}` : "/listings"}
      className="bg-card rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
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
        {listing.status === "AVAILABLE" && (
          <span className="absolute top-2 right-2 px-2 py-1 bg-success text-success-foreground text-xs font-semibold rounded">
            Available
          </span>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-foreground mb-2 line-clamp-1">
          {listingTitle}
        </h3>
        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
          {listing.description}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-primary">
            ${listing.pricePerDay}/day
          </span>
          {(listing.averageRating || 0) > 0 && (
            <div className="flex items-center">
              <Star className="w-4 h-4 text-yellow-400 fill-current" />
              <span className="ml-1 text-sm text-muted-foreground">
                {safeNumber(listing.averageRating).toFixed(1)}
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function ProfileRoute() {
  const { user, listings, reviews, stats } = useLoaderData<typeof clientLoader>();
  const { user: currentUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<"listings" | "reviews">(
    "listings"
  );

  const memberSince = user.createdAt
    ? safeDateLabel(user.createdAt, "MMMM yyyy")
    : "Unknown";
  const firstName = safeText(user.firstName, "User");
  const lastName = safeText(user.lastName);
  const fullName = `${firstName}${lastName ? ` ${lastName}` : ""}`;
  const responseRate = safeNumber(user.responseRate ?? 100);
  const responseTime = user.responseTime || "1 hour";

  const primaryListingId = listings[0]?.id;
  const canContact = Boolean(
    primaryListingId && currentUser?.id && currentUser.id !== user.id
  );

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Profile Header */}
        <div className="bg-card rounded-lg shadow-md p-8 mb-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            {/* Avatar */}
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-primary text-3xl font-bold flex-shrink-0">
              {user.profilePhotoUrl ? (
                <img
                  src={user.profilePhotoUrl}
                  alt={fullName}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                safeInitial(user.firstName)
              )}
            </div>

            {/* User Info */}
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-foreground mb-2">
                    {fullName}
                  </h1>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      Member since {memberSince}
                    </div>
                  </div>
                </div>

                {/* Verification Badge */}
                {user.idVerificationStatus === "VERIFIED" && (
                  <div className="flex items-center px-3 py-1 bg-success/10 text-success rounded-full text-sm">
                    <Shield className="w-4 h-4 mr-1" />
                    Verified
                  </div>
                )}
              </div>

              {user.bio && (
                <p className="mt-4 text-foreground/80">{user.bio}</p>
              )}
            </div>

            {/* Contact Button */}
            {canContact ? (
              <Link
                to={`/messages?listing=${primaryListingId}&participant=${user.id}`}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center whitespace-nowrap"
              >
                <MessageCircle className="w-5 h-5 mr-2" />
                Contact
              </Link>
            ) : null}
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            icon={Package}
            label="Active Listings"
            value={stats.activeListings}
            color="primary"
          />
          <StatCard
            icon={Star}
            label="Average Rating"
            value={
              safeNumber(stats.averageRating) > 0
                ? safeNumber(stats.averageRating).toFixed(1)
                : "N/A"
            }
            color="yellow"
          />
          <StatCard
            icon={MessageCircle}
            label="Response Rate"
            value={`${responseRate}%`}
            color="green"
          />
          <StatCard
            icon={Clock}
            label="Response Time"
            value={responseTime}
            color="blue"
          />
        </div>

        {/* Tabs */}
        <div className="bg-card rounded-lg shadow-md">
          <div className="border-b border-border">
            <div className="flex">
              <button
                onClick={() => setActiveTab("listings")}
                className={cn(
                  "px-6 py-4 font-medium text-sm border-b-2 transition-colors",
                  activeTab === "listings"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                Listings ({stats.totalListings})
              </button>
              <button
                onClick={() => setActiveTab("reviews")}
                className={cn(
                  "px-6 py-4 font-medium text-sm border-b-2 transition-colors",
                  activeTab === "reviews"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                Reviews ({stats.totalReviews})
              </button>
            </div>
          </div>

          <div className="p-6">
            {activeTab === "listings" && (
              <div>
                {listings.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {listings.map((listing) => (
                      <ListingCard key={listing.id} listing={listing} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      No listings available
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "reviews" && (
              <div>
                {reviews.length > 0 ? (
                  <div className="space-y-4">
                    {reviews.map((review) => (
                      <ReviewCard key={review.id} review={review} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Star className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No reviews yet</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
export { RouteErrorBoundary as ErrorBoundary };
