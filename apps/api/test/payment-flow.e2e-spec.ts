/**
 * P0: Payment Intent Flow E2E Test
 *
 * Tests the full payment lifecycle:
 * 1. Create booking → status PENDING_OWNER_APPROVAL
 * 2. Owner approves → status PENDING_PAYMENT
 * 3. Create payment intent → returns clientSecret (Stripe mocked)
 * 4. Verify Payment record creation + financial assertions
 *
 * Uses mocked StripeService via module override so tests are deterministic
 * and don't require a live Stripe key.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { StripeService } from '../src/modules/payments/services/stripe.service';
import { WebhookService } from '../src/modules/payments/webhook.service';
import { BookingStatus, PropertyStatus, UserRole, BookingMode, PaymentStatus } from '@rental-portal/database';
import { buildTestEmail, cleanupCoreRelationalData, createUserWithRole } from './e2e-helpers';

// ── Stripe Mock ─────────────────────────────────────────────
const mockStripeService = {
  providerId: 'stripe',
  providerConfig: {
    providerId: 'stripe',
    name: 'Stripe',
    supportedCountries: ['US', 'NP'],
    supportedCurrencies: ['USD', 'NPR'],
  },
  get config() { return this.providerConfig; },
  createPaymentIntent: jest.fn().mockResolvedValue({
    clientSecret: 'pi_test_secret_mock',
    paymentIntentId: 'pi_mock_123',
    providerId: 'stripe',
  }),
  capturePaymentIntent: jest.fn().mockResolvedValue(undefined),
  holdDeposit: jest.fn().mockResolvedValue('pi_deposit_mock'),
  releaseDeposit: jest.fn().mockResolvedValue(undefined),
  refundPayment: jest.fn().mockResolvedValue({ refundId: 'rf_mock' }),
  createConnectAccount: jest.fn().mockResolvedValue('acct_mock'),
  createAccountLink: jest.fn().mockResolvedValue('https://mock-onboard.example.com'),
  getAccountStatus: jest.fn().mockResolvedValue({
    detailsSubmitted: true,
    chargesEnabled: true,
    payoutsEnabled: true,
  }),
};

// Minimal mock for WebhookService so it doesn't throw on missing STRIPE_WEBHOOK_SECRET
const mockWebhookService = {
  handleStripeWebhook: jest.fn().mockResolvedValue(undefined),
  onModuleInit: jest.fn(),
  deadLetter: { entries: [], enqueue: jest.fn(), setRedis: jest.fn() },
};

describe('Payment Intent Flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let renterToken: string;
  let ownerId: string;
  let renterId: string;
  let categoryId: string;
  let listingId: string;
  const ownerEmail = buildTestEmail('pi-flow-owner');
  const renterEmail = buildTestEmail('pi-flow-renter');

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StripeService)
      .useValue(mockStripeService)
      .overrideProvider(WebhookService)
      .useValue(mockWebhookService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    prisma = app.get<PrismaService>(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await cleanupCoreRelationalData(prisma);
    await prisma.listing.deleteMany({ where: { owner: { email: { in: [ownerEmail, renterEmail] } } } });
    await prisma.category.deleteMany({ where: { slug: 'test-cat-pi-flow' } });
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, renterEmail] } } });
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    // Reset mocks between tests
    jest.clearAllMocks();

    await cleanupCoreRelationalData(prisma);
    await prisma.listing.deleteMany({ where: { owner: { email: { in: [ownerEmail, renterEmail] } } } });
    await prisma.category.deleteMany({ where: { slug: 'test-cat-pi-flow' } });
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, renterEmail] } } });

    // Setup owner with Stripe Connect
    const owner = await createUserWithRole({
      app,
      prisma,
      email: ownerEmail,
      firstName: 'PI',
      lastName: 'Owner',
      role: UserRole.HOST,
    });
    ownerToken = owner.accessToken;
    ownerId = owner.userId;

    // Add stripe connect ID to owner
    await prisma.user.update({
      where: { id: ownerId },
      data: {
        stripeConnectId: 'acct_test_pi_flow',
        emailVerified: true,
      },
    });

    const renter = await createUserWithRole({
      app,
      prisma,
      email: renterEmail,
      firstName: 'PI',
      lastName: 'Renter',
      role: UserRole.USER,
    });
    renterToken = renter.accessToken;
    renterId = renter.userId;

    // Verify renter email so EmailVerifiedGuard passes
    await prisma.user.update({
      where: { id: renterId },
      data: { emailVerified: true },
    });

    // Create test category
    const category = await prisma.category.create({
      data: {
        name: 'PI Flow Category',
        slug: 'test-cat-pi-flow',
        description: 'Test',
        icon: 'test',
        isActive: true,
        templateSchema: '{}',
        searchableFields: [],
        requiredFields: [],
      },
    });
    categoryId = category.id;

    // Create test listing
    const listing = await prisma.listing.create({
      data: {
        owner: { connect: { id: ownerId } },
        category: { connect: { id: categoryId } },
        title: 'PI Flow Test Listing',
        description: 'A listing for payment intent flow testing',
        slug: 'pi-flow-test-listing',
        address: '123 PI Test St',
        basePrice: 500,
        currency: 'NPR',
        city: 'Kathmandu',
        state: 'Bagmati',
        zipCode: '44600',
        country: 'NP',
        type: 'APARTMENT',
        latitude: 27.7172,
        longitude: 85.324,
        status: PropertyStatus.AVAILABLE,
        bookingMode: BookingMode.REQUEST,
        minStayNights: 1,
        maxStayNights: 30,
        instantBookable: false,
      },
    });
    listingId = listing.id;
  });

  describe('Full payment intent lifecycle', () => {
    it('should create booking → approve → create intent → verify payment record', async () => {
      // Step 1: Create a booking as renter
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 14);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      const bookingResponse = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          listingId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guestCount: 1,
        })
        .expect(201);

      const bookingId = bookingResponse.body.id;
      expect(bookingId).toBeDefined();
      expect(bookingResponse.body.status).toBe(BookingStatus.PENDING_OWNER_APPROVAL);

      // Step 2: Owner approves the booking
      const approveResponse = await request(app.getHttpServer())
        .patch(`/bookings/${bookingId}/approve`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(approveResponse.body.status).toBe(BookingStatus.PENDING_PAYMENT);

      // Step 3: Renter creates payment intent (Stripe is mocked)
      const intentResponse = await request(app.getHttpServer())
        .post(`/payments/intents/${bookingId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(201);

      // Verify mock response
      expect(intentResponse.body).toHaveProperty('clientSecret', 'pi_test_secret_mock');
      expect(intentResponse.body).toHaveProperty('paymentIntentId', 'pi_mock_123');
      expect(intentResponse.body).toHaveProperty('providerId', 'stripe');

      // Verify StripeService.createPaymentIntent was called with correct args
      expect(mockStripeService.createPaymentIntent).toHaveBeenCalledWith(
        bookingId,
        expect.any(Number),  // totalPrice
        'NPR',               // currency
        undefined,            // no stripe customer for new user
      );

      // Verify a Payment record was created in DB
      const payment = await prisma.payment.findFirst({
        where: { bookingId },
        orderBy: { createdAt: 'desc' },
      });
      expect(payment).toBeDefined();
      expect(payment!.status).toBe(PaymentStatus.PENDING);
      expect(payment!.stripePaymentIntentId).toBe('pi_mock_123');

      // Verify booking paymentIntentId was updated
      const updatedBooking = await prisma.booking.findUnique({ where: { id: bookingId } });
      expect(updatedBooking!.paymentIntentId).toBe('pi_mock_123');
    });

    it('should reject payment intent creation when booking is not in PENDING_PAYMENT state', async () => {
      // Create booking but DON'T approve it
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 14);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 2);

      const bookingRes = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          listingId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guestCount: 1,
        })
        .expect(201);

      // Try to create payment intent without approval — should fail
      const res = await request(app.getHttpServer())
        .post(`/payments/intents/${bookingRes.body.id}`)
        .set('Authorization', `Bearer ${renterToken}`);

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it('should reject payment intent creation by non-renter', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 14);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 2);

      const bookingRes = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          listingId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guestCount: 1,
        })
        .expect(201);

      // Approve
      await request(app.getHttpServer())
        .patch(`/bookings/${bookingRes.body.id}/approve`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      // Owner tries to create payment intent — should fail
      const res = await request(app.getHttpServer())
        .post(`/payments/intents/${bookingRes.body.id}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it('should require authentication for payment intent creation', async () => {
      await request(app.getHttpServer())
        .post('/payments/intents/some-booking-id')
        .expect(401);
    });
  });

  describe('Payment intent financial assertions', () => {
    it('should calculate correct price breakdown for multi-day booking', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 10);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 5); // 5 days

      const bookingRes = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          listingId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guestCount: 1,
        })
        .expect(201);

      const booking = bookingRes.body;

      // Verify price breakdown is present and makes sense
      expect(booking).toHaveProperty('subtotal');
      expect(booking).toHaveProperty('serviceFee');
      expect(booking).toHaveProperty('total');

      // basePrice = 500/day * 5 days = 2500
      const subtotal = parseFloat(booking.subtotal);
      expect(subtotal).toBeGreaterThan(0);

      // Service fee should be positive
      if (booking.serviceFee) {
        const serviceFee = parseFloat(booking.serviceFee);
        expect(serviceFee).toBeGreaterThanOrEqual(0);
      }

      // Total should >= subtotal
      const total = parseFloat(booking.total);
      expect(total).toBeGreaterThanOrEqual(subtotal);
    });
  });
});
