import { z } from "zod";

/**
 * API Response Validation Schemas
 *
 * Provides runtime schema validation for all API responses to ensure
 * data integrity and catch API contract violations early.
 */

// User schemas
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  role: z.enum(["renter", "owner", "admin"]),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]),
  emailVerified: z.boolean(),
  phoneVerified: z.boolean(),
  avatar: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export const AuthResponseSchema = z.object({
  user: UserSchema,
  accessToken: z.string(),
  refreshToken: z.string().optional(),
});

// Listing schemas
export const ListingOwnerSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  avatar: z.string().nullable().optional(),
  rating: z.number().min(0).max(5).optional(),
  responseRate: z.number().min(0).max(100).optional(),
});

export const ListingSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string(),
  price: z.number().positive(),
  currency: z.string().default("USD"),
  category: z.string(),
  location: z.string(),
  address: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  images: z.array(z.string()).default([]),
  rating: z.number().min(0).max(5).optional(),
  reviewsCount: z.number().int().min(0).default(0),
  owner: ListingOwnerSchema,
  features: z.record(z.string(), z.any()).optional(),
  availability: z
    .array(
      z.object({
        date: z.string(),
        available: z.boolean(),
      })
    )
    .optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export const ListingsSearchResponseSchema = z.object({
  listings: z.array(ListingSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1).default(1),
  totalPages: z.number().int().min(0).default(0),
  hasMore: z.boolean().optional(),
});

// Booking schemas
export const BookingStatusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
  "DISPUTED",
] as const);

export const BookingListingSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  images: z.array(z.string()).default([]),
});

export const BookingSchema = z.object({
  id: z.string().uuid(),
  listingId: z.string().uuid(),
  listing: BookingListingSchema.optional(),
  renterId: z.string().uuid(),
  ownerId: z.string().uuid(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  totalPrice: z.number().positive(),
  currency: z.string().default("USD"),
  status: BookingStatusSchema,
  paymentStatus: z.enum(["PENDING", "PAID", "REFUNDED", "FAILED"]).optional(),
  message: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
});

export const BookingsListResponseSchema = z.object({
  bookings: z.array(BookingSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1).default(1),
  totalPages: z.number().int().min(0).default(0),
});

// Payment schemas
export const PaymentSchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string(),
  status: z.enum(["PENDING", "COMPLETED", "FAILED", "REFUNDED"]),
  method: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
});

// Message schemas
export const MessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  senderId: z.string().uuid(),
  content: z.string(),
  attachments: z
    .array(
      z.object({
        url: z.string(),
        type: z.string(),
        name: z.string(),
      })
    )
    .optional(),
  createdAt: z.string().datetime(),
  readAt: z.string().datetime().nullable().optional(),
});

export const ConversationSchema = z.object({
  id: z.string().uuid(),
  participants: z.array(
    z.object({
      userId: z.string().uuid(),
      firstName: z.string(),
      lastName: z.string(),
      avatar: z.string().nullable().optional(),
    })
  ),
  lastMessage: MessageSchema.optional(),
  unreadCount: z.number().int().min(0).default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
});

// Review schemas
export const ReviewSchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string().uuid(),
  listingId: z.string().uuid(),
  reviewerId: z.string().uuid(),
  rating: z.number().min(1).max(5),
  content: z.string(),
  createdAt: z.string().datetime(),
});

// Dashboard schemas
export const DashboardStatsSchema = z.object({
  totalListings: z.number().int().min(0),
  activeBookings: z.number().int().min(0),
  totalEarnings: z.number().min(0),
  pendingRequests: z.number().int().min(0),
  unreadMessages: z.number().int().min(0),
  newReviews: z.number().int().min(0),
});

export const RecentActivitySchema = z.object({
  id: z.string().uuid(),
  type: z.enum([
    "BOOKING_CREATED",
    "BOOKING_CONFIRMED",
    "BOOKING_CANCELLED",
    "PAYMENT_RECEIVED",
    "MESSAGE_RECEIVED",
    "REVIEW_RECEIVED",
    "LISTING_VIEWED",
  ]),
  title: z.string(),
  description: z.string(),
  timestamp: z.string().datetime(),
  read: z.boolean().default(false),
});

// API Error schema
export const ApiErrorSchema = z.object({
  type: z.enum([
    "OFFLINE",
    "NETWORK_ERROR",
    "TIMEOUT_ERROR",
    "UNAUTHORIZED",
    "FORBIDDEN",
    "NOT_FOUND",
    "CONFLICT",
    "VALIDATION_ERROR",
    "SERVER_ERROR",
    "UNKNOWN_ERROR",
  ] as const),
  message: z.string(),
  statusCode: z.number().int().optional(),
  details: z.record(z.string(), z.array(z.string())).optional(),
  retryable: z.boolean(),
});

// Category schemas
export const CategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
});

// Validation helper functions
export function validateUser(data: unknown): z.infer<typeof UserSchema> {
  return UserSchema.parse(data);
}

export function validateAuthResponse(
  data: unknown
): z.infer<typeof AuthResponseSchema> {
  return AuthResponseSchema.parse(data);
}

export function validateListing(data: unknown): z.infer<typeof ListingSchema> {
  return ListingSchema.parse(data);
}

export function validateListingsSearch(
  data: unknown
): z.infer<typeof ListingsSearchResponseSchema> {
  return ListingsSearchResponseSchema.parse(data);
}

export function validateBooking(data: unknown): z.infer<typeof BookingSchema> {
  return BookingSchema.parse(data);
}

export function validateBookingsList(
  data: unknown
): z.infer<typeof BookingsListResponseSchema> {
  return BookingsListResponseSchema.parse(data);
}

export function validateDashboardStats(
  data: unknown
): z.infer<typeof DashboardStatsSchema> {
  return DashboardStatsSchema.parse(data);
}

export function validateRecentActivity(
  data: unknown
): z.infer<typeof RecentActivitySchema> {
  return RecentActivitySchema.parse(data);
}

// Safe validation helpers that don't throw
export function safeValidateUser(data: unknown) {
  return UserSchema.safeParse(data);
}

export function safeValidateListing(data: unknown) {
  return ListingSchema.safeParse(data);
}

export function safeValidateAuthResponse(data: unknown) {
  return AuthResponseSchema.safeParse(data);
}

export function safeValidateListingsSearch(data: unknown) {
  return ListingsSearchResponseSchema.safeParse(data);
}

export function safeValidateBooking(data: unknown) {
  return BookingSchema.safeParse(data);
}

// Array validation helpers
export function validateUserArray(
  data: unknown[]
): z.infer<typeof UserSchema>[] {
  return data.map((item) => UserSchema.parse(item));
}

export function validateListingArray(
  data: unknown[]
): z.infer<typeof ListingSchema>[] {
  return data.map((item) => ListingSchema.parse(item));
}

// Type inference helpers
export type User = z.infer<typeof UserSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type Listing = z.infer<typeof ListingSchema>;
export type ListingsSearchResponse = z.infer<
  typeof ListingsSearchResponseSchema
>;
export type Booking = z.infer<typeof BookingSchema>;
export type BookingsListResponse = z.infer<typeof BookingsListResponseSchema>;
export type DashboardStats = z.infer<typeof DashboardStatsSchema>;
export type RecentActivity = z.infer<typeof RecentActivitySchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;

export default {
  UserSchema,
  AuthResponseSchema,
  ListingSchema,
  ListingsSearchResponseSchema,
  BookingSchema,
  BookingsListResponseSchema,
  DashboardStatsSchema,
  RecentActivitySchema,
  validateUser,
  validateAuthResponse,
  validateListing,
  validateListingsSearch,
  validateBooking,
  validateBookingsList,
  validateDashboardStats,
  safeValidateUser,
  safeValidateListing,
  safeValidateAuthResponse,
};
