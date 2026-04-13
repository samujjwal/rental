# GharBatai Test Strategy

## Overview

This document defines the comprehensive testing strategy for the GharBatai Nepal Rental Portal. It establishes testing tiers, ownership, quality gates, and execution guidelines to ensure production-grade test coverage.

**Version**: 1.0  
**Last Updated**: April 11, 2026  
**Owner**: Engineering Team

---

## Test Tier Model

### Tier 1: Unit Tests (Fast Feedback)

**Purpose**: Validate individual units of code in isolation  
**Execution Time**: < 30 seconds  
**Coverage Target**: 85%  
**Ownership**: Feature developers  

| Aspect | Configuration |
|--------|---------------|
| Framework | Jest (API), Vitest (Web) |
| Files | `*.spec.ts`, `*.test.tsx` |
| Location | `apps/api/src/**/*.spec.ts`, `apps/web/**/*.test.tsx` |
| CI Gate | Must pass on every PR |

**Quality Requirements**:
- No shallow assertions (`.toBeDefined()`, `.toBeTruthy()`)
- Mock external dependencies only
- Test behavior, not implementation
- Include edge cases and error paths

**Commands**:
```bash
# API Unit Tests
npm run test:unit

# Web Unit Tests
npm run test:unit
```

---

### Tier 2: Integration Tests (Non-Browser)

**Purpose**: Validate module interactions with real dependencies  
**Execution Time**: 1-3 minutes  
**Coverage Target**: 80%  
**Ownership**: Feature developers + QA  

| Aspect | Configuration |
|--------|---------------|
| Framework | Jest |
| Files | `*.integration-spec.ts` |
| Location | `apps/api/test/integration/` |
| Dependencies | Real database, Redis, Stripe (test mode) |
| CI Gate | Must pass before merge |

**Quality Requirements**:
- Use real database connections (no mocks)
- Test actual API calls to external services (test mode)
- Validate state changes in database
- Include failure scenarios

**Commands**:
```bash
npm run test:integration
```

---

### Tier 3: Integration Tests (Browser/Component)

**Purpose**: Validate UI components and client-side logic  
**Execution Time**: 1-2 minutes  
**Coverage Target**: 85%  
**Ownership**: Frontend developers  

| Aspect | Configuration |
|--------|---------------|
| Framework | Vitest + React Testing Library |
| Environment | jsdom |
| Files | `*.test.tsx` |
| Location | `apps/web/**/*.test.tsx` |

**Quality Requirements**:
- Test user interactions
- Mock API calls and routing
- Include accessibility checks
- Test responsive behavior

**Commands**:
```bash
cd apps/web && npm run test
```

---

### Tier 4: Contract Tests

**Purpose**: Validate API schema and prevent breaking changes  
**Execution Time**: 30 seconds  
**Ownership**: API team  

| Aspect | Configuration |
|--------|---------------|
| Framework | Jest |
| Files | `contract*.spec.ts`, `api-schema*.spec.ts` |
| Location | `apps/api/src/contract-testing/`, `apps/api/test/` |

**Quality Requirements**:
- Validate against OpenAPI spec
- Detect breaking changes
- Version compatibility checks

**Commands**:
```bash
npm run test:contract
```

---

### Tier 5: API E2E Tests

**Purpose**: Validate full API workflows  
**Execution Time**: 3-5 minutes  
**Ownership**: QA + Backend developers  

| Aspect | Configuration |
|--------|---------------|
| Framework | Jest + Supertest |
| Files | `*.e2e-spec.ts` |
| Location | `apps/api/test/` |
| Database | Fresh test database |

**Quality Requirements**:
- Full HTTP request/response validation
- Database state verification
- Authentication flows
- Error handling

**Commands**:
```bash
npm run test:e2e
```

---

### Tier 6: UI E2E Tests

**Purpose**: Validate complete user journeys  
**Execution Time**: 5-10 minutes  
**Ownership**: QA team  

| Aspect | Configuration |
|--------|---------------|
| Framework | Playwright |
| Files | `*.spec.ts` |
| Location | `apps/web/e2e/` |
| Browsers | Chromium, Firefox, WebKit |

**Quality Requirements**:
- Multi-browser testing
- Mobile viewport testing
- No `waitForTimeout()` (use explicit waits)
- Visual regression testing

**Commands**:
```bash
npm run test:e2e
```

---

### Tier 7: Performance Tests

**Purpose**: Validate system performance under load  
**Execution Time**: 10-30 minutes  
**Ownership**: Platform team  

| Aspect | Configuration |
|--------|---------------|
| Framework | k6 |
| Files | `*.js` |
| Location | `apps/api/test/load/` |

**Test Types**:
- Load tests (expected traffic)
- Stress tests (beyond capacity)
- Soak tests (extended duration)
- Spike tests (sudden traffic increase)

**Commands**:
```bash
npm run test:performance
```

---

### Tier 8: Reliability/Chaos Tests

**Purpose**: Validate system resilience  
**Execution Time**: 15-30 minutes  
**Ownership**: Platform team  

| Aspect | Configuration |
|--------|---------------|
| Framework | Jest + custom fault injection |
| Files | `chaos*.spec.ts`, `reliability*.spec.ts` |
| Location | `apps/api/test/chaos/`, `apps/api/test/reliability/` |

**Scenarios**:
- Database connection failures
- Cache unavailability
- External service timeouts
- Resource exhaustion

**Commands**:
```bash
npm run test:chaos
npm run test:reliability
```

---

### Tier 9: Smoke/Release Gate

**Purpose**: Quick validation of critical paths  
**Execution Time**: < 1 minute  
**Ownership**: Release engineering  

| Aspect | Configuration |
|--------|---------------|
| Framework | Jest |
| Files | `smoke.e2e-spec.ts` |
| Location | `apps/api/test/` |

**Coverage**:
- Authentication
- Core API endpoints
- Database connectivity
- External service health

**Commands**:
```bash
npm run test:smoke
```

---

## Coverage Thresholds

| Tier | Branches | Functions | Lines | Statements |
|------|----------|-----------|-------|------------|
| Unit | 85% | 85% | 85% | 85% |
| Integration | 80% | 80% | 80% | 80% |
| Component | 85% | 85% | 85% | 85% |
| API E2E | N/A | N/A | N/A | N/A |
| UI E2E | N/A | N/A | N/A | N/A |

**Critical Modules** (require 90% coverage):
- `payments/*`
- `bookings/*`
- `auth/*`
- `listings/*`

---

## Test Execution Pipeline

### Local Development

```bash
# Quick feedback (unit tests)
npm run test:unit

# Before commit (unit + integration)
npm run test:unit
npm run test:integration

# Full validation (all tiers)
npm run test:comprehensive
```

### CI/CD Pipeline

| Stage | Tests | Gate |
|-------|-------|------|
| Build | Lint, Type check | Must pass |
| Unit | All unit tests | Must pass, 85% coverage |
| Integration | Integration tests | Must pass, 80% coverage |
| E2E | API + UI E2E | Must pass |
| Performance | Load tests | Must pass thresholds |
| Smoke | Release gate | Must pass |

---

## Test Data Management

### Principles

1. **Isolation**: Each test creates and cleans up its own data
2. **Repeatability**: Tests produce same results on every run
3. **Performance**: Use factories for efficient test data creation

### Test Data Factories

```typescript
// Example test data factory
export const createTestUser = async (overrides = {}) => {
  return prisma.user.create({
    data: {
      email: `test-${randomUUID()}@test.com`,
      password: 'hashed',
      firstName: 'Test',
      lastName: 'User',
      role: 'USER',
      ...overrides,
    },
  });
};
```

---

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
- [ ] Changelog updated

---

## Anti-Patterns to Avoid

### Test Code

- ❌ `expect(result).toBeDefined()` (shallow)
- ❌ `expect(mock).toHaveBeenCalled()` (implementation coupling)
- ❌ `waitForTimeout()` in E2E (flaky)
- ❌ `Math.random()` in tests (non-deterministic)
- ❌ Hard-coded IDs that depend on execution order

### Test Structure

- ❌ Tests depending on other tests
- ❌ Shared mutable state between tests
- ❌ Tests that don't clean up data
- ❌ Copy-paste test code (use helpers)

---

## Monitoring and Metrics

### Key Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Test Success Rate | > 99% | < 95% |
| Flaky Test Rate | < 1% | > 5% |
| Coverage (Unit) | > 85% | < 80% |
| Coverage (Integration) | > 80% | < 75% |
| E2E Execution Time | < 10 min | > 15 min |

### Dashboards

- Test execution trends
- Coverage trends by module
- Flaky test tracking
- Performance regression tracking

---

## Emergency Procedures

### Test Suite Failure

1. Identify scope (unit/integration/e2e)
2. Determine if test or code issue
3. Fix or skip with ticket reference
4. Never merge with failing CI

### Flaky Test Detection

1. Mark with `@flaky` annotation
2. Create ticket for investigation
3. Run 100 times locally to reproduce
4. Fix root cause or quarantine test

### Coverage Drop

1. Identify affected modules
2. Add tests for uncovered code
3. Review if uncovered code is necessary
4. Adjust thresholds if justified

---

## Best Practices

### Writing Tests

1. **AAA Pattern**: Arrange, Act, Assert
2. **Single Responsibility**: One concept per test
3. **Descriptive Names**: `should return error when user not found`
4. **Given-When-Then**: Document preconditions, actions, expectations

### Test Maintenance

1. Refactor tests with production code
2. Remove obsolete tests
3. Update tests when requirements change
4. Review test suite quarterly

### Test Review Checklist

- [ ] Tests behavior, not implementation
- [ ] Includes happy path and error cases
- [ ] No external dependencies (mocked)
- [ ] Clean setup and teardown
- [ ] Descriptive assertions
- [ ] No duplicate test logic

---

## Appendix

### Test File Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Unit | `*.spec.ts` | `bookings.service.spec.ts` |
| Integration | `*.integration-spec.ts` | `stripe.integration-spec.ts` |
| E2E | `*.e2e-spec.ts` | `bookings.e2e-spec.ts` |
| Property | `*.property.spec.ts` | `tax-calculation.property.spec.ts` |
| Contract | `contract*.spec.ts` | `contract-validation.spec.ts` |

### Test Configuration Files

| File | Purpose |
|------|---------|
| `jest.config.js` | Unit test configuration |
| `jest.integration.config.js` | Integration test configuration |
| `jest-e2e.json` | E2E test configuration |
| `playwright.config.ts` | UI E2E configuration |
| `vitest.config.ts` | Web unit test configuration |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-04-11 | Engineering Team | Initial strategy document |
