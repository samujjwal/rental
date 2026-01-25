import { Test, TestingModule } from '@nestjs/testing';
import { MessagesService } from './messages.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('MessagesService', () => {
  let service: MessagesService;
  let prisma: PrismaService;

  const mockPrismaService = {
    conversation: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    message: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    messageReadReceipt: {
      create: jest.fn(),
      createMany: jest.fn(),
      upsert: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('sendMessage', () => {
    const userId = 'user-1';
    const dto = {
      conversationId: 'conv-1',
      content: 'Hello world',
      attachments: ['url1'],
    };

    it('should create message and update conversation', async () => {
      // Mock verify participant
      mockPrismaService.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        participants: [{ userId: 'user-1' }, { userId: 'user-2' }],
      });

      mockPrismaService.message.create.mockResolvedValue({
        id: 'msg-1',
        content: 'Hello world',
        senderId: userId,
      });

      const result = await service.sendMessage(userId, dto);

      expect(mockPrismaService.conversation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: dto.conversationId } }),
      );
      expect(mockPrismaService.message.create).toHaveBeenCalled();
      expect(mockPrismaService.conversation.update).toHaveBeenCalledWith({
        where: { id: dto.conversationId },
        data: expect.any(Object),
      });
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException if conversation not found', async () => {
      mockPrismaService.conversation.findUnique.mockResolvedValue(null);

      await expect(service.sendMessage(userId, dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user not participant', async () => {
      mockPrismaService.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        participants: [{ userId: 'user-2' }, { userId: 'user-3' }],
      });

      await expect(service.sendMessage(userId, dto)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getConversationMessages', () => {
    const userId = 'user-1';
    const conversationId = 'conv-1';

    it('should return messages if user is participant', async () => {
      mockPrismaService.conversation.findUnique.mockResolvedValue({
        id: conversationId,
        participants: [{ userId }],
      });
      mockPrismaService.message.findMany.mockResolvedValue([{ id: 'msg-1' }]);
      mockPrismaService.message.count.mockResolvedValue(1);

      const result = await service.getConversationMessages(conversationId, userId);

      expect(result.messages).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('markAsRead', () => {
    const userId = 'user-1';
    const messageId = 'msg-1';

    it('should mark message as read', async () => {
      mockPrismaService.message.findUnique.mockResolvedValue({
        id: messageId,
        senderId: 'user-2', // sender is different
        conversation: {
          participants: [{ userId: 'user-1' }, { userId: 'user-2' }],
        },
      });

      const updatedMessage = { id: messageId, senderId: 'user-2' };
      // Note: service now returns the original message object, unrelated to upsert result

      const result = await service.markAsRead(messageId, userId);

      expect(mockPrismaService.messageReadReceipt.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { messageId_userId: { messageId, userId } },
        }),
      );
      expect(result).toEqual(expect.objectContaining({ id: messageId }));
    });

    it('should throw forbidden if user tries to mark own message as read', async () => {
      mockPrismaService.message.findUnique.mockResolvedValue({
        id: messageId,
        senderId: userId, // sender is SAME
        conversation: {
          participants: [{ userId: 'user-1' }, { userId: 'user-2' }],
        },
      });

      await expect(service.markAsRead(messageId, userId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('markConversationAsRead', () => {
    const userId = 'user-1';
    const conversationId = 'conv-1';

    it('should mark unread messages as read', async () => {
      mockPrismaService.conversation.findUnique.mockResolvedValue({
        id: conversationId,
        participants: [{ userId }],
      });

      // Unread messages
      mockPrismaService.message.findMany.mockResolvedValue([{ id: 'msg-1' }, { id: 'msg-2' }]);

      mockPrismaService.messageReadReceipt.createMany.mockResolvedValue({ count: 2 });

      const result = await service.markConversationAsRead(conversationId, userId);

      expect(mockPrismaService.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            conversationId,
            senderId: { not: userId },
            readReceipts: { none: { userId } },
          },
        }),
      );
      expect(mockPrismaService.messageReadReceipt.createMany).toHaveBeenCalled();
      expect(result).toBe(2);
    });
  });
});
