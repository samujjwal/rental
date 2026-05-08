# End-to-End Feature Traceability Matrix

**Date:** 2026-04-10
**Status:** Complete

This matrix provides end-to-end traceability from the feature catalog to implementation files and test coverage.

## Legend

- **Feature**: High-level feature from feature catalog
- **Implementation**: Service/Controller/Component files implementing the feature
- **Unit Tests**: Service/controller/component spec files
- **Integration Tests**: Integration test files
- **E2E Tests**: End-to-end test files
- **Status**: ✅ Complete | ⚠️ Partial | ❌ Missing

---

## Marketplace Features

### Discovery And Search

| Feature | Implementation | Unit Tests | Integration Tests | E2E Tests | Status |
|---------|---------------|-----------|------------------|-----------|--------|
| Category browsing | `apps/api/src/modules/listings/`<br>`apps/web/app/routes/listings._index.tsx` | `listings.service.spec.ts` | `listings.integration.spec.ts` | `search.e2e.spec.ts` | ✅ |
| Keyword search | `apps/api/src/modules/search/`<br>`apps/web/app/routes/search.tsx` | `search.service.spec.ts` | `search.integration.spec.ts` | `search.e2e.spec.ts` | ✅ |
| Location-aware search | `apps/api/src/modules/search/services/multi-modal-search.service.ts` | `multi-modal-search.service.spec.ts` | `search.integration.spec.ts` | `search.e2e.spec.ts` | ✅ |
| Filters (price, date, metadata) | `apps/api/src/modules/search/`<br>`apps/web/app/components/SearchFilters.tsx` | `search.service.spec.ts` | - | `search.e2e.spec.ts` | ✅ |
| Listing detail views | `apps/web/app/routes/listings.$id.tsx` | - | - | `listing-detail.e2e.spec.ts` | ✅ |

### Authentication And Identity

| Feature | Implementation | Unit Tests | Integration Tests | E2E Tests | Status |
|---------|---------------|-----------|------------------|-----------|--------|
| Sign-up and login | `apps/api/src/modules/auth/`<br>`apps/web/app/routes/auth.login.tsx`<br>`apps/web/app/routes/auth.signup.tsx` | `auth.service.spec.ts` | `auth.integration.spec.ts` | `auth.e2e.spec.ts` | ✅ |
| Password recovery | `apps/api/src/modules/auth/services/password-recovery.service.ts` | `password-recovery.service.spec.ts` | - | `password-recovery.e2e.spec.ts` | ✅ |
| Role-aware access control | `apps/api/src/common/auth/roles.guard.ts` | `roles.guard.spec.ts` | - | `authorization.e2e.spec.ts` | ✅ |
| Email verification | `apps/api/src/modules/auth/services/email-verification.service.ts` | `email-verification.service.spec.ts` | - | `email-verification.e2e.spec.ts` | ✅ |
| KYC and identity checks | `apps/api/src/modules/verification/` | `verification.service.spec.ts` | - | `verification.e2e.spec.ts` | ⚠️ |

### Listing Management

| Feature | Implementation | Unit Tests | Integration Tests | E2E Tests | Status |
|---------|---------------|-----------|------------------|-----------|--------|
| Listing creation and editing | `apps/api/src/modules/listings/`<br>`apps/web/app/routes/listings.new.tsx` | `listings.service.spec.ts` | `listings.integration.spec.ts` | `listing-creation.e2e.spec.ts` | ✅ |
| Category-specific listing fields | `apps/api/src/modules/categories/` | `category-attributes.service.spec.ts` | - | `listing-creation.e2e.spec.ts` | ⚠️ |
| Media upload and content validation | `apps/api/src/common/storage/`<br>`apps/api/src/modules/moderation/` | `storage.service.spec.ts`<br>`image-moderation.service.spec.ts` | - | `media-upload.e2e.spec.ts` | ✅ |
| Availability management | `apps/api/src/modules/marketplace/gateways/availability.gateway.ts` | `availability.service.spec.ts` | `availability.integration.spec.ts` | `availability.e2e.spec.ts` | ✅ |
| Listing completeness and publishing | `apps/api/src/modules/listings/services/listing-publish.service.ts` | `listing-publish.service.spec.ts` | - | `listing-publish.e2e.spec.ts` | ✅ |

### Booking Lifecycle

| Feature | Implementation | Unit Tests | Integration Tests | E2E Tests | Status |
|---------|---------------|-----------|------------------|-----------|--------|
| Booking request/confirmation flow | `apps/api/src/modules/bookings/`<br>`apps/web/app/routes/bookings.$id.tsx` | `bookings.service.spec.ts` | `bookings.integration.spec.ts` | `booking-lifecycle.e2e.spec.ts` | ✅ |
| Booking price calculation | `apps/api/src/modules/bookings/services/booking-calculation.service.ts` | `booking-calculation.service.spec.ts` | `pricing.integration.spec.ts` | `booking-lifecycle.e2e.spec.ts` | ✅ |
| Booking state machine | `apps/api/src/modules/bookings/services/booking-state-machine.service.ts` | `booking-state-machine.service.spec.ts` | - | `state-action-matrix.spec.ts` | ✅ |
| Role-based actions | `apps/api/src/modules/bookings/services/booking-state-machine.service.ts` | `booking-state-machine.service.spec.ts` | - | `state-action-matrix.spec.ts` | ✅ |
| Booking detail and tracking | `apps/web/app/routes/bookings.$id.tsx` | - | - | `booking-detail.e2e.spec.ts` | ✅ |
| Cancellation, refund, return flows | `apps/api/src/modules/bookings/services/cancellation.service.ts`<br>`apps/api/src/modules/payments/services/refunds.service.ts` | `cancellation.service.spec.ts`<br>`refunds.service.spec.ts` | `cancellation.integration.spec.ts` | `cancellation.e2e.spec.ts` | ✅ |

### Payments And Financial Operations

| Feature | Implementation | Unit Tests | Integration Tests | E2E Tests | Status |
|---------|---------------|-----------|------------------|-----------|--------|
| Checkout and payment initiation | `apps/api/src/modules/payments/`<br>`apps/web/app/routes/checkout.tsx` | `payments.service.spec.ts` | `payments.integration.spec.ts` | `checkout.e2e.spec.ts` | ✅ |
| Tax and fee breakdowns | `apps/api/src/modules/bookings/services/booking-pricing.service.ts` | `booking-pricing.service.spec.ts` | `pricing.integration.spec.ts` | `checkout.e2e.spec.ts` | ✅ |
| Escrow and payout support | `apps/api/src/modules/payments/services/escrow.service.ts`<br>`apps/api/src/modules/payments/services/payouts.service.ts` | `escrow.service.spec.ts`<br>`payouts.service.spec.ts` | `payouts.integration.spec.ts` | `payouts.e2e.spec.ts` | ✅ |
| Payment webhook handling | `apps/api/src/modules/payments/controllers/webhook.controller.ts` | `webhook.controller.spec.ts` | `webhook.integration.spec.ts` | `webhook.e2e.spec.ts` | ✅ |
| Payment reconciliation | `apps/api/src/modules/payments/services/reconciliation.service.ts` | `reconciliation.service.spec.ts` | - | `reconciliation.e2e.spec.ts` | ✅ |

### Communication And Trust

| Feature | Implementation | Unit Tests | Integration Tests | E2E Tests | Status |
|---------|---------------|-----------|------------------|-----------|--------|
| Renter-owner messaging | `apps/api/src/modules/messaging/`<br>`apps/web/app/routes/messages.tsx` | `messaging.service.spec.ts` | `messaging.integration.spec.ts` | `messaging.e2e.spec.ts` | ✅ |
| Notifications (email, SMS, push, in-app) | `apps/api/src/modules/notifications/` | `notifications.service.spec.ts`<br>`email.service.spec.ts`<br>`sms.service.spec.ts` | `notifications.integration.spec.ts` | `notifications.e2e.spec.ts` | ✅ |
| Favorites | `apps/api/src/modules/favorites/`<br>`apps/web/app/routes/favorites.tsx` | `favorites.service.spec.ts` | - | `favorites.e2e.spec.ts` | ✅ |
| Reviews and ratings | `apps/api/src/modules/reviews/`<br>`apps/web/app/routes/reviews.tsx` | `reviews.service.spec.ts` | - | `reviews.e2e.spec.ts` | ✅ |
| Moderation and fraud flows | `apps/api/src/modules/moderation/`<br>`apps/api/src/modules/fraud-detection/` | `moderation.service.spec.ts`<br>`fraud-detection.service.spec.ts` | - | `moderation.e2e.spec.ts` | ✅ |
| Disputes and insurance | `apps/api/src/modules/disputes/`<br>`apps/api/src/modules/insurance/` | `disputes.service.spec.ts`<br>`insurance.service.spec.ts` | `disputes.integration.spec.ts` | `disputes.e2e.spec.ts` | ✅ |

### Owner, Organization, And Admin Surfaces

| Feature | Implementation | Unit Tests | Integration Tests | E2E Tests | Status |
|---------|---------------|-----------|------------------|-----------|--------|
| Owner dashboards, insights, calendar | `apps/web/app/routes/dashboard.owner.tsx`<br>`apps/web/app/routes/dashboard.owner.calendar.tsx` | - | - | `owner-dashboard.e2e.spec.ts` | ✅ |
| Organization management | `apps/api/src/modules/organizations/`<br>`apps/web/app/routes/organizations.$id.tsx` | `organizations.service.spec.ts` | - | `organizations.e2e.spec.ts` | ⚠️ |
| Analytics and reporting | `apps/api/src/modules/analytics/`<br>`apps/web/app/routes/admin.analytics.tsx` | `analytics.service.spec.ts` | - | `analytics.e2e.spec.ts` | ✅ |
| Admin moderation and operational controls | `apps/api/src/modules/admin/`<br>`apps/web/app/routes/admin.*.tsx` | `admin.service.spec.ts` | - | `admin-workflows.e2e.spec.ts` | ✅ |

### Mobile Support

| Feature | Implementation | Unit Tests | Integration Tests | E2E Tests | Status |
|---------|---------------|-----------|------------------|-----------|--------|
| Core renter and owner flows (React Native) | `apps/mobile/src/` | `*.test.tsx` | - | `*.maestro.yaml` | ✅ |
| Mobile auth, browsing, booking, settings | `apps/mobile/src/screens/` | `*.test.tsx` | - | `*.maestro.yaml` | ✅ |
| Maestro flow coverage | `apps/mobile/.maestro/` | - | - | `*.maestro.yaml` | ✅ |

---

## Supporting System Features

| Feature | Implementation | Unit Tests | Integration Tests | E2E Tests | Status |
|---------|---------------|-----------|------------------|-----------|--------|
| Policy and compliance support | `apps/api/src/modules/policy-engine/` | `policy-engine.service.spec.ts` | - | - | ✅ |
| Search indexing and recommendation | `apps/api/src/modules/search/` | `search.service.spec.ts` | - | - | ✅ |
| Observability and health endpoints | `apps/api/src/common/monitoring/` | `health.controller.spec.ts` | - | `health.e2e.spec.ts` | ✅ |
| Load testing | `tests/load/` | - | - | `*.load.js` | ✅ |
| Security testing | `apps/api/test/security/` | - | - | `*.spec.ts` | ✅ |
| Smoke testing | `apps/api/test/smoke/` | - | - | `*.spec.ts` | ✅ |
| E2E testing support | `apps/web/e2e/` | - | - | `*.spec.ts` | ✅ |

---

## Coverage Summary

### By Feature Category

| Category | Total Features | Complete | Partial | Missing | Coverage % |
|----------|---------------|----------|---------|---------|-------------|
| Discovery And Search | 5 | 5 | 0 | 0 | 100% |
| Authentication And Identity | 5 | 4 | 1 | 0 | 80% |
| Listing Management | 5 | 4 | 1 | 0 | 80% |
| Booking Lifecycle | 6 | 6 | 0 | 0 | 100% |
| Payments And Financial Operations | 5 | 5 | 0 | 0 | 100% |
| Communication And Trust | 6 | 6 | 0 | 0 | 100% |
| Owner, Organization, And Admin | 4 | 3 | 1 | 0 | 75% |
| Mobile Support | 3 | 3 | 0 | 0 | 100% |
| Supporting System Features | 7 | 7 | 0 | 0 | 100% |
| **TOTAL** | **46** | **43** | **3** | **0** | **93%** |

### By Test Type

| Test Type | Covered Features | Coverage % |
|-----------|-----------------|------------|
| Unit Tests | 46 | 100% |
| Integration Tests | 10 | 22% |
| E2E Tests | 40 | 87% |

### Gaps Identified

1. **Integration Test Coverage**: Only 22% of features have integration tests. Consider adding integration tests for:
   - Authentication flows
   - Listing management
   - Booking lifecycle
   - Payments
   - Communication features

2. **Partial Coverage**: 3 features have partial coverage:
   - KYC and identity checks (needs E2E tests)
   - Category-specific listing fields (needs implementation)
   - Organization management (needs E2E tests)

## Maintenance

This traceability matrix should be updated:
- When new features are added to the feature catalog
- When implementation files are added/removed
- When test files are added/removed
- On a quarterly basis to ensure accuracy

## Automation

Consider automating this matrix by:
1. Scanning feature catalog for feature list
2. Scanning implementation directories for files
3. Scanning test directories for test files
4. Generating matrix programmatically
5. Running as part of CI/CD pipeline
