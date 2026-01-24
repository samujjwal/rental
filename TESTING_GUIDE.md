# Testing Guide - Universal Rental Portal

## Overview

This document provides comprehensive testing strategies and examples for the Universal Rental Portal backend API.

## Testing Stack

- **Test Framework**: Jest
- **E2E Testing**: Supertest
- **Test Utilities**: @nestjs/testing
- **Coverage Tool**: Jest Coverage
- **Database**: PostgreSQL (test database)
- **Mocking**: Jest mocks

## Running Tests

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# Coverage report
npm run test:cov

# E2E tests
npm run test:e2e

# Debug tests
npm run test:debug
```

## Test Structure

### Unit Tests

Unit tests focus on individual services, controllers, and utilities in isolation.

**Location**: `src/**/*.spec.ts`

**Example**: Testing a service with mocked dependencies

```typescript
// src/modules/bookings/services/booking.service.spec.ts
describe('BookingService', () => {
  let service: BookingService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<BookingService>(BookingService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should create a booking', async () => {
    // Arrange
    const createDto = {
      /* ... */
    };
    mockPrismaService.booking.create.mockResolvedValue(mockBooking);

    // Act
    const result = await service.create(createDto);

    // Assert
    expect(result).toBeDefined();
    expect(mockPrismaService.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: createDto }),
    );
  });
});
```

### Integration Tests

Integration tests verify interactions between multiple components.

**Location**: `test/*.e2e-spec.ts`

**Example**: Testing API endpoints end-to-end

```typescript
// test/bookings.e2e-spec.ts
describe('Bookings API (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Login to get access token
    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password' });

    accessToken = loginResponse.body.tokens.accessToken;
  });

  it('/api/bookings (POST) should create a booking', () => {
    return request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        listingId: 'listing-123',
        startDate: '2026-02-01',
        endDate: '2026-02-05',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty('id');
        expect(res.body.status).toBe('PENDING_PAYMENT');
      });
  });
});
```

## Test Coverage Requirements

### Minimum Coverage Targets

- **Statements**: 80%
- **Branches**: 75%
- **Functions**: 80%
- **Lines**: 80%

### High-Priority Coverage Areas

1. **State Machines**: 95% coverage
   - Booking state transitions
   - Payment workflows
   - Dispute resolution flow

2. **Payment Processing**: 90% coverage
   - Stripe integration
   - Refund calculations
   - Payout processing

3. **Authentication**: 90% coverage
   - JWT verification
   - Password hashing
   - Permission checks

4. **Critical Business Logic**: 85% coverage
   - Pricing calculations
   - Availability checks
   - Cancellation policies

## Testing Patterns

### 1. Mocking External Services

```typescript
// Mock Stripe service
const mockStripeService = {
  createPaymentIntent: jest.fn().mockResolvedValue({
    id: 'pi_123',
    client_secret: 'secret_123',
  }),
  createTransfer: jest.fn().mockResolvedValue({ id: 'tr_123' }),
  refundPayment: jest.fn().mockResolvedValue({ id: 'refund_123' }),
};
```

### 2. Database Testing with Transactions

```typescript
describe('Database Operations', () => {
  beforeEach(async () => {
    // Start transaction
    await prisma.$executeRaw`BEGIN`;
  });

  afterEach(async () => {
    // Rollback transaction
    await prisma.$executeRaw`ROLLBACK`;
  });

  it('should create user', async () => {
    const user = await prisma.user.create({
      data: {
        /* ... */
      },
    });
    expect(user).toBeDefined();
  });
});
```

### 3. Testing Event Emitters

```typescript
it('should emit booking created event', async () => {
  const emitSpy = jest.spyOn(eventsService, 'emitBookingCreated');

  await bookingService.create(createDto);

  expect(emitSpy).toHaveBeenCalledWith(
    expect.objectContaining({
      bookingId: expect.any(String),
    }),
  );
});
```

### 4. Testing Queue Jobs

```typescript
describe('Booking Processor', () => {
  let processor: BookingProcessor;
  let mockJob: Job;

  beforeEach(() => {
    mockJob = {
      data: { bookingId: 'booking-123' },
      progress: jest.fn(),
    } as any;
  });

  it('should handle expiration job', async () => {
    await processor.handleBookingExpiration(mockJob);

    expect(mockJob.progress).toHaveBeenCalledWith(100);
  });
});
```

### 5. Testing Scheduled Tasks

```typescript
describe('Scheduled Tasks', () => {
  it('should run expiration check', async () => {
    const checkExpiredSpy = jest.spyOn(schedulerService, 'checkExpiredBookings');

    await schedulerService.checkExpiredBookings();

    expect(checkExpiredSpy).toHaveBeenCalled();
  });
});
```

## Test Data Management

### Test Fixtures

Create reusable test data:

```typescript
// test/fixtures/users.fixture.ts
export const testUser = {
  email: 'test@example.com',
  password: 'SecurePass123!',
  firstName: 'Test',
  lastName: 'User',
};

export const testOwner = {
  email: 'owner@example.com',
  password: 'SecurePass123!',
  firstName: 'Owner',
  lastName: 'User',
  role: 'OWNER',
};
```

### Database Seeding for Tests

```typescript
// test/setup.ts
beforeAll(async () => {
  await prisma.user.createMany({
    data: [testUser, testOwner, testAdmin],
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({
    where: { email: { endsWith: '@example.com' } },
  });
});
```

## Testing Security

### Authentication Tests

```typescript
describe('Authentication', () => {
  it('should reject invalid JWT', async () => {
    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', 'Bearer invalid_token')
      .expect(401);
  });

  it('should reject expired JWT', async () => {
    const expiredToken = generateExpiredToken();

    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);
  });
});
```

### Authorization Tests

```typescript
describe('Authorization', () => {
  it('should deny non-admin access to admin routes', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);
  });

  it('should allow admin access to admin routes', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });
});
```

### Input Validation Tests

```typescript
describe('Input Validation', () => {
  it('should reject SQL injection attempts', async () => {
    await request(app.getHttpServer())
      .post('/api/listings')
      .send({ title: "'; DROP TABLE listings; --" })
      .expect(400);
  });

  it('should reject XSS attempts', async () => {
    await request(app.getHttpServer())
      .post('/api/listings')
      .send({ title: '<script>alert("XSS")</script>' })
      .expect(400);
  });
});
```

## Performance Testing

### Load Testing with Artillery (Optional)

```yaml
# artillery.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
      name: 'Warm up'
    - duration: 300
      arrivalRate: 50
      name: 'Load test'

scenarios:
  - name: 'Search listings'
    flow:
      - get:
          url: '/api/search/listings?q=car'
```

### Response Time Testing

```typescript
describe('Performance', () => {
  it('should respond to search within 500ms', async () => {
    const start = Date.now();

    await request(app.getHttpServer()).get('/api/search/listings?q=test').expect(200);

    const duration = Date.now() - start;
    expect(duration).toBeLessThan(500);
  });
});
```

## Continuous Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run migrations
        run: npx prisma migrate deploy

      - name: Run unit tests
        run: npm run test:cov

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## Best Practices

### 1. Test Naming

```typescript
// Good
it('should create a booking when all required fields are provided', async () => {});

// Bad
it('test booking', async () => {});
```

### 2. Arrange-Act-Assert Pattern

```typescript
it('should calculate total price correctly', async () => {
  // Arrange
  const listing = { pricePerDay: 100 };
  const booking = { startDate: '2026-01-01', endDate: '2026-01-05' };

  // Act
  const total = calculateTotal(listing, booking);

  // Assert
  expect(total).toBe(400); // 4 days * 100
});
```

### 3. Test Independence

```typescript
// Each test should be independent
describe('BookingService', () => {
  beforeEach(() => {
    // Reset mocks and state
    jest.clearAllMocks();
  });

  it('test 1', () => {
    // This test should not depend on test 2
  });

  it('test 2', () => {
    // This test should not depend on test 1
  });
});
```

### 4. Avoid Testing Implementation Details

```typescript
// Good - Test behavior
it('should return active listings', async () => {
  const listings = await service.getActiveListings();
  expect(listings.every((l) => l.status === 'ACTIVE')).toBe(true);
});

// Bad - Test implementation
it('should call prisma.listing.findMany', async () => {
  await service.getActiveListings();
  expect(prisma.listing.findMany).toHaveBeenCalled(); // Too coupled to implementation
});
```

### 5. Test Edge Cases

```typescript
describe('Edge Cases', () => {
  it('should handle empty search results', async () => {
    const results = await service.search('nonexistent');
    expect(results.items).toHaveLength(0);
  });

  it('should handle very long search queries', async () => {
    const longQuery = 'a'.repeat(1000);
    await expect(service.search(longQuery)).rejects.toThrow();
  });

  it('should handle concurrent bookings', async () => {
    const promises = Array(10)
      .fill(null)
      .map(() => service.createBooking(createDto));
    const results = await Promise.allSettled(promises);
    // Only one should succeed
    const succeeded = results.filter((r) => r.status === 'fulfilled');
    expect(succeeded).toHaveLength(1);
  });
});
```

## Debugging Tests

### Enable Verbose Output

```bash
npm run test -- --verbose
```

### Run Specific Test File

```bash
npm run test -- bookings.service.spec.ts
```

### Run Tests Matching Pattern

```bash
npm run test -- --testNamePattern="should create"
```

### Debug in VS Code

```json
// .vscode/launch.json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "--no-cache"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

## Conclusion

Comprehensive testing ensures:

- ✅ Code quality and reliability
- ✅ Confidence in refactoring
- ✅ Documentation of expected behavior
- ✅ Early detection of regressions
- ✅ Production readiness

Follow these patterns and maintain high test coverage for a robust, maintainable application.
