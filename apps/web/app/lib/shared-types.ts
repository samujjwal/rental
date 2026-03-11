/**
 * Shared Types — Re-exports from @rental-portal/shared-types
 *
 * This barrel re-exports shared contract types for convenient frontend consumption.
 * Use these shared types for:
 *   - Enum values (BookingStatus, UserRole, etc.) instead of hardcoded strings
 *   - API envelope types (PaginatedResponse, ApiErrorResponse)
 *   - Request/response contracts shared with the backend
 *
 * For UI-specific types (with extra fields like avatar, images, etc.),
 * continue using ~/types/*.
 */

// Shared enums — single source of truth for status values
export {
  BookingStatus,
  ListingStatus,
  PropertyStatus,
  UserRole,
  UserStatus,
  DisputeStatus,
  DisputeType,
  ReviewType,
  PayoutStatus,
  DepositStatus,
  NotificationType,
  OrganizationRole,
  OrganizationStatus,
  PricingMode,
  DeliveryMethod,
  CancellationPolicy,
  ItemCondition,
  SearchSortBy,
} from '@rental-portal/shared-types';

// API envelope types
export type {
  PaginatedResponse,
  ApiErrorResponse,
  ApiSuccessResponse,
  PaginationParams,
  SortDirection,
  DateRangeFilter,
} from '@rental-portal/shared-types';

// Booking contract types
export type {
  Booking,
  CreateBookingRequest,
  BookingCalculation,
  BookingAvailability,
  CreateReviewRequest,
  CreateBookingInput,
  UpdateBookingInput,
  CalculatePriceInput,
  PriceBreakdown,
  BookingSummary,
  BookingDetail,
  BookingQueryParams,
} from '@rental-portal/shared-types';

// Listing contract types
export type {
  Listing,
  CreateListingRequest,
  UpdateListingRequest,
  ListingSearchResponse,
  Category,
  ListingImage,
  ListingLocation,
  DeliveryOptions,
  CreateListingInput,
  UpdateListingInput,
  ListingSummary,
  ListingDetail,
  ListingSearchParams as SharedListingSearchParams,
} from '@rental-portal/shared-types';

// User contract types
export type {
  AuthResponse,
  User,
  PublicUser,
  UserProfile,
  UserProfileExtended,
  UserPreferences,
  NotificationPreferences,
  UpdateProfileInput,
  UpdateUserRequest,
  LoginInput,
  SignupInput,
} from '@rental-portal/shared-types';

// Auth contract types
export type {
  LoginRequest,
  SignupRequest,
  RefreshTokenRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
} from '@rental-portal/shared-types';

// Payment contract types
export type {
  CreatePaymentInput,
  PaymentIntentResponse,
  TransactionRecord,
  EarningsSummary,
  EarningsDetail,
  PayoutRecord,
  DepositRecord,
  BalanceResponse,
} from '@rental-portal/shared-types';
