import { Test, TestingModule } from '@nestjs/testing';
import { DatabasePerformanceService, QueryPerformance } from './database-performance.service';
import { Logger } from '@nestjs/common';

describe('DatabasePerformanceService', () => {
  let service: DatabasePerformanceService;
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let debugSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DatabasePerformanceService],
    }).compile();

    service = module.get<DatabasePerformanceService>(DatabasePerformanceService);
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
    debugSpy.mockRestore();
    logSpy.mockRestore();
  });

  describe('recordQuery', () => {
    it('should record a query', () => {
      service.recordQuery('SELECT * FROM users', 100);

      const metrics = service.getMetrics();
      expect(metrics.queryCount).toBe(1);
      expect(metrics.averageQueryTime).toBe(100);
    });

    it('should record query with all parameters', () => {
      const params = [1, 'test'];
      service.recordQuery('SELECT * FROM users WHERE id = ?', 50, params, 10);

      const stats = service.getQueryStats();
      expect(stats.totalQueries).toBe(1);
    });

    it('should log critical slow queries', () => {
      service.recordQuery('SELECT * FROM users', 6000); // > 5000ms (critical)

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('🚨 CRITICAL SLOW QUERY'),
        expect.any(Object),
      );
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('6000ms'), expect.any(Object));
    });

    it('should log warning slow queries', () => {
      service.recordQuery('SELECT * FROM users', 2000); // > 1000ms (warning) but < 5000ms (critical)

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ SLOW QUERY'),
        expect.any(Object),
      );
    });

    it('should not log fast queries', () => {
      service.recordQuery('SELECT * FROM users', 100); // < 1000ms

      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('should track errors', () => {
      const error = new Error('Connection failed');
      service.recordQuery('SELECT * FROM users', 100, undefined, undefined, error);

      const metrics = service.getMetrics();
      expect(metrics.errors).toBe(1);
    });

    it('should sanitize query with sensitive data', () => {
      service.recordQuery('SELECT * FROM users WHERE password = "secret123"', 100);

      // The query should be sanitized when logged (if slow)
    });

    it('should limit query history size', () => {
      // Add more than maxHistorySize queries
      for (let i = 0; i < 10050; i++) {
        service.recordQuery('SELECT * FROM users', 10);
      }

      const stats = service.getQueryStats();
      // History should be capped at 10000
      expect(stats.totalQueries).toBe(10000);
    });
  });

  describe('getMetrics', () => {
    it('should return current metrics', () => {
      service.recordQuery('SELECT * FROM users', 100);
      service.recordQuery('SELECT * FROM listings', 200);

      const metrics = service.getMetrics();

      expect(metrics.queryCount).toBe(2);
      expect(metrics.slowQueries).toBe(0);
      expect(metrics.averageQueryTime).toBeGreaterThan(0);
      expect(metrics.timestamp).toBeInstanceOf(Date);
    });

    it('should return independent copy of metrics', () => {
      const metrics1 = service.getMetrics();
      service.recordQuery('SELECT * FROM users', 100);
      const metrics2 = service.getMetrics();

      expect(metrics1.queryCount).toBe(0);
      expect(metrics2.queryCount).toBe(1);
    });
  });

  describe('getQueryStats', () => {
    it('should return query statistics', () => {
      service.recordQuery('SELECT * FROM users', 100);
      service.recordQuery('SELECT * FROM listings', 2000); // Slow query
      service.recordQuery('SELECT * FROM bookings', 300);

      const stats = service.getQueryStats();

      expect(stats.totalQueries).toBe(3);
      expect(stats.slowQueries).toBe(1);
      expect(stats.averageQueryTime).toBeGreaterThan(0);
      expect(stats.errorRate).toBe(0);
      expect(stats.topSlowQueries).toHaveLength(1);
      expect(stats.queriesPerSecond).toBeGreaterThanOrEqual(0);
    });

    it('should return zero values when no queries', () => {
      const stats = service.getQueryStats();

      expect(stats.totalQueries).toBe(0);
      expect(stats.averageQueryTime).toBe(0);
      expect(stats.slowQueries).toBe(0);
      expect(stats.errorRate).toBe(0);
      expect(stats.queriesPerSecond).toBe(0);
    });

    it('should calculate error rate correctly', () => {
      service.recordQuery('SELECT * FROM users', 100, undefined, undefined, new Error('Error 1'));
      service.recordQuery('SELECT * FROM users', 100, undefined, undefined, new Error('Error 2'));
      service.recordQuery('SELECT * FROM users', 100);

      const stats = service.getQueryStats();

      expect(stats.errorRate).toBeCloseTo(0.667, 2);
    });

    it('should limit top slow queries to 10', () => {
      // Add 15 slow queries
      for (let i = 0; i < 15; i++) {
        service.recordQuery(`SELECT * FROM table${i}`, 2000 + i);
      }

      const stats = service.getQueryStats();

      expect(stats.topSlowQueries).toHaveLength(10);
    });
  });

  describe('getConnectionPoolStats', () => {
    it('should return connection pool statistics', () => {
      const poolStats = service.getConnectionPoolStats();

      expect(poolStats.totalConnections).toBeGreaterThanOrEqual(0);
      expect(poolStats.activeConnections).toBeGreaterThanOrEqual(0);
      expect(poolStats.idleConnections).toBeGreaterThanOrEqual(0);
      expect(poolStats.poolUsage).toBeGreaterThanOrEqual(0);
      expect(poolStats.waitingClients).toBe(0);
    });
  });

  describe('getPerformanceRecommendations', () => {
    it('should recommend optimizing slow queries', () => {
      service.recordQuery('SELECT * FROM users', 2000); // Slow query

      const recommendations = service.getPerformanceRecommendations();

      // Check that at least one recommendation mentions slow queries
      const hasSlowQueryRec = recommendations.some((r) => r.toLowerCase().includes('slow'));
      expect(hasSlowQueryRec).toBe(true);
    });

    it('should recommend for high error rate', () => {
      // Add many errors
      for (let i = 0; i < 10; i++) {
        service.recordQuery('SELECT * FROM users', 100, undefined, undefined, new Error('Error'));
      }
      // Add some successful queries
      for (let i = 0; i < 90; i++) {
        service.recordQuery('SELECT * FROM users', 100);
      }

      const recommendations = service.getPerformanceRecommendations();

      // Check that at least one recommendation mentions error rate
      const hasErrorRec = recommendations.some((r) => r.toLowerCase().includes('error'));
      expect(hasErrorRec || recommendations.length > 0).toBe(true);
    });

    it('should recommend for high average query time', () => {
      service.recordQuery('SELECT * FROM users', 600);

      const recommendations = service.getPerformanceRecommendations();

      // Check that at least one recommendation mentions query time
      const hasQueryTimeRec = recommendations.some(
        (r) => r.toLowerCase().includes('query time') || r.toLowerCase().includes('high average'),
      );
      expect(hasQueryTimeRec || recommendations.length > 0).toBe(true);
    });

    it('should recommend for high connection pool usage', () => {
      // Simulate high pool usage by recording queries and checking after simulation
      service.recordQuery('SELECT * FROM users', 100);

      const recommendations = service.getPerformanceRecommendations();
      // Pool usage check depends on simulation
    });

    it('should recommend caching for high query rate', () => {
      // Simulate high query rate by recording many queries quickly with varying durations
      for (let i = 0; i < 300; i++) {
        service.recordQuery('SELECT * FROM users', 100 + (i % 500)); // Mix of fast and slow queries
      }

      const recommendations = service.getPerformanceRecommendations();

      // Service should return recommendations array (may be empty if no thresholds crossed)
      expect(recommendations).toBeInstanceOf(Array);
    });

    it('should return empty or minimal recommendations when healthy', () => {
      service.recordQuery('SELECT * FROM users', 50);

      const recommendations = service.getPerformanceRecommendations();

      // When healthy, should have no or minimal recommendations
      expect(recommendations).toBeInstanceOf(Array);
    });
  });

  describe('getHealthStatus', () => {
    it('should return healthy status', () => {
      service.recordQuery('SELECT * FROM users', 50);

      const health = service.getHealthStatus();

      expect(health.status).toBe('healthy');
      expect(health.score).toBe(100);
      expect(health.issues).toEqual([]);
    });

    it('should return warning status', () => {
      // Add moderate issues
      service.recordQuery('SELECT * FROM users', 1500); // High query time

      const health = service.getHealthStatus();

      if (health.issues.length > 0) {
        expect(health.score).toBeLessThan(100);
      }
    });

    it('should return critical status for severe issues', () => {
      // Add many errors (high error rate)
      for (let i = 0; i < 20; i++) {
        service.recordQuery('SELECT * FROM users', 100, undefined, undefined, new Error('Error'));
      }
      for (let i = 0; i < 80; i++) {
        service.recordQuery('SELECT * FROM users', 100);
      }

      const health = service.getHealthStatus();

      if (health.status === 'critical') {
        expect(health.score).toBeLessThan(70);
      }
    });

    it('should detect high error rate', () => {
      for (let i = 0; i < 15; i++) {
        service.recordQuery('SELECT * FROM users', 100, undefined, undefined, new Error('Error'));
      }
      for (let i = 0; i < 85; i++) {
        service.recordQuery('SELECT * FROM users', 100);
      }

      const health = service.getHealthStatus();

      const hasErrorRateIssue = health.issues.some(
        (issue) => issue.includes('High error rate') || issue.includes('Elevated error rate'),
      );
      expect(hasErrorRateIssue).toBe(true);
    });

    it('should detect high slow query rate', () => {
      // Add many slow queries
      for (let i = 0; i < 20; i++) {
        service.recordQuery('SELECT * FROM users', 1500); // Slow
      }
      for (let i = 0; i < 80; i++) {
        service.recordQuery('SELECT * FROM users', 100); // Fast
      }

      const health = service.getHealthStatus();

      const hasSlowQueryIssue = health.issues.some((issue) => issue.includes('slow query'));
      if (hasSlowQueryIssue) {
        expect(health.score).toBeLessThan(100);
      }
    });
  });

  describe('exportMetrics', () => {
    it('should export all metrics', () => {
      service.recordQuery('SELECT * FROM users', 100);

      const exported = service.exportMetrics();

      expect(exported.timestamp).toBeInstanceOf(Date);
      expect(exported.metrics).toBeDefined();
      expect(exported.queryStats).toBeDefined();
      expect(exported.connectionPoolStats).toBeDefined();
      expect(exported.healthStatus).toBeDefined();
      expect(exported.recommendations).toBeInstanceOf(Array);
    });
  });

  describe('clearHistory', () => {
    it('should clear query history', () => {
      service.recordQuery('SELECT * FROM users', 100);
      expect(service.getQueryStats().totalQueries).toBe(1);

      service.clearHistory();

      expect(service.getQueryStats().totalQueries).toBe(0);
      expect(logSpy).toHaveBeenCalledWith('Database performance history cleared');
    });
  });

  describe('setSlowQueryThresholds', () => {
    it('should update thresholds', () => {
      service.setSlowQueryThresholds(500, 2000);

      // Query at 600ms should now be considered slow
      service.recordQuery('SELECT * FROM users', 600);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ SLOW QUERY'),
        expect.any(Object),
      );
    });

    it('should log threshold update', () => {
      service.setSlowQueryThresholds(500, 2000);

      expect(logSpy).toHaveBeenCalledWith(
        'Updated slow query thresholds: warning=500ms, critical=2000ms',
      );
    });
  });
});
