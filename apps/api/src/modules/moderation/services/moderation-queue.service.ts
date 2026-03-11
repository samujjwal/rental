import { Injectable, NotFoundException } from '@nestjs/common';
import { i18nNotFound } from '@/common/errors/i18n-exceptions';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ModerationFlag } from './content-moderation.service';

interface QueueItem {
  entityType: string;
  entityId: string;
  flags: ModerationFlag[];
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface QueueMetadata {
  flags?: ModerationFlag[];
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  resolvedBy?: string;
  resolvedAt?: string;
  notes?: string;
}

@Injectable()
export class ModerationQueueService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Add item to moderation queue
   */
  async addToQueue(item: QueueItem): Promise<void> {
    const metadata: QueueMetadata = {
      flags: item.flags,
      priority: item.priority,
      status: 'PENDING',
    };

    await this.prisma.auditLog.create({
      data: {
        action: 'MODERATION_QUEUE_ADD',
        entityType: item.entityType,
        entityId: item.entityId,
        metadata: JSON.stringify(metadata),
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

    const hydrated = items.map((item) => ({
      item,
      metadata: this.parseMetadata(item.metadata),
    }));

    // Filter in memory for metadata fields
    let filtered = hydrated;

    if (filters?.status) {
      filtered = filtered.filter((entry) => entry.metadata.status === filters.status);
    }

    if (filters?.priority) {
      filtered = filtered.filter((entry) => entry.metadata.priority === filters.priority);
    }

    return filtered.map(({ item, metadata }) => ({
      id: item.id,
      entityType: item.entityType,
      entityId: item.entityId,
      flags: metadata.flags || [],
      priority: metadata.priority || 'LOW',
      status: metadata.status || 'PENDING',
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
      throw i18nNotFound('moderation.queueItemNotFound');
    }

    // Update status
    const existingMetadata = this.parseMetadata(queueItem.metadata);
    const updatedMetadata: QueueMetadata = {
      ...existingMetadata,
      status: decision,
      resolvedBy: adminId,
      resolvedAt: new Date().toISOString(),
      notes,
    };

    await this.prisma.auditLog.update({
      where: { id: queueItem.id },
      data: {
        metadata: JSON.stringify(updatedMetadata),
      },
    });

    // Create resolution log
    await this.prisma.auditLog.create({
      data: {
        action: `MODERATION_${decision}`,
        entityType: queueItem.entityType,
        entityId: queueItem.entityId,
        userId: adminId,
        newValues: JSON.stringify({ notes }),
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

    const metadata = items.map((item) => this.parseMetadata(item.metadata));
    const pending = metadata.filter((entry) => entry.status === 'PENDING').length;
    const approved = metadata.filter((entry) => entry.status === 'APPROVED').length;
    const rejected = metadata.filter((entry) => entry.status === 'REJECTED').length;

    const pendingItems = metadata.filter((entry) => entry.status === 'PENDING');
    const high = pendingItems.filter((entry) => entry.priority === 'HIGH').length;
    const medium = pendingItems.filter((entry) => entry.priority === 'MEDIUM').length;
    const low = pendingItems.filter((entry) => entry.priority === 'LOW').length;

    return {
      pending,
      approved,
      rejected,
      byPriority: { high, medium, low },
    };
  }

  private parseMetadata(raw: string | null | undefined): QueueMetadata {
    if (!raw) {
      return {};
    }

    try {
      const parsed = JSON.parse(raw) as QueueMetadata;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
}
