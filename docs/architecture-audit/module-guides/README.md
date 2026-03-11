# Module Usage Guides — GharBatai Monorepo

> Updated: 2026-02-25 · Covers all 7 workspace packages + API common layer

---

## Package Guides

### `packages/database` — Prisma Schema & Migrations
| | |
|---|---|
| **What** | Prisma 7.3 schema (43 models, 39 enums), migration files, seed scripts, `PrismaWrapper` |
| **When** | Any data model change, new migration, seed data update |
| **How** | `cd packages/database && npx prisma migrate dev --name <name>` |
| **Where** | Consumed by `apps/api` as workspace dep. Provides `PrismaService` and adapter config |
| **Key files** | `prisma/schema/`, `prisma.config.ts`, `src/prisma-wrapper.ts` |
| **Post-refactor** | Uses `@prisma/adapter-pg` with `PrismaPg({ connectionString })`. Config in `prisma.config.ts` |

### `packages/shared-types` — Contract Type Definitions
| | |
|---|---|
| **What** | Pure TypeScript interfaces/enums for User, Listing, Booking, Review, Payment, Messaging, Nepal config (1,666 LoC, 12 files) |
| **When** | API response shape changes, new domain types |
| **How** | Edit in `src/`, run `pnpm build`. Import: `import { UserType } from '@rental-portal/shared-types'` |
| **Where** | Should be consumed by all apps. Currently: Web (3 files), Mobile (via mobile-sdk). API: 0 imports |
| **⚠️ Gap** | Severely underadopted. See REFACTOR-v2-003 for adoption plan |

### `packages/mobile-sdk` — Mobile API Client (Deprecated)
| | |
|---|---|
| **What** | Single 986-LoC file: re-exports shared-types + raw `fetch()` API client |
| **When** | ⛔ Do not add new code here |
| **Where** | Consumed by `apps/mobile` |
| **Status** | Marked for deletion in REFACTOR-v2-003. Replace with direct `shared-types` import + axios |

---

## App Guides

### `apps/api` — NestJS API Server
| | |
|---|---|
| **What** | NestJS 11, Express v5, 21 modules, ~230 routes, 48,269 LoC |
| **Run** | `cd apps/api && pnpm nest start --watch` (port 3400) |
| **Test** | `pnpm jest` (49 suites, 648 tests, 26% coverage ratchet) |
| **Deps** | `@rental-portal/database` |
| **Key patterns** | Module-per-domain, service layer, DTOs with `class-validator`, Bull queues for async, EventEmitter for domain events |

#### API Common Layer

| Sub-module | Purpose | Key Export |
|------------|---------|-----------|
| `common/auth/` | Auth guard/decorator barrel | `JwtAuthGuard`, `CurrentUser`, `RolesGuard`, `Roles` |
| `common/email/` | Email sending (Resend adapter) | `EmailService` via `EmailPort` interface |
| `common/storage/` | S3/MinIO file uploads | `StorageService`, upload controller |
| `common/events/` | Domain event bus | `EventEmitterModule` |
| `common/scheduler/` | Cron background jobs | `SchedulerService` |
| `common/cache/` | Redis caching | `CacheService` |
| `common/rate-limit/` | Request throttling | `ThrottlerGuard` config |
| `common/telemetry/` | OpenTelemetry + Sentry | Auto-instrumented tracing |
| `common/health/` | Terminus health checks | `/health` endpoint |
| `common/prisma/` | Prisma service | `PrismaService` |
| `common/interfaces/` | Port interfaces | `EmbeddingInterface` |

### `apps/web` — React Router Web App
| | |
|---|---|
| **What** | React 19, React Router v7, Vite 7, Tailwind CSS 4, 72 routes, 56,493 LoC |
| **Run** | `cd apps/web && pnpm dev` (port 3401) |
| **Test** | `pnpm vitest` (28 test files) + `pnpm playwright test` (27 e2e specs) |
| **Deps** | `@rental-portal/shared-types` |
| **Key patterns** | Zustand (auth store) + TanStack Query (server state), `components/ui/` design system, `lib/api/` HTTP client wrappers |

### `apps/mobile` — Expo React Native App
| | |
|---|---|
| **What** | Expo 52, React Native 0.76, React 18 (pinned), 11,211 LoC |
| **Run** | `cd apps/mobile && npx expo start` |
| **Test** | `pnpm jest` (5 test files) |
| **Deps** | `@rental-portal/mobile-sdk`, `@rental-portal/shared-types` |
| **Note** | React 18 is required by Expo 52. Do not force to 19 |

---

## Adding a New API Module

1. Create `apps/api/src/modules/<name>/` with:
   - `<name>.module.ts` (NestJS module)
   - `controllers/<name>.controller.ts`
   - `services/<name>.service.ts`
   - `dto/<name>.dto.ts` (class-validator DTOs)
2. Import auth from `@/common/auth` (NOT `@/modules/auth/guards/*`)
3. Register in `app.module.ts`
4. Add tests: `services/<name>.service.spec.ts`
5. Verify no circular deps: `npx depcruise --config .dependency-cruiser.cjs apps/api/src/modules/<name>/`
