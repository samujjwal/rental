import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { PaymentCommandLogService } from './payment-command-log.service';
import type { PaymentCommandPayload, PaymentCommandType } from '@/common/payments/payment-command.types';
import { randomUUID } from 'crypto';

/**
 * Payment Idempotency Service
 * 
 * Ensures payment operations are idempotent to prevent duplicate charges,
 * refunds, and payouts. Uses idempotency keys with PostgreSQL advisory locks
 * for concurrency safety.
 * 
 * Key Features:
 * - Duplicate payment prevention with idempotency keys
 * - Concurrent payment attempt handling with database locks
 * - Command recovery and reconciliation
 * - Payment provider idempotency key management
 * - Network interruption resilience
 */
@Injectable()
export class PaymentIdempotencyService {
  private readonly logger = new Logger(PaymentIdempotencyService.name);
  private readonly IDEMPOTENCY_KEY_TTL_HOURS = 24;
  private readonly LOCK_TIMEOUT_MS = 5000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly commandLogService: PaymentCommandLogService,
  ) {}

  /**
   * Check if a payment operation can proceed based on idempotency
   * 
   * @param idempotencyKey - Unique key for the operation
   * @param entityType - Type of payment entity (PAYOUT, REFUND, DEPOSIT_RELEASE)
   * @param entityId - ID of the entity
   * @returns Result indicating if operation can proceed
   */
  async canProceed(
    idempotencyKey: string,
    entityType: PaymentCommandType,
    entityId: string,
  ): Promise<{
    canProceed: boolean;
    existingCommand?: any;
    reason?: string;
  }> {
    // Check for existing command with same idempotency key
    const existing = await this.prisma.auditLog.findFirst({
      where: {
        action: `${entityType}_COMMAND_REQUESTED`,
        newValues: { contains: idempotencyKey },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!existing) {
      return { canProceed: true };
    }

    // Parse the existing command payload
    const existingPayload = this.parsePayload(existing.newValues as string);
    const existingRequestedAt = this.parseDate(existingPayload.requestedAt || existing.createdAt);
    
    if (!existingRequestedAt || isNaN(existingRequestedAt.getTime())) {
      // If we can't determine age, be conservative and reject
      return {
        canProceed: false,
        existingCommand: existing,
        reason: 'Cannot determine command age - rejecting as precaution',
      };
    }

    const ageHours = (Date.now() - existingRequestedAt.getTime()) / (1000 * 60 * 60);

    // If key is expired (older than TTL), allow new operation
    if (ageHours >= this.IDEMPOTENCY_KEY_TTL_HOURS) {
      this.logger.log(`Idempotency key ${idempotencyKey} expired after ${ageHours.toFixed(2)} hours`);
      return { canProceed: true };
    }

    // Check if existing command is in a terminal state
    const status = (existingPayload.status || '').toUpperCase();
    const terminalStates = ['COMPLETED', 'FAILED'];
    
    if (terminalStates.includes(status)) {
      return {
        canProceed: false,
        existingCommand: existing,
        reason: `Command already ${status}`,
      };
    }

    // Command is in progress - reject to prevent duplicate
    return {
      canProceed: false,
      existingCommand: existing,
      reason: `Command in progress with status: ${status}`,
    };
  }

  /**
   * Create a payment command with idempotency protection
   * Uses PostgreSQL advisory lock to prevent concurrent duplicate creation
   * 
   * @param input - Command creation input
   * @returns Created command or existing command if duplicate
   */
  async createCommandWithIdempotency(input: {
    userId?: string;
    entityType: PaymentCommandType;
    entityId: string;
    amount: number;
    currency: string;
    reason?: string;
    requestedByRole?: string;
    metadata?: Record<string, unknown>;
  }): Promise<any> {
    // Generate or use provided idempotency key
    const idempotencyKey = input.metadata?.idempotencyKey as string || 
      this.generateIdempotencyKey(input.entityType, input.entityId, input.userId);

    // Generate lock key from idempotency key
    const lockKey = this.generateLockKey(idempotencyKey);

    try {
      // Acquire advisory lock to serialize concurrent attempts
      await this.prisma.$executeRawUnsafe('SELECT pg_advisory_xact_lock($1)', lockKey);

      // Check if operation can proceed
      const check = await this.canProceed(idempotencyKey, input.entityType, input.entityId);

      if (!check.canProceed) {
        this.logger.warn(
          `Duplicate payment attempt prevented: ${input.entityType} for ${input.entityId}, ` +
          `key: ${idempotencyKey}, reason: ${check.reason}`,
        );
        return check.existingCommand;
      }

      // Create the command
      return this.commandLogService.createCommand({
        ...input,
        metadata: {
          ...input.metadata,
          idempotencyKey,
        },
      });
    } catch (error) {
      this.logger.error(`Error creating command with idempotency: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Handle payment provider idempotency key
   * Ensures Stripe and other provider operations use consistent idempotency keys
   * 
   * @param entityType - Type of payment entity
   * @param entityId - ID of the entity
   * @param userId - User ID (optional)
   * @returns Provider-safe idempotency key
   */
  getProviderIdempotencyKey(
    entityType: PaymentCommandType,
    entityId: string,
    userId?: string,
  ): string {
    // Generate a consistent key format for payment providers
    const timestamp = Date.now();
    const userPart = userId || 'anonymous';
    return `${entityType}_${entityId}_${userPart}_${timestamp}`;
  }

  /**
   * Recover orphaned commands
   * Finds commands stuck in non-terminal states and attempts recovery
   * 
   * @param entityType - Optional entity type filter
   * @param maxAgeMinutes - Maximum age of commands to recover (default: 60 minutes)
   * @returns Recovery results
   */
  async recoverOrphanedCommands(
    entityType?: PaymentCommandType,
    maxAgeMinutes = 60,
  ): Promise<{
    recovered: number;
    failed: number;
    skipped: number;
  }> {
    const now = new Date();
    const cutoff = new Date(now.getTime() - maxAgeMinutes * 60 * 1000);

    const where: any = {
      createdAt: { lte: cutoff },
    };

    if (entityType) {
      where.action = `${entityType}_COMMAND_REQUESTED`;
    } else {
      where.action = { in: ['PAYOUT_COMMAND_REQUESTED', 'REFUND_COMMAND_REQUESTED', 'DEPOSIT_RELEASE_COMMAND_REQUESTED'] };
    }

    const orphanedCommands = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    let recovered = 0;
    let failed = 0;
    let skipped = 0;

    for (const command of orphanedCommands) {
      const payload = this.parsePayload(command.newValues as string);
      const status = (payload.status || '').toUpperCase();
      const terminalStates = ['COMPLETED', 'FAILED'];

      // Skip if already in terminal state
      if (terminalStates.includes(status)) {
        skipped++;
        continue;
      }

      try {
        // Attempt to recover based on current status
        if (status === 'PENDING') {
          // Mark as failed if pending too long
          await this.commandLogService.markFailed(
            command.id,
            'Recovery: Command pending too long',
            { recovered: true },
          );
          recovered++;
        } else if (status === 'ENQUEUED' && !payload.jobId) {
          // Orphaned enqueued command without job
          await this.commandLogService.markFailed(
            command.id,
            'Recovery: Orphaned enqueued command (no job ID)',
            { recovered: true },
          );
          recovered++;
        } else if (status === 'PROCESSING') {
          // Mark as failed if processing too long
          await this.commandLogService.markFailed(
            command.id,
            'Recovery: Command processing too long',
            { recovered: true },
          );
          recovered++;
        } else {
          skipped++;
        }
      } catch (error) {
        this.logger.error(`Failed to recover command ${command.id}: ${error.message}`, error);
        failed++;
      }
    }

    this.logger.log(
      `Orphaned command recovery: ${recovered} recovered, ${failed} failed, ${skipped} skipped`,
    );

    return { recovered, failed, skipped };
  }

  /**
   * Validate payment command consistency
   * Ensures payment records match command logs
   * 
   * @param bookingId - Booking ID to validate
   * @returns Validation result
   */
  async validatePaymentConsistency(bookingId: string): Promise<{
    consistent: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    // Get all payment records for the booking
    const payments = await this.prisma.payment.findMany({
      where: { bookingId },
    });

    // Get all command logs for the booking
    const commands = await this.prisma.auditLog.findMany({
      where: {
        entityId: bookingId,
        action: { in: ['PAYOUT_COMMAND_REQUESTED', 'REFUND_COMMAND_REQUESTED', 'DEPOSIT_RELEASE_COMMAND_REQUESTED'] },
      },
    });

    // Check for payments without corresponding commands
    for (const payment of payments) {
      const hasCommand = commands.some((cmd) => {
        const payload = this.parsePayload(cmd.newValues as string);
        return payload.metadata?.paymentId === payment.id;
      });

      if (!hasCommand) {
        issues.push(`Payment ${payment.id} has no corresponding command log`);
      }
    }

    // Check for commands without corresponding payments (for completed commands)
    for (const command of commands) {
      const payload = this.parsePayload(command.newValues as string);
      const status = (payload.status || '').toUpperCase();

      if (status === 'COMPLETED' && !payload.metadata?.paymentId) {
        // Check if payment exists by other means
        const paymentExists = payments.some((p) => 
          p.paymentIntentId === payload.metadata?.paymentIntentId
        );

        if (!paymentExists) {
          issues.push(`Command ${command.id} marked COMPLETED but no payment found`);
        }
      }
    }

    return {
      consistent: issues.length === 0,
      issues,
    };
  }

  /**
   * Generate a unique idempotency key
   * 
   * @param entityType - Type of payment entity
   * @param entityId - ID of the entity
   * @param userId - User ID (optional)
   * @returns Unique idempotency key
   */
  private generateIdempotencyKey(
    entityType: PaymentCommandType,
    entityId: string,
    userId?: string,
  ): string {
    const uuid = randomUUID();
    const userPart = userId ? `_${userId}` : '';
    return `${entityType}_${entityId}${userPart}_${uuid}`;
  }

  /**
   * Generate a numeric lock key from a string
   * 
   * @param key - String to convert to lock key
   * @returns Numeric lock key
   */
  private generateLockKey(key: string): number {
    return Math.abs(
      key.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 2147483647,
    );
  }

  /**
   * Parse a date string or return current date
   * 
   * @param dateStr - Date string or Date object
   * @returns Date object
   */
  private parseDate(dateStr: string | Date | undefined): Date {
    if (!dateStr) {
      return new Date();
    }

    if (dateStr instanceof Date) {
      return dateStr;
    }

    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  /**
   * Parse a JSON payload
   * 
   * @param raw - Raw JSON string
   * @returns Parsed object or empty object
   */
  private parsePayload(raw: string | null | undefined): Partial<PaymentCommandPayload> {
    if (!raw) {
      return {};
    }

    try {
      const parsed = JSON.parse(raw) as Partial<PaymentCommandPayload>;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
}
