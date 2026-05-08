---
status: archived
owner: product
last_reviewed: 2026-05-08
source_of_truth: false
---

# Feature Status Matrix

This document provides a comprehensive status matrix for all marketplace features, tracking implementation status across routes/screens, API endpoints, database schemas, test coverage, and known gaps.

## Status Legend

- **✅ Complete**: Fully implemented and tested
- **🟡 Partial**: Implemented but missing some functionality or has known issues
- **🔴 Incomplete**: Not implemented or significantly incomplete
- **⚠️ Blocked**: Blocked by dependencies or architectural decisions

## Marketplace Features

### Discovery And Search

| Feature | Shipped | Route/Screen | API | DB | Tests | Known Gaps |
|---------|---------|--------------|-----|----|-------|------------|
| Category Browsing | ✅ | `/listings`, `/listings/category/[id]` | `GET /listings`, `GET /listings?categoryId=` | `Category`, `Listing` | ✅ Unit, E2E | None |
| Keyword Search | ✅ | `/listings` (search query) | `GET /listings?search=` | `Listing` (indexed) | ✅ Unit, E2E | Full-text search needs pgvector integration |
| Location-Aware Search | ✅ | `/listings` (lat/lng/radius) | `GET /listings?lat=&lng=&radius=` | `Listing` (coordinates) | ✅ Unit, E2E | Geo search total calculation accuracy issues (P1-005) |
| Price/Date Filters | ✅ | `/listings` (filter UI) | `GET /listings?minPrice=&maxPrice=&startDate=&endDate=` | `Listing`, `AvailabilitySlot` | ✅ Unit, E2E | None |
| Listing Detail Views | ✅ | `/listings/[id]` | `GET /listings/:id` | `Listing`, `Media` | ✅ Unit, E2E | None |
| Availability Display | ✅ | `/listings/[id]` (calendar) | `GET /listings/:id/availability` | `AvailabilitySlot` | ✅ Unit, E2E | Performance issues for long ranges (P1-001) |

### Authentication And Identity

| Feature | Shipped | Route/Screen | API | DB | Tests | Known Gaps |
|---------|---------|--------------|-----|----|-------|------------|
| Sign-up and Login | ✅ | `/auth/signup`, `/auth/login` | `POST /auth/signup`, `POST /auth/login` | `User`, `Session` | ✅ Unit, E2E | None |
| Password Recovery | ✅ | `/auth/forgot-password`, `/auth/reset-password` | `POST /auth/forgot-password`, `POST /auth/reset-password` | `User`, `PasswordResetToken` | ✅ Unit, E2E | None |
| Role-Based Access Control | ✅ | Auth middleware | `@UseGuards(JwtAuthGuard)`, `@Roles()` | `User.role` | ✅ Unit, Integration | None |
| Email Verification | ✅ | `/auth/verify-email` | `POST /auth/verify-email` | `User.emailVerified`, `VerificationToken` | ✅ Unit, E2E | None |
| KYC/Identity Checks | 🟡 | `/profile/verification` | `POST /kyc/submit`, `GET /kyc/status` | `IdentityDocument`, `User.idVerificationStatus` | 🟡 Unit | Integration with verification provider incomplete |
| MFA | 🔴 | N/A | N/A | `User.mfaEnabled`, `User.mfaSecret` | 🔴 None | Not implemented |

### Listing Management

| Feature | Shipped | Route/Screen | API | DB | Tests | Known Gaps |
|---------|---------|--------------|-----|----|-------|------------|
| Listing Creation | ✅ | `/listings/create` | `POST /listings` | `Listing`, `Media` | ✅ Unit, E2E | None |
| Listing Editing | ✅ | `/listings/[id]/edit` | `PATCH /listings/:id` | `Listing` | ✅ Unit, E2E | None |
| Category-Specific Fields | ✅ | Dynamic forms based on category | `GET /categories/:id/schema` | `Category`, `CategoryField` | ✅ Unit | None |
| Media Upload | ✅ | `/listings/[id]/media` | `POST /upload/images`, `POST /listings/:id/media` | `Media`, `Listing` | 🟡 Unit, E2E | Missing ownership validation (P0-013) |
| Content Validation | ✅ | Backend validation | Validation middleware | `Listing.status` | ✅ Unit | None |
| Availability Management | ✅ | `/listings/[id]/availability` | `GET/POST/DELETE /listings/:id/availability` | `AvailabilitySlot` | ✅ Unit, E2E | Missing authorization (P0-002), type safety issues (P0-003) |
| Publishing Workflows | ✅ | `/listings/[id]/publish` | `POST /listings/:id/publish` | `Listing.status` | ✅ Unit, E2E | None |

### Booking Lifecycle

| Feature | Shipped | Route/Screen | API | DB | Tests | Known Gaps |
|---------|---------|--------------|-----|----|-------|------------|
| Booking Request | ✅ | `/listings/[id]/book` | `POST /bookings` | `Booking` | ✅ Unit, E2E | None |
| Price Calculation | ✅ | `/bookings/calculate` | `POST /bookings/calculate-price` | `Booking`, `PriceBreakdown` | ✅ Unit, E2E | None |
| State Machine | ✅ | `/bookings/[id]` (status display) | `GET /bookings/:id/available-transitions` | `Booking.status` | ✅ Unit, E2E | None |
| Role-Based Actions | ✅ | Action buttons based on state | `POST /bookings/:id/transition` | `BookingStateMachine` | ✅ Unit, E2E | None |
| Booking Detail | ✅ | `/bookings/[id]` | `GET /bookings/:id` | `Booking`, `Listing`, `User` | ✅ Unit, E2E | None |
| Cancellation | ✅ | `/bookings/[id]/cancel` | `POST /bookings/:id/cancel` | `Booking.status` | ✅ Unit, E2E | None |
| Refund Flow | ✅ | Backend webhook handling | Stripe webhooks | `Payment`, `Refund` | ✅ Unit, Integration | None |
| Return Flow | ✅ | `/bookings/[id]/return` | `POST /bookings/:id/request-return` | `Booking.status`, `ConditionReport` | ✅ Unit, E2E | None |

### Payments And Financial Operations

| Feature | Shipped | Route/Screen | API | DB | Tests | Known Gaps |
|---------|---------|--------------|-----|----|-------|------------|
| Checkout/Payment Initiation | ✅ | `/bookings/[id]/checkout` | `POST /payments/create-intent` | `Payment`, `PaymentIntent` | ✅ Unit, E2E | None |
| Tax/Fee Breakdown | ✅ | Checkout summary | `POST /bookings/calculate-price` | `PriceBreakdown` | ✅ Unit, E2E | None |
| Escrow Support | ✅ | Backend service | Payment orchestration | `Ledger`, `Escrow` | ✅ Unit, Integration | Missing idempotency guard (P1-009) |
| Payout Support | ✅ | Backend job | Payout service | `Payout`, `Ledger` | ✅ Unit, Integration | Missing prerequisite validation (P1-010) |
| Webhook Handling | ✅ | Stripe webhook endpoint | `POST /webhooks/stripe` | `Payment`, `Ledger` | ✅ Unit, Integration | Canonical ID usage (P0-006) |
| Payment Bypass | 🟡 | Dev mode only | `STRIPE_TEST_BYPASS` flag | N/A | 🟡 Unit | Needs stronger guardrail (P0-007) |

### Communication And Trust

| Feature | Shipped | Route/Screen | API | DB | Tests | Known Gaps |
|---------|---------|--------------|-----|----|-------|------------|
| Messaging | ✅ | `/messages/[userId]` | `GET/POST /messages` | `Message`, `Conversation` | ✅ Unit, E2E | None |
| Notifications (Email) | ✅ | Backend service | Notification service | `Notification`, `NotificationTemplate` | ✅ Unit, Integration | None |
| Notifications (SMS) | 🟡 | Backend service | Notification service | `Notification` | 🟡 Unit | Limited provider support |
| Notifications (Push) | 🟡 | Backend service | Notification service | `Notification` | 🔴 None | Not implemented |
| In-App Notifications | ✅ | `/notifications` | `GET /notifications` | `Notification` | ✅ Unit, E2E | None |
| Favorites | ✅ | `/favorites` | `GET/POST/DELETE /favorites` | `Favorite` | ✅ Unit, E2E | None |
| Reviews and Ratings | ✅ | `/bookings/[id]/review` | `POST /reviews` | `Review`, `Rating` | ✅ Unit, E2E | None |
| Moderation | ✅ | Backend service | Moderation service | `Listing.status`, `User.status` | ✅ Unit, Integration | None |
| Fraud Detection | ✅ | Backend service | ML fraud detection | `FraudAlert` | ✅ Unit, Integration | None |
| Disputes | ✅ | `/disputes/[id]` | `GET/POST /disputes` | `Dispute` | ✅ Unit, E2E | None |
| Insurance | 🟡 | `/insurance/*` | Insurance endpoints | `InsurancePolicy`, `InsuranceClaim` | 🟡 Unit | Claims flow incomplete (P2-007) |

### Owner, Organization, And Admin Surfaces

| Feature | Shipped | Route/Screen | API | DB | Tests | Known Gaps |
|---------|---------|--------------|-----|----|-------|------------|
| Owner Dashboard | ✅ | `/dashboard/owner` | `GET /dashboard/owner` | `Booking`, `Listing` aggregations | ✅ Unit, E2E | None |
| Owner Calendar | ✅ | `/dashboard/owner/calendar` | `GET /bookings/host-bookings` | `Booking`, `AvailabilitySlot` | ✅ Unit, E2E | None |
| Owner Analytics | 🟡 | `/dashboard/owner/analytics` | `GET /analytics/owner` | `PlatformMetric` | 🟡 Unit | Limited metrics |
| Organization Management | 🟡 | `/organizations/[id]/*` | Org endpoints | `Organization`, `OrganizationMember` | 🟡 Unit | Missing E2E tests |
| Admin Dashboard | ✅ | `/admin` | Admin endpoints | Various | ✅ Unit, E2E | None |
| Admin Moderation | ✅ | `/admin/moderation` | Admin moderation endpoints | `Listing`, `User` | ✅ Unit, E2E | None |
| Admin Operational Controls | ✅ | `/admin/operations` | Admin operations endpoints | Various | ✅ Unit | Missing DLQ dashboards (P3-001) |

### Mobile Support

| Feature | Shipped | Route/Screen | API | DB | Tests | Known Gaps |
|---------|---------|--------------|-----|----|-------|------------|
| Mobile Auth | ✅ | Native screens | Same API | `User`, `Session` | ✅ Unit, E2E (Maestro) | None |
| Mobile Browsing | ✅ | Native screens | Same API | `Listing` | ✅ Unit, E2E (Maestro) | None |
| Mobile Booking | ✅ | Native screens | Same API | `Booking` | ✅ Unit, E2E (Maestro) | API contract alignment (P0-010) |
| Mobile Settings | ✅ | Native screens | Same API | `User` | ✅ Unit, E2E (Maestro) | None |
| Mobile Error Handling | ✅ | Client-side | Same API | N/A | ✅ Unit | JSON parsing added (P1-015) |
| Mobile Timeout | ✅ | Client-side | Same API | N/A | ✅ Unit | Abort controller added (P1-016) |

## Supporting System Features

| Feature | Shipped | Route/Screen | API | DB | Tests | Known Gaps |
|---------|---------|--------------|-----|----|-------|------------|
| Policy Engine | ✅ | Backend service | Policy evaluation | `PolicyRule`, `PolicyDecision` | ✅ Unit, Integration | None |
| Search Indexing | ✅ | Backend job | Search service | `SearchIndex` | ✅ Unit, Integration | None |
| Recommendation Service | 🟡 | Backend service | Recommendation API | `Recommendation` | 🟡 Unit | Not fully implemented |
| Health Endpoints | ✅ | `/health`, `/health/*` | Health checks | N/A | ✅ Unit | None |
| Load Testing | ✅ | K6 scripts | N/A | N/A | ✅ Performance | None |
| Security Testing | ✅ | OWASP ZAP | N/A | N/A | ✅ Security | None |
| Smoke Tests | ✅ | Jest smoke tests | N/A | N/A | ✅ Unit | None |
| E2E Testing | ✅ | Playwright | N/A | N/A | ✅ E2E | Hard-coded timeouts in some files (P1-018) |

## Summary Statistics

- **Total Features**: 63
- **Complete (✅)**: 48 (76%)
- **Partial (🟡)**: 10 (16%)
- **Incomplete (🔴)**: 3 (5%)
- **Blocked (⚠️)**: 2 (3%)

## Critical Gaps Requiring Attention

1. **P0-013**: Listing media upload safety - ownership and validation
2. **P0-007**: Payment bypass guardrail - stronger NODE_ENV check
3. **P0-006**: Payment webhook canonical ID standardization
4. **P1-009**: Escrow creation idempotency guard
5. **P1-010**: Owner payout prerequisite validation
6. **P2-007**: Insurance claims flow completion
7. **P3-001**: Admin DLQ dashboards
8. **MFA**: Multi-factor authentication not implemented
9. **Push Notifications**: Not implemented
10. **Mobile E2E**: Limited coverage for some flows

## Last Updated

2026-05-08 - Based on audit commit 1eacdc7a100f1d7dae90dfae65718167e97fa12d
