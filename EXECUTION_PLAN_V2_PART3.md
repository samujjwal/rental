# Universal Rental Portal — Execution Plan Part 3: Search, Messaging & Fulfillment

**Document:** Part 3 of 5 - Features 5-7 Detailed Implementation  
**Related:** EXECUTION_PLAN_V2.md (Part 1), EXECUTION_PLAN_V2_PART2.md (Part 2)  
**Last Updated:** January 23, 2026

---

## 📋 Table of Contents

- [Feature 5: Search & Discovery Infrastructure](#feature-5-search--discovery-infrastructure)
- [Feature 6: Messaging & Real-time Communication](#feature-6-messaging--real-time-communication)
- [Feature 7: Fulfillment & Condition Reports](#feature-7-fulfillment--condition-reports)

---

## Feature 5: Search & Discovery Infrastructure

### 5.1 Elasticsearch Setup & Mapping

```typescript
// apps/api/src/modules/search/elasticsearch/mappings/listing.mapping.ts

export const ListingIndexMapping = {
  settings: {
    analysis: {
      analyzer: {
        autocomplete: {
          tokenizer: "autocomplete",
          filter: ["lowercase"],
        },
        autocomplete_search: {
          tokenizer: "lowercase",
        },
        location_analyzer: {
          tokenizer: "standard",
          filter: ["lowercase", "stop"],
        },
      },
      tokenizer: {
        autocomplete: {
          type: "edge_ngram",
          min_gram: 2,
          max_gram: 10,
          token_chars: ["letter", "digit"],
        },
      },
    },
    number_of_shards: 3,
    number_of_replicas: 2,
  },
  mappings: {
    properties: {
      // Basic fields
      id: { type: "keyword" },
      title: {
        type: "text",
        analyzer: "autocomplete",
        search_analyzer: "autocomplete_search",
        fields: {
          raw: { type: "keyword" },
          english: { type: "text", analyzer: "english" },
        },
      },
      description: {
        type: "text",
        analyzer: "english",
        fields: {
          raw: { type: "keyword" },
        },
      },

      // Category & classification
      category: { type: "keyword" },
      subcategory: { type: "keyword" },
      tags: { type: "keyword" },

      // Owner information
      ownerId: { type: "keyword" },
      ownerName: { type: "text" },
      ownerRating: { type: "float" },
      ownerVerified: { type: "boolean" },

      // Location (geo-point for radius searches)
      location: {
        type: "geo_point",
      },
      locationName: {
        type: "text",
        analyzer: "location_analyzer",
        fields: {
          keyword: { type: "keyword" },
        },
      },
      city: { type: "keyword" },
      state: { type: "keyword" },
      country: { type: "keyword" },
      postalCode: { type: "keyword" },

      // Pricing
      basePriceAmount: { type: "integer" },
      basePriceCurrency: { type: "keyword" },
      pricePerDay: { type: "integer" },
      pricePerWeek: { type: "integer" },
      pricePerMonth: { type: "integer" },

      // Availability
      instantBook: { type: "boolean" },
      minimumBookingDuration: { type: "integer" },
      maximumBookingDuration: { type: "integer" },
      advanceNoticeHours: { type: "integer" },

      // Ratings & reviews
      averageRating: { type: "float" },
      reviewCount: { type: "integer" },

      // Status & verification
      status: { type: "keyword" },
      verified: { type: "boolean" },
      featured: { type: "boolean" },

      // Amenities & features (category-specific)
      amenities: { type: "keyword" },
      features: {
        type: "nested",
        properties: {
          key: { type: "keyword" },
          value: { type: "keyword" },
          displayValue: { type: "text" },
        },
      },

      // Vehicle-specific
      vehicleType: { type: "keyword" },
      vehicleMake: { type: "keyword" },
      vehicleModel: { type: "keyword" },
      vehicleYear: { type: "integer" },
      vehicleSeats: { type: "integer" },
      vehicleTransmission: { type: "keyword" },
      vehicleFuelType: { type: "keyword" },

      // Space-specific
      spaceType: { type: "keyword" },
      spaceCapacity: { type: "integer" },
      spaceSize: { type: "integer" },
      spaceSizeUnit: { type: "keyword" },

      // Instrument-specific
      instrumentType: { type: "keyword" },
      instrumentBrand: { type: "keyword" },
      instrumentCondition: { type: "keyword" },

      // Event venue-specific
      venueType: { type: "keyword" },
      venueCapacity: { type: "integer" },
      venueCateringAvailable: { type: "boolean" },

      // Metadata
      createdAt: { type: "date" },
      updatedAt: { type: "date" },
      lastBookedAt: { type: "date" },
      totalBookings: { type: "integer" },

      // Boost factors (for ranking)
      boostScore: { type: "float" },
      popularityScore: { type: "float" },
    },
  },
};
```

### 5.2 Search Service Implementation

```typescript
// apps/api/src/modules/search/services/search.service.ts

import { Injectable } from "@nestjs/common";
import { ElasticsearchService } from "@nestjs/elasticsearch";
import { SearchRequest } from "@elastic/elasticsearch/lib/api/types";

@Injectable()
export class SearchService {
  private readonly INDEX_NAME = "listings";

  constructor(
    private readonly elasticsearch: ElasticsearchService,
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async searchListings(params: SearchListingsParams): Promise<SearchResults> {
    // Build Elasticsearch query
    const esQuery = this.buildSearchQuery(params);

    // Check cache
    const cacheKey = this.generateCacheKey(params);
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Execute search
    const response = await this.elasticsearch.search({
      index: this.INDEX_NAME,
      body: esQuery,
      track_total_hits: true,
    });

    // Parse results
    const results = {
      hits: response.hits.hits.map((hit) => ({
        id: hit._id,
        score: hit._score,
        ...hit._source,
      })),
      total:
        typeof response.hits.total === "number"
          ? response.hits.total
          : response.hits.total.value,
      facets: this.parseFacets(response.aggregations),
      page: params.page || 1,
      pageSize: params.pageSize || 20,
      took: response.took,
    };

    // Cache results
    await this.cacheService.set(cacheKey, JSON.stringify(results), 300); // 5 min cache

    return results;
  }

  private buildSearchQuery(
    params: SearchListingsParams,
  ): SearchRequest["body"] {
    const {
      query,
      category,
      location,
      radius,
      priceMin,
      priceMax,
      dateRange,
      filters,
      sort,
      page = 1,
      pageSize = 20,
    } = params;

    const must: any[] = [];
    const filter: any[] = [];
    const should: any[] = [];

    // Text search
    if (query) {
      must.push({
        multi_match: {
          query,
          fields: [
            "title^3", // Title most important
            "description^2", // Description second
            "locationName",
            "tags",
            "amenities",
          ],
          type: "best_fields",
          fuzziness: "AUTO",
          operator: "or",
          minimum_should_match: "75%",
        },
      });
    }

    // Category filter
    if (category) {
      filter.push({
        term: { category },
      });
    }

    // Geo-location search
    if (location && radius) {
      filter.push({
        geo_distance: {
          distance: `${radius}km`,
          location: {
            lat: location.lat,
            lon: location.lon,
          },
        },
      });
    }

    // Price range
    if (priceMin !== undefined || priceMax !== undefined) {
      const rangeQuery: any = {};
      if (priceMin !== undefined) rangeQuery.gte = priceMin;
      if (priceMax !== undefined) rangeQuery.lte = priceMax;

      filter.push({
        range: {
          pricePerDay: rangeQuery,
        },
      });
    }

    // Date availability check
    if (dateRange) {
      // This requires checking availability in main DB
      // For performance, we do this as a post-filter
      // Or maintain availability in ES (complex but faster)
    }

    // Dynamic filters (category-specific)
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          filter.push({
            terms: { [key]: value },
          });
        } else if (
          typeof value === "object" &&
          "min" in value &&
          "max" in value
        ) {
          filter.push({
            range: {
              [key]: {
                gte: value.min,
                lte: value.max,
              },
            },
          });
        } else {
          filter.push({
            term: { [key]: value },
          });
        }
      });
    }

    // Boost factors
    should.push(
      // Boost verified listings
      { term: { verified: { value: true, boost: 1.5 } } },
      // Boost instant book
      { term: { instantBook: { value: true, boost: 1.3 } } },
      // Boost highly rated
      { range: { averageRating: { gte: 4.5, boost: 1.4 } } },
      // Boost recently active
      {
        range: {
          lastBookedAt: {
            gte: "now-30d",
            boost: 1.2,
          },
        },
      },
    );

    // Always filter out inactive listings
    filter.push({
      term: { status: "active" },
    });

    // Build query
    const query_body: any = {
      query: {
        bool: {
          must: must.length > 0 ? must : undefined,
          filter: filter.length > 0 ? filter : undefined,
          should: should.length > 0 ? should : undefined,
          minimum_should_match: should.length > 0 ? 1 : undefined,
        },
      },

      // Aggregations for facets
      aggs: {
        categories: {
          terms: { field: "category", size: 20 },
        },
        priceRanges: {
          range: {
            field: "pricePerDay",
            ranges: [
              { to: 50 },
              { from: 50, to: 100 },
              { from: 100, to: 200 },
              { from: 200, to: 500 },
              { from: 500 },
            ],
          },
        },
        avgRating: {
          terms: { field: "averageRating", size: 5 },
        },
        instantBook: {
          terms: { field: "instantBook" },
        },
      },

      // Pagination
      from: (page - 1) * pageSize,
      size: pageSize,

      // Sorting
      sort: this.buildSortClause(sort, location),

      // Highlighting
      highlight: {
        fields: {
          title: {},
          description: {},
        },
        pre_tags: ["<mark>"],
        post_tags: ["</mark>"],
      },
    };

    return query_body;
  }

  private buildSortClause(
    sort: string | undefined,
    location: { lat: number; lon: number } | undefined,
  ): any[] {
    const sortClauses: any[] = [];

    switch (sort) {
      case "price_asc":
        sortClauses.push({ pricePerDay: "asc" });
        break;
      case "price_desc":
        sortClauses.push({ pricePerDay: "desc" });
        break;
      case "rating":
        sortClauses.push({ averageRating: "desc" });
        break;
      case "popular":
        sortClauses.push({ popularityScore: "desc" });
        break;
      case "newest":
        sortClauses.push({ createdAt: "desc" });
        break;
      case "distance":
        if (location) {
          sortClauses.push({
            _geo_distance: {
              location: {
                lat: location.lat,
                lon: location.lon,
              },
              order: "asc",
              unit: "km",
            },
          });
        }
        break;
      default:
        // Relevance score (default)
        sortClauses.push("_score");
    }

    // Always add tiebreaker
    sortClauses.push({ id: "asc" });

    return sortClauses;
  }

  // Index a listing
  async indexListing(listingId: string): Promise<void> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        owner: true,
        location: true,
        categorySpecificData: true,
        amenities: true,
      },
    });

    if (!listing) {
      throw new NotFoundException("Listing not found");
    }

    const document = this.transformListingToDocument(listing);

    await this.elasticsearch.index({
      index: this.INDEX_NAME,
      id: listing.id,
      document,
      refresh: true,
    });
  }

  // Remove from index
  async removeListing(listingId: string): Promise<void> {
    await this.elasticsearch.delete({
      index: this.INDEX_NAME,
      id: listingId,
      refresh: true,
    });
  }

  // Bulk index listings
  async bulkIndexListings(listingIds: string[]): Promise<void> {
    const listings = await this.prisma.listing.findMany({
      where: { id: { in: listingIds } },
      include: {
        owner: true,
        location: true,
        categorySpecificData: true,
        amenities: true,
      },
    });

    const operations = listings.flatMap((listing) => [
      { index: { _index: this.INDEX_NAME, _id: listing.id } },
      this.transformListingToDocument(listing),
    ]);

    if (operations.length > 0) {
      await this.elasticsearch.bulk({
        operations,
        refresh: true,
      });
    }
  }

  // Autocomplete suggestions
  async getSuggestions(query: string, category?: string): Promise<string[]> {
    const response = await this.elasticsearch.search({
      index: this.INDEX_NAME,
      body: {
        query: {
          bool: {
            must: [
              {
                match: {
                  title: {
                    query,
                    operator: "and",
                    fuzziness: "AUTO",
                  },
                },
              },
            ],
            filter: category ? [{ term: { category } }] : [],
          },
        },
        _source: ["title"],
        size: 10,
      },
    });

    return response.hits.hits.map((hit) => hit._source.title);
  }

  // Similar listings (More Like This)
  async getSimilarListings(
    listingId: string,
    limit: number = 5,
  ): Promise<Listing[]> {
    const response = await this.elasticsearch.search({
      index: this.INDEX_NAME,
      body: {
        query: {
          more_like_this: {
            fields: ["title", "description", "category", "tags"],
            like: [
              {
                _index: this.INDEX_NAME,
                _id: listingId,
              },
            ],
            min_term_freq: 1,
            min_doc_freq: 1,
            max_query_terms: 12,
          },
        },
        size: limit,
      },
    });

    const listingIds = response.hits.hits.map((hit) => hit._id);

    return await this.prisma.listing.findMany({
      where: { id: { in: listingIds } },
      include: {
        owner: true,
        location: true,
      },
    });
  }

  private transformListingToDocument(listing: any): any {
    return {
      id: listing.id,
      title: listing.title,
      description: listing.description,
      category: listing.category,
      subcategory: listing.subcategory,
      tags: listing.tags || [],

      ownerId: listing.ownerId,
      ownerName: listing.owner.name,
      ownerRating: listing.owner.averageRating,
      ownerVerified: listing.owner.verified,

      location: {
        lat: listing.location.latitude,
        lon: listing.location.longitude,
      },
      locationName: listing.location.formatted,
      city: listing.location.city,
      state: listing.location.state,
      country: listing.location.country,
      postalCode: listing.location.postalCode,

      basePriceAmount: listing.basePrice.amount,
      basePriceCurrency: listing.basePrice.currency,
      pricePerDay: listing.pricing.perDay,
      pricePerWeek: listing.pricing.perWeek,
      pricePerMonth: listing.pricing.perMonth,

      instantBook: listing.bookingMode === "instant-book",
      minimumBookingDuration: listing.minimumBookingDuration,
      maximumBookingDuration: listing.maximumBookingDuration,
      advanceNoticeHours: listing.advanceNoticeHours,

      averageRating: listing.averageRating,
      reviewCount: listing.reviewCount,

      status: listing.status,
      verified: listing.verified,
      featured: listing.featured,

      amenities: listing.amenities.map((a) => a.name),
      features: this.extractCategoryFeatures(listing),

      createdAt: listing.createdAt,
      updatedAt: listing.updatedAt,
      lastBookedAt: listing.lastBookedAt,
      totalBookings: listing.totalBookings,

      boostScore: this.calculateBoostScore(listing),
      popularityScore: this.calculatePopularityScore(listing),
    };
  }

  private extractCategoryFeatures(listing: any): any[] {
    const categoryData = listing.categorySpecificData;
    if (!categoryData) return [];

    return Object.entries(categoryData).map(([key, value]) => ({
      key,
      value: String(value),
      displayValue: this.formatFeatureValue(key, value),
    }));
  }

  private calculateBoostScore(listing: any): number {
    let score = 1.0;

    if (listing.verified) score += 0.5;
    if (listing.featured) score += 1.0;
    if (listing.averageRating >= 4.5) score += 0.3;
    if (listing.reviewCount > 10) score += 0.2;
    if (listing.totalBookings > 50) score += 0.4;

    return score;
  }

  private calculatePopularityScore(listing: any): number {
    const daysSinceCreated = differenceInDays(new Date(), listing.createdAt);
    const bookingsPerDay =
      listing.totalBookings / Math.max(daysSinceCreated, 1);

    return bookingsPerDay * listing.averageRating;
  }
}
```

### 5.3 React Router v7 Search Interface

```typescript
// apps/web/app/routes/search.tsx

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, useSearchParams, useNavigate } from '@remix-run/react';
import { useState, useEffect } from 'react';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);

  const searchParams = {
    query: url.searchParams.get('q') || '',
    category: url.searchParams.get('category') || undefined,
    location: url.searchParams.get('location') || undefined,
    lat: url.searchParams.get('lat') ? parseFloat(url.searchParams.get('lat')!) : undefined,
    lon: url.searchParams.get('lon') ? parseFloat(url.searchParams.get('lon')!) : undefined,
    radius: url.searchParams.get('radius') ? parseInt(url.searchParams.get('radius')!) : 50,
    priceMin: url.searchParams.get('priceMin') ? parseInt(url.searchParams.get('priceMin')!) : undefined,
    priceMax: url.searchParams.get('priceMax') ? parseInt(url.searchParams.get('priceMax')!) : undefined,
    startDate: url.searchParams.get('startDate') || undefined,
    endDate: url.searchParams.get('endDate') || undefined,
    sort: url.searchParams.get('sort') || 'relevance',
    page: url.searchParams.get('page') ? parseInt(url.searchParams.get('page')!) : 1
  };

  // Fetch search results
  const results = await apiClient.search.listings(searchParams);

  return json({ results, searchParams });
}

export default function Search() {
  const { results, searchParams } = useLoaderData<typeof loader>();
  const [searchParamsState, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [filters, setFilters] = useState({
    priceMin: searchParams.priceMin,
    priceMax: searchParams.priceMax,
    instantBook: false,
    verified: false
  });

  // Update URL when filters change
  const updateFilters = (newFilters: Partial<typeof filters>) => {
    const updated = { ...filters, ...newFilters };
    setFilters(updated);

    const params = new URLSearchParams(searchParamsState);
    Object.entries(updated).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, String(value));
      } else {
        params.delete(key);
      }
    });

    navigate(`/search?${params.toString()}`, { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Search Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <input
              type="text"
              defaultValue={searchParams.query}
              placeholder="Search for anything..."
              className="flex-1 px-4 py-2 border rounded-lg"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const params = new URLSearchParams(searchParamsState);
                  params.set('q', e.currentTarget.value);
                  navigate(`/search?${params.toString()}`);
                }
              }}
            />
            <select
              value={searchParams.category || ''}
              onChange={(e) => {
                const params = new URLSearchParams(searchParamsState);
                if (e.target.value) {
                  params.set('category', e.target.value);
                } else {
                  params.delete('category');
                }
                navigate(`/search?${params.toString()}`);
              }}
              className="px-4 py-2 border rounded-lg"
            >
              <option value="">All Categories</option>
              <option value="vehicles">Vehicles</option>
              <option value="spaces">Spaces</option>
              <option value="instruments">Instruments</option>
              <option value="event-venues">Event Venues</option>
              <option value="event-items">Event Items</option>
              <option value="wearables">Wearables</option>
            </select>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Filters Sidebar */}
          <aside className="md:col-span-1">
            <div className="bg-white rounded-lg shadow p-6 sticky top-4">
              <h3 className="font-semibold text-lg mb-4">Filters</h3>

              {/* Price Range */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Price Range</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.priceMin || ''}
                    onChange={(e) => updateFilters({ priceMin: parseInt(e.target.value) || undefined })}
                    className="w-full px-3 py-2 border rounded"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.priceMax || ''}
                    onChange={(e) => updateFilters({ priceMax: parseInt(e.target.value) || undefined })}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
              </div>

              {/* Instant Book */}
              <div className="mb-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={filters.instantBook}
                    onChange={(e) => updateFilters({ instantBook: e.target.checked })}
                  />
                  <span className="text-sm">Instant Book</span>
                </label>
              </div>

              {/* Verified */}
              <div className="mb-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={filters.verified}
                    onChange={(e) => updateFilters({ verified: e.target.checked })}
                  />
                  <span className="text-sm">Verified Only</span>
                </label>
              </div>

              {/* Facets from search results */}
              {results.facets?.categories && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium mb-2">Categories</h4>
                  <div className="space-y-1">
                    {results.facets.categories.map(facet => (
                      <button
                        key={facet.key}
                        className="text-sm text-gray-600 hover:text-blue-600 block"
                        onClick={() => {
                          const params = new URLSearchParams(searchParamsState);
                          params.set('category', facet.key);
                          navigate(`/search?${params.toString()}`);
                        }}
                      >
                        {facet.key} ({facet.doc_count})
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* Results */}
          <main className="md:col-span-3">
            {/* Results Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">
                  {results.total} {results.total === 1 ? 'result' : 'results'}
                </h2>
                {searchParams.query && (
                  <p className="text-gray-600">
                    for "<strong>{searchParams.query}</strong>"
                  </p>
                )}
              </div>

              {/* Sort */}
              <select
                value={searchParams.sort}
                onChange={(e) => {
                  const params = new URLSearchParams(searchParamsState);
                  params.set('sort', e.target.value);
                  navigate(`/search?${params.toString()}`);
                }}
                className="px-4 py-2 border rounded-lg"
              >
                <option value="relevance">Most Relevant</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="rating">Highest Rated</option>
                <option value="newest">Newest</option>
                {searchParams.lat && <option value="distance">Nearest</option>}
              </select>
            </div>

            {/* Listings Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {results.hits.map(listing => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>

            {/* Pagination */}
            {results.total > results.pageSize && (
              <div className="mt-8 flex justify-center">
                <Pagination
                  currentPage={searchParams.page}
                  totalPages={Math.ceil(results.total / results.pageSize)}
                  onPageChange={(page) => {
                    const params = new URLSearchParams(searchParamsState);
                    params.set('page', String(page));
                    navigate(`/search?${params.toString()}`);
                  }}
                />
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function ListingCard({ listing }: { listing: any }) {
  return (
    <a
      href={`/listings/${listing.id}`}
      className="bg-white rounded-lg shadow hover:shadow-lg transition"
    >
      <img
        src={listing.images?.[0] || '/placeholder.jpg'}
        alt={listing.title}
        className="w-full h-48 object-cover rounded-t-lg"
      />
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-lg line-clamp-2">{listing.title}</h3>
          {listing.instantBook && (
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
              Instant
            </span>
          )}
        </div>
        <p className="text-gray-600 text-sm mb-2">{listing.locationName}</p>
        <div className="flex items-center gap-1 mb-3">
          <StarIcon className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-medium">{listing.averageRating?.toFixed(1)}</span>
          <span className="text-sm text-gray-500">({listing.reviewCount})</span>
        </div>
        <div className="text-lg font-bold">
          ${listing.pricePerDay}
          <span className="text-sm font-normal text-gray-600"> / day</span>
        </div>
      </div>
    </a>
  );
}
```

---

## Feature 6: Messaging & Real-time Communication

### 6.1 Socket.io Architecture

```typescript
// apps/api/src/modules/messaging/messaging.gateway.ts

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { UseGuards } from "@nestjs/common";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true,
  },
  namespace: "/messaging",
})
export class MessagingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private redisClient;
  private redisPubClient;
  private redisSubClient;

  constructor(
    private readonly messagingService: MessagingService,
    private readonly presenceService: PresenceService,
    private readonly authService: AuthService,
  ) {}

  async afterInit(server: Server) {
    // Setup Redis adapter for horizontal scaling
    this.redisPubClient = createClient({ url: process.env.REDIS_URL });
    this.redisSubClient = this.redisPubClient.duplicate();

    await Promise.all([
      this.redisPubClient.connect(),
      this.redisSubClient.connect(),
    ]);

    server.adapter(createAdapter(this.redisPubClient, this.redisSubClient));
  }

  async handleConnection(client: Socket) {
    try {
      // Authenticate socket connection
      const token =
        client.handshake.auth.token ||
        client.handshake.headers.authorization?.split(" ")[1];

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = await this.authService.verifyToken(token);

      // Store user info on socket
      client.data.userId = payload.sub;
      client.data.user = payload;

      // Join user-specific room
      client.join(`user:${payload.sub}`);

      // Mark user as online
      await this.presenceService.markOnline(payload.sub, client.id);

      // Get user's conversations
      const conversations = await this.messagingService.getUserConversations(
        payload.sub,
      );

      // Join conversation rooms
      conversations.forEach((conv) => {
        client.join(`conversation:${conv.id}`);
      });

      // Emit connection success
      client.emit("connected", {
        userId: payload.sub,
        conversations: conversations.map((c) => c.id),
      });

      console.log(`User ${payload.sub} connected with socket ${client.id}`);
    } catch (error) {
      console.error("Socket authentication error:", error);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId;

    if (userId) {
      await this.presenceService.markOffline(userId, client.id);
      console.log(`User ${userId} disconnected`);
    }
  }

  @SubscribeMessage("send_message")
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SendMessageDto,
  ) {
    const userId = client.data.userId;

    try {
      // Validate conversation membership
      const conversation = await this.messagingService.getConversation(
        data.conversationId,
      );

      if (!conversation.participants.some((p) => p.userId === userId)) {
        throw new Error("Not a participant");
      }

      // Create message
      const message = await this.messagingService.createMessage({
        conversationId: data.conversationId,
        senderId: userId,
        content: data.content,
        type: data.type || "text",
        attachments: data.attachments,
      });

      // Broadcast to all participants
      this.server
        .to(`conversation:${data.conversationId}`)
        .emit("new_message", {
          conversationId: data.conversationId,
          message: this.serializeMessage(message),
        });

      // Send push notification to offline participants
      const offlineParticipants = conversation.participants.filter(
        (p) => p.userId !== userId && !this.presenceService.isOnline(p.userId),
      );

      for (const participant of offlineParticipants) {
        await this.notificationService.sendPush({
          userId: participant.userId,
          title: `New message from ${client.data.user.name}`,
          body: message.content.substring(0, 100),
          data: {
            type: "new_message",
            conversationId: data.conversationId,
            messageId: message.id,
          },
        });
      }

      return { success: true, messageId: message.id };
    } catch (error) {
      client.emit("error", { message: error.message });
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage("typing_start")
  async handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = client.data.userId;

    // Broadcast typing indicator to others in conversation
    client.to(`conversation:${data.conversationId}`).emit("user_typing", {
      conversationId: data.conversationId,
      userId,
      userName: client.data.user.name,
    });
  }

  @SubscribeMessage("typing_stop")
  async handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = client.data.userId;

    client
      .to(`conversation:${data.conversationId}`)
      .emit("user_stopped_typing", {
        conversationId: data.conversationId,
        userId,
      });
  }

  @SubscribeMessage("mark_as_read")
  async handleMarkAsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; messageId: string },
  ) {
    const userId = client.data.userId;

    await this.messagingService.markAsRead(
      data.conversationId,
      userId,
      data.messageId,
    );

    // Notify sender that message was read
    this.server.to(`conversation:${data.conversationId}`).emit("message_read", {
      conversationId: data.conversationId,
      messageId: data.messageId,
      readBy: userId,
    });
  }

  @SubscribeMessage("join_conversation")
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    client.join(`conversation:${data.conversationId}`);
    return { success: true };
  }

  @SubscribeMessage("leave_conversation")
  async handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    client.leave(`conversation:${data.conversationId}`);
    return { success: true };
  }

  // Helper to emit to specific user across all their connections
  emitToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  // Helper to emit to conversation
  emitToConversation(conversationId: string, event: string, data: any) {
    this.server.to(`conversation:${conversationId}`).emit(event, data);
  }

  private serializeMessage(message: any) {
    return {
      id: message.id,
      content: message.content,
      type: message.type,
      senderId: message.senderId,
      senderName: message.sender.name,
      attachments: message.attachments,
      createdAt: message.createdAt,
      readBy: message.readReceipts.map((r) => r.userId),
    };
  }
}
```

### 6.2 Messaging Service

```typescript
// apps/api/src/modules/messaging/services/messaging.service.ts

@Injectable()
export class MessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  // Create or get conversation between booking participants
  async getOrCreateConversation(
    bookingId: string,
    participantIds: string[],
  ): Promise<Conversation> {
    // Check if conversation exists
    const existing = await this.prisma.conversation.findFirst({
      where: {
        bookingId,
        participants: {
          every: {
            userId: { in: participantIds },
          },
        },
      },
      include: {
        participants: {
          include: { user: true },
        },
      },
    });

    if (existing) {
      return existing;
    }

    // Create new conversation
    return await this.prisma.conversation.create({
      data: {
        bookingId,
        type: "booking",
        participants: {
          create: participantIds.map((userId) => ({
            userId,
            role: "member",
          })),
        },
      },
      include: {
        participants: {
          include: { user: true },
        },
      },
    });
  }

  // Create message
  async createMessage(data: CreateMessageDto): Promise<Message> {
    return await this.prisma.$transaction(async (tx) => {
      // Create message
      const message = await tx.message.create({
        data: {
          conversationId: data.conversationId,
          senderId: data.senderId,
          content: data.content,
          type: data.type,
          attachments: data.attachments || [],
          metadata: data.metadata,
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
      });

      // Update conversation last message
      await tx.conversation.update({
        where: { id: data.conversationId },
        data: {
          lastMessageAt: new Date(),
          lastMessagePreview: data.content.substring(0, 100),
        },
      });

      // Increment unread count for all participants except sender
      await tx.conversationParticipant.updateMany({
        where: {
          conversationId: data.conversationId,
          userId: { not: data.senderId },
        },
        data: {
          unreadCount: { increment: 1 },
        },
      });

      return message;
    });
  }

  // Mark messages as read
  async markAsRead(
    conversationId: string,
    userId: string,
    upToMessageId?: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Get messages to mark as read
      const where: any = {
        conversationId,
        senderId: { not: userId },
      };

      if (upToMessageId) {
        const message = await tx.message.findUnique({
          where: { id: upToMessageId },
          select: { createdAt: true },
        });
        where.createdAt = { lte: message.createdAt };
      }

      const unreadMessages = await tx.message.findMany({ where });

      // Create read receipts
      await tx.messageReadReceipt.createMany({
        data: unreadMessages.map((msg) => ({
          messageId: msg.id,
          userId,
          readAt: new Date(),
        })),
        skipDuplicates: true,
      });

      // Reset unread count
      await tx.conversationParticipant.update({
        where: {
          conversationId_userId: {
            conversationId,
            userId,
          },
        },
        data: {
          unreadCount: 0,
          lastReadAt: new Date(),
        },
      });
    });
  }

  // Get conversation messages (paginated)
  async getMessages(
    conversationId: string,
    userId: string,
    pagination: { cursor?: string; limit?: number },
  ): Promise<PaginatedMessages> {
    const limit = pagination.limit || 50;

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        // Ensure user is a participant
        conversation: {
          participants: {
            some: { userId },
          },
        },
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        readReceipts: {
          select: {
            userId: true,
            readAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      cursor: pagination.cursor ? { id: pagination.cursor } : undefined,
    });

    const hasMore = messages.length > limit;
    const items = hasMore ? messages.slice(0, -1) : messages;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return {
      items: items.reverse(), // Return in chronological order
      nextCursor,
      hasMore,
    };
  }

  // Get user's conversations
  async getUserConversations(userId: string): Promise<Conversation[]> {
    return await this.prisma.conversation.findMany({
      where: {
        participants: {
          some: { userId },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
        },
        booking: {
          select: {
            id: true,
            listing: {
              select: {
                id: true,
                title: true,
                images: true,
              },
            },
          },
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { lastMessageAt: "desc" },
    });
  }

  // Upload message attachment
  async uploadAttachment(
    file: Express.Multer.File,
    userId: string,
  ): Promise<Attachment> {
    const path = `messages/${userId}/${Date.now()}-${file.originalname}`;

    const uploaded = await this.storageService.upload({
      file: file.buffer,
      path,
      contentType: file.mimetype,
      metadata: {
        uploadedBy: userId,
        originalName: file.originalname,
      },
    });

    return {
      id: crypto.randomUUID(),
      url: uploaded.url,
      type: this.detectAttachmentType(file.mimetype),
      name: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
    };
  }

  private detectAttachmentType(mimeType: string): string {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("video/")) return "video";
    if (mimeType.startsWith("audio/")) return "audio";
    if (mimeType === "application/pdf") return "pdf";
    return "file";
  }
}
```

### 6.3 Contact Privacy & Masking

```typescript
// apps/api/src/modules/messaging/services/contact-privacy.service.ts

@Injectable()
export class ContactPrivacyService {
  constructor(private readonly prisma: PrismaService) {}

  // Mask contact information in messages
  maskContactInfo(content: string): { masked: string; violations: string[] } {
    const violations: string[] = [];
    let masked = content;

    // Email patterns
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    if (emailPattern.test(masked)) {
      violations.push("email");
      masked = masked.replace(emailPattern, "[email hidden]");
    }

    // Phone patterns (various formats)
    const phonePatterns = [
      /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, // 123-456-7890
      /\(\d{3}\)\s*\d{3}[-.]?\d{4}/g, // (123) 456-7890
      /\b\d{10}\b/g, // 1234567890
    ];

    phonePatterns.forEach((pattern) => {
      if (pattern.test(masked)) {
        violations.push("phone");
        masked = masked.replace(pattern, "[phone hidden]");
      }
    });

    // Social media handles
    const socialPattern = /@[a-zA-Z0-9._]{3,}/g;
    if (socialPattern.test(masked)) {
      violations.push("social_media");
      masked = masked.replace(socialPattern, "[social hidden]");
    }

    // URLs
    const urlPattern = /https?:\/\/[^\s]+/g;
    if (urlPattern.test(masked)) {
      violations.push("url");
      masked = masked.replace(urlPattern, "[link hidden]");
    }

    return { masked, violations };
  }

  // Check if booking allows direct contact
  async canShareContact(bookingId: string): Promise<boolean> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    // Allow contact sharing only after booking is confirmed
    return booking.status === "CONFIRMED" || booking.status === "IN_PROGRESS";
  }

  // Generate temporary proxy email for communication
  async generateProxyEmail(bookingId: string, userId: string): Promise<string> {
    const proxy = await this.prisma.proxyEmail.create({
      data: {
        bookingId,
        userId,
        proxyAddress: `booking-${bookingId}-${userId.slice(0, 8)}@messages.platform.com`,
        expiresAt: addMonths(new Date(), 3),
      },
    });

    return proxy.proxyAddress;
  }
}
```

---

## Feature 7: Fulfillment & Condition Reports

### 7.1 Condition Report Service

```typescript
// apps/api/src/modules/fulfillment/services/condition-report.service.ts

@Injectable()
export class ConditionReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly notificationService: NotificationService,
  ) {}

  // Create condition report
  async createReport(data: CreateConditionReportDto): Promise<ConditionReport> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: data.bookingId },
      include: {
        listing: {
          include: { category: true },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException("Booking not found");
    }

    // Get category-specific checklist
    const checklist = await this.getChecklistForCategory(
      booking.listing.category.slug,
      data.reportType,
    );

    const report = await this.prisma.conditionReport.create({
      data: {
        bookingId: data.bookingId,
        reportType: data.reportType,
        reportedBy: data.reportedBy,
        checklist,
        status: "in_progress",
        dueDate: this.calculateDueDate(booking, data.reportType),
      },
    });

    // Notify responsible party
    await this.notifyReportCreated(report, booking);

    return report;
  }

  // Submit checklist items
  async submitChecklistItems(
    reportId: string,
    items: ChecklistItemSubmission[],
  ): Promise<ConditionReport> {
    return await this.prisma.$transaction(async (tx) => {
      const report = await tx.conditionReport.findUnique({
        where: { id: reportId },
        include: { booking: true },
      });

      if (!report) {
        throw new NotFoundException("Report not found");
      }

      if (report.status !== "in_progress") {
        throw new BadRequestException("Report is not in progress");
      }

      // Update checklist items
      const updatedChecklist = report.checklist.map((item) => {
        const submission = items.find((s) => s.itemId === item.id);
        if (submission) {
          return {
            ...item,
            status: submission.status,
            notes: submission.notes,
            photos: submission.photos,
            completedAt: new Date(),
          };
        }
        return item;
      });

      // Check if all required items are complete
      const allComplete = updatedChecklist
        .filter((item) => item.required)
        .every((item) => item.status !== "pending");

      return await tx.conditionReport.update({
        where: { id: reportId },
        data: {
          checklist: updatedChecklist,
          status: allComplete ? "submitted" : "in_progress",
          submittedAt: allComplete ? new Date() : null,
        },
      });
    });
  }

  // Upload evidence photo
  async uploadPhoto(
    reportId: string,
    file: Express.Multer.File,
    metadata: PhotoMetadata,
  ): Promise<ReportPhoto> {
    const report = await this.prisma.conditionReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException("Report not found");
    }

    // Upload to storage
    const path = `condition-reports/${reportId}/${Date.now()}-${file.originalname}`;

    const uploaded = await this.storageService.upload({
      file: file.buffer,
      path,
      contentType: file.mimetype,
      metadata: {
        reportId,
        itemId: metadata.itemId,
        uploadedBy: metadata.uploadedBy,
        timestamp: new Date().toISOString(),
      },
    });

    // Create photo record
    const photo = await this.prisma.reportPhoto.create({
      data: {
        reportId,
        url: uploaded.url,
        thumbnailUrl: await this.generateThumbnail(uploaded.url),
        itemId: metadata.itemId,
        caption: metadata.caption,
        uploadedBy: metadata.uploadedBy,
        metadata: {
          originalName: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
          dimensions: await this.getImageDimensions(file.buffer),
        },
      },
    });

    return photo;
  }

  // Confirm/approve report (by other party)
  async confirmReport(
    reportId: string,
    confirmedBy: string,
    notes?: string,
  ): Promise<ConditionReport> {
    return await this.prisma.$transaction(async (tx) => {
      const report = await tx.conditionReport.findUnique({
        where: { id: reportId },
        include: { booking: true },
      });

      if (!report) {
        throw new NotFoundException("Report not found");
      }

      if (report.status !== "submitted") {
        throw new BadRequestException("Report must be submitted first");
      }

      // Update report
      const updated = await tx.conditionReport.update({
        where: { id: reportId },
        data: {
          status: "confirmed",
          confirmedBy,
          confirmedAt: new Date(),
          confirmationNotes: notes,
        },
      });

      // Check if this triggers booking state transition
      await this.checkBookingTransition(report.booking, updated);

      return updated;
    });
  }

  // Dispute report (if issues found)
  async disputeReport(
    reportId: string,
    disputedBy: string,
    reason: string,
    evidence: DisputeEvidence[],
  ): Promise<ConditionReport> {
    return await this.prisma.$transaction(async (tx) => {
      const report = await tx.conditionReport.findUnique({
        where: { id: reportId },
        include: { booking: true },
      });

      if (!report) {
        throw new NotFoundException("Report not found");
      }

      // Update report status
      const updated = await tx.conditionReport.update({
        where: { id: reportId },
        data: {
          status: "disputed",
          disputedBy,
          disputedAt: new Date(),
          disputeReason: reason,
          disputeEvidence: evidence,
        },
      });

      // Create dispute case
      await tx.dispute.create({
        data: {
          bookingId: report.bookingId,
          initiatedBy: disputedBy,
          type: "condition_dispute",
          reason,
          evidence: {
            conditionReportId: reportId,
            additionalEvidence: evidence,
          },
          status: "open",
        },
      });

      // Notify admin team
      await this.notificationService.send({
        channel: "admin",
        type: "condition_report_disputed",
        data: {
          reportId,
          bookingId: report.bookingId,
          reason,
        },
      });

      return updated;
    });
  }

  // Get category-specific checklist
  private async getChecklistForCategory(
    categorySlug: string,
    reportType: "check_in" | "check_out",
  ): Promise<ChecklistItem[]> {
    const checklists = {
      vehicles: {
        check_in: [
          {
            id: "exterior",
            label: "Exterior condition",
            description: "Check for scratches, dents, damage",
            required: true,
            type: "photo_required",
            areas: ["front", "back", "left_side", "right_side", "top"],
          },
          {
            id: "interior",
            label: "Interior condition",
            description: "Check seats, dashboard, cleanliness",
            required: true,
            type: "photo_required",
            areas: ["front_seats", "back_seats", "dashboard", "trunk"],
          },
          {
            id: "fuel_level",
            label: "Fuel level",
            description: "Document current fuel level",
            required: true,
            type: "photo_required",
          },
          {
            id: "mileage",
            label: "Odometer reading",
            description: "Document current mileage",
            required: true,
            type: "photo_required",
          },
          {
            id: "accessories",
            label: "Accessories present",
            description: "Check all included items are present",
            required: true,
            type: "checklist",
            items: ["spare_tire", "jack", "manual", "keys", "registration"],
          },
        ],
        check_out: [
          // Similar items plus:
          {
            id: "return_fuel",
            label: "Fuel level at return",
            description: "Verify fuel policy compliance",
            required: true,
            type: "photo_required",
          },
          {
            id: "return_mileage",
            label: "Odometer at return",
            description: "Verify mileage limit compliance",
            required: true,
            type: "photo_required",
          },
          {
            id: "cleanliness",
            label: "Vehicle cleanliness",
            description: "Interior and exterior cleaning check",
            required: true,
            type: "rating",
          },
        ],
      },
      instruments: {
        check_in: [
          {
            id: "physical_condition",
            label: "Physical condition",
            description: "Check for scratches, dents, cracks",
            required: true,
            type: "photo_required",
          },
          {
            id: "functionality",
            label: "Functionality test",
            description: "Test all keys, strings, valves, etc.",
            required: true,
            type: "checklist",
          },
          {
            id: "accessories",
            label: "Included accessories",
            description: "Verify all accessories present",
            required: true,
            type: "checklist",
          },
        ],
        check_out: [], // Similar structure
      },
      spaces: {
        check_in: [
          {
            id: "overall_condition",
            label: "Overall space condition",
            description: "General cleanliness and order",
            required: true,
            type: "photo_required",
          },
          {
            id: "furniture",
            label: "Furniture condition",
            description: "Check all furniture items",
            required: true,
            type: "checklist",
          },
          {
            id: "appliances",
            label: "Appliances working",
            description: "Test all provided appliances",
            required: true,
            type: "checklist",
          },
        ],
        check_out: [],
      },
      // Add for other categories...
    };

    return checklists[categorySlug]?.[reportType] || [];
  }

  private calculateDueDate(
    booking: Booking,
    reportType: "check_in" | "check_out",
  ): Date {
    if (reportType === "check_in") {
      // Due at start date
      return booking.startDate;
    } else {
      // Due 24 hours after end date
      return addHours(booking.endDate, 24);
    }
  }

  private async checkBookingTransition(
    booking: Booking,
    report: ConditionReport,
  ): Promise<void> {
    // If check-in report confirmed, transition to IN_PROGRESS
    if (report.reportType === "check_in" && report.status === "confirmed") {
      await this.bookingStateMachine.transition(
        booking.id,
        BookingStatus.IN_PROGRESS,
        {
          triggeredBy: "system",
          reason: "Check-in report confirmed",
        },
      );
    }

    // If check-out report confirmed, transition to COMPLETED
    if (report.reportType === "check_out" && report.status === "confirmed") {
      await this.bookingStateMachine.transition(
        booking.id,
        BookingStatus.COMPLETED,
        {
          triggeredBy: "system",
          reason: "Check-out report confirmed",
        },
      );
    }
  }
}
```

### 7.2 React Native Condition Report Capture

```typescript
// apps/mobile/src/screens/ConditionReportScreen.tsx

import React, { useState, useEffect } from 'react';
import { View, ScrollView, Text, TouchableOpacity, Image } from 'react-native';
import { Camera, CameraType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute } from '@react-navigation/native';

export function ConditionReportScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { bookingId, reportType } = route.params;

  const [report, setReport] = useState(null);
  const [checklist, setChecklist] = useState([]);
  const [currentItem, setCurrentItem] = useState(0);
  const [photos, setPhotos] = useState<Record<string, string[]>>({});
  const [cameraVisible, setCameraVisible] = useState(false);
  const [hasPermission, setHasPermission] = useState(null);

  useEffect(() => {
    loadReport();
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === 'granted');
  };

  const loadReport = async () => {
    const data = await apiClient.conditionReports.getOrCreate(bookingId, reportType);
    setReport(data);
    setChecklist(data.checklist);
  };

  const capturePhoto = async (itemId: string) => {
    if (!hasPermission) {
      alert('Camera permission required');
      return;
    }

    // Open camera
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3]
    });

    if (!result.canceled) {
      const photoUri = result.assets[0].uri;

      // Upload photo
      const uploaded = await apiClient.conditionReports.uploadPhoto(
        report.id,
        photoUri,
        { itemId, uploadedBy: userId }
      );

      // Add to state
      setPhotos(prev => ({
        ...prev,
        [itemId]: [...(prev[itemId] || []), uploaded.url]
      }));
    }
  };

  const submitItem = async (itemId: string, status: string, notes: string) => {
    await apiClient.conditionReports.submitItem(report.id, {
      itemId,
      status,
      notes,
      photos: photos[itemId] || []
    });

    // Move to next item
    if (currentItem < checklist.length - 1) {
      setCurrentItem(currentItem + 1);
    } else {
      // All items complete
      await finalizeReport();
    }
  };

  const finalizeReport = async () => {
    await apiClient.conditionReports.submit(report.id);

    navigation.navigate('BookingDetails', { bookingId });
  };

  const item = checklist[currentItem];

  return (
    <ScrollView className="flex-1 bg-white">
      {/* Progress */}
      <View className="bg-blue-50 p-4">
        <Text className="text-sm text-gray-600 mb-2">
          Step {currentItem + 1} of {checklist.length}
        </Text>
        <View className="h-2 bg-gray-200 rounded-full">
          <View
            className="h-2 bg-blue-600 rounded-full"
            style={{ width: `${((currentItem + 1) / checklist.length) * 100}%` }}
          />
        </View>
      </View>

      {/* Current Item */}
      <View className="p-6">
        <Text className="text-2xl font-bold mb-2">{item.label}</Text>
        <Text className="text-gray-600 mb-6">{item.description}</Text>

        {/* Photo capture */}
        {item.type === 'photo_required' && (
          <View className="mb-6">
            <Text className="font-semibold mb-3">Take photos:</Text>

            {item.areas?.map(area => (
              <View key={area} className="mb-4">
                <Text className="text-sm text-gray-700 mb-2 capitalize">
                  {area.replace('_', ' ')}
                </Text>

                {photos[`${item.id}_${area}`]?.map((photoUrl, idx) => (
                  <Image
                    key={idx}
                    source={{ uri: photoUrl }}
                    className="w-full h-48 rounded-lg mb-2"
                  />
                ))}

                <TouchableOpacity
                  onPress={() => capturePhoto(`${item.id}_${area}`)}
                  className="bg-blue-600 py-3 rounded-lg"
                >
                  <Text className="text-white text-center font-semibold">
                    📷 Capture {area.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Checklist items */}
        {item.type === 'checklist' && (
          <View className="mb-6">
            {item.items?.map(subItem => (
              <CheckboxItem
                key={subItem}
                label={subItem.replace('_', ' ')}
                checked={checkedItems[subItem]}
                onChange={(checked) =>
                  setCheckedItems(prev => ({ ...prev, [subItem]: checked }))
                }
              />
            ))}
          </View>
        )}

        {/* Notes */}
        <View className="mb-6">
          <Text className="font-semibold mb-2">Notes (optional):</Text>
          <TextInput
            multiline
            numberOfLines={4}
            className="border border-gray-300 rounded-lg p-3"
            placeholder="Add any additional notes..."
            value={notes[item.id] || ''}
            onChangeText={(text) =>
              setNotes(prev => ({ ...prev, [item.id]: text }))
            }
          />
        </View>

        {/* Status buttons */}
        <View className="space-y-3">
          <TouchableOpacity
            onPress={() => submitItem(item.id, 'good', notes[item.id])}
            className="bg-green-600 py-4 rounded-lg"
          >
            <Text className="text-white text-center font-semibold text-lg">
              ✓ Good Condition
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => submitItem(item.id, 'minor_issue', notes[item.id])}
            className="bg-yellow-600 py-4 rounded-lg"
          >
            <Text className="text-white text-center font-semibold text-lg">
              ⚠ Minor Issues
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => submitItem(item.id, 'damaged', notes[item.id])}
            className="bg-red-600 py-4 rounded-lg"
          >
            <Text className="text-white text-center font-semibold text-lg">
              ✕ Damaged
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
```

---

**Status:** Part 3 completed with Features 5-7 (Search, Messaging, Fulfillment). Ready to create Part 4 with Features 8-10 and infrastructure details. Should I continue?
