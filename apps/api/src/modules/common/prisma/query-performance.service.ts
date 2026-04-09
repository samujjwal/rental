import { Injectable, Logger } from '@nestjs/common';

/**
 * Query Performance Monitoring Service
 *
 * This service monitors and tracks Prisma query performance:
 * - Tracks slow queries
 * - Detects N+1 query patterns
 * - Provides query optimization suggestions
 */
@Injectable()
export class QueryPerformanceService {
  private readonly logger = new Logger(QueryPerformanceService.name);

  // Configuration thresholds
  private readonly SLOW_QUERY_THRESHOLD_MS = 1000;
  private readonly N1_QUERY_THRESHOLD = 5;
  private readonly QUERY_HISTORY_SIZE = 100;

  // Query tracking
  private queryHistory: Array<{
    query: string;
    duration: number;
    timestamp: Date;
    params?: any;
  }> = [];

  // Query pattern tracking for N+1 detection
  private queryPatterns: Map<string, number> = new Map();

  /**
   * Track a query execution
   */
  trackQuery(query: string, duration: number, params?: any) {
    const timestamp = new Date();
    
    // Add to history
    this.queryHistory.push({ query, duration, timestamp, params });
    
    // Trim history if too large
    if (this.queryHistory.length > this.QUERY_HISTORY_SIZE) {
      this.queryHistory.shift();
    }

    // Check for slow query
    if (duration > this.SLOW_QUERY_THRESHOLD_MS) {
      this.logger.warn(
        `Slow query detected (${duration}ms): ${query.substring(0, 200)}...`
      );
      this.suggestOptimizations(query, duration);
    }

    // Track query patterns for N+1 detection
    this.trackQueryPattern(query);
  }

  /**
   * Track query patterns to detect N+1 queries
   */
  private trackQueryPattern(query: string) {
    // Normalize query for pattern matching
    const normalized = this.normalizeQuery(query);
    const count = this.queryPatterns.get(normalized) || 0;
    this.queryPatterns.set(normalized, count + 1);

    // Check for potential N+1 pattern
    if (count >= this.N1_QUERY_THRESHOLD) {
      this.logger.warn(
        `Potential N+1 query pattern detected: ${normalized} (executed ${count + 1} times)`
      );
    }
  }

  /**
   * Normalize query for pattern matching
   */
  private normalizeQuery(query: string): string {
    // Remove parameter values and normalize whitespace
    return query
      .replace(/\?\d+/g, '?')
      .replace(/\$\d+/g, '$')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Suggest optimizations for slow queries
   */
  private suggestOptimizations(query: string, duration: number) {
    const suggestions: string[] = [];

    // Check for missing indexes
    if (query.includes('WHERE') && !query.includes('INDEX')) {
      suggestions.push('Consider adding an index on filtered columns');
    }

    // Check for large result sets
    if (query.includes('SELECT *') || query.includes('SELECT ') && !query.includes('LIMIT')) {
      suggestions.push('Consider using LIMIT to restrict result set size');
    }

    // Check for missing joins
    if (query.includes('WHERE') && query.includes('OR')) {
      suggestions.push('Consider using UNION instead of OR for better performance');
    }

    // Check for nested queries
    if ((query.match(/\(/g) || []).length > 3) {
      suggestions.push('Consider simplifying nested queries or using temporary tables');
    }

    // Log suggestions if any
    if (suggestions.length > 0) {
      this.logger.log(`Optimization suggestions for ${duration}ms query:`);
      suggestions.forEach(s => this.logger.log(`  - ${s}`));
    }
  }

  /**
   * Get query performance statistics
   */
  getPerformanceStats() {
    if (this.queryHistory.length === 0) {
      return null;
    }

    const durations = this.queryHistory.map(q => q.duration);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const maxDuration = Math.max(...durations);
    const minDuration = Math.min(...durations);
    const slowQueries = this.queryHistory.filter(q => q.duration > this.SLOW_QUERY_THRESHOLD_MS);

    return {
      totalQueries: this.queryHistory.length,
      avgDuration: Math.round(avgDuration * 100) / 100,
      maxDuration,
      minDuration,
      slowQueryCount: slowQueries.length,
      slowQueryThreshold: this.SLOW_QUERY_THRESHOLD_MS,
      uniqueQueryPatterns: this.queryPatterns.size,
    };
  }

  /**
   * Get slow query history
   */
  getSlowQueries(limit: number = 10) {
    return this.queryHistory
      .filter(q => q.duration > this.SLOW_QUERY_THRESHOLD_MS)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  /**
   * Get N+1 query patterns
   */
  getN1QueryPatterns(limit: number = 10) {
    return Array.from(this.queryPatterns.entries())
      .filter(([_, count]) => count >= this.N1_QUERY_THRESHOLD)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([query, count]) => ({ query, count }));
  }

  /**
   * Clear query history
   */
  clearHistory() {
    this.queryHistory = [];
    this.queryPatterns.clear();
    this.logger.log('Query performance history cleared');
  }
}
