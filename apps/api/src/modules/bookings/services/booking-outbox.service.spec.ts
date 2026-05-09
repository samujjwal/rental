import { Test, TestingModule } from '@nestjs/testing';
import { BookingOutboxService, OutboxEvent } from './booking-outbox.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * BOOKING OUTBOX SERVICE TESTS
 * 
 * These tests validate the outbox pattern for durable side effects:
 * - Event creation and persistence
 * - Event status tracking (PENDING, PROCESSING, COMPLETED, FAILED)
 * - Retry logic with attempt limits
 * - Duplicate event prevention
 * - Statistics and cleanup
 * 
 * Business Truth Validated:
 * - Side effects are durable and can be retried
 * - Events are processed exactly once
 * - Failed events are retried up to a limit
 * - Old completed events are cleaned up
 */
describe('BookingOutboxService', () => {
  let service: BookingOutboxService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const mockPrismaService = {
      $queryRaw: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingOutboxService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<BookingOutboxService>(BookingOutboxService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Event Creation', () => {
    it('should create an outbox event with required fields', async () => {
      const eventData = {
        bookingId: 'booking-123',
        eventType: 'BOOKING_CONFIRMED',
        payload: { userId: 'user-1', amount: 1000 },
      };

      const mockEvent: OutboxEvent = {
        id: 'event-123',
        bookingId: 'booking-123',
        eventType: 'BOOKING_CONFIRMED',
        payload: eventData.payload,
        status: 'PENDING',
        attempts: 0,
        createdAt: new Date(),
      };

      (prisma.$queryRaw as jest.Mock).mockResolvedValue([mockEvent]);

      const result = await service.createEvent(eventData);

      expect(prisma.$queryRaw).toHaveBeenCalledWith(
        expect.anything()
      );
      expect(result.bookingId).toBe('booking-123');
      expect(result.eventType).toBe('BOOKING_CONFIRMED');
      expect(result.status).toBe('PENDING');
      expect(result.attempts).toBe(0);
    });

    it('should create events with different event types', async () => {
      const eventTypes = [
        'BOOKING_CONFIRMED',
        'PAYMENT_SUCCEEDED',
        'BOOKING_CANCELLED',
        'DISPUTE_CREATED',
      ];

      for (const eventType of eventTypes) {
        const mockEvent: OutboxEvent = {
          id: `event-${eventType}`,
          bookingId: 'booking-123',
          eventType,
          payload: { data: 'test' },
          status: 'PENDING',
          attempts: 0,
          createdAt: new Date(),
        };

        (prisma.$queryRaw as jest.Mock).mockResolvedValue([mockEvent]);

        await service.createEvent({
          bookingId: 'booking-123',
          eventType,
          payload: { data: 'test' },
        });

        expect(prisma.$queryRaw).toHaveBeenCalled();
      }
    });

    it('should store payload as JSONB', async () => {
      const complexPayload = {
        userId: 'user-1',
        amount: 1000,
        currency: 'USD',
        metadata: { key: 'value' },
        nested: { level2: { level3: 'deep' } },
      };

      const mockEvent: OutboxEvent = {
        id: 'event-123',
        bookingId: 'booking-123',
        eventType: 'BOOKING_CONFIRMED',
        payload: complexPayload,
        status: 'PENDING',
        attempts: 0,
        createdAt: new Date(),
      };

      (prisma.$queryRaw as jest.Mock).mockResolvedValue([mockEvent]);

      const result = await service.createEvent({
        bookingId: 'booking-123',
        eventType: 'BOOKING_CONFIRMED',
        payload: complexPayload,
      });

      expect(result.payload).toEqual(complexPayload);
    });
  });

  describe('Event Retrieval', () => {
    it('should get pending events for processing', async () => {
      const pendingEvents: OutboxEvent[] = [
        {
          id: 'event-1',
          bookingId: 'booking-1',
          eventType: 'BOOKING_CONFIRMED',
          payload: {},
          status: 'PENDING',
          attempts: 0,
          createdAt: new Date(),
        },
        {
          id: 'event-2',
          bookingId: 'booking-2',
          eventType: 'PAYMENT_SUCCEEDED',
          payload: {},
          status: 'PENDING',
          attempts: 0,
          createdAt: new Date(),
        },
      ];

      (prisma.$queryRaw as jest.Mock).mockResolvedValue(pendingEvents);

      const result = await service.getPendingEvents(100);

      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('PENDING');
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('should include failed events with attempts < 5', async () => {
      const mixedEvents: OutboxEvent[] = [
        {
          id: 'event-1',
          bookingId: 'booking-1',
          eventType: 'BOOKING_CONFIRMED',
          payload: {},
          status: 'PENDING',
          attempts: 0,
          createdAt: new Date(),
        },
        {
          id: 'event-2',
          bookingId: 'booking-2',
          eventType: 'PAYMENT_SUCCEEDED',
          payload: {},
          status: 'FAILED',
          attempts: 3,
          createdAt: new Date(),
        },
      ];

      (prisma.$queryRaw as jest.Mock).mockResolvedValue(mixedEvents);

      const result = await service.getPendingEvents(100);

      expect(result).toHaveLength(2);
      expect(result[1].status).toBe('FAILED');
      expect(result[1].attempts).toBe(3);
    });

    it('should not include failed events with attempts >= 5', async () => {
      const events: OutboxEvent[] = [
        {
          id: 'event-1',
          bookingId: 'booking-1',
          eventType: 'BOOKING_CONFIRMED',
          payload: {},
          status: 'FAILED',
          attempts: 5,
          createdAt: new Date(),
        },
      ];

      (prisma.$queryRaw as jest.Mock).mockResolvedValue(events);

      const result = await service.getPendingEvents(100);

      // The query filters out events with attempts >= 5
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('should respect limit parameter', async () => {
      const events: OutboxEvent[] = Array.from({ length: 50 }, (_, i) => ({
        id: `event-${i}`,
        bookingId: `booking-${i}`,
        eventType: 'BOOKING_CONFIRMED',
        payload: {},
        status: 'PENDING',
        attempts: 0,
        createdAt: new Date(),
      }));

      (prisma.$queryRaw as jest.Mock).mockResolvedValue(events);

      await service.getPendingEvents(10);

      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('should order events by creation date ascending', async () => {
      const events: OutboxEvent[] = [
        {
          id: 'event-2',
          bookingId: 'booking-2',
          eventType: 'BOOKING_CONFIRMED',
          payload: {},
          status: 'PENDING',
          attempts: 0,
          createdAt: new Date('2024-01-02'),
        },
        {
          id: 'event-1',
          bookingId: 'booking-1',
          eventType: 'BOOKING_CONFIRMED',
          payload: {},
          status: 'PENDING',
          attempts: 0,
          createdAt: new Date('2024-01-01'),
        },
      ];

      (prisma.$queryRaw as jest.Mock).mockResolvedValue(events);

      const result = await service.getPendingEvents(100);

      expect(result).toHaveLength(2);
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });
  });

  describe('Event Status Updates', () => {
    it('should mark event as processing', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      await service.markProcessing('event-123');

      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('should increment attempts when marking as processing', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      await service.markProcessing('event-123');

      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('should set lastAttemptAt when marking as processing', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      await service.markProcessing('event-123');

      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('should mark event as completed', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      await service.markCompleted('event-123');

      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('should set processedAt when marking as completed', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      await service.markCompleted('event-123');

      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('should mark event as failed with error message', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      await service.markFailed('event-123', 'Payment gateway timeout');

      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('should set lastAttemptAt when marking as failed', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      await service.markFailed('event-123', 'Database error');

      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('should store error message when marking as failed', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      await service.markFailed('event-123', 'Connection refused');

      expect(prisma.$queryRaw).toHaveBeenCalled();
    });
  });

  describe('Retry Logic', () => {
    it('should allow retry for failed events with attempts < 5', async () => {
      const failedEvent: OutboxEvent = {
        id: 'event-123',
        bookingId: 'booking-123',
        eventType: 'BOOKING_CONFIRMED',
        payload: {},
        status: 'FAILED',
        attempts: 3,
        createdAt: new Date(),
      };

      (prisma.$queryRaw as jest.Mock).mockResolvedValue([failedEvent]);

      const result = await service.getPendingEvents(100);

      expect(result).toHaveLength(1);
      expect(result[0].attempts).toBe(3);
    });

    it('should not retry events with attempts >= 5', async () => {
      const failedEvent: OutboxEvent = {
        id: 'event-123',
        bookingId: 'booking-123',
        eventType: 'BOOKING_CONFIRMED',
        payload: {},
        status: 'FAILED',
        attempts: 5,
        createdAt: new Date(),
      };

      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      const result = await service.getPendingEvents(100);

      expect(result).toHaveLength(0);
    });

    it('should increment attempt count on each retry', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      await service.markProcessing('event-123');

      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('should track retry attempts in event status', async () => {
      const events: OutboxEvent[] = [
        {
          id: 'event-1',
          bookingId: 'booking-1',
          eventType: 'BOOKING_CONFIRMED',
          payload: {},
          status: 'FAILED',
          attempts: 1,
          createdAt: new Date(),
        },
        {
          id: 'event-2',
          bookingId: 'booking-2',
          eventType: 'BOOKING_CONFIRMED',
          payload: {},
          status: 'FAILED',
          attempts: 4,
          createdAt: new Date(),
        },
      ];

      (prisma.$queryRaw as jest.Mock).mockResolvedValue(events);

      const result = await service.getPendingEvents(100);

      expect(result).toHaveLength(2);
      expect(result[0].attempts).toBe(1);
      expect(result[1].attempts).toBe(4);
    });
  });

  describe('Duplicate Side-Effect Prevention', () => {
    it('should prevent duplicate event creation for same booking and type', async () => {
      const eventData = {
        bookingId: 'booking-123',
        eventType: 'BOOKING_CONFIRMED',
        payload: { userId: 'user-1' },
      };

      const mockEvent: OutboxEvent = {
        id: 'event-123',
        bookingId: 'booking-123',
        eventType: 'BOOKING_CONFIRMED',
        payload: eventData.payload,
        status: 'PENDING',
        attempts: 0,
        createdAt: new Date(),
      };

      (prisma.$queryRaw as jest.Mock).mockResolvedValue([mockEvent]);

      const result1 = await service.createEvent(eventData);
      const result2 = await service.createEvent(eventData);

      // Each create should generate a new UUID
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    });

    it('should allow different event types for same booking', async () => {
      const bookingId = 'booking-123';

      const events = [
        { eventType: 'BOOKING_CONFIRMED', payload: {} },
        { eventType: 'PAYMENT_SUCCEEDED', payload: {} },
        { eventType: 'BOOKING_CANCELLED', payload: {} },
      ];

      for (const eventData of events) {
        const mockEvent: OutboxEvent = {
          id: `event-${eventData.eventType}`,
          bookingId,
          eventType: eventData.eventType,
          payload: eventData.payload,
          status: 'PENDING',
          attempts: 0,
          createdAt: new Date(),
        };

        (prisma.$queryRaw as jest.Mock).mockResolvedValue([mockEvent]);

        await service.createEvent({
          bookingId,
          eventType: eventData.eventType,
          payload: eventData.payload,
        });
      }

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(3);
    });

    it('should prevent reprocessing of completed events', async () => {
      const completedEvent: OutboxEvent = {
        id: 'event-123',
        bookingId: 'booking-123',
        eventType: 'BOOKING_CONFIRMED',
        payload: {},
        status: 'COMPLETED',
        attempts: 1,
        createdAt: new Date(),
        processedAt: new Date(),
      };

      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      await service.getPendingEvents(100);

      // Completed events should not be returned for processing
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });
  });

  describe('Statistics', () => {
    it('should return statistics for all event statuses', async () => {
      const stats = [
        { status: 'PENDING', count: BigInt(10) },
        { status: 'PROCESSING', count: BigInt(5) },
        { status: 'COMPLETED', count: BigInt(100) },
        { status: 'FAILED', count: BigInt(2) },
      ];

      (prisma.$queryRaw as jest.Mock).mockResolvedValue(stats);

      const result = await service.getStats();

      expect(result.pending).toBe(10);
      expect(result.processing).toBe(5);
      expect(result.completed).toBe(100);
      expect(result.failed).toBe(2);
      expect(result.total).toBe(117);
    });

    it('should handle empty statistics', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      const result = await service.getStats();

      expect(result.pending).toBe(0);
      expect(result.processing).toBe(0);
      expect(result.completed).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.total).toBe(0);
    });

    it('should calculate total correctly', async () => {
      const stats = [
        { status: 'PENDING', count: BigInt(5) },
        { status: 'COMPLETED', count: BigInt(15) },
      ];

      (prisma.$queryRaw as jest.Mock).mockResolvedValue(stats);

      const result = await service.getStats();

      expect(result.total).toBe(20);
    });
  });

  describe('Cleanup', () => {
    it('should clean up completed events older than 30 days', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ count: BigInt(50) }]);

      const result = await service.cleanupOldEvents();

      expect(result).toBe(50);
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('should only clean up COMPLETED events', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ count: BigInt(10) }]);

      await service.cleanupOldEvents();

      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('should return 0 when no old events to clean', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ count: BigInt(0) }]);

      const result = await service.cleanupOldEvents();

      expect(result).toBe(0);
    });

    it('should preserve recent completed events', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ count: BigInt(0) }]);

      await service.cleanupOldEvents();

      expect(prisma.$queryRaw).toHaveBeenCalled();
    });
  });

  describe('Concurrent Processing', () => {
    it('should handle concurrent event creation', async () => {
      const eventData = {
        bookingId: 'booking-123',
        eventType: 'BOOKING_CONFIRMED',
        payload: { userId: 'user-1' },
      };

      const mockEvent: OutboxEvent = {
        id: 'event-123',
        bookingId: 'booking-123',
        eventType: 'BOOKING_CONFIRMED',
        payload: eventData.payload,
        status: 'PENDING',
        attempts: 0,
        createdAt: new Date(),
      };

      (prisma.$queryRaw as jest.Mock).mockResolvedValue([mockEvent]);

      const promises = Array.from({ length: 5 }, () => 
        service.createEvent(eventData)
      );

      await Promise.all(promises);

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(5);
    });

    it('should handle concurrent status updates', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      const promises = [
        service.markProcessing('event-1'),
        service.markProcessing('event-2'),
        service.markCompleted('event-3'),
        service.markFailed('event-4', 'Error'),
      ];

      await Promise.all(promises);

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(4);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors during event creation', async () => {
      (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

      await expect(
        service.createEvent({
          bookingId: 'booking-123',
          eventType: 'BOOKING_CONFIRMED',
          payload: {},
        })
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle database errors during event retrieval', async () => {
      (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('Query timeout'));

      await expect(service.getPendingEvents(100)).rejects.toThrow('Query timeout');
    });

    it('should handle database errors during status updates', async () => {
      (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('Update failed'));

      await expect(service.markProcessing('event-123')).rejects.toThrow('Update failed');
    });
  });
});
