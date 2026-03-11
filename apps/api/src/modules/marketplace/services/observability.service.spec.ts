import { Test, TestingModule } from '@nestjs/testing';
import { ObservabilityService } from './observability.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';

describe('ObservabilityService', () => {
  let service: ObservabilityService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      serviceHealthCheck: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'shc-1', ...data })),
        findMany: jest.fn().mockResolvedValue([
          { serviceName: 'api', status: 'HEALTHY', responseTimeMs: 50, checkedAt: new Date() },
          { serviceName: 'database', status: 'HEALTHY', responseTimeMs: 10, checkedAt: new Date() },
        ]),
      },
      anomalyDetection: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'ad-1', ...data })),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ObservabilityService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: { get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn() } },
      ],
    }).compile();

    service = module.get<ObservabilityService>(ObservabilityService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordHealthCheck', () => {
    it('should record a health check', async () => {
      const result = await service.recordHealthCheck({
        serviceName: 'api',
        status: 'HEALTHY',
        responseTimeMs: 45,
      });
      expect(result).toBeDefined();
      expect(prisma.serviceHealthCheck.create).toHaveBeenCalled();
    });
  });

  describe('getSystemHealth', () => {
    it('should return overall system health', async () => {
      const result = await service.getSystemHealth();
      expect(result).toBeDefined();
      expect(result.overall).toBe('HEALTHY');
      expect(result.services).toHaveLength(2);
    });

    it('should return DEGRADED when some services unhealthy', async () => {
      prisma.serviceHealthCheck.findMany.mockResolvedValue([
        { serviceName: 'api', status: 'HEALTHY', responseTimeMs: 50, checkedAt: new Date() },
        { serviceName: 'cache', status: 'DEGRADED', responseTimeMs: 5000, checkedAt: new Date() },
      ]);
      const result = await service.getSystemHealth();
      expect(result.overall).toBe('DEGRADED');
    });
  });

  describe('detectAnomaly', () => {
    it('should detect anomaly above threshold', async () => {
      const result = await service.detectAnomaly({
        metric: 'response_time',
        value: 2000,
        threshold: 500,
        serviceName: 'api',
      });
      expect(result).toBeDefined();
      expect(prisma.anomalyDetection.create).toHaveBeenCalled();
    });

    it('should return null for values within threshold', async () => {
      const result = await service.detectAnomaly({
        metric: 'response_time',
        value: 400,
        threshold: 500,
        serviceName: 'api',
      });
      expect(result).toBeNull();
    });

    it('should classify severity correctly', async () => {
      // CRITICAL: value > threshold * 2
      await service.detectAnomaly({
        metric: 'test',
        value: 1500,
        threshold: 500,
        serviceName: 'test',
      });
      expect(prisma.anomalyDetection.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ severity: 'CRITICAL' }),
        }),
      );
    });
  });

  describe('getSlaMetrics', () => {
    it('should return SLA metrics for a service', async () => {
      const result = await service.getSlaMetrics('api', 7);
      expect(result).toBeDefined();
      expect(result.serviceName).toBe('api');
      expect(result.uptime).toBeGreaterThanOrEqual(0);
      expect(result.uptime).toBeLessThanOrEqual(1);
    });

    it('should handle empty data', async () => {
      prisma.serviceHealthCheck.findMany.mockResolvedValue([]);
      const result = await service.getSlaMetrics('nonexistent', 7);
      expect(result.uptime).toBe(0);
    });
  });

  describe('acknowledgeAnomaly', () => {
    it('should mark anomaly as acknowledged', async () => {
      await service.acknowledgeAnomaly('ad-1', 'admin-1');
      expect(prisma.anomalyDetection.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ acknowledged: true, acknowledgedBy: 'admin-1' }),
        }),
      );
    });
  });
});
