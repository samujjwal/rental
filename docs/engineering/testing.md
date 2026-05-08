---
status: canonical
owner: engineering
last_reviewed: 2026-05-08
source_of_truth: true
---

# Testing Guide

This is the canonical overview of how testing is organized in the repository.

## Test Pyramid

```
        /\
       /  \
   / E2E \          (route-aligned Playwright release suites)
     /--------\
    / Integration \     (API, WebSocket, Payment tests)
   /--------------\
  /    Unit Tests    \   (900+ Jest/Vitest tests)
 /--------------------\
```

## Test Layers

- **Unit Tests**: Individual units of code in isolation (Jest, Vitest)
- **Integration Tests**: Module interactions with real dependencies
- **API E2E Tests**: Full API workflows with HTTP request/response validation
- **Web E2E Tests**: Playwright browser journeys (route-aligned suites)
- **Mobile E2E Tests**: Maestro mobile flows
- **Property Tests**: Fast-check edge case detection
- **Security Tests**: OWASP ZAP, npm audit
- **Performance Tests**: K6 load testing
- **Chaos Tests**: Fault injection and resilience

## Core Commands

```bash
# All tests
pnpm test
pnpm run test:coverage

# API tests
pnpm --filter @rental-portal/api test
pnpm --filter @rental-portal/api test:e2e
pnpm --filter @rental-portal/api test:smoke
pnpm --filter @rental-portal/api test:security
pnpm --filter @rental-portal/api test:property
pnpm --filter @rental-portal/api test:chaos

# Web tests
pnpm --filter @rental-portal/web test
pnpm run test:e2e:web
pnpm run test:e2e:web:full

# Mobile tests
pnpm --filter rental-portal-mobile test
pnpm run test:e2e:mobile:syntax
pnpm run test:e2e:mobile:doctor
pnpm run test:e2e:mobile

# Performance
pnpm run test:load
```

## Test Ownership By Area

- `apps/api/test/`
  API integration, security, load, and smoke suites
- `apps/api/src/**/*.spec.ts`
  API unit and service tests
- `apps/web/e2e/`
  Playwright browser journeys
- `apps/web/app/**/*.test.ts(x)`
  web unit and component tests
- `apps/mobile/.maestro/`
  mobile end-to-end flows
- `apps/mobile/src/**/__tests__` and `*.test.*`
  mobile unit and integration tests

## Coverage Thresholds

| Tier | Branches | Functions | Lines | Statements |
|------|----------|-----------|-------|------------|
| Unit | 85% | 85% | 85% | 85% |
| Integration | 80% | 80% | 80% | 80% |
| Component | 85% | 85% | 85% | 85% |

**Critical Modules** (require 90% coverage):
- `payments/*`
- `bookings/*`
- `auth/*`
- `listings/*`

## Quality Gates

### Pre-Commit
- [ ] Unit tests pass
- [ ] No shallow assertions
- [ ] No `console.log` statements
- [ ] Lint checks pass

### Pre-Merge
- [ ] All unit tests pass (85% coverage)
- [ ] All integration tests pass (80% coverage)
- [ ] API E2E tests pass
- [ ] No flaky tests

### Pre-Release
- [ ] UI E2E tests pass (all browsers)
- [ ] Performance tests pass
- [ ] Smoke tests pass
- [ ] Security scan clean

## Anti-Patterns to Avoid

- ❌ `expect(result).toBeDefined()` (shallow assertions)
- ❌ `expect(mock).toHaveBeenCalled()` (implementation coupling)
- ❌ `waitForTimeout()` in E2E (flaky - use explicit waits)
- ❌ `Math.random()` in tests (non-deterministic)
- ❌ Tests depending on other tests
- ❌ Shared mutable state between tests
- ❌ Tests that don't clean up data

## Test Data Management

### Principles
- Each test creates and cleans up its own data
- Tests produce same results on every run
- Use factories for efficient test data creation

### Test User Credentials
- **Renter**: renter@test.com / password123
- **Owner**: owner@test.com / password123
- **Admin**: admin@test.com / password123

## Performance Testing

### Load Testing Targets (K6)
- **Homepage**: 1000 concurrent users, <2s response time
- **Search**: 500 concurrent users, <3s response time
- **Booking API**: 200 concurrent users, <1s response time
- **Checkout**: 100 concurrent users, <3s response time

### Key Metrics
- Time to First Byte (TTFB): <200ms
- First Contentful Paint (FCP): <1.5s
- Largest Contentful Paint (LCP): <2.5s
- Time to Interactive (TTI): <3.5s

## Accessibility Testing

### WCAG 2.1 AA Compliance
- [ ] Color contrast ratio ≥ 4.5:1
- [ ] Keyboard navigation functional
- [ ] Screen reader compatibility (ARIA labels)
- [ ] Focus indicators visible
- [ ] Form labels associated with inputs
- [ ] Alt text for images

### Testing Tools
- Lighthouse Accessibility Audit
- axe DevTools
- Screen readers (NVDA, VoiceOver)

## Security Testing

### Automated Security Scans
- OWASP ZAP baseline scan
- Dependency vulnerability check (npm audit)
- SAST with CodeQL
- Container scanning (Trivy)

## Principles

- critical-path suites should be deterministic and easy to rerun
- manual QA checklists belong in `docs/qa/`
- test execution reports belong in `docs/archive/test-reports/`, not in the live doc path
- failures in generated reports must be translated into actionable issues or fixes, not preserved as permanent repo clutter
- route-aligned E2E suites are authoritative for release gates; exploratory specs are useful but not gate-qualifying until validated against the router manifest

## Related Docs

- [`../qa/release-gates.md`](../qa/release-gates.md)
- [`../qa/README.md`](../qa/README.md)
- [`deployment.md`](deployment.md)
