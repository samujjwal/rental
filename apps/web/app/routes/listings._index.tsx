import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, useSearchParams, useRevalidator, useActionData, Form, useNavigation } from "react-router";
import { redirect } from "react-router";
import { useEffect, useMemo, useState } from "react";
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
  BarChart3,
  MousePointer,
} from "lucide-react";
import { listingsApi } from "~/lib/api/listings";
import { analyticsApi } from "~/lib/api/analytics";
import { UnifiedButton, Badge, RouteErrorBoundary } from "~/components/ui";
import {
  BulkActionsToolbar,
  BulkSelectCheckbox,
  ItemSelectCheckbox,
  useBulkSelection,
} from "~/components/admin/BulkActions";
import { EnhancedEmptyStatePresets } from "~/components/ui/PersonalizedEmptyState";
import { VirtualList } from "~/components/performance";
import { formatCurrency } from "~/lib/utils";
import { getUser } from "~/utils/auth";
import { isAppEntityId } from "~/utils/entity-id";
import { toast } from "~/lib/toast";
import { useTranslation } from "react-i18next";

export const meta: MetaFunction = () => {
  return [
    { title: "My Listings | GharBatai Rentals" },
    { name: "description", content: "Manage your rental listings" },
  ];
};

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
  photos: string[];
  images?: string[];
  status:
    | "AVAILABLE"
    | "RENTED"
    | "MAINTENANCE"
    | "UNAVAILABLE"
    | "DRAFT"
    | "SUSPENDED"
    | "ARCHIVED";
  verificationStatus?: "PENDING" | "VERIFIED" | "APPROVED" | "REJECTED" | null;
  rejectionReason?: string | null;
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

interface ListingAnalyticsSnapshot {
  views: number;
  bookings: number;
  revenue: number;
  rating: number;
}

const EMPTY_ANALYTICS_BY_LISTING: Record<string, ListingAnalyticsSnapshot> = {};

type OwnerListingLifecycle =
  | "AVAILABLE"
  | "RENTED"
  | "MAINTENANCE"
  | "UNDER_REVIEW"
  | "PAUSED"
  | "UNAVAILABLE"
  | "REJECTED"
  | "DRAFT"
  | "SUSPENDED"
  | "ARCHIVED";

const getListingLifecycleStatus = (
  listing: OwnerListing
): OwnerListingLifecycle => {
  if (
    listing.status === "UNAVAILABLE" &&
    listing.verificationStatus === "PENDING"
  ) {
    return "UNDER_REVIEW";
  }
  if (
    listing.status === "UNAVAILABLE" &&
    ["VERIFIED", "APPROVED"].includes(String(listing.verificationStatus || ""))
  ) {
    return "PAUSED";
  }
  if (
    listing.status === "DRAFT" &&
    listing.verificationStatus === "REJECTED"
  ) {
    return "REJECTED";
  }
  return listing.status;
};

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
    "UNDER_REVIEW",
    "PAUSED",
    "REJECTED",
    "UNAVAILABLE",
    "DRAFT",
    "SUSPENDED",
    "ARCHIVED",
  ]);
  const status = rawStatus && allowedStatuses.has(rawStatus) ? rawStatus : undefined;
  const search = url.searchParams.get("search")?.trim().slice(0, 100) || undefined;

  try {
    const [listingsResponse, analyticsResponse] = await Promise.allSettled([
      listingsApi.getMyListings(),
      analyticsApi.getPerformanceMetrics("monthly"),
    ]);
    const listings =
      listingsResponse.status === "fulfilled"
        ? (listingsResponse.value as unknown as OwnerListing[])
        : [];
    const analyticsOverview =
      analyticsResponse.status === "fulfilled"
        ? analyticsResponse.value.overview
        : null;
    const analyticsByListing = Object.fromEntries(
      (analyticsResponse.status === "fulfilled"
        ? analyticsResponse.value.topListings
        : []
      ).map((listing) => [
        listing.id,
        {
          views: safeNumber(listing.views),
          bookings: safeNumber(listing.bookings),
          revenue: safeNumber(listing.revenue),
          rating: safeNumber(listing.rating),
        },
      ])
    ) as Record<string, ListingAnalyticsSnapshot>;
    
    // Filter listings based on params
    let filteredListings: OwnerListing[] = listings;
    if (status) {
      filteredListings = listings.filter(
        (l) => getListingLifecycleStatus(l) === status
      );
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
      active: listings.filter((l) => getListingLifecycleStatus(l) === "AVAILABLE").length,
      rented: listings.filter((l) => getListingLifecycleStatus(l) === "RENTED").length,
      draft: listings.filter((l) => getListingLifecycleStatus(l) === "DRAFT").length,
      underReview: listings.filter((l) => getListingLifecycleStatus(l) === "UNDER_REVIEW").length,
      paused: listings.filter((l) => getListingLifecycleStatus(l) === "PAUSED").length,
      rejected: listings.filter((l) => getListingLifecycleStatus(l) === "REJECTED").length,
      unavailable: listings.filter((l) =>
        ["UNDER_REVIEW", "PAUSED", "UNAVAILABLE"].includes(
          getListingLifecycleStatus(l)
        )
      ).length,
      totalEarnings: listings.reduce((sum, l) => sum + safeNumber(l.totalEarnings), 0),
      totalBookings: listings.reduce((sum, l) => sum + safeNumber(l.bookingsCount), 0),
    };

    return {
      listings: filteredListings,
      total: filteredListings.length,
      stats,
      analyticsOverview,
      analyticsByListing,
      error:
        listingsResponse.status === "rejected"
          ? "Failed to load listings"
          : null,
    };
  } catch (error) {
    return {
      listings: [],
      total: 0,
      stats: {
        total: 0,
        active: 0,
        rented: 0,
        draft: 0,
        underReview: 0,
        paused: 0,
        rejected: 0,
        unavailable: 0,
        totalEarnings: 0,
        totalBookings: 0,
      },
      analyticsOverview: null,
      analyticsByListing: EMPTY_ANALYTICS_BY_LISTING,
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

  if (!isAppEntityId(listingId)) {
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

const STATUS_CONFIG: Record<OwnerListingLifecycle, { label: string; color: string; icon: typeof CheckCircle }> = {
  AVAILABLE: { label: "Available", color: "bg-green-100 text-green-800", icon: CheckCircle },
  RENTED: { label: "Rented", color: "bg-blue-100 text-blue-800", icon: Clock },
  MAINTENANCE: { label: "Maintenance", color: "bg-yellow-100 text-yellow-800", icon: AlertCircle },
  UNDER_REVIEW: { label: "Under Review", color: "bg-amber-100 text-amber-900", icon: Clock },
  PAUSED: { label: "Paused", color: "bg-orange-100 text-orange-800", icon: Pause },
  UNAVAILABLE: { label: "Unavailable", color: "bg-orange-100 text-orange-800", icon: Pause },
  REJECTED: { label: "Needs Changes", color: "bg-red-100 text-red-800", icon: AlertCircle },
  DRAFT: { label: "Draft", color: "bg-gray-100 text-gray-800", icon: Edit },
  SUSPENDED: { label: "Suspended", color: "bg-red-100 text-red-800", icon: AlertCircle },
  ARCHIVED: { label: "Archived", color: "bg-slate-100 text-slate-800", icon: Pause },
};

function ListingListRow({
  listing,
  analytics,
  isSelected,
  onToggleSelected,
}: {
  listing: OwnerListing;
  analytics?: ListingAnalyticsSnapshot;
  isSelected: boolean;
  onToggleSelected: () => void;
}) {
  const lifecycleStatus = getListingLifecycleStatus(listing);
  const statusConfig = STATUS_CONFIG[lifecycleStatus] || STATUS_CONFIG.DRAFT;
  const StatusIcon = statusConfig.icon;
  const listingId = safeText(listing.id);
  const listingTitle = safeText(listing.title) || "Listing";
  const views = analytics?.views ?? 0;
  const rating = analytics?.rating ?? safeNumber(listing.averageRating);

  return (
    <div className="flex items-start gap-3 border-b border-border px-4 py-4 last:border-b-0">
      <ItemSelectCheckbox
        checked={isSelected}
        onChange={onToggleSelected}
        ariaLabel={`Select ${listingTitle}`}
      />
      <div className="w-12 h-12 rounded overflow-hidden shrink-0 bg-muted">
        <ListingThumbnail src={listing.photos?.[0]} alt={listingTitle} size="small" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link
                to={listingId ? `/listings/${listingId}` : "/listings"}
                className="font-medium text-foreground hover:text-primary transition-colors line-clamp-1"
              >
                {listingTitle}
              </Link>
              <Badge className={statusConfig.color}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {statusConfig.label}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {listing.location?.city || "Location not set"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-foreground">
              {formatCurrency(listing.basePrice)}
            </p>
            <p className="text-xs text-muted-foreground">per day</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <div className="rounded-lg bg-muted/50 px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Views</p>
            <p className="mt-1 font-semibold text-foreground">{views}</p>
          </div>
          <div className="rounded-lg bg-muted/50 px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Bookings</p>
            <p className="mt-1 font-semibold text-foreground">{listing.bookingsCount || 0}</p>
          </div>
          <div className="rounded-lg bg-muted/50 px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Revenue</p>
            <p className="mt-1 font-semibold text-foreground">
              {formatCurrency(analytics?.revenue ?? safeNumber(listing.totalEarnings))}
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Rating</p>
            <p className="mt-1 font-semibold text-foreground">
              {rating > 0 ? rating.toFixed(1) : "New"}
            </p>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          to={listingId ? `/listings/${listingId}` : "/listings"}
          className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          View
        </Link>
        <Link
          to={listingId ? `/listings/${listingId}/edit` : "/listings"}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Edit
        </Link>
      </div>
    </div>
  );
}

export default function OwnerListingsPage() {
  const { t } = useTranslation();
  const {
    listings,
    stats,
    analyticsOverview,
    analyticsByListing = EMPTY_ANALYTICS_BY_LISTING,
    error,
  } = useLoaderData<typeof clientLoader>();
  const actionData = useActionData<typeof clientAction>();
  const revalidator = useRevalidator();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showActions, setShowActions] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [viewportHeight, setViewportHeight] = useState(900);
  const selection = useBulkSelection(listings);

  const isSubmitting = navigation.state === "submitting";

  useEffect(() => {
    const syncViewportHeight = () => setViewportHeight(window.innerHeight);
    syncViewportHeight();
    window.addEventListener("resize", syncViewportHeight, { passive: true });
    return () => window.removeEventListener("resize", syncViewportHeight);
  }, []);

  useEffect(() => {
    if (actionData?.success) {
      revalidator.revalidate();
      setConfirmingId(null);
    }
  }, [actionData, revalidator]);

  const currentStatus = searchParams.get("status");
  const currentSearch = searchParams.get("search") || "";
  const listContainerHeight = Math.max(viewportHeight - 340, 420);
  const shouldVirtualizeList = viewMode === "list" && listings.length > 12;

  const analyticsCards = useMemo(
    () =>
      analyticsOverview
        ? [
            {
              key: "views",
              label: "Monthly views",
              value: analyticsOverview.totalViews,
              icon: MousePointer,
            },
            {
              key: "bookings",
              label: "Bookings",
              value: analyticsOverview.totalBookings,
              icon: BarChart3,
            },
            {
              key: "conversion",
              label: "Conversion",
              value: `${analyticsOverview.conversionRate.toFixed(1)}%`,
              icon: CheckCircle,
            },
            {
              key: "rating",
              label: "Average rating",
              value: analyticsOverview.averageRating.toFixed(1),
              icon: Star,
            },
          ]
        : [],
    [analyticsOverview]
  );

  const handleBulkStatusChange = async (operation: string) => {
    const selectedItems = selection.getSelectedItems();
    if (selectedItems.length === 0) return;

    try {
      await Promise.all(
        selectedItems.map((listing) => {
          if (operation === "pause") return listingsApi.pauseListing(listing.id);
          if (operation === "activate") return listingsApi.activateListing(listing.id);
          if (operation === "publish") return listingsApi.publishListing(listing.id);
          return Promise.resolve();
        })
      );
      toast.success(`${selectedItems.length} listing${selectedItems.length === 1 ? "" : "s"} updated.`);
      selection.clearSelection();
      revalidator.revalidate();
    } catch {
      toast.error("Bulk update failed. Please try again.");
    }
  };

  const handleBulkDelete = async () => {
    const selectedItems = selection.getSelectedItems();
    if (selectedItems.length === 0) return;

    try {
      await Promise.all(selectedItems.map((listing) => listingsApi.deleteListing(listing.id)));
      toast.success(`${selectedItems.length} listing${selectedItems.length === 1 ? "" : "s"} deleted.`);
      selection.clearSelection();
      revalidator.revalidate();
    } catch {
      toast.error("Bulk delete failed. Please try again.");
    }
  };

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
            <h1 className="text-2xl font-bold text-foreground mb-2">{t('listings.owner.errorTitle', 'Unable to load listings')}</h1>
            <p className="text-muted-foreground mb-6">{error}</p>
            <UnifiedButton onClick={() => revalidator.revalidate()}>{t('common.retry')}</UnifiedButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('listings.owner.title', 'My Listings')}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t('listings.owner.subtitle', 'Manage and track all your rental items')}
            </p>
          </div>
          <Link to="/listings/new">
            <UnifiedButton>
              <Plus className="w-4 h-4 mr-2" />
              {t('listings.owner.addListing', 'Add Listing')}
            </UnifiedButton>
          </Link>
        </div>
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
        {analyticsCards.length > 0 && (
          <div className="grid grid-cols-2 gap-4 mb-8 xl:grid-cols-4">
            {analyticsCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.key} className="bg-card border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{card.label}</p>
                      <p className="mt-1 text-2xl font-bold text-foreground">{card.value}</p>
                    </div>
                    <div className="rounded-full bg-primary/10 p-3 text-primary">
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4 mb-8">
          <div className="bg-card border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">{t('dashboard.stats.totalListings')}</p>
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">{t('listings.owner.stats.active', 'Active')}</p>
            <p className="text-2xl font-bold text-green-600">{stats.active}</p>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">{t('listings.owner.stats.currentlyRented', 'Currently Rented')}</p>
            <p className="text-2xl font-bold text-blue-600">{stats.rented}</p>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">{t('listings.owner.stats.drafts', 'Drafts')}</p>
            <p className="text-2xl font-bold text-gray-600">{stats.draft}</p>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">{t('listings.owner.stats.underReview', 'Under Review')}</p>
            <p className="text-2xl font-bold text-amber-700">{stats.underReview}</p>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">{t('listings.owner.stats.paused', 'Paused')}</p>
            <p className="text-2xl font-bold text-orange-600">{stats.paused}</p>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">{t('listings.owner.stats.rejected', 'Needs Changes')}</p>
            <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">{t('listings.owner.stats.totalBookings', 'Total Bookings')}</p>
            <p className="text-2xl font-bold text-foreground">{stats.totalBookings}</p>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">{t('dashboard.stats.totalEarnings')}</p>
            <p className="text-2xl font-bold text-foreground">
              {formatCurrency(safeNumber(stats.totalEarnings))}
            </p>
          </div>
        </div>

        {listings.length > 0 && (
          <div className="mb-6 flex flex-col gap-3 rounded-xl border border-border bg-card p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <BulkSelectCheckbox
                checked={selection.isAllSelected}
                indeterminate={selection.isIndeterminate}
                onChange={selection.handleSelectAll}
              />
              <div>
                <p className="text-sm font-medium text-foreground">Bulk actions</p>
                <p className="text-xs text-muted-foreground">
                  Select listings to pause, activate, publish, or delete them together.
                </p>
              </div>
            </div>
            <BulkActionsToolbar
              selectedCount={selection.selectedCount}
              onClearSelection={selection.clearSelection}
              onDelete={handleBulkDelete}
              onStatusChange={handleBulkStatusChange}
              availableStatuses={[
                { value: "pause", label: "Pause selected" },
                { value: "activate", label: "Activate selected" },
                { value: "publish", label: "Submit for review" },
              ]}
              isLoading={isSubmitting}
            />
          </div>
        )}

        {/* Filters and Search */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <UnifiedButton
              variant={!currentStatus ? "primary" : "outline"}
              size="sm"
              onClick={() => handleStatusFilter(null)}
            >
              {t('listings.owner.filterAll', 'All')} ({stats.total})
            </UnifiedButton>
            <UnifiedButton
              variant={currentStatus === "AVAILABLE" ? "primary" : "outline"}
              size="sm"
              onClick={() => handleStatusFilter("AVAILABLE")}
            >
              {t('listings.owner.filterAvailable', 'Available')} ({stats.active})
            </UnifiedButton>
            <UnifiedButton
              variant={currentStatus === "RENTED" ? "primary" : "outline"}
              size="sm"
              onClick={() => handleStatusFilter("RENTED")}
            >
              {t('listings.owner.filterRented', 'Rented')} ({stats.rented})
            </UnifiedButton>
            <UnifiedButton
              variant={currentStatus === "DRAFT" ? "primary" : "outline"}
              size="sm"
              onClick={() => handleStatusFilter("DRAFT")}
            >
              {t('listings.owner.filterDrafts', 'Drafts')} ({stats.draft})
            </UnifiedButton>
            <UnifiedButton
              variant={currentStatus === "UNDER_REVIEW" ? "primary" : "outline"}
              size="sm"
              onClick={() => handleStatusFilter("UNDER_REVIEW")}
            >
              {t('listings.owner.filterUnderReview', 'Under Review')} ({stats.underReview})
            </UnifiedButton>
            <UnifiedButton
              variant={currentStatus === "PAUSED" ? "primary" : "outline"}
              size="sm"
              onClick={() => handleStatusFilter("PAUSED")}
            >
              {t('listings.owner.filterPaused', 'Paused')} ({stats.paused})
            </UnifiedButton>
            <UnifiedButton
              variant={currentStatus === "REJECTED" ? "primary" : "outline"}
              size="sm"
              onClick={() => handleStatusFilter("REJECTED")}
            >
              {t('listings.owner.filterRejected', 'Needs Changes')} ({stats.rejected})
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
                placeholder={t('listings.search')}
                aria-label={t('listings.search')}
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
          <div className="bg-card border rounded-lg">
            {currentStatus || currentSearch ? (
              <div className="text-center py-16">
                <TrendingUp className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  {t('listings.owner.noMatchFilters', 'No listings match your filters')}
                </h2>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  {t('listings.owner.adjustFilters', 'Try adjusting your filters or search terms')}
                </p>
              </div>
            ) : (
              <EnhancedEmptyStatePresets.NoListings context="owner" />
            )}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {listings.map((listing) => {
              const lifecycleStatus = getListingLifecycleStatus(listing);
              const statusConfig = STATUS_CONFIG[lifecycleStatus] || STATUS_CONFIG.DRAFT;
              const StatusIcon = statusConfig.icon;
              const listingId = safeText(listing.id);
              const listingTitle = safeText(listing.title) || "Listing";
              const canActivate = lifecycleStatus === "PAUSED";
              const canPublish =
                lifecycleStatus === "DRAFT" || lifecycleStatus === "REJECTED";
              const analytics = analyticsByListing[listing.id];
              
              return (
                <div
                  key={listing.id}
                  className="bg-card border rounded-lg overflow-hidden hover:shadow-lg transition-shadow group"
                >
                  <div className="relative aspect-[4/3]">
                    <div className="absolute left-2 top-2 z-10">
                      <ItemSelectCheckbox
                        checked={selection.isSelected(listing.id)}
                        onChange={() => selection.handleSelect(listing.id)}
                        ariaLabel={`Select ${listingTitle}`}
                      />
                    </div>
                    <Link to={listingId ? `/listings/${listingId}` : "/listings"}>
                      <ListingThumbnail src={listing.photos?.[0]} alt={listingTitle} size="full" />
                    </Link>
                    <div className="absolute top-2 left-12">
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
                              {t('listings.owner.view', 'View')}
                            </Link>
                            <Link
                              to={listingId ? `/listings/${listingId}/edit` : "/listings"}
                              className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-100"
                            >
                              <Edit className="w-4 h-4" />
                              {t('common.edit')}
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
                                {confirmingId === listing.id ? t('listings.owner.confirmDelete', 'Confirm delete') : t('common.delete')}
                              </button>
                            </Form>
                            {lifecycleStatus === "AVAILABLE" && (
                              <Form method="post" className="w-full">
                                <input type="hidden" name="listingId" value={listing.id} />
                                <input type="hidden" name="intent" value="pause" />
                                <button
                                  type="submit"
                                  disabled={isSubmitting}
                                  className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-100 w-full"
                                >
                                  <Pause className="w-4 h-4" />
                                  {t('listings.owner.pause', 'Pause')}
                                </button>
                              </Form>
                            )}
                            {canActivate && (
                              <Form method="post" className="w-full">
                                <input type="hidden" name="listingId" value={listing.id} />
                                <input type="hidden" name="intent" value="activate" />
                                <button
                                  type="submit"
                                  disabled={isSubmitting}
                                  className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-100 w-full"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  {t('listings.owner.activate', 'Activate')}
                                </button>
                              </Form>
                            )}
                            {canPublish && (
                              <Form method="post" className="w-full">
                                <input type="hidden" name="listingId" value={listing.id} />
                                <input type="hidden" name="intent" value="publish" />
                                <button
                                  type="submit"
                                  disabled={isSubmitting}
                                  className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-100 w-full"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  {lifecycleStatus === "REJECTED"
                                    ? t('listings.owner.resubmit', 'Resubmit')
                                    : t('listings.owner.publish', 'Publish')}
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
                      <span>{listing.location?.city || t('listings.owner.locationNotSet', 'Location not set')}</span>
                    </div>
                    {lifecycleStatus === "UNDER_REVIEW" && (
                      <p className="mt-2 text-sm text-amber-700">
                        {t(
                          'listings.owner.reviewPendingMessage',
                          'Submitted successfully. We are reviewing it before it goes live.'
                        )}
                      </p>
                    )}
                    {lifecycleStatus === "REJECTED" && listing.rejectionReason && (
                      <p className="mt-2 text-sm text-red-700">
                        {t('listings.owner.rejectionReasonLabel', 'Needs fixes')}: {listing.rejectionReason}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-medium">
                          {safeNumber(listing.averageRating) > 0
                            ? safeNumber(listing.averageRating).toFixed(1)
                            : t('listings.owner.new', 'New')}
                        </span>
                        <span className="text-muted-foreground text-sm">
                          ({listing.reviewCount || 0})
                        </span>
                      </div>
                      <div className="font-semibold text-foreground">
                        {formatCurrency(listing.basePrice)}
                        <span className="text-sm text-muted-foreground font-normal">{t('common.perDay')}</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {listing.bookingsCount || 0} {t('listings.owner.bookingsLabel', 'bookings')}
                      </span>
                      <span className="font-medium text-green-600">
                        {formatCurrency(safeNumber(listing.totalEarnings))} {t('listings.owner.earned', 'earned')}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                      <span>{analytics?.views ?? 0} views</span>
                      <span>
                        {formatCurrency(analytics?.revenue ?? safeNumber(listing.totalEarnings))} revenue
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-card border rounded-lg overflow-hidden">
            {shouldVirtualizeList ? (
              <VirtualList
                items={listings}
                itemHeight={146}
                containerHeight={listContainerHeight}
                className="bg-card"
                renderItem={(listing) => (
                  <ListingListRow
                    listing={listing}
                    analytics={analyticsByListing[listing.id]}
                    isSelected={selection.isSelected(listing.id)}
                    onToggleSelected={() => selection.handleSelect(listing.id)}
                  />
                )}
              />
            ) : (
              <div>
                {listings.map((listing) => (
                  <ListingListRow
                    key={listing.id}
                    listing={listing}
                    analytics={analyticsByListing[listing.id]}
                    isSelected={selection.isSelected(listing.id)}
                    onToggleSelected={() => selection.handleSelect(listing.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };
