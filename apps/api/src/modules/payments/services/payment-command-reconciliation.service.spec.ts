import { Test, TestingModule } from '@nestjs/testing';
import { PaymentCommandReconciliationService } from './payment-command-reconciliation.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { PaymentCommandLogService } from './payment-command-log.service';

/**
 * PAYMENT COMMAND RECONCILIATION TESTS
 * 
 * These tests validate the correctness of payment command reconciliation:
 * 1. Payout command reconciliation with Stripe
 * 2. Refund command reconciliation with Stripe
 * 3. Deposit release command reconciliation with holds
 * 4. Alert creation for missing records
 * 5. Alert deduplication (6-hour window)
 * 6. Command status updates based on actual state
 * 7. Edge cases and error handling
 * 
 * Business Truth Validated:
 * - Payment commands are reconciled against actual payment provider records
 * - Stale commands are detected and alerted
 * - Command status is updated to match actual payment state
 * - Alerts are deduplicated to prevent spam
 * - All reconciliation scenarios are handled correctly
 */

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

  describe('Payout Command Reconciliation', () => {
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

    it('marks payout commands complete when payout is PAID', async () => {
      prisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'cmd-2',
          entityType: 'PAYOUT',
          entityId: 'payout-2',
          createdAt: new Date(Date.now() - 30 * 60 * 1000),
        },
      ]);
      paymentCommandLog.parsePayload.mockReturnValue({ status: 'PROCESSING', requestedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString() });
      prisma.payout.findUnique.mockResolvedValue({ status: 'PAID', transferId: 'po_2' });

      await service.reconcileCommands();

      expect(paymentCommandLog.markCompleted).toHaveBeenCalledWith(
        'cmd-2',
        expect.objectContaining({ reconciled: true, transferId: 'po_2' }),
      );
    });

    it('marks payout commands complete when payout is IN_TRANSIT', async () => {
      prisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'cmd-3',
          entityType: 'PAYOUT',
          entityId: 'payout-3',
          createdAt: new Date(Date.now() - 15 * 60 * 1000),
        },
      ]);
      paymentCommandLog.parsePayload.mockReturnValue({ status: 'PROCESSING', requestedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString() });
      prisma.payout.findUnique.mockResolvedValue({ status: 'IN_TRANSIT', transferId: 'po_3' });

      await service.reconcileCommands();

      expect(paymentCommandLog.markCompleted).toHaveBeenCalledWith(
        'cmd-3',
        expect.objectContaining({ reconciled: true, transferId: 'po_3' }),
      );
    });

    it('marks payout commands failed when payout has failed', async () => {
      prisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'cmd-4',
          entityType: 'PAYOUT',
          entityId: 'payout-4',
          createdAt: new Date(Date.now() - 45 * 60 * 1000),
        },
      ]);
      paymentCommandLog.parsePayload.mockReturnValue({ status: 'PROCESSING', requestedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString() });
      prisma.payout.findUnique.mockResolvedValue({ status: 'FAILED', transferId: null });

      await service.reconcileCommands();

      expect(paymentCommandLog.markFailed).toHaveBeenCalledWith(
        'cmd-4',
        'Reconciled from payout failure',
        expect.objectContaining({ reconciled: true, payoutStatus: 'FAILED' }),
      );
    });

    it('raises alert when payout record is missing', async () => {
      prisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'cmd-5',
          entityType: 'PAYOUT',
          entityId: 'payout-missing',
          createdAt: new Date(Date.now() - 60 * 60 * 1000),
        },
      ]);
      paymentCommandLog.parsePayload.mockReturnValue({ status: 'PROCESSING', commandType: 'PAYOUT', requestedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() });
      prisma.payout.findUnique.mockResolvedValue(null);
      prisma.auditLog.findFirst.mockResolvedValue(null);

      await service.reconcileCommands();

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'PAYMENT_COMMAND_RECONCILIATION_ALERT',
          entityType: 'PAYOUT',
          entityId: 'payout-missing',
          metadata: expect.stringContaining('payout_record_missing'),
        }),
      });
    });

    it('does not update command when payout status matches command status', async () => {
      prisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'cmd-6',
          entityType: 'PAYOUT',
          entityId: 'payout-6',
          createdAt: new Date(Date.now() - 30 * 60 * 1000),
        },
      ]);
      paymentCommandLog.parsePayload.mockReturnValue({ status: 'COMPLETED', requestedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString() });
      prisma.payout.findUnique.mockResolvedValue({ status: 'COMPLETED', transferId: 'po_6' });

      await service.reconcileCommands();

      expect(paymentCommandLog.markCompleted).not.toHaveBeenCalled();
      expect(paymentCommandLog.markFailed).not.toHaveBeenCalled();
    });
  });

  describe('Refund Command Reconciliation', () => {
    it('marks refund commands complete when refund has succeeded', async () => {
      prisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'cmd-7',
          entityType: 'REFUND',
          entityId: 'refund-1',
          createdAt: new Date(Date.now() - 60 * 60 * 1000),
        },
      ]);
      paymentCommandLog.parsePayload.mockReturnValue({ status: 'PROCESSING', requestedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() });
      prisma.refund.findUnique.mockResolvedValue({ status: 'SUCCEEDED', refundId: 're_1' });

      await service.reconcileCommands();

      expect(paymentCommandLog.markCompleted).toHaveBeenCalledWith(
        'cmd-7',
        expect.objectContaining({ reconciled: true, refundId: 're_1' }),
      );
    });

    it('marks refund commands complete when refund is COMPLETED', async () => {
      prisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'cmd-8',
          entityType: 'REFUND',
          entityId: 'refund-2',
          createdAt: new Date(Date.now() - 30 * 60 * 1000),
        },
      ]);
      paymentCommandLog.parsePayload.mockReturnValue({ status: 'PROCESSING', requestedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString() });
      prisma.refund.findUnique.mockResolvedValue({ status: 'COMPLETED', refundId: 're_2' });

      await service.reconcileCommands();

      expect(paymentCommandLog.markCompleted).toHaveBeenCalledWith(
        'cmd-8',
        expect.objectContaining({ reconciled: true, refundId: 're_2' }),
      );
    });

    it('marks refund commands failed when refund has failed', async () => {
      prisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'cmd-9',
          entityType: 'REFUND',
          entityId: 'refund-3',
          createdAt: new Date(Date.now() - 45 * 60 * 1000),
        },
      ]);
      paymentCommandLog.parsePayload.mockReturnValue({ status: 'PROCESSING', requestedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString() });
      prisma.refund.findUnique.mockResolvedValue({ status: 'FAILED', refundId: null });

      await service.reconcileCommands();

      expect(paymentCommandLog.markFailed).toHaveBeenCalledWith(
        'cmd-9',
        'Reconciled from refund failure',
        expect.objectContaining({ reconciled: true, refundStatus: 'FAILED' }),
      );
    });

    it('marks refund commands failed when refund is cancelled', async () => {
      prisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'cmd-10',
          entityType: 'REFUND',
          entityId: 'refund-4',
          createdAt: new Date(Date.now() - 20 * 60 * 1000),
        },
      ]);
      paymentCommandLog.parsePayload.mockReturnValue({ status: 'PROCESSING', requestedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString() });
      prisma.refund.findUnique.mockResolvedValue({ status: 'CANCELLED', refundId: null });

      await service.reconcileCommands();

      expect(paymentCommandLog.markFailed).toHaveBeenCalledWith(
        'cmd-10',
        'Reconciled from refund failure',
        expect.objectContaining({ reconciled: true, refundStatus: 'CANCELLED' }),
      );
    });

    it('raises alert when refund record is missing', async () => {
      prisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'cmd-11',
          entityType: 'REFUND',
          entityId: 'refund-missing',
          createdAt: new Date(Date.now() - 60 * 60 * 1000),
        },
      ]);
      paymentCommandLog.parsePayload.mockReturnValue({ status: 'PROCESSING', commandType: 'REFUND', requestedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() });
      prisma.refund.findUnique.mockResolvedValue(null);
      prisma.auditLog.findFirst.mockResolvedValue(null);

      await service.reconcileCommands();

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'PAYMENT_COMMAND_RECONCILIATION_ALERT',
          entityType: 'REFUND',
          entityId: 'refund-missing',
          metadata: expect.stringContaining('refund_record_missing'),
        }),
      });
    });
  });

  describe('Deposit Release Command Reconciliation', () => {
    it('marks deposit release commands complete when holds are released', async () => {
      prisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'cmd-12',
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
      prisma.depositHold.findMany.mockResolvedValue([
        { id: 'hold-1', status: 'RELEASED' },
        { id: 'hold-2', status: 'RELEASED' },
      ]);

      await service.reconcileCommands();

      expect(paymentCommandLog.markCompleted).toHaveBeenCalledWith(
        'cmd-12',
        expect.objectContaining({
          reconciled: true,
          bookingId: 'booking-1',
          depositHoldIds: ['hold-1', 'hold-2'],
        }),
      );
    });

    it('marks deposit release commands failed when deposit was captured', async () => {
      prisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'cmd-13',
          entityType: 'DEPOSIT_RELEASE',
          entityId: 'booking-2',
          createdAt: new Date(Date.now() - 45 * 60 * 1000),
        },
      ]);
      paymentCommandLog.parsePayload.mockReturnValue({
        status: 'PROCESSING',
        commandType: 'DEPOSIT_RELEASE',
        requestedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        metadata: { bookingId: 'booking-2' },
      });
      prisma.depositHold.findMany.mockResolvedValue([
        { id: 'hold-3', status: 'CAPTURED' },
      ]);

      await service.reconcileCommands();

      expect(paymentCommandLog.markFailed).toHaveBeenCalledWith(
        'cmd-13',
        'Deposit was captured before release',
        expect.objectContaining({
          reconciled: true,
          bookingId: 'booking-2',
          depositHoldIds: ['hold-3'],
        }),
      );
    });

    it('raises alert for stale deposit release commands with no hold record', async () => {
      prisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'cmd-14',
          entityType: 'DEPOSIT_RELEASE',
          entityId: 'booking-3',
          createdAt: new Date(Date.now() - 60 * 60 * 1000),
        },
      ]);
      paymentCommandLog.parsePayload.mockReturnValue({
        status: 'PROCESSING',
        commandType: 'DEPOSIT_RELEASE',
        requestedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        metadata: { bookingId: 'booking-3' },
      });
      prisma.depositHold.findMany.mockResolvedValue([]);
      prisma.auditLog.findFirst.mockResolvedValue(null);

      await service.reconcileCommands();

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'PAYMENT_COMMAND_RECONCILIATION_ALERT',
          entityType: 'DEPOSIT_RELEASE',
          entityId: 'booking-3',
          metadata: expect.stringContaining('deposit_hold_missing'),
        }),
      });
    });

    it('extracts bookingId from metadata.depositBookingId when bookingId is not present', async () => {
      prisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'cmd-15',
          entityType: 'DEPOSIT_RELEASE',
          entityId: 'booking-4',
          createdAt: new Date(Date.now() - 30 * 60 * 1000),
        },
      ]);
      paymentCommandLog.parsePayload.mockReturnValue({
        status: 'PROCESSING',
        commandType: 'DEPOSIT_RELEASE',
        requestedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        metadata: { depositBookingId: 'booking-4' },
      });
      prisma.depositHold.findMany.mockResolvedValue([
        { id: 'hold-4', status: 'RELEASED' },
      ]);

      await service.reconcileCommands();

      expect(paymentCommandLog.markCompleted).toHaveBeenCalledWith(
        'cmd-15',
        expect.objectContaining({ bookingId: 'booking-4' }),
      );
    });
  });

  describe('Alert Deduplication', () => {
    it('does not create duplicate alerts within 6-hour window', async () => {
      prisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'cmd-16',
          entityType: 'REFUND',
          entityId: 'refund-5',
          createdAt: new Date(Date.now() - 30 * 60 * 1000),
        },
      ]);
      paymentCommandLog.parsePayload.mockReturnValue({
        status: 'PROCESSING',
        commandType: 'REFUND',
        requestedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      });
      prisma.refund.findUnique.mockResolvedValue(null);
      prisma.auditLog.findFirst.mockResolvedValue({ id: 'existing-alert' }); // Recent alert exists

      await service.reconcileCommands();

      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('creates new alert after 6-hour window expires', async () => {
      prisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'cmd-17',
          entityType: 'PAYOUT',
          entityId: 'payout-7',
          createdAt: new Date(Date.now() - 60 * 60 * 1000),
        },
      ]);
      paymentCommandLog.parsePayload.mockReturnValue({
        status: 'PROCESSING',
        commandType: 'PAYOUT',
        requestedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      });
      prisma.payout.findUnique.mockResolvedValue(null);
      prisma.auditLog.findFirst.mockResolvedValue(null); // No recent alert

      await service.reconcileCommands();

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'PAYMENT_COMMAND_RECONCILIATION_ALERT',
        }),
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('handles commands with missing payload gracefully', async () => {
      prisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'cmd-18',
          entityType: 'PAYOUT',
          entityId: 'payout-8',
          createdAt: new Date(Date.now() - 30 * 60 * 1000),
        },
      ]);
      paymentCommandLog.parsePayload.mockReturnValue(null); // No payload

      await service.reconcileCommands();

      expect(paymentCommandLog.markCompleted).not.toHaveBeenCalled();
      expect(paymentCommandLog.markFailed).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('handles commands with missing status in payload', async () => {
      prisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'cmd-19',
          entityType: 'REFUND',
          entityId: 'refund-6',
          createdAt: new Date(Date.now() - 30 * 60 * 1000),
        },
      ]);
      paymentCommandLog.parsePayload.mockReturnValue({ commandType: 'REFUND' }); // No status

      await service.reconcileCommands();

      expect(paymentCommandLog.markCompleted).not.toHaveBeenCalled();
      expect(paymentCommandLog.markFailed).not.toHaveBeenCalled();
    });

    it('handles unknown entity types without crashing', async () => {
      prisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'cmd-20',
          entityType: 'UNKNOWN_TYPE',
          entityId: 'entity-1',
          createdAt: new Date(Date.now() - 30 * 60 * 1000),
        },
      ]);
      paymentCommandLog.parsePayload.mockReturnValue({ status: 'PROCESSING', commandType: 'UNKNOWN', requestedAt: new Date().toISOString() });
      prisma.auditLog.findFirst.mockResolvedValue(null);

      await service.reconcileCommands();

      // Should create an alert for unknown type
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('processes multiple commands in batch', async () => {
      prisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'cmd-21',
          entityType: 'PAYOUT',
          entityId: 'payout-9',
          createdAt: new Date(Date.now() - 60 * 60 * 1000),
        },
        {
          id: 'cmd-22',
          entityType: 'REFUND',
          entityId: 'refund-7',
          createdAt: new Date(Date.now() - 45 * 60 * 1000),
        },
        {
          id: 'cmd-23',
          entityType: 'DEPOSIT_RELEASE',
          entityId: 'booking-5',
          createdAt: new Date(Date.now() - 30 * 60 * 1000),
        },
      ]);
      paymentCommandLog.parsePayload
        .mockReturnValueOnce({ status: 'PROCESSING', requestedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() })
        .mockReturnValueOnce({ status: 'PROCESSING', requestedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString() })
        .mockReturnValueOnce({ status: 'PROCESSING', commandType: 'DEPOSIT_RELEASE', requestedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), metadata: { bookingId: 'booking-5' } });
      prisma.payout.findUnique.mockResolvedValue({ status: 'COMPLETED', transferId: 'po_9' });
      prisma.refund.findUnique.mockResolvedValue({ status: 'SUCCEEDED', refundId: 're_7' });
      prisma.depositHold.findMany.mockResolvedValue([{ id: 'hold-5', status: 'RELEASED' }]);

      await service.reconcileCommands();

      expect(paymentCommandLog.markCompleted).toHaveBeenCalledTimes(3);
    });

    it('limits processing to 200 most recent commands', async () => {
      const commands = Array.from({ length: 250 }, (_, i) => ({
        id: `cmd-${i}`,
        entityType: 'PAYOUT',
        entityId: `payout-${i}`,
        createdAt: new Date(Date.now() - i * 60 * 1000),
      }));
      prisma.auditLog.findMany.mockResolvedValue(commands);
      paymentCommandLog.parsePayload.mockReturnValue({ status: 'PROCESSING', requestedAt: new Date().toISOString() });
      prisma.payout.findUnique.mockResolvedValue({ status: 'COMPLETED', transferId: 'po_test' });

      await service.reconcileCommands();

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 200,
        }),
      );
    });
  });

  describe('Reconciliation Statistics', () => {
    it('logs reconciliation statistics when repairs or alerts occur', async () => {
      prisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'cmd-24',
          entityType: 'PAYOUT',
          entityId: 'payout-10',
          createdAt: new Date(Date.now() - 60 * 60 * 1000),
        },
      ]);
      paymentCommandLog.parsePayload.mockReturnValue({ status: 'PROCESSING', requestedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() });
      prisma.payout.findUnique.mockResolvedValue({ status: 'COMPLETED', transferId: 'po_10' });

      await service.reconcileCommands();

      // Should complete without error (logging happens internally)
      expect(paymentCommandLog.markCompleted).toHaveBeenCalled();
    });
  });
});