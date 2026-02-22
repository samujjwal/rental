import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams, Link, Form, useNavigation, useSubmit, useNavigate } from "react-router";
import { Search, SlidersHorizontal, MapPin, X, Grid3X3, List, Map, Package } from "lucide-react";
import { listingsApi } from "~/lib/api/listings";
import type { ListingSearchParams } from "~/types/listing";
import type { Listing } from "~/types/listing";
import { useState, useEffect, useCallback } from "react";
import { cn } from "~/lib/utils";
import { useDebounce } from "~/hooks/use-debounce";
import type { LatLngBoundsExpression } from "leaflet";
import {
  UnifiedButton,
  Badge,
  CardGridSkeleton,
  EmptyStatePresets,
  RouteErrorBoundary,
  Alert,
} from "~/components/ui";
import { ListingsMap } from "~/components/map/ListingsMap";
import type { ListingMarkerData } from "~/components/map/ListingMarker";
import { LocationAutocomplete } from "~/components/search/LocationAutocomplete";

export const meta: MetaFunction = () => {
  return [
    { title: "Search Rentals - Universal Rental Portal" },
    { name: "description", content: "Find the perfect rental for your needs" },
  ];
};
const MAX_SEARCH_QUERY_LENGTH = 120;
const MAX_SEARCH_LOCATION_LENGTH = 120;
const MAX_CATEGORY_LENGTH = 80;
const safeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const safeText = (value: unknown, fallback = ""): string => {
  const text = typeof value === "string" ? value : "";
  return text || fallback;
};
const humanizeCondition = (value: unknown): string =>
  safeText(value).replace("-", " ");
const BOUNDS_EPSILON = 0.000001;
type SearchBounds = [[number, number], [number, number]];
const normalizeBounds = (bounds: LatLngBoundsExpression): SearchBounds | null => {
  if (!Array.isArray(bounds) || bounds.length !== 2) return null;
  const southWest = bounds[0];
  const northEast = bounds[1];
  if (!Array.isArray(southWest) || !Array.isArray(northEast)) return null;
  const south = Number(southWest[0]);
  const west = Number(southWest[1]);
  const north = Number(northEast[0]);
  const east = Number(northEast[1]);
  if (![south, west, north, east].every(Number.isFinite)) return null;
  return [
    [south, west],
    [north, east],
  ];
};
const boundsEqual = (
  first: SearchBounds | null,
  second: SearchBounds | null
) => {
  if (!first || !second) return false;
  return (
    Math.abs(first[0][0] - second[0][0]) < BOUNDS_EPSILON &&
    Math.abs(first[0][1] - second[0][1]) < BOUNDS_EPSILON &&
    Math.abs(first[1][0] - second[1][0]) < BOUNDS_EPSILON &&
    Math.abs(first[1][1] - second[1][1]) < BOUNDS_EPSILON
  );
};

export async function clientLoader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const parseNumber = (value: string | null) => {
    if (value == null || value === "") {
      return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));
  const normalizedLat = (() => {
    const value = parseNumber(url.searchParams.get("lat"));
    return typeof value === "number" && value >= -90 && value <= 90
      ? value
      : undefined;
  })();
  const normalizedLng = (() => {
    const value = parseNumber(url.searchParams.get("lng"));
    return typeof value === "number" && value >= -180 && value <= 180
      ? value
      : undefined;
  })();
  const normalizedQuery =
    url.searchParams.get("query")?.trim().slice(0, MAX_SEARCH_QUERY_LENGTH) || undefined;
  const normalizedLocation =
    url.searchParams.get("location")?.trim().slice(0, MAX_SEARCH_LOCATION_LENGTH) || undefined;
  const conditionParam = url.searchParams.get("condition");
  const allowedConditions = new Set(["new", "like-new", "good", "fair", "poor"]);
  const condition = conditionParam && allowedConditions.has(conditionParam)
    ? conditionParam
    : undefined;
  const minPrice = (() => {
    const value = parseNumber(url.searchParams.get("minPrice"));
    return typeof value === "number" ? Math.max(0, value) : undefined;
  })();
  const maxPrice = (() => {
    const value = parseNumber(url.searchParams.get("maxPrice"));
    return typeof value === "number" ? Math.max(0, value) : undefined;
  })();
  const normalizedMinPrice =
    typeof minPrice === "number" && typeof maxPrice === "number" && minPrice > maxPrice
      ? maxPrice
      : minPrice;
  const normalizedMaxPrice =
    typeof minPrice === "number" && typeof maxPrice === "number" && minPrice > maxPrice
      ? minPrice
      : maxPrice;
  const radius = (() => {
    const value = parseNumber(url.searchParams.get("radius"));
    return typeof value === "number" ? clamp(value, 1, 500) : undefined;
  })();

  const sortByParam = url.searchParams.get("sortBy");
  const sortBy = sortByParam &&
    ["rating", "price-asc", "price-desc", "newest", "popular"].includes(
      sortByParam
    )
      ? (sortByParam as ListingSearchParams["sortBy"])
      : undefined;

  const searchParams = {
    query: normalizedQuery,
    category: url.searchParams.get("category")?.trim().slice(0, MAX_CATEGORY_LENGTH) || undefined,
    lat: normalizedLat,
    lng: normalizedLng,
    radius,
    minPrice: normalizedMinPrice,
    maxPrice: normalizedMaxPrice,
    location: normalizedLocation,
    condition,
    instantBooking:
      url.searchParams.get("instantBooking") === "true" || undefined,
    delivery: url.searchParams.get("delivery") === "true" || undefined,
    sortBy,
    page: (() => {
      const parsedPage = parseNumber(url.searchParams.get("page"));
      if (!parsedPage || parsedPage < 1) {
        return 1;
      }
      return Math.floor(parsedPage);
    })(),
    limit: 20,
  };

  try {
    const [results, categories] = await Promise.all([
      listingsApi.searchListings(searchParams),
      listingsApi.getCategories().catch(() => []),
    ]);
    return { results, categories, searchParams, error: null };
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
      categories: [],
      searchParams,
      error: "Failed to load search results. Please try again.",
    };
  }
}

export default function SearchPage() {
  const { results, categories, searchParams, error } =
    useLoaderData<typeof clientLoader>();
  const [urlSearchParams, setSearchParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const [mapBounds, setMapBounds] = useState<SearchBounds | null>(null);
  const [highlightedListingId, setHighlightedListingId] = useState<string | undefined>();
  const [mapOnly, setMapOnly] = useState(false);
  const [locationValue, setLocationValue] = useState(searchParams.location || "");
  const navigate = useNavigate();

  // Initialize view mode from localStorage or default to grid
  const [viewMode, setViewMode] = useState<"grid" | "list" | "map">("grid");

  useEffect(() => {
    const savedViewMode = localStorage.getItem("searchViewMode") as
      | "grid"
      | "list"
      | "map";
    if (savedViewMode) {
      setViewMode(savedViewMode);
    }
    const savedMapOnly = localStorage.getItem("searchMapOnly");
    if (savedMapOnly === "true") {
      setMapOnly(true);
    }
  }, []);

  useEffect(() => {
    setLocationValue(searchParams.location || "");
  }, [searchParams.location]);

  useEffect(() => {
    setQuery(searchParams.query || "");
  }, [searchParams.query]);

  // Save view mode changes
  const handleViewModeChange = (mode: "grid" | "list" | "map") => {
    setViewMode(mode);
    localStorage.setItem("searchViewMode", mode);
    if (mode !== "map") {
      setMapOnly(false);
      localStorage.setItem("searchMapOnly", "false");
    }
  };

  const navigation = useNavigation();
  const submit = useSubmit();
  const isLoading = navigation.state === "loading";

  // Auto-submit search when typing (debounced)
  const [query, setQuery] = useState(searchParams.query || "");
  const debouncedQuery = useDebounce(query, 500);

  const handleSearchSubmit = () => {
    const formData = new FormData();
    if (query) formData.set("query", query);
    Array.from(urlSearchParams.entries()).forEach(([key, value]) => {
      if (key !== "query" && key !== "page") {
        formData.append(key, value);
      }
    });
    formData.set("page", "1");
    submit(formData, { replace: true });
  };

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
  }, [debouncedQuery, submit, searchParams.query, urlSearchParams]);

  const conditions = ["new", "like-new", "good", "fair", "poor"];

  const handleFilterChange = (key: string, value: string) => {
    const newParams = new URLSearchParams(urlSearchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    // Only reset to page 1 if changing a filter, not if changing the page itself
    if (key !== "page") {
      newParams.set("page", "1");
    }
    setSearchParams(newParams);
  };

  const applyLocationFilter = (
    locationLabel: string,
    coords?: { lat: number; lon: number }
  ) => {
    const normalizedLabel = locationLabel.trim().slice(0, MAX_SEARCH_LOCATION_LENGTH);
    const newParams = new URLSearchParams(urlSearchParams);
    if (normalizedLabel) {
      newParams.set("location", normalizedLabel);
    } else {
      newParams.delete("location");
    }

    if (coords) {
      const lat = safeNumber(coords.lat);
      const lon = safeNumber(coords.lon);
      if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        newParams.set("lat", lat.toFixed(6));
        newParams.set("lng", lon.toFixed(6));
      } else {
        newParams.delete("lat");
        newParams.delete("lng");
      }
      if (!newParams.get("radius")) {
        newParams.set("radius", "25");
      }
    } else {
      newParams.delete("lat");
      newParams.delete("lng");
    }

    newParams.set("page", "1");
    setSearchParams(newParams);
  };

  const clearFilters = () => {
    setLocationValue("");
    setQuery("");
    setSearchParams({});
  };

  const activeFiltersCount = Array.from(urlSearchParams.entries()).filter(
    ([key]) => key !== "page" && key !== "limit"
  ).length;

  type LegacyLocation = { lat?: number; lon?: number };
  const getListingCoordinates = (listing: Listing) => {
    const location = listing.location as Listing["location"] & LegacyLocation;
    return {
      lat: location.coordinates?.lat ?? location.lat,
      lng: location.coordinates?.lng ?? location.lon,
    };
  };

  const mapListings: ListingMarkerData[] = results.listings
    .filter((listing) => {
      const { lat, lng } = getListingCoordinates(listing);
      return typeof lat === "number" && typeof lng === "number";
    })
    .map((listing) => {
      const { lat, lng } = getListingCoordinates(listing);
      return {
        id: listing.id,
        title: listing.title,
        price: listing.basePrice,
        currency: listing.currency || "USD",
        imageUrl: listing.photos?.[0],
        category:
          typeof listing.category === "string"
            ? listing.category
            : listing.category?.name,
        location: {
          lat,
          lng,
        },
      };
    });

  const handleMapBoundsChange = useCallback((bounds: LatLngBoundsExpression) => {
    const normalizedBounds = normalizeBounds(bounds);
    if (!normalizedBounds) return;
    setMapBounds((previousBounds) =>
      boundsEqual(previousBounds, normalizedBounds)
        ? previousBounds
        : normalizedBounds
    );
  }, []);

  const handleSearchThisArea = () => {
    if (!mapBounds || !Array.isArray(mapBounds)) return;
    const [[south, west], [north, east]] = mapBounds as [[number, number], [number, number]];
    const centerLat = (south + north) / 2;
    const centerLng = (west + east) / 2;
    const radiusKm = Math.min(
      500,
      Math.max(1, haversineDistanceKm(centerLat, centerLng, north, east))
    );
    if (
      !Number.isFinite(centerLat) ||
      !Number.isFinite(centerLng) ||
      !Number.isFinite(radiusKm)
    ) {
      return;
    }
    const newParams = new URLSearchParams(urlSearchParams);
    newParams.set("lat", centerLat.toFixed(6));
    newParams.set("lng", centerLng.toFixed(6));
    newParams.set("radius", radiusKm.toFixed(2));
    newParams.set("page", "1");
    setSearchParams(newParams);
  };

  const handleMapListingClick = (listingId: string) => {
    const safeListingId = safeText(listingId);
    if (!safeListingId) return;
    navigate(`/listings/${safeListingId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link to="/" className="text-xl font-bold text-primary">
              Rental Portal
            </Link>

            {/* Search Bar */}
            <Form
              className="order-last w-full sm:order-none sm:flex-1 sm:max-w-2xl"
              onSubmit={(e) => {
                e.preventDefault();
                handleSearchSubmit();
              }}
            >
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  name="query"
                  value={query}
                  onChange={(e) =>
                    setQuery(e.target.value.slice(0, MAX_SEARCH_QUERY_LENGTH))
                  }
                  maxLength={MAX_SEARCH_QUERY_LENGTH}
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
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-md hover:bg-primary/90 transition-colors"
                >
                  Search
                </button>
              </div>
            </Form>

            <div className="w-full sm:w-48 md:w-60">
              <LocationAutocomplete
                value={locationValue}
                onChange={(value) =>
                  setLocationValue(value.slice(0, MAX_SEARCH_LOCATION_LENGTH))
                }
                onSelect={(suggestion) => {
                  setLocationValue(
                    suggestion.shortLabel.slice(0, MAX_SEARCH_LOCATION_LENGTH)
                  );
                  applyLocationFilter(suggestion.shortLabel, {
                    lat: suggestion.coordinates.lat,
                    lon: suggestion.coordinates.lon,
                  });
                }}
                inputClassName="py-2 text-sm pr-4"
                biasZoom={8}
                biasScale={0.6}
                layer="city"
              />
            </div>

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
            <UnifiedButton
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              leftIcon={<SlidersHorizontal className="w-5 h-5" />}
            >
              Filters
              {activeFiltersCount > 0 && (
                <Badge variant="default" className="ml-1">
                  {activeFiltersCount}
                </Badge>
              )}
            </UnifiedButton>

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
                  viewMode === "grid"
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
                  viewMode === "list"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-accent"
                )}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() =>
                  handleViewModeChange(viewMode === "map" ? "grid" : "map")
                }
                className={cn(
                  "p-2 transition-colors",
                  viewMode === "map"
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

        <div className={cn("flex gap-6", viewMode === "map" && "flex-1")}>
          {/* Filters Sidebar — overlay on mobile, inline on desktop */}
          {showFilters && (
            <>
              {/* Mobile backdrop */}
              <div
                className="fixed inset-0 z-40 bg-black/50 md:hidden"
                onClick={() => setShowFilters(false)}
                aria-hidden
              />
              <aside className="fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] overflow-y-auto bg-card shadow-xl md:relative md:inset-auto md:z-auto md:w-64 md:shadow-none md:shrink-0">
              <div className="bg-card rounded-lg md:shadow-sm md:border p-6 md:sticky md:top-24">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-foreground">Filters</h3>
                  <button
                    type="button"
                    onClick={() => setShowFilters(false)}
                    className="md:hidden p-1 text-muted-foreground hover:text-foreground"
                    aria-label="Close filters"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

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
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Location Filter */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Location
                  </label>
                  <LocationAutocomplete
                    value={locationValue}
                    onChange={(value) =>
                      setLocationValue(value.slice(0, MAX_SEARCH_LOCATION_LENGTH))
                    }
                    onSelect={(suggestion) => {
                      setLocationValue(
                        suggestion.shortLabel.slice(0, MAX_SEARCH_LOCATION_LENGTH)
                      );
                      applyLocationFilter(suggestion.shortLabel, {
                        lat: suggestion.coordinates.lat,
                        lon: suggestion.coordinates.lon,
                      });
                    }}
                    inputClassName="py-2.5 text-sm pr-4"
                    biasZoom={8}
                    biasScale={0.6}
                    layer="city"
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => applyLocationFilter(locationValue)}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Apply location
                    </button>
                    {(urlSearchParams.get("lat") || urlSearchParams.get("lng")) && (
                      <button
                        type="button"
                        onClick={() => {
                          const newParams = new URLSearchParams(urlSearchParams);
                          newParams.delete("lat");
                          newParams.delete("lng");
                          newParams.delete("radius");
                          newParams.set("page", "1");
                          setSearchParams(newParams);
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Clear pin
                      </button>
                    )}
                  </div>
                </div>

                {/* Radius */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Search Radius
                  </label>
                  <select
                    value={urlSearchParams.get("radius") || "25"}
                    onChange={(e) => handleFilterChange("radius", e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background focus:ring-2 focus:ring-ring transition-colors"
                  >
                    <option value="5">5 km</option>
                    <option value="10">10 km</option>
                    <option value="25">25 km</option>
                    <option value="50">50 km</option>
                    <option value="100">100 km</option>
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
                        {humanizeCondition(cond)}
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
            </>
          )}

          {/* Results Section - Split view with map */}
          <main className={cn("flex-1", viewMode === "map" && "flex gap-6")}>
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
            <div
              className={cn(
                viewMode === "map"
                  ? mapOnly
                    ? "hidden"
                    : "w-1/2 overflow-y-auto max-h-[calc(100vh-200px)]"
                  : "w-full"
              )}
            >
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
                  {viewMode === "grid" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {results.listings.map((listing) => (
                        <ListingCard key={listing.id} listing={listing} />
                      ))}
                    </div>
                  )}

                  {/* List View */}
                  {viewMode === "list" && (
                    <div className="space-y-4">
                      {results.listings.map((listing) => (
                        <ListingListItem key={listing.id} listing={listing} />
                      ))}
                    </div>
                  )}

                  {/* Map Split View - Show compact list */}
                  {viewMode === "map" && !mapOnly && (
                    <div className="space-y-3">
                      {results.listings.map((listing) => (
                        <ListingCompactCard
                          key={listing.id}
                          listing={listing}
                          onHighlightChange={setHighlightedListingId}
                        />
                      ))}
                    </div>
                  )}

                  {/* Pagination */}
                  {results.totalPages > 1 && (
                    <div className="mt-8 flex justify-center gap-2">
                      {results.page > 1 && (
                        <UnifiedButton
                          variant="outline"
                          onClick={() =>
                            handleFilterChange("page", String(results.page - 1))
                          }
                        >
                          Previous
                        </UnifiedButton>
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
                            <UnifiedButton
                              variant={
                                page === results.page ? "primary" : "outline"
                              }
                              onClick={() =>
                                handleFilterChange("page", String(page))
                              }
                            >
                              {page}
                            </UnifiedButton>
                          </div>
                        ))}
                      {results.page < results.totalPages && (
                        <UnifiedButton
                          variant="outline"
                          onClick={() =>
                            handleFilterChange("page", String(results.page + 1))
                          }
                        >
                          Next
                        </UnifiedButton>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Map View */}
            {viewMode === "map" && (
              <div
                className={cn(
                  mapOnly ? "w-full" : "w-1/2",
                  "sticky top-24 h-[calc(100vh-200px)]"
                )}
              >
                <div className="bg-card border rounded-lg h-full flex flex-col">
                  {/* Map Header */}
                  <div className="p-3 border-b flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      {mapListings.length} items on map
                    </span>
                    <div className="flex items-center gap-2">
                      <UnifiedButton
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setMapOnly((prev) => {
                            const next = !prev;
                            localStorage.setItem("searchMapOnly", String(next));
                            return next;
                          });
                        }}
                      >
                        {mapOnly ? "Show list" : "Map only"}
                      </UnifiedButton>
                      <UnifiedButton
                        variant="outline"
                        size="sm"
                        onClick={handleSearchThisArea}
                        disabled={!mapBounds}
                      >
                        Search this area
                      </UnifiedButton>
                    </div>
                  </div>

                  {/* Map */}
                  <div className="flex-1 relative">
                    <ListingsMap
                      listings={mapListings}
                      onListingClick={handleMapListingClick}
                      onBoundsChange={handleMapBoundsChange}
                      highlightedListingId={highlightedListingId}
                      className="h-full w-full rounded-b-lg"
                    />
                    {mapListings.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center bg-muted/70 rounded-b-lg">
                        <div className="text-center">
                          <p className="text-sm font-medium text-foreground">
                            No geocoded listings to show.
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Try adjusting filters or switch to list view.
                          </p>
                        </div>
                      </div>
                    )}
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
function ListingCard({ listing }: { listing: Listing }) {
  const listingId = safeText(listing.id);
  const listingTitle = safeText(listing.title, "Listing");
  const ratingValue = listing.rating ?? listing.averageRating ?? null;
  const reviewCount = listing.totalReviews ?? listing.reviewCount ?? 0;
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
          <Badge variant="success" className="absolute top-2 right-2">
            Instant
          </Badge>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-foreground mb-1 line-clamp-2 group-hover:text-primary transition-colors">
          {listingTitle}
        </h3>
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
            ${listing.basePrice}
          </span>
          <span className="text-sm text-muted-foreground">/day</span>
        </div>
      </div>
    </Link>
  );
}

// List View Component
function ListingListItem({ listing }: { listing: Listing }) {
  const listingId = safeText(listing.id);
  const listingTitle = safeText(listing.title, "Listing");
  const ratingValue = listing.rating ?? listing.averageRating ?? null;
  const reviewCount = listing.totalReviews ?? listing.reviewCount ?? 0;
  return (
    <Link
      to={listingId ? `/listings/${listingId}` : "/listings"}
      className="bg-card rounded-lg shadow-sm border overflow-hidden hover:shadow-md transition-shadow flex group"
    >
      {/* Image */}
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
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
              {listingTitle}
            </h3>
            {listing.featured && <Badge variant="warning">Featured</Badge>}
          </div>
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
              ${listing.basePrice}
            </span>
            <span className="text-sm text-muted-foreground">/day</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// Compact Card for Map View
function ListingCompactCard({
  listing,
  onHighlightChange,
}: {
  listing: Listing;
  onHighlightChange: (listingId: string | undefined) => void;
}) {
  const listingId = safeText(listing.id);
  const listingTitle = safeText(listing.title, "Listing");
  const ratingValue = listing.rating ?? listing.averageRating ?? null;
  const reviewCount = listing.totalReviews ?? listing.reviewCount ?? 0;
  return (
    <Link
      to={listingId ? `/listings/${listingId}` : "/listings"}
      onMouseEnter={() => onHighlightChange(listingId || undefined)}
      onMouseLeave={() => onHighlightChange(undefined)}
      className="bg-card rounded-lg border p-3 hover:shadow-md transition-shadow flex gap-3 group"
    >
      {/* Thumbnail */}
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

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-foreground text-sm line-clamp-1 group-hover:text-primary transition-colors">
          {listingTitle}
        </h3>
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
          ${listing.basePrice}/day
        </p>
      </div>
    </Link>
  );
}

// Error boundary for route errors
export { RouteErrorBoundary as ErrorBoundary };

function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

