import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { AdminUsersService } from './admin-users.service';
import { PrismaService } from '@/common/prisma/prisma.service';

describe('AdminUsersService', () => {
  let service: AdminUsersService;
  let prisma: jest.Mocked<PrismaService>;

  const adminId = 'admin-1';
  const adminUser = { id: adminId, role: 'ADMIN', status: 'ACTIVE' };
  const normalUserId = 'user-1';
  const normalUser = {
    id: normalUserId,
    email: 'user@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'USER',
    status: 'ACTIVE',
    userPreferences: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminUsersService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
              update: jest.fn(),
            },
            listing: {
              updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            },
            auditLog: {
              create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
            },
          },
        },
      ],
    }).compile();

    service = module.get(AdminUsersService);
    prisma = module.get(PrismaService);
  });

  const setupAdminVerification = () => {
    // First call: verifyAdmin → returns admin user
    // Subsequent calls: actual queries
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(adminUser);
  };

  describe('verifyAdmin', () => {
    it('rejects non-existent user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.getAllUsers('ghost', {})).rejects.toThrow(ForbiddenException);
    });

    it('rejects non-admin user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u', role: 'USER' });
      await expect(service.getAllUsers('u', {})).rejects.toThrow(ForbiddenException);
    });

    it.each(['ADMIN', 'SUPER_ADMIN', 'OPERATIONS_ADMIN', 'FINANCE_ADMIN', 'SUPPORT_ADMIN'])(
      'allows %s role',
      async (role) => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ id: adminId, role });
        (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.user.count as jest.Mock).mockResolvedValue(0);

        const result = await service.getAllUsers(adminId, {});
        expect(result).toBeDefined();
      },
    );
  });

  describe('getAllUsers', () => {
    it('returns paginated users with defaults', async () => {
      setupAdminVerification();
      (prisma.user.findMany as jest.Mock).mockResolvedValue([normalUser]);
      (prisma.user.count as jest.Mock).mockResolvedValue(1);

      const result = await service.getAllUsers(adminId, {});
      expect(result.users).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('filters by role', async () => {
      setupAdminVerification();
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.user.count as jest.Mock).mockResolvedValue(0);

      await service.getAllUsers(adminId, { role: 'HOST' as any });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ role: 'HOST' }),
        }),
      );
    });

    it('applies search across email, firstName, lastName', async () => {
      setupAdminVerification();
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.user.count as jest.Mock).mockResolvedValue(0);

      await service.getAllUsers(adminId, { search: 'sam' });

      const call = (prisma.user.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where.OR).toHaveLength(3);
    });

    it('applies pagination', async () => {
      setupAdminVerification();
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.user.count as jest.Mock).mockResolvedValue(50);

      await service.getAllUsers(adminId, { page: 3, limit: 10 });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });
  });

  describe('getUserById', () => {
    it('returns user with counts', async () => {
      setupAdminVerification();
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
        ...normalUser,
        _count: { listings: 5, bookings: 10, reviewsGiven: 3 },
      });

      const result = await service.getUserById(adminId, normalUserId);
      expect(result._count.listings).toBe(5);
    });

    it('throws when user not found', async () => {
      setupAdminVerification();
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);

      await expect(service.getUserById(adminId, 'nonexistent')).rejects.toThrow('User not found');
    });
  });

  describe('updateUserRole', () => {
    it('updates user role', async () => {
      setupAdminVerification();
      (prisma.user.update as jest.Mock).mockResolvedValue({ ...normalUser, role: 'HOST' });

      const result = await service.updateUserRole(adminId, normalUserId, 'HOST' as any);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: normalUserId },
        data: { role: 'HOST' },
      });
    });
  });

  describe('toggleUserStatus', () => {
    it('suspends user and pauses their listings', async () => {
      setupAdminVerification();
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(normalUser);
      (prisma.user.update as jest.Mock).mockResolvedValue({ ...normalUser, status: 'SUSPENDED' });

      await service.toggleUserStatus(adminId, normalUserId, true);

      expect(prisma.listing.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ ownerId: normalUserId }),
          data: expect.objectContaining({ status: 'SUSPENDED' }),
        }),
      );
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: normalUserId },
        data: { status: 'SUSPENDED' },
      });
    });

    it('activates suspended user', async () => {
      setupAdminVerification();
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
        ...normalUser,
        status: 'SUSPENDED',
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({ ...normalUser, status: 'ACTIVE' });

      await service.toggleUserStatus(adminId, normalUserId, false);

      expect(prisma.listing.updateMany).not.toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: normalUserId },
        data: { status: 'ACTIVE' },
      });
    });

    it('throws when trying to suspend admin', async () => {
      setupAdminVerification();
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'admin-2',
        role: 'ADMIN',
        userPreferences: null,
      });

      await expect(
        service.toggleUserStatus(adminId, 'admin-2', true),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when trying to suspend super admin', async () => {
      setupAdminVerification();
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'super-admin',
        role: 'SUPER_ADMIN',
        userPreferences: null,
      });

      await expect(
        service.toggleUserStatus(adminId, 'super-admin', true),
      ).rejects.toThrow('Cannot suspend admin users');
    });

    it('throws when target user not found', async () => {
      setupAdminVerification();
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        service.toggleUserStatus(adminId, 'ghost', true),
      ).rejects.toThrow('User not found');
    });
  });
});
