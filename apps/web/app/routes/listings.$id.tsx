import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link, useNavigate } from "react-router";
import { useState } from "react";
import {
  MapPin,
  Calendar,
  Package,
  Shield,
  Star,
  ChevronLeft,
  ChevronRight,
  Truck,
  CheckCircle,
  X,
} from "lucide-react";
import { listingsApi } from "~/lib/api/listings";
import { bookingsApi } from "~/lib/api/bookings";
import type { Listing } from "~/types/listing";
import type { BookingCalculation } from "~/types/booking";
import { useAuthStore } from "~/lib/store/auth";
import { cn } from "~/lib/utils";
import { Button, Badge } from "~/components/ui";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "~/components/ui";

export const meta: MetaFunction<typeof clientLoader> = ({ data }) => {
  if (!data?.listing) {
    return [{ title: "Listing Not Found" }];
  }
  return [
    { title: `${data.listing.title} - Universal Rental Portal` },
    { name: "description", content: data.listing.description },
  ];
};

export async function clientLoader({ params }: LoaderFunctionArgs) {
  const { id } = params;
  if (!id) throw new Error("Listing ID is required");

  try {
    const listing = await listingsApi.getListingById(id);
    let blockedDates: string[] = [];
    try {
      blockedDates = await bookingsApi.getBlockedDates(id);
    } catch (blockError) {
      // Blocked dates are optional, continue without them
      console.warn("Failed to load blocked dates:", blockError);
    }
    return { listing, blockedDates };
  } catch (error) {
    console.error("Failed to load listing:", error, "ID:", id);
    throw new Response("Listing not found", { status: 404 });
  }
}

export default function ListingDetail() {
  const { listing, blockedDates } = useLoaderData<typeof clientLoader>();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<
    "pickup" | "delivery" | "shipping"
  >("pickup");
  const [calculation, setCalculation] = useState<BookingCalculation | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  const nextImage = () => {
    setCurrentImageIndex((prev) =>
      prev === listing.images.length - 1 ? 0 : prev + 1
    );
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) =>
      prev === 0 ? listing.images.length - 1 : prev - 1
    );
  };

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

  const handleBooking = () => {
    if (!user) {
      navigate("/auth/login");
      return;
    }
    setShowBookingModal(true);
  };

  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  const isOwner = user?.id === listing.ownerId;

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
            <Card className="overflow-hidden mb-6">
              <div className="relative aspect-[16/10] bg-muted">
                {listing.images.length > 0 ? (
                  <>
                    <img
                      src={listing.images[currentImageIndex]}
                      alt={listing.title}
                      className="w-full h-full object-cover"
                    />
                    {listing.images.length > 1 && (
                      <>
                        <button
                          onClick={prevImage}
                          className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/90 hover:bg-background p-2 rounded-full shadow-lg transition-colors"
                        >
                          <ChevronLeft className="w-6 h-6" />
                        </button>
                        <button
                          onClick={nextImage}
                          className="absolute right-4 top-1/2 -translate-y-1/2 bg-background/90 hover:bg-background p-2 rounded-full shadow-lg transition-colors"
                        >
                          <ChevronRight className="w-6 h-6" />
                        </button>
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                          {listing.images.map((_, index) => (
                            <button
                              key={index}
                              onClick={() => setCurrentImageIndex(index)}
                              className={cn(
                                "w-2 h-2 rounded-full transition-colors",
                                index === currentImageIndex
                                  ? "bg-background"
                                  : "bg-background/50"
                              )}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    No images available
                  </div>
                )}
              </div>
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
                        {listing.location.city}, {listing.location.state}
                      </span>
                      {listing.rating && (
                        <span className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          {listing.rating.toFixed(1)} ({listing.totalReviews}{" "}
                          reviews)
                        </span>
                      )}
                      <span className="capitalize">
                        {listing.condition.replace("-", " ")}
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
                  {listing.deliveryOptions.delivery && (
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
                        listing.deliveryOptions.pickup && "Pickup",
                        listing.deliveryOptions.delivery && "Delivery",
                        listing.deliveryOptions.shipping && "Shipping",
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </div>
                  </div>
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
                    {listing.owner.avatar ? (
                      <img
                        src={listing.owner.avatar}
                        alt={listing.owner.firstName}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl font-bold text-muted-foreground">
                        {listing.owner.firstName[0]}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">
                      {listing.owner.firstName} {listing.owner.lastName}
                    </div>
                    {listing.owner.rating && (
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        {listing.owner.rating.toFixed(1)}
                      </div>
                    )}
                    {listing.owner.verified && (
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
                  {listing.availability === "available" ? (
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
                          setStartDate(e.target.value);
                          setCalculation(null);
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
                        {listing.deliveryOptions.pickup && (
                          <option value="pickup">Pickup</option>
                        )}
                        {listing.deliveryOptions.delivery && (
                          <option value="delivery">Delivery</option>
                        )}
                        {listing.deliveryOptions.shipping && (
                          <option value="shipping">Shipping</option>
                        )}
                      </select>
                    </div>

                    {/* Calculate Button */}
                    <Button
                      variant="outlined"
                      color="secondary"
                      onClick={handleCalculatePrice}
                      disabled={!startDate || !endDate || loading}
                      className="w-full mb-4"
                    >
                      {loading ? "Calculating..." : "Calculate Price"}
                    </Button>

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

                    {/* Book Button */}
                    <Button
                      onClick={handleBooking}
                      disabled={
                        !calculation ||
                        listing.availability !== "available" ||
                        loading
                      }
                      className="w-full"
                    >
                      {listing.instantBooking
                        ? "Book Instantly"
                        : "Request to Book"}
                    </Button>
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
                      <Button className="w-full">Edit Listing</Button>
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
