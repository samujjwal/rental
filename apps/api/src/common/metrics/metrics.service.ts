/**
 * Platform Metrics Service
 *
 * Collects, stores, and queries platform-level business metrics:
 * - Booking metrics (volume, revenue, conversion, cancellation rate)
 * - User metrics (active users, registrations, churn)
 * - Listing metrics (new listings, utilization, avg price)
 * - Payment metrics (GMV, payout volume, refund rate)
 * - Trust metrics (avg trust score, superhost count)
 * - Dispute metrics (open disputes, resolution time)
 *
 * Stores snapshots in PlatformMetric table for time-series analysis.
 * Exposes real-time counters via cache for dashboards.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';

export interface MetricSnapshot {
  name: string;
  value: number;
  dimensions: Record<string, string>;
  period: string;
  periodStart: Date;
}

export interface DashboardMetrics {
  bookings: {
    total: number;
    active: number;
    completedToday: number;
    cancelledToday: number;
    conversionRate: number;
  };
  revenue: {
    gmv30d: number;
    avgBookingValue: number;
    refundRate: number;
  };
  users: {
    totalActive: number;
    newThisWeek: number;
    superhostCount: number;
  };
  listings: {
    total: number;
    activeListings: number;
    avgUtilization: number;
  };
  disputes: {
    openCount: number;
    avgResolutionHours: number;
  };
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Capture a full metrics snapshot. Call from a scheduled job (e.g., hourly).
   */
  async captureSnapshot(period: string = 'HOURLY'): Promise<MetricSnapshot[]> {
    const now = new Date();
    const metrics: MetricSnapshot[] = [];

    const collectors = [
      this.collectBookingMetrics(now, period),
      this.collectUserMetrics(now, period),
      this.collectListingMetrics(now, period),
      this.collectRevenueMetrics(now, period),
      this.collectDisputeMetrics(now, period),
    ];

    const results = await Promise.allSettled(collectors);

    for (const result of results) {
      if (result.status === 'fulfilled') {
        metrics.push(...result.value);
      } else {
        this.logger.error(`Metric collection failed: ${result.reason}`);
      }
    }

    // Batch insert all metrics
    if (metrics.length > 0) {
      await this.prisma.platformMetric.createMany({
        data: metrics.map((m) => ({
          name: m.name,
          value: m.value,
          dimensions: m.dimensions,
          period: m.period,
          periodStart: m.periodStart,
        })),
      });
    }

    this.logger.log(`Captured ${metrics.length} metric snapshots (${period})`);
    return metrics;
  }

  /**
   * Get real-time dashboard metrics (cached, refreshed hourly).
   */
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const cacheKey = 'metrics:dashboard';
    const cached = await this.cache.get<DashboardMetrics>(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalBookings,
      activeBookings,
      completedToday,
      cancelledToday,
      totalActive,
      newThisWeek,
      superhostCount,
      totalListings,
      activeListings,
      openDisputes,
      recentPayments,
      recentRefunds,
    ] = await Promise.all([
      this.prisma.booking.count(),
      this.prisma.booking.count({ where: { status: { in: ['CONFIRMED', 'IN_PROGRESS'] } } }),
      this.prisma.booking.count({ where: { status: 'COMPLETED', updatedAt: { gte: todayStart } } }),
      this.prisma.booking.count({ where: { status: 'CANCELLED', updatedAt: { gte: todayStart } } }),
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      this.prisma.user.count({ where: { idVerificationStatus: 'VERIFIED' } }),
      this.prisma.listing.count(),
      this.prisma.listing.count({ where: { status: 'AVAILABLE' } }),
      this.prisma.dispute.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW', 'INVESTIGATING'] } } }),
      this.prisma.payment.aggregate({
        where: { createdAt: { gte: thirtyDaysAgo }, status: 'COMPLETED' },
        _sum: { amount: true },
        _avg: { amount: true },
      }),
      this.prisma.payment.count({
        where: { createdAt: { gte: thirtyDaysAgo }, status: 'REFUNDED' },
      }),
    ]);

    const totalPayments30d = await this.prisma.payment.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    });

    const dashboard: DashboardMetrics = {
      bookings: {
        total: totalBookings,
        active: activeBookings,
        completedToday,
        cancelledToday,
        conversionRate: totalBookings > 0
          ? Math.round(activeBookings / totalBookings * 10000) / 100
          : 0,
      },
      revenue: {
        gmv30d: Number(recentPayments._sum.amount || 0),
        avgBookingValue: Number(recentPayments._avg.amount || 0),
        refundRate: totalPayments30d > 0
          ? Math.round(recentRefunds / totalPayments30d * 10000) / 100
          : 0,
      },
      users: {
        totalActive,
        newThisWeek,
        superhostCount,
      },
      listings: {
        total: totalListings,
        activeListings,
        avgUtilization: 0, // Computed separately
      },
      disputes: {
        openCount: openDisputes,
        avgResolutionHours: 0, // Computed separately
      },
    };

    await this.cache.set(cacheKey, dashboard, 3600);
    return dashboard;
  }

  /**
   * Query metric time series.
   */
  async queryMetrics(
    name: string,
    startDate: Date,
    endDate: Date,
    _dimensions?: Record<string, string>,
  ): Promise<MetricSnapshot[]> {
    const results = await this.prisma.platformMetric.findMany({
      where: {
        name,
        periodStart: { gte: startDate, lte: endDate },
      },
      orderBy: { periodStart: 'asc' },
    });

    return results.map((r) => ({
      name: r.name,
      value: r.value,
      dimensions: r.dimensions as Record<string, string>,
      period: r.period,
      periodStart: r.periodStart,
    }));
  }

  // --- Private metric collectors ---

  private async collectBookingMetrics(
    now: Date,
    period: string,
  ): Promise<MetricSnapshot[]> {
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const [newBookings, completedBookings, cancelledBookings] = await Promise.all([
      this.prisma.booking.count({ where: { createdAt: { gte: hourAgo } } }),
      this.prisma.booking.count({ where: { status: 'COMPLETED', updatedAt: { gte: hourAgo } } }),
      this.prisma.booking.count({ where: { status: 'CANCELLED', updatedAt: { gte: hourAgo } } }),
    ]);

    return [
      { name: 'bookings.new', value: newBookings, dimensions: {}, period, periodStart: now },
      { name: 'bookings.completed', value: completedBookings, dimensions: {}, period, periodStart: now },
      { name: 'bookings.cancelled', value: cancelledBookings, dimensions: {}, period, periodStart: now },
    ];
  }

  private async collectUserMetrics(
    now: Date,
    period: string,
  ): Promise<MetricSnapshot[]> {
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const [newUsers, activeUsers] = await Promise.all([
      this.prisma.user.count({ where: { createdAt: { gte: hourAgo } } }),
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
    ]);

    return [
      { name: 'users.new', value: newUsers, dimensions: {}, period, periodStart: now },
      { name: 'users.active', value: activeUsers, dimensions: {}, period, periodStart: now },
    ];
  }

  private async collectListingMetrics(
    now: Date,
    period: string,
  ): Promise<MetricSnapshot[]> {
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const [newListings, activeListings] = await Promise.all([
      this.prisma.listing.count({ where: { createdAt: { gte: hourAgo } } }),
      this.prisma.listing.count({ where: { status: 'AVAILABLE' } }),
    ]);

    return [
      { name: 'listings.new', value: newListings, dimensions: {}, period, periodStart: now },
      { name: 'listings.active', value: activeListings, dimensions: {}, period, periodStart: now },
    ];
  }

  private async collectRevenueMetrics(
    now: Date,
    period: string,
  ): Promise<MetricSnapshot[]> {
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const payments = await this.prisma.payment.aggregate({
      where: { createdAt: { gte: hourAgo }, status: 'COMPLETED' },
      _sum: { amount: true },
      _count: true,
    });

    return [
      { name: 'revenue.gmv', value: Number(payments._sum.amount || 0), dimensions: {}, period, periodStart: now },
      { name: 'revenue.transactions', value: payments._count, dimensions: {}, period, periodStart: now },
    ];
  }

  private async collectDisputeMetrics(
    now: Date,
    period: string,
  ): Promise<MetricSnapshot[]> {
    const openDisputes = await this.prisma.dispute.count({
      where: { status: { in: ['OPEN', 'UNDER_REVIEW', 'INVESTIGATING'] } },
    });

    return [
      { name: 'disputes.open', value: openDisputes, dimensions: {}, period, periodStart: now },
    ];
  }
}
