/**
 * Search Analytics Service
 * 
 * Provides search analytics functionality including query tracking,
 * metrics calculation, and dashboard generation.
 */

import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '@/common/cache/cache.service';
import {
  SearchAnalyticsMetrics,
  SearchAnalyticsDashboard,
  TopQuery,
  TrendingQuery,
  SearchTrend,
  PopularSearch,
  GeographicStats,
  DeviceStats,
  RealtimeSearchAnalytics,
  SearchInsight,
  SearchQuery,
  SearchFilters,
} from '../interfaces/search-analytics.interface';

@Injectable()
export class SearchAnalyticsService {
  private readonly logger = new Logger(SearchAnalyticsService.name);
  private searchLogs: SearchQuery[] = [];
  private readonly maxLogSize = 10000;

  constructor(private readonly cacheService: CacheService) {}

  async logSearch(query: Omit<SearchQuery, 'id' | 'createdAt'>): Promise<SearchQuery> {
    const searchQuery: SearchQuery = {
      ...query,
      id: this.generateId(),
      createdAt: new Date(),
    };

    this.searchLogs.push(searchQuery);

    // Keep only recent logs
    if (this.searchLogs.length > this.maxLogSize) {
      this.searchLogs = this.searchLogs.slice(-this.maxLogSize);
    }

    // Invalidate cache for real-time stats
    await this.cacheService.del('search:realtime:stats');

    return searchQuery;
  }

  async getAnalyticsDashboard(
    startDate: Date,
    endDate: Date,
    period: string = 'daily',
  ): Promise<SearchAnalyticsDashboard> {
    const cacheKey = `search:dashboard:${startDate.toISOString()}:${endDate.toISOString()}`;
    const cached = await this.cacheService.get<SearchAnalyticsDashboard>(cacheKey);

    if (cached) {
      return cached;
    }

    const dashboard: SearchAnalyticsDashboard = {
      period,
      startDate,
      endDate,
      metrics: await this.calculateMetrics(startDate, endDate),
      popularSearches: await this.getPopularSearches(startDate, endDate),
      searchTrends: await this.getSearchTrends(startDate, endDate),
      geographicDistribution: await this.getGeographicDistribution(startDate, endDate),
      deviceBreakdown: await this.getDeviceBreakdown(startDate, endDate),
    };

    // Cache for 5 minutes
    await this.cacheService.set(cacheKey, dashboard, 300);

    return dashboard;
  }

  async calculateMetrics(startDate: Date, endDate: Date): Promise<SearchAnalyticsMetrics> {
    const logs = this.getLogsInRange(startDate, endDate);

    const totalSearches = logs.length;
    const uniqueQueries = new Set(logs.map((l) => l.query)).size;
    const averageResultsCount = this.calculateAverage(logs.map((l) => l.resultsCount));
    const averageSearchDuration = this.calculateAverage(logs.map((l) => l.searchDuration));

    const withClicks = logs.filter((l) => l.clickedResults && l.clickedResults.length > 0).length;
    const clickThroughRate = totalSearches > 0 ? (withClicks / totalSearches) * 100 : 0;

    return {
      totalSearches,
      uniqueQueries,
      averageResultsCount,
      clickThroughRate,
      averageSearchDuration,
      topQueries: await this.getTopQueries(startDate, endDate),
      trendingQueries: await this.getTrendingQueries(startDate, endDate),
      searchPerformance: {
        averageResponseTime: averageSearchDuration,
        p95ResponseTime: this.calculatePercentile(logs.map((l) => l.searchDuration), 95),
        p99ResponseTime: this.calculatePercentile(logs.map((l) => l.searchDuration), 99),
        errorRate: 0, // Would calculate from error logs
        cacheHitRate: 0, // Would calculate from cache metrics
      },
      userBehavior: {
        searchesPerUser: await this.getSearchesPerUser(startDate, endDate),
        averageSessionSearches: 0, // Would need session aggregation
        conversionRate: 0, // Would need booking data
        bounceRate: 0, // Would need page view data
        refinementRate: 0, // Would need search refinement tracking
      },
      searchQuality: {
        relevanceScore: 0.85, // Placeholder
        diversityScore: 0.75, // Placeholder
        coverageScore: 0.9, // Placeholder
        userSatisfaction: 4.2, // Placeholder
      },
    };
  }

  async getTopQueries(startDate: Date, endDate: Date, limit: number = 10): Promise<TopQuery[]> {
    const logs = this.getLogsInRange(startDate, endDate);
    const queryCounts = new Map<string, { count: number; withClicks: number }>();

    logs.forEach((log) => {
      const existing = queryCounts.get(log.query) || { count: 0, withClicks: 0 };
      existing.count++;
      if (log.clickedResults && log.clickedResults.length > 0) {
        existing.withClicks++;
      }
      queryCounts.set(log.query, existing);
    });

    const sorted = Array.from(queryCounts.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, limit);

    return sorted.map(([query, stats]) => ({
      query,
      count: stats.count,
      clickThroughRate: stats.count > 0 ? (stats.withClicks / stats.count) * 100 : 0,
    }));
  }

  async getTrendingQueries(
    startDate: Date,
    endDate: Date,
    limit: number = 10,
  ): Promise<TrendingQuery[]> {
    const periodLength = endDate.getTime() - startDate.getTime();
    const previousStart = new Date(startDate.getTime() - periodLength);
    const previousEnd = new Date(startDate.getTime());

    const currentLogs = this.getLogsInRange(startDate, endDate);
    const previousLogs = this.getLogsInRange(previousStart, previousEnd);

    const currentCounts = this.countByQuery(currentLogs);
    const previousCounts = this.countByQuery(previousLogs);

    const trending: TrendingQuery[] = [];

    currentCounts.forEach((currentCount, query) => {
      const previousCount = previousCounts.get(query) || 0;
      const growthRate = previousCount === 0 ? 100 : ((currentCount - previousCount) / previousCount) * 100;

      if (growthRate > 0) {
        trending.push({
          query,
          currentCount,
          previousCount,
          growthRate,
        });
      }
    });

    return trending.sort((a, b) => b.growthRate - a.growthRate).slice(0, limit);
  }

  async getSearchTrends(startDate: Date, endDate: Date): Promise<SearchTrend[]> {
    const logs = this.getLogsInRange(startDate, endDate);
    const dailyStats = new Map<string, { total: number; unique: Set<string>; withClicks: number }>();

    logs.forEach((log) => {
      const date = log.createdAt.toISOString().split('T')[0];
      const existing = dailyStats.get(date) || { total: 0, unique: new Set(), withClicks: 0 };
      existing.total++;
      existing.unique.add(log.query);
      if (log.clickedResults && log.clickedResults.length > 0) {
        existing.withClicks++;
      }
      dailyStats.set(date, existing);
    });

    return Array.from(dailyStats.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, stats]) => ({
        date: new Date(date),
        totalSearches: stats.total,
        uniqueQueries: stats.unique.size,
        clickThroughRate: stats.total > 0 ? (stats.withClicks / stats.total) * 100 : 0,
      }));
  }

  async getPopularSearches(startDate: Date, endDate: Date, limit: number = 10): Promise<PopularSearch[]> {
    const topQueries = await this.getTopQueries(startDate, endDate, limit);

    return topQueries.map((q) => ({
      query: q.query,
      count: q.count,
      conversionRate: 0, // Would need booking data
      avgBookingValue: 0, // Would need booking data
    }));
  }

  async getGeographicDistribution(startDate: Date, endDate: Date): Promise<GeographicStats[]> {
    // Would use IP geolocation data
    return [];
  }

  async getDeviceBreakdown(startDate: Date, endDate: Date): Promise<DeviceStats[]> {
    // Would use user agent parsing
    return [];
  }

  async getRealtimeAnalytics(): Promise<RealtimeSearchAnalytics> {
    const cacheKey = 'search:realtime:stats';
    const cached = await this.cacheService.get<RealtimeSearchAnalytics>(cacheKey);

    if (cached) {
      return cached;
    }

    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const recentLogs = this.searchLogs.filter((l) => l.createdAt >= fiveMinutesAgo);
    const currentQueries = recentLogs.filter((l) => l.createdAt >= oneMinuteAgo).length;
    const activeUsers = new Set(recentLogs.map((l) => l.sessionId)).size;

    const topQueriesNow = await this.getCurrentTopQueries();

    const analytics: RealtimeSearchAnalytics = {
      currentQueries,
      queriesPerSecond: currentQueries / 60,
      activeUsers,
      topQueriesNow,
      performanceHealth: this.determineHealth(recentLogs),
    };

    // Cache for 10 seconds
    await this.cacheService.set(cacheKey, analytics, 10);

    return analytics;
  }

  async getSearchInsights(startDate: Date, endDate: Date): Promise<SearchInsight[]> {
    const insights: SearchInsight[] = [];
    const metrics = await this.calculateMetrics(startDate, endDate);

    // Check click-through rate
    if (metrics.clickThroughRate < 20) {
      insights.push({
        type: 'warning',
        title: 'Low Click-Through Rate',
        description: `Current CTR is ${metrics.clickThroughRate.toFixed(1)}%, below the 20% threshold`,
        metric: 'clickThroughRate',
        change: -((20 - metrics.clickThroughRate) / 20) * 100,
        recommendation: 'Review search result relevance and ranking algorithm',
        severity: 'high',
      });
    }

    // Check trending queries for opportunities
    const trending = await this.getTrendingQueries(startDate, endDate, 5);
    if (trending.length > 0) {
      const topTrend = trending[0];
      insights.push({
        type: 'opportunity',
        title: 'Emerging Search Trend',
        description: `"${topTrend.query}" searches increased by ${topTrend.growthRate.toFixed(1)}%`,
        metric: 'trendingQuery',
        change: topTrend.growthRate,
        recommendation: 'Consider featuring related listings or creating targeted promotions',
        severity: 'medium',
      });
    }

    // Check performance
    if (metrics.searchPerformance.averageResponseTime > 500) {
      insights.push({
        type: 'warning',
        title: 'Slow Search Performance',
        description: `Average search time is ${metrics.searchPerformance.averageResponseTime.toFixed(0)}ms`,
        metric: 'averageResponseTime',
        change: 0,
        recommendation: 'Optimize search indexing and caching strategy',
        severity: 'high',
      });
    }

    return insights;
  }

  async getCurrentTopQueries(limit: number = 5): Promise<string[]> {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const recentLogs = this.searchLogs.filter((l) => l.createdAt >= oneMinuteAgo);

    const counts = this.countByQuery(recentLogs);

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([query]) => query);
  }

  async getSearchesPerUser(startDate: Date, endDate: Date): Promise<number> {
    const logs = this.getLogsInRange(startDate, endDate).filter((l) => l.userId);
    const userCounts = new Map<string, number>();

    logs.forEach((log) => {
      const count = userCounts.get(log.userId!) || 0;
      userCounts.set(log.userId!, count + 1);
    });

    if (userCounts.size === 0) return 0;

    const total = Array.from(userCounts.values()).reduce((sum, count) => sum + count, 0);
    return total / userCounts.size;
  }

  private getLogsInRange(startDate: Date, endDate: Date): SearchQuery[] {
    return this.searchLogs.filter((log) => log.createdAt >= startDate && log.createdAt <= endDate);
  }

  private countByQuery(logs: SearchQuery[]): Map<string, number> {
    const counts = new Map<string, number>();
    logs.forEach((log) => {
      const count = counts.get(log.query) || 0;
      counts.set(log.query, count + 1);
    });
    return counts;
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private determineHealth(recentLogs: SearchQuery[]): 'healthy' | 'degraded' | 'critical' {
    const avgDuration = this.calculateAverage(recentLogs.map((l) => l.searchDuration));

    if (avgDuration > 2000) return 'critical';
    if (avgDuration > 1000) return 'degraded';
    return 'healthy';
  }

  private generateId(): string {
    return `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
