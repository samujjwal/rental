import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { SearchIndexService } from '../services/search-index.service';

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

  constructor(private searchIndexService: SearchIndexService) {}

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
      switch (operation) {
        case 'index':
        case 'update':
          await this.searchIndexService.indexListing(listingId);
          this.logger.log(`Indexed listing ${listingId}`);
          break;
        case 'delete':
          await this.searchIndexService.removeListing(listingId);
          this.logger.log(`Removed listing ${listingId} from index`);
          break;
      }
    } catch (error) {
      this.logger.error(`Error indexing listing ${listingId}: ${error.message}`);
      throw error;
    }
  }

  @Process('bulk-index')
  async handleBulkIndex(job: Job<BulkIndexJob>) {
    const { listingIds } = job.data;

    try {
      await this.searchIndexService.bulkIndex(listingIds);
      this.logger.log(`Bulk indexed ${listingIds.length} listings`);
    } catch (error) {
      this.logger.error(`Error bulk indexing: ${error.message}`);
      throw error;
    }
  }

  @Process('reindex-all')
  async handleReindexAll(job: Job<ReindexAllJob>) {
    const { batchSize = 500 } = job.data;

    try {
      const result = await this.searchIndexService.reindexAll();
      this.logger.log(`Reindexed all listings: completed`);
      return result;
    } catch (error) {
      this.logger.error(`Error reindexing all listings: ${error.message}`);
      throw error;
    }
  }

  @Process('optimize-index')
  async handleOptimizeIndex(job: Job) {
    try {
      // Perform index optimization (force merge, etc.)
      this.logger.log('Optimizing search index');
      // Implementation would go here
    } catch (error) {
      this.logger.error(`Error optimizing index: ${error.message}`);
      throw error;
    }
  }
}
