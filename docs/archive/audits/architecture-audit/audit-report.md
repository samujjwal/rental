# Architecture Audit Report — GharBatai Monorepo (v2)

> Audited: 2026-02-25 · Previous audit: 2026-02-23 · Auditor: Principal Architect Review
> Evidence: [`outputs/inventory.json`](outputs/inventory.json), [`outputs/dep-graph.txt`](outputs/dep-graph.txt)

---

## 1  Executive Summary

This is the **second full audit** of the GharBatai monorepo. The first audit (2026-02-23) identified 17 findings and generated 16 REFACTOR tickets (REFACTOR-001 through REFACTOR-016), **all of which have been implemented**. This v2 audit validates the resolved items, captures updated metrics, and opens new tickets for remaining and newly-discovered architectural debt.

### 1.1  What Was Fixed Since v1

| v1 Finding | Status | What Changed |
|------------|--------|-------------|
| F-01 Prisma 5→7 split | ✅ Resolved | All packages now on Prisma 7.3 with `@prisma/adapter-pg` |
| F-03 Node 18→20 drift | ✅ Resolved | Dockerfile, CI, `.node-version` all aligned to Node 20 |
| F-04 3 email providers | ✅ Resolved | Consolidated to single `EmailPort` in `common/email/` |
| F-06 6 common→module violations | ⚠️ Partially | Reduced to 2 structural violations (see §4.1); `common/auth/` barrel now re-exports from `modules/auth/` |
| F-07 Duplicate upload controllers | ✅ Resolved | Merged into `common/storage/` |
| F-08 Duplicate email services | ✅ Resolved | Single implementation via `common/email/` |
| F-09 Duplicate moderation services | ✅ Resolved | Canonical home in `modules/moderation/` |
| F-10 API coverage 22.8% | ⬆️ Improved | Now at **26%** with ratchet threshold enforced |
| F-12 Duplicate useDebounce | ✅ Resolved | Single hook retained |
| F-15 npm audit in pnpm | ✅ Resolved | Switched to `pnpm audit` |
| F-16 Renovate MUI group | ✅ Resolved | Removed dead config |
| F-17 Mobile TS ~5.6 | ✅ Resolved | Aligned to ^5.9 |
| C-06 No dependency-cruiser | ✅ Resolved | `.dependency-cruiser.cjs` added with arch rules |
| §9 No observability | ⬆️ Improved | OpenTelemetry, Sentry, `x-request-id` middleware added |

### 1.2  Current Findings (v2)

| # | Severity | Finding |
|---|----------|---------|
| F-18 | 🔴 Critical | React major version split still present (18 vs 19) — **accepted risk** |
| F-19 | 🟠 High | Shared-types package remains a dead letter — API: 0 imports, Web: 8 consumers via barrels |
| F-20 | 🟠 High | Triple type duplication: `shared-types` + `web/types/` + `mobile-sdk` with diverged shapes |
| ~~F-21~~ | ~~🟠 High~~ | ~~7 Prisma-in-controller violations~~ → **✅ Resolved (0 violations in v3 scan)** |
| ~~F-22~~ | ~~🟠 High~~ | ~~Listings ↔ Search circular dependency (`forwardRef`)~~ → **✅ Resolved (0 forwardRef in v3 scan)** |
| F-23 | 🟡 Medium | 5 notification controllers with overlapping routes — over-fragmented |
| ~~F-24~~ | ~~🟡 Medium~~ | ~~Dual form libraries~~ → **✅ Resolved (`@tanstack/react-form` no longer detected)** |
| F-25 | 🟡 Medium | Auth token dual-write: Zustand persist AND direct localStorage |
| ~~F-26~~ | ~~🟡 Medium~~ | ~~4 duplicate deps in API~~ → **✅ Resolved (API deps reduced 48→45)** |
| F-27 | 🟡 Medium | Version mismatches: jest (29 vs 30) — constraint-blocked by Expo |
| F-28 | 🟡 Medium | `AuthResponse` field conflict: shared-types uses `token`, web/mobile use `accessToken` |
| F-29 | 🟡 Medium | Mobile has only 5 test files (11k LoC) — still below minimum |
| F-30 | 🟢 Low | `mobile-sdk` is a god-file anti-pattern (986 LoC single file) |
| F-31 | 🟢 Low | Many modules still import auth from `@/modules/auth/` instead of `@/common/auth/` barrel |

---

## 2  Workspace Package Map

```
gharbatai-rentals (root)        pnpm 10.28.2 + Turborepo
├── apps/
│   ├── api       → @rental-portal/api       (NestJS 11, 48,269 LoC, 48+30 deps)
│   │   └── depends on: @rental-portal/database
│   ├── web       → @rental-portal/web       (React Router 7, 56,493 LoC, 29+33 deps)
│   │   └── depends on: @rental-portal/shared-types (via re-export barrel)
│   └── mobile    → rental-portal-mobile      (Expo 52/RN 0.76, 11,211 LoC, 21+9 deps)
│       └── depends on: @rental-portal/mobile-sdk, @rental-portal/shared-types
├── packages/
│   ├── database       → Prisma 7.3 (43 models, 39 enums, 1,448 LoC schema)
│   ├── shared-types   → Contract types (1,666 LoC, 12 files — largely unused)
│   └── mobile-sdk     → God-file re-export (986 LoC, 1 file)
└── Total: 122,305 LoC · 99 test files · 7 packages
```

---

## 3  Dependency Sprawl Analysis

### 3.1  Version Mismatches (Current)

| Dependency | API | Web | Mobile | Risk |
|-----------|-----|-----|--------|------|
| **react** | — | ^19.2.4 | 18.3.1 | Accepted — Expo 52 pins React 18 |
| **@types/react** | — | ^19.2.10 | ~18.3.0 | Accepted — follows react version |
| **axios** | ^1.8.0 | ^1.13.4 | — | 🟡 Version drift; align to ^1.13.4 |
| **jest** | ^30.2.0 | — | ^29.7.0 | 🟡 Mobile stuck on 29; align when possible |
| **@types/jest** | ^30.0.0 | — | ^29.5.0 | 🟡 Follows jest |
| **socket.io-client** | 4.8.3 (pinned) | ^4.8.3 (caret) | ^4.8.0 | 🟢 Functionally compatible; standardize caret |

### 3.2  Duplicate Dependencies in API

These deps exist in `apps/api/package.json` but are already transitive via `@rental-portal/database`:

| Dependency | In API | In Database | Action |
|-----------|--------|-------------|--------|
| `@prisma/client` | ^7.3.0 | ^7.3.0 | Remove from API |
| `@prisma/adapter-pg` | ^7.3.0 | ^7.3.0 | Remove from API |
| `bcrypt` | ^5.2.0 | ^5.2.0 | Remove from API |
| `pg` | ^8.16.0 | ^8.16.0 | Remove from API |

### 3.3  Library Sprawl: Form Libraries (Web)

| Library | Files | Usage |
|---------|-------|-------|
| `react-hook-form` ^7.71.1 | 10 routes/components | Login, signup, forgot-password, listings CRUD, profile |
| `@tanstack/react-form` ^1.28.0 | 1 component | `EnhancedForm.tsx` only |

**Decision:** Remove `@tanstack/react-form` and convert `EnhancedForm.tsx` to `react-hook-form`.

### 3.4  Validation Libraries

| Lib | Files | Location | Status |
|-----|-------|----------|--------|
| `class-validator` | 19 | API DTOs | ✅ Blessed |
| `zod` | 6 | Web forms | ✅ Blessed |
| `joi` | 0 | — | ✅ Removed in v1 refactor |

---

## 4  Architecture Layering Analysis

### 4.1  API: common/ → modules/ Dependency Direction

After REFACTOR-006, a `common/auth/index.ts` barrel was created to re-export auth guards/decorators from `modules/auth/`. This is an **intentional facade** that enables the convention:

```
✅  modules/bookings → common/auth/   (uses barrel)
⚠️  modules/bookings → modules/auth/  (31 modules still import directly)
```

**Remaining structural violations (2):**

| Source | Imports | Mitigation Status |
|--------|---------|-------------------|
| `common/auth/index.ts` | `modules/auth/guards/*`, `modules/auth/decorators/*` | Intentional barrel — acceptable |
| `common/scheduler/scheduler.module.ts` | `modules/ai/ai.module` | Mitigated by `EmbeddingInterface` in `common/interfaces/` |

**Auth guard import hygiene:** 31+ modules still import guards directly from `@/modules/auth/` instead of `@/common/auth/`. This works but defeats the barrel's purpose. A bulk import update is low-risk, high-hygiene.

### 4.2  Prisma Direct Access in Controllers (F-21)

Clean architecture requires controllers to delegate to services. These 7 violations inject `PrismaService` directly:

| Controller | Model Accessed | Calls | Fix |
|-----------|---------------|-------|-----|
| `bookings.controller.ts:108` | `dispute.findMany` | 1 | Move to `DisputesService` or `BookingsService` |
| `organizations.controller.ts:116` | `organizationMember.findUnique` | 1 | Extract to `OrganizationsService` |
| `organizations.controller.ts:122` | `organizationMember.findMany` | 1 | Extract to `OrganizationsService` |
| `organizations.controller.ts:135` | `organization.findUnique` | 1 | Extract to `OrganizationsService` |
| `organizations.controller.ts:138` | `organization.update` | 1 | Extract to `OrganizationsService` |
| `organizations.controller.ts:155` | `organizationMember.findUnique` | 1 | Extract to `OrganizationsService` |
| `organizations.controller.ts:173` | `organizationMember.deleteMany` | 1 | Extract to `OrganizationsService` |

### 4.3  Circular Dependencies (F-22)

| Cycle | Mechanism | Root Cause |
|-------|-----------|-----------|
| Listings ↔ Search | `forwardRef(() => SearchModule)` in `listings.module.ts` | `ListingsController` injects `SearchService` directly |

**Fix:** Extract `SearchService.search()` call into a thin `ListingSearchFacade` in `listings/`, or move the search endpoint to the `search` module where it belongs.

### 4.4  Notification Controller Fragmentation (F-23)

The `notifications/` module has **5 controllers** with overlapping concerns:

| Controller | Purpose |
|-----------|---------|
| `notifications.controller.ts` | Main CRUD + admin endpoints |
| `notification.controller.ts` | User notification prefs |
| `inapp-notification.controller.ts` | In-app notification feed |
| `email.controller.ts` | Admin email sending |
| `sms.controller.ts` | Admin SMS sending |

**Recommendation:** Merge `notification.controller.ts` into `notifications.controller.ts` (singular vs plural collision). Merge `email.controller.ts` and `sms.controller.ts` into `admin-notifications.controller.ts`. Result: 3 focused controllers.

### 4.5  API Module Sizes (from dep-graph)

| Module | LoC | Assessment |
|--------|-----|------------|
| admin | 3,818 | 🟠 `admin.service.ts` alone is 3,003 LoC — extract analytics |
| listings | 3,615 | 🟡 Large but multiple controllers; cohesive |
| notifications | 3,277 | 🟠 5 controllers (see §4.4); needs consolidation |
| payments | 3,036 | 🟡 Webhook handler is dense but self-contained |
| bookings | 2,845 | ✅ Well-scoped |
| auth | 1,956 | ✅ Well-scoped |
| search | 1,599 | ✅ Well-scoped |
| categories | 1,592 | ✅ Well-scoped |
| moderation | 1,196 | ✅ Post-merge, right-sized |
| messaging | 1,153 | ✅ |
| reviews | 882 | ✅ |
| users | 833 | ✅ |
| organizations | 825 | ⚠️ Small but has 6 prisma-in-controller violations |
| insurance | 790 | ✅ |
| disputes | 792 | ✅ |
| tax | 733 | ✅ |
| geo | 718 | ✅ |
| fraud-detection | 571 | ✅ |
| analytics | 501 | ✅ |
| ai | 412 | ✅ |
| favorites | 376 | ✅ |

---

## 5  Shared Types & Contract Health

### 5.1  Adoption Gap (F-19, F-20)

| Consumer | Imports shared-types? | Evidence |
|----------|----------------------|----------|
| **API** | ❌ **Zero imports** | Uses own DTOs + Prisma-generated types exclusively |
| **Web** | ⚠️ 3 files via `~/lib/shared-types.ts` barrel | `bookings.tsx` (BookingStatus), `payments.ts` (enums) |
| **Web local types** | — | 23 files import from `~/types/` (968 LoC of local types) |
| **Mobile** | Via `mobile-sdk` | Re-exports with aliased names, diverged shapes |

### 5.2  Type Duplication Matrix

| Domain | `packages/shared-types` | `apps/web/app/types/` | `mobile-sdk` | Divergence? |
|--------|------------------------|-----------------------|--------------|-------------|
| User | 56 LoC | 102 LoC | ✅ duplicated | Fields differ (`token` vs `accessToken`) |
| Listing | 117 LoC | 159 LoC | ✅ duplicated | Web adds admin-specific fields |
| Booking | 89 LoC | 125 LoC | ✅ duplicated | Status enums diverged |
| Review | 53 LoC | 68 LoC | ✅ duplicated | Minor |
| Auth | (in user.ts) | 58 LoC | ✅ duplicated | `AuthResponse.token` vs `accessToken` (F-28) |
| Admin | — | 456 LoC | — | Only in web |

**Impact:** A contract change (e.g., adding a field to Booking response) requires edits in 3 places. High risk of silent type drift.

### 5.3  mobile-sdk Assessment (F-30)

`packages/mobile-sdk/src/index.ts` is a single 986-LoC file that:
1. Re-exports shared-types under alias names
2. Defines its own `ApiClient` class with raw `fetch()` calls
3. Defines local types that shadow/conflict with shared-types

**Recommendation:** Delete `mobile-sdk`. Mobile app should import `shared-types` directly and use a proper HTTP client (axios or ky).

---

## 6  Test Coverage & Strategy

### 6.1  Coverage Summary

| App | Test Files | Suites | Tests | Line Coverage | Δ from v1 |
|-----|-----------|--------|-------|---------------|-----------|
| API | 66 | 49 | 648 | **26%** (ratcheted) | ⬆️ +3.2pp |
| Web | 28 | — | — | Not tracked in CI | — |
| Mobile | 5 | — | — | Not tracked | ⬆️ from 0 |
| **Total** | **99** | — | — | — | — |

### 6.2  Test Pyramid Assessment

```
         ╱   E2E   ╲        ← 17 API e2e + 27 Playwright = 44
        ╱────────────╲
       ╱ Integration  ╲     ← Minimal; API tests mock Prisma
      ╱────────────────╲
     ╱   Unit Tests     ╲   ← 49 API suites, 26% coverage
    ╱────────────────────╲
   ╱  Contract / Schema   ╲  ← None — no runtime type validation between API ↔ clients
  ╱────────────────────────╲
```

### 6.3  Gaps

| Gap | Impact | Ticket |
|-----|--------|--------|
| No contract tests (API ↔ Web response shapes) | Silent breaking changes | REFACTOR-v2-008 |
| Web coverage not tracked in CI | Regressions undetected | REFACTOR-v2-009 |
| Mobile test coverage minimal (5 files / 11k LoC) | Core flows untested | REFACTOR-v2-010 |
| `admin.service.ts` (3,003 LoC) has 1 test file | Core business logic at risk | REFACTOR-v2-005 |

---

## 7  CI/CD & Build Guardrails

### 7.1  Current Pipeline

```
ci.yml: lint-and-format → typecheck → test-api → build → security-scan → e2e-tests (PR)
```

### 7.2  Status of v1 CI Issues

| v1 Issue | Status |
|----------|--------|
| C-01 `npm audit` in pnpm workspace | ✅ Fixed → `pnpm audit` |
| C-02 No SBOM generation | ⏳ Stub exists but not wired into pipeline |
| C-03 No coverage gate | ✅ Fixed → ratchet threshold at 26% |
| C-04 Docker Node 18 | ✅ Fixed → Node 20 |
| C-05 Web test `\|\|` fallback | ✅ Fixed |
| C-06 No arch lint | ✅ Fixed → dependency-cruiser added |
| C-07 Trivy sarif not uploaded | ⏳ Not yet connected to Security tab |
| C-08 Renovate MUI group | ✅ Fixed |

### 7.3  Remaining CI Gaps

| # | Gap | Impact |
|---|-----|--------|
| C-09 | SBOM generation not in CI pipeline | No supply-chain visibility |
| C-10 | Trivy sarif → GitHub Security tab not wired | Vuln findings invisible |
| C-11 | Web and mobile test steps not coverage-gated | Coverage can silently drop |
| C-12 | Dependency-cruiser rule exists but not in Turbo tasks or CI | Layer violations undetected in PR |
| C-13 | Turbo `typecheck` doesn't depend on `^typecheck` | Cross-package type errors may slip through |

---

## 8  Module-Level Usage Guides

### 8.1  `packages/database`
- **Tech:** Prisma 7.3, `@prisma/adapter-pg`, `PrismaPg({ connectionString })`
- **Schema:** 43 models, 39 enums, 1,448 LoC in `prisma/schema/`
- **Usage:** `cd packages/database && npx prisma migrate dev`
- **Consumed by:** `apps/api` (direct dep)
- **Post-refactor note:** `prisma.config.ts` at package root configures the PrismaPg adapter

### 8.2  `packages/shared-types`
- **Tech:** Pure TypeScript interfaces/enums (no runtime code)
- **LoC:** 1,666 across 12 files
- **Usage:** `pnpm build` to compile; import from `@rental-portal/shared-types`
- **Consumed by:** `apps/web` (3 actual consumers via barrel), `apps/mobile` (via mobile-sdk)
- **⚠️ Adoption gap:** API has 0 imports; web has 23 files importing local `~/types/` instead

### 8.3  `packages/mobile-sdk`
- **Status:** ⛔ Deprecated — recommend deletion
- **What:** Single 986-LoC file re-exporting shared-types + raw fetch API client
- **Consumed by:** `apps/mobile`
- **Replacement:** Direct `shared-types` import + axios

### 8.4  `apps/api` — Common Layer (Post-Refactor)

| Sub-module | Responsibility | LoC | Status |
|------------|---------------|-----|--------|
| `auth/` | Re-exports guards/decorators from `modules/auth/` | barrel | ✅ New in refactor |
| `storage/` | S3 upload, presigned URLs | ~1,100 | ✅ Merged with former `upload/` |
| `events/` | Domain event bus (NestJS EventEmitter) | ~890 | ✅ |
| `scheduler/` | Cron-based background jobs | ~470 | ✅ Uses `EmbeddingInterface` |
| `email/` | Single `EmailPort` + Resend adapter | ~340 | ✅ Consolidated |
| `rate-limit/` | Throttle middleware | ~260 | ✅ |
| `cache/` | Redis caching layer | ~260 | ✅ |
| `logger/` | Winston structured logging | ~190 | ✅ |
| `health/` | Terminus health checks | ~170 | ✅ |
| `filters/` | Exception filters | ~150 | ✅ |
| `interfaces/` | Port interfaces (EmbeddingInterface) | new | ✅ New in refactor |
| `security/` | Helmet, CORS | ~120 | ✅ |
| `swagger/` | OpenAPI setup | ~110 | ✅ |
| `prisma/` | PrismaService | ~65 | ✅ |
| `pipes/` | Validation pipes | ~46 | ✅ |
| `telemetry/` | OpenTelemetry + Sentry | new | ✅ New in refactor |

---

## 9  Observability Assessment (Post-Refactor)

| Pillar | v1 Status | v2 Status | Details |
|--------|-----------|-----------|---------|
| **Logging** | 🟡 Partial | ✅ Good | Winston + `x-request-id` correlation middleware |
| **Metrics** | 🔴 None | 🟡 Partial | OpenTelemetry auto-instrumentation; no custom business metrics yet |
| **Tracing** | 🔴 None | ✅ Good | `@opentelemetry/sdk-node` + auto-instrumentations |
| **Health checks** | ✅ Good | ✅ Good | Terminus: DB + Redis |
| **Error tracking** | 🔴 None | ✅ Good | `@sentry/nestjs` integrated |

**Next step:** Add custom business metrics (booking completion rate, payment success rate, search latency percentiles).

---

## 10  Web App Architecture Notes

### 10.1  Route Count & Structure
- **72 routes** in `apps/web/app/routes/`
- State management: **Zustand** (1 auth store) + **TanStack Query** (server state)
- Styling: **Tailwind CSS 4** + `components/ui/` design system (3,959 LoC)

### 10.2  Auth Token Dual-Write (F-25)

The web app stores auth tokens in two places:
1. Zustand persist (localStorage under Zustand key)
2. Direct `localStorage.setItem('accessToken', ...)` calls

This creates subtle bugs when one write succeeds but the other fails, or when clearing state doesn't clear both.

**Fix:** Remove direct localStorage calls; let Zustand persist handle token storage exclusively.

### 10.3  Oversized Routes (from v1 — partially addressed)

| Route | LoC | Status |
|-------|-----|--------|
| `listings.new.tsx` | ~1,480 | ⏳ Steps partially extracted to `components/listings/steps/` |
| `listings.$id.edit.tsx` | ~1,262 | ⏳ Still monolithic |
| `search.tsx` | ~1,229 | ⏳ Still monolithic |
| `messages.tsx` | ~1,003 | ⏳ Still monolithic |

### 10.4  Component Library
`components/ui/` at 3,959 LoC is the de-facto design system. Well-structured for current needs. Could be extracted to `packages/ui` if mobile-web component sharing is desired in the future.

---

## 11  Refactor Tickets

See [refactor-tickets.md](refactor-tickets.md) for the **v2 backlog** (new tickets REFACTOR-v2-001 through REFACTOR-v2-012).

---

## Appendix A — Metrics Summary

| Metric | v2 Value | v3 Value (latest) | Δ |
|--------|----------|-------------------|---|
| Total LoC (prod) | 122,305 | 122,675 | +370 |
| API LoC | 48,269 | 48,313 | +44 |
| Web LoC | 56,493 | 56,313 | -180 |
| Mobile LoC | 11,211 | 11,211 | — |
| Database LoC (src + prisma) | 3,680 | 3,680 | — |
| Shared-types LoC | 1,666 | 2,172 | +506 |
| Mobile-sdk LoC | 986 | 986 | — |
| API modules | 21 | 21 | — |
| Prisma models | 43 | 43 | — |
| Prisma enums | 39 | 39 | — |
| Web routes | 72 | 72 | — |
| Test files | 99 | 99 | — |
| API test suites / tests | 49 / 648 | 49 / 648 | — |
| API line coverage | 26% | 26% | — |
| `forwardRef` usages | 2 | **0** | ✅ Fixed |
| Prisma-in-controller violations | 7 | **0** | ✅ Fixed |
| Version mismatches | 6 | **4** (2 accepted, 2 constraint-blocked) | ✅ Reduced |
| API dependencies | 48 prod + 30 dev | 45 prod + 30 dev | ✅ Cleaned |
| Web dependencies | 29 prod + 33 dev | 27 prod + 33 dev | ✅ Cleaned |
| Mobile dependencies | 21 prod + 9 dev | 21 + 9 | — |

## Appendix B — Tool Output Locations

| Tool | Output | Generated By |
|------|--------|-------------|
| `outputs/inventory.json` | LoC, test counts, dep counts, version mismatches | `tools/inventory.sh` |
| `outputs/dep-graph.txt` | Cross-module imports, violations, module sizes | `tools/dep-graph.sh` |
