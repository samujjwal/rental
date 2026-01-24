import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ModerationFlag } from './content-moderation.service';

interface QueueItem {
  entityType: string;
  entityId: string;
  flags: ModerationFlag[];
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
}

@Injectable()
export class ModerationQueueService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Add item to moderation queue
   */
  async addToQueue(item: QueueItem): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        action: 'MODERATION_QUEUE_ADD',
        entityType: item.entityType,
        entityId: item.entityId,
        metadata: {
          flags: item.flags,
          priority: item.priority,
          status: 'PENDING',
        },
      },
    });
  }

  /**
   * Get moderation queue with filters
   */
  async getQueue(filters?: {
    status?: string;
    priority?: string;
    entityType?: string;
  }): Promise<any[]> {
    const where: any = {
      action: 'MODERATION_QUEUE_ADD',
    };

    if (filters?.entityType) {
      where.entityType = filters.entityType;
    }

    // Filter by status and priority in metadata
    const items = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Filter in memory for metadata fields (could be optimized with JSONB queries)
    let filtered = items;
    
    if (filters?.status) {
      filtered = filtered.filter(
        (item) => (item.metadata as any)?.status === filters.status,
      );
    }

    if (filters?.priority) {
      filtered = filtered.filter(
        (item) => (item.metadata as any)?.priority === filters.priority,
      );
    }

    return filtered.map((item) => ({
      id: item.id,
      entityType: item.entityType,
      entityId: item.entityId,
      flags: (item.metadata as any)?.flags || [],
      priority: (item.metadata as any)?.priority || 'LOW',
      status: (item.metadata as any)?.status || 'PENDING',
      createdAt: item.createdAt,
    }));
  }

  /**
   * Resolve queue item (approve or reject)
   */
  async resolveItem(
    entityId: string,
    decision: 'APPROVED' | 'REJECTED',
    adminId: string,
    notes?: string,
  ): Promise<void> {
    // Find the queue item
    const queueItem = await this.prisma.auditLog.findFirst({
      where: {
        action: 'MODERATION_QUEUE_ADD',
        entityId,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!queueItem) {
      throw new Error('Queue item not found');
    }

    // Update status
    await this.prisma.auditLog.update({
      where: { id: queueItem.id },
      data: {
        metadata: {
          ...(queueItem.metadata as any),
          status: decision,
          resolvedBy: adminId,
          resolvedAt: new Date(),
          notes,
        },
      },
    });

    // Create resolution log
    await this.prisma.auditLog.create({
      data: {
        action: `MODERATION_${decision}`,
        entityType: queueItem.entityType,
        entityId: queueItem.entityId,
        userId: adminId,
        metadata: { notes },
      },
    });
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    pending: number;
    approved: number;
    rejected: number;
    byPriority: { high: number; medium: number; low: number };
  }> {
    const items = await this.prisma.auditLog.findMany({
      where: {
        action: 'MODERATION_QUEUE_ADD',
      },
    });

    const pending = items.filter((i) => (i.metadata as any)?.status === 'PENDING').length;
    const approved = items.filter((i) => (i.metadata as any)?.status === 'APPROVED').length;
    const rejected = items.filter((i) => (i.metadata as any)?.status === 'REJECTED').length;

    const pendingItems = items.filter((i) => (i.metadata as any)?.status === 'PENDING');
    const high = pendingItems.filter((i) => (i.metadata as any)?.priority === 'HIGH').length;
    const medium = pendingItems.filter((i) => (i.metadata as any)?.priority === 'MEDIUM').length;
    const low = pendingItems.filter((i) => (i.metadata as any)?.priority === 'LOW').length;

    return {
      pending,
      approved,
      rejected,
      byPriority: { high, medium, low },
    };
  }
}
