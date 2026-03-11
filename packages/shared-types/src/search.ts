// ============================================================================
// Search Types (mobile + web search contracts)
// ============================================================================

export type SearchSort =
  | 'relevance'
  | 'price_asc'
  | 'price_desc'
  | 'rating'
  | 'newest';

export interface SearchParams {
  query?: string;
  categoryId?: string;
  lat?: number;
  lon?: number;
  radius?: number;
  minPrice?: number;
  maxPrice?: number;
  bookingMode?: string;
  condition?: string;
  features?: string[];
  sort?: SearchSort;
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
  location?: { lat?: number; lon?: number };
  basePrice: number;
  currency: string;
  photos: string[];
  ownerName: string;
  ownerRating: number;
  averageRating: number;
  totalReviews: number;
  pricingMode?: string;
  bookingMode?: string;
  condition?: string;
  features?: string[];
  score?: number;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  size: number;
  aggregations?: unknown;
}
