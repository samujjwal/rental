# Universal Rental Portal — Execution Plan Part 5: Infrastructure & Operations

**Document:** Part 5 of 5 - Production Infrastructure, Testing & Deployment  
**Related:** Parts 1-4  
**Last Updated:** January 23, 2026

---

## 📋 Table of Contents

- [Universal Rental Portal — Execution Plan Part 5: Infrastructure \& Operations](#universal-rental-portal--execution-plan-part-5-infrastructure--operations)
  - [📋 Table of Contents](#-table-of-contents)
  - [Database Schema (Prisma)](#database-schema-prisma)
    - [Complete Prisma Schema](#complete-prisma-schema)
  - [Caching Strategy](#caching-strategy)
    - [Redis Caching Patterns](#redis-caching-patterns)
  - [Background Jobs \& Queue Management](#background-jobs--queue-management)
    - [BullMQ Job Processing](#bullmq-job-processing)
    - [Scheduled Jobs (Cron)](#scheduled-jobs-cron)
  - [6. Testing Strategy](#6-testing-strategy)
    - [6.1 Unit Testing with Jest](#61-unit-testing-with-jest)
    - [6.2 Integration Testing with Supertest](#62-integration-testing-with-supertest)
    - [6.3 E2E Testing with Playwright](#63-e2e-testing-with-playwright)
    - [6.4 Performance Testing with k6](#64-performance-testing-with-k6)
    - [6.5 Security Testing Checklist](#65-security-testing-checklist)

---

## Database Schema (Prisma)

### Complete Prisma Schema

```prisma
// packages/database/prisma/schema.prisma

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["fullTextSearch", "postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pgvector(map: "vector")]
}

// ==================== Users & Authentication ====================

model User {
  id                    String    @id @default(uuid())
  email                 String    @unique
  emailVerified         Boolean   @default(false)
  emailVerificationToken String?  @unique
  emailVerificationExpires DateTime?

  passwordHash          String
  passwordSalt          String
  passwordUpdatedAt     DateTime  @default(now())

  name                  String
  avatar                String?
  bio                   String?   @db.Text
  phone                 String?
  phoneVerified         Boolean   @default(false)

  dateOfBirth           DateTime?
  governmentIdType      String?
  governmentIdNumber    String?
  governmentIdVerified  Boolean   @default(false)

  address               Json?
  timezone              String    @default("UTC")
  locale                String    @default("en-US")
  currency              String    @default("USD")

  role                  UserRole  @default(CUSTOMER)
  status                UserStatus @default(ACTIVE)

  stripeCustomerId      String?   @unique
  stripeAccountId       String?   @unique
  stripeOnboardingComplete Boolean @default(false)

  pushTokens            String[]
  notificationPreferences Json?

  averageRating         Float     @default(0)
  totalReviews          Int       @default(0)
  responseRate          Float     @default(0)
  responseTimeMinutes   Int       @default(0)

  verified              Boolean   @default(false)
  superhost             Boolean   @default(false)

  lastLoginAt           DateTime?
  lastLoginIp           String?
  loginCount            Int       @default(0)

  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  deletedAt             DateTime?

  // Relations
  listings              Listing[]
  bookingsAsRenter      Booking[] @relation("RenterBookings")
  bookingsAsOwner       Booking[] @relation("OwnerBookings")
  reviews               Review[]  @relation("ReviewsGiven")
  reviewsReceived       Review[]  @relation("ReviewsReceived")
  messages              Message[]
  conversationParticipants ConversationParticipant[]
  disputes              Dispute[] @relation("DisputeInitiator")
  disputesAsRespondent  Dispute[] @relation("DisputeRespondent")

  @@index([email])
  @@index([stripeCustomerId])
  @@index([stripeAccountId])
  @@index([status])
  @@index([role])
  @@map("users")
}

enum UserRole {
  CUSTOMER
  ADMIN
  MODERATOR
  SUPPORT
}

enum UserStatus {
  ACTIVE
  SUSPENDED
  BANNED
  DELETED
}

model Session {
  id           String   @id @default(uuid())
  userId       String
  token        String   @unique
  refreshToken String   @unique
  expiresAt    DateTime
  createdAt    DateTime @default(now())
  lastUsedAt   DateTime @default(now())
  ipAddress    String
  userAgent    String

  @@index([userId])
  @@index([token])
  @@index([expiresAt])
  @@map("sessions")
}

// ==================== Categories & Templates ====================

model Category {
  id              String   @id @default(uuid())
  name            String   @unique
  slug            String   @unique
  description     String?  @db.Text
  icon            String?
  sortOrder       Int      @default(0)
  active          Boolean  @default(true)

  templateSchema  Json
  validationRules Json

  requiresCheckinReport  Boolean @default(true)
  requiresCheckoutReport Boolean @default(true)
  inspectionWindowHours  Int     @default(48)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  listings        Listing[]

  @@map("categories")
}

// ==================== Listings ====================

model Listing {
  id              String    @id @default(uuid())
  ownerId         String
  owner           User      @relation(fields: [ownerId], references: [id])

  categoryId      String
  category        Category  @relation(fields: [categoryId], references: [id])

  title           String
  description     String    @db.Text
  images          String[]
  videos          String[]

  address         Json
  location        Json      // { lat, lon, formatted, city, state, country, postalCode }

  bookingMode     BookingMode @default(REQUEST_TO_BOOK)
  instantBook     Boolean   @default(false)

  basePriceAmount Int
  priceCurrency   String    @default("USD")
  pricingMode     PricingMode @default(PER_DAY)

  pricing         Json      // { perHour, perDay, perWeek, perMonth }
  discounts       Json?     // { weekly, monthly }

  minimumBookingDuration Int @default(1)
  maximumBookingDuration Int?
  advanceNoticeHours     Int @default(24)

  capacity        Int?
  quantity        Int       @default(1)

  amenities       String[]
  rules           String[]

  cancellationPolicyId String?
  cancellationPolicy   CancellationPolicy? @relation(fields: [cancellationPolicyId], references: [id])

  requiresDeposit Boolean   @default(false)
  depositAmount   Int?

  categoryData    Json      // Category-specific fields

  status          ListingStatus @default(DRAFT)
  verified        Boolean   @default(false)
  featured        Boolean   @default(false)

  averageRating   Float     @default(0)
  reviewCount     Int       @default(0)
  totalBookings   Int       @default(0)

  viewCount       Int       @default(0)
  favoriteCount   Int       @default(0)

  lastBookedAt    DateTime?

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  publishedAt     DateTime?
  deletedAt       DateTime?

  bookings        Booking[]
  reviews         Review[]
  availability    Availability[]

  @@index([ownerId])
  @@index([categoryId])
  @@index([status])
  @@index([verified])
  @@index([featured])
  @@fulltext([title, description])
  @@map("listings")
}

enum BookingMode {
  INSTANT_BOOK
  REQUEST_TO_BOOK
}

enum PricingMode {
  PER_HOUR
  PER_DAY
  PER_WEEK
  PER_MONTH
  CUSTOM
}

enum ListingStatus {
  DRAFT
  PENDING_REVIEW
  ACTIVE
  INACTIVE
  SUSPENDED
  REJECTED
}

model CancellationPolicy {
  id          String   @id @default(uuid())
  name        String
  type        CancellationPolicyType
  description String   @db.Text
  rules       Json

  listings    Listing[]

  @@map("cancellation_policies")
}

enum CancellationPolicyType {
  FLEXIBLE
  MODERATE
  STRICT
  NON_REFUNDABLE
}

model Availability {
  id          String   @id @default(uuid())
  listingId   String
  listing     Listing  @relation(fields: [listingId], references: [id], onDelete: Cascade)

  date        DateTime @db.Date
  available   Boolean  @default(true)
  quantity    Int      @default(1)
  priceOverride Int?

  @@unique([listingId, date])
  @@index([listingId, date])
  @@map("availability")
}

// ==================== Bookings ====================

model Booking {
  id              String        @id @default(uuid())

  listingId       String
  listing         Listing       @relation(fields: [listingId], references: [id])

  renterId        String
  renter          User          @relation("RenterBookings", fields: [renterId], references: [id])

  ownerId         String
  owner           User          @relation("OwnerBookings", fields: [ownerId], references: [id])

  status          BookingStatus @default(DRAFT)

  startDate       DateTime
  endDate         DateTime
  quantity        Int           @default(1)
  guestCount      Int?

  dateRange       Json          // { start, end }

  quoteSnapshot   Json          // Complete price breakdown at booking time
  agreementSnapshot Json?       // Terms accepted at booking time

  fulfillmentMethod String?     // pickup, delivery, in-person, etc.
  fulfillmentAddress Json?
  specialRequests String?       @db.Text

  paymentIntentId String?       @unique
  depositHoldId   String?       @unique
  payoutId        String?       @unique

  ownerApprovedAt DateTime?
  ownerApprovedBy String?

  inspectionStartedAt DateTime?
  completedAt     DateTime?
  settledAt       DateTime?

  expiresAt       DateTime?

  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  // Relations
  stateHistory    BookingStateHistory[]
  conditionReports ConditionReport[]
  disputes        Dispute[]
  reviews         Review[]
  conversations   Conversation[]
  ledgerEntries   LedgerEntry[]

  @@index([renterId])
  @@index([ownerId])
  @@index([listingId])
  @@index([status])
  @@index([startDate])
  @@index([endDate])
  @@map("bookings")
}

enum BookingStatus {
  DRAFT
  PENDING_OWNER_APPROVAL
  PENDING_PAYMENT
  CONFIRMED
  IN_PROGRESS
  AWAITING_RETURN_INSPECTION
  COMPLETED
  SETTLED
  CANCELLED
  DISPUTED
  REFUNDED
}

model BookingStateHistory {
  id          String   @id @default(uuid())
  bookingId   String
  booking     Booking  @relation(fields: [bookingId], references: [id], onDelete: Cascade)

  fromStatus  BookingStatus
  toStatus    BookingStatus

  triggeredBy String   // user, owner, admin, system
  triggeredById String?

  reason      String?  @db.Text
  metadata    Json?

  timestamp   DateTime @default(now())

  @@index([bookingId])
  @@map("booking_state_history")
}

// ==================== Payments & Ledger ====================

model LedgerEntry {
  id          String   @id @default(uuid())
  bookingId   String?
  booking     Booking? @relation(fields: [bookingId], references: [id])

  account     String   // assets.cash, liabilities.owners, revenue.platform_fee, etc.
  side        LedgerSide

  amount      Int
  currency    String   @default("USD")

  description String   @db.Text

  externalId  String?  // Stripe transaction ID
  externalType String? // payment_intent, refund, payout, etc.

  metadata    Json?

  createdAt   DateTime @default(now())

  @@index([bookingId])
  @@index([account])
  @@index([createdAt])
  @@map("ledger_entries")
}

enum LedgerSide {
  DEBIT
  CREDIT
}

model DepositHold {
  id                    String   @id
  bookingId             String   @unique

  amount                Int
  currency              String   @default("USD")

  status                DepositStatus @default(AUTHORIZED)

  stripePaymentIntentId String   @unique

  capturedAmount        Int?
  capturedAt            DateTime?

  releasedAt            DateTime?
  expiresAt             DateTime

  createdAt             DateTime @default(now())

  @@map("deposit_holds")
}

enum DepositStatus {
  AUTHORIZED
  CAPTURED
  PARTIALLY_CAPTURED
  RELEASED
  EXPIRED
}

model Refund {
  id              String   @id
  bookingId       String
  paymentIntentId String

  amount          Int
  currency        String   @default("USD")

  reason          String   @db.Text
  status          String

  stripeRefundId  String   @unique

  createdAt       DateTime @default(now())

  @@index([bookingId])
  @@map("refunds")
}

model Payout {
  id              String   @id
  bookingId       String
  ownerId         String

  amount          Int
  currency        String   @default("USD")

  status          String   @default("pending")

  stripeTransferId String  @unique

  paidAt          DateTime?

  createdAt       DateTime @default(now())

  @@index([bookingId])
  @@index([ownerId])
  @@map("payouts")
}

// ==================== Reviews ====================

model Review {
  id          String   @id @default(uuid())

  bookingId   String
  booking     Booking  @relation(fields: [bookingId], references: [id])

  listingId   String
  listing     Listing  @relation(fields: [listingId], references: [id])

  reviewerId  String
  reviewer    User     @relation("ReviewsGiven", fields: [reviewerId], references: [id])

  revieweeId  String
  reviewee    User     @relation("ReviewsReceived", fields: [revieweeId], references: [id])

  type        ReviewType // listing_review, user_review

  rating      Int      // 1-5
  comment     String?  @db.Text

  categoryRatings Json? // { cleanliness: 5, communication: 4, ... }

  isPublic    Boolean  @default(true)
  flagged     Boolean  @default(false)
  flagReason  String?

  response    String?  @db.Text
  respondedAt DateTime?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([bookingId, reviewerId])
  @@index([listingId])
  @@index([reviewerId])
  @@index([revieweeId])
  @@map("reviews")
}

enum ReviewType {
  LISTING_REVIEW
  USER_REVIEW
}

// ==================== Messaging ====================

model Conversation {
  id              String   @id @default(uuid())

  bookingId       String?
  booking         Booking? @relation(fields: [bookingId], references: [id])

  type            ConversationType @default(BOOKING)

  lastMessageAt   DateTime?
  lastMessagePreview String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  participants    ConversationParticipant[]
  messages        Message[]

  @@index([bookingId])
  @@map("conversations")
}

enum ConversationType {
  BOOKING
  SUPPORT
  GENERAL
}

model ConversationParticipant {
  id             String   @id @default(uuid())

  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  userId         String
  user           User     @relation(fields: [userId], references: [id])

  role           String   @default("member")

  unreadCount    Int      @default(0)
  lastReadAt     DateTime?

  joinedAt       DateTime @default(now())
  leftAt         DateTime?

  @@unique([conversationId, userId])
  @@index([userId])
  @@map("conversation_participants")
}

model Message {
  id             String   @id @default(uuid())

  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  senderId       String
  sender         User     @relation(fields: [senderId], references: [id])

  content        String   @db.Text
  type           MessageType @default(TEXT)

  attachments    Json?
  metadata       Json?

  edited         Boolean  @default(false)
  editedAt       DateTime?

  deleted        Boolean  @default(false)
  deletedAt      DateTime?

  createdAt      DateTime @default(now())

  readReceipts   MessageReadReceipt[]

  @@index([conversationId])
  @@index([senderId])
  @@index([createdAt])
  @@map("messages")
}

enum MessageType {
  TEXT
  IMAGE
  VIDEO
  FILE
  SYSTEM
}

model MessageReadReceipt {
  id        String   @id @default(uuid())
  messageId String
  message   Message  @relation(fields: [messageId], references: [id], onDelete: Cascade)

  userId    String
  readAt    DateTime @default(now())

  @@unique([messageId, userId])
  @@map("message_read_receipts")
}

// ==================== Condition Reports ====================

model ConditionReport {
  id          String   @id @default(uuid())

  bookingId   String
  booking     Booking  @relation(fields: [bookingId], references: [id])

  reportType  ReportType
  reportedBy  String

  checklist   Json     // Array of checklist items with status

  status      ReportStatus @default(IN_PROGRESS)

  submittedAt DateTime?
  confirmedBy String?
  confirmedAt DateTime?
  confirmationNotes String? @db.Text

  disputedBy  String?
  disputedAt  DateTime?
  disputeReason String? @db.Text
  disputeEvidence Json?

  dueDate     DateTime

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  photos      ReportPhoto[]

  @@index([bookingId])
  @@map("condition_reports")
}

enum ReportType {
  CHECK_IN
  CHECK_OUT
}

enum ReportStatus {
  IN_PROGRESS
  SUBMITTED
  CONFIRMED
  DISPUTED
}

model ReportPhoto {
  id          String   @id @default(uuid())

  reportId    String
  report      ConditionReport @relation(fields: [reportId], references: [id], onDelete: Cascade)

  url         String
  thumbnailUrl String?

  itemId      String   // Which checklist item this photo belongs to
  caption     String?

  uploadedBy  String

  metadata    Json?    // originalName, size, dimensions, etc.

  createdAt   DateTime @default(now())

  @@index([reportId])
  @@map("report_photos")
}

// ==================== Disputes ====================

model Dispute {
  id            String   @id @default(uuid())

  bookingId     String
  booking       Booking  @relation(fields: [bookingId], references: [id])

  initiatedBy   String
  initiator     User     @relation("DisputeInitiator", fields: [initiatedBy], references: [id])

  respondent    String
  respondentUser User    @relation("DisputeRespondent", fields: [respondent], references: [id])

  type          DisputeType
  category      String?
  description   String   @db.Text

  claimedAmount Int?

  evidence      Json?

  status        DisputeStatus @default(OPEN)
  priority      DisputePriority @default(MEDIUM)

  assignedTo    String?
  assignedAt    DateTime?

  resolution    String?
  resolvedBy    String?
  resolvedAt    DateTime?

  respondedAt   DateTime?
  informationRequestedAt DateTime?

  slaDeadline   DateTime

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  responses     DisputeResponse[]
  evidenceItems DisputeEvidence[]
  timeline      DisputeTimelineEvent[]
  resolutions   DisputeResolution[]

  @@index([bookingId])
  @@index([status])
  @@index([assignedTo])
  @@map("disputes")
}

enum DisputeType {
  PROPERTY_DAMAGE
  PAYMENT_ISSUE
  CANCELLATION_DISPUTE
  SERVICE_QUALITY
  SAFETY_CONCERN
  OTHER
}

enum DisputeStatus {
  OPEN
  UNDER_REVIEW
  IN_REVIEW
  PENDING_INFORMATION
  RESOLVED
  CLOSED
}

enum DisputePriority {
  CRITICAL
  HIGH
  MEDIUM
  LOW
}

model DisputeResponse {
  id          String   @id @default(uuid())
  disputeId   String
  dispute     Dispute  @relation(fields: [disputeId], references: [id], onDelete: Cascade)

  respondedBy String
  response    String   @db.Text
  counterOffer Int?
  evidence    Json?

  createdAt   DateTime @default(now())

  @@index([disputeId])
  @@map("dispute_responses")
}

model DisputeEvidence {
  id          String   @id @default(uuid())
  disputeId   String
  dispute     Dispute  @relation(fields: [disputeId], references: [id], onDelete: Cascade)

  uploadedBy  String
  type        String
  description String?  @db.Text
  files       Json     // Array of file objects
  metadata    Json?

  createdAt   DateTime @default(now())

  @@index([disputeId])
  @@map("dispute_evidence")
}

model DisputeTimelineEvent {
  id          String   @id @default(uuid())
  disputeId   String
  dispute     Dispute  @relation(fields: [disputeId], references: [id], onDelete: Cascade)

  type        String
  actor       String
  description String   @db.Text
  metadata    Json?

  timestamp   DateTime @default(now())

  @@index([disputeId])
  @@map("dispute_timeline_events")
}

model DisputeResolution {
  id          String   @id @default(uuid())
  disputeId   String
  dispute     Dispute  @relation(fields: [disputeId], references: [id], onDelete: Cascade)

  resolvedBy  String
  outcome     String
  reasoning   String   @db.Text

  financialAdjustment Boolean  @default(false)
  refundAmount        Int?
  penaltyAmount       Int?

  notes       String?  @db.Text

  resolvedAt  DateTime @default(now())

  @@index([disputeId])
  @@map("dispute_resolutions")
}

// ==================== Audit Logs ====================

model AuditLog {
  id          String   @id @default(uuid())

  action      String
  resource    String
  resourceId  String?

  userId      String?
  ipAddress   String?
  userAgent   String?

  changes     Json?
  metadata    Json?

  timestamp   DateTime @default(now())

  @@index([userId])
  @@index([resource, resourceId])
  @@index([timestamp])
  @@map("audit_logs")
}
```

---

## Caching Strategy

### Redis Caching Patterns

```typescript
// apps/api/src/common/cache/cache.service.ts

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

@Injectable()
export class CacheService {
  private readonly redis: Redis;
  private readonly cluster: Redis.Cluster;

  constructor(private readonly config: ConfigService) {
    // Standalone Redis for development
    if (config.get("NODE_ENV") === "development") {
      this.redis = new Redis({
        host: config.get("REDIS_HOST"),
        port: config.get("REDIS_PORT"),
        password: config.get("REDIS_PASSWORD"),
        db: 0,
        keyPrefix: "rental:",
        retryStrategy: (times) => Math.min(times * 50, 2000),
      });
    } else {
      // Redis Cluster for production
      this.cluster = new Redis.Cluster(
        [
          { host: config.get("REDIS_NODE_1"), port: 6379 },
          { host: config.get("REDIS_NODE_2"), port: 6379 },
          { host: config.get("REDIS_NODE_3"), port: 6379 },
        ],
        {
          redisOptions: {
            password: config.get("REDIS_PASSWORD"),
            keyPrefix: "rental:",
          },
        },
      );
    }
  }

  private getClient(): Redis | Redis.Cluster {
    return this.cluster || this.redis;
  }

  // ==================== Basic Operations ====================

  async get<T>(key: string): Promise<T | null> {
    const value = await this.getClient().get(key);
    return value ? JSON.parse(value) : null;
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);

    if (ttlSeconds) {
      await this.getClient().setex(key, ttlSeconds, serialized);
    } else {
      await this.getClient().set(key, serialized);
    }
  }

  async del(key: string): Promise<void> {
    await this.getClient().del(key);
  }

  async delPattern(pattern: string): Promise<void> {
    const keys = await this.getClient().keys(pattern);
    if (keys.length > 0) {
      await this.getClient().del(...keys);
    }
  }

  // ==================== Cache Patterns ====================

  // Cache-aside pattern
  async cacheAside<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number = 3600,
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key);
    if (cached) {
      return cached;
    }

    // Fetch from source
    const data = await fetcher();

    // Store in cache
    await this.set(key, data, ttlSeconds);

    return data;
  }

  // Write-through pattern
  async writeThrough<T>(
    key: string,
    data: T,
    persister: () => Promise<void>,
    ttlSeconds?: number,
  ): Promise<void> {
    // Write to database first
    await persister();

    // Then update cache
    await this.set(key, data, ttlSeconds);
  }

  // Cache invalidation
  async invalidate(keys: string | string[]): Promise<void> {
    const keyArray = Array.isArray(keys) ? keys : [keys];
    if (keyArray.length > 0) {
      await this.getClient().del(...keyArray);
    }
  }

  // Pub/Sub for cache invalidation across instances
  async publishInvalidation(key: string): Promise<void> {
    await this.getClient().publish("cache:invalidate", key);
  }

  subscribeToInvalidations(handler: (key: string) => void): void {
    const subscriber = this.getClient().duplicate();
    subscriber.subscribe("cache:invalidate");
    subscriber.on("message", (channel, message) => {
      if (channel === "cache:invalidate") {
        handler(message);
      }
    });
  }

  // ==================== Specific Cache Methods ====================

  // User cache
  async cacheUser(
    userId: string,
    user: any,
    ttl: number = 3600,
  ): Promise<void> {
    await this.set(`user:${userId}`, user, ttl);
  }

  async getCachedUser(userId: string): Promise<any | null> {
    return await this.get(`user:${userId}`);
  }

  async invalidateUser(userId: string): Promise<void> {
    await this.del(`user:${userId}`);
  }

  // Listing cache
  async cacheListing(
    listingId: string,
    listing: any,
    ttl: number = 1800,
  ): Promise<void> {
    await this.set(`listing:${listingId}`, listing, ttl);
  }

  async getCachedListing(listingId: string): Promise<any | null> {
    return await this.get(`listing:${listingId}`);
  }

  async invalidateListing(listingId: string): Promise<void> {
    await this.del(`listing:${listingId}`);
    // Also invalidate related caches
    await this.delPattern(`search:*:listing:${listingId}`);
  }

  // Search results cache
  async cacheSearchResults(
    searchKey: string,
    results: any,
    ttl: number = 300,
  ): Promise<void> {
    await this.set(`search:${searchKey}`, results, ttl);
  }

  // Session cache
  async cacheSession(
    sessionId: string,
    session: any,
    ttl: number = 86400,
  ): Promise<void> {
    await this.set(`session:${sessionId}`, session, ttl);
  }

  // ==================== Rate Limiting ====================

  // Sliding window rate limit
  async checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    const client = this.getClient();
    const rateLimitKey = `ratelimit:${key}`;

    // Remove old entries
    await client.zremrangebyscore(rateLimitKey, 0, windowStart);

    // Count requests in window
    const count = await client.zcard(rateLimitKey);

    if (count >= limit) {
      const oldestEntry = await client.zrange(rateLimitKey, 0, 0, "WITHSCORES");
      const resetAt = new Date(parseInt(oldestEntry[1]) + windowSeconds * 1000);

      return {
        allowed: false,
        remaining: 0,
        resetAt,
      };
    }

    // Add current request
    await client.zadd(rateLimitKey, now, `${now}:${Math.random()}`);
    await client.expire(rateLimitKey, windowSeconds);

    return {
      allowed: true,
      remaining: limit - count - 1,
      resetAt: new Date(now + windowSeconds * 1000),
    };
  }

  // ==================== Distributed Locks ====================

  async acquireLock(
    key: string,
    ttlSeconds: number = 10,
  ): Promise<string | null> {
    const lockKey = `lock:${key}`;
    const lockValue = crypto.randomUUID();

    const result = await this.getClient().set(
      lockKey,
      lockValue,
      "EX",
      ttlSeconds,
      "NX",
    );

    return result === "OK" ? lockValue : null;
  }

  async releaseLock(key: string, lockValue: string): Promise<boolean> {
    const lockKey = `lock:${key}`;

    // Lua script to ensure atomic release
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const result = await this.getClient().eval(script, 1, lockKey, lockValue);
    return result === 1;
  }
}
```

---

## Background Jobs & Queue Management

### BullMQ Job Processing

```typescript
// apps/api/src/common/queue/queue.module.ts

import { Module, Global } from "@nestjs/common";
import { BullModule } from "@nestjs/bull";
import { ConfigModule, ConfigService } from "@nestjs/config";

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get("REDIS_HOST"),
          port: config.get("REDIS_PORT"),
          password: config.get("REDIS_PASSWORD"),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 1000,
          },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      }),
      inject: [ConfigService],
    }),

    // Register queues
    BullModule.registerQueue(
      { name: "emails" },
      { name: "notifications" },
      { name: "bookings" },
      { name: "payments" },
      { name: "search-indexing" },
      { name: "reports" },
      { name: "cleanup" },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
```

```typescript
// apps/api/src/modules/bookings/processors/booking.processor.ts

import {
  Processor,
  Process,
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
} from "@nestjs/bull";
import { Job } from "bull";

@Processor("bookings")
export class BookingProcessor {
  constructor(
    private readonly bookingService: BookingService,
    private readonly stateMachine: BookingStateMachineService,
    private readonly notificationService: NotificationService,
  ) {}

  @Process("expire-booking-request")
  async expireBookingRequest(job: Job<{ bookingId: string }>) {
    const { bookingId } = job.data;

    const booking = await this.bookingService.findById(bookingId);

    if (booking.status === "PENDING_OWNER_APPROVAL") {
      await this.stateMachine.transition(bookingId, BookingStatus.CANCELLED, {
        triggeredBy: "system",
        reason: "Booking request expired (48 hours)",
      });
    }
  }

  @Process("expire-payment-window")
  async expirePaymentWindow(job: Job<{ bookingId: string }>) {
    const { bookingId } = job.data;

    const booking = await this.bookingService.findById(bookingId);

    if (booking.status === "PENDING_PAYMENT") {
      await this.stateMachine.transition(bookingId, BookingStatus.CANCELLED, {
        triggeredBy: "system",
        reason: "Payment window expired (15 minutes)",
      });
    }
  }

  @Process("send-booking-reminder")
  async sendBookingReminder(job: Job<{ bookingId: string }>) {
    const { bookingId } = job.data;

    const booking = await this.bookingService.findById(bookingId);

    // Send reminder 24 hours before start
    await this.notificationService.send({
      userId: booking.renterId,
      type: "booking_reminder",
      data: {
        bookingId,
        startDate: booking.startDate,
      },
    });
  }

  @Process("auto-complete-inspection")
  async autoCompleteInspection(job: Job<{ bookingId: string }>) {
    const { bookingId } = job.data;

    const booking = await this.bookingService.findById(bookingId);

    if (booking.status === "AWAITING_RETURN_INSPECTION") {
      // No disputes filed, auto-complete
      await this.stateMachine.transition(bookingId, BookingStatus.COMPLETED, {
        triggeredBy: "system",
        reason: "Inspection window expired without disputes",
      });
    }
  }

  @Process("process-payout")
  async processPayout(job: Job<{ bookingId: string }>) {
    const { bookingId } = job.data;

    await this.bookingService.processOwnerPayout(bookingId);
  }

  @OnQueueActive()
  onActive(job: Job) {
    console.log(`Processing job ${job.id} of type ${job.name}`);
  }

  @OnQueueCompleted()
  onComplete(job: Job, result: any) {
    console.log(`Job ${job.id} completed with result:`, result);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    console.error(`Job ${job.id} failed with error:`, error.message);
  }
}
```

### Scheduled Jobs (Cron)

```typescript
// apps/api/src/common/scheduler/scheduler.module.ts

import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { SchedulerService } from "./scheduler.service";

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
```

```typescript
// apps/api/src/common/scheduler/scheduler.service.ts

import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

@Injectable()
export class SchedulerService {
  constructor(
    private readonly bookingStateMachine: BookingStateMachineService,
    private readonly searchService: SearchService,
    private readonly cleanupService: CleanupService,
  ) {}

  // Check for expired booking requests every 5 minutes
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleExpiredBookings() {
    console.log("Checking for expired bookings...");
    await this.bookingStateMachine.checkAndTransitionExpiredBookings();
  }

  // Auto-complete inspections every hour
  @Cron(CronExpression.EVERY_HOUR)
  async handleInspectionCompletion() {
    console.log("Checking for inspection completions...");
    await this.bookingStateMachine.autoCompleteAfterInspection();
  }

  // Reindex search every night at 2 AM
  @Cron("0 2 * * *")
  async reindexSearch() {
    console.log("Reindexing search...");
    await this.searchService.reindexAll();
  }

  // Clean up old data weekly
  @Cron(CronExpression.EVERY_WEEK)
  async cleanupOldData() {
    console.log("Cleaning up old data...");
    await this.cleanupService.archiveOldBookings();
    await this.cleanupService.deleteOldAuditLogs();
  }

  // Generate daily reports at 6 AM
  @Cron("0 6 * * *")
  async generateDailyReports() {
    console.log("Generating daily reports...");
    // Report generation logic
  }
}
```

---

## 6. Testing Strategy

### 6.1 Unit Testing with Jest

**Test Structure:**

```typescript
// listings/services/listing.service.spec.ts
import { Test, TestingModule } from "@nestjs/testing";
import { ListingService } from "./listing.service";
import { PrismaService } from "@/shared/prisma/prisma.service";
import { CategoryService } from "@/categories/services/category.service";
import { CacheService } from "@/shared/cache/cache.service";
import { SearchService } from "@/search/services/search.service";
import { CreateListingDto } from "../dto/create-listing.dto";
import { ForbiddenException, NotFoundException } from "@nestjs/common";

describe("ListingService", () => {
  let service: ListingService;
  let prisma: PrismaService;
  let categoryService: CategoryService;
  let cacheService: CacheService;
  let searchService: SearchService;

  const mockPrisma = {
    listing: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrisma)),
  };

  const mockCategoryService = {
    getCategoryById: jest.fn(),
    validateCategoryData: jest.fn(),
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    invalidate: jest.fn(),
  };

  const mockSearchService = {
    indexListing: jest.fn(),
    deleteListing: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CategoryService, useValue: mockCategoryService },
        { provide: CacheService, useValue: mockCacheService },
        { provide: SearchService, useValue: mockSearchService },
      ],
    }).compile();

    service = module.get<ListingService>(ListingService);
    prisma = module.get<PrismaService>(PrismaService);
    categoryService = module.get<CategoryService>(CategoryService);
    cacheService = module.get<CacheService>(CacheService);
    searchService = module.get<SearchService>(SearchService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createListing", () => {
    const userId = "user-123";
    const createDto: CreateListingDto = {
      categoryId: "cat-vehicles",
      title: "Luxury Sedan for Rent",
      description: "Comfortable ride for business trips",
      categoryData: {
        vehicleType: "sedan",
        make: "BMW",
        model: "5 Series",
        year: 2022,
        fuelType: "gasoline",
      },
      pricingMode: "per_day",
      basePrice: 150,
      location: {
        address: "123 Main St",
        city: "New York",
        state: "NY",
        zipCode: "10001",
        country: "US",
        latitude: 40.7128,
        longitude: -74.006,
      },
    };

    it("should create a listing with valid data", async () => {
      const category = { id: "cat-vehicles", name: "Vehicles" };
      const createdListing = { id: "listing-123", ...createDto, userId };

      mockCategoryService.getCategoryById.mockResolvedValue(category);
      mockCategoryService.validateCategoryData.mockResolvedValue(true);
      mockPrisma.listing.create.mockResolvedValue(createdListing);
      mockSearchService.indexListing.mockResolvedValue(undefined);

      const result = await service.createListing(userId, createDto);

      expect(categoryService.getCategoryById).toHaveBeenCalledWith(
        createDto.categoryId,
      );
      expect(categoryService.validateCategoryData).toHaveBeenCalledWith(
        createDto.categoryId,
        createDto.categoryData,
      );
      expect(prisma.listing.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          categoryId: createDto.categoryId,
          title: createDto.title,
          status: "DRAFT",
        }),
        include: expect.any(Object),
      });
      expect(searchService.indexListing).toHaveBeenCalledWith(createdListing);
      expect(result).toEqual(createdListing);
    });

    it("should throw NotFoundException for invalid category", async () => {
      mockCategoryService.getCategoryById.mockResolvedValue(null);

      await expect(service.createListing(userId, createDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.listing.create).not.toHaveBeenCalled();
    });

    it("should handle validation errors for category data", async () => {
      const category = { id: "cat-vehicles", name: "Vehicles" };
      mockCategoryService.getCategoryById.mockResolvedValue(category);
      mockCategoryService.validateCategoryData.mockRejectedValue(
        new Error("Invalid vehicle data"),
      );

      await expect(service.createListing(userId, createDto)).rejects.toThrow(
        "Invalid vehicle data",
      );
      expect(prisma.listing.create).not.toHaveBeenCalled();
    });
  });

  describe("updateListing", () => {
    it("should update listing when user is owner", async () => {
      const listingId = "listing-123";
      const userId = "user-123";
      const updateData = { title: "Updated Title", basePrice: 200 };
      const existingListing = { id: listingId, userId, title: "Old Title" };
      const updatedListing = { ...existingListing, ...updateData };

      mockPrisma.listing.findUnique.mockResolvedValue(existingListing);
      mockPrisma.listing.update.mockResolvedValue(updatedListing);
      mockSearchService.indexListing.mockResolvedValue(undefined);
      mockCacheService.invalidate.mockResolvedValue(undefined);

      const result = await service.updateListing(listingId, userId, updateData);

      expect(prisma.listing.findUnique).toHaveBeenCalledWith({
        where: { id: listingId },
      });
      expect(prisma.listing.update).toHaveBeenCalledWith({
        where: { id: listingId },
        data: updateData,
        include: expect.any(Object),
      });
      expect(cacheService.invalidate).toHaveBeenCalledWith(
        `listing:${listingId}`,
      );
      expect(searchService.indexListing).toHaveBeenCalledWith(updatedListing);
      expect(result).toEqual(updatedListing);
    });

    it("should throw ForbiddenException when user is not owner", async () => {
      const listingId = "listing-123";
      const userId = "user-456";
      const existingListing = { id: listingId, userId: "user-123" };

      mockPrisma.listing.findUnique.mockResolvedValue(existingListing);

      await expect(
        service.updateListing(listingId, userId, { title: "New Title" }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.listing.update).not.toHaveBeenCalled();
    });
  });
});
```

**Test Coverage Goals:**

```typescript
// jest.config.js
module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": "ts-jest",
  },
  collectCoverageFrom: [
    "**/*.(t|j)s",
    "!**/*.module.ts",
    "!**/main.ts",
    "!**/*.interface.ts",
    "!**/*.dto.ts",
  ],
  coverageDirectory: "../coverage",
  testEnvironment: "node",
  coverageThresholds: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
```

### 6.2 Integration Testing with Supertest

**API Endpoint Tests:**

```typescript
// test/bookings/create-booking.e2e-spec.ts
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "@/app.module";
import { PrismaService } from "@/shared/prisma/prisma.service";
import { JwtService } from "@nestjs/jwt";

describe("Bookings API (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let userToken: string;
  let userId: string;
  let listingId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);

    // Clean database
    await prisma.booking.deleteMany();
    await prisma.listing.deleteMany();
    await prisma.user.deleteMany();

    // Create test user
    const user = await prisma.user.create({
      data: {
        email: "renter@test.com",
        firstName: "John",
        lastName: "Doe",
        passwordHash: "hashed_password",
        emailVerified: true,
        phoneVerified: true,
      },
    });
    userId = user.id;
    userToken = jwtService.sign({ sub: userId, email: user.email });

    // Create test listing
    const listing = await prisma.listing.create({
      data: {
        userId: "owner-123",
        categoryId: "cat-vehicles",
        title: "Test Vehicle",
        description: "Test description",
        pricingMode: "per_day",
        basePrice: 100,
        location: {
          address: "123 Main St",
          city: "New York",
          state: "NY",
          zipCode: "10001",
          country: "US",
          latitude: 40.7128,
          longitude: -74.006,
        },
        categoryData: {},
        status: "ACTIVE",
        instantBookEnabled: true,
      },
    });
    listingId = listing.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe("POST /api/bookings", () => {
    it("should create an instant booking", async () => {
      const bookingData = {
        listingId,
        startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        guests: 2,
      };

      const response = await request(app.getHttpServer())
        .post("/api/bookings")
        .set("Authorization", `Bearer ${userToken}`)
        .send(bookingData)
        .expect(201);

      expect(response.body).toMatchObject({
        listingId,
        renterId: userId,
        status: "CONFIRMED",
        totalPrice: 300,
        bookingType: "INSTANT",
      });
      expect(response.body.id).toBeDefined();
      expect(response.body.confirmationCode).toBeDefined();

      // Verify database state
      const booking = await prisma.booking.findUnique({
        where: { id: response.body.id },
      });
      expect(booking).toBeTruthy();
      expect(booking.status).toBe("CONFIRMED");
    });

    it("should reject booking with past start date", async () => {
      const bookingData = {
        listingId,
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        guests: 2,
      };

      await request(app.getHttpServer())
        .post("/api/bookings")
        .set("Authorization", `Bearer ${userToken}`)
        .send(bookingData)
        .expect(400);
    });

    it("should reject booking with unavailable dates", async () => {
      // Create existing booking
      const startDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const endDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);

      await prisma.booking.create({
        data: {
          listingId,
          renterId: "other-user-123",
          startDate,
          endDate,
          status: "CONFIRMED",
          totalPrice: 300,
          bookingType: "INSTANT",
        },
      });

      // Try to book overlapping dates
      const bookingData = {
        listingId,
        startDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() + 11 * 24 * 60 * 60 * 1000).toISOString(),
        guests: 2,
      };

      const response = await request(app.getHttpServer())
        .post("/api/bookings")
        .set("Authorization", `Bearer ${userToken}`)
        .send(bookingData)
        .expect(409);

      expect(response.body.message).toContain("not available");
    });

    it("should require authentication", async () => {
      await request(app.getHttpServer())
        .post("/api/bookings")
        .send({ listingId })
        .expect(401);
    });
  });

  describe("POST /api/bookings/:id/cancel", () => {
    it("should cancel booking with full refund within policy", async () => {
      // Create booking
      const booking = await prisma.booking.create({
        data: {
          listingId,
          renterId: userId,
          startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          endDate: new Date(Date.now() + 33 * 24 * 60 * 60 * 1000),
          status: "CONFIRMED",
          totalPrice: 300,
          bookingType: "INSTANT",
        },
      });

      const response = await request(app.getHttpServer())
        .post(`/api/bookings/${booking.id}/cancel`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({ reason: "Change of plans" })
        .expect(200);

      expect(response.body).toMatchObject({
        status: "CANCELLED_BY_RENTER",
        refundAmount: 300,
      });

      const updatedBooking = await prisma.booking.findUnique({
        where: { id: booking.id },
      });
      expect(updatedBooking.status).toBe("CANCELLED_BY_RENTER");
    });
  });
});
```

### 6.3 E2E Testing with Playwright

**Critical User Flows:**

```typescript
// e2e/booking-flow.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Complete Booking Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:5173");
  });

  test("user can search, view, and book a listing", async ({ page }) => {
    // 1. Search for listings
    await page.fill('[data-testid="search-input"]', "New York");
    await page.selectOption('[data-testid="category-select"]', "vehicles");
    await page.fill('[data-testid="start-date"]', "2026-06-01");
    await page.fill('[data-testid="end-date"]', "2026-06-05");
    await page.click('[data-testid="search-button"]');

    // Wait for search results
    await page.waitForSelector('[data-testid="listing-card"]');
    const listingCount = await page
      .locator('[data-testid="listing-card"]')
      .count();
    expect(listingCount).toBeGreaterThan(0);

    // 2. Click first listing
    await page.click('[data-testid="listing-card"]:first-child');
    await page.waitForURL(/\/listings\/\w+/);

    // Verify listing details page
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator('[data-testid="price-display"]')).toBeVisible();
    await expect(page.locator('[data-testid="host-info"]')).toBeVisible();

    // 3. Fill booking form
    await page.fill('[data-testid="guests-input"]', "2");
    await page.fill('[data-testid="booking-start-date"]', "2026-06-01");
    await page.fill('[data-testid="booking-end-date"]', "2026-06-05");

    // Verify price calculation
    const totalPrice = await page
      .locator('[data-testid="total-price"]')
      .textContent();
    expect(totalPrice).toContain("$");

    // 4. Login if not authenticated
    await page.click('[data-testid="book-now-button"]');

    const url = page.url();
    if (url.includes("/login")) {
      await page.fill('[data-testid="email-input"]', "test@example.com");
      await page.fill('[data-testid="password-input"]', "Test123!@#");
      await page.click('[data-testid="login-button"]');
      await page.waitForURL(/\/listings\/\w+/);
    }

    // 5. Complete payment
    await page.click('[data-testid="book-now-button"]');
    await page.waitForURL(/\/bookings\/\w+\/payment/);

    // Fill Stripe payment form
    const stripeFrame = page
      .frameLocator('[name^="__privateStripeFrame"]')
      .first();
    await stripeFrame.locator('[name="cardnumber"]').fill("4242424242424242");
    await stripeFrame.locator('[name="exp-date"]').fill("12/30");
    await stripeFrame.locator('[name="cvc"]').fill("123");
    await stripeFrame.locator('[name="postal"]').fill("10001");

    await page.click('[data-testid="pay-button"]');

    // 6. Verify confirmation
    await page.waitForURL(/\/bookings\/\w+\/confirmation/, { timeout: 10000 });
    await expect(
      page.locator('[data-testid="confirmation-message"]'),
    ).toContainText("confirmed");
    await expect(
      page.locator('[data-testid="confirmation-code"]'),
    ).toBeVisible();

    // Verify booking appears in user's trips
    await page.click('[data-testid="my-trips-link"]');
    await page.waitForURL("/account/trips");
    await expect(
      page.locator('[data-testid="booking-card"]').first(),
    ).toBeVisible();
  });

  test("user can message host about listing", async ({ page, context }) => {
    // Login
    await page.goto("http://localhost:5173/login");
    await page.fill('[data-testid="email-input"]', "test@example.com");
    await page.fill('[data-testid="password-input"]', "Test123!@#");
    await page.click('[data-testid="login-button"]');

    // Navigate to listing
    await page.goto("http://localhost:5173/listings/test-listing-id");

    // Open messaging panel
    await page.click('[data-testid="contact-host-button"]');
    await expect(page.locator('[data-testid="message-panel"]')).toBeVisible();

    // Send message
    await page.fill(
      '[data-testid="message-input"]',
      "Is this available for June 1-5?",
    );
    await page.click('[data-testid="send-message-button"]');

    // Verify message sent
    await expect(
      page
        .locator('[data-testid="message-bubble"]')
        .filter({ hasText: "Is this available" }),
    ).toBeVisible();

    // Verify real-time delivery in second tab (host view)
    const hostPage = await context.newPage();
    await hostPage.goto("http://localhost:5173/messages");
    await hostPage.fill('[data-testid="email-input"]', "host@example.com");
    await hostPage.fill('[data-testid="password-input"]', "Host123!@#");
    await hostPage.click('[data-testid="login-button"]');

    await hostPage.waitForSelector('[data-testid="conversation-item"]');
    await hostPage.click('[data-testid="conversation-item"]:first-child');

    await expect(
      hostPage
        .locator('[data-testid="message-bubble"]')
        .filter({ hasText: "Is this available" }),
    ).toBeVisible();
  });
});
```

**Playwright Configuration:**

```typescript
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html"], ["junit", { outputFile: "test-results/junit.xml" }]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "Mobile Safari",
      use: { ...devices["iPhone 12"] },
    },
  ],
  webServer: [
    {
      command: "npm run dev",
      port: 5173,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npm run start:dev",
      port: 3000,
      reuseExistingServer: !process.env.CI,
      cwd: "./backend",
    },
  ],
});
```

### 6.4 Performance Testing with k6

**Load Test Scripts:**

```javascript
// k6/booking-load-test.js
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const errorRate = new Rate("errors");

export const options = {
  stages: [
    { duration: "2m", target: 100 }, // Ramp up to 100 users
    { duration: "5m", target: 100 }, // Stay at 100 users
    { duration: "2m", target: 200 }, // Ramp up to 200 users
    { duration: "5m", target: 200 }, // Stay at 200 users
    { duration: "2m", target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ["p(95)<500", "p(99)<1000"], // 95% under 500ms, 99% under 1s
    http_req_failed: ["rate<0.01"], // Error rate under 1%
    errors: ["rate<0.05"], // Business logic errors under 5%
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

export function setup() {
  // Create test user and get auth token
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({
      email: "loadtest@example.com",
      password: "LoadTest123!",
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );

  return {
    authToken: JSON.parse(loginRes.body).token,
  };
}

export default function (data) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${data.authToken}`,
  };

  // 1. Search listings
  const searchRes = http.get(
    `${BASE_URL}/api/listings/search?category=vehicles&location=New%20York&startDate=2026-06-01&endDate=2026-06-05`,
    { headers },
  );

  check(searchRes, {
    "search status is 200": (r) => r.status === 200,
    "search returns results": (r) => JSON.parse(r.body).results.length > 0,
  }) || errorRate.add(1);

  sleep(1);

  // 2. Get listing details
  const listings = JSON.parse(searchRes.body).results;
  if (listings.length > 0) {
    const listingId = listings[0].id;
    const detailsRes = http.get(`${BASE_URL}/api/listings/${listingId}`, {
      headers,
    });

    check(detailsRes, {
      "details status is 200": (r) => r.status === 200,
      "details load time < 300ms": (r) => r.timings.duration < 300,
    }) || errorRate.add(1);
  }

  sleep(2);

  // 3. Check availability
  if (listings.length > 0) {
    const listingId = listings[0].id;
    const availabilityRes = http.post(
      `${BASE_URL}/api/listings/${listingId}/check-availability`,
      JSON.stringify({
        startDate: "2026-06-01T00:00:00Z",
        endDate: "2026-06-05T00:00:00Z",
      }),
      { headers },
    );

    check(availabilityRes, {
      "availability check status is 200": (r) => r.status === 200,
      "availability responds quickly": (r) => r.timings.duration < 200,
    }) || errorRate.add(1);
  }

  sleep(1);

  // 4. Create booking (10% of users)
  if (Math.random() < 0.1 && listings.length > 0) {
    const listingId = listings[0].id;
    const bookingRes = http.post(
      `${BASE_URL}/api/bookings`,
      JSON.stringify({
        listingId,
        startDate: "2026-06-01T00:00:00Z",
        endDate: "2026-06-05T00:00:00Z",
        guests: 2,
      }),
      { headers },
    );

    check(bookingRes, {
      "booking creation status is 201": (r) => r.status === 201,
      "booking has confirmation code": (r) =>
        JSON.parse(r.body).confirmationCode !== undefined,
    }) || errorRate.add(1);
  }

  sleep(3);
}

export function teardown(data) {
  // Cleanup test data if needed
}
```

**Search Performance Test:**

```javascript
// k6/search-performance-test.js
import http from "k6/http";
import { check } from "k6";

export const options = {
  scenarios: {
    constant_load: {
      executor: "constant-vus",
      vus: 50,
      duration: "5m",
    },
    spike_test: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "10s", target: 500 }, // Spike to 500 users
        { duration: "1m", target: 500 }, // Stay at 500
        { duration: "10s", target: 0 }, // Drop to 0
      ],
      startTime: "5m", // Start after constant load
    },
  },
  thresholds: {
    "http_req_duration{scenario:constant_load}": ["p(95)<400"],
    "http_req_duration{scenario:spike_test}": ["p(95)<800"],
    http_req_failed: ["rate<0.01"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

const searchQueries = [
  "?category=vehicles&location=New%20York",
  "?category=spaces&priceMin=50&priceMax=200",
  "?category=instruments&query=guitar",
  "?location=Los%20Angeles&radius=25",
  "?verified=true&instantBook=true",
];

export default function () {
  const query = searchQueries[Math.floor(Math.random() * searchQueries.length)];
  const res = http.get(`${BASE_URL}/api/listings/search${query}`);

  check(res, {
    "search successful": (r) => r.status === 200,
    "returns results": (r) => JSON.parse(r.body).results !== undefined,
    "fast response": (r) => r.timings.duration < 500,
  });
}
```

### 6.5 Security Testing Checklist

**Automated Security Scans:**

```yaml
# .github/workflows/security-scan.yml
name: Security Scan

on:
  push:
    branches: [main, develop]
  pull_request:
  schedule:
    - cron: "0 2 * * 1" # Weekly on Monday at 2 AM

jobs:
  dependency-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - name: Run npm audit
        run: |
          npm audit --audit-level=moderate
          cd backend && npm audit --audit-level=moderate

  sast-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Semgrep
        uses: returntocorp/semgrep-action@v1
        with:
          config: p/owasp-top-ten

  docker-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build Docker image
        run: docker build -t rental-portal:test -f backend/Dockerfile backend/
      - name: Run Trivy scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: rental-portal:test
          format: "sarif"
          output: "trivy-results.sarif"
      - name: Upload results
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: "trivy-results.sarif"
```

**Manual Security Test Cases:**

- Authentication
  - ✅ SQL injection in login form
  - ✅ Brute force protection (rate limiting)
  - ✅ Session fixation attacks
  - ✅ JWT token expiration
  - ✅ Password reset token validation
- Authorization
  - ✅ Horizontal privilege escalation (accessing other users' bookings)
  - ✅ Vertical privilege escalation (regular user to admin)
  - ✅ IDOR vulnerabilities (direct object reference)
- Input Validation
  - ✅ XSS in listing descriptions
  - ✅ SQL injection in search queries
  - ✅ File upload restrictions (size, type, malicious content)
  - ✅ JSON payload validation
- API Security
  - ✅ Rate limiting effectiveness
  - ✅ CORS configuration
  - ✅ API key exposure
  - ✅ Sensitive data in responses

---

**(Continued in next message with sections 7-10: Deployment, Monitoring, Security, Performance)**
