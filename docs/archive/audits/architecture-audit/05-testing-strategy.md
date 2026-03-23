# 05. Testing Strategy & Quality Gates — GharBatai Monorepo

---

## 1  Test Pyramid

```
         ╱   E2E   ╲        ← 27 Playwright specs (web) + 17 API e2e = 44 files
        ╱────────────╲
       ╱ Integration  ╲     ← Minimal; API tests mock Prisma at service level
      ╱────────────────╲
     ╱   Unit Tests     ╲   ← 49 API suites (648 tests), 28 web test files, 5 mobile
    ╱────────────────────╲
   ╱  Contract / Schema   ╲  ← ❌ None — no runtime type validation between API ↔ clients
  ╱────────────────────────╲
```

---

## 2  Current State

### 2.1  API (`apps/api`)

| Metric | Value |
|--------|-------|
| Test framework | Jest 30 + ts-jest |
| Test files | 66 (49 unit suites + 17 e2e) |
| Test count | 648 |
| Line coverage | 26% (ratcheted) |
| Coverage gate | ✅ `coverageThreshold: { branches: 31, functions: 25, lines: 26, statements: 26 }` |
| Path aliases | `@/`, `@modules/`, `@common/`, `@config/` via `moduleNameMapper` |
| Test runner | `NODE_OPTIONS='--localstorage-file=...'` (otplib compatibility) |

**Patterns:**
- Services tested with mocked `PrismaService` (no real DB in unit tests)
- E2E tests use `@nestjs/testing` `Test.createTestingModule()` with Supertest
- Load tests via k6 (`test/load/`)
- Security tests via shell scripts + OWASP ZAP

### 2.2  Web (`apps/web`)

| Metric | Value |
|--------|-------|
| Test framework | Vitest 4 + Testing Library |
| Test files | 28 (~4 unit suites, rest are component tests) |
| Test count | ~86 |
| Coverage | Not tracked |
| Coverage gate | ❌ None |
| E2E | Playwright (27 spec files) |

**Patterns:**
- Component tests: `*.test.tsx` files alongside components
- Vitest configured inline in `vite.config.ts`
- E2E covers auth flows, admin, booking journeys, search, etc.

### 2.3  Mobile (`apps/mobile`)

| Metric | Value |
|--------|-------|
| Test framework | Jest 29 + jest-expo + Testing Library (React Native) |
| Test files | 5 |
| Coverage | Not tracked |
| Coverage gate | ❌ `coverageThreshold: { branches: 10, functions: 10, lines: 10, statements: 10 }` (not enforced in CI) |

---

## 3  Gaps

| # | Gap | Impact | Ticket |
|---|-----|--------|--------|
| G-01 | **No contract tests** between API response shapes and client type expectations | Silent breaking changes when API response changes | REFACTOR-v2-003 (part of shared-types adoption) |
| G-02 | **Web coverage not tracked in CI** | Coverage can drop without detection | REFACTOR-v2-009 |
| G-03 | **Mobile test coverage minimal** (5 files for 11k LoC) | Core mobile flows entirely untested | REFACTOR-v2-009 |
| G-04 | **`admin.service.ts` (3k LoC) has 1 test file** | Core admin logic at risk | REFACTOR-v2-005 |
| G-05 | **No integration tests with real DB** | Prisma query behavior untested | Future |
| G-06 | **No mutation testing** | False confidence from tests that pass but don't assert | Future |

---

## 4  Quality Gates (Current vs Target)

### Coverage Thresholds

| App | Current | Target (Sprint 3) | Enforcement |
|-----|---------|-------------------|-------------|
| API | 26% branches, 25% functions, 26% lines | 40% lines | Jest `coverageThreshold` (ratchet) |
| Web | Not tracked | 10% lines | Vitest `coverage.thresholds` |
| Mobile | 10% (defined, not enforced) | 10% lines | Jest `coverageThreshold` in CI |

### Adding Web Coverage Gate (REFACTOR-v2-009)

```typescript
// apps/web/vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: {
        lines: 10,
        branches: 10,
        functions: 10,
        statements: 10,
      },
    },
  },
});
```

### Ratchet Strategy

Coverage thresholds are **ratcheted** — they can only go up:
1. When coverage increases above the threshold, bump the threshold number.
2. CI fails if coverage drops below the ratchet.
3. Review thresholds quarterly and bump targets.

---

## 5  Testing Rules

### Unit Tests (All Apps)

- **Deterministic:** No network calls, no real DB, no file I/O.
- **Isolated:** Each test suite is independent; no shared mutable state.
- **Named by behavior:** `it('should reject booking when listing is unavailable')`.
- **Fast:** Target <10s for full suite in any module.

### Service Tests (API)

- Mock `PrismaService` at injection point.
- Test business logic paths: happy path, validation failures, edge cases.
- Use `Test.createTestingModule()` for proper NestJS DI.

### Component Tests (Web)

- Use `@testing-library/react` with `render()` and `screen` queries.
- Test user interactions, not implementation details.
- Mock API calls via MSW or manual mock.

### E2E Tests

| Scope | Tool | When |
|-------|------|------|
| Web user flows | Playwright | Every PR (chromium) |
| API endpoint flows | Jest + Supertest | CI pipeline |
| Cross-browser | Playwright multi-project | Release only |

---

## 6  Contract Testing (Recommended)

**Problem:** API returns `{ accessToken, refreshToken, user }` but `shared-types` defines `{ token, user }`. No automated check catches this divergence.

**Solution options:**

1. **JSON Schema validation:** API exports OpenAPI spec → generate types → diff against shared-types.
2. **Runtime validation:** API e2e tests validate response shape against shared-types Zod schemas (after migration to Zod-based contracts).
3. **Snapshot contracts:** API e2e tests snapshot response shapes → diff in CI.

**Recommended approach:** Option 1 — leverage existing `@nestjs/swagger` decorators to auto-generate OpenAPI spec, then validate against shared-types during CI.

---

## 7  Test Data

### API

- Comprehensive seed script: `packages/database/prisma/seed-comprehensive.ts`
- Test data for: users (admin, owner, renter), listings (all categories), bookings, payments, reviews
- Factory pattern recommended for unit tests (not yet implemented)

### Web

- Test data inline in test files
- Consider extracting shared fixtures to `tests/fixtures/`

---

## 8  Load & Security Testing

| Type | Tool | Scripts | Status |
|------|------|---------|--------|
| Load testing | k6 | `apps/api/test/load/` (4 scripts) | ✅ Manual |
| Security scan | OWASP ZAP | `apps/api/test/security/` | ✅ Manual |
| Stress testing | k6 | `tests/load/` (3 scripts) | ✅ Manual |
| Dependency audit | pnpm audit | CI step | ✅ Automated |
| Container scan | Trivy | CI step | ⚠️ Partial |
