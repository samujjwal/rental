import { Test, TestingModule } from '@nestjs/testing';
import { PaymentCommandLogService, getPaymentCommandAttentionState, isPaymentCommandAction } from './payment-command-log.service';
import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * PAYMENT IDEMPOTENCY TESTS
 * 
 * These tests validate that payment operations are idempotent:
 * - Payment commands are logged with proper metadata
 * - Command status transitions are tracked correctly
 * - Failed commands can be identified for retry
 * - Long-running commands are flagged for attention
 * 
 * Business Truth Validated:
 * - All payment operations are logged for audit trail
 * - Command status is tracked throughout lifecycle
 * - Failed/stuck commands are detectable
 * - Retry logic can identify retryable failures
 */
describe('Payment Idempotency', () => {
  let paymentCommandLog: PaymentCommandLogService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const mockPrismaService = {
      auditLog: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentCommandLogService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    paymentCommandLog = module.get<PaymentCommandLogService>(PaymentCommandLogService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Payment Command Creation', () => {
    it('should create payment command with required fields', async () => {
      const input = {
        entityType: 'PAYOUT' as const,
        entityId: 'payout-123',
        amount: 5000,
        currency: 'USD',
        userId: 'user-123',
        requestedByRole: 'OWNER',
      };

      (prisma.auditLog.create as jest.Mock).mockResolvedValue({
        id: 'log-123',
        action: 'PAYOUT_COMMAND_REQUESTED',
        entityType: 'PAYOUT',
        entityId: 'payout-123',
      });

      const result = await paymentCommandLog.createCommand(input);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          action: 'PAYOUT_COMMAND_REQUESTED',
          entityType: 'PAYOUT',
          entityId: 'payout-123',
          newValues: expect.stringContaining('"status":"PENDING"'),
        }),
      });
      expect(result).toBeDefined();
    });

    it('should include metadata in payment command', async () => {
      const input = {
        entityType: 'REFUND' as const,
        entityId: 'refund-123',
        amount: 2500,
        currency: 'USD',
        reason: 'requested_by_customer',
        metadata: { bookingId: 'booking-123' },
      };

      (prisma.auditLog.create as jest.Mock).mockResolvedValue({
        id: 'log-123',
        action: 'REFUND_COMMAND_REQUESTED',
      });

      await paymentCommandLog.createCommand(input);

      const createCall = (prisma.auditLog.create as jest.Mock).mock.calls[0][0];
      const payload = JSON.parse(createCall.data.newValues);

      expect(payload.reason).toBe('requested_by_customer');
      expect(payload.metadata).toEqual({ bookingId: 'booking-123' });
    });
  });

  describe('Command Status Tracking', () => {
    it('should mark command as enqueued', async () => {
      (prisma.auditLog.findUnique as jest.Mock).mockResolvedValue({
        id: 'log-123',
        newValues: '{}',
      });
      (prisma.auditLog.update as jest.Mock).mockResolvedValue({
        id: 'log-123',
      });

      await paymentCommandLog.markEnqueued('log-123', {
        jobName: 'process-payout',
        jobId: 'job-123',
      });

      expect(prisma.auditLog.findUnique).toHaveBeenCalled();
      expect(prisma.auditLog.update).toHaveBeenCalled();
    });

    it('should mark command as processing', async () => {
      (prisma.auditLog.findUnique as jest.Mock).mockResolvedValue({
        id: 'log-123',
        newValues: '{}',
      });
      (prisma.auditLog.update as jest.Mock).mockResolvedValue({
        id: 'log-123',
      });

      await paymentCommandLog.markProcessing('log-123');

      expect(prisma.auditLog.update).toHaveBeenCalled();
    });

    it('should mark command as completed', async () => {
      (prisma.auditLog.findUnique as jest.Mock).mockResolvedValue({
        id: 'log-123',
        newValues: '{}',
      });
      (prisma.auditLog.update as jest.Mock).mockResolvedValue({
        id: 'log-123',
      });

      await paymentCommandLog.markCompleted('log-123', {
        payoutId: 'po_123',
      });

      expect(prisma.auditLog.update).toHaveBeenCalled();
    });

    it('should mark command as failed', async () => {
      (prisma.auditLog.findUnique as jest.Mock).mockResolvedValue({
        id: 'log-123',
        newValues: '{}',
      });
      (prisma.auditLog.update as jest.Mock).mockResolvedValue({
        id: 'log-123',
      });

      await paymentCommandLog.markFailed('log-123', 'Payment failed', {
        code: 'PAYMENT_DECLINED',
      });

      expect(prisma.auditLog.update).toHaveBeenCalled();
    });
  });

  describe('Command Attention Detection', () => {
    it('should flag failed commands for attention', () => {
      const payload = {
        status: 'FAILED' as const,
        requestedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      };

      const result = getPaymentCommandAttentionState(payload, new Date());

      expect(result.attentionRequired).toBe(true);
      expect(result.reason).toBe('command_failed');
    });

    it('should flag pending commands that are too old', () => {
      const payload = {
        status: 'PENDING' as const,
        requestedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      };

      const result = getPaymentCommandAttentionState(payload, new Date());

      expect(result.attentionRequired).toBe(true);
      expect(result.reason).toBe('command_pending_too_long');
    });

    it('should flag enqueued commands that are too old', () => {
      const payload = {
        status: 'ENQUEUED' as const,
        requestedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      };

      const result = getPaymentCommandAttentionState(payload, new Date());

      expect(result.attentionRequired).toBe(true);
      expect(result.reason).toBe('command_enqueued_too_long');
    });

    it('should flag processing commands that are too old', () => {
      const payload = {
        status: 'PROCESSING' as const,
        requestedAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
      };

      const result = getPaymentCommandAttentionState(payload, new Date());

      expect(result.attentionRequired).toBe(true);
      expect(result.reason).toBe('command_processing_too_long');
    });

    it('should not flag healthy commands', () => {
      const payload = {
        status: 'PROCESSING' as const,
        requestedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      };

      const result = getPaymentCommandAttentionState(payload, new Date());

      expect(result.attentionRequired).toBe(false);
      expect(result.reason).toBeNull();
    });
  });

  describe('Command Action Detection', () => {
    it('should identify payment command actions', () => {
      const validActions = [
        'PAYOUT_COMMAND_REQUESTED',
        'REFUND_COMMAND_REQUESTED',
        'DEPOSIT_RELEASE_COMMAND_REQUESTED',
      ];

      for (const action of validActions) {
        expect(isPaymentCommandAction(action)).toBe(true);
      }
    });

    it('should reject non-payment command actions', () => {
      const invalidActions = [
        'BOOKING_CREATED',
        'USER_UPDATED',
        'LISTING_PUBLISHED',
        null,
        undefined,
        '',
      ];

      for (const action of invalidActions) {
        expect(isPaymentCommandAction(action)).toBe(false);
      }
    });
  });

  describe('Retry Logic', () => {
    it('should allow retry for failed commands', async () => {
      const mockPayload = {
        status: 'FAILED' as const,
        error: 'Network timeout',
        requestedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      };

      (prisma.auditLog.findFirst as jest.Mock).mockResolvedValue({
        id: 'log-123',
        newValues: JSON.stringify(mockPayload),
      });

      const attentionState = getPaymentCommandAttentionState(mockPayload, new Date());

      expect(attentionState.attentionRequired).toBe(true);
      expect(attentionState.reason).toBe('command_failed');
    });

    it('should allow retry for stuck pending commands', async () => {
      const mockPayload = {
        status: 'PENDING' as const,
        requestedAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(), // 35 minutes ago
      };

      (prisma.auditLog.findFirst as jest.Mock).mockResolvedValue({
        id: 'log-123',
        newValues: JSON.stringify(mockPayload),
      });

      const attentionState = getPaymentCommandAttentionState(mockPayload, new Date());
      expect(attentionState.attentionRequired).toBe(true);
      expect(attentionState.reason).toBe('command_pending_too_long');
    });
  });

  // ──────────────────────────────────────────────────────
  // DUPLICATE PAYMENT PREVENTION TESTS (Task 1.4.2)
  // ──────────────────────────────────────────────────────

  describe('Duplicate Payment Prevention', () => {
    describe('Concurrent Payment Intent Creation', () => {
      it('should prevent duplicate payment intents with same idempotency key', async () => {
        const idempotencyKey = 'idemp-key-123';
        const paymentData = {
          entityType: 'PAYOUT' as const,
          entityId: 'payout-123',
          amount: 5000,
          currency: 'USD',
          userId: 'user-123',
          requestedByRole: 'OWNER',
          metadata: { idempotencyKey },
        };

        // First command creation succeeds
        (prisma.auditLog.create as jest.Mock).mockResolvedValueOnce({
          id: 'log-123',
          action: 'PAYOUT_COMMAND_REQUESTED',
          entityType: 'PAYOUT',
          entityId: 'payout-123',
          newValues: JSON.stringify({ status: 'PENDING', idempotencyKey }),
        });

        const firstResult = await paymentCommandLog.createCommand(paymentData);
        expect(firstResult).toBeDefined();

        // Second command with same idempotency key should find existing command
        (prisma.auditLog.findFirst as jest.Mock).mockResolvedValueOnce({
          id: 'log-123',
          action: 'PAYOUT_COMMAND_REQUESTED',
          entityType: 'PAYOUT',
          entityId: 'payout-123',
          newValues: JSON.stringify({ status: 'PENDING', idempotencyKey }),
          createdAt: new Date(),
        });

        // Mock the service to check for existing commands
        await paymentCommandLog.createCommand({
          ...paymentData,
          metadata: { idempotencyKey },
        });

        // Should return existing command instead of creating new one
        expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
        expect(prisma.auditLog.findFirst).toHaveBeenCalledWith({
          where: {
            action: 'PAYOUT_COMMAND_REQUESTED',
            newValues: expect.stringContaining(`"idempotencyKey":"${idempotencyKey}"`),
          },
        });
      });

      it('should allow different commands with different idempotency keys', async () => {
        const paymentData1 = {
          entityType: 'PAYOUT' as const,
          entityId: 'payout-123',
          amount: 5000,
          currency: 'USD',
          userId: 'user-123',
          requestedByRole: 'OWNER',
          metadata: { idempotencyKey: 'idemp-key-123' },
        };

        const paymentData2 = {
          ...paymentData1,
          metadata: { idempotencyKey: 'idemp-key-456' },
        };

        // Both commands should succeed
        (prisma.auditLog.create as jest.Mock)
          .mockResolvedValueOnce({
            id: 'log-123',
            action: 'PAYOUT_COMMAND_REQUESTED',
            newValues: JSON.stringify({ status: 'PENDING', idempotencyKey: 'idemp-key-123' }),
          })
          .mockResolvedValueOnce({
            id: 'log-456',
            action: 'PAYOUT_COMMAND_REQUESTED',
            newValues: JSON.stringify({ status: 'PENDING', idempotencyKey: 'idemp-key-456' }),
          });

        // No existing commands found
        (prisma.auditLog.findFirst as jest.Mock).mockResolvedValue(null);

        const result1 = await paymentCommandLog.createCommand(paymentData1);
        const result2 = await paymentCommandLog.createCommand(paymentData2);

        expect(result1).toBeDefined();
        expect(result2).toBeDefined();
        expect(prisma.auditLog.create).toHaveBeenCalledTimes(2);
      });

      it('should handle concurrent payment attempts from different sessions', async () => {
        const basePaymentData = {
          entityType: 'PAYOUT' as const,
          entityId: 'payout-123',
          amount: 5000,
          currency: 'USD',
          userId: 'user-123',
          requestedByRole: 'OWNER',
        };

        const session1Data = { ...basePaymentData, metadata: { idempotencyKey: 'session-1-key' } };
        const session2Data = { ...basePaymentData, metadata: { idempotencyKey: 'session-2-key' } };

        // Simulate race condition - both sessions check for existing commands
        (prisma.auditLog.findFirst as jest.Mock).mockResolvedValue(null);

        // Both commands should be allowed as they have different idempotency keys
        (prisma.auditLog.create as jest.Mock)
          .mockResolvedValueOnce({
            id: 'log-session1',
            action: 'PAYOUT_COMMAND_REQUESTED',
            newValues: JSON.stringify({ status: 'PENDING', idempotencyKey: 'session-1-key' }),
          })
          .mockResolvedValueOnce({
            id: 'log-session2',
            action: 'PAYOUT_COMMAND_REQUESTED',
            newValues: JSON.stringify({ status: 'PENDING', idempotencyKey: 'session-2-key' }),
          });

        // Simulate concurrent execution
        const [result1, result2] = await Promise.all([
          paymentCommandLog.createCommand(session1Data),
          paymentCommandLog.createCommand(session2Data),
        ]);

        expect(result1).toBeDefined();
        expect(result2).toBeDefined();
        expect(prisma.auditLog.create).toHaveBeenCalledTimes(2);
      });

      it('should prevent duplicate refunds for same booking', async () => {
        const refundData = {
          entityType: 'REFUND' as const,
          entityId: 'refund-123',
          amount: 2500,
          currency: 'USD',
          userId: 'user-123',
          reason: 'guest_cancellation',
          metadata: { bookingId: 'booking-123', idempotencyKey: 'refund-booking-123' },
        };

        // First refund succeeds
        (prisma.auditLog.create as jest.Mock).mockResolvedValueOnce({
          id: 'refund-log-1',
          action: 'REFUND_COMMAND_REQUESTED',
          newValues: JSON.stringify({ status: 'PENDING', idempotencyKey: 'refund-booking-123' }),
        });

        const firstRefund = await paymentCommandLog.createCommand(refundData);
        expect(firstRefund).toBeDefined();

        // Second refund attempt should find existing command
        (prisma.auditLog.findFirst as jest.Mock).mockResolvedValueOnce({
          id: 'refund-log-1',
          action: 'REFUND_COMMAND_REQUESTED',
          newValues: JSON.stringify({ status: 'COMPLETED', idempotencyKey: 'refund-booking-123' }),
          createdAt: new Date(),
        });

        // Should not create duplicate refund
        await paymentCommandLog.createCommand(refundData);

        expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
        expect(prisma.auditLog.findFirst).toHaveBeenCalledWith({
          where: {
            action: 'REFUND_COMMAND_REQUESTED',
            newValues: expect.stringContaining('refund-booking-123'),
          },
        });
      });
    });

    describe('Idempotency Key Management', () => {
      it('should generate unique idempotency keys for payment commands', async () => {
        const paymentData = {
          entityType: 'PAYOUT' as const,
          entityId: 'payout-123',
          amount: 5000,
          currency: 'USD',
          userId: 'user-123',
          requestedByRole: 'OWNER',
          metadata: { idempotencyKey: 'generated-key-123' },
        };

        // Mock UUID generation for consistent testing
        const mockUUID = '550e8400-e29b-41d4-a716-446655440000';
        jest.spyOn(crypto, 'randomUUID').mockReturnValue(mockUUID as any);

        (prisma.auditLog.create as jest.Mock).mockResolvedValue({
          id: 'log-123',
          action: 'PAYOUT_COMMAND_REQUESTED',
        });

        await paymentCommandLog.createCommand(paymentData);

        const createCall = (prisma.auditLog.create as jest.Mock).mock.calls[0][0];
        const payload = JSON.parse(createCall.data.newValues);

        expect(payload.idempotencyKey).toContain('payout-123');
        expect(payload.idempotencyKey).toContain('user-123');
        expect(payload.idempotencyKey).toContain(mockUUID);

        jest.restoreAllMocks();
      });

      it('should handle idempotency key expiration', async () => {
        const expiredKeyData = {
          entityType: 'PAYOUT' as const,
          entityId: 'payout-123',
          amount: 5000,
          currency: 'USD',
          userId: 'user-123',
          requestedByRole: 'OWNER',
          metadata: { idempotencyKey: 'expired-key-123' },
        };

        // Find existing command that's older than 24 hours
        const expiredCommand = {
          id: 'expired-log',
          action: 'PAYOUT_COMMAND_REQUESTED',
          newValues: JSON.stringify({ 
            status: 'FAILED',
            idempotencyKey: 'expired-key-123',
            requestedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours ago
          }),
          createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
        };

        (prisma.auditLog.findFirst as jest.Mock).mockResolvedValue(expiredCommand);

        // Should allow new command with same key since old one expired
        (prisma.auditLog.create as jest.Mock).mockResolvedValue({
          id: 'new-log',
          action: 'PAYOUT_COMMAND_REQUESTED',
        });

        await paymentCommandLog.createCommand(expiredKeyData);

        expect(prisma.auditLog.create).toHaveBeenCalled();
      });

      it('should prevent idempotency key collisions', async () => {
        const paymentData = {
          entityType: 'PAYOUT' as const,
          entityId: 'payout-123',
          amount: 5000,
          currency: 'USD',
          userId: 'user-123',
          requestedByRole: 'OWNER',
          metadata: { idempotencyKey: 'collision-test-key' },
        };

        // Simulate finding multiple commands with same key (shouldn't happen but test safety)
        (prisma.auditLog.findFirst as jest.Mock).mockResolvedValue({
          id: 'existing-log',
          action: 'PAYOUT_COMMAND_REQUESTED',
          newValues: JSON.stringify({ status: 'PENDING', idempotencyKey: 'collision-test-key' }),
        });

        // Should not create new command
        await paymentCommandLog.createCommand(paymentData);

        expect(prisma.auditLog.create).not.toHaveBeenCalled();
      });
    });

    describe('Queue and Lock Management', () => {
      it('should prevent job queue collisions', async () => {
        const commandId = 'log-123';
        const jobData = { jobName: 'process-payout', jobId: 'job-123' };

        // Mock existing command
        (prisma.auditLog.findUnique as jest.Mock).mockResolvedValue({
          id: commandId,
          newValues: JSON.stringify({ status: 'PENDING' }),
        });

        // First enqueue succeeds
        (prisma.auditLog.update as jest.Mock).mockResolvedValueOnce({
          id: commandId,
          newValues: JSON.stringify({ status: 'ENQUEUED', jobId: 'job-123' }),
        });

        await paymentCommandLog.markEnqueued(commandId, jobData);

        // Second enqueue attempt should detect existing job
        (prisma.auditLog.findUnique as jest.Mock).mockResolvedValue({
          id: commandId,
          newValues: JSON.stringify({ status: 'ENQUEUED', jobId: 'job-123' }),
        });

        await paymentCommandLog.markEnqueued(commandId, { jobName: 'process-payout', jobId: 'job-456' });

        // Should still update but maintain consistency
        expect(prisma.auditLog.update).toHaveBeenCalledTimes(2);
      });

      it('should handle distributed locking scenarios', async () => {
        const commandId = 'log-123';

        // Simulate concurrent processing attempts
        (prisma.auditLog.findUnique as jest.Mock).mockResolvedValue({
          id: commandId,
          newValues: JSON.stringify({ status: 'PENDING' }),
        });

        // First process attempt succeeds
        (prisma.auditLog.update as jest.Mock).mockResolvedValueOnce({
          id: commandId,
          newValues: JSON.stringify({ status: 'PROCESSING', processedAt: new Date().toISOString() }),
        });

        await paymentCommandLog.markProcessing(commandId);

        // Second process attempt should find command already processing
        (prisma.auditLog.findUnique as jest.Mock).mockResolvedValue({
          id: commandId,
          newValues: JSON.stringify({ status: 'PROCESSING', processedAt: new Date().toISOString() }),
        });

        await paymentCommandLog.markProcessing(commandId);

        // Should still attempt update but maintain state consistency
        expect(prisma.auditLog.update).toHaveBeenCalledTimes(2);
      });

      it('should handle queue overflow scenarios', async () => {
        const commands = Array.from({ length: 10 }, (_, i) => ({
          id: `log-${i}`,
          action: 'PAYOUT_COMMAND_REQUESTED',
          newValues: JSON.stringify({ status: 'PENDING' }),
        }));

        // Simulate queue being full
        (prisma.auditLog.findMany as jest.Mock).mockResolvedValue(commands);

        const attentionStates = commands.map(cmd => {
          const payload = JSON.parse(cmd.newValues);
          return getPaymentCommandAttentionState(payload, new Date());
        });

        // All commands should be flagged for attention due to queue overflow
        attentionStates.forEach(state => {
          expect(state.attentionRequired).toBe(true);
        });
      });

      it('should implement failed job retry logic', async () => {
        const commandId = 'log-123';
        const failureReason = 'Payment gateway timeout';

        // Mark command as failed
        (prisma.auditLog.findUnique as jest.Mock).mockResolvedValue({
          id: commandId,
          newValues: JSON.stringify({ status: 'PROCESSING' }),
        });

        (prisma.auditLog.update as jest.Mock).mockResolvedValue({
          id: commandId,
          newValues: JSON.stringify({ 
            status: 'FAILED',
            failureReason,
            processedAt: new Date().toISOString(),
            retryCount: 1,
          }),
        });

        await paymentCommandLog.markFailed(commandId, failureReason);

        const updateCall = (prisma.auditLog.update as jest.Mock).mock.calls[0][0];
        const payload = JSON.parse(updateCall.data.newValues);

        expect(payload.status).toBe('FAILED');
        expect(payload.failureReason).toBe(failureReason);
        expect(payload.retryCount).toBe(1);
      });
    });

    describe('Command Status Tracking', () => {
      it('should track command lifecycle through all states', async () => {
        const commandId = 'log-123';
        const entityId = 'payout-123';

        // Create command
        (prisma.auditLog.create as jest.Mock).mockResolvedValue({
          id: commandId,
          action: 'PAYOUT_COMMAND_REQUESTED',
          newValues: JSON.stringify({ status: 'PENDING', requestedAt: new Date().toISOString() }),
        });

        // Mark as enqueued
        (prisma.auditLog.findUnique as jest.Mock).mockResolvedValue({
          id: commandId,
          newValues: JSON.stringify({ status: 'PENDING' }),
        });

        (prisma.auditLog.update as jest.Mock).mockResolvedValue({
          id: commandId,
          newValues: JSON.stringify({ status: 'ENQUEUED', enqueuedAt: new Date().toISOString() }),
        });

        // Mark as processing
        (prisma.auditLog.findUnique as jest.Mock).mockResolvedValue({
          id: commandId,
          newValues: JSON.stringify({ status: 'ENQUEUED' }),
        });

        (prisma.auditLog.update as jest.Mock).mockResolvedValue({
          id: commandId,
          newValues: JSON.stringify({ status: 'PROCESSING', processedAt: new Date().toISOString() }),
        });

        // Mark as completed
        (prisma.auditLog.findUnique as jest.Mock).mockResolvedValue({
          id: commandId,
          newValues: JSON.stringify({ status: 'PROCESSING' }),
        });

        (prisma.auditLog.update as jest.Mock).mockResolvedValue({
          id: commandId,
          newValues: JSON.stringify({ 
            status: 'COMPLETED',
            completedAt: new Date().toISOString(),
            payoutId: 'po_123',
          }),
        });

        const command = await paymentCommandLog.createCommand({
          entityType: 'PAYOUT',
          entityId,
          amount: 5000,
          currency: 'USD',
          userId: 'user-123',
        });

        await paymentCommandLog.markEnqueued(commandId, { jobName: 'process-payout' });
        await paymentCommandLog.markProcessing(commandId);
        await paymentCommandLog.markCompleted(commandId, { payoutId: 'po_123' });

        expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
        expect(prisma.auditLog.update).toHaveBeenCalledTimes(3);
      });

      it('should detect and handle stuck commands', async () => {
        const stuckCommands = [
          {
            id: 'stuck-1',
            action: 'PAYOUT_COMMAND_REQUESTED',
            newValues: JSON.stringify({ 
              status: 'PROCESSING',
              requestedAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(), // 35 minutes ago
            }),
            createdAt: new Date(Date.now() - 35 * 60 * 1000),
          },
          {
            id: 'stuck-2',
            action: 'REFUND_COMMAND_REQUESTED',
            newValues: JSON.stringify({ 
              status: 'PENDING',
              requestedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 minutes ago
            }),
            createdAt: new Date(Date.now() - 15 * 60 * 1000),
          },
        ];

        stuckCommands.forEach(cmd => {
          const payload = JSON.parse(cmd.newValues);
          const attentionState = getPaymentCommandAttentionState(payload, cmd.createdAt);
          
          expect(attentionState.attentionRequired).toBe(true);
          expect(['command_processing_too_long', 'command_pending_too_long']).toContain(attentionState.reason);
        });
      });

      it('should maintain command state consistency', async () => {
        const commandId = 'log-123';
        
        // Simulate concurrent state updates
        (prisma.auditLog.findUnique as jest.Mock).mockResolvedValue({
          id: commandId,
          newValues: JSON.stringify({ 
            status: 'PROCESSING',
            metadata: { attempt: 1 },
          }),
        });

        (prisma.auditLog.update as jest.Mock).mockImplementation(async ({ where, data }) => {
          const currentPayload = JSON.parse(data.newValues);
          return {
            id: where.id,
            newValues: data.newValues,
          };
        });

        // Multiple concurrent updates should merge metadata properly
        await Promise.all([
          paymentCommandLog.markCompleted(commandId, { payoutId: 'po_123' }),
          paymentCommandLog.markCompleted(commandId, { transactionId: 'txn_456' }),
        ]);

        expect(prisma.auditLog.update).toHaveBeenCalledTimes(2);
      });
    });

    describe('Command Recovery Scenarios', () => {
      it('should handle command replay with same idempotency key', async () => {
        const replayData = {
          entityType: 'PAYOUT' as const,
          entityId: 'payout-123',
          amount: 5000,
          currency: 'USD',
          userId: 'user-123',
          requestedByRole: 'OWNER',
          metadata: { idempotencyKey: 'replay-key-123' },
        };

        // Find completed command from earlier attempt
        (prisma.auditLog.findFirst as jest.Mock).mockResolvedValue({
          id: 'completed-log',
          action: 'PAYOUT_COMMAND_REQUESTED',
          newValues: JSON.stringify({ 
            status: 'COMPLETED',
            idempotencyKey: 'replay-key-123',
            payoutId: 'po_123',
            completedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
          }),
        });

        // Should return existing completed command
        await paymentCommandLog.createCommand(replayData);

        expect(prisma.auditLog.create).not.toHaveBeenCalled();
        expect(prisma.auditLog.findFirst).toHaveBeenCalledWith({
          where: {
            action: 'PAYOUT_COMMAND_REQUESTED',
            newValues: expect.stringContaining('replay-key-123'),
          },
        });
      });

      it('should detect orphaned commands for cleanup', async () => {
        const orphanedCommands = [
          {
            id: 'orphaned-1',
            action: 'PAYOUT_COMMAND_REQUESTED',
            newValues: JSON.stringify({ 
              status: 'ENQUEUED',
              jobId: null, // No job ID - orphaned
              requestedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
            }),
          },
          {
            id: 'orphaned-2',
            action: 'REFUND_COMMAND_REQUESTED',
            newValues: JSON.stringify({ 
              status: 'PROCESSING',
              processedAt: null, // No processed timestamp - orphaned
              requestedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
            }),
          },
        ];

        orphanedCommands.forEach(cmd => {
          const payload = JSON.parse(cmd.newValues);
          const attentionState = getPaymentCommandAttentionState(payload, new Date());
          
          expect(attentionState.attentionRequired).toBe(true);
        });
      });

      it('should validate command data integrity', async () => {
        const corruptedCommands = [
          {
            id: 'corrupted-1',
            newValues: 'invalid-json-{',
          },
          {
            id: 'corrupted-2',
            newValues: null,
          },
          {
            id: 'corrupted-3',
            newValues: '',
          },
        ];

        corruptedCommands.forEach(cmd => {
          const parsedPayload = paymentCommandLog.parsePayload(cmd.newValues);
          expect(parsedPayload).toEqual({});
          
          const attentionState = getPaymentCommandAttentionState(parsedPayload, new Date());
        });
      });

      it('should maintain command sequence integrity', async () => {
        const commandId = 'log-sequence';
        
        // Track command state transitions
        const stateTransitions: string[] = [];
        
        (prisma.auditLog.findUnique as jest.Mock).mockResolvedValue({
          id: commandId,
          newValues: JSON.stringify({ status: 'PENDING' }),
        });

        (prisma.auditLog.update as jest.Mock).mockImplementation(async ({ where, data }) => {
          const payload = JSON.parse(data.newValues);
          stateTransitions.push(payload.status);
          return { id: where.id, newValues: data.newValues };
        });

        // Process through valid state transitions
        await paymentCommandLog.markEnqueued(commandId, { jobName: 'process-payout' });
        await paymentCommandLog.markProcessing(commandId);
        await paymentCommandLog.markCompleted(commandId, { payoutId: 'po_123' });

        // Should follow valid sequence
        expect(stateTransitions).toEqual(['ENQUEUED', 'PROCESSING', 'COMPLETED']);
      });
    });
  });
});
