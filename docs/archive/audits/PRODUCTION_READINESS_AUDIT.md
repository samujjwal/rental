# Production Readiness Audit — Rental Portal (GharBatai)

> **Prepared by:** Deep Code Analysis  
> **Date:** 2026-03  
> **Status:** Pre-release audit. Not cleared for production deployment in current state.

---

## Executive Summary

The platform has a well-structured architecture — NestJS backend, React Router v7 frontend, Prisma/PostgreSQL, Bull queues, Stripe payments — and all automated test suites pass (2,933 API unit, 3,179 web unit, 1,178 Playwright E2E). The core booking lifecycle, state machine, payment processing, and auth infrastructure are solid. However, **several non-trivial features that are user-visible are unimplemented stubs or contain critical logic errors** that would either expose users to broken behaviour or erode trust in the platform at launch.

**Overall stability: Conditionally production-ready.** The core rental flow (browse → book → pay → complete) is functional. Peripheral features — tax, insurance verification, content moderation, admin dashboard health data — are scaffolded but non-functional. An auth bypass vulnerability in the favorites endpoint requires immediate remediation.

### Must-Fix Before Release (5 items)

| # | Finding | Severity |
|---|---------|----------|
| F-01 | Favorites endpoint uses hardcoded fallback JWT secret | **Critical** |
| F-02 | Tax summary always returns `totalTax: 0` | **High** |
| F-03 | Image moderation API call is a stub — always returns null | **High** |
| F-04 | Insurance verification is a placeholder — all policies pass without real checks | **High** |
| F-05 | 1099 form generation not persisted — returns `id: 'mock_id'` | **High** |

### Important Before Scale (8 items)

| # | Finding | Severity |
|---|---------|----------|
| F-06 | `devLogin` silently falls back to any active user | **High** |
| F-07 | Admin backup info is fake static data from 2024 | **High** |
| F-08 | `VITE_DEV_LOGIN_SECRET` baked into JS bundle | **Medium** |
| F-09 | Access token persisted to `localStorage` (XSS risk) | **Medium** |
| F-10 | Field encryption uses deterministic dev key (`00112233...`) | **Medium** |
| F-11 | Disputes admin notification email commented out | **Medium** |
| F-12 | Listing `delete()` sets status=ARCHIVED but never sets `deletedAt` | **Medium** |
| F-13 | Direct `process.env` reads in 4+ files bypass `ConfigService` | **Medium** |

### Polish / Low Risk (5 items)

| # | Finding | Severity |
|---|---------|----------|
| F-14 | `getSupportedJurisdictions()` returns hardcoded mock array | **Low** |
| F-15 | Hardcoded cancellation tiers used when PolicyEngine has no rules (`@deprecated`) | **Low** |
| F-16 | Insurance provider list is US-only (State Farm, GEICO...) on Nepal-focused platform | **Low** |
| F-17 | CDN endpoints hardcoded as `cdn.gharbatai.com` in service logic | **Low** |
| F-18 | Expansion planner internet-penetration / competition scores hardcoded per country | **Low** |

---

## Findings

---

### F-01 — Favorites Endpoint Uses Hardcoded Fallback JWT Secret

| Attribute | Detail |
|-----------|--------|
| **Severity** | Critical |
| **Category** | Security — Authentication Bypass |
| **Area** | `apps/api/src/modules/favorites/controllers/favorites.controller.ts` |

**Evidence:**

```typescript
// GET /favorites/listing/:listingId  — partial auth check
const jwt = new JwtService({ secret: process.env.JWT_SECRET || 'dev-secret' });
```

The `GET /favorites/listing/:listingId` endpoint instantiates `JwtService` at runtime using a dynamic `require('@nestjs/jwt')` call and binds it to `process.env.JWT_SECRET || 'dev-secret'`. If `JWT_SECRET` is not set in the environment, **any token signed with the string `dev-secret` will verify as authentic**. This completely bypasses the standard `JwtAuthGuard`/`JwtStrategy` dependency-injection chain. The endpoint is meant to be optionally-authenticated (return count even for guests), but the manual verification path creates a secret-fallback attack surface.

**Why it matters:** An attacker who does not have a valid account can forge tokens using the wellknown fallback `dev-secret` string if the production environment ever launches without `JWT_SECRET` set. Even in a correctly configured deployment, the anti-pattern is fragile and untestable.

**Recommended fix:**

Replace the manual JwtService instantiation with NestJS's standard optional-auth pattern:

```typescript
// 1. Create an optional JWT guard
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    return user || null; // Returns null instead of throwing for unauthenticated
  }
}

// 2. Inject via DI — remove the dynamic require entirely
@UseGuards(OptionalJwtAuthGuard)
@Get('listing/:listingId')
async checkFavorite(
  @Param('listingId') listingId: string,
  @CurrentUser() user: User | null,
) { ... }
```

This leverages the configured `JwtStrategy` (which reads the secret from `ConfigService`) and removes the hardcoded fallback.

---

### F-02 — Tax Summary Always Returns `totalTax: 0`

| Attribute | Detail |
|-----------|--------|
| **Severity** | High |
| **Category** | Functional Bug — Silent Calculation Error |
| **Area** | `apps/api/src/modules/payments/services/stripe-tax.service.ts:303` |

**Evidence:**

```typescript
async getUserTaxSummary(userId: string, year: number): Promise<TaxSummaryDto> {
  const totalTax = 0; // totalTax would be calculated from payments in a real implementation
  return { userId, year, totalTax, ... };
}
```

The function is wired to a real API endpoint and is not feature-flagged. Users calling this endpoint receive zero as their total tax regardless of actual bookings or payments.

**Why it matters:** Host users who rely on this endpoint for tax filing will receive incorrect (zero) data. This is a legal/compliance risk if the platform markets tax tracking as a feature.

**Recommended fix:** Either (a) query `Payment` records filtered by year and `userId` (as owner), summing a stored `taxAmount` field; or (b) gate the endpoint with a `FEATURE_TAX_TRACKING` flag and return a `501 Not Implemented` until the real calculation is built.

---

### F-03 — Image Moderation API Call Is a Stub

| Attribute | Detail |
|-----------|--------|
| **Severity** | High |
| **Category** | Incompleteness — Missing Safety Control |
| **Area** | `apps/api/src/modules/moderation/services/image-moderation.service.ts:106` |

**Evidence:**

```typescript
/**
 * Call image moderation API (placeholder)
 * In production, this would call AWS Rekognition, Google Vision, or Cloudflare
 */
private async callImageModerationAPI(url: string): Promise<ModerationAPIResult | null> {
  // Placeholder — no actual API call
  return null;
}
```

All callers of `callImageModerationAPI` receive `null`. The service's result-processing code handles `null` gracefully (skips flagging), meaning **all uploaded images pass moderation unconditionally**.

**Why it matters:** Listing images are publicly visible. Without real moderation, harmful or illegal content can be uploaded and displayed to all users. This is a trust and safety failure.

**Recommended fix:** Integrate with an actual moderation provider (AWS Rekognition `DetectModerationLabels`, Cloudflare Images, or a self-hosted model). Gate behind a `FEATURE_IMAGE_MODERATION` environment flag so it fails-safe (reject upload) rather than fails-open.

---

### F-04 — Insurance Verification Is a Placeholder

| Attribute | Detail |
|-----------|--------|
| **Severity** | High |
| **Category** | Incompleteness — Core Trust Feature |
| **Area** | `apps/api/src/modules/insurance/services/insurance-verification.service.ts:86` |

**Evidence:**

```typescript
// Automated checks placeholder
// In a real implementation, these checks would:
//   1. Parse the policy document
//   2. Verify policy number with insurance company API
//   3. Check coverage amounts
async runAutomatedChecks(...): Promise<AutomatedCheckResult> {
  return {
    passed: false,
    confidence: 0.5,   // constant — never changes
    flaggedForReview: true,
  };
}

async extractPolicyDetails(documentUrl: string): Promise<Partial<InsurancePolicyDetails>> {
  // Placeholder — OCR document processing
  return {}; // always empty
}
```

Every insurance submission returns `confidence: 0.5` and `flaggedForReview: true`. The verification pipeline flags everything for manual review regardless of document quality.

Additionally, the hardcoded `KNOWN_INSURANCE_PROVIDERS` list contains US insurers (`State Farm`, `GEICO`, `Progressive`, `Allstate`, `Liberty Mutual`, `Farmers`), while the platform's target market is Nepal (`gharbatai.com`), making the provider matching logic irrelevant.

**Why it matters:** If insurance is a mandatory platform requirement (rental protection), users get no real signal on policy validity. Admin queues will be flooded with manual reviews that could have been automated. The US-only provider list is actively misleading for Nepali users.

**Recommended fix:** Either (a) integrate a real insurance API or OCR service; or (b) change the flow to manual-only and remove the false confidence score; or (c) remove the feature flag until implemented. Replace the US provider list with Nepali insurers (e.g., Nepal Insurance Authority registered companies).

---

### F-05 — 1099 Form Generation Returns `mock_id`, Not Persisted

| Attribute | Detail |
|-----------|--------|
| **Severity** | High |
| **Category** | Incompleteness — Financial Record-Keeping |
| **Area** | `apps/api/src/modules/payments/services/stripe-tax.service.ts:389` |

**Evidence:**

```typescript
async generate1099Form(userId: string, year: number): Promise<TaxFormDto> {
  const formData = { userId, year, taxId: 'N/A', ... }; // taxId hardcoded 'N/A'
  // await this.prisma.taxForm.create({ data: formData }); // ← commented out
  return { ...formData, id: 'mock_id' }; // ← never saved to DB
}
```

The 1099 form is constructed from partial data and returned to the caller, but **never written to the database**. `taxId` is hardcoded as `'N/A'` because user profiles do not store a tax ID field. Callers cannot retrieve the same "form" again.

**Why it matters:** Hosts/owners needing 1099s for IRS filing (or equivalent) receive a one-time ephemeral object with no record. The platform cannot demonstrate compliance with financial reporting obligations.

**Recommended fix:** Add `taxId` to the user profile schema. Uncomment and complete the `prisma.taxForm.create` call (requiring the `TaxForm` model in the schema if not yet added). Return the persisted record ID.

---

### F-06 — `devLogin` Falls Back to Any Active User

| Attribute | Detail |
|-----------|--------|
| **Severity** | High |
| **Category** | Security — Incorrect Behaviour in Dev |
| **Area** | `apps/api/src/modules/auth/services/auth.service.ts` |

**Evidence:**

```typescript
async devLogin(email: string, role: UserRole): Promise<AuthResponse> {
  let user = await this.prisma.user.findFirst({ where: { email, role } });
  if (!user) {
    // Fall back: find any active user with this role
    user = await this.prisma.user.findFirst({ where: { role, status: 'ACTIVE' } });
  }
  // Returns tokens for whatever user was found
}
```

If the requested email doesn't exist, `devLogin` silently authenticates as a different user with the matching role. A developer requesting login as `alice@example.com` (OWNER) would silently receive a session as `bob@example.com` (OWNER) without any warning.

**Why it matters:** In staging environments with shared databases, this can lead to accidental data modification under the wrong identity. If the dev-login endpoint is ever inadvertently accessible in production, the fallback expands the attack surface significantly.

**Recommended fix:** Remove the fallback. Throw a `404 Not Found` if the exact email+role combination isn't found, and document the seed users. Alternatively, create the dev user on demand (idempotent seeding).

---

### F-07 — Admin Backup Info Returns Fake Static Data

| Attribute | Detail |
|-----------|--------|
| **Severity** | High |
| **Category** | Stub — Operational Safety |
| **Area** | `apps/api/src/modules/admin/services/admin-system.service.ts` |

**Evidence:**

```typescript
async getBackupInfo(): Promise<BackupInfoDto> {
  return {
    backups: [
      { id: 'backup-1', createdAt: new Date('2024-01-25'), size: 1024 * 1024 * 512, status: 'COMPLETED' },
      { id: 'backup-2', createdAt: new Date('2024-01-24'), size: 1024 * 1024 * 480, status: 'COMPLETED' },
    ],
    lastBackupAt: new Date('2024-01-25'),
    nextScheduledAt: new Date(),
  };
}
```

The admin dashboard's "backup status" panel displays hardcoded entries from January 2024. There is no integration with the actual backup system (pg_dump, DigitalOcean Managed DB backups, etc.).

**Why it matters:** Operations teams relying on this panel to confirm database backups will have false confidence in data protection. If actual backups are failing, no operator would know from this interface.

**Recommended fix:** Integrate with the actual backup mechanism. For DigitalOcean Managed DB: call their API. For custom scripts: read backup metadata from a designated storage location or a `SystemBackup` DB table populated by the backup cron job.

---

### F-08 — `VITE_DEV_LOGIN_SECRET` Baked into JS Bundle

| Attribute | Detail |
|-----------|--------|
| **Severity** | Medium |
| **Category** | Security — Secret Exposure |
| **Area** | `apps/web/app/components/DevUserSwitcher.tsx` |

**Evidence:**

```typescript
const secret = import.meta.env.VITE_DEV_LOGIN_SECRET;
```

Vite embeds **all** `VITE_`-prefixed environment variables into the compiled JS bundle at build time. Even if the `DevUserSwitcher` component is conditionally rendered only in development (`MODE !== 'development'`), the value of `VITE_DEV_LOGIN_SECRET` is present as a literal string in any bundle built from a `.env.local` that includes it.

The runtime guard does not prevent it from appearing in source maps or being extracted via `strings` on the bundle artifact.

**Why it matters:** If a developer runs `pnpm build` locally with their `.env.local` and deploys that artifact to staging/production (or shares it), the dev-login secret is exposed. The API-side multi-layer guard is the real protection, but defense-in-depth requires not leaking the secret at all.

**Recommended fix:** For secret values, avoid `VITE_` prefix. Use a server-side loader or separate non-`VITE_` env to pass secrets only when `NODE_ENV === 'development'`. Alternatively, make the dev-login secret a well-known per-environment value that is regenerated for each environment rather than treated as a secret.

---

### F-09 — Access Token Persisted to `localStorage`

| Attribute | Detail |
|-----------|--------|
| **Severity** | Medium |
| **Category** | Security — XSS Token Theft |
| **Area** | `apps/web/app/lib/store/auth.ts` |

**Evidence:**

```typescript
// B-29: access token persisted for page-reload UX
persist(authSlice, {
  name: 'auth',
  partialize: (state) => ({ user: state.user, accessToken: state.accessToken }),
})
```

The short-lived JWT access token (15-minute TTL) and user profile are persisted to `localStorage`. The refresh token is correctly stored in an httpOnly cookie. This is documented as a deliberate design decision (B-29).

**Why it matters:** Any XSS vulnerability anywhere on the domain allows an attacker to read all `localStorage` keys and steal the active access token. With a 15-minute window, the attacker has time to make authenticated API requests. httpOnly cookies cannot be read by JavaScript, making them the standard mitigation; storing JWTs in localStorage intentionally removes that protection.

**Recommended fix:** Consider moving the access token to session memory only (no `partialize` persistence). On page reload, attempt a silent refresh via the httpOnly refresh-token cookie (`/auth/refresh`). This is a marginal UX trade-off (brief delay on cold reload) with a significant security gain. If `localStorage` persistence must be kept, ensure a strict Content-Security-Policy and all third-party scripts are SRI-hashed.

---

### F-10 — Field Encryption Uses Deterministic Shared Dev Key

| Attribute | Detail |
|-----------|--------|
| **Severity** | Medium |
| **Category** | Security — Key Management |
| **Area** | `apps/api/src/common/encryption/field-encryption.service.ts` |

**Evidence:**

```typescript
private getKey(): Buffer {
  const keyHex = process.env.FIELD_ENCRYPTION_KEY ||
    '0011223344556677889900aabbccddeeff0011223344556677889900aabbccdd';
  return Buffer.from(keyHex, 'hex');
}
```

Every developer and CI environment that doesn't set `FIELD_ENCRYPTION_KEY` shares the identical AES-256-GCM key. Fields encrypted with this key (MFA secrets, government ID numbers) are readable by anyone with the well-known constant.

**Why it matters:** The risk is primarily data migration: if dev/staging data (or a database dump) is ever analyzed outside a secured environment, sensitive fields are trivially decryptable with the known key. Additionally, if a developer accidentally uses a dev DB dump in a prod-like environment, encryption provides no protection.

**Recommended fix:** Add `FIELD_ENCRYPTION_KEY` to the required-at-startup validation (similar to `JWT_SECRET` which already throws if missing). Set distinct, randomly-generated keys per environment (CI, staging, production). Add a note in `EXTERNAL_SERVICES_SETUP.md` on key rotation procedures.

---

### F-11 — Disputes Admin Notification Email Is Commented Out

| Attribute | Detail |
|-----------|--------|
| **Severity** | Medium |
| **Category** | Incompleteness — Operational Process |
| **Area** | `apps/api/src/modules/disputes/services/disputes.service.ts:217` |

**Evidence:**

```typescript
// Notify Admin (hardcoded or configured email)
// await this.emailService.sendEmail('admin@rentals.com', 'New Dispute Created', ...);
```

When a new dispute is created, the admin notification email is commented out. Admins will not receive any notification of new disputes unless they proactively monitor the admin dashboard.

**Why it matters:** Disputes are time-sensitive. Without notification, SLA windows may be missed, leading to unresolved disputes escalating to chargebacks or user complaints.

**Recommended fix:** Uncomment and complete the email notification. Replace the hardcoded `admin@rentals.com` with a `ConfigService` value (`ADMIN_DISPUTES_EMAIL`). Consider also adding a Bull queue job for retry-on-failure delivery.

---

### F-12 — Listing `delete()` Does Not Set `deletedAt`; Soft-Delete Semantics Inconsistent

| Attribute | Detail |
|-----------|--------|
| **Severity** | Medium |
| **Category** | Data Integrity — Inconsistent Model Behaviour |
| **Area** | `apps/api/src/modules/listings/services/listings.service.ts` |

**Evidence:**

```typescript
// delete() in listings.service.ts
await this.prisma.listing.update({
  where: { id },
  data: { status: PropertyStatus.ARCHIVED }, // ← sets ARCHIVED status only
});
// No deletedAt assignment

// Slug uniqueness check at line 920 uses deletedAt: null
// → implies schema has deletedAt, but delete() never writes it
```

The Prisma schema has a `deletedAt` field on `Listing`, but the `delete()` function never sets it — it only changes `status` to `ARCHIVED`. Meanwhile, `findAll()` defaults to `status = AVAILABLE`, so archived listings are correctly hidden from public search. However, direct `findById()` fetches do not filter by status for admin/owner callers, meaning archived listings are retrievable by their owners and admins (which may or may not be intentional). The inconsistency between status-based and timestamp-based soft-delete creates confusion about the canonical "deleted" state and makes DB-level queries ambiguous.

**Recommended fix:** Decide on one soft-delete strategy. Preferred: set both `deletedAt = now()` and `status = ARCHIVED` in `delete()`. Add a global Prisma middleware or consistent `deletedAt: null` filter to all `findMany`/`findUnique` calls to prevent accidental access to deleted records.

---

### F-13 — Direct `process.env` Reads Bypass `ConfigService`

| Attribute | Detail |
|-----------|--------|
| **Severity** | Medium |
| **Category** | Reliability — Configuration consistency |
| **Area** | Multiple files |

**Evidence (non-exhaustive):**

```typescript
// auth.controller.ts
process.env.NODE_ENV !== 'production'
process.env.DEV_LOGIN_ENABLED
process.env.DEV_LOGIN_SECRET
process.env.DEV_LOGIN_ALLOWED_IPS

// field-encryption.service.ts
process.env.FIELD_ENCRYPTION_KEY

// stripe-tax.service.ts
process.env.STRIPE_TAX_ENABLED
```

These reads happen outside of `ConfigService` which is the NestJS-standard way to access validated, typed configuration. The `ConfigService` centralises schema validation at startup (via `Joi`) and provides a single source of truth.

**Why it matters:** Variables read via `process.env` bypass the startup validation — if they are missing in production, the error is silent or lazy (only triggering when the code path runs). It also makes configuration testing harder because `ConfigService` can be mocked in unit tests while `process.env` cannot be cleanly controlled.

**Recommended fix:** Move all `process.env` usages in service/controller code to `ConfigService` injections. Add the missing variables to the Joi validation schema in `configuration.ts` with appropriate required/optional rules.

---

### F-14 — `getSupportedJurisdictions()` Returns Hardcoded Mock Array

| Attribute | Detail |
|-----------|--------|
| **Severity** | Low |
| **Category** | Stub |
| **Area** | `apps/api/src/modules/payments/services/stripe-tax.service.ts:401` |

**Evidence:**

```typescript
// Return mock jurisdictions for now
return [
  { code: 'US-CA', name: 'California', taxRates: [] },
  { code: 'US-NY', name: 'New York', taxRates: [] },
  ...
];
```

The jurisdiction list is hardcoded, US-centric, and contains empty `taxRates` arrays. Because this is a lookup endpoint (not a mutation), the immediate impact is cosmetic — but it reinforces that tax infrastructure is non-functional.

**Recommended fix:** Either call `stripe.tax.settings.retrieve()` to return live jurisdictions, or remove the endpoint until the tax integration is complete.

---

### F-15 — Hardcoded Cancellation Tiers Still Active (`@deprecated`)

| Attribute | Detail |
|-----------|--------|
| **Severity** | Low |
| **Category** | Incompleteness / Hardcoding |
| **Area** | `apps/api/src/modules/bookings/services/booking-calculation.service.ts:411` |

**Evidence:**

```typescript
/**
 * Default hardcoded cancellation tiers (fallback when PolicyEngine has no rules).
 * @deprecated — all cancellation rules should come from PolicyEngine
 */
private getHardcodedCancellationTiers(): CancellationTier[] { ... }
```

The fallback is still exercised when `PolicyEngine` returns no applicable rules. Since `PolicyEngine` requires seeded policy data, new/empty deployments will use these hardcoded tiers without indication.

**Recommended fix:** Add a seed migration that creates default cancellation policies in the `PolicyEngine`, eliminating the need for the hardcoded fallback. Log a warning when the fallback is triggered so it is observable.

---

### F-16 — Insurance Provider List Is US-Only

| Attribute | Detail |
|-----------|--------|
| **Severity** | Low |
| **Category** | Hardcoding — Localisation |
| **Area** | `apps/api/src/modules/insurance/services/insurance-verification.service.ts` |

The `KNOWN_INSURANCE_PROVIDERS` constant lists US insurers (`State Farm`, `GEICO`, `Progressive`, `Allstate`, `Liberty Mutual`, `Farmers`). The platform's target market is Nepal (`gharbatai.com` domain, NPR currency references).

**Recommended fix:** Replace/extend with Nepali non-life insurance companies registered with the Insurance Authority of Nepal (e.g., Nepal Insurance, Sagarmatha Insurance, NIC Asia, Shikhar Insurance).

---

### F-17 — CDN Endpoints Hardcoded in Service Logic

| Attribute | Detail |
|-----------|--------|
| **Severity** | Low |
| **Category** | Hardcoding — Tenant/Brand Coupling |
| **Area** | `apps/api/src/modules/marketplace/services/geo-distribution.service.ts` |

**Evidence:**

```typescript
cdnEndpoint: 'cdn.gharbatai.com',
// cdn-sea.gharbatai.com, cdn-eu.gharbatai.com, etc.
```

Tenant-specific CDN endpoints are hardcoded in service logic rather than loaded from configuration.

**Recommended fix:** Move CDN endpoints to `configuration.ts` environment variables (`CDN_PRIMARY`, `CDN_SEA`, `CDN_EU`). This enables multi-tenant deployments and environment-specific overrides without code changes.

---

### F-18 — Expansion Planner Scores Are Hardcoded Per Country

| Attribute | Detail |
|-----------|--------|
| **Severity** | Low |
| **Category** | Hardcoding — Business Logic |
| **Area** | `apps/api/src/modules/marketplace/services/expansion-planner.service.ts:207` |

Internet penetration rates and competition scores are hardcoded as static numbers per country. These will become stale and inaccurate as market conditions evolve.

**Recommended fix:** Store these values in a database table (e.g., `MarketData`) seeded from authoritative sources, allowing periodic updates without code deployments.

---

## Feature Assessment

| Feature | Status | Notes |
|---------|--------|-------|
| **User Registration / Login** | ✅ Functional | Multi-factor auth, OAuth, OTP all implemented. Rate limiting, account locking present. |
| **Listing Management** | ✅ Functional | CRUD, publish/pause/archive, media upload, category hierarchy, soft-delete via status. Minor: deletedAt consistency (F-12). |
| **Search & Discovery** | ✅ Functional | Full-text + geo-spatial with pgvector. Parameterized SQL. Multi-modal search implemented. |
| **Booking Lifecycle** | ✅ Functional | State machine with role-based transitions, optimistic locking, admin override. |
| **Payments (Core)** | ✅ Functional | Stripe Connect, escrow/capture/release, webhook idempotency, dead-letter queue. |
| **Cancellation & Refunds** | ⚠️ Partial | PolicyEngine path correct; fallback to deprecated hardcoded tiers for fresh deployments (F-15). |
| **Favorites** | ⛔ Security Bug | JWT auth bypass in check endpoint (F-01). Must fix before release. |
| **Messaging / Chat** | ✅ Functional | WebSocket gateway with participant ownership check (`canUserMessage`). |
| **Disputes** | ⚠️ Partial | Core CRUD and state machine implemented. Admin notification email disabled (F-11). |
| **Reviews & Trust** | ✅ Functional | Post-booking review creation, aggregate score updates. No critical issues found. |
| **Insurance Verification** | ⛔ Stub | All verification returns 0.5 confidence, flags for manual review. No real checks (F-04). |
| **Image Moderation** | ⛔ Stub | Always passes — no real API call (F-03). |
| **Tax (Stripe Tax)** | ⛔ Stub | `totalTax` always 0, 1099s not persisted, mock jurisdiction list (F-02, F-05, F-14). |
| **Admin Dashboard** | ⚠️ Partial | Backup info is fake data (F-07). Other admin panels appear functional. |
| **AI Concierge** | ✅ Functional | Provider abstraction, versioned prompt registry, session ownership checks. |
| **Notifications** | ✅ Functional | Email via Resend, in-app notifications. Dispute notifications partially disabled (F-11). |
| **GDPR / Data Export** | ✅ Functional | User data export service exists. Privacy controls present. |
| **Fraud Detection** | ✅ Functional | Module present with risk-scoring logic. |
| **Field Encryption** | ✅ Functional | AES-256-GCM with version tags. Dev-key fallback is a risk only at env boundaries (F-10). |

---

## Stabilisation Checklist

### Immediate — Before Any Production Traffic

- [ ] **F-01**: Fix `favorites.controller.ts` — replace manual `JwtService` instantiation with `OptionalJwtAuthGuard` using DI.
- [ ] **F-01**: Add `JWT_SECRET` to startup required-variable validation in `main.ts` (it already throws — confirm it propagates in containerised start).
- [ ] **F-03**: Image moderation — either implement real API call or add `FEATURE_IMAGE_MODERATION=false` guard that rejects uploads or routes to manual review instead of silently passing.
- [ ] **F-04**: Insurance verification — either implement real verification or replace 0.5-confidence stub with explicit manual-review-only flow and communicate to users.
- [ ] **F-02 + F-05**: Disable tax endpoints (`/tax/summary`, `/tax/1099`) behind `FEATURE_TAX_TRACKING=false` and return `503` with clear message rather than wrong data.
- [ ] **F-07**: Admin backup panel — either integrate real backup status or display "No backup integration configured" rather than fake 2024 data.
- [ ] **F-11**: Uncomment and complete dispute admin notification email; add `ADMIN_DISPUTES_EMAIL` to config.

### Before First Paying User

- [ ] **F-06**: Remove devLogin user fallback — throw 404 if exact email+role not found.
- [ ] **F-10**: Add `FIELD_ENCRYPTION_KEY` to required-at-startup validation; generate per-environment keys.
- [ ] **F-12**: Standardise soft-delete: set `deletedAt` in `delete()` alongside `status = ARCHIVED`.
- [ ] **F-08**: Audit Vite bundle for leaked secrets; don't use `VITE_` prefix for sensitive values.
- [ ] **F-13**: Migrate `process.env` direct reads in service/controller files to injected `ConfigService`.

### Before Scale / After Launch

- [ ] **F-09**: Evaluate removing `accessToken` from `localStorage` persistence — attempt silent refresh on page load instead.
- [ ] **F-15**: Seed default cancellation policies into PolicyEngine to eliminate the deprecated hardcoded fallback.
- [ ] **F-16**: Replace US-only insurance provider list with Nepal-registered companies.
- [ ] **F-17**: Move CDN endpoints (`cdn.gharbatai.com`) to `configuration.ts` environment variables.
- [ ] **F-18**: Move country-market data (internet penetration, competition scores) to a seeded DB table.
- [ ] **F-14**: Remove or implement `getSupportedJurisdictions()` — current state returns empty `taxRates`.

---

## Open Questions

1. **Insurance as a hard requirement?** Is insurance verification a blocking gate for listing publication, or advisory? If blocking, the stub means no listings can be published unless insurance is disabled — clarify the intended launch-day behaviour.

2. **Tax feature timeline?** With three tax endpoints returning mock/zero data, is the tax feature intended for v1 or v2? If v2, add explicit documentation and 501/503 responses so integrators aren't silently misled.

3. **Nepal vs. global market?** Multiple pieces of the codebase assume US geography (insurance providers, state tax jurisdictions) while the brand (`GharBatai`, `gharbatai.com`) is clearly Nepal-focused. Is this a multi-market platform from day one, or Nepal-first? This determines priority for F-16 and F-17.

4. **devLogin scope in staging?** Is the `devLogin` endpoint enabled in the staging environment? If so, define which seed users should exist and enforce the exact-match-only behaviour (removing the fallback).

5. **Backup strategy?** F-07 reveals no backup integration in the admin panel. What is the actual backup mechanism (DigitalOcean managed backups, cron + pg_dump, etc.)? This must be documented and tested separately from the code fix.

6. **`localStorage` accessToken sign-off?** Decision B-29 was a deliberate trade-off. Has it been reviewed by a security stakeholder? If so, document the accepted risk formally. If not, escalate before launch.

7. **PolicyEngine seed data?** F-15 triggers when PolicyEngine has no rules. Does the production deployment include a seed migration for default cancellation policies? If not, all live bookings fall back to deprecated hardcoded tiers.

---

*End of audit report.*
