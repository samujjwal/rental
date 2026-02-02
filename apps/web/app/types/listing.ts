export interface Listing {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  category: string | { id: string; name: string; slug: string };
  subcategory: string | null;
  pricePerDay: number;
  basePrice?: number; // Alias for pricePerDay
  pricePerWeek: number | null;
  pricePerMonth: number | null;
  currency: string;
  condition: "new" | "like-new" | "good" | "fair" | "poor";
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
  images: string[];
  availability: "available" | "rented" | "maintenance";
  status?: "AVAILABLE" | "RENTED" | "MAINTENANCE" | "DRAFT" | "PENDING" | "INACTIVE"; // Alternative status field
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
  cancellationPolicy: "flexible" | "moderate" | "strict";
  rules: string | null;
  features: string[];
  rating: number | null;
  averageRating?: number; // Alias for rating
  totalReviews: number;
  reviewCount?: number; // Alias for totalReviews
  totalBookings: number;
  bookingsCount?: number; // Alias for totalBookings
  totalEarnings?: number; // Total earnings from this listing
  views: number;
  featured: boolean;
  verified: boolean;
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

export interface CreateListingRequest {
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  pricePerDay: number;
  pricePerWeek?: number;
  pricePerMonth?: number;
  condition: "new" | "like-new" | "good" | "fair" | "poor";
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
  images: string[];
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
  cancellationPolicy: "flexible" | "moderate" | "strict";
  rules?: string;
  features?: string[];
}

export type UpdateListingRequest = Partial<CreateListingRequest>;

export interface ListingSearchParams {
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
  sortBy?: "price-asc" | "price-desc" | "rating" | "newest" | "popular";
  page?: number;
  limit?: number;
}

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

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  subcategories: {
    id: string;
    name: string;
    slug: string;
  }[];
}
