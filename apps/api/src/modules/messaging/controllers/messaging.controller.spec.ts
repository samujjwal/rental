import { Test, TestingModule } from '@nestjs/testing';
import { MessagingController } from './messaging.controller';
import { ConversationsService } from '../services/conversations.service';
import { MessagesService } from '../services/messages.service';

describe('MessagingController', () => {
  let controller: MessagingController;
  let conversationsService: jest.Mocked<ConversationsService>;
  let messagesService: jest.Mocked<MessagesService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessagingController],
      providers: [
        {
          provide: ConversationsService,
          useValue: {
            createOrGetConversation: jest.fn(),
            getUserConversations: jest.fn(),
            getTotalUnreadCount: jest.fn(),
            getConversation: jest.fn(),
            deleteConversation: jest.fn(),
          },
        },
        {
          provide: MessagesService,
          useValue: {
            getConversationMessages: jest.fn(),
            sendMessage: jest.fn(),
            markConversationAsRead: jest.fn(),
            deleteMessage: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(MessagingController);
    conversationsService = module.get(ConversationsService) as jest.Mocked<ConversationsService>;
    messagesService = module.get(MessagesService) as jest.Mocked<MessagesService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── createConversation ──
  describe('createConversation', () => {
    it('delegates to createOrGetConversation', async () => {
      const conv = { id: 'c1' };
      conversationsService.createOrGetConversation.mockResolvedValue(conv as any);
      const dto = { participantId: 'u2' } as any;
      const result = await controller.createConversation('u1', dto);
      expect(conversationsService.createOrGetConversation).toHaveBeenCalledWith('u1', dto);
      expect(result).toBe(conv);
    });
  });

  // ── getConversations ──
  describe('getConversations', () => {
    it('parses pagination params', async () => {
      conversationsService.getUserConversations.mockResolvedValue([] as any);
      await controller.getConversations('u1', 2, 10, 'hello');
      expect(conversationsService.getUserConversations).toHaveBeenCalledWith('u1', {
        page: 2,
        limit: 10,
        search: 'hello',
      });
    });

    it('passes undefined for missing pagination', async () => {
      conversationsService.getUserConversations.mockResolvedValue([] as any);
      await controller.getConversations('u1', undefined, undefined, undefined);
      expect(conversationsService.getUserConversations).toHaveBeenCalledWith('u1', {
        page: undefined,
        limit: undefined,
        search: undefined,
      });
    });
  });

  // ── getUnreadCount ──
  describe('getUnreadCount', () => {
    it('wraps count in { count }', async () => {
      conversationsService.getTotalUnreadCount.mockResolvedValue(5);
      const result = await controller.getUnreadCount('u1');
      expect(result).toEqual({ count: 5 });
    });
  });

  // ── getConversation ──
  describe('getConversation', () => {
    it('passes conversationId and userId', async () => {
      conversationsService.getConversation.mockResolvedValue({ id: 'c1' } as any);
      await controller.getConversation('c1', 'u1');
      expect(conversationsService.getConversation).toHaveBeenCalledWith('c1', 'u1');
    });
  });

  // ── deleteConversation ──
  describe('deleteConversation', () => {
    it('returns success message', async () => {
      const result = await controller.deleteConversation('c1', 'u1');
      expect(conversationsService.deleteConversation).toHaveBeenCalledWith('c1', 'u1');
      expect(result).toEqual({ message: 'Conversation deleted successfully' });
    });
  });

  // ── getMessages ──
  describe('getMessages', () => {
    it('passes parsed options', async () => {
      messagesService.getConversationMessages.mockResolvedValue([] as any);
      await controller.getMessages('c1', 'u1', 2, 20, undefined);
      expect(messagesService.getConversationMessages).toHaveBeenCalledWith('c1', 'u1', {
        page: 2,
        limit: 20,
        before: undefined,
      });
    });

    it('converts before string to Date', async () => {
      messagesService.getConversationMessages.mockResolvedValue([] as any);
      await controller.getMessages('c1', 'u1', undefined, undefined, '2025-01-01T00:00:00Z');
      expect(messagesService.getConversationMessages).toHaveBeenCalledWith('c1', 'u1', {
        page: undefined,
        limit: undefined,
        before: new Date('2025-01-01T00:00:00Z'),
      });
    });
  });

  // ── sendMessage ──
  describe('sendMessage', () => {
    it('constructs message DTO with conversationId', async () => {
      messagesService.sendMessage.mockResolvedValue({ id: 'm1' } as any);
      await controller.sendMessage('c1', 'u1', { content: 'Hello' });
      expect(messagesService.sendMessage).toHaveBeenCalledWith('u1', {
        conversationId: 'c1',
        content: 'Hello',
        attachments: undefined,
      });
    });

    it('includes attachments when provided', async () => {
      messagesService.sendMessage.mockResolvedValue({ id: 'm1' } as any);
      await controller.sendMessage('c1', 'u1', { content: 'Check this', attachments: ['file.pdf'] });
      expect(messagesService.sendMessage).toHaveBeenCalledWith('u1', {
        conversationId: 'c1',
        content: 'Check this',
        attachments: ['file.pdf'],
      });
    });
  });

  // ── markConversationAsRead ──
  describe('markConversationAsRead', () => {
    it('returns { marked: count }', async () => {
      messagesService.markConversationAsRead.mockResolvedValue(3);
      const result = await controller.markConversationAsRead('c1', 'u1');
      expect(result).toEqual({ marked: 3 });
    });
  });

  // ── deleteMessage ──
  describe('deleteMessage', () => {
    it('returns success message', async () => {
      const result = await controller.deleteMessage('m1', 'u1');
      expect(messagesService.deleteMessage).toHaveBeenCalledWith('m1', 'u1');
      expect(result).toEqual({ message: 'Message deleted successfully' });
    });
  });
});
