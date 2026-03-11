import { FilterBuilderService, FilterCondition, FilterGroup } from './filter-builder.service';

describe('FilterBuilderService', () => {
  let service: FilterBuilderService;

  beforeEach(() => {
    service = new FilterBuilderService();
  });

  describe('buildWhereClause', () => {
    it('returns empty object for null/undefined', () => {
      expect(service.buildWhereClause(null as any)).toEqual({});
      expect(service.buildWhereClause(undefined as any)).toEqual({});
    });

    it('returns empty object for empty array', () => {
      expect(service.buildWhereClause([])).toEqual({});
    });

    it('returns single filter without AND wrapper', () => {
      const filters: FilterCondition[] = [
        { field: 'email', operator: 'eq', value: 'test@example.com' },
      ];
      expect(service.buildWhereClause(filters)).toEqual({ email: 'test@example.com' });
    });

    it('wraps multiple filters in AND', () => {
      const filters: FilterCondition[] = [
        { field: 'email', operator: 'eq', value: 'test@example.com' },
        { field: 'status', operator: 'eq', value: 'ACTIVE' },
      ];
      const result = service.buildWhereClause(filters);
      expect(result.AND).toHaveLength(2);
      expect(result.AND[0]).toEqual({ email: 'test@example.com' });
      expect(result.AND[1]).toEqual({ status: 'ACTIVE' });
    });

    // ── Operator tests ──────────────────────────────────────────────────

    it.each<[FilterCondition['operator'], any, any]>([
      ['eq', 42, { price: 42 }],
      ['neq', 'DRAFT', { status: { not: 'DRAFT' } }],
      ['gt', 100, { price: { gt: 100 } }],
      ['gte', 100, { price: { gte: 100 } }],
      ['lt', 50, { price: { lt: 50 } }],
      ['lte', 50, { price: { lte: 50 } }],
      ['contains', 'kathmandu', { city: { contains: 'kathmandu', mode: 'insensitive' } }],
      ['startsWith', 'Ram', { name: { startsWith: 'Ram', mode: 'insensitive' } }],
      ['endsWith', 'pur', { city: { endsWith: 'pur', mode: 'insensitive' } }],
    ])('operator %s produces correct Prisma clause', (operator, value, expected) => {
      const field = Object.keys(expected)[0];
      const result = service.buildWhereClause([{ field, operator, value }]);
      expect(result).toEqual(expected);
    });

    it('operator "in" uses values array', () => {
      const result = service.buildWhereClause([
        { field: 'role', operator: 'in', values: ['ADMIN', 'USER'] },
      ]);
      expect(result).toEqual({ role: { in: ['ADMIN', 'USER'] } });
    });

    it('operator "in" falls back to [value] when values missing', () => {
      const result = service.buildWhereClause([
        { field: 'role', operator: 'in', value: 'ADMIN' },
      ]);
      expect(result).toEqual({ role: { in: ['ADMIN'] } });
    });

    it('operator "not_in" uses values array', () => {
      const result = service.buildWhereClause([
        { field: 'status', operator: 'not_in', values: ['CANCELLED', 'REFUNDED'] },
      ]);
      expect(result).toEqual({ status: { notIn: ['CANCELLED', 'REFUNDED'] } });
    });

    it('operator "between" with valid 2-element array', () => {
      const result = service.buildWhereClause([
        { field: 'price', operator: 'between', value: [100, 500] },
      ]);
      expect(result).toEqual({ price: { gte: 100, lte: 500 } });
    });

    it('operator "between" throws for non-array or wrong length', () => {
      expect(() =>
        service.buildWhereClause([{ field: 'price', operator: 'between', value: 100 }]),
      ).toThrow('BETWEEN operator requires array with exactly 2 values');

      expect(() =>
        service.buildWhereClause([{ field: 'price', operator: 'between', value: [1] }]),
      ).toThrow();
    });

    it('operator "not_between" produces OR clause', () => {
      const result = service.buildWhereClause([
        { field: 'price', operator: 'not_between', value: [100, 500] },
      ]);
      expect(result).toEqual({
        OR: [{ price: { lt: 100 } }, { price: { gt: 500 } }],
      });
    });

    it('operator "not_between" throws for invalid value', () => {
      expect(() =>
        service.buildWhereClause([{ field: 'price', operator: 'not_between', value: 'bad' }]),
      ).toThrow('NOT_BETWEEN operator requires array with exactly 2 values');
    });

    it('operator "is_null" produces null check', () => {
      const result = service.buildWhereClause([
        { field: 'deletedAt', operator: 'is_null' },
      ]);
      expect(result).toEqual({ deletedAt: null });
    });

    it('operator "is_not_null" produces not-null check', () => {
      const result = service.buildWhereClause([
        { field: 'stripeId', operator: 'is_not_null' },
      ]);
      expect(result).toEqual({ stripeId: { not: null } });
    });

    it('unsupported operator throws', () => {
      expect(() =>
        service.buildWhereClause([
          { field: 'status', operator: 'BOGUS' as any, value: 1 },
        ]),
      ).toThrow('Unsupported operator');
    });

    // ── FilterGroup tests ────────────────────────────────────────────────

    it('handles FilterGroup with AND', () => {
      const group: FilterGroup = {
        and: [
          { field: 'status', operator: 'eq', value: 'ACTIVE' },
          { field: 'price', operator: 'gt', value: 0 },
        ],
      };
      const result = service.buildWhereClause(group);
      expect(result.AND).toHaveLength(2);
    });

    it('handles FilterGroup with OR', () => {
      const group: FilterGroup = {
        or: [
          { field: 'city', operator: 'eq', value: 'Kathmandu' },
          { field: 'city', operator: 'eq', value: 'Pokhara' },
        ],
      };
      const result = service.buildWhereClause(group);
      expect(result.OR).toHaveLength(2);
    });

    it('handles FilterGroup with both AND and OR', () => {
      const group: FilterGroup = {
        and: [{ field: 'status', operator: 'eq', value: 'ACTIVE' }],
        or: [{ field: 'city', operator: 'eq', value: 'Kathmandu' }],
      };
      const result = service.buildWhereClause(group);
      expect(result.AND).toHaveLength(1);
      expect(result.OR).toHaveLength(1);
    });

    it('empty FilterGroup returns empty object', () => {
      const group: FilterGroup = { and: [], or: [] };
      expect(service.buildWhereClause(group)).toEqual({});
    });
  });

  describe('parseFrontendFilters', () => {
    it('returns empty array for null/undefined', () => {
      expect(service.parseFrontendFilters(null as any)).toEqual([]);
      expect(service.parseFrontendFilters(undefined as any)).toEqual([]);
    });

    it('returns empty array for non-array input', () => {
      expect(service.parseFrontendFilters('bad' as any)).toEqual([]);
    });

    it('maps frontend operator names to backend', () => {
      const input = [
        { field: 'email', operator: 'equals', value: 'a@b.com' },
        { field: 'name', operator: 'contains', value: 'Sam' },
        { field: 'price', operator: 'greater_than', value: 100 },
        { field: 'price', operator: 'less_than_equal', value: 500 },
        { field: 'role', operator: 'in', values: ['ADMIN'] },
        { field: 'del', operator: 'is_null' },
      ];
      const result = service.parseFrontendFilters(input);
      expect(result).toEqual([
        { field: 'email', operator: 'eq', value: 'a@b.com', values: undefined },
        { field: 'name', operator: 'contains', value: 'Sam', values: undefined },
        { field: 'price', operator: 'gt', value: 100, values: undefined },
        { field: 'price', operator: 'lte', value: 500, values: undefined },
        { field: 'role', operator: 'in', value: undefined, values: ['ADMIN'] },
        { field: 'del', operator: 'is_null', value: undefined, values: undefined },
      ]);
    });

    it('defaults unknown frontend operators to "eq"', () => {
      const result = service.parseFrontendFilters([
        { field: 'x', operator: 'unknown_op', value: 1 },
      ]);
      expect(result[0].operator).toBe('eq');
    });
  });
});
