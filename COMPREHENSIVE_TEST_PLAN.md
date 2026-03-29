# Comprehensive Test Plan - GharBatai Rentals
## Production-Grade Test Inventory for Universal Rental Marketplace

---

## 1. Executive Summary

### 1.1 Product/Modules Scanned
- **apps/api**: NestJS backend API with 25+ feature modules
- **apps/web**: React Router v7 web application  
- **apps/mobile**: React Native mobile application (beta)
- **packages/database**: Prisma ORM with 70+ models
- **packages/shared-types**: Shared TypeScript definitions

### 1.2 Overall Test Strategy Summary
**Test Pyramid Positioning**:
- **Unit Tests** (Base): Controller logic, service methods, utility functions
- **Integration Tests** (Core Focus): API-to-database, service-to-repository, event flows
- **E2E Tests** (Critical Paths): Full user journeys across frontend-backend-database
- **Playwright Browser Tests** (User Experience): Real browser automation for critical workflows
- **Manual Tests** (Complex Scenarios): Multi-user interactions, dispute resolution, edge cases

### 1.3 Key Risks
1. **Payment Processing**: Stripe Connect integration with split payments, refunds, and payouts
2. **Booking State Machine**: 12-state lifecycle with complex transitions
3. **Real-time Features**: Socket.io messaging and notifications
4. **Multi-tenancy**: Organization scoping and RBAC enforcement
5. **Concurrent Access**: Double-booking prevention, inventory locking
6. **Compliance**: GDPR data handling, tax calculations, insurance verification

### 1.4 Coverage Philosophy
- **Behavior-First**: Tests derived from actual user journeys and business rules
- **Risk-Based**: Higher coverage for payment, booking, and auth flows
- **Deterministic**: Isolated test data, reproducible fixtures, no external dependencies in CI
- **Observability**: Every test includes assertions on side effects (DB state, events, notifications)

### 1.5 Major Infra Requirements
- PostgreSQL with pgvector extension
- Redis for caching and sessions
- MinIO/S3 for file storage
- Stripe test environment
- Elasticsearch for search (optional)
- Docker Compose for local development

---

## 2. Codebase Coverage Map

### 2.1 Backend API Modules

| Module | Responsibility | Risk Level | Test Types | Notes |
|--------|---------------|------------|------------|-------|
| **auth** | JWT auth, MFA, OAuth, session mgmt | CRITICAL | Integration, E2E, Playwright | All flows security-sensitive |
| **users** | User CRUD, profiles, preferences | HIGH | Integration, E2E | RBAC, data privacy |
| **listings** | Listing CRUD, inventory, availability | CRITICAL | Integration, E2E, Playwright | Complex business rules |
| **bookings** | 12-state booking lifecycle | CRITICAL | Integration, E2E, Playwright | State machine correctness |
| **payments** | Stripe Connect, ledger, payouts | CRITICAL | Integration | Financial correctness |
| **categories** | Dynamic templates, attributes | MEDIUM | Integration | Schema validation |
| **messaging** | Real-time chat, privacy | HIGH | Integration, E2E | Socket.io testing |
| **reviews** | Bi-directional ratings | MEDIUM | Integration, E2E | Trust scoring |
| **disputes** | Resolution workflow | HIGH | Integration, Manual | Multi-step process |
| **notifications** | Multi-channel delivery | MEDIUM | Integration | Email/SMS/push |
| **search** | Full-text + semantic | MEDIUM | Integration, E2E | pgvector testing |
| **insurance** | Policy management, claims | HIGH | Integration | Verification flows |
| **organizations** | Multi-tenancy | HIGH | Integration, E2E | Data isolation |
| **admin** | Dashboard, moderation | MEDIUM | E2E, Playwright | Privileged access |
| **analytics** | Metrics, reporting | LOW | Integration | Data accuracy |
| **fraud-detection** | Risk scoring | HIGH | Integration | ML/AI components |
| **geo** | Location services | MEDIUM | Integration | Geocoding accuracy |
| **policy-engine** | Dynamic rules engine | HIGH | Integration | Rule evaluation |

### 2.2 Frontend Web Application

| Route/Page | Responsibility | Risk Level | Test Types |
|------------|---------------|------------|------------|
| **/auth/* ** | Login, register, MFA, password reset | CRITICAL | Playwright, E2E |
| **/** | Home, search, discovery | HIGH | Playwright, E2E |
| **/listings/* ** | Create, edit, view listings | CRITICAL | Playwright, E2E |
| **/bookings/* ** | Booking management | CRITICAL | Playwright, E2E |
| **/checkout** | Payment flow | CRITICAL | Playwright, Manual |
| **/messages** | Real-time messaging | HIGH | Playwright, E2E |
| **/profile** | User settings, preferences | MEDIUM | Playwright |
| **/dashboard** | Host/analytics views | MEDIUM | Playwright |
| **/admin/* ** | Admin operations | HIGH | Playwright, Manual |
| **/disputes/* ** | Dispute resolution | HIGH | Manual |
| **/reviews** | Review management | MEDIUM | Playwright |

### 2.3 Mobile Application

| Feature Area | Risk Level | Test Types |
|--------------|------------|------------|
| **Authentication** | CRITICAL | E2E (Detox/Appium) |
| **Listing Discovery** | HIGH | E2E |
| **Booking Flow** | CRITICAL | E2E |
| **Messaging** | HIGH | E2E |
| **Camera/Photos** | MEDIUM | Manual |
| **Push Notifications** | MEDIUM | E2E |
| **Offline Support** | MEDIUM | Manual |

### 2.4 Missing/Under-Testable Areas
1. **AI/ML Components**: Content moderation AI needs mocked integration tests
2. **Third-party Webhooks**: Stripe webhooks need signature verification tests
3. **Background Jobs**: BullMQ job processing needs failure scenario coverage
4. **Real-time Sync**: Socket.io reconnection and state sync
5. **File Uploads**: Large file handling, virus scanning integration

---

## 3. User Journey Inventory

### 3.1 First-Time User Journey

**Journey: User Registration & Onboarding**

- **Actor**: New visitor
- **Entry Point**: Landing page
- **Prerequisites**: None

**Main Steps**:
1. Visitor browses landing page (anonymous)
2. Clicks "Sign Up" button
3. Views registration form with fields:
   - Email (validated for uniqueness)
   - Username (validated for uniqueness)
   - Password (strength requirements)
   - First/Last name
   - Phone number (optional)
4. Submits registration
5. Receives email verification
6. Clicks verification link
7. Email marked as verified
8. Redirected to onboarding flow
9. Completes profile (photo, bio, preferences)
10. Can now browse and create listings

**Alternate Branches**:
- OAuth registration (Google, Apple)
- Skip phone verification
- Exit and resume onboarding later

**Error Branches**:
- Duplicate email/username (inline validation)
- Weak password (strength indicator)
- Invalid email format
- Expired verification link
- Rate limiting on registration

**Systems Touched**:
- Web frontend, API, PostgreSQL, Redis (sessions), Email service

**Validation Points**:
- User record created with PENDING email status
- Session created in Redis
- Welcome email queued
- Audit log entry created

---

### 3.2 Authentication Journey

**Journey: Login with MFA**

- **Actor**: Registered user
- **Entry Point**: Login page

**Main Steps**:
1. Navigate to /auth/login
2. Form renders with email/password fields
3. Enter valid credentials
4. Submit (button disabled during submission)
5. If MFA enabled:
   - Redirect to MFA verification page
   - Enter TOTP code
   - Submit verification
6. Redirect to dashboard or original destination
7. Auth token persisted (localStorage/cookie)
8. User context hydrated
9. WebSocket connection established

**Error Branches**:
- Invalid credentials (generic error message for security)
- Account locked after failed attempts
- Expired session (redirect to login)
- Invalid MFA code (3 attempts before lockout)

**Side Effects**:
- Session created in Redis
- Last login timestamp updated
- Device fingerprint recorded (fraud detection)
- Login audit log entry

---

### 3.3 Listing Creation Journey

**Journey: Host Creates New Listing**

- **Actor**: Authenticated host user
- **Entry Point**: "List Your Item" button
- **Prerequisites**: Verified email, Stripe Connect onboarding started

**Main Steps**:
1. Navigate to /listings/new
2. Select category (Space, Vehicle, Instrument, etc.)
3. Category-specific form renders with dynamic fields
4. Fill basic information:
   - Title, description
   - Location (address with geocoding)
   - Photos upload (multiple, with preview)
5. Configure availability:
   - Set available dates/times
   - Define booking mode (Instant/Request)
   - Set minimum/maximum duration
6. Set pricing:
   - Base price
   - Currency
   - Security deposit
   - Cleaning fee (optional)
7. Configure policies:
   - Cancellation policy
   - House rules
   - Instant book eligibility
8. Review and submit
9. Listing created with PENDING verification status

**Systems Touched**:
- Web UI, API, PostgreSQL, S3/MinIO (photos), Redis (cache invalidation)

**Validation Points**:
- Listing record created with correct category attributes
- Photos uploaded to storage with proper paths
- Geocoding coordinates stored
- Availability slots generated
- Search index updated

**Error Branches**:
- Missing required fields (inline validation)
- Invalid photo format/size
- Geocoding failure
- Insufficient host verification
- Duplicate title detection

---

### 3.4 Booking Flow Journey

**Journey: Renter Books a Listing**

- **Actor**: Authenticated renter
- **Entry Point**: Listing detail page
- **Prerequisites**: Valid payment method on file

**Main Steps**:
1. Browse to listing detail page
2. View availability calendar
3. Select dates/times
4. View price breakdown (base + fees)
5. Click "Request to Book" or "Instant Book"
6. Review booking summary
7. Confirm booking request
8. If instant book: Payment processed immediately
9. If request: Host receives notification
10. Booking created with PENDING_HOST_APPROVAL or PAYMENT_PENDING status
11. Renter redirected to booking management page

**Systems Touched**:
- Web UI, API, PostgreSQL, Stripe, Redis, Notification service

**Validation Points**:
- Booking record created with correct state
- Availability slots marked as held/booked
- Payment intent created (if instant)
- Notification queued for host
- Calendar cache invalidated

**State Transitions**:
```
PENDING_HOST_APPROVAL → APPROVED → PAYMENT_PENDING → CONFIRMED
                    → DECLINED
                    → EXPIRED (timeout)
                    
INSTANT: PAYMENT_PENDING → CONFIRMED (on success)
                      → PAYMENT_FAILED (on failure)
```

---

### 3.5 Payment Processing Journey

**Journey: Complete Payment for Booking**

- **Actor**: Renter with approved booking
- **Entry Point**: Booking checkout page

**Main Steps**:
1. View booking with APPROVED status
2. Click "Complete Payment"
3. Review price breakdown:
   - Rental fee
   - Service fee
   - Security deposit (hold)
   - Insurance (optional)
4. Select or add payment method
5. Enter payment details or use saved card
6. Submit payment
7. Stripe payment intent created
8. 3D Secure challenge if required
9. Payment confirmed
10. Booking transitions to CONFIRMED
11. Receipt generated and emailed

**Systems Touched**:
- Web UI, API, Stripe API, PostgreSQL, Email service

**Validation Points**:
- Stripe payment intent created with correct amount
- Ledger entries created (double-entry accounting)
- Escrow transaction recorded
- Host payout scheduled
- Receipt generated
- Booking state updated

**Error Branches**:
- Card declined (specific error message)
- Insufficient funds
- 3D Secure failure
- Payment timeout
- Network failure (retry mechanism)

---

### 3.6 Messaging Journey

**Journey: Renter and Host Communicate**

- **Actor**: Authenticated users (renter/host)
- **Entry Point**: Message button on listing or booking

**Main Steps**:
1. Click "Message Host" on listing
2. Chat interface opens (existing or new conversation)
3. Type message
4. Send message
5. Message delivered in real-time to recipient
6. Recipient receives push/email notification
7. Recipient views message
8. Read receipt recorded
9. Reply sent
10. Conversation continues until booking completion

**Privacy Controls**:
- Phone/email masked until booking confirmed
- Attachment restrictions
- Content moderation (AI scanning)

**Systems Touched**:
- Web UI, Socket.io, PostgreSQL, Redis (presence), Notification service

---

### 3.7 Review Journey

**Journey: Post-Stay Review**

- **Actor**: Renter (post-checkout) or Host (post-checkout)
- **Entry Point**: Review prompt email or dashboard
- **Prerequisites**: Booking in COMPLETED state

**Main Steps**:
1. Receive review prompt (14-day window)
2. Navigate to review form
3. Rate experience (1-5 stars)
4. Provide written feedback
5. Rate specific categories (cleanliness, communication, etc.)
6. Submit review
7. If both parties submitted: Reviews published simultaneously
8. If only one: Wait for other party or timeout
9. Reviews visible on profiles
10. Trust scores updated

**Systems Touched**:
- Web UI, API, PostgreSQL, Notification service

---

### 3.8 Dispute Resolution Journey

**Journey: Open and Resolve Dispute**

- **Actor**: Renter or Host
- **Entry Point**: Booking management page
- **Prerequisites**: Booking in dispute-eligible state

**Main Steps**:
1. Click "Open Dispute" on booking
2. Select dispute reason (damage, non-delivery, etc.)
3. Provide detailed description
4. Upload evidence photos/documents
5. Submit dispute
6. Other party notified
7. Other party responds with their evidence
8. Platform reviews submissions
9. Resolution proposed or mediated
10. Resolution accepted/rejected
11. If accepted: Payout adjusted, reviews updated
12. If escalated: Manual admin review

**Systems Touched**:
- Web UI, API, PostgreSQL, S3 (evidence), Admin dashboard

---

## 4. Integration Test Case Catalog

### 4.1 Authentication Integration Tests

#### TC-AUTH-001: JWT Token Lifecycle
```yaml
ID: TC-AUTH-001
Module: auth
Title: JWT access token generation and validation
Objective: Verify JWT tokens are correctly generated, validated, and refreshed
Scope: Service layer, token middleware
Preconditions: User exists in database
Test Data: Valid user credentials
Steps:
  1. Authenticate user with valid credentials
  2. Capture access token and refresh token
  3. Verify access token structure (header, payload, signature)
  4. Use access token to access protected endpoint
  5. Wait for token expiration
  6. Attempt access with expired token (expect 401)
  7. Use refresh token to get new access token
  8. Verify old refresh token invalidated
Expected Results:
  - Access token contains correct claims (sub, email, role, exp)
  - Expired token rejected with 401
  - Refresh token rotation working
  - New tokens have updated expiration
Assertions:
  - Token payload decoded correctly
  - Redis session entry exists
  - Refresh token family tracked
Downstream Effects:
  - Session audit log entry created
  - Device fingerprint recorded
Priority: CRITICAL
Automation: jest (integration)
```

#### TC-AUTH-002: MFA TOTP Verification
```yaml
ID: TC-AUTH-002
Module: auth
Title: TOTP-based multi-factor authentication
Objective: Verify MFA enrollment and verification flow
Scope: MFA service, TOTP generation
Preconditions: User exists, MFA not yet enabled
Test Data: User account, authenticator app (simulated)
Steps:
  1. Initiate MFA enrollment
  2. Capture TOTP secret
  3. Generate TOTP code from secret
  4. Verify TOTP code
  5. Enable MFA on account
  6. Logout and re-login
  7. Enter credentials (expect MFA challenge)
  8. Enter valid TOTP code
  9. Access granted
  10. Enter invalid TOTP code (expect failure, attempt tracking)
Expected Results:
  - Secret generated in base32 format
  - QR code URL valid
  - Valid TOTP accepted within time window
  - Invalid TOTP rejected
  - Account locked after 3 failed attempts
Assertions:
  - mfaEnabled flag updated
  - mfaSecret stored encrypted
  - Backup codes generated
  - Login attempts tracked in Redis
Priority: CRITICAL
Automation: jest (integration)
```

#### TC-AUTH-003: OAuth Provider Integration
```yaml
ID: TC-AUTH-003
Module: auth
Title: Google OAuth login flow
Objective: Verify OAuth authentication creates/links account
Scope: OAuth service, user service
Preconditions: None
Test Data: Mocked Google OAuth response
Steps:
  1. Initiate OAuth flow
  2. Simulate Google callback with token
  3. Verify Google token
  4. Check if user exists by googleId
  5. If new: Create user with Google profile
  6. If existing: Link to existing account
  7. Issue JWT tokens
  8. Redirect to application
Expected Results:
  - New user created with verified email from Google
  - Existing user linked (googleId updated)
  - Profile photo imported
  - Session created
Priority: HIGH
Automation: jest (integration) with mocked OAuth
```

#### TC-AUTH-004: Rate Limiting on Auth Endpoints
```yaml
ID: TC-AUTH-004
Module: auth
Title: Rate limiting enforcement on login attempts
Objective: Verify brute force protection
Scope: Throttle middleware, auth controller
Preconditions: User account exists
Test Data: User credentials
Steps:
  1. Attempt login with invalid password (5 times)
  2. Verify 429 response on 6th attempt
  3. Wait for rate limit window
  4. Attempt valid login (expect success)
  5. Verify different IP not rate limited
Expected Results:
  - Rate limit headers present (X-RateLimit-*)
  - 429 status with Retry-After header
  - Redis rate counter incremented
Priority: HIGH
Automation: jest (integration)
```

### 4.2 User Management Integration Tests

#### TC-USER-001: User CRUD Operations
```yaml
ID: TC-USER-001
Module: users
Title: User profile creation and updates
Objective: Verify user data persistence and retrieval
Scope: User service, user controller, repository
Preconditions: None
Test Data: Valid user data
Steps:
  1. Create user with minimal fields
  2. Verify user persisted with defaults
  3. Update profile with all fields
  4. Verify changes persisted
  5. Fetch user by ID
  6. Fetch user by email
  7. Soft delete user
  8. Verify deletedAt set, data still queryable
Expected Results:
  - User created with UUID
  - Timestamps auto-generated
  - Slug/username uniqueness enforced
  - Soft delete works (not hard delete)
Assertions:
  - Database row matches input
  - Unique constraints enforced
Priority: HIGH
Automation: jest (integration)
```

#### TC-USER-002: RBAC Permission Enforcement
```yaml
ID: TC-USER-002
Module: users / auth
Title: Role-based access control
Objective: Verify role restrictions on endpoints
Scope: Guards, decorators, user service
Preconditions: Users with different roles exist
Test Data: ADMIN, HOST, RENTER, USER role accounts
Steps:
  1. Access admin endpoint as USER (expect 403)
  2. Access admin endpoint as ADMIN (expect 200)
  3. Access host-only endpoint as RENTER (expect 403)
  4. Access host-only endpoint as HOST (expect 200)
  5. Verify role hierarchy (ADMIN > HOST > RENTER > USER)
Expected Results:
  - 403 Forbidden for insufficient roles
  - 200 OK for sufficient roles
  - Roles checked before business logic
Assertions:
  - JWT role claim validated
  - Database role matches token
Priority: CRITICAL
Automation: jest (integration)
```

### 4.3 Listings Integration Tests

#### TC-LIST-001: Listing Creation with Dynamic Attributes
```yaml
ID: TC-LIST-001
Module: listings
Title: Create listing with category-specific attributes
Objective: Verify dynamic schema validation and storage
Scope: Listing service, category service, validation
Preconditions: Category exists with attribute definitions
Test Data: Category with required and optional attributes
Steps:
  1. Fetch category template
  2. Build listing payload with attributes
  3. Submit listing creation
  4. Validate attribute types (string, number, boolean, enum)
  5. Verify validation errors for missing required attributes
  6. Create valid listing
  7. Verify ListingAttributeValue records created
Expected Results:
  - Required attributes enforced
  - Type coercion for numeric values
  - Enum values validated against allowed set
  - JSON storage for complex attributes
Priority: CRITICAL
Automation: jest (integration)
```

#### TC-LIST-002: Geocoding Integration
```yaml
ID: TC-LIST-002
Module: listings / geo
Title: Address geocoding and coordinate storage
Objective: Verify location services integration
Scope: Geo service, listing service
Preconditions: Valid address
Test Data: Real-world address
Steps:
  1. Submit listing with address
  2. Verify geocoding API called
  3. Verify latitude/longitude stored
  4. Verify address normalized
  5. Test geocoding failure (invalid address)
  6. Verify graceful handling with null coordinates
Expected Results:
  - Coordinates within valid range
  - Geocoding errors logged, not thrown
  - Fallback behavior documented
Priority: MEDIUM
Automation: jest (integration) with mocked geocoding
```

#### TC-LIST-003: Photo Upload and Storage
```yaml
ID: TC-LIST-003
Module: listings
Title: Multi-photo upload with validation
Objective: Verify file handling, storage, and cleanup
Scope: File service, storage provider
Preconditions: Storage service available
Test Data: Various image files (valid, invalid, oversized)
Steps:
  1. Upload single valid image
  2. Verify stored in S3/MinIO with correct path
  3. Upload multiple images
  4. Verify order preserved
  5. Upload oversized image (expect validation error)
  6. Upload invalid format (expect rejection)
  7. Delete listing (verify photos cleaned up)
Expected Results:
  - Files stored with UUID filenames
  - Content-type preserved
  - Validation limits enforced
  - Cleanup on deletion
Assertions:
  - Storage bucket contains file
  - Database stores correct URLs
Priority: HIGH
Automation: jest (integration) with test containers
```

#### TC-LIST-004: Availability Management
```yaml
ID: TC-LIST-004
Module: listings
Title: Availability slot creation and updates
Objective: Verify calendar management logic
Scope: Availability service, slot management
Preconditions: Listing exists
Test Data: Date ranges, booking constraints
Steps:
  1. Set recurring availability (weekly pattern)
  2. Generate availability slots
  3. Verify slots created for date range
  4. Block specific date
  5. Verify slot marked unavailable
  6. Create overlapping booking
  7. Verify availability updated
  8. Cancel booking
  9. Verify availability restored
Expected Results:
  - Slots generated correctly for patterns
  - Overlapping blocked dates handled
  - Booking holds reflected immediately
Priority: CRITICAL
Automation: jest (integration)
```

#### TC-LIST-005: Search Index Updates
```yaml
ID: TC-LIST-005
Module: listings / search
Title: Listing changes propagate to search index
Objective: Verify real-time search index synchronization
Scope: Search service, event handlers
Preconditions: Elasticsearch/OpenSearch configured
Test Data: Listing with searchable content
Steps:
  1. Create listing
  2. Verify index document created
  3. Update listing title
  4. Verify index updated
  5. Delete listing
  6. Verify index document removed
  7. Test full-text search finds updated content
Expected Results:
  - Index operations async (event-driven)
  - Index consistent with database
  - Search returns updated results
Priority: MEDIUM
Automation: jest (integration) with test search instance
```

### 4.4 Bookings Integration Tests

#### TC-BOOK-001: State Machine Transitions
```yaml
ID: TC-BOOK-001
Module: bookings
Title: Booking lifecycle state transitions
Objective: Verify all valid and invalid state changes
Scope: Booking service, state machine
Preconditions: Listing with availability exists
Test Data: Booking through all 12 states
Steps:
  1. Create booking (PENDING_HOST_APPROVAL or PAYMENT_PENDING)
  2. Test valid transitions:
     - PENDING_HOST_APPROVAL → APPROVED (host action)
     - APPROVED → PAYMENT_PENDING (system)
     - PAYMENT_PENDING → CONFIRMED (payment success)
     - CONFIRMED → ACTIVE (check-in time reached)
     - ACTIVE → COMPLETED (check-out time reached)
  3. Test invalid transitions (expect errors):
     - PENDING_HOST_APPROVAL → ACTIVE (should fail)
     - COMPLETED → CANCELLED (should fail)
  4. Test cancellation from each cancellable state
Expected Results:
  - Valid transitions succeed with audit log
  - Invalid transitions rejected with error
  - State timestamps recorded
Priority: CRITICAL
Automation: jest (integration)
```

#### TC-BOOK-002: Double-Booking Prevention
```yaml
ID: TC-BOOK-002
Module: bookings / listings
Title: Concurrent booking conflict detection
Objective: Verify inventory locking prevents double-booking
Scope: Transaction handling, availability service
Preconditions: Single listing with one available slot
Test Data: Two simultaneous booking attempts
Steps:
  1. User A starts booking process
  2. User B starts booking process (same slot)
  3. User A completes booking first
  4. Verify User B receives conflict error
  5. Verify only one booking created
  6. Verify availability slot marked booked
Expected Results:
  - Database transaction prevents race condition
  - Optimistic locking or row-level locking used
  - Clear error message for second user
Priority: CRITICAL
Automation: jest (integration) with parallel requests
```

#### TC-BOOK-003: Pricing Calculation Engine
```yaml
ID: TC-BOOK-003
Module: bookings / pricing
Title: Dynamic price calculation with all components
Objective: Verify accurate price breakdown
Scope: Pricing service, booking service
Preconditions: Listing with complex pricing rules
Test Data: Date range, duration, seasonal pricing, discounts
Steps:
  1. Calculate base price (nights × nightly rate)
  2. Apply weekend surcharges
  3. Apply seasonal adjustments
  4. Apply long-stay discounts
  5. Add service fee (platform percentage)
  6. Add cleaning fee
  7. Calculate security deposit
  8. Calculate insurance premium (optional)
  9. Verify total and breakdown accuracy
Expected Results:
  - Math precise to currency decimal places
  - Each component itemized in BookingPriceBreakdown
  - Currency conversion handled if needed
Priority: HIGH
Automation: jest (integration)
```

#### TC-BOOK-004: Cancellation Flow
```yaml
ID: TC-BOOK-004
Module: bookings
Title: Booking cancellation with refund calculation
Objective: Verify cancellation policies enforced
Scope: Cancellation service, payment service
Preconditions: Confirmed booking exists
Test Data: Various cancellation policies
Steps:
  1. Cancel with "flexible" policy (full refund)
  2. Verify refund amount calculated
  3. Cancel with "moderate" policy (partial refund)
  4. Verify penalty applied
  5. Cancel with "strict" policy (no refund)
  6. Verify refund processed or forfeited
  7. Verify booking state: CANCELLED
  8. Verify availability restored
Expected Results:
  - Policy rules applied correctly based on timing
  - Refund calculations accurate
  - Availability released immediately
  - Notifications sent to both parties
Priority: HIGH
Automation: jest (integration)
```

### 4.5 Payments Integration Tests

#### TC-PAY-001: Stripe Payment Intent Creation
```yaml
ID: TC-PAY-001
Module: payments
Title: Payment intent lifecycle with Stripe
Objective: Verify Stripe API integration
Scope: Payment service, Stripe SDK
Preconditions: Stripe test mode configured
Test Data: Valid card, booking requiring payment
Steps:
  1. Create payment intent for booking
  2. Verify amount matches booking total
  3. Capture client secret
  4. Simulate frontend confirmation
  5. Verify payment intent status transitions
  6. Handle 3D Secure challenge
  7. Verify webhook received and processed
  8. Confirm ledger entry created
Expected Results:
  - Payment intent ID stored
  - Stripe dashboard shows test transaction
  - Webhook signature verified
  - Idempotency key prevents duplicates
Priority: CRITICAL
Automation: jest (integration) with Stripe test mode
```

#### TC-PAY-002: Split Payments and Escrow
```yaml
ID: TC-PAY-002
Module: payments
Title: Host payout and platform fee splitting
Objective: Verify Connect marketplace payments
Scope: Payment service, payout service
Preconditions: Host with Stripe Connect account
Test Data: Confirmed booking
Steps:
  1. Capture payment from renter
  2. Calculate platform fee percentage
  3. Calculate host payout
  4. Create transfer to host Connect account
  5. Verify transfer scheduled or immediate
  6. Verify ledger entries (debits/credits)
  7. Verify escrow transaction record
Expected Results:
  - Platform fee deducted correctly
  - Host payout net of fees
  - Transfer created with correct amount
  - Ledger balances (double-entry)
Priority: CRITICAL
Automation: jest (integration)
```

#### TC-PAY-003: Refund Processing
```yaml
ID: TC-PAY-003
Module: payments
Title: Partial and full refund processing
Objective: Verify refund logic and ledger updates
Scope: Refund service, Stripe integration
Preconditions: Paid booking exists
Test Data: Booking eligible for refund
Steps:
  1. Calculate refund amount
  2. Process refund through Stripe
  3. Verify refund record created
  4. Verify ledger entries (negative charge)
  5. Verify booking payment status updated
  6. Handle partial refund (multiple refunds)
  7. Verify refund limits (cannot exceed payment)
Expected Results:
  - Refund processed with Stripe
  - Reason code recorded
  - Ledger reflects refund
  - Booking updated with refund info
Priority: HIGH
Automation: jest (integration)
```

#### TC-PAY-004: Webhook Handling
```yaml
ID: TC-PAY-004
Module: payments
Title: Stripe webhook event processing
Objective: Verify async payment event handling
Scope: Webhook controller, event handlers
Preconditions: Webhook endpoint configured
Test Data: Mock Stripe webhook payloads
Steps:
  1. Send payment_intent.succeeded event
  2. Verify signature validation
  3. Verify booking transitioned to CONFIRMED
  4. Send payment_intent.payment_failed event
  5. Verify booking transitioned to PAYMENT_FAILED
  6. Send charge.dispute.created event
  7. Verify dispute record created
  8. Test idempotency (duplicate webhook)
Expected Results:
  - Signature verified before processing
  - Events processed idempotently
  - Failed events retried or logged
Priority: CRITICAL
Automation: jest (integration) with mock webhooks
```

### 4.6 Messaging Integration Tests

#### TC-MSG-001: Conversation Lifecycle
```yaml
ID: TC-MSG-001
Module: messaging
Title: Create conversation and send messages
Objective: Verify messaging persistence and retrieval
Scope: Messaging service, conversation service
Preconditions: Two users exist
Test Data: Renter and host accounts
Steps:
  1. Initiate conversation from listing inquiry
  2. Verify conversation created with participants
  3. Send message from renter
  4. Verify message persisted
  5. Verify read receipt created
  6. Host replies
  7. Verify conversation thread order
  8. Test conversation privacy (only participants can view)
Expected Results:
  - Conversation linked to listing
  - Participants correctly assigned
  - Messages ordered chronologically
  - Read receipts updated
Priority: HIGH
Automation: jest (integration)
```

#### TC-MSG-002: Real-time Delivery
```yaml
ID: TC-MSG-002
Module: messaging
Title: Socket.io message broadcasting
Objective: Verify real-time message delivery
Scope: Socket.io adapter, Redis adapter
Preconditions: WebSocket connection established
Test Data: Connected clients
Steps:
  1. Establish WebSocket connection as User A
  2. User B sends message to User A
  3. Verify message received via WebSocket
  4. Verify message not broadcast to unrelated users
  5. Test reconnection scenario
  6. Verify missed messages delivered after reconnect
Expected Results:
  - Message delivered within <1 second
  - Room-based routing correct
  - Redis pub/sub functioning (multi-instance)
Priority: HIGH
Automation: jest (integration) with WebSocket client
```

### 4.7 Notifications Integration Tests

#### TC-NOTIF-001: Multi-channel Notification Delivery
```yaml
ID: TC-NOTIF-001
Module: notifications
Title: Email, SMS, and push notification routing
Objective: Verify notification dispatch to correct channels
Scope: Notification service, channel providers
Preconditions: User with contact preferences
Test Data: Notification templates
Steps:
  1. Create notification with email channel
  2. Verify email queued/send
  3. Create notification with SMS channel
  4. Verify SMS queued/send
  5. Create notification with push channel
  6. Verify FCM/APNs payload sent
  7. Test user preferences (opt-out respected)
Expected Results:
  - Channel selected based on user preferences
  - Delivery status tracked
  - Failed deliveries retried
Priority: MEDIUM
Automation: jest (integration) with mocked providers
```

#### TC-NOTIF-002: Notification Templates
```yaml
ID: TC-NOTIF-002
Module: notifications
Title: Template rendering with variables
Objective: Verify dynamic content substitution
Scope: Template service, rendering engine
Preconditions: Templates exist in database
Test Data: Templates with variables
Steps:
  1. Fetch template for "booking_confirmed"
  2. Provide context variables
  3. Render template
  4. Verify variable substitution
  5. Verify localization (if applicable)
  6. Test missing variables (graceful handling)
Expected Results:
  - Variables replaced correctly
  - HTML/text versions generated
  - No template injection vulnerabilities
Priority: MEDIUM
Automation: jest (unit/integration)
```

### 4.8 Reviews Integration Tests

#### TC-REV-001: Review Submission and Publication
```yaml
ID: TC-REV-001
Module: reviews
Title: Bi-directional review flow
Objective: Verify review lifecycle and trust scoring
Scope: Review service, trust score service
Preconditions: Completed booking
Test Data: Renter and host reviews
Steps:
  1. Renter submits review
  2. Verify review marked pending (awaiting both sides)
  3. Host submits review
  4. Verify both reviews published simultaneously
  5. Verify trust scores updated
  6. Verify listing rating updated
  7. Verify host response rate tracked
Expected Results:
  - Reviews linked to booking
  - Double-blind until both submitted
  - Aggregate ratings calculated correctly
Priority: MEDIUM
Automation: jest (integration)
```

### 4.9 Search Integration Tests

#### TC-SEARCH-001: Full-text Search Relevance
```yaml
ID: TC-SEARCH-001
Module: search
Title: PostgreSQL full-text search ranking
Objective: Verify search result relevance
Scope: Search service, query builder
Preconditions: Indexed listings exist
Test Data: Various search queries
Steps:
  1. Search by keyword in title
  2. Verify title matches rank higher
  3. Search by keyword in description
  4. Search with filters (category, price, location)
  5. Verify pagination
  6. Verify sorting options
Expected Results:
  - Relevance scoring functional
  - Filters combined correctly (AND logic)
  - Pagination returns correct counts
Priority: MEDIUM
Automation: jest (integration)
```

#### TC-SEARCH-002: Geospatial Search
```yaml
ID: TC-SEARCH-002
Module: search / geo
Title: Location-based search with radius
Objective: Verify geo-querying accuracy
Scope: Search service, geo utilities
Preconditions: Listings with coordinates
Test Data: Search location and radius
Steps:
  1. Search with lat/lng and 5km radius
  2. Verify listings within radius returned
  3. Verify listings outside radius excluded
  4. Sort by distance (nearest first)
  5. Handle listings without coordinates
Expected Results:
  - Haversine or similar distance calculation
  - Results sorted by proximity
  - Edge cases (equator, meridian) handled
Priority: MEDIUM
Automation: jest (integration)
```

### 4.10 Background Jobs Integration Tests

#### TC-JOB-001: Job Queue Processing
```yaml
ID: TC-JOB-001
Module: common/queue
Title: BullMQ job enqueue and processing
Objective: Verify job queue reliability
Scope: Queue service, worker processes
Preconditions: Redis queue configured
Test Data: Various job types
Steps:
  1. Enqueue email job
  2. Verify job in Redis queue
  3. Worker picks up job
  4. Verify job processed successfully
  5. Test job failure and retry
  6. Verify retry attempts with backoff
  7. Test dead letter queue after max retries
Expected Results:
  - Jobs processed FIFO (or priority)
  - Failed jobs retried
  - Monitoring data available
Priority: MEDIUM
Automation: jest (integration)
```

---

## 5. End-to-End Test Case Catalog

### 5.1 Complete User Registration Flow (E2E)

#### E2E-001: Full Registration with Email Verification
```yaml
ID: E2E-001
Journey: User Registration
Business Objective: New users can successfully register and verify email
Actor: New visitor
Prerequisites: Clean environment, email service configured
Environment: Staging or test with real email (or mailtrap)
Seed Data: None
Steps:
  1. Navigate to home page
  2. Click "Sign Up" in header
  3. Fill registration form:
     - Email: test-{uuid}@example.com
     - Username: testuser{uuid}
     - Password: SecurePass123!
     - First Name: Test
     - Last Name: User
  4. Submit form
  5. Verify redirect to "Check your email" page
  6. Check email inbox (or mailtrap)
  7. Click verification link
  8. Verify redirect to onboarding page
  9. Complete profile (optional fields)
  10. Verify access to authenticated features
System Responses:
  - Form validates in real-time
  - Success message displayed
  - Email delivered within 30 seconds
  - Verification link valid for 24 hours
UI Expectations:
  - Loading state on submit button
  - Inline validation errors
  - Toast notification on success
Backend Expectations:
  - User record created with emailVerified: false
  - Verification token generated
  - Welcome email queued
DB Expectations:
  - users table: new row with PENDING status
  - email_verification_tokens table: token record
Postconditions:
  - User authenticated and redirected to dashboard
Negative Variants:
  - Duplicate email error
  - Weak password rejection
  - Expired verification link handling
Priority: CRITICAL
```

### 5.2 Complete Booking Flow (E2E)

#### E2E-002: Request-to-Book Flow
```yaml
ID: E2E-002
Journey: Booking with Host Approval
Business Objective: Renter can request booking, host approves, payment completes
Actor: Renter + Host (two separate sessions)
Prerequisites: 
  - Host user with verified listing
  - Renter user with payment method
Seed Data: Listing with availability, host account
Steps:
  Renter Actions:
  1. Login as renter
  2. Browse to listing page
  3. Select available dates
  4. Click "Request to Book"
  5. Review booking summary
  6. Add message to host (optional)
  7. Submit request
  8. Verify booking in "Pending" state
  
  Host Actions:
  9. Login as host (separate session)
  10. Navigate to booking requests
  11. View booking request from renter
  12. Click "Approve"
  13. Add approval message (optional)
  
  Renter Actions (continued):
  14. Receive approval notification
  15. Navigate to checkout
  16. Enter payment details (or use saved)
  17. Complete payment
  18. Verify booking confirmed
System Responses:
  - Availability checked real-time
  - Notifications sent at each state change
  - Payment processed securely
  - Confirmation emails sent
UI Expectations:
  - Calendar shows availability correctly
  - Price updates as dates change
  - Booking status badge updates
  - Payment form with validation
Backend Expectations:
  - Booking state: PENDING → APPROVED → CONFIRMED
  - Payment intent created and confirmed
  - Availability slot marked booked
DB Expectations:
  - bookings table: state transitions logged
  - payments table: transaction recorded
  - notifications table: entries for each party
Postconditions:
  - Booking confirmed
  - Calendar blocked for dates
  - Host and renter can message
Negative Variants:
  - Requested unavailable dates (error)
  - Host declines (state change to DECLINED)
  - Payment fails (retry flow)
  - Timeout (auto-expire)
Priority: CRITICAL
```

### 5.3 Instant Book Flow (E2E)

#### E2E-003: Instant Booking with Immediate Payment
```yaml
ID: E2E-003
Journey: Instant Book
Business Objective: Renter can book instantly without host approval
Actor: Renter
Prerequisites:
  - Listing with instantBook enabled
  - Renter with saved payment method
Seed Data: Instant-bookable listing
Steps:
  1. Login as renter
  2. Browse to instant-book listing
  3. Select dates
  4. Click "Instant Book"
  5. Review booking (no approval needed)
  6. Confirm payment
  7. Booking immediately confirmed
  8. Access booking management
System Responses:
  - Skips PENDING_HOST_APPROVAL state
  - Immediate PAYMENT_PENDING → CONFIRMED
  - Host notified of instant booking
UI Expectations:
  - "Instant Book" badge on listing
  - Streamlined checkout (fewer steps)
Backend Expectations:
  - Direct state transition
  - Immediate payment required
Priority: CRITICAL
```

### 5.4 Listing Management Flow (E2E)

#### E2E-004: Complete Listing Creation
```yaml
ID: E2E-004
Journey: Host Creates and Publishes Listing
Business Objective: Hosts can create complete listings with all details
Actor: Host user
Prerequisites: Host account with Stripe Connect setup
Seed Data: None
Steps:
  1. Login as host
  2. Click "List Your Space"
  3. Select category (e.g., "Vacation Rental")
  4. Fill basic info:
     - Title: "Beautiful Beach House"
     - Description: Detailed description
     - Location: Full address
  5. Upload 5+ photos
  6. Set availability (calendar)
  7. Configure pricing:
     - Nightly rate: $150
     - Cleaning fee: $50
     - Security deposit: $200
  8. Set house rules and policies
  9. Review and submit
  10. Verify listing in dashboard
  11. Check search index (listing appears in search)
System Responses:
  - Photos uploaded to storage
  - Geocoding resolves address
  - Listing created with PENDING verification
  - Search index updated
UI Expectations:
  - Multi-step form with progress
  - Photo preview and reordering
  - Map preview of location
  - Price preview with fee breakdown
Backend Expectations:
  - Listing record with all relations
  - Availability slots generated
  - Photos in storage
DB Expectations:
  - listings table: new record
  - listing_attribute_values: dynamic attributes
  - availability_slots: generated records
Priority: CRITICAL
```

### 5.5 Messaging Flow (E2E)

#### E2E-005: Conversation Between Renter and Host
```yaml
ID: E2E-005
Journey: Inquiry and Negotiation
Business Objective: Users can communicate securely before booking
Actor: Renter and Host
Prerequisites: Listing exists, both users authenticated
Seed Data: Active listing
Steps:
  Renter:
  1. Browse listing
  2. Click "Contact Host"
  3. Compose message about availability
  4. Send message
  
  Host:
  5. Receive notification (in-app/push/email)
  6. Open messages
  7. View inquiry
  8. Reply with availability info
  9. Suggest alternate dates
  
  Renter:
  10. View reply in real-time
  11. Ask follow-up question
  12. Proceed to book based on discussion
System Responses:
  - Messages delivered real-time via WebSocket
  - Notifications sent offline users
  - Read receipts updated
UI Expectations:
  - Chat interface with message history
  - Typing indicators (if implemented)
  - Unread message badges
Backend Expectations:
  - Conversation created with both participants
  - Messages linked to conversation
  - Read receipts tracked
Priority: HIGH
```

### 5.6 Review Flow (E2E)

#### E2E-006: Post-Booking Review Exchange
```yaml
ID: E2E-006
Journey: Mutual Review Submission
Business Objective: Trust system maintained through honest reviews
Actor: Renter and Host
Prerequisites: Completed booking
Seed Data: Booking in COMPLETED state
Steps:
  Renter:
  1. Receive review prompt email
  2. Click link to review form
  3. Rate overall experience (4 stars)
  4. Rate categories: cleanliness, communication, accuracy
  5. Write review text
  6. Submit review
  7. See "Waiting for host review" message
  
  Host:
  8. Receive review notification
  9. Navigate to review form
  10. Rate renter (5 stars)
  11. Write feedback
  12. Submit review
  
  Both:
  13. Reviews published simultaneously
  14. View published reviews on profiles
System Responses:
  - Reviews held until both submit or timeout
  - Notifications sent when review received
  - Trust scores recalculated
UI Expectations:
  - Star rating component
  - Category-specific ratings
  - Character count for text
Backend Expectations:
  - Review records with PUBLISHED status
  - Trust score updates
  - Listing rating aggregation
Priority: MEDIUM
```

---

## 6. Playwright Test Case Catalog

### 6.1 Authentication Playwright Tests

#### PW-AUTH-001: Login Flow Visual Verification
```yaml
ID: PW-AUTH-001
Feature: Login
Browser Context: Desktop Chrome, 1280x720
Preloaded State: None
Fixtures: None
Steps:
  1. Navigate to /auth/login
  2. Verify page title "Login - GharBatai"
  3. Verify email input visible with label
  4. Verify password input visible with label
  5. Verify "Sign In" button disabled initially
  6. Type valid email: locator('[name="email"]').fill('test@example.com')
  7. Type password: locator('[name="password"]').fill('password')
  8. Verify button enabled
  9. Click submit: locator('button[type="submit"]').click()
  10. Verify loading state: expect(button).toHaveAttribute('disabled')
  11. On success: expect(page).toHaveURL(/dashboard/)
  12. Verify user menu shows email
DOM Assertions:
  - Email input has type="email"
  - Password input has type="password"
  - Button has role="button"
Network Assertions:
  - POST /api/v1/auth/login returns 200
  - Response contains accessToken
  - Refresh token set in httpOnly cookie
Storage Assertions:
  - localStorage: token present
  - sessionStorage: user data present
Screenshot: On failure
Trace: Enabled for CI
```

#### PW-AUTH-002: Login Form Validation
```yaml
ID: PW-AUTH-002
Feature: Login Validation
Steps:
  1. Navigate to /auth/login
  2. Click submit without filling fields
  3. Verify HTML5 validation: input:invalid
  4. Fill invalid email: "not-an-email"
  5. Verify email validation error visible
  6. Fill short password: "123"
  7. Verify password validation error
  8. Submit with invalid credentials
  9. Verify error toast: "Invalid credentials"
  10. Verify form not cleared (UX)
Selectors:
  - Email error: [data-testid="email-error"]
  - Password error: [data-testid="password-error"]
  - Toast: [role="alert"]
Accessibility:
  - aria-invalid on invalid inputs
  - aria-describedby links to error
  - Error announced to screen readers
```

#### PW-AUTH-003: MFA Flow
```yaml
ID: PW-AUTH-003
Feature: Multi-Factor Authentication
Preloaded State: User with MFA enabled, credentials
Steps:
  1. Login with valid credentials
  2. Verify redirect to /auth/mfa
  3. Verify TOTP input visible
  4. Enter invalid TOTP code: "000000"
  5. Submit
  6. Verify error: "Invalid verification code"
  7. Enter valid TOTP (generate from secret)
  8. Submit
  9. Verify redirect to dashboard
  10. Verify full authentication
Flake Prevention:
  - TOTP window tolerance (±1 interval)
  - Retry with next code if first fails
```

### 6.2 Navigation Playwright Tests

#### PW-NAV-001: Header Navigation
```yaml
ID: PW-NAV-001
Feature: Main Navigation
Steps:
  1. Visit home page
  2. Verify header links:
     - Logo (href="/")
     - Search (href="/search")
     - List Your Item (href="/listings/new")
     - Messages (href="/messages")
     - Profile dropdown
  3. Click each link
  4. Verify correct page loads
  5. Verify active state on current page
  6. Test mobile hamburger menu (viewport change)
Viewport Tests:
  - Desktop: 1280x720
  - Tablet: 768x1024
  - Mobile: 375x667
Responsive Assertions:
  - Mobile: hamburger menu visible
  - Desktop: full nav visible
```

#### PW-NAV-002: Protected Routes
```yaml
ID: PW-NAV-002
Feature: Route Guards
Steps:
  1. Logout (clear session)
  2. Navigate to /listings/new
  3. Verify redirect to /auth/login
  4. Verify returnUrl parameter: ?returnUrl=%2Flistings%2Fnew
  5. Login
  6. Verify redirect back to /listings/new
  7. Navigate to /admin (as non-admin)
  8. Verify 403 or redirect to dashboard
Accessibility:
  - Redirect announced to screen reader
```

### 6.3 Search Playwright Tests

#### PW-SEARCH-001: Search and Filter
```yaml
ID: PW-SEARCH-001
Feature: Listing Discovery
Steps:
  1. Navigate to /search
  2. Verify search input focused
  3. Type "beach house"
  4. Verify results update (debounced)
  5. Apply filters:
     - Category: Vacation Rental
     - Price min: $100
     - Price max: $300
  6. Verify URL updated with query params
  7. Verify filter chips visible
  8. Clear filters
  9. Verify results reset
  10. Test pagination (if >20 results)
Selectors:
  - Search: [name="q"]
  - Category: [data-testid="category-filter"]
  - Price: [data-testid="price-range"]
Network:
  - GET /api/v1/search?q=beach+house
  - Response time <500ms
Visual:
  - Listing cards render with image, title, price
  - Skeleton loader during fetch
```

#### PW-SEARCH-002: Empty States
```yaml
ID: PW-SEARCH-002
Feature: No Results Handling
Steps:
  1. Search for nonsense string: "xyz123abc"
  2. Verify "No results found" message
  3. Verify suggestions visible
  4. Verify clear search button
  5. Click clear
  6. Verify popular listings shown
```

### 6.4 Listing Detail Playwright Tests

#### PW-LIST-001: Listing Page Render
```yaml
ID: PW-LIST-001
Feature: Listing Detail View
Steps:
  1. Navigate to listing detail page
  2. Verify gallery renders with photos
  3. Verify title, location, price visible
  4. Verify host info card
  5. Verify description expandable
  6. Verify amenities list
  7. Verify map with location pin
  8. Verify reviews section
  9. Scroll to "Book Now" button
  10. Verify sticky booking widget (desktop)
Visual Regression:
  - Screenshot comparison for key sections
Accessibility:
  - Image alt texts
  - Heading hierarchy (h1 for title)
  - Form labels
```

#### PW-LIST-002: Booking Widget Interaction
```yaml
ID: PW-LIST-002
Feature: Date Selection and Booking
Steps:
  1. View listing with availability
  2. Click check-in date picker
  3. Select available date
  4. Select check-out date
  5. Verify price calculation updates
  6. Verify "Request to Book" enabled
  7. Click button
  8. Verify navigation to checkout
Selectors:
  - Calendar: [data-testid="availability-calendar"]
  - Price: [data-testid="total-price"]
  - Button: [data-testid="book-button"]
Keyboard:
  - Tab through calendar
  - Enter to select date
```

### 6.5 Checkout Playwright Tests

#### PW-CHECKOUT-001: Payment Form
```yaml
ID: PW-CHECKOUT-001
Feature: Checkout Flow
Steps:
  1. Navigate to checkout with valid booking
  2. Verify booking summary visible
  3. Verify price breakdown
  4. Select payment method (or enter new card)
  5. Fill Stripe Elements test card:
     - Number: 4242424242424242
     - Expiry: 12/25
     - CVC: 123
  6. Submit payment
  7. Verify 3D Secure handling (if triggered)
  8. Verify success page
  9. Verify booking confirmation details
Network:
  - POST /api/v1/payments/create-intent
  - POST /api/v1/payments/confirm
  - Webhook handling (test mode)
Security:
  - Card numbers not in DOM
  - Stripe Elements iframe used
  - HTTPS enforced
```

#### PW-CHECKOUT-002: Payment Failure Handling
```yaml
ID: PW-CHECKOUT-002
Feature: Declined Payment
Steps:
  1. Use Stripe test decline card: 4000000000000002
  2. Submit payment
  3. Verify error message: "Your card was declined"
  4. Verify form preserved
  5. Allow retry with different card
  6. Test insufficient funds: 4000000000009995
  7. Verify specific error messaging
```

### 6.6 Dashboard Playwright Tests

#### PW-DASH-001: Host Dashboard
```yaml
ID: PW-DASH-001
Feature: Host Management Interface
Steps:
  1. Login as host
  2. Navigate to /dashboard
  3. Verify listings count
  4. Verify upcoming bookings widget
  5. Verify earnings summary
  6. Click on listing
  7. Verify listing management page
  8. Edit listing details
  9. Save changes
  10. Verify update reflected
Selectors:
  - Listings: [data-testid="host-listings"]
  - Bookings: [data-testid="upcoming-bookings"]
  - Earnings: [data-testid="earnings-card"]
```

#### PW-DASH-002: Booking Management
```yaml
ID: PW-DASH-002
Feature: Booking List and Actions
Steps:
  1. View bookings list
  2. Filter by status: PENDING, CONFIRMED, COMPLETED
  3. Click booking for details
  4. Verify guest info, dates, payout
  5. For pending booking: click Approve
  6. Verify confirmation modal
  7. Confirm
  8. Verify status updated to APPROVED
  9. Verify notification sent
```

### 6.7 Messaging Playwright Tests

#### PW-MSG-001: Chat Interface
```yaml
ID: PW-MSG-001
Feature: Real-time Messaging
Steps:
  1. Login as User A
  2. Open messages
  3. Start new conversation
  4. Type message
  5. Send
  6. In parallel: Login as User B
  7. Verify message received real-time
  8. Reply from User B
  9. Verify User A sees reply
  10. Test scroll behavior for long conversations
Network:
  - WebSocket connection established
  - Message events received
  - No polling for messages
```

### 6.8 Responsive Design Playwright Tests

#### PW-RESP-001: Mobile Navigation
```yaml
ID: PW-RESP-001
Feature: Mobile Experience
Viewport: iPhone 14 (390×844)
Steps:
  1. Test hamburger menu opens
  2. Test navigation items visible
  3. Test search bar collapses appropriately
  4. Test listing cards stack vertically
  5. Test booking widget becomes modal or inline
  6. Test touch targets minimum 44px
  7. Test font sizes readable
  8. Test horizontal overflow prevented
```

---

## 7. Manual Testing Matrix

### 7.1 Cross-Browser Compatibility

| Workflow | Chrome | Firefox | Safari | Edge | Mobile Safari | Mobile Chrome |
|----------|--------|---------|--------|------|---------------|---------------|
| Registration | Verify | Verify | Verify | Verify | Verify | Verify |
| Login with MFA | Verify | Verify | Verify | Verify | Verify | Verify |
| Listing Creation | Verify | Verify | Verify | Verify | - | Verify |
| Booking Flow | Verify | Verify | Verify | Verify | Verify | Verify |
| Payment (Stripe) | Verify | Verify | Verify | Verify | Verify | Verify |
| Messaging | Verify | Verify | Verify | Verify | Verify | Verify |
| File Upload | Verify | Verify | Verify | Verify | Camera | Camera |

### 7.2 Payment Method Testing

| Card Type | Number | Expected Result | Tested |
|-----------|--------|-----------------|--------|
| Visa | 4242424242424242 | Success | ☐ |
| Visa (debit) | 4000056655665556 | Success | ☐ |
| Mastercard | 5555555555554444 | Success | ☐ |
| Amex | 378282246310005 | Success | ☐ |
| Decline generic | 4000000000000002 | Declined | ☐ |
| Insufficient funds | 4000000000009995 | Declined | ☐ |
| Lost card | 4000000000009987 | Declined | ☐ |
| 3D Secure | 4000002500003155 | Challenge | ☐ |

### 7.3 Security Test Scenarios

#### Manual Security Checklist
- **SQL Injection**: Attempt injection in search, login forms
- **XSS**: Inject `<script>` in listing description, messages
- **CSRF**: Verify tokens on state-changing requests
- **IDOR**: Access other users' bookings by modifying IDs in URLs
- **Rate Limiting**: Rapid-fire requests to auth endpoints
- **Session Fixation**: Attempt session hijacking
- **File Upload**: Attempt malicious file uploads
- **Password Reset**: Test token expiration, reuse

### 7.4 Performance Test Scenarios

| Workflow | Target | Test Method | Pass Criteria |
|----------|--------|-------------|---------------|
| Home page load | <2s | Lighthouse | LCP < 2.5s |
| Search results | <1s | Network panel | TTFB < 200ms |
| Listing detail | <2s | Lighthouse | LCP < 2.5s |
| Checkout load | <1.5s | Network panel | TTFB < 200ms |
| Image loading | Progressive | DevTools | Blur-up works |
| API response | <200ms | k6 | p95 < 200ms |

---

## 8. Test Data and Environment Plan

### 8.1 Test Environments

| Environment | Purpose | Data | External Services |
|-------------|---------|------|-------------------|
| **Local** | Development | Docker compose, seeded | Stripe test, mocked email |
| **CI Test** | Automated testing | Fresh per run | Mocked (MSW) |
| **Staging** | Pre-release validation | Production-like | Stripe test, real email (mailtrap) |
| **Production** | Smoke tests | Real (read-only) | Production services |

### 8.2 Test Data Strategy

#### Seeded Users (Deterministic)
```yaml
users:
  - email: admin@gharbatai.com
    role: ADMIN
    password: TestPass123!
    
  - email: host-verified@example.com
    role: HOST
    stripeConnect: verified
    listings: 3
    
  - email: host-pending@example.com
    role: HOST
    stripeConnect: pending
    listings: 1
    
  - email: renter-premium@example.com
    role: RENTER
    bookings: 5
    verified: true
    
  - email: renter-new@example.com
    role: RENTER
    bookings: 0
    
  - email: user-mfa@example.com
    role: USER
    mfaEnabled: true
```

#### Deterministic Fixtures
- **UUIDs**: Use predictable UUIDs for consistent testing
- **Dates**: Use relative dates (today + N days)
- **Prices**: Standard test amounts ($100, $150, etc.)
- **Locations**: Fixed coordinates for geocoding tests

### 8.3 Data Reset Strategy

#### Per-Test Cleanup
```typescript
// After each test
- Delete created users (cascade)
- Cancel test bookings
- Delete test listings and photos
- Clear test payments (Stripe test mode)
- Reset rate limiting counters
```

#### Test Suite Reset
```bash
# Full reset between major test suites
- Truncate non-reference tables
- Reset sequences
- Re-seed reference data (categories, configs)
- Clear Redis keys (sessions, rate limits)
- Clear storage bucket (test prefix only)
```

---

## 9. Infra and Observability Requirements for Testing

### 9.1 Required Services

```yaml
Application:
  - API server (port 3400/3000)
  - Web server (port 3401/3000)
  - WebSocket server (port 3400)

Data:
  - PostgreSQL (port 5432/3432)
  - Redis (port 6379/3479)
  - MinIO/S3 (port 9000)

Search (optional):
  - Elasticsearch/OpenSearch (port 9200)

Testing:
  - Playwright browsers (Chromium, Firefox, WebKit)
  - Stripe CLI (webhook forwarding)
  - Mailtrap/SMTP catcher
```

### 9.2 Observability During Tests

#### Logging Requirements
- API request/response logs (structured JSON)
- Database query logs (slow query threshold: 100ms)
- Error stack traces with correlation IDs
- WebSocket event logs
- Background job execution logs

#### Metrics to Track
- Test execution time (per test, per suite)
- API response times (p50, p95, p99)
- Database connection pool usage
- Memory usage (leak detection)
- Browser console errors (Playwright)

#### Artifact Capture
- Playwright: screenshots on failure, traces for flakes
- API: HAR files for failed requests
- DB: Query logs for slow operations
- Coverage: Line, branch, function coverage reports

### 9.3 Test Reporting

```yaml
Reports:
  - JUnit XML for CI integration
  - HTML report with screenshots
  - Coverage report (Istanbul/nyc)
  - Lighthouse CI reports (performance)
  - Playwright trace viewer links

Notifications:
  - Slack: Test suite results
  - Email: Nightly test failures
  - PR Comments: Coverage changes
```

---

## 10. Coverage Gaps and Risk Areas

### 10.1 Known Testability Challenges

| Area | Challenge | Mitigation |
|------|-----------|------------|
| **Stripe Webhooks** | Async, signature verification | Stripe CLI for local, mocked in CI |
| **Socket.io Real-time** | Connection state, reconnect | Test client library, simulate disconnect |
| **File Uploads** | Storage dependencies | MinIO in Docker, cleanup after tests |
| **Background Jobs** | Timing, retry logic | Expose job status API, test in isolation |
| **Geocoding** | External API, rate limits | Mock service, record fixtures |
| **AI Moderation** | Non-deterministic | Mock responses, test integration only |
| **Push Notifications** | Device-specific | Use notification service API directly |
| **Email Delivery** | Async, deliverability | Mailtrap API verification |

### 10.2 Refactoring for Testability

1. **Extract Pure Functions**: Business logic should be testable without DB
2. **Dependency Injection**: Services injectable for mocking
3. **Event Interfaces**: Clear contracts for event publishers/consumers
4. **Test Hooks**: Expose endpoints for test setup/teardown (dev only)
5. **Feature Flags**: Enable/disable features for isolated testing

### 10.3 Brittle Test Areas

- **Date/Time**: Use time-freezing libraries (timekeeper, jest fake timers)
- **Random IDs**: Seed random generators or use deterministic IDs
- **External APIs**: Always mock, record fixtures for integration tests
- **Database IDs**: Don't assert on specific IDs, assert on relationships
- **Timestamps**: Use tolerance ranges (within 1 second)

---

## 11. Prioritized Execution Plan

### 11.1 Phase 1: Critical Smoke Tests (Week 1-2)

**Objective**: Block broken deployments, catch major regressions

**Included Suites**:
- TC-AUTH-001, TC-AUTH-002 (Auth core)
- TC-USER-002 (RBAC)
- E2E-001 (Registration)
- E2E-002, E2E-003 (Booking flows)
- PW-AUTH-001, PW-SEARCH-001 (Basic navigation)

**CI Integration**:
```yaml
# On every PR
- test:smoke (5 min timeout)
- Run in parallel with build
- Block merge on failure
```

**Exit Criteria**:
- All smoke tests passing
- <2 minute execution time
- 100% reliability (no flakes)

### 11.2 Phase 2: Core Business Workflows (Week 3-4)

**Objective**: Validate primary user journeys

**Included Suites**:
- All auth integration tests
- All listings integration tests
- All bookings integration tests
- E2E-004, E2E-005, E2E-006
- Payment integration tests (mocked)
- Messaging E2E tests

**CI Integration**:
```yaml
# On every PR (full suite)
- test:integration
- test:e2e:web:core
- 15 min timeout
```

**Exit Criteria**:
- 90% of core workflows covered
- <10% flake rate
- Coverage report generated

### 11.3 Phase 3: Permissions, Edge Cases, Failures (Week 5-6)

**Objective**: Security and resilience validation

**Included Suites**:
- TC-USER-002 (RBAC expanded)
- TC-BOOK-002 (Concurrency)
- TC-PAY-004 (Webhook failures)
- All error path E2E tests
- Security manual tests
- Rate limiting tests

**CI Integration**:
```yaml
# Nightly run
- test:security
- test:chaos (failure injection)
```

**Exit Criteria**:
- All RBAC scenarios covered
- Failure modes documented and tested
- Security checklist complete

### 11.4 Phase 4: Broader Regression Coverage (Week 7-8)

**Objective**: Comprehensive coverage across all modules

**Included Suites**:
- All remaining integration tests
- All Playwright tests
- Mobile E2E tests
- Review, dispute, notification flows
- Search and discovery tests
- Admin dashboard tests

**CI Integration**:
```yaml
# Pre-release gate
- test:all (full suite)
- test:e2e:web:full
- test:e2e:mobile
```

**Exit Criteria**:
- 80% code coverage
- All user journeys automated
- Mobile tests passing

### 11.5 Phase 5: Resilience and Performance (Ongoing)

**Objective**: Production readiness validation

**Included Suites**:
- Load tests (k6)
- Performance regression (Lighthouse CI)
- Concurrent user tests
- Failover and recovery tests
- Data consistency tests

**CI Integration**:
```yaml
# Weekly + pre-release
- test:load
- lighthouse CI
```

---

## 12. Final Deliverables

### 12.1 Test Inventory Summary

| Category | Count | Automated | Priority |
|----------|-------|-----------|----------|
| Integration Tests | 50+ | Jest | P0 |
| E2E Tests (Backend) | 15+ | Jest + Supertest | P0 |
| Playwright Tests | 40+ | Playwright | P0 |
| Mobile E2E Tests | 20+ | Detox/Appium | P1 |
| Load Tests | 10 | k6 | P2 |
| Security Tests | 25 | Manual + automated | P1 |
| Visual Regression | 30 | Playwright + Argos | P2 |

### 12.2 Recommended File Organization

```
apps/api/
  test/
    integration/
      auth/
        login.spec.ts
        mfa.spec.ts
        oauth.spec.ts
      listings/
        create.spec.ts
        search.spec.ts
      bookings/
        lifecycle.spec.ts
        conflicts.spec.ts
      payments/
        stripe.spec.ts
        webhooks.spec.ts
    e2e/
      flows/
        booking-flow.spec.ts
        dispute-flow.spec.ts
    fixtures/
      users.json
      listings.json
      categories.json

apps/web/
  e2e/
    playwright/
      auth/
        login.spec.ts
        register.spec.ts
      listings/
        create.spec.ts
        search.spec.ts
        detail.spec.ts
      bookings/
        book.spec.ts
        checkout.spec.ts
      messaging/
        chat.spec.ts
      fixtures/
        auth.json
  tests/
    unit/
    integration/

apps/mobile/
  e2e/
    detox/
      auth.spec.js
      booking.spec.js
      
tests/
  load/
    api-load.js
    checkout-load.js
```

### 12.3 Naming Conventions

**Integration Tests**:
```
{module}-{feature}-{scenario}.spec.ts
Example: auth-login-success.spec.ts
```

**E2E Tests**:
```
{journey}-{variant}.spec.ts
Example: booking-instant-payment.spec.ts
```

**Playwright Tests**:
```
{page}-{action}-{state}.spec.ts
Example: listing-detail-booking.spec.ts
```

### 12.4 Tagging Strategy

```typescript
// Test metadata
describe('Booking Flow', () => {
  it('completes instant booking', 
    { 
      tags: ['smoke', 'booking', 'payment', 'critical'],
      ci: 'pr-gate',
      owner: '@team-payments'
    }, 
    () => { /* test */ }
  );
});
```

### 12.5 CI Categorization

```yaml
# GitHub Actions workflow
jobs:
  smoke:
    runs-on: ubuntu-latest
    steps:
      - run: pnpm run test:smoke
    if: github.event_name == 'pull_request'

  integration:
    needs: smoke
    runs-on: ubuntu-latest
    steps:
      - run: pnpm run test:integration

  e2e-web:
    needs: integration
    runs-on: ubuntu-latest
    steps:
      - run: pnpm run test:e2e:web:isolated:core

  full-regression:
    needs: e2e-web
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - run: pnpm run test:all

  nightly:
    schedule: '0 0 * * *'
    steps:
      - run: pnpm run test:security
      - run: pnpm run test:load -- api
      - run: pnpm run lighthouse
```

---

## Appendices

### A. Test Environment Variables

```bash
# .env.test
NODE_ENV=test
DATABASE_URL=postgresql://test:test@localhost:3432/rental_test
REDIS_URL=redis://localhost:3479
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
ALLOW_DEV_LOGIN=true
DISABLE_THROTTLE=true
MOCK_EXTERNAL_SERVICES=true
```

### B. Test Utility Commands

```bash
# Reset test database
pnpm run db:reset:test

# Seed test data
pnpm run db:seed:test

# Run specific test
pnpm run test:integration -- auth/login

# Run with coverage
pnpm run test:coverage

# Debug Playwright
pnpm run test:e2e:web -- --debug

# View Playwright report
pnpm run test:e2e:web -- --reporter=html
```

### C. Troubleshooting Guide

| Issue | Cause | Solution |
|-------|-------|----------|
| Flaky Playwright tests | Race conditions | Use `waitFor` selectors, increase timeouts |
| DB connection timeouts | Pool exhaustion | Increase pool size, check connection cleanup |
| Stripe webhook failures | Timing | Use `stripe listen` CLI, add retry logic |
| Test data pollution | Missing cleanup | Implement `afterEach` cleanup, use transactions |
| Slow test execution | Unnecessary setup | Use testcontainers, parallel execution |

---

**Document Version**: 1.0
**Last Updated**: Generated from codebase analysis
**Owner**: Engineering + QA Teams
**Review Cycle**: Monthly during active development

