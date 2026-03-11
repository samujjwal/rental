 
import { Logger } from '@nestjs/common';
import { NotificationProcessor } from './notification.processor';

/* ── helpers ── */

function makeJob(name: string, data: any, overrides: any = {}) {
  return { id: `job-${Date.now()}`, name, data, ...overrides };
}

const mockSendNotification = jest.fn();
const mockNotificationsService: any = {
  sendNotification: mockSendNotification,
};

let processor: NotificationProcessor;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Logger.prototype, 'log').mockImplementation();
  jest.spyOn(Logger.prototype, 'error').mockImplementation();
  processor = new NotificationProcessor(mockNotificationsService);
});

describe('NotificationProcessor', () => {
  /* ── lifecycle ── */
  describe('queue lifecycle', () => {
    it('logs on active', () => {
      processor.onActive(makeJob('send', {}) as any);
      expect(Logger.prototype.log).toHaveBeenCalledWith(expect.stringContaining('Processing'));
    });

    it('logs on completed', () => {
      processor.onCompleted(makeJob('send', {}) as any);
      expect(Logger.prototype.log).toHaveBeenCalledWith(expect.stringContaining('completed'));
    });

    it('logs error on failed', () => {
      processor.onFailed(makeJob('send', {}) as any, new Error('boom'));
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.stringContaining('boom'),
        expect.any(String),
      );
    });
  });

  /* ── send ── */
  describe('handleSendNotification', () => {
    it('sends notification via service', async () => {
      const data = { userId: 'u1', type: 'BOOKING_CONFIRMED', title: 'Confirmed', message: 'Done' };
      mockSendNotification.mockResolvedValue(undefined);

      await processor.handleSendNotification(makeJob('send', data) as any);

      expect(mockSendNotification).toHaveBeenCalledWith(data);
      expect(Logger.prototype.log).toHaveBeenCalledWith(expect.stringContaining('u1'));
    });

    it('re-throws on failure', async () => {
      mockSendNotification.mockRejectedValue(new Error('send failed'));

      await expect(
        processor.handleSendNotification(makeJob('send', { userId: 'u1' }) as any),
      ).rejects.toThrow('send failed');

      expect(Logger.prototype.error).toHaveBeenCalledWith(expect.stringContaining('send failed'));
    });
  });

  /* ── send-batch ── */
  describe('handleBatchNotifications', () => {
    it('sends all notifications and returns counts', async () => {
      const notifications = [
        { userId: 'u1', type: 'TEST', title: 'T1', message: 'M1' },
        { userId: 'u2', type: 'TEST', title: 'T2', message: 'M2' },
        { userId: 'u3', type: 'TEST', title: 'T3', message: 'M3' },
      ];
      mockSendNotification.mockResolvedValue(undefined);

      const result = await processor.handleBatchNotifications(
        makeJob('send-batch', { notifications }) as any,
      );

      expect(mockSendNotification).toHaveBeenCalledTimes(3);
      expect(result).toEqual({ successful: 3, failed: 0 });
    });

    it('counts partial failures', async () => {
      const notifications = [
        { userId: 'u1', type: 'T', title: 'T1', message: 'M1' },
        { userId: 'u2', type: 'T', title: 'T2', message: 'M2' },
      ];
      mockSendNotification
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('failed'));

      const result = await processor.handleBatchNotifications(
        makeJob('send-batch', { notifications }) as any,
      );

      expect(result).toEqual({ successful: 1, failed: 1 });
    });
  });

  /* ── scheduled ── */
  describe('handleScheduledNotification', () => {
    it('sends scheduled notification', async () => {
      const data = { userId: 'u1', type: 'REMINDER', title: 'Reminder', message: 'Do not forget' };
      mockSendNotification.mockResolvedValue(undefined);

      await processor.handleScheduledNotification(makeJob('scheduled', data) as any);

      expect(mockSendNotification).toHaveBeenCalledWith(data);
      expect(Logger.prototype.log).toHaveBeenCalledWith(expect.stringContaining('Scheduled'));
    });

    it('re-throws on failure', async () => {
      mockSendNotification.mockRejectedValue(new Error('schedule fail'));

      await expect(
        processor.handleScheduledNotification(makeJob('scheduled', { userId: 'u1' }) as any),
      ).rejects.toThrow('schedule fail');
    });
  });
});
