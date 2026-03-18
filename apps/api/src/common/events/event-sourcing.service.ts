/**
 * Event Sourcing System for Audit Trail
 * 
 * Implements event sourcing pattern for critical domain events,
 * providing complete audit trail and temporal querying capabilities.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

export interface DomainEvent {
  id: string;
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  version: number;
  payload: any;
  metadata: {
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    correlationId?: string;
    causationId?: string;
  };
  timestamp: Date;
}

export interface EventStream {
  aggregateId: string;
  aggregateType: string;
  events: DomainEvent[];
  version: number;
}

export interface Snapshot {
  aggregateId: string;
  aggregateType: string;
  version: number;
  state: any;
  timestamp: Date;
}

@Injectable()
export class EventSourcingService {
  private readonly logger = new Logger(EventSourcingService.name);
  private readonly snapshotFrequency: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.snapshotFrequency = this.config.get('EVENT_SNAPSHOT_FREQUENCY', 100);
  }

  /**
   * Append event to event store
   */
  async appendEvent(event: Omit<DomainEvent, 'id' | 'version'>): Promise<DomainEvent> {
    const eventStore = this.getEventStoreDelegate();
    if (!eventStore) {
      throw new Error('Event store is not configured in the current Prisma client');
    }

    // Get current version for aggregate
    const currentVersion = await this.getCurrentVersion(event.aggregateId);
    const version = currentVersion + 1;

    const storedEvent = await eventStore.create({
      data: {
        id: this.generateEventId(),
        aggregateId: event.aggregateId,
        aggregateType: event.aggregateType,
        eventType: event.eventType,
        version,
        payload: JSON.stringify(event.payload),
        metadata: JSON.stringify(event.metadata),
        timestamp: event.timestamp,
      },
    });

    this.logger.debug(`Appended event ${storedEvent.id} v${version} for ${event.aggregateType}:${event.aggregateId}`);

    // Check if snapshot needed
    if (version % this.snapshotFrequency === 0) {
      await this.createSnapshot(event.aggregateId, event.aggregateType);
    }

    return this.toDomainEvent(storedEvent);
  }

  /**
   * Get event stream for aggregate
   */
  async getEventStream(aggregateId: string, fromVersion?: number): Promise<EventStream> {
    const eventStore = this.getEventStoreDelegate();
    if (!eventStore) {
      return null;
    }

    const events = await eventStore.findMany({
      where: {
        aggregateId,
        ...(fromVersion && { version: { gte: fromVersion } }),
      },
      orderBy: { version: 'asc' },
    });

    if (events.length === 0) {
      return null;
    }

    return {
      aggregateId,
      aggregateType: events[0].aggregateType,
      events: events.map((eventRecord: any) => this.toDomainEvent(eventRecord)),
      version: events[events.length - 1].version,
    };
  }

  /**
   * Get events by type and time range
   */
  async getEventsByType(
    eventType: string,
    options: {
      from?: Date;
      to?: Date;
      limit?: number;
    } = {},
  ): Promise<DomainEvent[]> {
    const eventStore = this.getEventStoreDelegate();
    if (!eventStore) {
      return [];
    }

    const events = await eventStore.findMany({
      where: {
        eventType,
        ...(options.from && { timestamp: { gte: options.from } }),
        ...(options.to && { timestamp: { lte: options.to } }),
      },
      orderBy: { timestamp: 'desc' },
      take: options.limit || 100,
    });

    return events.map((eventRecord: any) => this.toDomainEvent(eventRecord));
  }

  /**
   * Get events by correlation ID
   */
  async getEventsByCorrelation(correlationId: string): Promise<DomainEvent[]> {
    const eventStore = this.getEventStoreDelegate();
    if (!eventStore) {
      return [];
    }

    const events = await eventStore.findMany({
      where: {
        metadata: {
          contains: `"correlationId":"${correlationId}"`,
        },
      },
      orderBy: { timestamp: 'asc' },
    });

    return events.map((eventRecord: any) => this.toDomainEvent(eventRecord));
  }

  /**
   * Create snapshot for aggregate
   */
  async createSnapshot(aggregateId: string, aggregateType: string): Promise<Snapshot> {
    const eventSnapshot = this.getEventSnapshotDelegate();
    if (!eventSnapshot) {
      throw new Error('Event snapshots are not configured in the current Prisma client');
    }

    // Get current state by replaying events
    const stream = await this.getEventStream(aggregateId);
    
    if (!stream) {
      throw new Error(`No events found for aggregate ${aggregateId}`);
    }

    // Apply events to get current state (simplified - actual implementation would have proper reducers)
    const state = this.replayEvents(stream.events);

    const snapshot = await eventSnapshot.create({
      data: {
        aggregateId,
        aggregateType,
        version: stream.version,
        state: JSON.stringify(state),
        timestamp: new Date(),
      },
    });

    this.logger.debug(`Created snapshot v${snapshot.version} for ${aggregateType}:${aggregateId}`);

    return {
      aggregateId: snapshot.aggregateId,
      aggregateType: snapshot.aggregateType,
      version: snapshot.version,
      state,
      timestamp: snapshot.timestamp,
    };
  }

  /**
   * Get latest snapshot for aggregate
   */
  async getLatestSnapshot(aggregateId: string): Promise<Snapshot | null> {
    const eventSnapshot = this.getEventSnapshotDelegate();
    if (!eventSnapshot) {
      return null;
    }

    const snapshot = await eventSnapshot.findFirst({
      where: { aggregateId },
      orderBy: { version: 'desc' },
    });

    if (!snapshot) {
      return null;
    }

    return {
      aggregateId: snapshot.aggregateId,
      aggregateType: snapshot.aggregateType,
      version: snapshot.version,
      state: JSON.parse(snapshot.state),
      timestamp: snapshot.timestamp,
    };
  }

  /**
   * Replay events from snapshot
   */
  async replayFromSnapshot(aggregateId: string): Promise<any> {
    const snapshot = await this.getLatestSnapshot(aggregateId);
    
    if (!snapshot) {
      // No snapshot - replay all events
      const stream = await this.getEventStream(aggregateId);
      return stream ? this.replayEvents(stream.events) : null;
    }

    // Get events after snapshot
    const stream = await this.getEventStream(aggregateId, snapshot.version + 1);
    
    if (!stream || stream.events.length === 0) {
      return snapshot.state;
    }

    // Apply events to snapshot state
    return this.replayEvents(stream.events, snapshot.state);
  }

  /**
   * Temporal query - get state at specific point in time
   */
  async getStateAtTime(aggregateId: string, timestamp: Date): Promise<any> {
    const eventSnapshot = this.getEventSnapshotDelegate();
    const eventStore = this.getEventStoreDelegate();
    if (!eventStore) {
      return null;
    }

    // Get snapshot before timestamp
    const snapshot = eventSnapshot
      ? await eventSnapshot.findFirst({
      where: {
        aggregateId,
        timestamp: { lte: timestamp },
      },
      orderBy: { timestamp: 'desc' },
      })
      : null;

    // Get events between snapshot and target time
    const events = await eventStore.findMany({
      where: {
        aggregateId,
        timestamp: { lte: timestamp },
        ...(snapshot && { version: { gt: snapshot.version } }),
      },
      orderBy: { version: 'asc' },
    });

    const initialState = snapshot ? JSON.parse(snapshot.state) : null;
    return this.replayEvents(events.map((eventRecord: any) => this.toDomainEvent(eventRecord)), initialState);
  }

  /**
   * Get audit trail for aggregate
   */
  async getAuditTrail(aggregateId: string): Promise<Array<{
    action: string;
    performedBy: string;
    timestamp: Date;
    details: any;
  }>> {
    const stream = await this.getEventStream(aggregateId);
    
    if (!stream) {
      return [];
    }

    return stream.events.map(event => ({
      action: event.eventType,
      performedBy: event.metadata.userId || 'SYSTEM',
      timestamp: event.timestamp,
      details: event.payload,
    }));
  }

  /**
   * Project events to read model (CQRS pattern)
   */
  async projectEvents(eventTypes: string[], projector: (events: DomainEvent[]) => Promise<void>): Promise<void> {
    const eventStore = this.getEventStoreDelegate();
    if (!eventStore) {
      return;
    }

    const batchSize = 100;
    let lastTimestamp: Date | null = null;
    let hasMore = true;

    while (hasMore) {
      const events = await eventStore.findMany({
        where: {
          eventType: { in: eventTypes },
          ...(lastTimestamp && { timestamp: { gt: lastTimestamp } }),
        },
        orderBy: { timestamp: 'asc' },
        take: batchSize,
      });

      if (events.length === 0) {
        hasMore = false;
        break;
      }

      await projector(events.map((eventRecord: any) => this.toDomainEvent(eventRecord)));
      lastTimestamp = events[events.length - 1].timestamp;

      if (events.length < batchSize) {
        hasMore = false;
      }
    }
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  private async getCurrentVersion(aggregateId: string): Promise<number> {
    const eventStore = this.getEventStoreDelegate();
    if (!eventStore) {
      return 0;
    }

    const result = await eventStore.aggregate({
      where: { aggregateId },
      _max: { version: true },
    });

    return (result as any)._max.version || 0;
  }

  private getEventStoreDelegate(): any | null {
    const prismaClient = this.prisma as any;
    return prismaClient.eventStore ?? null;
  }

  private getEventSnapshotDelegate(): any | null {
    const prismaClient = this.prisma as any;
    return prismaClient.eventSnapshot ?? null;
  }

  private toDomainEvent(stored: any): DomainEvent {
    return {
      id: stored.id,
      aggregateId: stored.aggregateId,
      aggregateType: stored.aggregateType,
      eventType: stored.eventType,
      version: stored.version,
      payload: JSON.parse(stored.payload),
      metadata: JSON.parse(stored.metadata),
      timestamp: stored.timestamp,
    };
  }

  private generateEventId(): string {
    return `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private replayEvents(events: DomainEvent[], initialState: any = null): any {
    // Simplified event replay - actual implementation would have domain-specific reducers
    return events.reduce((state, event) => {
      // Apply event to state based on event type
      switch (event.eventType) {
        case 'ListingCreated':
          return { ...state, ...event.payload, status: 'DRAFT' };
        case 'ListingPublished':
          return { ...state, status: 'ACTIVE', publishedAt: event.timestamp };
        case 'BookingCreated':
          return { ...state, bookings: [...(state?.bookings || []), event.payload] };
        case 'BookingConfirmed':
          return {
            ...state,
            bookings: state?.bookings?.map((b: any) =>
              b.id === event.payload.bookingId ? { ...b, status: 'CONFIRMED' } : b
            ),
          };
        default:
          return { ...state, ...event.payload };
      }
    }, initialState);
  }
}
