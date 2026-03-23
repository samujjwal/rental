import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { createAdapter } from '@socket.io/redis-adapter';
import { MessagesService } from '../services/messages.service';
import { SendMessageDto } from '../dto/messaging.dto';
import { ConversationsService } from '../services/conversations.service';
import { WsJwtAuthGuard } from '@/modules/auth/guards/ws-jwt-auth.guard';
import { NotificationsService } from '@/modules/notifications/services/notifications.service';
import { NotificationType } from '@rental-portal/database';
import { CacheService } from '@/common/cache/cache.service';

interface AuthenticatedSocket extends Socket {
  userId: string;
}

@WebSocketGateway({
  namespace: '/messaging',
  cors: {
    // Use the same CORS_ORIGINS variable as the rest of the app (was mistakenly CORS_ORIGIN singular)
    origin: (process.env.CORS_ORIGINS || 'http://localhost:3401').split(','),
    credentials: true,
  },
})
@UseGuards(WsJwtAuthGuard)
export class MessagingGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MessagingGateway.name);
  /** Local fallback only — authoritative presence is in Redis */
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds
  /** Heartbeat intervals keyed by socket ID — revalidate JWT every 5 minutes */
  private readonly socketHeartbeats: Map<string, NodeJS.Timeout> = new Map();
  private static readonly HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  private static readonly PRESENCE_KEY_PREFIX = 'ws:presence:';
  private static readonly PRESENCE_TTL = 86400; // 24h safety TTL

  constructor(
    private messagesService: MessagesService,
    private conversationsService: ConversationsService,
    private wsAuthGuard: WsJwtAuthGuard,
    private readonly notificationsService: NotificationsService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Attach Redis adapter to Socket.IO server for multi-instance scaling.
   */
  afterInit(server: Server) {
    try {
      const pubClient = this.cacheService.getPubClient();
      const subClient = this.cacheService.getSubClient();
      server.adapter(createAdapter(pubClient, subClient));
      this.logger.log('Socket.IO Redis adapter configured successfully');
    } catch (err) {
      this.logger.warn(`Socket.IO Redis adapter init failed, using in-memory: ${err.message}`);
    }
  }

  /**
   * Handle client connection
   */
  async handleConnection(client: AuthenticatedSocket) {
    try {
      const auth = await this.wsAuthGuard.authenticateClient(client);
      const userId = auth.userId;
      client.userId = userId;
      client.data.userId = userId;
      client.handshake.auth = {
        ...client.handshake.auth,
        userId,
        email: auth.email,
      };

      // Track user's socket connections (local + Redis)
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);
      await this.addPresenceToRedis(userId, client.id);

      // F-17 fix: Join the user's named room so the Redis adapter can route
      // events (e.g. message_read) to this socket even from other pods.
      client.join(`user:${userId}`);
      this.logger.log(`Client connected: ${client.id} (User: ${userId})`);

      // Emit online status to user's contacts
      this.broadcastUserStatus(userId, 'online');

      // Send unread count to client
      const unreadCount = await this.conversationsService.getTotalUnreadCount(userId);
      client.emit('unread_count', { count: unreadCount });

      // Start JWT heartbeat — revalidate token periodically to catch expirations
      // for long-lived socket connections without requiring reconnect
      const heartbeat = setInterval(async () => {
        try {
          await this.wsAuthGuard.authenticateClient(client);
        } catch (err) {
          this.logger.warn(
            `JWT heartbeat failed for socket ${client.id} (User: ${userId}): ${err.message}. Disconnecting.`,
          );
          client.emit('error', { message: 'Session expired. Please reconnect.' });
          client.disconnect(true);
        }
      }, MessagingGateway.HEARTBEAT_INTERVAL_MS);
      this.socketHeartbeats.set(client.id, heartbeat);
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

    // Clear JWT heartbeat for this socket
    const heartbeat = this.socketHeartbeats.get(client.id);
    if (heartbeat) {
      clearInterval(heartbeat);
      this.socketHeartbeats.delete(client.id);
    }

    if (userId) {
      // Remove socket from user's connections (local + Redis)
      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(client.id);

        if (sockets.size === 0) {
          this.userSockets.delete(userId);
        }
      }

      await this.removePresenceFromRedis(userId, client.id);
      const stillOnline = await this.isUserOnline(userId);
      if (!stillOnline) {
        this.broadcastUserStatus(userId, 'offline');
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
      this.logger.error(`WebSocket error: ${error.message}`, error.stack);
      client.emit('error', { message: 'An error occurred. Please try again.' });
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
          const isOnline = await this.isUserOnline(participant.userId);

          if (!isOnline) {
            // Send push notification if recipient is offline
            await this.notificationsService.sendNotification({
              userId: participant.userId,
              type: NotificationType.NEW_MESSAGE,
              title: 'New Message',
              message: `You have a new message`,
              channels: ['PUSH', 'IN_APP'],
              data: { conversationId: message.conversationId, messageId: message.id },
            }).catch(err => this.logger.error('Failed to notify offline user', err));
          }
        }
      }

      return { success: true, message };
    } catch (error) {
      this.logger.error(`WebSocket error: ${error.message}`, error.stack);
      client.emit('error', { message: 'An error occurred. Please try again.' });
      return { success: false, error: 'An error occurred' };
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

      // F-17 fix: Use the Redis adapter room `user:<senderId>` instead of the
      // local userSockets Map.  Room routing is propagated across all pods.
      this.server.to(`user:${message.senderId}`).emit('message_read', {
        messageId: message.id,
        conversationId: message.conversationId,
        readBy: userId,
      });

      return { success: true };
    } catch (error) {
      this.logger.error(`WebSocket error: ${error.message}`, error.stack);
      return { success: false, error: 'An error occurred' };
    }
  }

  /**
   * Subscribe to a user's presence status updates.
   * Clients join a room `user:<userId>` to receive online/offline events.
   */
  @SubscribeMessage('subscribe_presence')
  async handleSubscribePresence(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { userId: string },
  ) {
    if (data?.userId) {
      client.join(`user:${data.userId}`);
      // Immediately push current status
      const isOnline = await this.isUserOnline(data.userId);
      client.emit('user_status', { userId: data.userId, status: isOnline ? 'online' : 'offline' });
    }
  }

  /**
   * Broadcast user online/offline status
   */
  private broadcastUserStatus(userId: string, status: 'online' | 'offline') {
    // Only emit to the specific user room, not all clients
    this.server.to(`user:${userId}`).emit('user_status', { userId, status });
  }

  /**
   * Check if user is online (Redis-backed, cross-instance)
   */
  private async isUserOnline(userId: string): Promise<boolean> {
    try {
      const key = `${MessagingGateway.PRESENCE_KEY_PREFIX}${userId}`;
      const members = await this.cacheService.smembers(key);
      return members != null && members.length > 0;
    } catch {
      // Fallback to local map if Redis unavailable
      return this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0;
    }
  }

  /**
   * Add a socket to the user's Redis presence set
   */
  private async addPresenceToRedis(userId: string, socketId: string): Promise<void> {
    try {
      const key = `${MessagingGateway.PRESENCE_KEY_PREFIX}${userId}`;
      await this.cacheService.sadd(key, socketId);
      await this.cacheService.expire(key, MessagingGateway.PRESENCE_TTL);
    } catch (err) {
      this.logger.warn(`Failed to add presence to Redis for ${userId}: ${err.message}`);
    }
  }

  /**
   * Remove a socket from the user's Redis presence set
   */
  private async removePresenceFromRedis(userId: string, socketId: string): Promise<void> {
    try {
      const key = `${MessagingGateway.PRESENCE_KEY_PREFIX}${userId}`;
      await this.cacheService.srem(key, socketId);
    } catch (err) {
      this.logger.warn(`Failed to remove presence from Redis for ${userId}: ${err.message}`);
    }
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
