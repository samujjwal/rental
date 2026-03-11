import { Test, TestingModule } from '@nestjs/testing';
import { PricingIntelligenceController } from './pricing-intelligence.controller';
import { PricingIntelligenceService } from '../services/pricing-intelligence.service';

describe('PricingIntelligenceController', () => {
  let controller: PricingIntelligenceController;
  let service: jest.Mocked<PricingIntelligenceService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PricingIntelligenceController],
      providers: [
        {
          provide: PricingIntelligenceService,
          useValue: {
            generateRecommendation: jest.fn(),
            getRecommendationHistory: jest.fn(),
            autoAcceptRecommendations: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(PricingIntelligenceController);
    service = module.get(PricingIntelligenceService) as jest.Mocked<PricingIntelligenceService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── getRecommendation ──

  describe('getRecommendation', () => {
    it('passes listingId and converted targetDate', async () => {
      const query = { listingId: 'l1', targetDate: '2026-05-01' };
      service.generateRecommendation.mockResolvedValue({ price: 150 } as any);

      const result = await controller.getRecommendation(query as any);

      expect(service.generateRecommendation).toHaveBeenCalledWith('l1', new Date('2026-05-01'));
      expect(result).toEqual({ price: 150 });
    });

    it('uses current date when targetDate is not provided', async () => {
      const query = { listingId: 'l1' };
      service.generateRecommendation.mockResolvedValue({ price: 120 } as any);

      const before = new Date();
      await controller.getRecommendation(query as any);
      const after = new Date();

      const callArg = service.generateRecommendation.mock.calls[0][1] as Date;
      expect(callArg.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(callArg.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('propagates service error', async () => {
      service.generateRecommendation.mockRejectedValue(new Error('Listing not found'));
      await expect(controller.getRecommendation({ listingId: 'bad' } as any)).rejects.toThrow('Listing not found');
    });
  });

  // ── getHistory ──

  describe('getHistory', () => {
    it('uses default days of 30 when not provided', async () => {
      service.getRecommendationHistory.mockResolvedValue([{ price: 100 }] as any);

      const result = await controller.getHistory('l1');

      expect(service.getRecommendationHistory).toHaveBeenCalledWith('l1', 30);
      expect(result).toEqual([{ price: 100 }]);
    });

    it('passes custom days param', async () => {
      service.getRecommendationHistory.mockResolvedValue([] as any);

      await controller.getHistory('l1', 7);

      expect(service.getRecommendationHistory).toHaveBeenCalledWith('l1', 7);
    });
  });

  // ── autoAccept ──

  describe('autoAccept', () => {
    it('delegates listingId and maxDeviationPercent', async () => {
      const dto = { listingId: 'l1', maxDeviationPercent: 10 };
      service.autoAcceptRecommendations.mockResolvedValue({ accepted: 3 } as any);

      const result = await controller.autoAccept(dto as any);

      expect(service.autoAcceptRecommendations).toHaveBeenCalledWith('l1', 10);
      expect(result).toEqual({ accepted: 3 });
    });

    it('propagates service error', async () => {
      service.autoAcceptRecommendations.mockRejectedValue(new Error('No recommendations'));
      await expect(controller.autoAccept({ listingId: 'l1', maxDeviationPercent: 5 } as any)).rejects.toThrow(
        'No recommendations',
      );
    });
  });
});
