// ============================================================================
// Shared Enums - Single Source of Truth
// Prisma-derived enums: auto-generated from schema.prisma via:
//   pnpm --filter shared-types generate
// Non-Prisma enums: maintained manually below
// ============================================================================

// Re-export all Prisma-generated enums
export {
  BookingStatus,
  ListingStatus,
  UserRole,
  UserStatus,
  DisputeStatus,
  DisputeType,
  DisputePriority,
  ReviewType,
  ReviewStatus,
  PaymentStatus,
  PayoutStatus,
  DepositStatus,
  NotificationType,
  OrganizationRole,
  OrganizationStatus,
  PropertyStatus,
  PricingMode,
  VerificationStatus,
  BookingStatusValues,
  ListingStatusValues,
  UserRoleValues,
  UserStatusValues,
  DisputeStatusValues,
  DisputeTypeValues,
  ReviewTypeValues,
  ReviewStatusValues,
  PaymentStatusValues,
  PayoutStatusValues,
  DepositStatusValues,
  NotificationTypeValues,
  OrganizationRoleValues,
  OrganizationStatusValues,
  PropertyStatusValues,
  PricingModeValues,
} from './enums.generated';

export type { EnumValues } from './enums.generated';

// ============================================================================
// Non-Prisma enums (frontend/API conventions)
// ============================================================================

export enum DeliveryMethod {
  PICKUP = 'pickup',
  DELIVERY = 'delivery',
  SHIPPING = 'shipping',
}

export enum CancellationPolicy {
  FLEXIBLE = 'flexible',
  MODERATE = 'moderate',
  STRICT = 'strict',
}

export enum ItemCondition {
  NEW = 'new',
  LIKE_NEW = 'like-new',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
}

export enum SearchSortBy {
  PRICE_ASC = 'price-asc',
  PRICE_DESC = 'price-desc',
  RATING = 'rating',
  NEWEST = 'newest',
  POPULAR = 'popular',
}
