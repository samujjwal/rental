import { Test, TestingModule } from '@nestjs/testing';
import { ExpansionController } from './expansion.controller';
import { ExpansionPlannerService } from '../services/expansion-planner.service';

describe('ExpansionController', () => {
  let controller: ExpansionController;
  let planner: jest.Mocked<ExpansionPlannerService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExpansionController],
      providers: [
        {
          provide: ExpansionPlannerService,
          useValue: {
            evaluateMarket: jest.fn(),
            simulateExpansion: jest.fn(),
            getRankedOpportunities: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(ExpansionController);
    planner = module.get(ExpansionPlannerService) as jest.Mocked<ExpansionPlannerService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── evaluateMarket ──

  describe('evaluateMarket', () => {
    it('delegates dto.country to service', async () => {
      const dto = { country: 'NP' } as any;
      planner.evaluateMarket.mockResolvedValue({ readinessScore: 0.8 } as any);

      const result = await controller.evaluateMarket(dto);

      expect(planner.evaluateMarket).toHaveBeenCalledWith('NP');
      expect(result).toEqual({ readinessScore: 0.8 });
    });

    it('propagates service error', async () => {
      planner.evaluateMarket.mockRejectedValue(new Error('Evaluation failed'));
      await expect(controller.evaluateMarket({ country: 'XX' } as any)).rejects.toThrow('Evaluation failed');
    });
  });

  // ── simulateExpansion ──

  describe('simulateExpansion', () => {
    it('delegates country param to service', async () => {
      planner.simulateExpansion.mockResolvedValue({ projected: true } as any);

      const result = await controller.simulateExpansion('IN');

      expect(planner.simulateExpansion).toHaveBeenCalledWith('IN');
      expect(result).toEqual({ projected: true });
    });
  });

  // ── getRankedOpportunities ──

  describe('getRankedOpportunities', () => {
    it('delegates to service with no args', async () => {
      planner.getRankedOpportunities.mockResolvedValue([{ country: 'NP' }] as any);

      const result = await controller.getRankedOpportunities();

      expect(planner.getRankedOpportunities).toHaveBeenCalled();
      expect(result).toEqual([{ country: 'NP' }]);
    });

    it('propagates service error', async () => {
      planner.getRankedOpportunities.mockRejectedValue(new Error('DB error'));
      await expect(controller.getRankedOpportunities()).rejects.toThrow('DB error');
    });
  });
});
