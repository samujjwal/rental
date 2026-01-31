# Universal Rental Portal — Technical Architecture Document (v1.0)

## 1. Executive Summary

### 1.1 System Overview

A distributed, event-driven marketplace platform supporting multiple rental categories with configurable business rules, immutable audit trails, and first-class dispute resolution capabilities.

### 1.2 Architecture Principles

1. **Domain-Driven Design**: Bounded contexts with explicit boundaries
2. **Event Sourcing for Critical Paths**: Booking, payment, dispute state transitions
3. **Immutable Audit Logs**: All state changes and financial actions
4. **Policy-Driven Configuration**: Category-specific rules as code
5. **Idempotent Operations**: All mutations support idempotency keys
6. **Observability First**: Structured logging, metrics, distributed tracing

### 1.3 Technology Stack

- **Backend**: Node.js/TypeScript with NestJS framework
- **Database**: PostgreSQL (primary), Redis (caching), Elasticsearch (search)
- **Message Queue**: RabbitMQ or AWS SQS/SNS
- **Payment Processing**: Stripe Connect with idempotency guarantees
- **Storage**: AWS S3 + CloudFront CDN
- **Monitoring**: Prometheus + Grafana + ELK Stack
- **Infrastructure**: AWS ECS/EKS with Terraform IaC

## 2. System Architecture

### 2.1 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Client Applications                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │   Web App   │  │  Mobile App │  │ Admin Portal│  │ Partner API │   │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘   │
│         │                 │                │                │          │
│  ┌──────┴─────────────────┴────────────────┴────────────────┴──────┐   │
│  │                    API Gateway / Load Balancer                    │   │
│  └────────────────────────────────┬─────────────────────────────────┘   │
│                                   │                                     │
│  ┌────────────────────────────────┼─────────────────────────────────┐   │
│  │                     Backend Services (Microservices)              │   │
│  │                                                                   │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │   │
│  │  │ Identity │  │ Listings │  │ Bookings │  │ Payments │         │   │
│  │  └─────┬────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘         │   │
│  │        │            │              │             │               │   │
│  │  ┌─────┴────┐  ┌────┴─────┐  ┌────┴─────┐  ┌────┴─────┐         │   │
│  │  │Fulfillment│  │ Search   │  │Reviews   │  │ Disputes │         │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘         │   │
│  │                                                                   │   │
│  └──────┬─────────────────────────────────────────────────┬─────────┘   │
│         │                                                 │             │
└─────────┼─────────────────────────────────────────────────┼─────────────┘
          │                                                 │
┌─────────┼─────────────────────────────────────────────────┼─────────────┐
│         ▼                                                 ▼             │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Shared Infrastructure Layer                   │   │
│  │                                                                   │   │
│  │  ┌────────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐ │   │
│  │  │ PostgreSQL │  │ Redis    │  │Elastic-  │  │   AWS S3       │ │   │
│  │  │ (Primary)  │  │(Cache/Queue)│ search   │  │ (Media)        │ │   │
│  │  └────────────┘  └──────────┘  └──────────┘  └────────────────┘ │   │
│  │                                                                   │   │
│  │  ┌────────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐ │   │
│  │  │ RabbitMQ   │  │ Stripe   │  │  Send-   │  │   CloudFront   │ │   │
│  │  │ (Events)   │  │ (Payments)│  │  Grid    │  │    (CDN)      │ │   │
│  │  └────────────┘  └──────────┘  └──────────┘  └────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Service Boundaries (Bounded Contexts)

#### 2.2.1 Identity & Access Context

**Responsibilities**: Authentication, authorization, user profiles, verification, trust scoring
**Domain Entities**: User, Profile, Verification, TrustScore, Session, Role
**Database Schema**: `identity_db` (isolated for security)

#### 2.2.2 Catalog Context

**Responsibilities**: Listing management, category templates, media, pricing, availability
**Domain Entities**: Listing, CategoryTemplate, ListingMedia, AvailabilityRule, PricingModel
**Database Schema**: `catalog_db`

#### 2.2.3 Booking & Reservation Context

**Responsibilities**: Booking lifecycle, state machine, agreements, fulfillment
**Domain Entities**: Booking, BookingState, Agreement, FulfillmentPlan, ConditionReport
**Database Schema**: `booking_db` + Event Store for state transitions

#### 2.2.4 Payment & Finance Context

**Responsibilities**: Payments, deposits, ledger, payouts, reconciliation
**Domain Entities**: PaymentIntent, DepositHold, LedgerEntry, Payout, Invoice
**Database Schema**: `payment_db` (with strict ACID requirements)

#### 2.2.5 Search & Discovery Context

**Responsibilities**: Search indexing, filtering, ranking, recommendations
**Domain Entities**: SearchIndex, RankingModel, FilterConfig
**Database**: Elasticsearch cluster

#### 2.2.6 Communication Context

**Responsibilities**: Messaging, notifications, email/SMS/push
**Domain Entities**: MessageThread, Message, Notification, Template
**Database Schema**: `communication_db`

#### 2.2.7 Reputation & Review Context

**Responsibilities**: Reviews, ratings, trust signals, moderation
**Domain Entities**: Review, Rating, ReputationScore, ModerationFlag
**Database Schema**: `reputation_db`

#### 2.2.8 Dispute & Resolution Context

**Responsibilities**: Dispute management, evidence, arbitration, settlements
**Domain Entities**: Dispute, EvidenceBundle, ArbitrationCase, Resolution
**Database Schema**: `dispute_db` + Document store for evidence

#### 2.2.9 Admin & Operations Context

**Responsibilities**: Admin console, moderation, audit, reporting, policy management
**Domain Entities**: AdminUser, AuditLog, PolicyRule, Report
**Database Schema**: `admin_db` (read-optimized)

### 2.3 Data Flow Patterns

#### 2.3.1 Booking Creation Flow (Saga Pattern)

```
1. [Client] → CreateBookingCommand → API Gateway
2. [Booking Service] → Validate availability → Reserve inventory
3. [Booking Service] → Generate quote → Create agreement snapshot
4. [Payment Service] → Create payment intent → Reserve deposit
5. [Booking Service] → Persist booking → Emit BookingCreated event
6. [Notification Service] → Send confirmation emails
7. [Search Service] → Update availability index
```

#### 2.3.2 Payment Reconciliation Flow

```
1. [Stripe Webhook] → PaymentSucceeded event → Webhook Handler
2. [Payment Service] → Validate webhook → Update ledger
3. [Payment Service] → Emit PaymentCompleted event
4. [Booking Service] → Transition booking to CONFIRMED
5. [Notification Service] → Send payment confirmation
6. [Admin Service] → Log financial audit entry
```

### 2.4 Database Architecture

#### 2.4.1 Primary Databases

```sql
-- PostgreSQL Clusters (one per bounded context)
identity_db     -- Users, auth, profiles
catalog_db      -- Listings, categories, templates
booking_db      -- Bookings, agreements, fulfillment
payment_db      -- Payments, ledger, invoices
communication_db-- Messages, notifications
reputation_db   -- Reviews, ratings
dispute_db      -- Disputes, evidence
admin_db        -- Admin, audit logs, policies

-- Event Store (for critical domains)
booking_events  -- Booking state transitions
payment_events  -- Payment state transitions
dispute_events  -- Dispute resolution events
```

#### 2.4.2 Data Partitioning Strategy

- **Listings**: Shard by `location_hash` for geo queries
- **Bookings**: Shard by `created_at` month + `owner_id`
- **Payments**: Shard by `created_at` day for reconciliation
- **Messages**: Shard by `thread_id` hash

#### 2.4.3 Index Strategy

```sql
-- Composite indexes for common query patterns
CREATE INDEX idx_listings_search ON listings USING gin (
  category,
  location_gist,
  (attributes->>'capacity')::int,
  status
) WHERE status = 'published';

CREATE INDEX idx_bookings_owner ON bookings (owner_id, status, start_date DESC);
CREATE INDEX idx_bookings_renter ON bookings (renter_id, status, start_date DESC);

-- Partial indexes for active data
CREATE INDEX idx_active_payments ON payment_intents (status)
WHERE status IN ('requires_confirmation', 'processing');
```

### 2.5 Caching Strategy

#### 2.5.1 Redis Cache Layers

```typescript
interface CacheLayers {
  // L1: In-memory (Node.js) - 5 minute TTL
  "listings:detail:{id}": ListingDetail;
  "users:profile:{id}": UserProfile;

  // L2: Redis Cluster - 1 hour TTL
  "search:results:{hash}": SearchResults;
  "availability:{listingId}:{month}": AvailabilityCalendar;
  "quotes:{hash}": CachedQuote;

  // L3: Redis Persistent - 24 hour TTL
  "categories:templates": CategoryTemplate[];
  "policies:cancellation": CancellationPolicy[];
  "geo:regions": GeoRegionCache;
}
```

#### 2.5.2 Cache Invalidation Patterns

```typescript
// Write-through for critical data
async function updateListing(listingId: string, data: Partial<Listing>) {
  // 1. Update database
  await db.listings.update(listingId, data);

  // 2. Invalidate cache
  await redis.del(`listings:detail:${listingId}`);
  await redis.del(`search:index:${listingId}`);

  // 3. Publish event for other services
  await eventBus.publish("listing.updated", { listingId });
}

// Cache-aside for reads
async function getListing(id: string): Promise<Listing> {
  const cacheKey = `listings:detail:${id}`;
  const cached = await redis.get(cacheKey);

  if (cached) return JSON.parse(cached);

  const listing = await db.listings.findUnique({ where: { id } });
  await redis.setex(cacheKey, 300, JSON.stringify(listing)); // 5 min TTL

  return listing;
}
```

### 2.6 Event-Driven Architecture

#### 2.6.1 Event Catalog

```typescript
// Domain Events
interface DomainEvents {
  // Identity Events
  "user.registered": { userId: string; email: string };
  "user.verified": { userId: string; tier: string };

  // Catalog Events
  "listing.published": { listingId: string; category: string };
  "listing.updated": { listingId: string; changes: string[] };

  // Booking Events
  "booking.created": BookingCreatedEvent;
  "booking.confirmed": BookingConfirmedEvent;
  "booking.cancelled": BookingCancelledEvent;
  "booking.completed": BookingCompletedEvent;

  // Payment Events
  "payment.succeeded": PaymentSucceededEvent;
  "payment.failed": PaymentFailedEvent;
  "deposit.held": DepositHeldEvent;
  "deposit.released": DepositReleasedEvent;

  // Fulfillment Events
  "checkin.completed": CheckinCompletedEvent;
  "checkout.completed": CheckoutCompletedEvent;

  // Review Events
  "review.submitted": ReviewSubmittedEvent;

  // Dispute Events
  "dispute.opened": DisputeOpenedEvent;
  "dispute.resolved": DisputeResolvedEvent;
}

// Integration Events
interface IntegrationEvents {
  "email.notification.sent": { template: string; recipient: string };
  "sms.notification.sent": { phone: string; message: string };
  "search.index.updated": { entity: string; id: string };
  "audit.log.created": AuditLogEvent;
}
```

#### 2.6.2 Event Processing Guarantees

- **At-least-once delivery**: With idempotent handlers
- **Ordering**: Per-aggregate (e.g., booking events in sequence)
- **Deduplication**: Message IDs + idempotency keys
- **Dead Letter Queue**: Failed events after retries

### 2.7 API Design

#### 2.7.1 REST API Standards

```yaml
openapi: 3.0.0
info:
  title: Universal Rental Portal API
  version: 1.0.0

paths:
  /listings:
    get:
      parameters:
        - $ref: "#/components/parameters/Page"
        - $ref: "#/components/parameters/Limit"
        - $ref: "#/components/parameters/Sort"
      responses:
        "200":
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/PaginatedListing"

  /bookings:
    post:
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/CreateBookingRequest"
      headers:
        Idempotency-Key:
          schema:
            type: string
      responses:
        "202":
          description: Booking accepted for processing
          headers:
            Location:
              schema:
                type: string
              description: URL to poll for booking status
```

#### 2.7.2 GraphQL Schema (Optional)

```graphql
type Query {
  listings(
    filters: ListingFilters
    pagination: PaginationInput
    sort: SortInput
  ): ListingConnection!

  booking(id: ID!): Booking
  user(id: ID!): User
}

type Mutation {
  createBooking(input: CreateBookingInput!): BookingResult!
  submitReview(input: SubmitReviewInput!): ReviewResult!
  openDispute(input: OpenDisputeInput!): DisputeResult!
}

type Subscription {
  bookingStatusChanged(bookingId: ID!): BookingStatusUpdate!
  newMessage(threadId: ID!): Message!
}
```

### 2.8 Security Architecture

#### 2.8.1 Authentication & Authorization

```typescript
interface AuthStrategy {
  // JWT-based authentication
  jwt: {
    issuer: "rental-portal-auth";
    audience: ["api", "admin", "partner"];
    algorithms: ["RS256"];
    publicKey: string;
  };

  // API Keys for partners
  apiKey: {
    prefix: "rp_";
    hashAlgorithm: "sha256";
    rateLimitPerKey: number;
  };

  // Webhook signatures
  webhook: {
    provider: "stripe" | "twilio" | "sendgrid";
    secret: string;
    tolerance: number; // seconds
  };
}

interface RBACMatrix {
  roles: ["renter", "owner", "admin", "support", "finance"];
  permissions: {
    "listings:create": ["owner", "admin"];
    "bookings:cancel": ["renter", "owner", "admin"];
    "payments:refund": ["finance", "admin"];
    "disputes:resolve": ["support", "admin"];
  };
}
```

#### 2.8.2 Data Protection

```typescript
// Encryption at rest
interface EncryptionConfig {
  // PII Fields
  pii: ["email", "phone", "address", "license_number"];
  algorithm: "aes-256-gcm";
  keyRotation: "90 days";

  // Payment data (PCI compliance)
  pci: {
    tokenization: "stripe_elements";
    neverStore: ["card_number", "cvc"];
    auditLogging: true;
  };
}

// Data masking
function maskSensitiveData(data: any, role: string): any {
  if (role === "public") {
    return {
      ...data,
      email: data.email?.replace(/(.).*@(.).*/, "$1***@$2***"),
      phone: data.phone?.replace(/.(?=.{4})/g, "*"),
    };
  }
  return data;
}
```

### 2.9 Monitoring & Observability

#### 2.9.1 Metrics Collection

```yaml
metrics:
  business:
    - bookings.created.total
    - bookings.confirmed.total
    - revenue.total
    - disputes.opened.total
    - user.signups.total

  technical:
    - api.request.duration
    - api.error.rate
    - db.query.duration
    - cache.hit.rate
    - queue.processing.time

  infrastructure:
    - cpu.utilization
    - memory.usage
    - disk.iops
    - network.throughput
```

#### 2.9.2 Distributed Tracing

```typescript
interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  baggage: Record<string, string>;
}

// Correlation IDs across services
async function processBooking(traceContext: TraceContext) {
  // Propagate trace across async operations
  const span = tracer.startSpan("process.booking", { traceContext });

  try {
    // All downstream calls include trace headers
    await paymentService.createPayment(payload, {
      headers: {
        "x-trace-id": traceContext.traceId,
        "x-span-id": span.id,
      },
    });

    span.setTag("booking.status", "processed");
  } catch (error) {
    span.setTag("error", true);
    span.log({ error: error.message });
    throw error;
  } finally {
    span.finish();
  }
}
```

### 2.10 Deployment Architecture

#### 2.10.1 Container Orchestration

```yaml
# docker-compose.yml (development)
version: "3.8"
services:
  api-gateway:
    image: nginx:alpine
    ports: ["8080:80"]
    depends_on: [identity-service, catalog-service]

  identity-service:
    build: ./services/identity
    environment:
      DATABASE_URL: postgresql://identity:password@identity-db:5432/identity
      REDIS_URL: redis://redis:6379/0

  catalog-service:
    build: ./services/catalog
    # ... similar config

  # Infrastructure services
  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: identity
      POSTGRES_USER: identity
      POSTGRES_PASSWORD: password

  redis:
    image: redis:7-alpine

  elasticsearch:
    image: elasticsearch:8.5.0
```

#### 2.10.2 Production Deployment (AWS)

```hcl
# terraform/main.tf
module "ecs_cluster" {
  source  = "terraform-aws-modules/ecs/aws"
  version = "~> 4.0"

  cluster_name = "rental-portal"

  fargate_capacity_providers = {
    FARGATE = {
      default_capacity_provider_strategy = {
        weight = 100
      }
    }
  }
}

module "rds_cluster" {
  source  = "terraform-aws-modules/rds-aurora/aws"
  version = "~> 7.0"

  name           = "rental-portal-db"
  engine         = "aurora-postgresql"
  engine_version = "14.5"

  instances = {
    writer = {
      instance_class = "db.r6g.large"
    }
    reader = {
      instance_class = "db.r6g.large"
      promotion_tier = 1
    }
  }
}
```

## 3. Technical Design Documents

### TDD-001: Booking State Machine Implementation

#### 3.1 Overview

Implements the core booking lifecycle with guaranteed state transitions, audit logging, and business rule enforcement.

#### 3.2 Class Diagram

```typescript
// src/modules/bookings/domain/
interface BookingStateMachine {
  // Core methods
  transition(
    booking: Booking,
    toState: BookingStatus,
    context: TransitionContext,
  ): Promise<Booking>;
  canTransition(
    from: BookingStatus,
    to: BookingStatus,
    context: TransitionContext,
  ): boolean;
  getAvailableTransitions(booking: Booking): BookingStatus[];

  // Event handlers
  onStateEnter(state: BookingStatus, booking: Booking): Promise<void>;
  onStateExit(state: BookingStatus, booking: Booking): Promise<void>;
}

interface TransitionContext {
  triggeredBy: "system" | "renter" | "owner" | "admin";
  reason?: string;
  metadata?: Record<string, any>;
  timestamp: DateTime;
}

// State definitions
const bookingStates: Record<BookingStatus, StateDefinition> = {
  DRAFT: {
    allowedTransitions: ["PENDING_OWNER_APPROVAL", "CANCELLED"],
    invariants: [
      "paymentIntentId must be null",
      "agreementSnapshot must be null",
    ],
    onEnter: async (booking) => {
      await auditLog.log("booking.draft.created", booking);
    },
  },

  CONFIRMED: {
    allowedTransitions: ["IN_PROGRESS", "CANCELLED"],
    invariants: [
      "paymentIntent must be succeeded",
      "deposit must be held or captured",
      "agreementSnapshot must exist",
    ],
    onEnter: async (booking) => {
      await eventBus.publish("booking.confirmed", booking);
      await notificationService.sendConfirmation(booking);
    },
  },

  // ... all other states
};
```

#### 3.3 Sequence Diagram: Booking Confirmation

```
┌─────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Client │    │Booking Svc  │    │Payment Svc  │    │  Stripe     │    │Notification │
└────┬────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘
     │                │                   │                   │                   │
     │POST /bookings  │                   │                   │                   │
     │───────────────>│                   │                   │                   │
     │                │                   │                   │                   │
     │                │Validate           │                   │                   │
     │                │─────────────┐     │                   │                   │
     │                │<────────────┘     │                   │                   │
     │                │                   │                   │                   │
     │                │Create payment     │                   │                   │
     │                │──────────────────>│                   │                   │
     │                │                   │Create intent      │                   │
     │                │                   │──────────────────>│                   │
     │                │                   │                   │Process payment    │
     │                │                   │                   │<──────────────────│
     │                │                   │                   │                   │
     │                │Transition to      │                   │                   │
     │                │CONFIRMED          │                   │                   │
     │                │─────────────┐     │                   │                   │
     │                │<────────────┘     │                   │                   │
     │                │                   │                   │                   │
     │                │Emit event         │                   │                   │
     │                │──────────────────────────────────────────────────────────>│
     │                │                   │                   │                   │Send emails
     │                │                   │                   │                   │─────────┐
     │                │                   │                   │                   │<────────┘
     │202 Accepted    │                   │                   │                   │
     │<───────────────│                   │                   │                   │
```

#### 3.4 Database Schema

```sql
-- booking_states table
CREATE TABLE booking_states (
  id BIGSERIAL PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES bookings(id),
  state VARCHAR(50) NOT NULL,
  triggered_by VARCHAR(20) NOT NULL,
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Indexes
  INDEX idx_booking_states_booking_id (booking_id),
  INDEX idx_booking_states_created_at (created_at DESC)
);

-- State machine configuration
CREATE TABLE state_machine_config (
  entity_type VARCHAR(50) PRIMARY KEY,
  current_version INTEGER NOT NULL,
  config JSONB NOT NULL, -- State definitions
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
```

#### 3.5 Error Handling

```typescript
class StateTransitionError extends ApplicationError {
  constructor(
    public currentState: BookingStatus,
    public targetState: BookingStatus,
    public reason: string,
    public invariantChecks: InvariantCheck[],
  ) {
    super(
      `Cannot transition from ${currentState} to ${targetState}: ${reason}`,
    );
    this.code = "STATE_TRANSITION_ERROR";
    this.statusCode = 409; // Conflict
  }
}

interface InvariantCheck {
  name: string;
  passed: boolean;
  message: string;
}

// Usage
try {
  await bookingStateMachine.transition(booking, "CONFIRMED", {
    triggeredBy: "system",
    metadata: { paymentIntentId: "pi_123" },
  });
} catch (error) {
  if (error instanceof StateTransitionError) {
    // Log detailed invariant failures
    logger.error("State transition failed", {
      bookingId: booking.id,
      currentState: error.currentState,
      targetState: error.targetState,
      failedInvariants: error.invariantChecks.filter((c) => !c.passed),
    });

    // Return structured error to client
    throw new APIError("Cannot confirm booking", 409, {
      code: "INVARIANT_VIOLATION",
      details: error.invariantChecks,
    });
  }
  throw error;
}
```

### TDD-002: Payment Ledger System

#### 3.6 Overview

Double-entry accounting system for all financial transactions with immutability guarantees.

#### 3.7 Ledger Design

```typescript
// src/modules/payments/domain/
interface LedgerEntry {
  id: UUID;
  bookingId: UUID;

  // Double-entry accounting
  debitAccount: AccountCode;
  creditAccount: AccountCode;
  amount: Money;

  // Metadata
  type: LedgerEntryType;
  description: string;
  externalId?: string; // Stripe charge ID, refund ID, etc.

  // Audit
  createdAt: DateTime;
  createdBy: "system" | UUID; // user ID or 'system'

  // Reconciliation
  reconciled: boolean;
  reconciledAt?: DateTime;
}

type AccountCode =
  | "assets.cash" // Money we hold
  | "assets.deposits.held" // Security deposits
  | "liabilities.owners" // Money owed to owners
  | "revenue.platform_fee" // Our earnings
  | "revenue.late_fees" // Additional revenue
  | "expenses.refunds" // Money returned
  | "expenses.chargebacks"; // Disputed charges

// Ledger transaction builder
class LedgerTransaction {
  private entries: LedgerEntry[] = [];

  // Booking confirmation: renter pays $100 + $20 platform fee
  static createBookingPayment(
    booking: Booking,
    payment: PaymentIntent,
  ): LedgerTransaction {
    const tx = new LedgerTransaction();

    // Debit: cash increases
    tx.debit("assets.cash", 120, "Payment received for booking");

    // Credit: split between owner revenue and our fee
    tx.credit("liabilities.owners", 100, "Amount due to owner");
    tx.credit("revenue.platform_fee", 20, "Platform service fee");

    return tx;
  }

  // Deposit hold: $500 security deposit
  static createDepositHold(
    booking: Booking,
    deposit: DepositHold,
  ): LedgerTransaction {
    const tx = new LedgerTransaction();

    // Debit: deposits held (asset)
    tx.debit("assets.deposits.held", 500, "Security deposit held");

    // Credit: deposit liability
    tx.credit("liabilities.deposits", 500, "Security deposit liability");

    return tx;
  }

  async commit(): Promise<void> {
    // Validate: sum of debits must equal sum of credits
    const debitTotal = this.entries
      .filter((e) => e.side === "debit")
      .reduce((sum, e) => sum + e.amount, 0);

    const creditTotal = this.entries
      .filter((e) => e.side === "credit")
      .reduce((sum, e) => sum + e.amount, 0);

    if (Math.abs(debitTotal - creditTotal) > 0.01) {
      throw new LedgerError("Transaction not balanced");
    }

    // Store all entries in a single database transaction
    await db.$transaction(async (tx) => {
      for (const entry of this.entries) {
        await tx.ledgerEntries.create({ data: entry });
      }
    });

    // Emit event for reconciliation
    await eventBus.publish("ledger.transaction.committed", {
      transactionId: this.id,
      bookingId: this.bookingId,
      entryCount: this.entries.length,
    });
  }
}
```

#### 3.8 Reconciliation Service

```typescript
class ReconciliationService {
  async reconcileDaily(): Promise<ReconciliationReport> {
    const startDate = startOfDay(DateTime.now().minus({ days: 1 }));
    const endDate = endOfDay(startDate);

    // 1. Get ledger entries for the day
    const ledgerEntries = await this.getLedgerEntries(startDate, endDate);

    // 2. Get external transactions from Stripe
    const stripeTransactions = await stripe.balanceTransactions.list({
      created: {
        gte: Math.floor(startDate.toSeconds()),
        lte: Math.floor(endDate.toSeconds()),
      },
    });

    // 3. Match and reconcile
    const matches = this.matchTransactions(ledgerEntries, stripeTransactions);

    // 4. Generate report
    const report: ReconciliationReport = {
      date: startDate,
      ledgerTotal: this.summarizeLedger(ledgerEntries),
      stripeTotal: this.summarizeStripe(stripeTransactions),
      matches,
      discrepancies: this.findDiscrepancies(matches),
      status: discrepancies.length === 0 ? 'balanced' : 'imbalanced',
    };

    // 5. Alert if discrepancies found
    if (report.discrepancies.length > 0) {
      await this.alertDiscrepancies(report);
    }

    return report;
  }

  private matchTransactions(
    ledgerEntries: LedgerEntry[],
    stripeTransactions: StripeBalanceTransaction[]
  ): TransactionMatch[] {
    return ledgerEntries.map(entry => {
      const stripeMatch = stripeTransactions.find(stripeTx =>
        this.isMatch(entry, stripeTx)
      );

      return {
        ledgerEntry: entry,
        stripeTransaction: stripeMatch,
        matchType: stripeMatch ? 'exact' : 'partial' : 'none',
        difference: stripeMatch
          ? entry.amount - this.convertStripeAmount(stripeMatch.amount, stripeMatch.currency)
          : null,
      };
    });
  }
}
```

#### 3.9 Database Schema

```sql
-- Double-entry ledger
CREATE TABLE ledger_entries (
  id BIGSERIAL PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES bookings(id),

  -- Double entry
  debit_account VARCHAR(50) NOT NULL,
  credit_account VARCHAR(50) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',

  -- Metadata
  entry_type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  external_id VARCHAR(100), -- Stripe/PayPal ID
  external_type VARCHAR(50), -- 'charge', 'refund', 'payout'

  -- Audit
  created_by_type VARCHAR(20) NOT NULL, -- 'system', 'user', 'admin'
  created_by_id UUID, -- user_id if applicable
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Reconciliation
  reconciled BOOLEAN NOT NULL DEFAULT FALSE,
  reconciled_at TIMESTAMPTZ,
  reconciliation_note TEXT,

  -- Indexes
  INDEX idx_ledger_booking (booking_id),
  INDEX idx_ledger_created_at (created_at DESC),
  INDEX idx_ledger_external (external_id, external_type),
  INDEX idx_ledger_reconciled (reconciled, created_at),

  -- Constraints
  CONSTRAINT amount_positive CHECK (amount > 0),
  CONSTRAINT accounts_different CHECK (debit_account != credit_account)
);

-- Account balances (materialized view)
CREATE MATERIALIZED VIEW account_balances AS
SELECT
  account,
  SUM(CASE WHEN side = 'debit' THEN amount ELSE -amount END) AS balance,
  currency
FROM (
  SELECT debit_account AS account, amount, 'debit' AS side, currency
  FROM ledger_entries
  UNION ALL
  SELECT credit_account AS account, amount, 'credit' AS side, currency
  FROM ledger_entries
) AS combined
GROUP BY account, currency;

-- Refresh balances nightly
CREATE OR REPLACE FUNCTION refresh_account_balances()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY account_balances;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```

### TDD-003: Category Template System

#### 3.10 Overview

Dynamic schema system for category-specific attributes with validation, indexing, and UI rendering.

#### 3.11 Template Registry

```typescript
// src/core/categories/
class CategoryTemplateRegistry {
  private templates: Map<string, CategoryTemplate> = new Map();
  private validators: Map<string, Validator> = new Map();
  private indexers: Map<string, Indexer> = new Map();

  async register(template: CategoryTemplate): Promise<void> {
    // Validate template schema
    const validator = this.compileValidator(template.schema);
    const indexer = this.compileIndexer(template.schema);

    this.templates.set(template.name, template);
    this.validators.set(template.name, validator);
    this.indexers.set(template.name, indexer);

    // Register with search service
    await searchService.registerSchema(
      template.name,
      this.getSearchSchema(template),
    );
  }

  async validate(listing: Listing): Promise<ValidationResult> {
    const template = this.templates.get(listing.category);
    if (!template) {
      throw new Error(`Template not found for category: ${listing.category}`);
    }

    const validator = this.validators.get(listing.category)!;
    return validator.validate(listing.attributes);
  }

  async index(listing: Listing): Promise<SearchDocument> {
    const indexer = this.indexers.get(listing.category);
    if (!indexer) {
      throw new Error(`Indexer not found for category: ${listing.category}`);
    }

    return indexer.transform(listing);
  }

  getUIFields(category: string): UIField[] {
    const template = this.templates.get(category);
    if (!template) return [];

    return this.schemaToUIFields(template.schema);
  }

  private compileValidator(schema: JSONSchema): Validator {
    // Use AJV for JSON Schema validation
    const ajv = new Ajv({
      allErrors: true,
      coerceTypes: false,
      useDefaults: true,
    });

    return ajv.compile(schema);
  }

  private compileIndexer(schema: JSONSchema): Indexer {
    // Extract searchable fields from schema
    const searchableFields = this.extractSearchableFields(schema);

    return {
      transform: (listing: Listing) => ({
        id: listing.id,
        category: listing.category,
        attributes: this.flattenAttributes(
          listing.attributes,
          searchableFields,
        ),
        location: listing.location,
        pricing: listing.pricing,
        availability: listing.availability,
      }),
    };
  }
}
```

#### 3.12 Template Definitions

```json
// config/categories/vehicles.json
{
  "name": "vehicles",
  "version": "1.2.0",
  "schema": {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "required": ["type", "make", "model", "year", "transmission", "fuelType"],
    "properties": {
      "type": {
        "type": "string",
        "enum": ["car", "suv", "truck", "van", "motorcycle", "scooter"]
      },
      "make": { "type": "string", "maxLength": 50 },
      "model": { "type": "string", "maxLength": 50 },
      "year": { "type": "integer", "minimum": 1990, "maximum": 2024 },
      "transmission": {
        "type": "string",
        "enum": ["automatic", "manual"]
      },
      "fuelType": {
        "type": "string",
        "enum": ["gasoline", "diesel", "electric", "hybrid"]
      },
      "seats": { "type": "integer", "minimum": 1, "maximum": 15 },
      "doors": { "type": "integer", "minimum": 2, "maximum": 6 },
      "features": {
        "type": "array",
        "items": { "type": "string" },
        "uniqueItems": true
      },
      "licensePlate": { "type": "string", "maxLength": 20 },
      "insuranceInfo": {
        "type": "object",
        "properties": {
          "provider": { "type": "string" },
          "policyNumber": { "type": "string" },
          "expiresAt": { "type": "string", "format": "date" }
        }
      }
    }
  },
  "pricingUnits": ["per_day", "per_hour"],
  "fulfillmentMethods": ["pickup_dropoff"],
  "requiredChecklists": ["vehicle_checkin", "vehicle_checkout"],
  "defaultPolicies": {
    "cancellation": "moderate_48h",
    "deposit": {
      "type": "fixed",
      "amount": 500,
      "currency": "USD"
    },
    "lateFees": {
      "type": "hourly",
      "rate": 25,
      "gracePeriod": 30
    }
  },
  "uiConfig": {
    "createForm": {
      "sections": [
        {
          "title": "Vehicle Details",
          "fields": ["type", "make", "model", "year"]
        },
        {
          "title": "Specifications",
          "fields": ["transmission", "fuelType", "seats", "doors"]
        }
      ]
    },
    "searchFilters": [
      { "field": "type", "type": "multi_select" },
      { "field": "make", "type": "text" },
      { "field": "year", "type": "range" },
      { "field": "seats", "type": "range" }
    ]
  }
}
```

#### 3.13 Database Schema

```sql
-- Category templates
CREATE TABLE category_templates (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  version VARCHAR(20) NOT NULL,
  schema JSONB NOT NULL,
  config JSONB NOT NULL, -- pricingUnits, fulfillmentMethods, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Index for schema queries
  INDEX idx_category_schema ON category_templates USING gin (schema);
);

-- Listing attributes (typed JSON storage)
CREATE TABLE listing_attributes (
  listing_id UUID PRIMARY KEY REFERENCES listings(id),
  category VARCHAR(50) NOT NULL,
  template_version VARCHAR(20) NOT NULL,
  attributes JSONB NOT NULL,

  -- Generated columns for indexed fields
  make VARCHAR(50) GENERATED ALWAYS AS (attributes->>'make') STORED,
  model VARCHAR(50) GENERATED ALWAYS AS (attributes->>'model') STORED,
  year INTEGER GENERATED ALWAYS AS ((attributes->>'year')::integer) STORED,

  -- Indexes
  INDEX idx_attrs_category (category),
  INDEX idx_attrs_make (make),
  INDEX idx_attrs_model (model),
  INDEX idx_attrs_year (year),

  -- JSONB indexes for flexible querying
  INDEX idx_attrs_gin ON listing_attributes USING gin (attributes jsonb_path_ops)
);

-- Schema migration tracking
CREATE TABLE schema_migrations (
  category VARCHAR(50) NOT NULL,
  from_version VARCHAR(20) NOT NULL,
  to_version VARCHAR(20) NOT NULL,
  migration_script TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (category, from_version, to_version)
);
```

### TDD-004: Search & Discovery Service

#### 3.14 Overview

Real-time search with category-specific filtering, geo-spatial queries, and relevance ranking.

#### 3.15 Search Architecture

```typescript
// src/modules/search/
class SearchService {
  constructor(
    private elasticsearch: ElasticsearchClient,
    private redis: RedisClient,
    private categoryRegistry: CategoryTemplateRegistry,
  ) {}

  async search(query: SearchQuery): Promise<SearchResults> {
    // Check cache first
    const cacheKey = this.buildCacheKey(query);
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    // Build Elasticsearch query
    const esQuery = this.buildElasticsearchQuery(query);

    // Execute search
    const result = await this.elasticsearch.search({
      index: "listings",
      body: esQuery,
    });

    // Transform results
    const listings = this.transformHits(result.hits.hits);
    const pagination = this.buildPagination(result, query);

    const searchResults: SearchResults = {
      listings,
      pagination,
      filters: this.buildAvailableFilters(result.aggregations),
      total: result.hits.total.value,
    };

    // Cache for 1 minute
    await this.redis.setex(cacheKey, 60, JSON.stringify(searchResults));

    return searchResults;
  }

  private buildElasticsearchQuery(query: SearchQuery): any {
    const must: any[] = [];
    const filter: any[] = [];

    // Category filter
    if (query.category) {
      filter.push({ term: { category: query.category } });
    }

    // Date range availability
    if (query.dateRange) {
      filter.push({
        nested: {
          path: "availability",
          query: {
            bool: {
              must: [
                {
                  range: {
                    "availability.start_date": { lte: query.dateRange.end },
                  },
                },
                {
                  range: {
                    "availability.end_date": { gte: query.dateRange.start },
                  },
                },
                { term: { "availability.available": true } },
              ],
            },
          },
        },
      });
    }

    // Location (geo-distance)
    if (query.location) {
      filter.push({
        geo_distance: {
          distance: query.radius || "10km",
          location: {
            lat: query.location.lat,
            lon: query.location.lng,
          },
        },
      });
    }

    // Category-specific filters
    if (query.filters && query.category) {
      const template = this.categoryRegistry.getTemplate(query.category);
      const filterableFields = template?.uiConfig?.searchFilters || [];

      for (const filterItem of query.filters) {
        const fieldConfig = filterableFields.find(
          (f) => f.field === filterItem.field,
        );
        if (fieldConfig) {
          filter.push(this.buildFieldFilter(filterItem, fieldConfig));
        }
      }
    }

    // Full-text search
    if (query.q) {
      must.push({
        multi_match: {
          query: query.q,
          fields: ["title^3", "description^2", "attributes.*^1"],
          fuzziness: "AUTO",
        },
      });
    }

    // Build final query
    return {
      query: {
        bool: {
          must: must.length > 0 ? must : undefined,
          filter: filter.length > 0 ? filter : undefined,
        },
      },
      aggs: this.buildAggregations(query.category),
      sort: this.buildSort(query.sortBy, query.sortOrder),
      from: (query.page - 1) * query.limit,
      size: query.limit,
    };
  }

  private buildFieldFilter(filter: SearchFilter, config: FilterConfig): any {
    switch (config.type) {
      case "range":
        return {
          range: {
            [`attributes.${filter.field}`]: {
              gte: filter.value.min,
              lte: filter.value.max,
            },
          },
        };

      case "multi_select":
        return {
          terms: {
            [`attributes.${filter.field}.keyword`]: filter.value,
          },
        };

      case "boolean":
        return {
          term: {
            [`attributes.${filter.field}`]: filter.value,
          },
        };

      default:
        return {
          term: {
            [`attributes.${filter.field}.keyword`]: filter.value,
          },
        };
    }
  }

  private buildSort(sortBy: string, sortOrder: "asc" | "desc"): any[] {
    switch (sortBy) {
      case "price":
        return [{ "pricing.base_amount": sortOrder }];

      case "distance":
        return [
          { _geo_distance: { location: "user_location", order: sortOrder } },
        ];

      case "rating":
        return [{ "trust_metrics.avg_rating": sortOrder }];

      case "relevance":
      default:
        return [{ _score: "desc" }];
    }
  }
}
```

#### 3.16 Indexing Service

```typescript
class IndexingService {
  async indexListing(listing: Listing): Promise<void> {
    // Get category-specific indexer
    const indexer = this.categoryRegistry.getIndexer(listing.category);
    const document = indexer.transform(listing);

    // Add common fields
    document.title = listing.title;
    document.description = listing.description;
    document.location = listing.location;
    document.pricing = listing.pricing;
    document.trust_metrics = await this.calculateTrustMetrics(listing);
    document.availability = await this.getAvailabilityWindows(listing.id);

    // Index in Elasticsearch
    await this.elasticsearch.index({
      index: "listings",
      id: listing.id,
      body: document,
      refresh: "wait_for", // Wait for index to be searchable
    });

    // Update availability cache
    await this.updateAvailabilityCache(listing);
  }

  async updateAvailability(
    listingId: string,
    date: Date,
    available: boolean,
  ): Promise<void> {
    // Update availability in listing document
    await this.elasticsearch.update({
      index: "listings",
      id: listingId,
      body: {
        script: {
          source: `
            if (ctx._source.availability == null) {
              ctx._source.availability = [];
            }
            
            // Remove existing entry for this date
            def toRemove = [];
            for (int i = 0; i < ctx._source.availability.length; i++) {
              if (ctx._source.availability[i].date == params.date) {
                toRemove.add(i);
              }
            }
            
            Collections.reverse(toRemove);
            for (int i : toRemove) {
              ctx._source.availability.remove(i);
            }
            
            // Add new availability
            ctx._source.availability.add([
              'date': params.date,
              'available': params.available
            ]);
          `,
          params: {
            date: date.toISOString().split("T")[0],
            available: available,
          },
        },
      },
    });

    // Invalidate search cache for queries involving this listing
    await this.invalidateSearchCache(listingId);
  }

  private async calculateTrustMetrics(listing: Listing): Promise<TrustMetrics> {
    const [reviews, bookings, owner] = await Promise.all([
      this.getListingReviews(listing.id),
      this.getBookingStats(listing.id),
      this.getOwnerStats(listing.ownerId),
    ]);

    return {
      avg_rating: reviews.averageRating,
      review_count: reviews.count,
      booking_count: bookings.total,
      completion_rate: bookings.completed / bookings.total,
      response_rate: owner.responseRate,
      verification_level: owner.verificationTier,
      super_host: owner.superHost,
    };
  }
}
```

#### 3.17 Elasticsearch Mapping

```json
{
  "mappings": {
    "dynamic": "strict",
    "properties": {
      "id": { "type": "keyword" },
      "category": { "type": "keyword" },
      "title": {
        "type": "text",
        "analyzer": "english",
        "fields": {
          "keyword": { "type": "keyword" }
        }
      },
      "description": {
        "type": "text",
        "analyzer": "english"
      },
      "location": {
        "type": "geo_point"
      },
      "attributes": {
        "type": "object",
        "dynamic": true,
        "properties": {
          "make": {
            "type": "text",
            "fields": { "keyword": { "type": "keyword" } }
          },
          "model": {
            "type": "text",
            "fields": { "keyword": { "type": "keyword" } }
          },
          "year": { "type": "integer" },
          "seats": { "type": "integer" },
          "features": { "type": "keyword" }
        }
      },
      "pricing": {
        "type": "object",
        "properties": {
          "base_amount": { "type": "float" },
          "currency": { "type": "keyword" },
          "cleaning_fee": { "type": "float" },
          "security_deposit": { "type": "float" }
        }
      },
      "availability": {
        "type": "nested",
        "properties": {
          "date": { "type": "date", "format": "yyyy-MM-dd" },
          "available": { "type": "boolean" },
          "price": { "type": "float" }
        }
      },
      "trust_metrics": {
        "type": "object",
        "properties": {
          "avg_rating": { "type": "float" },
          "review_count": { "type": "integer" },
          "booking_count": { "type": "integer" },
          "completion_rate": { "type": "float" },
          "response_rate": { "type": "float" },
          "verification_level": { "type": "keyword" }
        }
      },
      "created_at": { "type": "date" },
      "updated_at": { "type": "date" }
    }
  },
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 1,
    "analysis": {
      "analyzer": {
        "english": {
          "type": "standard",
          "stopwords": "_english_"
        }
      }
    }
  }
}
```

### TDD-005: Dispute Resolution System

#### 3.18 Overview

Structured dispute management with evidence collection, SLA tracking, and resolution workflows.

#### 3.19 Dispute State Machine

```typescript
// src/modules/disputes/domain/
class DisputeStateMachine {
  private readonly states: Record<DisputeStatus, StateDefinition> = {
    DRAFT: {
      allowedTransitions: ["OPEN"],
      invariants: ["evidenceBundle must not be empty"],
      onEnter: async (dispute) => {
        await this.validateDisputeEligibility(dispute);
      },
    },

    OPEN: {
      allowedTransitions: ["UNDER_REVIEW", "RESOLVED", "ESCALATED"],
      invariants: ["initiator must have responded"],
      onEnter: async (dispute) => {
        await this.startSLATimers(dispute);
        await this.notifyParties(dispute, "dispute.opened");
      },
    },

    UNDER_REVIEW: {
      allowedTransitions: [
        "RESOLVED",
        "ESCALATED",
        "ADDITIONAL_EVIDENCE_REQUIRED",
      ],
      invariants: ["assignedAdmin must exist"],
      onEnter: async (dispute) => {
        await this.assignToAdmin(dispute);
        await this.requestEvidenceIfNeeded(dispute);
      },
    },

    ADDITIONAL_EVIDENCE_REQUIRED: {
      allowedTransitions: ["UNDER_REVIEW", "ESCALATED"],
      invariants: ["evidenceRequest must exist"],
      onEnter: async (dispute) => {
        await this.sendEvidenceRequest(dispute);
        await this.startResponseTimer(dispute);
      },
    },

    ESCALATED: {
      allowedTransitions: ["RESOLVED", "EXTERNAL_ARBITRATION"],
      invariants: ["escalationReason must be provided"],
      onEnter: async (dispute) => {
        await this.escalateToSeniorAdmin(dispute);
        await this.updateSLA(dispute, { additionalDays: 3 });
      },
    },

    RESOLVED: {
      allowedTransitions: [],
      invariants: ["outcome must exist", "resolutionSummary must not be empty"],
      onEnter: async (dispute) => {
        await this.executeResolution(dispute);
        await this.finalizeDispute(dispute);
        await this.notifyParties(dispute, "dispute.resolved");
      },
    },

    EXTERNAL_ARBITRATION: {
      allowedTransitions: ["RESOLVED"],
      invariants: ["externalCaseId must exist"],
      onEnter: async (dispute) => {
        await this.submitToExternalArbitration(dispute);
      },
    },
  };

  async initiateDispute(
    bookingId: string,
    initiatorId: string,
    reason: DisputeReason,
    evidence: EvidenceSubmission,
  ): Promise<Dispute> {
    // Validate booking is eligible for dispute
    const booking = await this.validateBookingEligibility(bookingId);

    // Create evidence bundle
    const evidenceBundle = await this.buildEvidenceBundle(booking, evidence);

    // Create dispute
    const dispute: Dispute = {
      id: uuid(),
      bookingId,
      initiatorId,
      reason,
      category: this.mapReasonToCategory(reason),
      status: "DRAFT",
      evidenceBundle,
      timeline: [
        {
          event: "created",
          timestamp: new Date(),
          actor: initiatorId,
          metadata: { reason },
        },
      ],
      sla: this.calculateSLA(reason),
      createdAt: new Date(),
    };

    // Validate against category-specific rules
    await this.validateDisputeRules(dispute);

    // Transition to OPEN
    await this.transition(dispute, "OPEN", {
      triggeredBy: "system",
      metadata: { autoOpen: true },
    });

    return dispute;
  }

  private async executeResolution(dispute: Dispute): Promise<void> {
    const { outcome } = dispute;

    switch (outcome?.decision) {
      case "refund_renter":
        await this.refundRenter(dispute, outcome.amount);
        break;

      case "charge_renter":
        await this.chargeRenter(dispute, outcome.amount);
        break;

      case "split":
        await this.splitPayment(dispute, outcome.amount);
        break;

      case "dismissed":
        // No financial action, just close dispute
        break;
    }

    // Update booking status if needed
    await this.updateBookingStatus(dispute);

    // Log resolution
    await this.auditResolution(dispute);
  }
}
```

#### 3.20 Evidence Management

```typescript
class EvidenceManager {
  async buildEvidenceBundle(
    booking: Booking,
    additionalEvidence: EvidenceSubmission,
  ): Promise<EvidenceBundle> {
    // Automatically attach relevant evidence
    const [messages, conditionReports, paymentRecords] = await Promise.all([
      this.getMessageThread(booking.id),
      this.getConditionReports(booking.id),
      this.getPaymentRecords(booking.id),
    ]);

    // Filter to relevant time period
    const relevantPeriod = this.getRelevantPeriod(
      booking,
      additionalEvidence.reason,
    );

    const filteredMessages = messages.filter(
      (msg) =>
        msg.createdAt >= relevantPeriod.start &&
        msg.createdAt <= relevantPeriod.end,
    );

    const filteredReports = conditionReports.filter(
      (report) => report.type === additionalEvidence.requiredReportType,
    );

    // Add uploaded evidence
    const uploadedEvidence = await this.processUploadedEvidence(
      additionalEvidence.files,
      booking.id,
    );

    return {
      messages: filteredMessages,
      conditionReports: filteredReports,
      paymentRecords,
      additionalEvidence: uploadedEvidence,
      agreementSnapshot: booking.agreementSnapshot,
      timeline: this.buildTimeline(booking),
    };
  }

  async processUploadedEvidence(
    files: UploadedFile[],
    bookingId: string,
  ): Promise<EvidenceAttachment[]> {
    const attachments: EvidenceAttachment[] = [];

    for (const file of files) {
      // Validate file type and size
      this.validateEvidenceFile(file);

      // Scan for malicious content
      await this.scanFileForMalware(file);

      // Store in secure evidence bucket
      const url = await this.storeEvidenceFile(file, bookingId);

      // Create tamper-evident hash
      const hash = await this.createContentHash(file.buffer);

      attachments.push({
        id: uuid(),
        type: this.mapFileType(file.mimetype),
        url,
        hash,
        uploadedAt: new Date(),
        uploadedBy: file.uploaderId,
        metadata: {
          filename: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          hash,
        },
      });
    }

    return attachments;
  }

  private validateEvidenceFile(file: UploadedFile): void {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "video/mp4",
      "video/quicktime",
      "application/pdf",
      "text/plain",
    ];

    if (file.size > maxSize) {
      throw new ValidationError("File too large");
    }

    if (!allowedTypes.includes(file.mimetype)) {
      throw new ValidationError("Invalid file type");
    }
  }
}
```

#### 3.21 Database Schema

```sql
-- Disputes
CREATE TABLE disputes (
  id UUID PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES bookings(id),
  initiator_id UUID NOT NULL REFERENCES users(id),

  -- Dispute details
  reason VARCHAR(50) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,

  -- State
  status VARCHAR(30) NOT NULL,
  assigned_admin_id UUID REFERENCES admin_users(id),
  escalation_level INTEGER NOT NULL DEFAULT 1,

  -- SLA tracking
  sla_respond_by TIMESTAMPTZ NOT NULL,
  sla_resolve_by TIMESTAMPTZ NOT NULL,
  responded_at TIMESTAMPTZ,

  -- Resolution
  outcome_decision VARCHAR(30),
  outcome_amount DECIMAL(12, 2),
  outcome_currency VARCHAR(3),
  outcome_description TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES admin_users(id),

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Indexes
  INDEX idx_disputes_booking (booking_id),
  INDEX idx_disputes_status (status),
  INDEX idx_disputes_sla (sla_resolve_by) WHERE status NOT IN ('RESOLVED', 'DISMISSED'),
  INDEX idx_disputes_admin (assigned_admin_id) WHERE assigned_admin_id IS NOT NULL
);

-- Evidence
CREATE TABLE dispute_evidence (
  id UUID PRIMARY KEY,
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL,
  reference_type VARCHAR(30) NOT NULL, -- 'message', 'condition_report', 'payment', 'upload'
  reference_id UUID NOT NULL,
  metadata JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  INDEX idx_evidence_dispute (dispute_id),
  INDEX idx_evidence_type (type)
);

-- Timeline events
CREATE TABLE dispute_timeline (
  id BIGSERIAL PRIMARY KEY,
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  actor_id UUID NOT NULL,
  actor_type VARCHAR(20) NOT NULL, -- 'user', 'admin', 'system'
  description TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  INDEX idx_timeline_dispute (dispute_id, created_at DESC)
);

-- Resolution templates
CREATE TABLE resolution_templates (
  id UUID PRIMARY KEY,
  category VARCHAR(50) NOT NULL,
  reason VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  decision_type VARCHAR(30) NOT NULL,
  amount_logic JSONB NOT NULL, -- Formula for calculating amounts
  conditions JSONB NOT NULL, -- When this template applies
  priority INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,

  UNIQUE(category, reason, name),
  INDEX idx_templates_category (category, reason)
);
```

## 4. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)

```yaml
week-1:
  - Project setup & development environment
  - Core domain models & interfaces
  - Database schema design & migrations
  - Authentication service (JWT, sessions)

week-2:
  - User service (profiles, verification)
  - Category template system
  - Listing service (CRUD, validation)
  - Media upload service

week-3:
  - Availability service
  - Pricing & quote engine
  - Search service foundation
  - Elasticsearch setup

week-4:
  - Booking state machine
  - Agreement snapshots
  - Basic notification service
  - Admin service foundation
```

### Phase 2: Core Features (Weeks 5-8)

```yaml
week-5:
  - Payment service integration
  - Ledger system implementation
  - Deposit hold management
  - Webhook handling

week-6:
  - Messaging system
  - Real-time notifications
  - Condition reports system
  - Fulfillment workflows

week-7:
  - Review & reputation system
  - Search optimization
  - Advanced filtering
  - Geo-spatial queries

week-8:
  - Dispute system foundation
  - Evidence management
  - Basic resolution workflows
  - Admin moderation tools
```

### Phase 3: Advanced Features (Weeks 9-12)

```yaml
week-9:
  - Advanced dispute resolution
  - SLA tracking
  - Automated resolution suggestions
  - External arbitration integration

week-10:
  - Analytics & reporting
  - Business intelligence dashboards
  - Advanced search ranking
  - Recommendation engine

week-11:
  - Mobile optimizations
  - Push notifications
  - Offline capabilities
  - Performance optimizations

week-12:
  - Security hardening
  - Compliance features
  - Load testing
  - Production readiness
```

## 5. Testing Strategy

### 5.1 Test Pyramid

```
        /¯¯¯¯¯¯¯¯¯¯\
       /  E2E Tests  \      ~10%
      /_______________\
     /                 \
    /   Integration     \   ~20%
   /      Tests          \
  /_______________________\
 /                         \
/       Unit Tests          \ ~70%
\---------------------------/
```

### 5.2 Test Coverage Targets

```yaml
unit-tests:
  minimum-coverage: 80%
  critical-paths: 95%
  includes:
    - domain logic
    - business rules
    - state machines
    - validation

integration-tests:
  minimum-coverage: 70%
  includes:
    - API endpoints
    - database interactions
    - external service integrations
    - message queues

e2e-tests:
  scenarios:
    - user registration flow
    - listing creation flow
    - booking flow
    - payment flow
    - dispute flow
  performance: < 30 minutes runtime
```

### 5.3 Performance Testing

```yaml
load-tests:
  scenarios:
    - search-under-load: 1000 RPS for 5 minutes
    - booking-creation: 100 RPS for 10 minutes
    - payment-processing: 50 RPS for 15 minutes
  targets:
    - p95 latency: < 500ms
    - error rate: < 0.1%
    - throughput: sustained target RPS

stress-tests:
  scenarios:
    - peak-traffic: 10x normal load
    - database-failover: simulate primary failure
    - payment-provider-outage: fallback testing
```

## 6. Deployment & Operations

### 6.1 CI/CD Pipeline

```yaml
stages:
  - lint
  - test
  - build
  - deploy

environments:
  development:
    branch: main
    auto-deploy: true
    url: https://dev.rental-portal.com

  staging:
    branch: release/*
    manual-approval: true
    url: https://staging.rental-portal.com

  production:
    branch: production
    manual-approval: true
    canary-deployment: true
    url: https://rental-portal.com

deployment-strategy:
  type: blue-green
  health-checks:
    - endpoint: /health
      interval: 30s
      timeout: 5s
      retries: 3
  rollback:
    automatic: true
    threshold: 5% error rate
```

### 6.2 Monitoring & Alerting

```yaml
critical-alerts:
  - payment-failure-rate > 5%
  - database-connection-errors > 10/min
  - api-error-rate > 1%
  - dispute-resolution-time > sla-24h
  - booking-confirmation-latency > 2s

business-metrics:
  - daily-active-users
  - booking-conversion-rate
  - revenue-per-listing
  - dispute-resolution-rate
  - customer-satisfaction-score

sla-targets:
  - api-availability: 99.95%
  - search-latency: < 200ms p95
  - booking-confirmation: < 2s p95
  - payment-processing: < 5s p99
  - dispute-response: < 4h
```

## 7. Security & Compliance

### 7.1 Security Controls

```yaml
authentication:
  - multi-factor-authentication: optional
  - session-timeout: 24 hours
  - password-policy: NIST 800-63B

authorization:
  - role-based-access-control
  - attribute-based-access-control for sensitive data
  - audit-logging: all admin actions

data-protection:
  - encryption-at-rest: AES-256
  - encryption-in-transit: TLS 1.3
  - pii-masking: automatic
  - data-retention: 7 years for financial data

payment-security:
  - pci-dss-compliant: via Stripe
  - card-data: never stored
  - fraud-detection: machine learning
```

### 7.2 Compliance Framework

```yaml
gdpr:
  - data-subject-access-requests
  - right-to-erasure
  - data-processing-agreements
  - privacy-by-design

ccpa:
  - consumer-rights-portal
  - do-not-sell-my-data
  - data-deletion-requests

pci-dss:
  - saq-a: via Stripe
  - quarterly-vulnerability-scans
  - penetration-testing: annual

accessibility:
  - wcag-2.1-aa-compliance
  - screen-reader-compatible
  - keyboard-navigable
```

## 8. Success Metrics & KPIs

### 8.1 Technical Metrics

```yaml
reliability:
  - uptime: > 99.9%
  - error-rate: < 0.1%
  - mean-time-to-recovery: < 1 hour

performance:
  - api-latency-p95: < 500ms
  - search-latency-p95: < 200ms
  - page-load-time: < 3s

scalability:
  - concurrent-users: 10,000+
  - daily-bookings: 50,000+
  - peak-rps: 1,000+
```

### 8.2 Business Metrics

```yaml
growth:
  - monthly-active-users: +20% MoM
  - new-listings: +15% MoM
  - booking-volume: +25% MoM

monetization:
  - take-rate: 10-20%
  - average-order-value: $150+
  - revenue-growth: +30% MoM

quality:
  - dispute-rate: < 2%
  - customer-satisfaction: > 4.5/5
  - repeat-bookings: > 40%
```

This comprehensive architecture and technical design document provides a complete blueprint for building the Universal Rental Portal. Each section can be expanded into detailed implementation guides as development progresses.
