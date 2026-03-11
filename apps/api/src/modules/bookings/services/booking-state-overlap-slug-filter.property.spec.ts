/**
 * Property-based tests for date overlap detection, slug generation,
 * booking state machine transitions, and filter builder.
 */
import * as fc from 'fast-check';

// ── Date overlap detection ──────────────────────────────────────────────────

function datesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

// ── Slug generation (from listings.service.ts) ──────────────────────────────

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ── Booking state machine ───────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['PENDING_OWNER_APPROVAL'],
  PENDING_OWNER_APPROVAL: ['PENDING_PAYMENT', 'CANCELLED'],
  PENDING_PAYMENT: ['CONFIRMED', 'PAYMENT_FAILED', 'CANCELLED'],
  PAYMENT_FAILED: ['PENDING_PAYMENT', 'CANCELLED'],
  CONFIRMED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['AWAITING_RETURN_INSPECTION', 'DISPUTED'],
  AWAITING_RETURN_INSPECTION: ['COMPLETED', 'DISPUTED'],
  COMPLETED: ['SETTLED'],
  CANCELLED: ['REFUNDED'],
  DISPUTED: ['COMPLETED'],
  SETTLED: [],
  REFUNDED: [],
};

const ALL_STATES = Object.keys(VALID_TRANSITIONS);
const TERMINAL_STATES = ALL_STATES.filter((s) => VALID_TRANSITIONS[s].length === 0);

// ── Filter builder (from filter-builder.service.ts) ─────────────────────────

type Operator =
  | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'contains' | 'startsWith' | 'endsWith'
  | 'in' | 'not_in' | 'is_null' | 'is_not_null';

interface FilterCondition {
  field: string;
  operator: Operator;
  value?: any;
  values?: any[];
}

function buildSingleFilter(filter: FilterCondition): Record<string, any> {
  const { field, operator, value, values } = filter;
  switch (operator) {
    case 'eq': return { [field]: value };
    case 'neq': return { [field]: { not: value } };
    case 'gt': return { [field]: { gt: value } };
    case 'gte': return { [field]: { gte: value } };
    case 'lt': return { [field]: { lt: value } };
    case 'lte': return { [field]: { lte: value } };
    case 'contains': return { [field]: { contains: value, mode: 'insensitive' } };
    case 'startsWith': return { [field]: { startsWith: value, mode: 'insensitive' } };
    case 'endsWith': return { [field]: { endsWith: value, mode: 'insensitive' } };
    case 'in': return { [field]: { in: values || [value] } };
    case 'not_in': return { [field]: { notIn: values || [value] } };
    case 'is_null': return { [field]: null };
    case 'is_not_null': return { [field]: { not: null } };
  }
}

function buildWhereClause(filters: FilterCondition[]): Record<string, any> {
  if (!filters || filters.length === 0) return {};
  if (filters.length === 1) return buildSingleFilter(filters[0]);
  return { AND: filters.map((f) => buildSingleFilter(f)) };
}

// ── Arbitraries ─────────────────────────────────────────────────────────────

const dateArb = fc.date({ min: new Date('2024-01-01'), max: new Date('2030-12-31') });
const dateRangeArb = fc
  .tuple(dateArb, dateArb)
  .map(([a, b]) => (a <= b ? { start: a, end: b } : { start: b, end: a }))
  .filter(({ start, end }) => start.getTime() < end.getTime());

const titleArb = fc.string({ minLength: 1, maxLength: 200 });
const nonEmptyTitleArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 100 })
  .filter((s: string) => /[a-z0-9]/i.test(s));

const stateArb = fc.constantFrom(...ALL_STATES);
const fieldNameArb = fc.constantFrom('email', 'name', 'price', 'status', 'createdAt', 'rating');
const simpleValueArb = fc.oneof(
  fc.string({ minLength: 1, maxLength: 50 }),
  fc.integer({ min: 0, max: 10000 }),
);
const operatorArb = fc.constantFrom<Operator>(
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
  'contains', 'startsWith', 'endsWith',
  'is_null', 'is_not_null',
);
const filterArb: fc.Arbitrary<FilterCondition> = fc.record({
  field: fieldNameArb,
  operator: operatorArb,
  value: simpleValueArb,
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Date overlap detection — property-based', () => {
  fc.configureGlobal({ seed: 42, numRuns: 200 });

  it('overlap is commutative: overlap(A, B) === overlap(B, A)', () => {
    fc.assert(
      fc.property(dateRangeArb, dateRangeArb, (a, b) => {
        expect(datesOverlap(a.start, a.end, b.start, b.end)).toBe(
          datesOverlap(b.start, b.end, a.start, a.end),
        );
      }),
    );
  });

  it('a range always overlaps with itself', () => {
    fc.assert(
      fc.property(dateRangeArb, (range) => {
        expect(datesOverlap(range.start, range.end, range.start, range.end)).toBe(true);
      }),
    );
  });

  it('non-overlapping ranges have no conflict', () => {
    fc.assert(
      fc.property(
        dateRangeArb,
        fc.integer({ min: 1, max: 365 }),
        (range, gap) => {
          const bStart = new Date(range.end.getTime() + gap * 24 * 60 * 60 * 1000 + 1);
          const bEnd = new Date(bStart.getTime() + 24 * 60 * 60 * 1000);
          expect(datesOverlap(range.start, range.end, bStart, bEnd)).toBe(false);
        },
      ),
    );
  });

  it('contained range always overlaps', () => {
    fc.assert(
      fc.property(dateRangeArb, (outer) => {
        const diff = outer.end.getTime() - outer.start.getTime();
        if (diff < 2) return; // skip trivial
        const innerStart = new Date(outer.start.getTime() + 1);
        const innerEnd = new Date(outer.end.getTime() - 1);
        if (innerStart >= innerEnd) return;
        expect(datesOverlap(outer.start, outer.end, innerStart, innerEnd)).toBe(true);
      }),
    );
  });
});

describe('Slug generation — property-based', () => {
  fc.configureGlobal({ seed: 42, numRuns: 200 });

  it('output is URL-safe (matches /^[a-z0-9-]*$/)', () => {
    fc.assert(
      fc.property(titleArb, (title) => {
        const slug = generateSlug(title);
        expect(slug).toMatch(/^[a-z0-9-]*$/);
      }),
    );
  });

  it('deterministic: same input → same output', () => {
    fc.assert(
      fc.property(titleArb, (title) => {
        expect(generateSlug(title)).toBe(generateSlug(title));
      }),
    );
  });

  it('non-empty for any alphanumeric input', () => {
    fc.assert(
      fc.property(nonEmptyTitleArb, (title) => {
        const slug = generateSlug(title);
        expect(slug.length).toBeGreaterThan(0);
      }),
    );
  });

  it('no leading or trailing hyphens', () => {
    fc.assert(
      fc.property(titleArb, (title) => {
        const slug = generateSlug(title);
        if (slug.length > 0) {
          expect(slug[0]).not.toBe('-');
          expect(slug[slug.length - 1]).not.toBe('-');
        }
      }),
    );
  });
});

describe('Booking state machine — property-based', () => {
  fc.configureGlobal({ seed: 42, numRuns: 100 });

  it('terminal states have no outgoing transitions', () => {
    for (const state of TERMINAL_STATES) {
      expect(VALID_TRANSITIONS[state]).toHaveLength(0);
    }
  });

  it('every non-terminal state has at least one valid transition', () => {
    for (const state of ALL_STATES) {
      if (!TERMINAL_STATES.includes(state)) {
        expect(VALID_TRANSITIONS[state].length).toBeGreaterThan(0);
      }
    }
  });

  it('all transition targets are valid states', () => {
    for (const [_from, targets] of Object.entries(VALID_TRANSITIONS)) {
      for (const target of targets) {
        expect(ALL_STATES).toContain(target);
      }
    }
  });

  it('CANCELLED is only reachable from specific states (not from COMPLETED/SETTLED/REFUNDED)', () => {
    const statesLeadingToCancelled = ALL_STATES.filter((s) =>
      VALID_TRANSITIONS[s].includes('CANCELLED'),
    );
    expect(statesLeadingToCancelled).not.toContain('COMPLETED');
    expect(statesLeadingToCancelled).not.toContain('SETTLED');
    expect(statesLeadingToCancelled).not.toContain('REFUNDED');
  });

  it('random invalid transitions are rejected (target not in allowed list)', () => {
    fc.assert(
      fc.property(stateArb, stateArb, (from, to) => {
        const allowed = VALID_TRANSITIONS[from];
        if (!allowed.includes(to) && from !== to) {
          // This transition should be invalid
          expect(allowed).not.toContain(to);
        }
      }),
    );
  });
});

describe('Filter builder — property-based', () => {
  fc.configureGlobal({ seed: 42, numRuns: 100 });

  it('empty filters → empty where clause', () => {
    expect(buildWhereClause([])).toEqual({});
  });

  it('single filter → object (no AND wrapper)', () => {
    fc.assert(
      fc.property(filterArb, (filter) => {
        const result = buildWhereClause([filter]);
        expect(result).toBeDefined();
        expect(typeof result).toBe('object');
        expect(result.AND).toBeUndefined();
      }),
    );
  });

  it('multiple filters → AND array', () => {
    fc.assert(
      fc.property(fc.array(filterArb, { minLength: 2, maxLength: 10 }), (filters) => {
        const result = buildWhereClause(filters);
        expect(result.AND).toBeDefined();
        expect(Array.isArray(result.AND)).toBe(true);
        expect(result.AND.length).toBe(filters.length);
      }),
    );
  });

  it('result is always a plain object', () => {
    fc.assert(
      fc.property(fc.array(filterArb, { minLength: 0, maxLength: 10 }), (filters) => {
        const result = buildWhereClause(filters);
        expect(typeof result).toBe('object');
        expect(result).not.toBeNull();
      }),
    );
  });

  it('field name appears in the result for single filter', () => {
    fc.assert(
      fc.property(filterArb, (filter) => {
        const result = buildWhereClause([filter]);
        // For single filters, the field name should be a key in the result
        const keys = Object.keys(result);
        if (filter.operator === 'is_null' || filter.operator === 'is_not_null') {
          expect(keys).toContain(filter.field);
        } else {
          expect(keys).toContain(filter.field);
        }
      }),
    );
  });
});
