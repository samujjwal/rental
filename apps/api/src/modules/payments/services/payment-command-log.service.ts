import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type {
  PaymentCommandPayload,
  PaymentCommandStatus,
  PaymentCommandType,
} from '@/common/payments/payment-command.types';

export const PAYMENT_COMMAND_ACTIONS = [
  'PAYOUT_COMMAND_REQUESTED',
  'REFUND_COMMAND_REQUESTED',
  'DEPOSIT_RELEASE_COMMAND_REQUESTED',
] as const;

export function isPaymentCommandAction(action: string | null | undefined): boolean {
  return PAYMENT_COMMAND_ACTIONS.includes(String(action || '') as (typeof PAYMENT_COMMAND_ACTIONS)[number]);
}

export function getPaymentCommandAttentionState(
  payload: Partial<PaymentCommandPayload>,
  createdAt: Date,
  now = new Date(),
): { attentionRequired: boolean; reason: string | null; ageMinutes: number } {
  const requestedAt = payload.requestedAt ? new Date(payload.requestedAt) : createdAt;
  const safeRequestedAt = Number.isNaN(requestedAt.getTime()) ? createdAt : requestedAt;
  const ageMinutes = Math.max(0, Math.floor((now.getTime() - safeRequestedAt.getTime()) / 60000));
  const status = String(payload.status || '').toUpperCase();

  if (status === 'FAILED') {
    return { attentionRequired: true, reason: 'command_failed', ageMinutes };
  }

  // Detect orphaned commands (missing required fields)
  if (status === 'ENQUEUED' && payload.jobId === null) {
    return { attentionRequired: true, reason: 'command_orphaned', ageMinutes };
  }

  if (status === 'PROCESSING' && payload.processedAt === null) {
    return { attentionRequired: true, reason: 'command_orphaned', ageMinutes };
  }

  if (status === 'PENDING' && ageMinutes >= 10) {
    return { attentionRequired: true, reason: 'command_pending_too_long', ageMinutes };
  }

  if (status === 'ENQUEUED' && ageMinutes >= 15) {
    return { attentionRequired: true, reason: 'command_enqueued_too_long', ageMinutes };
  }

  if (status === 'PROCESSING' && ageMinutes >= 30) {
    return { attentionRequired: true, reason: 'command_processing_too_long', ageMinutes };
  }

  // Detect orphaned commands (commands stuck in intermediate states for too long)
  if (ageMinutes >= 60 && (status === 'PENDING' || status === 'ENQUEUED' || status === 'PROCESSING')) {
    return { attentionRequired: true, reason: 'command_orphaned', ageMinutes };
  }

  return { attentionRequired: false, reason: null, ageMinutes };
}

@Injectable()
export class PaymentCommandLogService {
  constructor(private readonly prisma: PrismaService) {}

  async createCommand(input: {
    userId?: string;
    entityType: PaymentCommandType;
    entityId: string;
    amount: number;
    currency: string;
    reason?: string;
    requestedByRole?: string;
    metadata?: Record<string, unknown>;
  }) {
    const idempotencyKey = input.metadata?.idempotencyKey as string;

    // Check for existing command with same idempotency key
    if (idempotencyKey) {
      const existing = await this.prisma.auditLog.findFirst({
        where: {
          action: `${input.entityType}_COMMAND_REQUESTED`,
          newValues: { contains: idempotencyKey },
        },
      });

      if (existing) {
        // Check if the existing command is older than 24 hours (expired)
        const existingPayload = this.parsePayload(existing.newValues as string);
        let existingRequestedAt: Date;
        
        if (existingPayload.requestedAt) {
          existingRequestedAt = new Date(existingPayload.requestedAt);
        } else if (existing.createdAt) {
          existingRequestedAt = new Date(existing.createdAt);
        } else {
          // If we can't determine the age, assume it's recent and return existing
          return existing;
        }

        // Validate the date
        if (isNaN(existingRequestedAt.getTime())) {
          return existing;
        }

        const ageHours = (Date.now() - existingRequestedAt.getTime()) / (1000 * 60 * 60);

        // If older than 24 hours, allow creating a new command (key expired)
        if (ageHours < 24) {
          return existing;
        }
      }
    }

    const payload: PaymentCommandPayload = {
      commandType: input.entityType,
      status: 'PENDING',
      amount: input.amount,
      currency: input.currency,
      queueName: 'payments',
      requestedAt: new Date().toISOString(),
      reason: input.reason,
      requestedByRole: input.requestedByRole,
      metadata: input.metadata,
      idempotencyKey: idempotencyKey || this.generateIdempotencyKey(input.entityType, input.entityId, input.userId),
    };

    return this.prisma.auditLog.create({
      data: {
        userId: input.userId,
        action: `${input.entityType}_COMMAND_REQUESTED`,
        entityType: input.entityType,
        entityId: input.entityId,
        newValues: JSON.stringify(payload),
      },
    });
  }

  private generateIdempotencyKey(entityType: PaymentCommandType, entityId: string, userId?: string): string {
    const uuid = (globalThis as any).crypto.randomUUID();
    return `${entityId}-${userId || 'user'}-${uuid}`;
  }

  async markEnqueued(commandId: string, data: { jobName: string; jobId?: string }) {
    return this.updateCommand(commandId, {
      status: 'ENQUEUED',
      jobName: data.jobName,
      jobId: data.jobId,
    });
  }

  async markProcessing(commandId: string) {
    return this.updateCommand(commandId, {
      status: 'PROCESSING',
      processedAt: new Date().toISOString(),
    });
  }

  async markCompleted(commandId: string, metadata?: Record<string, unknown>) {
    return this.updateCommand(commandId, {
      status: 'COMPLETED',
      processedAt: new Date().toISOString(),
      metadata,
    });
  }

  async markFailed(commandId: string, failureReason: string, metadata?: Record<string, unknown>) {
    const existing = await this.prisma.auditLog.findUnique({
      where: { id: commandId },
      select: { newValues: true },
    });
    const current = this.parsePayload(existing?.newValues);
    const retryCount = (current.retryCount || 0) + 1;

    return this.updateCommand(commandId, {
      status: 'FAILED',
      processedAt: new Date().toISOString(),
      failureReason,
      retryCount,
      metadata,
    });
  }

  private async updateCommand(commandId: string, patch: Partial<PaymentCommandPayload>) {
    const existing = await this.prisma.auditLog.findUnique({
      where: { id: commandId },
      select: { newValues: true },
    });

    const current = this.parsePayload(existing?.newValues);
    const mergedMetadata =
      patch.metadata && current.metadata
        ? { ...current.metadata, ...patch.metadata }
        : patch.metadata ?? current.metadata;

    return this.prisma.auditLog.update({
      where: { id: commandId },
      data: {
        newValues: JSON.stringify({
          ...current,
          ...patch,
          metadata: mergedMetadata,
        }),
      },
    });
  }

  parsePayload(raw: string | null | undefined): Partial<PaymentCommandPayload> {
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