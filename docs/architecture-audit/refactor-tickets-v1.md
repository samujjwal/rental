# Refactor Tickets — GharBatai Monorepo

> Generated: 2026-02-23 · Derived from [audit-report.md](audit-report.md)

---

## Priority Legend

| Label | Meaning |
|-------|---------|
| P0 | Blocks correctness or security — do within 1 sprint |
| P1 | High architectural debt — schedule within 2 sprints |
| P2 | Medium debt — backlog, address within quarter |
| P3 | Low / housekeeping — handle opportunistically |

---

## Tickets

### REFACTOR-001 · P0 — Align Prisma versions (database pkg 5 → 7)
**Finding:** F-01  
**Problem:** `packages/database` uses Prisma 5.22, but `apps/api` uses Prisma 7.3. Schema generation produces incompatible clients.  
**Steps:**
1. `cd packages/database && pnpm add prisma@^7.3.0 @prisma/client@^7.3.0 -D`
2. Run `npx prisma generate` — fix any breaking schema changes (Prisma 5→7 migration guide)
3. Run `npx prisma migrate diff` to verify no drift
4. Run full API test suite to confirm compatibility
5. Remove Prisma 5 from lockfile

**Affected files:** `packages/database/package.json`, `packages/database/prisma/schema.prisma`, seed scripts  
**Risk:** Medium — Prisma 7 has breaking changes in `$transaction` API  
**Estimate:** 2–4 hours

---

### REFACTOR-002 · P0 — Align Node.js version across CI, Docker, and local
**Finding:** F-03  
**Problem:** CI uses Node 20, Docker uses Node 18. Production runtime differs from test environment.  
**Steps:**
1. Create `.node-version` file at repo root: `20.x` (or `22` for LTS)
2. Update `apps/api/Dockerfile`: `FROM node:20-alpine` (both builder and runner stages)
3. Update `.github/workflows/ci.yml` env: `NODE_VERSION: "20"`
4. Add `engines.node` to root `package.json`: `">=20.0.0"`
5. Verify all docker-compose files reference updated image

**Affected files:** `Dockerfile`, `.node-version`, `package.json`, `ci.yml`  
**Risk:** Low  
**Estimate:** 30 min

---

### REFACTOR-003 · P1 — Consolidate email providers to single adapter
**Finding:** F-04  
**Problem:** Three email providers (SendGrid, Resend, Nodemailer) are all wired up simultaneously.  
**Steps:**
1. Create `common/email/email-port.interface.ts` with `send(to, subject, html)` contract
2. Keep `common/email/resend-email.service.ts` as the single implementation
3. Update `common/email/email.module.ts` to provide only the Resend adapter
4. Delete `modules/notifications/services/sendgrid.service.ts`
5. Delete `modules/notifications/services/email.service.ts` (the nodemailer one)
6. Update `modules/notifications/notifications.module.ts` to import from `common/email/`
7. Remove `@sendgrid/mail` and `nodemailer` from `apps/api/package.json`
8. Remove `@types/nodemailer` from devDeps
9. Run tests

**Affected files:** ~12 files across `common/email/` and `modules/notifications/`  
**Risk:** Medium — verify all email-sending paths are covered  
**Estimate:** 3–4 hours

---

### REFACTOR-004 · P1 — Merge duplicate upload controllers
**Finding:** F-07  
**Problem:** `common/storage/upload.controller.ts` and `common/upload/upload.controller.ts` are parallel implementations of the same file-upload endpoint.  
**Steps:**
1. Compare both files — identify which routes are live vs dead
2. Consolidate into `common/storage/upload.controller.ts`
3. Move `JwtAuthGuard` and `CurrentUser` decorator to `common/auth/` (fixes F-06 too)
4. Delete entire `common/upload/` directory
5. Update `common/storage/storage.module.ts` imports
6. Run e2e tests for upload endpoints

**Affected files:** `common/storage/`, `common/upload/` (delete), `common/auth/` (new)  
**Risk:** Low — one of the two is likely unused  
**Estimate:** 1–2 hours

---

### REFACTOR-005 · P1 — Merge duplicate moderation services
**Finding:** F-09  
**Problem:** `common/moderation/content-moderation.service.ts` duplicates `modules/moderation/services/content-moderation.service.ts`.  
**Steps:**
1. Audit call sites — which service is injected where?
2. Keep `modules/moderation/` as the canonical home (it already has tests + image moderation)
3. Delete `common/moderation/` directory
4. Update imports in any module that referenced `common/moderation/`
5. Run moderation-related tests

**Affected files:** `common/moderation/` (delete), `modules/moderation/`  
**Risk:** Low  
**Estimate:** 1 hour

---

### REFACTOR-006 · P1 — Fix upward imports (common → modules)
**Finding:** F-06  
**Problem:** 6 files in `common/` import from `modules/`, violating dependency direction.  
**Steps:**
1. **Auth guards/decorators:** Create `common/auth/` with `JwtAuthGuard`, `CurrentUser`, `RolesGuard` extracted from `modules/auth/`
2. **Scheduler → AI:** Inject `EmbeddingService` via an interface; or move scheduling logic into `modules/ai/`
3. Update module imports and dependency injection tokens
4. Add `dependency-cruiser` rule to prevent future violations (see REFACTOR-013)

**Affected files:** `common/scheduler/`, `common/storage/`, `common/upload/`, new `common/auth/`  
**Risk:** Medium — DI token changes may break wiring  
**Estimate:** 3–4 hours

---

### REFACTOR-007 · P1 — Make shared-types the single source of truth
**Finding:** F-05  
**Problem:** `packages/shared-types` has 1666 LoC of types but the web app maintains 968 LoC of diverged local types. The API doesn't use shared-types at all.  
**Steps:**
1. Audit `apps/web/app/types/` vs `packages/shared-types/src/` — create mapping of overlaps
2. Enrich `shared-types` to cover all web type needs (add `admin.ts`, expand `user.ts`)
3. Update `apps/web/app/types/` to re-export from `@rental-portal/shared-types`
4. Gradually delete local type files, replacing imports
5. For API: add `@rental-portal/shared-types` as dep; use for response DTOs (or generate DTOs from types)
6. Delete `packages/mobile-sdk` — replace with direct `@rental-portal/shared-types` import in mobile

**Affected files:** All web type imports, `packages/shared-types/`, `packages/mobile-sdk/` (delete)  
**Risk:** High — large surface area, requires careful type-by-type migration  
**Estimate:** 8–12 hours (spread across 2–3 PRs)

---

### REFACTOR-008 · P2 — Increase API test coverage to 60%
**Finding:** F-10  
**Problem:** 22.8% line coverage. Critical business logic (payments, bookings, auth) may have gaps.  
**Steps:**
1. Run `npx jest --coverage` and identify uncovered files by module
2. Priority order: `payments/` → `bookings/` → `auth/` → `listings/`
3. Add unit tests for services; integration tests for controller + DB
4. Set coverage threshold in `jest.config.ts`: `coverageThreshold: { global: { lines: 60 } }`
5. Enforce in CI

**Affected files:** New test files across `modules/`  
**Risk:** None  
**Estimate:** 20+ hours (ongoing)

---

### REFACTOR-009 · P2 — Add mobile test foundation
**Finding:** F-11  
**Problem:** 10.8k LoC mobile app has zero tests.  
**Steps:**
1. Add Jest + React Native Testing Library to `apps/mobile/package.json`
2. Create test scaffold for 5 critical screens: `HomeScreen`, `SearchScreen`, `BookingDetailScreen`, `LoginScreen`, `CheckoutScreen`
3. Add to CI pipeline
4. Set initial coverage target: 30%

**Affected files:** `apps/mobile/package.json`, new `__tests__/` directory  
**Risk:** Low  
**Estimate:** 8–10 hours

---

### REFACTOR-010 · P2 — Extract oversized routes into components
**Finding:** F-13  
**Problem:** `listings.new.tsx` (1480), `listings.$id.edit.tsx` (1262), `search.tsx` (1229) exceed 500 LoC guideline.  
**Steps:**
1. `listings.new.tsx` → Extract each step (Basic Info, Location, Pricing, Photos, Review) into `components/listings/create/Step*.tsx`
2. `listings.$id.edit.tsx` → Same pattern for edit steps
3. `search.tsx` → Extract `SearchFilterSidebar`, `SearchResults`, `SearchMapPanel`
4. Keep route files as thin orchestrators (~100–200 LoC each)

**Affected files:** 3 routes + ~10 new component files  
**Risk:** Low — pure refactor, no behavior change  
**Estimate:** 6–8 hours

---

### REFACTOR-011 · P2 — Delete duplicate useDebounce hook
**Finding:** F-12  
**Problem:** `hooks/useDebounce.ts` (1055 LoC) and `hooks/use-debounce.ts` (382 LoC) coexist.  
**Steps:**
1. Grep all imports of `use-debounce` — update to `useDebounce`
2. Delete `apps/web/app/hooks/use-debounce.ts`
3. Verify no broken imports

**Affected files:** `hooks/use-debounce.ts` (delete), importing routes  
**Risk:** None  
**Estimate:** 15 min

---

### REFACTOR-012 · P2 — Remove Joi; standardize on class-validator
**Finding:** From §3.3  
**Problem:** Joi is used in exactly 1 file while the rest of the API uses class-validator.  
**Steps:**
1. Find the Joi usage: `apps/api/src/config/`
2. Convert to `@nestjs/config` `Joi`-free validation or `class-validator`
3. Remove `joi` from `apps/api/package.json`

**Affected files:** 1 config file, `package.json`  
**Risk:** None  
**Estimate:** 30 min

---

### REFACTOR-013 · P2 — Add dependency-cruiser for architectural rules
**Finding:** F-06, C-06  
**Problem:** No automated enforcement of layer boundaries.  
**Steps:**
1. `pnpm add -Dw dependency-cruiser`
2. Create `.dependency-cruiser.cjs` with rules:
   - `common/` may not import from `modules/`
   - `modules/X` may not import from `modules/Y` (except via events)
   - No circular dependencies
3. Add Turbo task: `"arch-lint": { "outputs": [] }`
4. Add to CI

**Affected files:** `.dependency-cruiser.cjs`, `turbo.json`, CI workflow  
**Risk:** None  
**Estimate:** 2 hours

---

### REFACTOR-014 · P3 — Fix CI pipeline issues
**Finding:** C-01 through C-08  
**Steps:**
1. Replace `npm audit` with `pnpm audit --audit-level moderate`
2. Add SBOM step: `pnpm dlx @cyclonedx/cyclonedx-npm --output-file sbom.json`
3. Remove `|| echo "No tests configured yet"` from web test step
4. Add `github/codeql-action/upload-sarif` after Trivy scan
5. Add coverage threshold check for API tests
6. Remove MUI group from `renovate.json`
7. Add `.node-version` file (see REFACTOR-002)

**Affected files:** `.github/workflows/ci.yml`, `renovate.json`  
**Risk:** None  
**Estimate:** 1–2 hours

---

### REFACTOR-015 · P3 — Add baseline observability
**Finding:** §9  
**Steps:**
1. Add `@opentelemetry/sdk-node`, `@opentelemetry/auto-instrumentations-node`
2. Create `common/telemetry/telemetry.module.ts` for tracing + metrics
3. Add `x-request-id` middleware to Express for log correlation
4. Integrate Sentry for error tracking (`@sentry/nestjs`)
5. Export metrics endpoint for Prometheus scraping

**Affected files:** New `common/telemetry/`, `main.ts` bootstrap  
**Risk:** Low  
**Estimate:** 4–6 hours

---

### REFACTOR-016 · P3 — Upgrade mobile TypeScript to ^5.9
**Finding:** F-17  
**Problem:** Mobile uses `~5.6.0` while the rest of the workspace uses `^5.9.3`.  
**Steps:**
1. Update `apps/mobile/package.json`: `typescript: "^5.9.3"`
2. Run `pnpm install`
3. Fix any new strict-mode errors

**Affected files:** `apps/mobile/package.json`  
**Risk:** Low  
**Estimate:** 30 min

---

## Summary Roadmap

| Sprint | Tickets | Theme |
|--------|---------|-------|
| **Sprint 1** | REFACTOR-001, 002, 011, 012, 016 | Quick wins — version alignment, dedup |
| **Sprint 2** | REFACTOR-003, 004, 005, 006 | Architecture cleanup — merge duplicates, fix layers |
| **Sprint 3** | REFACTOR-007, 013, 014 | Contracts + CI guardrails |
| **Ongoing** | REFACTOR-008, 009, 010, 015 | Test coverage + observability |
