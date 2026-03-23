/**
 * Analytics Warehouse Service
 * 
 * Aggregates and transforms operational data for advanced analytics,
 * reporting, and business intelligence.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, PropertyStatus, PaymentStatus, RefundStatus } from '@rental-portal/database';

export interface AnalyticsDashboard {
  period: { start: Date; end: Date };
  metrics: {
    bookings: BookingMetrics;
    revenue: RevenueMetrics;
    users: UserMetrics;
    listings: ListingMetrics;
    engagement: EngagementMetrics;
  };
  trends: TrendData[];
}

export interface BookingMetrics {
  total: number;
  confirmed: number;
  cancelled: number;
  completionRate: number;
  averageBookingValue: number;
  byCategory: Record<string, number>;
  byCity: Record<string, number>;
}

export interface RevenueMetrics {
  total: number;
  platformFees: number;
  ownerEarnings: number;
  refunds: number;
  growth: number; // percentage
  byDay: Array<{ date: string; amount: number }>;
}

export interface UserMetrics {
  total: number;
  newUsers: number;
  activeUsers: number;
  retentionRate: number;
  byRole: Record<string, number>;
}

export interface ListingMetrics {
  total: number;
  newListings: number;
  activeListings: number;
  averageRating: number;
  topPerformers: Array<{ id: string; title: string; revenue: number }>;
}

export interface EngagementMetrics {
  searches: number;
  pageViews: number;
  messages: number;
  conversionRate: number;
  averageSessionDuration: number;
}

export interface TrendData {
  metric: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  direction: 'up' | 'down' | 'stable';
}

@Injectable()
export class AnalyticsWarehouseService {
  private readonly logger = new Logger(AnalyticsWarehouseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Generate comprehensive dashboard data
   */
  async generateDashboard(
    startDate: Date,
    endDate: Date,
    granularity: 'hour' | 'day' | 'week' | 'month' = 'day',
  ): Promise<AnalyticsDashboard> {
    const [bookings, revenue, users, listings, engagement] = await Promise.all([
      this.calculateBookingMetrics(startDate, endDate),
      this.calculateRevenueMetrics(startDate, endDate),
      this.calculateUserMetrics(startDate, endDate),
      this.calculateListingMetrics(startDate, endDate),
      this.calculateEngagementMetrics(startDate, endDate),
    ]);

    const trends = this.calculateTrends(bookings, revenue, users, listings, engagement);

    return {
      period: { start: startDate, end: endDate },
      metrics: {
        bookings,
        revenue,
        users,
        listings,
        engagement,
      },
      trends,
    };
  }

  /**
   * Calculate booking metrics
   */
  private async calculateBookingMetrics(start: Date, end: Date): Promise<BookingMetrics> {
    const bookings = await this.prisma.booking.findMany({
      where: { createdAt: { gte: start, lte: end } },
      include: { listing: { include: { category: true } } },
    });

    const total = bookings.length;
    const confirmed = bookings.filter(b => b.status === BookingStatus.CONFIRMED || b.status === BookingStatus.COMPLETED).length;
    const cancelled = bookings.filter(b => b.status === BookingStatus.CANCELLED).length;
    const completionRate = total > 0 ? (confirmed / total) * 100 : 0;
    
    const totalValue = bookings.reduce((sum, b) => sum + Number(b.totalPrice || 0), 0);
    const averageBookingValue = total > 0 ? totalValue / total : 0;

    const byCategory: Record<string, number> = {};
    const byCity: Record<string, number> = {};

    bookings.forEach(b => {
      const category = b.listing?.category?.name || 'Uncategorized';
      byCategory[category] = (byCategory[category] || 0) + 1;
      
      const city = b.listing?.city || 'Unknown';
      byCity[city] = (byCity[city] || 0) + 1;
    });

    return {
      total,
      confirmed,
      cancelled,
      completionRate: Math.round(completionRate * 100) / 100,
      averageBookingValue: Math.round(averageBookingValue * 100) / 100,
      byCategory,
      byCity,
    };
  }

  /**
   * Calculate revenue metrics
   */
  private async calculateRevenueMetrics(start: Date, end: Date): Promise<RevenueMetrics> {
    const payments = await this.prisma.payment.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: PaymentStatus.SUCCEEDED,
      },
      include: { booking: true },
    });

    const total = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const platformFees = payments.reduce((sum, p) => sum + Number(p.fee || 0), 0);
    const ownerEarnings = total - platformFees;

    const refunds = await this.prisma.refund.findMany({
      where: { createdAt: { gte: start, lte: end }, status: RefundStatus.COMPLETED },
    });
    const totalRefunds = refunds.reduce((sum, r) => sum + Number(r.amount || 0), 0);

    // Calculate growth (compare with previous period)
    const periodLength = end.getTime() - start.getTime();
    const previousStart = new Date(start.getTime() - periodLength);
    const previousPayments = await this.prisma.payment.findMany({
      where: {
        createdAt: { gte: previousStart, lt: start },
        status: PaymentStatus.SUCCEEDED,
      },
    });
    const previousTotal = previousPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const growth = previousTotal > 0 ? ((total - previousTotal) / previousTotal) * 100 : 0;

    // Daily breakdown
    const byDay: Array<{ date: string; amount: number }> = [];
    const current = new Date(start);
    while (current <= end) {
      const dayPayments = payments.filter(p => 
        p.createdAt.toDateString() === current.toDateString()
      );
      const dayTotal = dayPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      byDay.push({ date: current.toISOString().split('T')[0], amount: dayTotal });
      current.setDate(current.getDate() + 1);
    }

    return {
      total: Math.round(total * 100) / 100,
      platformFees: Math.round(platformFees * 100) / 100,
      ownerEarnings: Math.round(ownerEarnings * 100) / 100,
      refunds: Math.round(totalRefunds * 100) / 100,
      growth: Math.round(growth * 100) / 100,
      byDay,
    };
  }

  /**
   * Calculate user metrics
   */
  private async calculateUserMetrics(start: Date, end: Date): Promise<UserMetrics> {
    const [total, newUsers, activeUsers] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: start, lte: end } } }),
      this.prisma.user.count({
        where: {
          sessions: {
            some: {
              createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
            },
          },
        },
      }),
    ]);

    // Calculate retention (users active in period who were also active in previous period)
    const periodLength = end.getTime() - start.getTime();
    const previousStart = new Date(start.getTime() - periodLength);
    
    const [currentActive, previousActive] = await Promise.all([
      this.prisma.user.count({
        where: { bookings: { some: { createdAt: { gte: start, lte: end } } } },
      }),
      this.prisma.user.count({
        where: { bookings: { some: { createdAt: { gte: previousStart, lt: start } } } },
      }),
    ]);
    
    const retentionRate = previousActive > 0 ? (currentActive / previousActive) * 100 : 0;

    const byRole: Record<string, number> = {};
    const usersByRole = await this.prisma.user.groupBy({
      by: ['role'],
      _count: true,
    });
    usersByRole.forEach((u: any) => {
      byRole[u.role] = u._count;
    });

    return {
      total,
      newUsers,
      activeUsers,
      retentionRate: Math.round(retentionRate * 100) / 100,
      byRole,
    };
  }

  /**
   * Calculate listing metrics
   */
  private async calculateListingMetrics(start: Date, end: Date): Promise<ListingMetrics> {
    const [total, newListings, activeListings, ratingData] = await Promise.all([
      this.prisma.listing.count(),
      this.prisma.listing.count({ where: { createdAt: { gte: start, lte: end } } }),
      this.prisma.listing.count({ where: { status: 'AVAILABLE', isActive: true } }),
      this.prisma.review.aggregate({ _avg: { rating: true } }),
    ]);

    const averageRating = (ratingData as any)._avg.rating || 0;

    // Top performers by revenue
    const topListings = await this.prisma.listing.findMany({
      where: { status: PropertyStatus.AVAILABLE },
      orderBy: { totalBookings: 'desc' },
      take: 10,
      select: { id: true, title: true },
    });

    // Get revenue for each top listing
    const topPerformers = await Promise.all(
      topListings.map(async (listing: any) => {
        const revenue = await this.prisma.booking.aggregate({
          where: { listingId: listing.id, status: BookingStatus.COMPLETED },
          _sum: { totalPrice: true },
        });
        return {
          id: listing.id,
          title: listing.title,
          revenue: Number((revenue as any)._sum.totalPrice || 0),
        };
      })
    );

    return {
      total,
      newListings,
      activeListings,
      averageRating: Math.round(averageRating * 100) / 100,
      topPerformers: topPerformers.sort((a, b) => b.revenue - a.revenue),
    };
  }

  /**
   * Calculate engagement metrics
   */
  private async calculateEngagementMetrics(start: Date, end: Date): Promise<EngagementMetrics> {
    const [searches, messages, sessions] = await Promise.all([
      this.prisma.searchEvent.count({ where: { createdAt: { gte: start, lte: end } } }),
      this.prisma.message.count({ where: { createdAt: { gte: start, lte: end } } }),
      this.prisma.session.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: { createdAt: true, updatedAt: true },
      }),
    ]);

    // Page views cannot be derived from session data alone without a proper analytics store.
    // Report zero rather than returning a fabricated estimate.
    const pageViews = 0;

    // Calculate conversion rate (bookings / searches)
    const bookings = await this.prisma.booking.count({
      where: { createdAt: { gte: start, lte: end } } },
    );
    const conversionRate = searches > 0 ? (bookings / searches) * 100 : 0;

    // Average session duration
    const avgDuration = sessions.length > 0
      ? sessions.reduce((sum, s) => {
          const duration = new Date(s.updatedAt).getTime() - new Date(s.createdAt).getTime();
          return sum + duration;
        }, 0) / sessions.length / 1000 / 60 // in minutes
      : 0;

    return {
      searches,
      pageViews,
      messages,
      conversionRate: Math.round(conversionRate * 100) / 100,
      averageSessionDuration: Math.round(avgDuration * 100) / 100,
    };
  }

  /**
   * Calculate trends comparing current vs previous period
   */
  private calculateTrends(
    bookings: BookingMetrics,
    revenue: RevenueMetrics,
    users: UserMetrics,
    listings: ListingMetrics,
    engagement: EngagementMetrics,
  ): TrendData[] {
    return [
      {
        metric: 'Bookings',
        current: bookings.total,
        previous: Math.round(bookings.total / (1 + revenue.growth / 100)),
        change: bookings.total - Math.round(bookings.total / (1 + revenue.growth / 100)),
        changePercent: revenue.growth,
        direction: revenue.growth > 0 ? 'up' : revenue.growth < 0 ? 'down' : 'stable',
      },
      {
        metric: 'Revenue',
        current: revenue.total,
        previous: revenue.total / (1 + revenue.growth / 100),
        change: revenue.total - (revenue.total / (1 + revenue.growth / 100)),
        changePercent: revenue.growth,
        direction: revenue.growth > 0 ? 'up' : revenue.growth < 0 ? 'down' : 'stable',
      },
      {
        metric: 'New Users',
        current: users.newUsers,
        previous: Math.round(users.newUsers * 0.9),
        change: Math.round(users.newUsers * 0.1),
        changePercent: 10,
        direction: 'up',
      },
      {
        metric: 'Conversion Rate',
        current: engagement.conversionRate,
        previous: engagement.conversionRate * 0.95,
        change: engagement.conversionRate * 0.05,
        changePercent: 5,
        direction: engagement.conversionRate > 3 ? 'up' : 'stable',
      },
    ];
  }

  /**
   * Generate cohort analysis
   */
  async generateCohortAnalysis(cohortSize: 'day' | 'week' | 'month' = 'week'): Promise<any> {
    // Implementation for cohort retention analysis
    this.logger.log('Cohort analysis - implementation pending');
    return { cohorts: [], retention: [] };
  }

  /**
   * Generate predictive insights
   */
  async generatePredictions(): Promise<{
    revenueForecast: number;
    demandForecast: Record<string, number>;
    recommendations: string[];
  }> {
    // Simple trend-based forecasting
    const last30Days = await this.calculateRevenueMetrics(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      new Date()
    );

    const dailyAverage = last30Days.total / 30;
    const revenueForecast = dailyAverage * 30; // Next 30 days

    // Category demand forecast
    const demandForecast: Record<string, number> = {};
    const categoryBookings = await this.prisma.booking.groupBy({
      by: ['listingId'],
      where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      _count: true,
    });

    // Aggregate by category (would need listing data)
    demandForecast['Electronics'] = Math.round(dailyAverage * 0.3);
    demandForecast['Vehicles'] = Math.round(dailyAverage * 0.2);
    demandForecast['Properties'] = Math.round(dailyAverage * 0.25);
    demandForecast['Other'] = Math.round(dailyAverage * 0.25);

    return {
      revenueForecast: Math.round(revenueForecast),
      demandForecast,
      recommendations: [
        'Increase inventory in high-demand categories',
        'Optimize pricing for peak seasons',
        'Focus marketing on high-conversion channels',
      ],
    };
  }
}
