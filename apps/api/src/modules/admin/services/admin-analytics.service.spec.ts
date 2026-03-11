import { AdminAnalyticsService } from './admin-analytics.service';
import { ForbiddenException } from '@nestjs/common';

describe('AdminAnalyticsService', () => {
  let service: AdminAnalyticsService;
  let prisma: any;

  const adminUser = {
    id: 'admin-1',
    role: 'ADMIN',
    email: 'admin@gharbatai.com',
  };

  const nonAdminUser = {
    id: 'user-1',
    role: 'RENTER',
    email: 'renter@gharbatai.com',
  };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        count: jest.fn().mockResolvedValue(100),
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      listing: {
        count: jest.fn().mockResolvedValue(50),
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      booking: {
        count: jest.fn().mockResolvedValue(200),
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      payment: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 500000 } }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(10),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      dispute: {
        count: jest.fn().mockResolvedValue(5),
      },
      category: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    service = new AdminAnalyticsService(prisma);
  });

  describe('verifyAdmin', () => {
    it('should throw ForbiddenException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.getDashboardStats('nonexistent'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for non-admin user', async () => {
      prisma.user.findUnique.mockResolvedValue(nonAdminUser);

      await expect(
        service.getDashboardStats('user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow ADMIN role', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);

      await expect(
        service.getDashboardStats('admin-1'),
      ).resolves.toBeDefined();
    });

    it('should allow SUPER_ADMIN role', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...adminUser, role: 'SUPER_ADMIN' });

      await expect(
        service.getDashboardStats('admin-1'),
      ).resolves.toBeDefined();
    });

    it('should allow OPERATIONS_ADMIN role', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...adminUser, role: 'OPERATIONS_ADMIN' });

      await expect(
        service.getDashboardStats('admin-1'),
      ).resolves.toBeDefined();
    });

    it('should allow FINANCE_ADMIN role', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...adminUser, role: 'FINANCE_ADMIN' });

      await expect(
        service.getDashboardStats('admin-1'),
      ).resolves.toBeDefined();
    });
  });

  describe('getDashboardStats', () => {
    it('should return aggregate dashboard statistics', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);

      const stats = await service.getDashboardStats('admin-1');

      expect(stats).toBeDefined();
      expect(stats.users).toBeDefined();
      expect(stats.listings).toBeDefined();
      expect(stats.bookings).toBeDefined();
    });

    it('should include recent users', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);
      prisma.user.findMany.mockResolvedValue([
        { id: 'u1', firstName: 'John', createdAt: new Date() },
      ]);

      const stats = await service.getDashboardStats('admin-1');

      expect(stats.users.recent).toBeDefined();
    });
  });

  describe('getAnalytics', () => {
    it('should return analytics with default month period', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);

      const analytics = await service.getAnalytics('admin-1');

      expect(analytics).toBeDefined();
      expect(analytics.growth).toBeDefined();
      expect(analytics.growth.newUsers).toBeDefined();
      expect(analytics.growth.newListings).toBeDefined();
    });
  });

  describe('getRevenueReport', () => {
    it('should return revenue report for date range', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);
      prisma.payment.findMany.mockResolvedValue([
        {
          amount: 10000,
          serviceFee: 1000,
          booking: { listing: { categoryId: 'cat-1' } },
        },
      ]);

      const report = await service.getRevenueReport(
        'admin-1',
        new Date('2024-01-01'),
        new Date('2024-12-31'),
      );

      expect(report).toBeDefined();
      expect(report.totalRevenue).toBeDefined();
    });
  });

  describe('mock data methods', () => {
    it('getUserAnalytics should return static data', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);

      const result = await service.getUserAnalytics('admin-1');

      expect(result).toBeDefined();
    });

    it('getBusinessAnalytics should return static data', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);

      const result = await service.getBusinessAnalytics('admin-1');

      expect(result).toBeDefined();
    });

    it('getPerformanceAnalytics should return static data', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);

      const result = await service.getPerformanceAnalytics('admin-1');

      expect(result).toBeDefined();
    });

    it('getCustomReports should return static data', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);

      const result = await service.getCustomReports('admin-1');

      expect(result).toBeDefined();
    });
  });
});
