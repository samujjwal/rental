/**
 * Comprehensive Payment Processing E2E Tests
 *
 * Tests core payment workflow using actual API routes:
 * - POST /payments/intents/:bookingId - create payment intent
 * - GET  /payments/transactions       - payment history
 * - POST /payments/refund/:bookingId  - request refund
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { StripeService } from '../src/modules/payments/services/stripe.service';
import { WebhookService } from '../src/modules/payments/webhook.service';
import { BookingStatus, UserRole } from '@rental-portal/database';
import {
  buildTestEmail,
  cleanupCoreRelationalData,
  createUserWithRole,
  loginUser,
} from './e2e-helpers';

const mockStripeService = {
  providerId: 'stripe',
  providerConfig: { providerId: 'stripe', name: 'Stripe', supportedCountries: ['US', 'NP'], supportedCurrencies: ['USD', 'NPR'] },
  get config() { return this.providerConfig; },
  createPaymentIntent: jest.fn().mockResolvedValue({ clientSecret: 'pi_pp_secret_mock', paymentIntentId: 'pi_pp_mock_001', providerId: 'stripe' }),
  capturePaymentIntent: jest.fn().mockResolvedValue(undefined),
  holdDeposit: jest.fn().mockResolvedValue('pi_deposit_mock'),
  releaseDeposit: jest.fn().mockResolvedValue(undefined),
  refundPayment: jest.fn().mockResolvedValue({ refundId: 'rf_pp_mock' }),
  createRefund: jest.fn().mockResolvedValue({ id: 're_pp_mock', status: 'succeeded' }),
  createConnectAccount: jest.fn().mockResolvedValue('acct_pp_mock'),
  createAccountLink: jest.fn().mockResolvedValue('https://mock-onboard.example.com'),
  getAccountStatus: jest.fn().mockResolvedValue({ detailsSubmitted: true, chargesEnabled: true, payoutsEnabled: true }),
  createPayout: jest.fn().mockResolvedValue('tr_pp_mock'),
};

const mockWebhookService = {
  handleStripeWebhook: jest.fn().mockResolvedValue(undefined),
  onModuleInit: jest.fn(),
  deadLetter: { entries: [], enqueue: jest.fn(), setRedis: jest.fn() },
};

describe('Payment Processing E2E Suite', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let renterToken: string;
  let renterId: string;
  let ownerId: string;
  let listingId: string;

  const renterEmail = buildTestEmail('pp-renter');
  const ownerEmail = buildTestEmail('pp-owner');

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(StripeService).useValue(mockStripeService)
      .overrideProvider(WebhookService).useValue(mockWebhookService)
      .compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
  }, 30_000);

  afterAll(async () => {
    await cleanupCoreRelationalData(prisma);
    await prisma.listing.deleteMany({ where: { owner: { email: { in: [ownerEmail, renterEmail] } } } });
    await prisma.category.deleteMany({ where: { slug: 'test-cat-pp' } });
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, renterEmail] } } });
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await cleanupCoreRelationalData(prisma);
    await prisma.listing.deleteMany({ where: { owner: { email: { in: [ownerEmail, renterEmail] } } } });
    await prisma.category.deleteMany({ where: { slug: 'test-cat-pp' } });
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, renterEmail] } } });

    const owner = await createUserWithRole({ app, prisma, email: ownerEmail, firstName: 'PP', lastName: 'Owner', role: UserRole.HOST });
    ownerId = owner.userId;
    await prisma.user.update({ where: { id: ownerId }, data: { emailVerified: true } });

    const renter = await createUserWithRole({ app, prisma, email: renterEmail, firstName: 'PP', lastName: 'Renter', role: UserRole.USER });
    renterId = renter.userId;
    await prisma.user.update({ where: { id: renterId }, data: { emailVerified: true } });

    const loginRes = await loginUser(app, renterEmail);
    renterToken = loginRes.accessToken;

    const cat = await prisma.category.create({
      data: { name: 'PP Test Category', slug: 'test-cat-pp', description: 'Test', icon: 'test', isActive: true, templateSchema: '{}', searchableFields: [], requiredFields: [] },
    });

    const listing = await prisma.listing.create({
      data: {
        owner: { connect: { id: ownerId } },
        category: { connect: { id: cat.id } },
        title: 'PP Test Listing',
        description: 'A listing for payment processing testing',
        slug: `pp-test-${Date.now()}`,
        address: '123 PP St',
        basePrice: 1000,
        currency: 'NPR',
        city: 'Kathmandu',
        state: 'Bagmati',
        zipCode: '44600',
        country: 'NP',
        type: 'APARTMENT',
        latitude: 27.7172,
        longitude: 85.324,
        status: 'AVAILABLE',
        bookingMode: 'REQUEST',
        minStayNights: 1,
        maxStayNights: 30,
        instantBookable: false,
      },
    });
    listingId = listing.id;
  });

  async function createPendingPaymentBooking() {
    return prisma.booking.create({
      data: {
        listing: { connect: { id: listingId } },
        renter: { connect: { id: renterId } },
        bookingOwner: { connect: { id: ownerId } },
        startDate: new Date('2027-01-10'),
        endDate: new Date('2027-01-12'),
        basePrice: 2000,
        totalPrice: 2300,
        currency: 'NPR',
        status: BookingStatus.PENDING_PAYMENT,
        guestCount: 1,
      },
    });
  }

  async function createCompletedPaymentBooking() {
    const booking = await prisma.booking.create({
      data: {
        listing: { connect: { id: listingId } },
        renter: { connect: { id: renterId } },
        bookingOwner: { connect: { id: ownerId } },
        startDate: new Date('2027-02-10'),
        endDate: new Date('2027-02-12'),
        basePrice: 2000,
        totalPrice: 2300,
        currency: 'NPR',
        status: BookingStatus.CONFIRMED,
        guestCount: 1,
      },
    });
    await prisma.payment.create({
      data: {
        booking: { connect: { id: booking.id } },
        amount: 2300,
        currency: 'NPR',
        status: 'COMPLETED',
        paymentIntentId: 'pi_pp_completed',
        stripePaymentIntentId: 'pi_pp_stripe_completed',
      },
    });
    await prisma.ledgerEntry.create({
      data: {
        bookingId: booking.id,
        accountId: renterId,
        accountType: 'CASH',
        transactionType: 'PAYMENT',
        side: 'DEBIT',
        amount: 2300,
        currency: 'NPR',
        description: 'Test payment',
        status: 'SETTLED',
      },
    });
    return booking;
  }

  describe('Payment Intent Creation', () => {
    it('POST /payments/intents/:bookingId -> 201', async () => {
      const booking = await createPendingPaymentBooking();
      const response = await request(app.getHttpServer())
        .post(`/payments/intents/${booking.id}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(201);
      expect(response.body).toMatchObject({ clientSecret: expect.any(String), paymentIntentId: expect.any(String) });
      expect(mockStripeService.createPaymentIntent).toHaveBeenCalled();
    });

    it('POST /payments/intents/:bookingId -> 400 (wrong status)', async () => {
      const booking = await prisma.booking.create({
        data: {
          listing: { connect: { id: listingId } },
          renter: { connect: { id: renterId } },
          bookingOwner: { connect: { id: ownerId } },
          startDate: new Date('2027-03-10'),
          endDate: new Date('2027-03-12'),
          basePrice: 2000,
          totalPrice: 2300,
          currency: 'NPR',
          status: BookingStatus.CONFIRMED,
          guestCount: 1,
        },
      });
      await request(app.getHttpServer())
        .post(`/payments/intents/${booking.id}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(400);
    });

    it('POST /payments/intents/:bookingId -> 401 (no auth)', async () => {
      const booking = await createPendingPaymentBooking();
      await request(app.getHttpServer()).post(`/payments/intents/${booking.id}`).expect(401);
    });
  });

  describe('Payment History', () => {
    it('GET /payments/transactions -> 200', async () => {
      const response = await request(app.getHttpServer())
        .get('/payments/transactions')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);
      expect(response.body).toBeDefined();
    });

    it('GET /payments/transactions -> 401 (no auth)', async () => {
      await request(app.getHttpServer()).get('/payments/transactions').expect(401);
    });
  });

  describe('Refund Processing', () => {
    it('POST /payments/refund/:bookingId -> 200', async () => {
      const booking = await createCompletedPaymentBooking();
      const response = await request(app.getHttpServer())
        .post(`/payments/refund/${booking.id}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .send({ reason: 'requested_by_customer' })
        .expect((r: any) => expect([200, 201]).toContain(r.status));
      expect(response.body).toHaveProperty('amount');
      expect(response.body).toHaveProperty('refundId');
    });

    it('POST /payments/refund/:bookingId -> 403 (not renter)', async () => {
      const booking = await createCompletedPaymentBooking();
      const ownerLogin = await loginUser(app, ownerEmail);
      await request(app.getHttpServer())
        .post(`/payments/refund/${booking.id}`)
        .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
        .send({ reason: 'requested_by_customer' })
        .expect(403);
    });

    it('POST /payments/refund/:bookingId -> 400/404 (no payment)', async () => {
      const booking = await prisma.booking.create({
        data: {
          listing: { connect: { id: listingId } },
          renter: { connect: { id: renterId } },
          bookingOwner: { connect: { id: ownerId } },
          startDate: new Date('2027-05-10'),
          endDate: new Date('2027-05-12'),
          basePrice: 2000,
          totalPrice: 2300,
          currency: 'NPR',
          status: BookingStatus.CONFIRMED,
          guestCount: 1,
        },
      });
      await request(app.getHttpServer())
        .post(`/payments/refund/${booking.id}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .send({ reason: 'requested_by_customer' })
        .expect((r: any) => expect([400, 404]).toContain(r.status));
    });

    it('POST /payments/refund/:bookingId -> 401 (no auth)', async () => {
      await request(app.getHttpServer()).post('/payments/refund/some-id').send({ reason: 'test' }).expect(401);
    });
  });
});
