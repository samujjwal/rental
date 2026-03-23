import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaWrapper } from './prisma-wrapper';
import { toNumber, decimalAdd, decimalSubtract, decimalCompare } from './utils';

// Declare process for Node.js environment
declare const process: {
  env: Record<string, string | undefined>;
  NODE_ENV: string;
};

export { PrismaClient, PrismaWrapper, toNumber, decimalAdd, decimalSubtract, decimalCompare };

// Export Prisma enums directly for type compatibility
export { $Enums } from '@prisma/client';

// Re-export Prisma enums as named exports (single source of truth — no manual definitions)
export {
  UserRole,
  UserStatus,
  PropertyType,
  PropertyStatus,
  PropertyCondition,
  BookingStatus,
  BookingMode,
  PricingMode,
  DepositType,
  DepositStatus,
  DisputeStatus,
  DisputeType,
  DisputePriority,
  ReviewType,
  ReviewStatus,
  VerificationStatus,
  PaymentStatus,
  RefundStatus,
  PayoutStatus,
  AccountType,
  LedgerSide,
  TransactionType,
  LedgerEntryStatus,
  ListingStatus,
  NotificationType,
  OrganizationStatus,
  OrganizationRole,
  ClaimStatus,
  InsuranceStatus,
  InsuranceType,
  IdentityDocumentType,
  EmailTemplateType,
  ConversationType,
  ConversationStatus,
  MessageType,
  ResolutionType,
  AvailabilityStatus,
  AvailabilityMode,
  AvailabilitySlotStatus,
  PriceLineType,
  PolicyType,
  PolicyStatus,
  PricingRuleType,
  PricingStrategy,
  ComplianceCheckType,
  ComplianceStatus,
  EscrowStatus,
  EscalationLevel,
  CampaignStatus,
  AgentType,
  AiConversationStatus,
  ExpansionStatus,
  SearchType,
  ReputationTier,
  ModerationStatus,
  HealthStatus,
  AnomalySeverity,
} from '@prisma/client';

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
  IdentityDocument,
  ListingContent,
  ListingVersion,
  CategoryAttributeDefinition,
  ListingAttributeValue,
  InventoryUnit,
  AvailabilitySlot,
  FxRateSnapshot,
  BookingPriceBreakdown,
  PricingRule,
  ComplianceRecord,
  PlatformMetric,
  EscrowTransaction,
  DisputeEscalation,
  // V5 Enterprise Models
  MarketplaceHealthMetric,
  HostActivationCampaign,
  AiConversation,
  AiConversationTurn,
  DemandForecast,
  DemandSignal,
  MarketOpportunity,
  SearchEvent,
  UserSearchProfile,
  PricingRecommendation,
  FraudSignal,
  DeviceFingerprint,
  InventoryGraphNode,
  InventoryGraphEdge,
  PaymentProvider,
  TaxPolicy,
  CountryPolicyPack,
  ReputationScore,
  ModerationAction,
  ServiceHealthCheck,
  AnomalyDetection,
  RegionConfig,
  ExpansionSimulation,
} from '@prisma/client';

// Const value objects for runtime enum iteration (kept for backward compatibility)
export const UserRoleValues = {
  USER: 'USER',
  HOST: 'HOST',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
  CUSTOMER: 'CUSTOMER',
  OPERATIONS_ADMIN: 'OPERATIONS_ADMIN',
  FINANCE_ADMIN: 'FINANCE_ADMIN',
  SUPPORT_ADMIN: 'SUPPORT_ADMIN',
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
  SUSPENDED: 'SUSPENDED',
  ARCHIVED: 'ARCHIVED',
} as const;

export const BookingStatusValues = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  PENDING_OWNER_APPROVAL: 'PENDING_OWNER_APPROVAL',
  CONFIRMED: 'CONFIRMED',
  IN_PROGRESS: 'IN_PROGRESS',
  CANCELLED: 'CANCELLED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  DISPUTED: 'DISPUTED',
  COMPLETED: 'COMPLETED',
  AWAITING_RETURN_INSPECTION: 'AWAITING_RETURN_INSPECTION',
  REFUNDED: 'REFUNDED',
  SETTLED: 'SETTLED',
} as const;

// Create a singleton instance (lazy — avoids import-time errors when DATABASE_URL is unset, e.g. in tests)
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | null };

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    // Return a no-op placeholder; test suites provide their own mock PrismaService
    return null as unknown as PrismaClient;
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Create a singleton wrapper instance for API compatibility
const globalForPrismaWrapper = globalThis as unknown as { prismaWrapper: PrismaWrapper | null };

export const prismaWrapper = globalForPrismaWrapper.prismaWrapper ?? new PrismaWrapper();

if (process.env.NODE_ENV !== 'production') globalForPrismaWrapper.prismaWrapper = prismaWrapper;
