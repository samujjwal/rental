import { Test, TestingModule } from '@nestjs/testing';
import { GeoDistributionController } from './geo-distribution.controller';
import { GeoDistributionService } from '../services/geo-distribution.service';

describe('GeoDistributionController', () => {
  let controller: GeoDistributionController;
  let geo: jest.Mocked<GeoDistributionService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GeoDistributionController],
      providers: [
        {
          provide: GeoDistributionService,
          useValue: {
            getActiveRegions: jest.fn(),
            getRegionForCountry: jest.fn(),
            upsertRegionConfig: jest.fn(),
            getRoutingHints: jest.fn(),
            simulateFailover: jest.fn(),
            seedRegions: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(GeoDistributionController);
    geo = module.get(GeoDistributionService) as jest.Mocked<GeoDistributionService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── getActiveRegions ──

  describe('getActiveRegions', () => {
    it('delegates to service', async () => {
      geo.getActiveRegions.mockResolvedValue([{ name: 'south-asia' }] as any);

      const result = await controller.getActiveRegions();

      expect(geo.getActiveRegions).toHaveBeenCalled();
      expect(result).toEqual([{ name: 'south-asia' }]);
    });
  });

  // ── getRegion ──

  describe('getRegion', () => {
    it('delegates country to service', async () => {
      geo.getRegionForCountry.mockResolvedValue({ region: 'south-asia' } as any);

      const result = await controller.getRegion('NP');

      expect(geo.getRegionForCountry).toHaveBeenCalledWith('NP');
      expect(result).toEqual({ region: 'south-asia' });
    });

    it('propagates service error', async () => {
      geo.getRegionForCountry.mockRejectedValue(new Error('Country not found'));
      await expect(controller.getRegion('XX')).rejects.toThrow('Country not found');
    });
  });

  // ── upsertRegion ──

  describe('upsertRegion', () => {
    it('delegates dto to service', async () => {
      const dto = { name: 'south-asia', countries: ['NP', 'IN'] } as any;
      geo.upsertRegionConfig.mockResolvedValue({ id: 'r1' } as any);

      const result = await controller.upsertRegion(dto);

      expect(geo.upsertRegionConfig).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ id: 'r1' });
    });
  });

  // ── getRoutingHints ──

  describe('getRoutingHints', () => {
    it('delegates country to service', async () => {
      geo.getRoutingHints.mockResolvedValue({ db: 'ap-south-1' } as any);

      const result = await controller.getRoutingHints('NP');

      expect(geo.getRoutingHints).toHaveBeenCalledWith('NP');
      expect(result).toEqual({ db: 'ap-south-1' });
    });
  });

  // ── simulateFailover ──

  describe('simulateFailover', () => {
    it('delegates dto fields to service', async () => {
      const dto = { fromRegion: 'south-asia', toRegion: 'east-asia' } as any;
      geo.simulateFailover.mockResolvedValue({ success: true } as any);

      const result = await controller.simulateFailover(dto);

      expect(geo.simulateFailover).toHaveBeenCalledWith('south-asia', 'east-asia');
      expect(result).toEqual({ success: true });
    });
  });

  // ── seedRegions ──

  describe('seedRegions', () => {
    it('delegates to service', async () => {
      geo.seedRegions.mockResolvedValue({ seeded: 5 } as any);

      const result = await controller.seedRegions();

      expect(geo.seedRegions).toHaveBeenCalled();
      expect(result).toEqual({ seeded: 5 });
    });

    it('propagates service error', async () => {
      geo.seedRegions.mockRejectedValue(new Error('Seed failed'));
      await expect(controller.seedRegions()).rejects.toThrow('Seed failed');
    });
  });
});
