/**
 * Search Repository
 * 
 * Handles data storage operations for search analytics (in-memory implementation)
 */

import { Injectable } from '@nestjs/common';
import {
  SearchQuery,
  SearchFilters,
  TopQuery,
  TrendingQuery,
  SearchTrend,
  GeographicStats,
  DeviceStats,
  PopularSearch,
} from '../interfaces/search-analytics.interface';

@Injectable()
export class SearchRepository {
  private searchLogs: SearchQuery[] = [];
  private readonly maxLogSize = 50000;

  async save(query: SearchQuery): Promise<SearchQuery> {
    this.searchLogs.push(query);

    // Keep only recent logs to prevent memory issues
    if (this.searchLogs.length > this.maxLogSize) {
      this.searchLogs = this.searchLogs.slice(-this.maxLogSize);
    }

    return query;
  }

  async getLogsInRange(startDate: Date, endDate: Date): Promise<SearchQuery[]> {
    return this.searchLogs.filter((log) => log.createdAt >= startDate && log.createdAt <= endDate);
  }

  async getTotalSearches(startDate: Date, endDate: Date): Promise<number> {
    const logs = await this.getLogsInRange(startDate, endDate);
    return logs.length;
  }

  async getUniqueQueries(startDate: Date, endDate: Date): Promise<number> {
    const logs = await this.getLogsInRange(startDate, endDate);
    return new Set(logs.map((l) => l.query)).size;
  }

  async getAverageResultsCount(startDate: Date, endDate: Date): Promise<number> {
    const logs = await this.getLogsInRange(startDate, endDate);
    if (logs.length === 0) return 0;
    return logs.reduce((sum, l) => sum + l.resultsCount, 0) / logs.length;
  }

  async getAverageSearchDuration(startDate: Date, endDate: Date): Promise<number> {
    const logs = await this.getLogsInRange(startDate, endDate);
    if (logs.length === 0) return 0;
    return logs.reduce((sum, l) => sum + l.searchDuration, 0) / logs.length;
  }

  async getClickThroughRate(startDate: Date, endDate: Date): Promise<number> {
    const logs = await this.getLogsInRange(startDate, endDate);
    if (logs.length === 0) return 0;

    const withClicks = logs.filter((l) => l.clickedResults && l.clickedResults.length > 0).length;
    return (withClicks / logs.length) * 100;
  }

  async getTopQueries(startDate: Date, endDate: Date, limit: number = 10): Promise<TopQuery[]> {
    const logs = await this.getLogsInRange(startDate, endDate);
    const queryStats = new Map<string, { count: number; withClicks: number }>();

    logs.forEach((log) => {
      const stats = queryStats.get(log.query) || { count: 0, withClicks: 0 };
      stats.count++;
      if (log.clickedResults && log.clickedResults.length > 0) {
        stats.withClicks++;
      }
      queryStats.set(log.query, stats);
    });

    return Array.from(queryStats.entries())
      .map(([query, stats]) => ({
        query,
        count: stats.count,
        clickThroughRate: stats.count > 0 ? (stats.withClicks / stats.count) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  async getTrendingQueries(
    currentStart: Date,
    currentEnd: Date,
    previousStart: Date,
    previousEnd: Date,
    limit: number = 10,
  ): Promise<TrendingQuery[]> {
    const currentLogs = await this.getLogsInRange(currentStart, currentEnd);
    const previousLogs = await this.getLogsInRange(previousStart, previousEnd);

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
    const logs = await this.getLogsInRange(startDate, endDate);
    const dailyStats = new Map<string, { total: number; unique: Set<string>; withClicks: number }>();

    logs.forEach((log) => {
      const date = log.createdAt.toISOString().split('T')[0];
      const stats = dailyStats.get(date) || { total: 0, unique: new Set(), withClicks: 0 };
      stats.total++;
      stats.unique.add(log.query);
      if (log.clickedResults && log.clickedResults.length > 0) {
        stats.withClicks++;
      }
      dailyStats.set(date, stats);
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
      conversionRate: 0,
      avgBookingValue: 0,
    }));
  }

  async getGeographicDistribution(startDate: Date, endDate: Date): Promise<GeographicStats[]> {
    return [];
  }

  async getDeviceBreakdown(startDate: Date, endDate: Date): Promise<DeviceStats[]> {
    return [];
  }

  async getRealtimeStats(): Promise<{ currentQueries: number; activeUsers: number }> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentLogs = this.searchLogs.filter((l) => l.createdAt >= fiveMinutesAgo);

    return {
      currentQueries: recentLogs.length,
      activeUsers: new Set(recentLogs.map((l) => l.sessionId)).size,
    };
  }

  async getSearchesPerUser(startDate: Date, endDate: Date): Promise<number> {
    const logs = (await this.getLogsInRange(startDate, endDate)).filter((l) => l.userId);
    const userCounts = new Map<string, number>();

    logs.forEach((log) => {
      const count = userCounts.get(log.userId!) || 0;
      userCounts.set(log.userId!, count + 1);
    });

    if (userCounts.size === 0) return 0;

    const total = Array.from(userCounts.values()).reduce((sum, count) => sum + count, 0);
    return total / userCounts.size;
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

  private countByQuery(logs: SearchQuery[]): Map<string, number> {
    const counts = new Map<string, number>();
    logs.forEach((log) => {
      const count = counts.get(log.query) || 0;
      counts.set(log.query, count + 1);
    });
    return counts;
  }
}
