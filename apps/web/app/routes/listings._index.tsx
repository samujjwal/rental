import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link, useSearchParams, useRevalidator } from "react-router";
import { useState } from "react";
import {
  Plus,
  Search,
  Filter,
  Grid,
  List,
  Edit,
  Trash2,
  Eye,
  MoreVertical,
  MapPin,
  Star,
  Calendar,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  Pause,
} from "lucide-react";
import { format } from "date-fns";
import { listingsApi } from "~/lib/api/listings";
import { Button, Badge } from "~/components/ui";
import { cn } from "~/lib/utils";

export const meta: MetaFunction = () => {
  return [
    { title: "My Listings | GharBatai Rentals" },
    { name: "description", content: "Manage your rental listings" },
  ];
};

interface OwnerListing {
  id: string;
  title: string;
  description: string;
  images: string[];
  status: "AVAILABLE" | "RENTED" | "MAINTENANCE" | "DRAFT" | "PENDING" | "INACTIVE";
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
  lastBookingAt: string | null;
  instantBooking: boolean;
  deliveryAvailable: boolean;
}

interface ListingsData {
  listings: OwnerListing[];
  total: number;
  stats: {
    total: number;
    active: number;
    rented: number;
    draft: number;
    totalEarnings: number;
    totalBookings: number;
  };
}

export async function clientLoader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || undefined;
  const search = url.searchParams.get("search") || undefined;

  try {
    const listings = await listingsApi.getMyListings();
    
    // Filter listings based on params
    let filteredListings = listings;
    if (status) {
      filteredListings = listings.filter((l: any) => l.status === status);
    }
    if (search) {
      const searchLower = search.toLowerCase();
      filteredListings = filteredListings.filter((l: any) => 
        l.title.toLowerCase().includes(searchLower) ||
        l.description?.toLowerCase().includes(searchLower)
      );
    }

    // Calculate stats
    const stats = {
      total: listings.length,
      active: listings.filter((l: any) => l.status === "AVAILABLE").length,
      rented: listings.filter((l: any) => l.status === "RENTED").length,
      draft: listings.filter((l: any) => l.status === "DRAFT" || l.status === "PENDING").length,
      totalEarnings: listings.reduce((sum: number, l: any) => sum + (l.totalEarnings || 0), 0),
      totalBookings: listings.reduce((sum: number, l: any) => sum + (l.bookingsCount || 0), 0),
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
      stats: { total: 0, active: 0, rented: 0, draft: 0, totalEarnings: 0, totalBookings: 0 },
      error: "Failed to load listings",
    };
  }
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  AVAILABLE: { label: "Available", color: "bg-green-100 text-green-800", icon: CheckCircle },
  RENTED: { label: "Rented", color: "bg-blue-100 text-blue-800", icon: Clock },
  MAINTENANCE: { label: "Maintenance", color: "bg-yellow-100 text-yellow-800", icon: AlertCircle },
  DRAFT: { label: "Draft", color: "bg-gray-100 text-gray-800", icon: Edit },
  PENDING: { label: "Pending Review", color: "bg-orange-100 text-orange-800", icon: Clock },
  INACTIVE: { label: "Inactive", color: "bg-red-100 text-red-800", icon: Pause },
};

export default function OwnerListingsPage() {
  const { listings, total, stats, error } = useLoaderData<typeof clientLoader>();
  const revalidator = useRevalidator();
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showActions, setShowActions] = useState<string | null>(null);

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
    const search = formData.get("search") as string;
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
            <Button onClick={() => revalidator.revalidate()}>Try Again</Button>
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
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Listing
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
            <p className="text-sm text-muted-foreground">Total Bookings</p>
            <p className="text-2xl font-bold text-foreground">{stats.totalBookings}</p>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Total Earnings</p>
            <p className="text-2xl font-bold text-foreground">${stats.totalEarnings.toLocaleString()}</p>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={!currentStatus ? "contained" : "outlined"}
              size="small"
              onClick={() => handleStatusFilter(null)}
            >
              All ({stats.total})
            </Button>
            <Button
              variant={currentStatus === "AVAILABLE" ? "contained" : "outlined"}
              size="small"
              onClick={() => handleStatusFilter("AVAILABLE")}
            >
              Available ({stats.active})
            </Button>
            <Button
              variant={currentStatus === "RENTED" ? "contained" : "outlined"}
              size="small"
              onClick={() => handleStatusFilter("RENTED")}
            >
              Rented ({stats.rented})
            </Button>
            <Button
              variant={currentStatus === "DRAFT" ? "contained" : "outlined"}
              size="small"
              onClick={() => handleStatusFilter("DRAFT")}
            >
              Drafts ({stats.draft})
            </Button>
          </div>
          
          <div className="flex items-center gap-4 w-full md:w-auto">
            <form onSubmit={handleSearch} className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                name="search"
                defaultValue={currentSearch}
                placeholder="Search listings..."
                className="w-full pl-10 pr-4 py-2 border border-input rounded-lg bg-background text-sm"
              />
            </form>
            <div className="flex items-center gap-1 border rounded-lg p-1">
              <Button
                variant={viewMode === "grid" ? "contained" : "text"}
                size="small"
                onClick={() => setViewMode("grid")}
              >
                <Grid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "contained" : "text"}
                size="small"
                onClick={() => setViewMode("list")}
              >
                <List className="w-4 h-4" />
              </Button>
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
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Listing
                </Button>
              </Link>
            )}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {listings.map((listing) => {
              const statusConfig = STATUS_CONFIG[listing.status || "DRAFT"] || STATUS_CONFIG.DRAFT;
              const StatusIcon = statusConfig.icon;
              
              return (
                <div
                  key={listing.id}
                  className="bg-card border rounded-lg overflow-hidden hover:shadow-lg transition-shadow group"
                >
                  <div className="relative aspect-[4/3]">
                    <Link to={`/listings/${listing.id}`}>
                      <img
                        src={listing.images?.[0] || "/placeholder-listing.jpg"}
                        alt={listing.title}
                        className="w-full h-full object-cover"
                      />
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
                              to={`/listings/${listing.id}`}
                              className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-100"
                            >
                              <Eye className="w-4 h-4" />
                              View
                            </Link>
                            <Link
                              to={`/listings/${listing.id}/edit`}
                              className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-100"
                            >
                              <Edit className="w-4 h-4" />
                              Edit
                            </Link>
                            <button className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full">
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <Link to={`/listings/${listing.id}`}>
                      <h3 className="font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                        {listing.title}
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
                          {listing.averageRating?.toFixed(1) || "New"}
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
                        ${(listing.totalEarnings || 0).toLocaleString()} earned
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
                  
                  return (
                    <tr key={listing.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={listing.images?.[0] || "/placeholder-listing.jpg"}
                            alt={listing.title}
                            className="w-12 h-12 rounded object-cover"
                          />
                          <div>
                            <Link
                              to={`/listings/${listing.id}`}
                              className="font-medium text-foreground hover:text-primary"
                            >
                              {listing.title}
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
                          <span>{listing.averageRating?.toFixed(1) || "—"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">{listing.bookingsCount || 0}</td>
                      <td className="px-4 py-3 font-medium text-green-600">
                        ${(listing.totalEarnings || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link to={`/listings/${listing.id}`}>
                            <Button variant="text" size="small">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Link to={`/listings/${listing.id}/edit`}>
                            <Button variant="text" size="small">
                              <Edit className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button variant="text" size="small" className="text-red-600 hover:text-red-700">
                            <Trash2 className="w-4 h-4" />
                          </Button>
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
