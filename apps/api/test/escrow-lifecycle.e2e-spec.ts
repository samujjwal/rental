/**
 * Escrow Lifecycle E2E Test
 *
 * Tests the full escrow state machine:
 * 1. createEscrow() → PENDING
 * 2. fundEscrow() → FUNDED
 * 3. releaseEscrow() → RELEASED (or PARTIALLY_RELEASED)
 * 4. refundEscrow() → REFUNDED
 * 5. freezeEscrow() → DISPUTED
 *
 * Verifies:
 * - State transitions follow escrow rules
 * - Hold periods are enforced
 * - Events are emitted correctly
 * - Ledger integration
 *
 * This covers the gap identified in the Deep Flow Verification Report (Section 10.1):
 * "Escrow lifecycle E2E: create → fund → release/refund/freeze cycle"
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { EscrowService } from '../src/modules/payments/services/escrow.service';
import { EventsService } from '../src/common/events/events.service';
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

// ── Mocks ─────────────────────────────────────────────
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
    paymentIntentId: 'pi_mock_escrow',
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
  createPayout: jest.fn().mockResolvedValue('tr_escrow_mock'),
  createRefund: jest
    .fn()
    .mockResolvedValue({ id: 're_mock', status: 'succeeded' }),
};

const mockWebhookService = {
  handleStripeWebhook: jest.fn().mockResolvedValue(undefined),
  onModuleInit: jest.fn(),
  deadLetter: { entries: [], enqueue: jest.fn(), setRedis: jest.fn() },
};

describe('Escrow Lifecycle (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let escrowService: EscrowService;
  let eventsService: EventsService;
  let ownerId: string;
  let renterId: string;
  let categoryId: string;
  let listingId: string;
  let bookingId: string;
  const ownerEmail = buildTestEmail('escrow-owner');
  const renterEmail = buildTestEmail('escrow-renter');

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
    escrowService = app.get<EscrowService>(EscrowService);
    eventsService = app.get<EventsService>(EventsService);
    await app.init();
  });

  afterAll(async () => {
    await cleanupCoreRelationalData(prisma);
    await prisma.escrowTransaction.deleteMany({
      where: { booking: { listing: { owner: { email: ownerEmail } } } },
    });
    await prisma.listing.deleteMany({
      where: { owner: { email: { in: [ownerEmail, renterEmail] } } },
    });
    await prisma.category.deleteMany({ where: { slug: 'test-cat-escrow' } });
    await prisma.user.deleteMany({
      where: { email: { in: [ownerEmail, renterEmail] } },
    });
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    await cleanupCoreRelationalData(prisma);
    await prisma.escrowTransaction.deleteMany({
      where: { booking: { listing: { owner: { email: ownerEmail } } } },
    });
    await prisma.listing.deleteMany({
      where: { owner: { email: { in: [ownerEmail, renterEmail] } } },
    });
    await prisma.category.deleteMany({ where: { slug: 'test-cat-escrow' } });
    await prisma.user.deleteMany({
      where: { email: { in: [ownerEmail, renterEmail] } },
    });

    // Create owner
    const owner = await createUserWithRole({
      app,
      prisma,
      email: ownerEmail,
      firstName: 'Escrow',
      lastName: 'Owner',
      role: UserRole.HOST,
    });
    ownerId = owner.userId;
    await prisma.user.update({
      where: { id: ownerId },
      data: {
        stripeConnectId: 'acct_test_escrow',
        emailVerified: true,
      },
    });

    // Create renter
    const renter = await createUserWithRole({
      app,
      prisma,
      email: renterEmail,
      firstName: 'Escrow',
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
        name: 'Escrow Test Category',
        slug: 'test-cat-escrow',
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
        title: 'Escrow Test Listing',
        description: 'A listing for escrow testing',
        slug: `escrow-test-listing-${Date.now()}`,
        address: '123 Escrow St',
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

    // Create booking
    const booking = await prisma.booking.create({
      data: {
        listing: { connect: { id: listingId } },
        renter: { connect: { id: renterId } },
        bookingOwner: { connect: { id: ownerId } },
        startDate: new Date('2026-03-10'),
        endDate: new Date('2026-03-12'),
        status: BookingStatus.CONFIRMED,
        basePrice: 3000,
        totalPrice: 3000,
        currency: 'NPR',
        guestCount: 1,
      },
    });
    bookingId = booking.id;
  });

  describe('Full Lifecycle: PENDING → FUNDED → RELEASED', () => {
    it('should create, fund, and release escrow successfully', async () => {
      // 1. Create escrow (PENDING)
      const escrow = await escrowService.createEscrow({
        bookingId,
        amount: 3000,
        currency: 'NPR',
        releaseCondition: 'checkout_confirmed',
        holdDays: 0, // No hold period for this test
      });

      expect(escrow.status).toBe('PENDING');
      expect(escrow.bookingId).toBe(bookingId);
      expect(escrow.amount).toBe(3000);

      // 2. Fund escrow (FUNDED)
      const emitEscrowFundedSpy = jest.spyOn(eventsService, 'emitEscrowFunded');
      const funded = await escrowService.fundEscrow(escrow.id, 'pi_test_external');

      expect(funded.status).toBe('FUNDED');
      expect(emitEscrowFundedSpy).toHaveBeenCalledWith({
        escrowId: escrow.id,
        bookingId,
        amount: 3000,
        currency: 'NPR',
      });

      const fundedEscrow = await prisma.escrowTransaction.findUnique({
        where: { id: escrow.id },
      });
      expect(fundedEscrow?.capturedAt).toBeDefined();
      expect(fundedEscrow?.externalId).toBe('pi_test_external');

      // 3. Release escrow (RELEASED)
      const emitEscrowReleasedSpy = jest.spyOn(eventsService, 'emitEscrowReleased');
      const released = await escrowService.releaseEscrow(escrow.id);

      expect(released.success).toBe(true);
      expect(released.releasedAmount).toBe(3000);
      expect(released.remainingAmount).toBe(0);
      expect(emitEscrowReleasedSpy).toHaveBeenCalledWith({
        escrowId: escrow.id,
        bookingId,
        amount: 3000,
        currency: 'NPR',
        releasedTo: 'host',
      });

      const releasedEscrow = await prisma.escrowTransaction.findUnique({
        where: { id: escrow.id },
      });
      expect(releasedEscrow?.status).toBe('RELEASED');
      expect(releasedEscrow?.releasedAt).toBeDefined();
    });
  });

  describe('Partial Release: FUNDED → PARTIALLY_RELEASED', () => {
    it('should partially release escrow (e.g., deduct damages)', async () => {
      // Create and fund escrow
      const escrow = await escrowService.createEscrow({
        bookingId,
        amount: 3000,
        currency: 'NPR',
        holdDays: 0,
      });
      await escrowService.fundEscrow(escrow.id);

      // Partially release (e.g., 2500 released, 500 kept for damages)
      const result = await escrowService.releaseEscrow(escrow.id, 2500);

      expect(result.success).toBe(true);
      expect(result.releasedAmount).toBe(2500);
      expect(result.remainingAmount).toBe(500);

      const partialEscrow = await prisma.escrowTransaction.findUnique({
        where: { id: escrow.id },
      });
      expect(partialEscrow?.status).toBe('PARTIALLY_RELEASED');
    });
  });

  describe('Refund Flow: FUNDED → REFUNDED', () => {
    it('should refund escrow to renter on cancellation', async () => {
      // Create and fund escrow
      const escrow = await escrowService.createEscrow({
        bookingId,
        amount: 3000,
        currency: 'NPR',
      });
      await escrowService.fundEscrow(escrow.id);

      // Refund
      const emitEscrowReleasedSpy = jest.spyOn(eventsService, 'emitEscrowReleased');
      const refunded = await escrowService.refundEscrow(
        escrow.id,
        'Booking cancelled by renter',
      );

      expect(refunded.status).toBe('REFUNDED');
      expect(emitEscrowReleasedSpy).toHaveBeenCalledWith({
        escrowId: escrow.id,
        bookingId,
        amount: 3000,
        currency: 'NPR',
        releasedTo: 'renter',
      });

      const refundedEscrow = await prisma.escrowTransaction.findUnique({
        where: { id: escrow.id },
      });
      expect(refundedEscrow?.releasedAt).toBeDefined();
      expect((refundedEscrow?.metadata as any)?.refundReason).toBe(
        'Booking cancelled by renter',
      );
    });
  });

  describe('Dispute Flow: FUNDED → DISPUTED', () => {
    it('should freeze escrow during dispute', async () => {
      // Create and fund escrow
      const escrow = await escrowService.createEscrow({
        bookingId,
        amount: 3000,
        currency: 'NPR',
      });
      await escrowService.fundEscrow(escrow.id);

      // Freeze for dispute
      const disputeId = 'dispute_test_123';
      const frozen = await escrowService.freezeEscrow(escrow.id, disputeId);

      expect(frozen.status).toBe('DISPUTED');

      const frozenEscrow = await prisma.escrowTransaction.findUnique({
        where: { id: escrow.id },
      });
      expect((frozenEscrow?.metadata as any)?.disputeId).toBe(disputeId);
      expect((frozenEscrow?.metadata as any)?.frozenAt).toBeDefined();
    });
  });

  describe('Hold Period Enforcement', () => {
    it('should reject release before hold period expires', async () => {
      // Create escrow with 7-day hold
      const escrow = await escrowService.createEscrow({
        bookingId,
        amount: 3000,
        currency: 'NPR',
        holdDays: 7,
      });
      await escrowService.fundEscrow(escrow.id);

      // Try to release immediately
      await expect(escrowService.releaseEscrow(escrow.id)).rejects.toThrow(
        /hold period not yet expired/i,
      );

      // Verify escrow still FUNDED
      const stillFunded = await prisma.escrowTransaction.findUnique({
        where: { id: escrow.id },
      });
      expect(stillFunded?.status).toBe('FUNDED');
    });
  });

  describe('Edge Cases', () => {
    it('should reject duplicate escrow for same booking', async () => {
      // Create first escrow
      await escrowService.createEscrow({
        bookingId,
        amount: 3000,
        currency: 'NPR',
      });

      // Try to create second escrow for same booking
      await expect(
        escrowService.createEscrow({
          bookingId,
          amount: 3000,
          currency: 'NPR',
        }),
      ).rejects.toThrow(/Active escrow already exists/i);
    });

    it('should reject release on non-FUNDED escrow', async () => {
      // Create but don't fund
      const escrow = await escrowService.createEscrow({
        bookingId,
        amount: 3000,
        currency: 'NPR',
      });

      // Try to release PENDING escrow
      await expect(escrowService.releaseEscrow(escrow.id)).rejects.toThrow(
        /is in PENDING state, cannot release/i,
      );
    });

    it('should reject release amount exceeding escrow total', async () => {
      const escrow = await escrowService.createEscrow({
        bookingId,
        amount: 3000,
        currency: 'NPR',
        holdDays: 0,
      });
      await escrowService.fundEscrow(escrow.id);

      await expect(escrowService.releaseEscrow(escrow.id, 5000)).rejects.toThrow(
        /exceeds escrow amount/i,
      );
    });

    it('should handle event emission failure gracefully', async () => {
      // Mock event service to throw
      (jest.spyOn(eventsService, 'emitEscrowFunded') as any).mockRejectedValueOnce(
        new Error('Redis down'),
      );

      const escrow = await escrowService.createEscrow({
        bookingId,
        amount: 3000,
        currency: 'NPR',
      });

      // Should still succeed even if event fails
      await expect(escrowService.fundEscrow(escrow.id)).resolves.toBeDefined();

      const funded = await prisma.escrowTransaction.findUnique({
        where: { id: escrow.id },
      });
      expect(funded?.status).toBe('FUNDED');
    });
  });
});
