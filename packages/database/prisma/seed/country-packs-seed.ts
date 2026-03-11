/**
 * Country Pack Expansion — Thailand (TH), Indonesia (ID), Germany (DE)
 *
 * Adds TAX, FEE, CANCELLATION, BOOKING_CONSTRAINT, and COMPLIANCE rules
 * for three new country markets. Follows the same pattern as policy-rules-seed.ts.
 *
 * Run via: `npx prisma db seed` (imported from seed-comprehensive.ts)
 * or standalone: `npx tsx packages/database/prisma/seed/country-packs-seed.ts`
 */
import type { Prisma } from '@prisma/client';

const farFuture = new Date('2099-12-31T23:59:59.000Z');

// ═══════════════════════════════════════════════════════════════════════════════
// THAILAND (TH)
// ═══════════════════════════════════════════════════════════════════════════════

const TH_TAX_RULES: Prisma.PolicyRuleCreateInput[] = [
  {
    type: 'TAX',
    name: 'Thailand VAT 7%',
    description: 'Thailand Value Added Tax at 7% (reduced from 10% standard rate).',
    country: 'TH',
    jurisdictionPriority: 1,
    priority: 100,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: farFuture,
    status: 'ACTIVE',
    conditions: [{ field: 'country', operator: 'eq', value: 'TH' }],
    actions: [
      {
        type: 'SET_RATE',
        params: { rate: 7, taxType: 'VAT', name: 'Thailand VAT', jurisdiction: 'TH' },
      },
    ],
    tags: ['thailand', 'vat'],
    metadata: { authority: 'Thailand Revenue Department', reference: 'Revenue Code Title IV' },
  },
  {
    type: 'TAX',
    name: 'Thailand WHT 5%',
    description: 'Withholding tax at 5% on rental income for non-resident hosts.',
    country: 'TH',
    jurisdictionPriority: 1,
    priority: 90,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: farFuture,
    status: 'ACTIVE',
    conditions: [
      { field: 'country', operator: 'eq', value: 'TH' },
      { field: 'userCountry', operator: 'neq', value: 'TH' },
    ],
    actions: [
      {
        type: 'COMPOUND',
        params: { rate: 5, taxType: 'WHT', name: 'Withholding Tax (Non-Resident)', jurisdiction: 'TH' },
      },
    ],
    tags: ['thailand', 'wht', 'non-resident'],
    metadata: { authority: 'Thailand Revenue Department' },
  },
];

const TH_FEE_RULES: Prisma.PolicyRuleCreateInput[] = [
  {
    type: 'FEE',
    name: 'Thailand Service Fee',
    description: 'Platform service fee for Thailand market — 8% renter fee.',
    country: 'TH',
    jurisdictionPriority: 1,
    priority: 100,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: farFuture,
    status: 'ACTIVE',
    conditions: [{ field: 'country', operator: 'eq', value: 'TH' }],
    actions: [
      {
        type: 'SET_RATE',
        params: { rate: 8, feeType: 'RENTER_SERVICE_FEE', name: 'Service Fee' },
      },
    ],
    tags: ['thailand', 'service-fee'],
    metadata: {},
  },
];

const TH_CANCELLATION_RULES: Prisma.PolicyRuleCreateInput[] = [
  {
    type: 'CANCELLATION',
    name: 'Thailand Cancellation Policy',
    description: 'Standard cancellation tiers for Thailand bookings.',
    country: 'TH',
    jurisdictionPriority: 1,
    priority: 100,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: farFuture,
    status: 'ACTIVE',
    conditions: [{ field: 'country', operator: 'eq', value: 'TH' }],
    actions: [
      {
        type: 'SET_OBJECT',
        params: {
          tiers: [
            { minHoursBefore: 168, maxHoursBefore: null, refundPercentage: 100, label: 'Full refund (7+ days)' },
            { minHoursBefore: 48, maxHoursBefore: 168, refundPercentage: 50, label: '50% refund (2-7 days)' },
            { minHoursBefore: 0, maxHoursBefore: 48, refundPercentage: 0, label: 'No refund (<48h)' },
          ],
        },
      },
    ],
    tags: ['thailand', 'cancellation'],
    metadata: {},
  },
];

const TH_BOOKING_RULES: Prisma.PolicyRuleCreateInput[] = [
  {
    type: 'BOOKING_CONSTRAINT',
    name: 'Thailand Min Age',
    description: 'Minimum age 20 for Thailand (legal majority in Thailand).',
    country: 'TH',
    jurisdictionPriority: 1,
    priority: 100,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: farFuture,
    status: 'ACTIVE',
    conditions: [{ field: 'country', operator: 'eq', value: 'TH' }],
    actions: [{ type: 'SET_MIN_MAX', params: { minAge: 20 } }],
    tags: ['thailand', 'age-requirement'],
    metadata: { reference: 'Civil and Commercial Code Section 19' },
  },
];

const TH_COMPLIANCE_RULES: Prisma.PolicyRuleCreateInput[] = [
  {
    type: 'COMPLIANCE',
    name: 'Thailand Host Compliance',
    description: 'Compliance requirements for hosts operating in Thailand.',
    country: 'TH',
    jurisdictionPriority: 1,
    priority: 100,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: farFuture,
    status: 'ACTIVE',
    conditions: [{ field: 'country', operator: 'eq', value: 'TH' }],
    actions: [
      {
        type: 'SET_OBJECT',
        params: {
          checks: [
            { checkType: 'IDENTITY_VERIFICATION', required: true, description: 'Thai National ID or Passport', validityDays: null, blockOnFailure: true },
            { checkType: 'TAX_REGISTRATION', required: true, description: 'Tax Identification Number (TIN)', validityDays: 365, blockOnFailure: true },
            { checkType: 'PROPERTY_PERMIT', required: true, description: 'Hotel Business License (for serviced apartments)', validityDays: 365, blockOnFailure: false },
          ],
        },
      },
    ],
    tags: ['thailand', 'compliance'],
    metadata: { authority: 'Thai Ministry of Interior' },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// INDONESIA (ID)
// ═══════════════════════════════════════════════════════════════════════════════

const ID_TAX_RULES: Prisma.PolicyRuleCreateInput[] = [
  {
    type: 'TAX',
    name: 'Indonesia VAT 11%',
    description: 'Indonesia PPN (Pajak Pertambahan Nilai) at 11%.',
    country: 'ID',
    jurisdictionPriority: 1,
    priority: 100,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: farFuture,
    status: 'ACTIVE',
    conditions: [{ field: 'country', operator: 'eq', value: 'ID' }],
    actions: [
      {
        type: 'SET_RATE',
        params: { rate: 11, taxType: 'PPN', name: 'PPN (VAT)', jurisdiction: 'ID' },
      },
    ],
    tags: ['indonesia', 'ppn', 'vat'],
    metadata: { authority: 'Direktorat Jenderal Pajak', reference: 'UU HPP No. 7/2021' },
  },
  {
    type: 'TAX',
    name: 'Indonesia Bali Tourism Tax',
    description: 'Bali provincial tourism tax (1.5% on accommodation).',
    country: 'ID',
    state: 'Bali',
    jurisdictionPriority: 2,
    priority: 90,
    version: 1,
    effectiveFrom: new Date('2024-02-14'),
    effectiveTo: farFuture,
    status: 'ACTIVE',
    conditions: [
      { field: 'country', operator: 'eq', value: 'ID' },
      { field: 'state', operator: 'eq', value: 'Bali' },
    ],
    actions: [
      {
        type: 'COMPOUND',
        params: { rate: 1.5, taxType: 'TOURISM_TAX', name: 'Bali Tourism Tax', jurisdiction: 'ID-BA' },
      },
    ],
    tags: ['indonesia', 'bali', 'tourism-tax'],
    metadata: { authority: 'Bali Provincial Government', reference: 'Perda No. 6/2023' },
  },
];

const ID_FEE_RULES: Prisma.PolicyRuleCreateInput[] = [
  {
    type: 'FEE',
    name: 'Indonesia Service Fee',
    description: 'Platform service fee for Indonesia market — 10% renter fee.',
    country: 'ID',
    jurisdictionPriority: 1,
    priority: 100,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: farFuture,
    status: 'ACTIVE',
    conditions: [{ field: 'country', operator: 'eq', value: 'ID' }],
    actions: [
      {
        type: 'SET_RATE',
        params: { rate: 10, feeType: 'RENTER_SERVICE_FEE', name: 'Platform Fee' },
      },
    ],
    tags: ['indonesia', 'service-fee'],
    metadata: {},
  },
];

const ID_CANCELLATION_RULES: Prisma.PolicyRuleCreateInput[] = [
  {
    type: 'CANCELLATION',
    name: 'Indonesia Cancellation Policy',
    description: 'Standard cancellation policy for Indonesia bookings.',
    country: 'ID',
    jurisdictionPriority: 1,
    priority: 100,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: farFuture,
    status: 'ACTIVE',
    conditions: [{ field: 'country', operator: 'eq', value: 'ID' }],
    actions: [
      {
        type: 'SET_OBJECT',
        params: {
          tiers: [
            { minHoursBefore: 120, maxHoursBefore: null, refundPercentage: 100, label: 'Full refund (5+ days)' },
            { minHoursBefore: 48, maxHoursBefore: 120, refundPercentage: 50, label: '50% refund (2-5 days)' },
            { minHoursBefore: 24, maxHoursBefore: 48, refundPercentage: 25, label: '25% refund (24-48h)' },
            { minHoursBefore: 0, maxHoursBefore: 24, refundPercentage: 0, label: 'No refund (<24h)' },
          ],
        },
      },
    ],
    tags: ['indonesia', 'cancellation'],
    metadata: {},
  },
];

const ID_BOOKING_RULES: Prisma.PolicyRuleCreateInput[] = [
  {
    type: 'BOOKING_CONSTRAINT',
    name: 'Indonesia Min Age & Document',
    description: 'Min age 17, ID card (KTP) required for Indonesian citizens.',
    country: 'ID',
    jurisdictionPriority: 1,
    priority: 100,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: farFuture,
    status: 'ACTIVE',
    conditions: [{ field: 'country', operator: 'eq', value: 'ID' }],
    actions: [
      { type: 'SET_MIN_MAX', params: { minAge: 17 } },
      { type: 'REQUIRE_DOCUMENT', params: { documentType: 'NATIONAL_ID', label: 'KTP (Kartu Tanda Penduduk)' } },
    ],
    tags: ['indonesia', 'age-requirement', 'ktp'],
    metadata: { reference: 'UU Adminduk No. 23/2006' },
  },
];

const ID_COMPLIANCE_RULES: Prisma.PolicyRuleCreateInput[] = [
  {
    type: 'COMPLIANCE',
    name: 'Indonesia Host Compliance',
    description: 'Compliance requirements for hosts in Indonesia.',
    country: 'ID',
    jurisdictionPriority: 1,
    priority: 100,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: farFuture,
    status: 'ACTIVE',
    conditions: [{ field: 'country', operator: 'eq', value: 'ID' }],
    actions: [
      {
        type: 'SET_OBJECT',
        params: {
          checks: [
            { checkType: 'IDENTITY_VERIFICATION', required: true, description: 'KTP or Passport verification', validityDays: null, blockOnFailure: true },
            { checkType: 'TAX_REGISTRATION', required: true, description: 'NPWP (Tax ID Number)', validityDays: 365, blockOnFailure: true },
            { checkType: 'BUSINESS_LICENSE', required: false, description: 'NIB (Business Registration) for professional hosts', validityDays: 365, blockOnFailure: false },
            { checkType: 'PROPERTY_PERMIT', required: true, description: 'Izin Pondok Wisata (Tourism Accommodation Permit)', validityDays: 365, blockOnFailure: true },
          ],
        },
      },
    ],
    tags: ['indonesia', 'compliance'],
    metadata: { authority: 'Kementerian Pariwisata' },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// GERMANY (DE)
// ═══════════════════════════════════════════════════════════════════════════════

const DE_TAX_RULES: Prisma.PolicyRuleCreateInput[] = [
  {
    type: 'TAX',
    name: 'Germany VAT 19%',
    description: 'German Umsatzsteuer (USt) at standard 19% rate.',
    country: 'DE',
    jurisdictionPriority: 1,
    priority: 100,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: farFuture,
    status: 'ACTIVE',
    conditions: [{ field: 'country', operator: 'eq', value: 'DE' }],
    actions: [
      {
        type: 'SET_RATE',
        params: { rate: 19, taxType: 'UST', name: 'Umsatzsteuer (VAT)', jurisdiction: 'DE' },
      },
    ],
    tags: ['germany', 'vat', 'ust'],
    metadata: { authority: 'Bundeszentralamt für Steuern', reference: 'UStG §12' },
  },
  {
    type: 'TAX',
    name: 'Germany Accommodation Tax 7%',
    description: 'Reduced VAT rate of 7% for short-term accommodation (Beherbergungsleistungen).',
    country: 'DE',
    jurisdictionPriority: 1,
    priority: 90,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: farFuture,
    status: 'ACTIVE',
    conditions: [
      { field: 'country', operator: 'eq', value: 'DE' },
      { field: 'listingCategory', operator: 'in', value: ['short_term_rental', 'hotel', 'serviced_apartment'] },
    ],
    actions: [
      {
        type: 'SET_RATE',
        params: { rate: 7, taxType: 'UST_REDUCED', name: 'Accommodation VAT (Reduced)', jurisdiction: 'DE' },
      },
    ],
    tags: ['germany', 'accommodation', 'reduced-vat'],
    metadata: { reference: 'UStG §12 Abs. 2 Nr. 11' },
  },
  {
    type: 'TAX',
    name: 'Berlin City Tax',
    description: 'Berlin City Tax (Übernachtungssteuer) — 5% on accommodation.',
    country: 'DE',
    state: null,
    city: 'Berlin',
    jurisdictionPriority: 3,
    priority: 80,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: farFuture,
    status: 'ACTIVE',
    conditions: [
      { field: 'country', operator: 'eq', value: 'DE' },
      { field: 'city', operator: 'eq', value: 'Berlin' },
    ],
    actions: [
      {
        type: 'COMPOUND',
        params: { rate: 5, taxType: 'CITY_TAX', name: 'Berlin Übernachtungssteuer', jurisdiction: 'DE-BE' },
      },
    ],
    tags: ['germany', 'berlin', 'city-tax'],
    metadata: { authority: 'Senatsverwaltung für Finanzen Berlin' },
  },
];

const DE_FEE_RULES: Prisma.PolicyRuleCreateInput[] = [
  {
    type: 'FEE',
    name: 'Germany Service Fee',
    description: 'Platform service fee for Germany — 6% renter fee (EU-competitive).',
    country: 'DE',
    jurisdictionPriority: 1,
    priority: 100,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: farFuture,
    status: 'ACTIVE',
    conditions: [{ field: 'country', operator: 'eq', value: 'DE' }],
    actions: [
      {
        type: 'SET_RATE',
        params: { rate: 6, feeType: 'RENTER_SERVICE_FEE', name: 'Servicegebühr' },
      },
    ],
    tags: ['germany', 'service-fee'],
    metadata: {},
  },
];

const DE_CANCELLATION_RULES: Prisma.PolicyRuleCreateInput[] = [
  {
    type: 'CANCELLATION',
    name: 'Germany Cancellation Policy',
    description: 'EU-compliant cancellation policy. 14-day right of withdrawal for online bookings.',
    country: 'DE',
    jurisdictionPriority: 1,
    priority: 100,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: farFuture,
    status: 'ACTIVE',
    conditions: [{ field: 'country', operator: 'eq', value: 'DE' }],
    actions: [
      {
        type: 'SET_OBJECT',
        params: {
          tiers: [
            { minHoursBefore: 336, maxHoursBefore: null, refundPercentage: 100, label: 'Widerrufsrecht — Full refund (14+ days)' },
            { minHoursBefore: 72, maxHoursBefore: 336, refundPercentage: 75, label: '75% refund (3-14 days)' },
            { minHoursBefore: 24, maxHoursBefore: 72, refundPercentage: 50, label: '50% refund (1-3 days)' },
            { minHoursBefore: 0, maxHoursBefore: 24, refundPercentage: 0, label: 'No refund (<24h)' },
          ],
        },
      },
      {
        type: 'SET_BOOLEAN',
        params: { refundServiceFee: true, refundPlatformFee: true, alwaysRefundDeposit: true },
      },
    ],
    tags: ['germany', 'cancellation', 'eu-compliant'],
    metadata: { reference: 'BGB §355 Widerrufsrecht' },
  },
];

const DE_BOOKING_RULES: Prisma.PolicyRuleCreateInput[] = [
  {
    type: 'BOOKING_CONSTRAINT',
    name: 'Germany Age & Document Requirements',
    description: 'Min age 18, ID mandatory. Berlin: max 90 nights/year (Zweckentfremdungsverbot).',
    country: 'DE',
    jurisdictionPriority: 1,
    priority: 100,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: farFuture,
    status: 'ACTIVE',
    conditions: [{ field: 'country', operator: 'eq', value: 'DE' }],
    actions: [
      { type: 'SET_MIN_MAX', params: { minAge: 18 } },
      { type: 'REQUIRE_DOCUMENT', params: { documentType: 'NATIONAL_ID', label: 'Personalausweis or Reisepass' } },
    ],
    tags: ['germany', 'age-requirement', 'id-required'],
    metadata: {},
  },
  {
    type: 'BOOKING_CONSTRAINT',
    name: 'Berlin Short-Term Rental Limit',
    description: 'Berlin Zweckentfremdungsverbot — max 90 nights/year without registration number.',
    country: 'DE',
    city: 'Berlin',
    jurisdictionPriority: 3,
    priority: 80,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: farFuture,
    status: 'ACTIVE',
    conditions: [
      { field: 'country', operator: 'eq', value: 'DE' },
      { field: 'city', operator: 'eq', value: 'Berlin' },
    ],
    actions: [
      { type: 'SET_MIN_MAX', params: { max: 90 } },
      { type: 'REQUIRE_DOCUMENT', params: { documentType: 'PROPERTY_PERMIT', label: 'Registriernummer (Short-Term Rental Registration)' } },
    ],
    tags: ['germany', 'berlin', 'rental-limit'],
    metadata: { reference: 'Zweckentfremdungsverbot-Gesetz Berlin' },
  },
];

const DE_COMPLIANCE_RULES: Prisma.PolicyRuleCreateInput[] = [
  {
    type: 'COMPLIANCE',
    name: 'Germany Host Compliance',
    description: 'German compliance requirements including GDPR, tax registration, and trading license.',
    country: 'DE',
    jurisdictionPriority: 1,
    priority: 100,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: farFuture,
    status: 'ACTIVE',
    conditions: [{ field: 'country', operator: 'eq', value: 'DE' }],
    actions: [
      {
        type: 'SET_OBJECT',
        params: {
          checks: [
            { checkType: 'IDENTITY_VERIFICATION', required: true, description: 'German ID verification (Personalausweis/Reisepass)', validityDays: null, blockOnFailure: true },
            { checkType: 'TAX_REGISTRATION', required: true, description: 'Steuernummer (Tax Number) from Finanzamt', validityDays: 365, blockOnFailure: true },
            { checkType: 'BUSINESS_LICENSE', required: false, description: 'Gewerbeschein (Trade License) for professional hosts', validityDays: 365, blockOnFailure: false },
            { checkType: 'DATA_PRIVACY', required: true, description: 'GDPR/DSGVO compliance declaration', validityDays: null, blockOnFailure: true },
            { checkType: 'INSURANCE_COVERAGE', required: true, description: 'Haftpflichtversicherung (Liability Insurance)', validityDays: 365, blockOnFailure: true },
            { checkType: 'SAFETY_INSPECTION', required: true, description: 'Fire safety and building compliance', validityDays: 730, blockOnFailure: false },
          ],
        },
      },
    ],
    tags: ['germany', 'compliance', 'gdpr'],
    metadata: { authority: 'Bundeszentralamt für Steuern', gdpr: true },
  },
];

// ─── Aggregate Export ───────────────────────────────────────────────────────

export const COUNTRY_PACK_RULES = [
  // Thailand
  ...TH_TAX_RULES,
  ...TH_FEE_RULES,
  ...TH_CANCELLATION_RULES,
  ...TH_BOOKING_RULES,
  ...TH_COMPLIANCE_RULES,
  // Indonesia
  ...ID_TAX_RULES,
  ...ID_FEE_RULES,
  ...ID_CANCELLATION_RULES,
  ...ID_BOOKING_RULES,
  ...ID_COMPLIANCE_RULES,
  // Germany
  ...DE_TAX_RULES,
  ...DE_FEE_RULES,
  ...DE_CANCELLATION_RULES,
  ...DE_BOOKING_RULES,
  ...DE_COMPLIANCE_RULES,
];

/**
 * Seed function — upserts all country pack policy rules.
 * Safe to run multiple times (idempotent).
 */
export async function seedCountryPacks(prisma: {
  policyRule: {
    upsert: (args: any) => Promise<any>;
    count: () => Promise<number>;
  };
}): Promise<void> {
  for (const rule of COUNTRY_PACK_RULES) {
    const id = `seed-${rule.type}-${(rule.country || '*').toLowerCase()}-${rule.name!.replace(/\s+/g, '-').toLowerCase().slice(0, 50)}`;
    await prisma.policyRule.upsert({
      where: { id },
      create: { id, ...rule },
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
  console.log(`  ✅ Country Packs (TH, ID, DE) seeded — ${count} total rules in database`);
}
