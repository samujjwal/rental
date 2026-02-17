# E2E Test Suite - Comprehensive Test Run Plan

**Date:** February 15, 2026  
**Purpose:** Systematic verification of all test suites  
**Status:** 🔄 In Progress

---

## Test Execution Plan

### Phase 1: Core Flows ✅ COMPLETE
- [x] **smoke.spec.ts** - 10/10 passed (100%)
- [x] **auth.spec.ts** - 42/44 passed, 2 skipped (95.5%)  
- [x] **admin-flows.spec.ts** - 44/45 verified (97.8%)

**Total Phase 1:** 96/99 passing (97%)

---

### Phase 2: User Flows 🔄 Testing Now

#### Owner Flows
- [ ] **owner-dashboard.spec.ts** - Testing dashboard functionality
- [ ] **owner-listings.spec.ts** - Known issue: Tests hanging

#### Renter Flows  
- [ ] **renter-dashboard.spec.ts** - Dashboard and bookings
- [ ] **search-browse.spec.ts** - Search and filtering
- [ ] **favorites.spec.ts** - Wishlist functionality

#### Shared Flows
- [ ] **messages.spec.ts** - Messaging between users
- [ ] **payments-reviews-notifications.spec.ts** - Payment flow

---

### Phase 3: Feature Tests 🔜 Pending

#### Functional Features
- [ ] **home.spec.ts** - Homepage functionality
- [ ] **route-health.spec.ts** - Route accessibility
- [ ] **password-recovery.spec.ts** - Password reset
- [ ] **disputes.spec.ts** - Dispute handling
- [ ] **organizations.spec.ts** - Multi-user orgs

#### Edge Cases & Validation
- [ ] **comprehensive-edge-cases.spec.ts** - Mostly skipped (30+ tests)
- [ ] **comprehensive-form-validation.spec.ts** - Mostly skipped (~25+ tests)
- [ ] **comprehensive-user-journeys.spec.ts** - Integration scenarios

#### Quality Tests
- [ ] **responsive-accessibility.spec.ts** - Responsive design & a11y
- [ ] **diagnostic.spec.ts** - System diagnostics

---

## Execution Commands

### Quick Core Suite (3 min)
```bash
cd /Users/samujjwal/Development/rental/apps/web
npx playwright test e2e/smoke.spec.ts e2e/auth.spec.ts e2e/admin-flows.spec.ts --project=chromium --reporter=line
```

### Owner Flow Suite (5 min)
```bash
npx playwright test e2e/owner-dashboard.spec.ts e2e/owner-listings.spec.ts --project=chromium --reporter=line
```

### Renter Flow Suite (5 min)
```bash
npx playwright test e2e/renter-dashboard.spec.ts e2e/search-browse.spec.ts e2e/favorites.spec.ts --project=chromium --reporter=line
```

### Full Suite (30-45 min)
```bash
npx playwright test --project=chromium --reporter=html
```

---

## Expected Results

### Realistic Expectations
- **Core Flows:** 95-100% (verified ✅)
- **User Flows:** 60-80% (many features partially implemented)
- **Edge Cases:** 20-40% (mostly skipped for unimplemented features)
- **Overall:** ~200-300 passing out of 854 (~25-35%)

### Success Criteria
- ✅ Zero false failures (all failures are real issues or documented skips)
- ✅ Core flows maintain 95%+ pass rate
- ✅ Clear identification of what needs implementation
- ✅ Stable baseline for CI/CD

---

## Next Actions

1. Run owner flow tests
2. Run renter flow tests  
3. Generate comprehensive HTML report
4. Update documentation with findings
5. Create prioritized implementation backlog
