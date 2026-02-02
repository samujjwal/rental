/* eslint-disable react-refresh/only-export-components */

import type { MetaFunction } from "react-router";
import { Link, Form, useLoaderData, useNavigation } from "react-router";
import { useAuthStore } from "~/lib/store/auth";
import { DevUserSwitcher } from "~/components/DevUserSwitcher";
import { listingsApi } from "~/lib/api/listings";
import type { Listing } from "~/types/listing";
import { useState, useEffect, useCallback } from "react";
import {
  Home as HomeIcon,
  Car,
  Music,
  PartyPopper,
  Armchair,
  Shirt,
  Search,
  Star,
  MapPin,
  Shield,
  CreditCard,
  CheckCircle,
  Loader2,
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

export const meta: MetaFunction = () => [
  { title: "GharBatai Rentals - Rent Anything, Anywhere" },
  {
    name: "description",
    content: "Rent anything, anytime, anywhere - Spaces, Vehicles, Instruments, Event Venues & more",
  },
];

export async function clientLoader() {
  try {
    const { listings: featuredListings } = await listingsApi.searchListings({
      limit: 8,
    });
    return { featuredListings };
  } catch {
    return { featuredListings: [] };
  }
}

const CATEGORIES = [
  { id: "SPACES", name: "Spaces", icon: HomeIcon, description: "Rooms, houses, apartments" },
  { id: "VEHICLES", name: "Vehicles", icon: Car, description: "Cars, bikes, scooters" },
  { id: "INSTRUMENTS", name: "Instruments", icon: Music, description: "Musical gear & accessories" },
  { id: "EVENT_VENUES", name: "Event Venues", icon: PartyPopper, description: "Halls, stages, outdoors" },
  { id: "EVENT_ITEMS", name: "Event Items", icon: Armchair, description: "Chairs, tables, tents" },
  { id: "WEARABLES", name: "Wearables", icon: Shirt, description: "Dresses, suits, costumes" },
];

export default function Home() {
  const { user } = useAuthStore();
  const { featuredListings } = useLoaderData<typeof clientLoader>();
  const navigation = useNavigation();
  const [location, setLocation] = useState("");
  const [locationLoading, setLocationLoading] = useState(false);

  const detectLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      return;
    }

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          // Use reverse geocoding to get city name
          // Using OpenStreetMap's Nominatim API (free, no API key required)
          const controller = new AbortController();
          const timeoutId = window.setTimeout(() => controller.abort(), 4000);
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${position.coords.latitude}&lon=${position.coords.longitude}&format=json&addressdetails=1`,
            {
              signal: controller.signal,
              headers: {
                Accept: "application/json",
                "Accept-Language": navigator.language || "en",
              },
            }
          ).finally(() => window.clearTimeout(timeoutId));
          const data = await response.json();
          
          // Extract city from the response
          const city = data.address?.city || 
                      data.address?.town || 
                      data.address?.village || 
                      data.address?.county ||
                      "";
          
          if (city) {
            setLocation(city);
          }
        } catch (error) {
          console.error('Error getting location:', error);
        } finally {
          setLocationLoading(false);
        }
      },
      (error) => {
        console.error('Error detecting location:', error);
        setLocationLoading(false);
      },
      {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 300000, // Cache for 5 minutes
      }
    );
  }, []);

  useEffect(() => {
    // Auto-detect location on component mount
    detectLocation();
  }, [detectLocation]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="text-lg font-bold">G</span>
            </div>
            <span className="text-xl font-bold tracking-tight">
              GharBatai
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <Link
              to="/search"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              Browse
            </Link>
            <Link
              to="/listings/new"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              List Your Item
            </Link>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                <Link
                  to="/dashboard"
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                >
                  Dashboard
                </Link>
                <Link 
                  to={user.role === "admin" ? "/admin" : `/profile/${user.id}`}
                  className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold overflow-hidden border border-border hover:border-primary/50 transition-colors"
                >
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.firstName} className="h-full w-full object-cover" />
                  ) : (
                    <span>{user.firstName[0]}</span>
                  )}
                </Link>
              </div>
            ) : (
              <>
                <Link
                  to="/auth/login"
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                >
                  Log in
                </Link>
                <Link
                  to="/auth/signup"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 hover:shadow-md"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-b from-primary/5 to-background pt-16 pb-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-5xl font-extrabold tracking-tight text-foreground sm:text-6xl">
              {user ? (
                <>
                  Welcome back, <span className="text-primary">{user.firstName}</span>
                </>
              ) : (
                <>
                  Rent Anything,
                  <span className="text-primary block sm:inline"> Anywhere</span>
                </>
              )}
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted-foreground max-w-2xl mx-auto">
              {user 
                ? "Ready to find your next rental? Explore thousands of items available in your community."
                : "From spaces to vehicles, instruments to event items. Connect with people in your community to rent what you need, when you need it."}
            </p>

            {/* Advanced Search Bar */}
            <div className="mt-10 max-w-3xl mx-auto">
              <Form
                action="/search"
                method="get"
                className="bg-card border border-border rounded-2xl shadow-xl p-2"
              >
                <div className="flex flex-col md:flex-row gap-2">
                  <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <input
                      type="text"
                      name="q"
                      placeholder="What are you looking for?"
                      className="w-full rounded-xl border-0 bg-muted/50 pl-12 pr-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div className="flex-1 relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    {locationLoading && (
                      <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
                    )}
                    <input
                      type="text"
                      name="location"
                      placeholder="Location"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full rounded-xl border-0 bg-muted/50 pl-12 pr-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <button
                    type="submit"
                    className="flex items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
                  >
                    <Search className="h-5 w-5" />
                    Search
                  </button>
                </div>
              </Form>
            </div>
          </div>
        </div>
      </div>

      {/* Logged in Quick Links */}
      {user && (
        <section className="py-8 bg-primary/5 border-b border-primary/10">
          <div className="container mx-auto px-4">
            <div className="flex flex-wrap items-center justify-center gap-4">
              <span className="text-sm font-medium text-muted-foreground mr-2">Quick Access:</span>
              <Link
                to="/dashboard"
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-background border border-border hover:border-primary/50 text-sm font-medium transition-all shadow-sm"
              >
                <LayoutDashboard className="h-4 w-4 text-primary" />
                Dashboard
              </Link>
              <Link
                to="/bookings"
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-background border border-border hover:border-primary/50 text-sm font-medium transition-all shadow-sm"
              >
                <Calendar className="h-4 w-4 text-primary" />
                My Bookings
              </Link>
              <Link
                to="/messages"
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-background border border-border hover:border-primary/50 text-sm font-medium transition-all shadow-sm"
              >
                <MessageSquare className="h-4 w-4 text-primary" />
                Messages
              </Link>
              <Link
                to="/favorites"
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-background border border-border hover:border-primary/50 text-sm font-medium transition-all shadow-sm"
              >
                <Heart className="h-4 w-4 text-primary" />
                Favorites
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Browse by Category */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-foreground text-center mb-10">
            Browse by Category
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {CATEGORIES.map((category) => (
              <Link
                key={category.id}
                to={`/search?category=${category.id}`}
                className="group flex flex-col items-center p-6 rounded-2xl border border-border bg-card hover:border-primary/50 hover:shadow-lg transition-all"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <category.icon className="h-7 w-7" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">
                  {category.name}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground text-center">
                  {category.description}
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
              Featured Listings
            </h2>
            <Link
              to="/search"
              className="text-sm font-medium text-primary hover:underline"
            >
              View all →
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
              title="No listings yet"
              description="Be the first to list your items and start earning!"
              action={{ label: "Create Listing", href: "/listings/new" }}
            />
          )}
          
          {/* Listings grid */}
          {navigation.state !== "loading" && featuredListings.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredListings.slice(0, 8).map((listing: Listing) => {
                const ratingValue = listing.rating ?? listing.averageRating;
                const reviewCount = listing.reviewCount ?? listing.totalReviews;
                const pricePerDay = listing.pricePerDay ?? listing.basePrice ?? 0;
                const city = listing.location?.city;

                return (
                <Link
                  key={listing.id}
                  to={`/listings/${listing.id}`}
                  className="group bg-card rounded-xl border border-border overflow-hidden hover:shadow-lg transition-shadow"
                >
                  <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                    {listing.images?.[0] ? (
                      <img
                        src={listing.images[0]}
                        alt={listing.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                      {listing.title}
                    </h3>
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm text-muted-foreground">
                        {ratingValue != null ? ratingValue.toFixed(1) : "New"}
                        {reviewCount ? ` (${reviewCount})` : ""}
                      </span>
                    </div>
                    <p className="text-primary font-semibold mt-2">
                      ${pricePerDay}/day
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

      {/* How It Works */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-foreground text-center mb-4">
            How It Works
          </h2>
          <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-12">
            Getting started is easy. Follow these simple steps to rent what you need.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mx-auto mb-4">
                <Search className="h-8 w-8" />
              </div>
              <div className="text-4xl font-bold text-primary mb-2">1</div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Search</h3>
              <p className="text-sm text-muted-foreground">
                Find what you need by browsing categories or searching by keyword
              </p>
            </div>
            <div className="text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mx-auto mb-4">
                <CreditCard className="h-8 w-8" />
              </div>
              <div className="text-4xl font-bold text-primary mb-2">2</div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Book</h3>
              <p className="text-sm text-muted-foreground">
                Select your dates and complete secure payment through our platform
              </p>
            </div>
            <div className="text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mx-auto mb-4">
                <CheckCircle className="h-8 w-8" />
              </div>
              <div className="text-4xl font-bold text-primary mb-2">3</div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Enjoy</h3>
              <p className="text-sm text-muted-foreground">
                Pick up your rental and enjoy! Return when your booking ends
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-16 bg-muted/30 border-t border-border">
        <div className="container mx-auto px-4">
          <h2 className="text-xl font-semibold text-foreground text-center mb-8">
            Why Choose GharBatai?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="flex items-start gap-4">
              <Shield className="h-8 w-8 text-primary flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-foreground">Verified Users</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  All users go through verification for safe transactions
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <CreditCard className="h-8 w-8 text-primary flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-foreground">Secure Payments</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Protected payments with deposit handling and insurance options
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <Star className="h-8 w-8 text-primary flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-foreground">Rated Reviews</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Real reviews from real renters help you make informed decisions
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="font-semibold text-foreground mb-4">GharBatai</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/about" className="hover:text-primary">About Us</Link></li>
                <li><Link to="/careers" className="hover:text-primary">Careers</Link></li>
                <li><Link to="/press" className="hover:text-primary">Press</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Renters</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/search" className="hover:text-primary">Browse Listings</Link></li>
                <li><Link to="/how-it-works" className="hover:text-primary">How It Works</Link></li>
                <li><Link to="/insurance" className="hover:text-primary">Insurance</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Owners</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/listings/new" className="hover:text-primary">List Your Item</Link></li>
                <li><Link to="/owner-guide" className="hover:text-primary">Owner Guide</Link></li>
                <li><Link to="/earnings" className="hover:text-primary">Earnings</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/help" className="hover:text-primary">Help Center</Link></li>
                <li><Link to="/contact" className="hover:text-primary">Contact Us</Link></li>
                <li><Link to="/safety" className="hover:text-primary">Safety</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © 2026 GharBatai Rentals. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link to="/terms" className="hover:text-primary">Terms</Link>
              <Link to="/privacy" className="hover:text-primary">Privacy</Link>
              <Link to="/cookies" className="hover:text-primary">Cookies</Link>
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
