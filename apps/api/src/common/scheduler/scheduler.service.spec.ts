 
import { Logger } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { BookingStatus } from '@rental-portal/database';

/* ── Mocks ── */

const mockFindManyBooking = jest.fn();
const mockFindManyNotification = jest.fn();
const mockUpdateNotification = jest.fn();
const mockDeleteManyNotification = jest.fn();
const mockDeleteManySession = jest.fn();
const mockDeleteManyAuditLog = jest.fn();
const mockFindManyUser = jest.fn();
const mockAggregateReview = jest.fn();
const mockUpdateUser = jest.fn();
const mockFindManyListing = jest.fn();
const mockUpdateListing = jest.fn();
const mockQueryRaw = jest.fn();

const mockPrisma: any = {
  booking: { findMany: mockFindManyBooking },
  notification: {
    findMany: mockFindManyNotification,
    update: mockUpdateNotification,
    deleteMany: mockDeleteManyNotification,
  },
  session: { deleteMany: mockDeleteManySession },
  auditLog: { deleteMany: mockDeleteManyAuditLog },
  user: { findMany: mockFindManyUser, update: mockUpdateUser },
  review: { aggregate: mockAggregateReview },
  listing: { findMany: mockFindManyListing, update: mockUpdateListing },
  $queryRaw: mockQueryRaw,
};

const mockEmbeddingService: any = {
  backfillEmbeddings: jest.fn(),
};

const makeQueue = () => ({ add: jest.fn(), isReady: jest.fn().mockResolvedValue(true) });
const bookingsQueue = makeQueue();
const notificationsQueue = makeQueue();
const searchQueue = makeQueue();
const cleanupQueue = makeQueue();

const mockSchedulerRegistry: any = {
  getIntervals: jest.fn().mockReturnValue([]),
  deleteInterval: jest.fn(),
  getCronJobs: jest.fn().mockReturnValue(new Map()),
  deleteCronJob: jest.fn(),
};

const mockLockService: any = {
  acquireLock: jest.fn().mockResolvedValue(true),
  releaseLock: jest.fn().mockResolvedValue(undefined),
  withLock: jest.fn().mockImplementation((_key: string, fn: () => Promise<any>) => fn()),
};

let service: SchedulerService;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Logger.prototype, 'log').mockImplementation();
  jest.spyOn(Logger.prototype, 'error').mockImplementation();

  service = new SchedulerService(
    mockPrisma,
    mockEmbeddingService,
    bookingsQueue as any,
    {} as any, // paymentsQueue
    notificationsQueue as any,
    searchQueue as any,
    cleanupQueue as any,
    mockSchedulerRegistry,
    mockLockService,
  );
});

/* ═══════════════════════════════════════════════════════════════════════ */

describe('SchedulerService', () => {
  /* ── checkExpiredBookings ── */
  describe('checkExpiredBookings', () => {
    it('queues each expired booking', async () => {
      const bookings = [
        { id: 'b1', createdAt: new Date('2024-01-01') },
        { id: 'b2', createdAt: new Date('2024-01-02') },
      ];
      mockFindManyBooking.mockResolvedValue(bookings);

      await service.checkExpiredBookings();

      expect(mockFindManyBooking).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: BookingStatus.PENDING_PAYMENT }),
        }),
      );
      expect(bookingsQueue.add).toHaveBeenCalledTimes(2);
      expect(bookingsQueue.add).toHaveBeenCalledWith('check-expiration', expect.objectContaining({ bookingId: 'b1' }));
      expect(bookingsQueue.add).toHaveBeenCalledWith('check-expiration', expect.objectContaining({ bookingId: 'b2' }));
    });

    it('does nothing when no expired bookings found', async () => {
      mockFindManyBooking.mockResolvedValue([]);

      await service.checkExpiredBookings();

      expect(bookingsQueue.add).not.toHaveBeenCalled();
    });

    it('catches and logs errors', async () => {
      mockFindManyBooking.mockRejectedValue(new Error('db down'));

      await service.checkExpiredBookings();

      expect(Logger.prototype.error).toHaveBeenCalledWith(expect.stringContaining('db down'));
    });
  });

  /* ── sendUpcomingBookingReminders ── */
  describe('sendUpcomingBookingReminders', () => {
    it('queues reminders for confirmed bookings starting tomorrow', async () => {
      const bookings = [{ id: 'bk1', renterId: 'u1', listing: { title: 'Camera' } }];
      mockFindManyBooking.mockResolvedValue(bookings);

      await service.sendUpcomingBookingReminders();

      expect(mockFindManyBooking).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: BookingStatus.CONFIRMED }),
        }),
      );
      expect(bookingsQueue.add).toHaveBeenCalledWith('send-reminder', { bookingId: 'bk1', type: 'UPCOMING' });
    });

    it('catches and logs errors', async () => {
      mockFindManyBooking.mockRejectedValue(new Error('timeout'));

      await service.sendUpcomingBookingReminders();

      expect(Logger.prototype.error).toHaveBeenCalledWith(expect.stringContaining('timeout'));
    });
  });

  /* ── sendReturnReminders ── */
  describe('sendReturnReminders', () => {
    it('queues return reminders for in-progress bookings ending soon', async () => {
      const bookings = [{ id: 'ret1' }, { id: 'ret2' }];
      mockFindManyBooking.mockResolvedValue(bookings);

      await service.sendReturnReminders();

      expect(mockFindManyBooking).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: BookingStatus.IN_PROGRESS }),
        }),
      );
      expect(bookingsQueue.add).toHaveBeenCalledTimes(2);
      expect(bookingsQueue.add).toHaveBeenCalledWith('send-reminder', { bookingId: 'ret1', type: 'RETURN_DUE' });
    });

    it('handles empty results', async () => {
      mockFindManyBooking.mockResolvedValue([]);

      await service.sendReturnReminders();

      expect(bookingsQueue.add).not.toHaveBeenCalled();
    });
  });

  /* ── autoCompleteBookings ── */
  describe('autoCompleteBookings', () => {
    it('queues auto-complete for stale awaiting-return bookings', async () => {
      mockFindManyBooking.mockResolvedValue([{ id: 'ac1' }]);

      await service.autoCompleteBookings();

      expect(mockFindManyBooking).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: BookingStatus.AWAITING_RETURN_INSPECTION }),
        }),
      );
      expect(bookingsQueue.add).toHaveBeenCalledWith('auto-complete', { bookingId: 'ac1' });
    });

    it('catches errors', async () => {
      mockFindManyBooking.mockRejectedValue(new Error('oops'));

      await service.autoCompleteBookings();

      expect(Logger.prototype.error).toHaveBeenCalledWith(expect.stringContaining('oops'));
    });
  });

  /* ── processScheduledNotifications ── */
  describe('processScheduledNotifications', () => {
    it('queues scheduled notifications and marks them PENDING', async () => {
      const notifications = [
        { id: 'n1', userId: 'u1', type: 'booking', title: 'T1', message: 'M1', data: {} },
        { id: 'n2', userId: 'u2', type: 'system', title: 'T2', message: 'M2', data: null },
      ];
      mockFindManyNotification.mockResolvedValue(notifications);

      await service.processScheduledNotifications();

      expect(notificationsQueue.add).toHaveBeenCalledTimes(2);
      expect(notificationsQueue.add).toHaveBeenCalledWith('scheduled', expect.objectContaining({ userId: 'u1' }));
      expect(mockUpdateNotification).toHaveBeenCalledTimes(2);
      expect(mockUpdateNotification).toHaveBeenCalledWith({ where: { id: 'n1' }, data: { status: 'PENDING' } });
    });

    it('catches errors', async () => {
      mockFindManyNotification.mockRejectedValue(new Error('boom'));

      await service.processScheduledNotifications();

      expect(Logger.prototype.error).toHaveBeenCalledWith(expect.stringContaining('boom'));
    });
  });

  /* ── reindexSearchEngine ── */
  describe('reindexSearchEngine', () => {
    it('queues a reindex-all job with batchSize', async () => {
      await service.reindexSearchEngine();

      expect(searchQueue.add).toHaveBeenCalledWith('reindex-all', { batchSize: 500 });
    });

    it('catches errors', async () => {
      searchQueue.add.mockRejectedValueOnce(new Error('queue err'));

      await service.reindexSearchEngine();

      expect(Logger.prototype.error).toHaveBeenCalledWith(expect.stringContaining('queue err'));
    });
  });

  /* ── cleanupOldData ── */
  describe('cleanupOldData', () => {
    it('deletes old notifications, sessions, and audit logs', async () => {
      mockDeleteManyNotification.mockResolvedValue({ count: 5 });
      mockDeleteManySession.mockResolvedValue({ count: 3 });
      mockDeleteManyAuditLog.mockResolvedValue({ count: 1 });

      await service.cleanupOldData();

      expect(mockDeleteManyNotification).toHaveBeenCalled();
      expect(mockDeleteManySession).toHaveBeenCalled();
      expect(mockDeleteManyAuditLog).toHaveBeenCalled();
      expect(Logger.prototype.log).toHaveBeenCalledWith(expect.stringContaining('5'));
      expect(Logger.prototype.log).toHaveBeenCalledWith(expect.stringContaining('3'));
      expect(Logger.prototype.log).toHaveBeenCalledWith(expect.stringContaining('1'));
    });

    it('catches errors', async () => {
      mockDeleteManyNotification.mockRejectedValue(new Error('perm'));

      await service.cleanupOldData();

      expect(Logger.prototype.error).toHaveBeenCalledWith(expect.stringContaining('perm'));
    });
  });

  /* ── updateAggregatedRatings ── */
  describe('updateAggregatedRatings', () => {
    it('updates user and listing ratings', async () => {
      mockFindManyUser.mockResolvedValue([{ id: 'u1' }]);
      mockAggregateReview.mockResolvedValue({ _avg: { overallRating: 4.5 }, _count: 10 });
      mockFindManyListing.mockResolvedValue([{ id: 'l1' }]);

      await service.updateAggregatedRatings();

      expect(mockUpdateUser).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { averageRating: 4.5 },
      });
      expect(mockUpdateListing).toHaveBeenCalledWith({
        where: { id: 'l1' },
        data: { averageRating: 4.5 },
      });
    });

    it('defaults to 0 when no ratings', async () => {
      mockFindManyUser.mockResolvedValue([{ id: 'u1' }]);
      mockAggregateReview.mockResolvedValue({ _avg: { overallRating: null }, _count: 0 });
      mockFindManyListing.mockResolvedValue([]);

      await service.updateAggregatedRatings();

      expect(mockUpdateUser).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { averageRating: 0 },
      });
    });

    it('catches errors', async () => {
      mockFindManyUser.mockRejectedValue(new Error('fail'));

      await service.updateAggregatedRatings();

      expect(Logger.prototype.error).toHaveBeenCalledWith(expect.stringContaining('fail'));
    });
  });

  /* ── retryFailedSettlements ── */
  describe('retryFailedSettlements', () => {
    it('queues settlement retries for completed stale bookings', async () => {
      mockFindManyBooking.mockResolvedValue([
        { id: 's1', completedAt: new Date() },
        { id: 's2', completedAt: new Date() },
      ]);

      await service.retryFailedSettlements();

      expect(bookingsQueue.add).toHaveBeenCalledTimes(2);
      expect(bookingsQueue.add).toHaveBeenCalledWith('settle-booking', { bookingId: 's1' });
    });

    it('counts successes and failures', async () => {
      mockFindManyBooking.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);
      bookingsQueue.add.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('fail'));

      await service.retryFailedSettlements();

      expect(Logger.prototype.log).toHaveBeenCalledWith(expect.stringContaining('1 queued'));
      expect(Logger.prototype.log).toHaveBeenCalledWith(expect.stringContaining('1 failed'));
    });

    it('catches top-level errors', async () => {
      mockFindManyBooking.mockRejectedValue(new Error('top'));

      await service.retryFailedSettlements();

      expect(Logger.prototype.error).toHaveBeenCalledWith(expect.stringContaining('top'));
    });
  });

  /* ── healthCheck ── */
  describe('healthCheck', () => {
    it('checks database and all queues', async () => {
      mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);

      await service.healthCheck();

      expect(mockQueryRaw).toHaveBeenCalled();
      expect(bookingsQueue.isReady).toHaveBeenCalled();
      expect(notificationsQueue.isReady).toHaveBeenCalled();
      expect(searchQueue.isReady).toHaveBeenCalled();
    });

    it('logs error when health check fails', async () => {
      mockQueryRaw.mockRejectedValue(new Error('conn lost'));

      await service.healthCheck();

      expect(Logger.prototype.error).toHaveBeenCalledWith(expect.stringContaining('conn lost'));
    });
  });

  /* ── backfillEmbeddings ── */
  describe('backfillEmbeddings', () => {
    it('calls embedding service and logs result', async () => {
      mockEmbeddingService.backfillEmbeddings.mockResolvedValue({ processed: 10, total: 50 });

      await service.backfillEmbeddings();

      expect(mockEmbeddingService.backfillEmbeddings).toHaveBeenCalledWith(50);
      expect(Logger.prototype.log).toHaveBeenCalledWith(expect.stringContaining('processed'));
    });

    it('catches errors', async () => {
      mockEmbeddingService.backfillEmbeddings.mockRejectedValue(new Error('embed err'));

      await service.backfillEmbeddings();

      expect(Logger.prototype.error).toHaveBeenCalledWith(expect.stringContaining('embed err'));
    });
  });
});
