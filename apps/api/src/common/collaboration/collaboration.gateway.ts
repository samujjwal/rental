/**
 * Real-Time Collaborative Features Service
 * 
 * Enables real-time collaboration between users including:
 * - Live cursor tracking
 * - Collaborative editing
 * - Real-time annotations
 * - Presence awareness
 */

import { Injectable, Logger } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';

export interface CollaborativeSession {
  id: string;
  type: 'listing_edit' | 'booking_review' | 'dispute_resolution' | 'document_review';
  entityId: string;
  participants: Participant[];
  createdAt: Date;
  lastActivity: Date;
  data: any;
}

export interface Participant {
  userId: string;
  socketId: string;
  name: string;
  avatar?: string;
  role: 'owner' | 'editor' | 'viewer';
  cursor?: { x: number; y: number };
  selection?: any;
  lastSeen: Date;
  isTyping?: boolean;
}

export interface CollaborativeOperation {
  id: string;
  userId: string;
  type: 'insert' | 'delete' | 'update' | 'cursor_move' | 'selection_change';
  path: string[];
  value?: any;
  oldValue?: any;
  timestamp: number;
  sessionId: string;
}

@WebSocketGateway({
  namespace: '/collaboration',
  cors: { origin: '*' },
})
@Injectable()
export class CollaborationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CollaborationGateway.name);
  private sessions: Map<string, CollaborativeSession> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Handle new WebSocket connection
   */
  async handleConnection(client: Socket): Promise<void> {
    const userId = client.handshake.auth.userId;
    const token = client.handshake.auth.token;

    // Verify token
    const valid = await this.verifyToken(token);
    if (!valid) {
      client.disconnect();
      return;
    }

    this.logger.log(`User ${userId} connected to collaboration`);
    
    // Store user connection info
    await this.cache.set(`collab:user:${userId}`, {
      socketId: client.id,
      connectedAt: new Date(),
    }, 3600);

    // Join user's personal room
    client.join(`user:${userId}`);
  }

  /**
   * Handle WebSocket disconnection
   */
  async handleDisconnect(client: Socket): Promise<void> {
    const userId = client.handshake.auth.userId;
    
    // Remove from all sessions
    for (const [sessionId, session] of this.sessions.entries()) {
      const participantIndex = session.participants.findIndex(p => p.socketId === client.id);
      if (participantIndex !== -1) {
        const participant = session.participants[participantIndex];
        session.participants.splice(participantIndex, 1);
        
        // Notify others
        client.to(`session:${sessionId}`).emit('participant_left', {
          userId: participant.userId,
          name: participant.name,
          timestamp: new Date(),
        });

        // Clean up empty sessions
        if (session.participants.length === 0) {
          await this.persistSession(session);
          this.sessions.delete(sessionId);
        }
      }
    }

    await this.cache.del(`collab:user:${userId}`);
    this.logger.log(`User ${userId} disconnected from collaboration`);
  }

  /**
   * Join a collaborative session
   */
  @SubscribeMessage('join_session')
  async handleJoinSession(client: Socket, payload: {
    sessionId: string;
    entityType: string;
    entityId: string;
    role: 'owner' | 'editor' | 'viewer';
  }): Promise<void> {
    const userId = client.handshake.auth.userId;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true },
    });

    if (!user) {
      client.emit('error', { message: 'User not found' });
      return;
    }

    // Get or create session
    let session = this.sessions.get(payload.sessionId);
    if (!session) {
      session = await this.loadOrCreateSession(payload.sessionId, payload.entityType, payload.entityId);
      this.sessions.set(payload.sessionId, session);
    }

    // Check permissions
    const canJoin = await this.checkPermissions(userId, payload.entityId, payload.entityType, payload.role);
    if (!canJoin) {
      client.emit('error', { message: 'Permission denied' });
      return;
    }

    // Add participant
    const participant: Participant = {
      userId: user.id,
      socketId: client.id,
      name: `${user.firstName} ${user.lastName}`,
      avatar: user.profilePhotoUrl,
      role: payload.role,
      lastSeen: new Date(),
    };

    // Check if already in session
    const existingIndex = session.participants.findIndex(p => p.userId === userId);
    if (existingIndex !== -1) {
      session.participants[existingIndex] = participant;
    } else {
      session.participants.push(participant);
    }

    // Join Socket.IO room
    client.join(`session:${payload.sessionId}`);

    // Send current state to new participant
    client.emit('session_state', {
      sessionId: payload.sessionId,
      data: session.data,
      participants: session.participants.filter(p => p.userId !== userId),
      myRole: payload.role,
    });

    // Notify others
    client.to(`session:${payload.sessionId}`).emit('participant_joined', {
      userId: user.id,
      name: participant.name,
      avatar: participant.avatar,
      role: payload.role,
      timestamp: new Date(),
    });

    session.lastActivity = new Date();
    this.logger.log(`User ${userId} joined session ${payload.sessionId}`);
  }

  /**
   * Leave a collaborative session
   */
  @SubscribeMessage('leave_session')
  handleLeaveSession(client: Socket, payload: { sessionId: string }): void {
    const userId = client.handshake.auth.userId;
    const session = this.sessions.get(payload.sessionId);

    if (session) {
      const participantIndex = session.participants.findIndex(p => p.socketId === client.id);
      if (participantIndex !== -1) {
        const participant = session.participants[participantIndex];
        session.participants.splice(participantIndex, 1);

        client.to(`session:${payload.sessionId}`).emit('participant_left', {
          userId: participant.userId,
          name: participant.name,
          timestamp: new Date(),
        });
      }
    }

    client.leave(`session:${payload.sessionId}`);
    this.logger.log(`User ${userId} left session ${payload.sessionId}`);
  }

  /**
   * Handle collaborative operation
   */
  @SubscribeMessage('operation')
  async handleOperation(client: Socket, payload: CollaborativeOperation): Promise<void> {
    const userId = client.handshake.auth.userId;
    const session = this.sessions.get(payload.sessionId);

    if (!session) {
      client.emit('error', { message: 'Session not found' });
      return;
    }

    // Verify participant has edit permissions
    const participant = session.participants.find(p => p.userId === userId);
    if (!participant || participant.role === 'viewer') {
      client.emit('error', { message: 'No edit permission' });
      return;
    }

    // Apply operation to session data
    this.applyOperation(session, payload);

    // Broadcast to all participants (including sender for confirmation)
    this.server.to(`session:${payload.sessionId}`).emit('operation', {
      ...payload,
      userId,
      userName: participant.name,
    });

    session.lastActivity = new Date();
  }

  /**
   * Handle cursor movement
   */
  @SubscribeMessage('cursor_move')
  handleCursorMove(client: Socket, payload: {
    sessionId: string;
    x: number;
    y: number;
  }): void {
    const userId = client.handshake.auth.userId;
    const session = this.sessions.get(payload.sessionId);

    if (!session) return;

    const participant = session.participants.find(p => p.userId === userId);
    if (!participant) return;

    participant.cursor = { x: payload.x, y: payload.y };
    participant.lastSeen = new Date();

    // Broadcast to others (not sender)
    client.to(`session:${payload.sessionId}`).emit('cursor_update', {
      userId,
      userName: participant.name,
      avatar: participant.avatar,
      cursor: { x: payload.x, y: payload.y },
    });
  }

  /**
   * Handle selection change
   */
  @SubscribeMessage('selection_change')
  handleSelectionChange(client: Socket, payload: {
    sessionId: string;
    selection: any;
  }): void {
    const userId = client.handshake.auth.userId;
    const session = this.sessions.get(payload.sessionId);

    if (!session) return;

    const participant = session.participants.find(p => p.userId === userId);
    if (!participant) return;

    participant.selection = payload.selection;
    participant.lastSeen = new Date();

    client.to(`session:${payload.sessionId}`).emit('selection_update', {
      userId,
      userName: participant.name,
      selection: payload.selection,
    });
  }

  /**
   * Handle typing indicator
   */
  @SubscribeMessage('typing')
  handleTyping(client: Socket, payload: {
    sessionId: string;
    isTyping: boolean;
  }): void {
    const userId = client.handshake.auth.userId;
    const session = this.sessions.get(payload.sessionId);

    if (!session) return;

    const participant = session.participants.find(p => p.userId === userId);
    if (!participant) return;

    participant.isTyping = payload.isTyping;

    client.to(`session:${payload.sessionId}`).emit('typing_indicator', {
      userId,
      userName: participant.name,
      isTyping: payload.isTyping,
    });
  }

  /**
   * Get session presence info
   */
  @SubscribeMessage('get_presence')
  handleGetPresence(client: Socket, payload: { sessionId: string }): void {
    const session = this.sessions.get(payload.sessionId);
    if (session) {
      client.emit('presence_info', {
        sessionId: payload.sessionId,
        participants: session.participants,
      });
    }
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  private async verifyToken(token: string): Promise<boolean> {
    // Implement JWT verification
    // For now, accept all tokens in dev mode
    return true;
  }

  private async loadOrCreateSession(
    sessionId: string,
    entityType: string,
    entityId: string,
  ): Promise<CollaborativeSession> {
    // Try to load from cache/DB
    const cached = await this.cache.get(`collab:session:${sessionId}`);
    if (cached) {
      const cachedSession = typeof cached === 'object' && cached !== null
        ? (cached as Record<string, unknown>)
        : {};
      return {
        ...cachedSession,
        participants: [], // Don't restore participants, they need to reconnect
      } as CollaborativeSession;
    }

    // Create new session
    return {
      id: sessionId,
      type: this.mapEntityType(entityType),
      entityId,
      participants: [],
      createdAt: new Date(),
      lastActivity: new Date(),
      data: await this.loadEntityData(entityType, entityId),
    };
  }

  private mapEntityType(type: string): CollaborativeSession['type'] {
    const mapping: Record<string, CollaborativeSession['type']> = {
      'listing': 'listing_edit',
      'booking': 'booking_review',
      'dispute': 'dispute_resolution',
      'document': 'document_review',
    };
    return mapping[type] || 'document_review';
  }

  private async loadEntityData(entityType: string, entityId: string): Promise<any> {
    switch (entityType) {
      case 'listing':
        return this.prisma.listing.findUnique({
          where: { id: entityId },
          select: { id: true, title: true, description: true, basePrice: true },
        });
      case 'booking':
        return this.prisma.booking.findUnique({
          where: { id: entityId },
          select: { id: true, status: true, startDate: true, endDate: true },
        });
      default:
        return {};
    }
  }

  private async checkPermissions(
    userId: string,
    entityId: string,
    entityType: string,
    role: string,
  ): Promise<boolean> {
    switch (entityType) {
      case 'listing':
        const listing = await this.prisma.listing.findFirst({
          where: { id: entityId, ownerId: userId },
        });
        return !!listing || role === 'viewer';
      case 'booking':
        const booking = await this.prisma.booking.findFirst({
          where: {
            id: entityId,
            OR: [{ renterId: userId }, { ownerId: userId }],
          },
        });
        return !!booking;
      case 'dispute':
        const dispute = await this.prisma.dispute.findFirst({
          where: {
            id: entityId,
            OR: [{ initiatorId: userId }, { defendantId: userId }],
          },
        });
        return !!dispute;
      default:
        return true;
    }
  }

  private applyOperation(session: CollaborativeSession, operation: CollaborativeOperation): void {
    // Apply JSON patch-like operation
    let target = session.data;
    const path = [...operation.path];
    const key = path.pop();

    // Navigate to parent
    for (const segment of path) {
      target = target?.[segment];
    }

    if (!target || !key) return;

    switch (operation.type) {
      case 'insert':
      case 'update':
        target[key] = operation.value;
        break;
      case 'delete':
        delete target[key];
        break;
    }
  }

  private async persistSession(session: CollaborativeSession): Promise<void> {
    // Save session data to cache for potential restoration
    await this.cache.set(`collab:session:${session.id}`, {
      ...session,
      participants: [], // Don't save participants
    }, 86400); // 24 hours
  }
}
