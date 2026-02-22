import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link, useRevalidator, redirect } from "react-router";
import { useState } from "react";
import { MapPin, Star, AlertCircle } from "lucide-react";
import { organizationsApi, type Organization } from "~/lib/api/organizations";
import { UnifiedButton, Badge, PageSkeleton } from "~/components/ui";
import { RouteErrorBoundary } from "~/components/ui/error-state";
import { getUser } from "~/utils/auth";

export const ErrorBoundary = RouteErrorBoundary;

export const meta: MetaFunction = () => {
  return [
    { title: "Organization Listings | GharBatai Rentals" },
    { name: "description", content: "Manage organization listings" },
  ];
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value: string | undefined): value is string =>
  Boolean(value && UUID_PATTERN.test(value));
const humanizeStatus = (value: unknown): string =>
  String(value || "unknown").toLowerCase().replace(/_/g, " ");
const safeText = (value: unknown, fallback = ""): string => {
  const text = typeof value === "string" ? value : "";
  return text || fallback;
};

export async function clientLoader({ params, request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  if (!user) {
    return redirect("/auth/login");
  }

  const organizationId = params.id;
  if (!isUuid(organizationId)) {
    return redirect("/organizations");
  }

  try {
    if (user.role !== "admin") {
      const { organizations } = await organizationsApi.getMyOrganizations();
      const hasAccess = organizations.some((org) => org.id === organizationId);
      if (!hasAccess) {
        return redirect("/organizations");
      }
    }

    const organization = await organizationsApi.getOrganization(organizationId);
    return { organization, error: null };
  } catch (error: unknown) {
    return {
      organization: null,
      error:
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: string }).message)
          : "Failed to load organization",
    };
  }
}

const STATUS_BADGE: Record<string, string> = {
  AVAILABLE: "bg-success/10 text-success",
  RENTED: "bg-info/10 text-info",
  MAINTENANCE: "bg-warning/10 text-warning",
  UNAVAILABLE: "bg-muted text-muted-foreground",
  DRAFT: "bg-muted text-muted-foreground",
  SUSPENDED: "bg-destructive/10 text-destructive",
  ARCHIVED: "bg-muted text-muted-foreground",
};
const LISTING_STATUS_FILTERS = [
  "AVAILABLE",
  "RENTED",
  "MAINTENANCE",
  "UNAVAILABLE",
  "DRAFT",
  "SUSPENDED",
  "ARCHIVED",
] as const;
const LISTING_STATUS_SET = new Set<string>(LISTING_STATUS_FILTERS);

export default function OrganizationListingsPage() {
  const { organization, error } = useLoaderData<typeof clientLoader>() as {
    organization: Organization | null;
    error: string | null;
  };
  const revalidator = useRevalidator();
  const [filter, setFilter] = useState<string>("");

  if (error || !organization) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-destructive" />
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Unable to load listings
            </h1>
            <p className="text-muted-foreground mb-6">{error}</p>
            <UnifiedButton onClick={() => revalidator.revalidate()}>
              Try Again
            </UnifiedButton>
          </div>
        </div>
      </div>
    );
  }

  const listings = organization.listings || [];
  const normalizedFilter = LISTING_STATUS_SET.has(filter) ? filter : "";
  const filtered = normalizedFilter
    ? listings.filter((listing) => listing.status === filter)
    : listings;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <Link
                to={`/organizations/${organization.id}/settings`}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                ← Back to Organization
              </Link>
              <h1 className="text-2xl font-bold text-foreground mt-2">
                {organization.name} Listings
              </h1>
              <p className="text-sm text-muted-foreground">
                {listings.length} total listings
              </p>
            </div>
            <Link to="/listings/new">
              <UnifiedButton>Add Listing</UnifiedButton>
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <UnifiedButton
            variant={!normalizedFilter ? "primary" : "outline"}
            size="sm"
            onClick={() => setFilter("")}
          >
            All
          </UnifiedButton>
          {LISTING_STATUS_FILTERS.map((status) => (
            <UnifiedButton
              key={status}
              variant={normalizedFilter === status ? "primary" : "outline"}
              size="sm"
              onClick={() => setFilter(status)}
            >
              {humanizeStatus(status)}
            </UnifiedButton>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-card border rounded-lg">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold text-foreground mb-2">
              No listings to show
            </h2>
            <p className="text-muted-foreground mb-6">
              Try adjusting your filters or add a new listing.
            </p>
            <Link to="/listings/new">
              <UnifiedButton>Create Listing</UnifiedButton>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((listing) => (
              (() => {
                const listingId = safeText(listing.id);
                const listingTitle = safeText(listing.title, "Listing");
                const listingCity = safeText(listing.city) || safeText(organization.city) || "Location";
                const listingState = safeText(listing.state) || safeText(organization.state);
                return (
              <div
                key={listing.id}
                className="bg-card border rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
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
                  <div className="absolute top-2 left-2">
                    <Badge className={STATUS_BADGE[listing.status] || "bg-gray-100 text-gray-800"}>
                      {String(listing.status || "UNKNOWN")}
                    </Badge>
                  </div>
                </div>
                <div className="p-4">
                  <Link to={listingId ? `/listings/${listingId}` : "/listings"}>
                    <h3 className="font-semibold text-foreground line-clamp-1 hover:text-primary">
                      {listingTitle}
                    </h3>
                  </Link>
                  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    <span>
                      {listingCity}
                      {listingState ? `, ${listingState}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span>—</span>
                    </div>
                    <div className="font-semibold text-foreground">
                      ${listing.basePrice}
                      <span className="text-sm text-muted-foreground font-normal">/day</span>
                    </div>
                  </div>
                </div>
              </div>
                );
              })()
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

