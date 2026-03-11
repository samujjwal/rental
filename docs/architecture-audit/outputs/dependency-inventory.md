# Dependency Inventory — GharBatai Monorepo

> Auto-generated: 2026-02-25 (v3) · Source: `tools/inventory.sh`, `tools/dep-graph.sh`

---

## Workspace Topology

| Package | Name | Version | Deps | DevDeps | LoC (prod) |
|---------|------|---------|------|---------|------------|
| Root | `gharbatai-rentals` | 1.0.0 | 0 | 7 | — |
| apps/api | `@rental-portal/api` | 1.0.0 | 45 | 30 | 48,313 |
| apps/web | `@rental-portal/web` | 1.0.0 | 27 | 33 | 56,313 |
| apps/mobile | `rental-portal-mobile` | 0.1.0 | 21 | 9 | 11,211 |
| packages/database | `@rental-portal/database` | 1.0.0 | 6 | 5 | 3,680 |
| packages/shared-types | `@rental-portal/shared-types` | 1.0.0 | 0 | 1 | 2,172 |
| packages/mobile-sdk | `@rental-portal/mobile-sdk` | 0.1.0 | 1 | 0 | 986 |

**Total production LoC: 122,675** · **Total dependencies (union): ~170** · **Test files: 99**

---

## Internal Dependency Graph

```
gharbatai-rentals (root)
├── apps/api
│   └── @rental-portal/database
├── apps/web
│   └── @rental-portal/shared-types
├── apps/mobile
│   ├── @rental-portal/mobile-sdk
│   │   └── @rental-portal/shared-types
│   └── @rental-portal/shared-types
├── packages/database          (leaf — no workspace deps)
├── packages/shared-types      (leaf — no workspace deps)
└── packages/mobile-sdk
    └── @rental-portal/shared-types
```

**Key gap:** `@rental-portal/api` does **not** depend on `@rental-portal/shared-types`. Types are duplicated between API DTOs and the shared-types package.

---

## Version Conflict Matrix

| Dependency | apps/api | apps/web | apps/mobile | packages/database | Verdict |
|-----------|----------|----------|-------------|-------------------|---------|
| **typescript** | ^5.9.3 | ^5.9.3 | ^5.9.3 | ^5.9.3 | ✅ Aligned |
| **react** | — | ^19.2.4 | 18.3.1 | — | 🔴 Major split (Expo 52 pins React 18) — **accepted** |
| **@types/react** | — | ^19.2.10 | ~18.3.0 | — | 🔴 Follows react split — **accepted** |
| **jest** | ^30.2.0 | — | ^29.7.0 | — | 🟡 Mobile on 29 (jest-expo constraint) |
| **@types/jest** | ^30.0.0 | — | ^29.5.0 | — | 🟡 Follows jest |
| **axios** | ^1.13.4 | ^1.13.4 | — | — | ✅ Aligned |
| **socket.io-client** | ^4.8.3 (dev) | ^4.8.3 | ^4.8.3 | — | ✅ Aligned |
| **stripe** | ^20.3.0 | ^20.3.0 | — | — | ✅ Aligned (**but** web shouldn't have server SDK) |
| **date-fns** | ^4.1.0 | ^4.1.0 | — | — | ✅ Aligned |
| **bcrypt / @types/bcrypt** | ^6.0.0 | — | — | ^6.0.0 | ⚠️ Duplicate — remove from API (transitive via database) |
| **eslint** | ^9.39.2 | ^9.39.2 | — | — | ✅ Aligned |
| **prettier** | ^3.8.1 (root) | ^3.8.1 | — | — | ✅ Aligned |
| **@types/node** | ^25.1.0 | — | — | ^25.1.0 | ✅ Aligned |

---

## Blessed Stack

| Concern | Blessed | Current State | Action |
|---------|---------|---------------|--------|
| **Runtime** | Node ≥20 LTS | All aligned ✅ | — |
| **TypeScript** | ^5.9.x | All ^5.9.3 ✅ | — |
| **React (web)** | 19.x | ^19.2.4 ✅ | — |
| **React Native** | 0.76.x / React 18 | Correct for Expo 52 ✅ | — |
| **ORM** | Prisma 7.x | All ^7.3.0 ✅ | — |
| **Validation (API)** | class-validator | Used in all DTOs ✅ | — |
| **Validation (web)** | Zod + react-hook-form | Used across forms ✅ | — |
| **HTTP client** | axios ^1.13.x | API + Web ✅ | — |
| **State (web)** | Zustand + TanStack Query | ✅ | — |
| **Styling** | Tailwind CSS 4.x | ✅ | — |
| **Email** | Resend | Consolidated ✅ | — |
| **Storage** | S3 (MinIO dev) | Abstracted in `common/storage/` ✅ | — |
| **Queues** | Bull + Redis | ✅ | — |
| **Logging** | Winston | ✅ | — |
| **Tracing** | OpenTelemetry + Sentry | ✅ | — |

---

## API Module Size Distribution

| Module | LoC | Assessment |
|--------|-----|------------|
| admin | 3,901 | 🟠 Oversized — god-service (split recommended) |
| listings | 3,575 | 🟡 Large but cohesive (multiple services) |
| notifications | 3,226 | 🟠 Over-fragmented (too many controllers) |
| payments | 3,035 | 🟡 Webhook handler dense but self-contained |
| bookings | 2,849 | ✅ |
| auth | 1,956 | ✅ |
| search | 1,622 | ✅ |
| categories | 1,587 | ✅ |
| moderation | 1,193 | ✅ |
| messaging | 1,152 | ✅ |
| reviews | 881 | ✅ |
| organizations | 843 | ✅ |
| users | 827 | ✅ |
| disputes | 789 | ✅ |
| insurance | 787 | ✅ |
| tax | 733 | ✅ |
| geo | 718 | ✅ |
| fraud-detection | 569 | ✅ |
| analytics | 500 | ✅ |
| ai | 412 | ✅ |
| favorites | 375 | ✅ |

---

## Cross-Module Import Map (API)

| Source Module | Depends On | Via |
|--------------|-----------|-----|
| bookings | listings | `AvailabilityService` |
| bookings | notifications | `NotificationsService` |
| bookings | fraud-detection | `FraudDetectionService` |
| bookings | insurance | `InsuranceService` |
| bookings | moderation | `ContentModerationService` |
| search | ai | `EmbeddingService` |

**Upward violations (common/ → modules/):**

| Source | Target | Status |
|--------|--------|--------|
| `common/auth/index.ts` | `modules/auth/guards/*`, `modules/auth/decorators/*` | ✅ Intentional barrel |
| `common/scheduler/scheduler.module.ts` | `modules/ai/ai.module` | ⚠️ Mitigated by `EmbeddingInterface` |
| `common/storage/storage.controller.ts` | `modules/auth/guards/jwt-auth.guard` | ⚠️ Should use `common/auth` barrel |

---

## Shared-Types Adoption

| Consumer | Direct imports from `@rental-portal/shared-types` | Local type imports | Gap |
|----------|---------------------------------------------------|-------------------|-----|
| API | ❌ **0** | Uses Prisma-generated + own DTOs | Critical — no contract sharing |
| Web | 8 files (via `~/types/` barrels + `~/lib/shared-types.ts`) | 28 files from `~/types/` | Medium — types proxy through local barrels |
| Mobile | Via `mobile-sdk` re-exports | — | Medium |

---

## Test Distribution

| App | Test Files | Suites | Tests | Coverage | Gate |
|-----|-----------|--------|-------|----------|------|
| API | 66 | 49 | 648 | 26% (ratchet) | ✅ Enforced |
| Web | 28 | — | 86+ | Not tracked | ⚠️ No gate |
| Mobile | 5 | — | — | Not tracked | ⚠️ No gate |
| **Total** | **99** | — | — | — | — |
