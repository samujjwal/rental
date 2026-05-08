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

  // --- Real-time metrics for critical flows ---

  /**
   * Record booking creation metric
   */
  async recordBookingCreated(bookingId: string, listingId: string, amount: number): Promise<void> {
    const cacheKey = `metrics:booking:created`;
    await this.cache.increment(cacheKey);
    await this.cache.expire(cacheKey, 3600);
    
    this.logger.debug(`Booking created metric: ${bookingId}`, {
      bookingId,
      listingId,
      amount,
    });
  }

  /**
   * Record booking failure metric
   */
  async recordBookingFailed(bookingId: string, reason: string): Promise<void> {
    const cacheKey = `metrics:booking:failed`;
    await this.cache.increment(cacheKey);
    await this.cache.expire(cacheKey, 3600);
    
    this.logger.debug(`Booking failed metric: ${bookingId}`, {
      bookingId,
      reason,
    });
  }

  /**
   * Record double-booking prevention metric
   */
  async recordDoubleBookingPrevented(bookingId: string, listingId: string): Promise<void> {
    const cacheKey = `metrics:booking:double_booking_prevented`;
    await this.cache.increment(cacheKey);
    await this.cache.expire(cacheKey, 3600);
    
    this.logger.warn(`Double-booking prevented: ${bookingId}`, {
      bookingId,
      listingId,
    });
  }

  /**
   * Record webhook processing metric
   */
  async recordWebhookProcessed(eventType: string, paymentIntentId: string): Promise<void> {
    const cacheKey = `metrics:webhook:processed:${eventType}`;
    await this.cache.increment(cacheKey);
    await this.cache.expire(cacheKey, 3600);
    
    this.logger.debug(`Webhook processed: ${eventType}`, {
      eventType,
      paymentIntentId: this.redactPaymentId(paymentIntentId),
    });
  }

  /**
   * Record webhook retry metric
   */
  async recordWebhookRetried(eventType: string, attempt: number): Promise<void> {
    const cacheKey = `metrics:webhook:retried:${eventType}`;
    await this.cache.increment(cacheKey);
    await this.cache.expire(cacheKey, 3600);
    
    this.logger.warn(`Webhook retried: ${eventType}`, {
      eventType,
      attempt,
    });
  }

  /**
   * Record webhook DLQ (dead letter queue) metric
   */
  async recordWebhookDLQ(eventType: string, error: string): Promise<void> {
    const cacheKey = `metrics:webhook:dlq:${eventType}`;
    await this.cache.increment(cacheKey);
    await this.cache.expire(cacheKey, 3600);
    
    this.logger.error(`Webhook DLQ: ${eventType}`, {
      eventType,
      error,
    });
  }

  /**
   * Record notification delivered metric
   */
  async recordNotificationDelivered(notificationId: string, type: string, userId: string): Promise<void> {
    const cacheKey = `metrics:notification:delivered:${type}`;
    await this.cache.increment(cacheKey);
    await this.cache.expire(cacheKey, 3600);
    
    this.logger.debug(`Notification delivered: ${type}`, {
      notificationId,
      type,
      userId: this.redactUserId(userId),
    });
  }

  /**
   * Record notification failed metric
   */
  async recordNotificationFailed(notificationId: string, type: string, error: string): Promise<void> {
    const cacheKey = `metrics:notification:failed:${type}`;
    await this.cache.increment(cacheKey);
    await this.cache.expire(cacheKey, 3600);
    
    this.logger.warn(`Notification failed: ${type}`, {
      notificationId,
      type,
      error,
    });
  }

  /**
   * Record payout created metric
   */
  async recordPayoutCreated(payoutId: string, ownerId: string, amount: number): Promise<void> {
    const cacheKey = `metrics:payout:created`;
    await this.cache.increment(cacheKey);
    await this.cache.expire(cacheKey, 3600);
    
    this.logger.debug(`Payout created: ${payoutId}`, {
      payoutId,
      ownerId: this.redactUserId(ownerId),
      amount,
    });
  }

  /**
   * Record payout failed metric
   */
  async recordPayoutFailed(payoutId: string, error: string): Promise<void> {
    const cacheKey = `metrics:payout:failed`;
    await this.cache.increment(cacheKey);
    await this.cache.expire(cacheKey, 3600);
    
    this.logger.error(`Payout failed: ${payoutId}`, {
      payoutId,
      error,
    });
  }

  /**
   * Record refund processed metric
   */
  async recordRefundProcessed(refundId: string, paymentId: string, amount: number): Promise<void> {
    const cacheKey = `metrics:refund:processed`;
    await this.cache.increment(cacheKey);
    await this.cache.expire(cacheKey, 3600);
    
    this.logger.debug(`Refund processed: ${refundId}`, {
      refundId,
      paymentId: this.redactPaymentId(paymentId),
      amount,
    });
  }

  /**
   * Record booking state transition metric
   */
  async recordStateTransition(
    bookingId: string,
    fromStatus: string,
    toStatus: string,
    transition: string,
  ): Promise<void> {
    const cacheKey = `metrics:booking:transition:${toStatus}`;
    await this.cache.increment(cacheKey);
    await this.cache.expire(cacheKey, 3600);
    
    this.logger.debug(`Booking state transition: ${bookingId}`, {
      bookingId,
      fromStatus,
      toStatus,
      transition,
    });
  }

  /**
   * Record availability reservation metric
   */
  async recordAvailabilityReserved(listingId: string, startDate: Date, endDate: Date): Promise<void> {
    const cacheKey = `metrics:availability:reserved`;
    await this.cache.increment(cacheKey);
    await this.cache.expire(cacheKey, 3600);
    
    this.logger.debug(`Availability reserved: ${listingId}`, {
      listingId,
      startDate,
      endDate,
    });
  }

  /**
   * Record availability release metric
   */
  async recordAvailabilityReleased(listingId: string, startDate: Date, endDate: Date): Promise<void> {
    const cacheKey = `metrics:availability:released`;
    await this.cache.increment(cacheKey);
    await this.cache.expire(cacheKey, 3600);
    
    this.logger.debug(`Availability released: ${listingId}`, {
      listingId,
      startDate,
      endDate,
    });
  }

  // --- Helper methods for PII redaction in logs ---

  private redactPaymentId(id: string): string {
    if (!id) return '[NONE]';
    if (id.startsWith('pi_')) {
      return `pi_${id.substring(3, 10)}...`;
    }
    return `${id.substring(0, 8)}...`;
  }

  private redactUserId(id: string): string {
    if (!id) return '[NONE]';
    return `${id.substring(0, 8)}...`;
  }
}
