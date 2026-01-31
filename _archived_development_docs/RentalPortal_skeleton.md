# Universal Rental Portal — Technical Artifacts Skeleton

## Directory Structure
```
src/
├── core/                    # Shared domain logic
├── modules/                 # Feature modules
├── api/                     # API layer
├── infrastructure/         # External integrations
└── shared/                 # Utilities, types, constants
```

## Core Domain Entities (Interfaces)

### 1. User & Identity
```typescript
// src/core/identity/
interface User {
  id: UUID;
  email: string;
  phone?: string;
  status: 'active' | 'suspended' | 'banned';
  verificationTier: 'basic' | 'verified' | 'advanced';
  createdAt: DateTime;
}

interface UserProfile {
  userId: UUID;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  trustScore: number;
  verificationFlags: VerificationFlags[];
}

interface VerificationFlags {
  type: 'email' | 'phone' | 'id' | 'license' | 'address';
  status: 'pending' | 'verified' | 'failed';
  verifiedAt?: DateTime;
  metadata: Record<string, any>;
}
```

### 2. Category Templates
```typescript
// src/core/categories/
interface CategoryTemplate {
  id: UUID;
  name: 'spaces' | 'vehicles' | 'instruments' | 'event-venues' | 'event-items' | 'wearables';
  version: string;
  schema: JSONSchema;
  pricingUnits: PricingUnit[];
  fulfillmentMethods: FulfillmentMethod[];
  requiredChecklists: ChecklistTemplate[];
  defaultPolicies: {
    cancellation: CancellationPolicy;
    deposit: DepositPolicy;
    lateFees: LateFeePolicy;
  };
}

interface CategoryAttributes {
  [category: string]: {
    required: string[];
    optional: string[];
    searchable: string[];
    filterable: string[];
  };
}
```

### 3. Listings
```typescript
// src/modules/listings/
interface Listing {
  id: UUID;
  ownerId: UUID;
  category: CategoryType;
  templateVersion: string;
  status: 'draft' | 'published' | 'unpublished' | 'suspended';
  
  // Template-driven attributes
  attributes: Record<string, any>;
  
  // Pricing
  pricingModel: PricingModel;
  fees: Fee[];
  discounts?: Discount[];
  
  // Policies
  cancellationPolicy: CancellationPolicy;
  depositPolicy: DepositPolicy;
  houseRules?: string[];
  
  // Media
  media: ListingMedia[];
  
  // Availability
  availability: AvailabilityRule[];
  blackoutDates: Date[];
  
  createdAt: DateTime;
  publishedAt?: DateTime;
}

interface ListingMedia {
  id: UUID;
  listingId: UUID;
  url: string;
  type: 'image' | 'video';
  order: number;
  moderationStatus: 'pending' | 'approved' | 'rejected';
}
```

### 4. Availability & Pricing
```typescript
// src/modules/availability/
interface AvailabilityRule {
  listingId: UUID;
  dateRange: DateRange;
  availableUnits: number; // For quantity-based items
  minDuration: number;
  maxDuration: number;
  leadTimeHours: number;
  noticeTimeHours: number;
}

interface PricingModel {
  type: 'per_night' | 'per_day' | 'per_hour' | 'per_event' | 'package';
  baseAmount: Money;
  currency: string;
  
  // Category-specific
  mileageRules?: MileageRule[];
  cleaningFee?: Money;
  securityDeposit?: Money;
  
  // Discounts
  weeklyDiscount?: Percentage;
  monthlyDiscount?: Percentage;
}

interface Quote {
  id: UUID;
  listingId: UUID;
  renterId: UUID;
  dateRange: DateRange;
  quantity: number;
  
  lineItems: LineItem[];
  subtotal: Money;
  total: Money;
  deposit: Money;
  
  expiresAt: DateTime;
  snapshot: BookingAgreementSnapshot;
}

interface LineItem {
  type: 'rental' | 'platform_fee' | 'cleaning_fee' | 'deposit' | 'tax' | 'discount';
  description: string;
  amount: Money;
  metadata?: Record<string, any>;
}
```

### 5. Booking Engine
```typescript
// src/modules/bookings/
interface Booking {
  id: UUID;
  listingId: UUID;
  renterId: UUID;
  ownerId: UUID;
  
  status: BookingStatus;
  statusHistory: BookingStateTransition[];
  
  dateRange: DateRange;
  quantity: number;
  
  // Financial
  quoteSnapshot: Quote;
  paymentIntentId?: string;
  depositHoldId?: string;
  
  // Fulfillment
  fulfillmentMethod: FulfillmentMethod;
  checkInDetails?: CheckInDetails;
  checkOutDetails?: CheckOutDetails;
  
  // Legal
  agreementSnapshot: BookingAgreementSnapshot;
  termsAcceptedAt: DateTime;
  
  createdAt: DateTime;
  confirmedAt?: DateTime;
  completedAt?: DateTime;
}

type BookingStatus = 
  | 'draft'
  | 'pending_owner_approval'
  | 'pending_payment'
  | 'confirmed'
  | 'in_progress'
  | 'awaiting_return_inspection'
  | 'completed'
  | 'settled'
  | 'cancelled'
  | 'disputed'
  | 'refunded';

interface BookingStateTransition {
  from: BookingStatus;
  to: BookingStatus;
  triggeredBy: 'system' | 'renter' | 'owner' | 'admin';
  reason?: string;
  metadata?: Record<string, any>;
  timestamp: DateTime;
}
```

### 6. Payments & Ledger
```typescript
// src/modules/payments/
interface PaymentIntent {
  id: UUID;
  bookingId: UUID;
  amount: Money;
  status: 'requires_payment_method' | 'requires_confirmation' | 'succeeded' | 'canceled';
  paymentMethodId?: string;
  clientSecret?: string;
  metadata: Record<string, any>;
}

interface DepositHold {
  id: UUID;
  bookingId: UUID;
  amount: Money;
  status: 'authorized' | 'released' | 'captured' | 'partially_captured';
  authorizationId: string;
  releasePolicy: DepositReleasePolicy;
  releasedAt?: DateTime;
  capturedAt?: DateTime;
}

interface LedgerEntry {
  id: UUID;
  bookingId: UUID;
  type: LedgerEntryType;
  amount: Money;
  currency: string;
  description: string;
  metadata: Record<string, any>;
  createdAt: DateTime;
  
  // For reconciliation
  externalId?: string;
  externalType?: 'charge' | 'refund' | 'payout';
  reconciled: boolean;
}

type LedgerEntryType = 
  | 'charge'
  | 'refund'
  | 'platform_fee'
  | 'owner_payout'
  | 'deposit_hold'
  | 'deposit_release'
  | 'deposit_capture'
  | 'adjustment';
```

### 7. Fulfillment & Condition Reports
```typescript
// src/modules/fulfillment/
interface ConditionReport {
  id: UUID;
  bookingId: UUID;
  type: 'check_in' | 'check_out';
  status: 'draft' | 'submitted' | 'confirmed';
  
  checklist: ChecklistResponse[];
  evidence: EvidenceAttachment[];
  
  submittedBy: UUID; // user ID
  submittedAt?: DateTime;
  confirmedBy?: UUID; // user ID (other party)
  confirmedAt?: DateTime;
}

interface ChecklistTemplate {
  id: UUID;
  category: CategoryType;
  stage: 'check_in' | 'check_out';
  items: ChecklistItem[];
}

interface ChecklistItem {
  id: UUID;
  label: string;
  type: 'boolean' | 'text' | 'photo' | 'number';
  required: boolean;
  categorySpecific?: Record<string, any>;
}

interface EvidenceAttachment {
  id: UUID;
  type: 'photo' | 'video' | 'document';
  url: string;
  uploadedAt: DateTime;
  uploadedBy: UUID;
  metadata: {
    coordinates?: GeoCoordinates;
    timestamp?: DateTime;
    deviceInfo?: string;
  };
}
```

### 8. Messaging
```typescript
// src/modules/messaging/
interface MessageThread {
  id: UUID;
  type: 'booking' | 'inquiry' | 'dispute';
  bookingId?: UUID;
  participantIds: UUID[];
  lastMessageAt: DateTime;
  createdAt: DateTime;
}

interface Message {
  id: UUID;
  threadId: UUID;
  senderId: UUID;
  content: string;
  attachments: MessageAttachment[];
  
  // Privacy
  maskedContactInfo: boolean;
  
  status: 'sent' | 'delivered' | 'read';
  createdAt: DateTime;
  readAt?: DateTime;
}

interface MessageAttachment {
  type: 'image' | 'document' | 'evidence';
  url: string;
  filename: string;
}
```

### 9. Reviews & Reputation
```typescript
// src/modules/reviews/
interface Review {
  id: UUID;
  bookingId: UUID;
  reviewerId: UUID; // who wrote the review
  targetId: UUID;   // who/what is being reviewed (user or listing)
  targetType: 'user' | 'listing';
  
  rating: number; // 1-5
  tags: ReviewTag[];
  comment?: string;
  
  status: 'pending' | 'published' | 'flagged' | 'removed';
  createdAt: DateTime;
  publishedAt?: DateTime;
}

interface ReviewTag {
  category: CategoryType;
  tag: string; // e.g., 'clean', 'responsive', 'accurate_description'
}
```

### 10. Disputes
```typescript
// src/modules/disputes/
interface Dispute {
  id: UUID;
  bookingId: UUID;
  initiatorId: UUID; // renter or owner
  reason: DisputeReason;
  category: DisputeCategory;
  
  status: 'open' | 'under_review' | 'resolved' | 'escalated';
  
  evidenceBundle: DisputeEvidenceBundle;
  timeline: DisputeEvent[];
  
  sla: {
    responseDueBy: DateTime;
    resolutionDueBy: DateTime;
  };
  
  outcome?: DisputeOutcome;
  resolvedAt?: DateTime;
  
  createdAt: DateTime;
}

interface DisputeEvidenceBundle {
  messages: Message[];
  conditionReports: ConditionReport[];
  agreementSnapshot: BookingAgreementSnapshot;
  paymentRecords: LedgerEntry[];
  additionalEvidence: EvidenceAttachment[];
}

interface DisputeOutcome {
  decision: 'refund_renter' | 'charge_renter' | 'split' | 'dismissed';
  amount: Money;
  description: string;
  decidedBy: UUID; // admin ID
  decidedAt: DateTime;
}
```

### 11. Admin & Policy Engine
```typescript
// src/modules/admin/
interface AdminUser {
  id: UUID;
  email: string;
  roles: AdminRole[];
  permissions: Permission[];
  lastLoginAt?: DateTime;
}

type AdminRole = 'support' | 'moderator' | 'finance' | 'super_admin';

interface PolicyRule {
  id: UUID;
  type: 'fee' | 'deposit' | 'cancellation' | 'verification';
  category?: CategoryType;
  condition: PolicyCondition;
  action: PolicyAction;
  priority: number;
  enabled: boolean;
  createdAt: DateTime;
  updatedAt: DateTime;
}

interface AuditLog {
  id: UUID;
  action: string;
  actorId: UUID;
  actorType: 'user' | 'admin' | 'system';
  resourceType: string;
  resourceId: UUID;
  changes: Record<string, { old: any; new: any }>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: DateTime;
}
```

### 12. Search & Discovery
```typescript
// src/modules/search/
interface SearchCriteria {
  category: CategoryType;
  location?: GeoCoordinates;
  dateRange?: DateRange;
  filters: SearchFilter[];
  sortBy: 'price' | 'distance' | 'rating' | 'availability';
  sortOrder: 'asc' | 'desc';
  pagination: {
    limit: number;
    offset: number;
  };
}

interface SearchFilter {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'between';
  value: any;
}

interface SearchIndexDocument {
  listingId: UUID;
  category: CategoryType;
  attributes: Record<string, any>;
  location?: GeoCoordinates;
  availability: AvailabilityWindow[];
  pricing: PricingSummary;
  trustMetrics: TrustMetrics;
  lastUpdated: DateTime;
}
```

## API Layer Contracts

### 1. REST API Structure
```typescript
// src/api/routes/
interface APIRoutes {
  // Auth
  '/auth': {
    POST: {
      '/login': LoginRequest → LoginResponse;
      '/register': RegisterRequest → RegisterResponse;
      '/refresh': RefreshRequest → RefreshResponse;
    };
  };
  
  // Users
  '/users': {
    GET: {
      '/me': → UserProfile;
      '/:id': → PublicUserProfile;
    };
    PUT: {
      '/me': UpdateProfileRequest → UserProfile;
    };
  };
  
  // Listings
  '/listings': {
    GET: {
      '/': SearchListingsRequest → Paginated<Listings>;
      '/:id': → ListingDetail;
    };
    POST: {
      '/': CreateListingRequest → Listing;
    };
    PUT: {
      '/:id': UpdateListingRequest → Listing;
      '/:id/publish': → Listing;
    };
  };
  
  // Bookings
  '/bookings': {
    GET: {
      '/': GetBookingsRequest → Paginated<Booking>;
      '/:id': → BookingDetail;
    };
    POST: {
      '/': CreateBookingRequest → Booking;
      '/:id/confirm': → Booking;
      '/:id/cancel': CancelBookingRequest → Booking;
    };
  };
  
  // Payments
  '/payments': {
    POST: {
      '/intents': CreatePaymentIntentRequest → PaymentIntent;
      '/:id/confirm': ConfirmPaymentRequest → PaymentIntent;
    };
  };
  
  // Messages
  '/messages': {
    GET: {
      '/threads': → Thread[];
      '/threads/:id/messages': → Paginated<Message>;
    };
    POST: {
      '/threads/:id/messages': SendMessageRequest → Message;
    };
  };
  
  // Admin
  '/admin': {
    GET: {
      '/users': AdminSearchUsersRequest → Paginated<AdminUserView>;
      '/listings/moderation': → Paginated<ListingModerationItem>;
      '/disputes': → Paginated<Dispute>;
    };
    PUT: {
      '/listings/:id/status': UpdateListingStatusRequest → Listing;
      '/disputes/:id/resolve': ResolveDisputeRequest → Dispute;
    };
  };
}
```

### 2. Webhook Handlers
```typescript
// src/infrastructure/webhooks/
interface WebhookEvents {
  'payment.succeeded': PaymentSucceededEvent;
  'payment.failed': PaymentFailedEvent;
  'deposit.hold.created': DepositHoldCreatedEvent;
  'deposit.hold.released': DepositHoldReleasedEvent;
  'booking.status_changed': BookingStatusChangedEvent;
  'dispute.created': DisputeCreatedEvent;
}
```

## Infrastructure Interfaces

### 1. External Service Adapters
```typescript
// src/infrastructure/services/
interface PaymentProvider {
  createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntentResult>;
  createDepositHold(params: CreateDepositHoldParams): Promise<DepositHoldResult>;
  refundPayment(params: RefundPaymentParams): Promise<RefundResult>;
  payoutToOwner(params: PayoutParams): Promise<PayoutResult>;
}

interface StorageProvider {
  uploadFile(file: Buffer, options: UploadOptions): Promise<FileMetadata>;
  generateSignedUrl(fileId: string, expiresIn: number): Promise<string>;
  deleteFile(fileId: string): Promise<void>;
}

interface NotificationService {
  sendEmail(template: EmailTemplate, recipient: string, data: any): Promise<void>;
  sendSMS(phone: string, message: string): Promise<void>;
  sendPushNotification(userId: UUID, notification: PushNotification): Promise<void>;
}

interface SearchService {
  indexDocument(index: string, document: SearchIndexDocument): Promise<void>;
  search(index: string, query: SearchQuery): Promise<SearchResults>;
  deleteDocument(index: string, documentId: string): Promise<void>;
}
```

### 2. Job Queues
```typescript
// src/infrastructure/queues/
interface JobQueue {
  enqueue(job: Job): Promise<string>;
  process(queue: string, handler: JobHandler): void;
  retryFailed(jobId: string): Promise<void>;
}

interface JobTypes {
  'send-notification': NotificationJob;
  'process-webhook': WebhookJob;
  'generate-invoice': InvoiceJob;
  'reconcile-payments': ReconciliationJob;
  'cleanup-expired': CleanupJob;
}
```

## Shared Types & Utilities

### 1. Type Definitions
```typescript
// src/shared/types/
type UUID = string;
type DateTime = string; // ISO 8601
type Money = {
  amount: number;
  currency: string; // ISO 4217
};

type DateRange = {
  start: DateTime;
  end: DateTime;
};

type GeoCoordinates = {
  lat: number;
  lng: number;
};

type Percentage = number; // 0-100

interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  hasPrevious: boolean;
}
```

### 2. Validation Schemas
```typescript
// src/shared/validation/
const schemas = {
  user: z.object({/* ... */}),
  listing: z.object({/* ... */}),
  booking: z.object({/* ... */}),
  payment: z.object({/* ... */}),
} as const;
```

### 3. Error Types
```typescript
// src/shared/errors/
class ApplicationError extends Error {
  code: string;
  statusCode: number;
  details?: any;
}

class ValidationError extends ApplicationError { /* ... */ }
class AuthorizationError extends ApplicationError { /* ... */ }
class NotFoundError extends ApplicationError { /* ... */ }
class ConflictError extends ApplicationError { /* ... */ }
class PaymentError extends ApplicationError { /* ... */ }
```

## Database Schema Outline

### 1. Main Tables
```sql
-- Users
users (id, email, phone, verification_tier, status, created_at, updated_at)
profiles (user_id, first_name, last_name, avatar_url, trust_score)
verifications (user_id, type, status, verified_at, metadata)

-- Categories
category_templates (id, name, version, schema, created_at, updated_at)
category_attributes (category, required_fields, optional_fields)

-- Listings
listings (id, owner_id, category, template_version, status, attributes_json, ...)
listing_media (id, listing_id, url, type, order, moderation_status)
availability_rules (listing_id, date_range, available_units, ...)

-- Bookings
bookings (id, listing_id, renter_id, owner_id, status, date_range, ...)
booking_state_history (booking_id, from_status, to_status, triggered_by, ...)

-- Payments
payment_intents (id, booking_id, amount, status, ...)
deposit_holds (id, booking_id, amount, status, ...)
ledger_entries (id, booking_id, type, amount, description, ...)

-- Fulfillment
condition_reports (id, booking_id, type, status, ...)
checklist_responses (report_id, item_id, value, evidence_urls)
evidence_attachments (id, report_id, type, url, metadata_json)

-- Messaging
message_threads (id, type, booking_id, ...)
messages (id, thread_id, sender_id, content, ...)

-- Reviews
reviews (id, booking_id, reviewer_id, target_id, target_type, rating, ...)

-- Disputes
disputes (id, booking_id, initiator_id, reason, status, ...)
dispute_evidence (dispute_id, type, reference_id, ...)

-- Admin
admin_users (id, email, roles, permissions, ...)
audit_logs (id, action, actor_id, resource_type, resource_id, changes_json, ...)
policy_rules (id, type, category, condition_json, action_json, ...)
```

## Configuration Files

### 1. Environment Configuration
```typescript
// config/
interface AppConfig {
  environment: 'development' | 'staging' | 'production';
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
  };
  redis: {
    host: string;
    port: number;
  };
  payment: {
    provider: 'stripe' | 'paypal';
    secretKey: string;
    webhookSecret: string;
  };
  storage: {
    provider: 'aws' | 'gcp' | 'azure';
    bucket: string;
    region: string;
  };
  email: {
    provider: 'sendgrid' | 'ses' | 'mailgun';
    apiKey: string;
    fromAddress: string;
  };
  security: {
    jwtSecret: string;
    encryptionKey: string;
    rateLimit: {
      windowMs: number;
      maxRequests: number;
    };
  };
  features: {
    enableShipping: boolean;
    enableDelivery: boolean;
    requireVerification: boolean;
    autoApproveListings: boolean;
  };
}
```

### 2. Category Templates Configuration
```json
// config/categories/spaces.json
{
  "name": "spaces",
  "version": "1.0.0",
  "schema": {
    "type": "object",
    "required": ["spaceType", "capacity", "bedrooms", "bathrooms"],
    "properties": {
      "spaceType": {
        "type": "string",
        "enum": ["entire_home", "private_room", "shared_room"]
      },
      "capacity": { "type": "integer", "minimum": 1 },
      "bedrooms": { "type": "integer", "minimum": 0 },
      "bathrooms": { "type": "number", "minimum": 0 },
      "amenities": {
        "type": "array",
        "items": { "type": "string" }
      }
    }
  },
  "pricingUnits": ["per_night"],
  "defaultPolicies": {
    "cancellation": "flexible",
    "deposit": {
      "type": "percentage",
      "value": 20,
      "minimum": 100,
      "maximum": 1000
    }
  }
}
```

## Test Structure

```typescript
// tests/
├── unit/
│   ├── core/
│   │   ├── booking-state-machine.test.ts
│   │   └── pricing-engine.test.ts
│   └── modules/
│       ├── listings/
│       └── payments/
├── integration/
│   ├── booking-flow.test.ts
│   ├── payment-flow.test.ts
│   └── dispute-flow.test.ts
├── e2e/
│   ├── renter-journey.test.ts
│   └── owner-journey.test.ts
└── fixtures/
    ├── test-data.ts
    └── factories.ts
```

## Deployment Artifacts

### 1. Docker Configuration
```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### 2. Infrastructure as Code
```hcl
# terraform/
resource "aws_rds_cluster" "database" {
  cluster_identifier = "rental-portal-db"
  engine            = "aurora-postgresql"
  # ...
}

resource "aws_ecs_cluster" "api" {
  name = "api-cluster"
  # ...
}

resource "aws_s3_bucket" "media" {
  bucket = "rental-portal-media"
  # ...
}
```

This skeleton provides a complete interface-level blueprint for the Universal Rental Portal, covering all domains, modules, and integration points without implementation details. Each interface can be implemented according to the specific technology stack chosen.