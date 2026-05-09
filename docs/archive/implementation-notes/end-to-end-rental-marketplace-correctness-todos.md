I executed the tailored root-cause audit against `samujjwal/rental` at commit `6913fc8e9257adf7ea27c071dcbf4f8f8880b5b0` using the pasted audit structure. 

I reviewed the repo through GitHub connector evidence only. I did **not** run build, lint, typecheck, migrations, or tests locally, so runtime pass/fail is marked as **not verified** where applicable.

# 7.1 Production Readiness Verdict

**Production ready: No**

**Confidence level:** High for architectural/readiness blockers; medium for exact runtime failures because I did not execute tests.

The repo has a credible production direction: canonical docs exist, the monorepo shape is clear, and the product vision matches the implemented domains: web, API, mobile, Prisma, Stripe Connect, Socket.io/Redis, booking, payments, disputes, insurance, organizations, and admin operations. The README describes this as a Turbo monorepo with `apps/api`, `apps/web`, `apps/mobile`, and `packages/database`, using NestJS, React Router, Expo, Prisma/Postgres, Stripe Connect, Socket.io, Redis, and Docker.  Canonical documentation is also now organized under `docs/` with product, architecture, engineering, operations, QA, users, traceability, and archive sections. 

However, the implementation is **not production-ready** because several critical paths still contain production-breaking or production-risk patterns:

Main blockers:

1. Storage/upload endpoints are disabled to unblock compilation.
2. Idempotency is in-memory and not request/user/route fingerprinted.
3. Critical state mutations are only partially idempotent.
4. Booking/payment route contracts drift between tests, API, and clients.
5. Pricing/payment logic still contains mock/simplified production paths.
6. Organization/team scope is not consistently enforced in booking/payment surfaces.
7. Availability has overlapping models and query paths.
8. Web/mobile/API parity is not proven.
9. Smoke/E2E tests include stale endpoint expectations.
10. Cleanup is still needed for deprecated fields, duplicate lifecycle systems, and archived/generated docs.

Highest-risk area: **booking + payment + refund + storage evidence lifecycle**, because it combines money movement, availability locking, disputes, condition reports, uploads, and state transitions.

# 7.2 Root Architectural Blockers

## P0-1 Storage and evidence upload path is disabled

**Why it matters:** Listing photos, avatars, organization logos, dispute evidence, condition reports, insurance evidence, and user documents all depend on reliable upload/download/delete behavior.

**Root cause:** The storage controller exists but its endpoints are commented out with a TODO saying the storage endpoints need to be reimplemented and are temporarily disabled to unblock compilation. 

**Evidence:**

* `apps/api/src/common/storage/storage.controller.ts`
* Disabled endpoints include upload, presigned upload/download, file delete, list files, listing photos, user avatar, organization logo, statistics, S3 test, bucket exists, and ensure bucket. 

**Affected surfaces:**

* Listing creation/edit media
* Profile/avatar
* Organization branding
* Disputes evidence
* Insurance claims
* Condition reports
* KYC/identity documents
* Admin moderation

**Target pattern:** A production upload service with scoped object keys, MIME/size validation, ownership checks, signed URLs, malware/content validation if needed, audit events, lifecycle cleanup, and tests.

**Required fix:** Re-enable storage endpoints through the updated `StorageService` API; route every file upload through canonical ownership/scope validation.

**Required tests:** Upload/listing-photo/avatar/org-logo/dispute-evidence/condition-report/insurance-claim tests with unauthorized, wrong-owner, oversized, bad-MIME, deleted-object, and signed URL expiry cases.

**Cleanup implication:** Remove commented production code after reimplementation; do not keep “temporarily disabled” code in production files.

---

## P0-2 Idempotency is not production-safe

**Why it matters:** Booking creation, refund, payment, payout, deposit, and state transitions must be safe under retries, mobile double-taps, network timeouts, webhook retries, and distributed deployments.

**Root cause:** The global idempotency interceptor uses a process-local `Map`, keyed only by `Idempotency-Key`, with no route, user, request body hash, tenant/org scope, or persisted backing store. The code itself notes that production should use Redis, request fingerprinting, and invalidation strategies. 

**Evidence:**

* `apps/api/src/common/guards/idempotency.guard.ts`
* `AppModule` registers the interceptor globally, but it only applies to decorated endpoints. 
* Booking create has `@Idempotent()`, but many critical booking mutations do not. 
* Mobile booking client sends create/approve/cancel/reject/start/request-return calls without any visible idempotency key handling. 

**Affected surfaces:**

* Create booking
* Payment intent creation
* Refund request
* Booking approval/rejection/cancel/start/return/dispute
* Deposit release
* Payout
* Mobile client retries

**Target pattern:** Persistent Redis/Postgres idempotency table keyed by actor + route + method + request fingerprint + idempotency key, with TTL, response replay, conflict detection, and replay-safe error semantics.

**Required fix:** Replace process-local `Map` with durable idempotency storage and require keys for every money/state-changing mutation.

**Required tests:** Concurrent retry tests, same key/different payload conflict tests, cross-user key reuse tests, process restart tests, duplicate mobile submit tests, webhook retry tests.

**Cleanup implication:** Remove the simplified Map implementation from production path.

---

## P0-3 Booking lifecycle is strong but still has enum/state and side-effect consistency risks

**Why it matters:** Booking is the core marketplace lifecycle. Invalid states, stale transitions, or duplicate side effects can corrupt availability, refunds, payouts, condition reports, deposits, and disputes.

**Root cause:** The repo has a real booking state machine with optimistic locking and state history, which is good. It defines transitions and writes state history in the same transaction.  But the implementation also casts `MANUAL_REVIEW` as `BookingStatus`, and the Prisma schema stores booking status and state-history status as `BookingStatus`, so the enum must be verified end-to-end. 

**Evidence:**

* `BookingStateMachineService` defines transitions and optimistic locking. 
* `BookingsService.create` can move a booking into manual review when tax, constraints, or safety checks fail. 
* Prisma stores `Booking.status` and `BookingStateHistory.toStatus` as `BookingStatus`. 
* The state machine triggers side effects after transition, including notifications, deposit hold, settlement, refund, condition reports, and admin dispute notification. 

**Affected surfaces:**

* Booking create
* Manual review
* Payment confirmation
* Refund
* Payout
* Deposit hold/release
* Condition reports
* Dispute resolution

**Target pattern:** One canonical booking state enum, one transition registry, one state-effect outbox, and generated web/mobile/API contracts.

**Required fix:** Verify `MANUAL_REVIEW` exists in Prisma enum and shared types; move side effects to durable outbox/command records where they must be exactly-once or retryable.

**Required tests:** Full transition matrix against generated Prisma enum, manual-review approval/rejection tests, outbox retry tests, state-history tests, and duplicate side-effect prevention tests.

**Cleanup implication:** Remove all casts used to bypass enum correctness.

---

## P0-4 Pricing and payment parity is not yet production-grade

**Why it matters:** Rental pricing must match search, listing detail, booking preview, checkout, invoice, refunds, payouts, and ledger entries.

**Root cause:** Pricing is split across booking pricing ports, policy engine, booking calculation service, payment controller, ledger, and persisted price breakdowns. Some parts are good, but `BookingCalculationService` still contains mock/simplified pricing behavior, including mock add-on pricing, simplified tax recalculation, and hardcoded loyalty/seasonal adjustments. 

**Evidence:**

* `BookingCalculationService.calculatePrice` uses policy engine or config fallbacks for taxes/fees. 
* `calculateModificationPrice` uses a hardcoded add-on service price and simplified tax recalculation. 
* `calculateLoyaltyDiscount` uses default/hardcoded loyalty and seasonal behavior. 
* `PaymentsController` creates payment intents and payment records, but the current API path is `POST /payments/intents/:bookingId`. 
* The E2E test still expects `/api/payments/create-intent`, which does not match the fetched controller. 

**Affected surfaces:**

* Search/listing price display
* Booking calculate-price
* Booking create
* Checkout
* Payment intent
* Invoice
* Refund
* Owner earnings
* Payout
* Ledger

**Target pattern:** One canonical pricing engine with versioned quote snapshots used by booking, payment, invoice, refund, payout, and ledger.

**Required fix:** Remove mock pricing paths, persist quote snapshots, enforce quote-to-payment parity, and align API clients/tests to real routes.

**Required tests:** Golden-master pricing tests for day/week/month/hour, taxes, fees, discounts, deposits, refunds, payouts, ledger, invoice, and web/mobile checkout parity.

**Cleanup implication:** Delete mock add-on/seasonal logic or move incomplete features behind explicit feature flags.

---

## P0-5 API/test/client route contracts are drifting

**Why it matters:** Stale tests create false confidence and repeated audit noise.

**Root cause:** Some E2E tests call routes that do not match the current controller. This means coverage may be testing old contracts rather than the current application.

**Evidence:**

* Current `BookingsController` exposes `POST /bookings/:id/start`. 
* The booking lifecycle E2E test calls `/api/bookings/:id/start-rental`. 
* Current `PaymentsController` exposes `POST /payments/intents/:bookingId`. 
* The booking lifecycle E2E test calls `/api/payments/create-intent`. 
* The same E2E file also expects routes such as booking payments, audit logs, archive, payout-create, and refund paths that were not visible in the fetched controllers. 

**Affected surfaces:**

* API E2E
* Playwright E2E
* Mobile client
* Web client
* Release confidence

**Target pattern:** Generated route contract or shared API client used by web, mobile, and tests.

**Required fix:** Create a route/action registry; update all E2E tests and clients to current controller routes.

**Required tests:** Contract tests that fail if a route exists in client/tests but not in API controller metadata.

**Cleanup implication:** Delete or quarantine stale E2E tests until aligned.

---

## P1-6 Organization/team scope is incomplete in booking/payment surfaces

**Why it matters:** The product vision includes owners operating individually or as organizations. Organization-owned listings, bookings, earnings, and team actions must not be treated as simple owner-user ownership only.

**Root cause:** The schema supports organizations and organization members.  But booking queries and payment checks reviewed here mostly use `listing.ownerId`, `booking.ownerId`, or renter/owner direct checks rather than a canonical organization scope resolver.

**Evidence:**

* `getOwnerBookings` filters bookings through `listing.ownerId`. 
* `findById` allows renter, listing owner, or admin. 
* Payment release/refund logic uses local admin checks in some places instead of the centralized role helper. 
* The architecture docs name identity and organization as a dominant domain, and owner organization flows as part of the system. 

**Affected surfaces:**

* Owner dashboard
* Organization dashboard
* Organization-owned listings
* Bookings
* Earnings
* Payouts
* Ledger
* Messages
* Disputes
* Admin support

**Target pattern:** Canonical `ScopeResolver` and `PermissionGuard` used everywhere.

**Required fix:** Implement one organization/user/admin/support access policy and replace direct `ownerId === userId` checks where organization delegation applies.

**Required tests:** Individual owner, org owner, org admin, org member, renter, support admin, finance admin, and unrelated user access matrix.

**Cleanup implication:** Remove scattered local role/scope checks.

---

## P1-7 Availability has duplicate representations

**Why it matters:** Availability is the marketplace’s inventory lock. Duplicate models create double-booking and stale blocked-date risk.

**Root cause:** The schema contains both `Availability` and `AvailabilitySlot`, while booking creation uses a reservation service and blocked-date retrieval combines bookings with the older `availability` table.  

**Evidence:**

* `Availability` uses `propertyId`, start/end, and status. 
* `AvailabilitySlot` uses listing, optional inventory unit, start/end, status, booking, and version. 
* `BookingsService.getBlockedDates` queries bookings plus `prisma.availability.findMany`. 

**Affected surfaces:**

* Search availability filters
* Listing detail calendar
* Booking creation
* Blocked dates
* Inventory-unit rentals
* Owner calendar
* Mobile availability

**Target pattern:** One canonical availability engine, likely `AvailabilitySlot` + inventory units, with legacy `Availability` migrated or clearly scoped.

**Required fix:** Decide canonical availability model; migrate old blocked-date paths; add conflict tests around concurrent bookings.

**Required tests:** Same listing/date concurrent booking, inventory-unit booking, owner-blocked periods, search filter parity, listing-detail calendar parity, cancellation release.

**Cleanup implication:** Deprecate/remove old availability paths after migration.

---

## P1-8 Web/mobile/API parity is partial

**Why it matters:** The repo supports web and mobile. Both must behave consistently for booking, pricing, state transitions, invoices, messages, and payments.

**Root cause:** Mobile has its own booking client with direct endpoint strings and no visible idempotency key behavior.  Web tests verify portal layout, but not the full lifecycle across all routes. 

**Evidence:**

* Mobile client directly calls `/bookings`, `/bookings/:id/approve`, `/cancel`, `/reject`, `/start`, `/request-return`, `/approve-return`, `/reject-return`, and invoice. 
* Portal layout tests validate shared shell, dashboard, bookings, favorites, messages, notifications, and mobile drawer behavior. 
* Smoke tests mostly verify page visibility, non-404, and coarse health checks. 

**Affected surfaces:**

* Mobile booking lifecycle
* Web booking lifecycle
* Route registry
* Shared contracts
* Test coverage

**Target pattern:** Generated SDK/shared typed API client with route constants and required headers.

**Required fix:** Centralize API contracts and use them in web, mobile, and tests.

**Required tests:** Contract parity test for every mobile and web action against API route metadata.

**Cleanup implication:** Remove duplicate string-based clients where possible.

---

## P1-9 Privacy/security/i18n/a11y are improving but not pervasive

**Why it matters:** The rental platform handles PII, location, payments, evidence, private messages, disputes, insurance, and identity documents.

**Root cause:** Good platform controls exist, but coverage is inconsistent and not yet proven end-to-end.

**Evidence:**

* Config validation fails fast and forbids production/staging bypass flags such as Stripe bypass, safety fail-open, throttle disable, and dev login. 
* `AppModule` has global throttling, CSRF guard, request ID middleware, telemetry, logger, encryption, metrics, health, and cleanup modules. 
* Storage endpoints are disabled, leaving file privacy/security paths unresolved. 
* Many notification/user-facing messages in backend are hardcoded English strings. 

**Affected surfaces:**

* Uploads
* Evidence
* PII
* Admin/support workflows
* Notifications
* Invoices
* Mobile
* Accessibility state handling

**Target pattern:** Pervasive privacy/security/i18n/a11y gates in controllers, services, UI, and tests.

**Required fix:** Add privacy redaction policy, storage security, i18n message catalog, a11y E2E, and admin/support access audits.

**Required tests:** PII redaction, evidence access, keyboard navigation, modal focus, screen-reader labels, i18n fallback, locale formatting, unauthorized states.

**Cleanup implication:** Remove hardcoded strings from durable backend/user-facing paths where feasible.

---

## P2-10 Documentation is much cleaner, but domain-rule docs are still too high-level

**Why it matters:** The docs are now organized, but production readiness needs precise source-of-truth rules for pricing, booking state, payments, refunds, disputes, insurance, organization scope, and route/action contracts.

**Root cause:** Canonical docs exist, but the feature catalog remains high-level. It names capabilities without defining all operational rules. 

**Evidence:**

* `docs/README.md` says documentation consolidation is complete and establishes canonical docs. 
* Product vision and features describe expected capabilities.  
* Architecture overview describes domains and layers. 

**Affected surfaces:**

* Booking state
* Pricing
* Payments/refunds/payouts
* Disputes
* Insurance
* Organization/team permissions
* QA/release gates

**Target pattern:** Small canonical rule docs for each critical domain, linked from docs map and tested through traceability.

**Required fix:** Add concise canonical rule specs for lifecycle, pricing/payment, permissions, evidence/storage, and test matrix.

**Cleanup implication:** Keep archives, but ensure no old status/audit docs compete with canonical docs.

# 7.3 Migration Matrix

| Surface               | Route Registry | Scope Resolver | Permission Guard | Canonical State | Pricing/Payment |        Web/API |    Mobile/API | Privacy/Security | i18n/a11y |          Tests | Cleanup | Status     |
| --------------------- | -------------: | -------------: | ---------------: | --------------: | --------------: | -------------: | ------------: | ---------------: | --------: | -------------: | ------: | ---------- |
| `/dashboard`          |             🟡 |             🟡 |               🟡 |               ⚫ |               ⚫ |             🟡 |             ⚫ |               🟡 |        🟡 |             🟡 |      🟡 | 🟡 Partial |
| Renter dashboard      |             🟡 |             🟡 |               🟡 |              🟡 |              🟡 |             🟡 |            🟡 |               🟡 |        🟡 |             🟡 |      🟡 | 🟡 Partial |
| Owner dashboard       |             🟡 |             🔴 |               🟡 |              🟡 |              🟡 |             🟡 |            🟡 |               🟡 |        🟡 |             🟡 |      🟡 | 🟡 Partial |
| Search/discovery      |             🟡 |              ⚫ |                ⚫ |               ⚫ |              🟡 |             🟡 |            🟡 |               🟡 |        🟡 |             🟡 |      🟡 | 🟡 Partial |
| Listing create/edit   |             🟡 |             🟡 |               🟡 |              🟡 |              🟡 |             🟡 |            🟡 |       🔴 storage |        🟡 |             🟡 |      🔴 | 🔴 Blocked |
| Booking create        |             🟡 |             🟡 |               🟡 |              🟡 |              🟡 |             🟡 |            🟡 |               🟡 |        🟡 |             🟡 |      🟡 | 🟡 Partial |
| Booking transitions   |             🟡 |             🟡 |               🟡 |              🟡 |              🟡 |             🟡 |            🟡 |               🟡 |        🟡 |             🟡 |      🟡 | 🟡 Partial |
| Checkout/payment      |             🟡 |             🟡 |               🟡 |              🟡 |              🟡 | 🔴 route drift |            🟡 |               🟡 |        🟡 | 🔴 stale tests |      🟡 | 🔴 Blocked |
| Refund/deposit/payout |             🟡 |             🟡 |               🟡 |              🟡 |              🟡 |             🟡 | 🔴 not proven |               🟡 |        🟡 |             🟡 |      🟡 | 🟡 Partial |
| Disputes/evidence     |             🟡 |             🟡 |               🟡 |              🟡 |              🟡 |             🟡 | 🔴 not proven |       🔴 storage |        🟡 |             🟡 |      🔴 | 🔴 Blocked |
| Insurance/claims      |             🟡 |             🟡 |               🟡 |              🟡 |               ⚫ |             🟡 | 🔴 not proven |       🔴 storage |        🟡 |             🟡 |      🔴 | 🔴 Blocked |
| Organizations         |             🟡 |             🔴 |               🟡 |               ⚫ |              🟡 |             🟡 | 🔴 not proven |               🟡 |        🟡 |             🔴 |      🟡 | 🟡 Partial |
| Storage/uploads       |             🟡 |             🔴 |               🔴 |               ⚫ |               ⚫ |             🔴 |            🔴 |               🔴 |         ⚫ |             🔴 |      🔴 | 🔴 Missing |
| API E2E               |             🔴 |             🟡 |               🟡 |              🟡 |              🟡 |             🔴 |            🔴 |               🟡 |        🔴 |             🔴 |      🟡 | 🔴 Blocked |
| Repo cleanup          |             🟡 |              ⚫ |                ⚫ |              🟡 |              🟡 |             🟡 |            🟡 |               🟡 |        🟡 |             🟡 |      🟡 | 🟡 Partial |

# 7.4 File-Level Gaps

| Root blocker             | Path                                                                         | What is wrong/missing                                                            | Required fix                                                        | Required tests                                      |
| ------------------------ | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------- |
| Storage disabled         | `apps/api/src/common/storage/storage.controller.ts`                          | Upload/download/delete/listing-photo/avatar/org-logo endpoints are commented out | Reimplement against updated `StorageService`; remove commented code | Upload/evidence/avatar/org-logo auth and validation |
| Idempotency unsafe       | `apps/api/src/common/guards/idempotency.guard.ts`                            | Process-local Map, no fingerprint, no actor/route scoping                        | Redis/Postgres-backed idempotency store                             | Retry/replay/conflict/cross-user tests              |
| Mutations not idempotent | `apps/api/src/modules/bookings/controllers/bookings.controller.ts`           | Create is idempotent; approve/cancel/start/return/dispute are not                | Require idempotency on all state-changing endpoints                 | Duplicate submit and retry tests                    |
| Payment route drift      | `apps/api/src/modules/payments/controllers/payments.controller.ts` + E2E     | Controller and E2E use different payment intent routes                           | Align tests and clients to controller or update controller          | API contract route tests                            |
| Stale E2E                | `apps/api/test/e2e/booking-lifecycle-complete.e2e-spec.ts`                   | Uses routes not visible in current controllers                                   | Rewrite against current routes and real flow                        | Full lifecycle E2E                                  |
| Mock pricing             | `apps/api/src/modules/bookings/services/booking-calculation.service.ts`      | Hardcoded add-on, loyalty, seasonal and simplified tax behavior                  | Remove or feature-flag incomplete pricing features                  | Pricing golden masters                              |
| Organization scope       | `apps/api/src/modules/bookings/services/bookings.service.ts`                 | Owner bookings use direct listing owner only                                     | Use canonical scope resolver for user/org/team                      | Role/org matrix tests                               |
| Availability duplication | `packages/database/prisma/schema.prisma` + `BookingsService.getBlockedDates` | `Availability` and `AvailabilitySlot` coexist with mixed access paths            | Choose/migrate to canonical availability model                      | Concurrent booking + calendar parity tests          |
| Deprecated fields        | `packages/database/prisma/schema.prisma`                                     | Deprecated `views`, `stripePaymentIntentId`, `stripeId` remain in active models  | Finish migration or document compatibility window                   | Migration and API compatibility tests               |
| Shallow smoke tests      | `apps/web/e2e/smoke.spec.ts`                                                 | Mostly body visible / non-404 checks                                             | Replace with action/result assertions                               | Journey-specific Playwright tests                   |

# 7.5 Prioritized Implementation Sequence

1. **Restore storage as a production path**
   Rebuild upload/download/delete/listing-photo/avatar/org-logo/evidence endpoints with ownership checks, signed URL TTLs, MIME/size validation, object key scoping, and audit events.

2. **Replace idempotency implementation**
   Move from in-memory `Map` to Redis/Postgres idempotency records with route/method/user/body fingerprinting.

3. **Align API route contracts**
   Create a route/action registry and update API tests, web clients, mobile clients, and docs to the current controller routes.

4. **Harden booking state machine**
   Verify Prisma enum parity, remove string casts, and move transition side effects into durable command/outbox records.

5. **Canonicalize pricing and quote snapshots**
   Remove mock add-on/seasonal/loyalty logic from production paths; persist quote snapshots and use them through checkout, invoice, refund, payout, and ledger.

6. **Harden payment flow**
   Add idempotency to payment intent creation, avoid external Stripe calls inside DB transactions where possible, and enforce payment/booking/ledger reconciliation.

7. **Unify availability**
   Choose `AvailabilitySlot`/inventory-unit path as canonical or explicitly justify the old `Availability` model; migrate blocked-date and calendar reads.

8. **Implement organization scope resolver everywhere**
   Replace direct owner checks with user/org/team/admin/support policies.

9. **Strengthen web/mobile/API parity**
   Generate or share typed API clients; enforce required headers and route metadata.

10. **Replace shallow/stale tests**
    Turn smoke tests into behavior tests and rewrite stale API E2E to current routes.

11. **Privacy/security/i18n/a11y gates**
    Add evidence access tests, private-data redaction tests, keyboard/screen-reader tests, and locale formatting tests.

12. **Repository cleanup**
    Remove commented production code, stale tests, deprecated fields after migration, and archived docs that are still referenced as active.

# 7.6 Regression and Release Gates

Minimum gates before production readiness:

* `/dashboard` redirects correctly for guest/renter/owner/admin.
* Renter, owner, organization member, org admin, support admin, finance admin, and platform admin access matrix passes.
* Storage upload/download/delete works for listing photos, avatars, org logos, dispute evidence, condition reports, insurance claims, and KYC documents.
* Every mutation with booking/payment/refund/deposit/payout side effects requires durable idempotency.
* Booking state-machine golden master covers all valid/invalid transitions.
* Manual-review state is present in Prisma, shared types, API contracts, web/mobile UI, and tests.
* Payment intent creation is idempotent and reconciled with booking/payment records.
* Stripe webhook retry tests pass.
* Refund/deposit/payout ledger reconciliation passes.
* Availability conflict and concurrent booking tests pass.
* Search/listing/detail/checkout price parity passes.
* Invoice/refund/payout values match stored quote snapshots.
* Web and mobile clients use shared route/action contracts.
* No stale E2E routes remain.
* Privacy redaction tests pass for private profile, payment, evidence, and admin/support views.
* i18n locale/date/currency tests pass.
* Accessibility tests pass for dashboards, dialogs, tables, forms, checkout, upload, messages, and disputes.
* Build/lint/typecheck/test pass after cleanup.

# Repository Cleanup Plan

| Priority | Classification         | Path                                                       | Reason                                               | Evidence                                                  | Safe Fix                                           | Tests/Validation              |
| -------- | ---------------------- | ---------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------- | ----------------------------- |
| P0       | Replace                | `apps/api/src/common/storage/storage.controller.ts`        | Production endpoints disabled                        | Entire controller methods commented out                   | Reimplement and delete commented block             | Upload/evidence tests         |
| P0       | Replace                | `apps/api/src/common/guards/idempotency.guard.ts`          | In-memory process-local cache                        | Uses `new Map()` and comment says simplified              | Redis/Postgres idempotency service                 | Retry/replay tests            |
| P0       | Replace                | `apps/api/test/e2e/booking-lifecycle-complete.e2e-spec.ts` | Stale route expectations                             | Uses `/payments/create-intent`, `/start-rental`           | Rewrite against current routes                     | E2E route contract validation |
| P0       | Replace                | `apps/mobile/src/api/clients/bookings-client.ts`           | Direct endpoint strings and no visible idempotency   | Calls booking mutations directly                          | Use shared generated client                        | Mobile/API contract tests     |
| P1       | Merge                  | `Availability` + `AvailabilitySlot` schema paths           | Duplicate availability concepts                      | Both models exist                                         | Canonicalize slot model or document split          | Calendar/search/booking tests |
| P1       | Replace                | `BookingCalculationService` mock pricing areas             | Mock/simplified production pricing                   | Hardcoded add-on/seasonal logic                           | Move behind feature flag or real rule engine       | Pricing golden masters        |
| P1       | Merge                  | Scattered admin checks                                     | Some code uses helper, some hardcoded roles          | Payments controller hardcodes ADMIN/SUPER_ADMIN in places | Use centralized admin-role helpers                 | Admin role matrix             |
| P1       | Deprecate/remove       | Deprecated schema fields                                   | Active schema still has deprecated fields            | `views`, `stripePaymentIntentId`, `stripeId`              | Finish migration or document retention             | Migration tests               |
| P2       | Keep, but document why | `docs/archive/**`                                          | Archive is valid but must not compete with live docs | docs map marks archive historical                         | Keep only as non-source-of-truth                   | Link audit                    |
| P2       | Merge                  | Domain rules scattered across docs/code                    | Canonical docs are high-level                        | Feature catalog is concise                                | Add rule specs for booking/pricing/payment/dispute | Traceability checks           |

## Canonical Docs Matrix

| Doc                                     |     Keep |     Merge | Archive |         Delete | Notes                                      |
| --------------------------------------- | -------: | --------: | ------: | -------------: | ------------------------------------------ |
| `docs/README.md`                        |        ✅ |           |         |                | Canonical docs map                         |
| `docs/product/vision.md`                |        ✅ |           |         |                | Keep as product north star                 |
| `docs/product/features.md`              |        ✅ |           |         |                | Keep, but add links to detailed rule specs |
| `docs/product/requirements.md`          |        ✅ |           |         |                | Should own current requirement source      |
| `docs/architecture/overview.md`         |        ✅ |           |         |                | Keep                                       |
| `docs/architecture/domain-model.md`     |        ✅ |           |         |                | Should become schema/source parity map     |
| Booking lifecycle rules doc             | ✅ create |           |         |                | Needed as canonical state-machine spec     |
| Pricing/payment/refund/payout rules doc | ✅ create |           |         |                | Needed for financial parity                |
| Storage/evidence security doc           | ✅ create |           |         |                | Needed because storage is critical         |
| Organization authorization matrix       | ✅ create |           |         |                | Needed for org/team scope                  |
| `docs/archive/audits/**`                |          |           |       ✅ |                | Keep only as historical material           |
| Old root status/audit/generated docs    |          | ✅/archive |       ✅ | ✅ if duplicate | Not verified from current code/docs        |

Final cleanup checklist:

* [ ] Storage controller restored and commented production code removed
* [ ] In-memory idempotency removed from production path
* [ ] All critical mutations have durable idempotency
* [ ] API/web/mobile route contracts aligned
* [ ] Stale E2E routes rewritten or removed
* [ ] Booking enum/state-machine/shared types aligned
* [ ] Mock pricing paths removed or feature-flagged
* [ ] Availability model duplication resolved
* [ ] Organization scope resolver applied consistently
* [ ] Deprecated payment/listing schema fields migrated or documented
* [ ] Canonical rule docs added for lifecycle, pricing, storage, and authorization
* [ ] Build/lint/typecheck/test pass after cleanup

Bottom line: the repo is moving in the right direction, especially around canonical docs, modular API domains, config validation, booking state machine, and payment command patterns. But it is not yet production-ready because storage is disabled, idempotency is not durable, tests are stale in critical places, pricing still has mock paths, and org/payment/availability contracts are not consistently canonicalized.
