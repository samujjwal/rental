# Architecture Audit Report — GharBatai Monorepo

> Audited: 2026-02-23 · Auditor: Principal Architect Review

---

## 1  Executive Summary

The GharBatai monorepo is a pnpm + Turborepo workspace hosting a NestJS API, React Router web app, React Native mobile app, and three shared packages. It delivers a Nepal-focused rental platform with 43 Prisma models, 21 API modules, and 50+ web routes.

**Key findings (by severity):**

| # | Severity | Finding |
|---|----------|---------|
| F-01 | 🔴 Critical | Prisma major version split (5 vs 7) between `database` pkg and `api` |
| F-02 | 🔴 Critical | React major version split (18 vs 19) between mobile and web |
| F-03 | 🔴 Critical | Node.js version drift: CI=20, Docker=18, local unspecified |
| F-04 | 🟠 High | 3 email providers shipped simultaneously (SendGrid, Resend, Nodemailer) |
| F-05 | 🟠 High | Shared-types package almost unused — web has 968 LoC of local types |
| F-06 | 🟠 High | Upward/circular imports from `common/` → `modules/` (6 violations) |
| F-07 | 🟠 High | Duplicate upload controllers (`common/storage/` + `common/upload/`) |
| F-08 | 🟠 High | Duplicate email services (`common/email/` + `modules/notifications/`) |
| F-09 | 🟠 High | Duplicate moderation services (`common/moderation/` + `modules/moderation/`) |
| F-10 | 🟡 Medium | API test coverage at 22.8% (1918/8394 lines) |
| F-11 | 🟡 Medium | Mobile app has 0 tests (10.8k LoC untested) |
| F-12 | 🟡 Medium | Duplicate `useDebounce` / `use-debounce` hooks in web |
| F-13 | 🟡 Medium | Multiple oversized route files (>1000 LoC): 3 routes above threshold |
| F-14 | 🟡 Medium | No SBOM generation or license audit in CI |
| F-15 | 🟢 Low | CI `npm audit` runs on pnpm workspace (should use `pnpm audit`) |
| F-16 | 🟢 Low | Renovate config references MUI grouping — no MUI in the project |
| F-17 | 🟢 Low | TypeScript ~5.6 in mobile (rest at ^5.9) |

---

## 2  Workspace Package Map

```
gharbatai-rentals (root)
├── apps/
│   ├── api       → @rental-portal/api       (NestJS, 37k LoC, 52 deps)
│   │   └── depends on: @rental-portal/database
│   ├── web       → @rental-portal/web       (React Router, 55k LoC, 29 deps)
│   │   └── depends on: @rental-portal/shared-types (via re-export wrapper)
│   └── mobile    → rental-portal-mobile      (Expo/RN, 11k LoC, 21 deps)
│       └── depends on: @rental-portal/mobile-sdk, @rental-portal/shared-types
├── packages/
│   ├── database       → Prisma schema (43 models, 39 enums, 1449 LoC schema)
│   ├── shared-types   → Contract types (1666 LoC, only 2 consumers)
│   └── mobile-sdk     → Re-exports shared-types (~50 LoC)
```

**Observation:** `mobile-sdk` is a hollow pass-through; it re-exports `shared-types` under aliased names. It adds zero logic and should be merged into `shared-types` or deleted.

---

## 3  Dependency Sprawl Analysis

See [dependency-inventory.md](outputs/dependency-inventory.md) for full version matrix.

### 3.1  Critical Version Conflicts

| Conflict | Risk | Remediation |
|----------|------|-------------|
| **Prisma 5 vs 7** | Runtime schema mismatch; `database` pkg generates Prisma 5 client but `api` imports Prisma 7 | Upgrade `packages/database` to Prisma 7, run `prisma generate`, verify migrations |
| **React 18 vs 19** | Type-level incompatibility; cannot share React components between web & mobile | Acceptable — Expo 52 requires React 18. Document the split; do not force alignment |
| **Node 18 (Docker) vs 20 (CI)** | Builds pass in CI but fail in production with runtime API differences | Pin Dockerfile to `node:20-alpine`; add `.node-version` file at root |

### 3.2  Library Sprawl: Email

The API ships **three** email providers:

| Provider | Location | LoC |
|----------|----------|-----|
| SendGrid | `modules/notifications/services/sendgrid.service.ts` + `email.service.ts` | ~400 |
| Resend | `common/email/resend-email.service.ts` + `modules/notifications/services/resend.service.ts` | ~300 |
| Nodemailer | `common/email/email.service.ts` + `modules/notifications/services/email.service.ts` | ~350 |

**Recommendation:** Consolidate to a single `EmailPort` interface in `common/email/` with one implementation (Resend). Remove SendGrid and Nodemailer deps, saving ~750 LoC and 2 npm dependencies.

### 3.3  Library Sprawl: Validation

| Lib | Files using it | Location |
|-----|---------------|----------|
| `class-validator` | 19 | API DTOs (blessed) |
| `joi` | 1 | `apps/api/src/config/` |
| `zod` | 6 | Web forms (blessed) |

**Recommendation:** Remove `joi` dep; convert the single config validation file to `class-validator` or `@nestjs/config` schema.

---

## 4  Architecture Layering Analysis

### 4.1  API: Clean Architecture Violations

```
                    ┌──────────────────────┐
   SHOULD NOT ──►   │  common/             │
   IMPORT FROM      │   ├── scheduler/     │ ─── imports ──► modules/ai/
   modules/         │   ├── storage/       │ ─── imports ──► modules/auth/guards
                    │   └── upload/        │ ─── imports ──► modules/auth/guards
                    └──────────────────────┘               + modules/auth/decorators
```

**6 upward imports** from `common/` → `modules/`:

| Source | Imports From | Fix |
|--------|-------------|-----|
| `common/scheduler/scheduler.service.ts` | `modules/ai/services/embedding.service` | Extract EmbeddingPort to `common/` |
| `common/scheduler/scheduler.module.ts` | `modules/ai/ai.module` | Move scheduling logic into the ai module |
| `common/storage/storage.controller.ts` | `modules/auth/guards/jwt-auth.guard` | Move `JwtAuthGuard` to `common/auth/` |
| `common/storage/upload.controller.ts` | `modules/auth/guards/jwt-auth.guard` | Same as above |
| `common/upload/upload.controller.ts` | `modules/auth/guards/jwt-auth.guard` | Same + deduplicate with `common/storage/` |
| `common/upload/upload.controller.ts` | `modules/auth/decorators/current-user` | Move decorator to `common/auth/` |

### 4.2  Duplicate Modules (merge candidates)

| Duplicate A | Duplicate B | Overlap | Action |
|-------------|-------------|---------|--------|
| `common/storage/upload.controller.ts` | `common/upload/upload.controller.ts` | Both serve file uploads | **Merge** into `common/storage/`, delete `common/upload/` |
| `common/email/email.service.ts` | `modules/notifications/services/email.service.ts` | Both wrap email sending | **Merge** into `common/email/`, wire via DI |
| `common/moderation/content-moderation.service.ts` | `modules/moderation/services/content-moderation.service.ts` | Same concern | **Merge** into `modules/moderation/`, remove `common/moderation/` |

### 4.3  API Module Sizes

| Module | LoC | Assessment |
|--------|-----|------------|
| notifications | 3847 | 🟠 Oversized — contains email, SMS, push, in-app. Split into `notifications-core` + delivery adapters |
| admin | 3818 | 🟠 Oversized — consider extracting admin-analytics from admin-CRUD |
| listings | 3609 | 🟡 Large but cohesive |
| payments | 3036 | 🟡 Large — webhook handler is 1 file, acceptable |
| bookings | 2845 | ✅ Well-scoped |
| auth | 1956 | ✅ Well-scoped |
| favorites | 376 | ✅ Small, focused |
| ai | 404 | ✅ Small, focused |

---

## 5  Shared Types & Contract Health

### 5.1  Adoption Gap

| Consumer | Import style | Uses shared-types? |
|----------|-------------|-------------------|
| **API** | `@rental-portal/database` enums | ❌ Never imports `shared-types` — has own DTOs |
| **Web** | `~/types/*.ts` (local) + `~/lib/shared-types.ts` (re-export) | ⚠️ Only 2 imports from re-export; 968 LoC of local types |
| **Mobile** | Via `mobile-sdk` pass-through | ⚠️ Re-exports with aliases, adding indirection |

**Problem:** The `shared-types` package exists but is a **dead letter**. The web app duplicates User, Listing, Booking, Review, and Admin types locally. The API doesn't use it at all.

**Recommendation:**
1. Make `shared-types` the **single source of truth** for API response shapes
2. Generate API DTOs *from* shared-types or vice versa
3. Delete `apps/web/app/types/` and re-export from `shared-types`
4. Delete `mobile-sdk` — it adds no value over direct `shared-types` import

### 5.2  Web Local Types vs Shared Types Overlap

| Domain | Web local (`apps/web/app/types/`) | Shared (`packages/shared-types/src/`) | Duplicate? |
|--------|----------------------------------|---------------------------------------|------------|
| User | 102 LoC | 56 LoC | ✅ Yes, diverged |
| Listing | 159 LoC | 117 LoC | ✅ Yes, diverged |
| Booking | 125 LoC | 89 LoC | ✅ Yes, diverged |
| Review | 68 LoC | 53 LoC | ✅ Yes, diverged |
| Auth | 58 LoC | (in user.ts) | ✅ Yes |
| Admin | 456 LoC | — | ❌ Not in shared |

---

## 6  Test Coverage & Strategy

### 6.1  Coverage Summary

| App | Unit Test Suites | E2E Suites | Line Coverage | Assessment |
|-----|-----------------|------------|---------------|------------|
| API | 40 (579 tests) | 17 | **22.8%** (1918/8394) | 🔴 Below 60% target |
| Web | 32 suites | 27 (Playwright) | Not measured | 🟡 No coverage reporting in CI |
| Mobile | **0** | **0** | **0%** | 🔴 Zero test investment |

### 6.2  Test Pyramid Assessment

```
         ╱  E2E  ╲        ← 17 API e2e + 27 Playwright = 44 (good breadth)
        ╱──────────╲
       ╱ Integration ╲    ← Minimal — API tests mock Prisma, few true integration
      ╱────────────────╲
     ╱    Unit Tests     ╲ ← 40 API suites covering 22.8% of lines
    ╱──────────────────────╲
   ╱   Contract / Type Tests╲ ← None — shared-types has no runtime checks
  ╱──────────────────────────╲
```

**Gaps:**
- No contract tests between API ↔ web (response shape validation)
- No snapshot testing for shared-types
- Mobile: entirely untested
- Web: coverage not tracked in CI (Vitest configured but no coverage gate)

---

## 7  CI/CD & Build Guardrails

### 7.1  Current Pipeline

```
ci.yml jobs: lint-and-format → typecheck → test-api → build → security-scan → e2e-tests (PR only)
```

### 7.2  Issues

| # | Issue | Impact | Fix |
|---|-------|--------|-----|
| C-01 | `npm audit` in pnpm workspace | Doesn't read pnpm lockfile | Switch to `pnpm audit` |
| C-02 | No SBOM generation | Cannot track supply chain | Add `pnpm dlx @cyclonedx/cyclonedx-npm --output-file sbom.json` step |
| C-03 | No coverage gate | Coverage can silently drop | Add `--coverageThreshold` in jest config or CI check |
| C-04 | Docker uses Node 18, CI uses Node 20 | "Works in CI, fails in prod" risk | Align to Node 20 (or 22 LTS) |
| C-05 | Web test step has `\|\| echo "No tests configured yet"` | Silently passes on failure | Remove the `\|\|` fallback |
| C-06 | No architectural lint (e.g., depcheck, dependency-cruiser) | Layer violations undetected | Add `dependency-cruiser` with `.dependency-cruiser.cjs` |
| C-07 | Trivy results go to sarif file but not uploaded to GitHub Security tab | Findings are invisible | Add `github/codeql-action/upload-sarif` step |
| C-08 | Renovate groups MUI packages — no MUI in project | Dead config noise | Remove the MUI group rule |

### 7.3  Turbo Config

Current Turbo config is minimal but correct. Missing:
- `"typecheck"` doesn't depend on `"^typecheck"` — may miss cross-package type errors
- No `"e2e"` task defined — e2e tests run via raw commands in CI

---

## 8  Module-Level Usage Guides

### 8.1  `packages/database`
- **When:** Any Prisma schema or migration change
- **What:** Houses `schema.prisma` (43 models, 39 enums), seed scripts, `PrismaWrapper`
- **How:** `cd packages/database && npx prisma migrate dev`
- **Where consumed:** `apps/api` (direct dep), enum re-exports

### 8.2  `packages/shared-types`
- **When:** API contract shapes change (response types, enums)
- **What:** TypeScript interfaces for User, Listing, Booking, Review, Payment, Messaging, Organization + Nepal config
- **How:** Edit types in `src/`, run `pnpm build` in package
- **Where consumed:** `apps/web` (via `~/lib/shared-types.ts` re-export — mostly unused), `apps/mobile` (via `mobile-sdk`)
- **Note:** Currently a dead letter — see §5 for adoption plan

### 8.3  `packages/mobile-sdk`
- **When:** Never — it's a passthrough
- **What:** Re-exports `shared-types` with aliased names
- **How:** Should be deleted
- **Where consumed:** `apps/mobile`

### 8.4  `apps/api` — Common Layer
| Sub-module | Responsibility | LoC |
|------------|---------------|-----|
| `storage/` | S3 upload, presigned URLs | 1098 |
| `events/` | Domain event bus (NestJS EventEmitter) | 888 |
| `scheduler/` | Cron-based background jobs | 471 |
| `upload/` | **Duplicate of storage/** — merge | 460 |
| `email/` | Email sending (3 providers — consolidate) | 341 |
| `rate-limit/` | Throttle middleware | 263 |
| `cache/` | Redis caching layer | 259 |
| `moderation/` | **Duplicate of modules/moderation** — merge | 245 |
| `logger/` | Winston structured logging | 191 |
| `health/` | Terminus health checks | 166 |
| `filters/` | Exception filters | 154 |
| `security/` | Helmet, CORS | 117 |
| `swagger/` | OpenAPI setup | 113 |
| `prisma/` | PrismaService | 65 |
| `pipes/` | Validation pipes | 46 |
| `queue/` | Bull queue setup | 18 |

---

## 9  Observability Assessment

| Pillar | Status | Details |
|--------|--------|---------|
| **Logging** | 🟡 Partial | Winston configured with daily rotate. No structured request IDs or correlation. |
| **Metrics** | 🔴 None | No Prometheus/StatsD/DataDog integration. No request latency or business metrics. |
| **Tracing** | 🔴 None | No OpenTelemetry, no distributed trace propagation. |
| **Health checks** | ✅ Good | `@nestjs/terminus` with DB + Redis checks. |
| **Error tracking** | 🔴 None | No Sentry/Bugsnag. Errors only go to Winston logs. |

**Recommendation:** Add `@opentelemetry/sdk-node` with auto-instrumentation for traces + metrics. Add Sentry for error tracking. Inject `x-request-id` in Express middleware for log correlation.

---

## 10  Web App Architecture Notes

### 10.1  Oversized Routes

| Route | LoC | Recommendation |
|-------|-----|----------------|
| `listings.new.tsx` | 1480 | Extract form steps into `components/listings/CreateListingStep{1..N}.tsx` |
| `listings.$id.edit.tsx` | 1262 | Same — extract edit steps |
| `search.tsx` | 1229 | Extract filter sidebar, result card, map panel |
| `messages.tsx` | 1003 | Extract conversation list + message thread components |

### 10.2  Duplicate Hooks

| Hook A | Hook B | Resolution |
|--------|--------|------------|
| `hooks/useDebounce.ts` (1055 LoC) | `hooks/use-debounce.ts` (382 LoC) | Keep `useDebounce.ts`, delete `use-debounce.ts`, update imports |

### 10.3  Component Library

`components/ui/` at 3959 LoC is the largest component directory — this is the de-facto design system. It should be well-documented and potentially extracted to `packages/ui` if mobile-web parity is ever needed.

---

## 11  Refactor Tickets

See [refactor-tickets.md](refactor-tickets.md) for the full backlog.

---

## Appendix A — File Count Summary

| Area | Files |
|------|-------|
| API production `.ts` | ~350 |
| API test `.spec.ts` | 40 |
| API e2e `.e2e-spec.ts` | 17 |
| Web routes `.tsx` | 50+ |
| Web components `.tsx` | ~100 |
| Web tests | 32 |
| Web e2e (Playwright) | 27 |
| Mobile screens | 50 |
| Mobile tests | **0** |
| Prisma models | 43 |
| Prisma enums | 39 |
| Shared-types files | 12 |
