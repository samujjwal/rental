# Backend Comprehensive Test Checklist and Automation Plan

Last updated: 2026-02-14
Repository: `/Users/samujjwal/Development/rental`
Primary API: REST + WebSocket (Socket.IO)
GraphQL: Not implemented in current backend

## 1. Scope and objective

This checklist is the master plan to validate backend requirements across:

- Controllers and API contracts (REST, WebSocket)
- Service logic and business rules
- Database behavior and integrity
- Cache, events, queues, schedulers, and background jobs
- External integrations (payments, email, SMS, push, geo, AI, storage)
- End-to-end flows (positive, negative, edge, failure, recovery)

Primary goal: provide a repeatable checklist that can be automated in CI and staging to prevent regressions and detect contract drift.

## 2. Current backend surface (snapshot)

### 2.1 Implemented API modules

- `auth`
- `users`
- `categories`
- `listings`
- `bookings`
- `payments` (includes tax + webhooks)
- `search`
- `messaging` (REST + WebSocket gateway)
- `reviews`
- `disputes`
- `notifications`
- `organizations`
- `admin`
- `moderation`
- `insurance`
- `fraud-detection`
- `favorites`
- `analytics`
- `geo`
- `ai`

### 2.2 Data and infra layers

- Prisma/PostgreSQL schema with core marketplace, payments, messaging, disputes, moderation, and admin entities
- Redis cache and pub/sub
- Bull queues configured: `bookings`, `payments`, `notifications`, `search-indexing`, `emails`, `cleanup`
- Scheduler services and event listeners exist in code
- File storage/upload controllers and services

## 3. Critical drift and risk gates (test first)

Run these as blocking checks before broader suite expansion.

- [ ] Verify route prefix/version contract: app uses `/api` with URI version default `''`; fail if tests/docs still depend on `/api/v1`.
- [ ] Verify route registry against docs/tests for stale paths (example drifts observed in legacy suites: `/v1/admin/*`, `/api/messages/*`, `/api/bookings/owner-bookings`, `/api/reviews/received`).
- [ ] Verify `GraphQL` expectation is disabled or marked N/A in all automated plans.
- [ ] Verify webhook signature path has raw-body support for Stripe verification.
- [ ] Verify WebSocket auth guard is effectively enforced at runtime.
- [ ] Verify queue processors are actually registered as providers and consume jobs.
- [ ] Verify scheduler and health modules are imported and routes/jobs are live.
- [ ] Verify event listeners are registered and handling emitted events.
- [ ] Verify notification route/controller wiring is not conflicting and exposed routes match expectation.
- [ ] Verify search nearby path and search query DTO mapping (lat/lon/radius) are consistent end-to-end.
- [ ] Verify active config source and env names are consistent; fail on config key drift between code, docs, and `.env.example`.

## 4. Test architecture and environments

### 4.1 Test levels

- Unit: pure service logic, guards, validators, mappers
- Integration: controller + service + Prisma/Redis/queue stubs or real containers
- Contract: request/response schema and error contract snapshots
- End-to-end: full app with Postgres + Redis + queue + websocket + external mocks
- Non-functional: load, security, resilience, reliability

### 4.2 Environment matrix

- Local dev smoke
- CI ephemeral environment with dockerized Postgres + Redis
- Staging environment with real external sandbox credentials

### 4.3 Test data strategy

- Deterministic seed fixtures per module
- Factory helpers for user/listing/booking/payment state graphs
- Isolated tenant prefixes for parallel runs
- Automatic teardown and orphan detection checks

## 5. Global test matrix for every API path

Apply all dimensions below to every endpoint and websocket handler.

- [ ] Authentication matrix: missing token, invalid token, expired token, valid token
- [ ] Authorization matrix: renter/owner/admin/non-member role access
- [ ] Input validation matrix: required fields, type mismatch, enum mismatch, malformed payload, boundary sizes
- [ ] Business rule matrix: preconditions, state dependencies, ownership checks, policy checks
- [ ] Output contract matrix: status code, response schema, nullable behavior, pagination metadata
- [ ] Side-effect matrix: DB writes, cache writes/invalidation, events, queue jobs, audit logs
- [ ] Error matrix: deterministic 4xx and 5xx behavior, no internal stack leaks
- [ ] Idempotency matrix: repeated POST/PUT/PATCH where applicable
- [ ] Concurrency matrix: race conditions, duplicate requests, lock behavior
- [ ] Observability matrix: logs/metrics/traces and correlation IDs where available

## 6. Module-by-module checklist

### 6.1 Auth module

- [ ] `POST /api/auth/register`: success, duplicate email, invalid password, rate limiting
- [ ] `POST /api/auth/login`: success, wrong password, locked/suspended user, rate limiting
- [ ] `POST /api/auth/dev-login`: dev-only behavior, disabled in production behavior
- [ ] `POST /api/auth/refresh`: valid rotation, revoked/expired refresh token
- [ ] `POST /api/auth/logout`: session/token invalidation
- [ ] `POST /api/auth/logout-all`: all sessions revoked
- [ ] `GET /api/auth/me`: sanitized profile output (no secret fields)
- [ ] Password flows: reset request, reset token replay, change password invalid current password
- [ ] MFA flows: enable, verify, disable, invalid code
- [ ] Session table integrity and cleanup behavior

### 6.2 Users module

- [ ] `GET /api/users/me`: own profile returns expected shape
- [ ] `PATCH /api/users/me`: profile update validation and persistence
- [ ] `DELETE /api/users/me`: soft-delete semantics and anonymization checks
- [ ] `POST /api/users/upgrade-to-owner`: role transition and audit
- [ ] `GET /api/users/me/stats`: counts and aggregates accuracy
- [ ] `GET /api/users/:id`: public profile redaction rules

### 6.3 Categories module

- [ ] CRUD authorization for admin-only paths
- [ ] Slug and ID retrieval consistency
- [ ] Template retrieval and schema integrity
- [ ] Category stats correctness against seeded listings

### 6.4 Listings module

- [ ] Create/update/publish/pause/activate/delete lifecycle rules
- [ ] Owner-only mutations and admin override handling
- [ ] Listing search endpoint behavior and output mapping
- [ ] `GET /api/listings/:id` and `GET /api/listings/slug/:slug` parity
- [ ] Price suggestion behavior and category/city filter correctness
- [ ] Availability endpoints: create/get/check/update, date edge cases, timezone boundaries
- [ ] Listing images add/remove behavior and idempotency
- [ ] Nearby listings endpoint contract and distance filtering behavior
- [ ] Negative cases: invalid listing state, missing owner, bad date ranges, malformed coordinates

### 6.5 Bookings module

- [ ] Create booking: availability, self-booking block, date validation
- [ ] Request vs instant booking initial status correctness
- [ ] Owner approve/reject flow and permission enforcement
- [ ] Cancellation flow and refund trigger behavior
- [ ] Start rental, request return, approve return transitions
- [ ] Dispute initiation transition path
- [ ] Blocked dates generation and overlap detection
- [ ] Price calculation endpoint accuracy across durations
- [ ] Available transitions endpoint role-based correctness
- [ ] Concurrency tests: simultaneous booking attempts on same listing/time window
- [ ] State history persistence and timeline consistency

### 6.6 Booking state machine service

- [ ] Valid transition matrix coverage for all states
- [ ] Invalid transition rejection with clear errors
- [ ] Role-based transition authorization
- [ ] Auto-transition jobs (`EXPIRE`, timeout windows)
- [ ] Side effects per transition: notifications, settlement/refund/deposit events
- [ ] Terminal state protections and idempotency

### 6.7 Payments and tax modules

- [ ] Stripe Connect onboarding and account status
- [ ] Payment intent creation authorization and booking status guard
- [ ] Deposit hold/release flow and ledger side effects
- [ ] Customer and payment method management
- [ ] Payout request/history and earnings summary
- [ ] Ledger retrieval for booking/user
- [ ] Refund API path and reconciliation behavior
- [ ] Tax calculate/transaction/register/summary/1099 endpoints
- [ ] Tax fallback behavior when external provider unavailable
- [ ] Decimal rounding and currency precision validations

### 6.8 Stripe webhook path

- [ ] Signature validation with real raw payload bytes
- [ ] Event idempotency handling (`payment_intent.succeeded`, `failed`, `charge.refunded`, `payout.*`)
- [ ] Booking/payment status updates from webhook events
- [ ] Ledger side effects and duplicate-event safety
- [ ] Error behavior on invalid signatures or unsupported events

### 6.9 Search module

- [ ] `GET /api/search` text search behavior
- [ ] Filters: category, price range, booking mode, condition, features, delivery
- [ ] Geo search: lat/lon/radius filtering and distance sort
- [ ] Pagination and sorting correctness
- [ ] `POST /api/search/advanced` parity with GET query path
- [ ] Autocomplete and suggestion endpoints
- [ ] Similar listings and popular searches
- [ ] Cache hit/miss behavior with TTL and invalidation strategy
- [ ] Semantic enrichment fallback when embeddings unavailable

### 6.10 Messaging module (REST + WebSocket)

- [ ] Conversations CRUD and participant authorization
- [ ] Message send/read/delete behavior and pagination
- [ ] Unread counts and consistency with read receipts
- [ ] WebSocket connection auth enforcement
- [ ] Join/leave room authorization
- [ ] Real-time `send_message`, `typing`, `mark_read` event correctness
- [ ] Multi-device behavior (same user multiple sockets)
- [ ] Offline user handling and notification fallback

### 6.11 Reviews module

- [ ] Create only after valid completed booking
- [ ] One-review-per-user-per-booking rules
- [ ] Update and delete ownership rules
- [ ] Listing/user/booking review retrieval consistency
- [ ] Public vs private review visibility behavior
- [ ] Review moderation interactions

### 6.12 Disputes module

- [ ] Create dispute types and validation
- [ ] Evidence upload and retrieval integrity
- [ ] Response thread behavior and authorization
- [ ] Status updates and close flow
- [ ] Admin views (`admin/all`, `admin/stats`) authorization and correctness
- [ ] Financial resolution side effects (refund/capture paths)

### 6.13 Notifications module

- [ ] Notification list/read/read-all/delete
- [ ] Unread count consistency
- [ ] Preferences read/update behavior
- [ ] In-app notification service CRUD behavior
- [ ] Email and SMS controller behaviors and auth requirements
- [ ] Push/device token registration paths (if exposed)
- [ ] Channel routing by preference matrix (email/sms/push/in-app)
- [ ] Delivery failure handling and retry policy behavior

### 6.14 Organizations module

- [ ] Create/update/deactivate org
- [ ] Member invite/remove/role update authorization
- [ ] `my`, `:id`, `:id/members`, `:id/stats` path behavior
- [ ] Invitation accept/decline behavior
- [ ] Multi-tenant access boundaries

### 6.15 Admin module

- [ ] Admin authz enforcement in non-dev environments
- [ ] Dashboard and analytics endpoint shape and source correctness
- [ ] User/listing/booking/payment/refund/payout/ledger paths
- [ ] Moderation and dispute admin workflows
- [ ] Dynamic entity schema and generic entity endpoints
- [ ] Distinguish mocked vs live-backed endpoints and assert accordingly

### 6.16 Moderation module

- [ ] Queue retrieval filters and admin actions
- [ ] Text moderation behavior (PII/profanity/spam)
- [ ] Image moderation integration/fallback
- [ ] Queue add/resolve and audit log integrity
- [ ] History and risk-level calculations

### 6.17 Insurance module

- [ ] Requirement engine by category/value
- [ ] Policy upload date/coverage validation
- [ ] Verification flow and admin approvals/rejections
- [ ] Valid insurance status checks for listings
- [ ] Expiring policies retrieval
- [ ] Certificate generation behavior
- [ ] Verification service queue and provider checks

### 6.18 Fraud detection module

- [ ] High-risk users endpoint authorization and output
- [ ] User risk scoring rules
- [ ] Booking risk scoring (velocity, value, account age)
- [ ] Payment risk scoring behavior
- [ ] Listing risk checks (pricing anomalies, spam patterns)
- [ ] Decision thresholds (`allowBooking`, `requiresManualReview`)

### 6.19 Favorites module

- [ ] Add/remove/list favorites
- [ ] Bulk add/remove and duplicate handling
- [ ] Count endpoint correctness
- [ ] Filtering and sorting behavior
- [ ] Clear-all behavior and idempotency

### 6.20 Analytics module

- [ ] Performance endpoint aggregates and time window correctness
- [ ] Insights endpoint recommendation logic and thresholds
- [ ] Revenue/bookings conversion calculations accuracy

### 6.21 Geo module

- [ ] Autocomplete with/without location bias
- [ ] Reverse geocode valid/invalid coordinates
- [ ] Primary provider, fallback provider, and coordinate fallback behavior
- [ ] Cache key/TTL behavior for geo paths

### 6.22 AI module

- [ ] Description generation with API key (remote call mocked in tests)
- [ ] Template fallback without API key
- [ ] Input validation (title minimum length)
- [ ] Embedding service generation/update/backfill and semantic search fallback behavior

## 7. Infrastructure and shared component checklist

### 7.1 Database and Prisma

- [ ] Migration status clean and reproducible in CI
- [ ] Schema constraints validated: uniqueness, FK, enums, nullability
- [ ] Soft-delete semantics validated where expected
- [ ] Transaction rollback behavior for multi-step operations
- [ ] Query performance checks for high-traffic paths
- [ ] Data integrity audits:
- [ ] booking overlap prevention
- [ ] ledger balance consistency (debits == credits)
- [ ] payment/refund/payout referential integrity

### 7.2 Cache (Redis)

- [ ] Cache get/set TTL behavior
- [ ] Cache invalidation on listing/booking/user updates
- [ ] Pub/sub channel subscription and delivery behavior
- [ ] Resilience under Redis restarts and reconnects

### 7.3 Queues and processors (Bull)

- [ ] Queue registration and connectivity
- [ ] Processor registration and execution for `bookings`, `notifications`, `search-indexing`
- [ ] Retry/backoff/dead-letter behavior
- [ ] Job idempotency and duplicate handling
- [ ] Queue health metrics and failure count assertions

### 7.4 Events

- [ ] Event emission coverage from services
- [ ] Listener registration and invocation
- [ ] Cross-module event payload contract tests

### 7.5 Scheduler/cron

- [ ] Cron jobs execute on expected schedules in test harness
- [ ] Expired booking checks and reminders
- [ ] Auto-completion and cleanup jobs
- [ ] Reindex and maintenance jobs behavior

### 7.6 Storage and uploads

- [ ] Upload validation by mime type and max size
- [ ] Single vs multi-file upload behavior
- [ ] Presigned URL generation and expiry
- [ ] Storage path naming and access controls
- [ ] Delete and retrieval operations

### 7.7 Health and operational endpoints

- [ ] `/api/health` endpoints registered and operational
- [ ] DB/queue/memory/disk/liveness/readiness responses
- [ ] Admin system health path consistency with actual system state

## 8. End-to-end scenario checklist

- [ ] Renter registers, searches, books, pays, completes rental, reviews
- [ ] Owner creates listing, approves booking, fulfills rental, receives payout
- [ ] Booking cancellation with partial/full refund paths
- [ ] Dispute flow with evidence and admin resolution
- [ ] Notification fan-out for booking/payment/message events
- [ ] Messaging flow with websocket + REST consistency
- [ ] Organization owner invites member, member manages listing/bookings
- [ ] Admin lifecycle: moderate content, handle disputes, review payments
- [ ] Insurance-required listing blocks booking until valid policy
- [ ] Fraud risk blocks/flags high-risk booking attempts

## 9. Non-functional checklist

### 9.1 Performance

- [ ] API p95 and p99 latency targets per critical endpoint
- [ ] Throughput targets for search, booking create, payment intent
- [ ] WS concurrency and message fan-out latency
- [ ] DB query plan checks for slow paths

### 9.2 Security

- [ ] Auth bypass attempts (REST + WS)
- [ ] RBAC privilege escalation tests
- [ ] Input fuzzing and serialization attacks
- [ ] SQL injection and unsafe raw query tests
- [ ] File upload abuse tests (type spoofing, oversize)
- [ ] Rate limiting and brute-force defense
- [ ] Secrets/config exposure in responses/logs

### 9.3 Reliability and resilience

- [ ] Redis outage and recovery behavior
- [ ] DB transient failure behavior and rollback safety
- [ ] External provider timeout behavior (Stripe, email, SMS, geo, AI)
- [ ] Idempotent retries for webhook and job processing

## 10. Contract testing and drift control

- [ ] Generate route manifest from decorators in CI
- [ ] Compare route manifest against tested route registry
- [ ] OpenAPI schema snapshot diff on PRs
- [ ] Block PR if undocumented route change or stale tests detected
- [ ] Maintain module-to-test traceability matrix

Suggested traceability fields:

- Module
- Endpoint/handler
- Unit test file
- Integration test file
- E2E test file
- Contract snapshot ID
- Performance test script
- Security test script
- Last execution date
- Owner

## 11. Automation rollout plan

### Phase A: Stabilize contracts and wiring

- [ ] Build route manifest and detect stale tests/docs
- [ ] Add smoke tests for module wiring: scheduler, health, event listeners, processors, websocket auth
- [ ] Add webhook raw-body verification test harness

### Phase B: Core business flows

- [ ] Expand booking state machine tests to full transition matrix
- [ ] Expand payment+ledger+refund integration tests with deterministic fixtures
- [ ] Add search geo + cache behavior tests
- [ ] Add messaging websocket auth + realtime consistency tests

### Phase C: Long-tail modules and infra

- [ ] Add dedicated suites for favorites, analytics, geo, ai, insurance, fraud
- [ ] Add infrastructure tests for queues, cron, events
- [ ] Add resilience and chaos scenarios

### Phase D: CI gates

- [ ] PR gates: lint, typecheck, unit, integration contract
- [ ] Nightly gates: e2e, load smoke, security baseline
- [ ] Weekly gates: full load and extended security scans

## 12. Quality gates (release blocking)

- [ ] Zero failing contract tests on modified modules
- [ ] Critical-path E2E flows all passing
- [ ] No high-severity security findings unresolved
- [ ] No ledger imbalance or booking overlap integrity failures
- [ ] Webhook idempotency and signature checks passing
- [ ] Queue processor and scheduler smoke tests passing
- [ ] Performance thresholds met for search/bookings/payments endpoints

## 13. Immediate implementation backlog from this checklist

- [ ] Add module wiring smoke tests for scheduler/events/processors/health
- [ ] Add websocket auth enforcement tests and reject unauthorized connections
- [ ] Add Stripe webhook raw-body signature verification integration test
- [ ] Add route drift detector between controllers and e2e specs
- [ ] Add notifications route contract tests to resolve controller drift
- [ ] Add nearby search contract tests for lat/lon/radius mapping
- [ ] Add config key consistency tests against `.env.example` and active config usage

