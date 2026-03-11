import { Test, TestingModule } from '@nestjs/testing';
import { LiquidityController } from './liquidity.controller';
import { LiquidityEngineService } from '../services/liquidity-engine.service';

describe('LiquidityController', () => {
  let controller: LiquidityController;
  let liquidityEngine: jest.Mocked<LiquidityEngineService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LiquidityController],
      providers: [
        {
          provide: LiquidityEngineService,
          useValue: {
            calculateHealthMetrics: jest.fn(),
            getHealthHistory: jest.fn(),
            identifySupplyGaps: jest.fn(),
            createActivationCampaign: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(LiquidityController);
    liquidityEngine = module.get(LiquidityEngineService) as jest.Mocked<LiquidityEngineService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── getHealthMetrics ──

  describe('getHealthMetrics', () => {
    it('delegates query fields to service', async () => {
      const query = { country: 'NP', region: 'bagmati' } as any;
      liquidityEngine.calculateHealthMetrics.mockResolvedValue({ score: 0.75 } as any);

      const result = await controller.getHealthMetrics(query);

      expect(liquidityEngine.calculateHealthMetrics).toHaveBeenCalledWith('NP', 'bagmati');
      expect(result).toEqual({ score: 0.75 });
    });

    it('propagates service error', async () => {
      liquidityEngine.calculateHealthMetrics.mockRejectedValue(new Error('Metrics failed'));
      await expect(controller.getHealthMetrics({ country: 'NP' } as any)).rejects.toThrow('Metrics failed');
    });
  });

  // ── getHealthHistory ──

  describe('getHealthHistory', () => {
    it('delegates query fields to service', async () => {
      const query = { country: 'NP', days: 30, region: 'bagmati' } as any;
      liquidityEngine.getHealthHistory.mockResolvedValue([{ date: '2026-01-01' }] as any);

      const result = await controller.getHealthHistory(query);

      expect(liquidityEngine.getHealthHistory).toHaveBeenCalledWith('NP', 30, 'bagmati');
      expect(result).toEqual([{ date: '2026-01-01' }]);
    });
  });

  // ── identifySupplyGaps ──

  describe('identifySupplyGaps', () => {
    it('delegates threshold to service', async () => {
      const query = { threshold: 0.5 } as any;
      liquidityEngine.identifySupplyGaps.mockResolvedValue([{ region: 'lumbini' }] as any);

      const result = await controller.identifySupplyGaps(query);

      expect(liquidityEngine.identifySupplyGaps).toHaveBeenCalledWith(0.5);
      expect(result).toEqual([{ region: 'lumbini' }]);
    });
  });

  // ── createCampaign ──

  describe('createCampaign', () => {
    it('converts date strings to Date objects', async () => {
      const dto = {
        name: 'Summer Push',
        country: 'NP',
        startDate: '2026-06-01',
        endDate: '2026-08-31',
      } as any;
      liquidityEngine.createActivationCampaign.mockResolvedValue({ id: 'c1' } as any);

      const result = await controller.createCampaign(dto);

      expect(liquidityEngine.createActivationCampaign).toHaveBeenCalledWith({
        ...dto,
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-08-31'),
      });
      expect(result).toEqual({ id: 'c1' });
    });

    it('propagates service error', async () => {
      liquidityEngine.createActivationCampaign.mockRejectedValue(new Error('Invalid dates'));
      await expect(
        controller.createCampaign({ startDate: 'bad', endDate: 'bad' } as any),
      ).rejects.toThrow('Invalid dates');
    });
  });
});
