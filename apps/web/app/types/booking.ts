import type {
  Booking as SharedBooking,
  CreateBookingRequest,
  BookingCalculation,
  BookingAvailability,
  CreateReviewRequest,
  BookingSummary,
  BookingDetail,
  BookingTransition,
  BookingAvailableTransitionsResponse,
} from '@rental-portal/shared-types';

export type Booking = SharedBooking;

export interface ConditionReport {
  id: string;
  bookingId: string;
  propertyId: string;
  createdBy: string;
  checkIn: boolean;
  checkOut: boolean;
  photos: string[];
  notes: string | null;
  damages: string | null;
  signature: string | null;
  status: string | null;
  reportType: string | null;
  checklistData: string | null;
  createdAt: string;
  updatedAt: string;
  creator: {
    id: string;
    firstName: string;
    lastName: string;
    profilePhotoUrl: string | null;
  };
}

export type {
  CreateBookingRequest,
  BookingCalculation,
  BookingAvailability,
  CreateReviewRequest,
  BookingSummary,
  BookingDetail,
  BookingTransition,
  BookingAvailableTransitionsResponse,
};

