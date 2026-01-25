import { Test, TestingModule } from '@nestjs/testing';
import { ConversationsService } from './conversations.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('ConversationsService', () => {
  let service: ConversationsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    listing: {
      findUnique: jest.fn(),
    },
    conversation: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ConversationsService>(ConversationsService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('createOrGetConversation', () => {
    const userId = 'user-1';
    const dto = {
      listingId: 'listing-1',
      participantId: 'user-2',
    };

    it('should return existing conversation if found', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue({ id: 'listing-1' });
      const existingConv = { id: 'conv-1', type: 'BOOKING' };
      mockPrismaService.conversation.findFirst.mockResolvedValue(existingConv);

      const result = await service.createOrGetConversation(userId, dto);

      expect(mockPrismaService.listing.findUnique).toHaveBeenCalled();
      expect(mockPrismaService.conversation.findFirst).toHaveBeenCalled();
      expect(mockPrismaService.conversation.create).not.toHaveBeenCalled();
      expect(result).toEqual(existingConv);
    });

    it('should create new conversation if not found', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue({ id: 'listing-1' });
      mockPrismaService.conversation.findFirst.mockResolvedValue(null);

      const newConv = { id: 'conv-2', type: 'BOOKING' };
      mockPrismaService.conversation.create.mockResolvedValue(newConv);

      const result = await service.createOrGetConversation(userId, dto);

      expect(mockPrismaService.conversation.create).toHaveBeenCalled();
      expect(result).toEqual(newConv);
    });

    it('should throw NotFoundException if listing missing', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue(null);
      await expect(service.createOrGetConversation(userId, dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUserConversations', () => {
    const userId = 'user-1';

    it('should return conversations list', async () => {
      const conversations = [
        {
          id: 'conv-1',
          _count: { messages: 2 },
          messages: [{ id: 'msg-1' }],
        },
      ];
      mockPrismaService.conversation.findMany.mockResolvedValue(conversations);
      mockPrismaService.conversation.count.mockResolvedValue(1);

      const result = await service.getUserConversations(userId);

      expect(result.conversations).toBeDefined();
      expect(result.total).toBe(1);
      expect(result.conversations[0].unreadCount).toBe(2);
    });
  });

  describe('getConversation', () => {
    const userId = 'user-1';
    const conversationId = 'conv-1';

    it('should return conversation if user is participant', async () => {
      const conv = {
        id: conversationId,
        participants: [{ userId: 'user-1' }, { userId: 'user-2' }],
        _count: { messages: 0 },
      };
      mockPrismaService.conversation.findUnique.mockResolvedValue(conv);

      const result = await service.getConversation(conversationId, userId);

      expect(result.id).toBe(conversationId);
    });

    it('should throw Forbidden if user not participant', async () => {
      const conv = {
        id: conversationId,
        participants: [{ userId: 'user-2' }, { userId: 'user-3' }],
        _count: { messages: 0 },
      };
      mockPrismaService.conversation.findUnique.mockResolvedValue(conv);

      await expect(service.getConversation(conversationId, userId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
