import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { BookingStatus } from '@rental-portal/database';

type PeriodKey = '7days' | '30days' | '90days' | 'year';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPerformanceMetrics(userId: string, period?: string) {
    const normalizedPeriod = this.normalizePeriod(period);
    const { start, end, previousStart } = this.getPeriodRange(normalizedPeriod);

    const [user, listings] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.listing.findMany({
        where: { ownerId: userId },
        select: {
          id: true,
          title: true,
          basePrice: true,
          views: true,
          viewCount: true,
          averageRating: true,
          totalBookings: true,
        },
      }),
    ]);

    const listingIds = listings.map((l) => l.id);

    const [bookingsAll, bookingsPeriod, bookingsPrev, revenueAll, revenuePeriod, revenuePrev] =
      await Promise.all([
        this.prisma.booking.count({ where: { ownerId: userId } }),
        this.prisma.booking.count({
          where: { ownerId: userId, createdAt: { gte: start, lt: end } },
        }),
        this.prisma.booking.count({
          where: { ownerId: userId, createdAt: { gte: previousStart, lt: start } },
        }),
        this.sumOwnerRevenue(userId),
        this.sumOwnerRevenue(userId, start, end),
        this.sumOwnerRevenue(userId, previousStart, start),
      ]);

    const totalViews = listings.reduce(
      (sum, listing) => sum + (listing.viewCount || listing.views || 0),
      0,
    );

    const conversionRate = totalViews > 0 ? (bookingsAll / totalViews) * 100 : 0;

    const monthlyData = await this.getMonthlyData(userId, 6);

    const topListings = await this.getTopListings(listingIds);

    const responseRate = user?.responseRate ?? 0;
    const responseTime = this.parseResponseTime(user?.responseTime);

    const acceptanceRate = await this.getAcceptanceRate(userId);

    return {
      overview: {
        totalViews,
        viewsChange: 0,
        totalBookings: bookingsAll,
        bookingsChange: this.percentChange(bookingsPeriod, bookingsPrev),
        conversionRate,
        conversionChange: 0,
        averageRating: user?.averageRating ?? 0,
        ratingChange: 0,
      },
      earnings: {
        total: revenueAll,
        thisMonth: revenuePeriod,
        lastMonth: revenuePrev,
        change: this.percentChange(revenuePeriod, revenuePrev),
      },
      topListings,
      monthlyData,
      responseMetrics: {
        averageResponseTime: responseTime,
        responseRate,
        acceptanceRate,
      },
    };
  }

  async getInsights(userId: string) {
    const [user, listings, bookings] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.listing.findMany({
        where: { ownerId: userId },
        select: {
          id: true,
          title: true,
          basePrice: true,
          photos: true,
          averageRating: true,
        },
      }),
      this.prisma.booking.findMany({
        where: { ownerId: userId },
        select: { id: true, listingId: true, startDate: true, endDate: true, createdAt: true, totalAmount: true, totalPrice: true },
      }),
    ]);

    const insights = [];
    if (listings.length === 0) {
      insights.push({
        id: 'no-listings',
        type: 'opportunity',
        title: 'Create your first listing',
        description: 'Listings are required before you can accept bookings.',
        impact: 'High impact',
        action: 'Create listing',
        actionUrl: '/listings/new',
      });
    }

    const avgPhotos =
      listings.length > 0
        ? listings.reduce((sum, l) => sum + (l.photos?.length || 0), 0) / listings.length
        : 0;
    if (avgPhotos > 0 && avgPhotos < 4) {
      insights.push({
        id: 'more-photos',
        type: 'opportunity',
        title: 'Add more photos',
        description: 'Listings with 4+ photos typically convert better.',
        impact: 'Medium impact',
        action: 'Update listings',
        actionUrl: '/listings',
      });
    }

    const rating = user?.averageRating ?? 0;
    if (rating > 0 && rating < 4) {
      insights.push({
        id: 'improve-rating',
        type: 'warning',
        title: 'Improve your ratings',
        description: 'Higher ratings drive more bookings and better search placement.',
        impact: 'Medium impact',
        action: 'View reviews',
        actionUrl: '/reviews',
      });
    }

    const bookingsLast30 = bookings.filter(
      (b) => b.createdAt >= this.daysAgo(30),
    ).length;
    if (listings.length > 0 && bookingsLast30 === 0) {
      insights.push({
        id: 'boost-visibility',
        type: 'opportunity',
        title: 'Boost listing visibility',
        description: 'Try adjusting pricing or availability to attract bookings.',
        impact: 'High impact',
        action: 'Manage listings',
        actionUrl: '/listings',
      });
    }

    const monthly = await this.getMonthlyData(userId, 6);
    const seasonalTrends = monthly.map((month) => {
      const demand = this.classifyDemand(month.bookings, monthly.map((m) => m.bookings));
      return {
        period: month.month,
        demand,
        recommendation:
          demand === 'high'
            ? 'Keep availability open to capture demand.'
            : demand === 'low'
              ? 'Consider promotions or discounts.'
              : 'Maintain steady pricing and availability.',
      };
    });

    const competitorAnalysis = await this.getCompetitorAnalysis(listings);

    const customerSegments = this.buildCustomerSegments(bookings);

    const optimizations = [
      {
        area: 'Listing Photos',
        current: Math.round(avgPhotos),
        target: 5,
        tips: ['Add well-lit photos', 'Include close-ups of key features'],
      },
      {
        area: 'Response Rate',
        current: Math.round(user?.responseRate ?? 0),
        target: 90,
        tips: ['Enable notifications', 'Reply within an hour during peak times'],
      },
    ];

    const score = this.calculateScore({
      listings: listings.length,
      bookings: bookings.length,
      rating: user?.averageRating ?? 0,
    });

    return {
      score,
      insights,
      seasonalTrends,
      competitorAnalysis,
      customerSegments,
      optimizations,
    };
  }

  private async getTopListings(listingIds: string[]) {
    if (listingIds.length === 0) {
      return [];
    }

    const [listingStats, listings] = await Promise.all([
      this.prisma.booking.groupBy({
        by: ['listingId'],
        where: { listingId: { in: listingIds } },
        _count: { _all: true },
        _sum: { totalAmount: true, totalPrice: true },
      }),
      this.prisma.listing.findMany({
        where: { id: { in: listingIds } },
        select: { id: true, title: true, views: true, viewCount: true, averageRating: true },
      }),
    ]);

    const statsMap = new Map(
      listingStats.map((stat) => [
        stat.listingId,
        {
          bookings: stat._count._all,
          revenue: Number(stat._sum.totalAmount ?? stat._sum.totalPrice ?? 0),
        },
      ]),
    );

    return listings
      .map((listing) => {
        const stat = statsMap.get(listing.id);
        return {
          id: listing.id,
          title: listing.title,
          views: listing.viewCount || listing.views || 0,
          bookings: stat?.bookings || 0,
          revenue: stat?.revenue || 0,
          rating: listing.averageRating || 0,
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }

  private async sumOwnerRevenue(userId: string, start?: Date, end?: Date): Promise<number> {
    const where: any = { ownerId: userId, status: { in: this.revenueStatuses() } };
    if (start && end) {
      where.createdAt = { gte: start, lt: end };
    }

    const sum = await this.prisma.booking.aggregate({
      where,
      _sum: { totalAmount: true, totalPrice: true },
    });

    return Number(sum._sum.totalAmount ?? sum._sum.totalPrice ?? 0);
  }

  private revenueStatuses() {
    return [
      BookingStatus.CONFIRMED,
      BookingStatus.IN_PROGRESS,
      BookingStatus.COMPLETED,
      BookingStatus.SETTLED,
    ];
  }

  private async getMonthlyData(userId: string, months: number) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
    const bookings = await this.prisma.booking.findMany({
      where: {
        ownerId: userId,
        createdAt: { gte: start },
      },
      select: { createdAt: true, totalAmount: true, totalPrice: true },
    });

    const buckets = Array.from({ length: months }).map((_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (months - 1 - index), 1);
      const label = date.toLocaleString('default', { month: 'short' });
      return {
        month: label,
        year: date.getFullYear(),
        bookings: 0,
        revenue: 0,
      };
    });

    bookings.forEach((booking) => {
      const monthIndex =
        (booking.createdAt.getFullYear() - buckets[0].year) * 12 +
        (booking.createdAt.getMonth() - (now.getMonth() - (months - 1)));
      if (monthIndex >= 0 && monthIndex < buckets.length) {
        buckets[monthIndex].bookings += 1;
        buckets[monthIndex].revenue += Number(booking.totalAmount ?? booking.totalPrice ?? 0);
      }
    });

    return buckets.map((bucket) => ({
      month: bucket.month,
      views: 0,
      bookings: bucket.bookings,
      revenue: bucket.revenue,
    }));
  }

  private async getAcceptanceRate(userId: string) {
    const total = await this.prisma.booking.count({ where: { ownerId: userId } });
    if (total === 0) return 0;
    const accepted = await this.prisma.booking.count({
      where: {
        ownerId: userId,
        status: { in: [BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS, BookingStatus.COMPLETED, BookingStatus.SETTLED] },
      },
    });
    return Math.round((accepted / total) * 100);
  }

  private async getCompetitorAnalysis(listings: Array<{ basePrice: any }>) {
    const yourAverage =
      listings.length > 0
        ? listings.reduce((sum, listing) => sum + Number(listing.basePrice || 0), 0) /
          listings.length
        : 0;

    const allListings = await this.prisma.listing.findMany({
      where: { deletedAt: null },
      select: { basePrice: true },
      take: 1000,
    });
    const platformAverage =
      allListings.length > 0
        ? allListings.reduce((sum, l) => sum + Number(l.basePrice || 0), 0) / allListings.length
        : yourAverage;

    const pricePosition =
      yourAverage < platformAverage * 0.95
        ? 'below'
        : yourAverage > platformAverage * 1.05
          ? 'above'
          : 'at';

    return {
      averagePrice: Math.round(platformAverage),
      yourPrice: Math.round(yourAverage),
      pricePosition,
      recommendation:
        pricePosition === 'above'
          ? 'Consider small discounts to stay competitive.'
          : pricePosition === 'below'
            ? 'Your pricing is competitive; highlight value in descriptions.'
            : 'Your pricing is aligned with market averages.',
    };
  }

  private buildCustomerSegments(
    bookings: Array<{ startDate: Date; endDate: Date }>,
  ) {
    if (bookings.length === 0) {
      return [];
    }

    const segmentCounts = { short: 0, medium: 0, long: 0 };
    bookings.forEach((booking) => {
      const nights = Math.max(
        1,
        Math.ceil((booking.endDate.getTime() - booking.startDate.getTime()) / 86400000),
      );
      if (nights <= 3) segmentCounts.short += 1;
      else if (nights <= 7) segmentCounts.medium += 1;
      else segmentCounts.long += 1;
    });

    const total = bookings.length;
    return [
      {
        segment: 'Short stays',
        percentage: Math.round((segmentCounts.short / total) * 100),
        trend: 'stable',
        description: '1-3 day rentals',
      },
      {
        segment: 'Medium stays',
        percentage: Math.round((segmentCounts.medium / total) * 100),
        trend: 'stable',
        description: '4-7 day rentals',
      },
      {
        segment: 'Extended stays',
        percentage: Math.round((segmentCounts.long / total) * 100),
        trend: 'stable',
        description: '8+ day rentals',
      },
    ];
  }

  private calculateScore(input: { listings: number; bookings: number; rating: number }) {
    const listingScore = Math.min(input.listings * 10, 30);
    const bookingScore = Math.min(input.bookings * 2, 40);
    const ratingScore = Math.min(input.rating * 10, 30);
    return Math.round(listingScore + bookingScore + ratingScore);
  }

  private normalizePeriod(period?: string): PeriodKey {
    const value = (period || '30days') as PeriodKey;
    if (value === '7days' || value === '30days' || value === '90days' || value === 'year') {
      return value;
    }
    return '30days';
  }

  private getPeriodRange(period: PeriodKey) {
    const days = period === '7days' ? 7 : period === '90days' ? 90 : period === 'year' ? 365 : 30;
    const end = new Date();
    const start = this.daysAgo(days);
    const previousStart = this.daysAgo(days * 2);
    return { start, end, previousStart };
  }

  private percentChange(current: number, previous: number) {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return ((current - previous) / previous) * 100;
  }

  private daysAgo(days: number) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
  }

  private parseResponseTime(value?: string | null) {
    if (!value) return 0;
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private classifyDemand(value: number, values: number[]) {
    if (values.length === 0) return 'low';
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    if (value >= avg * 1.25) return 'high';
    if (value <= avg * 0.75) return 'low';
    return 'medium';
  }
}
