/**
 * Dead Letter Queue (DLQ) Service
 * 
 * Provides management operations for dead letter queues:
 * - Inspect DLQ messages
 * - Retry failed jobs
 * - Purge DLQ messages
 * - Get DLQ statistics
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';

export interface DLQMessage {
  id: string;
  name: string;
  data: any;
  opts: any;
  attemptsMade: number;
  failedReason?: string;
  stacktrace?: string[];
  timestamp: number;
  queueName: string;
}

export interface DLQStats {
  queueName: string;
  totalJobs: number;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

export interface RetryOptions {
  mutation?: (data: any) => any;
  priority?: number;
  delay?: number;
}

@Injectable()
export class DLQService {
  private readonly logger = new Logger(DLQService.name);

  constructor(
    @InjectQueue('webhooks') private readonly webhooksQueue: Queue,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
    @InjectQueue('emails') private readonly emailsQueue: Queue,
    @InjectQueue('payouts') private readonly payoutsQueue: Queue,
  ) {}

  /**
   * Get all available queue names
   */
  getQueueNames(): string[] {
    return ['webhooks', 'notifications', 'emails', 'payouts'];
  }

  /**
   * Get queue by name
   */
  private getQueue(queueName: string): Queue {
    const queues: Record<string, Queue> = {
      webhooks: this.webhooksQueue,
      notifications: this.notificationsQueue,
      emails: this.emailsQueue,
      payouts: this.payoutsQueue,
    };

    const queue = queues[queueName];
    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    return queue;
  }

  /**
   * Get statistics for a specific queue
   */
  async getQueueStats(queueName: string): Promise<DLQStats> {
    const queue = this.getQueue(queueName);
    const counts = await queue.getJobCounts();

    return {
      queueName,
      totalJobs: Object.values(counts).reduce((sum, count) => sum + count, 0),
      waiting: counts.waiting,
      active: counts.active,
      completed: counts.completed,
      failed: counts.failed,
      delayed: counts.delayed,
    };
  }

  /**
   * Get statistics for all queues
   */
  async getAllQueueStats(): Promise<DLQStats[]> {
    const stats = await Promise.all(
      this.getQueueNames().map((name) => this.getQueueStats(name)),
    );
    return stats;
  }

  /**
   * Get failed jobs (DLQ messages) from a queue
   */
  async getFailedJobs(queueName: string, limit: number = 50, offset: number = 0): Promise<DLQMessage[]> {
    const queue = this.getQueue(queueName);
    const failedJobs = await queue.getFailed(limit, offset);

    return failedJobs.map((job: Job) => ({
      id: job.id.toString(),
      name: job.name,
      data: job.data,
      opts: job.opts,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      stacktrace: job.stacktrace,
      timestamp: job.timestamp,
      queueName,
    }));
  }

  /**
   * Get a specific failed job by ID
   */
  async getFailedJob(queueName: string, jobId: string): Promise<DLQMessage | null> {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) return null;

    return {
      id: job.id.toString(),
      name: job.name,
      data: job.data,
      opts: job.opts,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      stacktrace: job.stacktrace,
      timestamp: job.timestamp,
      queueName,
    };
  }

  /**
   * Retry a failed job with optional data mutation
   */
  async retryJob(queueName: string, jobId: string, options: RetryOptions = {}): Promise<void> {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    // Apply data mutation if provided
    let data = job.data;
    if (options.mutation) {
      try {
        data = options.mutation(job.data);
        this.logger.log(`Applied mutation to job ${jobId} in queue ${queueName}`);
      } catch (error) {
        this.logger.error(`Failed to apply mutation to job ${jobId}`, error);
        throw new Error('Mutation failed');
      }
    }

    // Remove from failed and add to queue with options
    await job.remove();
    await queue.add(job.name, data, {
      ...job.opts,
      priority: options.priority,
      delay: options.delay,
    });

    this.logger.log(`Retried job ${jobId} in queue ${queueName}`);
  }

  /**
   * Retry multiple failed jobs in bulk
   */
  async retryBulkJobs(queueName: string, jobIds: string[], options: RetryOptions = {}): Promise<{
    succeeded: string[];
    failed: { jobId: string; error: string }[];
  }> {
    const succeeded: string[] = [];
    const failed: { jobId: string; error: string }[] = [];

    for (const jobId of jobIds) {
      try {
        await this.retryJob(queueName, jobId, options);
        succeeded.push(jobId);
      } catch (error) {
        failed.push({
          jobId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    this.logger.log(
      `Bulk retry completed for queue ${queueName}: ${succeeded.length} succeeded, ${failed.length} failed`,
    );

    return { succeeded, failed };
  }

  /**
   * Delete a failed job from DLQ
   */
  async deleteJob(queueName: string, jobId: string): Promise<void> {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    await job.remove();
    this.logger.log(`Deleted job ${jobId} from queue ${queueName}`);
  }

  /**
   * Purge all failed jobs from a queue
   */
  async purgeFailedJobs(queueName: string): Promise<number> {
    const queue = this.getQueue(queueName);
    const failedJobs = await queue.getFailed(0, -1); // Get all failed jobs

    for (const job of failedJobs) {
      await job.remove();
    }

    this.logger.log(`Purged ${failedJobs.length} failed jobs from queue ${queueName}`);
    return failedJobs.length;
  }

  /**
   * Purge failed jobs older than specified hours
   */
  async purgeOldFailedJobs(queueName: string, olderThanHours: number): Promise<number> {
    const queue = this.getQueue(queueName);
    const failedJobs = await queue.getFailed(0, -1);
    const cutoffTime = Date.now() - olderThanHours * 60 * 60 * 1000;

    let purgedCount = 0;
    for (const job of failedJobs) {
      if (job.timestamp < cutoffTime) {
        await job.remove();
        purgedCount++;
      }
    }

    this.logger.log(
      `Purged ${purgedCount} failed jobs older than ${olderThanHours} hours from queue ${queueName}`,
    );
    return purgedCount;
  }

  /**
   * Move failed jobs back to waiting queue (without retrying immediately)
   * Note: Bull doesn't have a direct moveToWaiting method, so we retry with delay
   */
  async moveToWaiting(queueName: string, jobId: string): Promise<void> {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    // Remove from failed and re-add with a delay to move to waiting state
    await job.remove();
    await queue.add(job.name, job.data, {
      ...job.opts,
      delay: 0, // No delay, goes to waiting
    });

    this.logger.log(`Moved job ${jobId} to waiting in queue ${queueName}`);
  }
}
