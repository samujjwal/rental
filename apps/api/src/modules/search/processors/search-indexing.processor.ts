import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

interface IndexListingJob {
  listingId: string;
  operation: 'index' | 'update' | 'delete';
}

interface BulkIndexJob {
  listingIds: string[];
}

interface ReindexAllJob {
  batchSize?: number;
}

@Processor('search-indexing')
export class SearchIndexingProcessor {
  private readonly logger = new Logger(SearchIndexingProcessor.name);

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(`Processing search indexing job ${job.id}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    this.logger.log(`Search indexing job ${job.id} completed`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(`Search indexing job ${job.id} failed: ${error.message}`, error.stack);
  }

  @Process('index-listing')
  async handleIndexListing(job: Job<IndexListingJob>) {
    const { listingId, operation } = job.data;

    try {
      // Since we're using PostgreSQL, no indexing needed
      this.logger.log(`Skipping indexing for listing ${listingId} - using PostgreSQL search`);
      return { skipped: true, reason: 'PostgreSQL search' };
    } catch (error) {
      this.logger.error(`Error processing listing ${listingId}: ${error.message}`);
      throw error;
    }
  }

  @Process('bulk-index')
  async handleBulkIndex(job: Job<BulkIndexJob>) {
    const { listingIds } = job.data;

    try {
      // Since we're using PostgreSQL, no bulk indexing needed
      this.logger.log(
        `Skipping bulk indexing for ${listingIds.length} listings - using PostgreSQL search`,
      );
      return { skipped: true, reason: 'PostgreSQL search' };
    } catch (error) {
      this.logger.error(`Error bulk indexing: ${error.message}`);
      throw error;
    }
  }

  @Process('reindex-all')
  async handleReindexAll(job: Job<ReindexAllJob>) {
    const { batchSize = 500 } = job.data;

    try {
      // Since we're using PostgreSQL, no reindexing needed
      this.logger.log(`Skipping reindex all - using PostgreSQL search`);
      return { skipped: true, reason: 'PostgreSQL search' };
    } catch (error) {
      this.logger.error(`Error reindexing all listings: ${error.message}`);
      throw error;
    }
  }

  @Process('optimize-index')
  async handleOptimizeIndex(job: Job) {
    try {
      // Since we're using PostgreSQL, no index optimization needed
      this.logger.log('Skipping index optimization - using PostgreSQL search');
      return { skipped: true, reason: 'PostgreSQL search' };
    } catch (error) {
      this.logger.error(`Error optimizing index: ${error.message}`);
      throw error;
    }
  }
}
