import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  const mockHealthCheckService = {
    check: jest.fn(),
  };
  const mockHttpIndicator = { pingCheck: jest.fn() };
  const mockPrismaIndicator = { pingCheck: jest.fn() };
  const mockMemoryIndicator = {
    checkHeap: jest.fn(),
    checkRSS: jest.fn(),
  };
  const mockDiskIndicator = { checkStorage: jest.fn() };
  const mockPrisma = {};
  const mockQueue = () => ({
    getActiveCount: jest.fn().mockResolvedValue(0),
    getFailedCount: jest.fn().mockResolvedValue(0),
    getWaitingCount: jest.fn().mockResolvedValue(0),
    isReady: jest.fn().mockResolvedValue(true),
  });

  const bookingsQueue = mockQueue();
  const notificationsQueue = mockQueue();
  const searchQueue = mockQueue();

  beforeEach(() => {
    jest.clearAllMocks();

    controller = new HealthController(
      mockHealthCheckService as any,
      mockHttpIndicator as any,
      mockPrismaIndicator as any,
      mockMemoryIndicator as any,
      mockDiskIndicator as any,
      mockPrisma as any,
      { isHealthy: jest.fn().mockResolvedValue({ externalServices: { status: 'up' } }) } as any,
      bookingsQueue as any,
      notificationsQueue as any,
      searchQueue as any,
    );
  });

  it('is defined', () => {
    expect(controller).toBeDefined();
  });

  describe('check', () => {
    it('calls health.check with 4 indicators', () => {
      mockHealthCheckService.check.mockResolvedValue({ status: 'ok' });
      controller.check();
      expect(mockHealthCheckService.check).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.any(Function),
          expect.any(Function),
          expect.any(Function),
          expect.any(Function),
        ]),
      );
    });
  });

  describe('checkDatabase', () => {
    it('calls health.check with prisma ping', () => {
      mockHealthCheckService.check.mockResolvedValue({ status: 'ok' });
      controller.checkDatabase();
      expect(mockHealthCheckService.check).toHaveBeenCalledWith([expect.any(Function)]);
    });
  });

  describe('checkQueues', () => {
    it('calls health.check with queue stats', async () => {
      mockHealthCheckService.check.mockImplementation(async (fns) => {
        const results = await Promise.all(fns.map((fn: () => unknown) => fn()));
        return { status: 'ok', details: results };
      });
      const result = await controller.checkQueues();
      expect(result.details[0].queues.status).toBe('up');
      expect(result.details[0].queues.bookings).toEqual({
        active: 0,
        waiting: 0,
        failed: 0,
      });
    });
  });

  describe('checkMemory', () => {
    it('calls health.check with memory indicators', () => {
      mockHealthCheckService.check.mockResolvedValue({ status: 'ok' });
      controller.checkMemory();
      expect(mockHealthCheckService.check).toHaveBeenCalledWith([
        expect.any(Function),
        expect.any(Function),
      ]);
    });
  });

  describe('liveness', () => {
    it('returns ok status with timestamp', () => {
      const result = controller.liveness();
      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('readiness', () => {
    it('calls health.check with database and redis checks', () => {
      mockHealthCheckService.check.mockResolvedValue({ status: 'ok' });
      controller.readiness();
      expect(mockHealthCheckService.check).toHaveBeenCalledWith([
        expect.any(Function),
        expect.any(Function),
      ]);
    });
  });
});
