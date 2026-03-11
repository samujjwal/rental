import { Test, TestingModule } from '@nestjs/testing';
import { PayoutsService } from './payouts.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { StripeService } from './stripe.service';
import { LedgerService } from './ledger.service';
import { ConfigService } from '@nestjs/config';
import { PayoutStatus } from '@rental-portal/database';

describe('PayoutsService', () => {
  let service: PayoutsService;
  let prisma: PrismaService;
  let stripe: StripeService;
  let ledger: LedgerService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    booking: {
      aggregate: jest.fn(),
      findFirst: jest.fn(),
    },
    payout: {
      aggregate: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    userPreferences: {
      findUnique: jest.fn(),
    },
  };

  const mockStripeService = {
    createPayout: jest.fn(),
  };

  const mockLedgerService = {
    recordPayout: jest.fn(),
    recordPayoutWithBooking: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayoutsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: StripeService, useValue: mockStripeService },
        { provide: LedgerService, useValue: mockLedgerService },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(5000) } },
      ],
    }).compile();

    service = module.get<PayoutsService>(PayoutsService);
    prisma = module.get<PrismaService>(PrismaService);
    stripe = module.get<StripeService>(StripeService);
    ledger = module.get<LedgerService>(LedgerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  const ownerId = 'owner-1';

  describe('createPayout', () => {

    it('should create a payout successfully', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: ownerId,
        stripeConnectId: 'acct_123',
        stripeOnboardingComplete: true,
      });

      // Mock pending earnings
      mockPrismaService.booking.aggregate.mockResolvedValue({ _sum: { ownerEarnings: 200 } });
      mockPrismaService.payout.aggregate.mockResolvedValue({ _sum: { amount: 50 } }); // Net 150
      mockPrismaService.userPreferences.findUnique.mockResolvedValue(null); // Default NPR

      mockStripeService.createPayout.mockResolvedValue('tr_123');
      mockPrismaService.payout.create.mockResolvedValue({
        id: 'po_1',
        status: PayoutStatus.PENDING,
      });

      // Mock booking find
      mockPrismaService.booking.findFirst.mockResolvedValue({ id: 'b-last' });

      const result = await service.createPayout(ownerId, 100);

      expect(stripe.createPayout).toHaveBeenCalledWith('acct_123', 100, 'NPR');
      expect(prisma.payout.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: 100,
            transferId: 'tr_123',
          }),
        }),
      );
      expect(ledger.recordPayoutWithBooking).toHaveBeenCalledWith(
        'b-last',
        ownerId,
        100,
        'NPR',
        'po_1',
      );
      expect(result).toEqual({ payoutId: 'po_1', amount: 100, currency: 'NPR' });
    });

    it('should fail if owner not verified', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        stripeConnectId: 'acct_123',
        stripeOnboardingComplete: false, // Not verified
      });

      await expect(service.createPayout(ownerId)).rejects.toThrow('Owner account not verified');
    });

    it('should fail if insufficient funds', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        stripeConnectId: 'acct_123',
        stripeOnboardingComplete: true,
      });

      // 100 total - 90 paid = 10 available
      mockPrismaService.booking.aggregate.mockResolvedValue({ _sum: { ownerEarnings: 100 } });
      mockPrismaService.payout.aggregate.mockResolvedValue({ _sum: { amount: 90 } });
      mockPrismaService.userPreferences.findUnique.mockResolvedValue(null);

      await expect(service.createPayout(ownerId, 20)).rejects.toThrow('Insufficient funds');
    });
  });

  describe('getPendingEarnings', () => {
    it('should use user preferred currency from UserPreferences', async () => {
      mockPrismaService.booking.aggregate.mockResolvedValue({ _sum: { ownerEarnings: 500 } });
      mockPrismaService.payout.aggregate.mockResolvedValue({ _sum: { amount: 100 } });
      mockPrismaService.userPreferences.findUnique.mockResolvedValue({ currency: 'EUR' });

      const result = await service.getPendingEarnings(ownerId);

      expect(result.currency).toBe('EUR');
      expect(result.amount).toBe(400);
    });

    it('should fall back to NPR when no user preferences exist', async () => {
      mockPrismaService.booking.aggregate.mockResolvedValue({ _sum: { ownerEarnings: 200 } });
      mockPrismaService.payout.aggregate.mockResolvedValue({ _sum: { amount: 50 } });
      mockPrismaService.userPreferences.findUnique.mockResolvedValue(null);

      const result = await service.getPendingEarnings(ownerId);

      expect(result.currency).toBe('NPR');
      expect(result.amount).toBe(150);
    });

    it('should fall back to NPR when user has no currency preference', async () => {
      mockPrismaService.booking.aggregate.mockResolvedValue({ _sum: { ownerEarnings: 100 } });
      mockPrismaService.payout.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
      mockPrismaService.userPreferences.findUnique.mockResolvedValue({ currency: null });

      const result = await service.getPendingEarnings(ownerId);

      expect(result.currency).toBe('NPR');
    });

    it('should handle zero earnings', async () => {
      mockPrismaService.booking.aggregate.mockResolvedValue({ _sum: { ownerEarnings: null } });
      mockPrismaService.payout.aggregate.mockResolvedValue({ _sum: { amount: null } });
      mockPrismaService.userPreferences.findUnique.mockResolvedValue(null);

      const result = await service.getPendingEarnings(ownerId);

      expect(result.amount).toBe(0);
    });
  });
});
