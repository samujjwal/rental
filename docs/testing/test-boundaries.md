# Test Boundaries Documentation

This document clarifies the boundaries between different test tiers in the rental portal system.

## Test Tier Definitions

### Unit Tests
**Location**: `apps/api/src/**/*.spec.ts`, `apps/web/src/**/*.test.tsx`, `apps/mobile/src/**/*.test.ts`

**Purpose**: Test individual functions, classes, components, or hooks in isolation.

**Characteristics**:
- Fast execution (milliseconds)
- No external dependencies (database, APIs, network)
- Use mocks for all dependencies
- Focus on single unit of functionality
- Test edge cases and error handling

**Examples**:
- Service business logic validation
- Component rendering and state
- Hook behavior
- Utility functions
- Controller validation logic

### Integration Tests
**Location**: `apps/api/test/integration/**/*.spec.ts`

**Purpose**: Test interactions between multiple units/modules with real dependencies.

**Characteristics**:
- Medium execution time (seconds)
- Use real database (PostgreSQL), Redis, and other services
- Test cross-module data flow
- Validate integration points
- Test transaction boundaries
- May use real external services (Stripe, email) or test-mode versions

**Examples**:
- Email/SMS notification integration
- API integration across modules
- Database transaction consistency
- Payment flow integration with Stripe
- WebSocket message flow

### E2E (End-to-End) Tests
**Location**: 
- API E2E: `apps/api/test/**/*.e2e-spec.ts`
- Web E2E: `apps/web/e2e/**/*.spec.ts`
- Mobile E2E: `apps/mobile/.maestro/*.yaml`
- Release Gate: `tests/release-gate/release-gate.spec.ts`

**Purpose**: Test complete user journeys from UI/API to database and back.

**Characteristics**:
- Slow execution (minutes)
- Full system stack
- Real browser (Playwright) or device (Maestro)
- Test complete user workflows
- Validate system behavior as a whole
- Test UI interactions and state transitions

**Examples**:
- Complete booking lifecycle
- User authentication flow
- Payment processing flow
- Multi-step wizard workflows
- Real-time updates across clients

### Contract Tests
**Location**: `apps/api/src/contract/**/*.spec.ts`, `apps/api/test/contract-*.spec.ts`

**Purpose**: Validate API contracts and schema compliance.

**Characteristics**:
- Medium execution time
- Validate OpenAPI specification
- Test response schemas
- Ensure API contract stability
- Detect breaking changes

**Examples**:
- OpenAPI schema validation
- Response structure validation
- Endpoint contract compliance
- Type safety validation

### Performance Tests
**Location**: `tests/load/performance-load.spec.ts`, `tests/load/*.spec.ts`

**Purpose**: Measure system performance under load.

**Characteristics**:
- Long execution time
- Simulate high traffic
- Measure response times, throughput
- Identify performance bottlenecks
- Validate SLA compliance

**Examples**:
- Load testing with K6
- Stress testing
- Spike testing
- Performance regression detection

### Reliability/Resilience Tests
**Location**: `apps/api/test/reliability/**/*.spec.ts`, `apps/api/test/chaos/**/*.spec.ts`

**Purpose**: Test system behavior under failure conditions.

**Characteristics**:
- Simulate failures (network, database, services)
- Test retry logic and circuit breakers
- Validate graceful degradation
- Test recovery mechanisms

**Examples**:
- Database connection failure handling
- Service timeout handling
- Retry logic validation
- Circuit breaker activation
- Chaos engineering scenarios

### Smoke/Release Gate Tests
**Location**: `tests/release-gate/release-gate.spec.ts`

**Purpose**: Quick health checks before deployment.

**Characteristics**:
- Fast execution (< 5 minutes)
- Cover critical paths only
- Validate system health
- Block deployment if failed

**Examples**:
- API health checks
- Authentication flow
- Core booking functionality
- Database connectivity
- External service health

## Key Differences

| Aspect | Unit | Integration | E2E |
|--------|------|-------------|-----|
| Scope | Single function/module | Multiple modules | Full system |
| Dependencies | Mocked | Real (DB, Redis) | Full stack |
| Speed | Very fast | Medium | Slow |
| Flakiness | Low | Low-Medium | Medium-High |
| Cost | Low | Medium | High |
| Maintenance | Low | Medium | High |

## When to Use Which Test

### Use Unit Tests When:
- Testing business logic
- Validating edge cases
- Testing component behavior
- Quick feedback needed

### Use Integration Tests When:
- Testing module interactions
- Validating database transactions
- Testing external service integrations
- Validating data flow across modules

### Use E2E Tests When:
- Testing complete user journeys
- Validating critical paths
- Testing UI workflows
- Validating system as a whole

### Use Contract Tests When:
- Validating API contracts
- Ensuring schema compliance
- Detecting breaking changes
- Validating API documentation

### Use Performance Tests When:
- Measuring system performance
- Validating SLA compliance
- Identifying bottlenecks
- Load testing

### Use Reliability Tests When:
- Testing failure scenarios
- Validating resilience patterns
- Testing recovery mechanisms
- Chaos engineering

## Test Strategy

1. **Unit Tests**: Write first, aim for high coverage
2. **Integration Tests**: Focus on critical module interactions
3. **Contract Tests**: Ensure API stability
4. **E2E Tests**: Cover critical user journeys only
5. **Performance Tests**: Run periodically (nightly/weekly)
6. **Reliability Tests**: Run periodically to validate resilience

## CI/CD Integration

- **Unit Tests**: Run on every PR and push
- **Integration Tests**: Run on every PR and push
- **Contract Tests**: Run on every PR and push
- **E2E Tests**: Run on every PR (subset) and nightly (full suite)
- **Performance Tests**: Run nightly
- **Reliability Tests**: Run weekly
- **Smoke/Release Gate**: Run on every push to main/develop before deployment
