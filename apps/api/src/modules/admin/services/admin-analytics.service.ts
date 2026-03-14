import {
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { i18nForbidden } from '@/common/errors/i18n-exceptions';
import { PrismaService } from '@/common/prisma/prisma.service';
import {
  UserRole,
  PropertyStatus,
  BookingStatus,
  PayoutStatus,
  DisputeStatus,
  toNumber,
} from '@rental-portal/database';

/**
 * Extracted from admin.service.ts — handles dashboard stats,
 * analytics aggregations, and revenue reports.
 */
@Injectable()
export class AdminAnalyticsService {
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
      this.prisma.listing.count({ where: { status: PropertyStatus.AVAILABLE } }),
      this.prisma.booking.count(),
      this.prisma.booking.count({
        where: {
          status: {
            in: [BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS],
          },
        },
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: PayoutStatus.COMPLETED },
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
          firstName: true,
          lastName: true,
          role: true,
          createdAt: true,
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
          status: PayoutStatus.COMPLETED,
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
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          viewCount: true,
          averageRating: true,
          _count: {
            select: { reviews: true },
          },
        },
      }),
    ]);

    // Get category details
    const categoryIds = topCategories.map((c) => c.categoryId).filter((id): id is string => id !== null);
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
   * Get revenue report for a date range
   */
  async getRevenueReport(userId: string, startDate: Date, endDate: Date): Promise<any> {
    await this.verifyAdmin(userId);

    const payments = await this.prisma.payment.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        status: PayoutStatus.COMPLETED,
      },
      include: {
        booking: {
          select: {
            id: true,
            platformFee: true,
            listingId: true,
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

    const totalRevenue = payments.reduce((sum, p) => sum + toNumber(p.amount), 0);
    const platformFees = payments.reduce((sum, p) => sum + toNumber(p.booking.platformFee || 0), 0);

    // Group by category
    const revenueByCategory: Record<string, number> = {};
    for (const payment of payments) {
      const categoryId = payment.booking.listing.categoryId;
      revenueByCategory[categoryId] =
        (revenueByCategory[categoryId] || 0) + toNumber(payment.amount);
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
   * Get user analytics (real data)
   */
  async getUserAnalytics(adminId: string, period?: string): Promise<any> {
    await this.verifyAdmin(adminId);

    const periodDays = this.parsePeriodDays(period || '30d');
    const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    const [
      newUsers,
      totalActiveUsers,
      usersByRole,
      userGrowthRaw,
    ] = await Promise.all([
      this.prisma.user.count({ where: { createdAt: { gte: startDate } } }),
      this.prisma.user.count({ where: { lastLoginAt: { gte: startDate } } }),
      this.prisma.user.groupBy({
        by: ['role'],
        _count: { id: true },
      }),
      this.prisma.user.findMany({
        where: { createdAt: { gte: startDate } },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    // Build daily growth timeline
    const growthMap = new Map<string, number>();
    for (const u of userGrowthRaw) {
      const day = u.createdAt.toISOString().slice(0, 10);
      growthMap.set(day, (growthMap.get(day) || 0) + 1);
    }
    const userGrowth = Array.from(growthMap.entries()).map(([date, users]) => ({
      date,
      users,
    }));

    const roles = usersByRole.map((r) => ({
      role: r.role,
      count: r._count.id,
    }));

    return {
      analytics: {
        newUsers,
        activeUsers: totalActiveUsers,
        roles,
        userGrowth,
      },
      period: period || '30d',
    };
  }

  /**
   * Get business analytics (real data)
   */
  async getBusinessAnalytics(adminId: string, period?: string): Promise<any> {
    await this.verifyAdmin(adminId);

    const periodDays = this.parsePeriodDays(period || '30d');
    const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    const [
      totalRevenue,
      totalBookings,
      completedBookings,
      revenueByCategory,
      topListings,
    ] = await Promise.all([
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { createdAt: { gte: startDate }, status: PayoutStatus.COMPLETED },
      }),
      this.prisma.booking.count({ where: { createdAt: { gte: startDate } } }),
      this.prisma.booking.count({
        where: { createdAt: { gte: startDate }, status: BookingStatus.COMPLETED },
      }),
      this.prisma.payment.findMany({
        where: { createdAt: { gte: startDate }, status: PayoutStatus.COMPLETED },
        include: {
          booking: {
            select: {
              listing: { select: { categoryId: true, category: { select: { name: true } } } },
            },
          },
        },
      }),
      this.prisma.listing.findMany({
        take: 10,
        orderBy: { viewCount: 'desc' },
        select: {
          id: true,
          title: true,
          viewCount: true,
          averageRating: true,
          _count: { select: { bookings: true } },
        },
      }),
    ]);

    // Group revenue by category
    const catMap = new Map<string, { name: string; revenue: number; bookings: number }>();
    for (const p of revenueByCategory) {
      const catName = p.booking.listing.category?.name || 'Uncategorized';
      const existing = catMap.get(catName) || { name: catName, revenue: 0, bookings: 0 };
      existing.revenue += toNumber(p.amount);
      existing.bookings += 1;
      catMap.set(catName, existing);
    }
    const totalRev = toNumber(totalRevenue._sum.amount || 0);
    const revByCategory = Array.from(catMap.values()).map((c: any) => ({
      category: c.name,
      revenue: c.revenue,
      percentage: totalRev > 0 ? Math.round((c.revenue / totalRev) * 100) : 0,
      bookings: c.bookings,
    }));

    return {
      analytics: {
        totalRevenue: totalRev,
        avgBookingValue: totalBookings > 0 ? Math.round(totalRev / totalBookings) : 0,
        totalBookings,
        completedBookings,
        revenueByCategory: revByCategory,
        topPerformingListings: topListings.map((l) => ({
          title: l.title,
          bookings: l._count.bookings,
          viewCount: l.viewCount,
          averageRating: l.averageRating,
        })),
      },
      period: period || '30d',
    };
  }

  /**
   * Get performance analytics — returns real DB query metrics where possible,
   * with notes that APM-level data requires external tooling.
   */
  async getPerformanceAnalytics(adminId: string, period?: string): Promise<any> {
    await this.verifyAdmin(adminId);

    const periodDays = this.parsePeriodDays(period || '24h');
    const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    const [totalBookings, totalUsers, totalPayments] = await Promise.all([
      this.prisma.booking.count({ where: { createdAt: { gte: startDate } } }),
      this.prisma.user.count({ where: { createdAt: { gte: startDate } } }),
      this.prisma.payment.count({ where: { createdAt: { gte: startDate } } }),
    ]);

    return {
      performance: {
        totalBookings,
        totalNewUsers: totalUsers,
        totalPayments,
        note: 'For APM metrics (response times, throughput, error rates), integrate an external observability provider.',
      },
      period: period || '24h',
    };
  }

  /**
   * Get custom reports — lists available report types based on real data ranges.
   */
  async getCustomReports(adminId: string): Promise<any> {
    await this.verifyAdmin(adminId);

    const [oldestPayment, newestPayment] = await Promise.all([
      this.prisma.payment.findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
      this.prisma.payment.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    ]);

    return {
      reports: [
        {
          id: 'revenue-report',
          name: 'Revenue Report',
          description: 'Revenue breakdown for a custom date range',
          type: 'FINANCIAL',
          dataRange: {
            earliest: oldestPayment?.createdAt || null,
            latest: newestPayment?.createdAt || null,
          },
        },
        {
          id: 'user-report',
          name: 'User Analytics Report',
          description: 'User growth and activity metrics',
          type: 'ANALYTICS',
        },
      ],
    };
  }

  private parsePeriodDays(period: string): number {
    const match = period.match(/^(\d+)(h|d|w|m)$/);
    if (!match) return 30;
    const value = parseInt(match[1], 10);
    switch (match[2]) {
      case 'h': return value / 24;
      case 'd': return value;
      case 'w': return value * 7;
      case 'm': return value * 30;
      default: return 30;
    }
  }
}
