/**
 * Payout Flow E2E Test
 *
 * Tests the full payout pipeline:
 * 1. Owner with completed bookings has pending earnings
 * 2. Owner requests payout via POST /payments/payouts
 * 3. System validates owner (stripeConnectId, onboarding complete)
 * 4. System creates Stripe payout
 * 5. System creates payout record in DB
 * 6. System creates ledger entries
 *
 * This covers the gap identified in the Deep Flow Verification Report (Section 10.1):
 * "Payout flow end-to-end: balance → payout → Stripe → ledger"
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { StripeService } from '../src/modules/payments/services/stripe.service';
import { WebhookService } from '../src/modules/payments/webhook.service';
import {
  BookingStatus,
  PropertyStatus,
  UserRole,
  BookingMode,
  PayoutStatus,
  AccountType,
  TransactionType,
  LedgerSide,
} from '@rental-portal/database';
import {
  buildTestEmail,
  cleanupCoreRelationalData,
  createUserWithRole,
  loginUser,
} from './e2e-helpers';
import request from 'supertest';

// ── Stripe Mock ─────────────────────────────────────────────
const mockStripeService = {
  providerId: 'stripe',
  providerConfig: {
    providerId: 'stripe',
    name: 'Stripe',
    supportedCountries: ['US', 'NP'],
    supportedCurrencies: ['USD', 'NPR'],
  },
  get config() {
    return this.providerConfig;
  },
  createPaymentIntent: jest.fn().mockResolvedValue({
    clientSecret: 'pi_test_secret_mock',
    paymentIntentId: 'pi_mock_payout',
    providerId: 'stripe',
  }),
  capturePaymentIntent: jest.fn().mockResolvedValue(undefined),
  holdDeposit: jest.fn().mockResolvedValue('pi_deposit_mock'),
  releaseDeposit: jest.fn().mockResolvedValue(undefined),
  refundPayment: jest.fn().mockResolvedValue({ refundId: 'rf_mock' }),
  createConnectAccount: jest.fn().mockResolvedValue('acct_mock'),
  createAccountLink: jest
    .fn()
    .mockResolvedValue('https://mock-onboard.example.com'),
  getAccountStatus: jest.fn().mockResolvedValue({
    detailsSubmitted: true,
    chargesEnabled: true,
    payoutsEnabled: true,
  }),
  createPayout: jest.fn().mockResolvedValue('tr_payout_test_123'),
  createRefund: jest
    .fn()
    .mockResolvedValue({ id: 're_mock', status: 'succeeded' }),
};

const mockWebhookService = {
  handleStripeWebhook: jest.fn().mockResolvedValue(undefined),
  onModuleInit: jest.fn(),
  deadLetter: { entries: [], enqueue: jest.fn(), setRedis: jest.fn() },
};

describe('Payout Flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerId: string;
  let renterId: string;
  let categoryId: string;
  let listingId: string;
  let ownerAccessToken: string;
  const ownerEmail = buildTestEmail('payout-owner');
  const renterEmail = buildTestEmail('payout-renter');

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
    await prisma.ledgerEntry.deleteMany({
      where: { booking: { listing: { owner: { email: ownerEmail } } } },
    });
    await prisma.payout.deleteMany({
      where: { owner: { email: { in: [ownerEmail, renterEmail] } } },
    });
    await prisma.escrowTransaction.deleteMany({
      where: { booking: { listing: { owner: { email: ownerEmail } } } },
    });
    await prisma.listing.deleteMany({
      where: { owner: { email: { in: [ownerEmail, renterEmail] } } },
    });
    await prisma.category.deleteMany({ where: { slug: 'test-cat-payout' } });
    await prisma.user.deleteMany({
      where: { email: { in: [ownerEmail, renterEmail] } },
    });
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    await cleanupCoreRelationalData(prisma);
    await prisma.ledgerEntry.deleteMany({
      where: { booking: { listing: { owner: { email: ownerEmail } } } },
    });
    await prisma.payout.deleteMany({
      where: { owner: { email: { in: [ownerEmail, renterEmail] } } },
    });
    await prisma.escrowTransaction.deleteMany({
      where: { booking: { listing: { owner: { email: ownerEmail } } } },
    });
    await prisma.listing.deleteMany({
      where: { owner: { email: { in: [ownerEmail, renterEmail] } } },
    });
    await prisma.category.deleteMany({ where: { slug: 'test-cat-payout' } });
    await prisma.user.deleteMany({
      where: { email: { in: [ownerEmail, renterEmail] } },
    });

    // Create owner with Stripe Connect
    const owner = await createUserWithRole({
      app,
      prisma,
      email: ownerEmail,
      firstName: 'Payout',
      lastName: 'Owner',
      role: UserRole.HOST,
    });
    ownerId = owner.userId;
    await prisma.user.update({
      where: { id: ownerId },
      data: {
        stripeConnectId: 'acct_test_payout',
        stripeOnboardingComplete: true,
        emailVerified: true,
      },
    });

    // Login owner
    const loginRes = await loginUser(app, ownerEmail);
    ownerAccessToken = loginRes.accessToken;

    // Create renter
    const renter = await createUserWithRole({
      app,
      prisma,
      email: renterEmail,
      firstName: 'Payout',
      lastName: 'Renter',
      role: UserRole.USER,
    });
    renterId = renter.userId;
    await prisma.user.update({
      where: { id: renterId },
      data: { emailVerified: true },
    });

    // Create category
    const category = await prisma.category.create({
      data: {
        name: 'Payout Test Category',
        slug: 'test-cat-payout',
        description: 'Test',
        icon: 'test',
        isActive: true,
        templateSchema: '{}',
        searchableFields: [],
        requiredFields: [],
      },
    });
    categoryId = category.id;

    // Create listing
    const listing = await prisma.listing.create({
      data: {
        owner: { connect: { id: ownerId } },
        category: { connect: { id: categoryId } },
        title: 'Payout Test Listing',
        description: 'A listing for payout flow testing',
        slug: `payout-test-listing-${Date.now()}`,
        address: '123 Payout St',
        basePrice: 1000,
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

  describe('POST /payments/payouts', () => {
    it('should create payout, call Stripe, and record ledger entries', async () => {
      // Create a completed booking with owner earnings
      const booking = await prisma.booking.create({
        data: {
          listing: { connect: { id: listingId } },
          renter: { connect: { id: renterId } },
          bookingOwner: { connect: { id: ownerId } },
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-03'),
          status: BookingStatus.SETTLED,
          basePrice: 3000,
          platformFee: 300,
          ownerEarnings: 2700,
          totalPrice: 3000,
          currency: 'NPR',
          guestCount: 1,
        },
      });

      // Create completed payment
      await prisma.payment.create({
        data: {
          booking: { connect: { id: booking.id } },
          amount: 3000,
          currency: 'NPR',
          status: 'COMPLETED',
          paymentIntentId: 'pi_payout_test',
        },
      });

      // Request payout
      const response = await request(app.getHttpServer())
        .post('/payments/payouts')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ amount: 2700 })
        .expect(201);

      // Verify response
      expect(response.body).toMatchObject({
        payoutId: expect.any(String),
        amount: 2700,
        currency: 'NPR',
      });

      // Verify Stripe payout was called
      expect(mockStripeService.createPayout).toHaveBeenCalledWith(
        'acct_test_payout',
        2700,
        'NPR',
      );

      // Verify payout record created
      const payout = await prisma.payout.findUnique({
        where: { id: response.body.payoutId },
      });
      expect(payout).toBeDefined();
      expect(payout?.ownerId).toBe(ownerId);
      expect(Number(payout?.amount)).toBe(2700);
      expect(payout?.status).toBe(PayoutStatus.PENDING);
      expect(payout?.transferId).toBe('tr_payout_test_123');

      // Verify ledger entries created
      const ledgerEntries = await prisma.ledgerEntry.findMany({
        where: {
          bookingId: booking.id,
          transactionType: TransactionType.PAYOUT,
        },
        orderBy: { side: 'asc' },
      });
      expect(ledgerEntries).toHaveLength(2);

      // DEBIT Receivable (decrease liability to owner)
      expect(ledgerEntries[0]).toMatchObject({
        accountType: AccountType.RECEIVABLE,
        side: LedgerSide.DEBIT,
        amount: expect.any(Object), // Decimal
      });
      expect(Number(ledgerEntries[0].amount)).toBe(2700);

      // CREDIT Cash (decrease cash account)
      expect(ledgerEntries[1]).toMatchObject({
        accountType: AccountType.CASH,
        side: LedgerSide.CREDIT,
        amount: expect.any(Object),
      });
      expect(Number(ledgerEntries[1].amount)).toBe(2700);
    });

    it('should reject payout when owner has no stripeConnectId', async () => {
      // Remove stripeConnectId
      await prisma.user.update({
        where: { id: ownerId },
        data: { stripeConnectId: null },
      });

      await request(app.getHttpServer())
        .post('/payments/payouts')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ amount: 1000 })
        .expect(400);

      // Verify no payout created
      const payouts = await prisma.payout.findMany({
        where: { ownerId },
      });
      expect(payouts).toHaveLength(0);
    });

    it('should reject payout when owner onboarding not complete', async () => {
      await prisma.user.update({
        where: { id: ownerId },
        data: { stripeOnboardingComplete: false },
      });

      await request(app.getHttpServer())
        .post('/payments/payouts')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ amount: 1000 })
        .expect(400);
    });

    it('should reject payout when no pending earnings', async () => {
      // No bookings created, so no earnings

      await request(app.getHttpServer())
        .post('/payments/payouts')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ amount: 1000 })
        .expect(400);
    });

    it('should reject payout when amount exceeds pending earnings', async () => {
      // Create booking with 2700 earnings
      const booking = await prisma.booking.create({
        data: {
          listing: { connect: { id: listingId } },
          renter: { connect: { id: renterId } },
          bookingOwner: { connect: { id: ownerId } },
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-03'),
          status: BookingStatus.SETTLED,
          basePrice: 3000,
          platformFee: 300,
          ownerEarnings: 2700,
          totalPrice: 3000,
          currency: 'NPR',
          guestCount: 1,
        },
      });

      await prisma.payment.create({
        data: {
          booking: { connect: { id: booking.id } },
          amount: 3000,
          currency: 'NPR',
          status: 'COMPLETED',
          paymentIntentId: 'pi_payout_test',
        },
      });

      // Request more than available
      await request(app.getHttpServer())
        .post('/payments/payouts')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ amount: 5000 })
        .expect(400);
    });
  });
});
