import { Test, TestingModule } from '@nestjs/testing';
import { PaymentCommandLogService } from './payment-command-log.service';
import { PrismaService } from '@/common/prisma/prisma.service';

describe('PaymentCommandLogService', () => {
  let service: PaymentCommandLogService;
  const prisma = {
    auditLog: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentCommandLogService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(PaymentCommandLogService);
    jest.clearAllMocks();
  });

  it('creates a payout command entry in the audit log', async () => {
    prisma.auditLog.create.mockResolvedValue({ id: 'cmd-1' });

    await service.createCommand({
      userId: 'owner-1',
      entityType: 'PAYOUT',
      entityId: 'payout-1',
      amount: 1200,
      currency: 'NPR',
      metadata: { bookingIds: ['b1'] },
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'owner-1',
        action: 'PAYOUT_COMMAND_REQUESTED',
        entityType: 'PAYOUT',
        entityId: 'payout-1',
      }),
    });
  });

  it('creates a deposit release command entry in the audit log', async () => {
    prisma.auditLog.create.mockResolvedValue({ id: 'cmd-2' });

    await service.createCommand({
      entityType: 'DEPOSIT_RELEASE',
      entityId: 'deposit-1',
      amount: 500,
      currency: 'NPR',
      metadata: { bookingId: 'booking-1' },
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'DEPOSIT_RELEASE_COMMAND_REQUESTED',
        entityType: 'DEPOSIT_RELEASE',
        entityId: 'deposit-1',
      }),
    });
  });

  it('merges metadata while updating command status', async () => {
    prisma.auditLog.findUnique.mockResolvedValue({
      newValues: JSON.stringify({
        status: 'ENQUEUED',
        metadata: { bookingIds: ['b1'] },
      }),
    });
    prisma.auditLog.update.mockResolvedValue({ id: 'cmd-1' });

    await service.markCompleted('cmd-1', { transferId: 'po_123' });

    expect(prisma.auditLog.update).toHaveBeenCalledWith({
      where: { id: 'cmd-1' },
      data: {
        newValues: expect.stringContaining('transferId'),
      },
    });
    const payload = JSON.parse(prisma.auditLog.update.mock.calls[0][0].data.newValues);
    expect(payload.status).toBe('COMPLETED');
    expect(payload.metadata).toEqual({ bookingIds: ['b1'], transferId: 'po_123' });
  });
});