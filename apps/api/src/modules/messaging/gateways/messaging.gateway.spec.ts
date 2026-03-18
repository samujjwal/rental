import { Logger } from '@nestjs/common';
import { MessagingGateway } from './messaging.gateway';
import { MessagesService } from '../services/messages.service';
import { ConversationsService } from '../services/conversations.service';
import { WsJwtAuthGuard } from '@/modules/auth/guards/ws-jwt-auth.guard';
import { NotificationsService } from '@/modules/notifications/services/notifications.service';

/* ---------- helpers ---------- */

function fakeSocket(userId = 'user-1', id = 'sock-1'): any {
  return {
    id,
    userId,
    data: {},
    handshake: { auth: {} },
    emit: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
    to: jest.fn().mockReturnThis(),
    disconnect: jest.fn(),
  };
}

function fakeServer(): any {
  const srv: any = {
    emit: jest.fn(),
    to: jest.fn().mockReturnValue({ emit: jest.fn() }),
  };
  return srv;
}

describe('MessagingGateway', () => {
  let gateway: MessagingGateway;
  let messagesService: jest.Mocked<MessagesService>;
  let conversationsService: jest.Mocked<ConversationsService>;
  let wsAuthGuard: jest.Mocked<WsJwtAuthGuard>;
  let notificationsService: jest.Mocked<NotificationsService>;

  beforeEach(() => {
    messagesService = {
      sendMessage: jest.fn(),
      markAsRead: jest.fn(),
      markConversationAsRead: jest.fn(),
    } as any;

    conversationsService = {
      canUserMessage: jest.fn(),
      getTotalUnreadCount: jest.fn().mockResolvedValue(3),
      getConversation: jest.fn(),
    } as any;

    wsAuthGuard = {
      authenticateClient: jest.fn(),
      canActivate: jest.fn(),
    } as any;

    notificationsService = {
      sendNotification: jest.fn().mockResolvedValue(undefined)
    } as any;

    const cacheService = {
      getPubClient: jest.fn().mockReturnValue(null),
      getSubClient: jest.fn().mockReturnValue(null),
    } as any;

    // Instantiate directly — avoids NestJS DI trying to resolve guard deps
    gateway = new MessagingGateway(messagesService, conversationsService, wsAuthGuard, notificationsService, cacheService);
    gateway.server = fakeServer();

    // Suppress noisy logs
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  /* ================================================================== */
  /*  handleConnection                                                   */
  /* ================================================================== */
  describe('handleConnection', () => {
    it('authenticates the client and tracks the socket', async () => {
      wsAuthGuard.authenticateClient.mockResolvedValue({ userId: 'u1', email: 'a@b.com' } as any);
      const client = fakeSocket('', 'sock-1');

      const toEmit = jest.fn();
      gateway.server.to = jest.fn().mockReturnValue({ emit: toEmit });

      await gateway.handleConnection(client);

      expect(client.userId).toBe('u1');
      expect(client.emit).toHaveBeenCalledWith('unread_count', { count: 3 });
      expect(gateway.server.to).toHaveBeenCalledWith('user:u1');
      expect(toEmit).toHaveBeenCalledWith('user_status', { userId: 'u1', status: 'online' });
    });

    it('disconnects on auth failure', async () => {
      wsAuthGuard.authenticateClient.mockRejectedValue(new Error('bad token'));
      const client = fakeSocket();
      await gateway.handleConnection(client);
      expect(client.disconnect).toHaveBeenCalled();
    });
  });

  /* ================================================================== */
  /*  handleDisconnect                                                   */
  /* ================================================================== */
  describe('handleDisconnect', () => {
    it('broadcasts offline when last socket disconnects', async () => {
      wsAuthGuard.authenticateClient.mockResolvedValue({ userId: 'u1', email: '' } as any);
      const client = fakeSocket('', 'sock-1');
      await gateway.handleConnection(client);

      // Reset to isolate disconnect broadcast
      const toEmit = jest.fn();
      gateway.server.to = jest.fn().mockReturnValue({ emit: toEmit });

      await gateway.handleDisconnect(client);

      expect(gateway.server.to).toHaveBeenCalledWith('user:u1');
      expect(toEmit).toHaveBeenCalledWith('user_status', { userId: 'u1', status: 'offline' });
    });

    it('does NOT broadcast offline when user has other active sockets', async () => {
      wsAuthGuard.authenticateClient.mockResolvedValue({ userId: 'u1', email: '' } as any);

      const s1 = fakeSocket('', 'sock-1');
      const s2 = fakeSocket('', 'sock-2');
      await gateway.handleConnection(s1);
      await gateway.handleConnection(s2);

      const toEmit = jest.fn();
      gateway.server.to = jest.fn().mockReturnValue({ emit: toEmit });
      await gateway.handleDisconnect(s1);

      // Should NOT emit offline because s2 is still connected
      expect(toEmit).not.toHaveBeenCalledWith(
        'user_status',
        expect.objectContaining({ status: 'offline' }),
      );
    });

    it('handles disconnect for unauthenticated socket gracefully', async () => {
      const client = fakeSocket(undefined);
      await gateway.handleDisconnect(client);
      // Should not throw
    });
  });

  /* ================================================================== */
  /*  handleJoinConversation                                             */
  /* ================================================================== */
  describe('handleJoinConversation', () => {
    it('joins conversation room and emits joined event', async () => {
      conversationsService.canUserMessage.mockResolvedValue(true);
      messagesService.markConversationAsRead.mockResolvedValue(0);

      const client = fakeSocket('u1');
      await gateway.handleJoinConversation(client, { conversationId: 'conv-1' });

      expect(client.join).toHaveBeenCalledWith('conversation:conv-1');
      expect(client.emit).toHaveBeenCalledWith('joined_conversation', { conversationId: 'conv-1' });
    });

    it('emits error when user is not authorized', async () => {
      conversationsService.canUserMessage.mockResolvedValue(false);
      const client = fakeSocket('u1');

      await gateway.handleJoinConversation(client, { conversationId: 'conv-1' });

      expect(client.emit).toHaveBeenCalledWith('error', { message: 'Not authorized to join conversation' });
      expect(client.join).not.toHaveBeenCalled();
    });

    it('notifies room when messages are marked as read', async () => {
      conversationsService.canUserMessage.mockResolvedValue(true);
      messagesService.markConversationAsRead.mockResolvedValue(5);

      const toEmit = jest.fn();
      gateway.server.to = jest.fn().mockReturnValue({ emit: toEmit });

      const client = fakeSocket('u1');
      await gateway.handleJoinConversation(client, { conversationId: 'conv-1' });

      expect(gateway.server.to).toHaveBeenCalledWith('conversation:conv-1');
      expect(toEmit).toHaveBeenCalledWith('messages_read', { conversationId: 'conv-1', userId: 'u1' });
    });
  });

  /* ================================================================== */
  /*  handleLeaveConversation                                            */
  /* ================================================================== */
  describe('handleLeaveConversation', () => {
    it('leaves the conversation room', () => {
      const client = fakeSocket('u1');
      gateway.handleLeaveConversation(client, { conversationId: 'conv-1' });

      expect(client.leave).toHaveBeenCalledWith('conversation:conv-1');
      expect(client.emit).toHaveBeenCalledWith('left_conversation', { conversationId: 'conv-1' });
    });
  });

  /* ================================================================== */
  /*  handleSendMessage                                                  */
  /* ================================================================== */
  describe('handleSendMessage', () => {
    it('creates message and broadcasts to conversation room', async () => {
      const msg = { id: 'm1', conversationId: 'conv-1' };
      messagesService.sendMessage.mockResolvedValue(msg as any);
      conversationsService.getConversation.mockResolvedValue({
        participants: [{ userId: 'u1' }, { userId: 'u2' }],
      } as any);

      const toEmit = jest.fn();
      gateway.server.to = jest.fn().mockReturnValue({ emit: toEmit });

      const client = fakeSocket('u1');
      const result = await gateway.handleSendMessage(client, {
        conversationId: 'conv-1',
        content: 'Hello',
      } as any);

      expect(result).toEqual({ success: true, message: msg });
      expect(gateway.server.to).toHaveBeenCalledWith('conversation:conv-1');
      expect(toEmit).toHaveBeenCalledWith('new_message', msg);
    });

    it('returns error on failure', async () => {
      messagesService.sendMessage.mockRejectedValue(new Error('DB error'));
      const client = fakeSocket('u1');

      const result = await gateway.handleSendMessage(client, {
        conversationId: 'conv-1',
        content: 'x',
      } as any);

      expect(result).toEqual({ success: false, error: 'An error occurred' });
      expect(client.emit).toHaveBeenCalledWith('error', { message: 'An error occurred. Please try again.' });
    });
  });

  /* ================================================================== */
  /*  handleTyping                                                       */
  /* ================================================================== */
  describe('handleTyping', () => {
    it('broadcasts typing event to conversation room except sender', () => {
      const toEmit = jest.fn();
      const client = fakeSocket('u1');
      client.to = jest.fn().mockReturnValue({ emit: toEmit });

      gateway.handleTyping(client, { conversationId: 'conv-1', isTyping: true });

      expect(client.to).toHaveBeenCalledWith('conversation:conv-1');
      expect(toEmit).toHaveBeenCalledWith('user_typing', {
        conversationId: 'conv-1',
        userId: 'u1',
        isTyping: true,
      });
    });
  });

  /* ================================================================== */
  /*  handleMarkRead                                                     */
  /* ================================================================== */
  describe('handleMarkRead', () => {
    it('marks message as read and notifies sender', async () => {
      // First connect the sender so their sockets are tracked
      wsAuthGuard.authenticateClient.mockResolvedValue({ userId: 'sender-1', email: '' } as any);
      const senderSocket = fakeSocket('', 'sender-sock');
      await gateway.handleConnection(senderSocket);

      messagesService.markAsRead.mockResolvedValue({
        id: 'm1',
        senderId: 'sender-1',
        conversationId: 'conv-1',
      } as any);

      const toEmit = jest.fn();
      gateway.server.to = jest.fn().mockReturnValue({ emit: toEmit });

      const client = fakeSocket('u1');
      const result = await gateway.handleMarkRead(client, { messageId: 'm1' });

      expect(result).toEqual({ success: true });
      expect(gateway.server.to).toHaveBeenCalledWith('sender-sock');
      expect(toEmit).toHaveBeenCalledWith('message_read', {
        messageId: 'm1',
        conversationId: 'conv-1',
        readBy: 'u1',
      });
    });

    it('returns error on failure', async () => {
      messagesService.markAsRead.mockRejectedValue(new Error('not found'));
      const client = fakeSocket('u1');

      const result = await gateway.handleMarkRead(client, { messageId: 'bad' });
      expect(result).toEqual({ success: false, error: 'An error occurred' });
    });
  });

  /* ================================================================== */
  /*  sendToUser / notifyNewConversation                                 */
  /* ================================================================== */
  describe('sendToUser', () => {
    it('emits event to all of the user sockets', async () => {
      wsAuthGuard.authenticateClient.mockResolvedValue({ userId: 'u1', email: '' } as any);
      const s1 = fakeSocket('', 's1');
      const s2 = fakeSocket('', 's2');
      await gateway.handleConnection(s1);
      await gateway.handleConnection(s2);

      const toEmit = jest.fn();
      gateway.server.to = jest.fn().mockReturnValue({ emit: toEmit });

      gateway.sendToUser('u1', 'test_event', { hello: 'world' });

      expect(gateway.server.to).toHaveBeenCalledWith('s1');
      expect(gateway.server.to).toHaveBeenCalledWith('s2');
      expect(toEmit).toHaveBeenCalledWith('test_event', { hello: 'world' });
    });
  });

  describe('notifyNewConversation', () => {
    it('sends new_conversation event to user', async () => {
      wsAuthGuard.authenticateClient.mockResolvedValue({ userId: 'u1', email: '' } as any);
      await gateway.handleConnection(fakeSocket('', 's1'));

      const toEmit = jest.fn();
      gateway.server.to = jest.fn().mockReturnValue({ emit: toEmit });

      gateway.notifyNewConversation('u1', { id: 'conv-1' });

      expect(toEmit).toHaveBeenCalledWith('new_conversation', { id: 'conv-1' });
    });
  });
});
