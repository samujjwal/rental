import { PrismaClient } from '@prisma/client';
import { PrismaWrapper } from './prisma-wrapper';
import { toNumber, decimalAdd, decimalSubtract, decimalCompare } from './utils';

// Declare process for Node.js environment
declare const process: {
  env: Record<string, string | undefined>;
  NODE_ENV: string;
};

export { PrismaClient, PrismaWrapper, toNumber, decimalAdd, decimalSubtract, decimalCompare };

// Export all types for API usage
export type {
  User,
  Listing as Property,
  Listing,
  Booking,
  Review,
  Category,
  Organization,
  Payment,
  Refund,
  Notification,
  Session,
  DeviceToken,
  UserPreferences,
  FavoriteListing,
  CancellationPolicy,
  ConditionReport,
  InsurancePolicy,
  InsuranceClaim,
  EmailTemplate,
  Conversation,
  Message,
  ConversationParticipant,
  MessageReadReceipt,
  Dispute,
  DisputeEvidence,
  DisputeResponse,
  DisputeTimelineEvent,
  DisputeResolution,
  OrganizationMember,
  AuditLog,
  Availability,
} from '@prisma/client';

// Export enums as both types and values for API usage
export enum UserRole {
  USER = 'USER',
  HOST = 'HOST',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
  CUSTOMER = 'CUSTOMER',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  DELETED = 'DELETED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
}

export enum PropertyType {
  APARTMENT = 'APARTMENT',
  HOUSE = 'HOUSE',
  VILLA = 'VILLA',
  STUDIO = 'STUDIO',
  CONDO = 'CONDO',
  TOWNHOUSE = 'TOWNHOUSE',
  COTTAGE = 'COTTAGE',
  CABIN = 'CABIN',
  LOFT = 'LOFT',
  OTHER = 'OTHER',
}

export enum PropertyStatus {
  AVAILABLE = 'AVAILABLE',
  RENTED = 'RENTED',
  MAINTENANCE = 'MAINTENANCE',
  UNAVAILABLE = 'UNAVAILABLE',
  DRAFT = 'DRAFT',
  SUSPENDED = 'SUSPENDED',
  ARCHIVED = 'ARCHIVED',
}

export enum BookingStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  PENDING_OWNER_APPROVAL = 'PENDING_OWNER_APPROVAL',
  CONFIRMED = 'CONFIRMED',
  IN_PROGRESS = 'IN_PROGRESS',
  CANCELLED = 'CANCELLED',
  DISPUTED = 'DISPUTED',
  COMPLETED = 'COMPLETED',
  AWAITING_RETURN_INSPECTION = 'AWAITING_RETURN_INSPECTION',
  REFUNDED = 'REFUNDED',
  SETTLED = 'SETTLED',
}

export enum BookingMode {
  REQUEST = 'REQUEST',
  INSTANT_BOOK = 'INSTANT_BOOK',
}

export enum PricingMode {
  PER_NIGHT = 'PER_NIGHT',
  PER_MONTH = 'PER_MONTH',
  PER_HOUR = 'PER_HOUR',
  PER_DAY = 'PER_DAY',
  PER_WEEK = 'PER_WEEK',
  CUSTOM = 'CUSTOM',
}

export enum DepositType {
  FIXED = 'FIXED',
  PERCENTAGE = 'PERCENTAGE',
  NONE = 'NONE',
}

export enum DisputeStatus {
  OPEN = 'OPEN',
  UNDER_REVIEW = 'UNDER_REVIEW',
  INVESTIGATING = 'INVESTIGATING',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export enum DisputeType {
  PROPERTY_DAMAGE = 'PROPERTY_DAMAGE',
  PAYMENT_ISSUE = 'PAYMENT_ISSUE',
  CANCELLATION = 'CANCELLATION',
  CLEANING_FEE = 'CLEANING_FEE',
  RULES_VIOLATION = 'RULES_VIOLATION',
  MISSING_ITEMS = 'MISSING_ITEMS',
  CONDITION_MISMATCH = 'CONDITION_MISMATCH',
  REFUND_REQUEST = 'REFUND_REQUEST',
  OTHER = 'OTHER',
}

export enum ReviewType {
  LISTING_REVIEW = 'LISTING_REVIEW',
  RENTER_REVIEW = 'RENTER_REVIEW',
  OWNER_REVIEW = 'OWNER_REVIEW',
}

export enum VerificationStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

export enum DepositStatus {
  PENDING = 'PENDING',
  AUTHORIZED = 'AUTHORIZED',
  HELD = 'HELD',
  RELEASED = 'RELEASED',
  CAPTURED = 'CAPTURED',
  FAILED = 'FAILED',
}

export enum PayoutStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  IN_TRANSIT = 'IN_TRANSIT',
  COMPLETED = 'COMPLETED',
  PAID = 'PAID',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum AccountType {
  REVENUE = 'REVENUE',
  EXPENSE = 'EXPENSE',
  LIABILITY = 'LIABILITY',
  ASSET = 'ASSET',
  EQUITY = 'EQUITY',
  CASH = 'CASH',
  RECEIVABLE = 'RECEIVABLE',
  PAYABLE = 'PAYABLE',
}

export enum LedgerSide {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
}

export enum TransactionType {
  PLATFORM_FEE = 'PLATFORM_FEE',
  SERVICE_FEE = 'SERVICE_FEE',
  PAYMENT = 'PAYMENT',
  REFUND = 'REFUND',
  PAYOUT = 'PAYOUT',
  DEPOSIT_HOLD = 'DEPOSIT_HOLD',
  OWNER_EARNING = 'OWNER_EARNING',
  DEPOSIT_RELEASE = 'DEPOSIT_RELEASE',
  DISPUTE = 'DISPUTE',
}

export enum LedgerEntryStatus {
  PENDING = 'PENDING',
  POSTED = 'POSTED',
  SETTLED = 'SETTLED',
  CANCELLED = 'CANCELLED',
}

export enum ListingStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  ARCHIVED = 'ARCHIVED',
  PENDING_REVIEW = 'PENDING_REVIEW',
  REJECTED = 'REJECTED',
}

export enum NotificationType {
  BOOKING_REQUEST = 'BOOKING_REQUEST',
  BOOKING_CONFIRMED = 'BOOKING_CONFIRMED',
  BOOKING_CANCELLED = 'BOOKING_CANCELLED',
  BOOKING_REMINDER = 'BOOKING_REMINDER',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  REVIEW_RECEIVED = 'REVIEW_RECEIVED',
  MESSAGE_RECEIVED = 'MESSAGE_RECEIVED',
  SYSTEM_UPDATE = 'SYSTEM_UPDATE',
  SYSTEM_ANNOUNCEMENT = 'SYSTEM_ANNOUNCEMENT',
  MARKETING = 'MARKETING',
  PAYOUT_PROCESSED = 'PAYOUT_PROCESSED',
  VERIFICATION_COMPLETE = 'VERIFICATION_COMPLETE',
  DISPUTE_OPENED = 'DISPUTE_OPENED',
  LISTING_APPROVED = 'LISTING_APPROVED',
}

export enum OrganizationStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
}

export enum OrganizationRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

export enum ClaimStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PROCESSING = 'PROCESSING',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

export enum EmailTemplateType {
  BOOKING_CONFIRMATION = 'BOOKING_CONFIRMATION',
  BOOKING_CANCELLATION = 'BOOKING_CANCELLATION',
  PAYMENT_CONFIRMATION = 'PAYMENT_CONFIRMATION',
  PAYMENT_RECEIPT = 'PAYMENT_RECEIPT',
  WELCOME = 'WELCOME',
  PASSWORD_RESET = 'PASSWORD_RESET',
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  LISTING_APPROVED = 'LISTING_APPROVED',
  LISTING_REJECTED = 'LISTING_REJECTED',
  REVIEW_REMINDER = 'REVIEW_REMINDER',
  PAYOUT_NOTIFICATION = 'PAYOUT_NOTIFICATION',
  DISPUTE_OPENED = 'DISPUTE_OPENED',
  DISPUTE_RESOLVED = 'DISPUTE_RESOLVED',
  SYSTEM_NOTIFICATION = 'SYSTEM_NOTIFICATION',
}

// Also export as const objects for backward compatibility
export const UserRoleValues = {
  USER: 'USER',
  HOST: 'HOST',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;

export const UserStatusValues = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  DELETED: 'DELETED',
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
} as const;

export const PropertyStatusValues = {
  AVAILABLE: 'AVAILABLE',
  RENTED: 'RENTED',
  MAINTENANCE: 'MAINTENANCE',
  UNAVAILABLE: 'UNAVAILABLE',
  DRAFT: 'DRAFT',
} as const;

export const BookingStatusValues = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  DISPUTED: 'DISPUTED',
  COMPLETED: 'COMPLETED',
  REFUNDED: 'REFUNDED',
  SETTLED: 'SETTLED',
} as const;

// Export string values for API compatibility
export const PROPERTY_STATUS = {
  AVAILABLE: 'AVAILABLE',
  RENTED: 'RENTED',
  MAINTENANCE: 'MAINTENANCE',
  UNAVAILABLE: 'UNAVAILABLE',
  DRAFT: 'DRAFT',
} as const;

export const USER_STATUS = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  DELETED: 'DELETED',
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
} as const;

export const BOOKING_STATUS = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
  REFUNDED: 'REFUNDED',
  SETTLED: 'SETTLED',
} as const;

export const VERIFICATION_STATUS = {
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
} as const;

// Create a singleton instance
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Create a singleton wrapper instance for API compatibility
const globalForPrismaWrapper = globalThis as unknown as { prismaWrapper: PrismaWrapper };

export const prismaWrapper = globalForPrismaWrapper.prismaWrapper || new PrismaWrapper();

if (process.env.NODE_ENV !== 'production') globalForPrismaWrapper.prismaWrapper = prismaWrapper;
