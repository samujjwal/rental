import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link, useNavigate } from "react-router";
import { useState, useEffect } from "react";
import {
  MapPin,
  Shield,
  Star,
  Truck,
  CheckCircle,
  ChevronLeft,
} from "lucide-react";
import { listingsApi } from "~/lib/api/listings";
import { bookingsApi } from "~/lib/api/bookings";
import { reviewsApi } from "~/lib/api/reviews";
import type { BookingCalculation } from "~/types/booking";
import type { Review } from "~/types/review";
import { useAuthStore } from "~/lib/store/auth";
import { cn } from "~/lib/utils";
import { UnifiedButton, Badge, RouteErrorBoundary } from "~/components/ui";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui";
import { Skeleton, CardSkeleton } from "~/components/ui/skeleton";
import { ListingGallery } from "~/components/ui/ListingGallery";

export const meta: MetaFunction<typeof clientLoader> = ({ data }) => {
  if (!data?.listing) {
    return [{ title: "Listing Not Found" }];
  }
  return [
    { title: `${data.listing.title} - Universal Rental Portal` },
    { name: "description", content: data.listing.description },
  ];
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{5,127}$/;
const isValidListingId = (value: string | undefined): value is string =>
  Boolean(value && (UUID_PATTERN.test(value) || SAFE_ID_PATTERN.test(value)));
const MAX_BOOKING_MESSAGE_LENGTH = 1000;
const MAX_BOOKING_GUESTS = 50;
const MAX_BOOKING_DAYS = 90;
const safeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const safeDateLabel = (value: unknown): string => {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleDateString();
};
const safeText = (value: unknown, fallback = ""): string => {
  const text = typeof value === "string" ? value : "";
  return text || fallback;
};

export async function clientLoader({ params }: LoaderFunctionArgs) {
  const { id } = params;
  if (!isValidListingId(id)) {
    throw new Response("Listing not found", { status: 404 });
  }

  try {
    const listing = await listingsApi.getListingById(id);
    return { listing };
  } catch (error) {
    console.error("Failed to load listing:", error, "ID:", id);
    throw new Response("Listing not found", { status: 404 });
  }
}

export default function ListingDetail() {
  const { listing } = useLoaderData<typeof clientLoader>();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [guestCount, setGuestCount] = useState(1);
  const [renterMessage, setRenterMessage] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<
    "pickup" | "delivery" | "shipping"
  >("pickup");
  const [calculation, setCalculation] = useState<BookingCalculation | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [reviewsTotal, setReviewsTotal] = useState(0);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [availabilityStatus, setAvailabilityStatus] = useState<
    "idle" | "checking" | "available" | "unavailable"
  >("idle");
  const [availabilityMessage, setAvailabilityMessage] = useState("");
  const deliveryOptions = listing.deliveryOptions || {
    pickup: false,
    delivery: false,
    shipping: false,
  };
  const galleryImages = Array.isArray(listing.images) ? listing.images : [];
  const locationCity = safeText(listing.location?.city, "Location");
  const locationState = safeText(listing.location?.state);
  const conditionLabel = safeText(listing.condition).replace("-", " ");
  const availabilityLabel = safeText(listing.availability).toLowerCase();

  useEffect(() => {
    if (deliveryOptions.pickup) {
      setDeliveryMethod("pickup");
      return;
    }
    if (deliveryOptions.delivery) {
      setDeliveryMethod("delivery");
      return;
    }
    if (deliveryOptions.shipping) {
      setDeliveryMethod("shipping");
    }
  }, [deliveryOptions.delivery, deliveryOptions.pickup, deliveryOptions.shipping]);

  const handleCalculatePrice = async () => {
    if (!startDate || !endDate) return;

    setLoading(true);
    try {
      const calc = await bookingsApi.calculatePrice(
        listing.id,
        startDate,
        endDate,
        deliveryMethod
      );
      setCalculation(calc);
    } catch (error) {
      console.error("Price calculation error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckAvailability = async () => {
    if (!startDate || !endDate) return;
    if (availabilityLabel !== "available") {
      setAvailabilityStatus("unavailable");
      setAvailabilityMessage("This listing is not currently available.");
      setCalculation(null);
      return;
    }
    if (endDate < startDate) {
      setAvailabilityStatus("unavailable");
      setAvailabilityMessage("End date must be after start date.");
      setCalculation(null);
      return;
    }
    setAvailabilityStatus("checking");
    setAvailabilityMessage("");
    setBookingError("");
    try {
      const availability = await bookingsApi.checkAvailability(
        listing.id,
        startDate,
        endDate
      );
      if (availability.available) {
        setAvailabilityStatus("available");
        setAvailabilityMessage("Dates are available.");
        await handleCalculatePrice();
      } else {
        setAvailabilityStatus("unavailable");
        setAvailabilityMessage(
          availability.message || "Selected dates are not available."
        );
        setCalculation(null);
      }
    } catch (error) {
      console.error("Availability check failed:", error);
      setAvailabilityStatus("unavailable");
      setAvailabilityMessage("Unable to check availability. Try again.");
      setCalculation(null);
    }
  };

  const handleBooking = async () => {
    const today = getTodayDate();
    const sanitizedMessage = renterMessage.trim().slice(0, MAX_BOOKING_MESSAGE_LENGTH);
    const normalizedGuestCount = Math.max(
      1,
      Math.min(MAX_BOOKING_GUESTS, Math.floor(guestCount))
    );
    const selectedDeliveryMethod = deliveryMethod;
    if (!deliveryOptions[selectedDeliveryMethod]) {
      setBookingError("Please select a valid delivery method.");
      return;
    }
    if (availabilityLabel !== "available") {
      setBookingError("This listing is not currently available.");
      return;
    }
    if (!startDate || !endDate) {
      setBookingError("Please select start and end dates.");
      return;
    }
    if (startDate < today) {
      setBookingError("Start date cannot be in the past.");
      return;
    }
    if (endDate < startDate) {
      setBookingError("End date must be after start date.");
      return;
    }
    const startAt = new Date(startDate);
    const endAt = new Date(endDate);
    if (
      Number.isNaN(startAt.getTime()) ||
      Number.isNaN(endAt.getTime())
    ) {
      setBookingError("Please select valid booking dates.");
      return;
    }
    const totalDays = Math.ceil(
      (endAt.getTime() - startAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (totalDays > MAX_BOOKING_DAYS) {
      setBookingError(`Bookings cannot exceed ${MAX_BOOKING_DAYS} days.`);
      return;
    }
    if (availabilityStatus !== "available") {
      setBookingError("Please check availability before booking.");
      return;
    }
    if (!user) {
      navigate(`/auth/login?redirectTo=/listings/${listing.id}`);
      return;
    }
    setBookingSubmitting(true);
    setBookingError("");
    try {
      const booking = await bookingsApi.createBooking({
        listingId: listing.id,
        startDate,
        endDate,
        guestCount: normalizedGuestCount,
        message: sanitizedMessage || undefined,
        deliveryMethod: selectedDeliveryMethod,
      });

      const status =
        typeof booking.status === "string"
          ? booking.status.toUpperCase()
          : "";

      if (status === "PENDING_PAYMENT" || status === "PENDING") {
        navigate(`/checkout/${booking.id}`);
      } else {
        navigate(`/bookings/${booking.id}`);
      }
    } catch (error) {
      console.error("Booking creation failed:", error);
      setBookingError("Unable to create booking. Please try again.");
    } finally {
      setBookingSubmitting(false);
    }
  };

  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  const isOwner = user?.id === listing.ownerId;

  const fetchReviews = async (page: number) => {
    setLoadingReviews(true);
    try {
      const response = await reviewsApi.getReviewsForListing(listing.id, page, 5);
      setReviews((prevReviews) =>
        page === 1 ? response.reviews : [...prevReviews, ...response.reviews]
      );
      setReviewsTotal(response.total || response.reviews.length);
      setReviewsPage(page);
    } catch (error) {
      console.error("Failed to load reviews:", error);
    } finally {
      setLoadingReviews(false);
    }
  };

  useEffect(() => {
    fetchReviews(1);
  }, [listing.id]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link
              to="/search"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              Back to search
            </Link>
            <Link to="/" className="text-xl font-bold text-primary">
              Rental Portal
            </Link>
            <Link
              to="/dashboard"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Image Gallery */}
            <Card className="overflow-hidden mb-6 group">
              <ListingGallery images={galleryImages} title={listing.title} />
            </Card>

            {/* Title and Details */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h1 className="text-3xl font-bold text-foreground mb-2">
                      {listing.title}
                    </h1>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {locationState ? `${locationCity}, ${locationState}` : locationCity}
                      </span>
                      {listing.rating && (
                        <span className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          {safeNumber(listing.rating).toFixed(1)} ({listing.totalReviews}{" "}
                          reviews)
                        </span>
                      )}
                      <span className="capitalize">
                        {conditionLabel || "N/A"}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-primary">
                      ${listing.pricePerDay}
                    </div>
                    <div className="text-sm text-muted-foreground">per day</div>
                    {listing.pricePerWeek && (
                      <div className="text-sm text-muted-foreground">
                        ${listing.pricePerWeek}/week
                      </div>
                    )}
                  </div>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {listing.instantBooking && (
                    <Badge
                      variant="success"
                      className="inline-flex items-center gap-1"
                    >
                      <CheckCircle className="w-3 h-3" />
                      Instant Booking
                    </Badge>
                  )}
                  {listing.verified && (
                    <Badge
                      variant="default"
                      className="inline-flex items-center gap-1"
                    >
                      <Shield className="w-3 h-3" />
                      Verified
                    </Badge>
                  )}
                  {deliveryOptions.delivery && (
                    <Badge
                      variant="default"
                      className="inline-flex items-center gap-1"
                    >
                      <Truck className="w-3 h-3" />
                      Delivery Available
                    </Badge>
                  )}
                </div>

                {/* Description */}
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-foreground mb-3">
                    Description
                  </h2>
                  <p className="text-muted-foreground whitespace-pre-line">
                    {listing.description}
                  </p>
                </div>

                {/* Features */}
                {listing.features && listing.features.length > 0 && (
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold text-foreground mb-3">
                      Features
                    </h2>
                    <ul className="grid grid-cols-2 gap-2">
                      {listing.features.map((feature, index) => (
                        <li
                          key={index}
                          className="flex items-center gap-2 text-muted-foreground"
                        >
                          <CheckCircle className="w-4 h-4 text-success" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Rental Terms */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  <div>
                    <div className="text-sm text-muted-foreground">
                      Security Deposit
                    </div>
                    <div className="font-semibold text-foreground">
                      ${listing.securityDeposit}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">
                      Min Rental Period
                    </div>
                    <div className="font-semibold text-foreground">
                      {listing.minimumRentalPeriod} day(s)
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">
                      Cancellation Policy
                    </div>
                    <div className="font-semibold text-foreground capitalize">
                      {listing.cancellationPolicy}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">
                      Delivery Options
                    </div>
                    <div className="font-semibold text-foreground">
                      {[
                        deliveryOptions.pickup && "Pickup",
                        deliveryOptions.delivery && "Delivery",
                        deliveryOptions.shipping && "Shipping",
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </div>
                  </div>
                </div>

                {/* Reviews */}
                <div className="mt-8">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-foreground">
                      Reviews
                    </h2>
                    {listing.totalReviews > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {listing.totalReviews} total
                      </span>
                    )}
                  </div>

                  {loadingReviews ? (
                    <p className="text-sm text-muted-foreground">Loading reviews...</p>
                  ) : reviews.length === 0 ? (
                    <div className="p-4 bg-muted rounded-lg text-sm text-muted-foreground">
                      No reviews yet.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {reviews.map((review) => {
                        const ratingValue = review.overallRating ?? review.rating ?? 0;
                        const reviewerFirstName = safeText(review.reviewer?.firstName, "User");
                        const reviewerLastName = safeText(review.reviewer?.lastName);
                        return (
                          <div key={review.id} className="border border-border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                                  {reviewerFirstName[0] || "U"}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-foreground">
                                    {reviewerFirstName}{reviewerLastName ? ` ${reviewerLastName}` : ""}
                                  </p>
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                    {safeNumber(ratingValue).toFixed(1)}
                                  </div>
                                </div>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {safeDateLabel(review.createdAt)}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">{review.comment}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {reviews.length < reviewsTotal && (
                    <div className="mt-4">
                      <UnifiedButton
                        variant="outline"
                        onClick={() => fetchReviews(reviewsPage + 1)}
                        disabled={loadingReviews}
                      >
                        Load more reviews
                      </UnifiedButton>
                    </div>
                  )}
                </div>

                {/* Rules */}
                {listing.rules && (
                  <div className="mt-6">
                    <h2 className="text-xl font-semibold text-foreground mb-3">
                      Rental Rules
                    </h2>
                    <p className="text-muted-foreground whitespace-pre-line">
                      {listing.rules}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Owner Info */}
            <Card>
              <CardHeader>
                <CardTitle>Owner Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                    {listing.owner?.avatar ? (
                      <img
                        src={listing.owner.avatar}
                        alt={listing.owner.firstName || "Owner"}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl font-bold text-muted-foreground">
                        {(listing.owner?.firstName || "O")[0]}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">
                      {listing.owner?.firstName || "Owner"} {listing.owner?.lastName || ""}
                    </div>
                    {listing.owner?.rating != null && listing.owner.rating > 0 && (
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        {safeNumber(listing.owner.rating).toFixed(1)}
                      </div>
                    )}
                    {listing.owner?.verified && (
                      <span className="text-sm text-info">Verified</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Booking Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4 shadow-lg">
              <CardContent className="p-6">
                <div className="mb-6">
                  <div className="text-3xl font-bold text-foreground mb-1">
                    ${listing.pricePerDay}
                    <span className="text-base font-normal text-muted-foreground">
                      {" "}
                      / day
                    </span>
                  </div>
                  {availabilityLabel === "available" ? (
                    <span className="text-sm text-success">Available</span>
                  ) : (
                    <span className="text-sm text-destructive">
                      Not Available
                    </span>
                  )}
                </div>

                {!isOwner && (
                  <>
                    {/* Date Selection */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => {
                          const nextStartDate = e.target.value;
                          setStartDate(nextStartDate);
                          if (endDate && nextStartDate && endDate < nextStartDate) {
                            setEndDate("");
                          }
                          setCalculation(null);
                          setAvailabilityStatus("idle");
                          setAvailabilityMessage("");
                        }}
                        min={getTodayDate()}
                        className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                      />
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-foreground mb-2">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => {
                          setEndDate(e.target.value);
                          setCalculation(null);
                          setAvailabilityStatus("idle");
                          setAvailabilityMessage("");
                        }}
                        min={startDate || getTodayDate()}
                        className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                      />
                    </div>

                    {/* Delivery Method */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Delivery Method
                      </label>
                      <select
                        value={deliveryMethod}
                        onChange={(e) => {
                          setDeliveryMethod(
                            e.target.value as "pickup" | "delivery" | "shipping"
                          );
                          setCalculation(null);
                        }}
                        className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                      >
                        {deliveryOptions.pickup && (
                          <option value="pickup">Pickup</option>
                        )}
                        {deliveryOptions.delivery && (
                          <option value="delivery">Delivery</option>
                        )}
                        {deliveryOptions.shipping && (
                          <option value="shipping">Shipping</option>
                        )}
                      </select>
                    </div>

                    {/* Guest Count */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Guests
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={MAX_BOOKING_GUESTS}
                        value={guestCount}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          setGuestCount(
                            Number.isNaN(value)
                              ? 1
                              : Math.max(1, Math.min(MAX_BOOKING_GUESTS, value))
                          );
                        }}
                        className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                      />
                    </div>

                    {/* Message to Owner */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Message to Owner (optional)
                      </label>
                      <textarea
                        value={renterMessage}
                        onChange={(e) =>
                          setRenterMessage(
                            e.target.value.slice(0, MAX_BOOKING_MESSAGE_LENGTH)
                          )
                        }
                        rows={3}
                        className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                        placeholder="Tell the owner about your needs..."
                      />
                    </div>

                    {/* Calculate Button */}
                    <UnifiedButton
                      variant="secondary"
                      onClick={handleCheckAvailability}
                      disabled={!startDate || !endDate || loading}
                      fullWidth
                      className="mb-3"
                    >
                      {availabilityStatus === "checking"
                        ? "Checking..."
                        : "Check Availability"}
                    </UnifiedButton>

                    {availabilityMessage && (
                      <div
                        className={cn(
                          "mb-4 rounded-lg px-3 py-2 text-sm",
                          availabilityStatus === "available"
                            ? "bg-success/10 text-success"
                            : "bg-destructive/10 text-destructive"
                        )}
                      >
                        {availabilityMessage}
                      </div>
                    )}

                    {/* Price Breakdown */}
                    {calculation && (
                      <div className="mb-4 p-4 bg-muted rounded-lg space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>
                            ${calculation.pricePerDay} × {calculation.totalDays}{" "}
                            days
                          </span>
                          <span>${calculation.subtotal}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Service fee</span>
                          <span>${calculation.serviceFee}</span>
                        </div>
                        {calculation.deliveryFee > 0 && (
                          <div className="flex justify-between text-sm">
                            <span>Delivery fee</span>
                            <span>${calculation.deliveryFee}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm">
                          <span>Security deposit</span>
                          <span>${calculation.securityDeposit}</span>
                        </div>
                        <div className="border-t border-border pt-2 flex justify-between font-semibold">
                          <span>Total</span>
                          <span>${calculation.totalAmount}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Security deposit will be refunded after return
                        </p>
                      </div>
                    )}

                    {bookingError && (
                      <div className="mb-4 rounded-lg px-3 py-2 text-sm bg-destructive/10 text-destructive">
                        {bookingError}
                      </div>
                    )}

                    {/* Book Button */}
                    <UnifiedButton
                      onClick={handleBooking}
                      disabled={
                        availabilityStatus !== "available" ||
                        availabilityLabel !== "available" ||
                        loading ||
                        bookingSubmitting
                      }
                      fullWidth
                      variant="primary"
                    >
                      {bookingSubmitting
                        ? "Submitting..."
                        : listing.instantBooking
                          ? "Book Instantly"
                          : "Request to Book"}
                    </UnifiedButton>
                  </>
                )}

                {isOwner && (
                  <div className="text-center">
                    <p className="text-muted-foreground mb-4">
                      This is your listing
                    </p>
                    <Link
                      to={`/listings/${listing.id}/edit`}
                      className="inline-block w-full"
                    >
                      <UnifiedButton className="w-full">Edit Listing</UnifiedButton>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };
