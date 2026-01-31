# Universal Rental Portal — Detailed Execution Plan

## Technology Stack Overview

| Layer                | Technology                                           | Purpose                                |
| -------------------- | ---------------------------------------------------- | -------------------------------------- |
| **Web Frontend**     | React 18+ + TypeScript + TailwindCSS + Vite          | Customer & Admin Web Portals           |
| **Mobile App**       | React Native + TypeScript + NativeWind (TailwindCSS) | iOS & Android Customer App             |
| **Backend API**      | NestJS + TypeScript                                  | REST/GraphQL API Services              |
| **Primary Database** | PostgreSQL 15+                                       | Transactional data, ledger, audit logs |
| **Cache/Queue**      | Redis 7+                                             | Caching, sessions, background jobs     |
| **Search Engine**    | Elasticsearch 8+ / OpenSearch                        | Full-text search, geo-queries          |
| **Object Storage**   | AWS S3 / Cloudflare R2                               | Media files, evidence, documents       |
| **CDN**              | CloudFront / Cloudflare                              | Static assets, media delivery          |
| **Message Queue**    | BullMQ (Redis-based)                                 | Background jobs, event processing      |
| **Payment Provider** | Stripe Connect                                       | Payments, deposits, payouts            |
| **Email Service**    | SendGrid / AWS SES                                   | Transactional emails                   |
| **Real-time**        | Socket.io                                            | Messaging, notifications               |
| **Monitoring**       | Prometheus + Grafana + Sentry                        | Metrics, APM, error tracking           |

---

## Project Structure (Monorepo with Turborepo)

```
gharbatai-rentals/
├── apps/
│   ├── web/                          # React Customer Web Portal
│   │   ├── src/
│   │   │   ├── app/                  # Next.js 14 App Router
│   │   │   ├── components/           # Shared UI components
│   │   │   ├── features/             # Feature modules
│   │   │   ├── hooks/                # Custom React hooks
│   │   │   ├── lib/                  # Utilities, API clients
│   │   │   └── styles/               # Global styles, Tailwind config
│   │   └── package.json
│   │
│   ├── admin/                        # React Admin Portal
│   │   ├── src/
│   │   │   ├── app/                  # Admin routes
│   │   │   ├── components/           # Admin-specific components
│   │   │   ├── features/             # Admin feature modules
│   │   │   └── lib/
│   │   └── package.json
│   │
│   ├── mobile/                       # React Native App
│   │   ├── src/
│   │   │   ├── app/                  # Expo Router navigation
│   │   │   ├── components/           # Mobile components
│   │   │   ├── features/             # Feature modules
│   │   │   ├── hooks/
│   │   │   └── lib/
│   │   └── package.json
│   │
│   └── api/                          # NestJS Backend
│       ├── src/
│       │   ├── core/                 # Shared domain logic
│       │   │   ├── categories/       # Category templates
│       │   │   ├── policies/         # Policy engine
│       │   │   └── common/           # Base classes, decorators
│       │   ├── modules/              # Feature modules
│       │   │   ├── auth/
│       │   │   ├── users/
│       │   │   ├── listings/
│       │   │   ├── bookings/
│       │   │   ├── payments/
│       │   │   ├── messaging/
│       │   │   ├── fulfillment/
│       │   │   ├── reviews/
│       │   │   ├── disputes/
│       │   │   ├── search/
│       │   │   ├── notifications/
│       │   │   └── admin/
│       │   ├── infrastructure/       # External integrations
│       │   │   ├── database/
│       │   │   ├── cache/
│       │   │   ├── queue/
│       │   │   ├── storage/
│       │   │   ├── payment/
│       │   │   ├── email/
│       │   │   └── search/
│       │   └── shared/               # Utilities, types
│       └── package.json
│
├── packages/
│   ├── ui/                           # Shared UI Component Library
│   │   ├── src/
│   │   │   ├── components/           # Atomic design components
│   │   │   │   ├── atoms/
│   │   │   │   ├── molecules/
│   │   │   │   └── organisms/
│   │   │   └── styles/
│   │   └── package.json
│   │
│   ├── api-client/                   # Generated API Client (OpenAPI)
│   │   ├── src/
│   │   └── package.json
│   │
│   ├── shared-types/                 # Shared TypeScript Types
│   │   ├── src/
│   │   │   ├── entities/
│   │   │   ├── api/
│   │   │   └── enums/
│   │   └── package.json
│   │
│   ├── validators/                   # Shared Validation Schemas (Zod)
│   │   ├── src/
│   │   └── package.json
│   │
│   └── config/                       # Shared Configurations
│       ├── eslint/
│       ├── typescript/
│       └── tailwind/
│
├── infrastructure/
│   ├── docker/
│   │   ├── docker-compose.yml
│   │   ├── docker-compose.dev.yml
│   │   └── Dockerfile.*
│   ├── terraform/
│   │   ├── modules/
│   │   └── environments/
│   └── k8s/
│       ├── base/
│       └── overlays/
│
├── docs/
│   ├── api/                          # API Documentation
│   ├── architecture/                 # Architecture docs
│   └── runbooks/                     # Operations runbooks
│
├── scripts/
│   ├── setup.sh
│   ├── seed-data.ts
│   └── migrate.sh
│
├── turbo.json                        # Turborepo config
├── package.json                      # Root package.json
└── pnpm-workspace.yaml               # Workspace config
```

---

# PHASE 0: Project Setup & Foundation (Week 1-2)

## Sprint 0.1: Development Environment Setup

### Tasks

#### 0.1.1 Monorepo Initialization

```
Priority: P0 | Estimate: 4h | Owner: Lead Dev
```

- [ ] Initialize Turborepo monorepo structure
- [ ] Configure pnpm workspaces
- [ ] Set up root `package.json` with shared scripts
- [ ] Configure `.nvmrc` for Node.js version (20.x LTS)
- [ ] Set up `turbo.json` with build/dev/test pipelines

#### 0.1.2 TypeScript Configuration

```
Priority: P0 | Estimate: 2h | Owner: Lead Dev
```

- [ ] Create base `tsconfig.json` in `packages/config/typescript/`
- [ ] Configure path aliases for all packages
- [ ] Set up strict mode with proper compiler options
- [ ] Configure project references for monorepo

#### 0.1.3 ESLint & Prettier Setup

```
Priority: P0 | Estimate: 2h | Owner: Lead Dev
```

- [ ] Create shared ESLint config in `packages/config/eslint/`
- [ ] Configure rules for React, NestJS, and general TypeScript
- [ ] Set up Prettier with consistent formatting
- [ ] Configure lint-staged for pre-commit hooks

#### 0.1.4 Git Hooks & CI/CD Foundation

```
Priority: P0 | Estimate: 4h | Owner: DevOps
```

- [ ] Set up Husky for Git hooks
- [ ] Configure commitlint with conventional commits
- [ ] Create GitHub Actions workflow for CI
- [ ] Set up branch protection rules
- [ ] Configure PR templates and issue templates

#### 0.1.5 Docker Development Environment

```
Priority: P0 | Estimate: 4h | Owner: DevOps
```

- [ ] Create `docker-compose.dev.yml` with:
  - PostgreSQL 15 with extensions (uuid-ossp, pgcrypto)
  - Redis 7 (cache + queue)
  - Elasticsearch 8 / OpenSearch
  - MinIO (S3-compatible local storage)
  - Mailhog (email testing)
- [ ] Create Dockerfiles for API and web apps
- [ ] Configure volume mounts for development
- [ ] Set up health checks for all services

---

## Sprint 0.2: Shared Packages Setup

### Tasks

#### 0.2.1 Shared Types Package (`packages/shared-types`)

```
Priority: P0 | Estimate: 8h | Owner: Backend Lead
```

- [ ] Define core entity interfaces:
  - `User`, `UserProfile`, `VerificationFlags`
  - `Listing`, `ListingMedia`, `ListingAttributes`
  - `Booking`, `BookingStatus`, `BookingStateTransition`
  - `Payment`, `PaymentIntent`, `DepositHold`, `LedgerEntry`
  - `Message`, `MessageThread`, `Notification`
  - `Review`, `ReviewTag`
  - `Dispute`, `DisputeOutcome`, `EvidenceBundle`
  - `ConditionReport`, `ChecklistItem`, `EvidenceAttachment`
- [ ] Define API request/response types
- [ ] Define enum types for all status fields
- [ ] Export types from package entry point

#### 0.2.2 Validators Package (`packages/validators`)

```
Priority: P0 | Estimate: 6h | Owner: Backend Lead
```

- [ ] Set up Zod for schema validation
- [ ] Create validation schemas matching all entity types
- [ ] Create API request validation schemas
- [ ] Export reusable validators for frontend and backend

#### 0.2.3 Shared UI Package (`packages/ui`)

```
Priority: P1 | Estimate: 12h | Owner: Frontend Lead
```

- [ ] Set up Tailwind CSS base configuration
- [ ] Define design tokens (colors, typography, spacing)
- [ ] Create atomic components:
  - **Atoms**: Button, Input, Textarea, Select, Checkbox, Radio, Badge, Avatar, Icon
  - **Molecules**: FormField, Card, Modal, Dropdown, Tabs, Pagination
  - **Organisms**: DataTable, Form, DatePicker, FileUpload, RichTextEditor
- [ ] Set up Storybook for component documentation
- [ ] Configure component exports with tree-shaking

#### 0.2.4 API Client Package (`packages/api-client`)

```
Priority: P1 | Estimate: 4h | Owner: Frontend Lead
```

- [ ] Set up OpenAPI code generator (orval/openapi-typescript)
- [ ] Configure automatic client generation from backend OpenAPI spec
- [ ] Create React Query hooks wrapper
- [ ] Set up request/response interceptors
- [ ] Configure error handling utilities

---

# PHASE 1: Backend Foundation (Week 2-4)

## Sprint 1.1: NestJS Core Setup

### Tasks

#### 1.1.1 NestJS Project Structure

```
Priority: P0 | Estimate: 4h | Owner: Backend Lead
```

- [ ] Initialize NestJS project with strict TypeScript
- [ ] Configure module structure with feature modules
- [ ] Set up ConfigModule with environment validation
- [ ] Configure CORS, compression, helmet
- [ ] Set up request logging middleware
- [ ] Configure OpenAPI/Swagger documentation

#### 1.1.2 Database Setup (Prisma/TypeORM)

```
Priority: P0 | Estimate: 8h | Owner: Backend Lead
```

- [ ] Set up Prisma ORM with PostgreSQL
- [ ] Create initial schema with core entities:

  ```prisma
  // Core Identity
  model User {}
  model UserProfile {}
  model Verification {}
  model Session {}

  // Categories
  model CategoryTemplate {}

  // Listings
  model Listing {}
  model ListingMedia {}
  model ListingAttributes {}
  model AvailabilityRule {}

  // Bookings
  model Booking {}
  model BookingStateHistory {}
  model BookingAgreement {}

  // Payments
  model PaymentIntent {}
  model DepositHold {}
  model LedgerEntry {}
  model Payout {}

  // Communication
  model MessageThread {}
  model Message {}
  model Notification {}

  // Fulfillment
  model ConditionReport {}
  model ChecklistTemplate {}
  model ChecklistResponse {}
  model EvidenceAttachment {}

  // Reviews
  model Review {}

  // Disputes
  model Dispute {}
  model DisputeEvidence {}
  model DisputeTimeline {}

  // Admin
  model AdminUser {}
  model AuditLog {}
  model PolicyRule {}
  ```

- [ ] Set up Prisma migrations workflow
- [ ] Create seed data scripts
- [ ] Configure connection pooling (PgBouncer)

#### 1.1.3 Redis Integration

```
Priority: P0 | Estimate: 4h | Owner: Backend Dev
```

- [ ] Set up Redis module with `ioredis`
- [ ] Configure cache manager with TTL strategies
- [ ] Set up session storage
- [ ] Configure rate limiting with Redis
- [ ] Set up distributed locking for concurrency control

#### 1.1.4 Queue System (BullMQ)

```
Priority: P0 | Estimate: 4h | Owner: Backend Dev
```

- [ ] Set up BullMQ with Redis
- [ ] Create queue definitions:
  - `email-notifications`
  - `sms-notifications`
  - `push-notifications`
  - `media-processing`
  - `search-indexing`
  - `payment-webhooks`
  - `reconciliation`
  - `cleanup-jobs`
- [ ] Configure worker concurrency
- [ ] Set up dead letter queues
- [ ] Create Bull Board dashboard for monitoring

---

## Sprint 1.2: Authentication & Authorization

### Tasks

#### 1.2.1 JWT Authentication Module

```
Priority: P0 | Estimate: 8h | Owner: Backend Lead
```

- [ ] Create `AuthModule` with JWT strategy
- [ ] Implement login endpoint with email/password
- [ ] Implement registration endpoint with email verification
- [ ] Create refresh token rotation mechanism
- [ ] Implement password reset flow
- [ ] Add rate limiting for auth endpoints
- [ ] Configure brute force protection

**Endpoints:**

```typescript
POST / api / v1 / auth / register;
POST / api / v1 / auth / login;
POST / api / v1 / auth / refresh;
POST / api / v1 / auth / logout;
POST / api / v1 / auth / forgot - password;
POST / api / v1 / auth / reset - password;
POST / api / v1 / auth / verify - email;
POST / api / v1 / auth / resend - verification;
```

#### 1.2.2 User Management Module

```
Priority: P0 | Estimate: 6h | Owner: Backend Dev
```

- [ ] Create `UsersModule` with CRUD operations
- [ ] Implement profile management
- [ ] Add avatar upload with image processing
- [ ] Implement verification tier system (basic, verified, advanced)
- [ ] Create trust score calculation service

**Endpoints:**

```typescript
GET    /api/v1/users/me
PUT    /api/v1/users/me
GET    /api/v1/users/:id/public-profile
PUT    /api/v1/users/me/avatar
GET    /api/v1/users/me/verifications
POST   /api/v1/users/me/verifications/:type
```

#### 1.2.3 RBAC Implementation

```
Priority: P0 | Estimate: 6h | Owner: Backend Lead
```

- [ ] Define roles: `user`, `owner`, `admin`, `support`, `finance`
- [ ] Create permissions enum with granular access
- [ ] Implement `@Roles()` decorator
- [ ] Implement `@Permissions()` decorator
- [ ] Create RolesGuard and PermissionsGuard
- [ ] Configure role-based endpoint access

#### 1.2.4 Audit Logging System

```
Priority: P0 | Estimate: 6h | Owner: Backend Dev
```

- [ ] Create `AuditModule` with interceptor
- [ ] Implement `@Auditable()` decorator
- [ ] Log all state changes, admin actions, financial operations
- [ ] Store: action, actor, resource, changes (diff), IP, user agent, timestamp
- [ ] Create audit log query endpoints for admin
- [ ] Ensure immutability (append-only pattern)

---

## Sprint 1.3: Category Template System

### Tasks

#### 1.3.1 Template Registry Service

```
Priority: P0 | Estimate: 8h | Owner: Backend Lead
```

- [ ] Create `CategoriesModule`
- [ ] Implement `CategoryTemplateRegistry` service
- [ ] Store JSON schemas in database with versioning
- [ ] Implement schema validation using Ajv
- [ ] Create template-to-UI-fields mapper
- [ ] Support schema migrations between versions

#### 1.3.2 Category Template Definitions

```
Priority: P0 | Estimate: 10h | Owner: Backend Dev
```

Create JSON schema templates for each category:

- [ ] **Spaces** (`spaces.json`):
  - Required: spaceType, capacity, bedrooms, bathrooms, address
  - Optional: amenities, houseRules, parkingInfo
  - Pricing: per_night, cleaning_fee
  - Checklist: space_checkin, space_checkout

- [ ] **Vehicles** (`vehicles.json`):
  - Required: type, make, model, year, transmission, fuelType
  - Optional: seats, doors, features, insuranceInfo
  - Pricing: per_day, per_hour, mileageRules, lateFees
  - Checklist: vehicle_checkin, vehicle_checkout

- [ ] **Instruments** (`instruments.json`):
  - Required: type, brand, model, accessories
  - Optional: condition, serialNumber
  - Pricing: per_day, per_week
  - Checklist: instrument_checkin, instrument_checkout

- [ ] **Event Venues** (`event-venues.json`):
  - Required: address, capacity, allowedHours, eventTypes
  - Optional: equipment, cateringOptions, restrictions
  - Pricing: per_event, per_hour, cleaningFee, securityDeposit
  - Checklist: venue_before, venue_after

- [ ] **Event Items** (`event-items.json`):
  - Required: itemType, quantity, dimensions
  - Optional: accessories, setupInstructions
  - Pricing: per_day, per_event
  - Checklist: items_pickup, items_return

- [ ] **Wearables** (`wearables.json`):
  - Required: type, size, measurements, condition
  - Optional: brand, material, careInstructions
  - Pricing: per_day, package_3day
  - Checklist: wearable_checkout, wearable_return

#### 1.3.3 Template Validation Service

```
Priority: P0 | Estimate: 4h | Owner: Backend Dev
```

- [ ] Implement `TemplateValidationService`
- [ ] Validate listing attributes against category schema
- [ ] Return structured validation errors
- [ ] Support custom validators per field type
- [ ] Implement coercion for compatible types

---

# PHASE 2: Core Business Logic (Week 4-7)

## Sprint 2.1: Listings Module

### Tasks

#### 2.1.1 Listing CRUD Operations

```
Priority: P0 | Estimate: 10h | Owner: Backend Lead
```

- [ ] Create `ListingsModule`
- [ ] Implement listing creation with draft state
- [ ] Validate attributes against category template
- [ ] Support listing updates (draft and published)
- [ ] Implement soft delete
- [ ] Add listing status transitions (draft → published → unpublished)

**Endpoints:**

```typescript
GET    /api/v1/listings                    # Search/filter listings
GET    /api/v1/listings/:id                # Get listing details
POST   /api/v1/listings                    # Create listing (draft)
PUT    /api/v1/listings/:id                # Update listing
DELETE /api/v1/listings/:id                # Soft delete listing
POST   /api/v1/listings/:id/publish        # Publish listing
POST   /api/v1/listings/:id/unpublish      # Unpublish listing
GET    /api/v1/users/me/listings           # Owner's listings
```

#### 2.1.2 Media Upload Service

```
Priority: P0 | Estimate: 8h | Owner: Backend Dev
```

- [ ] Create `MediaModule` with S3 integration
- [ ] Implement presigned URL generation
- [ ] Create background job for:
  - Image resizing (thumbnail, medium, large)
  - Image optimization (WebP conversion)
  - Video transcoding (if applicable)
- [ ] Implement media moderation hooks
- [ ] Add media ordering and metadata

**Endpoints:**

```typescript
POST   /api/v1/media/presigned-url        # Get upload URL
POST   /api/v1/listings/:id/media         # Attach media to listing
DELETE /api/v1/listings/:id/media/:mediaId # Remove media
PUT    /api/v1/listings/:id/media/reorder  # Reorder media
```

#### 2.1.3 Listing Policies Service

```
Priority: P0 | Estimate: 6h | Owner: Backend Dev
```

- [ ] Create policy attachment for listings
- [ ] Support cancellation policy templates (flexible, moderate, strict)
- [ ] Support deposit policy configuration
- [ ] Support house rules / usage rules
- [ ] Support fulfillment method selection

---

## Sprint 2.2: Availability & Pricing

### Tasks

#### 2.2.1 Availability Management

```
Priority: P0 | Estimate: 10h | Owner: Backend Lead
```

- [ ] Create `AvailabilityModule`
- [ ] Implement calendar-based availability
- [ ] Support blocked dates (blackout periods)
- [ ] Support minimum/maximum duration rules
- [ ] Support lead time and notice period
- [ ] Support quantity-based availability (for event items)
- [ ] Implement availability conflict detection

**Endpoints:**

```typescript
GET    /api/v1/listings/:id/availability            # Get availability calendar
PUT    /api/v1/listings/:id/availability            # Update availability rules
PUT    /api/v1/listings/:id/availability/blocked    # Set blocked dates
GET    /api/v1/listings/:id/availability/check      # Check specific date range
```

#### 2.2.2 Pricing Engine

```
Priority: P0 | Estimate: 10h | Owner: Backend Lead
```

- [ ] Create `PricingModule`
- [ ] Implement pricing model support:
  - Per night/day/hour/event
  - Package pricing (e.g., 3-day package)
  - Quantity-based pricing
- [ ] Support additional fees:
  - Cleaning fee
  - Service fee (platform)
  - Late fee calculation
  - Mileage-based fees (vehicles)
- [ ] Support discounts:
  - Weekly/monthly discounts
  - Early bird discounts
  - Last-minute discounts
- [ ] Implement seasonal pricing

#### 2.2.3 Quote Generation Service

```
Priority: P0 | Estimate: 8h | Owner: Backend Dev
```

- [ ] Create `QuoteService`
- [ ] Generate itemized quote with all line items
- [ ] Calculate taxes (if applicable)
- [ ] Apply discounts and promotions
- [ ] Generate quote snapshot for booking
- [ ] Implement quote expiration
- [ ] Support quote caching

**Endpoints:**

```typescript
POST   /api/v1/listings/:id/quote           # Generate quote
GET    /api/v1/quotes/:id                   # Get quote details
POST   /api/v1/quotes/:id/refresh           # Refresh expired quote
```

---

## Sprint 2.3: Booking Engine

### Tasks

#### 2.3.1 Booking State Machine

```
Priority: P0 | Estimate: 12h | Owner: Backend Lead
```

- [ ] Create `BookingsModule`
- [ ] Implement booking state machine:
  ```
  DRAFT → PENDING_OWNER_APPROVAL → PENDING_PAYMENT → CONFIRMED
       ↓                          ↓                  ↓
  CANCELLED                   CANCELLED         IN_PROGRESS
                                                     ↓
                                             AWAITING_RETURN_INSPECTION
                                                     ↓
                                                COMPLETED → SETTLED
                                                     ↓         ↓
                                                DISPUTED   REFUNDED
  ```
- [ ] Implement transition guards (invariants)
- [ ] Store state transition history
- [ ] Emit events on state changes
- [ ] Handle concurrent transition attempts

#### 2.3.2 Booking Flows Implementation

```
Priority: P0 | Estimate: 10h | Owner: Backend Dev
```

- [ ] **Instant Book Flow:**
  1. Create booking with quote snapshot
  2. Create payment intent
  3. Confirm payment
  4. Auto-transition to CONFIRMED
- [ ] **Request-to-Book Flow:**
  1. Create booking in PENDING_OWNER_APPROVAL
  2. Notify owner
  3. Owner accepts/declines
  4. If accepted → PENDING_PAYMENT
  5. Auto-expire after 48h if no response
- [ ] **Inquiry Flow (Optional MVP):**
  1. Create message thread
  2. Allow back-and-forth messages
  3. Convert inquiry to booking

**Endpoints:**

```typescript
POST   /api/v1/bookings                    # Create booking
GET    /api/v1/bookings/:id                # Get booking details
POST   /api/v1/bookings/:id/accept         # Owner accepts (request-to-book)
POST   /api/v1/bookings/:id/decline        # Owner declines
POST   /api/v1/bookings/:id/cancel         # Cancel booking
GET    /api/v1/users/me/bookings           # User's bookings (as renter)
GET    /api/v1/users/me/bookings/hosting   # User's bookings (as owner)
```

#### 2.3.3 Agreement Snapshot Service

```
Priority: P0 | Estimate: 4h | Owner: Backend Dev
```

- [ ] Capture listing state at booking time
- [ ] Capture all applicable policies
- [ ] Store platform terms version
- [ ] Generate agreement hash for integrity
- [ ] Implement agreement PDF generation (async)

---

## Sprint 2.4: Payment System

### Tasks

#### 2.4.1 Stripe Integration

```
Priority: P0 | Estimate: 12h | Owner: Backend Lead
```

- [ ] Create `PaymentsModule`
- [ ] Set up Stripe Connect for marketplace
- [ ] Implement payment intent creation
- [ ] Handle 3D Secure / SCA
- [ ] Implement webhook handler with signature verification
- [ ] Handle all payment events:
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
  - `charge.refunded`
  - `charge.dispute.created`

**Endpoints:**

```typescript
POST   /api/v1/payments/intents            # Create payment intent
POST   /api/v1/payments/:id/confirm        # Confirm payment
GET    /api/v1/payments/:id                # Get payment status
POST   /api/v1/webhooks/stripe             # Stripe webhook handler
```

#### 2.4.2 Deposit Hold System

```
Priority: P0 | Estimate: 8h | Owner: Backend Dev
```

- [ ] Implement deposit authorization holds
- [ ] Configure hold expiration and renewal
- [ ] Implement deposit release logic
- [ ] Implement partial/full capture for disputes
- [ ] Handle hold failures gracefully
- [ ] Configure category-specific deposit rules

#### 2.4.3 Ledger System

```
Priority: P0 | Estimate: 10h | Owner: Backend Lead
```

- [ ] Create immutable `LedgerEntry` table
- [ ] Implement double-entry accounting:
  - Debit/Credit accounts
  - Balance validation
- [ ] Record all financial events:
  - Charges
  - Refunds (partial/full)
  - Platform fees
  - Owner payouts
  - Deposit holds/releases/captures
  - Adjustments
- [ ] Implement reconciliation job
- [ ] Create ledger query API for admin

#### 2.4.4 Payout System

```
Priority: P1 | Estimate: 8h | Owner: Backend Dev
```

- [ ] Implement owner Connect account onboarding
- [ ] Configure payout schedule per category:
  - Spaces: after check-in
  - Vehicles: after return inspection
  - Wearables: after inspection window
- [ ] Handle payout failures and retries
- [ ] Generate payout reports

**Endpoints:**

```typescript
POST   /api/v1/payouts/connect/onboarding  # Start Stripe Connect onboarding
GET    /api/v1/payouts/connect/status      # Get onboarding status
GET    /api/v1/payouts                     # Get payout history
GET    /api/v1/payouts/:id                 # Get payout details
```

---

# PHASE 3: Communication & Fulfillment (Week 7-9)

## Sprint 3.1: Messaging System

### Tasks

#### 3.1.1 Message Thread Management

```
Priority: P0 | Estimate: 8h | Owner: Backend Dev
```

- [ ] Create `MessagingModule`
- [ ] Implement thread types: `booking`, `inquiry`, `dispute`
- [ ] Create thread when booking created
- [ ] Support participant management
- [ ] Implement unread count tracking

**Endpoints:**

```typescript
GET    /api/v1/messages/threads            # Get user's threads
GET    /api/v1/messages/threads/:id        # Get thread details
GET    /api/v1/messages/threads/:id/messages # Get messages (paginated)
POST   /api/v1/messages/threads/:id/messages # Send message
PUT    /api/v1/messages/threads/:id/read   # Mark as read
```

#### 3.1.2 Real-time Messaging (Socket.io)

```
Priority: P1 | Estimate: 8h | Owner: Backend Dev
```

- [ ] Set up Socket.io gateway
- [ ] Implement authentication for WebSocket connections
- [ ] Create namespaces for:
  - User messages
  - Notifications
  - Booking status updates
- [ ] Implement typing indicators
- [ ] Handle online/offline status

#### 3.1.3 Contact Information Masking

```
Priority: P0 | Estimate: 4h | Owner: Backend Dev
```

- [ ] Implement PII detection in messages (email, phone patterns)
- [ ] Mask contact info before booking confirmation
- [ ] Log masking events for compliance
- [ ] Reveal info after booking confirmed

---

## Sprint 3.2: Notification System

### Tasks

#### 3.2.1 Notification Engine

```
Priority: P0 | Estimate: 10h | Owner: Backend Dev
```

- [ ] Create `NotificationsModule`
- [ ] Implement notification channels:
  - Email (SendGrid/SES)
  - SMS (Twilio - Phase 2)
  - Push notifications (Firebase - Phase 2)
  - In-app notifications
- [ ] Create notification templates for all events
- [ ] Implement notification preferences
- [ ] Add retry logic with exponential backoff

**Key notification events:**

```
- booking_requested
- booking_accepted
- booking_declined
- booking_confirmed
- booking_cancelled
- payment_succeeded
- payment_failed
- review_requested
- dispute_opened
- dispute_resolved
- message_received
- payout_sent
```

#### 3.2.2 Email Templates

```
Priority: P0 | Estimate: 6h | Owner: Frontend Dev
```

- [ ] Create responsive HTML email templates
- [ ] Support i18n for email content
- [ ] Implement template variables
- [ ] Create templates for all notification types

---

## Sprint 3.3: Fulfillment & Condition Reports

### Tasks

#### 3.3.1 Fulfillment Service

```
Priority: P0 | Estimate: 8h | Owner: Backend Dev
```

- [ ] Create `FulfillmentModule`
- [ ] Implement fulfillment methods:
  - Self-check-in (spaces)
  - Pickup/dropoff (vehicles, items)
- [ ] Store fulfillment details per booking
- [ ] Reveal check-in instructions after confirmation

**Endpoints:**

```typescript
GET    /api/v1/bookings/:id/fulfillment    # Get fulfillment details
PUT    /api/v1/bookings/:id/fulfillment    # Update fulfillment (owner)
```

#### 3.3.2 Condition Report System

```
Priority: P0 | Estimate: 12h | Owner: Backend Lead
```

- [ ] Create `ConditionReportsModule`
- [ ] Implement checklist templates per category
- [ ] Support check-in and check-out reports
- [ ] Implement evidence attachment (photos/videos)
- [ ] Require reports for category rules:
  - Vehicles: mandatory before/after
  - Wearables: mandatory before/after
  - Event items: quantity verification
- [ ] Implement dual confirmation (both parties)
- [ ] Make reports immutable after submission

**Endpoints:**

```typescript
GET    /api/v1/bookings/:id/condition-reports           # Get reports
POST   /api/v1/bookings/:id/condition-reports           # Create report
POST   /api/v1/condition-reports/:id/evidence           # Add evidence
POST   /api/v1/condition-reports/:id/submit             # Submit report
POST   /api/v1/condition-reports/:id/confirm            # Other party confirms
```

#### 3.3.3 Late Return Detection

```
Priority: P1 | Estimate: 4h | Owner: Backend Dev
```

- [ ] Implement scheduled job to detect late returns
- [ ] Calculate late fees per policy
- [ ] Notify owner and renter
- [ ] Create claim initiation path for owner

---

# PHASE 4: Reviews & Disputes (Week 9-11)

## Sprint 4.1: Review System

### Tasks

#### 4.1.1 Review Management

```
Priority: P0 | Estimate: 8h | Owner: Backend Dev
```

- [ ] Create `ReviewsModule`
- [ ] Implement two-sided review system
- [ ] Support structured tags per category
- [ ] Prevent review before booking completion
- [ ] Implement review window (14 days)
- [ ] Add review moderation hooks

**Endpoints:**

```typescript
POST   /api/v1/bookings/:id/reviews        # Submit review
GET    /api/v1/listings/:id/reviews        # Get listing reviews
GET    /api/v1/users/:id/reviews           # Get user reviews
GET    /api/v1/users/me/reviews/pending    # Get pending reviews
```

#### 4.1.2 Reputation Aggregation

```
Priority: P1 | Estimate: 4h | Owner: Backend Dev
```

- [ ] Calculate average ratings per listing
- [ ] Calculate owner/renter reputation scores
- [ ] Update trust metrics on new reviews
- [ ] Expose trust signals in profiles

---

## Sprint 4.2: Dispute System

### Tasks

#### 4.2.1 Dispute State Machine

```
Priority: P0 | Estimate: 12h | Owner: Backend Lead
```

- [ ] Create `DisputesModule`
- [ ] Implement dispute states:
  ```
  DRAFT → OPEN → UNDER_REVIEW → RESOLVED
                      ↓              ↓
           ADDITIONAL_EVIDENCE_REQUIRED
                      ↓
                 ESCALATED → EXTERNAL_ARBITRATION
  ```
- [ ] Define dispute categories per rental category
- [ ] Implement SLA timers and escalation
- [ ] Create dispute eligibility validation

**Endpoints:**

```typescript
POST   /api/v1/bookings/:id/disputes       # Initiate dispute
GET    /api/v1/disputes/:id                # Get dispute details
POST   /api/v1/disputes/:id/evidence       # Add evidence
POST   /api/v1/disputes/:id/respond        # Respond to dispute
GET    /api/v1/users/me/disputes           # User's disputes
```

#### 4.2.2 Evidence Bundle System

```
Priority: P0 | Estimate: 6h | Owner: Backend Dev
```

- [ ] Auto-attach relevant evidence:
  - Messages from thread
  - Condition reports
  - Payment records
  - Agreement snapshot
- [ ] Support additional evidence upload
- [ ] Create tamper-evident hashing
- [ ] Implement evidence file validation

#### 4.2.3 Resolution Execution

```
Priority: P0 | Estimate: 8h | Owner: Backend Dev
```

- [ ] Implement resolution outcomes:
  - Full refund to renter
  - Partial refund
  - Deposit capture for owner
  - Split decision
  - Dismissed
- [ ] Execute financial actions on resolution
- [ ] Update booking status
- [ ] Notify all parties
- [ ] Create resolution summary

---

# PHASE 5: Search & Discovery (Week 11-12)

## Sprint 5.1: Search System

### Tasks

#### 5.1.1 Elasticsearch Setup

```
Priority: P0 | Estimate: 8h | Owner: Backend Lead
```

- [ ] Create `SearchModule`
- [ ] Define Elasticsearch mappings for listings
- [ ] Set up index templates and aliases
- [ ] Configure sharding and replication
- [ ] Set up analyzers for text search

#### 5.1.2 Search Indexing Service

```
Priority: P0 | Estimate: 8h | Owner: Backend Dev
```

- [ ] Implement listing indexing on create/update
- [ ] Index availability data
- [ ] Index trust metrics
- [ ] Handle index failures with retry
- [ ] Implement bulk reindexing

#### 5.1.3 Search Query Builder

```
Priority: P0 | Estimate: 10h | Owner: Backend Dev
```

- [ ] Implement full-text search
- [ ] Implement geo-distance queries
- [ ] Implement availability filtering
- [ ] Implement category-specific filters
- [ ] Implement faceted search (aggregations)
- [ ] Implement sorting options
- [ ] Add result caching

**Endpoints:**

```typescript
GET    /api/v1/search/listings             # Search listings
GET    /api/v1/search/suggestions          # Autocomplete
GET    /api/v1/search/filters              # Get available filters
```

---

# PHASE 6: Admin Portal Backend (Week 12-13)

## Sprint 6.1: Admin API

### Tasks

#### 6.1.1 Admin Authentication

```
Priority: P0 | Estimate: 6h | Owner: Backend Lead
```

- [ ] Create `AdminModule`
- [ ] Implement admin-specific auth flow
- [ ] Support MFA for admin users
- [ ] Configure admin roles and permissions
- [ ] Implement admin session management

#### 6.1.2 User Management API

```
Priority: P0 | Estimate: 6h | Owner: Backend Dev
```

**Endpoints:**

```typescript
GET    /api/v1/admin/users                 # Search users
GET    /api/v1/admin/users/:id             # Get user details
PUT    /api/v1/admin/users/:id/status      # Update user status
PUT    /api/v1/admin/users/:id/trust       # Update trust flags
GET    /api/v1/admin/users/:id/audit       # Get user audit log
```

#### 6.1.3 Listing Moderation API

```
Priority: P0 | Estimate: 6h | Owner: Backend Dev
```

**Endpoints:**

```typescript
GET    /api/v1/admin/listings/moderation   # Get moderation queue
PUT    /api/v1/admin/listings/:id/approve  # Approve listing
PUT    /api/v1/admin/listings/:id/reject   # Reject listing
PUT    /api/v1/admin/listings/:id/takedown # Takedown listing
GET    /api/v1/admin/listings/:id          # Get listing details
```

#### 6.1.4 Booking & Payment Admin API

```
Priority: P0 | Estimate: 8h | Owner: Backend Dev
```

**Endpoints:**

```typescript
GET    /api/v1/admin/bookings              # Search bookings
GET    /api/v1/admin/bookings/:id          # Get booking details
GET    /api/v1/admin/bookings/:id/timeline # Get full timeline
PUT    /api/v1/admin/bookings/:id/status   # Override booking status
POST   /api/v1/admin/bookings/:id/refund   # Process refund
GET    /api/v1/admin/payments/ledger       # View ledger entries
GET    /api/v1/admin/payouts               # View payouts
```

#### 6.1.5 Dispute Admin API

```
Priority: P0 | Estimate: 6h | Owner: Backend Dev
```

**Endpoints:**

```typescript
GET    /api/v1/admin/disputes              # Get disputes queue
GET    /api/v1/admin/disputes/:id          # Get dispute details
PUT    /api/v1/admin/disputes/:id/assign   # Assign to admin
POST   /api/v1/admin/disputes/:id/resolve  # Resolve dispute
POST   /api/v1/admin/disputes/:id/escalate # Escalate dispute
```

#### 6.1.6 Policy & Audit API

```
Priority: P1 | Estimate: 6h | Owner: Backend Dev
```

**Endpoints:**

```typescript
GET    /api/v1/admin/policies              # Get policy rules
PUT    /api/v1/admin/policies/:id          # Update policy
GET    /api/v1/admin/audit-logs            # Query audit logs
GET    /api/v1/admin/reports               # Get reports (phaseable)
```

---

# PHASE 7: Customer Web Portal (Week 13-17)

## Sprint 7.1: Web App Foundation

### Tasks

#### 7.1.1 Next.js Project Setup

```
Priority: P0 | Estimate: 6h | Owner: Frontend Lead
```

- [ ] Initialize Next.js 14 with App Router
- [ ] Configure TailwindCSS with custom theme
- [ ] Set up authentication with NextAuth.js or custom
- [ ] Configure API client integration
- [ ] Set up React Query for data fetching
- [ ] Configure error boundaries and logging

#### 7.1.2 Layout & Navigation

```
Priority: P0 | Estimate: 8h | Owner: Frontend Dev
```

- [ ] Create responsive header with:
  - Logo and navigation
  - Category selector
  - Search bar
  - User menu (login/profile)
  - Notification badge
- [ ] Create footer with links
- [ ] Implement mobile navigation drawer
- [ ] Create auth-aware layout switching

#### 7.1.3 Authentication Pages

```
Priority: P0 | Estimate: 8h | Owner: Frontend Dev
```

- [ ] Login page
- [ ] Registration page with email verification
- [ ] Forgot password page
- [ ] Reset password page
- [ ] Email verification status page

---

## Sprint 7.2: Search & Discovery UI

### Tasks

#### 7.2.1 Search Homepage

```
Priority: P0 | Estimate: 10h | Owner: Frontend Dev
```

- [ ] Hero section with search form:
  - Category selector
  - Location input with autocomplete
  - Date range picker
  - Search button
- [ ] Featured categories grid
- [ ] Popular listings carousel
- [ ] Trust & safety messaging

#### 7.2.2 Search Results Page

```
Priority: P0 | Estimate: 12h | Owner: Frontend Lead
```

- [ ] Filter sidebar with:
  - Price range slider
  - Category-specific filters (dynamic from template)
  - Rating filter
  - Availability filter
- [ ] Results grid/list toggle
- [ ] Listing cards with:
  - Image carousel
  - Price display
  - Rating stars
  - Key attributes
  - Favorite button
- [ ] Pagination/infinite scroll
- [ ] Map view (optional MVP)
- [ ] Sort options

#### 7.2.3 Listing Detail Page

```
Priority: P0 | Estimate: 12h | Owner: Frontend Dev
```

- [ ] Image gallery with lightbox
- [ ] Title, description, location
- [ ] Category-specific attributes display
- [ ] Pricing breakdown card
- [ ] Availability calendar
- [ ] Date picker for booking
- [ ] Quantity selector (for event items)
- [ ] Instant book / Request to book button
- [ ] Host profile section
- [ ] Reviews section
- [ ] House rules / policies
- [ ] Similar listings
- [ ] Report listing button

---

## Sprint 7.3: Booking Flow UI

### Tasks

#### 7.3.1 Booking Page

```
Priority: P0 | Estimate: 10h | Owner: Frontend Lead
```

- [ ] Booking summary card
- [ ] Date/guest confirmation
- [ ] Price breakdown display
- [ ] Cancellation policy display
- [ ] House rules agreement
- [ ] Payment form (Stripe Elements)
- [ ] Terms acceptance checkbox
- [ ] Submit booking button

#### 7.3.2 Booking Confirmation Page

```
Priority: P0 | Estimate: 4h | Owner: Frontend Dev
```

- [ ] Confirmation message
- [ ] Booking details summary
- [ ] Next steps guidance
- [ ] Message host button
- [ ] Add to calendar

#### 7.3.3 My Bookings Page

```
Priority: P0 | Estimate: 10h | Owner: Frontend Dev
```

- [ ] Tabs: Upcoming / Past / Cancelled
- [ ] Booking cards with:
  - Listing image and name
  - Dates and status
  - Host info
  - Actions (cancel, message, review)
- [ ] Booking detail modal/page:
  - Full booking information
  - Check-in instructions (when applicable)
  - Condition report submission
  - Contact host
  - Cancel/modify options
  - Receipt download

---

## Sprint 7.4: Owner Dashboard

### Tasks

#### 7.4.1 Host Dashboard

```
Priority: P0 | Estimate: 8h | Owner: Frontend Dev
```

- [ ] Switch to host mode toggle
- [ ] Dashboard overview:
  - Upcoming bookings
  - Pending requests
  - Recent messages
  - Earnings summary
- [ ] Quick actions

#### 7.4.2 My Listings Page

```
Priority: P0 | Estimate: 8h | Owner: Frontend Dev
```

- [ ] Listing cards with status
- [ ] Create new listing button
- [ ] Actions: Edit, Publish/Unpublish, View, Delete
- [ ] Performance metrics per listing

#### 7.4.3 Create/Edit Listing Flow

```
Priority: P0 | Estimate: 16h | Owner: Frontend Lead
```

Multi-step form wizard:

1. **Category Selection**: Select rental category
2. **Basic Info**: Title, description
3. **Attributes**: Dynamic form based on category schema
4. **Location**: Address, map pin (for spaces/venues)
5. **Photos**: Upload with drag-and-drop, reorder
6. **Pricing**: Base price, fees, discounts
7. **Availability**: Calendar settings, rules
8. **Policies**: Cancellation, deposit, house rules
9. **Review & Publish**: Summary and publish button

#### 7.4.4 Host Bookings Management

```
Priority: P0 | Estimate: 8h | Owner: Frontend Dev
```

- [ ] Pending requests (accept/decline)
- [ ] Upcoming bookings
- [ ] In-progress bookings
- [ ] Past bookings
- [ ] Calendar view of all bookings
- [ ] Condition report review

#### 7.4.5 Earnings & Payouts Page

```
Priority: P1 | Estimate: 6h | Owner: Frontend Dev
```

- [ ] Earnings summary (week/month/year)
- [ ] Payout history
- [ ] Pending payouts
- [ ] Payout settings (Stripe Connect)

---

## Sprint 7.5: Communication & Profile

### Tasks

#### 7.5.1 Messages Page

```
Priority: P0 | Estimate: 10h | Owner: Frontend Dev
```

- [ ] Thread list sidebar
- [ ] Message thread view
- [ ] Message input with attachments
- [ ] Real-time updates
- [ ] Unread indicators
- [ ] Link to booking/inquiry

#### 7.5.2 User Profile Page

```
Priority: P0 | Estimate: 6h | Owner: Frontend Dev
```

- [ ] Profile picture upload
- [ ] Basic info editing
- [ ] Verification status display
- [ ] Reviews received
- [ ] Public profile preview

#### 7.5.3 Settings Page

```
Priority: P0 | Estimate: 6h | Owner: Frontend Dev
```

- [ ] Account settings (email, password)
- [ ] Notification preferences
- [ ] Payment methods
- [ ] Privacy settings
- [ ] Delete account

---

## Sprint 7.6: Condition Reports & Disputes UI

### Tasks

#### 7.6.1 Condition Report Form

```
Priority: P0 | Estimate: 8h | Owner: Frontend Dev
```

- [ ] Checklist display based on category
- [ ] Photo/video capture and upload
- [ ] Notes field
- [ ] Submit and confirm flow
- [ ] View submitted reports

#### 7.6.2 Dispute Flow

```
Priority: P0 | Estimate: 6h | Owner: Frontend Dev
```

- [ ] Initiate dispute from booking
- [ ] Select reason
- [ ] Add evidence
- [ ] Track dispute status
- [ ] View resolution

#### 7.6.3 Review Submission

```
Priority: P0 | Estimate: 4h | Owner: Frontend Dev
```

- [ ] Star rating input
- [ ] Tag selection
- [ ] Comment textarea
- [ ] Submit review

---

# PHASE 8: Admin Portal Frontend (Week 17-19)

## Sprint 8.1: Admin Portal Foundation

### Tasks

#### 8.1.1 Admin App Setup

```
Priority: P0 | Estimate: 4h | Owner: Frontend Lead
```

- [ ] Initialize admin React app (Vite)
- [ ] Configure TailwindCSS with admin theme
- [ ] Set up admin authentication
- [ ] Configure API client
- [ ] Set up routing

#### 8.1.2 Admin Layout

```
Priority: P0 | Estimate: 6h | Owner: Frontend Dev
```

- [ ] Sidebar navigation with:
  - Dashboard
  - Users
  - Listings
  - Bookings
  - Payments
  - Disputes
  - Reports
  - Settings
- [ ] Top header with admin info
- [ ] Breadcrumbs
- [ ] Search command palette

---

## Sprint 8.2: Admin Features

### Tasks

#### 8.2.1 Admin Dashboard

```
Priority: P0 | Estimate: 6h | Owner: Frontend Dev
```

- [ ] Key metrics cards:
  - Active users
  - Total listings
  - Bookings today
  - Revenue
  - Open disputes
- [ ] Charts:
  - Booking trends
  - Revenue trends
  - Category distribution
- [ ] Quick actions
- [ ] Alerts panel

#### 8.2.2 User Management

```
Priority: P0 | Estimate: 8h | Owner: Frontend Dev
```

- [ ] Users data table with:
  - Search and filters
  - Sortable columns
  - Pagination
- [ ] User detail drawer:
  - Profile info
  - Verification status
  - Trust score
  - Bookings (as renter/owner)
  - Listings
  - Reviews
  - Audit log
- [ ] Actions: Suspend, Ban, Verify

#### 8.2.3 Listing Moderation

```
Priority: P0 | Estimate: 8h | Owner: Frontend Dev
```

- [ ] Moderation queue with tabs:
  - Pending review
  - Flagged
  - All listings
- [ ] Listing detail view:
  - All listing info
  - Images gallery
  - Owner info
  - Bookings
- [ ] Actions: Approve, Reject, Takedown

#### 8.2.4 Booking Management

```
Priority: P0 | Estimate: 8h | Owner: Frontend Dev
```

- [ ] Bookings table with:
  - Status filter
  - Date range filter
  - Search by ID/user
- [ ] Booking detail view:
  - Full booking timeline
  - Parties info
  - Payment details
  - Messages
  - Condition reports
- [ ] Actions: Override status, Refund

#### 8.2.5 Payment & Ledger View

```
Priority: P0 | Estimate: 6h | Owner: Frontend Dev
```

- [ ] Ledger entries table
- [ ] Payment intents table
- [ ] Refund processing form
- [ ] Payout management

#### 8.2.6 Dispute Resolution

```
Priority: P0 | Estimate: 10h | Owner: Frontend Lead
```

- [ ] Disputes queue with:
  - Status filter
  - Priority sorting
  - SLA indicators
- [ ] Dispute detail view:
  - Full evidence bundle
  - Timeline
  - Communication history
  - Both parties info
- [ ] Resolution form:
  - Decision selection
  - Amount input
  - Notes
  - Execute resolution

#### 8.2.7 Audit Logs

```
Priority: P1 | Estimate: 4h | Owner: Frontend Dev
```

- [ ] Audit log table
- [ ] Filters by actor, action, resource
- [ ] Detail view for each entry

---

# PHASE 9: Mobile App (Week 19-23)

## Sprint 9.1: Mobile Foundation

### Tasks

#### 9.1.1 React Native Setup

```
Priority: P0 | Estimate: 6h | Owner: Mobile Lead
```

- [ ] Initialize Expo project with TypeScript
- [ ] Configure Expo Router for navigation
- [ ] Set up NativeWind (Tailwind for RN)
- [ ] Configure API client
- [ ] Set up React Query
- [ ] Configure secure storage for auth

#### 9.1.2 Mobile Navigation Structure

```
Priority: P0 | Estimate: 8h | Owner: Mobile Dev
```

- [ ] Tab navigation:
  - Explore (Search)
  - Trips (Bookings)
  - Messages
  - Profile
- [ ] Stack navigation per tab
- [ ] Auth flow navigation

---

## Sprint 9.2: Core Mobile Screens

### Tasks

#### 9.2.1 Authentication Screens

```
Priority: P0 | Estimate: 8h | Owner: Mobile Dev
```

- [ ] Welcome/onboarding screens
- [ ] Login screen
- [ ] Registration screen
- [ ] Forgot password screen
- [ ] Biometric auth (optional)

#### 9.2.2 Search & Discovery

```
Priority: P0 | Estimate: 12h | Owner: Mobile Lead
```

- [ ] Search home screen
- [ ] Category selection
- [ ] Location search with maps integration
- [ ] Date picker
- [ ] Search results list
- [ ] Filter bottom sheet
- [ ] Listing detail screen

#### 9.2.3 Booking Flow

```
Priority: P0 | Estimate: 10h | Owner: Mobile Dev
```

- [ ] Booking confirmation screen
- [ ] Payment screen (Stripe mobile SDK)
- [ ] Booking success screen
- [ ] My trips screen (list)
- [ ] Trip detail screen
- [ ] Cancel booking flow

#### 9.2.4 Messaging

```
Priority: P0 | Estimate: 8h | Owner: Mobile Dev
```

- [ ] Conversations list
- [ ] Chat screen
- [ ] Image/attachment picker
- [ ] Push notification handling

#### 9.2.5 Profile & Settings

```
Priority: P0 | Estimate: 6h | Owner: Mobile Dev
```

- [ ] Profile screen
- [ ] Edit profile
- [ ] Settings
- [ ] Notifications settings
- [ ] Logout

---

## Sprint 9.3: Host Mode (Mobile)

### Tasks

#### 9.3.1 Host Dashboard

```
Priority: P1 | Estimate: 8h | Owner: Mobile Dev
```

- [ ] Host mode switch
- [ ] Host dashboard summary
- [ ] Bookings management
- [ ] Earnings summary

#### 9.3.2 Listing Management

```
Priority: P1 | Estimate: 10h | Owner: Mobile Lead
```

- [ ] My listings screen
- [ ] Create listing wizard (mobile-optimized)
- [ ] Edit listing
- [ ] Availability calendar

#### 9.3.3 Condition Reports (Mobile)

```
Priority: P0 | Estimate: 8h | Owner: Mobile Dev
```

- [ ] Condition report form
- [ ] Camera integration for photos
- [ ] Video recording (optional)
- [ ] GPS/timestamp metadata
- [ ] Submit and confirm

---

# PHASE 10: Testing & Quality (Week 23-25)

## Sprint 10.1: Backend Testing

### Tasks

#### 10.1.1 Unit Tests

```
Priority: P0 | Estimate: 16h | Owner: Backend Team
```

- [ ] Domain services tests (80% coverage)
- [ ] State machine tests (all transitions)
- [ ] Pricing engine tests (golden fixtures)
- [ ] Validation tests
- [ ] Policy engine tests

#### 10.1.2 Integration Tests

```
Priority: P0 | Estimate: 16h | Owner: Backend Team
```

- [ ] API endpoint tests (all routes)
- [ ] Database integration tests
- [ ] Payment flow tests (mock Stripe)
- [ ] Webhook processing tests
- [ ] Search indexing tests

#### 10.1.3 E2E Tests

```
Priority: P0 | Estimate: 12h | Owner: Backend Team
```

- [ ] Full booking flow (instant book)
- [ ] Full booking flow (request-to-book)
- [ ] Payment and payout flow
- [ ] Dispute flow
- [ ] Review flow

---

## Sprint 10.2: Frontend Testing

### Tasks

#### 10.2.1 Component Tests

```
Priority: P0 | Estimate: 10h | Owner: Frontend Team
```

- [ ] UI component tests (shared library)
- [ ] Form validation tests
- [ ] State management tests

#### 10.2.2 Integration Tests

```
Priority: P0 | Estimate: 10h | Owner: Frontend Team
```

- [ ] Page integration tests
- [ ] API integration tests (mock)
- [ ] Auth flow tests

#### 10.2.3 E2E Tests (Playwright/Cypress)

```
Priority: P0 | Estimate: 12h | Owner: Frontend Team
```

- [ ] User registration/login
- [ ] Search and filter
- [ ] View listing
- [ ] Complete booking
- [ ] Create listing (host)
- [ ] Admin moderation flow

---

## Sprint 10.3: Performance & Security

### Tasks

#### 10.3.1 Performance Testing

```
Priority: P1 | Estimate: 8h | Owner: DevOps
```

- [ ] Load testing with k6
- [ ] Search performance benchmarks
- [ ] Database query optimization
- [ ] Caching effectiveness analysis

#### 10.3.2 Security Audit

```
Priority: P0 | Estimate: 8h | Owner: Backend Lead
```

- [ ] OWASP checklist review
- [ ] Dependency vulnerability scan
- [ ] API security audit
- [ ] Auth token security review
- [ ] Data encryption verification

---

# PHASE 11: Deployment & Launch (Week 25-26)

## Sprint 11.1: Infrastructure Setup

### Tasks

#### 11.1.1 Cloud Infrastructure (Terraform)

```
Priority: P0 | Estimate: 16h | Owner: DevOps
```

- [ ] VPC and networking
- [ ] RDS PostgreSQL (Aurora)
- [ ] ElastiCache (Redis)
- [ ] OpenSearch cluster
- [ ] S3 buckets
- [ ] CloudFront CDN
- [ ] ECS/EKS cluster
- [ ] Load balancers
- [ ] IAM roles and policies

#### 11.1.2 CI/CD Pipelines

```
Priority: P0 | Estimate: 8h | Owner: DevOps
```

- [ ] GitHub Actions workflows:
  - Build and test
  - Deploy to staging
  - Deploy to production
- [ ] Database migrations pipeline
- [ ] Rollback procedures

#### 11.1.3 Monitoring Setup

```
Priority: P0 | Estimate: 8h | Owner: DevOps
```

- [ ] Prometheus + Grafana
- [ ] Application dashboards
- [ ] Business metrics dashboards
- [ ] Alerting rules
- [ ] Sentry for error tracking
- [ ] Log aggregation (CloudWatch/ELK)

---

## Sprint 11.2: Launch Preparation

### Tasks

#### 11.2.1 Staging Deployment

```
Priority: P0 | Estimate: 4h | Owner: DevOps
```

- [ ] Deploy full stack to staging
- [ ] Seed test data
- [ ] Smoke tests
- [ ] UAT environment setup

#### 11.2.2 Production Deployment

```
Priority: P0 | Estimate: 4h | Owner: DevOps
```

- [ ] Deploy to production
- [ ] DNS configuration
- [ ] SSL certificates
- [ ] Health check verification
- [ ] Monitoring verification

#### 11.2.3 Launch Checklist

```
Priority: P0 | Estimate: 4h | Owner: Tech Lead
```

- [ ] All critical paths tested
- [ ] Payment flow verified
- [ ] Email notifications working
- [ ] Mobile apps submitted to stores
- [ ] Runbooks documented
- [ ] On-call schedule set

---

# Resource Allocation

## Team Structure

| Role                   | Count | Responsibilities                               |
| ---------------------- | ----- | ---------------------------------------------- |
| **Tech Lead**          | 1     | Architecture, code review, technical decisions |
| **Backend Lead**       | 1     | Backend architecture, payment integration      |
| **Backend Developer**  | 2     | API development, database, integrations        |
| **Frontend Lead**      | 1     | Web architecture, UI library                   |
| **Frontend Developer** | 2     | Web portal, admin portal                       |
| **Mobile Lead**        | 1     | React Native architecture                      |
| **Mobile Developer**   | 1     | Mobile app features                            |
| **DevOps Engineer**    | 1     | Infrastructure, CI/CD, monitoring              |
| **QA Engineer**        | 1     | Testing strategy, automation                   |

## Timeline Summary

| Phase                       | Duration   | Deliverable                                              |
| --------------------------- | ---------- | -------------------------------------------------------- |
| Phase 0: Setup              | Week 1-2   | Monorepo, dev environment, shared packages               |
| Phase 1: Backend Foundation | Week 2-4   | Auth, users, RBAC, categories                            |
| Phase 2: Core Business      | Week 4-7   | Listings, availability, pricing, bookings, payments      |
| Phase 3: Communication      | Week 7-9   | Messaging, notifications, fulfillment, condition reports |
| Phase 4: Reviews & Disputes | Week 9-11  | Reviews, disputes, resolution                            |
| Phase 5: Search             | Week 11-12 | Elasticsearch, search API                                |
| Phase 6: Admin Backend      | Week 12-13 | Admin API endpoints                                      |
| Phase 7: Customer Web       | Week 13-17 | Full customer web portal                                 |
| Phase 8: Admin Portal       | Week 17-19 | Admin web portal                                         |
| Phase 9: Mobile App         | Week 19-23 | iOS & Android customer app                               |
| Phase 10: Testing           | Week 23-25 | Unit, integration, E2E, security                         |
| Phase 11: Launch            | Week 25-26 | Infrastructure, deployment, launch                       |

**Total Duration: ~26 weeks (6.5 months) for MVP**

---

# Risk Mitigation

| Risk                           | Likelihood | Impact | Mitigation                                   |
| ------------------------------ | ---------- | ------ | -------------------------------------------- |
| Payment integration complexity | Medium     | High   | Start early, use Stripe's prebuilt UI        |
| Mobile app delays              | Medium     | Medium | Focus on core flows, defer advanced features |
| Search performance issues      | Low        | High   | Proper indexing, caching, pagination         |
| Category schema changes        | Medium     | Medium | Versioned schemas, migration strategy        |
| Team availability              | Low        | High   | Documentation, knowledge sharing             |

---

# Success Criteria

## MVP Launch Criteria

- [ ] All 6 categories functional (spaces, vehicles, instruments, venues, event items, wearables)
- [ ] Complete booking flow working
- [ ] Payments processing reliably
- [ ] Deposit holds and releases working
- [ ] Condition reports functioning for required categories
- [ ] Disputes can be created and resolved
- [ ] Admin can moderate listings and resolve disputes
- [ ] Mobile app available on both platforms
- [ ] System handles 100 concurrent users
- [ ] <500ms p95 API latency
- [ ] <0.1% payment failure rate
- [ ] All critical security controls in place

---

**Document Version:** 1.0  
**Created:** January 23, 2026  
**Last Updated:** January 23, 2026
