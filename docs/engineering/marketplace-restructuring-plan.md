# Marketplace Module Restructuring Plan

**Current State:** 19 controllers
**Target State:** ~8 controllers
**Risk Level:** High (API contract changes possible)
**Priority:** Medium

---

## Current Controllers Analysis

### 1. AI & Intelligence (3 controllers)
- `ai-concierge.controller.ts` - AI-powered recommendations
- `fraud-intelligence.controller.ts` - Fraud detection insights
- `pricing-intelligence.controller.ts` - Pricing recommendations

**Consolidation Opportunity:** Merge into `intelligence.controller.ts`

---

### 2. Availability & Inventory (2 controllers)
- `availability.controller.ts` - Availability management
- `inventory-graph.controller.ts` - Inventory visualization

**Consolidation Opportunity:** Merge into `inventory.controller.ts`

---

### 3. Search & Discovery (2 controllers)
- `marketplace-search.controller.ts` - Search functionality
- `geo-distribution.controller.ts` - Geographic distribution data

**Consolidation Opportunity:** Merge into `discovery.controller.ts`

---

### 4. Policy & Compliance (3 controllers)
- `compliance-automation.controller.ts` - Compliance automation
- `country-policy.controller.ts` - Country-specific policies
- `tax-policy.controller.ts` - Tax policy management

**Consolidation Opportunity:** Merge into `policy.controller.ts`

---

### 5. Analytics & Observability (3 controllers)
- `demand-forecast.controller.ts` - Demand forecasting
- `observability.controller.ts` - System observability
- `reputation.controller.ts` - Reputation metrics

**Consolidation Opportunity:** Merge into `analytics.controller.ts`

---

### 6. Operations & Expansion (3 controllers)
- `expansion.controller.ts` - Market expansion
- `liquidity.controller.ts` - Liquidity management
- `bulk-operations.controller.ts` - Bulk operations

**Consolidation Opportunity:** Merge into `operations.controller.ts`

---

### 7. Payments & Checkout (2 controllers)
- `checkout.controller.ts` - Checkout flow
- `payment-orchestration.controller.ts` - Payment orchestration

**Consolidation Opportunity:** Merge into `payments.controller.ts` (or keep separate if complex)

---

### 8. Disputes (1 controller)
- `dispute-resolution.controller.ts` - Dispute management

**Note:** Already focused, keep as-is

---

## Proposed Target Structure (8 controllers)

1. **`intelligence.controller.ts`** - AI & Intelligence
   - Routes: `/intelligence/*`
   - Combines: ai-concierge, fraud-intelligence, pricing-intelligence

2. **`inventory.controller.ts`** - Availability & Inventory
   - Routes: `/inventory/*`
   - Combines: availability, inventory-graph

3. **`discovery.controller.ts`** - Search & Discovery
   - Routes: `/discovery/*`
   - Combines: marketplace-search, geo-distribution

4. **`policy.controller.ts`** - Policy & Compliance
   - Routes: `/policy/*`
   - Combines: compliance-automation, country-policy, tax-policy

5. **`analytics.controller.ts`** - Analytics & Observability
   - Routes: `/analytics/*`
   - Combines: demand-forecast, observability, reputation

6. **`operations.controller.ts`** - Operations & Expansion
   - Routes: `/operations/*`
   - Combines: expansion, liquidity, bulk-operations

7. **`checkout.controller.ts`** - Checkout (keep separate)
   - Routes: `/checkout/*`
   - Keep as-is (critical path)

8. **`dispute-resolution.controller.ts`** - Disputes (keep separate)
   - Routes: `/disputes/*`
   - Keep as-is (already focused)

---

## Implementation Strategy

### Phase 1: Route Mapping
1. Document all existing routes from 19 controllers
2. Map routes to new controller structure
3. Identify any conflicting routes

### Phase 2: Controller Creation
1. Create new consolidated controllers
2. Copy logic from source controllers
3. Maintain existing route paths to avoid breaking changes
4. Update controller decorators

### Phase 3: Test Migration
1. Update test files to reference new controllers
2. Ensure all existing tests pass
3. Add integration tests for new structure

### Phase 4: Deprecation
1. Deprecate old controllers (keep for backward compatibility)
2. Update API documentation
3. Communicate changes to API consumers

### Phase 5: Cleanup
1. Remove deprecated controllers after deprecation period
2. Clean up unused imports
3. Update module exports

---

## Risk Mitigation

### Breaking Changes
- **Risk:** Changing API routes could break client integrations
- **Mitigation:** Maintain existing route paths during consolidation, use controller-level routing

### Test Coverage
- **Risk:** Consolidation could introduce bugs
- **Mitigation:** Comprehensive test coverage before and after, E2E tests for critical paths

### Deployment
- **Risk:** Large change increases deployment risk
- **Mitigation:** Feature flags, gradual rollout, rollback plan

---

## Estimated Effort

- **Phase 1:** 2-3 hours (route mapping)
- **Phase 2:** 8-12 hours (controller creation)
- **Phase 3:** 6-8 hours (test migration)
- **Phase 4:** 2-3 hours (deprecation)
- **Phase 5:** 1-2 hours (cleanup)

**Total:** 19-28 hours

---

## Recommendation

Given the high risk and significant effort required, this restructuring should be:

1. **Planned as a separate initiative** with dedicated time allocation
2. **Reviewed by the team** before implementation
3. **Scheduled during a low-traffic period** to minimize impact
4. **Implemented with feature flags** for gradual rollout

**Alternative:** Keep current structure as-is. The 19 controllers are well-organized by domain and the overhead is minimal. The current structure provides better separation of concerns and is easier to maintain.

---

## Status

**Decision Required:** Proceed with restructuring or defer?

**Next Steps:**
- Team review of this plan
- Approval to proceed or decision to defer
- If approved: Schedule dedicated implementation sprint
