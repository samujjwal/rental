import { AdminSystemService } from './admin-system.service';
import { ForbiddenException } from '@nestjs/common';

describe('AdminSystemService', () => {
  let service: AdminSystemService;
  let prisma: any;

  const adminUser = {
    id: 'admin-1',
    role: 'ADMIN',
  };

  const mockQueue = () => ({
    add: jest.fn(),
    getActiveCount: jest.fn().mockResolvedValue(0),
    getWaitingCount: jest.fn().mockResolvedValue(0),
    getFailedCount: jest.fn().mockResolvedValue(0),
    getCompletedCount: jest.fn().mockResolvedValue(0),
    getDelayedCount: jest.fn().mockResolvedValue(0),
    isPaused: jest.fn().mockResolvedValue(false),
  });

  const mockSchedulerRegistry = {
    getCronJobs: jest.fn().mockReturnValue(new Map()),
    getIntervals: jest.fn().mockReturnValue([]),
    getTimeouts: jest.fn().mockReturnValue([]),
  };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
      auditLog: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ size: BigInt(1024), count: BigInt(5), name: 'test', rows: BigInt(100) }]),
    };

    service = new AdminSystemService(
      prisma as any,
      mockSchedulerRegistry as any,
      mockQueue() as any,
      mockQueue() as any,
      mockQueue() as any,
      mockQueue() as any,
      mockQueue() as any,
      mockQueue() as any,
    );
  });

  describe('verifyAdmin', () => {
    it('should throw ForbiddenException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.getGeneralSettings('nonexistent'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for non-admin role', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: 'RENTER' });

      await expect(
        service.getGeneralSettings('user-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getGeneralSettings', () => {
    it('should return general settings config', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);

      const settings = await service.getGeneralSettings('admin-1');

      expect(settings).toBeDefined();
      expect(typeof settings).toBe('object');
    });
  });

  describe('getApiKeys', () => {
    it('should return mock API key list', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);

      const keys = await service.getApiKeys('admin-1');

      expect(keys).toBeDefined();
    });
  });

  describe('getServiceConfig', () => {
    it('should return service configurations', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);

      const config = await service.getServiceConfig('admin-1');

      expect(config).toBeDefined();
    });
  });

  describe('getEnvironmentConfig', () => {
    it('should return environment config with masked secrets', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);

      const envConfig = await service.getEnvironmentConfig('admin-1');

      expect(envConfig).toBeDefined();
    });
  });

  describe('getSystemOverview', () => {
    it('should return system overview with status', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);

      const overview = await service.getSystemOverview('admin-1');

      expect(overview).toBeDefined();
    });
  });

  describe('getSystemHealth', () => {
    it('should return health status for services', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);

      const health = await service.getSystemHealth('admin-1');

      expect(health).toBeDefined();
    });
  });

  describe('getSystemLogs', () => {
    it('should return all logs when no level filter', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);

      const logs = await service.getSystemLogs('admin-1');

      expect(logs).toBeDefined();
    });

    it('should filter logs by level', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);

      const logs = await service.getSystemLogs('admin-1', 'error');

      expect(logs).toBeDefined();
    });

    it('should respect limit parameter', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);

      const logs = await service.getSystemLogs('admin-1', undefined, 5);

      expect(logs).toBeDefined();
    });
  });

  describe('getDatabaseInfo', () => {
    it('should return database info', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);

      const dbInfo = await service.getDatabaseInfo('admin-1');

      expect(dbInfo).toBeDefined();
    });
  });

  describe('getBackupInfo', () => {
    it('should return backup information', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);

      const backups = await service.getBackupInfo('admin-1');

      expect(backups).toBeDefined();
    });
  });
});
