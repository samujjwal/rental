// ============================================================================
// Booking Types
// Shared contract for booking data between frontend and backend
// ============================================================================

import type { PaginationParams, DateRangeFilter } from './api';
import { BookingStatus, DeliveryMethod } from './enums';

/** Full booking record (as returned by API) */
export interface Booking {
  id: string;
  listingId: string;
  renterId: string;
  ownerId: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  basePrice: number;
  subtotal: number;
  serviceFee: number;
  deliveryFee: number;
  securityDeposit: number;
  totalAmount: number;
  totalPrice?: number;
  status:
    | 'DRAFT'
    | 'PENDING'
    | 'PENDING_PAYMENT'
    | 'PENDING_OWNER_APPROVAL'
    | 'CONFIRMED'
    | 'IN_PROGRESS'
    | 'CANCELLED'
    | 'PAYMENT_FAILED'
    | 'DISPUTED'
    | 'COMPLETED'
    | 'AWAITING_RETURN_INSPECTION'
    | 'REFUNDED'
    | 'SETTLED';
  paymentStatus: 'PENDING' | 'PAID' | 'REFUNDED' | 'FAILED';
  deliveryMethod: 'pickup' | 'delivery' | 'shipping';
  deliveryAddress: string | null;
  specialRequests: string | null;
  pricing?: {
    subtotal: number;
    serviceFee: number;
    deliveryFee?: number;
    securityDeposit: number;
    totalAmount: number;
  };
  listing: {
    id: string;
    title: string;
    description?: string;
    images: string[];
    basePrice: number;
    location?: {
      city: string;
      state: string;
      country: string;
    };
    rating?: number;
  };
  renter: {
    id: string;
    firstName: string;
    lastName: string | null;
    avatar: string | null;
    rating: number | null;
  };
  owner: {
    id: string;
    firstName: string;
    lastName: string | null;
    avatar: string | null;
    rating: number | null;
  };
  review?: {
    id: string;
    rating: number;
    comment: string;
    createdAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

/** Create booking request body (web-compatible) */
export interface CreateBookingRequest {
  listingId: string;
  startDate: string;
  endDate: string;
  guestCount?: number;
  message?: string;
  promoCode?: string;
  deliveryMethod?: 'pickup' | 'delivery' | 'shipping';
  deliveryAddress?: string;
}

/** Booking price calculation response */
export interface BookingCalculation {
  startDate: string;
  endDate: string;
  totalDays: number;
  basePrice: number;
  subtotal: number;
  serviceFee: number;
  deliveryFee: number;
  securityDeposit: number;
  totalAmount: number;
  breakdown: {
    dailyRental: number;
    weeklyDiscount?: number;
    monthlyDiscount?: number;
    platformFee: number;
    taxes: number;
  };
}

/** Booking availability check response */
export interface BookingAvailability {
  available: boolean;
  blockedDates: string[];
  availableDates: string[];
  message?: string;
}

/** Create review request (attached to booking) */
export interface CreateReviewRequest {
  bookingId: string;
  rating: number;
  comment: string;
  categories?: {
    accuracy: number;
    communication: number;
    cleanliness: number;
    value: number;
  };
}

/** Create booking input (alias) */
export interface CreateBookingInput {
  listingId: string;
  startDate: string;
  endDate: string;
  deliveryMethod?: DeliveryMethod | string;
  deliveryAddress?: string;
  specialRequests?: string;
  guestCount?: number;
  promoCode?: string;
  message?: string;
}

/** Update booking request body */
export interface UpdateBookingInput {
  startDate?: string;
  endDate?: string;
  specialRequests?: string;
  guestCount?: number;
}

/** Price calculation request */
export interface CalculatePriceInput {
  listingId: string;
  startDate: string;
  endDate: string;
  promoCode?: string;
}

/** Price calculation response */
export interface PriceBreakdown {
  basePrice: number;
  rentalDays: number;
  dailyRate: number;
  weeklyDiscount?: number;
  monthlyDiscount?: number;
  serviceFee: number;
  insuranceFee?: number;
  deliveryFee?: number;
  taxAmount?: number;
  securityDeposit: number;
  promoDiscount?: number;
  totalPrice: number;
}

/** Booking summary (list view) */
export interface BookingSummary {
  id: string;
  listingId: string;
  listingTitle: string;
  listingImage?: string;
  status: BookingStatus | string;
  startDate: string;
  endDate: string;
  totalPrice: number;
  ownerName?: string;
  renterName?: string;
  createdAt: string;
}

/** Booking detail (full view) */
export interface BookingDetail extends BookingSummary {
  ownerId: string;
  renterId: string;
  deliveryMethod?: string;
  deliveryAddress?: string;
  specialRequests?: string;
  guestCount?: number;
  securityDeposit?: number;
  serviceFee?: number;
  insuranceFee?: number;
  priceBreakdown?: PriceBreakdown;
  cancellationPolicy?: string;
  updatedAt: string;
}

/** Booking list query params */
export interface BookingQueryParams extends PaginationParams, DateRangeFilter {
  status?: BookingStatus | string;
  role?: 'renter' | 'owner';
}
