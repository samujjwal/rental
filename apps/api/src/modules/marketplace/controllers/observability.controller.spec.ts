import { Test, TestingModule } from '@nestjs/testing';
import { ObservabilityController } from './observability.controller';
import { ObservabilityService } from '../services/observability.service';

describe('ObservabilityController', () => {
  let controller: ObservabilityController;
  let observability: jest.Mocked<ObservabilityService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ObservabilityController],
      providers: [
        {
          provide: ObservabilityService,
          useValue: {
            getPrometheusMetrics: jest.fn(),
            getSystemHealth: jest.fn(),
            recordHealthCheck: jest.fn(),
            detectAnomaly: jest.fn(),
            getRecentAnomalies: jest.fn(),
            acknowledgeAnomaly: jest.fn(),
            getSlaMetrics: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(ObservabilityController);
    observability = module.get(ObservabilityService) as jest.Mocked<ObservabilityService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── getPrometheusMetrics ──

  describe('getPrometheusMetrics', () => {
    it('sets content-type and sends metrics via res', async () => {
      const metricsText = '# HELP up\nup 1';
      observability.getPrometheusMetrics.mockResolvedValue(metricsText as any);

      const res = { set: jest.fn(), send: jest.fn() } as any;

      await controller.getPrometheusMetrics(res);

      expect(observability.getPrometheusMetrics).toHaveBeenCalled();
      expect(res.set).toHaveBeenCalledWith('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      expect(res.send).toHaveBeenCalledWith(metricsText);
    });

    it('propagates service error', async () => {
      observability.getPrometheusMetrics.mockRejectedValue(new Error('Metrics unavailable'));
      const res = { set: jest.fn(), send: jest.fn() } as any;
      await expect(controller.getPrometheusMetrics(res)).rejects.toThrow('Metrics unavailable');
    });
  });

  // ── getSystemHealth ──

  describe('getSystemHealth', () => {
    it('delegates to service', async () => {
      observability.getSystemHealth.mockResolvedValue({ status: 'healthy' } as any);

      const result = await controller.getSystemHealth();

      expect(observability.getSystemHealth).toHaveBeenCalled();
      expect(result).toEqual({ status: 'healthy' });
    });
  });

  // ── recordHealthCheck ──

  describe('recordHealthCheck', () => {
    it('delegates dto to service', async () => {
      const dto = { serviceName: 'api', status: 'up' } as any;
      observability.recordHealthCheck.mockResolvedValue({ recorded: true } as any);

      const result = await controller.recordHealthCheck(dto);

      expect(observability.recordHealthCheck).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ recorded: true });
    });
  });

  // ── detectAnomaly ──

  describe('detectAnomaly', () => {
    it('delegates dto to service', async () => {
      const dto = { metric: 'latency', value: 5000 } as any;
      observability.detectAnomaly.mockResolvedValue({ anomaly: true } as any);

      const result = await controller.detectAnomaly(dto);

      expect(observability.detectAnomaly).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ anomaly: true });
    });
  });

  // ── getRecentAnomalies ──

  describe('getRecentAnomalies', () => {
    it('defaults hours to 24', async () => {
      observability.getRecentAnomalies.mockResolvedValue([] as any);

      const result = await controller.getRecentAnomalies();

      expect(observability.getRecentAnomalies).toHaveBeenCalledWith(24, undefined);
      expect(result).toEqual([]);
    });

    it('passes explicit hours and severity', async () => {
      observability.getRecentAnomalies.mockResolvedValue([{ id: 'a1' }] as any);

      await controller.getRecentAnomalies(48, 'critical');

      expect(observability.getRecentAnomalies).toHaveBeenCalledWith(48, 'critical');
    });
  });

  // ── acknowledgeAnomaly ──

  describe('acknowledgeAnomaly', () => {
    it('delegates params to service', async () => {
      observability.acknowledgeAnomaly.mockResolvedValue({ acknowledged: true } as any);

      const result = await controller.acknowledgeAnomaly('a1', 'admin1');

      expect(observability.acknowledgeAnomaly).toHaveBeenCalledWith('a1', 'admin1');
      expect(result).toEqual({ acknowledged: true });
    });
  });

  // ── getSlaMetrics ──

  describe('getSlaMetrics', () => {
    it('defaults days to 7', async () => {
      observability.getSlaMetrics.mockResolvedValue({ uptime: 99.9 } as any);

      const result = await controller.getSlaMetrics('api');

      expect(observability.getSlaMetrics).toHaveBeenCalledWith('api', 7);
      expect(result).toEqual({ uptime: 99.9 });
    });

    it('passes explicit days', async () => {
      observability.getSlaMetrics.mockResolvedValue({ uptime: 99.5 } as any);

      await controller.getSlaMetrics('api', 30);

      expect(observability.getSlaMetrics).toHaveBeenCalledWith('api', 30);
    });

    it('propagates service error', async () => {
      observability.getSlaMetrics.mockRejectedValue(new Error('Service not found'));
      await expect(controller.getSlaMetrics('bad')).rejects.toThrow('Service not found');
    });
  });
});
