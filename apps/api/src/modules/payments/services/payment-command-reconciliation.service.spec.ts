import { Test, TestingModule } from '@nestjs/testing';
import { PaymentCommandReconciliationService } from './payment-command-reconciliation.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { PaymentCommandLogService } from './payment-command-log.service';

describe('PaymentCommandReconciliationService', () => {
  let service: PaymentCommandReconciliationService;

  const prisma = {
    auditLog: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    payout: {
      findUnique: jest.fn(),
    },
    refund: {
      findUnique: jest.fn(),
    },
    depositHold: {
      findMany: jest.fn(),
    },
  };

  const paymentCommandLog = {
    parsePayload: jest.fn(),
    markCompleted: jest.fn().mockResolvedValue(undefined),
    markFailed: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentCommandReconciliationService,
        { provide: PrismaService, useValue: prisma },
        { provide: PaymentCommandLogService, useValue: paymentCommandLog },
      ],
    }).compile();

    service = module.get(PaymentCommandReconciliationService);
    jest.clearAllMocks();
  });

  it('marks payout commands complete when the payout has already completed', async () => {
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'cmd-1',
        entityType: 'PAYOUT',
        entityId: 'payout-1',
        createdAt: new Date(Date.now() - 60 * 60 * 1000),
      },
    ]);
    paymentCommandLog.parsePayload.mockReturnValue({ status: 'PROCESSING', requestedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() });
    prisma.payout.findUnique.mockResolvedValue({ status: 'COMPLETED', transferId: 'po_1' });

    await service.reconcileCommands();

    expect(paymentCommandLog.markCompleted).toHaveBeenCalledWith(
      'cmd-1',
      expect.objectContaining({ reconciled: true, transferId: 'po_1' }),
    );
  });

  it('raises an alert for stale deposit release commands with no hold record', async () => {
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'cmd-2',
        entityType: 'DEPOSIT_RELEASE',
        entityId: 'booking-1',
        createdAt: new Date(Date.now() - 60 * 60 * 1000),
      },
    ]);
    paymentCommandLog.parsePayload.mockReturnValue({
      status: 'PROCESSING',
      commandType: 'DEPOSIT_RELEASE',
      requestedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      metadata: { bookingId: 'booking-1' },
    });
    prisma.depositHold.findMany.mockResolvedValue([]);
    prisma.auditLog.findFirst.mockResolvedValue(null);

    await service.reconcileCommands();

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'PAYMENT_COMMAND_RECONCILIATION_ALERT',
        entityType: 'DEPOSIT_RELEASE',
        entityId: 'booking-1',
      }),
    });
  });
});