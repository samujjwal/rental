# Comprehensive Testing Implementation Plan

## Complete Test Suite with Examples

**Platform**: Universal Rental Portal  
**Coverage Target**: 95%+  
**Testing Framework**: Jest, Supertest, Playwright, k6

---

## 📋 Table of Contents

1. [Unit Tests](#unit-tests)
2. [Integration Tests](#integration-tests)
3. [E2E Tests](#e2e-tests)
4. [Load Tests](#load-tests)
5. [Security Tests](#security-tests)
6. [Test Automation](#test-automation)

---

## 🧪 Unit Tests

### Current Status:

- ✅ Existing tests: ~1,500 lines
- 🟡 Coverage: ~60%
- 🎯 Target: 95%

### Missing Unit Tests Implementation:

#### 1. Booking State Machine Tests

```typescript
// apps/api/src/modules/bookings/services/booking-state-machine.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BookingStateMachineService } from './booking-state-machine.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BookingStatus } from '@rental-portal/database';

describe('BookingStateMachineService', () => {
  let service: BookingStateMachineService;
  let prisma: PrismaService;
  let eventEmitter: EventEmitter2;

  const mockBooking = {
    id: 'booking-123',
    status: BookingStatus.PENDING_OWNER_APPROVAL,
    ownerId: 'owner-123',
    renterId: 'renter-123',
    listingId: 'listing-123',
    totalPrice: 100,
    stateHistory: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingStateMachineService,
        {
          provide: PrismaService,
          useValue: {
            booking: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            bookingStateHistory: {
              create: jest.fn(),
            },
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BookingStateMachineService>(BookingStateMachineService);
    prisma = module.get<PrismaService>(PrismaService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  describe('transition', () => {
    it('should successfully transition from PENDING_OWNER_APPROVAL to PENDING_PAYMENT', async () => {
      jest.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockBooking as any);
      jest.spyOn(prisma.booking, 'update').mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.PENDING_PAYMENT,
      } as any);

      const result = await service.transition(
        'booking-123',
        BookingStatus.PENDING_PAYMENT,
        'owner-123',
        { reason: 'Approved by owner' },
      );

      expect(result.status).toBe(BookingStatus.PENDING_PAYMENT);
      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: 'booking-123' },
        data: expect.objectContaining({
          status: BookingStatus.PENDING_PAYMENT,
        }),
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith('booking.status.changed', expect.any(Object));
    });

    it('should reject invalid state transition', async () => {
      jest.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockBooking as any);

      await expect(
        service.transition('booking-123', BookingStatus.COMPLETED, 'owner-123', {
          reason: 'Invalid transition',
        }),
      ).rejects.toThrow('Invalid state transition');
    });

    it('should enforce role-based transition authorization', async () => {
      jest.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockBooking as any);

      await expect(
        service.transition('booking-123', BookingStatus.PENDING_PAYMENT, 'wrong-user-123', {
          reason: 'Unauthorized',
        }),
      ).rejects.toThrow('Not authorized');
    });

    it('should validate preconditions before transition', async () => {
      const unpaidBooking = {
        ...mockBooking,
        status: BookingStatus.PENDING_PAYMENT,
        paymentIntentId: null,
      };

      jest.spyOn(prisma.booking, 'findUnique').mockResolvedValue(unpaidBooking as any);

      await expect(
        service.transition('booking-123', BookingStatus.CONFIRMED, 'owner-123', {
          reason: 'Cannot confirm without payment',
        }),
      ).rejects.toThrow('Precondition not met');
    });

    it('should handle automatic transitions', async () => {
      const confirmedBooking = {
        ...mockBooking,
        status: BookingStatus.CONFIRMED,
        startDate: new Date(Date.now() - 1000), // Started 1 second ago
      };

      jest.spyOn(prisma.booking, 'findUnique').mockResolvedValue(confirmedBooking as any);
      jest.spyOn(prisma.booking, 'update').mockResolvedValue({
        ...confirmedBooking,
        status: BookingStatus.IN_PROGRESS,
      } as any);

      await service.checkAutoTransitions();

      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: 'booking-123' },
        data: expect.objectContaining({
          status: BookingStatus.IN_PROGRESS,
        }),
      });
    });

    it('should record state history with metadata', async () => {
      jest.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockBooking as any);
      jest.spyOn(prisma.booking, 'update').mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.PENDING_PAYMENT,
      } as any);
      jest.spyOn(prisma.bookingStateHistory, 'create').mockResolvedValue({} as any);

      await service.transition('booking-123', BookingStatus.PENDING_PAYMENT, 'owner-123', {
        reason: 'Approved',
        metadata: { notes: 'Fast approval' },
      });

      expect(prisma.bookingStateHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          bookingId: 'booking-123',
          fromStatus: BookingStatus.PENDING_OWNER_APPROVAL,
          toStatus: BookingStatus.PENDING_PAYMENT,
          actorId: 'owner-123',
          metadata: expect.objectContaining({
            notes: 'Fast approval',
          }),
        }),
      });
    });
  });

  describe('getAvailableTransitions', () => {
    it('should return available transitions for current state', async () => {
      jest.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockBooking as any);

      const transitions = await service.getAvailableTransitions('booking-123', 'owner-123');

      expect(transitions).toContain(BookingStatus.PENDING_PAYMENT);
      expect(transitions).toContain(BookingStatus.CANCELLED);
      expect(transitions).not.toContain(BookingStatus.COMPLETED);
    });
  });

  describe('canTransition', () => {
    it('should return true for valid transition', async () => {
      jest.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockBooking as any);

      const canTransition = await service.canTransition(
        'booking-123',
        BookingStatus.PENDING_PAYMENT,
        'owner-123',
      );

      expect(canTransition).toBe(true);
    });

    it('should return false for invalid transition', async () => {
      jest.spyOn(prisma.booking, 'findUnique').mockResolvedValue(mockBooking as any);

      const canTransition = await service.canTransition(
        'booking-123',
        BookingStatus.COMPLETED,
        'owner-123',
      );

      expect(canTransition).toBe(false);
    });
  });
});
```

#### 2. Payment Ledger Tests

```typescript
// apps/api/src/modules/payments/services/ledger.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { LedgerService } from './ledger.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

describe('LedgerService', () => {
  let service: LedgerService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LedgerService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn(),
            ledgerEntry: {
              create: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<LedgerService>(LedgerService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('recordBookingPayment', () => {
    it('should create double-entry for booking payment', async () => {
      const entries: any[] = [];

      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback) => {
        const mockPrisma = {
          ledgerEntry: {
            create: jest.fn((data) => {
              entries.push(data.data);
              return Promise.resolve(data.data);
            }),
          },
        };
        return callback(mockPrisma as any);
      });

      await service.recordBookingPayment({
        bookingId: 'booking-123',
        renterId: 'renter-123',
        ownerId: 'owner-123',
        totalAmount: 100,
        platformFee: 15,
        serviceFee: 5,
        ownerEarnings: 80,
        paymentIntentId: 'pi_123',
      });

      expect(entries).toHaveLength(4); // Debit renter, credit platform, credit owner, platform fee

      // Verify debit renter account
      const renterDebit = entries.find((e) => e.accountType === 'RENTER' && e.type === 'DEBIT');
      expect(renterDebit).toBeDefined();
      expect(renterDebit.amount).toBe(100);

      // Verify credit owner account
      const ownerCredit = entries.find((e) => e.accountType === 'OWNER' && e.type === 'CREDIT');
      expect(ownerCredit).toBeDefined();
      expect(ownerCredit.amount).toBe(80);

      // Verify platform fee
      const platformFeeEntry = entries.find(
        (e) => e.accountType === 'PLATFORM' && e.description.includes('fee'),
      );
      expect(platformFeeEntry).toBeDefined();
      expect(platformFeeEntry.amount).toBe(15);

      // Verify ledger balance (debits === credits)
      const totalDebits = entries
        .filter((e) => e.type === 'DEBIT')
        .reduce((sum, e) => sum + e.amount, 0);
      const totalCredits = entries
        .filter((e) => e.type === 'CREDIT')
        .reduce((sum, e) => sum + e.amount, 0);
      expect(totalDebits).toBe(totalCredits);
    });

    it('should handle refund with proper double-entry', async () => {
      const entries: any[] = [];

      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback) => {
        const mockPrisma = {
          ledgerEntry: {
            create: jest.fn((data) => {
              entries.push(data.data);
              return Promise.resolve(data.data);
            }),
          },
        };
        return callback(mockPrisma as any);
      });

      await service.recordRefund({
        bookingId: 'booking-123',
        renterId: 'renter-123',
        ownerId: 'owner-123',
        refundAmount: 50,
        platformFeeRefund: 7.5,
        ownerDeduction: 40,
      });

      // Verify refund entries maintain double-entry integrity
      const totalDebits = entries
        .filter((e) => e.type === 'DEBIT')
        .reduce((sum, e) => sum + e.amount, 0);
      const totalCredits = entries
        .filter((e) => e.type === 'CREDIT')
        .reduce((sum, e) => sum + e.amount, 0);
      expect(totalDebits).toBe(totalCredits);
    });

    it('should reject transaction if ledger balance check fails', async () => {
      jest.spyOn(prisma, '$transaction').mockRejectedValue(new Error('Transaction failed'));

      await expect(
        service.recordBookingPayment({
          bookingId: 'booking-123',
          renterId: 'renter-123',
          ownerId: 'owner-123',
          totalAmount: 100,
          platformFee: 15,
          serviceFee: 5,
          ownerEarnings: 81, // Wrong amount - doesn't balance
          paymentIntentId: 'pi_123',
        }),
      ).rejects.toThrow();
    });
  });

  describe('getAccountBalance', () => {
    it('should calculate correct account balance', async () => {
      const mockEntries = [
        { type: 'CREDIT', amount: 100 },
        { type: 'CREDIT', amount: 50 },
        { type: 'DEBIT', amount: 30 },
      ];

      jest.spyOn(prisma.ledgerEntry, 'findMany').mockResolvedValue(mockEntries as any);

      const balance = await service.getAccountBalance('user-123', 'OWNER');

      expect(balance).toBe(120); // 100 + 50 - 30
    });

    it('should return 0 for account with no entries', async () => {
      jest.spyOn(prisma.ledgerEntry, 'findMany').mockResolvedValue([]);

      const balance = await service.getAccountBalance('user-123', 'OWNER');

      expect(balance).toBe(0);
    });
  });

  describe('auditLedger', () => {
    it('should detect ledger imbalance', async () => {
      const mockEntries = [
        { type: 'CREDIT', amount: 100 },
        { type: 'DEBIT', amount: 95 }, // Imbalanced
      ];

      jest.spyOn(prisma.ledgerEntry, 'findMany').mockResolvedValue(mockEntries as any);

      const auditResult = await service.auditLedger();

      expect(auditResult.balanced).toBe(false);
      expect(auditResult.discrepancy).toBe(5);
    });

    it('should pass audit for balanced ledger', async () => {
      const mockEntries = [
        { type: 'CREDIT', amount: 100 },
        { type: 'DEBIT', amount: 100 },
      ];

      jest.spyOn(prisma.ledgerEntry, 'findMany').mockResolvedValue(mockEntries as any);

      const auditResult = await service.auditLedger();

      expect(auditResult.balanced).toBe(true);
      expect(auditResult.discrepancy).toBe(0);
    });
  });
});
```

#### 3. Search Service Tests

```typescript
// apps/api/src/modules/search/services/search.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { ElasticsearchService } from '@nestjs/elasticsearch';

describe('SearchService', () => {
  let service: SearchService;
  let elasticsearch: ElasticsearchService;

  const mockSearchResults = {
    hits: {
      total: { value: 2 },
      hits: [
        {
          _id: 'listing-1',
          _score: 0.95,
          _source: {
            id: 'listing-1',
            title: 'Camera Rental',
            category: 'electronics',
            basePrice: 50,
            location: { lat: 40.7128, lon: -74.006 },
          },
        },
        {
          _id: 'listing-2',
          _score: 0.85,
          _source: {
            id: 'listing-2',
            title: 'Professional Camera',
            category: 'electronics',
            basePrice: 75,
            location: { lat: 40.7129, lon: -74.0061 },
          },
        },
      ],
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        {
          provide: ElasticsearchService,
          useValue: {
            search: jest.fn(),
            index: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
    elasticsearch = module.get<ElasticsearchService>(ElasticsearchService);
  });

  describe('search', () => {
    it('should perform full-text search with relevance scoring', async () => {
      jest.spyOn(elasticsearch, 'search').mockResolvedValue(mockSearchResults as any);

      const results = await service.search({
        query: 'camera',
        page: 1,
        limit: 10,
      });

      expect(results.items).toHaveLength(2);
      expect(results.total).toBe(2);
      expect(results.items[0].title).toContain('Camera');
      expect(elasticsearch.search).toHaveBeenCalledWith(
        expect.objectContaining({
          index: 'listings',
          body: expect.objectContaining({
            query: expect.any(Object),
          }),
        }),
      );
    });

    it('should apply category filter', async () => {
      jest.spyOn(elasticsearch, 'search').mockResolvedValue(mockSearchResults as any);

      await service.search({
        query: 'camera',
        category: 'electronics',
        page: 1,
        limit: 10,
      });

      expect(elasticsearch.search).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            query: expect.objectContaining({
              bool: expect.objectContaining({
                filter: expect.arrayContaining([
                  expect.objectContaining({
                    term: { category: 'electronics' },
                  }),
                ]),
              }),
            }),
          }),
        }),
      );
    });

    it('should apply price range filter', async () => {
      jest.spyOn(elasticsearch, 'search').mockResolvedValue(mockSearchResults as any);

      await service.search({
        query: 'camera',
        minPrice: 50,
        maxPrice: 100,
        page: 1,
        limit: 10,
      });

      expect(elasticsearch.search).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            query: expect.objectContaining({
              bool: expect.objectContaining({
                filter: expect.arrayContaining([
                  expect.objectContaining({
                    range: {
                      basePrice: { gte: 50, lte: 100 },
                    },
                  }),
                ]),
              }),
            }),
          }),
        }),
      );
    });

    it('should perform geo-spatial search with distance', async () => {
      jest.spyOn(elasticsearch, 'search').mockResolvedValue(mockSearchResults as any);

      await service.search({
        query: 'camera',
        latitude: 40.7128,
        longitude: -74.006,
        radius: 10, // 10 km
        page: 1,
        limit: 10,
      });

      expect(elasticsearch.search).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            query: expect.objectContaining({
              bool: expect.objectContaining({
                filter: expect.arrayContaining([
                  expect.objectContaining({
                    geo_distance: expect.objectContaining({
                      distance: '10km',
                      location: {
                        lat: 40.7128,
                        lon: -74.006,
                      },
                    }),
                  }),
                ]),
              }),
            }),
          }),
        }),
      );
    });

    it('should sort by relevance by default', async () => {
      jest.spyOn(elasticsearch, 'search').mockResolvedValue(mockSearchResults as any);

      const results = await service.search({
        query: 'camera',
        page: 1,
        limit: 10,
      });

      expect(results.items[0]._score).toBeGreaterThan(results.items[1]._score);
    });

    it('should support custom sorting', async () => {
      jest.spyOn(elasticsearch, 'search').mockResolvedValue(mockSearchResults as any);

      await service.search({
        query: 'camera',
        sortBy: 'price',
        sortOrder: 'asc',
        page: 1,
        limit: 10,
      });

      expect(elasticsearch.search).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            sort: [{ basePrice: 'asc' }],
          }),
        }),
      );
    });

    it('should handle autocomplete suggestions', async () => {
      const mockSuggestions = {
        suggest: {
          'title-suggestion': [
            {
              options: [{ text: 'Camera Rental' }, { text: 'Camera Equipment' }],
            },
          ],
        },
      };

      jest.spyOn(elasticsearch, 'search').mockResolvedValue(mockSuggestions as any);

      const suggestions = await service.autocomplete('cam');

      expect(suggestions).toHaveLength(2);
      expect(suggestions[0]).toBe('Camera Rental');
    });
  });

  describe('indexListing', () => {
    it('should index new listing in Elasticsearch', async () => {
      jest.spyOn(elasticsearch, 'index').mockResolvedValue({ result: 'created' } as any);

      await service.indexListing({
        id: 'listing-1',
        title: 'Camera Rental',
        description: 'Professional camera for rent',
        category: 'electronics',
        basePrice: 50,
        location: { lat: 40.7128, lon: -74.006 },
      });

      expect(elasticsearch.index).toHaveBeenCalledWith({
        index: 'listings',
        id: 'listing-1',
        body: expect.objectContaining({
          title: 'Camera Rental',
        }),
      });
    });

    it('should update existing listing in index', async () => {
      jest.spyOn(elasticsearch, 'update').mockResolvedValue({ result: 'updated' } as any);

      await service.updateListing('listing-1', {
        title: 'Updated Camera Rental',
      });

      expect(elasticsearch.update).toHaveBeenCalledWith({
        index: 'listings',
        id: 'listing-1',
        body: {
          doc: expect.objectContaining({
            title: 'Updated Camera Rental',
          }),
        },
      });
    });

    it('should remove listing from index', async () => {
      jest.spyOn(elasticsearch, 'delete').mockResolvedValue({ result: 'deleted' } as any);

      await service.removeListing('listing-1');

      expect(elasticsearch.delete).toHaveBeenCalledWith({
        index: 'listings',
        id: 'listing-1',
      });
    });
  });
});
```

### Test Running Commands:

```bash
# Run all unit tests
pnpm run test

# Run with coverage
pnpm run test:cov

# Run specific test file
pnpm run test booking-state-machine.service.spec

# Run in watch mode
pnpm run test:watch
```

### Target Coverage:

```
Statements   : 95%
Branches     : 90%
Functions    : 95%
Lines        : 95%
```

---

## 🔗 Integration Tests

### Missing Integration Tests:

#### End-to-End Booking Flow Test

```typescript
// apps/api/test/booking-flow.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('Booking Flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let ownerId: string;
  let renterId: string;
  let listingId: string;
  let bookingId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await app.init();

    // Seed test data
    await seedTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  async function seedTestData() {
    // Create owner user
    const owner = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'owner@test.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'Owner',
      })
      .expect(201);

    ownerId = owner.body.user.id;

    // Create renter user
    const renter = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'renter@test.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'Renter',
      })
      .expect(201);

    renterId = renter.body.user.id;

    // Login as renter for subsequent requests
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'renter@test.com',
        password: 'Password123!',
      })
      .expect(200);

    authToken = login.body.access_token;

    // Create listing as owner
    const ownerToken = owner.body.access_token;
    const listing = await request(app.getHttpServer())
      .post('/listings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Test Camera',
        description: 'Professional camera for rent',
        category: 'electronics',
        basePrice: 50,
        pricingMode: 'PER_DAY',
        bookingMode: 'REQUEST',
        location: {
          address: '123 Test St',
          city: 'Test City',
          country: 'US',
          latitude: 40.7128,
          longitude: -74.006,
        },
      })
      .expect(201);

    listingId = listing.body.id;
  }

  async function cleanupTestData() {
    await prisma.booking.deleteMany({
      where: { id: bookingId },
    });
    await prisma.listing.deleteMany({
      where: { id: listingId },
    });
    await prisma.user.deleteMany({
      where: {
        OR: [{ id: ownerId }, { id: renterId }],
      },
    });
  }

  it('should complete full booking flow: create → approve → pay → confirm → complete', async () => {
    // Step 1: Create booking
    const createResponse = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        listingId,
        startDate: new Date(Date.now() + 86400000 * 7).toISOString(), // 7 days from now
        endDate: new Date(Date.now() + 86400000 * 9).toISOString(), // 9 days from now
        renterNotes: 'Need this for a photography project',
      })
      .expect(201);

    bookingId = createResponse.body.id;
    expect(createResponse.body.status).toBe('PENDING_OWNER_APPROVAL');

    // Step 2: Owner approves booking
    const ownerLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'owner@test.com',
        password: 'Password123!',
      })
      .expect(200);

    const ownerToken = ownerLogin.body.access_token;

    await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/approve`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const approvedBooking = await request(app.getHttpServer())
      .get(`/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(approvedBooking.body.status).toBe('PENDING_PAYMENT');

    // Step 3: Renter initiates payment
    const paymentIntent = await request(app.getHttpServer())
      .post(`/payments/create-intent`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ bookingId })
      .expect(201);

    expect(paymentIntent.body.clientSecret).toBeDefined();

    // Step 4: Simulate payment confirmation via webhook
    // (In real tests, you'd use Stripe test webhooks)
    await request(app.getHttpServer())
      .post('/payments/webhook')
      .send({
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: paymentIntent.body.paymentIntentId,
            metadata: { bookingId },
          },
        },
      })
      .expect(200);

    // Verify booking is confirmed
    const confirmedBooking = await request(app.getHttpServer())
      .get(`/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(confirmedBooking.body.status).toBe('CONFIRMED');

    // Step 5: Simulate booking start (would be automatic in production)
    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'IN_PROGRESS' },
    });

    // Step 6: Complete booking after return
    await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/complete`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        condition: 'GOOD',
        notes: 'Item returned in excellent condition',
      })
      .expect(200);

    const completedBooking = await request(app.getHttpServer())
      .get(`/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(completedBooking.body.status).toBe('COMPLETED');

    // Step 7: Verify ledger entries
    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: { bookingId },
    });

    expect(ledgerEntries.length).toBeGreaterThan(0);

    // Verify double-entry accounting balance
    const totalDebits = ledgerEntries
      .filter((e) => e.type === 'DEBIT')
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const totalCredits = ledgerEntries
      .filter((e) => e.type === 'CREDIT')
      .reduce((sum, e) => sum + Number(e.amount), 0);

    expect(totalDebits).toBe(totalCredits);
  });

  it('should handle booking cancellation with refund', async () => {
    // Create and approve booking
    const booking = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        listingId,
        startDate: new Date(Date.now() + 86400000 * 14).toISOString(),
        endDate: new Date(Date.now() + 86400000 * 16).toISOString(),
      })
      .expect(201);

    const cancelBookingId = booking.body.id;

    // Cancel booking
    await request(app.getHttpServer())
      .post(`/bookings/${cancelBookingId}/cancel`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        reason: 'Plans changed',
      })
      .expect(200);

    const cancelledBooking = await request(app.getHttpServer())
      .get(`/bookings/${cancelBookingId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(cancelledBooking.body.status).toBe('CANCELLED');
    expect(cancelledBooking.body.cancellationReason).toBe('Plans changed');

    // Cleanup
    await prisma.booking.delete({ where: { id: cancelBookingId } });
  });

  it('should prevent double booking on same dates', async () => {
    const startDate = new Date(Date.now() + 86400000 * 21).toISOString();
    const endDate = new Date(Date.now() + 86400000 * 23).toISOString();

    // Create first booking
    const firstBooking = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        listingId,
        startDate,
        endDate,
      })
      .expect(201);

    // Approve first booking
    const ownerLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'owner@test.com',
        password: 'Password123!',
      })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/bookings/${firstBooking.body.id}/approve`)
      .set('Authorization', `Bearer ${ownerLogin.body.access_token}`)
      .expect(200);

    // Attempt second booking on overlapping dates
    await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        listingId,
        startDate,
        endDate,
      })
      .expect(409); // Conflict

    // Cleanup
    await prisma.booking.delete({ where: { id: firstBooking.body.id } });
  });
});
```

---

## 🎭 E2E Tests (Playwright)

### Browser Automation Tests:

```typescript
// apps/web/tests/e2e/user-journey.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Complete User Journey', () => {
  test('user can register, create listing, and receive booking', async ({ page, context }) => {
    // Step 1: Register as owner
    await page.goto('http://localhost:5173/auth/signup');
    await page.fill('[name="firstName"]', 'John');
    await page.fill('[name="lastName"]', 'Owner');
    await page.fill('[name="email"]', `owner${Date.now()}@test.com`);
    await page.fill('[name="password"]', 'Password123!');
    await page.fill('[name="confirmPassword"]', 'Password123!');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/dashboard');

    // Step 2: Create listing
    await page.click('text=Create Listing');
    await expect(page).toHaveURL('/listings/new');

    await page.fill('[name="title"]', 'Professional DSLR Camera');
    await page.fill('[name="description"]', 'Canon EOS 5D Mark IV with lenses');
    await page.selectOption('[name="category"]', 'electronics');
    await page.fill('[name="basePrice"]', '75');
    await page.selectOption('[name="pricingMode"]', 'PER_DAY');
    await page.fill('[name="address"]', '123 Main St');
    await page.fill('[name="city"]', 'New York');
    await page.selectOption('[name="country"]', 'US');

    // Upload image
    const fileInput = await page.locator('input[type="file"]');
    await fileInput.setInputFiles('tests/fixtures/camera.jpg');

    await page.click('button:has-text("Publish Listing")');
    await expect(page).toHaveURL(/\/listings\/[a-z0-9-]+$/);

    const listingUrl = page.url();
    const listingId = listingUrl.split('/').pop();

    // Step 3: Open new browser context as renter
    const renterContext = await context.browser()!.newContext();
    const renterPage = await renterContext.newPage();

    // Register as renter
    await renterPage.goto('http://localhost:5173/auth/signup');
    await renterPage.fill('[name="firstName"]', 'Jane');
    await renterPage.fill('[name="lastName"]', 'Renter');
    await renterPage.fill('[name="email"]', `renter${Date.now()}@test.com`);
    await renterPage.fill('[name="password"]', 'Password123!');
    await renterPage.fill('[name="confirmPassword"]', 'Password123!');
    await renterPage.click('button[type="submit"]');

    // Search for listing
    await renterPage.goto('http://localhost:5173/search?q=camera');
    await expect(renterPage.locator('text=Professional DSLR Camera')).toBeVisible();

    // View listing detail
    await renterPage.click('text=Professional DSLR Camera');
    await expect(renterPage).toHaveURL(`/listings/${listingId}`);

    // Create booking
    await renterPage.click('button:has-text("Book Now")');

    // Select dates
    await renterPage.click('[data-testid="start-date"]');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await renterPage.click(`[data-date="${tomorrow.toISOString().split('T')[0]}"]`);

    await renterPage.click('[data-testid="end-date"]');
    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    await renterPage.click(`[data-date="${dayAfterTomorrow.toISOString().split('T')[0]}"]`);

    await renterPage.fill('[name="notes"]', 'Need for wedding photography');
    await renterPage.click('button:has-text("Request Booking")');

    await expect(renterPage.locator('text=Booking request sent')).toBeVisible();

    // Step 4: Owner approves booking
    await page.goto('http://localhost:5173/dashboard');
    await page.click('text=Pending Approvals');

    await expect(page.locator('text=Professional DSLR Camera')).toBeVisible();
    await page.click('button:has-text("Approve")');
    await page.click('button:has-text("Confirm Approval")');

    await expect(page.locator('text=Booking approved')).toBeVisible();

    // Step 5: Renter completes payment
    await renterPage.goto('http://localhost:5173/dashboard');
    await expect(renterPage.locator('text=Payment Required')).toBeVisible();

    await renterPage.click('button:has-text("Pay Now")');
    await expect(renterPage).toHaveURL(/\/checkout\/.+$/);

    // Fill Stripe test card
    const stripeFrame = renterPage.frameLocator('iframe[name^="__privateStripeFrame"]');
    await stripeFrame.locator('[name="cardnumber"]').fill('4242424242424242');
    await stripeFrame.locator('[name="exp-date"]').fill('12/25');
    await stripeFrame.locator('[name="cvc"]').fill('123');
    await stripeFrame.locator('[name="postal"]').fill('10001');

    await renterPage.click('button:has-text("Pay")');

    // Wait for payment success
    await expect(renterPage.locator('text=Payment successful')).toBeVisible({ timeout: 10000 });
    await expect(renterPage).toHaveURL(/\/bookings\/.+\?payment=success$/);

    // Verify booking status
    await expect(renterPage.locator('text=Confirmed')).toBeVisible();

    // Cleanup
    await renterContext.close();
  });

  test('user can search and filter listings', async ({ page }) => {
    await page.goto('http://localhost:5173/search');

    // Perform search
    await page.fill('[name="q"]', 'camera');
    await page.press('[name="q"]', 'Enter');

    // Apply category filter
    await page.click('text=Electronics');
    await expect(page.locator('[data-testid="listing-card"]')).toHaveCount(
      await page.locator('[data-testid="listing-card"]').count(),
    );

    // Apply price filter
    await page.fill('[name="minPrice"]', '50');
    await page.fill('[name="maxPrice"]', '100');
    await page.click('button:has-text("Apply Filters")');

    // Verify filtered results
    const listings = await page.locator('[data-testid="listing-card"]').all();
    for (const listing of listings) {
      const price = await listing.locator('[data-testid="price"]').textContent();
      const priceValue = parseFloat(price!.replace('$', ''));
      expect(priceValue).toBeGreaterThanOrEqual(50);
      expect(priceValue).toBeLessThanOrEqual(100);
    }
  });

  test('user can send and receive messages', async ({ page, context }) => {
    // Login as user 1
    await page.goto('http://localhost:5173/auth/login');
    await page.fill('[name="email"]', 'user1@test.com');
    await page.fill('[name="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    // Navigate to messages
    await page.goto('http://localhost:5173/messages');

    // Start new conversation
    await page.click('button:has-text("New Message")');
    await page.fill('[name="search"]', 'user2@test.com');
    await page.click('text=user2@test.com');

    // Send message
    const messageText = `Test message ${Date.now()}`;
    await page.fill('[name="message"]', messageText);
    await page.click('button:has-text("Send")');

    // Verify message sent
    await expect(page.locator(`text=${messageText}`)).toBeVisible();

    // Open new context as user 2
    const user2Context = await context.browser()!.newContext();
    const user2Page = await user2Context.newPage();

    await user2Page.goto('http://localhost:5173/auth/login');
    await user2Page.fill('[name="email"]', 'user2@test.com');
    await user2Page.fill('[name="password"]', 'Password123!');
    await user2Page.click('button[type="submit"]');

    // Check inbox
    await user2Page.goto('http://localhost:5173/messages');

    // Wait for message
    await expect(user2Page.locator(`text=${messageText}`)).toBeVisible({ timeout: 5000 });

    // Reply
    await user2Page.click(`text=${messageText}`);
    await user2Page.fill('[name="message"]', 'Reply message');
    await user2Page.click('button:has-text("Send")');

    // Verify reply appears in original user's view
    await page.reload();
    await expect(page.locator('text=Reply message')).toBeVisible({ timeout: 5000 });

    await user2Context.close();
  });
});
```

### Running E2E Tests:

```bash
# Install Playwright
pnpm add -D @playwright/test

# Install browsers
npx playwright install

# Run E2E tests
pnpm run test:e2e

# Run with UI
npx playwright test --ui

# Debug mode
npx playwright test --debug
```

---

## 📊 Load Tests (k6)

### Implementation Status:

- ✅ Test scripts exist in `apps/api/test/load/`
- ⚠️ Not executed yet

### Execute Load Tests:

```bash
# Install k6
brew install k6  # macOS
# or
curl https://github.com/grafana/k6/releases/download/v0.47.0/k6-v0.47.0-linux-amd64.tar.gz -L | tar xvz

# Run search load test
cd apps/api/test/load
k6 run search-queries.load.js

# Run booking flow test
k6 run bookings-flow.load.js

# Run with custom parameters
k6 run --vus 100 --duration 5m search-queries.load.js

# Generate HTML report
k6 run --out json=results.json search-queries.load.js
k6 run --out influxdb=http://localhost:8086/k6 search-queries.load.js
```

### Success Criteria:

```
✅ Average Response Time: < 200ms
✅ 95th Percentile (p95): < 500ms
✅ 99th Percentile (p99): < 1000ms
✅ Error Rate: < 1%
✅ Throughput: > 100 req/s
✅ Concurrent Users: 100+
```

---

## 🔒 Security Tests

### OWASP ZAP Scanning:

```bash
# Run quick security test
cd apps/api/test/security
./quick-security-test.sh

# Run full ZAP scan
./zap-scan.sh

# View report
open zap-report.html
```

### Manual Security Checklist:

- [ ] SQL Injection prevention
- [ ] XSS prevention
- [ ] CSRF protection
- [ ] Authentication bypass
- [ ] Authorization escalation
- [ ] Rate limiting effectiveness
- [ ] Input validation
- [ ] Output encoding
- [ ] Secrets management
- [ ] HTTPS enforcement

---

## 🤖 Test Automation

### CI/CD Integration:

```yaml
# .github/workflows/test.yml
name: Automated Testing

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Run unit tests
        run: pnpm run test:cov

      - name: Upload coverage
        uses: codecov/codecov-action@v3

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
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
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Run E2E tests
        run: pnpm run test:e2e

  load-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install k6
        run: |
          curl https://github.com/grafana/k6/releases/download/v0.47.0/k6-v0.47.0-linux-amd64.tar.gz -L | tar xvz
          sudo mv k6 /usr/local/bin

      - name: Run load tests
        run: |
          cd apps/api/test/load
          k6 run search-queries.load.js
          k6 run bookings-flow.load.js
```

---

## 📈 Coverage Goals

| Component         | Current | Target | Status         |
| ----------------- | ------- | ------ | -------------- |
| Unit Tests        | 60%     | 95%    | 🟡 In Progress |
| Integration Tests | 70%     | 90%    | 🟢 Good        |
| E2E Tests         | 0%      | 80%    | 🔴 Not Started |
| Load Tests        | 0%      | 100%   | 🔴 Not Started |
| Security Tests    | 0%      | 100%   | 🔴 Not Started |

---

**Document Status**: Complete Testing Plan  
**Last Updated**: January 24, 2026  
**Estimated Timeline**: 3-4 weeks for full implementation
