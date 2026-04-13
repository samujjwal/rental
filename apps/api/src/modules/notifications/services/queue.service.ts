import { Injectable, Logger } from '@nestjs/common';

export interface QueueItem {
  id?: string;
  status?: string;
  attempts?: number;
  [key: string]: unknown;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private queue: QueueItem[] = [];

  async add(item: QueueItem): Promise<void> {
    this.queue.push({
      ...item,
      status: 'pending',
    });
    this.logger.debug(`Added item to queue: ${item.id}`);
  }

  async process(): Promise<QueueItem[]> {
    const items = [...this.queue];
    this.logger.debug(`Processing ${items.length} queue items`);
    return items;
  }

  async getQueueSize(): Promise<number> {
    return this.queue.length;
  }

  async clearQueue(): Promise<void> {
    this.queue = [];
    this.logger.debug('Queue cleared');
  }
}
