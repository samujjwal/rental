import { Test, TestingModule } from '@nestjs/testing';
import { GeoDistributionService } from './geo-distribution.service';
import { PrismaService } from '@/common/prisma/prisma.service';

describe('GeoDistributionService', () => {
  let service: GeoDistributionService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      regionConfig: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve({ id: 'rc-1', ...create })),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'rc-1', ...data })),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeoDistributionService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<GeoDistributionService>(GeoDistributionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getRegionForCountry', () => {
    it('should return South Asia region for Nepal', async () => {
      const region = await service.getRegionForCountry('NP');
      expect(region).toBeDefined();
      expect(region.regionCode).toBe('ap-south-1');
    });

    it('should return US East for US', async () => {
      const region = await service.getRegionForCountry('US');
      expect(region.regionCode).toBe('us-east-1');
    });

    it('should return Europe for UK', async () => {
      const region = await service.getRegionForCountry('GB');
      expect(region.regionCode).toBe('eu-west-1');
    });

    it('should default to South Asia for unknown country', async () => {
      const region = await service.getRegionForCountry('XX');
      expect(region.regionCode).toBe('ap-south-1');
    });
  });

  describe('getRoutingHints', () => {
    it('should return routing hints for Nepal', async () => {
      const hints = await service.getRoutingHints('NP');
      expect(hints.region).toBe('ap-south-1');
      expect(hints.primaryDb).toBeDefined();
      expect(hints.cdnEndpoint).toBeDefined();
      expect(hints.latencyBudgetMs).toBeGreaterThan(0);
    });
  });

  describe('getActiveRegions', () => {
    it('should return default regions when DB is empty', async () => {
      const regions = await service.getActiveRegions();
      expect(regions.length).toBe(4);
    });

    it('should return DB regions when available', async () => {
      prisma.regionConfig.findMany.mockResolvedValue([
        { regionCode: 'ap-south-1', name: 'South Asia', config: {}, isActive: true },
      ]);
      const regions = await service.getActiveRegions();
      expect(regions).toHaveLength(1);
    });
  });

  describe('upsertRegionConfig', () => {
    it('should upsert a region config', async () => {
      const result = await service.upsertRegionConfig({
        regionCode: 'ap-south-1',
        name: 'South Asia (Mumbai)',
        config: { countries: ['NP', 'IN'] },
      });
      expect(result).toBeDefined();
      expect(prisma.regionConfig.upsert).toHaveBeenCalled();
    });
  });

  describe('simulateFailover', () => {
    it('should simulate failover between regions', async () => {
      const result = await service.simulateFailover('ap-south-1', 'ap-southeast-1');
      expect(result).toBeDefined();
      expect(result.fromRegion).toBe('ap-south-1');
      expect(result.toRegion).toBe('ap-southeast-1');
      expect(result.estimatedDowntimeSeconds).toBeDefined();
    });
  });

  describe('seedRegions', () => {
    it('should seed default regions', async () => {
      const result = await service.seedRegions();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
