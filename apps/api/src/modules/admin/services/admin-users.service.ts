import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { i18nNotFound, i18nForbidden, i18nBadRequest } from '@/common/errors/i18n-exceptions';
import { PrismaService } from '@/common/prisma/prisma.service';
import {
  UserRole,
  PropertyStatus,
  UserStatus,
} from '@rental-portal/database';

/**
 * Extracted from admin.service.ts — handles user CRUD,
 * role updates, and account suspension.
 */
@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  private async verifyAdmin(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw i18nForbidden('auth.userNotFound');
    }

    const adminRoles: string[] = [
      UserRole.ADMIN,
      UserRole.SUPER_ADMIN,
      UserRole.OPERATIONS_ADMIN,
      UserRole.FINANCE_ADMIN,
      UserRole.SUPPORT_ADMIN,
    ];

    if (!adminRoles.includes(user.role)) {
      throw i18nForbidden('admin.accessRequired');
    }
  }

  /**
   * Get all users with filters
   */
  async getAllUsers(
    userId: string,
    options: {
      role?: UserRole;
      search?: string;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<{ users: any[]; total: number }> {
    await this.verifyAdmin(userId);

    const { role, search, page = 1, limit = 20 } = options;

    const where: any = {};
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          _count: {
            select: {
              reviewsGiven: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, total };
  }

  /**
   * Get user by ID
   */
  async getUserById(adminId: string, userId: string): Promise<any> {
    await this.verifyAdmin(adminId);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        _count: {
          select: {
            listings: true,
            bookings: true,
            reviewsGiven: true,
          },
        },
      },
    });

    if (!user) {
      throw i18nNotFound('auth.userNotFound');
    }

    return user;
  }

  /**
   * Update user role
   */
  async updateUserRole(adminId: string, targetUserId: string, role: UserRole): Promise<any> {
    await this.verifyAdmin(adminId);

    const oldUser = await this.prisma.user.findUnique({ where: { id: targetUserId }, select: { role: true } });
    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { role },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'ADMIN_USER_ROLE_UPDATED',
        entityType: 'User',
        entityId: targetUserId,
        oldValues: JSON.stringify({ role: oldUser?.role }),
        newValues: JSON.stringify({ role }),
      },
    });

    return updated;
  }

  /**
   * Suspend/activate user
   */
  async toggleUserStatus(adminId: string, targetUserId: string, suspend: boolean): Promise<any> {
    await this.verifyAdmin(adminId);

    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: { userPreferences: true },
    });

    if (!user) {
      throw i18nNotFound('auth.userNotFound');
    }

    if (suspend && ([UserRole.ADMIN, UserRole.SUPER_ADMIN] as string[]).includes(user.role)) {
      throw i18nBadRequest('admin.cannotSuspendAdmin');
    }

    if (suspend) {
      // Suspend user - pause all their active listings
      await this.prisma.listing.updateMany({
        where: {
          ownerId: targetUserId,
          status: PropertyStatus.AVAILABLE,
        },
        data: {
          status: PropertyStatus.SUSPENDED,
        },
      });
    }

    return this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        status: suspend ? UserStatus.SUSPENDED : UserStatus.ACTIVE,
      },
    }).then(async (updated) => {
      await this.prisma.auditLog.create({
        data: {
          userId: adminId,
          action: suspend ? 'ADMIN_USER_SUSPENDED' : 'ADMIN_USER_ACTIVATED',
          entityType: 'User',
          entityId: targetUserId,
          oldValues: JSON.stringify({ status: user.status }),
          newValues: JSON.stringify({ status: updated.status }),
        },
      });
      return updated;
    });
  }
}
