# Test Coverage Report - GharBatai Nepal Rental Portal

**Generated:** March 2026  
**Scope:** API Services, route-aligned Web E2E, and integration tests. Legacy exploratory specs that target non-routed pages are excluded from this snapshot.

## Executive Summary

| Metric | Count | Status |
|--------|-------|--------|
| Total Services | 133 | - |
| Services with Tests | Snapshot requires recount | Stale in previous draft |
| Services Missing Tests | Snapshot requires recount | Previously reported 14-file gap no longer matches repo state |
| E2E Coverage Status | Route-aligned core suites verified manually | In Progress |
| Unit Test Files | 900+ | - |

## Previously Missing Unit Tests

The previous draft reported these services as lacking unit test coverage. That is no longer accurate at the file-presence level: corresponding `.spec.ts` files are present in the repo for every service listed below, and the editor currently reports no static errors in those spec files. The remaining work is to run and validate the suites, then recalculate the aggregate service-coverage numbers.

### 1. **booking-eligibility.service.ts** ⚠️ CRITICAL
**Impact:** Core booking flow - determines if a booking is allowed based on fraud, compliance, insurance, and moderation checks.  
**Risk:** No validation of complex orchestration logic. Fail-open/fail-closed modes untested.  
**Current State:** Spec file present: `booking-eligibility.service.spec.ts`

### 2. **booking-validation.service.ts** ⚠️ CRITICAL
**Impact:** Validates booking dates, listing availability, and capacity constraints.  
**Risk:** Date validation bugs, availability checking failures, guest capacity overflow.  
**Current State:** Spec file present: `booking-validation.service.spec.ts`

### 3. **error-handling.service.ts** ⚠️ HIGH
**Impact:** Centralized error handling, logging, and propagation.  
**Risk:** Silent failures, incorrect error classification, retry logic failures.  
**Current State:** Spec file present: `error-handling.service.spec.ts`

### 4. **activity.service.ts** ⚠️ MEDIUM
**Impact:** User activity tracking and analytics.  
**Risk:** Activity data corruption, incorrect stats calculation.  
**Current State:** Spec file present: `activity.service.spec.ts`

### 5. **booking-pricing-bridge.service.ts** ⚠️ MEDIUM
**Impact:** Bridges pricing calculation between booking and payment modules.  
**Risk:** Pricing discrepancies, tax calculation errors.
**Current State:** Spec file present: `booking-pricing-bridge.service.spec.ts`

### 6. **market-insights.service.ts** ⚠️ MEDIUM
**Impact:** AI-powered market analytics and pricing recommendations.  
**Risk:** Incorrect insights, stale data usage.
**Current State:** Spec file present: `market-insights.service.spec.ts`

### 7. **bulk-operations.service.ts** ⚠️ MEDIUM
**Impact:** Batch operations for listings, bookings, users.  
**Risk:** Partial failures, data inconsistency in batch operations.
**Current State:** Spec file present: `bulk-operations.service.spec.ts`

### 8. **distributed-lock.service.ts** ⚠️ MEDIUM
**Impact:** Prevents race conditions in concurrent operations.  
**Risk:** Deadlocks, lock timeouts, concurrent modification bugs.
**Current State:** Spec file present: `distributed-lock.service.spec.ts`

### 9. **event-sourcing.service.ts** ⚠️ MEDIUM
**Impact:** Event sourcing for audit trails and state reconstruction.  
**Risk:** Event loss, incorrect state reconstruction.
**Current State:** Spec file present: `event-sourcing.service.spec.ts`

### 10. **audit-archival.service.ts** ⚠️ LOW
**Impact:** Archives audit logs for compliance.  
**Risk:** Data retention compliance violations.
**Current State:** Spec file present: `audit-archival.service.spec.ts`

### 11. **ai-usage-ledger.service.ts** ⚠️ LOW
**Impact:** Tracks AI service usage for billing.  
**Risk:** Usage tracking inaccuracies.
**Current State:** Spec file present: `ai-usage-ledger.service.spec.ts`

### 12. **distributed-tracing.service.ts** ⚠️ LOW
**Impact:** Distributed tracing for observability.  
**Risk:** Tracing gaps, performance overhead.
**Current State:** Spec file present: `distributed-tracing.service.spec.ts`

### 13. **database-performance.service.ts** ⚠️ LOW
**Impact:** Monitors and optimizes database performance.  
**Risk:** Performance degradation undetected.
**Current State:** Spec file present: `database-performance.service.spec.ts`

### 14. **chaos-engineering.service.ts** ⚠️ LOW
**Impact:** Fault injection for resilience testing.  
**Risk:** Unintentional production impact.
**Current State:** Spec file present: `chaos-engineering.service.spec.ts`

## Existing Test Bugs Fixed

### 1. **Duplicate Assertions in payouts.service.spec.ts** ✅ FIXED
- **Lines:** 101-110
- **Issue:** Redundant `expect.objectContaining()` followed by exact match
- **Fix:** Removed redundant assertion

### 2. **TODO Comment in insurance.service.spec.ts** ✅ FIXED
- **Lines:** 331-335
- **Issue:** Misleading TODO about test organization
- **Fix:** Confirmed tests exist in insurance-policy.service.spec.ts, removed TODO

### 3. **waitForTimeout Anti-patterns in E2E Tests** ✅ FIXED
- **Files:** booking-state-machine.e2e.spec.ts, booking-by-category.spec.ts, booking-and-favorites.spec.ts
- **Issue:** Flaky `page.waitForTimeout()` calls
- **Fix:** Replaced with explicit `expect().toBeVisible()` waits

## Web E2E Coverage Status

### Verified Route-Aligned Coverage

| Flow | Priority | Status |
|------|----------|--------|
| Manual browser-first critical journey | High | ✅ Verified in `manual-critical-ui-journeys.spec.ts` on rebuilt fail-open manual isolated stack |
| Route health and reachable pages | High | ✅ Verified in `route-health.spec.ts` |
| Admin disputes and operations | High | ✅ Verified in `admin-flows.spec.ts` |
| Insurance overview and claims routes | High | ✅ Verified in `insurance-flows.spec.ts` on rebuilt strict isolated stack |
| Static public routes | High | ✅ Verified in `static-pages.spec.ts` on rebuilt strict isolated stack |
| Organization creation and management | High | ✅ Verified in `organizations-flows.spec.ts` on rebuilt strict isolated stack |
| Settings profile/security/notifications/billing | High | ✅ Verified in `settings-flows.spec.ts` on rebuilt strict isolated stack |

### Corrected Coverage Notes

- Previous versions of this report overstated E2E coverage by counting broad exploratory suites that exercised non-existent routes.
- The following suites were removed from the authoritative coverage set because they targeted pages the current router does not ship: `advanced-settings-comprehensive.spec.ts`, `comprehensive-regression-suite.spec.ts`, and `insurance-claims-comprehensive.spec.ts`.
- Remaining broad suites should be treated as exploratory until they are checked against `apps/web/app/routes.ts` and validated on a running stack.
- Playwright now ignores these confirmed exploratory suites by default unless `PLAYWRIGHT_INCLUDE_EXPLORATORY=true` is set: `file-upload-workflows-comprehensive.spec.ts`, `help-support-comprehensive.spec.ts`, `multi-language-comprehensive.spec.ts`, `organization-management-comprehensive.spec.ts`, `payment-integration-comprehensive.spec.ts`, `profile-management.spec.ts`, `profile-management-comprehensive.spec.ts`, `stripe-payments.spec.ts`, and `websocket-realtime-comprehensive.spec.ts`.
- `profile-management.spec.ts` still assumes a `/profile/me` alias that is not in the router, and `stripe-payments.spec.ts` still drives `/checkout/test-booking-id` with synthetic ids instead of creating a real seeded booking; both are investigative scaffolds, not release-gate coverage.
- `static-pages.spec.ts` was rebuilt against the actual shipped route modules after the original version asserted fabricated content blocks, job cards, and FAQ/legal structures on pages that intentionally render simpler `StaticPage` shells.
- Fresh rebuilt isolated previews changed the interpretation of the earlier `organizations` and `settings` failures: those were stale-preview false negatives from reusing `start:isolated:skip-build` after web code changes, not current-product defects. The rebuilt strict stack validated both suites green.
- The manual lane still depends on the documented degraded local API contract (`SAFETY_CHECKS_FAIL_OPEN=true`) so browser-first unhappy-path booking setup is not blocked by compliance gating before the tested decline, cancel, and payment-retry steps begin.

## Integration Test Gaps

### WebSocket / Real-time Features
- **Status:** Partial coverage
- **Missing:** Connection failure scenarios, reconnection logic, message queuing
- **Priority:** High

### Payment Integration
- **Status:** Good coverage with Stripe test cards
- **Missing:** Webhook failure handling, payout processing
- **Priority:** Medium

### File Upload Workflows
- **Status:** Basic coverage
- **Missing:** Large file handling, image optimization, virus scanning
- **Priority:** Medium

## Test Quality Improvements

### Anti-patterns Eliminated
1. ✅ Replaced `waitForTimeout` with explicit waits
2. ✅ Fixed duplicate assertions
3. ✅ Added proper mock typing

### Best Practices Enforced
1. ✅ Explicit wait conditions in E2E tests
2. ✅ Proper error message matching
3. ✅ Comprehensive edge case coverage

## Recommendations

### Immediate (Next Sprint)
1. Run and validate the newly present service spec files, then recalculate service-coverage metrics from actual passing suites
2. Add WebSocket integration tests
3. Rebuild or replace remaining exploratory Playwright suites with route-aligned scenarios

### Short-term (Next Month)
1. Convert the stale service-coverage snapshot into a generated report tied to actual discovered spec files and passing results
2. Create E2E tests for static pages (Terms, Privacy, Careers)
3. Implement visual regression testing

### Long-term (Next Quarter)
1. Performance testing with K6 for all critical paths
2. Security penetration testing integration
3. Load testing for peak traffic scenarios

## Test Execution Commands

```bash
# Run all tests
npm run test:comprehensive

# Run specific test types
npm run test:unit              # Jest unit tests
npm run test:e2e:web          # Playwright E2E tests
npm run test:api              # API integration tests
npm run test:performance      # K6 load tests

# Run specific service tests
npx jest booking-eligibility.service.spec.ts
npx jest booking-validation.service.spec.ts
npx jest error-handling.service.spec.ts
npx jest activity.service.spec.ts
```

## Coverage Metrics Target

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Service Coverage | 89.5% | 95% | 5.5% |
| Line Coverage | ~75% | 85% | 10% |
| Branch Coverage | ~70% | 80% | 10% |
| E2E Route Coverage | ~75% | 90% | 15% |

## Conclusion

The codebase has a strong testing foundation with 900+ unit tests and a solid set of route-aligned E2E suites. Earlier reports counted some invalid browser suites as real coverage, and this report also overstated a 14-service “missing unit tests” gap that no longer matches the current repo contents. The fixes implemented address:

1. ✅ Corrected the report so it no longer claims those 14 service test files are missing
2. ✅ Fixed existing test bugs (duplicate assertions, waitForTimeout)
3. ✅ Tightened browser coverage around real shipped routes and removed invalid route-based suites from the authoritative set
4. ✅ Added manual browser-first owner listing creation coverage to the critical UI lane
5. ✅ Created comprehensive QA documentation

**Next Steps:** Validate the newly present service specs at runtime, regenerate the service-coverage counts from the real file/test state, and continue replacing exploratory browser suites that are not route-aligned.
