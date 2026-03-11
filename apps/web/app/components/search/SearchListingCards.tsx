import { Link } from "react-router";
import { MapPin, Package } from "lucide-react";
import { CompactFavoriteButton } from "~/components/favorites";
import { Badge } from "~/components/ui";
import { formatCurrency } from "~/lib/utils";
import type { Listing } from "~/types/listing";

const safeText = (value: unknown, fallback = ""): string => {
  const text = typeof value === "string" ? value : "";
  return text || fallback;
};
const safeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const humanizeCondition = (value: unknown): string =>
  safeText(value).replace("-", " ");

const getCategoryName = (category: unknown): string | null => {
  if (!category) return null;
  if (typeof category === "string") return category.replace(/-/g, " ");
  if (typeof category === "object" && category !== null && "name" in category)
    return safeText((category as { name: unknown }).name);
  return null;
};

export function SearchListingCard({ listing }: { listing: Listing }) {
  const listingId = safeText(listing.id);
  const listingTitle = safeText(listing.title, "Listing");
  const ratingValue = listing.rating ?? null;
  const reviewCount = listing.totalReviews ?? 0;
  return (
    <Link
      to={listingId ? `/listings/${listingId}` : "/listings"}
      className="bg-card rounded-lg shadow-sm border overflow-hidden hover:shadow-md transition-shadow group"
    >
      {/* Image */}
      <div className="aspect-[4/3] bg-muted relative">
        {listing.photos?.[0] ? (
          <img
            src={listing.photos[0]}
            alt={listingTitle}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/60 text-muted-foreground">
            <Package className="w-10 h-10" />
          </div>
        )}
        {listing.featured && (
          <Badge variant="warning" className="absolute top-2 left-2">
            Featured
          </Badge>
        )}
        {listing.instantBooking && (
          <Badge variant="success" className="absolute bottom-2 left-2">
            Instant
          </Badge>
        )}
        <div className="absolute top-2 right-2">
          <CompactFavoriteButton listingId={listing.id} />
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-foreground mb-1 line-clamp-2 group-hover:text-primary transition-colors">
          {listingTitle}
        </h3>
        {getCategoryName(listing.category) && (
          <span className="inline-block text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full mb-1.5 capitalize">
            {getCategoryName(listing.category)}
          </span>
        )}
        <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
          <MapPin className="w-4 h-4" />
          {safeText(listing.location?.city, "Location")}
          {listing.location?.state ? `, ${listing.location.state}` : ""}
        </p>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground capitalize">
            {humanizeCondition(listing.condition)}
          </span>
          {ratingValue != null && (
            <span className="text-sm text-muted-foreground">
              ⭐ {safeNumber(ratingValue).toFixed(1)} ({reviewCount})
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-foreground">
            {formatCurrency(listing.basePrice)}
          </span>
          <span className="text-sm text-muted-foreground">/day</span>
        </div>
      </div>
    </Link>
  );
}

export function SearchListingListItem({ listing }: { listing: Listing }) {
  const listingId = safeText(listing.id);
  const listingTitle = safeText(listing.title, "Listing");
  const ratingValue = listing.rating ?? null;
  const reviewCount = listing.totalReviews ?? 0;
  return (
    <Link
      to={listingId ? `/listings/${listingId}` : "/listings"}
      className="bg-card rounded-lg shadow-sm border overflow-hidden hover:shadow-md transition-shadow flex group"
    >
      <div className="w-48 h-36 bg-muted relative shrink-0">
        {listing.photos?.[0] ? (
          <img
            src={listing.photos[0]}
            alt={listingTitle}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/60 text-muted-foreground">
            <Package className="w-8 h-8" />
          </div>
        )}
        {listing.instantBooking && (
          <Badge variant="success" className="absolute top-2 left-2">
            Instant
          </Badge>
        )}
        <div className="absolute top-2 right-2">
          <CompactFavoriteButton listingId={listing.id} />
        </div>
      </div>

      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
              {listingTitle}
            </h3>
            {listing.featured && <Badge variant="warning">Featured</Badge>}
          </div>
          {getCategoryName(listing.category) && (
            <span className="inline-block text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full mb-1.5 capitalize">
              {getCategoryName(listing.category)}
            </span>
          )}
          <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            {safeText(listing.location?.city, "Location")}
            {listing.location?.state ? `, ${listing.location.state}` : ""}
          </p>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {listing.description}
          </p>
        </div>
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground capitalize">
              {humanizeCondition(listing.condition)}
            </span>
            {ratingValue != null && (
              <span className="text-sm text-muted-foreground">
                ⭐ {safeNumber(ratingValue).toFixed(1)} ({reviewCount})
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-foreground">
              {formatCurrency(listing.basePrice)}
            </span>
            <span className="text-sm text-muted-foreground">/day</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function SearchListingCompactCard({
  listing,
  onHighlightChange,
}: {
  listing: Listing;
  onHighlightChange: (listingId: string | undefined) => void;
}) {
  const listingId = safeText(listing.id);
  const listingTitle = safeText(listing.title, "Listing");
  const ratingValue = listing.rating ?? null;
  const reviewCount = listing.totalReviews ?? 0;
  return (
    <Link
      to={listingId ? `/listings/${listingId}` : "/listings"}
      onMouseEnter={() => onHighlightChange(listingId || undefined)}
      onMouseLeave={() => onHighlightChange(undefined)}
      className="bg-card rounded-lg border p-3 hover:shadow-md transition-shadow flex gap-3 group"
    >
      <div className="w-20 h-20 bg-muted rounded-lg shrink-0 overflow-hidden">
        {listing.photos?.[0] ? (
          <img
            src={listing.photos[0]}
            alt={listingTitle}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/60 text-muted-foreground">
            <Package className="w-5 h-5" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-foreground text-sm line-clamp-1 group-hover:text-primary transition-colors">
          {listingTitle}
        </h3>
        {getCategoryName(listing.category) && (
          <span className="inline-block text-[9px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full mb-1 capitalize">
            {getCategoryName(listing.category)}
          </span>
        )}
        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          {listing.location?.city}
        </p>
        {ratingValue != null && (
          <p className="text-xs text-muted-foreground mb-1">
            ⭐ {safeNumber(ratingValue).toFixed(1)} ({reviewCount})
          </p>
        )}
        <p className="text-sm font-bold text-foreground">
          {formatCurrency(listing.basePrice)}/day
        </p>
      </div>
    </Link>
  );
}
