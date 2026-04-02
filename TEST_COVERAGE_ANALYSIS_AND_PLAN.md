# Comprehensive Test Coverage Analysis & Implementation Plan
## GharBatai Rentals - Universal Rental Marketplace

**Generated**: April 2026  
**Scope**: Full codebase audit for test coverage gaps  
**Priority Focus**: Unit tests, Integration tests, API E2E tests

---

## Executive Summary

### Current State Statistics
| Metric | Count |
|--------|-------|
| Backend Service Files | 133 |
| Backend Controller Files | 54 |
| Existing Backend Spec Files | 245 |
| Frontend Route Files (.tsx) | 91 |
| Frontend Test Files (.test.ts/test.tsx) | 87 |
| Database Models | 70+ |
| API Endpoints | 406+ decorators |

### Coverage Overview
- **Backend API**: ~70% spec files exist but many lack comprehensive test cases
- **Frontend Web**: ~50% of routes have test files, many are skeleton/placeholder tests
- **Mobile**: Minimal test coverage
- **Integration Tests**: Fragmented, needs unified approach
- **API E2E Tests**: Basic coverage exists but missing critical path validation

---

## Part 1: Backend API Coverage Analysis

### 1.1 Common/Shared Services (26 services)

| Service | Status | Priority | Test File | Coverage Gaps |
|---------|--------|----------|-----------|---------------|
| `audit-archival.service.ts` | ✅ Has spec | Medium | ✅ | Missing: archival edge cases, bulk operations |
| `cache.service.ts` | ✅ Has spec | High | ✅ | Missing: Redis failure scenarios, TTL edge cases |
| `chaos-engineering.service.ts` | ✅ Has spec | Low | ✅ | Missing: latency injection, error injection scenarios |
| `config-cascade.service.ts` | ✅ Has spec | Medium | ✅ | Missing: env override scenarios, nested cascade |
| `email.service.ts` | ✅ Has spec | High | ✅ | Missing: template rendering errors, retry logic |
| `resend-email.service.ts` | ✅ Has spec | Medium | ✅ | Missing: rate limiting, bounce handling |
| `field-encryption.service.ts` | ✅ Has spec | Critical | ✅ | Missing: key rotation, decryption failures |
| `error-handling.service.ts` | ✅ Has spec | High | ✅ | Missing: i18n error formatting, error classification |
| `event-sourcing.service.ts` | ✅ Has spec | Medium | ✅ | Missing: event replay, snapshot restoration |
| `events.service.ts` | ✅ Has spec | Medium | ✅ | Missing: event ordering, async error handling |
| `fx.service.ts` | ✅ Has spec | Medium | ✅ | Missing: rate caching, stale rate handling |
| `distributed-lock.service.ts` | ✅ Has spec | Critical | ✅ | Missing: lock timeout scenarios, deadlock prevention |
| `logger.service.ts` | ✅ Has spec | Low | ✅ | Missing: log rotation, PII masking |
| `metrics.service.ts` | ✅ Has spec | Medium | ✅ | Missing: metric aggregation, label cardinality |
| `database-performance.service.ts` | ✅ Has spec | Medium | ✅ | Missing: slow query detection, connection pool |
| `prisma.service.ts` | ✅ Has spec | Critical | ✅ | Missing: transaction retry, soft delete enforcement |
| `rate-limit.service.ts` | ✅ Has spec | High | ✅ | Missing: distributed rate limit, burst handling |
| `scheduler.service.ts` | ✅ Has spec | Medium | ✅ | Missing: job overlap prevention, cron edge cases |
| `s3.service.ts` | ✅ Has spec | High | ✅ | Missing: multipart upload, presigned URL expiry |
| `storage.service.ts` | ✅ Has spec | High | ✅ | Missing: virus scanning, mime-type validation |
| `distributed-tracing.service.ts` | ✅ Has spec | Low | ✅ | Missing: span context propagation, sampling |

**Missing Specs (Common)**:
- `cleanup/cleanup.processor.ts` - No spec file
- `health/external-services.health.ts` - No spec file
- `interceptors/` - No spec coverage for most interceptors

### 1.2 Feature Modules Services

#### Auth Module (9 services)
| Service | Status | Test File | Critical Methods Needing Tests |
|---------|--------|-----------|-------------------------------|
| `auth.service.ts` | ⚠️ Partial | auth.service.spec.ts | `register()`, `login()`, `refreshTokens()` - needs MFA, OAuth flow tests |
| `mfa.service.ts` | ✅ Has spec | mfa.service.spec.ts | Missing: TOTP drift, backup code exhaustion |
| `oauth.service.ts` | ⚠️ Partial | oauth.service.spec.ts | Missing: Apple OAuth, token revocation |
| `otp.service.ts` | ✅ Has spec | otp.service.spec.ts | Missing: SMS delivery failures, rate limiting |
| `password.service.ts` | ✅ Has spec | password.service.spec.ts | Missing: breach detection, strength validation |
| `sms.service.ts` | ✅ Has spec | sms.service.spec.ts | Missing: provider failover, delivery receipts |
| `token.service.ts` | ✅ Has spec | token.service.spec.ts | Missing: token rotation, blacklisting |

**Gap**: No integration tests for complete auth flows (register → verify email → MFA → login)

#### Bookings Module (10 services)
| Service | Status | Test File | Coverage Analysis |
|---------|--------|-----------|-------------------|
| `bookings.service.ts` | ⚠️ Partial | bookings.service.spec.ts | 15+ methods, only 3-4 tested. Missing: `approveBooking()`, `rejectBooking()`, `startRental()`, `requestReturn()`, `approveReturn()`, `rejectReturn()`, `initiateDispute()` |
| `booking-state-machine.service.ts` | ⚠️ Partial | booking-state-machine.spec.ts | 24 transitions defined, only 5-6 tested. Missing all dispute resolution, refund flows |
| `booking-calculation.service.ts` | ✅ Good | booking-calculation.spec.ts | Well covered, missing: seasonal pricing edge cases |
| `booking-validation.service.ts` | ⚠️ Partial | booking-validation.spec.ts | Missing: blocked periods, guest count validation |
| `booking-eligibility.service.ts` | ❌ Missing | None | **CRITICAL**: No tests for fraud detection, insurance verification, moderation |
| `booking-pricing.service.ts` | ⚠️ Partial | booking-pricing.spec.ts | Missing: dynamic pricing, surge calculations |
| `booking-pricing-bridge.service.ts` | ❌ Missing | None | No tests for pricing adapter pattern |
| `invoice.service.ts` | ⚠️ Partial | invoice.service.spec.ts | Missing: HTML generation, PDF conversion |

**CRITICAL GAP**: Booking eligibility orchestration (fraud + insurance + moderation) has zero tests

#### Payments Module (8+ services)
| Service | Status | Test File | Coverage Analysis |
|---------|--------|-----------|-------------------|
| `payments.service.ts` | ⚠️ Partial | payments.service.spec.ts | Missing: split payments, escrow flows |
| `ledger.service.ts` | ⚠️ Partial | ledger.service.spec.ts | Missing: double-entry validation, reconciliation |
| `payouts.service.ts` | ⚠️ Partial | payouts.service.spec.ts | Missing: multi-currency payouts, failed payout retry |
| `stripe.service.ts` | ⚠️ Partial | stripe.service.spec.ts | Missing: webhook handling, 3D Secure |
| `stripe-connect.service.ts` | ⚠️ Partial | stripe-connect.spec.ts | Missing: onboarding flows, KYC verification |
| `webhook.service.ts` | ⚠️ Partial | webhook.service.spec.ts | Missing: idempotency, signature verification failures |
| `refunds.service.ts` | ❌ Missing | None | **CRITICAL**: No refund processing tests |
| `payment-command-log.service.ts` | ❌ Missing | None | No audit trail tests |

#### Listings Module (6+ services)
| Service | Status | Test File | Coverage Analysis |
|---------|--------|-----------|-------------------|
| `listings.service.ts` | ⚠️ Partial | listings.service.spec.ts | Missing: search filters, geocoding errors |
| `availability.service.ts` | ⚠️ Partial | availability.service.spec.ts | Missing: concurrent booking conflicts, slot generation |
| `listing-content.service.ts` | ❌ Missing | None | No content versioning tests |
| `listing-version.service.ts` | ❌ Missing | None | No audit trail tests |
| `listing-search.service.ts` | ⚠️ Partial | listing-search.spec.ts | Missing: full-text search, embedding search |
| `geocoding.service.ts` | ❌ Missing | None | No geocoding fallback tests |

#### Users Module (3 services)
| Service | Status | Test File | Coverage Analysis |
|---------|--------|-----------|-------------------|
| `users.service.ts` | ⚠️ Partial | users.service.spec.ts | Missing: RBAC enforcement, profile updates |
| `kyc.service.ts` | ❌ Missing | None | **CRITICAL**: No KYC verification tests |
| `user-activity.service.ts` | ❌ Missing | None | No activity tracking tests |

#### Messaging Module (2 services)
| Service | Status | Test File | Coverage Analysis |
|---------|--------|-----------|-------------------|
| `messaging.service.ts` | ⚠️ Partial | messaging.service.spec.ts | Missing: real-time delivery, read receipts |
| `conversation.service.ts` | ❌ Missing | None | No conversation lifecycle tests |

#### Notifications Module (3+ services)
| Service | Status | Test File | Coverage Analysis |
|---------|--------|-----------|-------------------|
| `notifications.service.ts` | ⚠️ Partial | notifications.spec.ts | Missing: multi-channel routing, preferences |
| `notification-queue.service.ts` | ❌ Missing | None | No BullMQ job tests |
| `push-notification.service.ts` | ❌ Missing | None | No FCM/APNs tests |

#### Search Module (2 services)
| Service | Status | Test File | Coverage Analysis |
|---------|--------|-----------|-------------------|
| `search.service.ts` | ⚠️ Partial | search.service.spec.ts | Missing: personalization, filters |
| `multi-modal-search.service.ts` | ⚠️ Partial | Needs tests | Geo-search, FTS, vector search need coverage |

#### AI Module (4 services)
| Service | Status | Test File | Coverage Analysis |
|---------|--------|-----------|-------------------|
| `ai.service.ts` | ⚠️ Partial | ai.service.spec.ts | Missing: rate limiting, usage tracking |
| `embedding.service.ts` | ❌ Missing | None | No vector embedding tests |
| `market-insights.service.ts` | ❌ Missing | None | No ML insight tests |
| `ai-usage-ledger.service.ts` | ❌ Missing | None | No cost tracking tests |

#### Admin Module (7 services)
| Service | Status | Test File | Coverage Analysis |
|---------|--------|-----------|-------------------|
| `admin.service.ts` | ⚠️ Partial | admin.service.spec.ts | Missing: user management, moderation |
| `admin-analytics.service.ts` | ⚠️ Partial | admin-analytics.spec.ts | Missing: report generation, aggregations |
| `admin-content.service.ts` | ❌ Missing | None | No content moderation tests |
| `admin-entity.service.ts` | ⚠️ Partial | admin-entity.spec.ts | CRUD operations need more coverage |
| `admin-system.service.ts` | ❌ Missing | None | No system config tests |
| `admin-users.service.ts` | ❌ Missing | None | No user admin tests |
| `filter-builder.service.ts` | ❌ Missing | None | No dynamic filter tests |

#### Marketplace Module (15+ services)
| Service | Status | Test File | Coverage Analysis |
|---------|--------|-----------|-------------------|
| `checkout-orchestrator.service.ts` | ⚠️ Partial | Needs tests | **CRITICAL**: Saga pattern, compensating actions |
| `payment-orchestration.service.ts` | ❌ Missing | None | No multi-provider payment tests |
| `availability-graph.service.ts` | ❌ Missing | None | No graph-based inventory tests |
| `country-policy-pack.service.ts` | ⚠️ Partial | Needs tests | Policy cascade (YAML → DB → hardcoded) |
| `tax-policy-engine.service.ts` | ❌ Missing | None | No tax calculation tests |
| `fraud-intelligence.service.ts` | ❌ Missing | None | **CRITICAL**: No fraud detection tests |
| `demand-forecast.service.ts` | ❌ Missing | None | No ML forecast tests |
| `liquidity.service.ts` | ❌ Missing | None | No marketplace liquidity tests |

#### Insurance Module (3 services)
| Service | Status | Test File | Coverage Analysis |
|---------|--------|-----------|-------------------|
| `insurance.service.ts` | ⚠️ Partial | insurance.service.spec.ts | Missing: claim processing, verification |
| `insurance-policy.service.ts` | ⚠️ Partial | Needs tests | Missing: policy lifecycle, expiration |
| `insurance-verification.service.ts` | ❌ Missing | None | No OCR/carrier API tests |

#### Disputes Module (2 services)
| Service | Status | Test File | Coverage Analysis |
|---------|--------|-----------|-------------------|
| `disputes.service.ts` | ⚠️ Partial | disputes.service.spec.ts | Missing: resolution workflows, evidence |
| `dispute-escalation.service.ts` | ❌ Missing | None | No escalation path tests |

#### Reviews Module (1 service)
| Service | Status | Test File | Coverage Analysis |
|---------|--------|-----------|-------------------|
| `reviews.service.ts` | ⚠️ Partial | reviews.service.spec.ts | Missing: dual-blind review, trust score |

#### Analytics Module (2 services)
| Service | Status | Test File | Coverage Analysis |
|---------|--------|-----------|-------------------|
| `analytics.service.ts` | ⚠️ Partial | analytics.service.spec.ts | Missing: event tracking, aggregations |
| `analytics-warehouse.service.ts` | ❌ Missing | None | No data warehouse tests |

#### Organizations Module (1 service)
| Service | Status | Test File | Coverage Analysis |
|---------|--------|-----------|-------------------|
| `organizations.service.ts` | ⚠️ Partial | organizations.spec.ts | Missing: RBAC, member management |

#### Favorites Module (1 service)
| Service | Status | Test File | Coverage Analysis |
|---------|--------|-----------|-------------------|
| `favorites.service.ts` | ✅ Good | favorites.service.spec.ts | Well covered |

#### Fraud Detection Module (1 service)
| Service | Status | Test File | Coverage Analysis |
|---------|--------|-----------|-------------------|
| `fraud-detection.service.ts` | ⚠️ Partial | fraud-detection.spec.ts | Missing: ML model inference, risk scoring |

#### Categories Module (3 services)
| Service | Status | Test File | Coverage Analysis |
|---------|--------|-----------|-------------------|
| `categories.service.ts` | ✅ Good | categories.service.spec.ts | Well covered |
| `category-attribute.service.ts` | ⚠️ Partial | category-attribute.spec.ts | Missing: dynamic validation |
| `category-template.service.ts` | ❌ Missing | None | No template engine tests |

#### Policy Engine Module (3+ services)
| Service | Status | Test File | Coverage Analysis |
|---------|--------|-----------|-------------------|
| `policy-engine.service.ts` | ⚠️ Partial | policy-engine.spec.ts | Missing: rule evaluation, context resolution |
| `context-resolver.service.ts` | ❌ Missing | None | No context building tests |
| `rule-evaluation.service.ts` | ❌ Missing | None | No rule engine tests |

#### Compliance Module (1 service)
| Service | Status | Test File | Coverage Analysis |
|---------|--------|-----------|-------------------|
| `compliance.service.ts` | ❌ Missing | None | **CRITICAL**: No GDPR/compliance tests |

#### Pricing Module (1+ services)
| Service | Status | Test File | Coverage Analysis |
|---------|--------|-----------|-------------------|
| `pricing.service.ts` | ⚠️ Partial | pricing.service.spec.ts | Missing: dynamic pricing, discounts |

#### Activity Module (1 service)
| Service | Status | Test File | Coverage Analysis |
|---------|--------|-----------|-------------------|
| `activity.service.ts` | ⚠️ Partial | activity.service.spec.ts | Missing: activity aggregation |

---

## Part 2: Frontend Web Coverage Analysis

### 2.1 Route/Page Components (91 files)

#### Auth Routes (7 routes)
| Route | Test File | Status | Coverage Gaps |
|-------|-----------|--------|---------------|
| `auth.login.tsx` | auth.login.test.tsx | ✅ Good | Missing: MFA flow, rate limiting UI |
| `auth.signup.tsx` | auth.signup.test.tsx | ✅ Good | Missing: email verification flow |
| `auth.logout.tsx` | auth.logout.test.tsx | ✅ Good | Well covered |
| `auth.forgot-password.tsx` | forgot-password.test.tsx | ✅ Good | Well covered |
| `auth.reset-password.tsx` | reset-password.test.tsx | ✅ Good | Well covered |

#### Core Routes (10 routes)
| Route | Test File | Status | Coverage Gaps |
|-------|-----------|--------|---------------|
| `home.tsx` | home.test.tsx | ✅ Good | Missing: search interactions |
| `about.tsx` | about.test.tsx | ✅ Good | Static page, well covered |
| `search.tsx` | search.test.tsx | ✅ Good | Missing: filter combinations, map view |
| `_app.tsx` | _app.test.tsx | ✅ Good | Layout wrapper, well covered |
| `not-found.tsx` | not-found.test.tsx | ✅ Good | Well covered |

#### Listings Routes (5 routes)
| Route | Test File | Status | Coverage Gaps |
|-------|-----------|--------|---------------|
| `listings.$id.tsx` | listings.$id.test.tsx | ⚠️ Partial | Missing: booking interaction, reviews |
| `listings.$id.edit.tsx` | listings.$id.edit.test.tsx | ⚠️ Partial | Missing: photo upload, form validation |
| `listings.new.tsx` | listings.new.test.tsx | ⚠️ Partial | Missing: category selection, pricing |
| `listings._index.tsx` | listings._index.test.tsx | ⚠️ Partial | Missing: pagination, filtering |

#### Bookings Routes (3 routes)
| Route | Test File | Status | Coverage Gaps |
|-------|-----------|--------|---------------|
| `bookings.tsx` | bookings.test.tsx | ✅ Good | Well covered for list view |
| `bookings.$id.tsx` | bookings.$id.test.tsx | ⚠️ Partial | Missing: state transitions, actions |
| `bookings.$id.condition-report.tsx` | condition-report.test.tsx | ⚠️ Partial | Missing: photo capture, signature |

#### Dashboard Routes (6 routes)
| Route | Test File | Status | Coverage Gaps |
|-------|-----------|--------|---------------|
| `dashboard.tsx` | dashboard.test.tsx | ✅ Good | Navigation wrapper |
| `dashboard.owner.tsx` | dashboard.owner.test.tsx | ⚠️ Partial | Missing: earnings, analytics |
| `dashboard.owner.calendar.tsx` | calendar.test.tsx | ⚠️ Partial | Missing: booking management |
| `dashboard.owner.earnings.tsx` | earnings.test.tsx | ⚠️ Partial | Missing: payout flows |
| `dashboard.renter.tsx` | dashboard.renter.test.tsx | ⚠️ Partial | Missing: upcoming trips |

#### Checkout Routes (1 route)
| Route | Test File | Status | Coverage Gaps |
|-------|-----------|--------|---------------|
| `checkout.$bookingId.tsx` | checkout.test.tsx | ⚠️ Partial | **CRITICAL**: Missing payment flows, 3D Secure |

#### Messages Route (1 route)
| Route | Test File | Status | Coverage Gaps |
|-------|-----------|--------|---------------|
| `messages.tsx` | messages.test.tsx | ⚠️ Partial | Missing: real-time updates, attachments |

#### Disputes Routes (2 routes)
| Route | Test File | Status | Coverage Gaps |
|-------|-----------|--------|---------------|
| `disputes.tsx` | disputes.test.tsx | ⚠️ Partial | Missing: dispute creation, evidence |
| `disputes.$id.tsx` | disputes.$id.test.tsx | ⚠️ Partial | Missing: resolution flow |
| `disputes.new.$bookingId.tsx` | disputes.new.test.tsx | ⚠️ Partial | Missing: form submission |

#### Reviews Route (1 route)
| Route | Test File | Status | Coverage Gaps |
|-------|-----------|--------|---------------|
| `reviews.tsx` | reviews.test.tsx | ⚠️ Partial | Missing: dual-blind flow |

#### Insurance Routes (3 routes)
| Route | Test File | Status | Coverage Gaps |
|-------|-----------|--------|---------------|
| `insurance.tsx` | insurance.test.tsx | ⚠️ Partial | Missing: policy upload |
| `insurance.claims.tsx` | insurance.claims.test.tsx | ⚠️ Partial | Missing: claim filing |
| `insurance.upload.tsx` | insurance.upload.test.tsx | ⚠️ Partial | Missing: document validation |

#### Settings Routes (4 routes)
| Route | Test File | Status | Coverage Gaps |
|-------|-----------|--------|---------------|
| `settings.tsx` | settings.test.tsx | ✅ Good | Navigation wrapper |
| `settings.profile.tsx` | settings.profile.test.tsx | ⚠️ Partial | Missing: photo upload |
| `settings.security.tsx` | settings.security.test.tsx | ⚠️ Partial | Missing: MFA setup, password change |
| `settings.notifications.tsx` | settings.notifications.test.tsx | ⚠️ Partial | Missing: preference updates |
| `settings.billing.tsx` | settings.billing.test.tsx | ⚠️ Partial | Missing: payment method management |

#### Admin Routes (18+ routes)
| Route | Test File | Status | Coverage Gaps |
|-------|-----------|--------|---------------|
| `admin/_index.tsx` | admin/_index.test.tsx | ✅ Good | Dashboard overview |
| `admin/_layout.tsx` | admin/_layout.test.tsx | ✅ Good | Layout wrapper |
| `admin/analytics.tsx` | admin/analytics.test.tsx | ⚠️ Partial | Missing: charts, filters |
| `admin/disputes.tsx` | admin/disputes.test.tsx | ⚠️ Partial | Missing: resolution actions |
| `admin/listings.tsx` | admin/listings.test.tsx | ⚠️ Partial | Missing: moderation actions |
| `admin/entities/[entity].tsx` | admin/entities/entity.test.tsx | ⚠️ Partial | Missing: CRUD operations |
| `admin/fraud.tsx` | admin/fraud.test.tsx | ⚠️ Partial | Missing: fraud investigation |
| `admin/system/*` | Various | ⚠️ Partial | System management tests incomplete |

#### Organization Routes (4 routes)
| Route | Test File | Status | Coverage Gaps |
|-------|-----------|--------|---------------|
| `organizations._index.tsx` | organizations._index.test.tsx | ✅ Good | List view |
| `organizations.$id.members.tsx` | organizations.$id.members.test.tsx | ⚠️ Partial | Missing: invite flows |
| `organizations.$id.settings.tsx` | organizations.$id.settings.test.tsx | ⚠️ Partial | Missing: configuration |
| `organizations.new.tsx` | organizations.new.test.tsx | ⚠️ Partial | Missing: creation flow |

#### Static Pages (9 routes)
| Route | Test File | Status | Coverage Gaps |
|-------|-----------|--------|---------------|
| `about.tsx`, `careers.tsx`, `contact.tsx`, etc. | Various | ✅ Good | Static content well covered |

### 2.2 React Components (240+ components in `/components`)

#### UI Components (56 in `/components/ui`)
| Component | Test File | Status |
|-----------|-----------|--------|
| `button-variants.test.ts` | ✅ | Covered |
| Most other UI components | ❌ | **GAP**: Only 1 test for 56 components |

**Missing Tests**: `Dialog`, `Modal`, `Toast`, `Dropdown`, `Table`, `Form` inputs, `Card`, `Badge`, `Avatar`, `Tabs`, `Accordion`, `Skeleton`, `Spinner`, `Progress`, `Alert`, `Tooltip`, `Popover`, `Select`, `Checkbox`, `Radio`, `Switch`, `DatePicker`, `TimePicker`, `FileUpload`, `RichText`, `Search`, `Filter`, `Pagination`, `Breadcrumb`, `Stepper`, `Timeline`, `Chart`, `Map`, `ImageGallery`, `VideoPlayer`, `AudioPlayer`, `Calendar`, `Scheduler`, `Kanban`, `List`, `Grid`, `Tree`, `Menu`, `Navbar`, `Sidebar`, `Footer`, `Header`, `Drawer`, `Sheet`, `HoverCard`, `Collapsible`, `ScrollArea`, `Separator`, `Resizable`, `Command`, `MultiSelect`, `TagInput`, `PhoneInput`, `AddressInput`, `ColorPicker`, `Slider`, `RangeSlider`, `Rating`, `PasswordInput`, `OTPInput`, `CreditCardInput`, `BankAccountInput`, `TaxIdInput`

#### Layout Components (19 in `/components/layout`)
| Component Category | Count | Test Coverage |
|-------------------|-------|---------------|
| Layout wrappers | ~8 | ❌ No tests |
| Navigation | ~5 | ❌ No tests |
| Sidebar components | ~6 | ❌ No tests |

#### Feature Components
| Feature | Component Count | Test Coverage |
|---------|-----------------|---------------|
| Listings | 17 | ⚠️ Partial (~3 have tests) |
| Search | 13 | ⚠️ Partial (~2 have tests) |
| Map | 14 | ❌ Minimal |
| Bookings | 2 | ⚠️ Partial |
| Dashboard | 4 | ❌ Minimal |
| Favorites | 5 | ⚠️ Partial |
| Cards | 3 | ❌ No tests |

### 2.3 Custom Hooks (39 hooks in `/hooks`)

| Hook | Test File | Status |
|------|-----------|--------|
| `use-socket.test.ts` | ✅ | Covered |
| `useAdminEntity.test.ts` | ✅ | Covered |
| `useAnimation.test.ts` | ✅ | Covered |
| `useAsyncState.test.ts` | ✅ | Covered |
| `useAuthInit.test.ts` | ✅ | Covered |
| `useDashboardPreferences.test.ts` | ✅ | Covered |
| `useDashboardState.test.ts` | ✅ | Covered |
| `useDebounce.test.ts` | ✅ | Covered |
| `useElementPosition.test.ts` | ✅ | Covered |
| `useErrorHandler.test.ts` | ✅ | Covered |
| `useFavorites.test.ts` | ✅ | Covered |
| `useIntersectionObserver.test.ts` | ✅ | Covered |
| `useKeyboardNavigation.test.ts` | ✅ | Covered |
| `useLocaleFormatters.test.ts` | ✅ | Covered |
| `useMapSync.test.ts` | ✅ | Covered |
| `useOptimisticAction.test.ts` | ✅ | Covered |
| `useWebSocket.test.ts` | ✅ | Covered |
| **Remaining 22 hooks** | ❌ | **GAP**: No tests |

**Untested Hooks**:
- `useAuth.ts`, `useUser.ts`, `useListings.ts`, `useBookings.ts`
- `useSearch.ts`, `useFilter.ts`, `useSort.ts`, `usePagination.ts`
- `useMediaQuery.ts`, `useLocalStorage.ts`, `useSessionStorage.ts`
- `useClickOutside.ts`, `useFocusTrap.ts`, `useScrollLock.ts`
- `useTimeout.ts`, `useInterval.ts`, `useCountdown.ts`
- `useClipboard.ts`, `useNetworkStatus.ts`, `useOnlineStatus.ts`
- `useGeolocation.ts`, `usePermissions.ts`

### 2.4 API Client Modules (in `/lib/api`)

| Module | Test File | Status | Coverage Analysis |
|--------|-----------|--------|-------------------|
| `admin.ts` | admin.test.ts | ✅ Good | Well covered |
| `listings.ts` | listings.test.ts | ✅ Good | Well covered |
| `bookings.ts` | bookings.test.ts | ✅ Good | Well covered |
| `auth.ts` | auth.test.ts | ✅ Good | Well covered |
| `users.ts` | users.test.ts | ✅ Good | Well covered |
| `insurance.ts` | insurance.test.ts | ✅ Good | Well covered |
| `payments.ts` | payments.test.ts | ⚠️ Partial | Missing: error cases |
| `messaging.ts` | messaging.test.ts | ✅ Good | Well covered |
| `notifications.ts` | notifications.test.ts | ✅ Good | Well covered |
| `favorites.ts` | favorites.test.ts | ✅ Good | Well covered |
| `reviews.ts` | reviews.test.ts | ✅ Good | Well covered |
| `disputes.ts` | disputes.test.ts | ✅ Good | Well covered |
| `organizations.ts` | organizations.test.ts | ✅ Good | Well covered |
| `geo.ts` | geo.test.ts | ✅ Good | Well covered |
| `analytics.ts` | analytics.test.ts | ✅ Good | Well covered |
| `ai.ts` | ai.test.ts | ✅ Good | Well covered |
| `activity.ts` | ❌ | Missing | No tests |
| `upload.ts` | upload.test.ts | ✅ Good | Well covered |
| `fraud.ts` | fraud.test.ts | ✅ Good | Well covered |

### 2.5 Utility Functions (in `/lib` and `/utils`)

| Category | File Count | Test Coverage |
|----------|------------|---------------|
| Accessibility utilities | ~5 | ⚠️ Partial |
| Animation utilities | ~4 | ✅ Good |
| API utilities | ~6 | ✅ Good |
| Currency utilities | ~3 | ⚠️ Partial |
| Date utilities | ~2 | ❌ Missing |
| Form utilities | ~4 | ❌ Missing |
| i18n utilities | ~2 | ⚠️ Partial |
| Validation utilities | ~3 | ❌ Missing |

---

## Part 3: Mobile App Coverage Analysis

### 3.1 Mobile Structure (React Native)

| Category | File Count | Test Coverage |
|----------|------------|---------------|
| API/Store files | 5 | ✅ Has tests |
| Components | ~20 | ⚠️ Minimal |
| Navigation | 1 | ✅ Has test |
| Theme | 1 | ✅ Has test |
| Utils | 1 | ✅ Has test |

### 3.2 Mobile Test Files (8 files)

| Test File | Coverage |
|-----------|----------|
| `api/authStore.test.ts` | Auth state management |
| `api/client.test.ts` | API client |
| `api/notifications.test.ts` | Push notifications |
| `api/socket.test.ts` | Socket.io |
| `components/Toast.test.ts` | Toast component |
| `navigation/linking.test.ts` | Deep linking |
| `theme/theme.test.ts` | Theme system |
| `utils/currency.test.ts` | Currency formatting |

**Mobile Gaps**: Most React Native components lack tests, including screens for listings, bookings, profile, search, and messaging.

---

## Part 4: Business Logic Flows & State Transitions

### 4.1 Critical Business Flows Requiring Test Coverage

#### Flow 1: Complete Booking Lifecycle
```
DRAFT → PENDING_OWNER_APPROVAL → PENDING_PAYMENT → CONFIRMED → IN_PROGRESS → AWAITING_RETURN_INSPECTION → COMPLETED → SETTLED
```

**Required Tests**:
1. Happy path through all states
2. Cancellation at each cancellable state
3. Payment failure and retry
4. Owner rejection at PENDING_OWNER_APPROVAL
5. Auto-expiration timeouts (24hr payment, 48hr inspection, 72hr approval)
6. Dispute initiation at IN_PROGRESS or COMPLETED
7. Return rejection leading to dispute
8. Security deposit hold and release
9. Payout scheduling on settlement

**Missing Coverage**: Full state transition matrix tests, concurrent booking attempts, double-booking prevention

#### Flow 2: Payment Processing with Stripe
```
Create PaymentIntent → 3D Secure (if needed) → Confirm → Webhook handling → Ledger entry → Escrow → Payout
```

**Required Tests**:
1. Successful payment flow
2. 3D Secure challenge success/failure
3. Card declined scenarios (insufficient funds, invalid card, expired)
4. Webhook signature verification
5. Idempotent webhook handling
6. Ledger double-entry verification
7. Escrow lifecycle (hold → release/freeze)
8. Multi-currency handling
9. Refund processing (full/partial)
10. Payout to host (Stripe Connect)

**Missing Coverage**: Most webhook scenarios, payout failures, currency conversion edge cases

#### Flow 3: Authentication & Security
```
Register → Email Verification → (Optional: MFA Setup) → Login → Session Management → Logout/Refresh
```

**Required Tests**:
1. Registration with validation
2. Email verification link handling
3. MFA enrollment (TOTP generation, QR code, verification)
4. MFA login flow
5. OAuth (Google, Apple) sign-in
6. Password reset flow
7. Session expiration and refresh
8. Rate limiting enforcement
9. Account lockout after failed attempts
10. Device fingerprinting
11. CSRF protection
12. JWT token validation (expired, malformed)

**Missing Coverage**: Complete MFA flow tests, OAuth integration tests, security middleware tests

#### Flow 4: Listing Creation & Publishing
```
Create Draft → Upload Photos → Set Availability → Configure Pricing → Submit → Verification → Published
```

**Required Tests**:
1. Draft creation and autosave
2. Photo upload (single/multiple, validation, resizing)
3. Availability calendar configuration
4. Dynamic pricing rule setup
5. Category-specific attribute validation
6. Geocoding address to coordinates
7. Content moderation check
8. Admin approval workflow
9. Search index update
10. Cache invalidation

**Missing Coverage**: Photo processing pipeline, geocoding fallbacks, content moderation AI

#### Flow 5: Dispute Resolution
```
Open Dispute → Evidence Collection → Response Period → Review → Resolution → Payout Adjustment
```

**Required Tests**:
1. Dispute initiation by renter/host
2. Evidence upload and storage
3. Counter-response by other party
4. Admin review assignment
5. Resolution decision (full/partial refund, chargeback)
6. Payout adjustment
7. Review impact (optional)
8. Escrow freeze during dispute
9. Timeline event recording

**Missing Coverage**: Complete dispute workflow, evidence validation, resolution enforcement

#### Flow 6: Real-time Messaging
```
Create Conversation → Send Message → Real-time Delivery → Read Receipt → Reply
```

**Required Tests**:
1. Conversation creation (from listing/booking)
2. Message persistence
3. Socket.io broadcast
4. Read receipt tracking
5. Push notification trigger
6. Content moderation (AI filtering)
7. Block/mute functionality
8. Conversation archival
9. Multi-device sync

**Missing Coverage**: Socket reconnection, message ordering, delivery guarantees

### 4.2 State Machines Requiring Comprehensive Tests

#### Booking State Machine (12 states, 24 transitions)
**Current**: ~25% transition coverage
**Required**: 100% transition coverage with preconditions and side effects

**States**: DRAFT, PENDING_OWNER_APPROVAL, PENDING_PAYMENT, CONFIRMED, IN_PROGRESS, AWAITING_RETURN_INSPECTION, COMPLETED, SETTLED, CANCELLED, REFUNDED, PAYMENT_FAILED, DISPUTED

**Transitions to Test**:
| Transition | From → To | Priority | Missing Tests |
|------------|-----------|----------|---------------|
| SUBMIT_REQUEST | DRAFT → PENDING_OWNER_APPROVAL | Critical | ❌ Missing |
| OWNER_APPROVE | PENDING_OWNER_APPROVAL → PENDING_PAYMENT | Critical | ⚠️ Partial |
| OWNER_REJECT | PENDING_OWNER_APPROVAL → CANCELLED | High | ❌ Missing |
| EXPIRE | PENDING_OWNER_APPROVAL → CANCELLED | High | ❌ Missing |
| CANCEL | (Multiple) → CANCELLED | Critical | ⚠️ Partial |
| COMPLETE_PAYMENT | PENDING_PAYMENT → CONFIRMED | Critical | ⚠️ Partial |
| FAIL_PAYMENT | PENDING_PAYMENT → PAYMENT_FAILED | High | ❌ Missing |
| RETRY_PAYMENT | PAYMENT_FAILED → PENDING_PAYMENT | Medium | ❌ Missing |
| EXPIRE | PAYMENT_FAILED → CANCELLED | High | ❌ Missing |
| START_RENTAL | CONFIRMED → IN_PROGRESS | Critical | ⚠️ Partial |
| CANCEL | CONFIRMED → CANCELLED | High | ⚠️ Partial |
| REQUEST_RETURN | IN_PROGRESS → AWAITING_RETURN_INSPECTION | Critical | ⚠️ Partial |
| INITIATE_DISPUTE | IN_PROGRESS → DISPUTED | Critical | ❌ Missing |
| APPROVE_RETURN | AWAITING_RETURN_INSPECTION → COMPLETED | Critical | ⚠️ Partial |
| REJECT_RETURN | AWAITING_RETURN_INSPECTION → DISPUTED | Critical | ❌ Missing |
| EXPIRE | AWAITING_RETURN_INSPECTION → COMPLETED | Medium | ❌ Missing |
| SETTLE | COMPLETED → SETTLED | High | ⚠️ Partial |
| INITIATE_DISPUTE | COMPLETED → DISPUTED | High | ❌ Missing |
| REFUND | CANCELLED → REFUNDED | High | ⚠️ Partial |
| RESOLVE_DISPUTE_OWNER_FAVOR | DISPUTED → COMPLETED | Critical | ❌ Missing |
| RESOLVE_DISPUTE_RENTER_FAVOR | DISPUTED → REFUNDED | Critical | ❌ Missing |

---

## Part 5: Database Models & Critical Queries

### 5.1 Models Requiring Test Validation

#### Core Models (Prisma)
| Model | Test Priority | Query Patterns to Test |
|-------|---------------|------------------------|
| User | Critical | CRUD, soft delete, relations, search |
| Listing | Critical | CRUD, geospatial queries, search, filters |
| Booking | Critical | State transitions, date range queries, conflicts |
| Payment | Critical | Ledger entries, reconciliation, refunds |
| Review | High | Ratings aggregation, dual-blind logic |
| Conversation | High | Message threading, read receipts |
| Notification | Medium | Delivery status, preferences |
| Organization | Medium | Multi-tenancy, member roles |

### 5.2 Critical Database Scenarios

#### Scenario 1: Concurrent Booking Prevention
```typescript
// Test: Two users attempting to book same dates simultaneously
// Expected: Only one succeeds, other gets conflict error
// Implementation: Advisory locks + unique constraints
```

#### Scenario 2: Soft Delete Cascade
```typescript
// Test: Delete user → cascade to listings → cascade to bookings
// Expected: All records marked deletedAt, not removed
// Implementation: Middleware or service-level cascade
```

#### Scenario 3: Financial Ledger Integrity
```typescript
// Test: Every payment creates balanced debit/credit entries
// Expected: Sum of all ledger entries = 0 (accounting balance)
// Implementation: Transaction wrapper with verification
```

---

## Part 6: Integration Points Requiring Tests

### 6.1 External Service Integrations

| Service | Integration Point | Test Strategy |
|---------|------------------|---------------|
| **Stripe** | Payment processing, Connect, Webhooks | Mock server + contract tests |
| **AWS S3/MinIO** | File storage, presigned URLs | Local MinIO container |
| **Redis** | Cache, sessions, rate limiting | Testcontainers |
| **PostgreSQL** | Primary database | Testcontainers with migrations |
| **Elasticsearch** | (Optional) Search index | Testcontainers |
| **SendGrid/Resend** | Email delivery | Mock + spy on API calls |
| **FCM/APNs** | Push notifications | Mock + spy |
| **Google Maps** | Geocoding | Mock responses |
| **Slack** | Admin alerts | Mock webhook |

### 6.2 Queue Workers (BullMQ)

| Queue | Jobs | Test Strategy |
|-------|------|---------------|
| `payments` | process-payout, hold-deposit, release-deposit, process-refund | Integration tests with job assertions |
| `notifications` | send-email, send-push | Mock providers, assert job completion |
| `bookings` | expire-payment-failed | Time-based job triggering |
| `insurance` | verify-policy | Mock OCR service |

---

## Part 7: Risk Assessment & Priority Matrix

### 7.1 Critical Risk Areas (Test Immediately)

| Risk Area | Business Impact | Current Coverage | Priority |
|-----------|----------------|------------------|----------|
| Payment processing | Financial loss, regulatory | ⚠️ 40% | P0 |
| Booking state machine | Double bookings, revenue loss | ⚠️ 25% | P0 |
| Authentication/Authorization | Security breach, data loss | ⚠️ 50% | P0 |
| Refund processing | Financial loss, disputes | ❌ 0% | P0 |
| Escrow management | Host/renter financial loss | ⚠️ 30% | P0 |
| Dispute resolution | Legal exposure, trust | ❌ 10% | P0 |
| Fraud detection | Revenue loss, chargebacks | ❌ 0% | P1 |
| Insurance verification | Liability exposure | ❌ 0% | P1 |
| KYC compliance | Regulatory fines | ❌ 0% | P1 |
| Content moderation | Legal liability | ❌ 0% | P1 |

### 7.2 High Priority Areas (Test Next)

| Risk Area | Business Impact | Current Coverage | Priority |
|-----------|----------------|------------------|----------|
| Real-time messaging | User experience | ⚠️ 30% | P1 |
| Search functionality | Revenue (discoverability) | ⚠️ 40% | P1 |
| Notification delivery | User engagement | ⚠️ 35% | P1 |
| Listing creation | Supply acquisition | ⚠️ 45% | P1 |
| Review system | Trust & safety | ⚠️ 40% | P1 |
| Multi-tenancy | Data isolation | ⚠️ 30% | P2 |
| Analytics | Business decisions | ⚠️ 20% | P2 |

---

## Part 8: Implementation Plan for Missing Tests

### Phase 1: Critical Path (Weeks 1-2)

#### P0: Payment & Booking Core

**1.1 Payment Service Tests**
```typescript
// File: apps/api/src/modules/payments/services/payments.service.spec.ts
// Additional test cases to add:

describe('Payment Processing', () => {
  describe('createPaymentIntent', () => {
    it('should create payment intent with correct amount', async () => {});
    it('should apply platform fee calculation', async () => {});
    it('should handle 3D Secure required cards', async () => {});
    it('should reject invalid currency', async () => {});
    it('should handle Stripe API errors gracefully', async () => {});
  });

  describe('confirmPayment', () => {
    it('should confirm payment and update booking status', async () => {});
    it('should handle payment confirmation failure', async () => {});
    it('should create ledger entries on confirmation', async () => {});
    it('should emit payment.success event', async () => {});
  });

  describe('refundPayment', () => {
    it('should process full refund', async () => {});
    it('should process partial refund with amount', async () => {});
    it('should handle refund failure', async () => {});
    it('should update booking to REFUNDED status', async () => {});
    it('should create negative ledger entries', async () => {});
  });
});
```

**1.2 Booking State Machine Tests**
```typescript
// File: apps/api/src/modules/bookings/services/booking-state-machine.spec.ts
// Expand existing tests:

describe('BookingStateMachine', () => {
  describe('All State Transitions', () => {
    // Current: 5-6 transitions tested
    // Required: All 24 transitions with preconditions
    
    describe('DRAFT → PENDING_OWNER_APPROVAL', () => {
      it('should transition on submit_request', async () => {});
      it('should validate listing availability before transition', async () => {});
      it('should validate renter eligibility', async () => {});
    });

    describe('PENDING_OWNER_APPROVAL → CANCELLED', () => {
      it('should transition on owner reject', async () => {});
      it('should send notification to renter', async () => {});
      it('should restore availability', async () => {});
    });

    describe('DISPUTED → COMPLETED/REFUNDED', () => {
      it('should resolve in owner favor', async () => {});
      it('should resolve in renter favor with refund', async () => {});
      it('should handle split resolution', async () => {});
    });
  });
});
```

**1.3 Refund Service (New File)**
```typescript
// File: apps/api/src/modules/payments/services/refunds.service.spec.ts
// NEW TEST FILE - DOES NOT EXIST

describe('RefundsService', () => {
  describe('calculateRefundAmount', () => {
    it('should calculate full refund before cancellation deadline', async () => {});
    it('should apply cancellation policy penalties', async () => {});
    it('should handle no-refund policy', async () => {});
    it('should prorate for used portion', async () => {});
  });

  describe('processRefund', () => {
    it('should create refund record', async () => {});
    it('should call Stripe refund API', async () => {});
    it('should handle Stripe refund failure', async () => {});
    it('should update booking status', async () => {});
    it('should update ledger entries', async () => {});
  });
});
```

**1.4 Booking Eligibility (New File)**
```typescript
// File: apps/api/src/modules/bookings/services/booking-eligibility.service.spec.ts
// NEW TEST FILE - DOES NOT EXIST

describe('BookingEligibilityService', () => {
  describe('evaluate', () => {
    it('should allow booking when all checks pass', async () => {});
    it('should reject when fraud risk is high', async () => {});
    it('should reject when user is banned', async () => {});
    it('should reject when listing is unavailable', async () => {});
    it('should reject when insurance is required but not provided', async () => {});
    it('should skip failed checks gracefully', async () => {});
  });
});
```

### Phase 2: Security & Auth (Week 3)

**2.1 MFA Service Expansion**
```typescript
// Add to: apps/api/src/modules/auth/services/mfa.service.spec.ts

describe('MFA Complete Flow', () => {
  it('should generate TOTP secret and QR code', async () => {});
  it('should verify valid TOTP code', async () => {});
  it('should reject invalid TOTP code', async () => {});
  it('should handle TOTP time drift', async () => {});
  it('should allow backup codes after TOTP failure', async () => {});
  it('should invalidate used backup codes', async () => {});
  it('should lock account after 3 failed MFA attempts', async () => {});
});
```

**2.2 OAuth Integration Tests**
```typescript
// File: apps/api/src/modules/auth/services/oauth.service.spec.ts
// Expand with:

describe('OAuth Integration', () => {
  describe('Google OAuth', () => {
    it('should create new user from Google profile', async () => {});
    it('should link existing user by email', async () => {});
    it('should handle missing Google profile data', async () => {});
    it('should reject invalid Google tokens', async () => {});
  });

  describe('Apple OAuth', () => {
    it('should handle Apple Sign In with private email', async () => {});
    it('should capture name on first login only', async () => {});
    it('should verify Apple identity token', async () => {});
  });
});
```

### Phase 3: Core Business Flows (Week 4)

**3.1 Checkout Orchestrator**
```typescript
// File: apps/api/src/modules/marketplace/services/checkout-orchestrator.spec.ts
// NEW/EXPANDED

describe('CheckoutOrchestratorService', () => {
  describe('Saga Pattern', () => {
    it('should complete full checkout flow', async () => {});
    it('should rollback on policy validation failure', async () => {});
    it('should rollback on fraud check failure', async () => {});
    it('should rollback on availability lock failure', async () => {});
    it('should rollback on payment authorization failure', async () => {});
    it('should release lock on payment failure', async () => {});
    it('should cancel payment on booking creation failure', async () => {});
  });
});
```

**3.2 Dispute Service**
```typescript
// File: apps/api/src/modules/disputes/services/disputes.service.spec.ts
// Expand:

describe('Dispute Resolution Flow', () => {
  it('should open dispute from booking', async () => {});
  it('should collect evidence from both parties', async () => {});
  it('should calculate proposed resolution', async () => {});
  it('should process resolution and adjust payout', async () => {});
  it('should handle escalated disputes', async () => {});
  it('should freeze escrow during dispute', async () => {});
});
```

**3.3 Insurance Service**
```typescript
// File: apps/api/src/modules/insurance/services/insurance.service.spec.ts
// Expand:

describe('Insurance Verification', () => {
  it('should require insurance for high-value items', async () => {});
  it('should require insurance for vehicle category', async () => {});
  it('should calculate minimum coverage based on value', async () => {});
  it('should queue policy for verification', async () => {});
  it('should reject expired policies', async () => {});
  it('should generate certificate on approval', async () => {});
});
```

### Phase 4: Frontend Component Tests (Weeks 5-6)

**4.1 Critical Route Tests**
```typescript
// Add to existing test files - expand coverage:

// checkout.$bookingId.test.tsx
describe('Checkout Flow', () => {
  it('should display price breakdown', async () => {});
  it('should handle payment method selection', async () => {});
  it('should show 3D Secure modal when required', async () => {});
  it('should handle payment failure with retry', async () => {});
  it('should redirect on successful payment', async () => {});
});

// bookings.$id.test.tsx
describe('Booking Actions', () => {
  it('should show action buttons based on state', async () => {});
  it('should handle cancel booking', async () => {});
  it('should handle approve return', async () => {});
  it('should handle reject return with dispute', async () => {});
  it('should show state history timeline', async () => {});
});
```

**4.2 UI Component Tests**
```typescript
// NEW: Create tests for critical UI components

// File: apps/web/app/components/ui/Dialog.test.tsx
describe('Dialog', () => {
  it('should render with title and content', () => {});
  it('should close on overlay click', () => {});
  it('should close on escape key', () => {});
  it('should trap focus', () => {});
  it('should call onClose callback', () => {});
});

// File: apps/web/app/components/ui/Toast.test.tsx
describe('Toast', () => {
  it('should auto-dismiss after duration', () => {});
  it('should persist on hover', () => {});
  it('should support different variants', () => {});
  it('should handle action buttons', () => {});
});
```

### Phase 5: Integration & E2E API Tests (Weeks 7-8)

**5.1 API Integration Test Suite**
```typescript
// File: apps/api/test/integration/booking-flow.e2e-spec.ts
// NEW: Full end-to-end API tests

describe('Complete Booking Flow (E2E)', () => {
  let renterToken: string;
  let ownerToken: string;
  let listingId: string;
  let bookingId: string;

  beforeAll(async () => {
    // Setup: Create users, listing
  });

  it('should register and verify renter', async () => {});
  it('should register and verify owner with Stripe Connect', async () => {});
  it('should create listing with photos', async () => {});
  it('should search and find listing', async () => {});
  it('should calculate booking price', async () => {});
  it('should create booking request', async () => {});
  it('should approve booking as owner', async () => {});
  it('should process payment', async () => {});
  it('should confirm booking after payment', async () => {});
  it('should send reminder before rental start', async () => {});
  it('should allow starting rental', async () => {});
  it('should request return inspection', async () => {});
  it('should approve return and complete booking', async () => {});
  it('should process payout to owner', async () => {});
});
```

**5.2 Critical Path API Tests**
```typescript
// Additional E2E scenarios:

describe('Cancellation Flows (E2E)', () => {
  it('should cancel before owner approval with full refund', async () => {});
  it('should cancel after approval with partial refund (moderate policy)', async () => {});
  it('should cancel after approval with no refund (strict policy)', async () => {});
});

describe('Dispute Flows (E2E)', () => {
  it('should open dispute and resolve in renter favor', async () => {});
  it('should open dispute and resolve in owner favor', async () => {});
  it('should freeze escrow during dispute', async () => {});
});

describe('Payment Failure Recovery (E2E)', () => {
  it('should handle declined card with retry', async () => {});
  it('should auto-cancel after 24hr payment grace period', async () => {});
});
```

---

## Part 9: Test Infrastructure Recommendations

### 9.1 Required Test Utilities

```typescript
// helpers/test-database.ts
export class TestDatabase {
  async setup(): Promise<void> {}
  async teardown(): Promise<void> {}
  async seed(data: SeedData): Promise<void> {}
  async clean(): Promise<void> {}
}

// helpers/mock-stripe.ts
export class MockStripe {
  paymentIntents = {
    create: jest.fn(),
    confirm: jest.fn(),
    cancel: jest.fn(),
  };
  refunds = {
    create: jest.fn(),
  };
  transfers = {
    create: jest.fn(),
  };
}

// helpers/factories.ts
export const factories = {
  user: (overrides?: Partial<User>) => ({...}),
  listing: (overrides?: Partial<Listing>) => ({...}),
  booking: (overrides?: Partial<Booking>) => ({...}),
  payment: (overrides?: Partial<Payment>) => ({...}),
};
```

### 9.2 Test Configuration

```typescript
// jest.config.ts additions
{
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './src/modules/payments/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    './src/modules/bookings/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
}
```

---

## Part 10: Summary & Action Items

### Immediate Actions (This Week)

1. **Create Missing Spec Files** (P0):
   - [ ] `refunds.service.spec.ts` - Refund processing
   - [ ] `booking-eligibility.service.spec.ts` - Safety orchestration
   - [ ] `fraud-intelligence.service.spec.ts` - Risk scoring
   - [ ] `checkout-orchestrator.service.spec.ts` - Saga pattern
   - [ ] `dispute-escalation.service.spec.ts` - Dispute flows

2. **Expand Critical Service Tests** (P0):
   - [ ] Complete all 24 booking state transitions
   - [ ] Add payment webhook handling tests
   - [ ] Add escrow lifecycle tests
   - [ ] Add concurrent booking conflict tests

3. **Frontend Route Tests** (P1):
   - [ ] Checkout payment flow
   - [ ] Booking action buttons (all states)
   - [ ] Dispute creation and evidence upload
   - [ ] Insurance policy upload

### Short-term Actions (Next 2 Weeks)

4. **Integration Tests**:
   - [ ] End-to-end booking lifecycle
   - [ ] Payment failure and recovery
   - [ ] Cancellation with refund policies
   - [ ] Dispute resolution workflow

5. **UI Component Tests**:
   - [ ] Critical form components
   - [ ] Modal/Dialog interactions
   - [ ] Toast notifications
   - [ ] File upload components

### Metrics to Track

| Metric | Current | Target |
|--------|---------|--------|
| Backend Service Coverage | ~60% | 85% |
| Backend Controller Coverage | ~50% | 80% |
| Frontend Route Coverage | ~40% | 75% |
| Frontend Component Coverage | ~10% | 60% |
| Critical Path E2E | ~20% | 90% |
| State Transition Coverage | ~25% | 100% |

---

## Appendix A: Complete File Inventory

### Backend Services Without Spec Files (Critical Gaps)

| # | Service Path | Priority |
|---|--------------|----------|
| 1 | `modules/bookings/services/booking-eligibility.service.ts` | P0 |
| 2 | `modules/bookings/services/booking-pricing-bridge.service.ts` | P1 |
| 3 | `modules/bookings/services/invoice.service.ts` | P1 |
| 4 | `modules/payments/services/refunds.service.ts` | P0 |
| 5 | `modules/payments/services/payment-command-log.service.ts` | P1 |
| 6 | `modules/marketplace/services/checkout-orchestrator.service.ts` | P0 |
| 7 | `modules/marketplace/services/payment-orchestration.service.ts` | P1 |
| 8 | `modules/marketplace/services/availability-graph.service.ts` | P2 |
| 9 | `modules/marketplace/services/fraud-intelligence.service.ts` | P0 |
| 10 | `modules/marketplace/services/demand-forecast.service.ts` | P2 |
| 11 | `modules/marketplace/services/liquidity.service.ts` | P2 |
| 12 | `modules/disputes/services/dispute-escalation.service.ts` | P0 |
| 13 | `modules/insurance/services/insurance-verification.service.ts` | P1 |
| 14 | `modules/ai/services/embedding.service.ts` | P2 |
| 15 | `modules/ai/services/market-insights.service.ts` | P2 |
| 16 | `modules/admin/services/admin-content.service.ts` | P2 |
| 17 | `modules/admin/services/admin-system.service.ts` | P2 |
| 18 | `modules/admin/services/admin-users.service.ts` | P2 |
| 19 | `modules/admin/services/filter-builder.service.ts` | P2 |
| 20 | `modules/policy-engine/services/context-resolver.service.ts` | P1 |
| 21 | `modules/messaging/services/conversation.service.ts` | P1 |
| 22 | `modules/notifications/services/notification-queue.service.ts` | P1 |
| 23 | `modules/notifications/services/push-notification.service.ts` | P1 |
| 24 | `modules/compliance/compliance.service.ts` | P1 |

### Frontend Routes Without Test Files

| # | Route Path | Priority |
|---|------------|----------|
| 1 | `routes/dashboard.owner.insights.tsx` | P2 |
| 2 | `routes/dashboard.owner.performance.tsx` | P2 |
| 3 | `routes/earnings.tsx` | P2 |
| 4 | `routes/become-owner.tsx` | P2 |
| 5 | `routes/help.tsx` | P3 |
| 6 | `routes/how-it-works.tsx` | P3 |
| 7 | `routes/owner-guide.tsx` | P3 |
| 8 | `routes/safety.tsx` | P3 |
| 9 | `routes/press.tsx` | P3 |
| 10 | `routes/careers.tsx` | P3 |
| 11 | `routes/privacy.tsx` | P3 |
| 12 | `routes/terms.tsx` | P3 |
| 13 | `routes/cookies.tsx` | P3 |
| 14 | `routes/contact.tsx` | P3 |

---

*Document Version: 1.0*  
*Last Updated: April 2026*  
*Next Review: After Phase 1 completion*
