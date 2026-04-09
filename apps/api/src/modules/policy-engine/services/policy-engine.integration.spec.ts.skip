import { Test, TestingModule } from '@nestjs/testing';
import { PolicyEngineService } from './policy-engine.service';
import { RuleEvaluatorService } from './rule-evaluator.service';
import { PolicyRegistryService } from './policy-registry.service';
import { PolicyAuditService } from './policy-audit.service';
import {
  PolicyType,
  PolicyContext,
  FeeBreakdown,
  TaxBreakdown,
} from '../interfaces';

/**
 * POLICY ENGINE INTEGRATION TESTS
 * 
 * These tests validate the PolicyEngine integration with:
 * - Rule evaluation flow
 * - Action aggregation
 * - Tax calculation
 * - Fee calculation
 * - Audit logging
 * - Performance metrics
 * 
 * Business Truth Validated:
 * - PolicyEngine correctly evaluates rules
 * - Actions are aggregated from matched rules
 * - Tax/fee calculations are accurate
 * - Audit trail is maintained
 * - Performance is tracked
 */
describe('PolicyEngineService - Integration', () => {
  let policyEngine: PolicyEngineService;
  let registry: jest.Mocked<PolicyRegistryService>;
  let evaluator: jest.Mocked<RuleEvaluatorService>;
  let audit: jest.Mocked<PolicyAuditService>;

  beforeEach(async () => {
    const mockRegistry = {
      findActiveRules: jest.fn(),
      getRule: jest.fn(),
    };

    const mockEvaluator = {
      evaluateRule: jest.fn(),
    };

    const mockAudit = {
      logDecision: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PolicyEngineService,
        { provide: PolicyRegistryService, useValue: mockRegistry },
        { provide: RuleEvaluatorService, useValue: mockEvaluator },
        { provide: PolicyAuditService, useValue: mockAudit },
      ],
    }).compile();

    policyEngine = module.get<PolicyEngineService>(PolicyEngineService);
    registry = module.get(PolicyRegistryService);
    evaluator = module.get(RuleEvaluatorService);
    audit = module.get(PolicyAuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Rule Evaluation Flow', () => {
    it('should evaluate rules and return decision with matched/eliminated rules', async () => {
      const context: PolicyContext = {
        locale: 'en',
        country: 'NP',
        state: 'Bagmati',
        city: 'Kathmandu',
        timezone: 'Asia/Kathmandu',
        currency: 'NPR',
        userId: 'user-123',
        userRole: 'RENTER',
        userCountry: 'NP',
        listingId: 'listing-123',
        listingCategory: 'electronics',
        listingCountry: 'NP',
        listingState: 'Bagmati',
        listingCity: 'Kathmandu',
        bookingValue: 10000,
        bookingDuration: 24,
        bookingCurrency: 'NPR',
        startDate: '2026-04-05',
        endDate: '2026-04-06',
        guestCount: 1,
        hostPresent: false,
        requestTimestamp: new Date().toISOString(),
        evaluationDate: new Date().toISOString(),
        ipCountry: 'NP',
        platform: 'web',
        tenantId: null,
        workspaceConfig: {},
      };

      const mockRules = [
        {
          id: 'rule-1',
          version: 1,
          policyType: 'FEE',
          conditions: [{ field: 'country', operator: 'eq', value: 'NP' }],
          actions: [{ type: 'SET_RATE' as const, params: { feeType: 'platform', rate: 10 } }],
        },
      ];

      registry.findActiveRules.mockResolvedValue(mockRules as any);
      evaluator.evaluateRule.mockReturnValue({
        ruleId: 'rule-1',
        ruleName: 'Platform Fee',
        matched: true,
        conditionResults: [
          {
            field: 'country',
            operator: 'eq',
            expected: 'NP',
            actual: 'NP',
            matched: true,
          },
        ],
        actions: mockRules[0].actions,
      });

      const decision = await policyEngine.evaluate('FEE', context);

      expect(decision.matched).toBe(true);
      expect(decision.appliedRules).toHaveLength(1);
      expect(decision.eliminatedRules).toHaveLength(0);
      expect(decision.actions).toHaveLength(1);
      expect(decision.evaluationMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle no matched rules with fallback', async () => {
      const context: PolicyContext = {
        locale: 'en',
        country: 'XX',
        state: null,
        city: null,
        timezone: 'UTC',
        currency: 'USD',
        userId: null,
        userRole: 'GUEST',
        userCountry: null,
        listingId: null,
        listingCategory: null,
        listingCountry: null,
        listingState: null,
        listingCity: null,
        bookingValue: null,
        bookingDuration: null,
        bookingCurrency: null,
        startDate: null,
        endDate: null,
        guestCount: null,
        hostPresent: null,
        requestTimestamp: new Date().toISOString(),
        evaluationDate: new Date().toISOString(),
        ipCountry: null,
        platform: 'web',
        tenantId: null,
        workspaceConfig: {},
      };

      registry.findActiveRules.mockResolvedValue([]);

      const decision = await policyEngine.evaluate('FEE', context);

      expect(decision.matched).toBe(false);
      expect(decision.fallbackUsed).toBe(true);
      expect(decision.appliedRules).toHaveLength(0);
    });

    it('should track eliminated rules', async () => {
      const context: PolicyContext = {
        locale: 'en',
        country: 'NP',
        state: 'Bagmati',
        city: 'Kathmandu',
        timezone: 'Asia/Kathmandu',
        currency: 'NPR',
        userId: 'user-123',
        userRole: 'RENTER',
        userCountry: 'NP',
        listingId: 'listing-123',
        listingCategory: 'electronics',
        listingCountry: 'NP',
        listingState: 'Bagmati',
        listingCity: 'Kathmandu',
        bookingValue: 10000,
        bookingDuration: 24,
        bookingCurrency: 'NPR',
        startDate: '2026-04-05',
        endDate: '2026-04-06',
        guestCount: 1,
        hostPresent: false,
        requestTimestamp: new Date().toISOString(),
        evaluationDate: new Date().toISOString(),
        ipCountry: 'NP',
        platform: 'web',
        tenantId: null,
        workspaceConfig: {},
      };

      const mockRules = [
        {
          id: 'rule-1',
          version: 1,
          policyType: 'FEE',
          conditions: [{ field: 'country', operator: 'eq', value: 'US' }],
          actions: [{ type: 'SET_RATE' as const, params: { feeType: 'platform', rate: 12 } }],
        },
      ];

      registry.findActiveRules.mockResolvedValue(mockRules as any);
      evaluator.evaluateRule.mockReturnValue({
        ruleId: 'rule-1',
        ruleName: 'Platform Fee US',
        matched: false,
        conditionResults: [
          {
            field: 'country',
            operator: 'eq',
            expected: 'US',
            actual: 'NP',
            matched: false,
          },
        ],
        actions: [],
      });

      const decision = await policyEngine.evaluate('FEE', context);

      expect(decision.matched).toBe(false);
      expect(decision.appliedRules).toHaveLength(0);
      expect(decision.eliminatedRules).toHaveLength(1);
    });
  });

  describe('Tax Calculation', () => {
    it('should calculate tax with proper breakdown', async () => {
      const context: PolicyContext = {
        locale: 'en',
        country: 'NP',
        state: 'Bagmati',
        city: 'Kathmandu',
        timezone: 'Asia/Kathmandu',
        currency: 'NPR',
        userId: 'user-123',
        userRole: 'RENTER',
        userCountry: 'NP',
        listingId: 'listing-123',
        listingCategory: 'electronics',
        listingCountry: 'NP',
        listingState: 'Bagmati',
        listingCity: 'Kathmandu',
        bookingValue: 10000,
        bookingDuration: 24,
        bookingCurrency: 'NPR',
        startDate: '2026-04-05',
        endDate: '2026-04-06',
        guestCount: 1,
        hostPresent: false,
        requestTimestamp: new Date().toISOString(),
        evaluationDate: new Date().toISOString(),
        ipCountry: 'NP',
        platform: 'web',
        tenantId: null,
        workspaceConfig: {},
      };

      const mockRules = [
        {
          id: 'np-vat',
          version: 1,
          policyType: 'TAX',
          conditions: [{ field: 'country', operator: 'eq', value: 'NP' }],
          actions: [{ type: 'SET_RATE' as const, params: { taxType: 'VAT', name: 'VAT', rate: 13, jurisdiction: 'NP' } }],
        },
      ];

      registry.findActiveRules.mockResolvedValue(mockRules as any);
      evaluator.evaluateRule.mockReturnValue({
        ruleId: 'np-vat',
        ruleName: 'Nepal VAT',
        matched: true,
        conditionResults: [
          {
            field: 'country',
            operator: 'eq',
            expected: 'NP',
            actual: 'NP',
            matched: true,
          },
        ],
        actions: mockRules[0].actions,
      });

      const taxBreakdown = await policyEngine.calculateTax(context, 10000);

      expect(taxBreakdown.subtotal).toBe(10000);
      expect(taxBreakdown.totalTax).toBe(1300); // 13% of 10,000
      expect(taxBreakdown.total).toBe(11300);
      expect(taxBreakdown.taxLines).toHaveLength(1);
      expect(taxBreakdown.taxLines[0].rate).toBe(13);
      expect(taxBreakdown.taxLines[0].amount).toBe(1300);
      expect(taxBreakdown.currency).toBe('NPR');
      expect(taxBreakdown.snapshot).toBeDefined();
    });
  });

  describe('Fee Calculation', () => {
    it('should calculate fees with proper breakdown', async () => {
      const context: PolicyContext = {
        locale: 'en',
        country: 'NP',
        state: 'Bagmati',
        city: 'Kathmandu',
        timezone: 'Asia/Kathmandu',
        currency: 'NPR',
        userId: 'user-123',
        userRole: 'RENTER',
        userCountry: 'NP',
        listingId: 'listing-123',
        listingCategory: 'electronics',
        listingCountry: 'NP',
        listingState: 'Bagmati',
        listingCity: 'Kathmandu',
        bookingValue: 10000,
        bookingDuration: 24,
        bookingCurrency: 'NPR',
        startDate: '2026-04-05',
        endDate: '2026-04-06',
        guestCount: 1,
        hostPresent: false,
        requestTimestamp: new Date().toISOString(),
        evaluationDate: new Date().toISOString(),
        ipCountry: 'NP',
        platform: 'web',
        tenantId: null,
        workspaceConfig: {},
      };

      const mockRules = [
        {
          id: 'np-platform-fee',
          version: 1,
          policyType: 'FEE',
          conditions: [{ field: 'country', operator: 'eq', value: 'NP' }],
          actions: [{ type: 'SET_RATE' as const, params: { feeType: 'platform', rate: 10 } }],
        },
      ];

      registry.findActiveRules.mockResolvedValue(mockRules as any);
      evaluator.evaluateRule.mockReturnValue({
        ruleId: 'np-platform-fee',
        ruleName: 'Platform Fee',
        matched: true,
        conditionResults: [
          {
            field: 'country',
            operator: 'eq',
            expected: 'NP',
            actual: 'NP',
            matched: true,
          },
        ],
        actions: mockRules[0].actions,
      });

      const feeBreakdown = await policyEngine.calculateFees(context, 10000);

      expect(feeBreakdown.totalFees).toBe(1000); // 10% of 10,000
      expect(feeBreakdown.baseFees).toHaveLength(1);
      expect(feeBreakdown.baseFees[0].rate).toBe(10);
      expect(feeBreakdown.baseFees[0].amount).toBe(1000);
      expect(feeBreakdown.currency).toBe('NPR');
    });
  });

  describe('Audit Logging', () => {
    it('should log policy decisions for audit trail', async () => {
      const context: PolicyContext = {
        locale: 'en',
        country: 'NP',
        state: 'Bagmati',
        city: 'Kathmandu',
        timezone: 'Asia/Kathmandu',
        currency: 'NPR',
        userId: 'user-123',
        userRole: 'RENTER',
        userCountry: 'NP',
        listingId: 'listing-123',
        listingCategory: 'electronics',
        listingCountry: 'NP',
        listingState: 'Bagmati',
        listingCity: 'Kathmandu',
        bookingValue: 10000,
        bookingDuration: 24,
        bookingCurrency: 'NPR',
        startDate: '2026-04-05',
        endDate: '2026-04-06',
        guestCount: 1,
        hostPresent: false,
        requestTimestamp: new Date().toISOString(),
        evaluationDate: new Date().toISOString(),
        ipCountry: 'NP',
        platform: 'web',
        tenantId: null,
        workspaceConfig: {},
      };

      const mockRules = [
        {
          id: 'rule-1',
          version: 1,
          policyType: 'FEE',
          conditions: [{ field: 'country', operator: 'eq', value: 'NP' }],
          actions: [{ type: 'SET_RATE' as const, params: { feeType: 'platform', rate: 10 } }],
        },
      ];

      registry.findActiveRules.mockResolvedValue(mockRules as any);
      evaluator.evaluateRule.mockReturnValue({
        ruleId: 'rule-1',
        ruleName: 'Platform Fee',
        matched: true,
        conditionResults: [
          {
            field: 'country',
            operator: 'eq',
            expected: 'NP',
            actual: 'NP',
            matched: true,
          },
        ],
        actions: mockRules[0].actions,
      });

      await policyEngine.evaluate('FEE', context, 'booking', 'booking-123', 'request-123');

      expect(audit.logDecision).toHaveBeenCalledWith(
        'FEE',
        context,
        expect.any(Object),
        'booking',
        'booking-123',
        'request-123'
      );
    });
  });

  describe('Performance Metrics', () => {
    it('should track evaluation performance', async () => {
      const context: PolicyContext = {
        locale: 'en',
        country: 'NP',
        state: 'Bagmati',
        city: 'Kathmandu',
        timezone: 'Asia/Kathmandu',
        currency: 'NPR',
        userId: 'user-123',
        userRole: 'RENTER',
        userCountry: 'NP',
        listingId: 'listing-123',
        listingCategory: 'electronics',
        listingCountry: 'NP',
        listingState: 'Bagmati',
        listingCity: 'Kathmandu',
        bookingValue: 10000,
        bookingDuration: 24,
        bookingCurrency: 'NPR',
        startDate: '2026-04-05',
        endDate: '2026-04-06',
        guestCount: 1,
        hostPresent: false,
        requestTimestamp: new Date().toISOString(),
        evaluationDate: new Date().toISOString(),
        ipCountry: 'NP',
        platform: 'web',
        tenantId: null,
        workspaceConfig: {},
      };

      const mockRules = [
        {
          id: 'rule-1',
          version: 1,
          policyType: 'FEE',
          conditions: [{ field: 'country', operator: 'eq', value: 'NP' }],
          actions: [{ type: 'SET_RATE' as const, params: { feeType: 'platform', rate: 10 } }],
        },
      ];

      registry.findActiveRules.mockResolvedValue(mockRules as any);
      evaluator.evaluateRule.mockReturnValue({
        ruleId: 'rule-1',
        ruleName: 'Platform Fee',
        matched: true,
        conditionResults: [
          {
            field: 'country',
            operator: 'eq',
            expected: 'NP',
            actual: 'NP',
            matched: true,
          },
        ],
        actions: mockRules[0].actions,
      });

      const decision = await policyEngine.evaluate('FEE', context);

      expect(decision.evaluationMs).toBeGreaterThanOrEqual(0);
      expect(typeof decision.evaluationMs).toBe('number');
    });
  });

  describe('Action Aggregation', () => {
    it('should aggregate actions from multiple matched rules', async () => {
      const context: PolicyContext = {
        locale: 'en',
        country: 'NP',
        state: 'Bagmati',
        city: 'Kathmandu',
        timezone: 'Asia/Kathmandu',
        currency: 'NPR',
        userId: 'user-123',
        userRole: 'RENTER',
        userCountry: 'NP',
        listingId: 'listing-123',
        listingCategory: 'electronics',
        listingCountry: 'NP',
        listingState: 'Bagmati',
        listingCity: 'Kathmandu',
        bookingValue: 10000,
        bookingDuration: 24,
        bookingCurrency: 'NPR',
        startDate: '2026-04-05',
        endDate: '2026-04-06',
        guestCount: 1,
        hostPresent: false,
        requestTimestamp: new Date().toISOString(),
        evaluationDate: new Date().toISOString(),
        ipCountry: 'NP',
        platform: 'web',
        tenantId: null,
        workspaceConfig: {},
      };

      const mockRules = [
        {
          id: 'rule-1',
          version: 1,
          policyType: 'FEE',
          conditions: [{ field: 'country', operator: 'eq', value: 'NP' }],
          actions: [{ type: 'SET_RATE' as const, params: { feeType: 'platform', rate: 10 } }],
        },
        {
          id: 'rule-2',
          version: 1,
          policyType: 'FEE',
          conditions: [{ field: 'country', operator: 'eq', value: 'NP' }],
          actions: [{ type: 'SET_RATE' as const, params: { feeType: 'service', rate: 5 } }],
        },
      ];

      registry.findActiveRules.mockResolvedValue(mockRules as any);
      evaluator.evaluateRule.mockImplementation((rule) => ({
        ruleId: rule.id,
        ruleName: `Rule ${rule.id}`,
        matched: true,
        conditionResults: [
          {
            field: 'country',
            operator: 'eq',
            expected: 'NP',
            actual: 'NP',
            matched: true,
          },
        ],
        actions: rule.actions,
      }));

      const decision = await policyEngine.evaluate('FEE', context);

      expect(decision.appliedRules).toHaveLength(2);
      expect(decision.actions).toHaveLength(2);
    });
  });

  // ──────────────────────────────────────────────────────
  // COMPREHENSIVE FEE CALCULATION TESTS (Task 1.3.2)
  // ──────────────────────────────────────────────────────

  describe('Comprehensive Fee Calculation', () => {
    describe('Platform Fee Variations', () => {
      it('should calculate different platform fees by country', async () => {
        // Test Nepal: 10% platform fee
        const npContext: PolicyContext = {
          locale: 'en',
          country: 'NP',
          state: 'Bagmati',
          city: 'Kathmandu',
          timezone: 'Asia/Kathmandu',
          currency: 'NPR',
          userId: 'user-123',
          userRole: 'RENTER',
          userCountry: 'NP',
          listingId: 'listing-123',
          listingCategory: 'electronics',
          listingCountry: 'NP',
          listingState: 'Bagmati',
          listingCity: 'Kathmandu',
          bookingValue: 10000,
          bookingDuration: 24,
          bookingCurrency: 'NPR',
          startDate: '2026-04-05',
          endDate: '2026-04-06',
          guestCount: 1,
          hostPresent: false,
          requestTimestamp: new Date().toISOString(),
          evaluationDate: new Date().toISOString(),
          ipCountry: 'NP',
          platform: 'web',
          tenantId: null,
          workspaceConfig: {},
        };

        const npRules = [
          {
            id: 'np-platform-fee',
            version: 1,
            policyType: 'FEE',
            conditions: [{ field: 'country', operator: 'eq', value: 'NP' }],
            actions: [{ type: 'SET_RATE' as const, params: { feeType: 'platform', rate: 10, name: 'Nepal Platform Fee' } }],
          },
        ];

        registry.findActiveRules.mockResolvedValue(npRules as any);
        evaluator.evaluateRule.mockReturnValue({
          ruleId: 'np-platform-fee',
          ruleName: 'Nepal Platform Fee',
          matched: true,
          conditionResults: [{ field: 'country', operator: 'eq', expected: 'NP', actual: 'NP', matched: true }],
          actions: npRules[0].actions,
        });

        const npFees = await policyEngine.calculateFees(npContext, 10000);
        expect(npFees.totalFees).toBe(1000); // 10% of 10,000
        expect(npFees.baseFees[0].rate).toBe(10);
        expect(npFees.currency).toBe('NPR');

        // Test US: 12% platform fee
        const usContext = { ...npContext, country: 'US', currency: 'USD' };
        const usRules = [
          {
            id: 'us-platform-fee',
            version: 1,
            policyType: 'FEE',
            conditions: [{ field: 'country', operator: 'eq', value: 'US' }],
            actions: [{ type: 'SET_RATE' as const, params: { feeType: 'platform', rate: 12, name: 'US Platform Fee' } }],
          },
        ];

        registry.findActiveRules.mockResolvedValue(usRules as any);
        evaluator.evaluateRule.mockReturnValue({
          ruleId: 'us-platform-fee',
          ruleName: 'US Platform Fee',
          matched: true,
          conditionResults: [{ field: 'country', operator: 'eq', expected: 'US', actual: 'US', matched: true }],
          actions: usRules[0].actions,
        });

        const usFees = await policyEngine.calculateFees(usContext, 10000);
        expect(usFees.totalFees).toBe(1200); // 12% of 10,000
        expect(usFees.baseFees[0].rate).toBe(12);
        expect(usFees.currency).toBe('USD');
      });

      it('should apply regional fee variations within countries', async () => {
        const kathmanduContext: PolicyContext = {
          locale: 'en',
          country: 'NP',
          state: 'Bagmati',
          city: 'Kathmandu',
          timezone: 'Asia/Kathmandu',
          currency: 'NPR',
          userId: 'user-123',
          userRole: 'RENTER',
          userCountry: 'NP',
          listingId: 'listing-123',
          listingCategory: 'property',
          listingCountry: 'NP',
          listingState: 'Bagmati',
          listingCity: 'Kathmandu',
          bookingValue: 50000,
          bookingDuration: 30,
          bookingCurrency: 'NPR',
          startDate: '2026-04-05',
          endDate: '2026-05-05',
          guestCount: 2,
          hostPresent: false,
          requestTimestamp: new Date().toISOString(),
          evaluationDate: new Date().toISOString(),
          ipCountry: 'NP',
          platform: 'web',
          tenantId: null,
          workspaceConfig: {},
        };

        // Kathmandu (urban): Higher platform fee
        const kathmanduRules = [
          {
            id: 'kathmandu-urban-fee',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'country', operator: 'eq', value: 'NP' },
              { field: 'state', operator: 'eq', value: 'Bagmati' },
              { field: 'city', operator: 'eq', value: 'Kathmandu' },
            ],
            actions: [{ type: 'SET_RATE' as const, params: { feeType: 'platform', rate: 12, name: 'Kathmandu Urban Fee' } }],
          },
        ];

        registry.findActiveRules.mockResolvedValue(kathmanduRules as any);
        evaluator.evaluateRule.mockReturnValue({
          ruleId: 'kathmandu-urban-fee',
          ruleName: 'Kathmandu Urban Fee',
          matched: true,
          conditionResults: [
            { field: 'country', operator: 'eq', expected: 'NP', actual: 'NP', matched: true },
            { field: 'state', operator: 'eq', expected: 'Bagmati', actual: 'Bagmati', matched: true },
            { field: 'city', operator: 'eq', expected: 'Kathmandu', actual: 'Kathmandu', matched: true },
          ],
          actions: kathmanduRules[0].actions,
        });

        const kathmanduFees = await policyEngine.calculateFees(kathmanduContext, 50000);
        expect(kathmanduFees.totalFees).toBe(6000); // 12% of 50,000

        // Pokhara (tourist area): Standard platform fee
        const pokharaContext = { ...kathmanduContext, city: 'Pokhara', state: 'Gandaki' };
        const pokharaRules = [
          {
            id: 'pokhara-standard-fee',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'country', operator: 'eq', value: 'NP' },
              { field: 'state', operator: 'eq', value: 'Gandaki' },
            ],
            actions: [{ type: 'SET_RATE' as const, params: { feeType: 'platform', rate: 10, name: 'Pokhara Standard Fee' } }],
          },
        ];

        registry.findActiveRules.mockResolvedValue(pokharaRules as any);
        evaluator.evaluateRule.mockReturnValue({
          ruleId: 'pokhara-standard-fee',
          ruleName: 'Pokhara Standard Fee',
          matched: true,
          conditionResults: [
            { field: 'country', operator: 'eq', expected: 'NP', actual: 'NP', matched: true },
            { field: 'state', operator: 'eq', expected: 'Gandaki', actual: 'Gandaki', matched: true },
          ],
          actions: pokharaRules[0].actions,
        });

        const pokharaFees = await policyEngine.calculateFees(pokharaContext, 50000);
        expect(pokharaFees.totalFees).toBe(5000); // 10% of 50,000
      });
    });

    describe('Payment Processing Fees', () => {
      it('should add payment processing fees based on payment method', async () => {
        const context: PolicyContext = {
          locale: 'en',
          country: 'NP',
          state: 'Bagmati',
          city: 'Kathmandu',
          timezone: 'Asia/Kathmandu',
          currency: 'NPR',
          userId: 'user-123',
          userRole: 'RENTER',
          userCountry: 'NP',
          listingId: 'listing-123',
          listingCategory: 'electronics',
          listingCountry: 'NP',
          listingState: 'Bagmati',
          listingCity: 'Kathmandu',
          bookingValue: 10000,
          bookingDuration: 24,
          bookingCurrency: 'NPR',
          startDate: '2026-04-05',
          endDate: '2026-04-06',
          guestCount: 1,
          hostPresent: false,
          requestTimestamp: new Date().toISOString(),
          evaluationDate: new Date().toISOString(),
          ipCountry: 'NP',
          platform: 'web',
          tenantId: null,
          workspaceConfig: { paymentMethod: 'stripe' },
        };

        const paymentFeeRules = [
          {
            id: 'stripe-processing-fee',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'country', operator: 'eq', value: 'NP' },
              { field: 'workspaceConfig.paymentMethod', operator: 'eq', value: 'stripe' },
            ],
            actions: [
              { type: 'SET_RATE' as const, params: { feeType: 'payment_processing', rate: 2.9, name: 'Stripe Processing Fee' } },
              { type: 'SET_FIXED_AMOUNT' as const, params: { feeType: 'payment_fixed', amount: 30, name: 'Stripe Fixed Fee' } },
            ],
          },
        ];

        registry.findActiveRules.mockResolvedValue(paymentFeeRules as any);
        evaluator.evaluateRule.mockReturnValue({
          ruleId: 'stripe-processing-fee',
          ruleName: 'Stripe Processing Fee',
          matched: true,
          conditionResults: [
            { field: 'country', operator: 'eq', expected: 'NP', actual: 'NP', matched: true },
            { field: 'workspaceConfig.paymentMethod', operator: 'eq', expected: 'stripe', actual: 'stripe', matched: true },
          ],
          actions: paymentFeeRules[0].actions,
        });

        const fees = await policyEngine.calculateFees(context, 10000);
        
        // Should have platform fee + processing fee + fixed fee
        expect(fees.baseFees).toHaveLength(3);
        expect(fees.totalFees).toBeGreaterThan(1000); // Platform fee + processing fees
        
        const processingFee = fees.baseFees.find(f => f.feeType === 'payment_processing');
        const fixedFee = fees.baseFees.find(f => f.feeType === 'payment_fixed');
        
        expect(processingFee?.rate).toBe(2.9);
        expect(processingFee?.amount).toBe(290); // 2.9% of 10,000
        expect(fixedFee?.amount).toBe(30);
      });

      it('should apply different processing fees for international payments', async () => {
        const internationalContext: PolicyContext = {
          locale: 'en',
          country: 'US',
          state: 'CA',
          city: 'San Francisco',
          timezone: 'America/Los_Angeles',
          currency: 'USD',
          userId: 'user-123',
          userRole: 'RENTER',
          userCountry: 'NP', // User from Nepal paying for US listing
          listingId: 'listing-123',
          listingCategory: 'property',
          listingCountry: 'US',
          listingState: 'CA',
          listingCity: 'San Francisco',
          bookingValue: 1000,
          bookingDuration: 7,
          bookingCurrency: 'USD',
          startDate: '2026-04-05',
          endDate: '2026-04-12',
          guestCount: 1,
          hostPresent: false,
          requestTimestamp: new Date().toISOString(),
          evaluationDate: new Date().toISOString(),
          ipCountry: 'NP',
          platform: 'web',
          tenantId: null,
          workspaceConfig: { paymentMethod: 'stripe', isInternational: true },
        };

        const internationalFeeRules = [
          {
            id: 'international-stripe-fee',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'workspaceConfig.isInternational', operator: 'eq', value: true },
              { field: 'workspaceConfig.paymentMethod', operator: 'eq', value: 'stripe' },
            ],
            actions: [
              { type: 'SET_RATE' as const, params: { feeType: 'payment_processing', rate: 3.9, name: 'International Stripe Fee' } },
              { type: 'SET_FIXED_AMOUNT' as const, params: { feeType: 'payment_fixed', amount: 50, name: 'International Fixed Fee' } },
              { type: 'SET_RATE' as const, params: { feeType: 'currency_conversion', rate: 1.5, name: 'Currency Conversion Fee' } },
            ],
          },
        ];

        registry.findActiveRules.mockResolvedValue(internationalFeeRules as any);
        evaluator.evaluateRule.mockReturnValue({
          ruleId: 'international-stripe-fee',
          ruleName: 'International Stripe Fee',
          matched: true,
          conditionResults: [
            { field: 'workspaceConfig.isInternational', operator: 'eq', expected: true, actual: true, matched: true },
            { field: 'workspaceConfig.paymentMethod', operator: 'eq', expected: 'stripe', actual: 'stripe', matched: true },
          ],
          actions: internationalFeeRules[0].actions,
        });

        const fees = await policyEngine.calculateFees(internationalContext, 1000);
        
        expect(fees.baseFees).toHaveLength(3);
        
        const processingFee = fees.baseFees.find(f => f.feeType === 'payment_processing');
        const fixedFee = fees.baseFees.find(f => f.feeType === 'payment_fixed');
        const conversionFee = fees.baseFees.find(f => f.feeType === 'currency_conversion');
        
        expect(processingFee?.rate).toBe(3.9);
        expect(processingFee?.amount).toBe(39); // 3.9% of 1,000
        expect(fixedFee?.amount).toBe(50);
        expect(conversionFee?.rate).toBe(1.5);
        expect(conversionFee?.amount).toBe(15); // 1.5% of 1,000
        
        expect(fees.totalFees).toBe(104); // 39 + 50 + 15
      });
    });

    describe('Tax Calculations by Jurisdiction', () => {
      it('should calculate complex tax structures with multiple jurisdictions', async () => {
        const context: PolicyContext = {
          locale: 'en',
          country: 'NP',
          state: 'Bagmati',
          city: 'Kathmandu',
          timezone: 'Asia/Kathmandu',
          currency: 'NPR',
          userId: 'user-123',
          userRole: 'RENTER',
          userCountry: 'NP',
          listingId: 'listing-123',
          listingCategory: 'property',
          listingCountry: 'NP',
          listingState: 'Bagmati',
          listingCity: 'Kathmandu',
          bookingValue: 25000,
          bookingDuration: 30,
          bookingCurrency: 'NPR',
          startDate: '2026-04-05',
          endDate: '2026-05-05',
          guestCount: 2,
          hostPresent: false,
          requestTimestamp: new Date().toISOString(),
          evaluationDate: new Date().toISOString(),
          ipCountry: 'NP',
          platform: 'web',
          tenantId: null,
          workspaceConfig: {},
        };

        const complexTaxRules = [
          {
            id: 'national-vat',
            version: 1,
            policyType: 'TAX',
            conditions: [{ field: 'country', operator: 'eq', value: 'NP' }],
            actions: [{ type: 'SET_RATE' as const, params: { taxType: 'VAT', name: 'National VAT', rate: 13, jurisdiction: 'NP' } }],
          },
          {
            id: 'bagmati-provincial-tax',
            version: 1,
            policyType: 'TAX',
            conditions: [
              { field: 'country', operator: 'eq', value: 'NP' },
              { field: 'state', operator: 'eq', value: 'Bagmati' },
            ],
            actions: [{ type: 'SET_RATE' as const, params: { taxType: 'PROVINCIAL', name: 'Bagmati Provincial Tax', rate: 2, jurisdiction: 'Bagmati' } }],
          },
          {
            id: 'kathmandu-municipal-tax',
            version: 1,
            policyType: 'TAX',
            conditions: [
              { field: 'country', operator: 'eq', value: 'NP' },
              { field: 'state', operator: 'eq', value: 'Bagmati' },
              { field: 'city', operator: 'eq', value: 'Kathmandu' },
            ],
            actions: [{ type: 'SET_RATE' as const, params: { taxType: 'MUNICIPAL', name: 'Kathmandu Municipal Tax', rate: 1, jurisdiction: 'Kathmandu' } }],
          },
        ];

        registry.findActiveRules.mockResolvedValue(complexTaxRules as any);
        evaluator.evaluateRule.mockImplementation((rule) => ({
          ruleId: rule.id,
          ruleName: rule.actions[0].params.name as string,
          matched: true,
          conditionResults: rule.conditions.map(cond => ({
            field: cond.field,
            operator: cond.operator,
            expected: cond.value,
            actual: (context[cond.field as keyof PolicyContext] as string) || (context.workspaceConfig[(cond.field as string).replace('workspaceConfig.', '') as keyof typeof context.workspaceConfig] as string),
            matched: true,
          })),
          actions: rule.actions,
        }));

        const taxBreakdown = await policyEngine.calculateTax(context, 25000);
        
        expect(taxBreakdown.subtotal).toBe(25000);
        expect(taxBreakdown.taxLines).toHaveLength(3);
        
        const nationalVAT = taxBreakdown.taxLines.find(t => t.type === 'VAT');
        const provincialTax = taxBreakdown.taxLines.find(t => t.type === 'PROVINCIAL');
        const municipalTax = taxBreakdown.taxLines.find(t => t.type === 'MUNICIPAL');
        
        expect(nationalVAT?.rate).toBe(13);
        expect(nationalVAT?.amount).toBe(3250); // 13% of 25,000
        expect(nationalVAT?.jurisdiction).toBe('NP');
        
        expect(provincialTax?.rate).toBe(2);
        expect(provincialTax?.amount).toBe(500); // 2% of 25,000
        expect(provincialTax?.jurisdiction).toBe('Bagmati');
        
        expect(municipalTax?.rate).toBe(1);
        expect(municipalTax?.amount).toBe(250); // 1% of 25,000
        expect(municipalTax?.jurisdiction).toBe('Kathmandu');
        
        expect(taxBreakdown.totalTax).toBe(4000); // 3250 + 500 + 250
        expect(taxBreakdown.total).toBe(29000); // 25000 + 4000
        expect(taxBreakdown.currency).toBe('NPR');
        expect(taxBreakdown.snapshot).toBeDefined();
        expect(taxBreakdown.snapshot.rules).toHaveLength(3);
      });

      it('should handle compound tax calculations', async () => {
        const context: PolicyContext = {
          locale: 'en',
          country: 'NP',
          state: 'Bagmati',
          city: 'Kathmandu',
          timezone: 'Asia/Kathmandu',
          currency: 'NPR',
          userId: 'user-123',
          userRole: 'RENTER',
          userCountry: 'NP',
          listingId: 'listing-123',
          listingCategory: 'electronics',
          listingCountry: 'NP',
          listingState: 'Bagmati',
          listingCity: 'Kathmandu',
          bookingValue: 15000,
          bookingDuration: 7,
          bookingCurrency: 'NPR',
          startDate: '2026-04-05',
          endDate: '2026-04-12',
          guestCount: 1,
          hostPresent: false,
          requestTimestamp: new Date().toISOString(),
          evaluationDate: new Date().toISOString(),
          ipCountry: 'NP',
          platform: 'web',
          tenantId: null,
          workspaceConfig: {},
        };

        const compoundTaxRules = [
          {
            id: 'base-vat',
            version: 1,
            policyType: 'TAX',
            conditions: [{ field: 'country', operator: 'eq', value: 'NP' }],
            actions: [{ type: 'SET_RATE' as const, params: { taxType: 'VAT', name: 'Base VAT', rate: 10, jurisdiction: 'NP' } }],
          },
          {
            id: 'compound-service-tax',
            version: 1,
            policyType: 'TAX',
            conditions: [{ field: 'country', operator: 'eq', value: 'NP' }],
            actions: [{ type: 'COMPOUND' as const, params: { taxType: 'SERVICE_TAX', name: 'Compound Service Tax', rate: 5, jurisdiction: 'NP' } }],
          },
        ];

        registry.findActiveRules.mockResolvedValue(compoundTaxRules as any);
        evaluator.evaluateRule.mockImplementation((rule) => ({
          ruleId: rule.id,
          ruleName: rule.actions[0].params.name as string,
          matched: true,
          conditionResults: [{ field: 'country', operator: 'eq', expected: 'NP', actual: context.country as string, matched: true }],
          actions: rule.actions,
        }));

        const taxBreakdown = await policyEngine.calculateTax(context, 15000);
        
        expect(taxBreakdown.subtotal).toBe(15000);
        expect(taxBreakdown.taxLines).toHaveLength(2);
        
        const baseVAT = taxBreakdown.taxLines.find(t => t.type === 'VAT');
        const compoundTax = taxBreakdown.taxLines.find(t => t.type === 'SERVICE_TAX');
        
        expect(baseVAT?.rate).toBe(10);
        expect(baseVAT?.amount).toBe(1500); // 10% of 15,000
        
        expect(compoundTax?.rate).toBe(5);
        expect(compoundTax?.amount).toBe(825); // 5% of (15,000 + 1,500) = 5% of 16,500
        
        expect(taxBreakdown.totalTax).toBe(2325); // 1500 + 825
        expect(taxBreakdown.total).toBe(17325); // 15000 + 2325
      });
    });

    describe('Currency Conversion Fees', () => {
      it('should apply currency conversion fees for multi-currency transactions', async () => {
        const context: PolicyContext = {
          locale: 'en',
          country: 'NP',
          state: 'Bagmati',
          city: 'Kathmandu',
          timezone: 'Asia/Kathmandu',
          currency: 'USD', // Booking in USD but listing in NPR
          userId: 'user-123',
          userRole: 'RENTER',
          userCountry: 'US',
          listingId: 'listing-123',
          listingCategory: 'property',
          listingCountry: 'NP',
          listingState: 'Bagmati',
          listingCity: 'Kathmandu',
          bookingValue: 100, // USD
          bookingDuration: 7,
          bookingCurrency: 'USD',
          startDate: '2026-04-05',
          endDate: '2026-04-12',
          guestCount: 1,
          hostPresent: false,
          requestTimestamp: new Date().toISOString(),
          evaluationDate: new Date().toISOString(),
          ipCountry: 'US',
          platform: 'web',
          tenantId: null,
          workspaceConfig: { 
            originalCurrency: 'NPR',
            targetCurrency: 'USD',
            exchangeRate: 132.5 // 1 USD = 132.5 NPR
          },
        };

        const conversionFeeRules = [
          {
            id: 'currency-conversion-fee',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'currency', operator: 'neq', value: context.workspaceConfig.originalCurrency },
              { field: 'workspaceConfig.originalCurrency', operator: 'eq', value: 'NPR' },
            ],
            actions: [
              { type: 'SET_RATE' as const, params: { feeType: 'currency_conversion', rate: 2.5, name: 'Currency Conversion Fee' } },
              { type: 'SET_FIXED_AMOUNT' as const, params: { feeType: 'conversion_fixed', amount: 5, name: 'Conversion Fixed Fee' } },
            ],
          },
        ];

        registry.findActiveRules.mockResolvedValue(conversionFeeRules as any);
        evaluator.evaluateRule.mockReturnValue({
          ruleId: 'currency-conversion-fee',
          ruleName: 'Currency Conversion Fee',
          matched: true,
          conditionResults: [
            { field: 'currency', operator: 'neq', expected: 'NPR', actual: 'USD', matched: true },
            { field: 'workspaceConfig.originalCurrency', operator: 'eq', expected: 'NPR', actual: 'NPR', matched: true },
          ],
          actions: conversionFeeRules[0].actions,
        });

        const fees = await policyEngine.calculateFees(context, 100);
        
        expect(fees.baseFees).toHaveLength(2);
        
        const conversionFee = fees.baseFees.find(f => f.feeType === 'currency_conversion');
        const fixedFee = fees.baseFees.find(f => f.feeType === 'conversion_fixed');
        
        expect(conversionFee?.rate).toBe(2.5);
        expect(conversionFee?.amount).toBe(2.5); // 2.5% of 100 USD
        expect(fixedFee?.amount).toBe(5); // $5 fixed fee
        
        expect(fees.totalFees).toBe(7.5); // 2.5 + 5
        expect(fees.currency).toBe('USD');
      });

      it('should handle different conversion rates by currency pair', async () => {
        const euroContext: PolicyContext = {
          locale: 'en',
          country: 'NP',
          state: 'Bagmati',
          city: 'Kathmandu',
          timezone: 'Asia/Kathmandu',
          currency: 'EUR',
          userId: 'user-123',
          userRole: 'RENTER',
          userCountry: 'DE',
          listingId: 'listing-123',
          listingCategory: 'property',
          listingCountry: 'NP',
          listingState: 'Bagmati',
          listingCity: 'Kathmandu',
          bookingValue: 200, // EUR
          bookingDuration: 14,
          bookingCurrency: 'EUR',
          startDate: '2026-04-05',
          endDate: '2026-04-19',
          guestCount: 2,
          hostPresent: false,
          requestTimestamp: new Date().toISOString(),
          evaluationDate: new Date().toISOString(),
          ipCountry: 'DE',
          platform: 'web',
          tenantId: null,
          workspaceConfig: { 
            originalCurrency: 'NPR',
            targetCurrency: 'EUR',
            exchangeRate: 145.2, // 1 EUR = 145.2 NPR
            currencyPair: 'EUR-NPR'
          },
        };

        const euroConversionRules = [
          {
            id: 'eur-conversion-fee',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'workspaceConfig.currencyPair', operator: 'eq', value: 'EUR-NPR' },
            ],
            actions: [
              { type: 'SET_RATE' as const, params: { feeType: 'currency_conversion', rate: 3.0, name: 'EUR Conversion Fee' } },
              { type: 'SET_FIXED_AMOUNT' as const, params: { feeType: 'conversion_fixed', amount: 8, name: 'EUR Fixed Fee' } },
            ],
          },
        ];

        registry.findActiveRules.mockResolvedValue(euroConversionRules as any);
        evaluator.evaluateRule.mockReturnValue({
          ruleId: 'eur-conversion-fee',
          ruleName: 'EUR Conversion Fee',
          matched: true,
          conditionResults: [
            { field: 'workspaceConfig.currencyPair', operator: 'eq', expected: 'EUR-NPR', actual: 'EUR-NPR', matched: true },
          ],
          actions: euroConversionRules[0].actions,
        });

        const fees = await policyEngine.calculateFees(euroContext, 200);
        
        const conversionFee = fees.baseFees.find(f => f.feeType === 'currency_conversion');
        const fixedFee = fees.baseFees.find(f => f.feeType === 'conversion_fixed');
        
        expect(conversionFee?.rate).toBe(3.0);
        expect(conversionFee?.amount).toBe(6); // 3% of 200 EUR
        expect(fixedFee?.amount).toBe(8); // €8 fixed fee
        
        expect(fees.totalFees).toBe(14); // 6 + 8
        expect(fees.currency).toBe('EUR');
      });
    });

    describe('Seasonal Fee Adjustments', () => {
      it('should apply seasonal fee adjustments during peak periods', async () => {
        const peakSeasonContext: PolicyContext = {
          locale: 'en',
          country: 'NP',
          state: 'Bagmati',
          city: 'Kathmandu',
          timezone: 'Asia/Kathmandu',
          currency: 'NPR',
          userId: 'user-123',
          userRole: 'RENTER',
          userCountry: 'NP',
          listingId: 'listing-123',
          listingCategory: 'property',
          listingCountry: 'NP',
          listingState: 'Bagmati',
          listingCity: 'Kathmandu',
          bookingValue: 30000,
          bookingDuration: 7,
          bookingCurrency: 'NPR',
          startDate: '2026-10-15', // Dashain festival period (peak season)
          endDate: '2026-10-22',
          guestCount: 3,
          hostPresent: false,
          requestTimestamp: new Date().toISOString(),
          evaluationDate: new Date().toISOString(),
          ipCountry: 'NP',
          platform: 'web',
          tenantId: null,
          workspaceConfig: { season: 'peak' },
        };

        const seasonalFeeRules = [
          {
            id: 'base-platform-fee',
            version: 1,
            policyType: 'FEE',
            conditions: [{ field: 'country', operator: 'eq', value: 'NP' }],
            actions: [{ type: 'SET_RATE' as const, params: { feeType: 'platform', rate: 10, name: 'Base Platform Fee' } }],
          },
          {
            id: 'peak-season-surcharge',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'country', operator: 'eq', value: 'NP' },
              { field: 'workspaceConfig.season', operator: 'eq', value: 'peak' },
              { field: 'startDate', operator: 'dateRange', value: { start: '2026-10-01', end: '2026-10-31' } },
            ],
            actions: [{ type: 'SET_RATE' as const, params: { feeType: 'seasonal_surcharge', rate: 5, name: 'Peak Season Surcharge' } }],
          },
        ];

        registry.findActiveRules.mockResolvedValue(seasonalFeeRules as any);
        evaluator.evaluateRule.mockImplementation((rule) => ({
          ruleId: rule.id,
          ruleName: rule.actions[0].params.name,
          matched: true,
          conditionResults: rule.conditions.map(cond => {
            if (cond.field === 'startDate' && cond.operator === 'dateRange') {
              return {
                field: cond.field,
                operator: cond.operator,
                expected: cond.value,
                actual: peakSeasonContext.startDate,
                matched: true, // Assume date is in range for this test
              };
            }
            return {
              field: cond.field,
              operator: cond.operator,
              expected: cond.value,
              actual: cond.field === 'workspaceConfig.season' ? peakSeasonContext.workspaceConfig.season as string : peakSeasonContext[cond.field as keyof PolicyContext] as string,
              matched: true,
            };
          }),
          actions: rule.actions,
        }));

        const fees = await policyEngine.calculateFees(peakSeasonContext, 30000);
        
        expect(fees.baseFees).toHaveLength(2);
        
        const platformFee = fees.baseFees.find(f => f.feeType === 'platform');
        const seasonalFee = fees.baseFees.find(f => f.feeType === 'seasonal_surcharge');
        
        expect(platformFee?.rate).toBe(10);
        expect(platformFee?.amount).toBe(3000); // 10% of 30,000
        
        expect(seasonalFee?.rate).toBe(5);
        expect(seasonalFee?.amount).toBe(1500); // 5% of 30,000
        
        expect(fees.totalFees).toBe(4500); // 3000 + 1500
      });

      it('should apply discounts during off-peak periods', async () => {
        const offPeakContext: PolicyContext = {
          locale: 'en',
          country: 'NP',
          state: 'Bagmati',
          city: 'Kathmandu',
          timezone: 'Asia/Kathmandu',
          currency: 'NPR',
          userId: 'user-123',
          userRole: 'RENTER',
          userCountry: 'NP',
          listingId: 'listing-123',
          listingCategory: 'property',
          listingCountry: 'NP',
          listingState: 'Bagmati',
          listingCity: 'Kathmandu',
          bookingValue: 20000,
          bookingDuration: 7,
          bookingCurrency: 'NPR',
          startDate: '2026-06-15', // Monsoon season (off-peak)
          endDate: '2026-06-22',
          guestCount: 2,
          hostPresent: false,
          requestTimestamp: new Date().toISOString(),
          evaluationDate: new Date().toISOString(),
          ipCountry: 'NP',
          platform: 'web',
          tenantId: null,
          workspaceConfig: { season: 'off_peak' },
        };

        const offPeakFeeRules = [
          {
            id: 'base-platform-fee',
            version: 1,
            policyType: 'FEE',
            conditions: [{ field: 'country', operator: 'eq', value: 'NP' }],
            actions: [{ type: 'SET_RATE' as const, params: { feeType: 'platform', rate: 10, name: 'Base Platform Fee' } }],
          },
          {
            id: 'off-peak-discount',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'country', operator: 'eq', value: 'NP' },
              { field: 'workspaceConfig.season', operator: 'eq', value: 'off_peak' },
              { field: 'startDate', operator: 'dateRange', value: { start: '2026-06-01', end: '2026-08-31' } },
            ],
            actions: [{ type: 'SET_RATE' as const, params: { feeType: 'seasonal_discount', rate: -2, name: 'Off-Peak Discount' } }],
          },
        ];

        registry.findActiveRules.mockResolvedValue(offPeakFeeRules as any);
        evaluator.evaluateRule.mockImplementation((rule) => ({
          ruleId: rule.id,
          ruleName: rule.actions[0].params.name,
          matched: true,
          conditionResults: rule.conditions.map(cond => {
            if (cond.field === 'startDate' && cond.operator === 'dateRange') {
              return {
                field: cond.field,
                operator: cond.operator,
                expected: cond.value,
                actual: offPeakContext.startDate,
                matched: true, // Assume date is in range for this test
              };
            }
            return {
              field: cond.field,
              operator: cond.operator,
              expected: cond.value,
              actual: cond.field === 'workspaceConfig.season' ? offPeakContext.workspaceConfig.season as string : offPeakContext[cond.field as keyof PolicyContext] as string,
              matched: true,
            };
          }),
          actions: rule.actions,
        }));

        const fees = await policyEngine.calculateFees(offPeakContext, 20000);
        
        expect(fees.baseFees).toHaveLength(2);
        
        const platformFee = fees.baseFees.find(f => f.feeType === 'platform');
        const seasonalDiscount = fees.baseFees.find(f => f.feeType === 'seasonal_discount');
        
        expect(platformFee?.rate).toBe(10);
        expect(platformFee?.amount).toBe(2000); // 10% of 20,000
        
        expect(seasonalDiscount?.rate).toBe(-2);
        expect(seasonalDiscount?.amount).toBe(-400); // -2% of 20,000
        
        expect(fees.totalFees).toBe(1600); // 2000 - 400
      });
    });

    describe('Complex Fee Structures', () => {
      it('should handle tiered fee structures based on booking value', async () => {
        const highValueContext: PolicyContext = {
          locale: 'en',
          country: 'NP',
          state: 'Bagmati',
          city: 'Kathmandu',
          timezone: 'Asia/Kathmandu',
          currency: 'NPR',
          userId: 'user-123',
          userRole: 'RENTER',
          userCountry: 'NP',
          listingId: 'listing-123',
          listingCategory: 'property',
          listingCountry: 'NP',
          listingState: 'Bagmati',
          listingCity: 'Kathmandu',
          bookingValue: 150000, // High value booking
          bookingDuration: 30,
          bookingCurrency: 'NPR',
          startDate: '2026-04-05',
          endDate: '2026-05-05',
          guestCount: 4,
          hostPresent: false,
          requestTimestamp: new Date().toISOString(),
          evaluationDate: new Date().toISOString(),
          ipCountry: 'NP',
          platform: 'web',
          tenantId: null,
          workspaceConfig: {},
        };

        const tieredFeeRules = [
          {
            id: 'base-fee',
            version: 1,
            policyType: 'FEE',
            conditions: [{ field: 'country', operator: 'eq', value: 'NP' }],
            actions: [{ type: 'SET_RATE' as const, params: { feeType: 'platform', rate: 8, name: 'Base Platform Fee' } }],
          },
          {
            id: 'high-value-surcharge',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'country', operator: 'eq', value: 'NP' },
              { field: 'bookingValue', operator: 'gte', value: 100000 },
            ],
            actions: [{ type: 'SET_RATE' as const, params: { feeType: 'high_value_surcharge', rate: 2, name: 'High Value Surcharge' } }],
          },
          {
            id: 'premium-surcharge',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'country', operator: 'eq', value: 'NP' },
              { field: 'bookingValue', operator: 'gte', value: 150000 },
            ],
            actions: [{ type: 'SET_RATE' as const, params: { feeType: 'premium_surcharge', rate: 1, name: 'Premium Surcharge' } }],
          },
        ];

        registry.findActiveRules.mockResolvedValue(tieredFeeRules as any);
        evaluator.evaluateRule.mockImplementation((rule) => ({
          ruleId: rule.id,
          ruleName: rule.actions[0].params.name as string,
          matched: true,
          conditionResults: rule.conditions.map(cond => ({
            field: cond.field,
            operator: cond.operator,
            expected: cond.value,
            actual: cond.field === 'bookingValue' ? highValueContext.bookingValue as number : highValueContext[cond.field as keyof PolicyContext] as string,
            matched: true,
          })),
          actions: rule.actions,
        }));

        const fees = await policyEngine.calculateFees(highValueContext, 150000);
        
        expect(fees.baseFees).toHaveLength(3);
        
        const baseFee = fees.baseFees.find(f => f.feeType === 'platform');
        const highValueFee = fees.baseFees.find(f => f.feeType === 'high_value_surcharge');
        const premiumFee = fees.baseFees.find(f => f.feeType === 'premium_surcharge');
        
        expect(baseFee?.rate).toBe(8);
        expect(baseFee?.amount).toBe(12000); // 8% of 150,000
        
        expect(highValueFee?.rate).toBe(2);
        expect(highValueFee?.amount).toBe(3000); // 2% of 150,000
        
        expect(premiumFee?.rate).toBe(1);
        expect(premiumFee?.amount).toBe(1500); // 1% of 150,000
        
        expect(fees.totalFees).toBe(16500); // 12000 + 3000 + 1500 = 11% total
      });

      it('should apply capped fee structures', async () => {
        const cappedFeeContext: PolicyContext = {
          locale: 'en',
          country: 'NP',
          state: 'Bagmati',
          city: 'Kathmandu',
          timezone: 'Asia/Kathmandu',
          currency: 'NPR',
          userId: 'user-123',
          userRole: 'RENTER',
          userCountry: 'NP',
          listingId: 'listing-123',
          listingCategory: 'property',
          listingCountry: 'NP',
          listingState: 'Bagmati',
          listingCity: 'Kathmandu',
          bookingValue: 500000, // Very high value booking
          bookingDuration: 90,
          bookingCurrency: 'NPR',
          startDate: '2026-04-05',
          endDate: '2026-07-04',
          guestCount: 6,
          hostPresent: false,
          requestTimestamp: new Date().toISOString(),
          evaluationDate: new Date().toISOString(),
          ipCountry: 'NP',
          platform: 'web',
          tenantId: null,
          workspaceConfig: {},
        };

        // Note: This test demonstrates how capped fees would work
        // In a real implementation, the PolicyEngine would need to support
        // cap calculations or the service layer would apply caps after
        const cappedFeeRules = [
          {
            id: 'standard-platform-fee',
            version: 1,
            policyType: 'FEE',
            conditions: [{ field: 'country', operator: 'eq', value: 'NP' }],
            actions: [{ type: 'SET_RATE' as const, params: { feeType: 'platform', rate: 10, name: 'Standard Platform Fee' } }],
          },
          {
            id: 'fee-cap-adjustment',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'country', operator: 'eq', value: 'NP' },
              { field: 'bookingValue', operator: 'gt', value: 100000 },
            ],
            actions: [{ type: 'SET_FIXED_AMOUNT' as const, params: { feeType: 'cap_adjustment', amount: -15000, name: 'Fee Cap Adjustment' } }],
          },
        ];

        registry.findActiveRules.mockResolvedValue(cappedFeeRules as any);
        evaluator.evaluateRule.mockImplementation((rule) => ({
          ruleId: rule.id,
          ruleName: rule.actions[0].params.name as string,
          matched: true,
          conditionResults: rule.conditions.map(cond => ({
            field: cond.field,
            operator: cond.operator,
            expected: cond.value,
            actual: cond.field === 'bookingValue' ? cappedFeeContext.bookingValue as number : cappedFeeContext[cond.field as keyof PolicyContext] as string,
            matched: true,
          })),
          actions: rule.actions,
        }));

        const fees = await policyEngine.calculateFees(cappedFeeContext, 500000);
        
        expect(fees.baseFees).toHaveLength(2);
        
        const platformFee = fees.baseFees.find(f => f.feeType === 'platform');
        const capAdjustment = fees.baseFees.find(f => f.feeType === 'cap_adjustment');
        
        expect(platformFee?.rate).toBe(10);
        expect(platformFee?.amount).toBe(50000); // 10% of 500,000
        
        expect(capAdjustment?.amount).toBe(-15000); // Cap adjustment
        
        expect(fees.totalFees).toBe(35000); // 50000 - 15000 = 7% effective rate
      });
    });
  });

  // ──────────────────────────────────────────────────────
  // COMPREHENSIVE BUSINESS RULE TESTS (Task 1.3.3)
  // ──────────────────────────────────────────────────────

  describe('Business Rule Validation', () => {
    describe('Booking Eligibility Rules', () => {
      it('should validate minimum age requirements for vehicle rentals', async () => {
        const vehicleContext: PolicyContext = {
          locale: 'en',
          country: 'NP',
          state: 'Bagmati',
          city: 'Kathmandu',
          timezone: 'Asia/Kathmandu',
          currency: 'NPR',
          userId: 'user-123',
          userRole: 'RENTER',
          userCountry: 'NP',
          listingId: 'listing-123',
          listingCategory: 'vehicle',
          listingCountry: 'NP',
          listingState: 'Bagmati',
          listingCity: 'Kathmandu',
          bookingValue: 5000,
          bookingDuration: 24,
          bookingCurrency: 'NPR',
          startDate: '2026-04-05',
          endDate: '2026-04-06',
          guestCount: 1,
          hostPresent: false,
          requestTimestamp: new Date().toISOString(),
          evaluationDate: new Date().toISOString(),
          ipCountry: 'NP',
          platform: 'web',
          tenantId: null,
          workspaceConfig: { userAge: 19 }, // Under minimum age
        };

        const ageRestrictionRules = [
          {
            id: 'vehicle-min-age',
            version: 1,
            policyType: 'BOOKING_CONSTRAINT',
            conditions: [
              { field: 'listingCategory', operator: 'eq', value: 'vehicle' },
              { field: 'workspaceConfig.userAge', operator: 'lt', value: 21 },
            ],
            actions: [
              { type: 'BLOCK' as const, params: { reason: 'Driver must be at least 21 years old for vehicle rentals', referenceUrl: 'https://gharbatai.com/policies/vehicle-age' } },
              { type: 'SET_MIN_MAX' as const, params: { minAge: 21 } },
            ],
          },
        ];

        registry.findActiveRules.mockResolvedValue(ageRestrictionRules as any);
        evaluator.evaluateRule.mockReturnValue({
          ruleId: 'vehicle-min-age',
          ruleName: 'Vehicle Minimum Age',
          matched: true,
          conditionResults: [
            { field: 'listingCategory', operator: 'eq', expected: 'vehicle', actual: 'vehicle', matched: true },
            { field: 'workspaceConfig.userAge', operator: 'lt', expected: 21, actual: 19, matched: true },
          ],
          actions: ageRestrictionRules[0].actions,
        });

        const constraints = await policyEngine.evaluateBookingConstraints(vehicleContext);
        
        expect(constraints.isAllowed).toBe(false);
        expect(constraints.blockedReasons).toHaveLength(1);
        expect(constraints.blockedReasons[0].reason).toBe('Driver must be at least 21 years old for vehicle rentals');
        expect(constraints.blockedReasons[0].ruleId).toBe('vehicle-min-age');
        expect(constraints.minAge).toBe(21);
        expect(constraints.appliedRules).toContain('vehicle-min-age');
      });

      it('should allow bookings when age requirements are met', async () => {
        const eligibleContext: PolicyContext = {
          locale: 'en',
          country: 'NP',
          state: 'Bagmati',
          city: 'Kathmandu',
          timezone: 'Asia/Kathmandu',
          currency: 'NPR',
          userId: 'user-123',
          userRole: 'RENTER',
          userCountry: 'NP',
          listingId: 'listing-123',
          listingCategory: 'vehicle',
          listingCountry: 'NP',
          listingState: 'Bagmati',
          listingCity: 'Kathmandu',
          bookingValue: 5000,
          bookingDuration: 24,
          bookingCurrency: 'NPR',
          startDate: '2026-04-05',
          endDate: '2026-04-06',
          guestCount: 1,
          hostPresent: false,
          requestTimestamp: new Date().toISOString(),
          evaluationDate: new Date().toISOString(),
          ipCountry: 'NP',
          platform: 'web',
          tenantId: null,
          workspaceConfig: { userAge: 25 }, // Meets minimum age
        };

        // No matching rules means booking is allowed
        registry.findActiveRules.mockResolvedValue([]);

        const constraints = await policyEngine.evaluateBookingConstraints(eligibleContext);
        
        expect(constraints.isAllowed).toBe(true);
        expect(constraints.blockedReasons).toHaveLength(0);
        expect(constraints.minAge).toBeNull();
      });

      it('should validate document requirements for international rentals', async () => {
        const internationalContext: PolicyContext = {
          locale: 'en',
          country: 'NP',
          state: 'Bagmati',
          city: 'Kathmandu',
          timezone: 'Asia/Kathmandu',
          currency: 'NPR',
          userId: 'user-123',
          userRole: 'RENTER',
          userCountry: 'US', // International user
          listingId: 'listing-123',
          listingCategory: 'property',
          listingCountry: 'NP',
          listingState: 'Bagmati',
          listingCity: 'Kathmandu',
          bookingValue: 15000,
          bookingDuration: 30,
          bookingCurrency: 'NPR',
          startDate: '2026-04-05',
          endDate: '2026-05-05',
          guestCount: 2,
          hostPresent: false,
          requestTimestamp: new Date().toISOString(),
          evaluationDate: new Date().toISOString(),
          ipCountry: 'US',
          platform: 'web',
          tenantId: null,
          workspaceConfig: { hasVisa: false, hasPassport: true },
        };

        const documentRules = [
          {
            id: 'international-doc-requirements',
            version: 1,
            policyType: 'BOOKING_CONSTRAINT',
            conditions: [
              { field: 'userCountry', operator: 'neq', value: 'NP' },
              { field: 'listingCountry', operator: 'eq', value: 'NP' },
              { field: 'workspaceConfig.hasVisa', operator: 'eq', value: false },
            ],
            actions: [
              { type: 'REQUIRE_DOCUMENT' as const, params: { documentType: 'VISA', label: 'Valid Nepal Visa', threshold: 30 } },
              { type: 'REQUIRE_DOCUMENT' as const, params: { documentType: 'PASSPORT', label: 'Valid Passport' } },
              { type: 'SET_MULTIPLIER' as const, params: { multiplier: 1.2, name: 'International Document Surcharge' } },
            ],
          },
        ];

        registry.findActiveRules.mockResolvedValue(documentRules as any);
        evaluator.evaluateRule.mockReturnValue({
          ruleId: 'international-doc-requirements',
          ruleName: 'International Document Requirements',
          matched: true,
          conditionResults: [
            { field: 'userCountry', operator: 'neq', expected: 'NP', actual: 'US', matched: true },
            { field: 'listingCountry', operator: 'eq', expected: 'NP', actual: 'NP', matched: true },
            { field: 'workspaceConfig.hasVisa', operator: 'eq', expected: false, actual: false, matched: true },
          ],
          actions: documentRules[0].actions,
        });

        const constraints = await policyEngine.evaluateBookingConstraints(internationalContext);
        
        expect(constraints.isAllowed).toBe(true); // Not blocked, but documents required
        expect(constraints.requiredDocuments).toHaveLength(2);
        
        const visaRequirement = constraints.requiredDocuments.find(d => d.documentType === 'VISA');
        const passportRequirement = constraints.requiredDocuments.find(d => d.documentType === 'PASSPORT');
        
        expect(visaRequirement?.label).toBe('Valid Nepal Visa');
        expect(visaRequirement?.threshold).toBe(30);
        
        expect(passportRequirement?.label).toBe('Valid Passport');
        expect(passportRequirement?.threshold).toBeUndefined();
        
        expect(constraints.priceMultiplier).toBe(1.2); // 20% surcharge
      });

      it('should enforce minimum stay requirements for luxury properties', async () => {
        const luxuryPropertyContext: PolicyContext = {
          locale: 'en',
          country: 'NP',
          state: 'Bagmati',
          city: 'Kathmandu',
          timezone: 'Asia/Kathmandu',
          currency: 'NPR',
          userId: 'user-123',
          userRole: 'RENTER',
          userCountry: 'NP',
          listingId: 'listing-123',
          listingCategory: 'property',
          listingCountry: 'NP',
          listingState: 'Bagmati',
          listingCity: 'Kathmandu',
          bookingValue: 80000,
          bookingDuration: 2, // Only 2 days - too short for luxury property
          bookingCurrency: 'NPR',
          startDate: '2026-04-05',
          endDate: '2026-04-07',
          guestCount: 2,
          hostPresent: false,
          requestTimestamp: new Date().toISOString(),
          evaluationDate: new Date().toISOString(),
          ipCountry: 'NP',
          platform: 'web',
          tenantId: null,
          workspaceConfig: { propertyType: 'luxury', minStayRequired: true },
        };

        const minStayRules = [
          {
            id: 'luxury-min-stay',
            version: 1,
            policyType: 'BOOKING_CONSTRAINT',
            conditions: [
              { field: 'listingCategory', operator: 'eq', value: 'property' },
              { field: 'workspaceConfig.propertyType', operator: 'eq', value: 'luxury' },
              { field: 'bookingDuration', operator: 'lt', value: 3 },
            ],
            actions: [
              { type: 'BLOCK' as const, params: { reason: 'Luxury properties require minimum 3 nights stay', referenceUrl: 'https://gharbatai.com/policies/luxury-min-stay' } },
              { type: 'SET_MIN_MAX' as const, params: { minStay: 3 } },
            ],
          },
        ];

        registry.findActiveRules.mockResolvedValue(minStayRules as any);
        evaluator.evaluateRule.mockReturnValue({
          ruleId: 'luxury-min-stay',
          ruleName: 'Luxury Minimum Stay',
          matched: true,
          conditionResults: [
            { field: 'listingCategory', operator: 'eq', expected: 'property', actual: 'property', matched: true },
            { field: 'workspaceConfig.propertyType', operator: 'eq', expected: 'luxury', actual: 'luxury', matched: true },
            { field: 'bookingDuration', operator: 'lt', expected: 3, actual: 2, matched: true },
          ],
          actions: minStayRules[0].actions,
        });

        const constraints = await policyEngine.evaluateBookingConstraints(luxuryPropertyContext);
        
        expect(constraints.isAllowed).toBe(false);
        expect(constraints.blockedReasons).toHaveLength(1);
        expect(constraints.blockedReasons[0].reason).toBe('Luxury properties require minimum 3 nights stay');
        expect(constraints.minStay).toBe(3);
      });
    });

    describe('Cancellation Policy Evaluation', () => {
      it('should generate standard cancellation tiers for property rentals', async () => {
        const propertyContext: PolicyContext = {
          locale: 'en',
          country: 'NP',
          state: 'Bagmati',
          city: 'Kathmandu',
          timezone: 'Asia/Kathmandu',
          currency: 'NPR',
          userId: 'user-123',
          userRole: 'RENTER',
          userCountry: 'NP',
          listingId: 'listing-123',
          listingCategory: 'property',
          listingCountry: 'NP',
          listingState: 'Bagmati',
          listingCity: 'Kathmandu',
          bookingValue: 25000,
          bookingDuration: 7,
          bookingCurrency: 'NPR',
          startDate: '2026-04-05',
          endDate: '2026-04-12',
          guestCount: 2,
          hostPresent: false,
          requestTimestamp: new Date().toISOString(),
          evaluationDate: new Date().toISOString(),
          ipCountry: 'NP',
          platform: 'web',
          tenantId: null,
          workspaceConfig: {},
        };

        const cancellationRules = [
          {
            id: 'property-cancellation-policy',
            version: 1,
            policyType: 'CANCELLATION',
            conditions: [
              { field: 'listingCategory', operator: 'eq', value: 'property' },
              { field: 'country', operator: 'eq', value: 'NP' },
            ],
            actions: [
              { type: 'SET_OBJECT' as const, params: {
                tiers: [
                  { minHoursBefore: 720, maxHoursBefore: null, refundPercentage: 100, label: 'Full Refund (30+ days)' }, // 30 days = 720 hours
                  { minHoursBefore: 168, maxHoursBefore: 720, refundPercentage: 50, label: 'Partial Refund (7-30 days)' }, // 7 days = 168 hours
                  { minHoursBefore: 24, maxHoursBefore: 168, refundPercentage: 25, label: 'Partial Refund (1-7 days)' }, // 1 day = 24 hours
                  { minHoursBefore: 0, maxHoursBefore: 24, refundPercentage: 0, label: 'No Refund (less than 24 hours)' },
                ],
              }},
              { type: 'SET_BOOLEAN' as const, params: { refundServiceFee: false, refundPlatformFee: false } },
              { type: 'SET_FIXED_AMOUNT' as const, params: { penalty: 500 } },
            ],
          },
        ];

        registry.findActiveRules.mockResolvedValue(cancellationRules as any);
        evaluator.evaluateRule.mockReturnValue({
          ruleId: 'property-cancellation-policy',
          ruleName: 'Property Cancellation Policy',
          matched: true,
          conditionResults: [
            { field: 'listingCategory', operator: 'eq', expected: 'property', actual: 'property', matched: true },
            { field: 'country', operator: 'eq', expected: 'NP', actual: 'NP', matched: true },
          ],
          actions: cancellationRules[0].actions,
        });

        const cancellationDecision = await policyEngine.evaluateCancellation(propertyContext);
        
        expect(cancellationDecision.tiers).toHaveLength(4);
        
        // Check tier ordering (most generous first)
        expect(cancellationDecision.tiers[0].minHoursBefore).toBe(720);
        expect(cancellationDecision.tiers[0].refundPercentage).toBe(100);
        expect(cancellationDecision.tiers[0].label).toBe('Full Refund (30+ days)');
        
        expect(cancellationDecision.tiers[1].minHoursBefore).toBe(168);
        expect(cancellationDecision.tiers[1].maxHoursBefore).toBe(720);
        expect(cancellationDecision.tiers[1].refundPercentage).toBe(50);
        
        expect(cancellationDecision.tiers[2].minHoursBefore).toBe(24);
        expect(cancellationDecision.tiers[2].maxHoursBefore).toBe(168);
        expect(cancellationDecision.tiers[2].refundPercentage).toBe(25);
        
        expect(cancellationDecision.tiers[3].minHoursBefore).toBe(0);
        expect(cancellationDecision.tiers[3].maxHoursBefore).toBe(24);
        expect(cancellationDecision.tiers[3].refundPercentage).toBe(0);
        
        expect(cancellationDecision.refundServiceFee).toBe(false);
        expect(cancellationDecision.refundPlatformFee).toBe(false);
        expect(cancellationDecision.flatPenalty).toBe(500);
        expect(cancellationDecision.appliedRules).toContain('property-cancellation-policy');
      });

      it('should apply strict cancellation policies for vehicle rentals', async () => {
        const vehicleContext: PolicyContext = {
          locale: 'en',
          country: 'NP',
          state: 'Bagmati',
          city: 'Kathmandu',
          timezone: 'Asia/Kathmandu',
          currency: 'NPR',
          userId: 'user-123',
          userRole: 'RENTER',
          userCountry: 'NP',
          listingId: 'listing-123',
          listingCategory: 'vehicle',
          listingCountry: 'NP',
          listingState: 'Bagmati',
          listingCity: 'Kathmandu',
          bookingValue: 8000,
          bookingDuration: 48,
          bookingCurrency: 'NPR',
          startDate: '2026-04-05',
          endDate: '2026-04-07',
          guestCount: 1,
          hostPresent: false,
          requestTimestamp: new Date().toISOString(),
          evaluationDate: new Date().toISOString(),
          ipCountry: 'NP',
          platform: 'web',
          tenantId: null,
          workspaceConfig: {},
        };

        const vehicleCancellationRules = [
          {
            id: 'vehicle-cancellation-policy',
            version: 1,
            policyType: 'CANCELLATION',
            conditions: [
              { field: 'listingCategory', operator: 'eq', value: 'vehicle' },
            ],
            actions: [
              { type: 'SET_OBJECT' as const, params: {
                tiers: [
                  { minHoursBefore: 168, maxHoursBefore: null, refundPercentage: 75, label: '75% Refund (7+ days)' },
                  { minHoursBefore: 48, maxHoursBefore: 168, refundPercentage: 50, label: '50% Refund (2-7 days)' },
                  { minHoursBefore: 0, maxHoursBefore: 48, refundPercentage: 0, label: 'No Refund (less than 48 hours)' },
                ],
              }},
              { type: 'SET_BOOLEAN' as const, params: { refundServiceFee: false, refundPlatformFee: false, alwaysRefundDeposit: false } },
              { type: 'SET_FIXED_AMOUNT' as const, params: { penalty: 1000 } },
            ],
          },
        ];

        registry.findActiveRules.mockResolvedValue(vehicleCancellationRules as any);
        evaluator.evaluateRule.mockReturnValue({
          ruleId: 'vehicle-cancellation-policy',
          ruleName: 'Vehicle Cancellation Policy',
          matched: true,
          conditionResults: [
            { field: 'listingCategory', operator: 'eq', expected: 'vehicle', actual: 'vehicle', matched: true },
          ],
          actions: vehicleCancellationRules[0].actions,
        });

        const cancellationDecision = await policyEngine.evaluateCancellation(vehicleContext);
        
        expect(cancellationDecision.tiers).toHaveLength(3);
        expect(cancellationDecision.tiers[0].refundPercentage).toBe(75); // Less generous than properties
        expect(cancellationDecision.tiers[2].refundPercentage).toBe(0); // No refund for last 48 hours
        
        expect(cancellationDecision.refundServiceFee).toBe(false);
        expect(cancellationDecision.refundPlatformFee).toBe(false);
        expect(cancellationDecision.alwaysRefundDeposit).toBe(false); // Deposit may be forfeited
        expect(cancellationDecision.flatPenalty).toBe(1000);
      });

      it('should handle flexible cancellation for long-term bookings', async () => {
        const longTermContext: PolicyContext = {
          locale: 'en',
          country: 'NP',
          state: 'Bagmati',
          city: 'Kathmandu',
          timezone: 'Asia/Kathmandu',
          currency: 'NPR',
          userId: 'user-123',
          userRole: 'RENTER',
          userCountry: 'NP',
          listingId: 'listing-123',
          listingCategory: 'property',
          listingCountry: 'NP',
          listingState: 'Bagmati',
          listingCity: 'Kathmandu',
          bookingValue: 150000,
          bookingDuration: 90, // 3 months
          bookingCurrency: 'NPR',
          startDate: '2026-04-05',
          endDate: '2026-07-04',
          guestCount: 2,
          hostPresent: false,
          requestTimestamp: new Date().toISOString(),
          evaluationDate: new Date().toISOString(),
          ipCountry: 'NP',
          platform: 'web',
          tenantId: null,
          workspaceConfig: { isLongTerm: true },
        };

        const longTermCancellationRules = [
          {
            id: 'long-term-cancellation-policy',
            version: 1,
            policyType: 'CANCELLATION',
            conditions: [
              { field: 'bookingDuration', operator: 'gte', value: 30 }, // 30+ days
              { field: 'listingCategory', operator: 'eq', value: 'property' },
            ],
            actions: [
              { type: 'SET_OBJECT' as const, params: {
                tiers: [
                  { minHoursBefore: 720, maxHoursBefore: null, refundPercentage: 100, label: 'Full Refund (30+ days)' },
                  { minHoursBefore: 168, maxHoursBefore: 720, refundPercentage: 75, label: '75% Refund (7-30 days)' },
                  { minHoursBefore: 72, maxHoursBefore: 168, refundPercentage: 50, label: '50% Refund (3-7 days)' },
                  { minHoursBefore: 24, maxHoursBefore: 72, refundPercentage: 25, label: '25% Refund (1-3 days)' },
                  { minHoursBefore: 0, maxHoursBefore: 24, refundPercentage: 0, label: 'No Refund (less than 24 hours)' },
                ],
              }},
              { type: 'SET_BOOLEAN' as const, params: { refundServiceFee: true, refundPlatformFee: true } },
              { type: 'SET_FIXED_AMOUNT' as const, params: { penalty: 2000 } },
            ],
          },
        ];

        registry.findActiveRules.mockResolvedValue(longTermCancellationRules as any);
        evaluator.evaluateRule.mockReturnValue({
          ruleId: 'long-term-cancellation-policy',
          ruleName: 'Long Term Cancellation Policy',
          matched: true,
          conditionResults: [
            { field: 'bookingDuration', operator: 'gte', expected: 30, actual: 90, matched: true },
            { field: 'listingCategory', operator: 'eq', expected: 'property', actual: 'property', matched: true },
          ],
          actions: longTermCancellationRules[0].actions,
        });

        const cancellationDecision = await policyEngine.evaluateCancellation(longTermContext);
        
        expect(cancellationDecision.tiers).toHaveLength(5);
        // Long-term bookings get more generous terms
        expect(cancellationDecision.tiers[1].refundPercentage).toBe(75); // Better than standard 50%
        expect(cancellationDecision.tiers[2].refundPercentage).toBe(50);
        
        expect(cancellationDecision.refundServiceFee).toBe(true); // Service fees refunded for long-term
        expect(cancellationDecision.refundPlatformFee).toBe(true);
        expect(cancellationDecision.flatPenalty).toBe(2000);
      });
    });

    describe('Deposit Requirements', () => {
      it('should calculate security deposits based on property value and type', async () => {
        const highValuePropertyContext: PolicyContext = {
          locale: 'en',
          country: 'NP',
          state: 'Bagmati',
          city: 'Kathmandu',
          timezone: 'Asia/Kathmandu',
          currency: 'NPR',
          userId: 'user-123',
          userRole: 'RENTER',
          userCountry: 'NP',
          listingId: 'listing-123',
          listingCategory: 'property',
          listingCountry: 'NP',
          listingState: 'Bagmati',
          listingCity: 'Kathmandu',
          bookingValue: 100000, // High value property
          bookingDuration: 30,
          bookingCurrency: 'NPR',
          startDate: '2026-04-05',
          endDate: '2026-05-05',
          guestCount: 4,
          hostPresent: false,
          requestTimestamp: new Date().toISOString(),
          evaluationDate: new Date().toISOString(),
          ipCountry: 'NP',
          platform: 'web',
          tenantId: null,
          workspaceConfig: { propertyType: 'luxury', hasPool: true, hasExpensiveArt: true },
        };

        const depositRules = [
          {
            id: 'base-security-deposit',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'listingCategory', operator: 'eq', value: 'property' },
              { field: 'bookingValue', operator: 'gte', value: 50000 },
            ],
            actions: [
              { type: 'SET_RATE' as const, params: { feeType: 'security_deposit', rate: 10, name: 'Base Security Deposit' } },
            ],
          },
          {
            id: 'luxury-property-surcharge',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'workspaceConfig.propertyType', operator: 'eq', value: 'luxury' },
            ],
            actions: [
              { type: 'SET_RATE' as const, params: { feeType: 'luxury_surcharge', rate: 5, name: 'Luxury Property Surcharge' } },
            ],
          },
          {
            id: 'pool-deposit',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'workspaceConfig.hasPool', operator: 'eq', value: true },
            ],
            actions: [
              { type: 'SET_FIXED_AMOUNT' as const, params: { feeType: 'pool_deposit', amount: 5000, name: 'Pool Security Deposit' } },
            ],
          },
          {
            id: 'valuable-items-deposit',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'workspaceConfig.hasExpensiveArt', operator: 'eq', value: true },
            ],
            actions: [
              { type: 'SET_FIXED_AMOUNT' as const, params: { feeType: 'valuable_items_deposit', amount: 10000, name: 'Valuable Items Deposit' } },
            ],
          },
        ];

        registry.findActiveRules.mockResolvedValue(depositRules as any);
        evaluator.evaluateRule.mockImplementation((rule) => ({
          ruleId: rule.id,
          ruleName: rule.actions[0].params.name as string,
          matched: true,
          conditionResults: rule.conditions.map(cond => ({
            field: cond.field,
            operator: cond.operator,
            expected: cond.value,
            actual: cond.field.startsWith('workspaceConfig.') 
              ? highValuePropertyContext.workspaceConfig[cond.field.replace('workspaceConfig.', '') as keyof typeof highValuePropertyContext.workspaceConfig]
              : highValuePropertyContext[cond.field as keyof PolicyContext],
            matched: true,
          })),
          actions: rule.actions,
        }));

        const fees = await policyEngine.calculateFees(highValuePropertyContext, 100000);
        
        expect(fees.baseFees).toHaveLength(4);
        
        const baseDeposit = fees.baseFees.find(f => f.feeType === 'security_deposit');
        const luxurySurcharge = fees.baseFees.find(f => f.feeType === 'luxury_surcharge');
        const poolDeposit = fees.baseFees.find(f => f.feeType === 'pool_deposit');
        const valuableItemsDeposit = fees.baseFees.find(f => f.feeType === 'valuable_items_deposit');
        
        expect(baseDeposit?.rate).toBe(10);
        expect(baseDeposit?.amount).toBe(10000); // 10% of 100,000
        
        expect(luxurySurcharge?.rate).toBe(5);
        expect(luxurySurcharge?.amount).toBe(5000); // 5% of 100,000
        
        expect(poolDeposit?.amount).toBe(5000);
        expect(valuableItemsDeposit?.amount).toBe(10000);
        
        expect(fees.totalFees).toBe(30000); // 10000 + 5000 + 5000 + 10000
      });

      it('should apply reduced deposits for long-term rentals', async () => {
        const longTermContext: PolicyContext = {
          locale: 'en',
          country: 'NP',
          state: 'Bagmati',
          city: 'Kathmandu',
          timezone: 'Asia/Kathmandu',
          currency: 'NPR',
          userId: 'user-123',
          userRole: 'RENTER',
          userCountry: 'NP',
          listingId: 'listing-123',
          listingCategory: 'property',
          listingCountry: 'NP',
          listingState: 'Bagmati',
          listingCity: 'Kathmandu',
          bookingValue: 60000,
          bookingDuration: 180, // 6 months
          bookingCurrency: 'NPR',
          startDate: '2026-04-05',
          endDate: '2026-10-02',
          guestCount: 2,
          hostPresent: false,
          requestTimestamp: new Date().toISOString(),
          evaluationDate: new Date().toISOString(),
          ipCountry: 'NP',
          platform: 'web',
          tenantId: null,
          workspaceConfig: { isLongTerm: true },
        };

        const longTermDepositRules = [
          {
            id: 'standard-deposit',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'listingCategory', operator: 'eq', value: 'property' },
              { field: 'bookingValue', operator: 'gte', value: 50000 },
            ],
            actions: [
              { type: 'SET_RATE' as const, params: { feeType: 'security_deposit', rate: 10, name: 'Standard Security Deposit' } },
            ],
          },
          {
            id: 'long-term-discount',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'workspaceConfig.isLongTerm', operator: 'eq', value: true },
              { field: 'bookingDuration', operator: 'gte', value: 90 },
            ],
            actions: [
              { type: 'SET_RATE' as const, params: { feeType: 'long_term_discount', rate: -5, name: 'Long Term Deposit Discount' } },
            ],
          },
        ];

        registry.findActiveRules.mockResolvedValue(longTermDepositRules as any);
        evaluator.evaluateRule.mockImplementation((rule) => ({
          ruleId: rule.id,
          ruleName: rule.actions[0].params.name as string,
          matched: true,
          conditionResults: rule.conditions.map(cond => ({
            field: cond.field,
            operator: cond.operator,
            expected: cond.value,
            actual: cond.field.startsWith('workspaceConfig.') 
              ? longTermContext.workspaceConfig[cond.field.replace('workspaceConfig.', '') as keyof typeof longTermContext.workspaceConfig]
              : longTermContext[cond.field as keyof PolicyContext],
            matched: true,
          })),
          actions: rule.actions,
        }));

        const fees = await policyEngine.calculateFees(longTermContext, 60000);
        
        expect(fees.baseFees).toHaveLength(2);
        
        const standardDeposit = fees.baseFees.find(f => f.feeType === 'security_deposit');
        const longTermDiscount = fees.baseFees.find(f => f.feeType === 'long_term_discount');
        
        expect(standardDeposit?.rate).toBe(10);
        expect(standardDeposit?.amount).toBe(6000); // 10% of 60,000
        
        expect(longTermDiscount?.rate).toBe(-5);
        expect(longTermDiscount?.amount).toBe(-3000); // -5% of 60,000
        
        expect(fees.totalFees).toBe(3000); // 6000 - 3000 = 5% effective rate
      });
    });

    describe('Insurance Requirements', () => {
      it('should require insurance for high-value vehicle rentals', async () => {
        const vehicleContext: PolicyContext = {
          locale: 'en',
          country: 'NP',
          state: 'Bagmati',
          city: 'Kathmandu',
          timezone: 'Asia/Kathmandu',
          currency: 'NPR',
          userId: 'user-123',
          userRole: 'RENTER',
          userCountry: 'NP',
          listingId: 'listing-123',
          listingCategory: 'vehicle',
          listingCountry: 'NP',
          listingState: 'Bagmati',
          listingCity: 'Kathmandu',
          bookingValue: 50000, // High value vehicle
          bookingDuration: 48,
          bookingCurrency: 'NPR',
          startDate: '2026-04-05',
          endDate: '2026-04-07',
          guestCount: 1,
          hostPresent: false,
          requestTimestamp: new Date().toISOString(),
          evaluationDate: new Date().toISOString(),
          ipCountry: 'NP',
          platform: 'web',
          tenantId: null,
          workspaceConfig: { vehicleType: 'car', hasInsurance: false },
        };

        const insuranceRules = [
          {
            id: 'vehicle-insurance-requirement',
            version: 1,
            policyType: 'BOOKING_CONSTRAINT',
            conditions: [
              { field: 'listingCategory', operator: 'eq', value: 'vehicle' },
              { field: 'bookingValue', operator: 'gte', value: 25000 },
              { field: 'workspaceConfig.hasInsurance', operator: 'eq', value: false },
            ],
            actions: [
              { type: 'BLOCK' as const, params: { reason: 'Vehicle insurance is required for rentals over NPR 25,000', referenceUrl: 'https://gharbatai.com/policies/vehicle-insurance' } },
              { type: 'REQUIRE_DOCUMENT' as const, params: { documentType: 'INSURANCE', label: 'Valid Vehicle Insurance Policy', threshold: 100000 } },
              { type: 'SET_FIXED_AMOUNT' as const, params: { feeType: 'insurance_verification', amount: 500, name: 'Insurance Verification Fee' } },
            ],
          },
        ];

        registry.findActiveRules.mockResolvedValue(insuranceRules as any);
        evaluator.evaluateRule.mockReturnValue({
          ruleId: 'vehicle-insurance-requirement',
          ruleName: 'Vehicle Insurance Requirement',
          matched: true,
          conditionResults: [
            { field: 'listingCategory', operator: 'eq', expected: 'vehicle', actual: 'vehicle', matched: true },
            { field: 'bookingValue', operator: 'gte', expected: 25000, actual: 50000, matched: true },
            { field: 'workspaceConfig.hasInsurance', operator: 'eq', expected: false, actual: false, matched: true },
          ],
          actions: insuranceRules[0].actions,
        });

        const constraints = await policyEngine.evaluateBookingConstraints(vehicleContext);
        
        expect(constraints.isAllowed).toBe(false);
        expect(constraints.blockedReasons).toHaveLength(1);
        expect(constraints.blockedReasons[0].reason).toBe('Vehicle insurance is required for rentals over NPR 25,000');
        expect(constraints.requiredDocuments).toHaveLength(1);
        expect(constraints.requiredDocuments[0].documentType).toBe('INSURANCE');
        expect(constraints.requiredDocuments[0].threshold).toBe(100000);
      });

      it('should allow bookings with valid insurance coverage', async () => {
        const insuredVehicleContext: PolicyContext = {
          locale: 'en',
          country: 'NP',
          state: 'Bagmati',
          city: 'Kathmandu',
          timezone: 'Asia/Kathmandu',
          currency: 'NPR',
          userId: 'user-123',
          userRole: 'RENTER',
          userCountry: 'NP',
          listingId: 'listing-123',
          listingCategory: 'vehicle',
          listingCountry: 'NP',
          listingState: 'Bagmati',
          listingCity: 'Kathmandu',
          bookingValue: 50000,
          bookingDuration: 48,
          bookingCurrency: 'NPR',
          startDate: '2026-04-05',
          endDate: '2026-04-07',
          guestCount: 1,
          hostPresent: false,
          requestTimestamp: new Date().toISOString(),
          evaluationDate: new Date().toISOString(),
          ipCountry: 'NP',
          platform: 'web',
          tenantId: null,
          workspaceConfig: { vehicleType: 'car', hasInsurance: true, insuranceCoverage: 150000 },
        };

        // No blocking rules when insurance is present
        registry.findActiveRules.mockResolvedValue([]);

        const constraints = await policyEngine.evaluateBookingConstraints(insuredVehicleContext);
        
        expect(constraints.isAllowed).toBe(true);
        expect(constraints.blockedReasons).toHaveLength(0);
        expect(constraints.requiredDocuments).toHaveLength(0);
      });

      it('should calculate insurance premiums based on risk factors', async () => {
        const riskVehicleContext: PolicyContext = {
          locale: 'en',
          country: 'NP',
          state: 'Bagmati',
          city: 'Kathmandu',
          timezone: 'Asia/Kathmandu',
          currency: 'NPR',
          userId: 'user-123',
          userRole: 'RENTER',
          userCountry: 'NP',
          listingId: 'listing-123',
          listingCategory: 'vehicle',
          listingCountry: 'NP',
          listingState: 'Bagmati',
          listingCity: 'Kathmandu',
          bookingValue: 30000,
          bookingDuration: 72, // 3 days
          bookingCurrency: 'NPR',
          startDate: '2026-04-05',
          endDate: '2026-04-08',
          guestCount: 1,
          hostPresent: false,
          requestTimestamp: new Date().toISOString(),
          evaluationDate: new Date().toISOString(),
          ipCountry: 'NP',
          platform: 'web',
          tenantId: null,
          workspaceConfig: { 
            driverAge: 22, // Young driver
            drivingExperience: 1, // Limited experience
            vehicleType: 'motorcycle', // Higher risk
            hasInsurance: false
          },
        };

        const insurancePremiumRules = [
          {
            id: 'base-insurance-premium',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'listingCategory', operator: 'eq', value: 'vehicle' },
            ],
            actions: [
              { type: 'SET_RATE' as const, params: { feeType: 'insurance_premium', rate: 5, name: 'Base Insurance Premium' } },
            ],
          },
          {
            id: 'young-driver-surcharge',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'workspaceConfig.driverAge', operator: 'lt', value: 25 },
            ],
            actions: [
              { type: 'SET_RATE' as const, params: { feeType: 'young_driver_surcharge', rate: 3, name: 'Young Driver Surcharge' } },
            ],
          },
          {
            id: 'inexperienced-driver-surcharge',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'workspaceConfig.drivingExperience', operator: 'lt', value: 2 },
            ],
            actions: [
              { type: 'SET_RATE' as const, params: { feeType: 'inexperienced_surcharge', rate: 2, name: 'Inexperienced Driver Surcharge' } },
            ],
          },
          {
            id: 'motorcycle-risk-surcharge',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'workspaceConfig.vehicleType', operator: 'eq', value: 'motorcycle' },
            ],
            actions: [
              { type: 'SET_RATE' as const, params: { feeType: 'motorcycle_risk', rate: 4, name: 'Motorcycle Risk Surcharge' } },
            ],
          },
        ];

        registry.findActiveRules.mockResolvedValue(insurancePremiumRules as any);
        evaluator.evaluateRule.mockImplementation((rule) => ({
          ruleId: rule.id,
          ruleName: rule.actions[0].params.name as string,
          matched: true,
          conditionResults: rule.conditions.map(cond => ({
            field: cond.field,
            operator: cond.operator,
            expected: cond.value,
            actual: cond.field.startsWith('workspaceConfig.') 
              ? riskVehicleContext.workspaceConfig[cond.field.replace('workspaceConfig.', '') as keyof typeof riskVehicleContext.workspaceConfig]
              : riskVehicleContext[cond.field as keyof PolicyContext],
            matched: true,
          })),
          actions: rule.actions,
        }));

        const fees = await policyEngine.calculateFees(riskVehicleContext, 30000);
        
        expect(fees.baseFees).toHaveLength(4);
        
        const basePremium = fees.baseFees.find(f => f.feeType === 'insurance_premium');
        const youngDriverSurcharge = fees.baseFees.find(f => f.feeType === 'young_driver_surcharge');
        const inexperiencedSurcharge = fees.baseFees.find(f => f.feeType === 'inexperienced_surcharge');
        const motorcycleRisk = fees.baseFees.find(f => f.feeType === 'motorcycle_risk');
        
        expect(basePremium?.rate).toBe(5);
        expect(basePremium?.amount).toBe(1500); // 5% of 30,000
        
        expect(youngDriverSurcharge?.rate).toBe(3);
        expect(youngDriverSurcharge?.amount).toBe(900); // 3% of 30,000
        
        expect(inexperiencedSurcharge?.rate).toBe(2);
        expect(inexperiencedSurcharge?.amount).toBe(600); // 2% of 30,000
        
        expect(motorcycleRisk?.rate).toBe(4);
        expect(motorcycleRisk?.amount).toBe(1200); // 4% of 30,000
        
        expect(fees.totalFees).toBe(4200); // 1500 + 900 + 600 + 1200 = 14% total
      });
    });
  });

  // ──────────────────────────────────────────────────────
  // CATEGORY-SPECIFIC POLICY TESTS (Task 1.3.4)
  // ──────────────────────────────────────────────────────

  describe('Category-Specific Policy Tests', () => {
    describe('Vehicle Rental Policies', () => {
      it('should apply vehicle-specific insurance and licensing requirements', async () => {
        const motorcycleContext: PolicyContext = {
          locale: 'en',
          country: 'NP',
          state: 'Bagmati',
          city: 'Kathmandu',
          timezone: 'Asia/Kathmandu',
          currency: 'NPR',
          userId: 'user-123',
          userRole: 'RENTER',
          userCountry: 'NP',
          listingId: 'listing-123',
          listingCategory: 'vehicle',
          listingCountry: 'NP',
          listingState: 'Bagmati',
          listingCity: 'Kathmandu',
          bookingValue: 25000,
          bookingDuration: 48,
          bookingCurrency: 'NPR',
          startDate: '2026-04-05',
          endDate: '2026-04-07',
          guestCount: 1,
          hostPresent: false,
          requestTimestamp: new Date().toISOString(),
          evaluationDate: new Date().toISOString(),
          ipCountry: 'NP',
          platform: 'web',
          tenantId: null,
          workspaceConfig: { 
            vehicleType: 'motorcycle',
            hasLicense: false,
            hasInsurance: false,
            engineCC: 150
          },
        };

        const vehiclePolicyRules = [
          {
            id: 'motorcycle-license-requirement',
            version: 1,
            policyType: 'BOOKING_CONSTRAINT',
            conditions: [
              { field: 'listingCategory', operator: 'eq', value: 'vehicle' },
              { field: 'workspaceConfig.vehicleType', operator: 'eq', value: 'motorcycle' },
              { field: 'workspaceConfig.hasLicense', operator: 'eq', value: false },
            ],
            actions: [
              { type: 'BLOCK' as const, params: { reason: 'Valid motorcycle license required for motorcycle rentals', referenceUrl: 'https://gharbatai.com/policies/motorcycle-license' } },
              { type: 'REQUIRE_DOCUMENT' as const, params: { documentType: 'MOTORCYCLE_LICENSE', label: 'Valid Motorcycle License' } },
            ],
          },
          {
            id: 'motorcycle-insurance-requirement',
            version: 1,
            policyType: 'BOOKING_CONSTRAINT',
            conditions: [
              { field: 'listingCategory', operator: 'eq', value: 'vehicle' },
              { field: 'workspaceConfig.vehicleType', operator: 'eq', value: 'motorcycle' },
              { field: 'workspaceConfig.hasInsurance', operator: 'eq', value: false },
            ],
            actions: [
              { type: 'REQUIRE_DOCUMENT' as const, params: { documentType: 'MOTORCYCLE_INSURANCE', label: 'Motorcycle Insurance Policy', threshold: 50000 } },
              { type: 'SET_FIXED_AMOUNT' as const, params: { feeType: 'insurance_verification', amount: 300, name: 'Motorcycle Insurance Verification' } },
            ],
          },
          {
            id: 'motorcycle-age-requirement',
            version: 1,
            policyType: 'BOOKING_CONSTRAINT',
            conditions: [
              { field: 'listingCategory', operator: 'eq', value: 'vehicle' },
              { field: 'workspaceConfig.vehicleType', operator: 'eq', value: 'motorcycle' },
              { field: 'workspaceConfig.engineCC', operator: 'gt', value: 125 },
            ],
            actions: [
              { type: 'SET_MIN_MAX' as const, params: { minAge: 21 } },
              { type: 'SET_RATE' as const, params: { feeType: 'high_cc_surcharge', rate: 2, name: 'High CC Surcharge' } },
            ],
          },
        ];

        registry.findActiveRules.mockResolvedValue(vehiclePolicyRules as any);
        evaluator.evaluateRule.mockImplementation((rule) => ({
          ruleId: rule.id,
          ruleName: rule.actions[0].params.name as string,
          matched: true,
          conditionResults: rule.conditions.map(cond => ({
            field: cond.field,
            operator: cond.operator,
            expected: cond.value,
            actual: cond.field.startsWith('workspaceConfig.') 
              ? motorcycleContext.workspaceConfig[cond.field.replace('workspaceConfig.', '') as keyof typeof motorcycleContext.workspaceConfig]
              : motorcycleContext[cond.field as keyof PolicyContext],
            matched: true,
          })),
          actions: rule.actions,
        }));

        const constraints = await policyEngine.evaluateBookingConstraints(motorcycleContext);
        
        expect(constraints.isAllowed).toBe(false); // Blocked due to missing license
        expect(constraints.blockedReasons).toHaveLength(1);
        expect(constraints.blockedReasons[0].reason).toBe('Valid motorcycle license required for motorcycle rentals');
        expect(constraints.requiredDocuments).toHaveLength(2); // License and insurance requirements
        expect(constraints.minAge).toBe(21);
        expect(constraints.appliedRules).toContain('motorcycle-license-requirement');
        expect(constraints.appliedRules).toContain('motorcycle-insurance-requirement');
        expect(constraints.appliedRules).toContain('motorcycle-age-requirement');
      });

      it('should apply different policies for cars vs motorcycles', async () => {
        const carContext: PolicyContext = {
          locale: 'en',
          country: 'NP',
          state: 'Bagmati',
          city: 'Kathmandu',
          timezone: 'Asia/Kathmandu',
          currency: 'NPR',
          userId: 'user-123',
          userRole: 'RENTER',
          userCountry: 'NP',
          listingId: 'listing-123',
          listingCategory: 'vehicle',
          listingCountry: 'NP',
          listingState: 'Bagmati',
          listingCity: 'Kathmandu',
          bookingValue: 40000,
          bookingDuration: 72,
          bookingCurrency: 'NPR',
          startDate: '2026-04-05',
          endDate: '2026-04-08',
          guestCount: 1,
          hostPresent: false,
          requestTimestamp: new Date().toISOString(),
          evaluationDate: new Date().toISOString(),
          ipCountry: 'NP',
          platform: 'web',
          tenantId: null,
          workspaceConfig: { 
            vehicleType: 'car',
            hasLicense: true,
            hasInsurance: true,
            carType: 'sedan',
            transmission: 'manual'
          },
        };

        const carPolicyRules = [
          {
            id: 'car-insurance-premium',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'listingCategory', operator: 'eq', value: 'vehicle' },
              { field: 'workspaceConfig.vehicleType', operator: 'eq', value: 'car' },
            ],
            actions: [
              { type: 'SET_RATE' as const, params: { feeType: 'car_insurance_premium', rate: 3, name: 'Car Insurance Premium' } },
            ],
          },
          {
            id: 'manual-transmission-discount',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'workspaceConfig.transmission', operator: 'eq', value: 'manual' },
            ],
            actions: [
              { type: 'SET_RATE' as const, params: { feeType: 'manual_discount', rate: -1, name: 'Manual Transmission Discount' } },
            ],
          },
          {
            id: 'sedan-standard-fee',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'workspaceConfig.carType', operator: 'eq', value: 'sedan' },
            ],
            actions: [
              { type: 'SET_FIXED_AMOUNT' as const, params: { feeType: 'sedan_fee', amount: 500, name: 'Sedan Standard Fee' } },
            ],
          },
        ];

        registry.findActiveRules.mockResolvedValue(carPolicyRules as any);
        evaluator.evaluateRule.mockImplementation((rule) => ({
          ruleId: rule.id,
          ruleName: rule.actions[0].params.name as string,
          matched: true,
          conditionResults: rule.conditions.map(cond => ({
            field: cond.field,
            operator: cond.operator,
            expected: cond.value,
            actual: cond.field.startsWith('workspaceConfig.') 
              ? carContext.workspaceConfig[cond.field.replace('workspaceConfig.', '') as keyof typeof carContext.workspaceConfig]
              : carContext[cond.field as keyof PolicyContext],
            matched: true,
          })),
          actions: rule.actions,
        }));

        const fees = await policyEngine.calculateFees(carContext, 40000);
        
        expect(fees.baseFees).toHaveLength(3);
        
        const insurancePremium = fees.baseFees.find(f => f.feeType === 'car_insurance_premium');
        const manualDiscount = fees.baseFees.find(f => f.feeType === 'manual_discount');
        const sedanFee = fees.baseFees.find(f => f.feeType === 'sedan_fee');
        
        expect(insurancePremium?.rate).toBe(3);
        expect(insurancePremium?.amount).toBe(1200); // 3% of 40,000
        
        expect(manualDiscount?.rate).toBe(-1);
        expect(manualDiscount?.amount).toBe(-400); // -1% of 40,000
        
        expect(sedanFee?.amount).toBe(500);
        
        expect(fees.totalFees).toBe(1300); // 1200 - 400 + 500
      });
    });

    describe('Property Rental Policies', () => {
      it('should apply property-specific policies based on type and amenities', async () => {
        const luxuryApartmentContext: PolicyContext = {
          locale: 'en',
          country: 'NP',
          state: 'Bagmati',
          city: 'Kathmandu',
          timezone: 'Asia/Kathmandu',
          currency: 'NPR',
          userId: 'user-123',
          userRole: 'RENTER',
          userCountry: 'NP',
          listingId: 'listing-123',
          listingCategory: 'property',
          listingCountry: 'NP',
          listingState: 'Bagmati',
          listingCity: 'Kathmandu',
          bookingValue: 75000,
          bookingDuration: 30,
          bookingCurrency: 'NPR',
          startDate: '2026-04-05',
          endDate: '2026-05-05',
          guestCount: 3,
          hostPresent: false,
          requestTimestamp: new Date().toISOString(),
          evaluationDate: new Date().toISOString(),
          ipCountry: 'NP',
          platform: 'web',
          tenantId: null,
          workspaceConfig: { 
            propertyType: 'apartment',
            propertyClass: 'luxury',
            bedrooms: 3,
            hasElevator: true,
            hasParking: true,
            hasGym: true,
            hasPool: false,
            furnished: true
          },
        };

        const propertyPolicyRules = [
          {
            id: 'luxury-apartment-fee',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'listingCategory', operator: 'eq', value: 'property' },
              { field: 'workspaceConfig.propertyClass', operator: 'eq', value: 'luxury' },
              { field: 'workspaceConfig.propertyType', operator: 'eq', value: 'apartment' },
            ],
            actions: [
              { type: 'SET_RATE' as const, params: { feeType: 'luxury_apartment_fee', rate: 8, name: 'Luxury Apartment Fee' } },
            ],
          },
          {
            id: 'furnished-surcharge',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'workspaceConfig.furnished', operator: 'eq', value: true },
            ],
            actions: [
              { type: 'SET_RATE' as const, params: { feeType: 'furnished_surcharge', rate: 3, name: 'Furnished Surcharge' } },
            ],
          },
          {
            id: 'amenity-fees',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'workspaceConfig.hasElevator', operator: 'eq', value: true },
              { field: 'workspaceConfig.hasParking', operator: 'eq', value: true },
              { field: 'workspaceConfig.hasGym', operator: 'eq', value: true },
            ],
            actions: [
              { type: 'SET_FIXED_AMOUNT' as const, params: { feeType: 'elevator_fee', amount: 200, name: 'Elevator Maintenance' } },
              { type: 'SET_FIXED_AMOUNT' as const, params: { feeType: 'parking_fee', amount: 1000, name: 'Parking Fee' } },
              { type: 'SET_FIXED_AMOUNT' as const, params: { feeType: 'gym_fee', amount: 500, name: 'Gym Access Fee' } },
            ],
          },
          {
            id: 'multi-bedroom-discount',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'workspaceConfig.bedrooms', operator: 'gte', value: 3 },
            ],
            actions: [
              { type: 'SET_RATE' as const, params: { feeType: 'multi_bedroom_discount', rate: -2, name: 'Multi-Bedroom Discount' } },
            ],
          },
        ];

        registry.findActiveRules.mockResolvedValue(propertyPolicyRules as any);
        evaluator.evaluateRule.mockImplementation((rule) => ({
          ruleId: rule.id,
          ruleName: rule.actions[0].params.name as string,
          matched: true,
          conditionResults: rule.conditions.map(cond => ({
            field: cond.field,
            operator: cond.operator,
            expected: cond.value,
            actual: cond.field.startsWith('workspaceConfig.') 
              ? luxuryApartmentContext.workspaceConfig[cond.field.replace('workspaceConfig.', '') as keyof typeof luxuryApartmentContext.workspaceConfig]
              : luxuryApartmentContext[cond.field as keyof PolicyContext],
            matched: true,
          })),
          actions: rule.actions,
        }));

        const fees = await policyEngine.calculateFees(luxuryApartmentContext, 75000);
        
        expect(fees.baseFees).toHaveLength(6);
        
        const luxuryFee = fees.baseFees.find(f => f.feeType === 'luxury_apartment_fee');
        const furnishedSurcharge = fees.baseFees.find(f => f.feeType === 'furnished_surcharge');
        const elevatorFee = fees.baseFees.find(f => f.feeType === 'elevator_fee');
        const parkingFee = fees.baseFees.find(f => f.feeType === 'parking_fee');
        const gymFee = fees.baseFees.find(f => f.feeType === 'gym_fee');
        const bedroomDiscount = fees.baseFees.find(f => f.feeType === 'multi_bedroom_discount');
        
        expect(luxuryFee?.rate).toBe(8);
        expect(luxuryFee?.amount).toBe(6000); // 8% of 75,000
        
        expect(furnishedSurcharge?.rate).toBe(3);
        expect(furnishedSurcharge?.amount).toBe(2250); // 3% of 75,000
        
        expect(elevatorFee?.amount).toBe(200);
        expect(parkingFee?.amount).toBe(1000);
        expect(gymFee?.amount).toBe(500);
        
        expect(bedroomDiscount?.rate).toBe(-2);
        expect(bedroomDiscount?.amount).toBe(-1500); // -2% of 75,000
        
        expect(fees.totalFees).toBe(8450); // 6000 + 2250 + 200 + 1000 + 500 - 1500
      });

      it('should apply different policies for houses vs apartments', async () => {
        const houseContext: PolicyContext = {
          locale: 'en',
          country: 'NP',
          state: 'Bagmati',
          city: 'Kathmandu',
          timezone: 'Asia/Kathmandu',
          currency: 'NPR',
          userId: 'user-123',
          userRole: 'RENTER',
          userCountry: 'NP',
          listingId: 'listing-123',
          listingCategory: 'property',
          listingCountry: 'NP',
          listingState: 'Bagmati',
          listingCity: 'Kathmandu',
          bookingValue: 60000,
          bookingDuration: 60,
          bookingCurrency: 'NPR',
          startDate: '2026-04-05',
          endDate: '2026-06-04',
          guestCount: 4,
          hostPresent: false,
          requestTimestamp: new Date().toISOString(),
          evaluationDate: new Date().toISOString(),
          ipCountry: 'NP',
          platform: 'web',
          tenantId: null,
          workspaceConfig: { 
            propertyType: 'house',
            propertyClass: 'standard',
            bedrooms: 4,
            hasGarden: true,
            hasGarage: true,
            hasSecurity: false,
            furnished: false
          },
        };

        const housePolicyRules = [
          {
            id: 'house-standard-fee',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'listingCategory', operator: 'eq', value: 'property' },
              { field: 'workspaceConfig.propertyType', operator: 'eq', value: 'house' },
            ],
            actions: [
              { type: 'SET_RATE' as const, params: { feeType: 'house_standard_fee', rate: 6, name: 'House Standard Fee' } },
            ],
          },
          {
            id: 'garden-maintenance-fee',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'workspaceConfig.hasGarden', operator: 'eq', value: true },
            ],
            actions: [
              { type: 'SET_FIXED_AMOUNT' as const, params: { feeType: 'garden_fee', amount: 800, name: 'Garden Maintenance Fee' } },
            ],
          },
          {
            id: 'garage-access-fee',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'workspaceConfig.hasGarage', operator: 'eq', value: true },
            ],
            actions: [
              { type: 'SET_FIXED_AMOUNT' as const, params: { feeType: 'garage_fee', amount: 1500, name: 'Garage Access Fee' } },
            ],
          },
          {
            id: 'unfurnished-discount',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'workspaceConfig.furnished', operator: 'eq', value: false },
            ],
            actions: [
              { type: 'SET_RATE' as const, params: { feeType: 'unfurnished_discount', rate: -1.5, name: 'Unfurnished Discount' } },
            ],
          },
        ];

        registry.findActiveRules.mockResolvedValue(housePolicyRules as any);
        evaluator.evaluateRule.mockImplementation((rule) => ({
          ruleId: rule.id,
          ruleName: rule.actions[0].params.name as string,
          matched: true,
          conditionResults: rule.conditions.map(cond => ({
            field: cond.field,
            operator: cond.operator,
            expected: cond.value,
            actual: cond.field.startsWith('workspaceConfig.') 
              ? houseContext.workspaceConfig[cond.field.replace('workspaceConfig.', '') as keyof typeof houseContext.workspaceConfig]
              : houseContext[cond.field as keyof PolicyContext],
            matched: true,
          })),
          actions: rule.actions,
        }));

        const fees = await policyEngine.calculateFees(houseContext, 60000);
        
        expect(fees.baseFees).toHaveLength(4);
        
        const houseFee = fees.baseFees.find(f => f.feeType === 'house_standard_fee');
        const gardenFee = fees.baseFees.find(f => f.feeType === 'garden_fee');
        const garageFee = fees.baseFees.find(f => f.feeType === 'garage_fee');
        const unfurnishedDiscount = fees.baseFees.find(f => f.feeType === 'unfurnished_discount');
        
        expect(houseFee?.rate).toBe(6);
        expect(houseFee?.amount).toBe(3600); // 6% of 60,000
        
        expect(gardenFee?.amount).toBe(800);
        expect(garageFee?.amount).toBe(1500);
        
        expect(unfurnishedDiscount?.rate).toBe(-1.5);
        expect(unfurnishedDiscount?.amount).toBe(-900); // -1.5% of 60,000
        
        expect(fees.totalFees).toBe(5000); // 3600 + 800 + 1500 - 900
      });
    });

    describe('Equipment Rental Policies', () => {
      it('should apply equipment-specific maintenance and insurance policies', async () => {
        const constructionEquipmentContext: PolicyContext = {
          locale: 'en',
          country: 'NP',
          state: 'Bagmati',
          city: 'Kathmandu',
          timezone: 'Asia/Kathmandu',
          currency: 'NPR',
          userId: 'user-123',
          userRole: 'RENTER',
          userCountry: 'NP',
          listingId: 'listing-123',
          listingCategory: 'equipment',
          listingCountry: 'NP',
          listingState: 'Bagmati',
          listingCity: 'Kathmandu',
          bookingValue: 35000,
          bookingDuration: 168, // 7 days
          bookingCurrency: 'NPR',
          startDate: '2026-04-05',
          endDate: '2026-04-12',
          guestCount: 1,
          hostPresent: false,
          requestTimestamp: new Date().toISOString(),
          evaluationDate: new Date().toISOString(),
          ipCountry: 'NP',
          platform: 'web',
          tenantId: null,
          workspaceConfig: { 
            equipmentType: 'construction',
            equipmentClass: 'heavy',
            requiresOperator: true,
            hasInsurance: false,
            operatorCertified: false
          },
        };

        const equipmentPolicyRules = [
          {
            id: 'heavy-equipment-insurance',
            version: 1,
            policyType: 'BOOKING_CONSTRAINT',
            conditions: [
              { field: 'listingCategory', operator: 'eq', value: 'equipment' },
              { field: 'workspaceConfig.equipmentClass', operator: 'eq', value: 'heavy' },
              { field: 'workspaceConfig.hasInsurance', operator: 'eq', value: false },
            ],
            actions: [
              { type: 'REQUIRE_DOCUMENT' as const, params: { documentType: 'EQUIPMENT_INSURANCE', label: 'Heavy Equipment Insurance', threshold: 200000 } },
              { type: 'SET_RATE' as const, params: { feeType: 'equipment_insurance_premium', rate: 4, name: 'Equipment Insurance Premium' } },
            ],
          },
          {
            id: 'operator-certification-requirement',
            version: 1,
            policyType: 'BOOKING_CONSTRAINT',
            conditions: [
              { field: 'workspaceConfig.requiresOperator', operator: 'eq', value: true },
              { field: 'workspaceConfig.operatorCertified', operator: 'eq', value: false },
            ],
            actions: [
              { type: 'BLOCK' as const, params: { reason: 'Certified operator required for heavy equipment operation', referenceUrl: 'https://gharbatai.com/policies/equipment-operator' } },
              { type: 'REQUIRE_DOCUMENT' as const, params: { documentType: 'OPERATOR_CERTIFICATION', label: 'Valid Operator Certification' } },
            ],
          },
          {
            id: 'construction-equipment-maintenance',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'workspaceConfig.equipmentType', operator: 'eq', value: 'construction' },
            ],
            actions: [
              { type: 'SET_FIXED_AMOUNT' as const, params: { feeType: 'maintenance_fee', amount: 2000, name: 'Construction Equipment Maintenance' } },
              { type: 'SET_RATE' as const, params: { feeType: 'wear_and_tear', rate: 2, name: 'Wear and Tear Fee' } },
            ],
          },
          {
            id: 'long-term-equipment-discount',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'bookingDuration', operator: 'gte', value: 120 }, // 5+ days
            ],
            actions: [
              { type: 'SET_RATE' as const, params: { feeType: 'long_term_discount', rate: -1.5, name: 'Long Term Equipment Discount' } },
            ],
          },
        ];

        registry.findActiveRules.mockResolvedValue(equipmentPolicyRules as any);
        evaluator.evaluateRule.mockImplementation((rule) => ({
          ruleId: rule.id,
          ruleName: rule.actions[0].params.name as string,
          matched: true,
          conditionResults: rule.conditions.map(cond => ({
            field: cond.field,
            operator: cond.operator,
            expected: cond.value,
            actual: cond.field.startsWith('workspaceConfig.') 
              ? constructionEquipmentContext.workspaceConfig[cond.field.replace('workspaceConfig.', '') as keyof typeof constructionEquipmentContext.workspaceConfig]
              : constructionEquipmentContext[cond.field as keyof PolicyContext],
            matched: true,
          })),
          actions: rule.actions,
        }));

        const constraints = await policyEngine.evaluateBookingConstraints(constructionEquipmentContext);
        
        expect(constraints.isAllowed).toBe(false); // Blocked due to missing operator certification
        expect(constraints.blockedReasons).toHaveLength(1);
        expect(constraints.blockedReasons[0].reason).toBe('Certified operator required for heavy equipment operation');
        expect(constraints.requiredDocuments).toHaveLength(2); // Insurance and certification requirements
        expect(constraints.appliedRules).toContain('heavy-equipment-insurance');
        expect(constraints.appliedRules).toContain('operator-certification-requirement');

        // Test fee calculation for equipment
        const fees = await policyEngine.calculateFees(constructionEquipmentContext, 35000);
        
        expect(fees.baseFees).toHaveLength(4);
        
        const insurancePremium = fees.baseFees.find(f => f.feeType === 'equipment_insurance_premium');
        const maintenanceFee = fees.baseFees.find(f => f.feeType === 'maintenance_fee');
        const wearAndTear = fees.baseFees.find(f => f.feeType === 'wear_and_tear');
        const longTermDiscount = fees.baseFees.find(f => f.feeType === 'long_term_discount');
        
        expect(insurancePremium?.rate).toBe(4);
        expect(insurancePremium?.amount).toBe(1400); // 4% of 35,000
        
        expect(maintenanceFee?.amount).toBe(2000);
        expect(wearAndTear?.rate).toBe(2);
        expect(wearAndTear?.amount).toBe(700); // 2% of 35,000
        
        expect(longTermDiscount?.rate).toBe(-1.5);
        expect(longTermDiscount?.amount).toBe(-525); // -1.5% of 35,000
        
        expect(fees.totalFees).toBe(3575); // 1400 + 2000 + 700 - 525
      });

      it('should apply different policies for electronic vs construction equipment', async () => {
        const electronicEquipmentContext: PolicyContext = {
          locale: 'en',
          country: 'NP',
          state: 'Bagmati',
          city: 'Kathmandu',
          timezone: 'Asia/Kathmandu',
          currency: 'NPR',
          userId: 'user-123',
          userRole: 'RENTER',
          userCountry: 'NP',
          listingId: 'listing-123',
          listingCategory: 'equipment',
          listingCountry: 'NP',
          listingState: 'Bagmati',
          listingCity: 'Kathmandu',
          bookingValue: 8000,
          bookingDuration: 24,
          bookingCurrency: 'NPR',
          startDate: '2026-04-05',
          endDate: '2026-04-06',
          guestCount: 1,
          hostPresent: false,
          requestTimestamp: new Date().toISOString(),
          evaluationDate: new Date().toISOString(),
          ipCountry: 'NP',
          platform: 'web',
          tenantId: null,
          workspaceConfig: { 
            equipmentType: 'electronics',
            equipmentClass: 'portable',
            requiresCalibration: false,
            hasWarranty: true,
            fragile: true
          },
        };

        const electronicPolicyRules = [
          {
            id: 'electronics-standard-fee',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'listingCategory', operator: 'eq', value: 'equipment' },
              { field: 'workspaceConfig.equipmentType', operator: 'eq', value: 'electronics' },
            ],
            actions: [
              { type: 'SET_RATE' as const, params: { feeType: 'electronics_fee', rate: 5, name: 'Electronics Rental Fee' } },
            ],
          },
          {
            id: 'fragile-equipment-surcharge',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'workspaceConfig.fragile', operator: 'eq', value: true },
            ],
            actions: [
              { type: 'SET_RATE' as const, params: { feeType: 'fragile_surcharge', rate: 2, name: 'Fragile Equipment Surcharge' } },
            ],
          },
          {
            id: 'warranty-protection-discount',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'workspaceConfig.hasWarranty', operator: 'eq', value: true },
            ],
            actions: [
              { type: 'SET_RATE' as const, params: { feeType: 'warranty_discount', rate: -1, name: 'Warranty Protection Discount' } },
            ],
          },
          {
            id: 'portable-equipment-handling',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'workspaceConfig.equipmentClass', operator: 'eq', value: 'portable' },
            ],
            actions: [
              { type: 'SET_FIXED_AMOUNT' as const, params: { feeType: 'handling_fee', amount: 200, name: 'Portable Equipment Handling' } },
            ],
          },
        ];

        registry.findActiveRules.mockResolvedValue(electronicPolicyRules as any);
        evaluator.evaluateRule.mockImplementation((rule) => ({
          ruleId: rule.id,
          ruleName: rule.actions[0].params.name as string,
          matched: true,
          conditionResults: rule.conditions.map(cond => ({
            field: cond.field,
            operator: cond.operator,
            expected: cond.value,
            actual: cond.field.startsWith('workspaceConfig.') 
              ? electronicEquipmentContext.workspaceConfig[cond.field.replace('workspaceConfig.', '') as keyof typeof electronicEquipmentContext.workspaceConfig]
              : electronicEquipmentContext[cond.field as keyof PolicyContext],
            matched: true,
          })),
          actions: rule.actions,
        }));

        const fees = await policyEngine.calculateFees(electronicEquipmentContext, 8000);
        
        expect(fees.baseFees).toHaveLength(4);
        
        const electronicsFee = fees.baseFees.find(f => f.feeType === 'electronics_fee');
        const fragileSurcharge = fees.baseFees.find(f => f.feeType === 'fragile_surcharge');
        const warrantyDiscount = fees.baseFees.find(f => f.feeType === 'warranty_discount');
        const handlingFee = fees.baseFees.find(f => f.feeType === 'handling_fee');
        
        expect(electronicsFee?.rate).toBe(5);
        expect(electronicsFee?.amount).toBe(400); // 5% of 8,000
        
        expect(fragileSurcharge?.rate).toBe(2);
        expect(fragileSurcharge?.amount).toBe(160); // 2% of 8,000
        
        expect(warrantyDiscount?.rate).toBe(-1);
        expect(warrantyDiscount?.amount).toBe(-80); // -1% of 8,000
        
        expect(handlingFee?.amount).toBe(200);
        
        expect(fees.totalFees).toBe(680); // 400 + 160 - 80 + 200
      });
    });

    describe('Event Venue Policies', () => {
      it('should apply venue-specific capacity and event type policies', async () => {
        const weddingVenueContext: PolicyContext = {
          locale: 'en',
          country: 'NP',
          state: 'Bagmati',
          city: 'Kathmandu',
          timezone: 'Asia/Kathmandu',
          currency: 'NPR',
          userId: 'user-123',
          userRole: 'RENTER',
          userCountry: 'NP',
          listingId: 'listing-123',
          listingCategory: 'event_venue',
          listingCountry: 'NP',
          listingState: 'Bagmati',
          listingCity: 'Kathmandu',
          bookingValue: 120000,
          bookingDuration: 12, // 12 hours for event
          bookingCurrency: 'NPR',
          startDate: '2026-04-05',
          endDate: '2026-04-05',
          guestCount: 150,
          hostPresent: false,
          requestTimestamp: new Date().toISOString(),
          evaluationDate: new Date().toISOString(),
          ipCountry: 'NP',
          platform: 'web',
          tenantId: null,
          workspaceConfig: { 
            eventType: 'wedding',
            venueType: 'banquet_hall',
            maxCapacity: 200,
            hasCatering: false,
            hasDecoration: false,
            requiresPermit: true,
            hasPermit: false,
            alcoholServed: true
          },
        };

        const venuePolicyRules = [
          {
            id: 'wedding-venue-base-fee',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'listingCategory', operator: 'eq', value: 'event_venue' },
              { field: 'workspaceConfig.eventType', operator: 'eq', value: 'wedding' },
            ],
            actions: [
              { type: 'SET_RATE' as const, params: { feeType: 'wedding_venue_fee', rate: 15, name: 'Wedding Venue Fee' } },
            ],
          },
          {
            id: 'banquet-hall-surcharge',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'workspaceConfig.venueType', operator: 'eq', value: 'banquet_hall' },
            ],
            actions: [
              { type: 'SET_RATE' as const, params: { feeType: 'banquet_surcharge', rate: 3, name: 'Banquet Hall Surcharge' } },
            ],
          },
          {
            id: 'alcohol-license-fee',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'workspaceConfig.alcoholServed', operator: 'eq', value: true },
            ],
            actions: [
              { type: 'SET_FIXED_AMOUNT' as const, params: { feeType: 'alcohol_license', amount: 5000, name: 'Alcohol License Fee' } },
            ],
          },
          {
            id: 'capacity-based-pricing',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'guestCount', operator: 'gt', value: 100 },
            ],
            actions: [
              { type: 'SET_RATE' as const, params: { feeType: 'capacity_surcharge', rate: 2, name: 'High Capacity Surcharge' } },
            ],
          },
          {
            id: 'permit-requirement',
            version: 1,
            policyType: 'BOOKING_CONSTRAINT',
            conditions: [
              { field: 'workspaceConfig.requiresPermit', operator: 'eq', value: true },
              { field: 'workspaceConfig.hasPermit', operator: 'eq', value: false },
            ],
            actions: [
              { type: 'REQUIRE_DOCUMENT' as const, params: { documentType: 'EVENT_PERMIT', label: 'Event Permit from Local Authority' } },
              { type: 'SET_FIXED_AMOUNT' as const, params: { feeType: 'permit_processing', amount: 1000, name: 'Permit Processing Fee' } },
            ],
          },
        ];

        registry.findActiveRules.mockResolvedValue(venuePolicyRules as any);
        evaluator.evaluateRule.mockImplementation((rule) => ({
          ruleId: rule.id,
          ruleName: rule.actions[0].params.name as string,
          matched: true,
          conditionResults: rule.conditions.map(cond => ({
            field: cond.field,
            operator: cond.operator,
            expected: cond.value,
            actual: cond.field.startsWith('workspaceConfig.') 
              ? weddingVenueContext.workspaceConfig[cond.field.replace('workspaceConfig.', '') as keyof typeof weddingVenueContext.workspaceConfig]
              : weddingVenueContext[cond.field as keyof PolicyContext],
            matched: true,
          })),
          actions: rule.actions,
        }));

        const constraints = await policyEngine.evaluateBookingConstraints(weddingVenueContext);
        
        expect(constraints.isAllowed).toBe(true); // Not blocked, but permit required
        expect(constraints.requiredDocuments).toHaveLength(1);
        expect(constraints.requiredDocuments[0].documentType).toBe('EVENT_PERMIT');
        expect(constraints.appliedRules).toContain('permit-requirement');

        // Test fee calculation
        const fees = await policyEngine.calculateFees(weddingVenueContext, 120000);
        
        expect(fees.baseFees).toHaveLength(5);
        
        const weddingFee = fees.baseFees.find(f => f.feeType === 'wedding_venue_fee');
        const banquetSurcharge = fees.baseFees.find(f => f.feeType === 'banquet_surcharge');
        const alcoholLicense = fees.baseFees.find(f => f.feeType === 'alcohol_license');
        const capacitySurcharge = fees.baseFees.find(f => f.feeType === 'capacity_surcharge');
        const permitProcessing = fees.baseFees.find(f => f.feeType === 'permit_processing');
        
        expect(weddingFee?.rate).toBe(15);
        expect(weddingFee?.amount).toBe(18000); // 15% of 120,000
        
        expect(banquetSurcharge?.rate).toBe(3);
        expect(banquetSurcharge?.amount).toBe(3600); // 3% of 120,000
        
        expect(alcoholLicense?.amount).toBe(5000);
        expect(capacitySurcharge?.rate).toBe(2);
        expect(capacitySurcharge?.amount).toBe(2400); // 2% of 120,000
        
        expect(permitProcessing?.amount).toBe(1000);
        
        expect(fees.totalFees).toBe(30000); // 18000 + 3600 + 5000 + 2400 + 1000
      });

      it('should apply different policies for corporate vs social events', async () => {
        const corporateEventContext: PolicyContext = {
          locale: 'en',
          country: 'NP',
          state: 'Bagmati',
          city: 'Kathmandu',
          timezone: 'Asia/Kathmandu',
          currency: 'NPR',
          userId: 'user-123',
          userRole: 'RENTER',
          userCountry: 'NP',
          listingId: 'listing-123',
          listingCategory: 'event_venue',
          listingCountry: 'NP',
          listingState: 'Bagmati',
          listingCity: 'Kathmandu',
          bookingValue: 80000,
          bookingDuration: 8,
          bookingCurrency: 'NPR',
          startDate: '2026-04-05',
          endDate: '2026-04-05',
          guestCount: 80,
          hostPresent: false,
          requestTimestamp: new Date().toISOString(),
          evaluationDate: new Date().toISOString(),
          ipCountry: 'NP',
          platform: 'web',
          tenantId: null,
          workspaceConfig: { 
            eventType: 'corporate',
            venueType: 'conference_room',
            maxCapacity: 100,
            hasAVEquipment: true,
            hasWifi: true,
            requiresPermit: false,
            businessLicense: true,
            taxDeductible: true
          },
        };

        const corporatePolicyRules = [
          {
            id: 'corporate-event-base-fee',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'listingCategory', operator: 'eq', value: 'event_venue' },
              { field: 'workspaceConfig.eventType', operator: 'eq', value: 'corporate' },
            ],
            actions: [
              { type: 'SET_RATE' as const, params: { feeType: 'corporate_event_fee', rate: 12, name: 'Corporate Event Fee' } },
            ],
          },
          {
            id: 'conference-room-setup',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'workspaceConfig.venueType', operator: 'eq', value: 'conference_room' },
            ],
            actions: [
              { type: 'SET_FIXED_AMOUNT' as const, params: { feeType: 'conference_setup', amount: 3000, name: 'Conference Room Setup' } },
            ],
          },
          {
            id: 'av-equipment-fee',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'workspaceConfig.hasAVEquipment', operator: 'eq', value: true },
            ],
            actions: [
              { type: 'SET_FIXED_AMOUNT' as const, params: { feeType: 'av_equipment', amount: 2000, name: 'AV Equipment Fee' } },
            ],
          },
          {
            id: 'business-tax-exemption',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'workspaceConfig.businessLicense', operator: 'eq', value: true },
              { field: 'workspaceConfig.taxDeductible', operator: 'eq', value: true },
            ],
            actions: [
              { type: 'SET_RATE' as const, params: { feeType: 'tax_exemption_discount', rate: -2, name: 'Business Tax Exemption Discount' } },
            ],
          },
        ];

        registry.findActiveRules.mockResolvedValue(corporatePolicyRules as any);
        evaluator.evaluateRule.mockImplementation((rule) => ({
          ruleId: rule.id,
          ruleName: rule.actions[0].params.name as string,
          matched: true,
          conditionResults: rule.conditions.map(cond => ({
            field: cond.field,
            operator: cond.operator,
            expected: cond.value,
            actual: cond.field.startsWith('workspaceConfig.') 
              ? corporateEventContext.workspaceConfig[cond.field.replace('workspaceConfig.', '') as keyof typeof corporateEventContext.workspaceConfig]
              : corporateEventContext[cond.field as keyof PolicyContext],
            matched: true,
          })),
          actions: rule.actions,
        }));

        const fees = await policyEngine.calculateFees(corporateEventContext, 80000);
        
        expect(fees.baseFees).toHaveLength(4);
        
        const corporateFee = fees.baseFees.find(f => f.feeType === 'corporate_event_fee');
        const conferenceSetup = fees.baseFees.find(f => f.feeType === 'conference_setup');
        const avEquipment = fees.baseFees.find(f => f.feeType === 'av_equipment');
        const taxExemption = fees.baseFees.find(f => f.feeType === 'tax_exemption_discount');
        
        expect(corporateFee?.rate).toBe(12);
        expect(corporateFee?.amount).toBe(9600); // 12% of 80,000
        
        expect(conferenceSetup?.amount).toBe(3000);
        expect(avEquipment?.amount).toBe(2000);
        
        expect(taxExemption?.rate).toBe(-2);
        expect(taxExemption?.amount).toBe(-1600); // -2% of 80,000
        
        expect(fees.totalFees).toBe(13000); // 9600 + 3000 + 2000 - 1600
      });
    });

    describe('Custom Category Policies', () => {
      it('should apply custom category rules for unique rental types', async () => {
        const photographyStudioContext: PolicyContext = {
          locale: 'en',
          country: 'NP',
          state: 'Bagmati',
          city: 'Kathmandu',
          timezone: 'Asia/Kathmandu',
          currency: 'NPR',
          userId: 'user-123',
          userRole: 'RENTER',
          userCountry: 'NP',
          listingId: 'listing-123',
          listingCategory: 'photography_studio',
          listingCountry: 'NP',
          listingState: 'Bagmati',
          listingCity: 'Kathmandu',
          bookingValue: 15000,
          bookingDuration: 6,
          bookingCurrency: 'NPR',
          startDate: '2026-04-05',
          endDate: '2026-04-05',
          guestCount: 5,
          hostPresent: false,
          requestTimestamp: new Date().toISOString(),
          evaluationDate: new Date().toISOString(),
          ipCountry: 'NP',
          platform: 'web',
          tenantId: null,
          workspaceConfig: { 
            studioType: 'professional',
            hasLightingEquipment: true,
            hasBackdrop: true,
            hasEditingSuite: false,
            commercialUse: true,
            photographerCertified: false
          },
        };

        const customCategoryRules = [
          {
            id: 'photography-studio-base-fee',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'listingCategory', operator: 'eq', value: 'photography_studio' },
            ],
            actions: [
              { type: 'SET_RATE' as const, params: { feeType: 'studio_base_fee', rate: 10, name: 'Photography Studio Base Fee' } },
            ],
          },
          {
            id: 'professional-studio-surcharge',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'workspaceConfig.studioType', operator: 'eq', value: 'professional' },
            ],
            actions: [
              { type: 'SET_RATE' as const, params: { feeType: 'professional_surcharge', rate: 3, name: 'Professional Studio Surcharge' } },
            ],
          },
          {
            id: 'equipment-usage-fees',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'workspaceConfig.hasLightingEquipment', operator: 'eq', value: true },
              { field: 'workspaceConfig.hasBackdrop', operator: 'eq', value: true },
            ],
            actions: [
              { type: 'SET_FIXED_AMOUNT' as const, params: { feeType: 'lighting_equipment', amount: 800, name: 'Lighting Equipment Fee' } },
              { type: 'SET_FIXED_AMOUNT' as const, params: { feeType: 'backdrop_fee', amount: 400, name: 'Backdrop Usage Fee' } },
            ],
          },
          {
            id: 'commercial-use-surcharge',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'workspaceConfig.commercialUse', operator: 'eq', value: true },
            ],
            actions: [
              { type: 'SET_RATE' as const, params: { feeType: 'commercial_surcharge', rate: 5, name: 'Commercial Use Surcharge' } },
            ],
          },
          {
            id: 'photographer-certification-requirement',
            version: 1,
            policyType: 'BOOKING_CONSTRAINT',
            conditions: [
              { field: 'workspaceConfig.commercialUse', operator: 'eq', value: true },
              { field: 'workspaceConfig.photographerCertified', operator: 'eq', value: false },
            ],
            actions: [
              { type: 'REQUIRE_DOCUMENT' as const, params: { documentType: 'PHOTOGRAPHER_CERTIFICATION', label: 'Professional Photographer Certification' } },
              { type: 'SET_FIXED_AMOUNT' as const, params: { feeType: 'certification_verification', amount: 500, name: 'Certification Verification' } },
            ],
          },
        ];

        registry.findActiveRules.mockResolvedValue(customCategoryRules as any);
        evaluator.evaluateRule.mockImplementation((rule) => ({
          ruleId: rule.id,
          ruleName: rule.actions[0].params.name as string,
          matched: true,
          conditionResults: rule.conditions.map(cond => ({
            field: cond.field,
            operator: cond.operator,
            expected: cond.value,
            actual: cond.field.startsWith('workspaceConfig.') 
              ? photographyStudioContext.workspaceConfig[cond.field.replace('workspaceConfig.', '') as keyof typeof photographyStudioContext.workspaceConfig]
              : photographyStudioContext[cond.field as keyof PolicyContext],
            matched: true,
          })),
          actions: rule.actions,
        }));

        const constraints = await policyEngine.evaluateBookingConstraints(photographyStudioContext);
        
        expect(constraints.isAllowed).toBe(true); // Not blocked, but certification required
        expect(constraints.requiredDocuments).toHaveLength(1);
        expect(constraints.requiredDocuments[0].documentType).toBe('PHOTOGRAPHER_CERTIFICATION');
        expect(constraints.appliedRules).toContain('photographer-certification-requirement');

        // Test fee calculation
        const fees = await policyEngine.calculateFees(photographyStudioContext, 15000);
        
        expect(fees.baseFees).toHaveLength(6);
        
        const baseFee = fees.baseFees.find(f => f.feeType === 'studio_base_fee');
        const professionalSurcharge = fees.baseFees.find(f => f.feeType === 'professional_surcharge');
        const lightingEquipment = fees.baseFees.find(f => f.feeType === 'lighting_equipment');
        const backdropFee = fees.baseFees.find(f => f.feeType === 'backdrop_fee');
        const commercialSurcharge = fees.baseFees.find(f => f.feeType === 'commercial_surcharge');
        const certificationVerification = fees.baseFees.find(f => f.feeType === 'certification_verification');
        
        expect(baseFee?.rate).toBe(10);
        expect(baseFee?.amount).toBe(1500); // 10% of 15,000
        
        expect(professionalSurcharge?.rate).toBe(3);
        expect(professionalSurcharge?.amount).toBe(450); // 3% of 15,000
        
        expect(lightingEquipment?.amount).toBe(800);
        expect(backdropFee?.amount).toBe(400);
        
        expect(commercialSurcharge?.rate).toBe(5);
        expect(commercialSurcharge?.amount).toBe(750); // 5% of 15,000
        
        expect(certificationVerification?.amount).toBe(500);
        
        expect(fees.totalFees).toBe(4400); // 1500 + 450 + 800 + 400 + 750 + 500
      });

      it('should handle multiple custom categories with different rules', async () => {
        const artGalleryContext: PolicyContext = {
          locale: 'en',
          country: 'NP',
          state: 'Bagmati',
          city: 'Kathmandu',
          timezone: 'Asia/Kathmandu',
          currency: 'NPR',
          userId: 'user-123',
          userRole: 'RENTER',
          userCountry: 'NP',
          listingId: 'listing-123',
          listingCategory: 'art_gallery',
          listingCountry: 'NP',
          listingState: 'Bagmati',
          listingCity: 'Kathmandu',
          bookingValue: 25000,
          bookingDuration: 48,
          bookingCurrency: 'NPR',
          startDate: '2026-04-05',
          endDate: '2026-04-07',
          guestCount: 30,
          hostPresent: false,
          requestTimestamp: new Date().toISOString(),
          evaluationDate: new Date().toISOString(),
          ipCountry: 'NP',
          platform: 'web',
          tenantId: null,
          workspaceConfig: { 
            galleryType: 'contemporary',
            hasSecurityStaff: true,
            hasInsurance: false,
            artworkValue: 500000,
            publicAccess: true,
            requiresCurator: false
          },
        };

        const artGalleryRules = [
          {
            id: 'art-gallery-base-fee',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'listingCategory', operator: 'eq', value: 'art_gallery' },
            ],
            actions: [
              { type: 'SET_RATE' as const, params: { feeType: 'gallery_base_fee', rate: 8, name: 'Art Gallery Base Fee' } },
            ],
          },
          {
            id: 'contemporary-gallery-surcharge',
            version: 1,
            policyType: 'FEE',
            conditions: [
              { field: 'workspaceConfig.galleryType', operator: 'eq', value: 'contemporary' },
            ],
            actions: [
              { type: 'SET_RATE' as const, params: { feeType: 'contemporary_surcharge', rate: 2, name: 'Contemporary Gallery Surcharge' } },
            ],
          },
          {
            id: 'security-requirements',
            version: 1,
            policyType: 'BOOKING_CONSTRAINT',
            conditions: [
              { field: 'workspaceConfig.artworkValue', operator: 'gt', value: 100000 },
              { field: 'workspaceConfig.hasSecurityStaff', operator: 'eq', value: false },
            ],
            actions: [
              { type: 'REQUIRE_DOCUMENT' as const, params: { documentType: 'SECURITY_PLAN', label: 'Security Plan for High-Value Artwork' } },
              { type: 'SET_FIXED_AMOUNT' as const, params: { feeType: 'security_deposit', amount: 5000, name: 'Security Deposit' } },
            ],
          },
          {
            id: 'artwork-insurance-requirement',
            version: 1,
            policyType: 'BOOKING_CONSTRAINT',
            conditions: [
              { field: 'workspaceConfig.artworkValue', operator: 'gt', value: 250000 },
              { field: 'workspaceConfig.hasInsurance', operator: 'eq', value: false },
            ],
            actions: [
              { type: 'REQUIRE_DOCUMENT' as const, params: { documentType: 'ARTWORK_INSURANCE', label: 'Artwork Insurance Policy', threshold: 600000 } },
              { type: 'SET_RATE' as const, params: { feeType: 'insurance_premium', rate: 1.5, name: 'Artwork Insurance Premium' } },
            ],
          },
        ];

        registry.findActiveRules.mockResolvedValue(artGalleryRules as any);
        evaluator.evaluateRule.mockImplementation((rule) => ({
          ruleId: rule.id,
          ruleName: rule.actions[0].params.name as string,
          matched: true,
          conditionResults: rule.conditions.map(cond => ({
            field: cond.field,
            operator: cond.operator,
            expected: cond.value,
            actual: cond.field.startsWith('workspaceConfig.') 
              ? artGalleryContext.workspaceConfig[cond.field.replace('workspaceConfig.', '') as keyof typeof artGalleryContext.workspaceConfig]
              : artGalleryContext[cond.field as keyof PolicyContext],
            matched: true,
          })),
          actions: rule.actions,
        }));

        const constraints = await policyEngine.evaluateBookingConstraints(artGalleryContext);
        
        expect(constraints.isAllowed).toBe(true); // Has security staff, so not blocked
        expect(constraints.requiredDocuments).toHaveLength(1); // Only insurance required
        expect(constraints.requiredDocuments[0].documentType).toBe('ARTWORK_INSURANCE');
        expect(constraints.appliedRules).toContain('artwork-insurance-requirement');

        // Test fee calculation
        const fees = await policyEngine.calculateFees(artGalleryContext, 25000);
        
        expect(fees.baseFees).toHaveLength(3);
        
        const galleryBaseFee = fees.baseFees.find(f => f.feeType === 'gallery_base_fee');
        const contemporarySurcharge = fees.baseFees.find(f => f.feeType === 'contemporary_surcharge');
        const insurancePremium = fees.baseFees.find(f => f.feeType === 'insurance_premium');
        
        expect(galleryBaseFee?.rate).toBe(8);
        expect(galleryBaseFee?.amount).toBe(2000); // 8% of 25,000
        
        expect(contemporarySurcharge?.rate).toBe(2);
        expect(contemporarySurcharge?.amount).toBe(500); // 2% of 25,000
        
        expect(insurancePremium?.rate).toBe(1.5);
        expect(insurancePremium?.amount).toBe(375); // 1.5% of 25,000
        
        expect(fees.totalFees).toBe(2875); // 2000 + 500 + 375
      });
    });
  });
});

