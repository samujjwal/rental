// ============================================================================
// Listing Types
// Shared contract for listing data between frontend and backend
// ============================================================================

import type { PaginationParams } from './api';

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

/** Create listing input */
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
  sortBy?: string;
}
