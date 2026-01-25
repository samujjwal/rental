import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  UserRole,
  ListingStatus,
  BookingStatus,
  DisputeStatus,
  PaymentStatus,
} from '@rental-portal/database';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  /**
   * Verify user is admin
   */
  private async verifyAdmin(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin access required');
    }
  }

  /**
   * Get platform dashboard statistics
   */
  async getDashboardStats(userId: string): Promise<any> {
    await this.verifyAdmin(userId);

    const [
      totalUsers,
      totalListings,
      activeListings,
      totalBookings,
      activeBookings,
      totalRevenue,
      pendingDisputes,
      recentUsers,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.listing.count(),
      this.prisma.listing.count({ where: { status: ListingStatus.ACTIVE } }),
      this.prisma.booking.count(),
      this.prisma.booking.count({
        where: {
          status: {
            in: [BookingStatus.CONFIRMED, BookingStatus.ACTIVE],
          },
        },
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: PaymentStatus.SUCCEEDED },
      }),
      this.prisma.dispute.count({
        where: {
          status: {
            in: [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW],
          },
        },
      }),
      this.prisma.user.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
          profile: true,
        },
      }),
    ]);

    return {
      users: {
        total: totalUsers,
        recent: recentUsers,
      },
      listings: {
        total: totalListings,
        active: activeListings,
      },
      bookings: {
        total: totalBookings,
        active: activeBookings,
      },
      revenue: {
        total: totalRevenue._sum.amount || 0,
      },
      disputes: {
        pending: pendingDisputes,
      },
    };
  }

  /**
   * Get analytics data
   */
  async getAnalytics(
    userId: string,
    period: 'day' | 'week' | 'month' | 'year' = 'month',
  ): Promise<any> {
    await this.verifyAdmin(userId);

    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        break;
      case 'year':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
    }

    const [
      newUsers,
      newListings,
      newBookings,
      completedBookings,
      revenue,
      topCategories,
      topListings,
    ] = await Promise.all([
      this.prisma.user.count({
        where: { createdAt: { gte: startDate } },
      }),
      this.prisma.listing.count({
        where: { createdAt: { gte: startDate } },
      }),
      this.prisma.booking.count({
        where: { createdAt: { gte: startDate } },
      }),
      this.prisma.booking.count({
        where: {
          completedAt: { gte: startDate },
          status: BookingStatus.COMPLETED,
        },
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          createdAt: { gte: startDate },
          status: PaymentStatus.SUCCEEDED,
        },
      }),
      this.prisma.listing.groupBy({
        by: ['categoryId'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
      this.prisma.listing.findMany({
        take: 10,
        orderBy: { views: 'desc' },
        select: {
          id: true,
          title: true,
          views: true,
          averageRating: true,
          _count: {
            select: { bookings: true },
          },
        },
      }),
    ]);

    // Get category details
    const categoryIds = topCategories.map((c) => c.categoryId);
    const categories = await this.prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true },
    });

    const topCategoriesWithNames = topCategories.map((tc) => ({
      category: categories.find((c) => c.id === tc.categoryId),
      count: tc._count.id,
    }));

    return {
      period,
      startDate,
      endDate: now,
      growth: {
        newUsers,
        newListings,
        newBookings,
        completedBookings,
      },
      revenue: {
        total: revenue._sum.amount || 0,
      },
      topCategories: topCategoriesWithNames,
      topListings,
    };
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
        { profile: { firstName: { contains: search, mode: 'insensitive' } } },
        { profile: { lastName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          profile: true,
          _count: {
            select: {
              listings: true,
              bookingsAsRenter: true,
              reviews: true,
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
   * Update user role
   */
  async updateUserRole(adminId: string, targetUserId: string, role: UserRole): Promise<any> {
    await this.verifyAdmin(adminId);

    return this.prisma.user.update({
      where: { id: targetUserId },
      data: { role },
    });
  }

  /**
   * Suspend/activate user
   */
  async toggleUserStatus(adminId: string, targetUserId: string, suspend: boolean): Promise<any> {
    await this.verifyAdmin(adminId);

    // Implement suspension logic (you may need to add a suspended field to User model)
    // For now, we'll use a note in the profile
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: { profile: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (suspend) {
      // Suspend user - pause all their active listings
      await this.prisma.listing.updateMany({
        where: {
          ownerId: targetUserId,
          status: ListingStatus.ACTIVE,
        },
        data: {
          status: ListingStatus.PAUSED,
        },
      });
    }

    return this.prisma.userProfile.update({
      where: { userId: targetUserId },
      data: {
        notes: suspend ? 'Account suspended by admin' : '',
      },
    });
  }

  /**
   * Get all listings with filters
   */
  async getAllListings(
    userId: string,
    options: {
      status?: ListingStatus;
      categoryId?: string;
      search?: string;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<{ listings: any[]; total: number }> {
    await this.verifyAdmin(userId);

    const { status, categoryId, search, page = 1, limit = 20 } = options;

    const where: any = {};
    if (status) where.status = status;
    if (categoryId) where.categoryId = categoryId;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [listings, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        include: {
          owner: {
            select: {
              id: true,
              email: true,
              profile: true,
            },
          },
          category: true,
          _count: {
            select: {
              bookings: true,
              reviews: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.listing.count({ where }),
    ]);

    return { listings, total };
  }

  /**
   * Update listing status (approve/reject)
   */
  async updateListingStatus(
    adminId: string,
    listingId: string,
    status: ListingStatus,
    reason?: string,
  ): Promise<any> {
    await this.verifyAdmin(adminId);

    return this.prisma.listing.update({
      where: { id: listingId },
      data: {
        status,
        // Store reason in notes if provided
        notes: reason ? { adminNote: reason } : undefined,
      },
    });
  }

  /**
   * Delete listing (soft delete)
   */
  async deleteListing(adminId: string, listingId: string): Promise<void> {
    await this.verifyAdmin(adminId);

    await this.prisma.listing.update({
      where: { id: listingId },
      data: {
        status: ListingStatus.ARCHIVED,
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Get platform revenue report
   */
  async getRevenueReport(userId: string, startDate: Date, endDate: Date): Promise<any> {
    await this.verifyAdmin(userId);

    const payments = await this.prisma.payment.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        status: PaymentStatus.SUCCEEDED,
      },
      include: {
        booking: {
          include: {
            listing: {
              select: {
                id: true,
                title: true,
                categoryId: true,
              },
            },
          },
        },
      },
    });

    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
    const platformFees = payments.reduce((sum, p) => sum + (p.platformFee || 0), 0);

    // Group by category
    const revenueByCategory: Record<string, number> = {};
    for (const payment of payments) {
      const categoryId = payment.booking.listing.categoryId;
      revenueByCategory[categoryId] = (revenueByCategory[categoryId] || 0) + payment.amount;
    }

    return {
      period: {
        startDate,
        endDate,
      },
      totalRevenue,
      platformFees,
      totalPayments: payments.length,
      revenueByCategory,
    };
  }

  /**
   * Get audit logs (implement based on your logging system)
   */
  async getAuditLogs(
    userId: string,
    options: {
      action?: string;
      targetUserId?: string;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<any> {
    await this.verifyAdmin(userId);

    const { action, targetUserId, page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (action) where.action = action;
    if (targetUserId) where.userId = targetUserId;

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
