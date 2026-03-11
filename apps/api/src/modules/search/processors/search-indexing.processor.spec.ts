 
import { Logger } from '@nestjs/common';
import { SearchIndexingProcessor } from './search-indexing.processor';

/* ── helpers ── */

function makeJob(name: string, data: any, overrides: any = {}) {
  return { id: `job-${Date.now()}`, name, data, ...overrides };
}

let processor: SearchIndexingProcessor;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Logger.prototype, 'log').mockImplementation();
  jest.spyOn(Logger.prototype, 'error').mockImplementation();
  processor = new SearchIndexingProcessor();
});

describe('SearchIndexingProcessor', () => {
  /* ── lifecycle ── */
  describe('queue lifecycle', () => {
    it('logs on active', () => {
      processor.onActive(makeJob('index-listing', {}) as any);
      expect(Logger.prototype.log).toHaveBeenCalledWith(expect.stringContaining('Processing'));
    });

    it('logs on completed', () => {
      processor.onCompleted(makeJob('index-listing', {}) as any, {});
      expect(Logger.prototype.log).toHaveBeenCalledWith(expect.stringContaining('completed'));
    });

    it('logs error on failed', () => {
      processor.onFailed(makeJob('index-listing', {}) as any, new Error('boom'));
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.stringContaining('boom'),
        expect.any(String),
      );
    });
  });

  /* ── index-listing ── */
  describe('handleIndexListing', () => {
    it('returns skipped result for index operation', async () => {
      const job = makeJob('index-listing', { listingId: 'l1', operation: 'index' });
      const result = await processor.handleIndexListing(job as any);
      expect(result).toEqual({ skipped: true, reason: 'PostgreSQL search' });
    });

    it('returns skipped result for update operation', async () => {
      const job = makeJob('index-listing', { listingId: 'l2', operation: 'update' });
      const result = await processor.handleIndexListing(job as any);
      expect(result).toEqual({ skipped: true, reason: 'PostgreSQL search' });
    });

    it('returns skipped result for delete operation', async () => {
      const job = makeJob('index-listing', { listingId: 'l3', operation: 'delete' });
      const result = await processor.handleIndexListing(job as any);
      expect(result).toEqual({ skipped: true, reason: 'PostgreSQL search' });
    });
  });

  /* ── bulk-index ── */
  describe('handleBulkIndex', () => {
    it('returns skipped for bulk indexing', async () => {
      const job = makeJob('bulk-index', { listingIds: ['l1', 'l2', 'l3'] });
      const result = await processor.handleBulkIndex(job as any);
      expect(result).toEqual({ skipped: true, reason: 'PostgreSQL search' });
    });
  });

  /* ── reindex-all ── */
  describe('handleReindexAll', () => {
    it('returns skipped with default batchSize', async () => {
      const job = makeJob('reindex-all', {});
      const result = await processor.handleReindexAll(job as any);
      expect(result).toEqual({ skipped: true, reason: 'PostgreSQL search' });
    });

    it('accepts custom batchSize', async () => {
      const job = makeJob('reindex-all', { batchSize: 100 });
      const result = await processor.handleReindexAll(job as any);
      expect(result).toEqual({ skipped: true, reason: 'PostgreSQL search' });
    });
  });

  /* ── optimize-index ── */
  describe('handleOptimizeIndex', () => {
    it('returns skipped', async () => {
      const job = makeJob('optimize-index', {});
      const result = await processor.handleOptimizeIndex(job as any);
      expect(result).toEqual({ skipped: true, reason: 'PostgreSQL search' });
    });
  });
});
