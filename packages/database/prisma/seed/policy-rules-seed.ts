/**
 * PolicyRule Seed Data — Multi-Country Policy Rules
 *
 * Provides TAX, FEE, CANCELLATION, and BOOKING_CONSTRAINT rules for:
 * - Nepal (NP): VAT 13%
 * - India (IN): GST 18% (sub-18K), GST 12% (≥18K)
 * - United States (US): State-level sales tax (select states)
 * - Global (*): Default fallback rules
 *
 * Run via: `npx prisma db seed` or import from seed-comprehensive.ts.
 */
import type { Prisma } from '@prisma/client';

// ─── Helper ──────────────────────────────────────────────────────────────────
const farFuture = new Date('2099-12-31T23:59:59.000Z');

// ─── TAX Rules ───────────────────────────────────────────────────────────────

const TAX_RULES: Prisma.PolicyRuleCreateInput[] = [
  // Global fallback — 0% tax
  {
    type: 'TAX',
    name: 'Global Default — No Tax',
    description: 'Default zero-tax fallback when no country-specific rule matches.',
    country: '*',
    jurisdictionPriority: 0,
    priority: 999,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: farFuture,
    status: 'ACTIVE',
    conditions: [{ field: 'country', operator: 'always', value: true }],
    actions: [
      {
        type: 'SET_RATE',
        params: { rate: 0, taxType: 'NONE', name: 'No Tax', jurisdiction: 'GLOBAL' },
      },
    ],
    tags: ['global', 'fallback'],
    metadata: {},
  },

  // Nepal — VAT 13%
  {
    type: 'TAX',
    name: 'Nepal VAT 13%',
    description: 'Nepal Value Added Tax at 13% as per Nepal IRD.',
    country: 'NP',
    jurisdictionPriority: 1,
    priority: 100,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: farFuture,
    status: 'ACTIVE',
    conditions: [{ field: 'country', operator: 'eq', value: 'NP' }],
    actions: [
      {
        type: 'SET_RATE',
        params: { rate: 13, taxType: 'VAT', name: 'Nepal VAT', jurisdiction: 'NP' },
      },
    ],
    tags: ['nepal', 'vat'],
    metadata: { authority: 'Nepal Inland Revenue Department', reference: 'VAT Act 2052' },
  },

  // India — GST 12% for booking value >= 18,000 INR
  {
    type: 'TAX',
    name: 'India GST 12% (High-Value)',
    description: 'GST at 12% for bookings valued at ₹18,000 or more.',
    country: 'IN',
    jurisdictionPriority: 1,
    priority: 90,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: farFuture,
    status: 'ACTIVE',
    conditions: [
      { field: 'country', operator: 'eq', value: 'IN' },
      { field: 'bookingValue', operator: 'gte', value: 18000 },
    ],
    actions: [
      {
        type: 'SET_RATE',
        params: { rate: 12, taxType: 'GST', name: 'CGST + SGST', jurisdiction: 'IN' },
      },
    ],
    tags: ['india', 'gst', 'high-value'],
    metadata: { authority: 'CBIC', reference: 'GST Council 53rd Meeting' },
  },

  // India — GST 18% for booking value < 18,000 INR
  {
    type: 'TAX',
    name: 'India GST 18% (Standard)',
    description: 'GST at 18% for bookings under ₹18,000.',
    country: 'IN',
    jurisdictionPriority: 1,
    priority: 100,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: farFuture,
    status: 'ACTIVE',
    conditions: [
      { field: 'country', operator: 'eq', value: 'IN' },
      { field: 'bookingValue', operator: 'lt', value: 18000 },
    ],
    actions: [
      {
        type: 'SET_RATE',
        params: { rate: 18, taxType: 'GST', name: 'CGST + SGST', jurisdiction: 'IN' },
      },
    ],
    tags: ['india', 'gst', 'standard'],
    metadata: { authority: 'CBIC' },
  },

  // US — California
  {
    type: 'TAX',
    name: 'US California Sales Tax',
    description: 'California combined sales tax rate (~7.25% base + average local).',
    country: 'US',
    state: 'CA',
    jurisdictionPriority: 2,
    priority: 100,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: farFuture,
    status: 'ACTIVE',
    conditions: [
      { field: 'country', operator: 'eq', value: 'US' },
      { field: 'state', operator: 'eq', value: 'CA' },
    ],
    actions: [
      {
        type: 'SET_RATE',
        params: { rate: 8.68, taxType: 'SALES_TAX', name: 'CA Sales Tax', jurisdiction: 'US-CA' },
      },
    ],
    tags: ['us', 'california', 'sales-tax'],
    metadata: { authority: 'CDTFA' },
  },

  // US — New York
  {
    type: 'TAX',
    name: 'US New York Sales Tax',
    description: 'New York state + average local sales tax.',
    country: 'US',
    state: 'NY',
    jurisdictionPriority: 2,
    priority: 100,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: farFuture,
    status: 'ACTIVE',
    conditions: [
      { field: 'country', operator: 'eq', value: 'US' },
      { field: 'state', operator: 'eq', value: 'NY' },
    ],
    actions: [
      {
        type: 'SET_RATE',
        params: { rate: 8.52, taxType: 'SALES_TAX', name: 'NY Sales Tax', jurisdiction: 'US-NY' },
      },
    ],
    tags: ['us', 'new-york', 'sales-tax'],
    metadata: { authority: 'NY DTF' },
  },

  // US — Texas
  {
    type: 'TAX',
    name: 'US Texas Sales Tax',
    description: 'Texas state + average local sales tax.',
    country: 'US',
    state: 'TX',
    jurisdictionPriority: 2,
    priority: 100,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: farFuture,
    status: 'ACTIVE',
    conditions: [
      { field: 'country', operator: 'eq', value: 'US' },
      { field: 'state', operator: 'eq', value: 'TX' },
    ],
    actions: [
      {
        type: 'SET_RATE',
        params: { rate: 8.2, taxType: 'SALES_TAX', name: 'TX Sales Tax', jurisdiction: 'US-TX' },
      },
    ],
    tags: ['us', 'texas', 'sales-tax'],
    metadata: { authority: 'TX Comptroller' },
  },

  // US — Florida
  {
    type: 'TAX',
    name: 'US Florida Sales Tax',
    description: 'Florida state + average local sales tax.',
    country: 'US',
    state: 'FL',
    jurisdictionPriority: 2,
    priority: 100,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: farFuture,
    status: 'ACTIVE',
    conditions: [
      { field: 'country', operator: 'eq', value: 'US' },
      { field: 'state', operator: 'eq', value: 'FL' },
    ],
    actions: [
      {
        type: 'SET_RATE',
        params: { rate: 7.02, taxType: 'SALES_TAX', name: 'FL Sales Tax', jurisdiction: 'US-FL' },
      },
    ],
    tags: ['us', 'florida', 'sales-tax'],
    metadata: { authority: 'FL DOR' },
  },

  // US — Fallback (no state matched)
  {
    type: 'TAX',
    name: 'US Default Sales Tax',
    description: 'US fallback when no state-specific rule matches.',
    country: 'US',
    jurisdictionPriority: 1,
    priority: 500,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: farFuture,
    status: 'ACTIVE',
    conditions: [{ field: 'country', operator: 'eq', value: 'US' }],
    actions: [
      {
        type: 'SET_RATE',
        params: { rate: 7.12, taxType: 'SALES_TAX', name: 'US Avg Sales Tax', jurisdiction: 'US' },
      },
    ],
    tags: ['us', 'fallback', 'sales-tax'],
    metadata: {},
  },
];

// ─── FEE Rules ───────────────────────────────────────────────────────────────

const FEE_RULES: Prisma.PolicyRuleCreateInput[] = [
  // Global default fees
  {
    type: 'FEE',
    name: 'Global Platform Fee 10%',
    description: 'Default platform fee charged to listing owners.',
    country: '*',
    jurisdictionPriority: 0,
    priority: 999,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: farFuture,
    status: 'ACTIVE',
    conditions: [{ field: 'country', operator: 'always', value: true }],
    actions: [
      {
        type: 'SET_RATE',
        params: { rate: 10, feeType: 'PLATFORM_FEE', name: 'Platform Fee' },
      },
    ],
    tags: ['global', 'platform-fee'],
    metadata: {},
  },
  {
    type: 'FEE',
    name: 'Global Service Fee 5%',
    description: 'Default service fee charged to renters.',
    country: '*',
    jurisdictionPriority: 0,
    priority: 999,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: farFuture,
    status: 'ACTIVE',
    conditions: [{ field: 'country', operator: 'always', value: true }],
    actions: [
      {
        type: 'SET_RATE',
        params: { rate: 5, feeType: 'SERVICE_FEE', name: 'Service Fee' },
      },
    ],
    tags: ['global', 'service-fee'],
    metadata: {},
  },

  // Nepal — lower platform fee (8%) to encourage adoption
  {
    type: 'FEE',
    name: 'Nepal Platform Fee 8%',
    description: 'Reduced platform fee for Nepal market.',
    country: 'NP',
    jurisdictionPriority: 1,
    priority: 100,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: farFuture,
    status: 'ACTIVE',
    conditions: [{ field: 'country', operator: 'eq', value: 'NP' }],
    actions: [
      {
        type: 'SET_RATE',
        params: { rate: 8, feeType: 'PLATFORM_FEE', name: 'Platform Fee (Nepal)' },
      },
    ],
    tags: ['nepal', 'platform-fee'],
    metadata: {},
  },
  {
    type: 'FEE',
    name: 'Nepal Service Fee 3%',
    description: 'Reduced service fee for Nepal market.',
    country: 'NP',
    jurisdictionPriority: 1,
    priority: 100,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: farFuture,
    status: 'ACTIVE',
    conditions: [{ field: 'country', operator: 'eq', value: 'NP' }],
    actions: [
      {
        type: 'SET_RATE',
        params: { rate: 3, feeType: 'SERVICE_FEE', name: 'Service Fee (Nepal)' },
      },
    ],
    tags: ['nepal', 'service-fee'],
    metadata: {},
  },

  // India — standard fees matching market rates
  {
    type: 'FEE',
    name: 'India Platform Fee 10%',
    description: 'Platform fee for India.',
    country: 'IN',
    jurisdictionPriority: 1,
    priority: 100,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: farFuture,
    status: 'ACTIVE',
    conditions: [{ field: 'country', operator: 'eq', value: 'IN' }],
    actions: [
      {
        type: 'SET_RATE',
        params: { rate: 10, feeType: 'PLATFORM_FEE', name: 'Platform Fee (India)' },
      },
    ],
    tags: ['india', 'platform-fee'],
    metadata: {},
  },
  {
    type: 'FEE',
    name: 'India Service Fee 5%',
    description: 'Service fee for India.',
    country: 'IN',
    jurisdictionPriority: 1,
    priority: 100,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: farFuture,
    status: 'ACTIVE',
    conditions: [{ field: 'country', operator: 'eq', value: 'IN' }],
    actions: [
      {
        type: 'SET_RATE',
        params: { rate: 5, feeType: 'SERVICE_FEE', name: 'Service Fee (India)' },
      },
    ],
    tags: ['india', 'service-fee'],
    metadata: {},
  },
];

// ─── CANCELLATION Rules ──────────────────────────────────────────────────────

const CANCELLATION_RULES: Prisma.PolicyRuleCreateInput[] = [
  // Global default cancellation tiers
  {
    type: 'CANCELLATION',
    name: 'Global Standard Cancellation',
    description: 'Default 3-tier cancellation policy: full >48h, 50% 24-48h, 0% <24h.',
    country: '*',
    jurisdictionPriority: 0,
    priority: 999,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: farFuture,
    status: 'ACTIVE',
    conditions: [{ field: 'country', operator: 'always', value: true }],
    actions: [
      {
        type: 'SET_OBJECT',
        params: {
          tiers: [
            {
              minHoursBefore: 48,
              maxHoursBefore: null,
              refundPercentage: 1.0,
              label: 'Full refund — cancelled more than 48 hours before start',
            },
            {
              minHoursBefore: 24,
              maxHoursBefore: 48,
              refundPercentage: 0.5,
              label: '50% refund — cancelled 24–48 hours before start',
            },
            {
              minHoursBefore: 0,
              maxHoursBefore: 24,
              refundPercentage: 0,
              label: 'No refund — cancelled less than 24 hours before start',
            },
          ],
        },
      },
      {
        type: 'SET_BOOLEAN',
        params: { refundServiceFee: true, refundPlatformFee: true, alwaysRefundDeposit: true },
      },
    ],
    tags: ['global', 'cancellation', 'standard'],
    metadata: {},
  },

  // Nepal — more generous policy (72h full refund)
  {
    type: 'CANCELLATION',
    name: 'Nepal Flexible Cancellation',
    description: 'Nepal cancellation: full >72h, 75% 24-72h, 25% <24h.',
    country: 'NP',
    jurisdictionPriority: 1,
    priority: 100,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: farFuture,
    status: 'ACTIVE',
    conditions: [{ field: 'country', operator: 'eq', value: 'NP' }],
    actions: [
      {
        type: 'SET_OBJECT',
        params: {
          tiers: [
            {
              minHoursBefore: 72,
              maxHoursBefore: null,
              refundPercentage: 1.0,
              label: 'Full refund — cancelled more than 72 hours before start',
            },
            {
              minHoursBefore: 24,
              maxHoursBefore: 72,
              refundPercentage: 0.75,
              label: '75% refund — cancelled 24–72 hours before start',
            },
            {
              minHoursBefore: 0,
              maxHoursBefore: 24,
              refundPercentage: 0.25,
              label: '25% refund — cancelled less than 24 hours before start',
            },
          ],
        },
      },
      {
        type: 'SET_BOOLEAN',
        params: { refundServiceFee: true, refundPlatformFee: true, alwaysRefundDeposit: true },
      },
    ],
    tags: ['nepal', 'cancellation', 'flexible'],
    metadata: {},
  },

  // India — standard policy with service fee non-refundable
  {
    type: 'CANCELLATION',
    name: 'India Moderate Cancellation',
    description: 'India cancellation: full >48h, 50% 12-48h, 0% <12h. Service fee non-refundable.',
    country: 'IN',
    jurisdictionPriority: 1,
    priority: 100,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: farFuture,
    status: 'ACTIVE',
    conditions: [{ field: 'country', operator: 'eq', value: 'IN' }],
    actions: [
      {
        type: 'SET_OBJECT',
        params: {
          tiers: [
            {
              minHoursBefore: 48,
              maxHoursBefore: null,
              refundPercentage: 1.0,
              label: 'Full refund — cancelled more than 48 hours before start',
            },
            {
              minHoursBefore: 12,
              maxHoursBefore: 48,
              refundPercentage: 0.5,
              label: '50% refund — cancelled 12–48 hours before start',
            },
            {
              minHoursBefore: 0,
              maxHoursBefore: 12,
              refundPercentage: 0,
              label: 'No refund — cancelled less than 12 hours before start',
            },
          ],
        },
      },
      {
        type: 'SET_BOOLEAN',
        params: { refundServiceFee: false, refundPlatformFee: true, alwaysRefundDeposit: true },
      },
    ],
    tags: ['india', 'cancellation', 'moderate'],
    metadata: {},
  },
];

// ─── BOOKING_CONSTRAINT Rules ────────────────────────────────────────────────

const BOOKING_CONSTRAINT_RULES: Prisma.PolicyRuleCreateInput[] = [
  // Global — minimum 1 day, maximum 365 days
  {
    type: 'BOOKING_CONSTRAINT',
    name: 'Global Min/Max Stay',
    description: 'Global default: minimum 1 day, maximum 365 days.',
    country: '*',
    jurisdictionPriority: 0,
    priority: 999,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: farFuture,
    status: 'ACTIVE',
    conditions: [{ field: 'country', operator: 'always', value: true }],
    actions: [
      {
        type: 'SET_MIN_MAX',
        params: { min: 1, max: 365 },
      },
    ],
    tags: ['global', 'stay-limits'],
    metadata: {},
  },

  // Nepal — require identity document for bookings > 30 days
  {
    type: 'BOOKING_CONSTRAINT',
    name: 'Nepal Long-Stay ID Requirement',
    description: 'Nepal requires citizenship/passport for bookings exceeding 30 days.',
    country: 'NP',
    jurisdictionPriority: 1,
    priority: 100,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: farFuture,
    status: 'ACTIVE',
    conditions: [
      { field: 'country', operator: 'eq', value: 'NP' },
      { field: 'bookingDuration', operator: 'gt', value: 30 },
    ],
    actions: [
      {
        type: 'REQUIRE_DOCUMENT',
        params: {
          documentType: 'GOVERNMENT_ID',
          label: 'Citizenship card or passport required for bookings over 30 days',
          threshold: 30,
        },
      },
    ],
    tags: ['nepal', 'identity', 'long-stay'],
    metadata: {},
  },

  // India — minimum age 18
  {
    type: 'BOOKING_CONSTRAINT',
    name: 'India Minimum Age 18',
    description: 'Indian law requires renters to be at least 18 years old.',
    country: 'IN',
    jurisdictionPriority: 1,
    priority: 100,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: farFuture,
    status: 'ACTIVE',
    conditions: [{ field: 'country', operator: 'eq', value: 'IN' }],
    actions: [
      {
        type: 'SET_MIN_MAX',
        params: { minAge: 18 },
      },
    ],
    tags: ['india', 'age-requirement'],
    metadata: {},
  },
];

// ─── Export for seed runner ──────────────────────────────────────────────────

export const POLICY_RULES_SEED = [
  ...TAX_RULES,
  ...FEE_RULES,
  ...CANCELLATION_RULES,
  ...BOOKING_CONSTRAINT_RULES,
];

/**
 * Seed function — upserts all policy rules by name+country+type.
 * Safe to run multiple times (idempotent).
 */
export async function seedPolicyRules(prisma: {
  policyRule: {
    upsert: (args: any) => Promise<any>;
    count: () => Promise<number>;
  };
}): Promise<void> {
  for (const rule of POLICY_RULES_SEED) {
    await prisma.policyRule.upsert({
      where: {
        // Use a composite unique-ish lookup: type + name
        // If no unique constraint exists, fall back to findFirst + create pattern
        id: `seed-${rule.type}-${(rule.country || '*').toLowerCase()}-${rule.name!.replace(/\s+/g, '-').toLowerCase().slice(0, 50)}`,
      },
      create: {
        id: `seed-${rule.type}-${(rule.country || '*').toLowerCase()}-${rule.name!.replace(/\s+/g, '-').toLowerCase().slice(0, 50)}`,
        ...rule,
      },
      update: {
        description: rule.description,
        conditions: rule.conditions as any,
        actions: rule.actions as any,
        status: rule.status,
        effectiveFrom: rule.effectiveFrom,
        effectiveTo: rule.effectiveTo,
        priority: rule.priority,
        tags: rule.tags as any,
        metadata: rule.metadata as any,
      },
    });
  }

  const count = await prisma.policyRule.count();
  console.log(`  ✅ PolicyRules seeded — ${count} total rules in database`);
}
