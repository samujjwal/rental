import type { MetaFunction } from "react-router";
import { useLoaderData, Link, useSearchParams, Form, useActionData } from "react-router";
import { useState } from "react";
import {
  Star,
  MessageCircle,
  Calendar,
  User,
  Package,
  ThumbsUp,
  ThumbsDown,
  Flag,
  Filter,
  Search,
  Edit,
  Trash2,
  AlertCircle,
  CheckCircle,
  Clock,
} from "lucide-react";
import { reviewsApi } from "~/lib/api/reviews";
import { useAuthStore } from "~/lib/store/auth";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
} from "~/components/ui";
import { Button } from "~/components/ui";
import { cn } from "~/lib/utils";

import type { Review } from "~/types/review";

export const meta: MetaFunction = () => {
  return [
    { title: "Reviews | GharBatai Rentals" },
    { name: "description", content: "Manage and view your reviews" },
  ];
};

interface ReviewsData {
  reviews: Review[];
  stats: {
    total: number;
    averageRating: number;
    ratings: { [key: number]: number };
    pending: number;
  };
}

export async function clientLoader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const view = url.searchParams.get("view") || "received";
  const rating = url.searchParams.get("rating");

  try {
    const [received, given] = await Promise.all([
      reviewsApi.getReceivedReviews(),
      reviewsApi.getGivenReviews(),
    ]);

    const reviews = view === "given" ? given : received;

    // Filter by rating if specified
    const filteredReviews = rating
      ? reviews.filter((r: Review) => r.rating === parseInt(rating))
      : reviews;

    // Calculate stats
    const stats = {
      total: reviews.length,
      averageRating: reviews.length > 0
        ? reviews.reduce((sum: number, r: Review) => sum + r.rating, 0) / reviews.length
        : 0,
      ratings: {
        5: reviews.filter((r: Review) => r.rating === 5).length,
        4: reviews.filter((r: Review) => r.rating === 4).length,
        3: reviews.filter((r: Review) => r.rating === 3).length,
        2: reviews.filter((r: Review) => r.rating === 2).length,
        1: reviews.filter((r: Review) => r.rating === 1).length,
      },
      pending: reviews.filter((r: Review) => r.status === "pending").length,
    };

    return { reviews: filteredReviews, stats, view, error: null };
  } catch (error: any) {
    return {
      reviews: [],
      stats: { total: 0, averageRating: 0, ratings: {}, pending: 0 },
      view,
      error: error?.message || "Failed to load reviews",
    };
  }
}

export async function clientAction({ request }: { request: Request }) {
  const formData = await request.formData();
  const intent = formData.get("intent");
  const reviewId = formData.get("reviewId") as string;

  try {
    if (intent === "respond") {
      const response = formData.get("response") as string;
      await reviewsApi.respondToReview(reviewId, response);
      return { success: true, message: "Response submitted successfully" };
    }
    if (intent === "report") {
      const reason = formData.get("reason") as string;
      await reviewsApi.reportReview(reviewId, reason);
      return { success: true, message: "Review reported successfully" };
    }
    if (intent === "delete") {
      await reviewsApi.deleteReview(reviewId);
      return { success: true, message: "Review deleted successfully" };
    }
    return { success: false, message: "Unknown action" };
  } catch (error: any) {
    return { success: false, message: error?.message || "Action failed" };
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

function ReviewCard({ review, isOwner }: { review: Review; isOwner: boolean }) {
  const [showResponseForm, setShowResponseForm] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex gap-4">
          {/* Reviewer Avatar */}
          <div className="flex-shrink-0">
            {review.reviewer.avatar ? (
              <img
                src={review.reviewer.avatar}
                alt={review.reviewer.firstName}
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
                  {review.reviewer.firstName} {review.reviewer.lastName}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <RatingStars rating={review.rating} size="small" />
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(review.createdAt), "MMM d, yyyy")}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {review.status === "pending" && (
                  <Badge variant="warning">
                    <Clock className="w-3 h-3 mr-1" />
                    Pending
                  </Badge>
                )}
                {review.status === "reported" && (
                  <Badge variant="destructive">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Reported
                  </Badge>
                )}
              </div>
            </div>

            {/* Listing Info */}
            {review.listing && (
              <Link
                to={`/listings/${review.listing.id}`}
                className="flex items-center gap-2 p-2 bg-muted rounded-lg mb-3 hover:bg-muted/80 transition-colors"
              >
                <div className="w-10 h-10 rounded bg-muted-foreground/20 overflow-hidden flex-shrink-0">
                  {review.listing.images && review.listing.images[0] ? (
                    <img src={review.listing.images[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <span className="text-sm font-medium text-foreground">{review.listing.title}</span>
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
                  {review.responseAt && format(new Date(review.responseAt), "MMM d, yyyy")}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-4">
              <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ThumbsUp className="w-4 h-4" />
                Helpful
              </button>
              
              {isOwner && !review.response && (
                <button
                  onClick={() => setShowResponseForm(!showResponseForm)}
                  className="flex items-center gap-1 text-sm text-primary hover:text-primary/80"
                >
                  <MessageCircle className="w-4 h-4" />
                  Respond
                </button>
              )}

              {review.status !== "reported" && (
                <button
                  onClick={() => setShowReportForm(!showReportForm)}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-destructive"
                >
                  <Flag className="w-4 h-4" />
                  Report
                </button>
              )}
            </div>

            {/* Response Form */}
            {showResponseForm && (
              <Form method="post" className="mt-4 p-4 bg-muted rounded-lg">
                <input type="hidden" name="intent" value="respond" />
                <input type="hidden" name="reviewId" value={review.id} />
                <textarea
                  name="response"
                  placeholder="Write your response..."
                  className="w-full p-3 border border-input rounded-lg bg-background resize-none"
                  rows={3}
                  required
                />
                <div className="flex justify-end gap-2 mt-3">
                  <Button type="button" variant="outlined" size="small" onClick={() => setShowResponseForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="small">
                    Submit Response
                  </Button>
                </div>
              </Form>
            )}

            {/* Report Form */}
            {showReportForm && (
              <Form method="post" className="mt-4 p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                <input type="hidden" name="intent" value="report" />
                <input type="hidden" name="reviewId" value={review.id} />
                <p className="text-sm font-medium text-foreground mb-2">Report this review</p>
                <select
                  name="reason"
                  className="w-full p-2 border border-input rounded-lg bg-background mb-3"
                  required
                >
                  <option value="">Select a reason</option>
                  <option value="inappropriate">Inappropriate content</option>
                  <option value="fake">Fake or misleading</option>
                  <option value="spam">Spam</option>
                  <option value="harassment">Harassment</option>
                  <option value="other">Other</option>
                </select>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outlined" size="small" onClick={() => setShowReportForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="small" variant="outlined" color="error">
                    Report
                  </Button>
                </div>
              </Form>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ReviewsPage() {
  const { reviews, stats, view, error } = useLoaderData<typeof clientLoader>();
  const actionData = useActionData<typeof clientAction>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();

  const currentRating = searchParams.get("rating");

  const handleViewChange = (newView: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("view", newView);
    setSearchParams(params);
  };

  const handleRatingFilter = (rating: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (rating) {
      params.set("rating", rating);
    } else {
      params.delete("rating");
    }
    setSearchParams(params);
  };

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
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
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
                <p className="text-5xl font-bold text-foreground">{stats.averageRating.toFixed(1)}</p>
                <RatingStars rating={Math.round(stats.averageRating)} />
                <p className="text-sm text-muted-foreground mt-1">{stats.total} reviews</p>
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
              <ReviewCard
                key={review.id}
                review={review}
                isOwner={view === "received"}
              />
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
                  <Button>View Bookings</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
