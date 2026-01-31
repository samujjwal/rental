import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams, Link, Form } from "react-router";
import { Search, SlidersHorizontal, MapPin, X } from "lucide-react";
import { listingsApi } from "~/lib/api/listings";
import type { ListingSearchResponse } from "~/types/listing";
import { useState } from "react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui";
import { Badge } from "~/components/ui";

export const meta: MetaFunction = () => {
  return [
    { title: "Search Rentals - Universal Rental Portal" },
    { name: "description", content: "Find the perfect rental for your needs" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
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
    return { results, searchParams };
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
    };
  }
}

export default function SearchPage() {
  const { results, searchParams } = useLoaderData<typeof loader>();
  const [urlSearchParams, setSearchParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);

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
            <Form className="flex-1 max-w-2xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  name="query"
                  defaultValue={searchParams.query}
                  placeholder="Search for items..."
                  className="w-full pl-10 pr-24 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                />
                <button
                  type="submit"
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
              variant="outline"
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

        <div className="flex gap-6">
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

          {/* Results Grid */}
          <main className="flex-1">
            {results.listings.length === 0 ? (
              <div className="bg-card rounded-lg shadow-sm border p-12 text-center">
                <Search className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  No results found
                </h3>
                <p className="text-muted-foreground mb-4">
                  Try adjusting your search or filters
                </p>
                <button
                  onClick={clearFilters}
                  className="text-primary hover:text-primary/90 font-medium transition-colors"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {results.listings.map((listing) => (
                    <Link
                      key={listing.id}
                      to={`/listings/${listing.id}`}
                      className="bg-card rounded-lg shadow-sm border overflow-hidden hover:shadow-md transition-shadow group"
                    >
                      {/* Image */}
                      <div className="aspect-[4/3] bg-muted relative">
                        {listing.images[0] ? (
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
                          <Badge
                            variant="warning"
                            className="absolute top-2 left-2"
                          >
                            Featured
                          </Badge>
                        )}
                        {listing.instantBooking && (
                          <Badge
                            variant="success"
                            className="absolute top-2 right-2"
                          >
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
                          {listing.location.city}, {listing.location.state}
                        </p>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-muted-foreground capitalize">
                            {listing.condition.replace("-", " ")}
                          </span>
                          {listing.rating && (
                            <span className="text-sm text-muted-foreground">
                              ⭐ {listing.rating.toFixed(1)} (
                              {listing.totalReviews})
                            </span>
                          )}
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-bold text-foreground">
                            ${listing.pricePerDay}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            /day
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>

                {/* Pagination */}
                {results.totalPages > 1 && (
                  <div className="mt-8 flex justify-center gap-2">
                    {results.page > 1 && (
                      <Button
                        variant="outline"
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
                              page === results.page ? "default" : "outline"
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
                        variant="outline"
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
          </main>
        </div>
      </div>
    </div>
  );
}
