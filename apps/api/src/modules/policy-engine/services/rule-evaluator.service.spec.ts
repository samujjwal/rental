import { RuleEvaluatorService } from '../services/rule-evaluator.service';
import {
  PolicyContext,
  RuleCondition,
  SerializedPolicyRule,
} from '../interfaces';

describe('RuleEvaluatorService', () => {
  let evaluator: RuleEvaluatorService;

  beforeEach(() => {
    evaluator = new RuleEvaluatorService();
  });

  // ──────────────────────────────────────
  // Helper: build a minimal PolicyContext
  // ──────────────────────────────────────
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

  const buildRule = (overrides: Partial<SerializedPolicyRule> = {}): SerializedPolicyRule => ({
    id: 'rule_test',
    type: 'TAX',
    name: 'Test Rule',
    description: 'A test rule',
    country: 'NP',
    state: null,
    city: null,
    jurisdictionPriority: 1,
    version: 1,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: null,
    supersedesId: null,
    priority: 100,
    conditions: [],
    actions: [{ type: 'SET_RATE', params: { rate: 13, taxType: 'VAT', name: 'Nepal VAT' } }],
    status: 'ACTIVE',
    tags: ['test'],
    metadata: {},
    ...overrides,
  });

  // ──────────────────────────────────────
  // Condition Operators
  // ──────────────────────────────────────

  describe('compare (condition operators)', () => {
    it('eq: matches equal values', () => {
      expect(evaluator.compare('NP', 'eq', 'NP')).toBe(true);
      expect(evaluator.compare('NP', 'eq', 'IN')).toBe(false);
    });

    it('neq: matches unequal values', () => {
      expect(evaluator.compare('NP', 'neq', 'IN')).toBe(true);
      expect(evaluator.compare('NP', 'neq', 'NP')).toBe(false);
    });

    it('gt: greater than', () => {
      expect(evaluator.compare(100, 'gt', 50)).toBe(true);
      expect(evaluator.compare(50, 'gt', 100)).toBe(false);
      expect(evaluator.compare(50, 'gt', 50)).toBe(false);
    });

    it('gte: greater or equal', () => {
      expect(evaluator.compare(100, 'gte', 50)).toBe(true);
      expect(evaluator.compare(50, 'gte', 50)).toBe(true);
      expect(evaluator.compare(49, 'gte', 50)).toBe(false);
    });

    it('lt: less than', () => {
      expect(evaluator.compare(30, 'lt', 50)).toBe(true);
      expect(evaluator.compare(50, 'lt', 50)).toBe(false);
    });

    it('lte: less or equal', () => {
      expect(evaluator.compare(50, 'lte', 50)).toBe(true);
      expect(evaluator.compare(51, 'lte', 50)).toBe(false);
    });

    it('in: value in array', () => {
      expect(evaluator.compare('SPACES', 'in', ['SPACES', 'VEHICLES'])).toBe(true);
      expect(evaluator.compare('TOOLS', 'in', ['SPACES', 'VEHICLES'])).toBe(false);
    });

    it('nin: value not in array', () => {
      expect(evaluator.compare('TOOLS', 'nin', ['SPACES', 'VEHICLES'])).toBe(true);
      expect(evaluator.compare('SPACES', 'nin', ['SPACES', 'VEHICLES'])).toBe(false);
    });

    it('between: value in range (inclusive)', () => {
      expect(evaluator.compare(5000, 'between', [1000, 10000])).toBe(true);
      expect(evaluator.compare(1000, 'between', [1000, 10000])).toBe(true);
      expect(evaluator.compare(10000, 'between', [1000, 10000])).toBe(true);
      expect(evaluator.compare(500, 'between', [1000, 10000])).toBe(false);
      expect(evaluator.compare(100, 'between', [1000, 10000])).toBe(false);
    });

    it('contains: string contains substring', () => {
      expect(evaluator.compare('Kathmandu', 'contains', 'Kath')).toBe(true);
      expect(evaluator.compare('Kathmandu', 'contains', 'xyz')).toBe(false);
    });

    it('startsWith: string starts with prefix', () => {
      expect(evaluator.compare('Kathmandu', 'startsWith', 'Kath')).toBe(true);
      expect(evaluator.compare('Kathmandu', 'startsWith', 'mandu')).toBe(false);
    });

    it('regex: regex pattern match', () => {
      expect(evaluator.compare('Kathmandu', 'regex', '^kath')).toBe(true); // case-insensitive
      expect(evaluator.compare('Kathmandu', 'regex', '^xyz')).toBe(false);
    });

    it('regex: handles invalid regex safely', () => {
      expect(evaluator.compare('test', 'regex', '[invalid')).toBe(false);
    });

    it('exists: field is present and non-null', () => {
      expect(evaluator.compare('value', 'exists', null)).toBe(true);
      expect(evaluator.compare(0, 'exists', null)).toBe(true);
      expect(evaluator.compare(null, 'exists', null)).toBe(false);
      expect(evaluator.compare(undefined, 'exists', null)).toBe(false);
    });

    it('dayOfWeek: matches day of week', () => {
      // 2026-03-06 is a Friday (day 5)
      expect(evaluator.compare('2026-03-06', 'dayOfWeek', [5, 6])).toBe(true);
      // 2026-03-07 is a Saturday (day 6)
      expect(evaluator.compare('2026-03-07', 'dayOfWeek', [5, 6])).toBe(true);
      // 2026-03-09 is a Monday (day 1)
      expect(evaluator.compare('2026-03-09', 'dayOfWeek', [5, 6])).toBe(false);
    });

    it('dateRange: date falls within range', () => {
      expect(evaluator.compare('2026-03-05', 'dateRange', ['2026-03-01', '2026-03-31'])).toBe(true);
      expect(evaluator.compare('2026-04-05', 'dateRange', ['2026-03-01', '2026-03-31'])).toBe(false);
    });

    it('always: always returns true', () => {
      expect(evaluator.compare(null, 'always', null)).toBe(true);
      expect(evaluator.compare(undefined, 'always', undefined)).toBe(true);
    });

    it('returns false for non-numeric gt/gte/lt/lte comparisons', () => {
      expect(evaluator.compare('abc', 'gt', 10)).toBe(false);
      expect(evaluator.compare(10, 'gt', 'abc' as any)).toBe(false);
    });

    it('returns false for unknown operators', () => {
      expect(evaluator.compare('x', 'unknown_op' as any, 'y')).toBe(false);
    });
  });

  // ──────────────────────────────────────
  // Field Resolution
  // ──────────────────────────────────────

  describe('resolveField', () => {
    it('resolves top-level fields', () => {
      const ctx = buildContext({ country: 'IN' });
      expect(evaluator.resolveField('country', ctx)).toBe('IN');
      expect(evaluator.resolveField('bookingValue', ctx)).toBe(15000);
    });

    it('resolves nested fields via dot notation', () => {
      const ctx = buildContext({ workspaceConfig: { maxListings: 100 } });
      expect(evaluator.resolveField('workspaceConfig.maxListings', ctx)).toBe(100);
    });

    it('returns undefined for missing fields', () => {
      const ctx = buildContext();
      expect(evaluator.resolveField('nonExistentField', ctx)).toBeUndefined();
      expect(evaluator.resolveField('workspaceConfig.deep.missing', ctx)).toBeUndefined();
    });

    it('handles null gracefully in nested path', () => {
      const ctx = buildContext({ listingState: null });
      expect(evaluator.resolveField('listingState', ctx)).toBeNull();
    });
  });

  // ──────────────────────────────────────
  // Single Condition Evaluation
  // ──────────────────────────────────────

  describe('evaluateCondition', () => {
    it('evaluates a matching condition', () => {
      const ctx = buildContext({ country: 'NP' });
      const condition: RuleCondition = { field: 'country', operator: 'eq', value: 'NP' };
      const result = evaluator.evaluateCondition(condition, ctx);
      expect(result.matched).toBe(true);
      expect(result.actual).toBe('NP');
      expect(result.expected).toBe('NP');
    });

    it('evaluates a non-matching condition', () => {
      const ctx = buildContext({ country: 'IN' });
      const condition: RuleCondition = { field: 'country', operator: 'eq', value: 'NP' };
      const result = evaluator.evaluateCondition(condition, ctx);
      expect(result.matched).toBe(false);
    });

    it('negates a condition when negate=true', () => {
      const ctx = buildContext({ country: 'IN' });
      const condition: RuleCondition = { field: 'country', operator: 'eq', value: 'NP', negate: true };
      const result = evaluator.evaluateCondition(condition, ctx);
      expect(result.matched).toBe(true); // NOT eq NP → true when country=IN
    });

    it('evaluates booking value range condition', () => {
      const ctx = buildContext({ bookingValue: 25000 });
      const condition: RuleCondition = {
        field: 'bookingValue',
        operator: 'between',
        value: [5000, 50000],
      };
      const result = evaluator.evaluateCondition(condition, ctx);
      expect(result.matched).toBe(true);
    });
  });

  // ──────────────────────────────────────
  // Full Rule Evaluation
  // ──────────────────────────────────────

  describe('evaluateRule', () => {
    it('matches rule with no conditions (always-match)', () => {
      const rule = buildRule({ conditions: [] });
      const ctx = buildContext();
      const result = evaluator.evaluateRule(rule, ctx);
      expect(result.matched).toBe(true);
      expect(result.actions).toHaveLength(1);
    });

    it('matches rule when ALL conditions pass', () => {
      const rule = buildRule({
        conditions: [
          { field: 'country', operator: 'eq', value: 'NP' },
          { field: 'listingCategory', operator: 'in', value: ['SPACES', 'EVENT_VENUES'] },
        ],
      });
      const ctx = buildContext({ country: 'NP', listingCategory: 'SPACES' });
      const result = evaluator.evaluateRule(rule, ctx);
      expect(result.matched).toBe(true);
      expect(result.conditionResults).toHaveLength(2);
      expect(result.conditionResults.every((c) => c.matched)).toBe(true);
    });

    it('rejects rule when ANY condition fails', () => {
      const rule = buildRule({
        conditions: [
          { field: 'country', operator: 'eq', value: 'NP' },
          { field: 'bookingValue', operator: 'gt', value: 100000 }, // Fails: 15000 < 100000
        ],
      });
      const ctx = buildContext({ country: 'NP', bookingValue: 15000 });
      const result = evaluator.evaluateRule(rule, ctx);
      expect(result.matched).toBe(false);
      expect(result.actions).toHaveLength(0); // No actions if not matched
    });

    it('matches Nepal VAT rule correctly', () => {
      const nepalVatRule = buildRule({
        id: 'rule_np_vat_13',
        name: 'Nepal Standard VAT',
        conditions: [{ field: 'country', operator: 'eq', value: 'NP' }],
        actions: [
          {
            type: 'SET_RATE',
            params: { taxType: 'VAT', name: 'Nepal VAT', rate: 13.0, jurisdiction: 'Nepal' },
          },
        ],
      });

      const nepalCtx = buildContext({ country: 'NP' });
      expect(evaluator.evaluateRule(nepalVatRule, nepalCtx).matched).toBe(true);

      const indiaCtx = buildContext({ country: 'IN' });
      expect(evaluator.evaluateRule(nepalVatRule, indiaCtx).matched).toBe(false);
    });

    it('matches India GST rule with booking value threshold', () => {
      const indiaGstRule = buildRule({
        id: 'rule_in_gst_18',
        type: 'TAX',
        name: 'India GST 18%',
        conditions: [
          { field: 'country', operator: 'eq', value: 'IN' },
          { field: 'bookingValue', operator: 'lte', value: 100000 },
        ],
        actions: [
          { type: 'SET_RATE', params: { taxType: 'GST', name: 'CGST', rate: 9.0, jurisdiction: 'Central' } },
          { type: 'SET_RATE', params: { taxType: 'GST', name: 'SGST', rate: 9.0, jurisdiction: 'State' } },
        ],
      });

      // Under threshold
      const ctx = buildContext({ country: 'IN', bookingValue: 50000 });
      const result = evaluator.evaluateRule(indiaGstRule, ctx);
      expect(result.matched).toBe(true);
      expect(result.actions).toHaveLength(2);

      // Over threshold
      const ctxHigh = buildContext({ country: 'IN', bookingValue: 200000 });
      expect(evaluator.evaluateRule(indiaGstRule, ctxHigh).matched).toBe(false);
    });

    it('matches weekend pricing rule (dayOfWeek)', () => {
      const weekendRule = buildRule({
        type: 'PRICING',
        name: 'Weekend Surcharge',
        conditions: [
          { field: 'country', operator: 'eq', value: 'NP' },
          { field: 'startDate', operator: 'dayOfWeek', value: [5, 6] }, // Friday, Saturday
          { field: 'listingCategory', operator: 'in', value: ['SPACES', 'EVENT_VENUES'] },
        ],
        actions: [{ type: 'SET_MULTIPLIER', params: { multiplier: 1.2 } }],
      });

      // Friday start
      const fridayCtx = buildContext({
        country: 'NP',
        startDate: '2026-03-06', // Friday
        listingCategory: 'SPACES',
      });
      expect(evaluator.evaluateRule(weekendRule, fridayCtx).matched).toBe(true);

      // Monday start — should NOT match
      const mondayCtx = buildContext({
        country: 'NP',
        startDate: '2026-03-09', // Monday
        listingCategory: 'SPACES',
      });
      expect(evaluator.evaluateRule(weekendRule, mondayCtx).matched).toBe(false);
    });

    it('matches NYC booking constraint rule', () => {
      const nycRule = buildRule({
        type: 'BOOKING_CONSTRAINT',
        name: 'NYC Short-Term Restriction',
        conditions: [
          { field: 'country', operator: 'eq', value: 'US' },
          { field: 'state', operator: 'eq', value: 'NY' },
          { field: 'city', operator: 'eq', value: 'New York' },
          { field: 'bookingDuration', operator: 'lt', value: 30 },
          { field: 'hostPresent', operator: 'eq', value: false },
        ],
        actions: [
          {
            type: 'BLOCK',
            params: { reason: 'NYC Local Law 18 prohibits short-term rentals (<30 days) without host present' },
          },
        ],
      });

      // Short-term, no host — blocked
      const blockedCtx = buildContext({
        country: 'US',
        state: 'NY',
        city: 'New York',
        bookingDuration: 5,
        hostPresent: false,
      });
      const blocked = evaluator.evaluateRule(nycRule, blockedCtx);
      expect(blocked.matched).toBe(true);
      expect(blocked.actions[0].type).toBe('BLOCK');

      // Long-term — allowed
      const allowedCtx = buildContext({
        country: 'US',
        state: 'NY',
        city: 'New York',
        bookingDuration: 45,
        hostPresent: false,
      });
      expect(evaluator.evaluateRule(nycRule, allowedCtx).matched).toBe(false);

      // Short-term with host present — allowed
      const hostCtx = buildContext({
        country: 'US',
        state: 'NY',
        city: 'New York',
        bookingDuration: 5,
        hostPresent: true,
      });
      expect(evaluator.evaluateRule(nycRule, hostCtx).matched).toBe(false);
    });

    it('matches Dashain festival date range', () => {
      const dashainRule = buildRule({
        type: 'PRICING',
        name: 'Dashain Surcharge 2026',
        conditions: [
          { field: 'country', operator: 'eq', value: 'NP' },
          { field: 'startDate', operator: 'dateRange', value: ['2026-10-02', '2026-10-16'] },
        ],
        actions: [{ type: 'SET_MULTIPLIER', params: { multiplier: 1.5 } }],
      });

      // During Dashain
      const dashainCtx = buildContext({ country: 'NP', startDate: '2026-10-10' });
      expect(evaluator.evaluateRule(dashainRule, dashainCtx).matched).toBe(true);

      // Outside Dashain
      const normalCtx = buildContext({ country: 'NP', startDate: '2026-11-10' });
      expect(evaluator.evaluateRule(dashainRule, normalCtx).matched).toBe(false);
    });

    it('matches identity requirement rule', () => {
      const idRule = buildRule({
        type: 'IDENTITY',
        name: 'Nepal Owner Citizenship Requirement',
        conditions: [
          { field: 'country', operator: 'eq', value: 'NP' },
          { field: 'userRole', operator: 'eq', value: 'OWNER' },
        ],
        actions: [
          { type: 'REQUIRE_DOCUMENT', params: { documentType: 'CITIZENSHIP', label: 'Citizenship Certificate' } },
        ],
      });

      const ownerCtx = buildContext({ country: 'NP', userRole: 'OWNER' });
      expect(evaluator.evaluateRule(idRule, ownerCtx).matched).toBe(true);

      const renterCtx = buildContext({ country: 'NP', userRole: 'RENTER' });
      expect(evaluator.evaluateRule(idRule, renterCtx).matched).toBe(false);
    });
  });
});
