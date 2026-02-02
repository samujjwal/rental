import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link, useNavigation, useRevalidator } from "react-router";
import { useState } from "react";
import {
  Heart,
  MapPin,
  Star,
  Calendar,
  Trash2,
  Search,
  Grid as LayoutGrid,
  List,
  Loader2,
} from "lucide-react";
import { listingsApi } from "~/lib/api/listings";
import { useAuthStore } from "~/lib/store/auth";
import {
  Button,
  Badge,
  CardGridSkeleton,
  EmptyStatePresets,
  RouteErrorBoundary,
} from "~/components/ui";
import { cn } from "~/lib/utils";

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

export async function clientLoader({ request }: LoaderFunctionArgs) {
  try {
    // Get the authenticated user's ID from the auth store
    const user = useAuthStore.getState().user;
    if (!user) {
      throw new Error("User not authenticated");
    }
    
    const favorites = await listingsApi.getFavoriteListings(user.id);
    return { favorites, error: null };
  } catch (error) {
    console.error("Failed to load favorites:", error);
    return { favorites: [], error: "Failed to load favorites" };
  }
}

export default function FavoritesPage() {
  const { favorites, error } = useLoaderData<{
    favorites: FavoriteListing[];
    error: string | null;
  }>();
  
  const revalidator = useRevalidator();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  const filteredFavorites = favorites.filter((listing) =>
    listing.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    listing.category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    listing.location.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRemoveFavorite = async (listingId: string) => {
    setRemovingId(listingId);
    try {
      await listingsApi.removeFavorite(listingId);
      revalidator.revalidate();
    } catch (error) {
      console.error("Failed to remove favorite:", error);
    } finally {
      setRemovingId(null);
    }
  };

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
              <Button variant="outlined">
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
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search favorites..."
                  className="w-full pl-10 pr-4 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === "grid" ? "contained" : "outlined"}
                  size="small"
                  onClick={() => setViewMode("grid")}
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "contained" : "outlined"}
                  size="small"
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
                {filteredFavorites.map((listing) => (
                  <div
                    key={listing.id}
                    className="bg-card border rounded-lg overflow-hidden hover:shadow-lg transition-shadow group"
                  >
                    <div className="relative aspect-[4/3]">
                      <Link to={`/listings/${listing.id}`}>
                        <img
                          src={listing.images[0] || "/placeholder-listing.jpg"}
                          alt={listing.title}
                          className="w-full h-full object-cover"
                        />
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
                      <Link to={`/listings/${listing.id}`}>
                        <h3 className="font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                          {listing.title}
                        </h3>
                      </Link>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        <span>{listing.location.city}, {listing.location.state}</span>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium">
                            {listing.averageRating?.toFixed(1) || "New"}
                          </span>
                          <span className="text-muted-foreground text-sm">
                            ({listing.reviewCount})
                          </span>
                        </div>
                        <div className="font-semibold text-foreground">
                          ${listing.basePrice}
                          <span className="text-sm text-muted-foreground font-normal">/day</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredFavorites.map((listing) => (
                  <div
                    key={listing.id}
                    className="bg-card border rounded-lg overflow-hidden hover:shadow-lg transition-shadow flex"
                  >
                    <div className="relative w-48 h-32 flex-shrink-0">
                      <Link to={`/listings/${listing.id}`}>
                        <img
                          src={listing.images[0] || "/placeholder-listing.jpg"}
                          alt={listing.title}
                          className="w-full h-full object-cover"
                        />
                      </Link>
                    </div>
                    <div className="flex-1 p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between">
                          <Link to={`/listings/${listing.id}`}>
                            <h3 className="font-semibold text-foreground hover:text-primary transition-colors">
                              {listing.title}
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
                            <span>{listing.location.city}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                            <span>{listing.averageRating?.toFixed(1) || "New"}</span>
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
                ))}
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
