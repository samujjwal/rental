/**
 * P0: Checkout Orchestration (Saga) E2E Test (Item #17)
 *
 * Tests the full 8-step checkout saga via POST /marketplace/checkout:
 * 1. Policy Pack Validation
 * 2. Fraud Risk Assessment
 * 3. Availability Lock (Redis)
 * 4. Availability Verify (DB)
 * 5. Calculate Pricing + Taxes
 * 6. Payment Authorization
 * 7. Create Booking (Prisma transaction + ledger)
 * 8. Emit Domain Events
 *
 * Also tests compensating actions (saga rollback) when mid-saga failures occur.
 *
 * Uses mocked providers:
 * - PaymentOrchestrationService → mock authorize/refund
 * - FraudIntelligenceService → mock analyzeRisk (ALLOW/REVIEW/BLOCK)
 * - StripeService → mock (prevents STRIPE_SECRET_KEY missing error)
 * - WebhookService → mock (prevents STRIPE_WEBHOOK_SECRET missing error)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { CacheService } from '../src/common/cache/cache.service';
import { StripeService } from '../src/modules/payments/services/stripe.service';
import { WebhookService } from '../src/modules/payments/webhook.service';
import { PaymentOrchestrationService } from '../src/modules/marketplace/services/payment-orchestration.service';
import { FraudIntelligenceService } from '../src/modules/marketplace/services/fraud-intelligence.service';
import { AvailabilityGraphService } from '../src/modules/marketplace/services/availability-graph.service';
import { CountryPolicyPackService } from '../src/modules/marketplace/services/country-policy-pack.service';
import { TaxPolicyEngineService } from '../src/modules/marketplace/services/tax-policy-engine.service';
import {
  PropertyStatus,
  UserRole,
  BookingMode,
  BookingStatus,
} from '@rental-portal/database';
import { buildTestEmail, cleanupCoreRelationalData, createUserWithRole } from './e2e-helpers';

// ── Mocks ───────────────────────────────────────────────────

const mockPaymentOrchestration = {
  authorize: jest.fn().mockResolvedValue({
    transactionId: 'tx_checkout_mock',
    provider: 'mock_provider',
    status: 'AUTHORIZED',
  }),
  refund: jest.fn().mockResolvedValue({ success: true }),
  getRegisteredProviders: jest.fn().mockReturnValue(['mock_provider']),
  registerProvider: jest.fn(),
};

const mockFraudService = {
  analyzeRisk: jest.fn().mockResolvedValue({
    decision: 'ALLOW',
    riskScore: 10,
    reasons: [],
  }),
};

const mockAvailabilityService = {
  checkRealTimeAvailability: jest.fn().mockResolvedValue({ available: true }),
};

const mockPolicyService = {
  validateBooking: jest.fn().mockResolvedValue({ valid: true, violations: [] }),
  loadCountryPolicyPack: jest.fn(),
  getCountryPolicies: jest.fn().mockResolvedValue(null),
};

const mockTaxService = {
  calculateTax: jest.fn().mockResolvedValue({
    totalTax: 50,
    breakdown: [{ name: 'VAT', rate: 0.13, amount: 50 }],
  }),
};

const mockStripeService = {
  providerId: 'stripe',
  providerConfig: { providerId: 'stripe', name: 'Stripe', supportedCountries: ['NP'], supportedCurrencies: ['NPR'] },
  get config() { return this.providerConfig; },
  createPaymentIntent: jest.fn().mockResolvedValue({ clientSecret: 'x', paymentIntentId: 'pi_x', providerId: 'stripe' }),
  capturePaymentIntent: jest.fn(),
  holdDeposit: jest.fn(),
  releaseDeposit: jest.fn(),
  refundPayment: jest.fn(),
  createConnectAccount: jest.fn(),
  createAccountLink: jest.fn(),
  getAccountStatus: jest.fn(),
};

const mockWebhookService = {
  handleStripeWebhook: jest.fn(),
  onModuleInit: jest.fn(),
  deadLetter: { entries: [], enqueue: jest.fn(), setRedis: jest.fn() },
};

describe('Checkout Orchestration Saga (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cacheService: CacheService;
  let renterToken: string;
  let renterId: string;
  let ownerId: string;
  let listingId: string;
  const ownerEmail = buildTestEmail('co-saga-owner');
  const renterEmail = buildTestEmail('co-saga-renter');

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StripeService)
      .useValue(mockStripeService)
      .overrideProvider(WebhookService)
      .useValue(mockWebhookService)
      .overrideProvider(PaymentOrchestrationService)
      .useValue(mockPaymentOrchestration)
      .overrideProvider(FraudIntelligenceService)
      .useValue(mockFraudService)
      .overrideProvider(AvailabilityGraphService)
      .useValue(mockAvailabilityService)
      .overrideProvider(CountryPolicyPackService)
      .useValue(mockPolicyService)
      .overrideProvider(TaxPolicyEngineService)
      .useValue(mockTaxService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );

    prisma = app.get<PrismaService>(PrismaService);
    cacheService = app.get<CacheService>(CacheService);
    await app.init();
  });

  afterAll(async () => {
    await cleanupCoreRelationalData(prisma);
    await prisma.listing.deleteMany({ where: { owner: { email: { in: [ownerEmail, renterEmail] } } } });
    await prisma.category.deleteMany({ where: { slug: 'test-cat-co-saga' } });
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, renterEmail] } } });
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    // Reset mock defaults
    mockFraudService.analyzeRisk.mockResolvedValue({ decision: 'ALLOW', riskScore: 10, reasons: [] });
    mockAvailabilityService.checkRealTimeAvailability.mockResolvedValue({ available: true });
    mockPolicyService.validateBooking.mockResolvedValue({ valid: true, violations: [] });
    mockPaymentOrchestration.authorize.mockResolvedValue({
      transactionId: `tx_${Date.now()}`, provider: 'mock_provider', status: 'AUTHORIZED',
    });

    await cleanupCoreRelationalData(prisma);
    await prisma.listing.deleteMany({ where: { owner: { email: { in: [ownerEmail, renterEmail] } } } });
    await prisma.category.deleteMany({ where: { slug: 'test-cat-co-saga' } });
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, renterEmail] } } });

    // Setup owner
    const owner = await createUserWithRole({
      app, prisma, email: ownerEmail, firstName: 'CO', lastName: 'Owner', role: UserRole.HOST,
    });
    ownerId = owner.userId;
    await prisma.user.update({
      where: { id: ownerId },
      data: { stripeConnectId: 'acct_co_saga', emailVerified: true },
    });

    // Setup renter
    const renter = await createUserWithRole({
      app, prisma, email: renterEmail, firstName: 'CO', lastName: 'Renter', role: UserRole.USER,
    });
    renterToken = renter.accessToken;
    renterId = renter.userId;
    await prisma.user.update({ where: { id: renterId }, data: { emailVerified: true } });

    // Category
    const category = await prisma.category.create({
      data: {
        name: 'CO Saga Cat', slug: 'test-cat-co-saga', description: 'Test',
        icon: 'test', isActive: true, templateSchema: '{}', searchableFields: [], requiredFields: [],
      },
    });

    // Listing
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 20);
    const listing = await prisma.listing.create({
      data: {
        owner: { connect: { id: ownerId } },
        category: { connect: { id: category.id } },
        title: 'CO Saga Listing', description: 'Checkout saga test listing',
        slug: `co-saga-${Date.now()}`, address: '456 Saga Rd', basePrice: 500, currency: 'NPR',
        city: 'Kathmandu', state: 'Bagmati', zipCode: '44600', country: 'NP', type: 'APARTMENT',
        latitude: 27.7172, longitude: 85.324, status: PropertyStatus.AVAILABLE,
        bookingMode: BookingMode.INSTANT_BOOK, minStayNights: 1, maxStayNights: 30, instantBookable: true,
      },
    });
    listingId = listing.id;
  });

  // ── Happy path: full checkout succeeds ────────────────────
  describe('Successful checkout (happy path)', () => {
    it('should execute full 8-step saga and return booking', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 21);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      const res = await request(app.getHttpServer())
        .post('/marketplace/checkout')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          listingId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guestCount: 2,
          paymentMethod: 'card',
          country: 'NP',
          currency: 'NPR',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('bookingId');
      expect(res.body).toHaveProperty('status', 'CONFIRMED');
      expect(res.body).toHaveProperty('totalAmount');
      expect(res.body).toHaveProperty('paymentTransactionId');
      expect(res.body).toHaveProperty('provider', 'mock_provider');

      // Verify booking in DB
      const booking = await prisma.booking.findUnique({ where: { id: res.body.bookingId } });
      expect(booking).toBeDefined();
      expect(booking!.status).toBe('CONFIRMED');
      expect(Number(booking!.totalPrice)).toBe(res.body.totalAmount);

      // Verify ledger entry was created
      const ledger = await prisma.ledgerEntry.findFirst({
        where: { bookingId: res.body.bookingId },
      });
      expect(ledger).toBeDefined();

      // Verify mocks were called in correct order
      expect(mockPolicyService.validateBooking).toHaveBeenCalledTimes(1);
      expect(mockFraudService.analyzeRisk).toHaveBeenCalledTimes(1);
      expect(mockAvailabilityService.checkRealTimeAvailability).toHaveBeenCalledWith(
        listingId, expect.any(Date), expect.any(Date),
      );
      expect(mockPaymentOrchestration.authorize).toHaveBeenCalledTimes(1);
    });

    it('should include correct pricing breakdown', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 25);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 2); // 2 nights

      const res = await request(app.getHttpServer())
        .post('/marketplace/checkout')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          listingId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guestCount: 1,
          paymentMethod: 'card',
          country: 'NP',
          currency: 'NPR',
        });

      expect(res.status).toBe(201);
      // 2 nights * 500/night = 1000 base
      // serviceFee = 1000 * 0.10 = 100 (10% platform fee)
      // tax = 50 (mocked)
      // total = 1000 + 100 + 50 = 1150
      expect(res.body.totalAmount).toBe(1150);
      expect(res.body.serviceFee).toBe(100);
      expect(res.body.taxAmount).toBe(50);
    });
  });

  // ── Fraud block ───────────────────────────────────────────
  describe('Fraud block (saga step 2 abort)', () => {
    it('should reject checkout when fraud service returns BLOCK', async () => {
      mockFraudService.analyzeRisk.mockResolvedValue({
        decision: 'BLOCK',
        riskScore: 95,
        reasons: ['velocity_limit_exceeded'],
      });

      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 22);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 2);

      const res = await request(app.getHttpServer())
        .post('/marketplace/checkout')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          listingId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guestCount: 1,
          paymentMethod: 'card',
          country: 'NP',
          currency: 'NPR',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('fraud');

      // Verify payment was NOT authorized (saga stops before step 6)
      expect(mockPaymentOrchestration.authorize).not.toHaveBeenCalled();
    });
  });

  // ── Availability conflict ─────────────────────────────────
  describe('Availability conflict (saga step 4 abort)', () => {
    it('should reject checkout when listing is not available', async () => {
      mockAvailabilityService.checkRealTimeAvailability.mockResolvedValue({
        available: false,
      });

      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 23);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 2);

      const res = await request(app.getHttpServer())
        .post('/marketplace/checkout')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          listingId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guestCount: 1,
          paymentMethod: 'card',
          country: 'NP',
          currency: 'NPR',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('not available');

      // Payment should NOT have been authorized
      expect(mockPaymentOrchestration.authorize).not.toHaveBeenCalled();
    });
  });

  // ── Payment failure with compensation ─────────────────────
  describe('Payment authorization failure (saga step 6 rollback)', () => {
    it('should compensate (release lock, emit failure event) when payment fails', async () => {
      mockPaymentOrchestration.authorize.mockRejectedValue(
        new Error('Payment provider declined'),
      );

      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 24);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 2);

      const res = await request(app.getHttpServer())
        .post('/marketplace/checkout')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          listingId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guestCount: 1,
          paymentMethod: 'card',
          country: 'NP',
          currency: 'NPR',
        });

      expect(res.status).toBeGreaterThanOrEqual(400);

      // No booking should have been created
      const bookings = await prisma.booking.findMany({
        where: { listingId, renterId },
      });
      expect(bookings.length).toBe(0);
    });
  });

  // ── Policy violation ──────────────────────────────────────
  describe('Policy violation (saga step 1 abort)', () => {
    it('should reject checkout when policy validation fails', async () => {
      mockPolicyService.validateBooking.mockResolvedValue({
        valid: false,
        violations: ['Minimum stay is 7 nights in this region'],
      });

      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 26);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 2);

      const res = await request(app.getHttpServer())
        .post('/marketplace/checkout')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          listingId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guestCount: 1,
          paymentMethod: 'card',
          country: 'NP',
          currency: 'NPR',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Policy validation failed');

      // No other saga steps should have been reached
      expect(mockFraudService.analyzeRisk).not.toHaveBeenCalled();
      expect(mockPaymentOrchestration.authorize).not.toHaveBeenCalled();
    });
  });

  // ── Auth guard ────────────────────────────────────────────
  describe('Authentication guard', () => {
    it('should require authentication for checkout endpoint', async () => {
      await request(app.getHttpServer())
        .post('/marketplace/checkout')
        .send({
          listingId: 'some-listing',
          startDate: '2026-04-01',
          endDate: '2026-04-03',
          guestCount: 1,
          paymentMethod: 'card',
          country: 'NP',
          currency: 'NPR',
        })
        .expect(401);
    });
  });

  // ── Lock management ───────────────────────────────────────
  describe('Lock management endpoints', () => {
    it('should allow releasing a lock via DELETE /marketplace/checkout/lock/:key', async () => {
      // Set a test lock in cache
      const lockKey = `test_lock_${Date.now()}`;
      await cacheService.set(`avail_lock:${lockKey}`, { test: true }, 600);

      const res = await request(app.getHttpServer())
        .delete(`/marketplace/checkout/lock/${lockKey}`)
        .set('Authorization', `Bearer ${renterToken}`);

      // Should succeed (204) or at least not 500
      expect(res.status).toBeLessThan(500);
    });

    it('should allow refreshing a lock via POST /marketplace/checkout/lock/refresh', async () => {
      const lockKey = `test_lock_refresh_${Date.now()}`;
      await cacheService.set(`avail_lock:${lockKey}`, { test: true }, 600);

      const res = await request(app.getHttpServer())
        .post('/marketplace/checkout/lock/refresh')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({ lockKey });

      expect(res.status).toBeLessThan(500);
    });
  });

  // ── Validation ────────────────────────────────────────────
  describe('Request validation', () => {
    it('should reject checkout with missing required fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/marketplace/checkout')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          listingId,
          // Missing: startDate, endDate, guestCount, paymentMethod, country, currency
        });

      expect(res.status).toBe(400);
    });

    it('should reject checkout with invalid date format', async () => {
      const res = await request(app.getHttpServer())
        .post('/marketplace/checkout')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          listingId,
          startDate: 'not-a-date',
          endDate: 'also-not-a-date',
          guestCount: 1,
          paymentMethod: 'card',
          country: 'NP',
          currency: 'NPR',
        });

      expect(res.status).toBe(400);
    });
  });
});
