// ============================================================================
// Mobile Types Barrel
// Re-exports types from shared-types (SSOT) + local mobile-specific types
// ============================================================================

// --- From shared-types (generic, cross-platform types) ---
export type {
  AuthResponse,
  AuthUser,
  UserStats,
  NotificationPreferences,
} from '@rental-portal/shared-types';

export type {
  GeoSuggestion,
  GeoAutocompleteOptions,
} from '@rental-portal/shared-types';

export type {
  SearchResult,
  SearchResponse,
  SearchParams,
  SearchSort,
} from '@rental-portal/shared-types';

export type {
  Dispute,
  DisputeDetail,
  DisputeResponse,
  DisputeParticipant,
  CreateDisputePayload,
} from '@rental-portal/shared-types';

export {
  BookingStatus,
  DisputeType,
  OrganizationStatus,
  PaymentStatus,
  ReviewType,
  DeliveryMethod,
  SearchSortBy,
  UserRole,
} from '@rental-portal/shared-types';

// --- Local mobile-specific types (diverged shapes from shared-types) ---
export type {
  ListingDetail,
  Category,
  BookingSummary,
  BookingDetail,
  BookingResponse,
  ConversationSummary,
  UserProfile,
  ReviewResponse,
  Organization,
  OrganizationRole,
  OrganizationMember,
  BusinessType,
  MessageItem,
  PaymentBalance,
  PaymentTransaction,
  LoginPayload,
  RegisterPayload,
  UpdateProfilePayload,
  MobileClientConfig,
} from './mobile';
