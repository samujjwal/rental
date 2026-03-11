import { Test, TestingModule } from '@nestjs/testing';
import { PolicyAuditService } from './policy-audit.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { PolicyContext, PolicyDecision } from '../interfaces';

describe('PolicyAuditService', () => {
  let module: TestingModule;
  let service: PolicyAuditService;
  let prisma: { policyAuditLog: { create: jest.Mock } };

  const buildContext = (): PolicyContext => ({
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
  });

  const buildDecision = (matched: boolean = true): PolicyDecision => ({
    policyType: 'TAX',
    matched,
    appliedRules: matched
      ? [
          {
            ruleId: 'rule_np_vat_13',
            ruleName: 'Nepal Standard VAT',
            matched: true,
            conditionResults: [
              { field: 'country', operator: 'eq', expected: 'NP', actual: 'NP', matched: true },
            ],
            actions: [{ type: 'SET_RATE', params: { rate: 13 } }],
          },
        ]
      : [],
    eliminatedRules: matched
      ? []
      : [
          {
            ruleId: 'rule_in_gst',
            ruleName: 'India GST',
            matched: false,
            conditionResults: [
              { field: 'country', operator: 'eq', expected: 'IN', actual: 'NP', matched: false },
            ],
            actions: [],
          },
        ],
    actions: matched ? [{ type: 'SET_RATE', params: { rate: 13 } }] : [],
    evaluationMs: 1.5,
    fallbackUsed: !matched,
  });

  beforeEach(async () => {
    prisma = {
      policyAuditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit_1' }),
      },
    };

    module = await Test.createTestingModule({
      providers: [
        PolicyAuditService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PolicyAuditService>(PolicyAuditService);
  });

  afterAll(async () => {
    if (module) await module.close();
  });

  describe('logDecision', () => {
    it('writes an audit log entry asynchronously', async () => {
      const ctx = buildContext();
      const decision = buildDecision(true);

      service.logDecision('TAX', ctx, decision, 'BOOKING', 'bkg_1', 'req_1');

      // Wait for the async fire-and-forget to complete
      await new Promise((r) => setTimeout(r, 50));

      expect(prisma.policyAuditLog.create).toHaveBeenCalledTimes(1);
      const arg = prisma.policyAuditLog.create.mock.calls[0][0].data;

      expect(arg.policyType).toBe('TAX');
      expect(arg.contextHash).toBeTruthy();
      expect(arg.contextHash.length).toBe(64);
      expect(arg.matchedRules).toEqual(['rule_np_vat_13']);
      expect(arg.candidateRules).toContain('rule_np_vat_13');
      expect(arg.userId).toBe('user_1');
      expect(arg.entityType).toBe('BOOKING');
      expect(arg.entityId).toBe('bkg_1');
      expect(arg.requestId).toBe('req_1');
      expect(arg.evaluationMs).toBe(1.5);
      expect(arg.policyRuleId).toBe('rule_np_vat_13');
    });

    it('handles eliminated rules in audit', async () => {
      const ctx = buildContext();
      const decision = buildDecision(false);

      service.logDecision('TAX', ctx, decision);
      await new Promise((r) => setTimeout(r, 50));

      expect(prisma.policyAuditLog.create).toHaveBeenCalledTimes(1);
      const arg = prisma.policyAuditLog.create.mock.calls[0][0].data;

      expect(arg.matchedRules).toEqual([]);
      expect(arg.candidateRules).toContain('rule_in_gst');
      expect(arg.policyRuleId).toBeNull();
    });

    it('sanitizes context (removes PII)', async () => {
      const ctx = buildContext();
      const decision = buildDecision(true);

      service.logDecision('TAX', ctx, decision);
      await new Promise((r) => setTimeout(r, 50));

      const arg = prisma.policyAuditLog.create.mock.calls[0][0].data;
      const context = arg.context;

      // Should include policy-relevant fields
      expect(context.country).toBe('NP');
      expect(context.currency).toBe('NPR');
      expect(context.listingCategory).toBe('SPACES');

      // Should NOT include PII
      expect(context.userId).toBeUndefined();
      expect(context.listingId).toBeUndefined();
    });

    it('generates explanation for matched decision', async () => {
      const ctx = buildContext();
      const decision = buildDecision(true);

      service.logDecision('TAX', ctx, decision);
      await new Promise((r) => setTimeout(r, 50));

      const arg = prisma.policyAuditLog.create.mock.calls[0][0].data;
      expect(arg.explanation).toContain('TAX evaluated');
      expect(arg.explanation).toContain('1 rule(s) matched');
      expect(arg.explanation).toContain('Nepal Standard VAT');
    });

    it('generates explanation for no-match decision', async () => {
      const ctx = buildContext();
      const decision = buildDecision(false);

      service.logDecision('TAX', ctx, decision);
      await new Promise((r) => setTimeout(r, 50));

      const arg = prisma.policyAuditLog.create.mock.calls[0][0].data;
      expect(arg.explanation).toContain('No TAX rules matched');
      expect(arg.explanation).toContain('Fallback rule applied');
    });

    it('does not throw when prisma write fails', async () => {
      prisma.policyAuditLog.create.mockRejectedValue(new Error('DB down'));
      const ctx = buildContext();
      const decision = buildDecision(true);

      // Should not throw
      expect(() => {
        service.logDecision('TAX', ctx, decision);
      }).not.toThrow();

      await new Promise((r) => setTimeout(r, 50));
      // Just verify it was called (and failed silently)
      expect(prisma.policyAuditLog.create).toHaveBeenCalledTimes(1);
    });
  });
});
