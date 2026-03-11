import { AnalyticsController } from './analytics.controller';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let analyticsService: any;

  beforeEach(() => {
    analyticsService = {
      getPerformanceMetrics: jest.fn().mockResolvedValue({
        responseTime: 45,
        uptime: 99.9,
        requestCount: 1200,
      }),
      getInsights: jest.fn().mockResolvedValue({
        topListings: [],
        revenue: 50000,
      }),
    };

    controller = new AnalyticsController(analyticsService);
  });

  describe('getPerformanceMetrics', () => {
    it('should return performance metrics', async () => {
      const result = await controller.getPerformanceMetrics('user-1');

      expect(result).toBeDefined();
      expect(analyticsService.getPerformanceMetrics).toHaveBeenCalledWith('user-1', undefined);
    });

    it('should pass period parameter', async () => {
      await controller.getPerformanceMetrics('user-1', 'monthly');

      expect(analyticsService.getPerformanceMetrics).toHaveBeenCalledWith('user-1', 'monthly');
    });
  });

  describe('getInsights', () => {
    it('should return user insights', async () => {
      const result = await controller.getInsights('user-1');

      expect(result).toBeDefined();
      expect(analyticsService.getInsights).toHaveBeenCalledWith('user-1');
    });
  });
});
