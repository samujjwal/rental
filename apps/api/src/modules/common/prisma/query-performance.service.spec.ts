import { Test, TestingModule } from '@nestjs/testing';
import { QueryPerformanceService } from './query-performance.service';

describe('QueryPerformanceService', () => {
  let service: QueryPerformanceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [QueryPerformanceService],
    }).compile();

    service = module.get<QueryPerformanceService>(QueryPerformanceService);
  });

  describe('Query Tracking', () => {
    it('should track query execution', () => {
      service.trackQuery('SELECT * FROM users', 100);
      const stats = service.getPerformanceStats();

      expect(stats).toBeDefined();
      expect(stats?.totalQueries).toBe(1);
      expect(stats?.avgDuration).toBe(100);
    });

    it('should track slow queries', () => {
      const slowQuery = 'SELECT * FROM users WHERE email = ?';
      service.trackQuery(slowQuery, 1500);

      const slowQueries = service.getSlowQueries();
      expect(slowQueries).toHaveLength(1);
      expect(slowQueries[0].query).toBe(slowQuery);
      expect(slowQueries[0].duration).toBe(1500);
    });

    it('should not track fast queries as slow', () => {
      service.trackQuery('SELECT * FROM users', 100);

      const slowQueries = service.getSlowQueries();
      expect(slowQueries).toHaveLength(0);
    });

    it('should track query patterns for N+1 detection', () => {
      const pattern = 'SELECT * FROM bookings WHERE listing_id = ?';
      for (let i = 0; i < 6; i++) {
        service.trackQuery(pattern, 50);
      }

      const n1Patterns = service.getN1QueryPatterns();
      expect(n1Patterns).toHaveLength(1);
      expect(n1Patterns[0].query).toContain('SELECT * FROM bookings');
      expect(n1Patterns[0].count).toBeGreaterThanOrEqual(6);
    });

    it('should calculate accurate performance statistics', () => {
      service.trackQuery('Query 1', 100);
      service.trackQuery('Query 2', 200);
      service.trackQuery('Query 3', 300);

      const stats = service.getPerformanceStats();
      expect(stats?.totalQueries).toBe(3);
      expect(stats?.avgDuration).toBe(200);
      expect(stats?.maxDuration).toBe(300);
      expect(stats?.minDuration).toBe(100);
    });
  });

  describe('Query History Management', () => {
    it('should trim history when exceeding maximum size', () => {
      // Add more queries than the history size
      for (let i = 0; i < 150; i++) {
        service.trackQuery(`Query ${i}`, 50);
      }

      const stats = service.getPerformanceStats();
      expect(stats?.totalQueries).toBeLessThanOrEqual(100);
    });

    it('should clear history', () => {
      service.trackQuery('Query 1', 100);
      service.trackQuery('Query 2', 200);

      service.clearHistory();

      const stats = service.getPerformanceStats();
      expect(stats).toBeNull();
    });
  });

  describe('Query Pattern Normalization', () => {
    it('should normalize parameterized queries', () => {
      // Track queries more times to reach N+1 threshold
      for (let i = 0; i < 6; i++) {
        service.trackQuery('SELECT * FROM users WHERE id = ?1', 100);
        service.trackQuery('SELECT * FROM users WHERE id = ?2', 100);
      }

      const n1Patterns = service.getN1QueryPatterns();
      // Both queries should be normalized to the same pattern
      expect(n1Patterns.length).toBe(1);
    });

    it('should normalize different parameter formats', () => {
      // Track queries more times to reach N+1 threshold
      for (let i = 0; i < 6; i++) {
        service.trackQuery('SELECT * FROM users WHERE id = $1', 100);
        service.trackQuery('SELECT * FROM users WHERE id = $2', 100);
      }

      const n1Patterns = service.getN1QueryPatterns();
      expect(n1Patterns.length).toBe(1);
    });
  });

  describe('Performance Statistics', () => {
    it('should return null when no queries tracked', () => {
      const stats = service.getPerformanceStats();
      expect(stats).toBeNull();
    });

    it('should track slow query count separately', () => {
      service.trackQuery('Fast query', 50);
      service.trackQuery('Slow query 1', 1200);
      service.trackQuery('Slow query 2', 1500);

      const stats = service.getPerformanceStats();
      expect(stats?.slowQueryCount).toBe(2);
      expect(stats?.totalQueries).toBe(3);
    });

    it('should track unique query patterns', () => {
      service.trackQuery('SELECT * FROM users', 50);
      service.trackQuery('SELECT * FROM bookings', 50);
      service.trackQuery('SELECT * FROM listings', 50);

      const stats = service.getPerformanceStats();
      expect(stats?.uniqueQueryPatterns).toBe(3);
    });
  });
});
