# Refactor Tickets v2 — GharBatai Monorepo

> Generated: 2026-02-25 · Derived from [audit-report.md](audit-report.md) (v2)
> Previous tickets: [refactor-tickets-v1.md](refactor-tickets-v1.md) — all 16 tickets **implemented**

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

### REFACTOR-v2-001 · P0 — Extract Prisma calls from controllers to services
**Finding:** F-21
**Problem:** 7 `this.prisma.*` calls in controllers (bookings: 1, organizations: 6) violate the service-layer pattern. Cannot test controller logic independently; Prisma coupling makes unit tests require DB mocks at controller level.
**Steps:**
1. **bookings.controller.ts:108** — Move `this.prisma.dispute.findMany(...)` to `BookingsService.getDisputesForBooking(bookingId)` or `DisputesService.findByBooking(bookingId)`
2. **organizations.controller.ts** (6 calls) — Create new methods in `OrganizationsService`:
   - `getMembers(orgId): Promise<OrganizationMember[]>`
   - `getOrganization(orgId): Promise<Organization>`
   - `updateOrganization(orgId, data): Promise<Organization>`
   - `getMembership(orgId, userId): Promise<OrganizationMember>`
   - `removeMember(orgId, userId): Promise<void>`
3. Replace all `this.prisma.*` calls in controllers with service method calls
4. Remove `PrismaService` from controller constructor injections
5. Add unit tests for the new service methods

**Affected files:**
- `apps/api/src/modules/bookings/controllers/bookings.controller.ts`
- `apps/api/src/modules/organizations/controllers/organizations.controller.ts`
- `apps/api/src/modules/organizations/services/organizations.service.ts` (new methods)
- `apps/api/src/modules/bookings/services/bookings.service.ts` (new method)

**Risk:** Low — pure refactor, no behavior change
**Estimate:** 2–3 hours

---

### REFACTOR-v2-002 · P1 — Resolve Listings ↔ Search circular dependency
**Finding:** F-22
**Problem:** `listings.module.ts` uses `forwardRef(() => SearchModule)` and `ListingsController` injects `SearchService` directly. Circular dependencies are NestJS anti-patterns that cause init-order bugs and complicate testing.
**Steps:**
1. Identify the search endpoint in `ListingsController` that uses `SearchService`
2. Option A: **Move the endpoint** to `SearchController` where it belongs (search is the domain)
3. Option B: **Extract interface** — create `ISearchService` in `common/interfaces/`, inject via token
4. Remove `forwardRef` from `listings.module.ts`
5. Remove `SearchService` injection from `ListingsController`
6. Verify no other circular deps: `npx madge --circular apps/api/src/`

**Affected files:**
- `apps/api/src/modules/listings/listings.module.ts`
- `apps/api/src/modules/listings/controllers/listings.controller.ts`
- `apps/api/src/modules/search/controllers/search.controller.ts` (if moving endpoint)

**Risk:** Medium — route URL must remain stable; verify no frontend breaks
**Estimate:** 2–3 hours

---

### REFACTOR-v2-003 · P1 — Consolidate shared-types as single source of truth
**Finding:** F-19, F-20, F-28
**Problem:** Triple type duplication across `shared-types`, `web/types/`, and `mobile-sdk`. The `AuthResponse` type uses `token` in shared-types but `accessToken` in web/mobile. 23 web files import from local `~/types/` instead of shared-types. API has zero shared-types imports.
**Steps:**
1. **Audit type divergence:** Compare each domain type (User, Listing, Booking, Review, Auth) between all three locations
2. **Enrich shared-types:**
   - Add `admin.ts` (456 LoC currently only in web)
   - Fix `AuthResponse`: rename `token` → `accessToken` to match actual API response
   - Add any missing fields that web types have but shared-types doesn't
3. **Update web:** Replace `~/types/*.ts` imports with `@rental-portal/shared-types` or `~/lib/shared-types.ts` barrel
4. **Delete `apps/web/app/types/`** once all consumers migrated (keep barrel for convenience)
5. **For API:** Add `@rental-portal/shared-types` as dep; use for response DTOs where practical
6. **Delete `packages/mobile-sdk`:** Replace mobile imports with direct `@rental-portal/shared-types`

**Affected files:** ~30 web files, `packages/shared-types/src/`, `packages/mobile-sdk/` (delete), `apps/mobile/` imports
**Risk:** High — large surface area; do in 2–3 incremental PRs
**Estimate:** 8–12 hours

---

### REFACTOR-v2-004 · P1 — Consolidate notification controllers
**Finding:** F-23
**Problem:** 5 controllers in `notifications/` module with overlapping concerns (`notification.controller.ts` vs `notifications.controller.ts` singular/plural collision).
**Steps:**
1. Merge `notification.controller.ts` (user prefs) into `notifications.controller.ts` (main CRUD)
2. Merge `email.controller.ts` + `sms.controller.ts` into new `admin-notifications.controller.ts`
3. Keep `inapp-notification.controller.ts` as-is (distinct concern)
4. Result: 3 controllers instead of 5
5. Update `notifications.module.ts` controller registrations
6. Verify no route collisions
7. Run e2e tests

**Affected files:**
- `apps/api/src/modules/notifications/controllers/` (delete 2, merge into existing)
- `apps/api/src/modules/notifications/notifications.module.ts`

**Risk:** Low — pure consolidation, no business logic change
**Estimate:** 1–2 hours

---

### REFACTOR-v2-005 · P1 — Split admin.service.ts god-service
**Finding:** §4.5 (admin module 3,818 LoC)
**Problem:** `admin.service.ts` is 3,003 LoC — the largest single file in the codebase. It mixes CRUD operations, analytics queries, dashboard aggregations, and user management. Untestable as a unit.
**Steps:**
1. Extract analytics/dashboard methods → `admin-analytics.service.ts`
2. Extract user management methods → `admin-users.service.ts`
3. Keep core admin CRUD in `admin.service.ts` (target: <800 LoC)
4. Update `admin.controller.ts` to inject the 3 specialized services
5. Move `admin.service.spec.ts` tests to match new service boundaries
6. Add dedicated tests for each extracted service

**Affected files:**
- `apps/api/src/modules/admin/services/admin.service.ts` (reduce from 3,003 LoC)
- New: `admin-analytics.service.ts`, `admin-users.service.ts`
- `apps/api/src/modules/admin/admin.module.ts`
- `apps/api/src/modules/admin/controllers/admin.controller.ts`

**Risk:** Medium — large surface area; careful method-by-method extraction needed
**Estimate:** 4–6 hours

---

### REFACTOR-v2-006 · P2 — Remove duplicate form library
**Finding:** F-24
**Problem:** `react-hook-form` (10 files) and `@tanstack/react-form` (1 file: `EnhancedForm.tsx`) coexist. Two form state managers add bundle size and cognitive overhead.
**Steps:**
1. Convert `apps/web/app/components/admin/enhanced/EnhancedForm.tsx` from `@tanstack/react-form` to `react-hook-form`
2. Remove `@tanstack/react-form` from `apps/web/package.json`
3. Run `pnpm install` to clean lockfile
4. Verify EnhancedForm still works in browser

**Affected files:**
- `apps/web/app/components/admin/enhanced/EnhancedForm.tsx`
- `apps/web/package.json`

**Risk:** Low — 1 file to convert
**Estimate:** 30 min – 1 hour

---

### REFACTOR-v2-007 · P2 — Fix auth token dual-write
**Finding:** F-25
**Problem:** Web app writes auth tokens to both Zustand persist (localStorage) AND direct `localStorage.setItem('accessToken', ...)`. Logout may clear one but not the other, causing stale auth state.
**Steps:**
1. Grep for `localStorage.setItem.*accessToken\|localStorage.setItem.*token` in `apps/web/`
2. Remove all direct `localStorage` writes for auth tokens
3. Use Zustand `useAuthStore.getState().setToken(token)` as the single write path
4. Ensure logout clears Zustand state (which clears persist automatically)
5. Update any `localStorage.getItem('accessToken')` reads to use `useAuthStore.getState().token`
6. Test login/logout/refresh flows

**Affected files:** Auth-related files in `apps/web/app/`
**Risk:** Medium — must verify all auth flows still work
**Estimate:** 1–2 hours

---

### REFACTOR-v2-008 · P2 — Align dependency versions across workspace
**Finding:** F-26, F-27
**Problem:** axios version drift (1.8 vs 1.13), jest major split (29 vs 30), socket.io-client inconsistent pinning, and 4 duplicate deps in API that exist in database package.
**Steps:**
1. **axios:** Align all to `^1.13.4` (latest)
2. **jest + @types/jest:** Align mobile to `^30.2.0` (if Expo supports it; else document as accepted)
3. **socket.io-client:** Standardize to `^4.8.3` across all packages
4. **Remove duplicates from API:** Delete `@prisma/client`, `@prisma/adapter-pg`, `bcrypt`, `pg` from `apps/api/package.json` (they come transitively from `@rental-portal/database`)
5. Run `pnpm install` and verify all packages resolve correctly
6. Run full test suite

**Affected files:**
- `apps/api/package.json`, `apps/web/package.json`, `apps/mobile/package.json`

**Risk:** Low — minor version bumps + dep removal
**Estimate:** 1 hour

---

### REFACTOR-v2-009 · P2 — Add web and mobile coverage gates to CI
**Finding:** F-29, C-11
**Problem:** Only API has a coverage threshold (26% ratchet). Web and mobile tests have no coverage tracking. Coverage can silently drop.
**Steps:**
1. **Web:** Add `--coverage` to Vitest config; set initial threshold at 10%
2. **Mobile:** Add `--coverage` to Jest config; set initial threshold at 10%
3. Add coverage upload step in CI for all 3 apps
4. Add `coverageThreshold` ratchet config similar to API

**Affected files:**
- `apps/web/vitest.config.ts`
- `apps/mobile/package.json` (jest config)
- `.github/workflows/ci.yml`

**Risk:** Low
**Estimate:** 2 hours

---

### REFACTOR-v2-010 · P2 — Wire dependency-cruiser into CI + Turbo
**Finding:** C-12
**Problem:** `.dependency-cruiser.cjs` rules exist but aren't enforced in CI. Developers can still introduce layer violations without detection.
**Steps:**
1. Add Turbo task: `"arch-lint": { "dependsOn": ["^build"], "outputs": [] }`
2. Add script in root `package.json`: `"arch-lint": "depcruise --config .dependency-cruiser.cjs apps/api/src"`
3. Add CI step after typecheck: `pnpm turbo arch-lint`
4. Fix any current violations caught by the rules

**Affected files:**
- `turbo.json`
- `package.json` (root)
- `.github/workflows/ci.yml`

**Risk:** Low
**Estimate:** 1 hour

---

### REFACTOR-v2-011 · P2 — Bulk-update auth imports to use common/auth barrel
**Finding:** F-31
**Problem:** 31+ module files import auth guards/decorators directly from `@/modules/auth/guards/*` and `@/modules/auth/decorators/*` instead of the `@/common/auth/` barrel created in REFACTOR-006. The barrel exists but adoption is incomplete.
**Steps:**
1. Find all files: `grep -r "from '@/modules/auth/guards\|from '@/modules/auth/decorators" apps/api/src/modules/`
2. Replace imports with `from '@/common/auth'`
3. Verify barrel exports all needed symbols
4. Run full test suite

**Affected files:** ~31 controller/guard files across all modules
**Risk:** None — import path change only, same runtime symbols
**Estimate:** 1 hour (mostly search-and-replace)

---

### REFACTOR-v2-012 · P3 — Wire SBOM generation and Trivy upload in CI
**Finding:** C-09, C-10
**Problem:** No SBOM generation in pipeline; Trivy results go to sarif file but aren't uploaded to GitHub Security tab.
**Steps:**
1. Add SBOM step: `pnpm dlx @cyclonedx/cyclonedx-npm --output-file sbom.json`
2. Upload `sbom.json` as build artifact
3. After Trivy scan, add `github/codeql-action/upload-sarif@v3` step
4. Verify findings appear in GitHub Security → Code scanning alerts

**Affected files:**
- `.github/workflows/ci.yml`

**Risk:** None
**Estimate:** 30 min

---

## Summary Roadmap

| Sprint | Tickets | Theme | Est. Hours |
|--------|---------|-------|-----------|
| **Sprint 1** | v2-001, v2-006, v2-008, v2-011, v2-012 | Quick wins: layer fixes, dedup, CI | 5–7h |
| **Sprint 2** | v2-002, v2-004, v2-005, v2-010 | Architecture: circular dep, consolidation, god-service | 8–12h |
| **Sprint 3** | v2-003, v2-007, v2-009 | Contracts: shared-types adoption, auth fix, coverage | 11–15h |

### Effort Summary

| Priority | Count | Total Estimate |
|----------|-------|---------------|
| P0 | 1 | 2–3h |
| P1 | 4 | 15–23h |
| P2 | 6 | 6.5–9h |
| P3 | 1 | 0.5h |
| **Total** | **12** | **24–35.5h** |

---

## Dependency Graph (Ticket Order)

```
v2-001 (Prisma-in-controllers) → standalone
v2-002 (Listings↔Search cycle) → standalone
v2-003 (shared-types SSOT)     → depends on v2-007 (auth token fix)
v2-004 (Notification merge)    → standalone
v2-005 (Admin god-service)     → standalone
v2-006 (Form lib dedup)        → standalone
v2-007 (Auth dual-write)       → standalone
v2-008 (Dep version align)     → standalone
v2-009 (Coverage gates)        → standalone
v2-010 (Dep-cruiser in CI)     → standalone
v2-011 (Auth import barrel)    → standalone
v2-012 (SBOM + Trivy CI)       → standalone
```

Most tickets are independent and can be parallelized across developers. Only v2-003 (shared-types) depends on v2-007 (auth token fix) being done first to avoid migrating to a type with the wrong field name.
