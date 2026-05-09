import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { randomUUID } from 'crypto';

export interface OutboxEvent {
  id: string;
  bookingId: string;
  eventType: string;
  payload: Record<string, any>;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  attempts: number;
  lastAttemptAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  processedAt?: Date;
}

export interface CreateOutboxEventOptions {
  bookingId: string;
  eventType: string;
  payload: Record<string, any>;
}

@Injectable()
export class BookingOutboxService {
  private readonly logger = new Logger(BookingOutboxService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create an outbox event for a booking state transition side effect
   * This ensures side effects are durable and can be retried exactly once
   */
  async createEvent(options: CreateOutboxEventOptions): Promise<OutboxEvent> {
    const { bookingId, eventType, payload } = options;

    const event = await this.prisma.$queryRaw<OutboxEvent[]>`
      INSERT INTO booking_outbox (id, booking_id, event_type, payload, status, attempts, created_at)
      VALUES (
        ${randomUUID()},
        ${bookingId},
        ${eventType},
        ${JSON.stringify(payload)}::jsonb,
        'PENDING',
        0,
        NOW()
      )
      RETURNING *
    `;

    this.logger.log(`Created outbox event ${event[0].id} for booking ${bookingId}: ${eventType}`);
    return event[0];
  }

  /**
   * Get pending outbox events for processing
   */
  async getPendingEvents(limit: number = 100): Promise<OutboxEvent[]> {
    const events = await this.prisma.$queryRaw<OutboxEvent[]>`
      SELECT * FROM booking_outbox
      WHERE status = 'PENDING'
        OR (status = 'FAILED' AND attempts < 5)
      ORDER BY created_at ASC
      LIMIT ${limit}
    `;

    return events;
  }

  /**
   * Mark an event as processing
   */
  async markProcessing(eventId: string): Promise<void> {
    await this.prisma.$queryRaw`
      UPDATE booking_outbox
      SET status = 'PROCESSING',
          last_attempt_at = NOW(),
          attempts = attempts + 1
      WHERE id = ${eventId}
    `;
  }

  /**
   * Mark an event as completed
   */
  async markCompleted(eventId: string): Promise<void> {
    await this.prisma.$queryRaw`
      UPDATE booking_outbox
      SET status = 'COMPLETED',
          processed_at = NOW()
      WHERE id = ${eventId}
    `;

    this.logger.log(`Outbox event ${eventId} marked as completed`);
  }

  /**
   * Mark an event as failed with error message
   */
  async markFailed(eventId: string, errorMessage: string): Promise<void> {
    await this.prisma.$queryRaw`
      UPDATE booking_outbox
      SET status = 'FAILED',
          last_attempt_at = NOW(),
          error_message = ${errorMessage}
      WHERE id = ${eventId}
    `;

    this.logger.error(`Outbox event ${eventId} marked as failed: ${errorMessage}`);
  }

  /**
   * Get statistics about outbox events
   */
  async getStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    total: number;
  }> {
    const stats = await this.prisma.$queryRaw<Array<{ status: string; count: bigint }>>`
      SELECT status, COUNT(*) as count
      FROM booking_outbox
      GROUP BY status
    `;

    const result = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      total: 0,
    };

    for (const stat of stats) {
      result[stat.status.toLowerCase() as keyof typeof result] = Number(stat.count);
      result.total += Number(stat.count);
    }

    return result;
  }

  /**
   * Clean up completed events older than 30 days
   */
  async cleanupOldEvents(): Promise<number> {
    const result = await this.prisma.$queryRaw`
      DELETE FROM booking_outbox
      WHERE status = 'COMPLETED'
        AND processed_at < NOW() - INTERVAL '30 days'
    `;

    const count = Number(result);
    this.logger.log(`Cleaned up ${count} old completed outbox events`);
    return count;
  }
}
