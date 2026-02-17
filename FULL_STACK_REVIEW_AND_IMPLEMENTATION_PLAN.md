# Full-Stack Review & Implementation Plan
## GharBatai Rental Portal — End-to-End Audit

**Date:** February 12, 2026  
**Scope:** UI/UX flows, frontend-backend integration, I/O contracts, error handling, fallbacks, AI/ML, missing logic  
**Method:** Line-level code audit of all 50+ routes, 20 backend modules, Prisma schema, API client layer, validation schemas

---

## Executive Summary

The GharBatai rental portal has a **feature-rich codebase** with an impressive surface area: 20+ backend modules, 50+ frontend routes, WebSocket messaging, Stripe payments, double-entry ledger, fraud detection, multi-channel notifications, and real file upload infrastructure. However, this audit uncovered **critical structural failures** that would cause production incidents:

1. **Zero server-side input validation** outside auth (all DTOs are interfaces, not classes)
2. **7 dead API endpoints** called by the frontend that don't exist in the backend
3. **Stripe refunds never execute** — refund records are created but `stripe.refunds.create()` is never called
4. **Booking settlement never triggers** — payouts to owners never happen automatically
5. **Geo-search is fake** — lat/lon/radius parameters accepted but completely ignored
6. **AI/ML is marketed but not real** — pgvector deployed but unused, "AI-assisted" features are regex

The plan below prioritizes fixes by business impact and provides production-grade patterns for each.

---

## Table of Contents

1. [Critical Production Blockers](#1-critical-production-blockers)
2. [Frontend-Backend Contract Mismatches](#2-frontend-backend-contract-mismatches)
3. [Missing Business Logic](#3-missing-business-logic)
4. [Error Handling & Fallback Gaps](#4-error-handling--fallback-gaps)
5. [UI/UX Flow Simplification via AI/ML](#5-uiux-flow-simplification-via-aiml)
6. [Integration Pattern Improvements](#6-integration-pattern-improvements)
7. [Implementation Plan](#7-implementation-plan)
8. [File-by-File Fix Registry](#8-file-by-file-fix-registry)

---

## 1. Critical Production Blockers

### 1.1 🔴 No Server-Side Input Validation (All Business Modules)

**Impact:** Any JSON body is accepted as-is. Malicious payloads can inject arbitrary fields into Prisma queries. No length limits, no type checking, no field stripping.

**Root Cause:** All business-module DTOs (bookings, listings, payments, reviews, organizations, messaging, disputes, insurance, tax) are defined as TypeScript `interface` inside service files. The global `ValidationPipe` with `whitelist: true` requires `class-validator`-decorated **classes** to work. Interfaces are erased at runtime.

**Only auth has proper validation** — `auth.dto.ts` uses `@IsEmail`, `@IsString`, `@MinLength`, etc.

**Fix Pattern — Create proper DTO classes for each module:**

```typescript
// apps/api/src/modules/bookings/dto/create-booking.dto.ts (NEW)
import { IsString, IsUUID, IsDateString, IsOptional, IsInt, Min, Max, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBookingDto {
  @ApiProperty({ description: 'Listing ID to book' })
  @IsUUID()
  listingId: string;

  @ApiProperty({ description: 'Start date (ISO 8601)' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'End date (ISO 8601)' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  guestCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  promoCode?: string;
}
```

**Scope:** Create DTO classes with decorators for all 7 modules:

| Module | DTOs Needed | Priority |
|--------|------------|----------|
| Bookings | `CreateBookingDto`, `UpdateBookingDto` | Critical |
| Listings | `CreateListingDto`, `UpdateListingDto` | Critical |
| Payments | `CreatePaymentIntentDto`, `RequestPayoutDto`, `AttachPaymentMethodDto` | Critical |
| Reviews | `CreateReviewDto`, `UpdateReviewDto` | High |
| Organizations | `CreateOrganizationDto`, `UpdateOrganizationDto`, `InviteMemberDto` | High |
| Disputes | `CreateDisputeDto`, `AddResponseDto` | High |
| Messaging | `CreateConversationDto`, `SendMessageDto` | High |

---

### 1.2 🔴 Dead API Endpoints (7 Frontend Calls → 404)

**Impact:** User-facing features silently fail. Price calculation, blocked dates display, earnings/payout pages, and organization members pages all call endpoints that don't exist.

| Frontend Call | Expected Endpoint | Status |
|--------------|-------------------|--------|
| `bookingsApi.calculatePrice()` | `POST /bookings/calculate-price` | **MISSING from controller** |
| `bookingsApi.getBlockedDates()` | `GET /bookings/blocked-dates/:id` | **MISSING from controller** |
| `paymentsApi.getTransactions()` | `GET /payments/transactions` | **MISSING from controller** |
| `paymentsApi.getEarnings()` | `GET /payments/earnings` | **MISSING from controller** |
| `paymentsApi.getEarningsSummary()` | `GET /payments/earnings/summary` | **MISSING from controller** |
| `paymentsApi.getBalance()` | `GET /payments/balance` | **MISSING from controller** |
| `paymentsApi.getPayouts()` | `GET /payments/payouts` | **MISSING from controller** |

**Fix:** Implement these endpoints in the backend controllers, OR update the frontend to use endpoints that DO exist. The backend services have most of the underlying logic (LedgerService, PayoutsService) — it's the controller routes that are missing.

---

### 1.3 🔴 Stripe Refunds Never Execute

**Impact:** When a booking is cancelled, a `Refund` record is created with status `PENDING` in the database, but **no code ever calls `stripe.refunds.create()`** to actually refund the money. The renter never gets their money back.

**Flow traced:**
1. `bookings.service.ts` → `cancelBooking()` → publishes Redis event `booking:cancelled` with refund amount
2. `booking-state-machine.service.ts` → `processCancellationRefund()` → creates `Refund` record in DB (status: `PENDING`)
3. **No consumer ever picks up the Redis event to execute the Stripe refund**
4. The `charge.refunded` webhook handler only processes refunds *initiated from the Stripe Dashboard*, not internally-created ones

**Fix:**

```typescript
// apps/api/src/modules/payments/services/refund.service.ts (NEW)
@Injectable()
export class RefundService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly ledger: LedgerService,
  ) {}

  async processRefund(refundId: string): Promise<void> {
    const refund = await this.prisma.refund.findUniqueOrThrow({
      where: { id: refundId },
      include: { booking: { include: { payments: true } } },
    });

    if (refund.status !== 'PENDING') return;

    const payment = refund.booking.payments.find(p => p.status === 'SUCCEEDED');
    if (!payment?.stripePaymentIntentId) {
      throw new BadRequestException('No successful payment found for refund');
    }

    try {
      const stripeRefund = await this.stripe.createRefund(
        payment.stripePaymentIntentId,
        refund.amount,
      );

      await this.prisma.$transaction(async (tx) => {
        await tx.refund.update({
          where: { id: refundId },
          data: { status: 'COMPLETED', stripeRefundId: stripeRefund.id, processedAt: new Date() },
        });
        await this.ledger.recordRefund(tx, refund.bookingId, refund.amount);
      });
    } catch (error) {
      await this.prisma.refund.update({
        where: { id: refundId },
        data: { status: 'FAILED', failureReason: error.message },
      });
      throw error;
    }
  }
}
```

Then wire `processRefund()` into `processCancellationRefund()` in the state machine.

---

### 1.4 🔴 Settlement / Owner Payout Never Triggers

**Impact:** After a booking is `COMPLETED`, the transition to `SETTLED` is never automatically triggered. The `triggerSettlementProcess()` method only sends a notification but doesn't call `transition(bookingId, 'SETTLE')`. Owner payouts are never automatically created.

**Fix:** Add a scheduled job or post-completion hook:

```typescript
// In booking-state-machine.service.ts
private async triggerSettlementProcess(bookingId: string): Promise<void> {
  // Existing: send notification
  await this.notificationsService.create({...});
  
  // NEW: Actually trigger settlement
  await this.transition(bookingId, 'SETTLE', 'system', {
    note: 'Auto-settled after completion',
  });
  
  // NEW: Create owner payout
  await this.payoutsService.createAutoPayout(bookingId);
}
```

---

### 1.5 🔴 Duplicate Webhook Handlers (Double Processing)

**Impact:** Two endpoints handle the same Stripe events with different logic:
- `POST /webhooks/stripe` → `WebhookService` (comprehensive)
- `POST /payments/webhook` → `StripeService.processWebhookEvent()` (less thorough)

If Stripe is configured to send to both (or NestJS routes both to the same), events like `payment_intent.succeeded` get processed twice — potentially creating duplicate ledger entries.

**Fix:** Remove the `POST /payments/webhook` route from `PaymentsController`. Keep only the dedicated `WebhookController` at `POST /webhooks/stripe`. Add idempotency keys to webhook processing.

---

### 1.6 🔴 Three Backend Modules Not Registered

**Impact:** `OrganizationsModule`, `FraudDetectionModule`, and `TaxModule` have controllers and services but are NOT listed in `app.module.ts` imports. Their endpoints **do not exist at runtime**.

**Note:** FraudDetectionService IS functional because it's injected directly by BookingsModule. But the `GET /fraud/high-risk-users` admin endpoint is inaccessible. Organizations and Tax are completely non-functional.

**Fix:** Add to `app.module.ts`:
```typescript
imports: [
  // ...existing
  OrganizationsModule,
  TaxModule,
  // FraudDetectionModule only if admin endpoint is needed
]
```

---

## 2. Frontend-Backend Contract Mismatches

### 2.1 Booking Schema Mismatch

| Frontend Zod Schema | Backend DTO | Problem |
|---------------------|-------------|---------|
| `deliveryMethod` (pickup/delivery/shipping) | Not in `CreateBookingDto` | **Frontend sends field backend ignores** |
| `deliveryAddress` | Not in `CreateBookingDto` | **Frontend sends field backend ignores** |
| `specialRequests` | Not in `CreateBookingDto` | **Frontend sends field backend ignores** |
| Not in frontend schema | `guestCount` | **Backend field never sent** |
| Not in frontend schema | `message` | **Backend field never sent** |
| Not in frontend schema | `promoCode` | **Backend field never sent** |

**Fix:** Align both sides. Determine which fields are correct, then update:
- The Zod schema in `lib/validation/booking.ts`
- The DTO class in the backend
- The form in `listings.$id.tsx`

### 2.2 Listing Data Transformation Hack

The frontend `listingsApi.searchListings()` maps backend responses with fabricated defaults:

```typescript
// lib/api/listings.ts — paraphrased
photos: listing.photos || [],
images: listing.photos || [],  // ← Alias because UI uses "images" but API returns "photos"
deliveryOptions: { pickup: true, delivery: false, shipping: false }, // ← Completely fabricated
pricePerDay: listing.basePrice,  // ← Renamed field
```

**Fix:** Create a shared response type used by both frontend and backend. Use consistent field names. Don't fabricate data.

### 2.3 Review Field Name Mismatch

| Frontend | Backend | Problem |
|----------|---------|---------|
| `rating` | `overallRating` | Different field name |
| `categories.accuracy` | `accuracyRating` | Different shape (nested vs flat) |
| `categories.communication` | `communicationRating` | Different shape |
| Missing | `reviewType` (RENTER_TO_OWNER / OWNER_TO_RENTER) | **Required field not sent** |

---

## 3. Missing Business Logic

### 3.1 Deposit Lifecycle Not Automated

The deposit hold, release, and capture endpoints exist but are completely disconnected from the booking state machine. In production, this means:
- No automatic deposit hold when a booking is confirmed
- No automatic deposit release when booking completes without damage
- No automatic deposit capture when a damage claim is filed

**Fix:** Wire deposit operations into state machine transitions:
- `CONFIRMED` → auto-hold deposit (if listing requires one)
- `COMPLETED` → auto-release deposit (if no dispute filed within 48h)
- `DISPUTED` → freeze deposit until resolution

### 3.2 Insurance Not Enforced During Booking

`InsuranceService.checkInsuranceRequirement()` exists and correctly determines if insurance is required based on category, but it's **never called during booking creation**. A renter can book a $10,000 item without any insurance.

**Fix:** Add insurance check in `bookings.service.ts:create()`:

```typescript
// Before creating booking
const insuranceReq = await this.insuranceService.checkInsuranceRequirement(listing.categoryId, listing.basePrice);
if (insuranceReq.required) {
  const policy = await this.insuranceService.getActivePolicy(listing.id);
  if (!policy) {
    throw new BadRequestException('This listing requires insurance. Please upload a valid insurance policy.');
  }
}
```

### 3.3 Content Moderation Not Integrated

`TextModerationService` and `ImageModerationService` exist with regex-based moderation + OpenAI/Perspective API stubs, but are **never called** from:
- Listing creation/update (title, description, photos)
- Message sending
- Review creation
- Dispute responses

**Fix:** Add moderation middleware or service calls at content creation points:

```typescript
// In listings.service.ts:create()
const titleModeration = await this.moderationService.moderateText(dto.title);
const descModeration = await this.moderationService.moderateText(dto.description);
if (titleModeration.flagged || descModeration.flagged) {
  // Queue for manual review instead of publishing
  data.status = 'PENDING_REVIEW';
  data.moderationFlags = [...titleModeration.flags, ...descModeration.flags];
}
```

### 3.4 Geo-Search Not Functional

`SearchService` accepts lat/lon/radius parameters in the `SearchQuery` interface, and the frontend sends them, but the actual Prisma query **only filters by city/state/country as text `contains`**. The `distance` field in search results is always empty.

**Fix:** Use PostgreSQL's built-in geo functions or PostGIS:

```sql
-- Option A: Simple Haversine in SQL (no PostGIS needed)
WHERE (
  6371 * acos(
    cos(radians(:lat)) * cos(radians("latitude"))
    * cos(radians("longitude") - radians(:lon))
    + sin(radians(:lat)) * sin(radians("latitude"))
  )
) <= :radiusKm

-- Option B: If PostGIS is available
WHERE ST_DWithin(
  ST_MakePoint("longitude", "latitude")::geography,
  ST_MakePoint(:lon, :lat)::geography,
  :radiusMeters
)
```

### 3.5 Payment Failure Race Condition

When Stripe payment fails:
- **Webhook path:** Sets booking to `CANCELLED` immediately (aggressive)
- **Client path:** Stripe.js shows error, user can retry on the checkout page

The webhook may cancel the booking **while the user is still looking at the checkout page**. On retry, the payment intent targets a `CANCELLED` booking.

**Fix:** 
- Change webhook `payment_intent.payment_failed` to set booking to `PAYMENT_FAILED` (new status) instead of `CANCELLED`
- Allow a grace period (e.g., 30 minutes) before auto-cancelling
- The frontend checkout page should check booking status before allowing retry

### 3.6 Push Notifications Stubbed

`PushNotificationService.getUserDeviceTokens()` returns `[]` — the FCM integration code exists but will never execute. No device token registration endpoint exists either.

**Fix for MVP:** Remove push notification toggle from `settings.notifications.tsx` (it's misleading users into thinking they'll receive push notifications). Re-enable when FCM integration is ready.

---

## 4. Error Handling & Fallback Gaps

### 4.1 Frontend Error Handling Quality Map

| Quality | Routes | Pattern |
|---------|--------|---------|
| **Solid** | auth.login, auth.signup, auth.forgot-password, auth.reset-password, checkout, disputes.new, become-owner, settings.notifications | Zod validation + inline errors + toast + specific messages |
| **Adequate** | search, bookings.$id, listings.new, listings.$id.edit, dashboard.owner.earnings, reviews | Try/catch + generic error display + fallback data |
| **Poor** | bookings (uses `alert()`), dashboard.owner (no error boundary), payments (generic) | Missing toasts, no recovery actions |
| **Broken** | messages.tsx (console.error only), dashboard.renter (manual headers), insurance (static page) | Silent failures, pattern violations |

### 4.2 Missing Route-Level Error Boundaries

Only 6 of 30+ routes export their own `ErrorBoundary`. The other 24 fall through to the root boundary which provides no route-specific recovery. Critical routes missing boundaries:

- `listings.$id.tsx` — listing detail (high-traffic page)
- `checkout.$bookingId.tsx` — payment page (financial)
- `messages.tsx` — messaging (realtime, more failure modes)
- `dashboard.owner.tsx` — owner dashboard (primary owner surface)
- `payments.tsx` — earnings/payouts (financial)
- `disputes.$id.tsx` — dispute detail (legal/compliance)

**Fix:** Add contextual `ErrorBoundary` exports to each route with specific recovery actions:

```tsx
// Example: listings.$id.tsx
export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <h1 className="text-2xl font-bold mb-4">Listing Not Found</h1>
      <p className="text-muted-foreground mb-6">
        This listing may have been removed or the link may be incorrect.
      </p>
      <div className="flex gap-3 justify-center">
        <Link to="/search" className="...">Browse Listings</Link>
        <button onClick={() => window.location.reload()}>Try Again</button>
      </div>
    </div>
  );
}
```

### 4.3 Backend Error Handling Gaps

| Issue | Impact | Fix |
|-------|--------|-----|
| Prisma error handling commented out in `AllExceptionsFilter` | P2002 (unique) returns 500, P2025 (not found) returns 500 | Uncomment and map to proper HTTP status codes |
| PaymentsController throws raw `Error` instead of `HttpException` | All payment errors return 500 | Replace `throw new Error(...)` with `throw new NotFoundException(...)` etc. |
| Error response shape inconsistency (`method` field) | Frontend parsing inconsistency | Standardize both filters |
| No Prisma connection error handling | DB connection failures crash the process | Add connection pool monitoring |

### 4.4 Fallback Hierarchy

**Current fallback pattern (good):**
```
Route clientLoader:
  try { API call } 
  catch { return { data: emptyDefaults, error: "message" } }
→ Component renders error message + empty state
→ Root ErrorBoundary catches unhandled throws
```

**Missing from the hierarchy:**
- No stale-while-revalidate (React Query mutations exist but unused)
- No offline caching / Service Worker
- No retry buttons on failed data loads (except root boundary's generic retry)
- No partial data rendering (if 1 of 3 API calls fails, entire page shows error instead of loading what succeeded)

**Improved pattern:**

```tsx
// Load data with partial failure tolerance
export async function clientLoader() {
  const [listingsRes, statsRes, bookingsRes] = await Promise.allSettled([
    listingsApi.getMyListings(),
    usersApi.getUserStats(),
    bookingsApi.getOwnerBookings(),
  ]);

  return {
    listings: listingsRes.status === 'fulfilled' ? listingsRes.value : { data: [], error: 'Failed to load listings' },
    stats: statsRes.status === 'fulfilled' ? statsRes.value : { data: null, error: 'Failed to load stats' },
    bookings: bookingsRes.status === 'fulfilled' ? bookingsRes.value : { data: [], error: 'Failed to load bookings' },
  };
}
// Component renders each section independently — one failure doesn't break the whole page
```

---

## 5. UI/UX Flow Simplification via AI/ML

### Current State: "AI" Features Are Regex

| Feature | Label in UI | Reality |
|---------|------------|---------|
| "AI-Assisted" Quick Create | `listings.new.tsx` | Regex keyword matching on title → category/price hints |
| Voice Listing Assistant | `VoiceListingAssistant.tsx` | Browser SpeechRecognition API → regex command parsing |
| Smart Search | Landing page claims | SQL `LIKE '%query%'` — no semantic matching |
| Recommendations | "Recommended for You" | `GET /listings?limit=4` — no personalization |
| pgvector | Docker image deployed | Zero vector columns in Prisma schema, no embedding code |

### AI/ML Implementation Plan (Ordered by Impact/Effort Ratio)

#### Phase A: Wire Existing Stubs (1-2 days effort)

**A1. Content Moderation — Wire OpenAI Moderation API**

The code exists in `text-moderation.service.ts` L256-279 (`moderateWithOpenAI()`). Steps:
1. Add `OPENAI_API_KEY` to production environment
2. Install `openai` npm package in `apps/api`
3. Wire `moderateWithOpenAI()` as a second-pass after the regex filter in `moderateText()`
4. Call `moderateText()` from listing creation, message sending, and review creation

```typescript
// text-moderation.service.ts — wire existing method
async moderateText(text: string): Promise<ModerationResult> {
  // Fast regex pass (existing)
  const regexResult = this.regexModerate(text);
  if (regexResult.severity === 'HIGH') return regexResult;
  
  // AI second pass for medium/uncertain cases
  if (this.openaiApiKey && regexResult.severity === 'MEDIUM') {
    const aiResult = await this.moderateWithOpenAI(text);
    return this.mergeResults(regexResult, aiResult);
  }
  
  return regexResult;
}
```

**A2. Wire Image Moderation (Rekognition/Vision)**

Same pattern — stubs exist in `image-moderation.service.ts`. Uncomment and connect to listing photo upload.

---

#### Phase B: LLM-Powered UX Simplification (1-2 weeks)

**B1. AI Listing Description Generator**

Add a single endpoint + frontend button:

```typescript
// apps/api/src/modules/listings/controllers/listings.controller.ts — NEW endpoint
@Post('generate-description')
@UseGuards(JwtAuthGuard)
async generateDescription(
  @Body() body: { title: string; category: string; condition: string; features: string[] },
) {
  return this.aiService.generateListingDescription(body);
}
```

```typescript
// apps/api/src/modules/listings/services/listing-ai.service.ts (NEW)
@Injectable()
export class ListingAiService {
  private readonly openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async generateListingDescription(input: {
    title: string;
    category: string;
    condition: string;
    features: string[];
  }): Promise<{ description: string }> {
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini', // Cost-efficient
      messages: [
        {
          role: 'system',
          content: `You are a rental listing copywriter. Write a compelling, honest description for a rental item listing. 
                    Be specific about condition and features. Keep it 2-3 paragraphs, under 300 words. 
                    Do not exaggerate or make claims about quality not supported by the features.`,
        },
        {
          role: 'user',
          content: `Title: ${input.title}\nCategory: ${input.category}\nCondition: ${input.condition}\nFeatures: ${input.features.join(', ')}`,
        },
      ],
      max_tokens: 400,
      temperature: 0.7,
    });

    return { description: completion.choices[0].message.content || '' };
  }
}
```

Frontend: Add "✨ Generate Description" button in `listings.new.tsx` step 1 that calls this endpoint and fills the description field. Cost: ~$0.001 per generation.

**B2. Smart Pricing Suggestions**

Replace the regex `KEYWORD_PRICE_HINTS` with a data-driven suggestion:

```typescript
// Backend endpoint
@Get('price-suggestion')
async getPriceSuggestion(
  @Query('categoryId') categoryId: string,
  @Query('condition') condition: string,
  @Query('city') city: string,
) {
  const comparables = await this.prisma.listing.findMany({
    where: { categoryId, status: 'ACTIVE', city },
    select: { basePrice: true },
    take: 50,
  });
  
  const prices = comparables.map(l => l.basePrice);
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  const p25 = percentile(prices, 25);
  const p75 = percentile(prices, 75);
  
  // Adjust by condition
  const conditionMultiplier = { NEW: 1.2, LIKE_NEW: 1.1, GOOD: 1.0, FAIR: 0.85, POOR: 0.7 };
  const suggested = avg * (conditionMultiplier[condition] || 1.0);
  
  return {
    suggestedPrice: Math.round(suggested * 100) / 100,
    range: { low: Math.round(p25), high: Math.round(p75) },
    comparableCount: prices.length,
    message: prices.length < 5 
      ? 'Limited data available — consider checking similar categories'
      : `Based on ${prices.length} similar listings in ${city}`,
  };
}
```

Frontend: Show a "Suggested: NPR X/day (based on Y similar listings)" hint below the price field.

**B3. AI-Powered Search (Use Deployed pgvector)**

Steps to activate the already-deployed pgvector infrastructure:

1. Add embedding column to Prisma schema:
```prisma
model Listing {
  // ... existing fields
  embedding    Unsupported("vector(1536)")?  // OpenAI ada-002 dimensions
}
```

2. Generate embeddings on listing create/update:
```typescript
async generateEmbedding(text: string): Promise<number[]> {
  const response = await this.openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}
```

3. Semantic search query:
```sql
SELECT *, embedding <=> $1::vector AS distance
FROM "Listing"
WHERE status = 'ACTIVE'
ORDER BY embedding <=> $1::vector
LIMIT 20;
```

This means "something to record a podcast" would match "Blue Yeti USB Microphone" — impossible with the current `LIKE '%query%'`.

---

#### Phase C: Personalization (2-4 weeks)

**C1. Recommendation Engine**

Replace the fake "Recommended for You" (which just shows recent listings) with collaborative filtering:

```typescript
// Lightweight item-item similarity
async getRecommendations(userId: string, limit: number = 10): Promise<Listing[]> {
  // 1. Get user's interaction history
  const history = await this.prisma.$queryRaw`
    SELECT DISTINCT "listingId" FROM (
      SELECT "listingId" FROM "Booking" WHERE "renterId" = ${userId}
      UNION
      SELECT "listingId" FROM "FavoriteListing" WHERE "userId" = ${userId}
    ) interactions
  `;

  // 2. Find users who interacted with the same items
  const similarUsers = await this.prisma.$queryRaw`
    SELECT "renterId", COUNT(*) as overlap
    FROM "Booking"
    WHERE "listingId" = ANY(${history.map(h => h.listingId)})
    AND "renterId" != ${userId}
    GROUP BY "renterId"
    ORDER BY overlap DESC
    LIMIT 50
  `;

  // 3. Get items those users liked that current user hasn't seen
  const recommendations = await this.prisma.$queryRaw`
    SELECT l.*, COUNT(*) as score
    FROM "Listing" l
    JOIN "Booking" b ON b."listingId" = l.id
    WHERE b."renterId" = ANY(${similarUsers.map(u => u.renterId)})
    AND l.id NOT IN (${history.map(h => h.listingId)})
    AND l.status = 'ACTIVE'
    GROUP BY l.id
    ORDER BY score DESC
    LIMIT ${limit}
  `;

  return recommendations;
}
```

**C2. Listing Completeness Score**

AI-powered quality feedback during listing creation:

```typescript
async scoreListingCompleteness(listing: Partial<CreateListingDto>): Promise<{
  score: number;
  suggestions: string[];
}> {
  let score = 0;
  const suggestions: string[] = [];

  // Basic fields
  if (listing.title?.length >= 20) score += 10; else suggestions.push('Make your title more descriptive (20+ chars)');
  if (listing.description?.length >= 100) score += 15; else suggestions.push('Add a detailed description (100+ words)');
  if (listing.photos?.length >= 4) score += 20; else suggestions.push(`Add ${4 - (listing.photos?.length || 0)} more photos — listings with 4+ photos get 2x more bookings`);
  if (listing.features?.length >= 3) score += 10; else suggestions.push('Highlight at least 3 features');
  if (listing.rules) score += 5;
  if (listing.securityDeposit !== undefined) score += 5;
  if (listing.cancellationPolicy) score += 5;
  
  // Category-specific
  // ... check for category-required fields

  return { score, suggestions };
}
```

Show as an interactive sidebar score indicator during listing creation.

---

## 6. Integration Pattern Improvements

### 6.1 Eliminate Pattern Violations

Three routes bypass the API module layer:

| Route | Violation | Fix |
|-------|-----------|-----|
| `dashboard.renter.tsx` | Uses `apiClient.get()` with manual `Authorization` header | Use `bookingsApi.getMyBookings()`, `favoritesApi.getFavorites()`, `listingsApi.searchListings()` |
| `settings.profile.tsx` | Uses `api.patch("/users/me")` directly | Use `usersApi.updateProfile()` |
| `insurance.upload.tsx` | Uses raw `api.get()` and `api.post()` | Use `insuranceApi.checkRequirement()`, `insuranceApi.createPolicy()` |

### 6.2 Wire Unused Infrastructure

| Infrastructure | Module | Status | Action |
|---------------|--------|--------|--------|
| `optimistic-updates.ts` | `useOptimisticMutation`, `useOptimisticAdd`, `useOptimisticRemove` | Never imported | Wire into favorites toggle, message send, booking actions |
| `error-handler.ts` | `handlePaymentError`, `handleAuthError`, `handleValidationError` | Never imported | Use in checkout, auth, and form routes |
| `favoritesApi` | Toggle, bulk, count | Bypassed by `listingsApi` | Use in favorites route + listing detail |
| `insuranceApi` | Policies, quotes, claims | Bypassed by raw calls | Use in insurance routes |
| `notificationsApi` | Full CRUD + preferences | No notifications page | Create notifications list page |
| `adminApi` | 684-line module | No admin routes | Create admin dashboard |
| `messagingApi.getUnreadCount()` | Unread badge count | Not called in nav | Add to mobile nav + header |

### 6.3 Add Pagination to All List Views

| Route | Current | Fix |
|-------|---------|-----|
| `bookings.tsx` | Loads ALL bookings | Add `page`/`limit` query params, use `bookingsApi.getMyBookings({ page, limit })` |
| `disputes.tsx` | Loads ALL disputes | Add pagination controls |
| `favorites.tsx` | Loads ALL favorites | Add pagination (backend already supports it via `favoritesApi`) |
| `dashboard.owner.earnings.tsx` | Hardcoded `limit: 20` | Add "Load More" or pagination |
| `messages.tsx` | Loads 100 messages | Add "Load older messages" on scroll-to-top |

### 6.4 Centralize Status Label Mapping

Currently, booking status labels are defined inline in `bookings.tsx` with raw `replace(/_/g, " ")`. Create a shared utility:

```typescript
// apps/web/app/lib/status-labels.ts (NEW)
export const BOOKING_STATUS = {
  DRAFT: { label: 'Draft', color: 'secondary', icon: FileEdit },
  PENDING_OWNER_APPROVAL: { label: 'Pending Approval', color: 'warning', icon: Clock },
  PENDING_PAYMENT: { label: 'Awaiting Payment', color: 'warning', icon: CreditCard },
  CONFIRMED: { label: 'Confirmed', color: 'success', icon: CheckCircle },
  IN_PROGRESS: { label: 'Active', color: 'info', icon: Play },
  AWAITING_RETURN_INSPECTION: { label: 'Return Inspection', color: 'warning', icon: Eye },
  COMPLETED: { label: 'Completed', color: 'success', icon: CheckCircle2 },
  SETTLED: { label: 'Settled', color: 'success', icon: Banknote },
  CANCELLED: { label: 'Cancelled', color: 'destructive', icon: XCircle },
  DISPUTED: { label: 'Disputed', color: 'destructive', icon: AlertTriangle },
  REFUNDED: { label: 'Refunded', color: 'info', icon: RotateCcw },
} as const;

export const DISPUTE_STATUS = { ... } as const;
export const LISTING_STATUS = { ... } as const;
```

### 6.5 Shared Type Contracts

Create a shared types package for frontend-backend alignment:

```
packages/
  shared-types/
    src/
      booking.ts      // Booking, CreateBookingInput, BookingStatus
      listing.ts      // Listing, CreateListingInput, ListingStatus
      user.ts         // User, UpdateProfileInput
      payment.ts      // PaymentIntent, Transaction, Payout
      review.ts       // Review, CreateReviewInput
      api-response.ts // PaginatedResponse<T>, ApiError
```

Both `apps/api` and `apps/web` import from `@gharbatai/shared-types`. This eliminates the field-name mismatches found between frontend TypeScript types and backend Prisma models.

---

## 7. Implementation Plan

### Phase 1: Production Blockers (Week 1-2) 🔴

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 1.1 | Create DTO classes with class-validator for all 7 modules | 3 days | Prevents injection attacks |
| 1.2 | Implement missing 7 backend endpoints (payments, bookings) | 2 days | Fixes dead frontend pages |
| 1.3 | Wire refund execution into cancellation flow | 1 day | Renters actually get refunds |
| 1.4 | Wire settlement + auto-payout on booking completion | 1 day | Owners actually get paid |
| 1.5 | Remove duplicate webhook handler + add idempotency | 0.5 day | Prevents double charges |
| 1.6 | Register missing modules in AppModule | 0.5 day | Unlocks organizations, tax |
| 1.7 | Uncomment Prisma error handling in AllExceptionsFilter | 0.5 day | Proper 404/409 instead of 500 |
| 1.8 | Fix PaymentsController — use HttpException not Error | 0.5 day | Proper HTTP status codes |

### Phase 2: Contract & Integration Fixes (Week 2-3) 🟠

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 2.1 | Align booking/review/listing Zod schemas with backend DTOs | 2 days | Eliminates silent data loss |
| 2.2 | Create shared types package | 1 day | Single source of truth |
| 2.3 | Fix 3 pattern violations (dashboard.renter, settings.profile, insurance.upload) | 1 day | Consistent API usage |
| 2.4 | Implement geo-search (Haversine or PostGIS) | 1 day | Map search actually works |
| 2.5 | Wire `optimistic-updates.ts` into favorites + booking actions | 1 day | Snappy UI feedback |
| 2.6 | Wire `error-handler.ts` centralized handlers | 1 day | Consistent error UX |
| 2.7 | Fix messages.tsx error handling (console.error → toast) | 0.5 day | Users see send failures |
| 2.8 | Replace all 12 `alert()` calls with toast | 0.5 day | Non-blocking error UX |

### Phase 3: Missing Features & Logic (Week 3-5) 🟡

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 3.1 | Add pagination to bookings, disputes, favorites, earnings, messages | 2 days | Scalability |
| 3.2 | Wire insurance enforcement into booking creation | 1 day | Risk protection |
| 3.3 | Wire content moderation into listing/message/review creation | 1 day | Trust & safety |
| 3.4 | Create notifications list page (API module exists) | 1 day | Feature completeness |
| 3.5 | Add unread counts to navigation (messages + notifications) | 0.5 day | Engagement |
| 3.6 | Create organization detail/settings/members routes (or remove broken links) | 2 days | No dead links |
| 3.7 | Add ErrorBoundary exports to 10 high-traffic routes | 1 day | Better error recovery |
| 3.8 | Fix payment failure race condition (add PAYMENT_FAILED status) | 1 day | Checkout reliability |
| 3.9 | Implement `Promise.allSettled` partial-failure loading in dashboards | 1 day | Resilient page loads |
| 3.10 | Add deposit automation to booking lifecycle | 1 day | Deposit management |
| 3.11 | Remove push notification toggle (stubbed) or implement fully | 0.5 day | No misleading UI |
| 3.12 | Fix booking calendar — call `getBlockedDates()` for unavailable dates | 0.5 day | Accurate availability |

### Phase 4: AI/ML Integration (Week 5-7) 🟢

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 4.1 | Wire OpenAI Moderation API (existing stubs) | 1 day | Better content safety |
| 4.2 | AI listing description generator | 2 days | Reduces listing creation friction |
| 4.3 | Data-driven price suggestions | 1 day | Smarter pricing |
| 4.4 | Semantic search with pgvector embeddings | 3 days | "Podcast recording" → "Microphone" |
| 4.5 | Listing completeness score | 1 day | Higher quality listings |
| 4.6 | Collaborative filtering recommendations | 3 days | Personalized discovery |
| 4.7 | Review sentiment aggregation | 1 day | Richer owner insights |

### Phase 5: Polish & Resilience (Week 7-8)

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 5.1 | Draft saving for multi-step forms (listings, organizations) | 2 days | No data loss |
| 5.2 | Listing detail favorites + share buttons | 0.5 day | Engagement |
| 5.3 | CSV/PDF export for transactions/earnings | 1 day | Owner utility |
| 5.4 | Typing indicators in messaging | 0.5 day | Real-time feel |
| 5.5 | Admin dashboard routes (684-line API module unused) | 5 days | Platform management |

---

## 8. File-by-File Fix Registry

### Backend Files to Create

| File | Purpose |
|------|---------|
| `modules/bookings/dto/create-booking.dto.ts` | Validated booking creation |
| `modules/bookings/dto/update-booking.dto.ts` | Validated booking update |
| `modules/listings/dto/create-listing.dto.ts` | Validated listing creation |
| `modules/listings/dto/update-listing.dto.ts` | Validated listing update |
| `modules/payments/dto/create-payment-intent.dto.ts` | Validated payment intent |
| `modules/payments/dto/request-payout.dto.ts` | Validated payout request |
| `modules/reviews/dto/create-review.dto.ts` | Validated review creation |
| `modules/reviews/dto/update-review.dto.ts` | Validated review update |
| `modules/organizations/dto/create-organization.dto.ts` | Validated org creation |
| `modules/disputes/dto/create-dispute.dto.ts` | Validated dispute creation |
| `modules/messaging/dto/send-message.dto.ts` | Validated message sending |
| `modules/payments/services/refund.service.ts` | Actual Stripe refund execution |
| `modules/listings/services/listing-ai.service.ts` | AI description generation |
| `packages/shared-types/src/index.ts` | Shared frontend-backend types |

### Backend Files to Modify

| File | Changes |
|------|---------|
| `app.module.ts` | Register OrganizationsModule, TaxModule |
| `modules/payments/controllers/payments.controller.ts` | Add 5 missing endpoints (transactions, earnings, balance, payouts), fix raw Error throws |
| `modules/bookings/controllers/bookings.controller.ts` | Add missing calculate-price, blocked-dates endpoints |
| `modules/bookings/services/booking-state-machine.service.ts` | Wire settlement transition + auto-payout + refund execution |
| `modules/bookings/services/bookings.service.ts` | Add insurance check on booking creation |
| `modules/payments/webhook.controller.ts` | Add idempotency check |
| `modules/payments/payments.controller.ts` | Remove duplicate webhook endpoint |
| `modules/search/services/search.service.ts` | Add geo-search (Haversine/PostGIS), support pgvector |
| `common/filters/all-exceptions.filter.ts` | Uncomment Prisma error mapping |
| `modules/listings/services/listings.service.ts` | Add content moderation calls |
| `modules/messaging/services/conversations.service.ts` | Add content moderation on message send |

### Frontend Files to Modify

| File | Changes |
|------|---------|
| `routes/dashboard.renter.tsx` | Replace raw apiClient with API modules |
| `routes/settings.profile.tsx` | Replace raw api.patch with usersApi |
| `routes/insurance.upload.tsx` | Replace raw api calls with insuranceApi |
| `routes/bookings.tsx` | Replace alert() with toast, add pagination |
| `routes/listings.$id.edit.tsx` | Replace alert() with toast |
| `routes/listings.new.tsx` | Replace alert() with toast, add AI description button, add draft saving |
| `routes/messages.tsx` | Add user-visible error handling (replace console.error) |
| `routes/listings.$id.tsx` | Add favorites button, call getBlockedDates(), add ErrorBoundary |
| `routes/search.tsx` | Add search skeleton during loading |
| `routes/favorites.tsx` | Switch to favoritesApi, add pagination |
| `routes/insurance.tsx` | Load user policies from insuranceApi |
| `lib/validation/booking.ts` | Align Zod schema with backend DTO fields |
| `lib/validation/review.ts` | Align field names with backend |
| `lib/api-enhanced.ts` | Limit retries to idempotent methods only |

### Frontend Files to Create

| File | Purpose |
|------|---------|
| `routes/notifications.tsx` | Notification list page (API module exists) |
| `routes/organizations.$id.tsx` | Organization detail |
| `routes/organizations.$id.settings.tsx` | Organization settings |
| `routes/organizations.$id.members.tsx` | Organization members |
| `lib/status-labels.ts` | Centralized status label/color/icon mapping |
| `routes/admin/` (multiple) | Admin dashboard pages |

---

## Success Metrics

| Metric | Current | Target | How |
|--------|---------|--------|-----|
| Backend validation coverage | 1/20 modules (~5%) | 20/20 (100%) | Class-validator on all DTOs |
| Dead API endpoints | 7 | 0 | Implement or fix frontend |
| Frontend error handling | 6/30 routes solid | 30/30 solid | ErrorBoundary + toast + fallbacks |
| `alert()` calls | 12 | 0 | Replace with toast |
| Pattern violations | 3 routes | 0 | Use API modules consistently |
| Unpaginated lists | 5 routes | 0 | All lists paginated |
| AI-powered features | 0 real (4 fake) | 4+ real | Description gen, search, pricing, moderation |
| Geo-search | Broken | Functional | Haversine or PostGIS |
| Automatic refunds | Not working | Working | Wire Stripe refund into cancellation |
| Automatic payouts | Not working | Working | Wire into settlement |

---

**Document Version:** 1.0  
**Last Updated:** February 12, 2026  
**Method:** Full-stack code audit — every backend module, every frontend route, all API client files, Prisma schema, validation schemas
