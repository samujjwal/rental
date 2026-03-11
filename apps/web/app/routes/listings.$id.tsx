import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link, useNavigate } from "react-router";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  MapPin,
  Shield,
  Star,
  Truck,
  CheckCircle,
  ChevronLeft,
  ChevronDown,
  Info,
  MessageCircle,
  Share2,
  Tag,
  Navigation,
  Package,
  ExternalLink,
} from "lucide-react";
import { listingsApi } from "~/lib/api/listings";
import { bookingsApi } from "~/lib/api/bookings";
import { reviewsApi } from "~/lib/api/reviews";
import { messagingApi } from "~/lib/api/messaging";
import type { BookingCalculation } from "~/types/booking";
import {
  getCategoryFields,
  groupCategoryFields,
  formatFieldValue,
} from "~/lib/category-fields";
import { getCategoryContext } from "~/lib/category-context";
import { formatCurrency, formatDate } from "~/lib/utils";
import { APP_CURRENCY } from "~/config/locale";
import type { Review } from "~/types/review";
import { useAuthStore } from "~/lib/store/auth";
import { cn } from "~/lib/utils";
import { UnifiedButton, Badge, RouteErrorBoundary } from "~/components/ui";
import { FavoriteButton } from "~/components/favorites";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui";
import { Skeleton, CardSkeleton } from "~/components/ui/skeleton";
import { ListingGallery } from "~/components/ui/ListingGallery";
import { BookingCalendar } from "~/components/booking/BookingCalendar";

export const meta: MetaFunction<typeof clientLoader> = ({ data }) => {
  if (!data?.listing) {
    return [{ title: "Listing Not Found" }];
  }
  return [
    { title: `${data.listing.title} | GharBatai Rentals` },
    { name: "description", content: data.listing.description },
  ];
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{5,127}$/;
const isValidListingId = (value: string | undefined): value is string =>
  Boolean(value && (UUID_PATTERN.test(value) || SAFE_ID_PATTERN.test(value)));
const MAX_BOOKING_MESSAGE_LENGTH = 500; // matches backend @MaxLength(500) on CreateBookingDto.message
const MAX_BOOKING_GUESTS = 50;
const MAX_BOOKING_DAYS = 90;
const safeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const safeDateLabel = (value: unknown): string => {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? "Unknown date" : formatDate(date);
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
    throw new Response("Listing not found", { status: 404 });
  }
}

export default function ListingDetail() {
  const { t } = useTranslation();
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
  const [quantityNeeded, setQuantityNeeded] = useState(1);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [showPromoCode, setShowPromoCode] = useState(false);
  const [contactingOwner, setContactingOwner] = useState(false);
  const [contactOwnerError, setContactOwnerError] = useState("");
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const deliveryOptions = listing.deliveryOptions || {
    pickup: false,
    delivery: false,
    shipping: false,
  };
  // Resolve a fallback delivery method for categories that don't show the dropdown
  const resolvedDelivery = deliveryOptions.pickup
    ? "pickup"
    : deliveryOptions.delivery
    ? "delivery"
    : deliveryOptions.shipping
    ? "shipping"
    : "pickup";
  const galleryImages = Array.isArray(listing.photos) && listing.photos.length > 0
    ? listing.photos
    : Array.isArray(listing.images) ? listing.images : [];
  const locationCity = safeText(listing.location?.city, "Location");
  const locationState = safeText(listing.location?.state);
  const conditionLabel = safeText(listing.condition).replace("-", " ");
  const availabilityLabel = safeText(listing.availability).toLowerCase();
  const categoryName = typeof listing.category === 'string' ? listing.category : listing.category?.name;
  const catCtx = useMemo(
    () => getCategoryContext(listing.categorySlug, categoryName),
    [listing.categorySlug, categoryName]
  );
  const cur = listing.currency || APP_CURRENCY;
  const price = (v: number | string | null | undefined) =>
    v != null ? formatCurrency(safeNumber(v), cur) : null;

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
      const effectiveGuestCount = catCtx.showQuantity
        ? Math.max(1, Math.min(50, Math.floor(quantityNeeded)))
        : Math.max(1, Math.min(MAX_BOOKING_GUESTS, Math.floor(guestCount)));
      const calc = await bookingsApi.calculatePrice(
        listing.id,
        new Date(startDate).toISOString(),
        new Date(endDate).toISOString(),
        deliveryMethod,
        {
          guestCount: effectiveGuestCount,
          promoCode: promoCode.trim() || undefined,
        }
      );
      setCalculation(calc);
    } catch (error) {
      setCalculation(null);
      console.error('Price calculation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckAvailability = async () => {
    if (!startDate || !endDate) return;
    // Guard against concurrent clicks
    if (availabilityStatus === "checking") return;
    if (availabilityLabel !== "available") {
      setAvailabilityStatus("unavailable");
      setAvailabilityMessage("This listing is not currently available.");
      setCalculation(null);
      return;
    }
    const today = getTodayDate();
    if (startDate < today) {
      setAvailabilityStatus("unavailable");
      setAvailabilityMessage("Start date cannot be in the past.");
      setCalculation(null);
      return;
    }
    if (endDate <= startDate) {
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
        new Date(startDate).toISOString(),
        new Date(endDate).toISOString()
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
      setAvailabilityStatus("unavailable");
      setAvailabilityMessage("Unable to check availability. Try again.");
      setCalculation(null);
    }
  };

  // Auto-trigger availability check whenever both dates are selected
  useEffect(() => {
    if (startDate && endDate) {
      handleCheckAvailability();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  // Restore booking intent saved before unauthenticated redirect
  useEffect(() => {
    try {
      const intentKey = `bookingIntent_${listing.id}`;
      const saved = sessionStorage.getItem(intentKey);
      if (saved) {
        const intent = JSON.parse(saved);
        if (intent.startDate) setStartDate(intent.startDate);
        if (intent.endDate) setEndDate(intent.endDate);
        if (typeof intent.guestCount === 'number') setGuestCount(intent.guestCount);
        if (typeof intent.quantityNeeded === 'number') setQuantityNeeded(intent.quantityNeeded);
        if (intent.deliveryMethod) setDeliveryMethod(intent.deliveryMethod as 'pickup' | 'delivery' | 'shipping');
        if (intent.renterMessage) setRenterMessage(intent.renterMessage);
        sessionStorage.removeItem(intentKey);
      }
    } catch { /* ignore storage errors */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing.id]);

  const handleBooking = async () => {
    const today = getTodayDate();
    const sanitizedMessage = renterMessage.trim().slice(0, MAX_BOOKING_MESSAGE_LENGTH);
    const normalizedGuestCount = Math.max(
      1,
      Math.min(MAX_BOOKING_GUESTS, Math.floor(guestCount))
    );
    const selectedDeliveryMethod = catCtx.supportsDelivery ? deliveryMethod : resolvedDelivery;
    if (catCtx.supportsDelivery && !deliveryOptions[selectedDeliveryMethod]) {
      setBookingError("Please select a valid delivery method.");
      return;
    }
    if (catCtx.supportsDelivery && selectedDeliveryMethod !== "pickup" && !deliveryAddress.trim()) {
      setBookingError("Please provide a delivery address.");
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
    const minRental = safeNumber(listing.minimumRentalPeriod);
    if (minRental > 1 && totalDays < minRental) {
      setBookingError(`Minimum rental period is ${minRental} day${minRental > 1 ? "s" : ""}.`);
      return;
    }
    if (availabilityStatus !== "available") {
      setBookingError("Please check availability before booking.");
      return;
    }
    if (!user) {
      // Persist booking state so it can be restored after authentication
      try {
        sessionStorage.setItem(`bookingIntent_${listing.id}`, JSON.stringify({
          startDate,
          endDate,
          guestCount,
          quantityNeeded,
          deliveryMethod,
          renterMessage: renterMessage.trim(),
        }));
      } catch { /* ignore storage errors */ }
      navigate(`/auth/login?redirectTo=/listings/${listing.id}`);
      return;
    }
    setBookingSubmitting(true);
    setBookingError("");
    try {
      const booking = await bookingsApi.createBooking({
        listingId: listing.id,
        startDate: startAt.toISOString(),
        endDate: endAt.toISOString(),
        guestCount: catCtx.showQuantity ? Math.max(1, Math.min(50, Math.floor(quantityNeeded))) : normalizedGuestCount,
        message: sanitizedMessage || undefined,
        deliveryMethod: selectedDeliveryMethod,
        deliveryAddress: selectedDeliveryMethod !== "pickup" ? deliveryAddress.trim() || undefined : undefined,
        promoCode: promoCode.trim() || undefined,
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
    } catch (error: unknown) {
      // Surface the backend error message when available
      const apiMessage =
        (error as any)?.response?.data?.message ||
        (error as any)?.response?.data?.error ||
        (typeof (error as any)?.message === 'string' && (error as any).message) ||
        "Unable to create booking. Please try again.";
      setBookingError(Array.isArray(apiMessage) ? apiMessage.join(' ') : String(apiMessage));
    } finally {
      setBookingSubmitting(false);
    }
  };

  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  const isOwner = user?.id === listing.ownerId;

  const handleContactOwner = async () => {
    if (!user) {
      navigate(`/auth/login?redirectTo=/listings/${listing.id}`);
      return;
    }
    if (isOwner) return;
    setContactingOwner(true);
    setContactOwnerError("");
    try {
      const conversation = await messagingApi.createConversation({
        listingId: listing.id,
        participantId: listing.ownerId,
      });
      navigate(`/messages?conversation=${conversation.id}`);
    } catch (error) {
      console.error("Failed to start conversation:", error);
      setContactOwnerError(
        t("listings.detail.contactOwnerError", "Failed to start a conversation. Please try again.")
      );
    } finally {
      setContactingOwner(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: listing.title, url });
      } catch {
        // user cancelled or not supported
      }
    } else {
      await navigator.clipboard.writeText(url).catch(() => {});
    }
  };

  const fetchReviews = useCallback(async (page: number) => {
    setLoadingReviews(true);
    try {
      const response = await reviewsApi.getReviewsForListing(listing.id, page, 5);
      setReviews((prevReviews) =>
        page === 1 ? response.reviews : [...prevReviews, ...response.reviews]
      );
      setReviewsTotal(response.total || response.reviews.length);
      setReviewsPage(page);
    } catch {
      // Reviews loading failure is non-critical — silently ignore
    } finally {
      setLoadingReviews(false);
    }
  }, [listing.id]);

  useEffect(() => {
    fetchReviews(1);
  }, [fetchReviews]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Breadcrumb */}
        <Link
          to="/search"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          {t('listings.detail.backToSearch', 'Back to search')}
        </Link>
      </div>

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
                          {t('listings.card.reviews')})
                        </span>
                      )}
                      {catCtx.showCondition && conditionLabel && (
                        <span className="capitalize">
                          {conditionLabel}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-3">
                    <div>
                      <div className="text-3xl font-bold text-primary">
                        {price(listing.basePrice)}
                      </div>
                      <div className="text-sm text-muted-foreground">{catCtx.pricePeriodLabel}</div>
                      {listing.pricePerWeek && !listing.pricePerMonth && (
                        <div className="text-sm text-muted-foreground">
                          {price(listing.pricePerWeek)}{t('common.perWeek')}
                        </div>
                      )}
                      {listing.pricePerMonth && (
                        <div className="text-sm text-muted-foreground">
                          {price(listing.pricePerMonth)}{t('common.perMonth')}
                        </div>
                      )}
                    </div>
                    {!isOwner && (
                      <FavoriteButton listingId={listing.id} size="medium" showTooltip />
                    )}
                    <button
                      onClick={handleShare}
                      className="p-2 rounded-full border border-border hover:bg-muted transition-colors"
                      title={t('listings.detail.share', 'Share listing')}
                      aria-label="Share listing"
                    >
                      <Share2 className="w-5 h-5 text-muted-foreground" />
                    </button>
                  </div>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {typeof listing.category === 'string' && listing.category !== 'Uncategorized' && (
                    <Badge variant="secondary">
                      {listing.category}
                    </Badge>
                  )}
                  {listing.subcategory && (
                    <Badge variant="outline">
                      {listing.subcategory}
                    </Badge>
                  )}
                  {listing.instantBooking && (
                    <Badge
                      variant="success"
                      className="inline-flex items-center gap-1"
                    >
                      <CheckCircle className="w-3 h-3" />
                      {t('listings.card.instantBook')}
                    </Badge>
                  )}
                  {listing.verified && (
                    <Badge
                      variant="default"
                      className="inline-flex items-center gap-1"
                    >
                      <Shield className="w-3 h-3" />
                      {t('listings.card.verified')}
                    </Badge>
                  )}
                  {catCtx.supportsDelivery && deliveryOptions.delivery && (
                    <Badge
                      variant="default"
                      className="inline-flex items-center gap-1"
                    >
                      <Truck className="w-3 h-3" />
                      {t('listings.detail.deliveryAvailable', 'Delivery Available')}
                    </Badge>
                  )}
                </div>

                {/* Description */}
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-foreground mb-3">
                    {t('listings.detail.description')}
                  </h2>
                  <p className="text-muted-foreground whitespace-pre-line">
                    {listing.description}
                  </p>
                </div>

                {/* Features */}
                {listing.features && listing.features.length > 0 && (
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold text-foreground mb-3">
                      {catCtx.featuresLabel}
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

                {/* Category-Specific Details */}
                <CategorySpecificDetails
                  categorySlug={listing.categorySlug}
                  data={listing.categorySpecificData}
                />

                {/* Rental Terms */}
                <div className="mb-2">
                  <h2 className="text-xl font-semibold text-foreground mb-3">{catCtx.rentalTermsHeading}</h2>
                </div>
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  {listing.securityDeposit != null && (
                    <div>
                      <div className="text-sm text-muted-foreground">
                        {catCtx.securityDepositLabel}
                      </div>
                      <div className="font-semibold text-foreground">
                        {price(listing.securityDeposit)}
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="text-sm text-muted-foreground">
                      {catCtx.minRentalLabel}
                    </div>
                    <div className="font-semibold text-foreground">
                      {listing.minimumRentalPeriod}
                      {" "}{listing.minimumRentalPeriod === 1 ? catCtx.pricePeriodUnit : `${catCtx.pricePeriodUnit}s`}
                    </div>
                  </div>
                  {listing.maximumRentalPeriod && (
                    <div>
                      <div className="text-sm text-muted-foreground">
                        {catCtx.maxRentalLabel}
                      </div>
                      <div className="font-semibold text-foreground">
                        {listing.maximumRentalPeriod}
                        {" "}{listing.maximumRentalPeriod === 1 ? catCtx.pricePeriodUnit : `${catCtx.pricePeriodUnit}s`}
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="text-sm text-muted-foreground">
                      {t('listings.detail.cancellationPolicy')}
                    </div>
                    <div className="font-semibold text-foreground capitalize">
                      {listing.cancellationPolicy}
                    </div>
                  </div>
                  {catCtx.supportsDelivery && (
                    <div>
                      <div className="text-sm text-muted-foreground">
                        {t('listings.detail.deliveryOptions', 'Delivery Options')}
                      </div>
                      <div className="font-semibold text-foreground">
                        {[
                          deliveryOptions.pickup && t('listings.detail.pickup', 'Pickup'),
                          deliveryOptions.delivery && t('listings.detail.delivery', 'Delivery'),
                          deliveryOptions.shipping && t('listings.detail.shipping', 'Shipping'),
                        ]
                          .filter(Boolean)
                          .join(", ") || t('listings.detail.pickup', 'Pickup')}
                      </div>
                    </div>
                  )}
                  {catCtx.supportsDelivery && listing.deliveryFee != null && listing.deliveryFee > 0 && (
                    <div>
                      <div className="text-sm text-muted-foreground">
                        {t('listings.detail.deliveryFee', 'Delivery Fee')}
                      </div>
                      <div className="font-semibold text-foreground">
                        {price(listing.deliveryFee)}
                      </div>
                    </div>
                  )}
                  {catCtx.supportsDelivery && listing.deliveryRadius != null && listing.deliveryRadius > 0 && (
                    <div>
                      <div className="text-sm text-muted-foreground">
                        {t('listings.detail.deliveryRadius', 'Delivery Radius')}
                      </div>
                      <div className="font-semibold text-foreground">
                        {listing.deliveryRadius} {catCtx.distanceUnit}
                      </div>
                    </div>
                  )}
                  {catCtx.showCheckInOut && (listing.categorySpecificData as any)?.checkInTime && (
                    <div>
                      <div className="text-sm text-muted-foreground">{t('listings.detail.checkIn', 'Check-in Time')}</div>
                      <div className="font-semibold text-foreground">{(listing.categorySpecificData as any).checkInTime}</div>
                    </div>
                  )}
                  {catCtx.showCheckInOut && (listing.categorySpecificData as any)?.checkOutTime && (
                    <div>
                      <div className="text-sm text-muted-foreground">{t('listings.detail.checkOut', 'Check-out Time')}</div>
                      <div className="font-semibold text-foreground">{(listing.categorySpecificData as any).checkOutTime}</div>
                    </div>
                  )}
                  {catCtx.showCleaningFee && (listing.categorySpecificData as any)?.cleaningFee != null && (
                    <div>
                      <div className="text-sm text-muted-foreground">{t('listings.detail.cleaningFee', 'Cleaning Fee')}</div>
                      <div className="font-semibold text-foreground">{price((listing.categorySpecificData as any).cleaningFee)}</div>
                    </div>
                  )}
                </div>

                {/* Location */}
                {listing.location && (
                  <div className="mt-6">
                    <h2 className="text-xl font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Navigation className="w-5 h-5 text-primary" />
                      {t('listings.detail.location', 'Location')}
                    </h2>
                    <div className="rounded-lg overflow-hidden border border-border">
                      {listing.location.coordinates?.lat && listing.location.coordinates?.lng ? (
                        <iframe
                          title="Listing location map"
                          width="100%"
                          height="250"
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                          src={`https://www.openstreetmap.org/export/embed.html?bbox=${listing.location.coordinates.lng - 0.01},${listing.location.coordinates.lat - 0.01},${listing.location.coordinates.lng + 0.01},${listing.location.coordinates.lat + 0.01}&layer=mapnik&marker=${listing.location.coordinates.lat},${listing.location.coordinates.lng}`}
                          className="w-full"
                        />
                      ) : null}
                      <div className="p-3 bg-muted flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="w-4 h-4 flex-shrink-0" />
                          <span>
                            {[listing.location.address, listing.location.city, listing.location.state, listing.location.country]
                              .filter(Boolean)
                              .join(', ')}
                          </span>
                        </div>
                        {listing.location.coordinates?.lat && (
                          <a
                            href={`https://www.google.com/maps?q=${listing.location.coordinates.lat},${listing.location.coordinates.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline ml-2 flex-shrink-0"
                          >
                            <ExternalLink className="w-3 h-3" />
                            {t('listings.detail.openInMaps', 'Open in Maps')}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Reviews */}
                <div className="mt-8">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-foreground">
                      {t('listings.detail.reviews')}
                    </h2>
                    {listing.totalReviews > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {listing.totalReviews} {t('listings.detail.totalLabel', 'total')}
                      </span>
                    )}
                  </div>

                  {loadingReviews ? (
                    <p className="text-sm text-muted-foreground">{t('listings.detail.loadingReviews', 'Loading reviews...')}</p>
                  ) : reviews.length === 0 ? (
                    <div className="p-4 bg-muted rounded-lg text-sm text-muted-foreground">
                      {t('reviews.noReviews')}
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
                        {t('listings.detail.loadMoreReviews', 'Load more reviews')}
                      </UnifiedButton>
                    </div>
                  )}
                </div>

                {/* Rules */}
                {listing.rules && (
                  <div className="mt-6">
                    <h2 className="text-xl font-semibold text-foreground mb-3">
                      {catCtx.rulesHeading}
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
                <CardTitle>{t('listings.detail.ownerInformation', '{{label}} Information', { label: catCtx.ownerLabel })}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center overflow-hidden">
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
                  <div className="flex-1">
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
                      <span className="text-sm text-info">{t('listings.card.verified')}</span>
                    )}
                  </div>
                </div>
                {!isOwner && (
                  <div className="mt-4">
                    <UnifiedButton
                      variant="outline"
                      fullWidth
                      onClick={handleContactOwner}
                      disabled={contactingOwner}
                      className="flex items-center justify-center gap-2"
                    >
                      <MessageCircle className="w-4 h-4" />
                      {contactingOwner
                        ? t('listings.detail.connecting', 'Connecting…')
                        : t('listings.detail.messageOwner', 'Message {{label}}', { label: catCtx.ownerLabel })}
                    </UnifiedButton>
                    {contactOwnerError && (
                      <p className="mt-2 text-sm text-destructive">{contactOwnerError}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Booking Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4 shadow-lg">
              <CardContent className="p-6">
                <div className="mb-6">
                  <div className="text-3xl font-bold text-foreground mb-1">
                    {price(listing.basePrice)}
                    <span className="text-base font-normal text-muted-foreground">
                      {" "}
                      / {catCtx.pricePeriodUnit}
                    </span>
                  </div>
                  {availabilityLabel === "available" ? (
                    <span className="text-sm text-success">{t('listings.detail.available', 'Available')}</span>
                  ) : (
                    <span className="text-sm text-destructive">
                      {t('listings.detail.notAvailable', 'Not Available')}
                    </span>
                  )}
                </div>

                {!isOwner && (
                  <>
                    {/* Date Selection — interactive calendar */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-foreground mb-2">
                        {catCtx.startDateLabel} → {catCtx.endDateLabel}
                      </label>
                      <BookingCalendar
                        listingId={listing.id}
                        startDate={startDate || undefined}
                        endDate={endDate || undefined}
                        minRentalDays={listing.minimumRentalPeriod ?? 1}
                        maxRentalDays={listing.maximumRentalPeriod ?? 90}
                        onRangeSelect={(s, e) => {
                          setStartDate(s);
                          // If start and end are the same, only start is set (user picking)
                          setEndDate(s === e ? "" : e);
                          setCalculation(null);
                          setAvailabilityStatus("idle");
                          setAvailabilityMessage("");
                        }}
                        onClear={() => {
                          setStartDate("");
                          setEndDate("");
                          setCalculation(null);
                          setAvailabilityStatus("idle");
                          setAvailabilityMessage("");
                        }}
                      />
                    </div>

                    {/* More options toggle — revealed after dates are selected */}
                    {startDate && endDate && (
                      <button
                        type="button"
                        onClick={() => setShowMoreOptions((s) => !s)}
                        className="flex items-center gap-1.5 text-sm text-primary hover:underline focus:outline-none mb-4"
                      >
                        <ChevronDown
                          className={cn(
                            "w-4 h-4 transition-transform",
                            showMoreOptions ? "rotate-180" : ""
                          )}
                        />
                        {showMoreOptions
                          ? t('listings.detail.fewerOptions', 'Fewer options')
                          : t('listings.detail.moreOptions', 'More options (delivery, guests, message…)')}
                      </button>
                    )}

                    {/* Collapsible additional options */}
                    {showMoreOptions && (
                      <>

                    {/* Delivery Method — only relevant for categories that support it */}
                    {catCtx.supportsDelivery && (
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-foreground mb-2">
                          {t('listings.detail.deliveryMethod', 'Delivery Method')}
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
                            <option value="pickup">{t('listings.detail.pickup', 'Pickup')}</option>
                          )}
                          {deliveryOptions.delivery && (
                            <option value="delivery">{t('listings.detail.delivery', 'Delivery')}</option>
                          )}
                          {deliveryOptions.shipping && (
                            <option value="shipping">{t('listings.detail.shipping', 'Shipping')}</option>
                          )}
                        </select>
                      </div>
                    )}

                    {/* Delivery Address — required when delivery/shipping selected */}
                    {catCtx.supportsDelivery && deliveryMethod !== "pickup" && (
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-foreground mb-2">
                          {t('listings.detail.deliveryAddress', 'Delivery Address')}
                          <span className="text-destructive ml-0.5">*</span>
                        </label>
                        <textarea
                          value={deliveryAddress}
                          onChange={(e) => setDeliveryAddress(e.target.value.slice(0, 500))}
                          rows={2}
                          placeholder={t('listings.detail.deliveryAddressPlaceholder', 'Enter your full delivery address…')}
                          className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                        />
                      </div>
                    )}

                    {/* Guest / Occupant Count — only for properties and event spaces */}
                    {catCtx.showGuestCount && (
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-foreground mb-2">
                          {catCtx.guestLabel}
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
                    )}

                    {/* Quantity — for equipment, electronics, sports */}
                    {catCtx.showQuantity && (
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-foreground mb-2">
                          <Package className="w-4 h-4 inline mr-1 text-muted-foreground" />
                          {catCtx.quantityLabel}
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={quantityNeeded}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setQuantityNeeded(Number.isNaN(v) ? 1 : Math.max(1, Math.min(50, Math.floor(v))));
                          }}
                          className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t('listings.detail.maxQuantity', 'Maximum 50 units per booking')}
                        </p>
                      </div>
                    )}

                    {/* Message to Owner */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-foreground mb-2">
                        {t('listings.detail.messageToOwner', 'Message to {{label}} (optional)', { label: catCtx.ownerLabel })}
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
                        placeholder={catCtx.messagePlaceholder}
                      />
                    </div>

                    {/* Promo Code */}
                    <div className="mb-4">
                      <button
                        type="button"
                        onClick={() => setShowPromoCode((s) => !s)}
                        className="flex items-center gap-1.5 text-sm text-primary hover:underline focus:outline-none"
                      >
                        <Tag className="w-4 h-4" />
                        {showPromoCode
                          ? t('listings.detail.hidePromoCode', 'Hide promo code')
                          : t('listings.detail.havePromoCode', 'Have a promo code?')}
                      </button>
                      {showPromoCode && (
                        <input
                          type="text"
                          value={promoCode}
                          onChange={(e) => setPromoCode(e.target.value.slice(0, 50).toUpperCase())}
                          placeholder={t('listings.detail.promoCodePlaceholder', 'Enter promo code…')}
                          className="mt-2 w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring transition-colors uppercase tracking-wider"
                        />
                      )}
                    </div>

                      </>
                    )}

                    {/* Recalculate button — only shown after an initial check */}
                    {(availabilityStatus === "available" || availabilityStatus === "unavailable") && (
                      <UnifiedButton
                        variant="outline"
                        onClick={handleCheckAvailability}
                        disabled={!startDate || !endDate || loading}
                        fullWidth
                        className="mb-3 text-sm"
                      >
                        {t('listings.detail.recheckAvailability', 'Recalculate')}
                      </UnifiedButton>
                    )}
                    {availabilityStatus === "checking" && (
                      <div className="mb-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <svg className="animate-spin h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        {t('listings.detail.checking', 'Checking availability…')}
                      </div>
                    )}

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
                            {price(calculation.basePrice)} × {calculation.totalDays}{" "}
                            {t('bookings.details.days')}
                          </span>
                          <span>{price(calculation.subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>{t('bookings.details.serviceFee')}</span>
                          <span>{price(calculation.serviceFee)}</span>
                        </div>
                        {calculation.deliveryFee > 0 && (
                          <div className="flex justify-between text-sm">
                            <span>{t('listings.detail.deliveryFee', 'Delivery fee')}</span>
                            <span>{price(calculation.deliveryFee)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm">
                          <span>{t('listings.detail.securityDeposit')}</span>
                          <span>{price(calculation.securityDeposit)}</span>
                        </div>
                        <div className="border-t border-border pt-2 flex justify-between font-semibold">
                          <span>{t('bookings.details.total')}</span>
                          <span>{price(calculation.totalAmount)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {catCtx.depositReturnText}
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
                        ? t('listings.detail.submitting', 'Submitting...')
                        : listing.instantBooking
                          ? t('listings.detail.bookInstantly', 'Book Instantly')
                          : t('listings.detail.requestToBook', 'Request to Book')}
                    </UnifiedButton>
                  </>
                )}

                {isOwner && (
                  <div className="text-center">
                    <p className="text-muted-foreground mb-4">
                      {t('listings.detail.yourListing', 'This is your listing')}
                    </p>
                    <Link
                      to={`/listings/${listing.id}/edit`}
                      className="inline-block w-full"
                    >
                      <UnifiedButton className="w-full">{t('listings.create.editTitle')}</UnifiedButton>
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

// ---------------------------------------------------------------------------
// Category-Specific Details display component
// ---------------------------------------------------------------------------

function CategorySpecificDetails({
  categorySlug,
  data,
}: {
  categorySlug?: string | null;
  data?: Record<string, unknown>;
}) {
  const { t } = useTranslation();
  const fields = useMemo(() => getCategoryFields(categorySlug), [categorySlug]);
  const groups = useMemo(() => groupCategoryFields(fields), [fields]);

  if (fields.length === 0) return null;

  const safeData = data ?? {};
  const hasAnyData = Object.keys(safeData).length > 0 &&
    fields.some((f) => {
      const v = safeData[f.key];
      return v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);
    });

  return (
    <div className="mb-6">
      <h2 className="text-xl font-semibold text-foreground mb-3 flex items-center gap-2">
        <Info className="w-5 h-5 text-primary" />
        {t('listings.detail.specifications', 'Specifications')}
      </h2>
      {!hasAnyData ? (
        <div className="p-4 bg-muted rounded-lg text-sm text-muted-foreground">
          {t('listings.detail.noSpecifications', 'Detailed specifications not provided by the owner. Contact them directly for more information.')}
        </div>
      ) : (
        groups
          .map((group) => ({
            ...group,
            fields: group.fields.filter((field) => {
              const val = safeData[field.key];
              return val !== undefined && val !== null && val !== "" && !(Array.isArray(val) && val.length === 0);
            }),
          }))
          .filter((g) => g.fields.length > 0)
          .map((group) => (
            <div key={group.label} className="mb-4 last:mb-0">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {group.label}
              </h3>
              <div className="grid grid-cols-2 gap-3 p-4 bg-muted rounded-lg">
                {group.fields.map((field) => (
                  <div key={field.key}>
                    <div className="text-sm text-muted-foreground">{field.label}</div>
                    <div className="font-semibold text-foreground">
                      {formatFieldValue(field, safeData[field.key])}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
      )}
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };

