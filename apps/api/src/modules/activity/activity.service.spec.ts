import { Test, TestingModule } from '@nestjs/testing';
import { ActivityService } from './activity.service';

describe('ActivityService', () => {
  let service: ActivityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ActivityService],
    }).compile();

    service = module.get<ActivityService>(ActivityService);
  });

  describe('getRecentActivity', () => {
    it('should return empty activities array by default', async () => {
      const result = await service.getRecentActivity('user-123', {});

      expect(result).toEqual({
        activities: [],
        total: 0,
        hasMore: false,
      });
    });

    it('should return empty activities with limit parameter', async () => {
      const result = await service.getRecentActivity('user-123', { limit: 10 });

      expect(result.activities).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('should return empty activities with types filter', async () => {
      const result = await service.getRecentActivity('user-123', {
        types: ['booking', 'message'],
      });

      expect(result.activities).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should return empty activities with date range', async () => {
      const result = await service.getRecentActivity('user-123', {
        startDate: '2025-01-01',
        endDate: '2025-12-31',
      });

      expect(result.activities).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should handle cursor-based pagination', async () => {
      const result = await service.getRecentActivity('user-123', {
        cursor: 'cursor-123',
        limit: 20,
      });

      expect(result.activities).toEqual([]);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('getActivityStats', () => {
    it('should return default stats for 7d period', async () => {
      const result = await service.getActivityStats('user-123', '7d');

      expect(result).toEqual({
        totalActivities: 0,
        byType: {},
        mostActiveDay: expect.any(String),
        trend: 'stable',
        changePercent: 0,
      });
    });

    it('should return default stats for 30d period', async () => {
      const result = await service.getActivityStats('user-123', '30d');

      expect(result.totalActivities).toBe(0);
      expect(result.trend).toBe('stable');
      expect(result.changePercent).toBe(0);
    });

    it('should return default stats for 90d period', async () => {
      const result = await service.getActivityStats('user-123', '90d');

      expect(result.totalActivities).toBe(0);
      expect(result.byType).toEqual({});
    });

    it('should return valid date string for mostActiveDay', async () => {
      const result = await service.getActivityStats('user-123', '7d');

      expect(result.mostActiveDay).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('getUnreadCount', () => {
    it('should return zero unread count', async () => {
      const result = await service.getUnreadCount('user-123');

      expect(result).toEqual({ count: 0 });
    });

    it('should return zero for different user IDs', async () => {
      const result = await service.getUnreadCount('user-456');

      expect(result.count).toBe(0);
    });
  });
});
