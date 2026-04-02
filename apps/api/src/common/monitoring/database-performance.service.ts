import { Injectable, Logger } from '@nestjs/common';

export interface DatabaseMetrics {
  queryCount: number;
  slowQueries: number;
  averageQueryTime: number;
  connectionPoolUsage: number;
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  errors: number;
  timestamp: Date;
}

export interface QueryPerformance {
  query: string;
  duration: number;
  timestamp: Date;
  parameters?: any[];
  affectedRows?: number;
  error?: Error;
  tags?: Record<string, any>;
}

export interface SlowQueryThreshold {
  warning: number; // ms
  critical: number; // ms
}

@Injectable()
export class DatabasePerformanceService {
  private readonly logger = new Logger(DatabasePerformanceService.name);
  private readonly metrics: DatabaseMetrics = {
    queryCount: 0,
    slowQueries: 0,
    averageQueryTime: 0,
    connectionPoolUsage: 0,
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    errors: 0,
    timestamp: new Date(),
  };

  private readonly queryHistory: QueryPerformance[] = [];
  private readonly slowQueryThresholds: SlowQueryThreshold = {
    warning: 1000, // 1 second
    critical: 5000, // 5 seconds
  };

  private readonly maxHistorySize = 10000;
  private readonly metricsInterval = 60000; // 1 minute

  constructor() {
    // Start periodic metrics collection
    setInterval(() => {
      this.collectMetrics();
    }, this.metricsInterval);
  }

  /**
   * Record a query execution
   */
  recordQuery(
    query: string,
    duration: number,
    parameters?: any[],
    affectedRows?: number,
    error?: Error,
    tags?: Record<string, any>,
  ): void {
    const queryPerf: QueryPerformance = {
      query: this.sanitizeQuery(query),
      duration,
      timestamp: new Date(),
      parameters,
      affectedRows,
      error,
      tags,
    };

    // Add to history
    this.queryHistory.push(queryPerf);

    // Maintain history size
    if (this.queryHistory.length > this.maxHistorySize) {
      this.queryHistory.shift();
    }

    // Update metrics
    this.updateMetrics(queryPerf);

    // Log slow queries
    this.logSlowQuery(queryPerf);
  }

  /**
   * Get current database metrics
   */
  getMetrics(): DatabaseMetrics {
    return { ...this.metrics };
  }

  /**
   * Get query performance statistics
   */
  getQueryStats(): {
    totalQueries: number;
    averageQueryTime: number;
    slowQueries: number;
    errorRate: number;
    topSlowQueries: QueryPerformance[];
    queriesPerSecond: number;
  } {
    const totalQueries = this.queryHistory.length;
    const slowQueries = this.queryHistory.filter(
      (q) => q.duration > this.slowQueryThresholds.warning,
    );
    const errors = this.queryHistory.filter((q) => q.error);

    const averageQueryTime =
      totalQueries > 0
        ? this.queryHistory.reduce((sum, q) => sum + q.duration, 0) / totalQueries
        : 0;

    const errorRate = totalQueries > 0 ? errors.length / totalQueries : 0;

    // Calculate queries per second (last minute)
    const oneMinuteAgo = new Date(Date.now() - 60000);
    const recentQueries = this.queryHistory.filter((q) => q.timestamp > oneMinuteAgo);
    const queriesPerSecond = recentQueries.length / 60;

    // Get top 10 slowest queries
    const topSlowQueries = this.queryHistory
      .filter((q) => q.duration > this.slowQueryThresholds.warning)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    return {
      totalQueries,
      averageQueryTime,
      slowQueries: slowQueries.length,
      errorRate,
      topSlowQueries,
      queriesPerSecond,
    };
  }

  /**
   * Get connection pool statistics
   */
  getConnectionPoolStats(): {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    poolUsage: number;
    waitingClients: number;
  } {
    // This would typically come from your database connection pool
    // For now, we'll return the tracked metrics
    return {
      totalConnections: this.metrics.totalConnections,
      activeConnections: this.metrics.activeConnections,
      idleConnections: this.metrics.idleConnections,
      poolUsage: this.metrics.connectionPoolUsage,
      waitingClients: 0, // Would need to be tracked by the pool
    };
  }

  /**
   * Get performance recommendations
   */
  getPerformanceRecommendations(): string[] {
    const recommendations: string[] = [];
    const stats = this.getQueryStats();

    // Check slow queries
    if (stats.slowQueries > 0) {
      recommendations.push(
        `Found ${stats.slowQueries} slow queries (>1s). Consider optimizing query performance.`,
      );
    }

    // Check for slow queries
    if (stats.slowQueries > 0) {
      recommendations.push(
        `Detected ${stats.slowQueries} slow queries. Consider optimizing queries that exceed ${this.slowQueryThresholds.warning}ms.`,
      );
    }

    // Check error rate
    if (stats.errorRate > 0.05) {
      // 5% error rate
      recommendations.push(
        `High error rate: ${(stats.errorRate * 100).toFixed(2)}%. Review query logic and database connectivity.`,
      );
    }

    // Check average query time
    if (stats.averageQueryTime > 500) {
      // 500ms average
      recommendations.push(
        `High average query time: ${stats.averageQueryTime.toFixed(2)}ms. Consider database optimization.`,
      );
    }

    // Check connection pool usage
    if (this.metrics.connectionPoolUsage > 0.8) {
      // 80% usage
      recommendations.push(
        `High connection pool usage: ${(this.metrics.connectionPoolUsage * 100).toFixed(2)}%. Consider increasing pool size.`,
      );
    }

    // Check query frequency
    if (stats.queriesPerSecond > 100) {
      recommendations.push(
        `High query rate: ${stats.queriesPerSecond.toFixed(2)} queries/sec. Consider implementing caching.`,
      );
    }

    return recommendations;
  }

  /**
   * Get database health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    score: number;
    issues: string[];
  } {
    const issues: string[] = [];
    let score = 100;

    const stats = this.getQueryStats();
    const poolStats = this.getConnectionPoolStats();

    // Check error rate
    if (stats.errorRate > 0.1) {
      // 10% error rate
      issues.push(`High error rate: ${(stats.errorRate * 100).toFixed(2)}%`);
      score -= 30;
    } else if (stats.errorRate > 0.05) {
      // 5% error rate
      issues.push(`Elevated error rate: ${(stats.errorRate * 100).toFixed(2)}%`);
      score -= 15;
    }

    // Check slow queries
    if (stats.slowQueries > stats.totalQueries * 0.1) {
      // 10% slow queries
      issues.push(`High slow query rate: ${stats.slowQueries}/${stats.totalQueries}`);
      score -= 20;
    }

    // Check connection pool
    if (poolStats.poolUsage > 0.9) {
      // 90% usage
      issues.push(`Critical connection pool usage: ${(poolStats.poolUsage * 100).toFixed(2)}%`);
      score -= 25;
    } else if (poolStats.poolUsage > 0.8) {
      // 80% usage
      issues.push(`High connection pool usage: ${(poolStats.poolUsage * 100).toFixed(2)}%`);
      score -= 10;
    }

    // Check average query time
    if (stats.averageQueryTime > 2000) {
      // 2 seconds
      issues.push(`Very high average query time: ${stats.averageQueryTime.toFixed(2)}ms`);
      score -= 20;
    } else if (stats.averageQueryTime > 1000) {
      // 1 second
      issues.push(`High average query time: ${stats.averageQueryTime.toFixed(2)}ms`);
      score -= 10;
    }

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (score < 70) {
      status = 'critical';
    } else if (score < 85) {
      status = 'warning';
    }

    return { status, score, issues };
  }

  /**
   * Export performance data for external monitoring
   */
  exportMetrics(): {
    timestamp: Date;
    metrics: DatabaseMetrics;
    queryStats: any;
    connectionPoolStats: any;
    healthStatus: any;
    recommendations: string[];
  } {
    return {
      timestamp: new Date(),
      metrics: this.getMetrics(),
      queryStats: this.getQueryStats(),
      connectionPoolStats: this.getConnectionPoolStats(),
      healthStatus: this.getHealthStatus(),
      recommendations: this.getPerformanceRecommendations(),
    };
  }

  /**
   * Clear performance history
   */
  clearHistory(): void {
    this.queryHistory.length = 0;
    this.logger.log('Database performance history cleared');
  }

  /**
   * Update slow query thresholds
   */
  setSlowQueryThresholds(warning: number, critical: number): void {
    this.slowQueryThresholds.warning = warning;
    this.slowQueryThresholds.critical = critical;
    this.logger.log(`Updated slow query thresholds: warning=${warning}ms, critical=${critical}ms`);
  }

  /**
   * Update metrics based on new query
   */
  private updateMetrics(queryPerf: QueryPerformance): void {
    this.metrics.queryCount++;
    this.metrics.timestamp = new Date();

    if (queryPerf.error) {
      this.metrics.errors++;
    }

    if (queryPerf.duration > this.slowQueryThresholds.warning) {
      this.metrics.slowQueries++;
    }

    // Update average query time
    const totalDuration = this.queryHistory.reduce((sum, q) => sum + q.duration, 0);
    this.metrics.averageQueryTime = totalDuration / this.queryHistory.length;
  }

  /**
   * Log slow queries with appropriate level
   */
  private logSlowQuery(queryPerf: QueryPerformance): void {
    if (queryPerf.duration > this.slowQueryThresholds.critical) {
      this.logger.error(`🚨 CRITICAL SLOW QUERY: ${queryPerf.duration}ms`, {
        query: queryPerf.query,
        duration: queryPerf.duration,
        parameters: queryPerf.parameters,
        affectedRows: queryPerf.affectedRows,
        timestamp: queryPerf.timestamp,
      });
    } else if (queryPerf.duration > this.slowQueryThresholds.warning) {
      this.logger.warn(`⚠️ SLOW QUERY: ${queryPerf.duration}ms`, {
        query: queryPerf.query,
        duration: queryPerf.duration,
        parameters: queryPerf.parameters,
        affectedRows: queryPerf.affectedRows,
        timestamp: queryPerf.timestamp,
      });
    }
  }

  /**
   * Collect periodic metrics
   */
  private collectMetrics(): void {
    // This would typically collect real database metrics
    // For now, we'll update connection pool simulation
    this.simulateConnectionPoolMetrics();
  }

  /**
   * Simulate connection pool metrics (replace with real implementation)
   */
  private simulateConnectionPoolMetrics(): void {
    // This should be replaced with actual connection pool metrics
    // from your database connection library
    this.metrics.totalConnections = 20;
    this.metrics.activeConnections = Math.floor(Math.random() * 15) + 5;
    this.metrics.idleConnections = this.metrics.totalConnections - this.metrics.activeConnections;
    this.metrics.connectionPoolUsage =
      this.metrics.activeConnections / this.metrics.totalConnections;
  }

  /**
   * Sanitize query for logging (remove sensitive data)
   */
  private sanitizeQuery(query: string): string {
    // Remove common sensitive patterns
    return query
      .replace(/password\s*=\s*['"][^'"]*['"]/gi, "password='***'")
      .replace(/token\s*=\s*['"][^'"]*['"]/gi, "token='***'")
      .replace(/secret\s*=\s*['"][^'"]*['"]/gi, "secret='***'")
      .replace(/api_key\s*=\s*['"][^'"]*['"]/gi, "api_key='***'")
      .substring(0, 500); // Limit length
  }
}
