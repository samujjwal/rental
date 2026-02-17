// ============================================================================
// Booking Types
// Shared contract for booking data between frontend and backend
// ============================================================================

import type { PaginationParams, DateRangeFilter } from './api';
import { BookingStatus, DeliveryMethod } from './enums';

/** Create booking request body */
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
