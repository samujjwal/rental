
import type { MetaFunction } from "react-router";
import { Link, useLoaderData, useNavigation } from "react-router";
import { useAuthStore } from "~/lib/store/auth";
import { DevUserSwitcher } from "~/components/DevUserSwitcher";
import { listingsApi } from "~/lib/api/listings";
import { geoApi } from "~/lib/api/geo";
import type { Listing } from "~/types/listing";
import { useState, useCallback, useEffect } from "react";
import {
  Home as HomeIcon,
  Car,
  Music,
  PartyPopper,
  Shirt,
  Search,
  Star,
  MapPin,
  Shield,
  CreditCard,
  CheckCircle,
  Camera,
  Wrench,
  Package,
  ParkingSquare,
  Dumbbell,
  Building2,
  LayoutDashboard,
  Calendar,
  MessageSquare,
  Heart,
} from "lucide-react";
import {
  CardGridSkeleton,
  EmptyState,
  RouteErrorBoundary,
} from "~/components/ui";
import { formatCurrency } from "~/lib/utils";
import { InstantSearch } from "~/components/search/InstantSearch";
import { LocationAutocomplete } from "~/components/search/LocationAutocomplete";
import { useTranslation } from "react-i18next";
import { AppNav } from "~/components/layout/AppNav";

export const meta: MetaFunction = () => [
  { title: "GharBatai Rentals - Rent Anything, Anywhere" },
  {
    name: "description",
    content: "Rent anything, anytime, anywhere - Spaces, Vehicles, Instruments, Event Venues & more",
  },
];

const safeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const safeText = (value: unknown, fallback = ""): string => {
  const text = typeof value === "string" ? value : "";
  return text || fallback;
};

export async function clientLoader() {
  const normalizeListings = (items: unknown): Listing[] =>
    Array.isArray(items) ? (items.filter(Boolean).slice(0, 8) as Listing[]) : [];

  try {
    const featuredListings = await listingsApi.getFeaturedListings();
    return { featuredListings: normalizeListings(featuredListings) };
  } catch {
    try {
      const { listings } = await listingsApi.searchListings({ limit: 8 });
      return { featuredListings: normalizeListings(listings) };
    } catch {
      return { featuredListings: [] };
    }
  }
}

const CATEGORY_KEYS = [
  { id: "SPACES", icon: HomeIcon },
  { id: "VEHICLES", icon: Car },
  { id: "INSTRUMENTS", icon: Music },
  { id: "EVENT_VENUES", icon: PartyPopper },
  { id: "OFFICE", icon: Building2 },
  { id: "WEARABLES", icon: Shirt },
  { id: "SPORTS", icon: Dumbbell },
  { id: "ELECTRONICS", icon: Camera },
  { id: "EQUIPMENT", icon: Wrench },
  { id: "PARKING", icon: ParkingSquare },
  { id: "STORAGE", icon: Package },
];

export default function Home() {
  const { user } = useAuthStore();
  const { featuredListings } = useLoaderData<typeof clientLoader>();
  const navigation = useNavigation();
  const { t } = useTranslation();
  const [location, setLocation] = useState("");
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [locationCoords, setLocationCoords] = useState<{
    lat: number;
    lon: number;
  } | null>(null);

  // Pre-populate location from last saved search location
  useEffect(() => {
    if (location) return; // already set (e.g. user typed something)
    const saved = localStorage.getItem("lastSearchLocation");
    if (saved) setLocation(saved);
   
  }, []);

  const detectLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setLocationError(t("home.locationNotSupported"));
      return;
    }

    setLocationError("");
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = safeNumber(position.coords.latitude);
        const lon = safeNumber(position.coords.longitude);
        if (!(lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180)) {
          setLocationError(t("home.locationCouldNotRead"));
          setLocationLoading(false);
          return;
        }

        // Coordinates are enough for search; reverse geocoding is best-effort.
        setLocationCoords({ lat, lon });
        try {
          const { result } = await geoApi.reverse(
            lat,
            lon,
            navigator.language || "en"
          );

          const label = result?.shortLabel || result?.address?.locality || "";

          if (label) {
            setLocation(label);
            if (result?.provider === "fallback") {
              setLocationError(
                t("home.locationUnavailable")
              );
            }
          } else {
            // Reverse geocoding can legitimately return null in sparse areas.
            // Keep location usable for search with a stable fallback label.
            setLocation(t("home.nearMe"));
          }
          if (result?.provider !== "fallback") {
            setLocationError("");
          }
        } catch (error) {
          // Keep coordinates and allow search even if label lookup fails.
          setLocation(t("home.nearMe"));
          setLocationError("");
        } finally {
          setLocationLoading(false);
        }
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError(t("home.locationDenied"));
        } else if (error.code === error.TIMEOUT) {
          setLocationError(t("home.locationTimeout"));
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setLocationError(t("home.locationPositionUnavailable"));
        } else {
          setLocationError(t("home.locationFailed"));
        }
        setLocationLoading(false);
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000, // Cache for 5 minutes
      }
    );
  }, []);

  const buildSearchUrl = useCallback(
    (query: string) => {
      const params = new URLSearchParams();
      if (query) params.set("query", query);
      if (location) params.set("location", location);
      if (locationCoords) {
        const lat = safeNumber(locationCoords.lat);
        const lon = safeNumber(locationCoords.lon);
        if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
          params.set("lat", lat.toFixed(6));
          params.set("lng", lon.toFixed(6));
        }
        params.set("radius", "25");
      }
      const queryString = params.toString();
      return queryString ? `/search?${queryString}` : "/search";
    },
    [location, locationCoords]
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation — shared AppNav component (same as _app.tsx layout) */}
      <AppNav />

      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-b from-primary/5 to-background pt-16 pb-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-5xl font-extrabold tracking-tight text-foreground sm:text-6xl">
              {user ? (
                <>
                  {t("home.heroTitleUser")} <span className="text-primary">{user.firstName}</span>
                </>
              ) : (
                <>
                  {t("home.heroTitle")}
                  <span className="text-primary block sm:inline"> {t("home.heroTitleHighlight")}</span>
                </>
              )}
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted-foreground max-w-2xl mx-auto">
              {user 
                ? t("home.heroSubtitleUser")
                : t("home.heroSubtitle")}
            </p>

            {/* Advanced Search Bar */}
            <div className="mt-10 max-w-3xl mx-auto">
              <div className="bg-card border border-border rounded-2xl shadow-xl p-2">
                <div className="flex flex-col md:flex-row gap-2">
                  <div className="flex-1">
                    <InstantSearch
                      placeholder={t("home.searchPlaceholder")}
                      className="w-full"
                      getSearchUrl={buildSearchUrl}
                    />
                  </div>
                  <div className="flex-1 relative">
                    <LocationAutocomplete
                      value={location}
                      onChange={(value) => {
                        setLocation(value);
                        setLocationError("");
                        if (!value) {
                          setLocationCoords(null);
                        }
                      }}
                      onSelect={(suggestion) => {
                        setLocation(suggestion.shortLabel);
                        setLocationCoords({
                          lat: suggestion.coordinates.lat,
                          lon: suggestion.coordinates.lon,
                        });
                        setLocationError("");
                      }}
                      placeholder={t("home.locationPlaceholder")}
                      inputClassName="pr-36"
                      bias={locationCoords || undefined}
                      biasZoom={10}
                      biasScale={0.8}
                      layer="city"
                    />
                    <button
                      type="button"
                      onClick={detectLocation}
                      disabled={locationLoading}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-muted disabled:opacity-60"
                      aria-label={t("home.useMyLocation")}
                    >
                      {locationLoading ? t("home.locating") : t("home.useMyLocation")}
                    </button>
                  </div>
                </div>
                {locationError && (
                  <p
                    className="mt-3 text-sm text-muted-foreground"
                    role="alert"
                    aria-live="polite"
                  >
                    {locationError}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Social proof trust strip — only for unauthenticated visitors */}
      {!user && <div className="border-y border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-success shrink-0" />
              <span><strong className="text-foreground">10,000+</strong> {t("home.trust.itemsRented", "items rented")}</span>
            </span>
            <span className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary shrink-0" />
              <span><strong className="text-foreground">500+</strong> {t("home.trust.verifiedOwners", "verified owners")}</span>
            </span>
            <span className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500 shrink-0" />
              <span><strong className="text-foreground">4.9★</strong> {t("home.trust.avgRating", "avg. rating")}</span>
            </span>
            <span className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary shrink-0" />
              <span>{t("home.trust.securePayments", "Secure, insured payments")}</span>
            </span>
          </div>
        </div>
      </div>}
      {/* End trust strip */}

      {/* Logged in Quick Links */}
      {user && (
        <section className="py-8 bg-primary/5 border-b border-primary/10">
          <div className="container mx-auto px-4">
            <div className="flex flex-wrap items-center justify-center gap-4">
              <span className="text-sm font-medium text-muted-foreground mr-2">{t("home.quickAccess")}</span>
              <Link
                to="/dashboard"
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-background border border-border hover:border-primary/50 text-sm font-medium transition-all shadow-sm"
              >
                <LayoutDashboard className="h-4 w-4 text-primary" />
                {t("nav.dashboard")}
              </Link>
              <Link
                to="/bookings"
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-background border border-border hover:border-primary/50 text-sm font-medium transition-all shadow-sm"
              >
                <Calendar className="h-4 w-4 text-primary" />
                {t("bookings.title")}
              </Link>
              <Link
                to="/messages"
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-background border border-border hover:border-primary/50 text-sm font-medium transition-all shadow-sm"
              >
                <MessageSquare className="h-4 w-4 text-primary" />
                {t("nav.messages")}
              </Link>
              <Link
                to="/favorites"
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-background border border-border hover:border-primary/50 text-sm font-medium transition-all shadow-sm"
              >
                <Heart className="h-4 w-4 text-primary" />
                {t("favorites.title")}
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Browse by Category */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-foreground text-center mb-10">
            {t("home.browseByCategory")}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {CATEGORY_KEYS.map((category) => (
              <Link
                key={category.id}
                to={`/search?category=${category.id}${location ? `&location=${encodeURIComponent(location)}` : ""}`}
                className="group flex flex-col items-center p-6 rounded-2xl border border-border bg-card hover:border-primary/50 hover:shadow-lg transition-all"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <category.icon className="h-7 w-7" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">
                  {t(`home.categories.${category.id}`)}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground text-center">
                  {t(`home.categories.${category.id}_DESC`)}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Listings */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-foreground">
              {t("home.featuredListings")}
            </h2>
            <Link
              to="/search"
              className="text-sm font-medium text-primary hover:underline"
            >
              {t("home.viewAll")}
            </Link>
          </div>
          
          {/* Loading state */}
          {navigation.state === "loading" && (
            <CardGridSkeleton count={8} />
          )}
          
          {/* Empty state */}
          {navigation.state !== "loading" && featuredListings.length === 0 && (
            <EmptyState
              icon="🏠"
              title={t("home.noListingsYet")}
              description={t("home.noListingsDesc")}
              action={{ label: t("home.createListing"), href: "/listings/new" }}
            />
          )}
          
          {/* Listings grid */}
          {navigation.state !== "loading" && featuredListings.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredListings.slice(0, 8).map((listing: Listing) => {
                const listingId = safeText(listing.id);
                const listingTitle = safeText(listing.title, "Listing");
                const ratingValue = listing.rating;
                const reviewCount = listing.totalReviews;
                const basePrice = listing.basePrice ?? listing.basePrice ?? 0;
                const city = listing.location?.city;

                return (
                <Link
                  key={listing.id}
                  to={listingId ? `/listings/${listingId}` : "/listings"}
                  className="group bg-card rounded-xl border border-border overflow-hidden hover:shadow-lg transition-shadow"
                >
                  <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                    {listing.photos?.[0] ? (
                      <img
                        src={listing.photos[0]}
                        alt={listingTitle}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        {t("home.noImage")}
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                      {listingTitle}
                    </h3>
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm text-muted-foreground">
                        {ratingValue != null ? safeNumber(ratingValue).toFixed(1) : t("home.new")}
                        {reviewCount ? ` (${reviewCount})` : ""}
                      </span>
                    </div>
                    <p className="text-primary font-semibold mt-2">
                      {formatCurrency(basePrice)}{t("common.perDay")}
                    </p>
                    {city && (
                      <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {city}
                      </p>
                    )}
                  </div>
                </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* How It Works — only for unauthenticated visitors */}
      {!user && <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-foreground text-center mb-4">
            {t("home.howItWorks")}
          </h2>
          <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-12">
            {t("home.howItWorksDesc")}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mx-auto mb-4">
                <Search className="h-8 w-8" />
              </div>
              <div className="text-4xl font-bold text-primary mb-2">1</div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{t("home.stepSearch")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("home.stepSearchDesc")}
              </p>
            </div>
            <div className="text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mx-auto mb-4">
                <CreditCard className="h-8 w-8" />
              </div>
              <div className="text-4xl font-bold text-primary mb-2">2</div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{t("home.stepBook")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("home.stepBookDesc")}
              </p>
            </div>
            <div className="text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mx-auto mb-4">
                <CheckCircle className="h-8 w-8" />
              </div>
              <div className="text-4xl font-bold text-primary mb-2">3</div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{t("home.stepEnjoy")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("home.stepEnjoyDesc")}
              </p>
            </div>
          </div>
        </div>
      </section>}
      {/* End How It Works */}

      {/* Trust Section — only for unauthenticated visitors */}
      {!user && <section className="py-16 bg-muted/30 border-t border-border">
        <div className="container mx-auto px-4">
          <h2 className="text-xl font-semibold text-foreground text-center mb-8">
            {t("home.whyChoose")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="flex items-start gap-4">
              <Shield className="h-8 w-8 text-primary flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-foreground">{t("home.verifiedUsers")}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("home.verifiedUsersDesc")}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <CreditCard className="h-8 w-8 text-primary flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-foreground">{t("home.securePayments")}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("home.securePaymentsDesc")}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <Star className="h-8 w-8 text-primary flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-foreground">{t("home.ratedReviews")}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("home.ratedReviewsDesc")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>}
      {/* End Trust Section */}

      {/* Footer */}
      <footer className="bg-card border-t border-border py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="font-semibold text-foreground mb-4">GharBatai</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/about" className="hover:text-primary">{t("footer.about")}</Link></li>
                <li><Link to="/careers" className="hover:text-primary">{t("footer.careers")}</Link></li>
                <li><Link to="/press" className="hover:text-primary">{t("footer.press")}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Renters</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/search" className="hover:text-primary">{t("home.browseListings")}</Link></li>
                <li><Link to="/how-it-works" className="hover:text-primary">{t("nav.howItWorks")}</Link></li>
                <li><Link to="/insurance" className="hover:text-primary">{t("footer.insurance")}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Owners</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/listings/new" className="hover:text-primary">{t("home.listYourItem")}</Link></li>
                <li><Link to="/owner-guide" className="hover:text-primary">{t("home.ownerGuide")}</Link></li>
                <li><Link to="/earnings" className="hover:text-primary">{t("dashboard.earnings")}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/help" className="hover:text-primary">{t("footer.help")}</Link></li>
                <li><Link to="/contact" className="hover:text-primary">{t("home.contactUs")}</Link></li>
                <li><Link to="/safety" className="hover:text-primary">{t("footer.safety")}</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              {t("footer.copyright", { year: 2026 })}
            </p>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link to="/terms" className="hover:text-primary">{t("footer.terms")}</Link>
              <Link to="/privacy" className="hover:text-primary">{t("footer.privacy")}</Link>
              <Link to="/cookies" className="hover:text-primary">{t("footer.cookies")}</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Dev User Switcher */}
      <DevUserSwitcher />
    </div>
  );
}
// Error boundary for route errors
export { RouteErrorBoundary as ErrorBoundary };

