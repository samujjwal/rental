import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link, useRevalidator, redirect } from "react-router";
import { useState, useCallback, useMemo } from "react";
import {
  Heart,
  MapPin,
  Star,
  Trash2,
  Search,
  Grid as LayoutGrid,
  List,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { listingsApi } from "~/lib/api/listings";
import { getUser } from "~/utils/auth";
import {
  Button,
  Badge,
  RouteErrorBoundary,
} from "~/components/ui";
import { toast } from "~/lib/toast";

export const meta: MetaFunction = () => {
  return [
    { title: "Favorites | GharBatai Rentals" },
    { name: "description", content: "View your saved favorite listings" },
  ];
};

interface FavoriteListing {
  id: string;
  title: string;
  description: string;
  images: string[];
  basePrice: number;
  currency: string;
  location: {
    city: string;
    state: string;
  };
  averageRating: number | null;
  reviewCount: number;
  category: {
    name: string;
  };
  owner: {
    firstName: string;
    lastName: string | null;
  };
  instantBooking: boolean;
  deliveryAvailable: boolean;
  savedAt?: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value: string): boolean => UUID_PATTERN.test(value);
const MAX_SEARCH_QUERY_LENGTH = 120;
const safeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const safeText = (value: unknown): string =>
  typeof value === "string" ? value : "";
const safeLower = (value: unknown): string => safeText(value).toLowerCase();
const safeLocation = (listing: FavoriteListing): string => {
  const city = safeText(listing.location?.city);
  const state = safeText(listing.location?.state);
  if (city && state) return `${city}, ${state}`;
  return city || state || "Location";
};

export async function clientLoader({ request: _request }: LoaderFunctionArgs) {
  const user = await getUser(_request);
  if (!user) {
    return redirect("/auth/login");
  }

  try {
    const favoritesResult = await listingsApi.getFavoriteListings(user.id);
    const favorites = Array.isArray(favoritesResult) ? favoritesResult : [];
    return { favorites, error: null };
  } catch (error) {
    console.error("Failed to load favorites:", error);
    return { favorites: [], error: "Failed to load favorites" };
  }
}

export default function FavoritesPage() {
  const { favorites: serverFavorites, error } = useLoaderData<{
    favorites: FavoriteListing[];
    error: string | null;
  }>();
  
  const revalidator = useRevalidator();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);
  // Optimistic state: track IDs that have been optimistically removed
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 12;

  const favorites = serverFavorites.filter((f) => !removedIds.has(f.id));

  const query = safeLower(searchQuery);
  const filteredFavorites = favorites.filter((listing) =>
    safeLower(listing.title).includes(query) ||
    safeLower(listing.category?.name).includes(query) ||
    safeLower(listing.location?.city).includes(query)
  );

  const totalPages = Math.max(1, Math.ceil(filteredFavorites.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedFavorites = useMemo(
    () => filteredFavorites.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE),
    [filteredFavorites, safePage]
  );

  const handleRemoveFavorite = useCallback(async (listingId: string) => {
    if (!isUuid(listingId)) {
      return;
    }
    const confirmed = window.confirm("Remove this listing from your favorites?");
    if (!confirmed) {
      return;
    }

    // Optimistically remove from UI immediately
    setRemovedIds((prev) => new Set(prev).add(listingId));
    setRemovingId(listingId);

    try {
      await listingsApi.removeFavorite(listingId);
      toast.success("Removed from favorites");
      // Sync server state in background
      revalidator.revalidate();
    } catch (error) {
      console.error("Failed to remove favorite:", error);
      // Rollback: restore the item
      setRemovedIds((prev) => {
        const next = new Set(prev);
        next.delete(listingId);
        return next;
      });
      toast.error("Failed to remove favorite. Please try again.");
    } finally {
      setRemovingId(null);
    }
  }, [revalidator]);

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <Heart className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h1 className="text-2xl font-bold text-foreground mb-2">Unable to load favorites</h1>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Button onClick={() => revalidator.revalidate()}>Try Again</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">My Favorites</h1>
              <p className="text-sm text-muted-foreground">
                {favorites.length} saved {favorites.length === 1 ? "listing" : "listings"}
              </p>
            </div>
            <Link to="/search">
              <Button variant="outline">
                <Search className="w-4 h-4 mr-2" />
                Browse More
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {favorites.length === 0 ? (
          <div className="text-center py-16">
            <Heart className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold text-foreground mb-2">
              No favorites yet
            </h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Start exploring and save listings you love. They'll appear here for easy access.
            </p>
            <Link to="/search">
              <Button>Start Exploring</Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
              <div className="relative w-full sm:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value.slice(0, MAX_SEARCH_QUERY_LENGTH));
                    setCurrentPage(1);
                  }}
                  placeholder="Search favorites..."
                  maxLength={MAX_SEARCH_QUERY_LENGTH}
                  className="w-full pl-10 pr-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === "grid" ? "primary" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "primary" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Listings */}
            {filteredFavorites.length === 0 ? (
              <div className="text-center py-12">
                <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  No favorites match your search. Try different keywords.
                </p>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {paginatedFavorites.map((listing) => {
                  const listingId = safeText(listing.id);
                  const listingTitle = safeText(listing.title) || "Listing";
                  return (
                  <div
                    key={listing.id}
                    className="bg-card border rounded-lg overflow-hidden hover:shadow-lg transition-shadow group"
                  >
                    <div className="relative aspect-[4/3]">
                      <Link to={listingId ? `/listings/${listingId}` : "/listings"}>
                        {listing.photos?.[0] ? (
                          <img
                            src={listing.photos[0]}
                            alt={listingTitle}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-muted flex items-center justify-center text-sm font-semibold text-foreground">
                            {listingTitle[0] || "L"}
                          </div>
                        )}
                      </Link>
                      <button
                        onClick={() => handleRemoveFavorite(listing.id)}
                        disabled={removingId === listing.id}
                        className="absolute top-2 right-2 p-2 bg-white/90 rounded-full hover:bg-white transition-colors"
                        title="Remove from favorites"
                      >
                        {removingId === listing.id ? (
                          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        ) : (
                          <Heart className="w-5 h-5 fill-red-500 text-red-500" />
                        )}
                      </button>
                      {listing.instantBooking && (
                        <Badge className="absolute top-2 left-2">Instant Book</Badge>
                      )}
                    </div>
                    <div className="p-4">
                      <Link to={listingId ? `/listings/${listingId}` : "/listings"}>
                        <h3 className="font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                          {listingTitle}
                        </h3>
                      </Link>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        <span>{safeLocation(listing)}</span>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium">
                            {listing.averageRating != null
                              ? safeNumber(listing.averageRating).toFixed(1)
                              : "New"}
                          </span>
                          <span className="text-muted-foreground text-sm">
                            ({listing.reviewCount ?? 0})
                          </span>
                        </div>
                        <div className="font-semibold text-foreground">
                          ${listing.basePrice}
                          <span className="text-sm text-muted-foreground font-normal">/day</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )})}
              </div>
            ) : (
              <div className="space-y-4">
                {paginatedFavorites.map((listing) => {
                  const listingId = safeText(listing.id);
                  const listingTitle = safeText(listing.title) || "Listing";
                  return (
                  <div
                    key={listing.id}
                    className="bg-card border rounded-lg overflow-hidden hover:shadow-lg transition-shadow flex"
                  >
                    <div className="relative w-48 h-32 flex-shrink-0">
                      <Link to={listingId ? `/listings/${listingId}` : "/listings"}>
                        {listing.photos?.[0] ? (
                          <img
                            src={listing.photos[0]}
                            alt={listingTitle}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-muted flex items-center justify-center text-sm font-semibold text-foreground">
                            {listingTitle[0] || "L"}
                          </div>
                        )}
                      </Link>
                    </div>
                    <div className="flex-1 p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between">
                          <Link to={listingId ? `/listings/${listingId}` : "/listings"}>
                            <h3 className="font-semibold text-foreground hover:text-primary transition-colors">
                              {listingTitle}
                            </h3>
                          </Link>
                          <button
                            onClick={() => handleRemoveFavorite(listing.id)}
                            disabled={removingId === listing.id}
                            className="p-1 hover:bg-muted rounded transition-colors"
                            title="Remove from favorites"
                          >
                            {removingId === listing.id ? (
                              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                            ) : (
                              <Trash2 className="w-5 h-5 text-muted-foreground hover:text-destructive" />
                            )}
                          </button>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                          {listing.description}
                        </p>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            <span>{safeLocation(listing)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                            <span>
                              {listing.averageRating != null
                                ? safeNumber(listing.averageRating).toFixed(1)
                                : "New"}
                            </span>
                          </div>
                          {listing.instantBooking && (
                            <Badge variant="outline" className="text-xs">Instant Book</Badge>
                          )}
                        </div>
                        <div className="font-semibold text-foreground">
                          ${listing.basePrice}
                          <span className="text-sm text-muted-foreground font-normal">/day</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )})}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {safePage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Error boundary for route errors
export { RouteErrorBoundary as ErrorBoundary };

