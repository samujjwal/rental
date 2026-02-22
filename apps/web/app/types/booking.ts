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
    | "DRAFT"
    | "PENDING"
    | "PENDING_PAYMENT"
    | "PENDING_OWNER_APPROVAL"
    | "CONFIRMED"
    | "IN_PROGRESS"
    | "CANCELLED"
    | "PAYMENT_FAILED"
    | "DISPUTED"
    | "COMPLETED"
    | "AWAITING_RETURN_INSPECTION"
    | "REFUNDED"
    | "SETTLED";
  paymentStatus: "PENDING" | "PAID" | "REFUNDED" | "FAILED";
  deliveryMethod: "pickup" | "delivery" | "shipping";
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

export interface CreateBookingRequest {
  listingId: string;
  startDate: string;
  endDate: string;
  guestCount?: number;
  message?: string;
  promoCode?: string;
  deliveryMethod?: "pickup" | "delivery" | "shipping";
  deliveryAddress?: string;
}

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

export interface BookingAvailability {
  available: boolean;
  blockedDates: string[];
  availableDates: string[];
  message?: string;
}

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
