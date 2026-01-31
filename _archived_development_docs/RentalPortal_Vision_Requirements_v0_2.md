# Universal Rental Portal — Vision + Requirements (v0.2)
*Scope: space/room/house, vehicles, instruments, event venues & event items, dresses/wearables.*  
*Goal: feature-rich, gap-free foundation using a category-template + policy-driven rental core.*

---

## 1. Vision

### 1.1 One-sentence vision
Build a **universal, lawful rental marketplace** where customers can **list** and **rent** spaces, vehicles, instruments, event venues/items, and wearables with **trust, safety, transparent pricing, and end-to-end lifecycle support** (discovery → booking → payment → fulfillment → return → settlement → reviews → disputes).

### 1.2 Product principles (non-negotiables)
1. **Category-agnostic rental core** + **category adapters** (templates, schemas, policy defaults).
2. **Trust & safety first**: identity, risk rules, moderation, auditable actions.
3. **Transparent pricing**: full cost breakdown (fees + deposit + taxes where applicable) before payment.
4. **Lifecycle state machines** are explicit, observable, and enforce business invariants.
5. **Disputes are first-class**: evidence capture, SLAs, structured outcomes.
6. **Compliance-ready**: prohibited items policy + jurisdiction-ready overrides (phased).

### 1.3 Primary users (personas)
- **Renter (Borrower/Guest)**: finds, books, pays, checks in/out, returns, reviews, disputes.
- **Owner (Lender/Host)**: lists, prices, manages availability, approves bookings (optional), fulfills, inspects, resolves issues, payouts.
- **Business Operator**: manages teams, inventory/fleets, invoices, roles (phaseable).
- **Admin/Support**: moderation, dispute resolution, refunds, policy enforcement, risk review.

### 1.4 Success metrics (examples)
- Listing activation rate; time-to-first-listing; time-to-first-booking
- Search → view → booking attempt → completion funnel conversion
- Dispute rate, dispute resolution time, chargeback rate
- Repeat rentals, retention (30/90 days), supply utilization %
- Payment success rate, webhook reconciliation rate

---

## 2. Category minimum support

### 2.1 Categories
1. **Spaces**: room/house/apartment/shared space
2. **Vehicles**: cars, bikes, scooters, vans (extensible)
3. **Instruments**: musical instruments & accessories
4. **Events**
   - **Venues**: stage/party venue/banquet space
   - **Items**: chairs, tables, tents, sound, lighting, decorations, etc.
5. **Wearables**: dresses, suits, costumes, accessories

### 2.2 Category template model (core concept)
Each listing attaches to a **CategoryTemplate** that defines:
- Required & optional attributes (schema validation)
- Allowed pricing units (hour/day/night/event/week/month/package)
- Allowed fulfillment methods (self-check-in, pickup/dropoff; delivery/shipping later)
- Required checklists & evidence capture
- Default policies (deposit, cancellation, late fees, inspection windows)

---

## 3. Rental Core (shared for all categories)

### 3.1 Shared lifecycle
**Listing → Discovery → Booking → Payment/Deposit → Fulfillment → Return → Settlement → Review → Dispute**

### 3.2 Booking state machine (minimum)
- `DRAFT`
- `PENDING_OWNER_APPROVAL` (for request-to-book)
- `PENDING_PAYMENT`
- `CONFIRMED`
- `IN_PROGRESS`
- `AWAITING_RETURN_INSPECTION` (optional by category)
- `COMPLETED`
- `SETTLED`
- `CANCELLED` (by renter/owner/system)
- `DISPUTED`
- `REFUNDED` (partial/full)

**Invariants**
- Booking cannot be `CONFIRMED` unless payment requirements satisfied.
- Category rules can require check-in condition report before `IN_PROGRESS`.
- Settlement only after required inspection windows and/or checkout evidence.

### 3.3 Payments & ledger model (minimum)
- Charge for rental amount (upfront for MVP) + platform fees
- Deposit as authorization hold (preferred) or captured amount if hold unsupported
- Refunds & adjustments via explicit ledger entries
- Payout to owners after policy-defined release time (e.g., after start/completion)

### 3.4 Evidence capture (first-class)
- Condition report at check-in and check-out
- Photos/time-stamped evidence + checklist results
- Immutable submission; follow-up addendums allowed but audit logged

---

## 4. Category-specific requirements (templates)

### 4.1 Spaces (room/house)
**Required**
- Address stored; approximate location shown pre-book
- Space type (entire/home/shared/room), capacity (guests), beds/baths, amenities
- Check-in/out times, house rules (pets, smoking, parties)
- Nightly availability calendar and minimum stay
- Cancellation policy, cleaning fee settings

**Recommended**
- Security deposit for high-value/long stays
- Optional condition capture for long stays

### 4.2 Vehicles
**Required**
- Type; make/model/year (or equivalent); pickup location; usage rules
- Renter eligibility: age + license requirements (risk-based gating)
- Pricing: per day or per hour; late fees; optional mileage/fuel rules
- Mandatory condition reports: pickup + return (photos + checklist)

### 4.3 Instruments
**Required**
- Type; brand/model; included accessories; handling rules
- Pricing: day/week; optional event package
- Condition report required above configurable value threshold

### 4.4 Events — Venues
**Required**
- Address; capacity; allowed hours; noise/curfew; event types allowed
- Setup/cleanup windows; included equipment; responsibilities (permits, security)
- Pricing: per hour/day/event; cleaning fee; security deposit
- Mandatory before/after condition capture

### 4.5 Events — Items
**Required**
- Inventory mode (quantity); item attributes; included accessories
- Pricing: per day/event; quantity reservation without double-booking
- Pickup/dropoff fulfillment in MVP; delivery later
- Quantity verification + damage inspection at return

### 4.6 Wearables (dress/wearables)
**Required**
- Size system + measurements; condition grade; cleaning policy
- Pricing: per day or package (e.g., 3-day); strict return deadline; late fees
- Mandatory condition capture; inspection window before deposit release

---

## 5. Functional Requirements (FR) — detailed

### 5.1 Identity, onboarding, and profiles
- FR-1: Email/phone signup, login, password reset
- FR-2: Profile with name/photo, contact verification
- FR-3: Risk-tier verification gates (phaseable): ID, license, address proof
- FR-4: Trust signals: completed rentals, reviews, verification badges
- FR-5: Block direct contact exchange before confirmed booking (privacy)

### 5.2 Listing management
- FR-10: Create/edit listing in `DRAFT` state
- FR-11: Select CategoryTemplate and complete required fields (schema validation)
- FR-12: Media upload (photos/video) + moderation scanning hooks
- FR-13: Pricing configuration (base + fees + discounts)
- FR-14: Availability management (calendar, blackout, lead time, min/max duration)
- FR-15: Publish workflow + optional admin review queue
- FR-16: Inventory modes: single-unit vs quantity vs fleet-like subunits (phaseable)

### 5.3 Search & discovery
- FR-20: Search by location + date range (where relevant)
- FR-21: Category filters (schema-derived filters)
- FR-22: Sorting (price, rating, distance, availability match)
- FR-23: Listing detail page: rules, policies, cost breakdown preview
- FR-24: Map view for location-based categories (optional)

### 5.4 Booking & contracting
- FR-30: Booking flows: instant book, request-to-book, inquiry
- FR-31: Quote generation: base, fees, deposit, discounts, taxes (if any)
- FR-32: Agreement snapshot: platform terms + listing rules + timestamps
- FR-33: Booking modifications (policy-driven): date changes, extensions (phaseable)
- FR-34: Cancellation flows: renter/owner/system; enforce policy windows

### 5.5 Payments, deposits, payouts
- FR-40: Card payments for rentals (MVP)
- FR-41: Deposit authorization holds & release/capture logic
- FR-42: Owner payouts via payment provider connect (phaseable but recommended early)
- FR-43: Ledger: every financial action produces immutable entries
- FR-44: Receipts/invoices (basic) + downloadable PDFs (phaseable)

### 5.6 Messaging & notifications
- FR-50: Thread per inquiry/booking
- FR-51: Attachments (photos/evidence)
- FR-52: Notification preferences; email/SMS/push (email in MVP)
- FR-53: System messages for state changes (confirmed/cancelled/etc.)

### 5.7 Fulfillment (check-in/out, pickup/return)
- FR-60: Fulfillment plan chosen at booking (self-check-in vs pickup)
- FR-61: Check-in checklist with timestamped photo evidence (required by category)
- FR-62: Check-out checklist with evidence
- FR-63: Late return detection and fee calculation
- FR-64: Inspection window rules before settlement (wearables/instruments/events)

### 5.8 Reviews & reputation
- FR-70: Two-sided reviews post-completion
- FR-71: Structured tags + free text; anti-abuse constraints
- FR-72: Review visibility and dispute for reviews (phaseable)

### 5.9 Disputes & claims
- FR-80: Dispute initiation reasons by category
- FR-81: Evidence bundle (messages, condition reports, receipts)
- FR-82: Timers/SLA: response window, escalation levels
- FR-83: Outcomes: refund, partial refund, deposit capture, extra charge (policy/provider permitting)
- FR-84: Admin adjudication + audit logs

### 5.10 Admin & operations console
- FR-90: User management (view, trust flags, suspend/ban)
- FR-91: Listing moderation (approve/takedown; prohibited content)
- FR-92: Booking management (override states with justification)
- FR-93: Payment tools (refunds/adjustments; ledger view; payout issues)
- FR-94: Policy engine management (fees, deposits, cancellation templates)
- FR-95: Audit logs for every admin action and all financial actions

---

## 6. Non-Functional Requirements (NFR)

### 6.1 Security
- NFR-S1: Strong auth, rate limiting, bot/fraud controls
- NFR-S2: Encryption in transit; sensitive data at rest
- NFR-S3: RBAC for admin/support; least privilege
- NFR-S4: Tamper-evident audit logging for money + moderation

### 6.2 Privacy
- NFR-P1: Location obfuscation pre-book; reveal exact after confirmation
- NFR-P2: Contact masking before confirmation
- NFR-P3: Data retention and export/delete readiness

### 6.3 Reliability & correctness
- NFR-R1: Idempotent payment and booking operations
- NFR-R2: Webhook reconciliation + retry strategy
- NFR-R3: Consistent booking state transitions with invariants

### 6.4 Performance
- NFR-F1: Search p95 latency target
- NFR-F2: Image CDN and background processing

### 6.5 Observability
- NFR-O1: Structured logs, metrics, traces
- NFR-O2: Funnel dashboards + alerting for payment failures

---

## 7. Architecture requirements (product-engineering constraints)

### 7.1 Config-driven templates & policies
- AR-1: Category schemas versioned and validated (JSON Schema recommended)
- AR-2: Fee policy templates (platform fee, cleaning, mileage, late fees)
- AR-3: Cancellation policy templates (flex/mod/strict + category defaults)
- AR-4: Deposit rules per category and per listing override capability
- AR-5: Evidence requirements rules (by category, by price threshold)

### 7.2 Core services/modules (logical)
- Listings & templates
- Availability & pricing/quote engine
- Booking state machine
- Payments & ledger
- Messaging/notifications
- Condition reports (evidence)
- Reviews & reputation
- Disputes & enforcement
- Admin console & policy management
- Audit logging

---

## 8. Data model (high-level)

### 8.1 Entities
- User, Profile, Verification
- Listing, ListingMedia, ListingUnit (optional), ListingAttributes (typed JSON)
- CategoryTemplate, CategorySchemaVersion
- AvailabilityCalendar, BlackoutDates
- Booking, BookingAgreementSnapshot, BookingStateHistory
- Quote, FeeLineItem, DiscountLineItem
- PaymentIntent/Charge/Refund, DepositHold, Payout
- LedgerEntry (immutable)
- MessageThread, Message, NotificationEvent
- ConditionReport, ChecklistTemplate, ChecklistResponse, EvidenceAttachment
- Review
- Dispute, DisputeEvidenceBundle, DisputeOutcome
- PolicyRule, FeeRule, CancellationPolicy, DepositPolicy
- AuditLog

---

# 9. Granular Task Breakdown (Backlog) — “no gaps” plan
Below is a highly granular, implementation-oriented task list. Organize into epics → stories → tasks.

> **Legend**: ✅ deliverable, 🔒 security/compliance, 🧪 testing, 📊 observability, 🧰 tooling/ops

---

## Epic E0 — Product Definition & Governance
### E0.1 Requirements finalization
- [ ] Define MVP boundaries and explicitly list out-of-scope items
- [ ] Define “prohibited items” baseline + moderation escalation rules
- [ ] Define fee model: renter service fee, owner commission, optional fees
- [ ] Define cancellation policy templates per category
- [ ] Define deposit policy defaults per category + thresholds by value
- [ ] Define dispute categories and resolution outcomes

### E0.2 UX & information architecture
- [ ] IA map: renter flows, owner flows, admin flows
- [ ] Wireframe list for all screens (MVP)
- [ ] Content strategy: listing guidance, policies, safety guidance

✅ Deliverable: `VISION + REQUIREMENTS` + `MVP Scope` + `IA/Wireframes Index`

---

## Epic E1 — Foundations (Auth, Users, RBAC, Audit) 🔒
### E1.1 Auth
- [ ] Implement email/password auth
- [ ] Implement phone/email verification (MVP: email)
- [ ] Session management (refresh tokens, revoke sessions)
- [ ] Password reset flow
- [ ] Rate limiting for auth endpoints 🔒
- [ ] Brute force and enumeration protections 🔒

🧪 Tests
- [ ] Unit tests for auth logic
- [ ] Integration tests for login/signup/reset flows

### E1.2 User profiles & trust
- [ ] Profile CRUD (name/photo/contact)
- [ ] “Renter mode” vs “Owner mode” UX toggle
- [ ] Verification status fields (tiered, even if unused in MVP)
- [ ] Trust score placeholder and flags (manual/admin)

### E1.3 RBAC & Audit logs 🔒
- [ ] Define roles: user, admin, support
- [ ] Protect admin endpoints with RBAC checks
- [ ] Implement `AuditLog` for:
  - [ ] Admin actions
  - [ ] Financial actions
  - [ ] Booking state transitions
- [ ] Ensure audit logs are immutable and queryable

📊 Observability
- [ ] Auth success/failure metrics
- [ ] Suspicious activity counters

---

## Epic E2 — Category Templates & Schema Validation (Core Differentiator)
### E2.1 Category template system
- [ ] Define `CategoryTemplate` entity
- [ ] Create JSON schema storage + versioning
- [ ] Add “required field” enforcement via schema validation
- [ ] Implement “template-derived UI fields” mapping (server sends schema → UI renders)

### E2.2 Create base templates (minimum)
- [ ] Spaces template schema
- [ ] Vehicles template schema
- [ ] Instruments template schema
- [ ] Event Venues template schema
- [ ] Event Items template schema (supports quantity)
- [ ] Wearables template schema

### E2.3 Template-driven filters
- [ ] Derive searchable attributes per template
- [ ] Define indexing strategy for template fields (e.g., computed columns or JSON indexes)
- [ ] Add filter definitions per category for UI

🧪 Tests
- [ ] Schema validation tests with positive/negative fixtures
- [ ] Migration tests for schema version upgrades

✅ Deliverable: Category template registry with versioned schemas

---

## Epic E3 — Listings (Create/Publish/Manage) + Media
### E3.1 Listings CRUD
- [ ] Create listing draft with selected category template
- [ ] Validate listing attributes against schema
- [ ] Save draft and autosave UX support (phaseable)
- [ ] Edit listing: attributes, pricing, policies, photos
- [ ] Publish listing (enforce required fields, media minimum)
- [ ] Unpublish/disable listing

### E3.2 Media handling
- [ ] Upload photos (min count rules by category)
- [ ] Generate thumbnails
- [ ] Content moderation hooks (basic: admin flags)
- [ ] CDN/storage integration (implementation-specific)

### E3.3 Policy & rules per listing
- [ ] Attach cancellation policy template
- [ ] Attach deposit policy
- [ ] Attach fulfillment options per listing
- [ ] Attach house rules / usage rules / cleaning rules

🧪 Tests
- [ ] Listing creation validation tests
- [ ] Publish invariants tests
- [ ] Media upload integration tests

---

## Epic E4 — Availability & Pricing / Quote Engine
### E4.1 Availability core
- [ ] Calendar availability for date ranges
- [ ] Lead time + minimum notice
- [ ] Min/max rental duration
- [ ] Blackout dates
- [ ] Quantity availability for event items (reservation counts)

### E4.2 Pricing models (MVP)
- [ ] Support pricing units by category:
  - [ ] Space: per night (+ cleaning fee optional)
  - [ ] Vehicle: per day/per hour (+ late fee rules)
  - [ ] Instrument: per day/per week
  - [ ] Venue: per event/per hour
  - [ ] Event items: per day/per event (per quantity)
  - [ ] Wearables: package pricing (e.g., 3-day) + per day
- [ ] Discounts: weekly/monthly (spaces), multi-day (others)
- [ ] Fees: platform fee, cleaning fee, deposit line item
- [ ] Quote preview API for listing page (before booking)
- [ ] Quote locking (quote snapshot attached to booking)

### E4.3 Anti-double-booking protection
- [ ] Atomic reservation checks (transactional)
- [ ] Concurrency tests to prevent overlapping confirmations

🧪 Tests
- [ ] Quote calculation unit tests (golden fixtures)
- [ ] Availability edge-case tests (time zones, boundaries)
- [ ] Concurrency/integration tests for booking collisions

📊 Observability
- [ ] Quote error counters, availability conflict counters

---

## Epic E5 — Booking Engine (State Machine + Agreement Snapshot)
### E5.1 Booking creation flows
- [ ] Instant book: create booking → require payment → confirm
- [ ] Request-to-book: create booking pending owner approval
- [ ] Inquiry: message thread creation without booking (MVP optional)

### E5.2 Owner approval workflow
- [ ] Owner accept/decline with reasons
- [ ] Timers: auto-expire request if not responded
- [ ] Notifications to renter and owner

### E5.3 Booking state machine enforcement
- [ ] Central transition function with invariant checks
- [ ] Store `BookingStateHistory` (who/why/when)
- [ ] Prevent invalid transitions (guardrails)

### E5.4 Agreement snapshot
- [ ] Snapshot listing rules + policies at booking time
- [ ] Store “terms accepted” timestamp and version
- [ ] Provide downloadable agreement (phaseable)

🧪 Tests
- [ ] State machine unit tests for every transition
- [ ] Integration tests for each booking flow

---

## Epic E6 — Payments, Deposits, Ledger, Payouts 🔒
### E6.1 Payment provider integration
- [ ] Create payment intent for rental amount
- [ ] Confirm payment and handle SCA/3DS (provider-dependent)
- [ ] Webhook handler for payment events
- [ ] Idempotency keys for payment operations 🔒

### E6.2 Deposit holds
- [ ] Create deposit authorization hold
- [ ] Release hold on successful settlement
- [ ] Capture hold partially/fully on approved claims (dispute outcome)
- [ ] Deposit release timing rules (wearables inspection window)

### E6.3 Ledger (immutable)
- [ ] Define ledger entry types: charge, fee, deposit hold, release, refund, payout, adjustment
- [ ] Record ledger entry for every financial event
- [ ] Build reconciliation job comparing provider events vs local ledger

### E6.4 Payouts to owners
- [ ] Owner payout onboarding
- [ ] Payout schedule rules (after start or after completion)
- [ ] Payout failure handling + retry workflow

🧪 Tests
- [ ] Webhook signature verification tests 🔒
- [ ] Ledger integrity tests (sum checks)
- [ ] End-to-end “pay → confirm → complete → payout” test

📊 Observability
- [ ] Payment failure rate metrics
- [ ] Webhook processing latency metrics
- [ ] Reconciliation mismatch alerts

---

## Epic E7 — Messaging & Notifications
### E7.1 Messaging
- [ ] Thread creation per booking and per inquiry
- [ ] Message send/receive with read status
- [ ] Attachment support (photos, documents)
- [ ] Policy: block sharing phone/email until confirmed (basic detection) 🔒

### E7.2 Notifications
- [ ] Email notifications for key events
- [ ] Notification templates (booking requested, accepted, payment confirmed, reminders)
- [ ] User notification preferences (phaseable)
- [ ] Retry/backoff for failed sends

🧪 Tests
- [ ] Messaging integration tests
- [ ] Notification dispatch tests with mock provider

---

## Epic E8 — Fulfillment: Check-in/out + Condition Reports
### E8.1 Fulfillment plan selection
- [ ] Self-check-in (spaces): instructions revealed after confirm
- [ ] Pickup/dropoff (vehicles/items/instruments/wearables): schedule + location
- [ ] Store selected plan in booking snapshot

### E8.2 Condition report engine (shared)
- [ ] Checklist templates per category and stage (check-in/out)
- [ ] Evidence attachments: photos/videos, notes
- [ ] Dual confirmation (optional): both parties confirm condition (phaseable)
- [ ] Time windows for submission and edits (immutable after submit)

### E8.3 Category enforcement
- [ ] Vehicles: require pickup condition report before `IN_PROGRESS`
- [ ] Wearables: require return evidence before settlement
- [ ] Event items: quantity verification checklist
- [ ] Venues: before/after inspection required
- [ ] Instruments: required above value threshold

### E8.4 Late return & extra charges
- [ ] Late detection logic
- [ ] Fee calculation per policy
- [ ] Owner claim initiation path

🧪 Tests
- [ ] Condition report workflow tests
- [ ] Category rule enforcement tests

---

## Epic E9 — Reviews & Reputation
### E9.1 Review flow
- [ ] Trigger review request after completion
- [ ] Two-sided review system with structured tags
- [ ] Prevent review before completed booking
- [ ] Moderation hooks for abusive content (phaseable)

### E9.2 Reputation surfaces
- [ ] Aggregate rating per listing and per user
- [ ] Trust badges (verified, super-host, etc. phaseable)

🧪 Tests
- [ ] Review eligibility tests
- [ ] Rating aggregation tests

---

## Epic E10 — Disputes, Claims, & Resolution (First-class)
### E10.1 Dispute initiation
- [ ] Start dispute from booking within allowed window
- [ ] Select dispute reason by category
- [ ] Auto-attach evidence: messages, condition reports, quote, agreement

### E10.2 Dispute workflow
- [ ] Renter response window
- [ ] Admin/support triage queue
- [ ] SLA timers and escalation notifications
- [ ] Settlement outcomes: refund, partial refund, deposit capture, adjustment

### E10.3 Financial execution
- [ ] Execute refund via provider + ledger entries
- [ ] Execute deposit capture + ledger entries
- [ ] Generate resolution summary and notify parties

🧪 Tests
- [ ] Dispute state machine tests
- [ ] Refund/capture end-to-end tests

📊 Observability
- [ ] Dispute volume, aging, resolution time dashboards

---

## Epic E11 — Admin Console & Policy Engine
### E11.1 Admin console foundation
- [ ] Admin auth + RBAC
- [ ] User search + profile view + trust flags
- [ ] Listing moderation queue and actions
- [ ] Booking lookup and timeline view
- [ ] Payment ledger viewer and refund tool access

### E11.2 Policy engine UI
- [ ] Manage prohibited categories/keywords
- [ ] Manage category defaults: deposits, cancellations, evidence requirements
- [ ] Manage fees: platform fee %, flat fees, cleaning fee toggles
- [ ] Risk rules: require verification above thresholds

### E11.3 Audit & reporting
- [ ] Audit log explorer with filters
- [ ] Export basic reports (phaseable)

🧪 Tests
- [ ] Admin action permission tests
- [ ] Audit log creation tests for each admin action

---

## Epic E12 — Search Indexing & Ranking (MVP-grade)
### E12.1 Search backend
- [ ] Location-based search for spaces/venues
- [ ] Schema-driven attribute filtering for each category
- [ ] Availability-aware ranking
- [ ] Pagination and caching strategies

### E12.2 Ranking heuristics
- [ ] Availability match score
- [ ] Distance score (where relevant)
- [ ] Price competitiveness (optional heuristic)
- [ ] Trust score weighting (reviews, verification)

🧪 Tests
- [ ] Filter correctness tests
- [ ] Regression tests for ranking changes (fixtures)

---

## Epic E13 — Compliance & Safety 🔒
### E13.1 Prohibited items policy
- [ ] Define prohibited taxonomy and keywords
- [ ] Listing create/edit validation against banned categories
- [ ] Flag suspicious listings for review
- [ ] Admin takedown workflow with appeals (phaseable)

### E13.2 Privacy & data protection
- [ ] Mask address pre-book
- [ ] Mask contact details pre-book
- [ ] Data retention policy placeholders and delete/export endpoints (phaseable)

### E13.3 Security hardening
- [ ] WAF/rate limiting for sensitive endpoints
- [ ] CSRF protections (web) where needed
- [ ] Secure file upload scanning hook (phaseable)

---

## Epic E14 — QA, Release Engineering, and Operations 🧪🧰📊
### E14.1 Testing strategy
- [ ] Unit test coverage targets per module
- [ ] Integration tests for booking/payment state flows
- [ ] E2E tests for main user journeys (renter + owner)
- [ ] Load tests for search and booking concurrency

### E14.2 CI/CD and environments
- [ ] Dev/stage/prod environment setup
- [ ] Database migrations pipeline
- [ ] Secret management integration
- [ ] Blue/green or rolling deployment plan (implementation-specific)

### E14.3 Observability
- [ ] Logging standard (structured logs)
- [ ] Metrics dashboards for:
  - [ ] bookings funnel
  - [ ] payment failures
  - [ ] disputes backlog
  - [ ] moderation queue
- [ ] Alerts for payment webhook failures, reconciliation mismatches

### E14.4 Data backup & recovery
- [ ] Backup schedules and restore drills
- [ ] Disaster recovery runbook (phaseable)

---

# 10. MVP Build Plan (recommended sequencing)

## MVP-1 (First Launch)
- E1 Foundations (Auth/RBAC/Audit)
- E2 Templates & schemas
- E3 Listings + media
- E4 Availability + quote engine
- E5 Booking engine
- E6 Payments + deposits + ledger
- E7 Messaging + notifications (email)
- E8 Fulfillment + condition reports (required categories enforced)
- E9 Reviews
- E11 Admin basics (moderation + refunds + disputes basic)
- E13 Prohibited items + privacy basics
- E14 Minimal CI/CD + monitoring

**MVP-1 constraint (to ship fast without gaps)**
- Fulfillment methods: **self-check-in + pickup/dropoff only**
- No shipping/delivery
- Card payments only
- Verification: basic tiers + manual admin overrides

## MVP-2 (Scale & Trust Enhancements)
- Delivery/shipping workflows (wearables/instruments/items)
- Business accounts, teams, inventory/fleet management
- Advanced risk scoring + verification automation
- Advanced dispute automation, SLA tooling, reporting exports

---

## 11. Acceptance Criteria (category-critical)
- Vehicle rentals require check-in (pickup) condition report before `IN_PROGRESS`.
- Wearables require checkout return evidence and inspection window before settlement.
- Event items support quantity reservations without double-booking.
- Venue listings cannot publish without capacity, allowed hours, and responsibilities.
- Renter sees full cost breakdown (fees + deposit + policy) before payment.
- Admin can reconstruct complete booking/payment timeline from state history + ledger + messages.
- All admin actions and financial actions create immutable audit log entries.

---

## 12. Open decisions (to finalize early)
- Payment provider + deposit hold capabilities
- Schema storage/index strategy for category attributes
- Default booking mode per category (instant vs request-to-book)
- Payout timing policy per category
- Dispute arbitration model and support staffing assumptions

---
**End of document.**
