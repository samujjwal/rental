import { Test, TestingModule } from '@nestjs/testing';
import { PolicyEngineService } from './policy-engine.service';
import { RuleEvaluatorService } from './rule-evaluator.service';
import { PolicyRegistryService } from './policy-registry.service';
import { PolicyAuditService } from './policy-audit.service';
import { PolicyContext, SerializedPolicyRule } from '../interfaces';

describe('PolicyEngineService', () => {
  let engine: PolicyEngineService;
  let registry: jest.Mocked<PolicyRegistryService>;
  let audit: jest.Mocked<PolicyAuditService>;

  const buildContext = (overrides: Partial<PolicyContext> = {}): PolicyContext => ({
    locale: 'en',
    country: 'NP',
    state: null,
    city: null,
    timezone: 'Asia/Kathmandu',
    currency: 'NPR',
    userId: 'user_1',
    userRole: 'RENTER',
    userCountry: 'NP',
    listingId: 'lst_1',
    listingCategory: 'SPACES',
    listingCountry: 'NP',
    listingState: null,
    listingCity: 'Kathmandu',
    bookingValue: 15000,
    bookingDuration: 7,
    bookingCurrency: 'NPR',
    startDate: '2026-03-05',
    endDate: '2026-03-12',
    guestCount: 2,
    hostPresent: false,
    requestTimestamp: '2026-03-02T10:30:00Z',
    evaluationDate: '2026-03-02',
    ipCountry: 'NP',
    platform: 'web',
    tenantId: null,
    workspaceConfig: {},
    ...overrides,
  });

  const nepalVatRule: SerializedPolicyRule = {
    id: 'rule_np_vat_13',
    type: 'TAX',
    name: 'Nepal Standard VAT',
    description: 'Nepal VAT at 13%',
    country: 'NP',
    state: null,
    city: null,
    jurisdictionPriority: 1,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: null,
    supersedesId: null,
    priority: 100,
    conditions: [{ field: 'country', operator: 'eq', value: 'NP' }],
    actions: [
      {
        type: 'SET_RATE',
        params: { taxType: 'VAT', name: 'Nepal VAT', rate: 13.0, jurisdiction: 'Nepal' },
      },
    ],
    status: 'ACTIVE',
    tags: ['vat', 'nepal'],
    metadata: {},
  };

  const platformFeeRule: SerializedPolicyRule = {
    id: 'rule_fee_np_12',
    type: 'FEE',
    name: 'Nepal Platform Fee 12%',
    description: 'Standard platform fee',
    country: 'NP',
    state: null,
    city: null,
    jurisdictionPriority: 1,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: null,
    supersedesId: null,
    priority: 100,
    conditions: [{ field: 'country', operator: 'eq', value: 'NP' }],
    actions: [
      {
        type: 'SET_RATE',
        params: { feeType: 'PLATFORM_FEE', name: 'Platform Service Fee', rate: 12.0 },
      },
    ],
    status: 'ACTIVE',
    tags: [],
    metadata: {},
  };

  beforeEach(async () => {
    const mockRegistry = {
      findActiveRules: jest.fn().mockResolvedValue([]),
      invalidateCache: jest.fn().mockResolvedValue(undefined),
      onModuleInit: jest.fn(),
    };

    const mockAudit = {
      logDecision: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PolicyEngineService,
        RuleEvaluatorService,
        { provide: PolicyRegistryService, useValue: mockRegistry },
        { provide: PolicyAuditService, useValue: mockAudit },
      ],
    }).compile();

    engine = module.get<PolicyEngineService>(PolicyEngineService);
    registry = module.get(PolicyRegistryService);
    audit = module.get(PolicyAuditService);
  });

  // ──────────────────────────────────────
  // Generic Evaluation
  // ──────────────────────────────────────

  describe('evaluate', () => {
    it('returns empty decision when no rules exist', async () => {
      registry.findActiveRules.mockResolvedValue([]);
      const ctx = buildContext();
      const decision = await engine.evaluate('TAX', ctx);

      expect(decision.matched).toBe(false);
      expect(decision.appliedRules).toHaveLength(0);
      expect(decision.fallbackUsed).toBe(true);
      expect(decision.evaluationMs).toBeGreaterThanOrEqual(0);
    });

    it('returns matched rules with actions', async () => {
      registry.findActiveRules.mockResolvedValue([nepalVatRule]);
      const ctx = buildContext({ country: 'NP' });
      const decision = await engine.evaluate('TAX', ctx);

      expect(decision.matched).toBe(true);
      expect(decision.appliedRules).toHaveLength(1);
      expect(decision.appliedRules[0].ruleId).toBe('rule_np_vat_13');
      expect(decision.actions).toHaveLength(1);
      expect(decision.actions[0].type).toBe('SET_RATE');
      expect(decision.fallbackUsed).toBe(false);
    });

    it('separates matched and eliminated rules', async () => {
      const indiaRule: SerializedPolicyRule = {
        ...nepalVatRule,
        id: 'rule_in_gst',
        name: 'India GST',
        country: 'IN',
        conditions: [{ field: 'country', operator: 'eq', value: 'IN' }],
      };

      registry.findActiveRules.mockResolvedValue([nepalVatRule, indiaRule]);
      const ctx = buildContext({ country: 'NP' });
      const decision = await engine.evaluate('TAX', ctx);

      expect(decision.appliedRules).toHaveLength(1);
      expect(decision.appliedRules[0].ruleId).toBe('rule_np_vat_13');
      expect(decision.eliminatedRules).toHaveLength(1);
      expect(decision.eliminatedRules[0].ruleId).toBe('rule_in_gst');
    });

    it('logs decision to audit service', async () => {
      registry.findActiveRules.mockResolvedValue([nepalVatRule]);
      const ctx = buildContext();
      await engine.evaluate('TAX', ctx, 'BOOKING', 'bkg_1', 'req_1');

      expect(audit.logDecision).toHaveBeenCalledWith(
        'TAX',
        ctx,
        expect.objectContaining({ matched: true }),
        'BOOKING',
        'bkg_1',
        'req_1',
      );
    });
  });

  // ──────────────────────────────────────
  // Tax Calculation
  // ──────────────────────────────────────

  describe('calculateTax', () => {
    it('applies Nepal VAT 13% to subtotal', async () => {
      registry.findActiveRules.mockResolvedValue([nepalVatRule]);
      const ctx = buildContext({ country: 'NP' });
      const result = await engine.calculateTax(ctx, 15000);

      expect(result.subtotal).toBe(15000);
      expect(result.taxLines).toHaveLength(1);
      expect(result.taxLines[0].type).toBe('VAT');
      expect(result.taxLines[0].name).toBe('Nepal VAT');
      expect(result.taxLines[0].rate).toBe(13);
      expect(result.taxLines[0].amount).toBe(1950);
      expect(result.totalTax).toBe(1950);
      expect(result.total).toBe(16950);
      expect(result.currency).toBe('NPR');
    });

    it('applies multiple tax lines (India GST split)', async () => {
      const indiaGstRules: SerializedPolicyRule = {
        ...nepalVatRule,
        id: 'rule_in_gst_18',
        name: 'India GST 18%',
        country: 'IN',
        conditions: [{ field: 'country', operator: 'eq', value: 'IN' }],
        actions: [
          { type: 'SET_RATE', params: { taxType: 'GST', name: 'CGST', rate: 9.0, jurisdiction: 'Central' } },
          { type: 'SET_RATE', params: { taxType: 'GST', name: 'SGST', rate: 9.0, jurisdiction: 'State' } },
        ],
      };

      registry.findActiveRules.mockResolvedValue([indiaGstRules]);
      const ctx = buildContext({ country: 'IN', currency: 'INR' });
      const result = await engine.calculateTax(ctx, 100000);

      expect(result.taxLines).toHaveLength(2);
      expect(result.taxLines[0].name).toBe('CGST');
      expect(result.taxLines[0].amount).toBe(9000);
      expect(result.taxLines[1].name).toBe('SGST');
      expect(result.taxLines[1].amount).toBe(9000);
      expect(result.totalTax).toBe(18000);
      expect(result.total).toBe(118000);
    });

    it('handles compound tax (tax-on-tax)', async () => {
      const compoundRule: SerializedPolicyRule = {
        ...nepalVatRule,
        id: 'rule_compound',
        name: 'Compound Tax Test',
        conditions: [{ field: 'country', operator: 'eq', value: 'NP' }],
        actions: [
          { type: 'SET_RATE', params: { taxType: 'VAT', name: 'Base VAT', rate: 10.0, jurisdiction: 'Nepal' } },
          { type: 'COMPOUND', params: { taxType: 'CESS', name: 'Health Cess', rate: 2.0, jurisdiction: 'Nepal' } },
        ],
      };

      registry.findActiveRules.mockResolvedValue([compoundRule]);
      const ctx = buildContext({ country: 'NP' });
      const result = await engine.calculateTax(ctx, 10000);

      // Base VAT: 10% of 10000 = 1000
      expect(result.taxLines[0].amount).toBe(1000);
      // Compound Cess: 2% of (10000 + 1000) = 220
      expect(result.taxLines[1].amount).toBe(220);
      expect(result.totalTax).toBe(1220);
      expect(result.total).toBe(11220);
    });

    it('returns zero tax when no rules match', async () => {
      registry.findActiveRules.mockResolvedValue([]);
      const ctx = buildContext({ country: 'BD' }); // No rules for Bangladesh
      const result = await engine.calculateTax(ctx, 10000);

      expect(result.totalTax).toBe(0);
      expect(result.total).toBe(10000);
      expect(result.taxLines).toHaveLength(0);
    });

    it('includes tax snapshot for auditing', async () => {
      registry.findActiveRules.mockResolvedValue([nepalVatRule]);
      const ctx = buildContext({ country: 'NP' });
      const result = await engine.calculateTax(ctx, 15000);

      expect(result.snapshot).toBeDefined();
      expect(result.snapshot.evaluatedAt).toBeTruthy();
      expect(result.snapshot.contextHash).toBeTruthy();
      expect(result.snapshot.rules).toHaveLength(1);
      expect(result.snapshot.rules[0].ruleId).toBe('rule_np_vat_13');
      expect(result.snapshot.rules[0].rate).toBe(13);
      expect(result.snapshot.rules[0].amount).toBe(1950);
    });
  });

  // ──────────────────────────────────────
  // Fee Calculation
  // ──────────────────────────────────────

  describe('calculateFees', () => {
    it('applies percentage-based fee', async () => {
      registry.findActiveRules.mockResolvedValue([platformFeeRule]);
      const ctx = buildContext({ country: 'NP' });
      const result = await engine.calculateFees(ctx, 15000);

      expect(result.baseFees).toHaveLength(1);
      expect(result.baseFees[0].feeType).toBe('PLATFORM_FEE');
      expect(result.baseFees[0].amount).toBe(1800);
      expect(result.totalFees).toBe(1800);
    });

    it('applies fixed-amount fee', async () => {
      const fixedFeeRule: SerializedPolicyRule = {
        ...platformFeeRule,
        id: 'rule_fee_fixed',
        actions: [
          { type: 'SET_FIXED_AMOUNT', params: { feeType: 'BOOKING_FEE', name: 'Booking Fee', amount: 500 } },
        ],
      };

      registry.findActiveRules.mockResolvedValue([fixedFeeRule]);
      const ctx = buildContext({ country: 'NP' });
      const result = await engine.calculateFees(ctx, 15000);

      expect(result.baseFees[0].amount).toBe(500);
      expect(result.totalFees).toBe(500);
    });

    it('returns zero fees when no rules match', async () => {
      registry.findActiveRules.mockResolvedValue([]);
      const ctx = buildContext();
      const result = await engine.calculateFees(ctx, 15000);

      expect(result.totalFees).toBe(0);
      expect(result.baseFees).toHaveLength(0);
    });
  });

  // ──────────────────────────────────────
  // Booking Constraints
  // ──────────────────────────────────────

  describe('evaluateBookingConstraints', () => {
    it('allows booking when no constraints match', async () => {
      registry.findActiveRules.mockResolvedValue([]);
      const ctx = buildContext();
      const result = await engine.evaluateBookingConstraints(ctx);

      expect(result.isAllowed).toBe(true);
      expect(result.blockedReasons).toHaveLength(0);
      expect(result.priceMultiplier).toBe(1.0);
    });

    it('blocks booking when BLOCK action matches', async () => {
      const blockRule: SerializedPolicyRule = {
        ...nepalVatRule,
        id: 'rule_nyc_block',
        type: 'BOOKING_CONSTRAINT',
        conditions: [{ field: 'country', operator: 'eq', value: 'NP' }],
        actions: [
          { type: 'BLOCK', params: { reason: 'Restricted area', referenceUrl: 'https://example.com' } },
        ],
      };

      registry.findActiveRules.mockResolvedValue([blockRule]);
      const ctx = buildContext({ country: 'NP' });
      const result = await engine.evaluateBookingConstraints(ctx);

      expect(result.isAllowed).toBe(false);
      expect(result.blockedReasons).toHaveLength(1);
      expect(result.blockedReasons[0].reason).toBe('Restricted area');
      expect(result.blockedReasons[0].referenceUrl).toBe('https://example.com');
    });

    it('enforces min/max stay constraints (most restrictive)', async () => {
      const minStayRule: SerializedPolicyRule = {
        ...nepalVatRule,
        id: 'rule_min_2',
        type: 'BOOKING_CONSTRAINT',
        conditions: [{ field: 'country', operator: 'eq', value: 'NP' }],
        actions: [{ type: 'SET_MIN_MAX', params: { min: 2, max: 90 } }],
      };

      const maxStayRule: SerializedPolicyRule = {
        ...nepalVatRule,
        id: 'rule_max_28',
        type: 'BOOKING_CONSTRAINT',
        conditions: [{ field: 'country', operator: 'eq', value: 'NP' }],
        actions: [{ type: 'SET_MIN_MAX', params: { min: 1, max: 28 } }],
      };

      registry.findActiveRules.mockResolvedValue([minStayRule, maxStayRule]);
      const ctx = buildContext({ country: 'NP' });
      const result = await engine.evaluateBookingConstraints(ctx);

      expect(result.isAllowed).toBe(true);
      expect(result.minStay).toBe(2);  // Most restrictive min
      expect(result.maxStay).toBe(28); // Most restrictive max
    });

    it('compounds price multipliers', async () => {
      const weekendRule: SerializedPolicyRule = {
        ...nepalVatRule,
        id: 'rule_weekend',
        type: 'BOOKING_CONSTRAINT',
        conditions: [{ field: 'country', operator: 'eq', value: 'NP' }],
        actions: [{ type: 'SET_MULTIPLIER', params: { multiplier: 1.2 } }],
      };

      const holidayRule: SerializedPolicyRule = {
        ...nepalVatRule,
        id: 'rule_holiday',
        type: 'BOOKING_CONSTRAINT',
        conditions: [{ field: 'country', operator: 'eq', value: 'NP' }],
        actions: [{ type: 'SET_MULTIPLIER', params: { multiplier: 1.5 } }],
      };

      registry.findActiveRules.mockResolvedValue([weekendRule, holidayRule]);
      const ctx = buildContext({ country: 'NP' });
      const result = await engine.evaluateBookingConstraints(ctx);

      // 1.2 × 1.5 = 1.8
      expect(result.priceMultiplier).toBeCloseTo(1.8, 2);
    });

    it('collects document requirements', async () => {
      const docRule: SerializedPolicyRule = {
        ...nepalVatRule,
        id: 'rule_doc',
        type: 'BOOKING_CONSTRAINT',
        conditions: [{ field: 'country', operator: 'eq', value: 'NP' }],
        actions: [
          { type: 'REQUIRE_DOCUMENT', params: { documentType: 'PAN_CARD', label: 'PAN Card', threshold: 50000 } },
        ],
      };

      registry.findActiveRules.mockResolvedValue([docRule]);
      const ctx = buildContext({ country: 'NP' });
      const result = await engine.evaluateBookingConstraints(ctx);

      expect(result.requiredDocuments).toHaveLength(1);
      expect(result.requiredDocuments[0].documentType).toBe('PAN_CARD');
      expect(result.requiredDocuments[0].threshold).toBe(50000);
    });
  });

  // ──────────────────────────────────────
  // Cancellation Evaluation
  // ──────────────────────────────────────

  describe('evaluateCancellation', () => {
    it('returns empty tiers when no rules match', async () => {
      registry.findActiveRules.mockResolvedValue([]);
      const ctx = buildContext();
      const result = await engine.evaluateCancellation(ctx);

      expect(result.tiers).toHaveLength(0);
      expect(result.refundServiceFee).toBe(true);
      expect(result.refundPlatformFee).toBe(true);
      expect(result.alwaysRefundDeposit).toBe(true);
      expect(result.flatPenalty).toBe(0);
    });

    it('parses tiered cancellation from SET_OBJECT action', async () => {
      const cancelRule: SerializedPolicyRule = {
        ...nepalVatRule,
        id: 'rule_cancel_np',
        type: 'CANCELLATION',
        conditions: [{ field: 'country', operator: 'eq', value: 'NP' }],
        actions: [
          {
            type: 'SET_OBJECT',
            params: {
              tiers: [
                { minHoursBefore: 0, maxHoursBefore: 24, refundPercentage: 0.25, label: '25% <24h' },
                { minHoursBefore: 72, maxHoursBefore: null, refundPercentage: 1.0, label: 'Full >72h' },
                { minHoursBefore: 24, maxHoursBefore: 72, refundPercentage: 0.75, label: '75% 24-72h' },
              ],
            },
          },
        ],
      };

      registry.findActiveRules.mockResolvedValue([cancelRule]);
      const ctx = buildContext({ country: 'NP' });
      const result = await engine.evaluateCancellation(ctx);

      expect(result.tiers).toHaveLength(3);
      // Should be sorted descending by minHoursBefore
      expect(result.tiers[0].minHoursBefore).toBe(72);
      expect(result.tiers[0].refundPercentage).toBe(1.0);
      expect(result.tiers[1].minHoursBefore).toBe(24);
      expect(result.tiers[2].minHoursBefore).toBe(0);
    });

    it('handles SET_BOOLEAN for fee refund flags', async () => {
      const cancelRule: SerializedPolicyRule = {
        ...nepalVatRule,
        id: 'rule_cancel_in',
        type: 'CANCELLATION',
        conditions: [{ field: 'country', operator: 'eq', value: 'IN' }],
        actions: [
          {
            type: 'SET_BOOLEAN',
            params: { refundServiceFee: false, refundPlatformFee: true, alwaysRefundDeposit: true },
          },
        ],
      };

      registry.findActiveRules.mockResolvedValue([cancelRule]);
      const ctx = buildContext({ country: 'IN' });
      const result = await engine.evaluateCancellation(ctx);

      expect(result.refundServiceFee).toBe(false);
      expect(result.refundPlatformFee).toBe(true);
    });

    it('accumulates flat penalties from SET_FIXED_AMOUNT', async () => {
      const cancelRule: SerializedPolicyRule = {
        ...nepalVatRule,
        id: 'rule_penalty',
        type: 'CANCELLATION',
        conditions: [{ field: 'country', operator: 'eq', value: 'NP' }],
        actions: [
          { type: 'SET_FIXED_AMOUNT', params: { penalty: 200 } },
          { type: 'SET_FIXED_AMOUNT', params: { amount: 100 } },
        ],
      };

      registry.findActiveRules.mockResolvedValue([cancelRule]);
      const ctx = buildContext({ country: 'NP' });
      const result = await engine.evaluateCancellation(ctx);

      expect(result.flatPenalty).toBe(300);
    });

    it('includes applied rule IDs', async () => {
      const cancelRule: SerializedPolicyRule = {
        ...nepalVatRule,
        id: 'rule_cancel_np',
        type: 'CANCELLATION',
        conditions: [{ field: 'country', operator: 'eq', value: 'NP' }],
        actions: [
          { type: 'SET_OBJECT', params: { tiers: [{ minHoursBefore: 0, maxHoursBefore: null, refundPercentage: 1.0, label: 'Full' }] } },
        ],
      };

      registry.findActiveRules.mockResolvedValue([cancelRule]);
      const ctx = buildContext({ country: 'NP' });
      const result = await engine.evaluateCancellation(ctx);

      expect(result.appliedRules).toContain('rule_cancel_np');
    });
  });
});
