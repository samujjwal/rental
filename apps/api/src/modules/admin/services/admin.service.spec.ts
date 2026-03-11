import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AdminUsersService } from './admin-users.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { UserRole, UserStatus, PropertyStatus } from '@rental-portal/database';

describe('AdminAnalyticsService', () => {
  let service: AdminAnalyticsService;
  let prisma: any;
  const originalNodeEnv = process.env.NODE_ENV;

  const adminId = 'admin-1';
  const userId = 'user-1';

  beforeEach(async () => {
    process.env.NODE_ENV = 'production';

    prisma = {
      user: {
        count: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      listing: {
        count: jest.fn(),
        findMany: jest.fn(),
        groupBy: jest.fn(),
      },
      booking: {
        count: jest.fn(),
      },
      payment: {
        aggregate: jest.fn(),
      },
      dispute: {
        count: jest.fn(),
      },
      category: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAnalyticsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AdminAnalyticsService>(AdminAnalyticsService);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('admin verification', () => {
    it('should reject non-admin users in production', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: userId, role: UserRole.USER });

      await expect(service.getDashboardStats(userId)).rejects.toThrow(ForbiddenException);
    });

    it('should reject when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getDashboardStats('missing')).rejects.toThrow(ForbiddenException);
    });

    it('should allow ADMIN role', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: adminId, role: UserRole.ADMIN });
      prisma.user.count.mockResolvedValue(100);
      prisma.listing.count.mockResolvedValue(50);
      prisma.booking.count.mockResolvedValue(25);
      prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 1000 } });
      prisma.dispute.count.mockResolvedValue(3);
      prisma.user.findMany.mockResolvedValue([]);

      const result = await service.getDashboardStats(adminId);

      expect(result).toBeDefined();
    });

    it('should allow SUPER_ADMIN role', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: adminId, role: UserRole.SUPER_ADMIN });
      prisma.user.count.mockResolvedValue(0);
      prisma.listing.count.mockResolvedValue(0);
      prisma.booking.count.mockResolvedValue(0);
      prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: null } });
      prisma.dispute.count.mockResolvedValue(0);
      prisma.user.findMany.mockResolvedValue([]);

      const result = await service.getDashboardStats(adminId);

      expect(result).toBeDefined();
    });

    it('should allow OPERATIONS_ADMIN role', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: adminId, role: UserRole.OPERATIONS_ADMIN });
      prisma.user.count.mockResolvedValue(0);
      prisma.listing.count.mockResolvedValue(0);
      prisma.booking.count.mockResolvedValue(0);
      prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: null } });
      prisma.dispute.count.mockResolvedValue(0);
      prisma.user.findMany.mockResolvedValue([]);

      const result = await service.getDashboardStats(adminId);

      expect(result).toBeDefined();
    });

    it('should allow FINANCE_ADMIN role', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: adminId, role: UserRole.FINANCE_ADMIN });
      prisma.user.count.mockResolvedValue(0);
      prisma.listing.count.mockResolvedValue(0);
      prisma.booking.count.mockResolvedValue(0);
      prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: null } });
      prisma.dispute.count.mockResolvedValue(0);
      prisma.user.findMany.mockResolvedValue([]);

      const result = await service.getDashboardStats(adminId);

      expect(result).toBeDefined();
    });

    it('should allow SUPPORT_ADMIN role', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: adminId, role: UserRole.SUPPORT_ADMIN });
      prisma.user.count.mockResolvedValue(0);
      prisma.listing.count.mockResolvedValue(0);
      prisma.booking.count.mockResolvedValue(0);
      prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: null } });
      prisma.dispute.count.mockResolvedValue(0);
      prisma.user.findMany.mockResolvedValue([]);

      const result = await service.getDashboardStats(adminId);

      expect(result).toBeDefined();
    });

    it('should reject non-admin roles regardless of NODE_ENV', async () => {
      process.env.NODE_ENV = 'development';
      prisma.user.findUnique.mockResolvedValue({ id: adminId, role: UserRole.USER });

      await expect(service.getDashboardStats(adminId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getDashboardStats', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({ id: adminId, role: UserRole.ADMIN });
    });

    it('should return dashboard statistics', async () => {
      prisma.user.count.mockResolvedValue(100);
      prisma.listing.count
        .mockResolvedValueOnce(50) // total
        .mockResolvedValueOnce(40); // active
      prisma.booking.count
        .mockResolvedValueOnce(200) // total
        .mockResolvedValueOnce(15); // active
      prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 25000 } });
      prisma.dispute.count.mockResolvedValue(5);
      prisma.user.findMany.mockResolvedValue([
        { id: 'u1', email: 'a@b.com', firstName: 'A', lastName: 'B', role: 'USER', createdAt: new Date() },
      ]);

      const result = await service.getDashboardStats(adminId);

      expect(result.users.total).toBe(100);
      expect(result.listings.total).toBe(50);
      expect(result.listings.active).toBe(40);
      expect(result.bookings.total).toBe(200);
      expect(result.bookings.active).toBe(15);
      expect(result.revenue.total).toBe(25000);
      expect(result.disputes.pending).toBe(5);
    });

    it('should handle zero revenue', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.listing.count.mockResolvedValue(0);
      prisma.booking.count.mockResolvedValue(0);
      prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: null } });
      prisma.dispute.count.mockResolvedValue(0);
      prisma.user.findMany.mockResolvedValue([]);

      const result = await service.getDashboardStats(adminId);

      expect(result.revenue.total).toBe(0);
    });
  });

  describe('getAnalytics', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({ id: adminId, role: UserRole.ADMIN });
    });

    it('should return analytics for month period', async () => {
      prisma.user.count.mockResolvedValue(10);
      prisma.listing.count.mockResolvedValue(5);
      prisma.booking.count.mockResolvedValueOnce(20).mockResolvedValueOnce(15);
      prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 5000 } });
      prisma.listing.groupBy.mockResolvedValue([]);
      prisma.listing.findMany.mockResolvedValue([]);
      prisma.category.findMany.mockResolvedValue([]);

      const result = await service.getAnalytics(adminId, 'month');

      expect(result.period).toBe('month');
      expect(result.growth.newUsers).toBe(10);
      expect(result.revenue.total).toBe(5000);
    });

    it('should support different period values', async () => {
      prisma.user.count.mockResolvedValue(3);
      prisma.listing.count.mockResolvedValue(1);
      prisma.booking.count.mockResolvedValue(2);
      prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: null } });
      prisma.listing.groupBy.mockResolvedValue([]);
      prisma.listing.findMany.mockResolvedValue([]);
      prisma.category.findMany.mockResolvedValue([]);

      const result = await service.getAnalytics(adminId, 'week');

      expect(result.period).toBe('week');
      expect(result.revenue.total).toBe(0);
    });
  });
});

describe('AdminUsersService', () => {
  let service: AdminUsersService;
  let prisma: any;
  const originalNodeEnv = process.env.NODE_ENV;

  const adminId = 'admin-1';
  const userId = 'user-1';

  beforeEach(async () => {
    process.env.NODE_ENV = 'production';

    prisma = {
      user: {
        count: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      listing: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminUsersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AdminUsersService>(AdminUsersService);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('getAllUsers', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({ id: adminId, role: UserRole.ADMIN });
    });

    it('should return paginated users', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'u1', email: 'a@b.com' }]);
      prisma.user.count.mockResolvedValue(1);

      const result = await service.getAllUsers(adminId);

      expect(result.users).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by role', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.getAllUsers(adminId, { role: UserRole.HOST });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ role: UserRole.HOST }),
        }),
      );
    });

    it('should search by email/name', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.getAllUsers(adminId, { search: 'john' });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ OR: expect.any(Array) }),
        }),
      );
    });
  });

  describe('updateUserRole', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({ id: adminId, role: UserRole.ADMIN });
    });

    it('should update user role', async () => {
      prisma.user.update.mockResolvedValue({ id: userId, role: UserRole.HOST });

      const result = await service.updateUserRole(adminId, userId, UserRole.HOST);

      expect(result.role).toBe(UserRole.HOST);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { role: UserRole.HOST },
      });
    });
  });

  describe('toggleUserStatus', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({ id: adminId, role: UserRole.ADMIN });
    });

    it('should suspend a user and pause their listings', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({ id: adminId, role: UserRole.ADMIN }) // verifyAdmin
        .mockResolvedValueOnce({ id: userId, userPreferences: null }); // find target user
      prisma.listing.updateMany.mockResolvedValue({ count: 3 });
      prisma.user.update.mockResolvedValue({ id: userId, status: UserStatus.SUSPENDED });

      const result = await service.toggleUserStatus(adminId, userId, true);

      expect(prisma.listing.updateMany).toHaveBeenCalledWith({
        where: { ownerId: userId, status: PropertyStatus.AVAILABLE },
        data: { status: PropertyStatus.SUSPENDED },
      });
      expect(result.status).toBe(UserStatus.SUSPENDED);
    });

    it('should reactivate a user', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({ id: adminId, role: UserRole.ADMIN })
        .mockResolvedValueOnce({ id: userId, userPreferences: null });
      prisma.user.update.mockResolvedValue({ id: userId, status: UserStatus.ACTIVE });

      const result = await service.toggleUserStatus(adminId, userId, false);

      expect(result.status).toBe(UserStatus.ACTIVE);
      expect(prisma.listing.updateMany).not.toHaveBeenCalled();
    });

    it('should throw when target user not found', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({ id: adminId, role: UserRole.ADMIN })
        .mockResolvedValueOnce(null);

      await expect(service.toggleUserStatus(adminId, 'missing', true)).rejects.toThrow(
        'User not found',
      );
    });
  });
});
