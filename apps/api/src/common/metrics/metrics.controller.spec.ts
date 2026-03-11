import { Test, TestingModule } from '@nestjs/testing';
import { MetricsController } from './metrics.controller';

describe('MetricsController', () => {
  let controller: MetricsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
    }).compile();

    controller = module.get<MetricsController>(MetricsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMetrics', () => {
    it('should return Prometheus-format metrics', () => {
      let sentBody = '';
      const sentHeaders: Record<string, string> = {};
      const mockRes = {
        set: jest.fn((key: string, value: string) => {
          sentHeaders[key] = value;
        }),
        send: jest.fn((body: string) => {
          sentBody = body;
        }),
      } as any;

      controller.getMetrics(mockRes);

      expect(mockRes.set).toHaveBeenCalledWith(
        'Content-Type',
        'text/plain; version=0.0.4; charset=utf-8',
      );
      expect(mockRes.send).toHaveBeenCalled();
      expect(sentBody).toContain('process_resident_memory_bytes');
      expect(sentBody).toContain('process_heap_bytes');
      expect(sentBody).toContain('process_cpu_user_seconds_total');
      expect(sentBody).toContain('process_uptime_seconds');
      expect(sentBody).toContain('nodejs_active_handles');
      expect(sentBody).toContain('nodejs_active_requests');
    });

    it('should include all expected metric types', () => {
      let sentBody = '';
      const mockRes = {
        set: jest.fn(),
        send: jest.fn((body: string) => {
          sentBody = body;
        }),
      } as any;

      controller.getMetrics(mockRes);

      // Check metric type annotations
      expect(sentBody).toContain('# TYPE process_resident_memory_bytes gauge');
      expect(sentBody).toContain('# TYPE process_cpu_user_seconds_total counter');
      expect(sentBody).toContain('# TYPE process_start_time_seconds gauge');
      expect(sentBody).toContain('# TYPE process_uptime_seconds gauge');
    });

    it('should return numeric values for all metrics', () => {
      let sentBody = '';
      const mockRes = {
        set: jest.fn(),
        send: jest.fn((body: string) => {
          sentBody = body;
        }),
      } as any;

      controller.getMetrics(mockRes);

      // Parse non-comment, non-empty lines and check they have numeric values
      const metricLines = sentBody
        .split('\n')
        .filter((line: string) => line && !line.startsWith('#'));
      expect(metricLines.length).toBeGreaterThanOrEqual(8);
      for (const line of metricLines) {
        const parts = line.split(' ');
        expect(parts.length).toBe(2);
        expect(Number.isFinite(Number(parts[1]))).toBe(true);
      }
    });

    it('should report positive memory values', () => {
      let sentBody = '';
      const mockRes = {
        set: jest.fn(),
        send: jest.fn((body: string) => {
          sentBody = body;
        }),
      } as any;

      controller.getMetrics(mockRes);

      const rssLine = sentBody
        .split('\n')
        .find((l: string) => l.startsWith('process_resident_memory_bytes'));
      expect(rssLine).toBeDefined();
      const rssValue = Number(rssLine!.split(' ')[1]);
      expect(rssValue).toBeGreaterThan(0);
    });
  });
});
