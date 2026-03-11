import { BookingProcessor } from './booking.processor';

/* ── mocks ── */

const mockPrisma = {
  booking: {
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  bookingStateHistory: {
    create: jest.fn().mockResolvedValue({}),
  },
  $transaction: jest.fn(async (fn: (tx: any) => Promise<any>) => {
    return fn(mockPrisma);
  }),
};

const mockNotificationsService = {
  sendNotification: jest.fn(),
};

function makeJob(name: string, data: any, overrides: any = {}) {
  return {
    id: 'job-1',
    name,
    data,
    queue: { add: jest.fn() },
    ...overrides,
  } as any;
}

describe('BookingProcessor', () => {
  let processor: BookingProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new BookingProcessor(
      mockPrisma as any,
      mockNotificationsService as any,
    );
  });

  /* ─── Queue lifecycle events ─── */

  it('onActive logs without error', () => {
    expect(() => processor.onActive(makeJob('test', {}))).not.toThrow();
  });

  it('onCompleted logs without error', () => {
    expect(() => processor.onCompleted(makeJob('test', {}))).not.toThrow();
  });

  it('onFailed logs without error', () => {
    expect(() => processor.onFailed(makeJob('test', {}), new Error('boom'))).not.toThrow();
  });

  /* ─── handleBookingExpiration ─── */

  describe('handleBookingExpiration', () => {
    it('skips when booking not found', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(null);
      const job = makeJob('check-expiration', { bookingId: 'b1', expiresAt: new Date() });
      await processor.handleBookingExpiration(job);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('skips when booking status is not pending', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'b1',
        status: 'CONFIRMED',
        listing: { title: 'Camera' },
        renter: { id: 'u1' },
      });
      const job = makeJob('check-expiration', { bookingId: 'b1', expiresAt: new Date() });
      await processor.handleBookingExpiration(job);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('cancels expired pending booking and notifies renter', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'b1',
        status: 'PENDING_PAYMENT',
        renterId: 'renter-1',
        listing: { title: 'Camera' },
        renter: { id: 'renter-1' },
      });
      mockPrisma.booking.update.mockResolvedValue({});
      mockNotificationsService.sendNotification.mockResolvedValue(undefined);

      const pastDate = new Date(Date.now() - 60_000);
      const job = makeJob('check-expiration', { bookingId: 'b1', expiresAt: pastDate });
      await processor.handleBookingExpiration(job);

      expect(mockPrisma.booking.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'b1' }),
          data: expect.objectContaining({ status: 'CANCELLED' }),
        }),
      );
      expect(mockPrisma.bookingStateHistory.create).toHaveBeenCalled();
      expect(mockNotificationsService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'renter-1',
          type: 'BOOKING_CANCELLED',
        }),
      );
    });

    it('does not cancel if not yet expired', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'b1',
        status: 'PENDING_PAYMENT',
        listing: { title: 'Camera' },
        renter: { id: 'u1' },
      });
      const futureDate = new Date(Date.now() + 60_000);
      const job = makeJob('check-expiration', { bookingId: 'b1', expiresAt: futureDate });
      await processor.handleBookingExpiration(job);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('re-throws on prisma error', async () => {
      mockPrisma.booking.findUnique.mockRejectedValue(new Error('DB error'));
      const job = makeJob('check-expiration', { bookingId: 'b1', expiresAt: new Date() });
      await expect(processor.handleBookingExpiration(job)).rejects.toThrow('DB error');
    });
  });

  /* ─── handleBookingReminder ─── */

  describe('handleBookingReminder', () => {
    it('skips when booking not found', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(null);
      const job = makeJob('send-reminder', { bookingId: 'b1', type: 'UPCOMING' });
      await processor.handleBookingReminder(job);
      expect(mockNotificationsService.sendNotification).not.toHaveBeenCalled();
    });

    it('sends UPCOMING reminder with correct message', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'b1',
        renterId: 'renter-1',
        listing: { title: 'Camera' },
        renter: { id: 'renter-1' },
      });
      mockNotificationsService.sendNotification.mockResolvedValue(undefined);

      const job = makeJob('send-reminder', { bookingId: 'b1', type: 'UPCOMING' });
      await processor.handleBookingReminder(job);

      expect(mockNotificationsService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Booking Starting Soon',
          type: 'BOOKING_REMINDER',
          channels: ['EMAIL', 'PUSH', 'IN_APP'],
        }),
      );
    });

    it('sends RETURN_DUE reminder', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'b1',
        renterId: 'renter-1',
        listing: { title: 'Bike' },
        renter: { id: 'renter-1' },
      });
      mockNotificationsService.sendNotification.mockResolvedValue(undefined);

      const job = makeJob('send-reminder', { bookingId: 'b1', type: 'RETURN_DUE' });
      await processor.handleBookingReminder(job);

      expect(mockNotificationsService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Return Reminder',
          message: expect.stringContaining('Bike'),
        }),
      );
    });

    it('sends ONGOING reminder', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'b1',
        renterId: 'renter-1',
        listing: { title: 'Car' },
        renter: { id: 'renter-1' },
      });
      mockNotificationsService.sendNotification.mockResolvedValue(undefined);

      const job = makeJob('send-reminder', { bookingId: 'b1', type: 'ONGOING' });
      await processor.handleBookingReminder(job);

      expect(mockNotificationsService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Active Booking Reminder' }),
      );
    });
  });

  /* ─── handleAutoComplete ─── */

  describe('handleAutoComplete', () => {
    it('skips when booking not found', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(null);
      const job = makeJob('auto-complete', { bookingId: 'b1' });
      await processor.handleAutoComplete(job);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('skips when booking is not AWAITING_RETURN_INSPECTION', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'b1',
        status: 'CONFIRMED',
        conditionReports: [],
        listing: {},
      });
      const job = makeJob('auto-complete', { bookingId: 'b1' });
      await processor.handleAutoComplete(job);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('auto-completes when return report has no severe damage', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'b1',
        status: 'AWAITING_RETURN_INSPECTION',
        conditionReports: [
          {
            reportType: 'CHECK_OUT',
            status: 'COMPLETED',
            checklistData: { damages: [{ severity: 'MINOR' }] },
          },
        ],
        listing: {},
      });
      mockPrisma.booking.updateMany.mockResolvedValue({ count: 1 });

      const job = makeJob('auto-complete', { bookingId: 'b1' });
      await processor.handleAutoComplete(job);

      expect(mockPrisma.booking.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'b1' }),
          data: expect.objectContaining({ status: 'COMPLETED' }),
        }),
      );
      // Settlement is now handled by auto-settlement cron after 48-hour dispute window
    });

    it('does not auto-complete when severe damage detected', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'b1',
        status: 'AWAITING_RETURN_INSPECTION',
        conditionReports: [
          {
            reportType: 'CHECK_OUT',
            status: 'COMPLETED',
            checklistData: { damages: [{ severity: 'SEVERE' }] },
          },
        ],
        listing: {},
      });
      const job = makeJob('auto-complete', { bookingId: 'b1' });
      await processor.handleAutoComplete(job);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  /* ─── handleStatusUpdate ─── */

  describe('handleStatusUpdate', () => {
    it('updates booking status', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({ status: 'PENDING_PAYMENT' });
      mockPrisma.booking.update.mockResolvedValue({});
      const job = makeJob('update-status', { bookingId: 'b1', status: 'CONFIRMED' });
      await processor.handleStatusUpdate(job);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'b1' },
          data: expect.objectContaining({ status: 'CONFIRMED' }),
        }),
      );
      expect(mockPrisma.bookingStateHistory.create).toHaveBeenCalled();
    });

    it('includes cancellation reason when provided', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({ status: 'CONFIRMED' });
      mockPrisma.booking.update.mockResolvedValue({});
      const job = makeJob('update-status', {
        bookingId: 'b1',
        status: 'CANCELLED',
        reason: 'User requested',
      });
      await processor.handleStatusUpdate(job);

      expect(mockPrisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'CANCELLED',
            cancellationReason: 'User requested',
          }),
        }),
      );
    });

    it('re-throws on db error', async () => {
      mockPrisma.$transaction.mockRejectedValueOnce(new Error('DB fail'));
      const job = makeJob('update-status', { bookingId: 'b1', status: 'CONFIRMED' });
      await expect(processor.handleStatusUpdate(job)).rejects.toThrow('DB fail');
    });
  });
});
