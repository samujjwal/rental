import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams, Form, useNavigation, useSubmit, useNavigate } from "react-router";
import { Search, SlidersHorizontal, X, Grid3X3, List, Map } from "lucide-react";
import { listingsApi } from "~/lib/api/listings";
import { geoApi } from "~/lib/api/geo";
import type { ListingSearchParams } from "~/types/listing";
import type { Listing } from "~/types/listing";
import type { FilterPreset } from "~/components/ui/FilterPresets";
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "~/lib/utils";
import { APP_CURRENCY } from "~/config/locale";
import { useDebounce } from "~/hooks/useDebounce";
import type { LatLngBoundsExpression } from "leaflet";
import {
  UnifiedButton,
  Badge,
  CardGridSkeleton,
  EmptyStatePresets,
  FilterPresets,
  RouteErrorBoundary,
  Alert,
} from "~/components/ui";
import { ListingsMap } from "~/components/map/ListingsMap";
import type { ListingMarkerData } from "~/components/map/ListingMarker";
import { LocationAutocomplete } from "~/components/search/LocationAutocomplete";
import {
  SearchListingCard,
  SearchListingListItem,
  SearchListingCompactCard,
} from "~/components/search/SearchListingCards";
import { SearchFiltersSidebar } from "~/components/search/SearchFiltersSidebar";

export const meta: MetaFunction = () => {
  return [
    { title: "Search Rentals | GharBatai Rentals" },
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
    (url.searchParams.get("query") ?? url.searchParams.get("q"))
      ?.trim()
      .slice(0, MAX_SEARCH_QUERY_LENGTH) || undefined;
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
    ["rating", "price-asc", "price-desc", "newest", "popular", "distance"].includes(
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
  const { t } = useTranslation();
  const [urlSearchParams, setSearchParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  // Initialize and handle responsive behavior without causing layout shifts
  useEffect(() => {
    const checkDesktop = () => window.innerWidth >= 1280;
    
    // Set initial state
    setIsDesktop(checkDesktop());
    setShowFilters(checkDesktop());

    // Stable resize handler - uses CSS for transitions rather than state changes
    const handleResize = () => {
      const desktop = checkDesktop();
      setIsDesktop(desktop);
      // Only update showFilters on initial load or major breakpoint crossing
      // Don't toggle on every resize to prevent layout thrashing
    };

    window.addEventListener("resize", handleResize, { passive: true });
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const [mapBounds, setMapBounds] = useState<SearchBounds | null>(null);
  const [highlightedListingId, setHighlightedListingId] = useState<string | undefined>();
  const [mapOnly, setMapOnly] = useState(false);
  const [locationValue, setLocationValue] = useState(searchParams.location || "");
  const [subbarScrolled, setSubbarScrolled] = useState(false);
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

  // Collapse location input when user has scrolled 60px down
  useEffect(() => {
    const handler = () => setSubbarScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    setLocationValue(searchParams.location || "");
  }, [searchParams.location]);

  // Auto-populate location from last used or current position
  useEffect(() => {
    if (searchParams.location) return; // already set from URL
    const saved = localStorage.getItem("lastSearchLocation");
    if (saved) {
      setLocationValue(saved);
      // Also apply to URL so results are actually filtered by this location
      const newParams = new URLSearchParams(urlSearchParams);
      newParams.set("location", saved);
      // Restore saved coordinates so geo search works on return visits
      try {
        const savedCoords = localStorage.getItem("lastSearchCoords");
        if (savedCoords) {
          const { lat, lng } = JSON.parse(savedCoords);
          if (typeof lat === "number" && typeof lng === "number") {
            newParams.set("lat", lat.toFixed(6));
            newParams.set("lng", lng.toFixed(6));
            if (!newParams.get("radius")) newParams.set("radius", "25");
          }
        }
      } catch { /* ignore malformed coords */ }
      newParams.set("page", "1");
      setSearchParams(newParams, { replace: true });
      return;
    }
    // Fall back to GPS detection
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { result } = await geoApi.reverse(
            pos.coords.latitude,
            pos.coords.longitude,
            navigator.language || "en"
          );
          const label = result?.shortLabel || result?.address?.locality || "";
          if (label) {
            setLocationValue(label);
            localStorage.setItem("lastSearchLocation", label);
            // Persist coordinates so geo search actually triggers
            localStorage.setItem(
              "lastSearchCoords",
              JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude })
            );
            // Apply location + coords to URL so results are proximity-filtered
            const gpsParams = new URLSearchParams(urlSearchParams);
            gpsParams.set("location", label);
            gpsParams.set("lat", pos.coords.latitude.toFixed(6));
            gpsParams.set("lng", pos.coords.longitude.toFixed(6));
            if (!gpsParams.get("radius")) gpsParams.set("radius", "25");
            gpsParams.set("page", "1");
            setSearchParams(gpsParams, { replace: true });
          }
        } catch {
          // silently ignore
        }
      },
      () => { /* permission denied – ignore */ },
      { timeout: 5000 }
    );
   
  }, []);

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

  // Recent search terms persisted in localStorage
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("recentSearchQueries") || "[]");
    } catch {
      return [];
    }
  });

  const saveRecentSearch = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const updated = [trimmed, ...prev.filter((s) => s !== trimmed)].slice(0, 5);
      localStorage.setItem("recentSearchQueries", JSON.stringify(updated));
      return updated;
    });
  };

  // Auto-submit search when typing (debounced)
  const [query, setQuery] = useState(searchParams.query || "");
  const debouncedQuery = useDebounce(query, 500);

  const handleSearchSubmit = () => {
    if (query.trim()) saveRecentSearch(query.trim());
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
      localStorage.setItem("lastSearchLocation", normalizedLabel);
    } else {
      newParams.delete("location");
    }

    if (coords) {
      const lat = safeNumber(coords.lat);
      const lon = safeNumber(coords.lon);
      if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        newParams.set("lat", lat.toFixed(6));
        newParams.set("lng", lon.toFixed(6));
        // Persist coordinates for return-visit restoration
        localStorage.setItem("lastSearchCoords", JSON.stringify({ lat, lng: lon }));
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
  const currentFilters = Object.fromEntries(urlSearchParams.entries());

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
        currency: listing.currency || APP_CURRENCY,
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
      {/* Search sub-bar — sticky below the main app nav (top-14 = 56px) */}
      <div className="sticky top-14 z-20 bg-card/95 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Bar */}
            <Form
              className="flex-1 min-w-[200px]"
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
                  placeholder={t("search.placeholder", "Search for items...")}
                  aria-label={t("search.placeholder", "Search for items")}
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
                  {t("common.search", "Search")}
                </button>
              </div>
            </Form>

            {/* Recent search chip suggestions — shown when query is empty */}
            {!query && recentSearches.length > 0 && (
              <div className="w-full flex items-center gap-1.5 flex-wrap -mt-1 pb-1">
                <span className="text-xs text-muted-foreground shrink-0">
                  {t("search.recent", "Recent:")}
                </span>
                {recentSearches.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setQuery(s);
                      handleSearchSubmit();
                    }}
                    className="text-xs px-2.5 py-1 rounded-full border border-border bg-muted hover:bg-muted/70 text-foreground transition-colors"
                  >
                    {s}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setRecentSearches([]);
                    localStorage.removeItem("recentSearchQueries");
                  }}
                  className="text-xs text-muted-foreground/60 hover:text-muted-foreground ml-1"
                >
                  {t("search.clearRecent", "Clear")}
                </button>
              </div>
            )}

            <div
              className={`transition-all duration-300 overflow-hidden shrink-0 ${
                subbarScrolled ? "w-0 opacity-0 pointer-events-none" : "w-full sm:w-48 md:w-60 opacity-100"
              }`}
            >
              <LocationAutocomplete
                value={locationValue}
                onChange={setLocationValue}
                onSelect={(suggestion) => {
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
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Category Quick-Filter Row — scrollable pills */}
        {categories.length > 0 && (
          <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
            <button
              onClick={() => handleFilterChange("category", "")}
              className={cn(
                "flex-shrink-0 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors whitespace-nowrap",
                !searchParams.category
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-input hover:border-foreground hover:text-foreground"
              )}
            >
              {t("search.categoryAll", "All")}
            </button>
            {(categories as { id: string; name: string; slug?: string }[]).map((cat) => {
              const catKey = cat.slug ?? cat.id;
              const isActive = searchParams.category === catKey;
              return (
                <button
                  key={cat.id}
                  onClick={() => handleFilterChange("category", isActive ? "" : catKey)}
                  className={cn(
                    "flex-shrink-0 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors whitespace-nowrap",
                    isActive
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-input hover:border-foreground hover:text-foreground"
                  )}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        )}

        {/* Filter Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <UnifiedButton
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              leftIcon={<SlidersHorizontal className="w-5 h-5" />}
            >
              {t("search.filters", "Filters")}
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
                {t("search.clearFilters", "Clear all")}
              </button>
            )}

            <FilterPresets
              currentFilters={currentFilters}
              storageKey="search"
                onApplyPreset={(filters: FilterPreset["filters"]) => {
                setLocationValue(filters.location || "");
                setSearchParams({ ...filters, page: "1" });
              }}
            />
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {t("search.resultsFound", "{{count}} results found", { count: results.total })}
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
                title={t("search.gridView", "Grid view")}
                aria-label={t("search.gridView", "Grid view")}
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
                title={t("search.listView", "List view")}
                aria-label={t("search.listView", "List view")}
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
                title={t("search.mapView", "Map view")}
                aria-label={t("search.mapView", "Map view")}
              >
                <Map className="w-4 h-4" />
              </button>
            </div>

            <select
              value={searchParams.sortBy || ""}
              onChange={(e) => handleFilterChange("sortBy", e.target.value)}
              className="px-3 py-2 border border-input rounded-lg text-sm bg-background focus:ring-2 focus:ring-ring transition-colors"
              aria-label={t("search.sortBy", "Sort by")}
            >
              <option value="">{t("search.sortBy", "Sort by")}</option>
              <option value="distance">{t("search.nearest", "Nearest")}</option>
              <option value="newest">{t("search.newest", "Newest")}</option>
              <option value="popular">{t("search.mostPopular", "Most Popular")}</option>
              <option value="price-asc">{t("search.priceLow", "Price: Low to High")}</option>
              <option value="price-desc">{t("search.priceHigh", "Price: High to Low")}</option>
              <option value="rating">{t("search.topRated", "Highest Rated")}</option>
            </select>
          </div>
        </div>

        <div className={cn("flex gap-6", viewMode === "map" && "flex-1")}>
          {/* Filters Sidebar — CSS-based responsive behavior for stability */}
          <aside
            className={cn(
              "transition-all duration-300 ease-in-out overflow-hidden",
              "xl:w-64 xl:block xl:opacity-100",
              showFilters ? "w-64 opacity-100 block" : "w-0 opacity-0 hidden xl:w-64 xl:opacity-100 xl:block"
            )}
          >
            <SearchFiltersSidebar
              categories={categories}
              searchParams={searchParams}
              urlSearchParams={urlSearchParams}
              locationValue={locationValue}
              conditions={conditions}
              maxLocationLength={MAX_SEARCH_LOCATION_LENGTH}
              onLocationChange={(value) => setLocationValue(value)}
              onLocationSelect={(suggestion) => {
                setLocationValue(
                  suggestion.shortLabel.slice(0, MAX_SEARCH_LOCATION_LENGTH)
                );
                applyLocationFilter(suggestion.shortLabel, {
                  lat: suggestion.coordinates.lat,
                  lon: suggestion.coordinates.lon,
                });
              }}
              onFilterChange={handleFilterChange}
              onApplyLocation={applyLocationFilter}
              onClearPin={() => {
                const newParams = new URLSearchParams(urlSearchParams);
                newParams.delete("lat");
                newParams.delete("lng");
                newParams.delete("radius");
                newParams.set("page", "1");
                setSearchParams(newParams);
              }}
              onClearAll={clearFilters}
              onClose={() => setShowFilters(false)}
            />
          </aside>

          {/* Results Section - Split view with map */}
          <main className={cn("flex-1", viewMode === "map" && "flex gap-6")}>
            {/* Error Alert */}
            {error && (
              <Alert
                type="error"
                title={t("search.error", "Search Error")}
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

              {/* Empty search discovery prompt — shown when no active search intent */}
              {!isLoading && !searchParams.query && !searchParams.location && !searchParams.lat && !searchParams.category && results.listings.length > 0 && (
                <div className="mb-6 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-6">
                  <h2 className="text-lg font-semibold text-foreground mb-1">
                    {t("search.discoverPromptTitle", "What are you looking for?")}
                  </h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t("search.discoverPromptDesc", "Search by keyword or location above, or browse popular categories below.")}
                  </p>
                  {categories.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {(categories as { id: string; name: string; slug?: string }[]).slice(0, 8).map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => handleFilterChange("category", cat.slug ?? cat.id)}
                          className="px-3 py-1.5 rounded-full border border-primary/30 bg-background text-sm text-primary font-medium hover:bg-primary hover:text-primary-foreground transition-colors"
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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
                  {/* Similar results notice */}
                  {(results.listings as any[]).some((l) => l.isSimilarMatch) && (
                    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
                      <span className="font-medium">{t("search.noExactMatches", "No exact matches found.")}</span>
                      <span className="text-amber-700 dark:text-amber-400">
                        {searchParams.query ? t("search.showingSimilarFor", "Showing similar results for \"{{query}}\".", { query: searchParams.query }) : t("search.showingSimilar", "Showing similar results.")}
                      </span>
                    </div>
                  )}

                  {/* Grid View */}
                  {viewMode === "grid" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {results.listings.map((listing) => (
                        <SearchListingCard key={listing.id} listing={listing} />
                      ))}
                    </div>
                  )}

                  {/* List View */}
                  {viewMode === "list" && (
                    <div className="space-y-4">
                      {results.listings.map((listing) => (
                        <SearchListingListItem key={listing.id} listing={listing} />
                      ))}
                    </div>
                  )}

                  {/* Map Split View - Show compact list */}
                  {viewMode === "map" && !mapOnly && (
                    <div className="space-y-3">
                      {results.listings.map((listing) => (
                        <SearchListingCompactCard
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
                          {t("common.previous", "Previous")}
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
                          {t("common.next", "Next")}
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
                  "sticky top-[8.5rem] h-[calc(100vh-9rem)]"
                )}
              >
                <div className="bg-card border rounded-lg h-full flex flex-col">
                  {/* Map Header */}
                  <div className="p-3 border-b flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      {t("search.itemsOnMap", "{{count}} items on map", { count: mapListings.length })}
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
                        {mapOnly ? t("search.showList", "Show list") : t("search.mapOnly", "Map only")}
                      </UnifiedButton>
                      <UnifiedButton
                        variant="outline"
                        size="sm"
                        onClick={handleSearchThisArea}
                        disabled={!mapBounds}
                      >
                        {t("search.searchThisArea", "Search this area")}
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
                            {t("search.noGeocodedListings", "No geocoded listings to show.")}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {t("search.adjustFiltersHint", "Try adjusting filters or switch to list view.")}
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
