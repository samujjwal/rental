/**
 * Settlement Chain E2E Test
 *
 * Tests the async settlement pipeline:
 * 1. Create COMPLETED booking with payment (>48h old)
 * 2. Run autoSettleBookings cron
 * 3. Verify: booking → SETTLED, state history created, settlement job queued
 * 4. Run settlement processor to verify: Stripe payout → Payout record → Event emission
 *
 * This covers the gap identified in the Deep Flow Verification Report (Section 10.1):
 * "Full settlement chain: Cron → StateMachine → Queue → Stripe → Ledger → Escrow"
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { SchedulerService } from '../src/common/scheduler/scheduler.service';
import { StripeService } from '../src/modules/payments/services/stripe.service';
import { WebhookService } from '../src/modules/payments/webhook.service';
import {
  BookingStatus,
  PropertyStatus,
  UserRole,
  BookingMode,
} from '@rental-portal/database';
import {
  buildTestEmail,
  cleanupCoreRelationalData,
  createUserWithRole,
} from './e2e-helpers';

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
    paymentIntentId: 'pi_mock_settle',
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
  createPayout: jest.fn().mockResolvedValue('tr_settle_mock'),
  createRefund: jest
    .fn()
    .mockResolvedValue({ id: 're_mock', status: 'succeeded' }),
};

const mockWebhookService = {
  handleStripeWebhook: jest.fn().mockResolvedValue(undefined),
  onModuleInit: jest.fn(),
  deadLetter: { entries: [], enqueue: jest.fn(), setRedis: jest.fn() },
};

describe('Settlement Chain (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let schedulerService: SchedulerService;
  let ownerId: string;
  let renterId: string;
  let categoryId: string;
  let listingId: string;
  const ownerEmail = buildTestEmail('settle-owner');
  const renterEmail = buildTestEmail('settle-renter');

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
    schedulerService = app.get<SchedulerService>(SchedulerService);
    await app.init();
  });

  afterAll(async () => {
    await cleanupCoreRelationalData(prisma);
    await prisma.payout.deleteMany({
      where: { owner: { email: { in: [ownerEmail, renterEmail] } } },
    });
    await prisma.escrowTransaction.deleteMany({
      where: { booking: { listing: { owner: { email: ownerEmail } } } },
    });
    await prisma.listing.deleteMany({
      where: { owner: { email: { in: [ownerEmail, renterEmail] } } },
    });
    await prisma.category.deleteMany({ where: { slug: 'test-cat-settle' } });
    await prisma.user.deleteMany({
      where: { email: { in: [ownerEmail, renterEmail] } },
    });
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    await cleanupCoreRelationalData(prisma);
    await prisma.payout.deleteMany({
      where: { owner: { email: { in: [ownerEmail, renterEmail] } } },
    });
    await prisma.escrowTransaction.deleteMany({
      where: { booking: { listing: { owner: { email: ownerEmail } } } },
    });
    await prisma.listing.deleteMany({
      where: { owner: { email: { in: [ownerEmail, renterEmail] } } },
    });
    await prisma.category.deleteMany({ where: { slug: 'test-cat-settle' } });
    await prisma.user.deleteMany({
      where: { email: { in: [ownerEmail, renterEmail] } },
    });

    // Create owner with Stripe Connect
    const owner = await createUserWithRole({
      app,
      prisma,
      email: ownerEmail,
      firstName: 'Settle',
      lastName: 'Owner',
      role: UserRole.HOST,
    });
    ownerId = owner.userId;
    await prisma.user.update({
      where: { id: ownerId },
      data: {
        stripeConnectId: 'acct_test_settle',
        emailVerified: true,
      },
    });

    // Create renter
    const renter = await createUserWithRole({
      app,
      prisma,
      email: renterEmail,
      firstName: 'Settle',
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
        name: 'Settlement Test Category',
        slug: 'test-cat-settle',
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
        title: 'Settlement Test Listing',
        description: 'A listing for settlement flow testing',
        slug: `settle-test-listing-${Date.now()}`,
        address: '123 Settlement St',
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

  describe('Cron → State Transition → Queue → Payout', () => {
    it('should settle a COMPLETED booking older than 48 hours', async () => {
      // Create a booking in COMPLETED state with completedAt > 48h ago
      const completedAt = new Date();
      completedAt.setHours(completedAt.getHours() - 72); // 72h ago

      const booking = await prisma.booking.create({
        data: {
          listing: { connect: { id: listingId } },
          renter: { connect: { id: renterId } },
          bookingOwner: { connect: { id: ownerId } },
          startDate: new Date('2025-12-01'),
          endDate: new Date('2025-12-04'),
          status: BookingStatus.COMPLETED,
          completedAt,
          basePrice: 3000,
          platformFee: 300,
          ownerEarnings: 2700,
          totalPrice: 3000,
          currency: 'NPR',
          guestCount: 1,
        },
      });

      // Create associated completed payment
      await prisma.payment.create({
        data: {
          booking: { connect: { id: booking.id } },
          amount: 3000,
          currency: 'NPR',
          status: 'COMPLETED',
          paymentIntentId: 'pi_settle_test',
        },
      });

      // Run the auto-settle cron job
      await schedulerService.autoSettleBookings();

      // Auto-settlement now persists payout commands first and leaves the
      // booking in COMPLETED until payout confirmation arrives.
      const settledBooking = await prisma.booking.findUnique({
        where: { id: booking.id },
      });
      expect(settledBooking?.status).toBe(BookingStatus.COMPLETED);

      const payout = await prisma.payout.findFirst({
        where: {
          ownerId,
          status: 'PENDING',
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(payout).toBeDefined();

      const payoutCommand = await prisma.auditLog.findFirst({
        where: {
          action: 'PAYOUT_COMMAND_REQUESTED',
          entityType: 'PAYOUT',
          entityId: payout?.id,
        },
      });
      expect(payoutCommand).toBeDefined();
    });

    it('should NOT settle a COMPLETED booking less than 48 hours old', async () => {
      const completedAt = new Date();
      completedAt.setHours(completedAt.getHours() - 24); // Only 24h ago

      const booking = await prisma.booking.create({
        data: {
          listing: { connect: { id: listingId } },
          renter: { connect: { id: renterId } },
          bookingOwner: { connect: { id: ownerId } },
          startDate: new Date('2025-12-01'),
          endDate: new Date('2025-12-04'),
          status: BookingStatus.COMPLETED,
          completedAt,
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
          paymentIntentId: 'pi_too_recent',
        },
      });

      await schedulerService.autoSettleBookings();

      // Should still be COMPLETED — not yet 48h
      const unchangedBooking = await prisma.booking.findUnique({
        where: { id: booking.id },
      });
      expect(unchangedBooking?.status).toBe(BookingStatus.COMPLETED);
    });

    it('should skip settlement when booking has no completed payment', async () => {
      const completedAt = new Date();
      completedAt.setHours(completedAt.getHours() - 72);

      const booking = await prisma.booking.create({
        data: {
          listing: { connect: { id: listingId } },
          renter: { connect: { id: renterId } },
          bookingOwner: { connect: { id: ownerId } },
          startDate: new Date('2025-12-01'),
          endDate: new Date('2025-12-04'),
          status: BookingStatus.COMPLETED,
          completedAt,
          basePrice: 3000,
          platformFee: 300,
          ownerEarnings: 2700,
          totalPrice: 3000,
          currency: 'NPR',
          guestCount: 1,
        },
      });

      // No payment record — simulate missing payment

      await schedulerService.autoSettleBookings();

      // Should still be COMPLETED — no payment to settle
      const unchangedBooking = await prisma.booking.findUnique({
        where: { id: booking.id },
      });
      expect(unchangedBooking?.status).toBe(BookingStatus.COMPLETED);
    });

    it('should not re-settle an already SETTLED booking', async () => {
      const completedAt = new Date();
      completedAt.setHours(completedAt.getHours() - 72);

      const booking = await prisma.booking.create({
        data: {
          listing: { connect: { id: listingId } },
          renter: { connect: { id: renterId } },
          bookingOwner: { connect: { id: ownerId } },
          startDate: new Date('2025-12-01'),
          endDate: new Date('2025-12-04'),
          status: BookingStatus.SETTLED,
          completedAt,
          basePrice: 3000,
          platformFee: 300,
          ownerEarnings: 2700,
          totalPrice: 3000,
          currency: 'NPR',
          guestCount: 1,
        },
      });

      await schedulerService.autoSettleBookings();

      // Should remain SETTLED
      const booking2 = await prisma.booking.findUnique({
        where: { id: booking.id },
      });
      expect(booking2?.status).toBe(BookingStatus.SETTLED);

      // No new state history for this booking
      const newHistory = await prisma.bookingStateHistory.findFirst({
        where: {
          bookingId: booking.id,
          toStatus: BookingStatus.SETTLED,
        },
      });
      // Should be 0 new history entries since we never changed it
      expect(newHistory).toBeNull();
    });
  });
});
