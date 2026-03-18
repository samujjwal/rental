import type {
  Booking as SharedBooking,
  CreateBookingRequest,
  BookingCalculation,
  BookingAvailability,
  CreateReviewRequest,
  BookingSummary,
  BookingDetail,
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

export type BookingTransition =
  | 'SUBMIT_REQUEST'
  | 'OWNER_APPROVE'
  | 'OWNER_REJECT'
  | 'COMPLETE_PAYMENT'
  | 'FAIL_PAYMENT'
  | 'RETRY_PAYMENT'
  | 'START_RENTAL'
  | 'CANCEL'
  | 'REQUEST_RETURN'
  | 'APPROVE_RETURN'
  | 'REJECT_RETURN'
  | 'COMPLETE'
  | 'SETTLE'
  | 'INITIATE_DISPUTE'
  | 'RESOLVE_DISPUTE_OWNER_FAVOR'
  | 'RESOLVE_DISPUTE_RENTER_FAVOR'
  | 'REFUND'
  | 'EXPIRE';

export interface BookingAvailableTransitionsResponse {
  currentState: Booking['status'] | string;
  role: 'RENTER' | 'OWNER' | 'ADMIN';
  availableTransitions: BookingTransition[];
}

export type {
  CreateBookingRequest,
  BookingCalculation,
  BookingAvailability,
  CreateReviewRequest,
  BookingSummary,
  BookingDetail,
};
