# Failing Test Tracker

**Repository:** `samujjwal/rental`  
**Last Updated:** 2026-05-08  
**Purpose:** Track skipped tests, test failures, and implementation gaps to ensure production readiness.

## Summary

- **Total Test Suites:** 336
- **Active Suites:** 312
- **Skipped Suites:** 24
- **Failed Tests:** 0
- **Passed Tests:** 5,121

## Critical Skipped Tests (P0)

### Availability Logic Tests
- **File:** `apps/api/src/modules/availability/services/availability-logic.spec.ts.skip`
- **Status:** Service exists but tests are skipped
- **Impact:** Availability correctness critical for preventing double-booking
- **Action:** Reactivate tests once service is production-ready

### Concurrency Race Conditions
- **File:** `apps/api/src/modules/bookings/services/concurrency-race-conditions.spec.ts.skip`
- **Status:** Contract tests exist but full integration tests skipped
- **Impact:** Race conditions can cause data corruption
- **Action:** Reactivate with real DB integration

### Booking State Machine Complete Transitions
- **File:** `apps/api/src/modules/bookings/services/booking-state-machine.service.complete-transitions.spec.ts.skip`
- **Status:** State machine exists but complete transition validation skipped
- **Impact:** Invalid state transitions can cause payment/booking errors
- **Action:** Reactivate once all transitions are validated

### Payment Idempotency
- **File:** `apps/api/src/modules/payments/services/payment-idempotency.spec.ts.skip`
- **Status:** Tests exist but marked as skipped
- **Impact:** Duplicate payments risk
- **Action:** Reactivate and validate idempotency keys

### Stripe Integration
- **File:** `apps/api/src/modules/payments/services/stripe-integration.spec.ts.skip`
- **Status:** Integration tests exist but require Stripe test mode
- **Impact:** Payment failures in production
- **Action:** Run in CI with Stripe test keys

## Conditional Skips (Acceptable)

The following tests use conditional skips based on environment availability - these are acceptable:

- `apps/api/test/integration/stripe.integration-spec.ts` - Skips if STRIPE_SECRET_KEY not in test mode
- `apps/web/e2e/payments-real-stripe.spec.ts` - Skips if Stripe test key unavailable
- `apps/web/e2e/browser-compatibility.spec.ts` - Skips Firefox/Webkit tests if browsers unavailable
- `apps/web/e2e/advanced-features.spec.ts` - Skips mobile tests if mobile project unavailable

## Test Coverage Metrics

### Current Coverage
- **Unit Tests (Services):** 900+ files (80%+ coverage)
- **Unit Tests (Controllers):** 0 files (CRITICAL GAP)
- **Integration Tests:** 2 files (limited)
- **API E2E Tests:** 53 files
- **Web E2E Tests:** 53 files
- **Mobile E2E Tests:** 0 files (MISSING)

### Coverage Thresholds
- **Current Threshold:** 50% (insufficient for production)
- **Required Threshold:** 80% (for production readiness)

## Anti-Patterns Found

### Hard-coded Timeouts in E2E
- **Issue:** 20+ E2E files use `page.waitForTimeout()` creating flaky tests
- **Better Practice:** Use `page.waitForSelector()`, `page.waitForURL()`, or `page.expect().toBeVisible()`
- **Files Affected:** booking-state-machine.e2e.spec.ts, data/consistency.spec.ts, and 18 others
- **Action:** Replace with explicit waits

### Simplified Mocking
- **Issue:** Payment integration tests use simplified mocking
- **Impact:** May miss real Stripe edge cases
- **Action:** Use Stripe test mode for integration tests

## Production Blockers

### Critical Gaps
1. **Zero Controller Tests** - API contract violations can reach production
2. **Missing Real Stripe Integration** - Payment failures risk
3. **Missing WebSocket Integration** - Real-time sync issues
4. **Missing Mobile E2E Tests** - Mobile flows untested
5. **Low Coverage Thresholds** - 50% insufficient for production

## Action Items

### Immediate (P0)
1. Create controller test suite for all API endpoints
2. Reactivate critical skipped tests
3. Increase coverage thresholds to 80%+
4. Replace `waitForTimeout()` with explicit waits in E2E tests
5. Implement real Stripe integration tests

### High Priority (P1)
6. Create mobile E2E test suite
7. Add WebSocket integration tests
8. Expand contract testing coverage
9. Create comprehensive API E2E tests
10. Add security test scenarios

## Test Strict Mode

A `test:strict` mode should be implemented that:
- Fails on any `.skip` file in critical paths
- Fails on `describe.skip` in critical test suites
- Fails on `it.skip` in critical test suites
- Requires feature flag approval for skipping critical tests
- Distinguishes between "passing active suite" and "production-ready coverage"

## Verification

Run the following to verify test status:
```bash
pnpm run test:unit
pnpm run test:integration
pnpm run test:e2e
pnpm run test:coverage
```

## Notes

- This tracker should be updated after each test run
- Skipped tests must have linked TODOs and approval
- Production deployment requires all P0 tests to pass
- Coverage must meet 80% threshold before production
