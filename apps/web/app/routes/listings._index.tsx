import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, useSearchParams, useRevalidator, useActionData, Form, useNavigation } from "react-router";
import { redirect } from "react-router";
import { useEffect, useState } from "react";
import {
  Plus,
  Search,
  Grid,
  List,
  Edit,
  Trash2,
  Eye,
  MoreVertical,
  MapPin,
  Star,
  TrendingUp,
  AlertCircle,
  Clock,
  CheckCircle,
  Pause,
} from "lucide-react";
import { listingsApi } from "~/lib/api/listings";
import { UnifiedButton, Badge, RouteErrorBoundary } from "~/components/ui";
import { getUser } from "~/utils/auth";

export const meta: MetaFunction = () => {
  return [
    { title: "My Listings | GharBatai Rentals" },
    { name: "description", content: "Manage your rental listings" },
  ];
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value: string): boolean => UUID_PATTERN.test(value);
const MAX_SEARCH_LENGTH = 100;
const safeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const safeText = (value: unknown): string =>
  typeof value === "string" ? value : "";
const safeLower = (value: unknown): string => safeText(value).toLowerCase();

const ListingThumbnail = ({
  src,
  alt,
  size = "full",
}: {
  src?: string;
  alt: string;
  size?: "full" | "small";
}) => {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={size === "full" ? "w-full h-full object-cover" : "w-12 h-12 rounded object-cover"}
      />
    );
  }

  return (
    <div
      className={
        size === "full"
          ? "w-full h-full bg-muted flex items-center justify-center text-sm font-semibold text-foreground"
          : "w-12 h-12 rounded bg-muted flex items-center justify-center text-sm font-semibold text-foreground"
      }
    >
      {alt?.[0] || "L"}
    </div>
  );
};

interface OwnerListing {
  id: string;
  title: string;
  description: string;
  images: string[];
  status:
    | "AVAILABLE"
    | "RENTED"
    | "MAINTENANCE"
    | "UNAVAILABLE"
    | "DRAFT"
    | "SUSPENDED"
    | "ARCHIVED";
  basePrice: number;
  currency: string;
  location: {
    city: string;
    state: string;
  };
  averageRating: number | null;
  reviewCount: number;
  bookingsCount: number;
  totalEarnings: number;
  category: {
    name: string;
  };
  createdAt: string;
  lastBookingAt?: string | null;
  instantBooking: boolean;
  deliveryAvailable?: boolean;
}

export async function clientLoader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  if (!user) {
    return redirect("/auth/login");
  }
  if (user.role !== "owner" && user.role !== "admin") {
    return redirect("/dashboard/renter");
  }

  const url = new URL(request.url);
  const rawStatus = url.searchParams.get("status");
  const allowedStatuses = new Set([
    "AVAILABLE",
    "RENTED",
    "MAINTENANCE",
    "UNAVAILABLE",
    "DRAFT",
    "SUSPENDED",
    "ARCHIVED",
  ]);
  const status = rawStatus && allowedStatuses.has(rawStatus) ? rawStatus : undefined;
  const search = url.searchParams.get("search")?.trim().slice(0, 100) || undefined;

  try {
    const listings = (await listingsApi.getMyListings()) as OwnerListing[];
    
    // Filter listings based on params
    let filteredListings: OwnerListing[] = listings;
    if (status) {
      filteredListings = listings.filter((l) => l.status === status);
    }
    if (search) {
      const searchLower = search.toLowerCase();
      filteredListings = filteredListings.filter((l) =>
        safeLower(l.title).includes(searchLower) ||
        safeLower(l.description).includes(searchLower)
      );
    }

    // Calculate stats
    const stats = {
      total: listings.length,
      active: listings.filter((l) => l.status === "AVAILABLE").length,
      rented: listings.filter((l) => l.status === "RENTED").length,
      draft: listings.filter((l) => l.status === "DRAFT").length,
      unavailable: listings.filter((l) => l.status === "UNAVAILABLE").length,
      totalEarnings: listings.reduce((sum, l) => sum + safeNumber(l.totalEarnings), 0),
      totalBookings: listings.reduce((sum, l) => sum + safeNumber(l.bookingsCount), 0),
    };

    return {
      listings: filteredListings,
      total: filteredListings.length,
      stats,
      error: null,
    };
  } catch (error) {
    console.error("Failed to load listings:", error);
    return {
      listings: [],
      total: 0,
      stats: { total: 0, active: 0, rented: 0, draft: 0, unavailable: 0, totalEarnings: 0, totalBookings: 0 },
      error: "Failed to load listings",
    };
  }
}

export async function clientAction({ request }: ActionFunctionArgs) {
  const user = await getUser(request);
  if (!user) {
    return redirect("/auth/login");
  }
  if (user.role !== "owner" && user.role !== "admin") {
    return { success: false, message: "Unauthorized action." };
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const listingId = String(formData.get("listingId") || "").trim();
  const allowedIntents = new Set(["delete", "pause", "activate", "publish"]);

  if (!listingId || !isUuid(listingId)) {
    return { success: false, message: "Listing ID is required." };
  }
  if (!allowedIntents.has(intent)) {
    return { success: false, message: "Unknown action." };
  }

  if (user.role !== "admin") {
    try {
      const listing = await listingsApi.getListingById(listingId);
      if (listing.ownerId !== user.id) {
        return { success: false, message: "You do not own this listing." };
      }
    } catch {
      return { success: false, message: "Listing not found." };
    }
  }

  try {
    if (intent === "delete") {
      const confirmed = String(formData.get("confirmed") || "") === "true";
      if (!confirmed) {
        return { success: false, message: "Delete confirmation is required." };
      }
      await listingsApi.deleteListing(listingId);
      return { success: true, message: "Listing deleted." };
    }
    if (intent === "pause") {
      await listingsApi.pauseListing(listingId);
      return { success: true, message: "Listing paused." };
    }
    if (intent === "activate") {
      await listingsApi.activateListing(listingId);
      return { success: true, message: "Listing activated." };
    }
    if (intent === "publish") {
      await listingsApi.publishListing(listingId);
      return { success: true, message: "Listing submitted for review." };
    }
    return { success: false, message: "Unknown action." };
  } catch (error: unknown) {
    return {
      success: false,
      message:
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: string }).message)
          : "Action failed.",
    };
  }
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  AVAILABLE: { label: "Available", color: "bg-green-100 text-green-800", icon: CheckCircle },
  RENTED: { label: "Rented", color: "bg-blue-100 text-blue-800", icon: Clock },
  MAINTENANCE: { label: "Maintenance", color: "bg-yellow-100 text-yellow-800", icon: AlertCircle },
  DRAFT: { label: "Draft", color: "bg-gray-100 text-gray-800", icon: Edit },
  UNAVAILABLE: { label: "Unavailable", color: "bg-orange-100 text-orange-800", icon: Pause },
  SUSPENDED: { label: "Suspended", color: "bg-red-100 text-red-800", icon: AlertCircle },
  ARCHIVED: { label: "Archived", color: "bg-slate-100 text-slate-800", icon: Pause },
};

export default function OwnerListingsPage() {
  const { listings, stats, error } = useLoaderData<typeof clientLoader>();
  const actionData = useActionData<typeof clientAction>();
  const revalidator = useRevalidator();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showActions, setShowActions] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const isSubmitting = navigation.state === "submitting";

  useEffect(() => {
    if (actionData?.success) {
      revalidator.revalidate();
      setConfirmingId(null);
    }
  }, [actionData, revalidator]);

  const currentStatus = searchParams.get("status");
  const currentSearch = searchParams.get("search") || "";

  const handleStatusFilter = (status: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (status) {
      params.set("status", status);
    } else {
      params.delete("status");
    }
    setSearchParams(params);
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const search = String(formData.get("search") || "")
      .trim()
      .slice(0, MAX_SEARCH_LENGTH);
    const params = new URLSearchParams(searchParams);
    if (search) {
      params.set("search", search);
    } else {
      params.delete("search");
    }
    setSearchParams(params);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-destructive" />
            <h1 className="text-2xl font-bold text-foreground mb-2">Unable to load listings</h1>
            <p className="text-muted-foreground mb-6">{error}</p>
            <UnifiedButton onClick={() => revalidator.revalidate()}>Try Again</UnifiedButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">My Listings</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Manage and track all your rental items
              </p>
            </div>
            <Link to="/listings/new">
              <UnifiedButton>
                <Plus className="w-4 h-4 mr-2" />
                Add Listing
              </UnifiedButton>
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {actionData?.message && (
          <div
            className={`mb-6 rounded-lg px-4 py-3 text-sm ${
              actionData.success
                ? "bg-success/10 text-success"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            {actionData.message}
          </div>
        )}
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-card border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Total Listings</p>
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Active</p>
            <p className="text-2xl font-bold text-green-600">{stats.active}</p>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Currently Rented</p>
            <p className="text-2xl font-bold text-blue-600">{stats.rented}</p>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Drafts</p>
            <p className="text-2xl font-bold text-gray-600">{stats.draft}</p>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Unavailable</p>
            <p className="text-2xl font-bold text-orange-600">{stats.unavailable}</p>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Total Bookings</p>
            <p className="text-2xl font-bold text-foreground">{stats.totalBookings}</p>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Total Earnings</p>
            <p className="text-2xl font-bold text-foreground">
              ${safeNumber(stats.totalEarnings).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <UnifiedButton
              variant={!currentStatus ? "primary" : "outline"}
              size="sm"
              onClick={() => handleStatusFilter(null)}
            >
              All ({stats.total})
            </UnifiedButton>
            <UnifiedButton
              variant={currentStatus === "AVAILABLE" ? "primary" : "outline"}
              size="sm"
              onClick={() => handleStatusFilter("AVAILABLE")}
            >
              Available ({stats.active})
            </UnifiedButton>
            <UnifiedButton
              variant={currentStatus === "RENTED" ? "primary" : "outline"}
              size="sm"
              onClick={() => handleStatusFilter("RENTED")}
            >
              Rented ({stats.rented})
            </UnifiedButton>
            <UnifiedButton
              variant={currentStatus === "DRAFT" ? "primary" : "outline"}
              size="sm"
              onClick={() => handleStatusFilter("DRAFT")}
            >
              Drafts ({stats.draft})
            </UnifiedButton>
            <UnifiedButton
              variant={currentStatus === "UNAVAILABLE" ? "primary" : "outline"}
              size="sm"
              onClick={() => handleStatusFilter("UNAVAILABLE")}
            >
              Unavailable ({stats.unavailable})
            </UnifiedButton>
          </div>
          
          <div className="flex items-center gap-4 w-full md:w-auto">
            <form onSubmit={handleSearch} className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                name="search"
                defaultValue={currentSearch}
                maxLength={MAX_SEARCH_LENGTH}
                placeholder="Search listings..."
                className="w-full pl-10 pr-4 py-2 border border-input rounded-lg bg-background text-sm"
              />
            </form>
            <div className="flex items-center gap-1 border rounded-lg p-1">
              <UnifiedButton
                variant={viewMode === "grid" ? "primary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grid")}
              >
                <Grid className="w-4 h-4" />
              </UnifiedButton>
              <UnifiedButton
                variant={viewMode === "list" ? "primary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
              >
                <List className="w-4 h-4" />
              </UnifiedButton>
            </div>
          </div>
        </div>

        {/* Listings */}
        {listings.length === 0 ? (
          <div className="text-center py-16 bg-card border rounded-lg">
            <TrendingUp className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold text-foreground mb-2">
              {currentStatus || currentSearch ? "No listings match your filters" : "No listings yet"}
            </h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              {currentStatus || currentSearch
                ? "Try adjusting your filters or search terms"
                : "Start earning by listing your first item for rent"}
            </p>
            {!currentStatus && !currentSearch && (
              <Link to="/listings/new">
                <UnifiedButton>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Listing
                </UnifiedButton>
              </Link>
            )}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {listings.map((listing) => {
              const statusConfig = STATUS_CONFIG[listing.status || "DRAFT"] || STATUS_CONFIG.DRAFT;
              const StatusIcon = statusConfig.icon;
              const listingId = safeText(listing.id);
              const listingTitle = safeText(listing.title) || "Listing";
              
              return (
                <div
                  key={listing.id}
                  className="bg-card border rounded-lg overflow-hidden hover:shadow-lg transition-shadow group"
                >
                  <div className="relative aspect-[4/3]">
                    <Link to={listingId ? `/listings/${listingId}` : "/listings"}>
                      <ListingThumbnail src={listing.images?.[0]} alt={listingTitle} size="full" />
                    </Link>
                    <div className="absolute top-2 left-2">
                      <Badge className={statusConfig.color}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {statusConfig.label}
                      </Badge>
                    </div>
                    <div className="absolute top-2 right-2">
                      <div className="relative">
                        <button
                          onClick={() => setShowActions(showActions === listing.id ? null : listing.id)}
                          className="p-2 bg-white/90 rounded-full hover:bg-white transition-colors"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {showActions === listing.id && (
                          <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border py-1 min-w-32 z-10">
                            <Link
                              to={listingId ? `/listings/${listingId}` : "/listings"}
                              className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-100"
                            >
                              <Eye className="w-4 h-4" />
                              View
                            </Link>
                            <Link
                              to={listingId ? `/listings/${listingId}/edit` : "/listings"}
                              className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-100"
                            >
                              <Edit className="w-4 h-4" />
                              Edit
                            </Link>
                            <Form method="post" className="w-full">
                              <input type="hidden" name="listingId" value={listing.id} />
                              <input type="hidden" name="intent" value="delete" />
                              <input
                                type="hidden"
                                name="confirmed"
                                value={confirmingId === listing.id ? "true" : "false"}
                              />
                              <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full"
                                onClick={(event) => {
                                  if (confirmingId !== listing.id) {
                                    event.preventDefault();
                                    setConfirmingId(listing.id);
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                                {confirmingId === listing.id ? "Confirm delete" : "Delete"}
                              </button>
                            </Form>
                            {listing.status === "AVAILABLE" && (
                              <Form method="post" className="w-full">
                                <input type="hidden" name="listingId" value={listing.id} />
                                <input type="hidden" name="intent" value="pause" />
                                <button
                                  type="submit"
                                  disabled={isSubmitting}
                                  className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-100 w-full"
                                >
                                  <Pause className="w-4 h-4" />
                                  Pause
                                </button>
                              </Form>
                            )}
                            {listing.status === "UNAVAILABLE" && (
                              <Form method="post" className="w-full">
                                <input type="hidden" name="listingId" value={listing.id} />
                                <input type="hidden" name="intent" value="activate" />
                                <button
                                  type="submit"
                                  disabled={isSubmitting}
                                  className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-100 w-full"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  Activate
                                </button>
                              </Form>
                            )}
                            {listing.status === "DRAFT" && (
                              <Form method="post" className="w-full">
                                <input type="hidden" name="listingId" value={listing.id} />
                                <input type="hidden" name="intent" value="publish" />
                                <button
                                  type="submit"
                                  disabled={isSubmitting}
                                  className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-100 w-full"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  Publish
                                </button>
                              </Form>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <Link to={listingId ? `/listings/${listingId}` : "/listings"}>
                      <h3 className="font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                        {listingTitle}
                      </h3>
                    </Link>
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      <span>{listing.location?.city || "Location not set"}</span>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-medium">
                          {safeNumber(listing.averageRating) > 0
                            ? safeNumber(listing.averageRating).toFixed(1)
                            : "New"}
                        </span>
                        <span className="text-muted-foreground text-sm">
                          ({listing.reviewCount || 0})
                        </span>
                      </div>
                      <div className="font-semibold text-foreground">
                        ${listing.basePrice}
                        <span className="text-sm text-muted-foreground font-normal">/day</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {listing.bookingsCount || 0} bookings
                      </span>
                      <span className="font-medium text-green-600">
                        ${safeNumber(listing.totalEarnings).toLocaleString()} earned
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-card border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Listing</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Price</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Rating</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Bookings</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Earnings</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {listings.map((listing) => {
                  const statusConfig = STATUS_CONFIG[listing.status || "DRAFT"] || STATUS_CONFIG.DRAFT;
                  const listingId = safeText(listing.id);
                  const listingTitle = safeText(listing.title) || "Listing";
                  
                  return (
                    <tr key={listing.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <ListingThumbnail src={listing.images?.[0]} alt={listingTitle} size="small" />
                          <div>
                            <Link
                              to={listingId ? `/listings/${listingId}` : "/listings"}
                              className="font-medium text-foreground hover:text-primary"
                            >
                              {listingTitle}
                            </Link>
                            <p className="text-sm text-muted-foreground">
                              {typeof listing.category === 'string' ? listing.category : listing.category?.name}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                      </td>
                      <td className="px-4 py-3 font-medium">${listing.basePrice}/day</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          <span>
                            {safeNumber(listing.averageRating) > 0
                              ? safeNumber(listing.averageRating).toFixed(1)
                              : "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">{listing.bookingsCount || 0}</td>
                      <td className="px-4 py-3 font-medium text-green-600">
                        ${safeNumber(listing.totalEarnings).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link to={listingId ? `/listings/${listingId}` : "/listings"}>
                            <UnifiedButton variant="ghost" size="sm">
                              <Eye className="w-4 h-4" />
                            </UnifiedButton>
                          </Link>
                          <Link to={listingId ? `/listings/${listingId}/edit` : "/listings"}>
                            <UnifiedButton variant="ghost" size="sm">
                              <Edit className="w-4 h-4" />
                            </UnifiedButton>
                          </Link>
                          <Form method="post">
                            <input type="hidden" name="listingId" value={listing.id} />
                            <input type="hidden" name="intent" value="delete" />
                            <input
                              type="hidden"
                              name="confirmed"
                              value={confirmingId === listing.id ? "true" : "false"}
                            />
                            <button
                              type="submit"
                              disabled={isSubmitting}
                              onClick={(event) => {
                                if (confirmingId !== listing.id) {
                                  event.preventDefault();
                                  setConfirmingId(listing.id);
                                }
                              }}
                              className="text-red-600 hover:text-red-700"
                              aria-label={confirmingId === listing.id ? "Confirm delete" : "Delete listing"}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </Form>
                          {listing.status === "AVAILABLE" && (
                            <Form method="post">
                              <input type="hidden" name="listingId" value={listing.id} />
                              <input type="hidden" name="intent" value="pause" />
                              <button
                                type="submit"
                                disabled={isSubmitting}
                                className="text-muted-foreground hover:text-foreground"
                                aria-label="Pause listing"
                              >
                                <Pause className="w-4 h-4" />
                              </button>
                            </Form>
                          )}
                          {listing.status === "UNAVAILABLE" && (
                            <Form method="post">
                              <input type="hidden" name="listingId" value={listing.id} />
                              <input type="hidden" name="intent" value="activate" />
                              <button
                                type="submit"
                                disabled={isSubmitting}
                                className="text-muted-foreground hover:text-foreground"
                                aria-label="Activate listing"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            </Form>
                          )}
                          {listing.status === "DRAFT" && (
                            <Form method="post">
                              <input type="hidden" name="listingId" value={listing.id} />
                              <input type="hidden" name="intent" value="publish" />
                              <button
                                type="submit"
                                disabled={isSubmitting}
                                className="text-muted-foreground hover:text-foreground"
                                aria-label="Publish listing"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            </Form>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };
