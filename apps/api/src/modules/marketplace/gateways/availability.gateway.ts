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
import { OnEvent } from '@nestjs/event-emitter';
import { WsJwtAuthGuard } from '@/modules/auth/guards/ws-jwt-auth.guard';
import { AvailabilityGraphService } from '../services/availability-graph.service';

interface AuthenticatedSocket extends Socket {
  userId: string;
}

/**
 * Real-time Availability WebSocket Gateway (V5 Prompt 10)
 *
 * Provides real-time availability updates for listings:
 * - Subscribe to listing availability changes
 * - Real-time calendar slot updates
 * - Instant booking conflict notifications
 * - Bulk availability change broadcasts
 */
@WebSocketGateway({
  namespace: '/availability',
  cors: {
    origin: (process.env.CORS_ORIGINS || 'http://localhost:3401').split(','),
    credentials: true,
  },
})
@UseGuards(WsJwtAuthGuard)
export class AvailabilityGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AvailabilityGateway.name);

  // Track which listings each socket is watching
  private socketListings: Map<string, Set<string>> = new Map(); // socketId -> Set<listingId>
  // Track which sockets are watching each listing
  private listingSubscribers: Map<string, Set<string>> = new Map(); // listingId -> Set<socketId>
  // Track user connections
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> Set<socketId>

  constructor(
    private readonly availabilityService: AvailabilityGraphService,
    private readonly wsAuthGuard: WsJwtAuthGuard,
  ) {}

  /**
   * Handle client connection.
   */
  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Authenticate via WsJwtAuthGuard
      const user =
        (await (this.wsAuthGuard as any).validateSocket?.(client)) ??
        (this.wsAuthGuard as any).canActivate?.({
          switchToWs: () => ({ getClient: () => client }),
        } as any);
      if (!user) {
        client.disconnect();
        return;
      }

      client.userId = user.id;

      // Track user socket
      if (!this.userSockets.has(user.id)) {
        this.userSockets.set(user.id, new Set());
      }
      this.userSockets.get(user.id)!.add(client.id);

      this.socketListings.set(client.id, new Set());

      this.logger.debug(`Availability WS connected: ${client.id} (user: ${user.id})`);
    } catch (error) {
      this.logger.warn(`Availability WS auth failed: ${error.message}`);
      client.disconnect();
    }
  }

  /**
   * Handle client disconnection.
   */
  handleDisconnect(client: AuthenticatedSocket) {
    // Clean up listing subscriptions
    const watchedListings = this.socketListings.get(client.id);
    if (watchedListings) {
      for (const listingId of watchedListings) {
        this.listingSubscribers.get(listingId)?.delete(client.id);
        // Clean up empty subscriber sets
        if (this.listingSubscribers.get(listingId)?.size === 0) {
          this.listingSubscribers.delete(listingId);
        }
      }
    }
    this.socketListings.delete(client.id);

    // Clean up user socket tracking
    if (client.userId) {
      this.userSockets.get(client.userId)?.delete(client.id);
      if (this.userSockets.get(client.userId)?.size === 0) {
        this.userSockets.delete(client.userId);
      }
    }

    this.logger.debug(`Availability WS disconnected: ${client.id}`);
  }

  /**
   * Subscribe to real-time availability updates for a listing.
   *
   * Client emits: { listingId: string }
   * Server responds: current availability + joins room for updates
   */
  @SubscribeMessage('subscribe_availability')
  async handleSubscribeAvailability(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { listingId: string },
  ) {
    const { listingId } = data;
    if (!listingId) {
      return { event: 'error', data: { message: 'listingId is required' } };
    }

    // Track subscription
    this.socketListings.get(client.id)?.add(listingId);
    if (!this.listingSubscribers.has(listingId)) {
      this.listingSubscribers.set(listingId, new Set());
    }
    this.listingSubscribers.get(listingId)!.add(client.id);

    // Join Socket.IO room for the listing
    client.join(`listing:${listingId}`);

    this.logger.debug(`Socket ${client.id} subscribed to listing ${listingId}`);

    // Send current availability snapshot
    try {
      const today = new Date();
      const threeMonthsLater = new Date();
      threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

      const availability = await this.availabilityService.checkRealTimeAvailability(
        listingId,
        today,
        threeMonthsLater,
      );

      return {
        event: 'availability_snapshot',
        data: {
          listingId,
          availability,
          subscribedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get availability for ${listingId}: ${error.message}`);
      return {
        event: 'availability_snapshot',
        data: { listingId, availability: null as any, error: 'Failed to load' },
      };
    }
  }

  /**
   * Unsubscribe from listing availability updates.
   */
  @SubscribeMessage('unsubscribe_availability')
  handleUnsubscribeAvailability(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { listingId: string },
  ) {
    const { listingId } = data;
    if (!listingId) return;

    this.socketListings.get(client.id)?.delete(listingId);
    this.listingSubscribers.get(listingId)?.delete(client.id);

    // Clean up empty subscriber sets
    if (this.listingSubscribers.get(listingId)?.size === 0) {
      this.listingSubscribers.delete(listingId);
    }

    client.leave(`listing:${listingId}`);

    this.logger.debug(`Socket ${client.id} unsubscribed from listing ${listingId}`);

    return { event: 'unsubscribed', data: { listingId } };
  }

  /**
   * Check availability for specific dates (on-demand query via WebSocket).
   */
  @SubscribeMessage('check_dates')
  async handleCheckDates(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: { listingId: string; startDate: string; endDate: string },
  ) {
    const { listingId, startDate, endDate } = data;

    try {
      const availability = await this.availabilityService.checkRealTimeAvailability(
        listingId,
        new Date(startDate),
        new Date(endDate),
      );

      return {
        event: 'date_check_result',
        data: { listingId, startDate, endDate, availability },
      };
    } catch (error) {
      return {
        event: 'date_check_result',
        data: {
          listingId,
          startDate,
          endDate,
          availability: null as any,
          error: error.message,
        },
      };
    }
  }

  // ------- Event-driven broadcasts -------

  /**
   * Broadcast availability change when a booking is created.
   */
  @OnEvent('booking.created')
  handleBookingCreated(payload: {
    listingId: string;
    startDate: Date;
    endDate: Date;
    bookingId: string;
  }) {
    this.broadcastAvailabilityChange(payload.listingId, {
      type: 'BOOKING_CREATED',
      listingId: payload.listingId,
      startDate: payload.startDate,
      endDate: payload.endDate,
      bookingId: payload.bookingId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast availability change when a booking is cancelled.
   */
  @OnEvent('booking.cancelled')
  handleBookingCancelled(payload: {
    listingId: string;
    startDate: Date;
    endDate: Date;
    bookingId: string;
  }) {
    this.broadcastAvailabilityChange(payload.listingId, {
      type: 'BOOKING_CANCELLED',
      listingId: payload.listingId,
      startDate: payload.startDate,
      endDate: payload.endDate,
      bookingId: payload.bookingId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast when host updates calendar/pricing.
   */
  @OnEvent('listing.availability_updated')
  handleAvailabilityUpdate(payload: { listingId: string; changes: any }) {
    this.broadcastAvailabilityChange(payload.listingId, {
      type: 'CALENDAR_UPDATED',
      listingId: payload.listingId,
      changes: payload.changes,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast availability change to all subscribed clients.
   */
  private broadcastAvailabilityChange(listingId: string, data: Record<string, any>) {
    const subscriberCount = this.listingSubscribers.get(listingId)?.size || 0;

    if (subscriberCount > 0) {
      this.server.to(`listing:${listingId}`).emit('availability_changed', data);

      this.logger.debug(
        `Broadcasted availability change for listing ${listingId} to ${subscriberCount} subscribers`,
      );
    }
  }

  /**
   * Get gateway statistics (for observability).
   */
  getStats() {
    return {
      connectedSockets: this.socketListings.size,
      uniqueUsers: this.userSockets.size,
      watchedListings: this.listingSubscribers.size,
      totalSubscriptions: Array.from(this.listingSubscribers.values()).reduce(
        (sum, set) => sum + set.size,
        0,
      ),
    };
  }
}
