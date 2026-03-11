import { Test, TestingModule } from '@nestjs/testing';
import { FraudIntelligenceController } from './fraud-intelligence.controller';
import { FraudIntelligenceService } from '../services/fraud-intelligence.service';

describe('FraudIntelligenceController', () => {
  let controller: FraudIntelligenceController;
  let fraud: jest.Mocked<FraudIntelligenceService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FraudIntelligenceController],
      providers: [
        {
          provide: FraudIntelligenceService,
          useValue: {
            analyzeRisk: jest.fn(),
            registerDevice: jest.fn(),
            getSignals: jest.fn(),
            resolveSignal: jest.fn(),
            getUserRiskScore: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(FraudIntelligenceController);
    fraud = module.get(FraudIntelligenceService) as jest.Mocked<FraudIntelligenceService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── analyzeRisk ──

  describe('analyzeRisk', () => {
    it('delegates dto fields to service', async () => {
      const dto = { entityType: 'booking', entityId: 'b1', context: { ip: '1.2.3.4' } } as any;
      fraud.analyzeRisk.mockResolvedValue({ riskLevel: 'low' } as any);

      const result = await controller.analyzeRisk(dto);

      expect(fraud.analyzeRisk).toHaveBeenCalledWith('booking', 'b1', { ip: '1.2.3.4' });
      expect(result).toEqual({ riskLevel: 'low' });
    });

    it('propagates service error', async () => {
      fraud.analyzeRisk.mockRejectedValue(new Error('Analysis failed'));
      await expect(controller.analyzeRisk({} as any)).rejects.toThrow('Analysis failed');
    });
  });

  // ── registerDevice ──

  describe('registerDevice', () => {
    it('delegates userId and dto fields to service', async () => {
      const dto = { fingerprint: 'fp123', metadata: { browser: 'chrome' } } as any;
      fraud.registerDevice.mockResolvedValue({ id: 'dev1' } as any);

      const result = await controller.registerDevice('u1', dto);

      expect(fraud.registerDevice).toHaveBeenCalledWith('u1', 'fp123', { browser: 'chrome' });
      expect(result).toEqual({ id: 'dev1' });
    });
  });

  // ── getSignals ──

  describe('getSignals', () => {
    it('delegates params to service', async () => {
      fraud.getSignals.mockResolvedValue([{ id: 's1' }] as any);

      const result = await controller.getSignals('user', 'u1');

      expect(fraud.getSignals).toHaveBeenCalledWith('user', 'u1');
      expect(result).toEqual([{ id: 's1' }]);
    });
  });

  // ── resolveSignal ──

  describe('resolveSignal', () => {
    it('delegates signalId and dto.resolvedBy to service', async () => {
      const dto = { resolvedBy: 'admin1' } as any;
      fraud.resolveSignal.mockResolvedValue({ resolved: true } as any);

      const result = await controller.resolveSignal('s1', dto);

      expect(fraud.resolveSignal).toHaveBeenCalledWith('s1', 'admin1');
      expect(result).toEqual({ resolved: true });
    });
  });

  // ── getUserRiskScore ──

  describe('getUserRiskScore', () => {
    it('delegates userId to service', async () => {
      fraud.getUserRiskScore.mockResolvedValue({ score: 15 } as any);

      const result = await controller.getUserRiskScore('u1');

      expect(fraud.getUserRiskScore).toHaveBeenCalledWith('u1');
      expect(result).toEqual({ score: 15 });
    });

    it('propagates service error', async () => {
      fraud.getUserRiskScore.mockRejectedValue(new Error('User not found'));
      await expect(controller.getUserRiskScore('bad')).rejects.toThrow('User not found');
    });
  });
});
