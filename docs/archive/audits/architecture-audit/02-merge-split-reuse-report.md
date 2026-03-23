# 02. Merge / Split / Reuse Report — GharBatai Monorepo

> Based on `outputs/inventory.json`, `outputs/dep-graph.txt`, and manual code review.

---

## Summary Table

| Module | Stack | LoC | Decision | Rationale |
|--------|-------|----:|----------|-----------|
| `apps/api/modules/admin` | NestJS | 3,901 | **Split** | `admin.service.ts` alone ~3,000 LoC — god-service mixing CRUD, analytics, user mgmt |
| `apps/api/modules/notifications` | NestJS | 3,226 | **Merge controllers** | 5 controllers with overlapping routes; consolidate to 3 |
| `packages/mobile-sdk` | TypeScript | 986 | **Delete** | Single god-file re-exporting shared-types + raw fetch client |
| `packages/shared-types` | TypeScript | 2,172 | **Promote** → single source of truth | Currently underadopted: API 0 imports, web proxies through local types |
| `apps/web/app/types/` | TypeScript | ~968 | **Delete** → migrate to shared-types | 6 local type files duplicating shared-types content |
| `apps/web/app/lib/api-*.ts` | TypeScript | 3 files | **Merge** | `api-client.ts` + `api-enhanced.ts` + `api-client.server.ts` — consolidate client-side |
| `apps/api/common/auth/` | NestJS | barrel | **Increase adoption** | Barrel exists but 31+ modules still import from `@/modules/auth/` directly |
| `apps/api/modules/bookings` | NestJS | 2,849 | **Keep** | Large but cohesive; 7 services with clear single-responsibility |
| `apps/api/modules/listings` | NestJS | 3,575 | **Keep** | Multiple controllers/services, well-scoped; no action needed |
| `apps/api/modules/payments` | NestJS | 3,035 | **Keep** | Webhook handler is dense but self-contained |

---

## Detailed Findings

### Split: `admin` module (3,901 LoC)

**Symptoms:**
- `admin.service.ts` is ~3,000 LoC — largest single file in codebase
- Mixes CRUD operations, analytics queries, dashboard aggregations, and user management
- Single test file for all behaviors — insufficient coverage isolation

**Plan:**
1. Extract analytics/dashboard methods → `admin-analytics.service.ts` (already partially done)
2. Extract user management methods → `admin-users.service.ts` (already partially done)
3. Keep core admin CRUD in `admin.service.ts` (target: <800 LoC)
4. Update `admin.controller.ts` to inject the 3 specialized services
5. Split test file to match service boundaries

**Ticket:** REFACTOR-v2-005 · P1 · 4–6h

---

### Merge Controllers: `notifications` module (3,226 LoC)

**Symptoms:**
- 5 controllers with overlapping concerns:
  - `notifications.controller.ts` (main CRUD + admin)
  - `notification.controller.ts` (user prefs — singular/plural collision)
  - `inapp-notification.controller.ts` (in-app feed)
  - `admin-notifications.controller.ts` (admin email/SMS)
- Route prefix confusion between singular and plural

**Plan:**
1. Merge `notification.controller.ts` → `notifications.controller.ts`
2. Merge admin email + SMS into `admin-notifications.controller.ts`
3. Keep `inapp-notification.controller.ts` as-is (distinct concern)
4. Result: 3 controllers instead of 5

**Ticket:** REFACTOR-v2-004 · P1 · 1–2h

---

### Delete: `packages/mobile-sdk` (986 LoC)

**Symptoms:**
- Single `index.ts` file — god-file anti-pattern
- Re-exports shared-types under alias names (type shadowing)
- Bundles a raw `fetch()` API client when apps should use axios
- Types conflict with shared-types (e.g., `AuthResponse` field names)

**Plan:**
1. Replace mobile imports of `@rental-portal/mobile-sdk` with direct `@rental-portal/shared-types`
2. Replace raw fetch API client with axios (matching web patterns)
3. Delete `packages/mobile-sdk/` entirely
4. Remove from `pnpm-workspace.yaml` if needed

**Ticket:** Part of REFACTOR-v2-003 · P1 · included in 8–12h estimate

---

### Promote: `packages/shared-types` → Single Source of Truth

**Current adoption:**

| Consumer | Direct imports | Status |
|----------|---------------|--------|
| API | 0 | ❌ Uses own DTOs + Prisma types exclusively |
| Web | 8 files (through barrels) | ⚠️ 28 files still use local `~/types/` |
| Mobile | Via mobile-sdk re-exports | ⚠️ Aliased/conflicting shapes |

**Plan:**
1. Enrich shared-types with missing types (admin types, refined auth types)
2. Fix `AuthResponse.token` → `accessToken` to match API response
3. Migrate web: replace `~/types/*` imports with shared-types
4. Add `@rental-portal/shared-types` as API dependency for response DTOs
5. Delete mobile-sdk, use shared-types directly

**Ticket:** REFACTOR-v2-003 · P1 · 8–12h

---

### Delete Web Local Types: `apps/web/app/types/` (968 LoC)

**Current state:** 6 type files (`admin.ts`, `auth.ts`, `booking.ts`, `listing.ts`, `review.ts`, `user.ts`) that proxy from shared-types with local additions.

**Migration:** After enriching shared-types (above), these become pure re-exports. Delete and update 28 import sites to use shared-types directly or via `~/lib/shared-types.ts` barrel.

**Ticket:** Part of REFACTOR-v2-003

---

### Merge: Web API Client Files

**Current state:**
- `lib/api-client.ts` — base axios instance with auth interceptors
- `lib/api-enhanced.ts` — wrapper with retry logic, error normalization
- `lib/api-client.server.ts` — server-side (SSR) fetch client

**Plan:** Consolidate `api-client.ts` and `api-enhanced.ts` into a single `api-client.ts` with retry/error handling built in. Keep `api-client.server.ts` separate (SSR boundary).

**Ticket:** Housekeeping — P3

---

### Increase Adoption: `common/auth/` Barrel

**Current state:** `common/auth/index.ts` barrel exists and re-exports guards/decorators from `modules/auth/`. However, 31+ module files still import directly from `@/modules/auth/guards/*` and `@/modules/auth/decorators/*`.

**Plan:** Bulk search-and-replace to redirect all imports through barrel. No runtime change.

**Ticket:** REFACTOR-v2-011 · P2 · 1h

---

## Modules That Are Well-Scoped (No Action)

| Module | LoC | Why Keep |
|--------|-----|---------|
| auth | 1,956 | Clear boundaries, tested, proper guard/strategy separation |
| bookings | 2,849 | 7 services but each has single responsibility (pricing, state machine, calculation, invoicing) |
| categories | 1,587 | Template system is cohesive |
| listings | 3,575 | Large but well-structured (3 controllers, 7 services, proper separation) |
| payments | 3,035 | Webhook + Stripe + ledger is naturally dense |
| search | 1,622 | Clean |
| messaging | 1,152 | Gateway + service split is appropriate |
| moderation | 1,193 | Post-merge right-sized |
| All others (<1,000) | — | Already right-sized |
