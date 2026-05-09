/**
 * Shared API Type Definitions
 * 
 * This file contains type definitions for API contracts that can be shared across:
 * - Web client (React/Next.js)
 * - Mobile client (React Native)
 * - API (NestJS)
 * 
 * All API routes should use these types for request/response contracts to ensure parity.
 */

// ============================================================================
// Common Types
// ============================================================================

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  errors?: Array<{ field: string; message: string }>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================================================
// Auth Endpoints
// ============================================================================

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
  accessToken: string;
  refreshToken: string;
}

// ============================================================================
// Listing Endpoints
// ============================================================================

export interface ListingSearchParams extends PaginationParams {
  categoryId?: string;
  ownerId?: string;
  organizationId?: string;
  location?: {
    lat: number;
    lng: number;
    radius?: number;
  };
  priceRange?: {
    min: number;
    max: number;
  };
  startDate?: string;
  endDate?: string;
  guests?: number;
  amenities?: string[];
}

export interface CreateListingRequest {
  title: string;
  description: string;
  categoryId: string;
  basePrice: number;
  currency: string;
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  amenities?: string[];
  rules?: string[];
  photos?: string[];
}

export interface UpdateListingRequest extends Partial<CreateListingRequest> {}

export interface ListingResponse {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  categoryName: string;
  ownerId: string;
  ownerName: string;
  organizationId?: string;
  basePrice: number;
  currency: string;
  status: string;
  averageRating: number;
  reviewCount: number;
  photos: string[];
  amenities: string[];
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Booking Endpoints
// ============================================================================

export interface CreateBookingRequest {
  listingId: string;
  startDate: string;
  endDate: string;
  guests: number;
  message?: string;
}

export interface BookingResponse {
  id: string;
  listingId: string;
  listingTitle: string;
  renterId: string;
  renterName: string;
  ownerId: string;
  ownerName: string;
  startDate: string;
  endDate: string;
  status: string;
  totalPrice: number;
  currency: string;
  depositAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BookingActionRequest {
  reason?: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// Payment Endpoints
// ============================================================================

export interface CreatePaymentIntentRequest {
  bookingId: string;
  paymentMethodId?: string;
}

export interface PaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
}

export interface RefundRequest {
  bookingId: string;
  reason: string;
}

// ============================================================================
// Required Headers
// ============================================================================

export interface ApiHeaders {
  'Authorization': string;
  'Content-Type': 'application/json';
  'Idempotency-Key'?: string;
  'X-Request-ID'?: string;
  'Accept-Language'?: string;
}

// ============================================================================
// Error Types
// ============================================================================

export interface ApiError {
  statusCode: number;
  message: string;
  error: string;
  errors?: Array<{ field: string; message: string }>;
}

export class ApiError extends Error {
  statusCode: number;
  errors?: Array<{ field: string; message: string }>;

  constructor(message: string, statusCode: number, errors?: Array<{ field: string; message: string }>) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

// ============================================================================
// Route Metadata
// ============================================================================

export interface RouteMetadata {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  requiresAuth: boolean;
  requiresVerification?: boolean;
  idempotent?: boolean;
  rateLimit?: {
    requests: number;
    windowMs: number;
  };
  headers: {
    required: string[];
    optional: string[];
  };
}

export const ROUTE_REGISTRY: Record<string, RouteMetadata> = {
  // Auth
  'POST /auth/register': {
    path: '/auth/register',
    method: 'POST',
    requiresAuth: false,
    headers: { required: ['Content-Type'], optional: [] },
  },
  'POST /auth/login': {
    path: '/auth/login',
    method: 'POST',
    requiresAuth: false,
    idempotent: false,
    headers: { required: ['Content-Type'], optional: [] },
  },
  'POST /auth/logout': {
    path: '/auth/logout',
    method: 'POST',
    requiresAuth: true,
    headers: { required: ['Authorization'], optional: [] },
  },
  'POST /auth/refresh': {
    path: '/auth/refresh',
    method: 'POST',
    requiresAuth: false,
    headers: { required: ['Content-Type'], optional: [] },
  },

  // Listings
  'GET /listings': {
    path: '/listings',
    method: 'GET',
    requiresAuth: false,
    headers: { required: [], optional: ['Accept-Language'] },
  },
  'POST /listings': {
    path: '/listings',
    method: 'POST',
    requiresAuth: true,
    requiresVerification: true,
    headers: { required: ['Authorization', 'Content-Type'], optional: ['Idempotency-Key'] },
  },
  'GET /listings/:id': {
    path: '/listings/:id',
    method: 'GET',
    requiresAuth: false,
    headers: { required: [], optional: ['Accept-Language'] },
  },
  'PATCH /listings/:id': {
    path: '/listings/:id',
    method: 'PATCH',
    requiresAuth: true,
    headers: { required: ['Authorization', 'Content-Type'], optional: ['Idempotency-Key'] },
  },
  'DELETE /listings/:id': {
    path: '/listings/:id',
    method: 'DELETE',
    requiresAuth: true,
    headers: { required: ['Authorization'], optional: [] },
  },

  // Bookings
  'POST /bookings': {
    path: '/bookings',
    method: 'POST',
    requiresAuth: true,
    requiresVerification: true,
    idempotent: true,
    headers: { required: ['Authorization', 'Content-Type', 'Idempotency-Key'], optional: [] },
  },
  'GET /bookings/my-bookings': {
    path: '/bookings/my-bookings',
    method: 'GET',
    requiresAuth: true,
    headers: { required: ['Authorization'], optional: [] },
  },
  'GET /bookings/host-bookings': {
    path: '/bookings/host-bookings',
    method: 'GET',
    requiresAuth: true,
    headers: { required: ['Authorization'], optional: [] },
  },
  'GET /bookings/:id': {
    path: '/bookings/:id',
    method: 'GET',
    requiresAuth: true,
    headers: { required: ['Authorization'], optional: [] },
  },
  'POST /bookings/:id/approve': {
    path: '/bookings/:id/approve',
    method: 'POST',
    requiresAuth: true,
    idempotent: true,
    headers: { required: ['Authorization', 'Content-Type', 'Idempotency-Key'], optional: [] },
  },
  'POST /bookings/:id/reject': {
    path: '/bookings/:id/reject',
    method: 'POST',
    requiresAuth: true,
    idempotent: true,
    headers: { required: ['Authorization', 'Content-Type', 'Idempotency-Key'], optional: [] },
  },
  'POST /bookings/:id/cancel': {
    path: '/bookings/:id/cancel',
    method: 'POST',
    requiresAuth: true,
    idempotent: true,
    headers: { required: ['Authorization', 'Content-Type', 'Idempotency-Key'], optional: [] },
  },

  // Payments
  'POST /payments/intents/:bookingId': {
    path: '/payments/intents/:bookingId',
    method: 'POST',
    requiresAuth: true,
    headers: { required: ['Authorization', 'Content-Type'], optional: [] },
  },
  'POST /payments/refund/:bookingId': {
    path: '/payments/refund/:bookingId',
    method: 'POST',
    requiresAuth: true,
    idempotent: true,
    headers: { required: ['Authorization', 'Content-Type', 'Idempotency-Key'], optional: [] },
  },
};
