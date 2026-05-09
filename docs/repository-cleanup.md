# Repository Cleanup Plan

This document tracks cleanup tasks for the repository to maintain code quality.

## Commented Production Code

### Found TODO Comments
- `apps/api/src/modules/currency/services/multi-currency.spec.ts:535` - TODO: Implement competitive pricing strategy logic
- `apps/api/src/modules/bookings/services/booking-pricing-logic-correctness.spec.ts:108` - TODO: Add validation to reject negative base prices
- `apps/api/src/common/audit/audit-archival.service.ts:128` - Comment about S3 key organization (keep as documentation)
- `apps/api/src/security/sql-injection.spec.ts` - Multiple TODO comments about SQL injection middleware not implemented (keep as test documentation)

### Action Items
- [ ] Implement competitive pricing strategy logic or remove TODO comment
- [ ] Add validation for negative base prices or remove TODO comment
- [ ] Keep S3 key organization comment as documentation
- [ ] Keep SQL injection TODO comments as test documentation (these are test markers, not production code)

## Stale Tests

### Tests to Review
- Review test files that reference deprecated models
- Review test files that mock removed functionality
- Review test files that use old API contracts

### Action Items
- [ ] Scan for tests referencing deprecated models (e.g., old Availability model)
- [ ] Update tests to use canonical models (AvailabilitySlot)
- [ ] Remove tests for removed features

## Deprecated Fields After Migration

### Migrations Completed
- `idempotency_records` table added (migration: 20250109_add_idempotency_records)
- `booking_outbox` table added (migration: 20250109_add_booking_outbox)
- `quote_snapshots` table added (migration: 20250109_add_quote_snapshots)

### Fields to Review
- Review for fields that were marked as deprecated but not removed
- Review for fields that reference old models
- Review for unused enum values

### Action Items
- [ ] Check schema for @deprecated fields
- [ ] Remove @deprecated fields after migration verification
- [ ] Update code to not use deprecated fields

## Archived Docs

### Documentation Review
- Check for docs marked as "archived" but still referenced
- Check for docs that reference removed features
- Check for docs with outdated information

### Action Items
- [ ] Search for references to archived docs
- [ ] Update or remove archived docs
- [ ] Update cross-references in active docs

## Cleanup Status

**Completed:**
- None yet

**In Progress:**
- Scanning for TODO comments

**Pending:**
- Implement or resolve TODO comments
- Review and update stale tests
- Remove deprecated fields
- Clean up archived docs

## Next Steps

1. Address TODO comments in production code (not test code)
2. Update tests to use canonical models
3. Remove deprecated fields from schema
4. Clean up archived documentation
5. Run full test suite to verify no regressions
