/**
 * Global Policy & Rules Engine — Core Interfaces
 *
 * These interfaces define the contract for the configuration-driven policy engine.
 * All country-specific, region-specific, and time-variant rules are expressed as data
 * and evaluated at runtime — zero hardcoded country logic in domain services.
 */

// ──────────────────────────────────────────────────────────
// Policy Types & Enums
// ──────────────────────────────────────────────────────────

export type PolicyType =
  | 'TAX'
  | 'FEE'
  | 'PRICING'
  | 'CANCELLATION'
  | 'BOOKING_CONSTRAINT'
  | 'COMPLIANCE'
  | 'CURRENCY'
  | 'IDENTITY';

export type PolicyStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'ARCHIVED';

export type ConditionOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'nin'
  | 'contains'
  | 'startsWith'
  | 'regex'
  | 'between'
  | 'exists'
  | 'dayOfWeek'
  | 'dateRange'
  | 'always';

export type ActionType =
  | 'SET_RATE'
  | 'SET_FIXED_AMOUNT'
  | 'SET_MULTIPLIER'
  | 'SET_MIN_MAX'
  | 'SET_BOOLEAN'
  | 'SET_ENUM'
  | 'SET_OBJECT'
  | 'COMPOUND'
  | 'BLOCK'
  | 'REQUIRE_DOCUMENT';

// ──────────────────────────────────────────────────────────
// Policy Context — the runtime evaluation context
// ──────────────────────────────────────────────────────────

export interface PolicyContext {
  // Locale / Region
  locale: string;
  country: string;
  state: string | null;
  city: string | null;
  timezone: string;
  currency: string;

  // User
  userId: string | null;
  userRole: string;
  userCountry: string | null;

  // Listing
  listingId: string | null;
  listingCategory: string | null;
  listingCountry: string | null;
  listingState: string | null;
  listingCity: string | null;

  // Booking
  bookingValue: number | null;
  bookingDuration: number | null;
  bookingCurrency: string | null;
  startDate: string | null;
  endDate: string | null;
  guestCount: number | null;
  hostPresent: boolean | null;

  // Request
  requestTimestamp: string;
  evaluationDate: string;
  ipCountry: string | null;
  platform: string;

  // Workspace / Tenant
  tenantId: string | null;
  workspaceConfig: Record<string, unknown>;
}

// ──────────────────────────────────────────────────────────
// Rule Condition & Action
// ──────────────────────────────────────────────────────────

export interface RuleCondition {
  field: string;
  operator: ConditionOperator;
  value: unknown;
  negate?: boolean;
}

export interface RuleAction {
  type: ActionType;
  params: Record<string, unknown>;
}

// ──────────────────────────────────────────────────────────
// Evaluation Results
// ──────────────────────────────────────────────────────────

export interface ConditionResult {
  field: string;
  operator: ConditionOperator;
  expected: unknown;
  actual: unknown;
  matched: boolean;
}

export interface RuleEvaluationResult {
  ruleId: string;
  ruleName: string;
  matched: boolean;
  conditionResults: ConditionResult[];
  actions: RuleAction[];
}

export interface PolicyDecision {
  policyType: PolicyType;
  matched: boolean;
  appliedRules: RuleEvaluationResult[];
  eliminatedRules: RuleEvaluationResult[];
  actions: RuleAction[];
  evaluationMs: number;
  fallbackUsed: boolean;
}

// ──────────────────────────────────────────────────────────
// Tax-specific result types
// ──────────────────────────────────────────────────────────

export interface TaxLineItem {
  type: string;
  name: string;
  rate: number;
  amount: number;
  jurisdiction: string;
  ruleId: string;
}

export interface TaxBreakdown {
  subtotal: number;
  taxLines: TaxLineItem[];
  totalTax: number;
  total: number;
  currency: string;
  snapshot: TaxSnapshot;
}

export interface TaxSnapshot {
  evaluatedAt: string;
  rules: Array<{
    ruleId: string;
    version: number;
    rate: number;
    amount: number;
    jurisdiction: string;
  }>;
  contextHash: string;
}

// ──────────────────────────────────────────────────────────
// Fee-specific result types
// ──────────────────────────────────────────────────────────

export interface FeeLineItem {
  feeType: string;
  name: string;
  rate: number;
  amount: number;
  ruleId: string;
}

export interface FeeBreakdown {
  baseFees: FeeLineItem[];
  totalFees: number;
  currency: string;
}

// ──────────────────────────────────────────────────────────
// Booking Constraint result types
// ──────────────────────────────────────────────────────────

export interface BookingConstraintDecision {
  isAllowed: boolean;
  blockedReasons: Array<{ reason: string; ruleId: string; referenceUrl?: string }>;
  minStay: number | null;
  maxStay: number | null;
  minAge: number | null;
  requiredDocuments: Array<{ documentType: string; label?: string; threshold?: number }>;
  priceMultiplier: number;
  appliedRules: string[];
}

// ──────────────────────────────────────────────────────────
// Cancellation policy result types
// ──────────────────────────────────────────────────────────

export interface CancellationTier {
  /** Minimum hours before start for this tier to apply */
  minHoursBefore: number;
  /** Maximum hours before start (exclusive upper bound, null = infinity) */
  maxHoursBefore: number | null;
  /** Refund percentage (0.0–1.0) */
  refundPercentage: number;
  /** Human-readable label */
  label: string;
  /** PolicyRule ID that produced this tier */
  ruleId: string;
}

export interface CancellationDecision {
  /** Ordered tiers (most generous first) */
  tiers: CancellationTier[];
  /** Whether service fees are refundable */
  refundServiceFee: boolean;
  /** Whether platform fees are refundable */
  refundPlatformFee: boolean;
  /** Whether security deposit is always returned */
  alwaysRefundDeposit: boolean;
  /** Flat penalty amount (if any) */
  flatPenalty: number;
  /** IDs of all rules that contributed */
  appliedRules: string[];
}

// ──────────────────────────────────────────────────────────
// Serialized Policy Rule (matches DB shape)
// ──────────────────────────────────────────────────────────

export interface SerializedPolicyRule {
  id: string;
  type: PolicyType;
  name: string;
  description: string | null;
  country: string;
  state: string | null;
  city: string | null;
  jurisdictionPriority: number;
  version: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  supersedesId: string | null;
  priority: number;
  conditions: RuleCondition[];
  actions: RuleAction[];
  status: PolicyStatus;
  tags: string[];
  metadata: Record<string, unknown>;
}
