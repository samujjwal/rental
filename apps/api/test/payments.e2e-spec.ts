import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { StripeService } from '../src/modules/payments/services/stripe.service';
import { BookingStatus, ListingStatus, UserRole, BookingMode } from '@rental-portal/database';

/**
 * Payments E2E Tests
 *
 * These tests verify the payment API endpoints and their integration with the booking system.
 * Note: Stripe webhooks and actual payment processing require real Stripe test keys in .env.test
 */
describe('Payments (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let stripeService: StripeService;
  let ownerToken: string;
  let renterToken: string;
  let ownerId: string;
  let renterId: string;
  let listingId: string;
  let bookingId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    prisma = app.get<PrismaService>(PrismaService);
    stripeService = app.get<StripeService>(StripeService);

    await app.init();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.depositHold.deleteMany({
      where: { booking: { renter: { email: { contains: '@paymenttest.com' } } } },
    });
    await prisma.ledgerEntry.deleteMany({});
    await prisma.booking.deleteMany({
      where: {
        OR: [
          { renter: { email: { contains: '@paymenttest.com' } } },
          { listing: { owner: { email: { contains: '@paymenttest.com' } } } },
        ],
      },
    });
    await prisma.listing.deleteMany({
      where: { owner: { email: { contains: '@paymenttest.com' } } },
    });
    await prisma.category.deleteMany({
      where: { slug: { contains: 'payment-test' } },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: '@paymenttest.com' } },
    });

    // Create test users
    const ownerRes = await request(app.getHttpServer()).post('/api/auth/register').send({
      email: 'owner@paymenttest.com',
      password: 'SecurePass123!',
      firstName: 'Test',
      lastName: 'Owner',
      phone: '+1234567890',
      role: UserRole.HOST,
    });
    ownerToken = ownerRes.body.tokens.accessToken;
    ownerId = ownerRes.body.user.id;

    const renterRes = await request(app.getHttpServer()).post('/api/auth/register').send({
      email: 'renter@paymenttest.com',
      password: 'SecurePass123!',
      firstName: 'Test',
      lastName: 'Renter',
      phone: '+1234567891',
      role: UserRole.USER,
    });
    renterToken = renterRes.body.tokens.accessToken;
    renterId = renterRes.body.user.id;

    // Create test category and listing
    const category = await prisma.category.create({
      data: {
        name: 'Payment Test Category',
        slug: 'payment-test-category',
        description: 'Test category',
        icon: 'test',
        isActive: true,
        templateSchema: '{}',
      },
    });

    const listing = await prisma.listing.create({
      data: {
        ownerId,
        categoryId: category.id,
        title: 'Test Payment Listing',
        description: 'A test listing',
        slug: 'test-payment-listing',
        basePrice: 10000, // $100.00
        currency: 'USD',
        city: 'Test City',
        state: 'TS',
        country: 'US',
        latitude: 40.7128,
        longitude: -74.006,
        status: ListingStatus.ACTIVE,
        bookingMode: BookingMode.INSTANT_BOOK,
        minRentalDays: 1,
        maxRentalDays: 30,
        instantBooking: true,
        depositAmount: 5000, // $50.00 deposit
        details: {},
      },
    });
    listingId = listing.id;
  });

  describe('Stripe Connect Onboarding', () => {
    describe('POST /api/payments/connect/onboard', () => {
      it('should create Stripe Connect onboarding URL', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/payments/connect/onboard')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({
            returnUrl: 'http://localhost:3000/onboarding/complete',
            refreshUrl: 'http://localhost:3000/onboarding/refresh',
          })
          .expect(200);

        expect(response.body).toHaveProperty('url');
        expect(response.body).toHaveProperty('accountId');
        expect(typeof response.body.url).toBe('string');
        expect(response.body.url).toContain('stripe.com');
      });

      it('should return existing account if already created', async () => {
        // First request
        const firstRes = await request(app.getHttpServer())
          .post('/api/payments/connect/onboard')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({
            returnUrl: 'http://localhost:3000/onboarding/complete',
            refreshUrl: 'http://localhost:3000/onboarding/refresh',
          })
          .expect(200);

        const firstAccountId = firstRes.body.accountId;

        // Second request should return same account
        const secondRes = await request(app.getHttpServer())
          .post('/api/payments/connect/onboard')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({
            returnUrl: 'http://localhost:3000/onboarding/complete',
            refreshUrl: 'http://localhost:3000/onboarding/refresh',
          })
          .expect(200);

        expect(secondRes.body.accountId).toBe(firstAccountId);
      });

      it('should require authentication', async () => {
        await request(app.getHttpServer())
          .post('/api/payments/connect/onboard')
          .send({
            returnUrl: 'http://localhost:3000/onboarding/complete',
            refreshUrl: 'http://localhost:3000/onboarding/refresh',
          })
          .expect(401);
      });
    });

    describe('GET /api/payments/connect/status', () => {
      it('should return not connected status when no account', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/payments/connect/status')
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(200);

        expect(response.body.connected).toBe(false);
      });

      it('should return account status when connected', async () => {
        // Create account first
        await request(app.getHttpServer())
          .post('/api/payments/connect/onboard')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({
            returnUrl: 'http://localhost:3000/onboarding/complete',
            refreshUrl: 'http://localhost:3000/onboarding/refresh',
          });

        const response = await request(app.getHttpServer())
          .get('/api/payments/connect/status')
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(200);

        expect(response.body.connected).toBe(true);
        expect(response.body).toHaveProperty('accountId');
        expect(response.body).toHaveProperty('detailsSubmitted');
        expect(response.body).toHaveProperty('chargesEnabled');
        expect(response.body).toHaveProperty('payoutsEnabled');
      });
    });
  });

  describe('Customer Management', () => {
    describe('POST /api/payments/customer', () => {
      it('should create Stripe customer for renter', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/payments/customer')
          .set('Authorization', `Bearer ${renterToken}`)
          .expect(201);

        expect(response.body).toHaveProperty('customerId');
        expect(typeof response.body.customerId).toBe('string');
        expect(response.body.customerId).toContain('cus_');
      });

      it('should require authentication', async () => {
        await request(app.getHttpServer()).post('/api/payments/customer').expect(401);
      });
    });

    describe('GET /api/payments/methods', () => {
      it('should return empty array when no customer', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/payments/methods')
          .set('Authorization', `Bearer ${renterToken}`)
          .expect(200);

        expect(response.body.data).toEqual([]);
      });

      it('should retrieve payment methods for customer', async () => {
        // Create customer first
        await request(app.getHttpServer())
          .post('/api/payments/customer')
          .set('Authorization', `Bearer ${renterToken}`)
          .expect(201);

        const response = await request(app.getHttpServer())
          .get('/api/payments/methods')
          .set('Authorization', `Bearer ${renterToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
      });
    });
  });

  describe('Payment Intents', () => {
    beforeEach(async () => {
      // Create booking for payment tests
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      const booking = await prisma.booking.create({
        data: {
          renterId,
          listingId,
          startDate,
          endDate,
          status: BookingStatus.PENDING_PAYMENT,
          basePrice: 300,
          totalPrice: 330,
          totalAmount: 330,
          currency: 'USD',
          platformFee: 2000,
          serviceFee: 1000,
        },
      });
      bookingId = booking.id;

      // Create customer
      await request(app.getHttpServer())
        .post('/api/payments/customer')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(201);

      // Setup Connect account for owner
      await request(app.getHttpServer())
        .post('/api/payments/connect/onboard')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          returnUrl: 'http://localhost:3000/onboarding/complete',
          refreshUrl: 'http://localhost:3000/onboarding/refresh',
        })
        .expect(200);
    });

    describe('POST /api/payments/intents/:bookingId', () => {
      it('should create payment intent for booking', async () => {
        const response = await request(app.getHttpServer())
          .post(`/api/payments/intents/${bookingId}`)
          .set('Authorization', `Bearer ${renterToken}`)
          .expect(201);

        expect(response.body).toHaveProperty('clientSecret');
        expect(response.body).toHaveProperty('paymentIntentId');
        expect(typeof response.body.clientSecret).toBe('string');
        expect(response.body.paymentIntentId).toContain('pi_');
      });

      it('should reject payment intent by non-renter', async () => {
        await request(app.getHttpServer())
          .post(`/api/payments/intents/${bookingId}`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(400);
      });

      it('should reject payment intent for non-existent booking', async () => {
        await request(app.getHttpServer())
          .post('/api/payments/intents/non-existent-id')
          .set('Authorization', `Bearer ${renterToken}`)
          .expect(400);
      });
    });
  });

  describe('Security Deposits', () => {
    beforeEach(async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      const booking = await prisma.booking.create({
        data: {
          renterId,
          listingId,
          startDate,
          endDate,
          status: BookingStatus.CONFIRMED,
          basePrice: 300,
          totalPrice: 330,
          totalAmount: 330,
          currency: 'USD',
          platformFee: 2000,
          serviceFee: 1000,
          depositAmount: 5000,
        },
      });
      bookingId = booking.id;

      // Create customer
      await request(app.getHttpServer())
        .post('/api/payments/customer')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(201);
    });

    describe('POST /api/payments/deposit/hold/:bookingId', () => {
      it('should hold security deposit', async () => {
        const response = await request(app.getHttpServer())
          .post(`/api/payments/deposit/hold/${bookingId}`)
          .set('Authorization', `Bearer ${renterToken}`)
          .expect(201);

        expect(response.body).toHaveProperty('paymentIntentId');
        expect(typeof response.body.paymentIntentId).toBe('string');

        // Verify deposit hold record created
        const depositHold = await prisma.depositHold.findFirst({
          where: { bookingId },
        });
        expect(depositHold).toBeDefined();
        expect(depositHold.status).toBe('HELD');
        expect(depositHold.amount).toBe(5000);
      });

      it('should reject holding deposit for booking without deposit', async () => {
        // Update booking to have no deposit
        await prisma.booking.update({
          where: { id: bookingId },
          data: { depositAmount: 0 },
        });

        await request(app.getHttpServer())
          .post(`/api/payments/deposit/hold/${bookingId}`)
          .set('Authorization', `Bearer ${renterToken}`)
          .expect(400);
      });
    });

    describe('POST /api/payments/deposit/release/:depositId', () => {
      let depositId: string;

      beforeEach(async () => {
        // Hold deposit first
        const holdRes = await request(app.getHttpServer())
          .post(`/api/payments/deposit/hold/${bookingId}`)
          .set('Authorization', `Bearer ${renterToken}`)
          .expect(201);

        const depositHold = await prisma.depositHold.findFirst({
          where: { bookingId },
        });
        depositId = depositHold.id;
      });

      it('should release security deposit', async () => {
        const response = await request(app.getHttpServer())
          .post(`/api/payments/deposit/release/${depositId}`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);

        // Verify deposit status updated
        const depositHold = await prisma.depositHold.findUnique({
          where: { id: depositId },
        });
        expect(depositHold.status).toBe('RELEASED');
        expect(depositHold.releasedAt).toBeDefined();
      });

      it('should reject releasing non-existent deposit', async () => {
        await request(app.getHttpServer())
          .post('/api/payments/deposit/release/non-existent-id')
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(400);
      });
    });
  });

  describe('Ledger and Balance', () => {
    beforeEach(async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      const booking = await prisma.booking.create({
        data: {
          renterId,
          listingId,
          startDate,
          endDate,
          status: BookingStatus.CONFIRMED,
          basePrice: 300,
          totalPrice: 330,
          totalAmount: 330,
          currency: 'USD',
          platformFee: 2000,
          serviceFee: 1000,
        },
      });
      bookingId = booking.id;

      // Create some ledger entries
      await prisma.ledgerEntry.createMany({
        data: [
          {
            accountId: renterId,
            accountType: 'USER',
            side: 'DEBIT',
            transactionType: 'PAYMENT',
            bookingId,
            amount: 330,
            currency: 'USD',
            description: 'Booking payment',
          },
          {
            accountId: ownerId,
            accountType: 'USER',
            side: 'CREDIT',
            transactionType: 'EARNINGS',
            bookingId,
            amount: 280,
            currency: 'USD',
            description: 'Rental earnings',
          },
        ],
      });
    });

    describe('GET /api/payments/ledger/booking/:bookingId', () => {
      it('should retrieve booking ledger entries', async () => {
        const response = await request(app.getHttpServer())
          .get(`/api/payments/ledger/booking/${bookingId}`)
          .set('Authorization', `Bearer ${renterToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
        expect(response.body[0]).toHaveProperty('type');
        expect(response.body[0]).toHaveProperty('amount');
        expect(response.body[0]).toHaveProperty('currency');
        expect(response.body[0]).toHaveProperty('description');
      });

      it('should return empty array for non-existent booking', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/payments/ledger/booking/non-existent-id')
          .set('Authorization', `Bearer ${renterToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBe(0);
      });
    });

    describe('GET /api/payments/balance', () => {
      it('should retrieve renter balance', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/payments/balance')
          .set('Authorization', `Bearer ${renterToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('balance');
        expect(response.body).toHaveProperty('currency');
        expect(typeof response.body.balance).toBe('number');
        expect(response.body.balance).toBe(-33000); // Negative due to charge
      });

      it('should retrieve owner balance', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/payments/balance')
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('balance');
        expect(typeof response.body.balance).toBe('number');
        expect(response.body.balance).toBe(28000); // Positive due to credit
      });
    });
  });

  describe('Payouts', () => {
    beforeEach(async () => {
      // Setup Connect account
      await request(app.getHttpServer())
        .post('/api/payments/connect/onboard')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          returnUrl: 'http://localhost:3000/onboarding/complete',
          refreshUrl: 'http://localhost:3000/onboarding/refresh',
        })
        .expect(200);

      // Create earnings ledger entry
      await prisma.ledgerEntry.create({
        data: {
          accountId: ownerId,
          accountType: 'USER',
          side: 'CREDIT',
          transactionType: 'EARNINGS',
          amount: 500,
          currency: 'USD',
          description: 'Test earnings',
        },
      });
    });

    describe('GET /api/payments/earnings', () => {
      it('should retrieve pending earnings', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/payments/earnings')
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('pendingAmount');
        expect(typeof response.body.pendingAmount).toBe('number');
        expect(response.body.pendingAmount).toBe(50000);
      });
    });

    describe('POST /api/payments/payouts', () => {
      it('should create payout request', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/payments/payouts')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ amount: 25000 })
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('amount');
        expect(response.body.amount).toBe(25000);
        expect(response.body).toHaveProperty('status');
      });

      it('should reject payout without Connect account', async () => {
        // Use renter who doesn't have Connect account
        await request(app.getHttpServer())
          .post('/api/payments/payouts')
          .set('Authorization', `Bearer ${renterToken}`)
          .expect(400);
      });
    });

    describe('GET /api/payments/payouts', () => {
      it('should retrieve payout history', async () => {
        // Create a payout first
        await request(app.getHttpServer())
          .post('/api/payments/payouts')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ amount: 25000 })
          .expect(201);

        const response = await request(app.getHttpServer())
          .get('/api/payments/payouts')
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
        expect(response.body[0]).toHaveProperty('amount');
        expect(response.body[0]).toHaveProperty('status');
      });
    });
  });

  describe('Payment Flow Integration', () => {
    it('should complete full payment flow', async () => {
      // 1. Create customer
      const customerRes = await request(app.getHttpServer())
        .post('/api/payments/customer')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(201);

      expect(customerRes.body).toHaveProperty('customerId');

      // 2. Setup Connect account for owner
      const connectRes = await request(app.getHttpServer())
        .post('/api/payments/connect/onboard')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          returnUrl: 'http://localhost:3000/onboarding/complete',
          refreshUrl: 'http://localhost:3000/onboarding/refresh',
        })
        .expect(200);

      expect(connectRes.body).toHaveProperty('accountId');

      // 3. Create booking
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      const bookingRes = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          listingId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        })
        .expect(201);

      const newBookingId = bookingRes.body.id;

      // 4. Create payment intent
      const intentRes = await request(app.getHttpServer())
        .post(`/api/payments/intents/${newBookingId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(201);

      expect(intentRes.body).toHaveProperty('clientSecret');
      expect(intentRes.body).toHaveProperty('paymentIntentId');

      // 5. Hold deposit
      const depositRes = await request(app.getHttpServer())
        .post(`/api/payments/deposit/hold/${newBookingId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(201);

      expect(depositRes.body).toHaveProperty('paymentIntentId');

      // 6. Verify ledger entries created
      const ledgerRes = await request(app.getHttpServer())
        .get(`/api/payments/ledger/booking/${newBookingId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(Array.isArray(ledgerRes.body)).toBe(true);
    });
  });
});
