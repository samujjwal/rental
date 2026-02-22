import type { MetaFunction } from "react-router";
import { useLoaderData, Link, useSearchParams, useActionData, redirect } from "react-router";
import {
  Star,
  User,
  Package,
  AlertCircle,
  CheckCircle,
  Clock,
} from "lucide-react";
import { reviewsApi } from "~/lib/api/reviews";
import { getUser } from "~/utils/auth";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  Badge,
  RouteErrorBoundary,
} from "~/components/ui";
import { UnifiedButton } from "~/components/ui";
import { cn } from "~/lib/utils";
import { Skeleton } from "~/components/ui/skeleton";

import type { Review } from "~/types/review";

export const meta: MetaFunction = () => {
  return [
    { title: "Reviews | GharBatai Rentals" },
    { name: "description", content: "Manage and view your reviews" },
  ];
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value: string | null): value is string =>
  Boolean(value && UUID_PATTERN.test(value));
const safeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const safeDateLabel = (value: unknown, pattern: string): string => {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? "Unknown date" : format(date, pattern);
};
const safeText = (value: unknown, fallback = ""): string => {
  const text = typeof value === "string" ? value : "";
  return text || fallback;
};

export async function clientLoader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const rawView = url.searchParams.get("view");
  const view = rawView === "given" ? "given" : "received";
  const rating = url.searchParams.get("rating");
  const ratingNumber = rating ? Number.parseInt(rating, 10) : Number.NaN;
  const normalizedRating =
    Number.isInteger(ratingNumber) && ratingNumber >= 1 && ratingNumber <= 5
      ? ratingNumber
      : null;
  const rawPage = Number(url.searchParams.get("page") ?? "1");
  const page =
    Number.isFinite(rawPage) && rawPage > 0
      ? Math.min(Math.floor(rawPage), 1000)
      : 1;
  const limit = 10;

  try {
    const currentUser = await getUser(request);
    if (!currentUser) {
      return redirect("/auth/login");
    }

    const reviewResponse = await reviewsApi.getUserReviews(
      currentUser.id,
      view,
      page,
      limit
    );
    const reviews = reviewResponse.reviews || [];

    // Filter by rating if specified
    const filteredReviews = Number.isInteger(normalizedRating)
      ? reviews.filter((r: Review) =>
          (r.overallRating ?? r.rating) === normalizedRating
        )
      : reviews;

    // Calculate stats
    const stats = {
      total: reviewResponse.total || reviews.length,
      averageRating: reviews.length > 0
        ? reviews.reduce((sum: number, r: Review) => sum + (r.overallRating ?? r.rating ?? 0), 0) / reviews.length
        : 0,
      ratings: {
        5: reviews.filter((r: Review) => (r.overallRating ?? r.rating) === 5).length,
        4: reviews.filter((r: Review) => (r.overallRating ?? r.rating) === 4).length,
        3: reviews.filter((r: Review) => (r.overallRating ?? r.rating) === 3).length,
        2: reviews.filter((r: Review) => (r.overallRating ?? r.rating) === 2).length,
        1: reviews.filter((r: Review) => (r.overallRating ?? r.rating) === 1).length,
      },
      pending: reviews.filter((r: Review) => r.status === "DRAFT").length,
    };

    return { reviews: filteredReviews, stats, view, error: null, page, total: reviewResponse.total || reviews.length, limit };
  } catch (error: unknown) {
    return {
      reviews: [],
      stats: { total: 0, averageRating: 0, ratings: {}, pending: 0 },
      view,
      error:
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: string }).message)
          : "Failed to load reviews",
      page: 1,
      total: 0,
      limit: 10,
    };
  }
}

export async function clientAction({ request }: { request: Request }) {
  const currentUser = await getUser(request);
  if (!currentUser) {
    return redirect("/auth/login");
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  if (intent !== "delete") {
    return { success: false, message: "Unknown action" };
  }
  const reviewId = String(formData.get("reviewId") ?? "").trim();
  const requestView = new URL(request.url).searchParams.get("view");
  const view = String(formData.get("view") || requestView || "");

  try {
    if (!isUuid(reviewId)) {
      return { success: false, message: "Missing review ID" };
    }
    if (view !== "given") {
      return { success: false, message: "Only authored reviews can be deleted." };
    }
    await reviewsApi.deleteReview(reviewId);
    return { success: true, message: "Review deleted successfully" };
  } catch (error: unknown) {
    return {
      success: false,
      message:
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: string }).message)
          : "Action failed",
    };
  }
}

function RatingStars({ rating, size = "default" }: { rating: number; size?: "small" | "default" }) {
  const sizeClass = size === "small" ? "w-4 h-4" : "w-5 h-5";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            sizeClass,
            star <= rating ? "text-yellow-500 fill-current" : "text-gray-300"
          )}
        />
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const ratingValue = review.overallRating ?? review.rating ?? 0;
  const reviewerFirstName = safeText(review.reviewer?.firstName, "User");
  const reviewerLastName = safeText(review.reviewer?.lastName);
  const reviewerFullName = `${reviewerFirstName}${reviewerLastName ? ` ${reviewerLastName}` : ""}`;
  const listingTitle = safeText(review.listing?.title, "Listing");
  const listingId = safeText(review.listing?.id);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex gap-4">
          {/* Reviewer Avatar */}
          <div className="flex-shrink-0">
            {review.reviewer?.profilePhotoUrl ? (
              <img
                src={review.reviewer.profilePhotoUrl}
                alt={reviewerFullName}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
              </div>
            )}
          </div>

          {/* Review Content */}
          <div className="flex-1">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-semibold text-foreground">
                  {reviewerFullName}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <RatingStars rating={ratingValue} size="small" />
                  <span className="text-sm text-muted-foreground">
                    {safeDateLabel(review.createdAt, "MMM d, yyyy")}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {review.status === "DRAFT" && (
                  <Badge variant="warning">
                    <Clock className="w-3 h-3 mr-1" />
                    Pending
                  </Badge>
                )}
                {review.status === "HIDDEN" && (
                  <Badge variant="destructive">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Hidden
                  </Badge>
                )}
              </div>
            </div>

            {/* Listing Info */}
            {review.listing && (
              <Link
                to={listingId ? `/listings/${listingId}` : "/listings"}
                className="flex items-center gap-2 p-2 bg-muted rounded-lg mb-3 hover:bg-muted/80 transition-colors"
              >
                <div className="w-10 h-10 rounded bg-muted-foreground/20 overflow-hidden flex-shrink-0">
                  {review.listing?.photos?.[0] ? (
                    <img src={review.listing.photos[0]} alt={listingTitle} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <span className="text-sm font-medium text-foreground">{listingTitle}</span>
              </Link>
            )}

            {/* Review Text */}
            <p className="text-foreground mb-4">{review.comment}</p>

            {/* Owner Response */}
            {review.response && (
              <div className="bg-primary/5 border-l-4 border-primary p-4 rounded-r-lg mb-4">
                <p className="text-sm font-medium text-foreground mb-1">Owner Response</p>
                <p className="text-sm text-muted-foreground">{review.response}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {review.responseAt
                    ? safeDateLabel(review.responseAt, "MMM d, yyyy")
                    : null}
                </p>
              </div>
            )}

          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ReviewsPage() {
  const { reviews, stats, view, error, page, total, limit } = useLoaderData<typeof clientLoader>();
  const actionData = useActionData<typeof clientAction>();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentRating = searchParams.get("rating");

  const handleViewChange = (newView: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("view", newView);
    params.set("page", "1");
    setSearchParams(params);
  };

  const handleRatingFilter = (rating: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (rating) {
      params.set("rating", rating);
      params.set("page", "1");
    } else {
      params.delete("rating");
    }
    setSearchParams(params);
  };

  const totalPages = Math.ceil(total / limit);

  if (error) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive">
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">Reviews</h1>
            <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success/Error Messages */}
        {actionData?.success && (
          <div className="mb-6 p-4 bg-success/10 border border-success/30 rounded-lg flex items-center gap-2 text-success">
            <CheckCircle className="w-5 h-5" />
            {actionData.message}
          </div>
        )}
        {actionData?.success === false && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive">
            <AlertCircle className="w-5 h-5" />
            {actionData.message}
          </div>
        )}

        {/* Stats Overview */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              {/* Average Rating */}
              <div className="text-center">
                <p className="text-5xl font-bold text-foreground">
                  {safeNumber(stats.averageRating).toFixed(1)}
                </p>
                <RatingStars rating={Math.round(safeNumber(stats.averageRating))} />
                <p className="text-sm text-muted-foreground mt-1">
                  {stats.total} reviews
                  <span className="ml-2 text-xs text-muted-foreground">(page stats)</span>
                </p>
              </div>

              {/* Rating Breakdown */}
              <div className="flex-1 w-full">
                {[5, 4, 3, 2, 1].map((rating) => {
                  const count = (stats.ratings as Record<number, number>)[rating] || 0;
                  const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
                  return (
                    <button
                      key={rating}
                      onClick={() => handleRatingFilter(currentRating === String(rating) ? null : String(rating))}
                      className={cn(
                        "flex items-center gap-2 w-full py-1 hover:bg-muted rounded transition-colors",
                        currentRating === String(rating) && "bg-muted"
                      )}
                    >
                      <span className="text-sm text-muted-foreground w-6">{rating}</span>
                      <Star className="w-4 h-4 text-yellow-500 fill-current" />
                      <div className="flex-1 bg-muted rounded-full h-2">
                        <div
                          className="bg-yellow-500 h-2 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-8">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* View Toggle */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => handleViewChange("received")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              view === "received"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            Reviews Received
          </button>
          <button
            onClick={() => handleViewChange("given")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              view === "given"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            Reviews Given
          </button>
        </div>

        {/* Reviews List */}
        <div className="space-y-4">
          {reviews.length > 0 ? (
            reviews.map((review: Review) => (
              <ReviewCard key={review.id} review={review} />
            ))
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Star className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No reviews yet</h3>
                <p className="text-muted-foreground mb-4">
                  {view === "received"
                    ? "You haven't received any reviews yet. Complete more rentals to get feedback!"
                    : "You haven't left any reviews yet. Share your experience after your next rental!"}
                </p>
                <Link to="/bookings">
                  <UnifiedButton>View Bookings</UnifiedButton>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>

        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <UnifiedButton
              variant="outline"
              disabled={page <= 1}
              onClick={() => {
                const params = new URLSearchParams(searchParams);
                params.set("page", String(page - 1));
                setSearchParams(params);
              }}
            >
              Previous
            </UnifiedButton>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <UnifiedButton
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => {
                const params = new URLSearchParams(searchParams);
                params.set("page", String(page + 1));
                setSearchParams(params);
              }}
            >
              Next
            </UnifiedButton>
          </div>
        )}
      </div>
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };

