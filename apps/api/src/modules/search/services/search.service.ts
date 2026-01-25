import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { PrismaService } from '../../../common/prisma/prisma.service';

export interface SearchQuery {
  query?: string;
  categoryId?: string;
  location?: {
    lat: number;
    lon: number;
    radius?: string; // e.g., "10km"
  };
  priceRange?: {
    min?: number;
    max?: number;
  };
  dates?: {
    startDate: Date;
    endDate: Date;
  };
  filters?: {
    bookingMode?: string;
    condition?: string;
    features?: string[];
    amenities?: string[];
  };
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'rating' | 'newest';
  page?: number;
  size?: number;
}

export interface SearchResult {
  id: string;
  title: string;
  description: string;
  slug: string;
  categoryName: string;
  categorySlug: string;
  city: string;
  state: string;
  country: string;
  location: {
    lat: number;
    lon: number;
  };
  basePrice: number;
  currency: string;
  photos: any[];
  ownerName: string;
  ownerRating: number;
  averageRating: number;
  totalReviews: number;
  bookingMode: string;
  condition?: string;
  features: string[];
  score?: number;
  distance?: number;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly indexName = 'listings';

  constructor(
    private readonly elasticsearch: ElasticsearchService,
    private readonly prisma: PrismaService,
  ) {}

  async search(searchQuery: SearchQuery): Promise<{
    results: SearchResult[];
    total: number;
    page: number;
    size: number;
    aggregations?: any;
  }> {
    const page = searchQuery.page || 1;
    const size = searchQuery.size || 20;
    const from = (page - 1) * size;

    // Build Elasticsearch query
    const must: any[] = [
      { term: { status: 'ACTIVE' } },
      { term: { verificationStatus: 'VERIFIED' } },
    ];

    const filter: any[] = [];
    const should: any[] = [];

    // Text search
    if (searchQuery.query) {
      should.push(
        {
          multi_match: {
            query: searchQuery.query,
            fields: ['title^3', 'description^2', 'categoryName', 'city', 'features'],
            type: 'best_fields',
            fuzziness: 'AUTO',
          },
        },
        {
          match_phrase: {
            title: {
              query: searchQuery.query,
              boost: 5,
            },
          },
        },
      );
    }

    // Category filter
    if (searchQuery.categoryId) {
      filter.push({ term: { categoryId: searchQuery.categoryId } });
    }

    // Location search with geo distance
    if (searchQuery.location) {
      filter.push({
        geo_distance: {
          distance: searchQuery.location.radius || '50km',
          location: {
            lat: searchQuery.location.lat,
            lon: searchQuery.location.lon,
          },
        },
      });
    }

    // Price range
    if (searchQuery.priceRange) {
      const priceFilter: any = {};
      if (searchQuery.priceRange.min !== undefined) {
        priceFilter.gte = searchQuery.priceRange.min;
      }
      if (searchQuery.priceRange.max !== undefined) {
        priceFilter.lte = searchQuery.priceRange.max;
      }
      if (Object.keys(priceFilter).length > 0) {
        filter.push({ range: { basePrice: priceFilter } });
      }
    }

    // Additional filters
    if (searchQuery.filters) {
      if (searchQuery.filters.bookingMode) {
        filter.push({ term: { bookingMode: searchQuery.filters.bookingMode } });
      }
      if (searchQuery.filters.condition) {
        filter.push({ term: { condition: searchQuery.filters.condition } });
      }
      if (searchQuery.filters.features && searchQuery.filters.features.length > 0) {
        filter.push({ terms: { features: searchQuery.filters.features } });
      }
    }

    // Build sort
    const sort: any[] = [];
    switch (searchQuery.sort) {
      case 'price_asc':
        sort.push({ basePrice: 'asc' });
        break;
      case 'price_desc':
        sort.push({ basePrice: 'desc' });
        break;
      case 'rating':
        sort.push({ averageRating: 'desc' });
        break;
      case 'newest':
        sort.push({ createdAt: 'desc' });
        break;
      default:
        sort.push('_score');
    }

    // Add distance sort if location provided
    if (searchQuery.location) {
      sort.unshift({
        _geo_distance: {
          location: {
            lat: searchQuery.location.lat,
            lon: searchQuery.location.lon,
          },
          order: 'asc',
          unit: 'km',
        },
      });
    }

    // Build Elasticsearch query
    const esQuery: any = {
      bool: {
        must,
        filter,
      },
    };

    if (should.length > 0) {
      esQuery.bool.should = should;
      esQuery.bool.minimum_should_match = 1;
    }

    try {
      const response = await this.elasticsearch.search({
        index: this.indexName,
        body: {
          query: esQuery,
          sort,
          from,
          size,
          track_scores: true,
          aggs: {
            categories: {
              terms: { field: 'categoryId', size: 20 },
            },
            priceRanges: {
              histogram: {
                field: 'basePrice',
                interval: 50,
              },
            },
            cities: {
              terms: { field: 'city.keyword', size: 20 },
            },
            conditions: {
              terms: { field: 'condition', size: 10 },
            },
          },
        },
      } as any);

      const results: SearchResult[] = response.hits.hits.map((hit: any) => ({
        ...hit._source,
        score: hit._score,
        distance:
          hit.sort && hit.sort.length > 0 && hit.sort[0] !== hit._score ? hit.sort[0] : undefined,
      }));

      return {
        results,
        total: (response.hits.total as any).value || 0,
        page,
        size,
        aggregations: response.aggregations,
      };
    } catch (error) {
      this.logger.error('Elasticsearch search failed', error);
      throw error;
    }
  }

  async autocomplete(query: string, limit: number = 10): Promise<string[]> {
    try {
      const response = await this.elasticsearch.search({
        index: this.indexName,
        body: {
          query: {
            bool: {
              must: [
                { term: { status: 'ACTIVE' } },
                {
                  multi_match: {
                    query,
                    fields: ['title', 'categoryName', 'city'],
                    type: 'phrase_prefix',
                  },
                },
              ],
            },
          },
          size: limit,
          _source: ['title'],
        } as any,
      } as any);

      return response.hits.hits.map((hit: any) => hit._source.title);
    } catch (error) {
      this.logger.error('Autocomplete search failed', error);
      return [];
    }
  }

  async getSuggestions(query: string): Promise<{
    listings: any[];
    categories: any[];
    locations: any[];
  }> {
    try {
      const [listings, categories, locations] = await Promise.all([
        this.elasticsearch.search({
          index: this.indexName,
          body: {
            query: {
              bool: {
                must: [
                  { term: { status: 'ACTIVE' } },
                  {
                    multi_match: {
                      query,
                      fields: ['title^2', 'description'],
                      fuzziness: 'AUTO',
                    },
                  },
                ],
              },
            },
            size: 5,
            _source: ['id', 'title', 'slug', 'photos', 'basePrice', 'currency'],
          },
        } as any),
        this.elasticsearch.search({
          index: this.indexName,
          body: {
            query: {
              match: { categoryName: query },
            },
            aggs: {
              categories: {
                terms: { field: 'categoryName.keyword', size: 5 },
              },
            },
            size: 0,
          },
        } as any),
        this.elasticsearch.search({
          index: this.indexName,
          body: {
            query: {
              multi_match: {
                query,
                fields: ['city', 'state', 'country'],
              },
            },
            aggs: {
              locations: {
                terms: {
                  field: 'city.keyword',
                  size: 5,
                },
              },
            },
            size: 0,
          },
        } as any),
      ]);

      return {
        listings: listings.hits.hits.map((hit: any) => hit._source),
        categories: (categories.aggregations as any)?.categories?.buckets || [],
        locations: (locations.aggregations as any)?.locations?.buckets || [],
      };
    } catch (error) {
      this.logger.error('Get suggestions failed', error);
      return { listings: [], categories: [], locations: [] };
    }
  }

  async findSimilar(listingId: string, limit: number = 10): Promise<SearchResult[]> {
    try {
      // Get the listing
      const listing = await this.elasticsearch.get({
        index: this.indexName,
        id: listingId,
      });

      const source = listing._source as any;

      // Find similar listings
      const response = await this.elasticsearch.search({
        index: this.indexName,
        body: {
          query: {
            bool: {
              must: [{ term: { status: 'ACTIVE' } }, { term: { categoryId: source.categoryId } }],
              should: [
                {
                  more_like_this: {
                    fields: ['title', 'description', 'features'],
                    like: [{ _index: this.indexName, _id: listingId }],
                    min_term_freq: 1,
                    min_doc_freq: 1,
                  },
                },
                {
                  geo_distance: {
                    distance: '50km',
                    location: source.location,
                  },
                },
              ],
              must_not: [{ term: { id: listingId } }],
            },
          },
          size: limit,
        },
      } as any);

      return response.hits.hits.map((hit: any) => ({
        ...hit._source,
        score: hit._score,
      }));
    } catch (error) {
      this.logger.error('Find similar failed', error);
      return [];
    }
  }

  async getPopularSearches(limit: number = 10): Promise<string[]> {
    // This would typically come from analytics/tracking
    // For now, return most common search terms from aggregations
    return [
      'apartment',
      'car',
      'camera',
      'bike',
      'guitar',
      'wedding venue',
      'tools',
      'camping gear',
      'party supplies',
      'kayak',
    ].slice(0, limit);
  }
}
