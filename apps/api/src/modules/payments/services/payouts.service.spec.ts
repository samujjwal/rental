import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { PayoutsService } from './payouts.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { PayoutStatus } from '@rental-portal/database';
import { PaymentCommandLogService } from './payment-command-log.service';

describe('PayoutsService', () => {
  let service: PayoutsService;
  let prisma: PrismaService;
  let queue: { add: jest.Mock };
  let paymentCommands: PaymentCommandLogService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    booking: {
      aggregate: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
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
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => {
        return callback(mockPrismaService);
      }),
  };

  const mockPaymentCommandLogService = {
    createCommand: jest.fn(),
    markEnqueued: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayoutsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(5000) } },
        { provide: PaymentCommandLogService, useValue: mockPaymentCommandLogService },
        { provide: getQueueToken('payments'), useValue: { add: jest.fn() } },
      ],
    }).compile();

    service = module.get<PayoutsService>(PayoutsService);
    prisma = module.get<PrismaService>(PrismaService);
    queue = module.get(getQueueToken('payments'));
    paymentCommands = module.get<PaymentCommandLogService>(PaymentCommandLogService);
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
      mockPrismaService.payout.create.mockResolvedValue({
        id: 'po_1',
        status: PayoutStatus.PENDING,
      });
      mockPrismaService.booking.findMany.mockResolvedValue([{ id: 'b-last' }]);
      mockPrismaService.auditLog.create.mockResolvedValue({ id: 'cmd-1' });
      mockPaymentCommandLogService.createCommand.mockResolvedValue({ id: 'cmd-1' });

      const result = await service.createPayout(ownerId, 100);

      // The service returns simplified payout info
      expect(result).toEqual(
        expect.objectContaining({
          amount: 100,
          status: PayoutStatus.PENDING,
        }),
      );
      // Payment command service is no longer used in this method
      expect(queue.add).toHaveBeenCalledWith(
        'process-payout',
        expect.objectContaining({ payoutId: 'po_1', ownerStripeConnectId: 'acct_123' }),
        expect.objectContaining({ jobId: 'payout:po_1' }),
      );
      expect(result).toEqual({ payoutId: 'po_1', amount: 100, currency: 'NPR', status: PayoutStatus.PENDING });
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
