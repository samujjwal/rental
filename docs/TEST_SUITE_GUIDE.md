# GharBatai — Test Suite Guide

> Generated alongside the prompt-pack test execution.  
> **22 new test files · ~3 600 lines of test code · 6 test categories**

---

## Quick Commands

```bash
# ── All unit + service tests ────────────────────────────
pnpm test                                  # Turbo: all workspaces
pnpm run test:coverage                     # Coverage across workspaces

# ── API only ─────────────────────────────────────────────
pnpm --filter @rental-portal/api test             # Jest 30 (unit + service)
pnpm --filter @rental-portal/api test:coverage    # + coverage report
pnpm --filter @rental-portal/api test:property    # Property-based (fast-check)
pnpm --filter @rental-portal/api test:chaos       # Chaos / fault-injection
pnpm --filter @rental-portal/api test:e2e         # Integration / E2E (needs DB + Redis)
pnpm --filter @rental-portal/api test:smoke       # Smoke-only integration suite
pnpm --filter @rental-portal/api test:security    # Security / OWASP-focused suite

# ── Web ──────────────────────────────────────────────────
pnpm --filter @rental-portal/web test             # Vitest (unit + component)
pnpm --filter @rental-portal/web test:coverage    # + coverage
pnpm --filter @rental-portal/web test:e2e         # Core Playwright suite
pnpm --filter @rental-portal/web test:e2e:full    # Full Playwright suite

# ── Mobile ───────────────────────────────────────────────
pnpm --filter rental-portal-mobile test           # jest-expo
pnpm --filter rental-portal-mobile test:e2e       # Maestro flows

# ── Root shortcuts ───────────────────────────────────────
pnpm run test:smoke        # API smoke E2E
pnpm run test:security     # API security E2E
pnpm run test:property     # API property-based
pnpm run test:chaos        # API chaos tests
pnpm run test:e2e:web      # Web E2E with local infra bootstrap
pnpm run test:e2e:mobile   # Mobile E2E (Maestro)
pnpm run test:load -- api  # k6 baseline load test
```

---

## Test Categories

### 1. Property-Based Tests (`fast-check`)

| File                                                 | Focus                                            | # Tests |
| ---------------------------------------------------- | ------------------------------------------------ | ------- |
| `booking-calculation.property.spec.ts`               | Duration, base price, discounts, total invariant | 10      |
| `tax-calculation.property.spec.ts`                   | Tax ≥ 0, rounding, monotonicity                  | 7       |
| `booking-state-overlap-slug-filter.property.spec.ts` | Date overlap, slug safety, FSM, filter builder   | ~12     |

> Seed: `42`, 100 runs per property. Increase with `fc.configureGlobal({ numRuns: 1000 })`.

### 2. Backend Unit / Service Tests

| File                                       | Service Under Test             | # Tests |
| ------------------------------------------ | ------------------------------ | ------- |
| `filter-builder.service.spec.ts`           | FilterBuilderService           | 23      |
| `notification-template.service.spec.ts`    | NotificationTemplateService    | 8       |
| `notification-preferences.service.spec.ts` | NotificationPreferencesService | 8       |
| `kyc.service.spec.ts`                      | KycService                     | 11      |
| `data-export.service.spec.ts`              | DataExportService              | 4       |
| `moderation-queue.service.spec.ts`         | ModerationQueueService         | 10      |
| `oauth.service.spec.ts`                    | OAuthService                   | 9       |
| `fraud-detection.service.spec.ts`          | FraudDetectionService          | 16      |
| `admin-users.service.spec.ts`              | AdminUsersService              | 12      |

### 3. Smoke Suite

| File                              | Runner           | Coverage                                                                       |
| --------------------------------- | ---------------- | ------------------------------------------------------------------------------ |
| `apps/api/test/smoke.e2e-spec.ts` | Jest + Supertest | Auth, listings, categories, search, bookings, favorites, notifications, health |
| `apps/web/tests/smoke.test.tsx`   | Vitest           | Category context, formatCurrency, cn utility                                   |

### 4. Security Tests (OWASP)

| File                                 | Vectors                                                                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/api/test/security.e2e-spec.ts` | A01 Access Control, A02 Crypto, A03 Injection (SQLi + XSS), A04 Insecure Design, A05 Misconfiguration, A07 Auth Failures, Input Validation |

### 5. Chaos / Fault-Injection Tests

| File                         | Scenarios                                                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/chaos.spec.ts` | Null/undefined resilience, template injection, 1 000-parallel concurrency, DB failure simulation, Unicode/emoji/zero-width edge cases |

### 6. Web Component Tests

| File                       | Component                                                                             | # Tests |
| -------------------------- | ------------------------------------------------------------------------------------- | ------- |
| `utils.test.ts`            | cn, formatCurrency, formatNumber, formatDate, truncateText, getInitials, isLightColor | 20      |
| `badge.test.tsx`           | Badge variants                                                                        | 8       |
| `card.test.tsx`            | Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription                 | 10      |
| `StatusBadge.test.tsx`     | StatusBadge colors, sizes                                                             | 9       |
| `category-context.test.ts` | getCategoryFamily, getCategoryContext                                                 | 10      |

### 7. Mobile Component Tests

| File                       | Components                                             | # Tests |
| -------------------------- | ------------------------------------------------------ | ------- |
| `core-components.test.tsx` | Toast (4), StaticInfoScreen (3), Theme (5), Config (2) | 14      |

---

## CI Pipeline (recommended order)

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck

  unit:
    needs: lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm run test:coverage
      - uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: apps/api/coverage/lcov.info

  property:
    needs: lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:property

  smoke:
    needs: unit
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg15
        env:
          POSTGRES_DB: rental_test
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        ports: ['5432:5432']
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @rental-portal/api build
      - run: pnpm test:smoke

  security:
    needs: unit
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg15
        env:
          POSTGRES_DB: rental_test
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        ports: ['5432:5432']
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @rental-portal/api build
      - run: pnpm test:security
```

---

## Coverage Gates

| Workspace | Branches | Functions | Lines | Statements |
| --------- | -------- | --------- | ----- | ---------- |
| API       | 31%      | 25%       | 26%   | 26%        |
| Web       | 15%      | 15%       | 15%   | 15%        |
| Mobile    | 20%      | 20%       | 20%   | 20%        |

> Ratchet up thresholds quarterly after adding these new tests.

---

## File Inventory (22 new test files)

```
apps/api/src/
  chaos.spec.ts
  modules/
    admin/services/
      admin-users.service.spec.ts
      filter-builder.service.spec.ts
    auth/services/
      oauth.service.spec.ts
    bookings/services/
      booking-calculation.property.spec.ts
      booking-state-overlap-slug-filter.property.spec.ts
    fraud-detection/services/
      fraud-detection.service.spec.ts
    moderation/services/
      moderation-queue.service.spec.ts
    notifications/services/
      notification-preferences.service.spec.ts
      notification-template.service.spec.ts
    tax/services/
      tax-calculation.property.spec.ts
    users/services/
      data-export.service.spec.ts
      kyc.service.spec.ts

apps/api/test/
  security.e2e-spec.ts
  smoke.e2e-spec.ts

apps/web/
  tests/smoke.test.tsx
  app/lib/utils.test.ts
  app/lib/category-context.test.ts
  app/components/ui/badge.test.tsx
  app/components/ui/card.test.tsx
  app/components/ui/StatusBadge.test.tsx

apps/mobile/src/__tests__/components/
  core-components.test.tsx
```
