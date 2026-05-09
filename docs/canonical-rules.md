# Canonical Rule Specifications

This document defines the canonical business rules for the GharBatai Nepal rental portal. These rules are the single source of truth for all system behavior.

## Booking Lifecycle Rules

### State Transitions

**Valid Transitions:**
- `DRAFT → PENDING_OWNER_APPROVAL`: Renter submits booking request
- `PENDING_OWNER_APPROVAL → PENDING_PAYMENT`: Owner approves request
- `PENDING_OWNER_APPROVAL → CANCELLED`: Owner rejects request
- `PENDING_OWNER_APPROVAL → CANCELLED`: Renter cancels before approval
- `PENDING_PAYMENT → CONFIRMED`: Payment completed successfully
- `PENDING_PAYMENT → PAYMENT_FAILED`: Payment attempt failed
- `PAYMENT_FAILED → PENDING_PAYMENT`: Renter retries payment
- `CONFIRMED → IN_PROGRESS`: Rental period starts
- `CONFIRMED → CANCELLED`: Cancelled before start (with refund policy)
- `IN_PROGRESS → AWAITING_RETURN_INSPECTION`: Renter requests return
- `IN_PROGRESS → DISPUTED`: Dispute raised during rental
- `AWAITING_RETURN_INSPECTION → COMPLETED`: Return approved by owner
- `AWAITING_RETURN_INSPECTION → DISPUTED`: Return rejected (issues found)
- `COMPLETED → SETTLED`: Payment released to owner
- `COMPLETED → DISPUTED`: Post-completion dispute
- `CANCELLED → REFUNDED`: Refund processed
- `DISPUTED → COMPLETED`: Resolved in owner favor
- `DISPUTED → REFUNDED`: Resolved in renter favor
- `MANUAL_REVIEW → PENDING_PAYMENT`: Admin approves manual review
- `MANUAL_REVIEW → CANCELLED`: Admin rejects manual review

**Invalid Transitions:**
- Cannot transition from COMPLETED to CANCELLED
- Cannot transition from REFUNDED to any state
- Cannot transition from SETTLED to any state
- Cannot skip PENDING_PAYMENT after MANUAL_REVIEW

### Role-Based Authorization

**RENTER:**
- Can create bookings (DRAFT → PENDING_OWNER_APPROVAL)
- Can cancel own bookings (various states → CANCELLED)
- Can retry failed payments (PAYMENT_FAILED → PENDING_PAYMENT)
- Can request return (IN_PROGRESS → AWAITING_RETURN_INSPECTION)
- Can initiate disputes (IN_PROGRESS/COMPLETED → DISPUTED)

**OWNER:**
- Can approve/reject booking requests (PENDING_OWNER_APPROVAL → PENDING_PAYMENT/CANCELLED)
- Can cancel bookings (CONFIRMED → CANCELLED)
- Can start rental (CONFIRMED → IN_PROGRESS)
- Can approve/reject returns (AWAITING_RETURN_INSPECTION → COMPLETED/DISPUTED)
- Can initiate disputes (IN_PROGRESS/COMPLETED → DISPUTED)

**ADMIN:**
- Can approve manual review (MANUAL_REVIEW → PENDING_PAYMENT)
- Can reject manual review (MANUAL_REVIEW → CANCELLED)
- Can resolve disputes (DISPUTED → COMPLETED/REFUNDED)

**SYSTEM:**
- Can process payment completion (PENDING_PAYMENT → CONFIRMED)
- Can process payment failure (PENDING_PAYMENT → PAYMENT_FAILED)
- Can expire time-limited states (various → CANCELLED/COMPLETED)

### Side Effects (Durable via Outbox)

**CONFIRMED state:**
- Schedule reminder notification (24h before start)
- Trigger deposit hold (if security deposit required)

**IN_PROGRESS state:**
- Create initial condition report

**COMPLETED state:**
- Trigger settlement process (payout to owner)
- Release deposit hold (if no damage claims)

**CANCELLED state:**
- Trigger refund process (calculate and queue refund)

**PAYMENT_FAILED state:**
- Send immediate notification to renter
- Schedule expiration (24h grace period)

**AWAITING_RETURN_INSPECTION state:**
- Create return condition report
- Notify owner of return request

**DISPUTED state:**
- Notify all admins
- Hold funds in escrow

## Pricing and Payment Rules

### Pricing Calculation

**Base Price:**
- Calculated from listing.basePrice × duration
- Duration type: day, week, month, hour
- Minimum price enforced by platform

**Platform Fee:**
- Percentage of base price (default: 10%)
- Configurable via platform.platformFeePercent

**Service Fee:**
- Percentage of base price (default: 5%)
- Configurable via platform.serviceFeePercent

**Taxes:**
- Calculated via PolicyEngine based on jurisdiction
- Nepal: 13% VAT
- India: GST (CGST + SGST)
- Other jurisdictions: configured via PolicyEngine

**Deposit Amount:**
- Percentage of total price (default: 20%)
- Configurable per listing via depositType
- Types: FIXED, PERCENTAGE, NONE

**Total Calculation:**
```
total = base_price + platform_fee + service_fee + taxes + deposit_amount
```

**Owner Earnings:**
```
owner_earnings = total - platform_fee - service_fee - taxes
```

### Refund Policy

**Cancellation Tiers:**
- >48 hours before start: 100% refund
- 24-48 hours before start: 50% refund
- <24 hours before start: 0% refund

**Refund Calculation:**
- Based on time until rental start
- Configured via PolicyEngine or default tiers
- Deposit released if no damage claims

**Refund Processing:**
- Queued via Bull queue (durable)
- Processed via Stripe refund API
- Transition to REFUNDED state on success

### Payment Flow

**Payment Intent:**
- Created when booking is PENDING_PAYMENT
- Client secret returned to frontend
- Stripe handles 3D Secure

**Payment Confirmation:**
- Webhook triggers on payment.success
- Booking transitions to CONFIRMED
- Side effects triggered via outbox

**Payment Failure:**
- Webhook triggers on payment.failure
- Booking transitions to PAYMENT_FAILED
- Notification sent to renter
- 24h grace period for retry

**Payout:**
- Triggered when booking COMPLETED
- Stripe Connect transfer to owner
- Booking transitions to SETTLED on success

## Permission Rules

### Organization Scope

**INDIVIDUAL_OWNER:**
- Full access to own resources
- Can manage listings, bookings, payments

**ORG_OWNER:**
- Full access to organization resources
- Can manage org members
- Can transfer ownership

**ORG_ADMIN:**
- Can manage organization resources
- Cannot transfer ownership
- Cannot delete organization

**ORG_MEMBER:**
- Can view organization resources
- Limited write access (configurable)

**RENTER:**
- Can view own bookings
- Can create/modify own bookings
- Cannot access others' bookings

**SUPPORT_ADMIN:**
- Read-only access to all resources for support
- Cannot modify financial data

**FINANCE_ADMIN:**
- Can access financial resources (payouts, refunds)
- Cannot modify booking states

**CORE_ADMIN:**
- Full access to all resources
- Can modify system configuration

### Resource Access Matrix

| Resource Type | Owner | Org Owner | Org Admin | Org Member | Renter | Support Admin | Finance Admin | Core Admin |
|---------------|-------|-----------|-----------|------------|--------|---------------|---------------|------------|
| Listing | Full | Full | Full | Read | Read | Read | No | Full |
| Booking | Full | Full | Full | Read | Own | Read | Read | Full |
| Payment | Full | Full | Full | No | Own | Read | Full | Full |
| Payout | Full | Full | Full | No | No | No | Full | Full |
| Dispute | Full | Full | Full | Read | Own | Read | No | Full |
| Evidence | Full | Full | Full | No | Own | Read | No | Full |

### Evidence Access Rules

**Dispute Evidence:**
- Accessible to: renter, owner, support admins
- Redacted in: public listings, search results
- Full access in: dispute details, admin panel

**Insurance Claim Evidence:**
- Accessible to: claimant, owner, insurance admins
- Redacted in: public profiles
- Full access in: claim details, admin panel

**Condition Report Photos:**
- Accessible to: renter, owner, dispute participants
- Redacted in: public listings
- Full access in: booking details, dispute resolution

## Storage Rules

### File Upload Rules

**Ownership Validation:**
- Listing photos: listing.ownerId must match uploader
- User avatar: userId must match uploader
- Organization logo: organization member must be owner/admin
- Dispute evidence: dispute participant only
- Insurance claim evidence: claim participant only

**File Size Limits:**
- Listing photos: 10MB max per file
- User avatar: 5MB max
- Organization logo: 5MB max
- Evidence documents: 25MB max

**MIME Type Validation:**
- Images: image/jpeg, image/png, image/webp
- Documents: application/pdf
- Evidence: image/*, application/pdf

**Signed URL TTLs:**
- Upload URLs: 15 minutes
- Download URLs: 1 hour
- Public URLs: never (private only)

### Object Key Scoping

**Listing Photos:**
- `listings/{listingId}/photos/{uuid}.{ext}`

**User Avatar:**
- `users/{userId}/avatar/{uuid}.{ext}`

**Organization Logo:**
- `organizations/{orgId}/logo/{uuid}.{ext}`

**Dispute Evidence:**
- `disputes/{disputeId}/evidence/{uuid}.{ext}`

**Insurance Claim Evidence:**
- `insurance/claims/{claimId}/evidence/{uuid}.{ext}`

### Audit Logging

**All storage operations must log:**
- Action: upload/download/delete
- Actor: userId
- Resource: type + id
- File: object key
- Timestamp: ISO 8601
- Result: success/failure

## Test Matrix

### Critical Test Categories

**Booking State Machine Tests:**
- Full transition matrix (all valid transitions)
- Invalid transition attempts (should fail)
- Manual-review approval/rejection
- Outbox retry logic
- State-history persistence
- Duplicate side-effect prevention

**Pricing Tests:**
- Golden-master pricing for day/week/month/hour
- Tax calculation (Nepal, India, other jurisdictions)
- Platform/service fee calculation
- Deposit calculation (fixed, percentage)
- Refund calculation (cancellation tiers)
- Payout calculation
- Ledger entry accuracy
- Invoice generation
- Web/mobile checkout parity

**Storage Tests:**
- Unauthorized access attempts
- Wrong-owner access attempts
- Oversized file rejection
- Bad MIME type rejection
- Deleted-object access
- Signed URL expiry
- Audit event logging

**Idempotency Tests:**
- Concurrent retry handling
- Same key/different payload conflict
- Cross-user key reuse prevention
- Process restart persistence
- Duplicate mobile submit prevention
- Webhook retry handling

**Organization Scope Tests:**
- Individual owner access
- Org owner access
- Org admin access
- Org member access
- Renter access
- Support admin access
- Finance admin access
- Unrelated user denial

**Availability Tests:**
- Same listing/date concurrent booking
- Inventory-unit booking
- Owner-blocked periods
- Search filter parity
- Listing-detail calendar parity
- Cancellation release

**Privacy/Security Tests:**
- Evidence access restrictions
- Private-data redaction
- Keyboard navigation
- Screen-reader compatibility
- Locale formatting (Nepali, English)

### Test Coverage Requirements

**Unit Tests:**
- Service layer: 90% coverage
- Controller layer: 80% coverage
- Utility functions: 100% coverage

**Integration Tests:**
- API endpoint integration: 80% coverage
- Database integration: 90% coverage
- External service integration: 70% coverage

**E2E Tests:**
- Critical user journeys: 100% coverage
- Happy paths: 100% coverage
- Error paths: 80% coverage
- Edge cases: 60% coverage

**Contract Tests:**
- API route registry validation: 100%
- Type contract validation: 100%
- Schema contract validation: 100%

## Enforcement

**Code Review Checklist:**
- [ ] No string casts for enums
- [ ] No mock/stub in production code
- [ ] All side effects use outbox pattern
- [ ] All pricing uses PolicyEngine
- [ ] All ownership checks use OrganizationScopeService
- [ ] All storage operations validate ownership
- [ ] All sensitive data is redacted
- [ ] All errors use i18n exceptions

**CI/CD Gates:**
- All tests must pass before merge
- Contract tests must pass
- Type checking must pass
- Linting must pass
- Security scan must pass

**Production Readiness Checklist:**
- [ ] All P0 tasks completed
- [ ] All P1 tasks completed
- [ ] Test coverage thresholds met
- [ ] No outstanding security vulnerabilities
- [ ] Performance benchmarks met
- [ ] Documentation updated
- [ ] Monitoring configured
- [ ] Backup/restore tested
