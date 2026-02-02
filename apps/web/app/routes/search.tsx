import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams, Link, Form, useNavigation, useSubmit } from "react-router";
import { Search, SlidersHorizontal, MapPin, X, Grid3X3, List, Map, AlertCircle } from "lucide-react";
import { listingsApi } from "~/lib/api/listings";
import type { ListingSearchResponse } from "~/types/listing";
import { useState, useEffect } from "react";
import { cn } from "~/lib/utils";
import { useDebounce } from "~/hooks/use-debounce";
import {
  Button,
  Badge,
  CardGridSkeleton,
  EmptyStatePresets,
  RouteErrorBoundary,
  Alert,
} from "~/components/ui";

export const meta: MetaFunction = () => {
  return [
    { title: "Search Rentals - Universal Rental Portal" },
    { name: "description", content: "Find the perfect rental for your needs" },
  ];
};

export async function clientLoader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const searchParams = {
    query: url.searchParams.get("query") || undefined,
    category: url.searchParams.get("category") || undefined,
    minPrice: url.searchParams.get("minPrice")
      ? Number(url.searchParams.get("minPrice"))
      : undefined,
    maxPrice: url.searchParams.get("maxPrice")
      ? Number(url.searchParams.get("maxPrice"))
      : undefined,
    location: url.searchParams.get("location") || undefined,
    condition: url.searchParams.get("condition") || undefined,
    instantBooking:
      url.searchParams.get("instantBooking") === "true" || undefined,
    delivery: url.searchParams.get("delivery") === "true" || undefined,
    sortBy: (url.searchParams.get("sortBy") as any) || undefined,
    page: url.searchParams.get("page")
      ? Number(url.searchParams.get("page"))
      : 1,
    limit: 20,
  };

  try {
    const results = await listingsApi.searchListings(searchParams);
    return { results, searchParams, error: null };
  } catch (error) {
    console.error("Search error:", error);
    return {
      results: {
        listings: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      },
      searchParams,
      error: "Failed to load search results. Please try again.",
    };
  }
}

export default function SearchPage() {
  const { results, searchParams, error } = useLoaderData<typeof clientLoader>();
  const [urlSearchParams, setSearchParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const [showMap, setShowMap] = useState(false);
  
  // Initialize view mode from localStorage or default to grid
  const [viewMode, setViewMode] = useState<"grid" | "list" | "map">("grid");

  useEffect(() => {
    const savedViewMode = localStorage.getItem("searchViewMode") as "grid" | "list" | "map";
    if (savedViewMode) {
      setViewMode(savedViewMode);
    }
  }, []);

  // Save view mode changes
  const handleViewModeChange = (mode: "grid" | "list" | "map") => {
    setViewMode(mode);
    localStorage.setItem("searchViewMode", mode);
    if (mode !== "map") {
      setShowMap(false);
    }
  };

  const navigation = useNavigation();
  const submit = useSubmit();
  const isLoading = navigation.state === "loading";

  // Auto-submit search when typing (debounced)
  const [query, setQuery] = useState(searchParams.query || "");
  const debouncedQuery = useDebounce(query, 500);

  useEffect(() => {
    // Only submit if query changed and it's not the initial load
    if (debouncedQuery !== (searchParams.query || "")) {
      const formData = new FormData();
      if (debouncedQuery) formData.set("query", debouncedQuery);
      
      // Preserve other filters
      Array.from(urlSearchParams.entries()).forEach(([key, value]) => {
        if (key !== "query" && key !== "page") {
          formData.append(key, value);
        }
      });
      formData.set("page", "1"); // Reset page on new search
      
      submit(formData, { replace: true });
    }
  }, [debouncedQuery, submit]);

  const categories = [
    "Electronics",
    "Tools",
    "Sports",
    "Vehicles",
    "Photography",
    "Party",
    "Outdoor",
    "Home",
  ];

  const conditions = ["new", "like-new", "good", "fair", "poor"];

  const handleFilterChange = (key: string, value: string) => {
    const newParams = new URLSearchParams(urlSearchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    newParams.set("page", "1"); // Reset to first page
    setSearchParams(newParams);
  };

  const clearFilters = () => {
    setSearchParams({});
  };

  const activeFiltersCount = Array.from(urlSearchParams.entries()).filter(
    ([key]) => key !== "page" && key !== "limit"
  ).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <Link to="/" className="text-xl font-bold text-primary">
              Rental Portal
            </Link>

            {/* Search Bar */}
            <Form className="flex-1 max-w-2xl" onSubmit={(e) => { e.preventDefault(); }}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  name="query"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search for items..."
                  className="w-full pl-10 pr-24 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-20 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-md hover:bg-primary/90 transition-colors"
                >
                  Search
                </button>
              </div>
            </Form>

            <Link
              to="/dashboard"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Filter Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="outlined"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <SlidersHorizontal className="w-5 h-5" />
              Filters
              {activeFiltersCount > 0 && (
                <Badge variant="default" className="ml-1">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>

            {activeFiltersCount > 0 && (
              <button
                onClick={clearFilters}
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                <X className="w-4 h-4" />
                Clear all
              </button>
            )}
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {results.total} results found
            </span>
            
            {/* View Mode Toggle */}
            <div className="flex items-center border rounded-lg overflow-hidden">
              <button
                onClick={() => handleViewModeChange("grid")}
                className={cn(
                  "p-2 transition-colors",
                  viewMode === "grid" && !showMap
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-accent"
                )}
                title="Grid view"
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleViewModeChange("list")}
                className={cn(
                  "p-2 transition-colors border-x",
                  viewMode === "list" && !showMap
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-accent"
                )}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setShowMap(!showMap); if(!showMap) handleViewModeChange("map"); }}
                className={cn(
                  "p-2 transition-colors",
                  showMap
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-accent"
                )}
                title="Map view"
              >
                <Map className="w-4 h-4" />
              </button>
            </div>
            
            <select
              value={searchParams.sortBy || ""}
              onChange={(e) => handleFilterChange("sortBy", e.target.value)}
              className="px-3 py-2 border border-input rounded-lg text-sm bg-background focus:ring-2 focus:ring-ring transition-colors"
            >
              <option value="">Sort by</option>
              <option value="newest">Newest</option>
              <option value="popular">Most Popular</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="rating">Highest Rated</option>
            </select>
          </div>
        </div>

        <div className={cn("flex gap-6", showMap && "flex-1")}>
          {/* Filters Sidebar */}
          {showFilters && (
            <aside className="w-64 shrink-0">
              <div className="bg-card rounded-lg shadow-sm border p-6 sticky top-24">
                <h3 className="font-semibold text-foreground mb-4">Filters</h3>

                {/* Category Filter */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Category
                  </label>
                  <select
                    value={searchParams.category || ""}
                    onChange={(e) =>
                      handleFilterChange("category", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background focus:ring-2 focus:ring-ring transition-colors"
                  >
                    <option value="">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Price Range */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Price Range (per day)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="Min"
                      value={searchParams.minPrice || ""}
                      onChange={(e) =>
                        handleFilterChange("minPrice", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background focus:ring-2 focus:ring-ring transition-colors"
                    />
                    <span className="text-muted-foreground">-</span>
                    <input
                      type="number"
                      placeholder="Max"
                      value={searchParams.maxPrice || ""}
                      onChange={(e) =>
                        handleFilterChange("maxPrice", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background focus:ring-2 focus:ring-ring transition-colors"
                    />
                  </div>
                </div>

                {/* Condition */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Condition
                  </label>
                  <select
                    value={searchParams.condition || ""}
                    onChange={(e) =>
                      handleFilterChange("condition", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background capitalize focus:ring-2 focus:ring-ring transition-colors"
                  >
                    <option value="">Any Condition</option>
                    {conditions.map((cond) => (
                      <option key={cond} value={cond}>
                        {cond.replace("-", " ")}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quick Filters */}
                <div className="space-y-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={searchParams.instantBooking === true}
                      onChange={(e) =>
                        handleFilterChange(
                          "instantBooking",
                          e.target.checked ? "true" : ""
                        )
                      }
                      className="w-4 h-4 text-primary rounded border-input focus:ring-ring"
                    />
                    <span className="text-sm text-foreground">
                      Instant Booking
                    </span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={searchParams.delivery === true}
                      onChange={(e) =>
                        handleFilterChange(
                          "delivery",
                          e.target.checked ? "true" : ""
                        )
                      }
                      className="w-4 h-4 text-primary rounded border-input focus:ring-ring"
                    />
                    <span className="text-sm text-foreground">
                      Delivery Available
                    </span>
                  </label>
                </div>
              </div>
            </aside>
          )}

          {/* Results Section - Split view with map */}
          <main className={cn("flex-1", showMap && "flex gap-6")}>
            {/* Error Alert */}
            {error && (
              <Alert
                type="error"
                title="Search Error"
                message={error}
                className="mb-6"
              />
            )}
            
            {/* Listings */}
            <div className={cn(showMap ? "w-1/2 overflow-y-auto max-h-[calc(100vh-200px)]" : "w-full")}>
              {/* Loading State */}
              {isLoading && (
                <CardGridSkeleton 
                  count={viewMode === "list" ? 6 : 9} 
                  className={viewMode === "list" ? "grid-cols-1" : ""} 
                />
              )}
              
              {/* Empty State */}
              {!isLoading && results.listings.length === 0 && (
                <div className="bg-card rounded-lg shadow-sm border p-12">
                  <EmptyStatePresets.NoSearchResults
                    searchTerm={searchParams.query}
                    onClearFilters={clearFilters}
                  />
                </div>
              )}
              
              {/* Results */}
              {!isLoading && results.listings.length > 0 && (
                <>
                  {/* Grid View */}
                  {viewMode === "grid" && !showMap && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {results.listings.map((listing) => (
                        <ListingCard key={listing.id} listing={listing} />
                      ))}
                    </div>
                  )}
                  
                  {/* List View */}
                  {viewMode === "list" && !showMap && (
                    <div className="space-y-4">
                      {results.listings.map((listing) => (
                        <ListingListItem key={listing.id} listing={listing} />
                      ))}
                    </div>
                  )}
                  
                  {/* Map Split View - Show compact list */}
                  {showMap && (
                    <div className="space-y-3">
                      {results.listings.map((listing) => (
                        <ListingCompactCard key={listing.id} listing={listing} />
                      ))}
                    </div>
                  )}

                  {/* Pagination */}
                  {results.totalPages > 1 && (
                    <div className="mt-8 flex justify-center gap-2">
                      {results.page > 1 && (
                        <Button
                          variant="outlined"
                          onClick={() =>
                            handleFilterChange("page", String(results.page - 1))
                          }
                        >
                          Previous
                        </Button>
                      )}
                      {Array.from({ length: results.totalPages }, (_, i) => i + 1)
                        .filter(
                          (page) =>
                            page === 1 ||
                            page === results.totalPages ||
                            Math.abs(page - results.page) <= 2
                        )
                        .map((page, index, array) => (
                          <div key={page}>
                            {index > 0 && array[index - 1] !== page - 1 && (
                              <span className="px-2 py-2 text-muted-foreground">
                                ...
                              </span>
                            )}
                            <Button
                              variant={
                                page === results.page ? "contained" : "outlined"
                              }
                              onClick={() =>
                                handleFilterChange("page", String(page))
                              }
                            >
                              {page}
                            </Button>
                          </div>
                        ))}
                      {results.page < results.totalPages && (
                        <Button
                          variant="outlined"
                          onClick={() =>
                            handleFilterChange("page", String(results.page + 1))
                          }
                        >
                          Next
                        </Button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            
            {/* Map View */}
            {showMap && (
              <div className="w-1/2 sticky top-24 h-[calc(100vh-200px)]">
                <div className="bg-card border rounded-lg h-full flex flex-col">
                  {/* Map Header */}
                  <div className="p-3 border-b flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      {results.listings.length} items on map
                    </span>
                    <Button variant="outlined" size="small">
                      Search this area
                    </Button>
                  </div>
                  
                  {/* Map Placeholder */}
                  <div className="flex-1 bg-muted relative">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <Map className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground mb-2">Interactive Map</p>
                        <p className="text-sm text-muted-foreground">
                          Integrate with Mapbox, Google Maps, or Leaflet
                        </p>
                      </div>
                    </div>
                    
                    {/* Simulated Map Pins */}
                    <div className="absolute inset-0 p-8">
                      {results.listings.slice(0, 6).map((listing, index) => (
                        <div
                          key={listing.id}
                          className="absolute bg-primary text-primary-foreground px-2 py-1 rounded-full text-xs font-bold shadow-lg cursor-pointer hover:bg-primary/90 transition-colors"
                          style={{
                            left: `${20 + (index % 3) * 30}%`,
                            top: `${20 + Math.floor(index / 3) * 40}%`,
                          }}
                          title={listing.title}
                        >
                          ${listing.pricePerDay}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Map Controls */}
                  <div className="absolute bottom-20 right-4 flex flex-col gap-1">
                    <button className="bg-card border rounded p-2 shadow hover:bg-accent transition-colors">
                      <span className="text-lg font-bold">+</span>
                    </button>
                    <button className="bg-card border rounded p-2 shadow hover:bg-accent transition-colors">
                      <span className="text-lg font-bold">−</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

// Grid Card Component
function ListingCard({ listing }: { listing: any }) {
  return (
    <Link
      to={`/listings/${listing.id}`}
      className="bg-card rounded-lg shadow-sm border overflow-hidden hover:shadow-md transition-shadow group"
    >
      {/* Image */}
      <div className="aspect-[4/3] bg-muted relative">
        {listing.images?.[0] ? (
          <img
            src={listing.images[0]}
            alt={listing.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            No image
          </div>
        )}
        {listing.featured && (
          <Badge variant="warning" className="absolute top-2 left-2">
            Featured
          </Badge>
        )}
        {listing.instantBooking && (
          <Badge variant="success" className="absolute top-2 right-2">
            Instant
          </Badge>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-foreground mb-1 line-clamp-2 group-hover:text-primary transition-colors">
          {listing.title}
        </h3>
        <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
          <MapPin className="w-4 h-4" />
          {listing.location?.city}, {listing.location?.state}
        </p>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground capitalize">
            {listing.condition?.replace("-", " ")}
          </span>
          {listing.rating && (
            <span className="text-sm text-muted-foreground">
              ⭐ {listing.rating.toFixed(1)} ({listing.totalReviews})
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-foreground">
            ${listing.pricePerDay}
          </span>
          <span className="text-sm text-muted-foreground">/day</span>
        </div>
      </div>
    </Link>
  );
}

// List View Component
function ListingListItem({ listing }: { listing: any }) {
  return (
    <Link
      to={`/listings/${listing.id}`}
      className="bg-card rounded-lg shadow-sm border overflow-hidden hover:shadow-md transition-shadow flex group"
    >
      {/* Image */}
      <div className="w-48 h-36 bg-muted relative shrink-0">
        {listing.images?.[0] ? (
          <img
            src={listing.images[0]}
            alt={listing.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            No image
          </div>
        )}
        {listing.instantBooking && (
          <Badge variant="success" className="absolute top-2 left-2">
            Instant
          </Badge>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
              {listing.title}
            </h3>
            {listing.featured && <Badge variant="warning">Featured</Badge>}
          </div>
          <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            {listing.location?.city}, {listing.location?.state}
          </p>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {listing.description}
          </p>
        </div>
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground capitalize">
              {listing.condition?.replace("-", " ")}
            </span>
            {listing.rating && (
              <span className="text-sm text-muted-foreground">
                ⭐ {listing.rating.toFixed(1)} ({listing.totalReviews})
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-foreground">
              ${listing.pricePerDay}
            </span>
            <span className="text-sm text-muted-foreground">/day</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// Compact Card for Map View
function ListingCompactCard({ listing }: { listing: any }) {
  return (
    <Link
      to={`/listings/${listing.id}`}
      className="bg-card rounded-lg border p-3 hover:shadow-md transition-shadow flex gap-3 group"
    >
      {/* Thumbnail */}
      <div className="w-20 h-20 bg-muted rounded-lg shrink-0 overflow-hidden">
        {listing.images?.[0] ? (
          <img
            src={listing.images[0]}
            alt={listing.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
            No img
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-foreground text-sm line-clamp-1 group-hover:text-primary transition-colors">
          {listing.title}
        </h3>
        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          {listing.location?.city}
        </p>
        {listing.rating && (
          <p className="text-xs text-muted-foreground mb-1">
            ⭐ {listing.rating.toFixed(1)} ({listing.totalReviews})
          </p>
        )}
        <p className="text-sm font-bold text-foreground">
          ${listing.pricePerDay}/day
        </p>
      </div>
    </Link>
  );
}

// Error boundary for route errors
export { RouteErrorBoundary as ErrorBoundary };

