import { Test, TestingModule } from '@nestjs/testing';
import { AiConciergeService } from './ai-concierge.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';

describe('AiConciergeService', () => {
  let service: AiConciergeService;
  let prisma: any;

  const mockConversation = {
    id: 'conv-1',
    userId: 'user-1',
    sessionId: 'sess-abc123',
    agentType: 'GENERAL',
    status: 'ACTIVE',
    context: {},
    turns: [],
    createdAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      aiConversation: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'conv-1', ...data, turns: [] })),
        findUnique: jest.fn().mockResolvedValue({ ...mockConversation, turns: [] }),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...mockConversation, ...data })),
      },
      aiConversationTurn: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'turn-1', ...data })),
        findMany: jest.fn().mockResolvedValue([]),
      },
      listing: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'listing-1', title: 'Cozy Room', price: 2000, city: 'Kathmandu' },
        ]),
      },
      booking: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      userSearchProfile: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiConciergeService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('GharBatai') } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<AiConciergeService>(AiConciergeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('startSession', () => {
    it('should create a new conversation session', async () => {
      const result = await service.startSession('user-1', 'GENERAL', {});
      expect(result).toBeDefined();
      expect(prisma.aiConversation.create).toHaveBeenCalled();
    });
  });

  describe('classifyIntent', () => {
    it('should classify search intent', async () => {
      const intent = await service.classifyIntent('I want to search for a room in Kathmandu');
      expect(intent.name).toBe('SEARCH_LISTING');
    });

    it('should classify booking help intent', async () => {
      const intent = await service.classifyIntent('Help me with my booking');
      expect(intent.name).toBe('BOOKING_HELP');
    });

    it('should classify price inquiry intent', async () => {
      const intent = await service.classifyIntent('How much does it cost?');
      expect(intent.name).toBe('PRICE_INQUIRY');
    });

    it('should default to GENERAL for unrecognized input', async () => {
      const intent = await service.classifyIntent('Hello there');
      expect(intent.name).toBe('GENERAL');
    });
  });

  describe('processMessage', () => {
    it('should process a user message and return response', async () => {
      prisma.aiConversation.findUnique.mockResolvedValue({
        ...mockConversation,
        turns: [],
      });
      prisma.aiConversationTurn.findMany.mockResolvedValue([]);

      const result = await service.processMessage('sess-abc123', 'Find me a room');
      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
      expect(prisma.aiConversationTurn.create).toHaveBeenCalled();
    });
  });

  describe('getRecommendations', () => {
    it('should return personalized recommendations', async () => {
      const result = await service.getRecommendations('user-1', 5);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('endSession', () => {
    it('should mark session as completed', async () => {
      await service.endSession('sess-abc123', 5);
      expect(prisma.aiConversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sessionId: 'sess-abc123' },
        }),
      );
    });
  });
});
