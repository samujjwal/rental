import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { PaymentCommandPayload } from '@/common/payments/payment-command.types';
import { PrismaService } from '@/common/prisma/prisma.service';
import {
  PaymentCommandLogService,
  PAYMENT_COMMAND_ACTIONS,
  getPaymentCommandAttentionState,
} from './payment-command-log.service';

@Injectable()
export class PaymentCommandReconciliationService {
  private readonly logger = new Logger(PaymentCommandReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentCommandLog: PaymentCommandLogService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async reconcileCommands(): Promise<void> {
    const commands = await this.prisma.auditLog.findMany({
      where: {
        action: { in: [...PAYMENT_COMMAND_ACTIONS] },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    let repairedCount = 0;
    let alertCount = 0;

    for (const command of commands) {
      const payload = this.paymentCommandLog.parsePayload(command.newValues);
      const outcome = await this.reconcileCommand(command, payload);
      if (outcome.repaired) {
        repairedCount += 1;
      }
      if (outcome.alerted) {
        alertCount += 1;
      }
    }

    if (repairedCount > 0 || alertCount > 0) {
      this.logger.log(
        `Payment command reconciliation updated ${repairedCount} commands and raised ${alertCount} alerts`,
      );
    }
  }

  private async reconcileCommand(
    command: { id: string; entityType: string; entityId: string; createdAt: Date },
    payload: Partial<PaymentCommandPayload>,
  ): Promise<{ repaired: boolean; alerted: boolean }> {
    if (!payload.status) {
      return { repaired: false, alerted: false };
    }

    if (command.entityType === 'PAYOUT') {
      const payout = await this.prisma.payout.findUnique({
        where: { id: command.entityId },
        select: { status: true, transferId: true },
      });

      if (!payout) {
        const alerted = await this.createAlert(command, payload, 'payout_record_missing');
        return { repaired: false, alerted };
      }

      if (['COMPLETED', 'PAID', 'IN_TRANSIT'].includes(String(payout.status)) && payload.status !== 'COMPLETED') {
        await this.paymentCommandLog.markCompleted(command.id, {
          reconciled: true,
          payoutStatus: payout.status,
          transferId: payout.transferId,
        });
        return { repaired: true, alerted: false };
      }

      if (String(payout.status) === 'FAILED' && payload.status !== 'FAILED') {
        await this.paymentCommandLog.markFailed(command.id, 'Reconciled from payout failure', {
          reconciled: true,
          payoutStatus: payout.status,
        });
        return { repaired: true, alerted: false };
      }
    }

    if (command.entityType === 'REFUND') {
      const refund = await this.prisma.refund.findUnique({
        where: { id: command.entityId },
        select: { status: true, refundId: true },
      });

      if (!refund) {
        const alerted = await this.createAlert(command, payload, 'refund_record_missing');
        return { repaired: false, alerted };
      }

      if (['COMPLETED', 'SUCCEEDED'].includes(String(refund.status)) && payload.status !== 'COMPLETED') {
        await this.paymentCommandLog.markCompleted(command.id, {
          reconciled: true,
          refundStatus: refund.status,
          refundId: refund.refundId,
        });
        return { repaired: true, alerted: false };
      }

      if (['FAILED', 'CANCELLED'].includes(String(refund.status)) && payload.status !== 'FAILED') {
        await this.paymentCommandLog.markFailed(command.id, 'Reconciled from refund failure', {
          reconciled: true,
          refundStatus: refund.status,
        });
        return { repaired: true, alerted: false };
      }
    }

    if (command.entityType === 'DEPOSIT_RELEASE') {
      const bookingId = String(payload.metadata?.bookingId || payload.metadata?.depositBookingId || command.entityId);
      const holds = await this.prisma.depositHold.findMany({
        where: { bookingId },
        select: { id: true, status: true },
      });

      if (holds.length === 0) {
        const alerted = await this.createAlert(command, payload, 'deposit_hold_missing');
        return { repaired: false, alerted };
      }

      if (holds.every((hold) => String(hold.status) === 'RELEASED') && payload.status !== 'COMPLETED') {
        await this.paymentCommandLog.markCompleted(command.id, {
          reconciled: true,
          bookingId,
          depositHoldIds: holds.map((hold) => hold.id),
        });
        return { repaired: true, alerted: false };
      }

      if (holds.some((hold) => String(hold.status) === 'CAPTURED') && payload.status !== 'FAILED') {
        await this.paymentCommandLog.markFailed(command.id, 'Deposit was captured before release', {
          reconciled: true,
          bookingId,
          depositHoldIds: holds.map((hold) => hold.id),
        });
        return { repaired: true, alerted: false };
      }
    }

    const alerted = await this.createAlert(command, payload, getPaymentCommandAttentionState(payload, command.createdAt).reason);
    return { repaired: false, alerted };
  }

  private async createAlert(
    command: { id: string; entityType: string; entityId: string; createdAt: Date },
    payload: Partial<PaymentCommandPayload>,
    reason: string | null,
  ): Promise<boolean> {
    const attention = getPaymentCommandAttentionState(payload, command.createdAt);
    const alertReason = reason || attention.reason;

    if (!alertReason || !attention.attentionRequired) {
      return false;
    }

    const recentAlert = await this.prisma.auditLog.findFirst({
      where: {
        action: 'PAYMENT_COMMAND_RECONCILIATION_ALERT',
        entityType: command.entityType,
        entityId: command.entityId,
        createdAt: {
          gte: new Date(Date.now() - 6 * 60 * 60 * 1000),
        },
      },
      select: { id: true },
    });

    if (recentAlert) {
      return false;
    }

    await this.prisma.auditLog.create({
      data: {
        userId: null,
        action: 'PAYMENT_COMMAND_RECONCILIATION_ALERT',
        entityType: command.entityType,
        entityId: command.entityId,
        metadata: JSON.stringify({
          commandId: command.id,
          commandStatus: payload.status,
          commandType: payload.commandType,
          reason: alertReason,
          ageMinutes: attention.ageMinutes,
          requestedAt: payload.requestedAt,
        }),
      },
    });

    return true;
  }
}