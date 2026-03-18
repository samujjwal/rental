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
import { useTranslation } from "react-i18next";

import type { Review } from "~/types/review";
import type { ReviewListResponse } from "~/types/review";

export const meta: MetaFunction = () => {
  return [
    { title: "Reviews | GharBatai Rentals" },
    { name: "description", content: "Manage and view your reviews" },
  ];
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{5,127}$/;
const isValidReviewId = (value: string | null): value is string =>
  Boolean(value && (UUID_PATTERN.test(value) || SAFE_ID_PATTERN.test(value)));
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
const EMPTY_RATINGS: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
const EMPTY_STATS = {
  total: 0,
  averageRating: 0,
  ratings: EMPTY_RATINGS,
  pending: 0,
};
const buildFallbackStats = (reviews: Review[], total: number) => ({
  total,
  averageRating: reviews.length > 0
    ? reviews.reduce((sum: number, review: Review) => sum + (review.overallRating ?? review.rating ?? 0), 0) /
      reviews.length
    : 0,
  ratings: {
    5: reviews.filter((review: Review) => (review.overallRating ?? review.rating) === 5).length,
    4: reviews.filter((review: Review) => (review.overallRating ?? review.rating) === 4).length,
    3: reviews.filter((review: Review) => (review.overallRating ?? review.rating) === 3).length,
    2: reviews.filter((review: Review) => (review.overallRating ?? review.rating) === 2).length,
    1: reviews.filter((review: Review) => (review.overallRating ?? review.rating) === 1).length,
  },
  pending: reviews.filter((review: Review) => review.status === "DRAFT").length,
});
const resolveSummaryStats = (
  reviewResponse: ReviewListResponse,
  reviews: Review[]
): {
  stats: {
    total: number;
    averageRating: number;
    ratings: Record<number, number>;
    pending: number;
  };
  statsScope: "overall" | "current_results" | "unavailable";
  statsAvailable: boolean;
} => {
  if (reviewResponse.stats) {
    return {
      stats: {
        total: reviewResponse.stats.totalReviews,
        averageRating: reviewResponse.stats.averageRating,
        ratings: reviewResponse.stats.ratings,
        pending: reviewResponse.stats.pending,
      },
      statsScope: "overall",
      statsAvailable: true,
    };
  }

  const filteredTotal = reviewResponse.total || reviews.length;
  if (filteredTotal <= reviews.length) {
    return {
      stats: buildFallbackStats(reviews, filteredTotal),
      statsScope: "current_results",
      statsAvailable: true,
    };
  }

  return {
    stats: EMPTY_STATS,
    statsScope: "unavailable",
    statsAvailable: false,
  };
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
      limit,
      normalizedRating ?? undefined
    );
    const reviews = reviewResponse.reviews || [];
    const { stats, statsScope, statsAvailable } = resolveSummaryStats(
      reviewResponse,
      reviews
    );

    return {
      reviews,
      stats,
      statsScope,
      statsAvailable,
      view,
      error: null,
      page,
      total: reviewResponse.total || reviews.length,
      limit,
      activeRating: normalizedRating,
    };
  } catch (error: unknown) {
    return {
      reviews: [],
      stats: EMPTY_STATS,
      statsScope: "unavailable" as const,
      statsAvailable: false,
      view,
      error:
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: string }).message)
          : "Failed to load reviews",
      page: 1,
      total: 0,
      limit: 10,
      activeRating: null,
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
    if (!isValidReviewId(reviewId)) {
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
  const { t } = useTranslation();
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
                    {t("reviews.pending")}
                  </Badge>
                )}
                {review.status === "HIDDEN" && (
                  <Badge variant="destructive">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    {t("reviews.hidden")}
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
                  {review.listing?.images?.[0] ? (
                    <img src={review.listing.images[0]} alt={listingTitle} className="w-full h-full object-cover" />
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
                <p className="text-sm font-medium text-foreground mb-1">{t("reviews.ownerResponse")}</p>
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
  const { t } = useTranslation();
  const {
    reviews,
    stats,
    statsScope,
    statsAvailable,
    view,
    error,
    page,
    total,
    limit,
    activeRating,
  } = useLoaderData<typeof clientLoader>();
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
  const summaryLabel =
    statsScope === "overall"
      ? t("reviews.overallSummary", "Overall review summary")
      : statsScope === "current_results"
        ? t("reviews.currentResultsSummary", "Summary of current results")
        : t("reviews.summaryUnavailable", "Summary unavailable for this page");
  const resultsLabel =
    total > reviews.length
      ? t("reviews.showingResults", {
          shown: reviews.length,
          total,
          defaultValue: `Showing ${reviews.length} of ${total} results`,
        })
      : t("reviews.resultsCount", {
          count: total,
          defaultValue: `${total} results`,
        });
  const filteredResultsLabel =
    activeRating !== null
      ? t("reviews.filteredResultsCount", {
          count: total,
          rating: activeRating,
          defaultValue: `${total} matching ${activeRating}-star reviews`,
        })
      : resultsLabel;

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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <h1 className="text-2xl font-bold text-foreground mb-6">{t("reviews.title")}</h1>
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
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  {summaryLabel}
                </p>
                <p className="text-5xl font-bold text-foreground">
                  {statsAvailable ? safeNumber(stats.averageRating).toFixed(1) : "—"}
                </p>
                {statsAvailable ? (
                  <RatingStars rating={Math.round(safeNumber(stats.averageRating))} />
                ) : (
                  <p className="text-sm text-muted-foreground mt-2">
                    {t(
                      "reviews.summaryUnavailableHint",
                      "Load overall stats before using the rating breakdown."
                    )}
                  </p>
                )}
                <p className="text-sm text-muted-foreground mt-1">
                  {statsScope === "overall"
                    ? t("reviews.reviewsCount", { count: stats.total })
                    : filteredResultsLabel}
                </p>
                {statsScope === "overall" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {filteredResultsLabel}
                  </p>
                )}
                {statsScope !== "overall" && total > reviews.length && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {resultsLabel}
                  </p>
                )}
                {statsAvailable && statsScope !== "overall" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {t(
                      "reviews.currentResultsSummaryHint",
                      "These stats reflect the currently loaded results."
                    )}
                  </p>
                )}
                {!statsAvailable && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {filteredResultsLabel}
                  </p>
                )}
              </div>

              {/* Rating Breakdown */}
              <div className="flex-1 w-full">
                {statsAvailable ? (
                  [5, 4, 3, 2, 1].map((rating) => {
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
                  })
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                    {t(
                      "reviews.breakdownUnavailable",
                      "Rating breakdown is unavailable until overall summary stats are loaded."
                    )}
                  </div>
                )}
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
            {t("reviews.reviewsReceived")}
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
            {t("reviews.reviewsGiven")}
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
                <h3 className="text-lg font-semibold text-foreground mb-2">{t("reviews.noReviews")}</h3>
                <p className="text-muted-foreground mb-4">
                  {view === "received"
                    ? t("reviews.noReceivedReviewsDesc")
                    : t("reviews.noGivenReviewsDesc")}
                </p>
                <Link to="/bookings">
                  <UnifiedButton>{t("reviews.viewBookings")}</UnifiedButton>
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
              {t("reviews.previous")}
            </UnifiedButton>
            <span className="text-sm text-muted-foreground">
              {t("reviews.pageOf", { page, totalPages })}
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
              {t("reviews.next")}
            </UnifiedButton>
          </div>
        )}
      </div>
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };
