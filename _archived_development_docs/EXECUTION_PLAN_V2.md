# Universal Rental Portal — Comprehensive Execution Plan v2.0

**Technology Update:** React Router v7 Framework Mode  
**Status:** Production-Ready Detailed Plan with Gap Analysis  
**Last Updated:** January 23, 2026

---

## 📋 Executive Summary

This document provides a production-grade execution plan for building a universal rental marketplace supporting 6 rental categories (spaces, vehicles, instruments, event venues, event items, wearables) with full booking lifecycle, payments, disputes, and multi-platform support.

### Document Structure

This execution plan is split into 5 comprehensive parts:

- **Part 1 (This Document):** Overview, Technology Stack, Gap Analysis, Auth & Category Systems
- **Part 2:** Features 3-4 (Booking State Machine, Payment Integration)
- **Part 3:** Features 5-7 (Search & Discovery, Messaging, Fulfillment)
- **Part 4:** Features 8-10 (Dispute Resolution, Mobile App, Admin Portal)
- **Part 5:** Infrastructure (Database, Caching, Queue, Testing, Deployment, Monitoring)

### Key Changes from V1

- ✅ **React Router v7 Framework Mode** replaces Next.js for web applications
- ✅ **Enhanced gap analysis** identifying 12 critical areas requiring attention
- ✅ **Detailed implementation strategies** for all 150+ features
- ✅ **Production-grade considerations** for scalability, security, and reliability
- ✅ **Complete TypeScript implementations** with production-ready code examples

---

## 🏗️ Technology Stack (Updated)

| Layer                | Technology                                                  | Justification                                                      |
| -------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------ |
| **Web Frontend**     | React Router v7 (Framework Mode) + TypeScript + TailwindCSS | Modern full-stack framework with SSR, streaming, type-safe routing |
| **Admin Portal**     | React Router v7 + Vite + TailwindCSS                        | Same stack for consistency, optimized for SPA admin workflows      |
| **Mobile App**       | React Native + Expo + NativeWind                            | Cross-platform with shared component library                       |
| **Backend API**      | NestJS + TypeScript + Prisma                                | Scalable, modular, production-tested                               |
| **Primary Database** | PostgreSQL 15+ with pgvector                                | ACID compliance, JSON support, vector search capability            |
| **Cache Layer**      | Redis 7+ (Cluster mode)                                     | Session storage, rate limiting, queue backend                      |
| **Search Engine**    | Elasticsearch 8+ / OpenSearch                               | Full-text search, geo-queries, faceted filtering                   |
| **Object Storage**   | AWS S3 / Cloudflare R2 + CDN                                | Scalable media storage with edge caching                           |
| **Message Queue**    | BullMQ (Redis-based)                                        | Reliable background job processing                                 |
| **Payment Provider** | Stripe Connect                                              | Marketplace payments with split payouts                            |
| **Email Service**    | SendGrid / AWS SES                                          | Transactional email with high deliverability                       |
| **Real-time**        | Socket.io + Redis Adapter                                   | WebSocket messaging with horizontal scaling                        |
| **Monitoring**       | Prometheus + Grafana + Sentry + DataDog                     | Full-stack observability                                           |
| **Infrastructure**   | AWS (Terraform IaC)                                         | ECS Fargate, RDS, ElastiCache, CloudFront                          |

### React Router v7 Framework Mode Benefits

```typescript
// 1. File-based routing with type safety
// app/routes/listings.$id.tsx
export async function loader({ params }: LoaderFunctionArgs) {
  const listing = await getListingById(params.id);
  return json({ listing });
}

// 2. Server-side rendering & streaming
export default function Listing() {
  const { listing } = useLoaderData<typeof loader>();
  return <ListingDetail listing={listing} />;
}

// 3. Action handlers for mutations
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  return await createBooking(formData);
}

// 4. Built-in error boundaries
export function ErrorBoundary() {
  const error = useRouteError();
  return <ErrorDisplay error={error} />;
}
```

**Why React Router v7 over Next.js?**

- ✅ More flexible data loading patterns (loaders/actions)
- ✅ True full-stack framework (not just React + API routes)
- ✅ Better performance for dynamic content
- ✅ Simpler deployment (single artifact)
- ✅ Excellent TypeScript support out of the box
- ✅ Built-in progressive enhancement

---

## 📊 Gap Analysis & Production Considerations

### Identified Gaps from Original Plan

#### 1. ❌ **Missing: Multi-tenancy & Organization Support**

**Gap:** No support for businesses managing fleets/portfolios
**Impact:** Cannot serve professional rental companies
**Solution:**

```typescript
// Add to Sprint 1.2 - User Management
interface Organization {
  id: UUID;
  name: string;
  type: "individual" | "business" | "enterprise";
  ownerId: UUID;
  members: OrganizationMember[];
  listings: Listing[];
  settings: OrgSettings;
}

interface OrganizationMember {
  userId: UUID;
  role: "owner" | "admin" | "manager" | "viewer";
  permissions: Permission[];
}
```

#### 2. ❌ **Missing: Insurance Integration**

**Gap:** No insurance verification for high-value items (vehicles, equipment)
**Impact:** High risk exposure, potential legal issues
**Solution:**

```typescript
// Add to Sprint 2.1 - Listings Module
interface InsurancePolicy {
  listingId: UUID;
  provider: string;
  policyNumber: string;
  coverage: Money;
  expiresAt: DateTime;
  documents: Document[];
  verificationStatus: "pending" | "verified" | "expired";
}

// Add insurance verification requirement
const listingValidation = {
  vehicles: {
    insuranceRequired: true,
    minimumCoverage: { amount: 100000, currency: "USD" },
  },
};
```

#### 3. ❌ **Missing: Fraud Detection System**

**Gap:** No proactive fraud prevention mechanisms
**Impact:** Platform vulnerable to scams, chargebacks
**Solution:**

```typescript
// Add to Phase 1 - Backend Foundation
interface FraudDetectionService {
  // Risk scoring for users
  calculateUserRiskScore(user: User): Promise<RiskScore>;

  // Booking validation
  validateBooking(booking: BookingRequest): Promise<ValidationResult>;

  // Pattern detection
  detectSuspiciousActivity(userId: UUID): Promise<Alert[]>;

  // Velocity checks
  checkBookingVelocity(userId: UUID): Promise<boolean>;
}

// Integration with booking flow
const riskRules = {
  newUser: { maxBookingValue: 500, requireDeposit: true },
  flaggedUser: { requireManualReview: true },
  highValueItem: { requireIDVerification: true },
};
```

#### 4. ❌ **Missing: Tax Calculation & Compliance**

**Gap:** No sales tax, VAT, or GST handling
**Impact:** Legal compliance issues, incorrect pricing
**Solution:**

```typescript
// Add to Sprint 2.2 - Pricing Engine
interface TaxService {
  calculateTax(booking: Booking): Promise<TaxBreakdown>;
  getApplicableJurisdictions(location: GeoLocation): Promise<TaxJurisdiction[]>;
  generate1099(owner: User, year: number): Promise<Document>;
}

interface TaxBreakdown {
  subtotal: Money;
  taxes: TaxLineItem[];
  total: Money;
}

interface TaxLineItem {
  type: "sales_tax" | "vat" | "gst" | "lodging_tax";
  jurisdiction: string;
  rate: number;
  amount: Money;
}
```

#### 5. ❌ **Missing: Content Moderation (AI-powered)**

**Gap:** Manual moderation only, no automated filtering
**Impact:** Slow moderation, inappropriate content exposure
**Solution:**

```typescript
// Add to Sprint 2.1 - Listings Module
interface ContentModerationService {
  // Image moderation
  moderateImage(imageUrl: string): Promise<ModerationResult>;

  // Text moderation
  moderateText(text: string): Promise<ModerationResult>;

  // Detection categories
  detectInappropriateListing(listing: Listing): Promise<ModerationFlags[]>;
}

interface ModerationResult {
  approved: boolean;
  confidence: number;
  flags: string[];
  categories: {
    adult: number;
    violence: number;
    spam: number;
    pii: number;
  };
}

// Integration: AWS Rekognition + OpenAI Moderation API
```

#### 6. ❌ **Missing: Dynamic Pricing & Revenue Management**

**Gap:** Static pricing only, no demand-based optimization
**Impact:** Lost revenue opportunities
**Solution:**

```typescript
// Add to Sprint 2.2 - Pricing Engine
interface DynamicPricingService {
  suggestPrice(listing: Listing, date: Date): Promise<PriceSuggestion>;
  analyzeMarket(
    category: string,
    location: GeoLocation,
  ): Promise<MarketAnalysis>;
  optimizeCalendar(listingId: UUID): Promise<PricingStrategy>;
}

interface PriceSuggestion {
  basePrice: Money;
  suggestedPrice: Money;
  confidence: number;
  factors: {
    demand: number;
    competition: number;
    seasonality: number;
    events: string[];
  };
}
```

#### 7. ❌ **Missing: Internationalization (i18n) Infrastructure**

**Gap:** English only, no multi-language support
**Impact:** Limited market reach
**Solution:**

```typescript
// Add to Phase 0 - Foundation
// Use react-i18next + i18next-http-backend

// app/i18n.server.ts
export const i18n = {
  supportedLngs: ['en', 'es', 'fr', 'de', 'ja', 'zh'],
  fallbackLng: 'en',
  defaultNS: 'common',
  backend: {
    loadPath: '/locales/{{lng}}/{{ns}}.json'
  }
};

// Database schema addition
model Translation {
  id        UUID    @id
  key       String
  language  String
  value     String
  namespace String

  @@unique([key, language, namespace])
}

// API support
GET /api/v1/translations/:namespace/:language
PUT /api/v1/admin/translations
```

#### 8. ❌ **Missing: Cancellation & Refund Automation**

**Gap:** Manual refund processing described
**Impact:** Slow refunds, customer dissatisfaction
**Solution:**

```typescript
// Add to Sprint 2.4 - Payment System
interface CancellationService {
  calculateRefund(
    booking: Booking,
    cancelledAt: DateTime,
  ): Promise<RefundCalculation>;
  processAutomaticRefund(booking: Booking): Promise<Refund>;
  applyCancellationPolicy(booking: Booking): Promise<PolicyApplication>;
}

interface RefundCalculation {
  originalAmount: Money;
  refundAmount: Money;
  penaltyAmount: Money;
  processingFee: Money;
  policyApplied: string;
  breakdown: RefundLineItem[];
}

// Automated flow
const cancellationFlow = {
  flexible: { fullRefundUntil: 24, partialRefundUntil: 0 },
  moderate: { fullRefundUntil: 5 * 24, partialRefundUntil: 24 },
  strict: { fullRefundUntil: 7 * 24, partialRefundUntil: 48 },
};
```

#### 9. ❌ **Missing: Analytics & Business Intelligence**

**Gap:** No analytics dashboards or reporting
**Impact:** Cannot measure business metrics, make data-driven decisions
**Solution:**

```typescript
// Add to Phase 6 - Admin Portal Backend
interface AnalyticsService {
  // Business metrics
  getKPIs(dateRange: DateRange): Promise<KPIDashboard>;

  // Funnel analysis
  getConversionFunnel(type: "booking" | "listing"): Promise<FunnelData>;

  // Cohort analysis
  analyzeCohorts(metric: string): Promise<CohortAnalysis>;

  // Financial reports
  getRevenueReport(period: string): Promise<RevenueReport>;
}

// Data warehouse setup
// Option 1: PostgreSQL with Timescale extension
// Option 2: ClickHouse for OLAP queries
// Option 3: AWS Redshift
```

#### 10. ❌ **Missing: Scheduled Jobs & Cron Infrastructure**

**Gap:** Background jobs mentioned but not detailed
**Impact:** Late detection of issues, inconsistent state
**Solution:**

```typescript
// Add to Phase 1 - Backend Foundation
interface ScheduledJobsService {
  // Booking lifecycle
  expirePendingBookings: CronJob; // Every 5 minutes
  sendBookingReminders: CronJob; // Hourly
  detectLateReturns: CronJob; // Every 15 minutes
  autoCompleteBookings: CronJob; // Hourly

  // Payments
  reconcilePayments: CronJob; // Daily at 2 AM
  processPayouts: CronJob; // Daily at 4 AM
  checkFailedPayments: CronJob; // Every 30 minutes

  // Search & indexing
  rebuildSearchIndex: CronJob; // Weekly
  refreshAvailability: CronJob; // Every 10 minutes

  // Cleanup
  archiveOldBookings: CronJob; // Weekly
  cleanupExpiredSessions: CronJob; // Daily
  deleteTemporaryFiles: CronJob; // Daily
}

// Implementation with BullMQ
import { Queue, Worker } from "bullmq";

const schedules = {
  "expire-pending-bookings": { cron: "*/5 * * * *" },
  "reconcile-payments": { cron: "0 2 * * *" },
};
```

#### 11. ❌ **Missing: Rate Limiting & API Throttling**

**Gap:** Basic rate limiting mentioned but not detailed
**Impact:** API abuse, DDoS vulnerability
**Solution:**

```typescript
// Add to Phase 1 - Backend Foundation
interface RateLimitService {
  // Per-endpoint limits
  checkLimit(key: string, limit: RateLimit): Promise<boolean>;

  // Adaptive throttling
  adaptiveThrottle(userId: UUID, action: string): Promise<ThrottleResult>;
}

// Configuration
const rateLimits = {
  // Public endpoints
  search: { points: 100, duration: 60 }, // 100 req/min
  "listings:view": { points: 200, duration: 60 }, // 200 req/min

  // Authenticated
  "bookings:create": { points: 10, duration: 60 }, // 10 req/min
  "messages:send": { points: 30, duration: 60 }, // 30 req/min

  // Auth endpoints (stricter)
  "auth:login": { points: 5, duration: 300 }, // 5 req/5min
  "auth:register": { points: 3, duration: 3600 }, // 3 req/hour

  // Admin endpoints
  "admin:*": { points: 1000, duration: 60 }, // 1000 req/min
};

// Implementation with Redis
// Using sliding window counter algorithm
```

#### 12. ❌ **Missing: Disaster Recovery & Backup Strategy**

**Gap:** No backup or disaster recovery plan
**Impact:** Data loss risk
**Solution:**

```typescript
// Add to Phase 11 - Infrastructure
const backupStrategy = {
  database: {
    automated: {
      frequency: "hourly",
      retention: "30 days",
      pointInTimeRecovery: true,
    },
    manual: {
      beforeMigration: true,
      beforeMajorRelease: true,
    },
  },

  files: {
    s3Versioning: true,
    crossRegionReplication: true,
    glacierArchive: "90 days",
  },

  redis: {
    rdbSnapshots: "every 6 hours",
    aofEnabled: true,
  },

  elasticsearch: {
    snapshots: "daily",
    retention: "7 days",
  },
};

// Disaster recovery procedures
const drProcedures = {
  rto: "4 hours", // Recovery Time Objective
  rpo: "1 hour", // Recovery Point Objective

  failoverSteps: [
    "Switch DNS to backup region",
    "Promote read replica to primary",
    "Restore latest snapshots",
    "Verify data integrity",
    "Resume traffic",
  ],
};
```

---

## 🏗️ Updated Project Structure (React Router v7)

```
gharbatai-rentals/
├── apps/
│   ├── web/                          # React Router v7 Customer Portal
│   │   ├── app/
│   │   │   ├── root.tsx              # Root layout with providers
│   │   │   ├── entry.client.tsx      # Client entry point
│   │   │   ├── entry.server.tsx      # Server entry point
│   │   │   ├── routes/               # File-based routing
│   │   │   │   ├── _index.tsx        # Homepage (/)
│   │   │   │   ├── _auth.tsx         # Auth layout
│   │   │   │   ├── _auth.login.tsx   # /login
│   │   │   │   ├── _auth.register.tsx
│   │   │   │   ├── search.tsx        # /search
│   │   │   │   ├── listings.$id.tsx  # /listings/:id
│   │   │   │   ├── bookings.tsx      # /bookings
│   │   │   │   ├── bookings.$id.tsx  # /bookings/:id
│   │   │   │   ├── host/             # Host dashboard routes
│   │   │   │   │   ├── _layout.tsx
│   │   │   │   │   ├── dashboard.tsx
│   │   │   │   │   ├── listings.tsx
│   │   │   │   │   └── earnings.tsx
│   │   │   │   ├── messages.tsx
│   │   │   │   ├── profile.tsx
│   │   │   │   └── api/              # API routes
│   │   │   │       ├── webhooks.stripe.tsx
│   │   │   │       └── health.tsx
│   │   │   ├── components/           # Shared components
│   │   │   ├── lib/                  # Utilities
│   │   │   │   ├── api.server.ts     # Server-side API calls
│   │   │   │   ├── auth.server.ts    # Auth utilities
│   │   │   │   ├── session.server.ts # Session management
│   │   │   │   └── db.server.ts      # Database client (if needed)
│   │   │   └── styles/
│   │   │       └── tailwind.css
│   │   ├── public/
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   ├── admin/                        # Admin Portal (React Router v7)
│   │   ├── app/
│   │   │   ├── routes/
│   │   │   │   ├── _index.tsx        # Admin dashboard
│   │   │   │   ├── users.tsx
│   │   │   │   ├── listings.tsx
│   │   │   │   ├── bookings.tsx
│   │   │   │   ├── disputes.tsx
│   │   │   │   └── reports.tsx
│   │   │   └── ...
│   │   └── package.json
│   │
│   ├── mobile/                       # React Native (unchanged)
│   │   └── ...
│   │
│   └── api/                          # NestJS Backend (unchanged)
│       ├── src/
│       │   ├── core/
│       │   ├── modules/
│       │   ├── infrastructure/
│       │   └── shared/
│       └── package.json
│
├── packages/
│   ├── ui/                           # Shared UI components
│   ├── api-client/                   # Generated API client
│   ├── shared-types/                 # TypeScript types
│   ├── validators/                   # Zod schemas
│   └── config/                       # Shared configs
│
├── infrastructure/
│   ├── docker/
│   ├── terraform/
│   └── k8s/
│
├── docs/
├── scripts/
├── turbo.json
├── package.json
└── pnpm-workspace.yaml
```

---

## 📝 Detailed Implementation Plans by Feature

### Feature 1: Authentication & Authorization (Sprint 1.2)

#### Implementation Strategy

**1.1 JWT Token Management**

```typescript
// Backend: apps/api/src/modules/auth/auth.service.ts
@Injectable()
export class AuthService {
  // Token generation with rotation
  async generateTokenPair(userId: string): Promise<TokenPair> {
    const accessToken = this.jwtService.sign(
      { sub: userId, type: "access" },
      { expiresIn: "15m" },
    );

    const refreshToken = this.jwtService.sign(
      { sub: userId, type: "refresh" },
      { expiresIn: "7d" },
    );

    // Store refresh token with expiry
    await this.redis.setex(`refresh:${userId}`, 7 * 24 * 60 * 60, refreshToken);

    return { accessToken, refreshToken };
  }

  // Token validation
  async validateAccessToken(token: string): Promise<JWTPayload> {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        throw new UnauthorizedException("Token expired");
      }
      throw new UnauthorizedException("Invalid token");
    }
  }

  // Refresh token rotation
  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    const payload = await this.validateRefreshToken(refreshToken);

    // Invalidate old refresh token
    await this.redis.del(`refresh:${payload.sub}`);

    // Generate new token pair
    return this.generateTokenPair(payload.sub);
  }
}
```

**1.2 Password Security**

```typescript
// Use Argon2 for password hashing (better than bcrypt)
import * as argon2 from "argon2";

export class PasswordService {
  async hash(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 4,
    });
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  // Password strength validation
  validateStrength(password: string): ValidationResult {
    const checks = {
      minLength: password.length >= 12,
      hasUpper: /[A-Z]/.test(password),
      hasLower: /[a-z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password),
      notCommon: !this.isCommonPassword(password),
    };

    const score = Object.values(checks).filter(Boolean).length;

    return {
      valid: score >= 5,
      score,
      checks,
      suggestions: this.generateSuggestions(checks),
    };
  }
}
```

**1.3 Rate Limiting for Auth**

```typescript
// Use Redis for distributed rate limiting
export class AuthRateLimiter {
  async checkLoginAttempts(email: string): Promise<boolean> {
    const key = `login:attempts:${email}`;
    const attempts = await this.redis.incr(key);

    if (attempts === 1) {
      // Set expiry on first attempt
      await this.redis.expire(key, 300); // 5 minutes
    }

    if (attempts > 5) {
      // Lock account temporarily
      await this.lockAccount(email, 900); // 15 minutes
      throw new TooManyRequestsException("Too many login attempts");
    }

    return true;
  }

  async resetAttempts(email: string): Promise<void> {
    await this.redis.del(`login:attempts:${email}`);
  }

  // Implement sliding window for more sophisticated rate limiting
  async checkRateLimit(
    identifier: string,
    limit: number,
    windowSeconds: number,
  ): Promise<boolean> {
    const now = Date.now();
    const key = `rate:${identifier}`;

    // Remove old entries
    await this.redis.zremrangebyscore(key, 0, now - windowSeconds * 1000);

    // Count requests in window
    const count = await this.redis.zcard(key);

    if (count >= limit) {
      return false;
    }

    // Add current request
    await this.redis.zadd(key, now, `${now}:${crypto.randomUUID()}`);
    await this.redis.expire(key, windowSeconds);

    return true;
  }
}
```

**1.4 React Router v7 Auth Integration**

```typescript
// apps/web/app/lib/auth.server.ts
import { createCookieSessionStorage, redirect } from "@remix-run/node";

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) throw new Error("SESSION_SECRET must be set");

const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
    sameSite: "lax",
    secrets: [sessionSecret],
    secure: process.env.NODE_ENV === "production",
  },
});

export async function createUserSession({
  userId,
  remember,
  redirectTo,
}: {
  userId: string;
  remember: boolean;
  redirectTo: string;
}) {
  const session = await sessionStorage.getSession();
  session.set("userId", userId);

  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session, {
        maxAge: remember ? 60 * 60 * 24 * 30 : undefined, // 30 days if remember me
      }),
    },
  });
}

export async function requireUserId(
  request: Request,
  redirectTo: string = new URL(request.url).pathname,
) {
  const userId = await getUserId(request);
  if (!userId) {
    const searchParams = new URLSearchParams([["redirectTo", redirectTo]]);
    throw redirect(`/login?${searchParams}`);
  }
  return userId;
}

export async function getUserId(request: Request): Promise<string | undefined> {
  const session = await getUserSession(request);
  const userId = session.get("userId");
  if (!userId || typeof userId !== "string") return undefined;
  return userId;
}

async function getUserSession(request: Request) {
  return sessionStorage.getSession(request.headers.get("Cookie"));
}

export async function logout(request: Request) {
  const session = await getUserSession(request);
  return redirect("/login", {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
}

// Protected loader example
export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const user = await getUserById(userId);

  if (!user) {
    throw await logout(request);
  }

  return json({ user });
}
```

**1.5 Email Verification Flow**

```typescript
// Backend verification service
export class EmailVerificationService {
  async sendVerificationEmail(user: User): Promise<void> {
    const token = crypto.randomBytes(32).toString("hex");
    const hash = await argon2.hash(token);

    // Store verification token
    await this.prisma.emailVerification.create({
      data: {
        userId: user.id,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    // Send email with verification link
    const verificationUrl = `${process.env.APP_URL}/verify-email?token=${token}`;
    await this.emailService.send({
      to: user.email,
      template: "email-verification",
      data: {
        name: user.name,
        verificationUrl,
      },
    });
  }

  async verifyEmail(token: string): Promise<User> {
    const verifications = await this.prisma.emailVerification.findMany({
      where: {
        expiresAt: { gt: new Date() },
        used: false,
      },
      include: { user: true },
    });

    // Find matching token
    for (const verification of verifications) {
      const isValid = await argon2.verify(verification.tokenHash, token);
      if (isValid) {
        // Mark as verified
        await this.prisma.$transaction([
          this.prisma.user.update({
            where: { id: verification.userId },
            data: { emailVerified: true },
          }),
          this.prisma.emailVerification.update({
            where: { id: verification.id },
            data: { used: true },
          }),
        ]);

        return verification.user;
      }
    }

    throw new BadRequestException("Invalid or expired verification token");
  }
}
```

---

### Feature 2: Category Template System (Sprint 1.3)

#### Implementation Strategy

**2.1 JSON Schema Storage & Validation**

```typescript
// Backend: apps/api/src/core/categories/template.service.ts
import Ajv from "ajv";
import addFormats from "ajv-formats";

@Injectable()
export class CategoryTemplateService {
  private ajv: Ajv;
  private templates: Map<string, CategoryTemplate> = new Map();

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      coerceTypes: true,
      useDefaults: true,
      removeAdditional: "all",
      strict: false,
    });
    addFormats(this.ajv);
  }

  async loadTemplates(): Promise<void> {
    // Load from database
    const templates = await this.prisma.categoryTemplate.findMany({
      where: { enabled: true },
      orderBy: { version: "desc" },
    });

    // Group by category, keep latest version
    const latestTemplates = new Map<string, CategoryTemplate>();
    templates.forEach((template) => {
      const existing = latestTemplates.get(template.category);
      if (
        !existing ||
        this.compareVersions(template.version, existing.version) > 0
      ) {
        latestTemplates.set(template.category, template);
      }
    });

    // Compile validators
    latestTemplates.forEach((template, category) => {
      const validator = this.ajv.compile(template.schema);
      this.templates.set(category, {
        ...template,
        validator,
      });
    });
  }

  async validateListing(listing: CreateListingDto): Promise<ValidationResult> {
    const template = this.templates.get(listing.category);
    if (!template) {
      throw new NotFoundException(
        `Template not found for category: ${listing.category}`,
      );
    }

    const valid = template.validator(listing.attributes);

    if (!valid) {
      return {
        valid: false,
        errors: template.validator.errors.map((err) => ({
          path: err.instancePath,
          message: err.message,
          keyword: err.keyword,
          params: err.params,
        })),
      };
    }

    return { valid: true, errors: [] };
  }

  // Generate UI fields from schema
  generateUIFields(category: string): UIField[] {
    const template = this.templates.get(category);
    if (!template) return [];

    return this.schemaToUIFields(template.schema);
  }

  private schemaToUIFields(schema: JSONSchema, parentPath = ""): UIField[] {
    const fields: UIField[] = [];
    const properties = schema.properties || {};
    const required = schema.required || [];

    Object.entries(properties).forEach(([key, prop]: [string, any]) => {
      const path = parentPath ? `${parentPath}.${key}` : key;

      const field: UIField = {
        name: key,
        path,
        label: this.generateLabel(key),
        type: this.mapJsonTypeToUIType(prop),
        required: required.includes(key),
        validation: this.extractValidation(prop),
        description: prop.description,
        placeholder: prop.examples?.[0],
      };

      // Handle enums
      if (prop.enum) {
        field.options = prop.enum.map((value) => ({
          value,
          label: this.generateLabel(value),
        }));
      }

      // Handle nested objects
      if (prop.type === "object" && prop.properties) {
        field.children = this.schemaToUIFields(prop, path);
      }

      // Handle arrays
      if (prop.type === "array") {
        field.itemType = this.mapJsonTypeToUIType(prop.items);
        if (prop.items.enum) {
          field.options = prop.items.enum.map((value) => ({
            value,
            label: this.generateLabel(value),
          }));
        }
      }

      fields.push(field);
    });

    return fields;
  }

  private mapJsonTypeToUIType(prop: any): UIFieldType {
    const format = prop.format;
    const type = prop.type;

    if (format === "date") return "date";
    if (format === "date-time") return "datetime";
    if (format === "email") return "email";
    if (format === "url") return "url";
    if (prop.enum) return "select";

    if (type === "string") {
      if (prop.maxLength > 200) return "textarea";
      return "text";
    }

    if (type === "number" || type === "integer") return "number";
    if (type === "boolean") return "checkbox";
    if (type === "array") return "array";
    if (type === "object") return "object";

    return "text";
  }

  private extractValidation(prop: any): ValidationRule[] {
    const rules: ValidationRule[] = [];

    if (prop.minLength)
      rules.push({ type: "minLength", value: prop.minLength });
    if (prop.maxLength)
      rules.push({ type: "maxLength", value: prop.maxLength });
    if (prop.minimum) rules.push({ type: "min", value: prop.minimum });
    if (prop.maximum) rules.push({ type: "max", value: prop.maximum });
    if (prop.pattern) rules.push({ type: "pattern", value: prop.pattern });

    return rules;
  }

  // Schema migration
  async migrateListingSchema(
    listingId: string,
    fromVersion: string,
    toVersion: string,
  ): Promise<void> {
    const migration = await this.prisma.schemaMigration.findUnique({
      where: {
        category_fromVersion_toVersion: {
          category: listing.category,
          fromVersion,
          toVersion,
        },
      },
    });

    if (!migration) {
      throw new NotFoundException("Migration not found");
    }

    // Execute migration script
    const migrationFn = new Function("attributes", migration.script);
    const migratedAttributes = migrationFn(listing.attributes);

    await this.prisma.listing.update({
      where: { id: listingId },
      data: {
        attributes: migratedAttributes,
        templateVersion: toVersion,
      },
    });
  }
}
```

**2.2 Category Template Definitions**

```json
// config/categories/vehicles.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "Vehicle Rental",
  "description": "Schema for vehicle rental listings",
  "required": [
    "vehicleType",
    "make",
    "model",
    "year",
    "transmission",
    "fuelType",
    "pickupLocation"
  ],
  "properties": {
    "vehicleType": {
      "type": "string",
      "title": "Vehicle Type",
      "enum": [
        "car",
        "suv",
        "truck",
        "van",
        "motorcycle",
        "scooter",
        "rv",
        "boat"
      ],
      "description": "Type of vehicle"
    },
    "make": {
      "type": "string",
      "title": "Make",
      "minLength": 2,
      "maxLength": 50,
      "examples": ["Toyota", "Honda", "Ford"]
    },
    "model": {
      "type": "string",
      "title": "Model",
      "minLength": 1,
      "maxLength": 50,
      "examples": ["Camry", "Civic", "F-150"]
    },
    "year": {
      "type": "integer",
      "title": "Year",
      "minimum": 1990,
      "maximum": 2026
    },
    "transmission": {
      "type": "string",
      "title": "Transmission",
      "enum": ["automatic", "manual", "cvt"]
    },
    "fuelType": {
      "type": "string",
      "title": "Fuel Type",
      "enum": ["gasoline", "diesel", "electric", "hybrid", "plug-in-hybrid"]
    },
    "seats": {
      "type": "integer",
      "title": "Number of Seats",
      "minimum": 1,
      "maximum": 15,
      "default": 5
    },
    "doors": {
      "type": "integer",
      "title": "Number of Doors",
      "minimum": 2,
      "maximum": 6,
      "default": 4
    },
    "color": {
      "type": "string",
      "title": "Exterior Color",
      "maxLength": 30
    },
    "mileage": {
      "type": "integer",
      "title": "Current Mileage",
      "minimum": 0,
      "description": "Current odometer reading in miles/km"
    },
    "features": {
      "type": "array",
      "title": "Features",
      "items": {
        "type": "string",
        "enum": [
          "air_conditioning",
          "bluetooth",
          "gps",
          "backup_camera",
          "cruise_control",
          "heated_seats",
          "sunroof",
          "leather_seats",
          "apple_carplay",
          "android_auto",
          "usb_charging",
          "child_seat_anchors",
          "roof_rack",
          "tow_hitch"
        ]
      },
      "uniqueItems": true,
      "maxItems": 15
    },
    "pickupLocation": {
      "type": "object",
      "title": "Pickup Location",
      "required": ["address", "city", "state", "zipCode"],
      "properties": {
        "address": { "type": "string", "minLength": 5 },
        "city": { "type": "string", "minLength": 2 },
        "state": { "type": "string", "minLength": 2, "maxLength": 2 },
        "zipCode": { "type": "string", "pattern": "^\\d{5}(-\\d{4})?$" },
        "instructions": { "type": "string", "maxLength": 500 }
      }
    },
    "licensePlate": {
      "type": "string",
      "title": "License Plate",
      "minLength": 2,
      "maxLength": 20
    },
    "vin": {
      "type": "string",
      "title": "VIN (Vehicle Identification Number)",
      "pattern": "^[A-HJ-NPR-Z0-9]{17}$",
      "description": "17-character VIN"
    },
    "insurance": {
      "type": "object",
      "title": "Insurance Information",
      "required": ["provider", "policyNumber", "expiresAt"],
      "properties": {
        "provider": { "type": "string", "minLength": 2 },
        "policyNumber": { "type": "string", "minLength": 5 },
        "expiresAt": { "type": "string", "format": "date" },
        "coverage": {
          "type": "object",
          "properties": {
            "liability": { "type": "number", "minimum": 0 },
            "collision": { "type": "number", "minimum": 0 },
            "comprehensive": { "type": "number", "minimum": 0 }
          }
        }
      }
    },
    "maintenanceRecords": {
      "type": "array",
      "title": "Maintenance Records",
      "items": {
        "type": "object",
        "properties": {
          "date": { "type": "string", "format": "date" },
          "type": { "type": "string" },
          "mileage": { "type": "integer" },
          "notes": { "type": "string", "maxLength": 500 }
        }
      }
    },
    "restrictions": {
      "type": "object",
      "title": "Rental Restrictions",
      "properties": {
        "minimumAge": {
          "type": "integer",
          "minimum": 18,
          "maximum": 99,
          "default": 25
        },
        "maximumAge": { "type": "integer", "minimum": 18, "maximum": 99 },
        "licenseRequired": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": ["standard", "commercial", "motorcycle", "international"]
          }
        },
        "minimumDrivingExperience": {
          "type": "integer",
          "description": "Minimum years of driving experience",
          "minimum": 0
        },
        "smokingAllowed": { "type": "boolean", "default": false },
        "petsAllowed": { "type": "boolean", "default": false },
        "mileageLimit": {
          "type": "object",
          "properties": {
            "type": {
              "type": "string",
              "enum": ["unlimited", "per_day", "total"]
            },
            "limit": { "type": "integer", "minimum": 0 },
            "overageFee": { "type": "number", "minimum": 0 }
          }
        }
      }
    }
  }
}
```

Similar comprehensive schemas needed for:

- Spaces (600+ lines)
- Instruments (400+ lines)
- Event Venues (500+ lines)
- Event Items (450+ lines)
- Wearables (400+ lines)

**2.3 Frontend Dynamic Form Generation**

```typescript
// apps/web/app/components/DynamicForm.tsx
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

interface DynamicFormProps {
  fields: UIField[];
  onSubmit: (data: any) => Promise<void>;
  defaultValues?: any;
}

export function DynamicForm({ fields, onSubmit, defaultValues }: DynamicFormProps) {
  const form = useForm({
    defaultValues,
    resolver: zodResolver(generateZodSchema(fields))
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {fields.map(field => (
          <FormField
            key={field.path}
            control={form.control}
            name={field.path}
            render={({ field: formField }) => (
              <DynamicFieldRenderer
                field={field}
                formField={formField}
                form={form}
              />
            )}
          />
        ))}

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Saving...' : 'Save'}
        </Button>
      </form>
    </Form>
  );
}

function DynamicFieldRenderer({ field, formField, form }) {
  switch (field.type) {
    case 'text':
    case 'email':
    case 'url':
      return (
        <FormItem>
          <FormLabel>{field.label}</FormLabel>
          <FormControl>
            <Input {...formField} type={field.type} placeholder={field.placeholder} />
          </FormControl>
          {field.description && <FormDescription>{field.description}</FormDescription>}
          <FormMessage />
        </FormItem>
      );

    case 'textarea':
      return (
        <FormItem>
          <FormLabel>{field.label}</FormLabel>
          <FormControl>
            <Textarea {...formField} placeholder={field.placeholder} rows={4} />
          </FormControl>
          <FormMessage />
        </FormItem>
      );

    case 'number':
      return (
        <FormItem>
          <FormLabel>{field.label}</FormLabel>
          <FormControl>
            <Input
              {...formField}
              type="number"
              onChange={e => formField.onChange(Number(e.target.value))}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      );

    case 'select':
      return (
        <FormItem>
          <FormLabel>{field.label}</FormLabel>
          <Select onValueChange={formField.onChange} defaultValue={formField.value}>
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder={field.placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {field.options?.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      );

    case 'checkbox':
      return (
        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
          <FormControl>
            <Checkbox
              checked={formField.value}
              onCheckedChange={formField.onChange}
            />
          </FormControl>
          <div className="space-y-1 leading-none">
            <FormLabel>{field.label}</FormLabel>
            {field.description && <FormDescription>{field.description}</FormDescription>}
          </div>
        </FormItem>
      );

    case 'date':
      return (
        <FormItem className="flex flex-col">
          <FormLabel>{field.label}</FormLabel>
          <Popover>
            <PopoverTrigger asChild>
              <FormControl>
                <Button variant="outline">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formField.value ? format(formField.value, 'PPP') : 'Pick a date'}
                </Button>
              </FormControl>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={formField.value}
                onSelect={formField.onChange}
              />
            </PopoverContent>
          </Popover>
          <FormMessage />
        </FormItem>
      );

    case 'array':
      const { fields: arrayFields, append, remove } = useFieldArray({
        control: form.control,
        name: field.path
      });

      return (
        <FormItem>
          <FormLabel>{field.label}</FormLabel>
          <div className="space-y-2">
            {arrayFields.map((item, index) => (
              <div key={item.id} className="flex gap-2">
                <FormField
                  control={form.control}
                  name={`${field.path}.${index}`}
                  render={({ field: arrayItemField }) => (
                    <FormControl>
                      <Input {...arrayItemField} />
                    </FormControl>
                  )}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => remove(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append('')}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add {field.label}
            </Button>
          </div>
          <FormMessage />
        </FormItem>
      );

    case 'object':
      return (
        <div className="space-y-4 rounded-lg border p-4">
          <h3 className="font-medium">{field.label}</h3>
          {field.children?.map(childField => (
            <FormField
              key={childField.path}
              control={form.control}
              name={childField.path}
              render={({ field: childFormField }) => (
                <DynamicFieldRenderer
                  field={childField}
                  formField={childFormField}
                  form={form}
                />
              )}
            />
          ))}
        </div>
      );

    default:
      return null;
  }
}

// Generate Zod schema from UI fields
function generateZodSchema(fields: UIField[]): z.ZodSchema {
  const shape: Record<string, z.ZodTypeAny> = {};

  fields.forEach(field => {
    let schema: z.ZodTypeAny;

    switch (field.type) {
      case 'text':
      case 'email':
      case 'url':
      case 'textarea':
        schema = z.string();
        field.validation?.forEach(rule => {
          if (rule.type === 'minLength') schema = schema.min(rule.value);
          if (rule.type === 'maxLength') schema = schema.max(rule.value);
          if (rule.type === 'pattern') schema = schema.regex(new RegExp(rule.value));
        });
        if (field.type === 'email') schema = schema.email();
        if (field.type === 'url') schema = schema.url();
        break;

      case 'number':
        schema = z.number();
        field.validation?.forEach(rule => {
          if (rule.type === 'min') schema = schema.min(rule.value);
          if (rule.type === 'max') schema = schema.max(rule.value);
        });
        break;

      case 'checkbox':
        schema = z.boolean();
        break;

      case 'date':
      case 'datetime':
        schema = z.date();
        break;

      case 'select':
        schema = z.enum(field.options.map(o => o.value));
        break;

      case 'array':
        const itemSchema = generateItemSchema(field.itemType);
        schema = z.array(itemSchema);
        break;

      case 'object':
        schema = z.object(generateZodSchema(field.children || []));
        break;

      default:
        schema = z.string();
    }

    if (!field.required) {
      schema = schema.optional();
    }

    shape[field.name] = schema;
  });

  return z.object(shape);
}
```

---

_This is Part 1 of the comprehensive plan. Due to length constraints, shall I continue with:_

**Part 2: Detailed Implementation Plans for:**

- Feature 3: Booking State Machine & Lifecycle Management
- Feature 4: Payment Integration & Ledger System
- Feature 5: Search & Discovery Infrastructure
- Feature 6: Messaging & Real-time Communication
- Feature 7: Fulfillment & Condition Reports
- Feature 8: Dispute Resolution System
- Feature 9: Mobile App Architecture
- Feature 10: Admin Portal Implementation

**Part 3: Production Infrastructure:**

- Database schema details
- Caching strategies
- Queue management
- Monitoring & alerting
- Security hardening
- Deployment strategies
- Disaster recovery

**Part 4: Testing & Quality Assurance:**

- Unit testing strategies
- Integration testing
- E2E testing
- Performance testing
- Security testing

Would you like me to continue with the complete detailed implementation plans?
