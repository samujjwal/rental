import { Test, TestingModule } from '@nestjs/testing';
import { AiConciergeController } from './ai-concierge.controller';
import { AiConciergeService } from '../services/ai-concierge.service';

describe('AiConciergeController', () => {
  let controller: AiConciergeController;
  let service: jest.Mocked<AiConciergeService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiConciergeController],
      providers: [
        {
          provide: AiConciergeService,
          useValue: {
            startSession: jest.fn(),
            processMessage: jest.fn(),
            endSession: jest.fn(),
            getConversationHistory: jest.fn(),
            getRecommendations: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(AiConciergeController);
    service = module.get(AiConciergeService) as jest.Mocked<AiConciergeService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── startSession ──

  describe('startSession', () => {
    it('delegates userId, agentType, and initialContext', async () => {
      const dto = { agentType: 'booking', initialContext: { listingId: 'l1' } };
      service.startSession.mockResolvedValue({ sessionId: 's1' } as any);

      const result = await controller.startSession('u1', dto as any);

      expect(service.startSession).toHaveBeenCalledWith('u1', 'booking', { listingId: 'l1' });
      expect(result).toEqual({ sessionId: 's1' });
    });

    it('propagates service error', async () => {
      service.startSession.mockRejectedValue(new Error('Agent not available'));
      await expect(controller.startSession('u1', {} as any)).rejects.toThrow('Agent not available');
    });
  });

  // ── processMessage ──

  describe('processMessage', () => {
    it('delegates sessionId and message', async () => {
      const dto = { message: 'What is the cancellation policy?' };
      service.processMessage.mockResolvedValue({ reply: 'You can cancel up to 24h before.' } as any);

      const result = await controller.processMessage('s1', dto as any);

      expect(service.processMessage).toHaveBeenCalledWith('s1', 'What is the cancellation policy?');
      expect(result).toEqual({ reply: 'You can cancel up to 24h before.' });
    });

    it('propagates service error', async () => {
      service.processMessage.mockRejectedValue(new Error('Session expired'));
      await expect(controller.processMessage('s1', { message: 'hi' } as any)).rejects.toThrow('Session expired');
    });
  });

  // ── endSession ──

  describe('endSession', () => {
    it('delegates sessionId and satisfaction', async () => {
      const dto = { satisfaction: 5 };
      service.endSession.mockResolvedValue({ ended: true } as any);

      const result = await controller.endSession('s1', dto as any);

      expect(service.endSession).toHaveBeenCalledWith('s1', 5);
      expect(result).toEqual({ ended: true });
    });
  });

  // ── getHistory ──

  describe('getHistory', () => {
    it('delegates sessionId to service', async () => {
      service.getConversationHistory.mockResolvedValue([{ role: 'user', message: 'hi' }] as any);

      const result = await controller.getHistory('s1');

      expect(service.getConversationHistory).toHaveBeenCalledWith('s1');
      expect(result).toEqual([{ role: 'user', message: 'hi' }]);
    });
  });

  // ── getRecommendations ──

  describe('getRecommendations', () => {
    it('uses default limit of 10 when not provided', async () => {
      service.getRecommendations.mockResolvedValue([{ listingId: 'l1' }] as any);

      const result = await controller.getRecommendations('u1');

      expect(service.getRecommendations).toHaveBeenCalledWith('u1', 10);
      expect(result).toEqual([{ listingId: 'l1' }]);
    });

    it('passes custom limit', async () => {
      service.getRecommendations.mockResolvedValue([] as any);

      await controller.getRecommendations('u1', 5);

      expect(service.getRecommendations).toHaveBeenCalledWith('u1', 5);
    });

    it('propagates service error', async () => {
      service.getRecommendations.mockRejectedValue(new Error('User not found'));
      await expect(controller.getRecommendations('bad')).rejects.toThrow('User not found');
    });
  });
});
