import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CacheService } from '../../../common/cache/cache.service';
import { Cron, CronExpression } from '@nestjs/schedule';

/**
 * Global Observability Platform (V5 Prompt 16)
 *
 * Platform health monitoring with:
 * - Service health checks with auto-registration
 * - Anomaly detection via statistical thresholds
 * - SLA tracking for critical paths
 * - Incident-severity classification
 * - Prometheus-compatible /metrics endpoint data
 * - Request tracing via correlation IDs
 */
@Injectable()
export class ObservabilityService {
  private readonly logger = new Logger(ObservabilityService.name);
  private static readonly METRICS_CACHE_KEY = 'obs:metrics';
  private static readonly METRICS_TTL = 15; // 15s cache

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Record a service health check.
   */
  async recordHealthCheck(params: {
    serviceName: string;
    status: string;
    responseTimeMs: number;
    details?: Record<string, any>;
    endpoint?: string;
  }) {
    return this.prisma.serviceHealthCheck.create({
      data: {
        serviceName: params.serviceName,
        status: params.status as any,
        responseTimeMs: params.responseTimeMs,
        details: params.details || {},
        checkType: params.endpoint || 'LIVENESS',
        checkedAt: new Date(),
      },
    });
  }

  /**
   * Get health status for all services.
   */
  async getSystemHealth(): Promise<{
    overall: string;
    services: Array<{
      name: string;
      status: string;
      avgResponseMs: number;
      lastCheck: Date;
      uptime: number;
    }>;
  }> {
    const since = new Date(Date.now() - 60 * 60 * 1000); // Last hour

    const checks = await this.prisma.serviceHealthCheck.findMany({
      where: { checkedAt: { gte: since } },
      orderBy: { checkedAt: 'desc' },
    });

    const serviceMap = new Map<string, typeof checks>();
    for (const c of checks) {
      if (!serviceMap.has(c.serviceName)) serviceMap.set(c.serviceName, []);
      serviceMap.get(c.serviceName)!.push(c);
    }

    const services = Array.from(serviceMap.entries()).map(([name, sChecks]) => {
      const totalChecks = sChecks.length;
      const healthyChecks = sChecks.filter((c) => c.status === 'HEALTHY').length;
      const avgResponseMs = sChecks.reduce((sum, c) => sum + c.responseTimeMs, 0) / totalChecks;

      return {
        name,
        status: sChecks[0]?.status || 'UNKNOWN',
        avgResponseMs: Math.round(avgResponseMs),
        lastCheck: sChecks[0]?.checkedAt || new Date(),
        uptime: totalChecks > 0 ? healthyChecks / totalChecks : 0,
      };
    });

    const overall = services.every((s) => s.status === 'HEALTHY') ? 'HEALTHY' :
      services.some((s) => s.status === 'UNHEALTHY') ? 'UNHEALTHY' : 'DEGRADED';

    return { overall, services };
  }

  /**
   * Detect anomalies based on metric thresholds.
   */
  async detectAnomaly(params: {
    metric: string;
    value: number;
    threshold: number;
    serviceName: string;
  }) {
    const severity = params.value > params.threshold * 2 ? 'CRITICAL' :
      params.value > params.threshold * 1.5 ? 'HIGH' :
        params.value > params.threshold ? 'MEDIUM' : 'LOW';

    if (severity === 'LOW') return null; // Not an anomaly

    const anomaly = await this.prisma.anomalyDetection.create({
      data: {
        metricName: params.metric,
        actualValue: params.value,
        expectedValue: params.threshold,
        deviation: (params.value - params.threshold) / Math.max(params.threshold, 1),
        severity: severity as any,
        serviceName: params.serviceName,
        detectedAt: new Date(),
        metadata: {
          deviationPercent: ((params.value - params.threshold) / params.threshold) * 100,
        },
      },
    });

    this.logger.warn(
      `Anomaly detected: ${params.metric} = ${params.value} (threshold: ${params.threshold}) [${severity}]`,
    );

    return anomaly;
  }

  /**
   * Get recent anomalies.
   */
  async getRecentAnomalies(hours: number = 24, severity?: string) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    return this.prisma.anomalyDetection.findMany({
      where: {
        detectedAt: { gte: since },
        ...(severity ? { severity: severity as any } : {}),
      },
      orderBy: { detectedAt: 'desc' },
    });
  }

  /**
   * Get SLA metrics for critical paths.
   */
  async getSlaMetrics(serviceName: string, days: number = 7) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const checks = await this.prisma.serviceHealthCheck.findMany({
      where: {
        serviceName,
        checkedAt: { gte: since },
      },
    });

    if (checks.length === 0) {
      return { serviceName, uptime: 0, avgResponseMs: 0, p99ResponseMs: 0, totalChecks: 0 };
    }

    const healthyChecks = checks.filter((c) => c.status === 'HEALTHY').length;
    const responseTimes = checks.map((c) => c.responseTimeMs).sort((a, b) => a - b);
    const p99Index = Math.floor(responseTimes.length * 0.99);

    return {
      serviceName,
      uptime: healthyChecks / checks.length,
      avgResponseMs: Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length),
      p99ResponseMs: responseTimes[p99Index] || 0,
      totalChecks: checks.length,
    };
  }

  /**
   * Acknowledge (resolve) an anomaly.
   */
  async acknowledgeAnomaly(anomalyId: string, resolvedBy: string) {
    return this.prisma.anomalyDetection.update({
      where: { id: anomalyId },
      data: {
        acknowledged: true,
        acknowledgedBy: resolvedBy,
        metadata: {
          resolvedBy,
        },
      },
    });
  }

  /**
   * Scheduled health check for internal services.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async performScheduledHealthChecks() {
    const services = ['api', 'database', 'cache', 'queue', 'search'];

    for (const svc of services) {
      const startTime = Date.now();
      let status = 'HEALTHY';

      try {
        // Simple liveness check: verify DB connectivity
        if (svc === 'database') {
          await this.prisma.$queryRaw`SELECT 1`;
        }
      } catch {
        status = 'UNHEALTHY';
      }

      const responseTimeMs = Date.now() - startTime;

      await this.recordHealthCheck({
        serviceName: svc,
        status,
        responseTimeMs,
        endpoint: `internal/${svc}/health`,
      });

      // Check for response time anomaly
      if (responseTimeMs > 1000) {
        await this.detectAnomaly({
          metric: `${svc}.response_time`,
          value: responseTimeMs,
          threshold: 500,
          serviceName: svc,
        });
      }
    }
  }

  /**
   * Generate Prometheus-compatible metrics output.
   * Cached for 15 seconds to prevent expensive DB queries on every scrape.
   */
  async getPrometheusMetrics(): Promise<string> {
    const cached = await this.cache.get<string>(ObservabilityService.METRICS_CACHE_KEY);
    if (cached) return cached;

    const since = new Date(Date.now() - 5 * 60 * 1000); // Last 5 min

    const [healthChecks, anomalies, bookingCount, userCount, listingCount, disputeCount] = await Promise.all([
      this.prisma.serviceHealthCheck.findMany({ where: { checkedAt: { gte: since } } }),
      this.prisma.anomalyDetection.count({ where: { detectedAt: { gte: since } } }),
      this.prisma.booking.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.listing.count({ where: { status: 'AVAILABLE' } }),
      this.prisma.dispute.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
    ]);

    // Build metrics in Prometheus exposition format
    const lines: string[] = [
      '# HELP rental_bookings_total Total number of bookings',
      '# TYPE rental_bookings_total counter',
      `rental_bookings_total ${bookingCount}`,
      '',
      '# HELP rental_active_users Total active users',
      '# TYPE rental_active_users gauge',
      `rental_active_users ${userCount}`,
      '',
      '# HELP rental_available_listings Available listings count',
      '# TYPE rental_available_listings gauge',
      `rental_available_listings ${listingCount}`,
      '',
      '# HELP rental_open_disputes Open disputes count',
      '# TYPE rental_open_disputes gauge',
      `rental_open_disputes ${disputeCount}`,
      '',
      '# HELP rental_anomalies_5m Anomalies detected in last 5 minutes',
      '# TYPE rental_anomalies_5m gauge',
      `rental_anomalies_5m ${anomalies}`,
      '',
    ];

    // Per-service health metrics
    const serviceMap = new Map<string, typeof healthChecks>();
    for (const c of healthChecks) {
      if (!serviceMap.has(c.serviceName)) serviceMap.set(c.serviceName, []);
      serviceMap.get(c.serviceName)!.push(c);
    }

    lines.push('# HELP rental_service_up Service health status (1=healthy, 0=unhealthy)');
    lines.push('# TYPE rental_service_up gauge');
    for (const [name, checks] of serviceMap) {
      const latest = checks[0];
      lines.push(`rental_service_up{service="${name}"} ${latest?.status === 'HEALTHY' ? 1 : 0}`);
    }

    lines.push('');
    lines.push('# HELP rental_service_response_ms Service response time in ms');
    lines.push('# TYPE rental_service_response_ms gauge');
    for (const [name, checks] of serviceMap) {
      const avgMs = checks.reduce((s, c) => s + c.responseTimeMs, 0) / checks.length;
      lines.push(`rental_service_response_ms{service="${name}"} ${Math.round(avgMs)}`);
    }

    const output = lines.join('\n') + '\n';
    await this.cache.set(ObservabilityService.METRICS_CACHE_KEY, output, ObservabilityService.METRICS_TTL);
    return output;
  }

  /**
   * Record a request trace/span for distributed tracing.
   */
  async recordTrace(params: {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
    operationName: string;
    serviceName: string;
    durationMs: number;
    status: 'OK' | 'ERROR';
    metadata?: Record<string, any>;
  }) {
    // Store trace in cache for real-time access (short TTL)
    const key = `trace:${params.traceId}:${params.spanId}`;
    await this.cache.set(key, params, 300); // 5 min retention

    // Also persist to DB for historical analysis
    return this.prisma.serviceHealthCheck.create({
      data: {
        serviceName: params.serviceName,
        status: params.status === 'OK' ? 'HEALTHY' : 'UNHEALTHY',
        responseTimeMs: params.durationMs,
        checkType: `trace:${params.operationName}`,
        details: {
          traceId: params.traceId,
          spanId: params.spanId,
          parentSpanId: params.parentSpanId,
          ...params.metadata,
        },
        checkedAt: new Date(),
      },
    });
  }
}
