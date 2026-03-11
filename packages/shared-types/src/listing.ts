// ============================================================================
// Listing Types
// Shared contract for listing data between frontend and backend
// ============================================================================

import type { PaginationParams } from './api';
import { PropertyCondition } from './enums';

// ---------------------------------------------------------------------------
// Condition mapping helpers
// The API returns raw Prisma enum values (EXCELLENT, GOOD, FAIR, POOR).
// Frontends display friendlier labels (new, like-new, good, fair, poor).
// ---------------------------------------------------------------------------

/** Lowercase condition labels used by frontends */
export type FrontendCondition = 'new' | 'like-new' | 'good' | 'fair' | 'poor';

/** Union of API (DB) values and frontend-friendly values */
export type ListingConditionValue = PropertyCondition | FrontendCondition;

/** Map a raw DB condition to the frontend-friendly label */
export function normalizeCondition(
  condition?: string | null,
): FrontendCondition {
  const upper = String(condition ?? '').toUpperCase();
  if (upper === 'EXCELLENT') return 'new';
  if (upper === 'GOOD') return 'good';
  if (upper === 'FAIR') return 'fair';
  if (upper === 'POOR') return 'poor';
  // already a frontend value – pass through
  const lower = String(condition ?? '').toLowerCase();
  if (['new', 'like-new', 'good', 'fair', 'poor'].includes(lower))
    return lower as FrontendCondition;
  return 'good'; // safe default
}

/** Listing image */
export interface ListingImage {
  url: string;
  caption?: string;
  order?: number;
}

/** Listing location */
export interface ListingLocation {
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

/** Delivery options */
export interface DeliveryOptions {
  pickup: boolean;
  delivery: boolean;
  shipping: boolean;
}

/** Full listing record (as returned by API) */
export interface Listing {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  category: string | { id: string; name: string; slug: string };
  subcategory: string | null;
  basePrice: number;
  pricePerWeek: number | null;
  pricePerMonth: number | null;
  currency: string;
  condition: ListingConditionValue;
  location: {
    address: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    coordinates: {
      lat: number;
      lng: number;
    };
  };
  photos: string[];
  images?: string[];
  categoryId?: string;
  availability: 'available' | 'rented' | 'maintenance' | 'unavailable';
  status?:
    | 'AVAILABLE'
    | 'RENTED'
    | 'MAINTENANCE'
    | 'UNAVAILABLE'
    | 'DRAFT'
    | 'SUSPENDED'
    | 'ARCHIVED';
  availabilitySchedule: {
    startDate: string | null;
    endDate: string | null;
  };
  instantBooking: boolean;
  deliveryOptions: {
    pickup: boolean;
    delivery: boolean;
    shipping: boolean;
  };
  deliveryRadius: number | null;
  deliveryFee: number | null;
  securityDeposit: number;
  minimumRentalPeriod: number;
  maximumRentalPeriod: number | null;
  cancellationPolicy: 'flexible' | 'moderate' | 'strict';
  rules: string | null;
  features: string[];
  rating: number | null;
  totalReviews: number;
  totalBookings: number;
  totalEarnings?: number;
  views: number;
  featured: boolean;
  verified: boolean;
  categorySlug?: string | null;
  categorySpecificData?: Record<string, unknown>;
  owner: {
    id: string;
    firstName: string;
    lastName: string | null;
    avatar: string | null;
    rating: number | null;
    verified: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

/** Create listing request body */
export interface CreateListingRequest {
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  basePrice: number;
  pricePerWeek?: number;
  pricePerMonth?: number;
  condition: ListingConditionValue;
  location: {
    address: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    coordinates: {
      lat: number;
      lng: number;
    };
  };
  photos: string[];
  instantBooking?: boolean;
  deliveryOptions: {
    pickup: boolean;
    delivery: boolean;
    shipping: boolean;
  };
  deliveryRadius?: number;
  deliveryFee?: number;
  securityDeposit: number;
  minimumRentalPeriod: number;
  maximumRentalPeriod?: number;
  cancellationPolicy: 'flexible' | 'moderate' | 'strict';
  rules?: string;
  features?: string[];
  categorySpecificData?: Record<string, unknown>;
}

/** Update listing request body */
export type UpdateListingRequest = Partial<CreateListingRequest>;

/** Listing search response */
export interface ListingSearchResponse {
  listings: Listing[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  facets?: {
    categories: { name: string; count: number }[];
    conditions: { name: string; count: number }[];
    priceRanges: { min: number; max: number; count: number }[];
  };
}

/** Category */
export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  requiredFields?: string[];
  searchableFields?: string[];
  templateSchema?: string;
  subcategories: {
    id: string;
    name: string;
    slug: string;
  }[];
}

/** Create listing input (alias for backward compat) */
export interface CreateListingInput {
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  pricePerDay: number;
  pricePerWeek?: number;
  pricePerMonth?: number;
  condition: string;
  location: ListingLocation;
  images: string[];
  instantBooking?: boolean;
  deliveryOptions: DeliveryOptions;
  deliveryRadius?: number;
  deliveryFee?: number;
  securityDeposit: number;
  minimumRentalPeriod: number;
  maximumRentalPeriod?: number;
  cancellationPolicy: string;
  rules?: string;
  features?: string[];
}

/** Update listing input */
export interface UpdateListingInput extends Partial<CreateListingInput> {
  id?: string;
}

/** Listing summary (card/list view) */
export interface ListingSummary {
  id: string;
  title: string;
  description: string;
  pricePerDay: number;
  images: ListingImage[] | string[];
  location: ListingLocation;
  rating?: number;
  reviewCount?: number;
  ownerId: string;
  ownerName?: string;
  ownerAvatar?: string;
  condition?: string;
  instantBooking?: boolean;
  isFavorited?: boolean;
  status?: string;
  createdAt: string;
}

/** Listing detail (full view) */
export interface ListingDetail extends ListingSummary {
  category: string;
  subcategory?: string;
  pricePerWeek?: number;
  pricePerMonth?: number;
  securityDeposit?: number;
  minimumRentalPeriod?: number;
  maximumRentalPeriod?: number;
  deliveryOptions?: DeliveryOptions;
  deliveryRadius?: number;
  deliveryFee?: number;
  cancellationPolicy?: string;
  rules?: string;
  features?: string[];
  availability?: Array<{ start: string; end: string }>;
  updatedAt: string;
}

/** Search/filter params for listings */
export interface ListingSearchParams extends PaginationParams {
  query?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  location?: string;
  lat?: number;
  lng?: number;
  radius?: number;
  condition?: string;
  instantBooking?: boolean;
  delivery?: boolean;
  sortBy?: 'price-asc' | 'price-desc' | 'rating' | 'newest' | 'popular' | string;
}
