# Deep Production Readiness Audit — API Source Code
**Date:** 2025  
**Scope:** `apps/api/src` — 338 TypeScript source files across 30+ modules  
**Method:** Full source read + targeted grep analysis across all modules

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 4     |
| High     | 8     |
| Medium   | 12    |
| Low / Config | 9  |
| **Total** | **33** |

---

## Critical

### C-1 — `GET /auth/dev-config` exposes `DEV_LOGIN_SECRET` to unauthenticated callers

**File:** `apps/api/src/modules/auth/controllers/auth.controller.ts`

The endpoint returns `{ secret: DEV_LOGIN_SECRET }` to any unauthenticated HTTP caller when `NODE_ENV === 'development'`. The `DEV_LOGIN_SECRET` is intended to gate the DevUserSwitcher UI widget, but this endpoint renders the gate meaningless — any caller that can reach the API in dev mode retrieves the secret with no credentials.

```ts
// No @UseGuards(...) decorator — unauthenticated
@Get('dev-config')
getDevConfig() {
  if (this.configService.get('NODE_ENV') === 'development') {
    return { secret: this.configService.get('DEV_LOGIN_SECRET') };
  }
  throw new NotFoundException();
}
```

**Fix:** Ship the secret to the frontend via a build-time `NEXT_PUBLIC_DEV_LOGIN_SECRET` env var only. Remove the `/auth/dev-config` endpoint entirely. If it must exist, restrict it to `127.0.0.1` via a request IP guard.

---

### C-2 — `DELETE /upload/:key` has no file ownership check

**File:** `apps/api/src/common/storage/upload.controller.ts`

The route requires a valid JWT but does not verify that the requesting user owns the file identified by `key`. Any authenticated user can delete (or obtain a signed URL for) any stored object by guessing or discovering the key.

```ts
@Delete(':key')
@UseGuards(JwtAuthGuard)               // identity only — no ownership assertion
async deleteFile(@Param('key') key: string) {
  await this.storageService.deleteFile(key);
  return { success: true };
}
```

The same gap applies to `GET /upload/signed-url/:key`.

**Fix:** Store `uploadedBy: userId` alongside each upload record (or encode the user ID into the key prefix). Assert ownership before any destructive or confidential-URL operation. Return `403 Forbidden` on mismatch.

---

### C-3 — Hardcoded AES-256-GCM fallback key in `FieldEncryptionService`

**File:** `apps/api/src/common/encryption/field-encryption.service.ts`

When `FIELD_ENCRYPTION_KEY` is not set, the service silently falls back to a hardcoded 64-hex-character key baked into source code. Any data encrypted under this key is decryptable by anyone with the repository.

```ts
const devKey = '0011223344556677889900aabbccddeeff0011223344556677889900aabbccdd';
const keyHex = this.configService.get<string>('FIELD_ENCRYPTION_KEY') || devKey;
```

Affected fields include MFA TOTP secrets and government ID numbers.

**Fix:** Remove the fallback entirely. Throw at startup (matching the pattern already used for `JWT_SECRET` in `main.ts`) if `FIELD_ENCRYPTION_KEY` is absent.

---

### C-4 — `STRIPE_TEST_BYPASS=true` silently fakes all payment processing on non-production envs

**File:** `apps/api/src/modules/payments/services/stripe.service.ts`

When `STRIPE_TEST_BYPASS=true`, `createPaymentIntent` and `createDepositHold` return synthetic `pi_TEST_*` IDs without contacting Stripe. The guard only throws on `NODE_ENV=production`:

```ts
const nodeEnv = configService.get<string>('nodeEnv') || process.env.NODE_ENV;
if (configService.get<string>('STRIPE_TEST_BYPASS') === 'true' && nodeEnv === 'production') {
  throw new Error('STRIPE_TEST_BYPASS=true is not permitted in production.');
}
```

A staging environment with `NODE_ENV=staging` and `STRIPE_TEST_BYPASS=true` (e.g., a misconfigured CI deployment) would accept all "payments" without any real charge.

**Fix:** Change the condition to permit bypass **only** when `NODE_ENV === 'test' || NODE_ENV === 'development'`. Staging and preview environments should never bypass payment processing.

---

## High

### H-1 — Fraud detection thresholds are USD-denominated on an NPR-currency platform

**Files:**  
`apps/api/src/modules/fraud-detection/services/fraud-detection.service.ts`  
`apps/api/src/modules/fraud-detection/services/ml-fraud-detection.service.ts`

```ts
if (bookingData.totalPrice > 500) riskScore += 20;  // "HIGH_VALUE_NEW_USER"
if (bookingData.totalPrice > 300) riskScore += 15;  // "SUSPICIOUS_AMOUNT"
```

500 NPR ≈ $3.75 USD. Nearly every booking on this Nepal-focused platform trips the "HIGH_VALUE" threshold, flooding the fraud review queue with false positives and rendering the fraud signal useless. The issue also affects `shouldBlock()` which can hard-block users at checkout.

**Fix:** Load thresholds from config (e.g., `FRAUD_HIGH_VALUE_THRESHOLD=50000` for NPR) or multiply hardcoded USD values by the local currency exchange rate.

---

### H-2 — Image moderation is a complete stub; all uploaded photos are unvetted

**File:** `apps/api/src/modules/moderation/services/image-moderation.service.ts`

Every detection and moderation method returns empty or zero values:

| Method | Returns |
|--------|---------|
| `callImageModerationAPI()` | `null` always |
| `moderateWithRekognition()` | `[]` (implementation commented out) |
| `moderateWithVision()` | `[]` (implementation commented out) |
| `detectFaces()` | `{ faceCount: 0, confidence: 0 }` |
| `detectTextInImage()` | `[]` |
| `checkImageQuality()` | `{ resolution: {width:0, height:0}, isLowQuality: false }` |

When `FEATURE_IMAGE_MODERATION=false` (the default), every listing image is marked `PENDING_HUMAN_REVIEW` and routed to a manual queue that will grow unbounded with no automation to triage it.

**Fix:** Integrate at least one real provider. The Rekognition and Google Vision code exists but is commented out — uncomment, configure credentials, and enable the feature flag.

---

### H-3 — Insurance verification is a complete stub; every policy routes to manual review

**File:** `apps/api/src/modules/insurance/services/insurance-verification.service.ts`

```ts
async runAutomatedChecks(...): Promise<AutomatedCheckResult> {
  // OCR extraction not implemented — returning empty (manual review required)
  return { passed: false, requiresManualReview: true, confidence: 0 };
}

async extractPolicyDetails(documentUrl: string): Promise<Partial<PolicyDetails>> {
  return {};   // stub
}
```

All insurance documents submitted consume manual review capacity. No automated verification occurs.

**Fix:** Implement OCR extraction (AWS Textract, Google Document AI, or equivalent) and add real validation logic before launch.

---

### H-4 — Scheduled notifications are stored in the DB but never delivered

**File:** `apps/api/src/modules/notifications/services/notifications.service.ts`

```ts
// MVP: scheduling not fully implemented
// Scheduled notifications are stored but not actually scheduled for delivery
```

Any notification with `scheduledFor` set is written to the `Notification` table and silently dropped. Reminder emails, pre-booking alerts, and any feature that depends on deferred delivery silently never send.

**Fix:** Add a Bull recurring job or a cron task that polls `WHERE scheduledFor <= NOW() AND status = 'PENDING'` and dispatches those notifications.

---

### H-5 — Review eligibility window uses `booking.updatedAt` instead of `completedAt`

**File:** `apps/api/src/modules/reviews/services/reviews.service.ts`

```ts
const cutoffDate = new Date(booking.updatedAt);
cutoffDate.setDate(cutoffDate.getDate() - 30);
if (new Date() > cutoffDate) throw new BadRequestException('Review window has closed');
```

`updatedAt` changes on any write to the booking record (status changes, admin edits, metadata patches). Any update resets the 30-day review window, allowing renters or admins to keep it open indefinitely.

**Fix:** Use `booking.completedAt` (set once during the `COMPLETE` state transition) as the baseline for the review window.

---

### H-6 — `ml-fraud-detection.service.ts` is entirely rule-based; configured ML endpoint is never called

**File:** `apps/api/src/modules/fraud-detection/services/ml-fraud-detection.service.ts`

```ts
// Despite the 'ML' name, scoring is currently implemented as a weighted rule-based heuristic.
// A real ML model integration is planned but not yet built.
```

`this.modelEndpoint` and `this.apiKey` are read from config but never referenced in the implementation. Any configuration of `ML_FRAUD_MODEL_ENDPOINT` has no effect.

**Fix (short-term):** Rename to `HeuristicFraudScoringService` and remove the dead config fields to prevent confusion. **Fix (long-term):** Implement the ML model call or remove the class.

---

### H-7 — `auth.service.ts` login leaks account existence via status check order

**File:** `apps/api/src/modules/auth/services/auth.service.ts`

Account status is checked **before** password verification:

```ts
if (user.status !== UserStatus.ACTIVE) {
  throw new UnauthorizedException('Account suspended or inactive');
}
// password check comes after
```

An attacker can distinguish "account exists but is suspended" from "wrong password" by the distinct error message, enabling targeted account enumeration.

**Fix:** Always run `bcrypt.compare` first, regardless of account status. Return a generic `'Invalid credentials'` message for all failure cases; differentiate only in internal log entries.

---

### H-8 — `DistributedLockService.releaseLock()` has a TOCTOU race condition

**File:** `apps/api/src/common/locking/distributed-lock.service.ts`

The lock release uses a non-atomic GET-then-DELETE:

```ts
// Lua script noted as needed but not implemented — "simple approach" used instead
const currentValue = await this.cacheService.get(lockKey);   // read
if (currentValue === lockValue) {
  await this.cacheService.delete(lockKey);                   // separate write
}
```

Between the `GET` and `DELETE`, a concurrent process could acquire the lock (after TTL expiry). This race releases a lock that no longer belongs to the caller, breaking the distributed locking guarantee used to prevent double-bookings.

**Fix:** Implement `cacheService.compareAndDelete(key, expectedValue)` using a Redis Lua script:
```lua
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
```

---

## Medium

### M-1 — All marketplace payment plugins bypass `ConfigService`

**Files:**  
`apps/api/src/modules/marketplace/providers/khalti-payment.plugin.ts`  
`apps/api/src/modules/marketplace/providers/bkash-payment.plugin.ts`  
`apps/api/src/modules/marketplace/providers/esewa-payment.plugin.ts`  
`apps/api/src/modules/marketplace/providers/razorpay-payment.plugin.ts`

All four plugins read secrets via `process.env.X` directly, bypassing the NestJS `ConfigService` and the Joi validation schema. Missing variables are silently `undefined` and may cause runtime failures mid-transaction:

```ts
// khalti-payment.plugin.ts
this.secretKey = process.env.KHALTI_SECRET_KEY || '';

// bkash-payment.plugin.ts
this.appKey = process.env.BKASH_APP_KEY || '';
```

**Fix:** Inject `ConfigService` into each plugin class. Add the required keys to the Joi schema in `configuration.ts` so missing values are caught at startup.

---

### M-2 — bKash OAuth access token cached in instance memory, not Redis

**File:** `apps/api/src/modules/marketplace/providers/bkash-payment.plugin.ts`

```ts
private accessToken: string | null = null;
private tokenExpiry: Date | null = null;
```

The token is stored per-process-instance. On pod restart, rollout, or horizontal scaling, each new instance re-authenticates independently. This increases load on the bKash token endpoint and causes brief auth failure windows during deployments.

**Fix:** Cache the token in Redis with a TTL of `(tokenExpiry - 5 minutes)`.

---

### M-3 — `nodemailer` transporter created unconditionally even when Resend is the active provider

**File:** `apps/api/src/modules/notifications/services/notifications.service.ts`

`nodemailer.createTransport()` is always called in the constructor, even when `SMTP_HOST` is unset (i.e., when Resend is in use). This creates a broken transporter that emits auth errors into the log on every attempted send.

**Fix:**
```ts
if (this.configService.get('SMTP_HOST')) {
  this.smtpTransport = nodemailer.createTransport({ ... });
}
```

---

### M-4 — Fraud detection can hard-block legitimate users (related to H-1)

**File:** `apps/api/src/modules/fraud-detection/services/fraud-detection.service.ts`

`shouldBlock()` returns `true` for `CRITICAL` severity **or** `HIGH` severity with at least one critical factor. Because the USD thresholds (H-1) flag virtually every NPR booking as `HIGH_VALUE`, a new user making their first normal-priced rental can be hard-blocked at checkout.

**Fix:** Same as H-1. Additionally, reconsider whether `HIGH + any_critical_factor` should hard-block vs. flag for human review.

---

### M-5 — Admin force-status endpoint bypasses booking state machine; dual-purpose with E2E tests

**File:** `apps/api/src/modules/admin/controllers/admin.controller.ts`

```ts
// PATCH /admin/bookings/:id/status
// Force-set booking status — bypasses state machine
// "Intended for admin intervention AND E2E test environments"
```

An admin role user can set any booking to any status without transition precondition validation (payment verification, escrow checks, etc.). Combining emergency admin tooling with E2E test tooling on the same endpoint is risky.

**Fix:** Separate concerns: E2E test state manipulation should require `STRIPE_TEST_BYPASS=true` to be active (as `bookings-dev.controller.ts` already enforces). The admin override endpoint should be restricted to `SUPER_ADMIN` only and must write an audit log entry for every use.

---

### M-6 — Price calculation and blocked-dates endpoints are unauthenticated

**File:** `apps/api/src/modules/bookings/controllers/bookings.controller.ts`

`POST /bookings/calculate-price` and `GET /bookings/blocked-dates/:listingId` have no `@UseGuards(JwtAuthGuard)`. The price calculation endpoint exposes pricing rules, discount tiers, and tax logic to anonymous callers.

**Fix:** If anonymous access is intentional, document it. Otherwise add `@UseGuards(JwtAuthGuard)` to both endpoints.

---

### M-7 — Booking creation silently proceeds when tax calculation fails

**File:** `apps/api/src/modules/bookings/services/bookings.service.ts`

```ts
try {
  tax = await this.taxService.calculate(...);
} catch {
  taxCalculationFailed = true;
  // booking is created anyway with metadata.taxCalculationFailed = true
}
```

A user could exploit a transient tax service failure to complete a booking at pre-tax prices. The platform only discovers the underpayment after the fact via manual metadata review.

**Fix:** Fail the booking atomically if tax calculation fails. Retry with a short backoff (2–3 attempts) before returning an error to the user.

---

### M-8 — `search.service.ts` ILIKE query without full-text index causes full table scans

**File:** `apps/api/src/modules/search/services/search.service.ts`

```ts
await this.prisma.$queryRawUnsafe(
  `SELECT * FROM "Listing" WHERE title ILIKE '%' || $1 || '%' ...`,
  query,
);
```

The query is correctly parameterized (no SQL injection risk), but ILIKE with a leading wildcard cannot use a B-tree index and performs a sequential scan at any table size. Additionally, geo search fetches `size * 5` rows and filters them in application memory rather than in the database.

**Fix:** Add a `pg_trgm` GIN index on `title` (and other searchable text columns), or migrate to PostgreSQL `tsvector` full-text search. Push geo bounding-box filtering into the SQL `WHERE` clause.

---

### M-9 — `chaos-engineering.service.ts` mutates `process.env` at runtime

**File:** `apps/api/src/modules/chaos-engineering/services/chaos-engineering.service.ts`

```ts
process.env.SENDGRID_MOCK_FAILURE = 'true';
```

Mutating `process.env` at runtime is not safe in multi-pod deployments. Only the pod receiving the chaos request is affected; others continue normally, making failure injection unreliable.

**Fix:** Use a Redis feature flag: set a key in Redis, have the service check that key before each operation.

---

### M-10 — `GET /upload/presigned` does not validate MIME type or upload path

**File:** `apps/api/src/common/storage/upload.controller.ts`

Arbitrary `mimeType` and `folder` values are accepted without validation. This can be used to store content with spoofed MIME types, or to write files outside expected folder prefixes (e.g., into another user's folder).

**Fix:** Validate `mimeType` against an allowlist (`image/jpeg`, `image/png`, `application/pdf`, etc.) and validate `folder` against the user's permitted path prefixes.

---

### M-11 — `CORS_ORIGINS` defaults to `'*'` in non-production environments

**File:** `apps/api/src/main.ts`

```ts
if (isWildcard && process.env.NODE_ENV === 'production') {
  throw new Error('Wildcard CORS origin is not allowed in production.');
}
```

Staging environments without `CORS_ORIGINS` set receive wildcard CORS, enabling cross-origin requests from any domain against real staging data.

**Fix:** Extend the check: throw for `NODE_ENV === 'production' || NODE_ENV === 'staging'`. Or require `CORS_ORIGINS` to be explicitly set in any deployed environment.

---

### M-12 — Bull module and `CacheService` use different Redis port defaults

**File:** `apps/api/src/app.module.ts`

```ts
BullModule.forRootAsync({
  useFactory: () => ({
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),   // default: 6379
    },
  }),
}),
```

`configuration.ts` defaults `REDIS_PORT` to `3479`. Bull reads `process.env` with default `6379`. When `REDIS_PORT` is not set, Bull connects to port 6379 while `CacheService` connects to 3479 — two different Redis instances in development, silently.

**Fix:** Remove the direct `process.env` read in `BullModule`; inject `ConfigService` and use `configService.get('redis.port')`.

---

## Low / Configuration

### L-1 — `.env.example` contains insecure placeholder credential strings

**File:** `apps/api/.env.example`

| Variable | Placeholder Value | Issue |
|----------|------------------|-------|
| `JWT_SECRET` | `CHANGE_THIS_IN_PRODUCTION_USE_CRYPT0_RANDOM_64...` | Typo: `CRYPT0` not `CRYPTO`; looks like a real string if copy-pasted |
| `AWS_ACCESS_KEY_ID` | `minioadmin` | Real MinIO credential documented in source |
| `AWS_SECRET_ACCESS_KEY` | `minioadmin123` | Same |
| `STRIPE_SECRET_KEY` | `sk_test_your_stripe_secret_key` | Non-functional but looks real |
| `DATABASE_URL` | contains `rental_password` | Dev password in source |

**Fix:** Replace all credential placeholders with `REPLACE_ME`. Add a pre-deploy check that asserts no `REPLACE_ME` values remain in the container's environment.

---

### L-2 — CDN defaults hardcode `gharbatai.com` brand domains

**File:** `apps/api/src/config/configuration.ts`

```ts
cdnUrl: process.env.CDN_URL || 'https://cdn.gharbatai.com',
imageBaseUrl: process.env.IMAGE_BASE_URL || 'https://images.gharbatai.com',
```

Any environment without explicit CDN config silently serves assets from the brand domain. Re-branding or CDN migration would silently break images until the env var is set.

**Fix:** Remove the defaults. Fail fast if `CDN_URL` or `IMAGE_BASE_URL` are absent in non-development environments.

---

### L-3 — `firebase-admin` loaded via `require()` inside a private method

**File:** `apps/api/src/modules/notifications/services/push-notification.service.ts`

```ts
private async sendToFCM(...) {
  const admin = require('firebase-admin');   // dynamic require inside method
  if (!admin.apps.length) { admin.initializeApp(...); }
}
```

This bypasses TypeScript module resolution, hides the dependency from `package.json` analysis, and relies on mutable global state. Firebase initialization failures surface at first push attempt, not at startup.

**Fix:** Import `firebase-admin` at module scope. Initialize inside the constructor; set a `firebaseEnabled = false` flag on failure.

---

### L-4 — `listings.service.ts` reads `DEFAULT_CURRENCY` via `process.env` directly

**File:** `apps/api/src/modules/listings/services/listings.service.ts`

```ts
currency: dto.currency || process.env.DEFAULT_CURRENCY || 'NPR'
```

Bypasses `ConfigService` and the Joi validation schema. Inject `ConfigService` and read via `this.configService.get('DEFAULT_CURRENCY')`.

---

### L-5 — Swagger docs exposed without authentication on staging/preview environments

**File:** `apps/api/src/main.ts`

```ts
if (configService.get('NODE_ENV') !== 'production') {
  SwaggerModule.setup('api/docs', app, document);  // no auth
}
```

Full API schema, including internal admin endpoints, is publicly accessible on any non-production deployment.

**Fix:** Add HTTP basic auth to the Swagger route for non-development environments. Development can remain unrestricted.

---

### L-6 — `DISABLE_THROTTLE=true` silently disables all rate limiting globally

**File:** `apps/api/src/app.module.ts`

```ts
skipIf: () => process.env.DISABLE_THROTTLE === 'true',
```

A single env var removes all rate limiting with no deployment guard. If accidentally set in staging, all rate limiting (including auth endpoints) is disabled.

**Fix:** Add a startup check: throw if `DISABLE_THROTTLE=true` and `NODE_ENV` is `production` or `staging`.

---

### L-7 — Escrow ledger writes are outside the escrow state update transaction

**File:** `apps/api/src/modules/payments/services/escrow.service.ts`

```ts
} catch (ledgerError) {
  this.logger.error('Failed to write ledger entry', ledgerError);
  // Continue — don't fail the release over a ledger error
}
```

The escrow is released (money moves) even if the audit ledger write fails. Financial reconciliation will show an escrow release with no corresponding ledger entry.

**Fix:** Move the ledger write into the same `$transaction` as the escrow state update so they commit or roll back atomically.

---

### L-8 — Admin dispute notification failures are silently swallowed

**File:** `apps/api/src/modules/disputes/services/disputes.service.ts`

```ts
await this.notificationsService.sendAdminAlert(...)
  .catch(err => this.logger.error('Failed to send admin dispute alert', err));
```

If the notification fails, no admin receives the dispute alert. The failure is only visible in the log.

**Fix:** Add a fallback channel (direct SMTP to a hardcoded admin inbox, or a dead-letter queue entry) so the failure is surfaced through an independently monitored pathway.

---

### L-9 — Moderation failure during review creation saves unvetted content

**File:** `apps/api/src/modules/reviews/services/reviews.service.ts`

```ts
} catch (err) {
  this.logger.warn('Moderation failed, allowing review to proceed', err);
  // Review saved without moderation check
}
```

When moderation throws (rather than returning a negative result), the review is saved as if it passed. Combined with the image moderation stubs (H-2), content is never actually moderated in any path.

**Fix:** On moderation exception, set `review.status = PENDING_REVIEW` rather than saving with approved status.

---

## Files Not Fully Audited

The following files were not fully read or were only seen in grep output. They should be reviewed before production deployment:

- `apps/api/src/modules/auth/services/auth.service.ts` — only first 300 lines read; OAuth handler, `sanitizeUser()`, and session invalidation logic not reviewed
- `apps/api/src/modules/marketplace/providers/esewa-payment.plugin.ts` — only seen in grep output
- `apps/api/src/modules/marketplace/providers/razorpay-payment.plugin.ts` — only seen in grep output
- `packages/database/prisma/schema.prisma` — multiple service files reference fields commented out as "doesn't exist in schema" (`requiresDeposit`, `depositAmount`, `bookingMode` on Listing model); schema gaps should be audited
- `apps/api/src/modules/admin/services/admin.service.ts` — admin bulk operations and user management logic not read

---

## Recommended Fix Order

| Phase | Items | Criterion |
|-------|-------|-----------|
| **Pre-public exposure** | C-1, C-2, C-3, C-4 | Must be fixed before the service accepts real traffic |
| **Before enabling payments** | H-1, H-7, H-8 | Currency thresholds, auth leak, distributed lock correctness |
| **Before launch** | H-2, H-3, H-4, H-5, H-6 | Stubs and silent drops visible to end users |
| **Sprint before launch** | M-1 through M-12 | Runtime correctness and operational safety |
| **Deployment hardening** | L-1 through L-9 | Configuration hygiene and observability |
