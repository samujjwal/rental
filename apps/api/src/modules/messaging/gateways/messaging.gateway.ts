import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { MessagesService, SendMessageDto } from '../services/messages.service';
import { ConversationsService } from '../services/conversations.service';
import { WsJwtAuthGuard } from '@/modules/auth/guards/ws-jwt-auth.guard';

interface AuthenticatedSocket extends Socket {
  userId: string;
}

@WebSocketGateway({
  namespace: '/messaging',
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
})
export class MessagingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MessagingGateway.name);
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds

  constructor(
    private messagesService: MessagesService,
    private conversationsService: ConversationsService,
  ) {}

  /**
   * Handle client connection
   */
  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Extract user ID from socket handshake (set by WsJwtAuthGuard)
      const userId = client.handshake.auth?.userId || client.handshake.query?.userId;

      if (!userId) {
        this.logger.warn(`Connection rejected: No userId provided`);
        client.disconnect();
        return;
      }

      client.userId = userId as string;

      // Track user's socket connections
      if (!this.userSockets.has(userId as string)) {
        this.userSockets.set(userId as string, new Set());
      }
      this.userSockets.get(userId as string)!.add(client.id);

      this.logger.log(`Client connected: ${client.id} (User: ${userId})`);

      // Emit online status to user's contacts
      this.broadcastUserStatus(userId as string, 'online');

      // Send unread count to client
      const unreadCount = await this.conversationsService.getTotalUnreadCount(userId as string);
      client.emit('unread_count', { count: unreadCount });
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      client.disconnect();
    }
  }

  /**
   * Handle client disconnection
   */
  async handleDisconnect(client: AuthenticatedSocket) {
    const userId = client.userId;

    if (userId) {
      // Remove socket from user's connections
      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(client.id);

        // If user has no more active connections, mark as offline
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
          this.broadcastUserStatus(userId, 'offline');
        }
      }

      this.logger.log(`Client disconnected: ${client.id} (User: ${userId})`);
    }
  }

  /**
   * Join conversation room
   */
  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    try {
      const { conversationId } = data;
      const userId = client.userId;

      // Verify user can join conversation
      const canJoin = await this.conversationsService.canUserMessage(conversationId, userId);

      if (!canJoin) {
        client.emit('error', { message: 'Not authorized to join conversation' });
        return;
      }

      // Join room
      client.join(`conversation:${conversationId}`);

      this.logger.log(
        `User ${userId} joined conversation ${conversationId} (Socket: ${client.id})`,
      );

      client.emit('joined_conversation', { conversationId });

      // Mark messages as read
      const markedCount = await this.messagesService.markConversationAsRead(conversationId, userId);

      if (markedCount > 0) {
        // Notify sender that messages were read
        this.server
          .to(`conversation:${conversationId}`)
          .emit('messages_read', { conversationId, userId });
      }
    } catch (error) {
      this.logger.error(`Error joining conversation: ${error.message}`);
      client.emit('error', { message: error.message });
    }
  }

  /**
   * Leave conversation room
   */
  @SubscribeMessage('leave_conversation')
  handleLeaveConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    const { conversationId } = data;
    client.leave(`conversation:${conversationId}`);

    this.logger.log(
      `User ${client.userId} left conversation ${conversationId} (Socket: ${client.id})`,
    );

    client.emit('left_conversation', { conversationId });
  }

  /**
   * Send message
   */
  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() dto: SendMessageDto,
  ) {
    try {
      const userId = client.userId;

      // Create message
      const message = await this.messagesService.sendMessage(userId, dto);

      // Emit to conversation room
      this.server.to(`conversation:${dto.conversationId}`).emit('new_message', message);

      // Get conversation participants to send notifications
      const conversation = await this.conversationsService.getConversation(
        dto.conversationId,
        userId,
      );

      // Send push notification to offline participants
      for (const participant of conversation.participants) {
        if (participant.userId !== userId) {
          const isOnline = this.isUserOnline(participant.userId);

          if (!isOnline) {
            // TODO: Queue push notification
            this.logger.log(`User ${participant.userId} is offline, should send push notification`);
          }
        }
      }

      return { success: true, message };
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`);
      client.emit('error', { message: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Typing indicator
   */
  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string; isTyping: boolean },
  ) {
    const { conversationId, isTyping } = data;
    const userId = client.userId;

    // Broadcast to conversation room (except sender)
    client.to(`conversation:${conversationId}`).emit('user_typing', {
      conversationId,
      userId,
      isTyping,
    });
  }

  /**
   * Mark message as read
   */
  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { messageId: string },
  ) {
    try {
      const userId = client.userId;
      const message = await this.messagesService.markAsRead(data.messageId, userId);

      // Notify sender
      const senderSockets = this.getUserSockets(message.senderId);
      for (const socketId of senderSockets) {
        this.server.to(socketId).emit('message_read', {
          messageId: message.id,
          conversationId: message.conversationId,
          readBy: userId,
        });
      }

      return { success: true };
    } catch (error) {
      this.logger.error(`Error marking message as read: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Broadcast user online/offline status
   */
  private broadcastUserStatus(userId: string, status: 'online' | 'offline') {
    // TODO: Get user's contacts and notify them
    // For now, just broadcast to all connected clients
    this.server.emit('user_status', { userId, status });
  }

  /**
   * Check if user is online
   */
  private isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0;
  }

  /**
   * Get all socket IDs for a user
   */
  private getUserSockets(userId: string): string[] {
    const sockets = this.userSockets.get(userId);
    return sockets ? Array.from(sockets) : [];
  }

  /**
   * Send message to specific user (all their sockets)
   */
  sendToUser(userId: string, event: string, data: any) {
    const socketIds = this.getUserSockets(userId);
    for (const socketId of socketIds) {
      this.server.to(socketId).emit(event, data);
    }
  }

  /**
   * Send notification about new conversation
   */
  notifyNewConversation(userId: string, conversation: any) {
    this.sendToUser(userId, 'new_conversation', conversation);
  }
}
