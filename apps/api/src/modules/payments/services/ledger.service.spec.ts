import { Test, TestingModule } from '@nestjs/testing';
import { LedgerService, TransactionType, AccountType } from './ledger.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { LedgerSide, LedgerEntryStatus } from '@rental-portal/database';

describe('LedgerService', () => {
  let service: LedgerService;
  let prisma: PrismaService;

  const mockPrismaService: any = {};
  mockPrismaService.ledgerEntry = {
    createMany: jest.fn(),
    findMany: jest.fn(),
  };
  mockPrismaService.booking = {
    findMany: jest.fn(),
  };
  mockPrismaService.$transaction = jest.fn((callback) => callback(mockPrismaService));

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LedgerService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get<LedgerService>(LedgerService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordBookingPayment', () => {
    const bookingId = 'booking-1';
    const renterId = 'renter-1';
    const ownerId = 'owner-1';
    const amounts = {
      total: 100,
      subtotal: 90,
      platformFee: 10,
      serviceFee: 5,
      currency: 'USD',
    };

    it('should create ledger entries for payment', async () => {
      await service.recordBookingPayment(bookingId, renterId, ownerId, amounts);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.ledgerEntry.createMany).toHaveBeenCalledTimes(4); // 4 batches

      // Check first batch (Payment)
      expect(prisma.ledgerEntry.createMany).toHaveBeenNthCalledWith(1, {
        data: expect.arrayContaining([
          expect.objectContaining({
            bookingId,
            accountType: AccountType.CASH,
            transactionType: TransactionType.PAYMENT,
            side: LedgerSide.DEBIT,
            amount: amounts.total,
          }),
          expect.objectContaining({
            bookingId,
            accountType: AccountType.LIABILITY,
            transactionType: TransactionType.PAYMENT,
            side: LedgerSide.CREDIT,
            amount: amounts.total,
          }),
        ]),
      });
    });
  });

  describe('recordPayoutWithBooking', () => {
    it('should record payout entries', async () => {
      await service.recordPayoutWithBooking('b1', 'o1', 50, 'USD', 'po1');

      expect(prisma.ledgerEntry.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            transactionType: TransactionType.PAYOUT,
            side: LedgerSide.DEBIT, // Receivable
            amount: 50,
          }),
          expect.objectContaining({
            transactionType: TransactionType.PAYOUT,
            side: LedgerSide.CREDIT, // Cash
            amount: 50,
          }),
        ]),
      });
    });
  });

  describe('getUserBalance', () => {
    it('should calculate balance for owner correctly', async () => {
      const userId = 'owner-1';
      const currency = 'USD';

      // Mock bookings find
      mockPrismaService.booking.findMany.mockResolvedValue([{ id: 'b1' }, { id: 'b2' }]);

      // Mock entries
      mockPrismaService.ledgerEntry.findMany.mockResolvedValue([
        { side: LedgerSide.CREDIT, amount: 100 }, // Earning
        { side: LedgerSide.DEBIT, amount: 20 }, // Payout
      ]);

      const balance = await service.getUserBalance(userId, currency);
      expect(prisma.booking.findMany).toHaveBeenCalledWith({
        where: { owner: { id: userId } },
        select: { id: true },
      });
      expect(balance).toBe(80); // 100 - 20
    });

    it('should return 0 if no bookings', async () => {
      mockPrismaService.booking.findMany.mockResolvedValue([]);
      const balance = await service.getUserBalance('u1');
      expect(balance).toBe(0);
      expect(prisma.ledgerEntry.findMany).not.toHaveBeenCalled();
    });
  });
});
