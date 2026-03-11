import { AdminEntityService } from './admin-entity.service';
import { ForbiddenException, BadRequestException } from '@nestjs/common';

describe('AdminEntityService', () => {
  let service: AdminEntityService;
  let prisma: any;
  let filterBuilder: any;

  const adminUser = { id: 'admin-1', role: 'ADMIN' };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      listing: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      booking: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      payment: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      dispute: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      review: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      category: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      organization: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      message: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      insurancePolicy: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      favorite: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      refund: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      payout: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      notification: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    filterBuilder = {
      parseFrontendFilters: jest.fn().mockReturnValue([]),
      buildWhereClause: jest.fn().mockReturnValue({}),
    };

    service = new AdminEntityService(prisma, filterBuilder);
  });

  describe('verifyAdmin', () => {
    it('should throw ForbiddenException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.getEntitySchema('nonexistent', 'users'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for non-admin user', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: 'RENTER' });

      await expect(
        service.getEntitySchema('user-1', 'users'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getEntitySchema', () => {
    it('should return schema for known entity', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);

      const schema = await service.getEntitySchema('admin-1', 'users');

      expect(schema).toBeDefined();
    });

    it('should return schema for listings entity', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);

      const schema = await service.getEntitySchema('admin-1', 'listings');

      expect(schema).toBeDefined();
    });

    it('should return schema for bookings entity', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);

      const schema = await service.getEntitySchema('admin-1', 'bookings');

      expect(schema).toBeDefined();
    });

    it('should throw for unknown entity', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);

      await expect(
        service.getEntitySchema('admin-1', 'nonexistent-entity'),
      ).rejects.toThrow();
    });
  });

  describe('getEntityData', () => {
    it('should return paginated data for users entity', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);
      prisma.user.findMany.mockResolvedValue([
        { id: 'u1', firstName: 'John', email: 'john@test.com' },
      ]);
      prisma.user.count.mockResolvedValue(1);

      const result = await service.getEntityData('admin-1', 'users');

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.pagination).toBeDefined();
    });

    it('should apply pagination options', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);

      await service.getEntityData('admin-1', 'users', {
        page: 2,
        limit: 10,
      });

      expect(prisma.user.findMany).toHaveBeenCalled();
    });

    it('should apply search filter', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);

      await service.getEntityData('admin-1', 'users', {
        search: 'john',
      });

      expect(prisma.user.findMany).toHaveBeenCalled();
    });

    it('should apply sorting options', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);

      await service.getEntityData('admin-1', 'users', {
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(prisma.user.findMany).toHaveBeenCalled();
    });

    it('should throw for unsupported entity', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);

      await expect(
        service.getEntityData('admin-1', 'unknown-entity'),
      ).rejects.toThrow();
    });

    it('should return data for listings entity', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);
      prisma.listing.findMany.mockResolvedValue([]);
      prisma.listing.count.mockResolvedValue(0);

      const result = await service.getEntityData('admin-1', 'listings');

      expect(result).toBeDefined();
    });

    it('should return data for bookings entity', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.booking.count.mockResolvedValue(0);

      const result = await service.getEntityData('admin-1', 'bookings');

      expect(result).toBeDefined();
    });

    it('should return data for payments entity', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);
      prisma.payment.findMany.mockResolvedValue([]);
      prisma.payment.count.mockResolvedValue(0);

      const result = await service.getEntityData('admin-1', 'payments');

      expect(result).toBeDefined();
    });

    it('should return data for disputes entity', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);
      prisma.dispute.findMany.mockResolvedValue([]);
      prisma.dispute.count.mockResolvedValue(0);

      const result = await service.getEntityData('admin-1', 'disputes');

      expect(result).toBeDefined();
    });

    it('should handle query errors gracefully', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);
      prisma.user.findMany.mockRejectedValue(new Error('Query fail'));
      prisma.user.count.mockResolvedValue(0);

      const result = await service.getEntityData('admin-1', 'users');

      // Should return empty data on query error
      expect(result).toBeDefined();
    });

    it('should use filterBuilder for advanced filters', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);

      await service.getEntityData('admin-1', 'users', {
        filters: [{ field: 'status', value: 'ACTIVE' }],
      });

      expect(filterBuilder.parseFrontendFilters).toHaveBeenCalled();
    });
  });
});
