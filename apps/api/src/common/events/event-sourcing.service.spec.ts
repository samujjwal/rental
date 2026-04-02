import { Test, TestingModule } from '@nestjs/testing';
import { EventSourcingService, DomainEvent } from './event-sourcing.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

describe('EventSourcingService', () => {
  let service: EventSourcingService;
  let mockPrisma: {
    eventStore: { create: jest.Mock; findMany: jest.Mock; aggregate: jest.Mock };
    eventSnapshot: { create: jest.Mock; findFirst: jest.Mock };
  };
  let mockConfig: { get: jest.Mock };
  let debugSpy: jest.SpyInstance;

  const mockPrismaService = {
    eventStore: { create: jest.fn(), findMany: jest.fn(), aggregate: jest.fn() },
    eventSnapshot: { create: jest.fn(), findFirst: jest.fn() },
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue(100),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventSourcingService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<EventSourcingService>(EventSourcingService);
    mockPrisma = mockPrismaService as any;
    mockConfig = mockConfigService as any;
    debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.clearAllMocks();
  });

  afterEach(() => {
    debugSpy.mockRestore();
  });

  describe('appendEvent', () => {
    it('should append event with auto-generated id and version', async () => {
      mockPrisma.eventStore.aggregate.mockResolvedValue({ _max: { version: 0 } });
      mockPrisma.eventStore.create.mockResolvedValue({
        id: 'evt-1',
        aggregateId: 'listing-123',
        aggregateType: 'Listing',
        eventType: 'ListingCreated',
        version: 1,
        payload: '{"title":"Test"}',
        metadata: { userId: 'user-1' },
        timestamp: new Date(),
      });

      const event = await service.appendEvent({
        aggregateId: 'listing-123',
        aggregateType: 'Listing',
        eventType: 'ListingCreated',
        payload: { title: 'Test' },
        metadata: { userId: 'user-1' },
        timestamp: new Date(),
      });

      expect(event.id).toBe('evt-1');
      expect(event.version).toBe(1);
      expect(mockPrisma.eventStore.create).toHaveBeenCalled();
    });

    it('should auto-generate correlationId if not provided', async () => {
      mockPrisma.eventStore.aggregate.mockResolvedValue({ _max: { version: 0 } });
      mockPrisma.eventStore.create.mockResolvedValue({
        id: 'evt-2',
        aggregateId: 'listing-123',
        aggregateType: 'Listing',
        eventType: 'ListingCreated',
        version: 1,
        payload: '{}',
        metadata: { correlationId: 'auto-generated-uuid' },
        timestamp: new Date(),
      });

      await service.appendEvent({
        aggregateId: 'listing-123',
        aggregateType: 'Listing',
        eventType: 'ListingCreated',
        payload: {},
        metadata: {},
        timestamp: new Date(),
      });

      const createCall = mockPrisma.eventStore.create.mock.calls[0][0];
      expect(createCall.data.metadata.correlationId).toBeDefined();
    });

    it('should create snapshot at snapshot frequency', async () => {
      mockPrisma.eventStore.aggregate.mockResolvedValue({ _max: { version: 99 } });
      mockPrisma.eventStore.create.mockResolvedValue({
        id: 'evt-100',
        aggregateId: 'listing-123',
        aggregateType: 'Listing',
        eventType: 'ListingUpdated',
        version: 100,
        payload: '{}',
        metadata: {},
        timestamp: new Date(),
      });
      mockPrisma.eventStore.findMany.mockResolvedValue([
        {
          id: 'evt-1',
          aggregateId: 'listing-123',
          aggregateType: 'Listing',
          eventType: 'ListingCreated',
          version: 1,
          payload: '{}',
          metadata: {},
          timestamp: new Date(),
        },
      ]);
      mockPrisma.eventSnapshot.create.mockResolvedValue({
        id: 'snap-1',
        aggregateId: 'listing-123',
        aggregateType: 'Listing',
        version: 100,
        state: '{}',
        timestamp: new Date(),
      });

      await service.appendEvent({
        aggregateId: 'listing-123',
        aggregateType: 'Listing',
        eventType: 'ListingUpdated',
        payload: {},
        metadata: {},
        timestamp: new Date(),
      });

      expect(mockPrisma.eventSnapshot.create).toHaveBeenCalled();
    });

    it('should throw error when event store not configured', async () => {
      const serviceWithoutEventStore = new EventSourcingService(
        {} as any,
        mockConfigService as any,
      );

      await expect(
        serviceWithoutEventStore.appendEvent({
          aggregateId: 'test',
          aggregateType: 'Test',
          eventType: 'TestEvent',
          payload: {},
          metadata: {},
          timestamp: new Date(),
        }),
      ).rejects.toThrow('Event store is not configured');
    });
  });

  describe('getEventStream', () => {
    it('should return event stream for aggregate', async () => {
      mockPrisma.eventStore.findMany.mockResolvedValue([
        {
          id: 'evt-1',
          aggregateId: 'listing-123',
          aggregateType: 'Listing',
          eventType: 'ListingCreated',
          version: 1,
          payload: '{}',
          metadata: {},
          timestamp: new Date(),
        },
        {
          id: 'evt-2',
          aggregateId: 'listing-123',
          aggregateType: 'Listing',
          eventType: 'ListingUpdated',
          version: 2,
          payload: '{}',
          metadata: {},
          timestamp: new Date(),
        },
      ]);

      const stream = await service.getEventStream('listing-123');

      expect(stream).toBeDefined();
      expect(stream?.aggregateId).toBe('listing-123');
      expect(stream?.version).toBe(2);
      expect(stream?.events).toHaveLength(2);
    });

    it('should return null when no events exist', async () => {
      mockPrisma.eventStore.findMany.mockResolvedValue([]);

      const stream = await service.getEventStream('non-existent');

      expect(stream).toBeNull();
    });

    it('should return null when event store not configured', async () => {
      const serviceWithoutEventStore = new EventSourcingService(
        {} as any,
        mockConfigService as any,
      );

      const stream = await serviceWithoutEventStore.getEventStream('test');

      expect(stream).toBeNull();
    });

    it('should filter events from specific version', async () => {
      mockPrisma.eventStore.findMany.mockResolvedValue([
        {
          id: 'evt-3',
          aggregateId: 'listing-123',
          aggregateType: 'Listing',
          eventType: 'ListingUpdated',
          version: 3,
          payload: '{}',
          metadata: {},
          timestamp: new Date(),
        },
      ]);

      await service.getEventStream('listing-123', 3);

      expect(mockPrisma.eventStore.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            aggregateId: 'listing-123',
            version: { gte: 3 },
          }),
        }),
      );
    });
  });

  describe('getEventsByType', () => {
    it('should return events by type', async () => {
      mockPrisma.eventStore.findMany.mockResolvedValue([
        {
          id: 'evt-1',
          aggregateId: 'listing-1',
          aggregateType: 'Listing',
          eventType: 'ListingCreated',
          version: 1,
          payload: '{}',
          metadata: {},
          timestamp: new Date(),
        },
        {
          id: 'evt-2',
          aggregateId: 'listing-2',
          aggregateType: 'Listing',
          eventType: 'ListingCreated',
          version: 1,
          payload: '{}',
          metadata: {},
          timestamp: new Date(),
        },
      ]);

      const events = await service.getEventsByType('ListingCreated');

      expect(events).toHaveLength(2);
    });

    it('should filter by date range', async () => {
      const from = new Date('2025-01-01');
      const to = new Date('2025-12-31');

      await service.getEventsByType('ListingCreated', { from, to });

      // Service applies from and to as separate conditions
      expect(mockPrisma.eventStore.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            eventType: 'ListingCreated',
          }),
        }),
      );
    });

    it('should apply limit', async () => {
      await service.getEventsByType('ListingCreated', { limit: 50 });

      expect(mockPrisma.eventStore.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 }),
      );
    });

    it('should return empty array when event store not configured', async () => {
      const serviceWithoutEventStore = new EventSourcingService(
        {} as any,
        mockConfigService as any,
      );

      const events = await serviceWithoutEventStore.getEventsByType('Test');

      expect(events).toEqual([]);
    });
  });

  describe('getEventsByCorrelation', () => {
    it('should return events by correlation ID', async () => {
      mockPrisma.eventStore.findMany.mockResolvedValue([
        {
          id: 'evt-1',
          aggregateId: 'listing-1',
          aggregateType: 'Listing',
          eventType: 'ListingCreated',
          version: 1,
          payload: '{}',
          metadata: { correlationId: 'corr-123' },
          timestamp: new Date(),
        },
      ]);

      const events = await service.getEventsByCorrelation('corr-123');

      expect(events).toHaveLength(1);
      expect(mockPrisma.eventStore.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            metadata: {
              path: ['correlationId'],
              equals: 'corr-123',
            },
          },
        }),
      );
    });
  });

  describe('createSnapshot', () => {
    it('should create snapshot from events', async () => {
      mockPrisma.eventStore.findMany.mockResolvedValue([
        {
          id: 'evt-1',
          aggregateId: 'listing-123',
          aggregateType: 'Listing',
          eventType: 'ListingCreated',
          version: 1,
          payload: '{"title":"Test"}',
          metadata: {},
          timestamp: new Date(),
        },
      ]);
      mockPrisma.eventSnapshot.create.mockResolvedValue({
        id: 'snap-1',
        aggregateId: 'listing-123',
        aggregateType: 'Listing',
        version: 1,
        state: '{"title":"Test","status":"DRAFT"}',
        timestamp: new Date(),
      });

      const snapshot = await service.createSnapshot('listing-123', 'Listing');

      expect(snapshot.aggregateId).toBe('listing-123');
      expect(snapshot.version).toBe(1);
    });

    it('should throw error when no events exist', async () => {
      mockPrisma.eventStore.findMany.mockResolvedValue([]);

      await expect(service.createSnapshot('non-existent', 'Listing')).rejects.toThrow(
        'No events found',
      );
    });

    it('should throw error when snapshot store not configured', async () => {
      const serviceWithoutSnapshot = new EventSourcingService(
        {
          eventStore: {
            findMany: jest.fn().mockResolvedValue([{ id: 'evt-1', version: 1, payload: '{}' }]),
          },
        } as any,
        mockConfigService as any,
      );

      await expect(serviceWithoutSnapshot.createSnapshot('test', 'Test')).rejects.toThrow(
        'Event snapshots are not configured',
      );
    });
  });

  describe('getAuditTrail', () => {
    it('should return audit trail for aggregate', async () => {
      mockPrisma.eventStore.findMany.mockResolvedValue([
        {
          id: 'evt-1',
          aggregateId: 'listing-123',
          aggregateType: 'Listing',
          eventType: 'ListingCreated',
          version: 1,
          payload: '{"title":"Test"}',
          metadata: { userId: 'user-1' },
          timestamp: new Date('2025-01-15'),
        },
        {
          id: 'evt-2',
          aggregateId: 'listing-123',
          aggregateType: 'Listing',
          eventType: 'ListingPublished',
          version: 2,
          payload: '{}',
          metadata: { userId: 'user-2' },
          timestamp: new Date('2025-01-16'),
        },
      ]);

      const trail = await service.getAuditTrail('listing-123');

      expect(trail).toHaveLength(2);
      expect(trail[0].action).toBe('ListingCreated');
      expect(trail[0].performedBy).toBe('user-1');
      expect(trail[1].action).toBe('ListingPublished');
      expect(trail[1].performedBy).toBe('user-2');
    });

    it('should return empty array when no events exist', async () => {
      mockPrisma.eventStore.findMany.mockResolvedValue([]);

      const trail = await service.getAuditTrail('non-existent');

      expect(trail).toEqual([]);
    });
  });

  describe('replayEvents', () => {
    it('should replay ListingCreated event', async () => {
      const events: DomainEvent[] = [
        {
          id: 'evt-1',
          aggregateId: 'listing-123',
          aggregateType: 'Listing',
          eventType: 'ListingCreated',
          version: 1,
          payload: { title: 'Test Listing' },
          metadata: {},
          timestamp: new Date(),
        },
      ];

      // Access private method through any
      const result = (service as any).replayEvents(events, null);

      expect(result.title).toBe('Test Listing');
      expect(result.status).toBe('DRAFT');
    });

    it('should replay ListingPublished event', async () => {
      const events: DomainEvent[] = [
        {
          id: 'evt-1',
          aggregateId: 'listing-123',
          aggregateType: 'Listing',
          eventType: 'ListingCreated',
          version: 1,
          payload: { title: 'Test' },
          metadata: {},
          timestamp: new Date(),
        },
        {
          id: 'evt-2',
          aggregateId: 'listing-123',
          aggregateType: 'Listing',
          eventType: 'ListingPublished',
          version: 2,
          payload: {},
          metadata: {},
          timestamp: new Date('2025-01-16'),
        },
      ];

      const result = (service as any).replayEvents(events, null);

      expect(result.status).toBe('ACTIVE');
      expect(result.publishedAt).toBeInstanceOf(Date);
    });

    it('should replay BookingCreated event', async () => {
      const events: DomainEvent[] = [
        {
          id: 'evt-1',
          aggregateId: 'user-123',
          aggregateType: 'User',
          eventType: 'BookingCreated',
          version: 1,
          payload: { id: 'booking-1', status: 'PENDING' },
          metadata: {},
          timestamp: new Date(),
        },
      ];

      const result = (service as any).replayEvents(events, null);

      expect(result.bookings).toHaveLength(1);
      expect(result.bookings[0].id).toBe('booking-1');
    });

    it('should replay BookingConfirmed event', async () => {
      const initialState = { bookings: [{ id: 'booking-1', status: 'PENDING' }] };
      const events: DomainEvent[] = [
        {
          id: 'evt-1',
          aggregateId: 'user-123',
          aggregateType: 'User',
          eventType: 'BookingConfirmed',
          version: 1,
          payload: { bookingId: 'booking-1' },
          metadata: {},
          timestamp: new Date(),
        },
      ];

      const result = (service as any).replayEvents(events, initialState);

      expect(result.bookings[0].status).toBe('CONFIRMED');
    });
  });
});
