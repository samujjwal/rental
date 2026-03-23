import {
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { i18nForbidden } from '@/common/errors/i18n-exceptions';
import { PrismaService } from '@/common/prisma/prisma.service';
import { UserRole } from '@rental-portal/database';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { SchedulerRegistry } from '@nestjs/schedule';
import * as os from 'node:os';

/**
 * Extracted from admin.service.ts — handles system configuration,
 * health checks, logs, backups, and infrastructure settings.
 */
@Injectable()
export class AdminSystemService {
  private readonly logger = new Logger(AdminSystemService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @InjectQueue('bookings') private readonly bookingsQueue: Queue,
    @InjectQueue('payments') private readonly paymentsQueue: Queue,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
    @InjectQueue('search-indexing') private readonly searchQueue: Queue,
    @InjectQueue('emails') private readonly emailsQueue: Queue,
    @InjectQueue('cleanup') private readonly cleanupQueue: Queue,
  ) {}

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
   * Get general settings
   */
  async getGeneralSettings(adminId: string): Promise<any> {
    await this.verifyAdmin(adminId);

    return {
      siteName: 'GharBatai Rentals',
      siteUrl: 'https://rental-portal.com',
      contactEmail: 'support@rental-portal.com',
      allowRegistration: true,
      requireEmailVerification: true,
      maintenanceMode: false,
      debugMode: false,
    };
  }

  /**
   * Get API keys
   */
  async getApiKeys(adminId: string): Promise<any> {
    await this.verifyAdmin(adminId);

    const apiKeys = [
      {
        id: 'key-1',
        name: 'Production API Key',
        service: 'Stripe',
        isActive: true,
        createdAt: new Date('2024-01-01'),
        lastUsed: new Date('2024-01-25'),
      },
    ];

    return { apiKeys };
  }

  /**
   * Get service configuration
   */
  async getServiceConfig(adminId: string): Promise<any> {
    await this.verifyAdmin(adminId);

    return {
      services: [
        {
          id: 'email',
          name: 'Email Service',
          enabled: true,
          config: [
            { key: 'provider', value: 'SendGrid', label: 'Provider' },
            { key: 'apiKey', value: '••••••••••••••••', label: 'API Key', type: 'password' },
          ],
        },
        {
          id: 'sms',
          name: 'SMS Service',
          enabled: true,
          config: [
            { key: 'provider', value: 'Twilio', label: 'Provider' },
            { key: 'phoneNumber', value: '+1234567890', label: 'Phone Number' },
          ],
        },
      ],
    };
  }

  /**
   * Get environment configuration
   */
  async getEnvironmentConfig(adminId: string): Promise<any> {
    await this.verifyAdmin(adminId);

    return {
      environment: [
        {
          key: 'NODE_ENV',
          value: 'production',
          description: 'Node environment',
          isSecret: false,
        },
        {
          key: 'DATABASE_URL',
          value: '••••••••••••••••••••••••••',
          description: 'Database connection string',
          isSecret: true,
        },
        {
          key: 'STRIPE_SECRET_KEY',
          value: '••••••••••••••••••••••••••',
          description: 'Stripe secret key',
          isSecret: true,
        },
      ],
    };
  }

  /**
   * Get system overview
   */
  async getSystemOverview(adminId: string): Promise<any> {
    await this.verifyAdmin(adminId);

    const [connections, queueStats, scheduler] = await Promise.all([
      this.getDatabaseConnections(),
      this.getQueueStats(),
      Promise.resolve(this.getSchedulerSnapshot()),
    ]);

    const queueBacklog = queueStats.reduce(
      (total, queue) => total + queue.waiting + queue.active + queue.delayed,
      0,
    );

    return {
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      uptime: Math.round(process.uptime()),
      connections,
      queueBacklog,
      scheduledJobs: scheduler.cronJobs.length,
      activeIntervals: scheduler.intervals.length,
      system: {
        overallStatus: this.aggregateStatus([
          ...queueStats.map((queue) => queue.status),
        ]),
        activeServices: queueStats.filter((queue) => queue.status === 'healthy').length,
        systemLoad: this.getCpuUsage(),
      },
      queues: queueStats,
      scheduler,
    };
  }

  /**
   * Get system health
   */
  async getSystemHealth(adminId: string): Promise<any> {
    await this.verifyAdmin(adminId);

    const [database, queueStats] = await Promise.all([
      this.measureDatabaseHealth(),
      this.getQueueStats(),
    ]);

    const redisStatus = this.aggregateStatus(queueStats.map((queue) => queue.status));
    const redisLatency = this.average(queueStats.map((queue) => queue.latency));
    const memoryUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const usedMemory = memoryUsage.rss;
    const cpuUsage = this.getCpuUsage();
    const scheduler = this.getSchedulerSnapshot();
    const storageConfigured = Boolean(
      process.env.S3_BUCKET || process.env.AWS_S3_BUCKET || process.env.STORAGE_BUCKET,
    );

    const status = this.aggregateStatus([
      database.status,
      redisStatus,
      storageConfigured ? 'healthy' : 'degraded',
    ]);

    return {
      status,
      uptime: 99.9,
      processUptimeSeconds: Math.round(process.uptime()),
      services: {
        database: { status: database.status, latency: database.latency },
        redis: { status: redisStatus, latency: redisLatency },
        storage: { status: storageConfigured ? 'healthy' : 'degraded', latency: 0 },
        queues: {
          status: redisStatus,
          latency: redisLatency,
          totalBacklog: queueStats.reduce(
            (total, queue) => total + queue.waiting + queue.active + queue.delayed,
            0,
          ),
        },
        scheduler: {
          status: scheduler.cronJobs.length > 0 ? 'healthy' : 'degraded',
          latency: 0,
          cronJobs: scheduler.cronJobs.length,
          intervals: scheduler.intervals.length,
        },
      },
      queues: queueStats,
      scheduler,
      memory: {
        used: usedMemory,
        total: totalMemory,
        percentage: Number(((usedMemory / totalMemory) * 100).toFixed(1)),
      },
      cpu: {
        usage: cpuUsage,
        cores: os.cpus().length,
      },
    };
  }

  /**
   * Get system logs
   */
  async getSystemLogs(adminId: string, level?: string, limit?: number, search?: string): Promise<any> {
    await this.verifyAdmin(adminId);

    const rawLogs = await this.prisma.auditLog.findMany({
      where: {
        OR: search
          ? [
              { action: { contains: search, mode: 'insensitive' } },
              { entityType: { contains: search, mode: 'insensitive' } },
              { entityId: { contains: search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit || 100, 200),
    });

    const logs = rawLogs
      .map((entry) => {
        const inferredLevel = this.inferLogLevel(entry.action);
        return {
          id: entry.id,
          level: inferredLevel,
          message: `${entry.action} ${entry.entityType || 'SYSTEM'} ${entry.entityId || ''}`.trim(),
          timestamp: entry.createdAt,
          meta: {
            userId: entry.userId,
            metadata: entry.metadata,
            oldValues: entry.oldValues,
            newValues: entry.newValues,
          },
        };
      })
      .filter((entry) => !level || entry.level.toLowerCase() === level.toLowerCase());

    return { logs };
  }

  /**
   * Get database information
   */
  async getDatabaseInfo(adminId: string): Promise<any> {
    await this.verifyAdmin(adminId);

    const [sizeResult, tableStats, connections] = await Promise.all([
      this.prisma.$queryRaw<Array<{ size: bigint | number }>>`
        SELECT pg_database_size(current_database()) AS size
      `,
      this.prisma.$queryRaw<Array<{ name: string; rows: bigint | number; size: bigint | number }>>`
        SELECT
          relname AS name,
          n_live_tup AS rows,
          pg_total_relation_size(relid) AS size
        FROM pg_stat_user_tables
        ORDER BY pg_total_relation_size(relid) DESC
        LIMIT 10
      `,
      this.getDatabaseConnections(),
    ]);

    return {
      size: this.toNumber(sizeResult[0]?.size),
      tables: tableStats.map((table) => ({
        name: table.name,
        rows: this.toNumber(table.rows),
        size: this.toNumber(table.size),
      })),
      connections,
      database: {
        status: 'healthy',
        activeConnections: connections,
        maxConnections: 100,
        avgQueryTime: 0,
        totalConnections: connections,
      },
    };
  }

  /**
   * Get backup information.
   *
   * Reads backup records from the SystemBackup table, which is populated by
   * the scheduled backup cron job (or external backup tooling via the API).
   * Returns an empty list with a warning when no records exist — administrators
   * should verify that the backup cron is running and registering records.
   */
  async getBackupInfo(adminId: string): Promise<any> {
    await this.verifyAdmin(adminId);

    let backups: any[] = [];

    try {
      backups = await (this.prisma as any).systemBackup.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
    } catch {
      // SystemBackup table may not exist yet in this deployment; return empty
      this.logger.warn(
        'SystemBackup table not found or query failed. ' +
        'Run a database migration and ensure the backup cron is configured.',
      );
    }

    const lastBackup = backups[0] ?? null;

    return {
      backups,
      lastBackupAt: lastBackup?.createdAt ?? null,
      nextScheduledAt: null, // Determined by the external cron schedule
      warning:
        backups.length === 0
          ? 'No backup records found. Verify the backup cron job is running and posting records to /admin/system/backups.'
          : undefined,
    };
  }

  private async measureDatabaseHealth(): Promise<{ status: string; latency: number }> {
    const startedAt = Date.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'healthy',
        latency: Date.now() - startedAt,
      };
    } catch {
      return {
        status: 'unhealthy',
        latency: Date.now() - startedAt,
      };
    }
  }

  private async getDatabaseConnections(): Promise<number> {
    const result = await this.prisma.$queryRaw<Array<{ count: bigint | number }>>`
      SELECT COUNT(*) AS count
      FROM pg_stat_activity
      WHERE datname = current_database()
    `;

    return this.toNumber(result[0]?.count);
  }

  private async getQueueStats() {
    const queues = [
      { name: 'bookings', queue: this.bookingsQueue },
      { name: 'payments', queue: this.paymentsQueue },
      { name: 'notifications', queue: this.notificationsQueue },
      { name: 'search-indexing', queue: this.searchQueue },
      { name: 'emails', queue: this.emailsQueue },
      { name: 'cleanup', queue: this.cleanupQueue },
    ];

    return Promise.all(
      queues.map(async ({ name, queue }) => {
        const startedAt = Date.now();
        try {
          await queue.isReady();
          const counts = await queue.getJobCounts();

          return {
            name,
            status: counts.failed > 0 ? 'degraded' : 'healthy',
            latency: Date.now() - startedAt,
            active: counts.active || 0,
            waiting: counts.waiting || 0,
            completed: counts.completed || 0,
            failed: counts.failed || 0,
            delayed: counts.delayed || 0,
            paused: 0,
          };
        } catch (error) {
          return {
            name,
            status: 'unhealthy',
            latency: Date.now() - startedAt,
            active: 0,
            waiting: 0,
            completed: 0,
            failed: 0,
            delayed: 0,
            paused: 0,
            error: error instanceof Error ? error.message : 'Queue unavailable',
          };
        }
      }),
    );
  }

  private getSchedulerSnapshot() {
    const cronJobs = Array.from(this.schedulerRegistry.getCronJobs().entries()).map(
      ([name, job]) => {
        const nextRun = this.serializeCronDate(() => job.nextDate());

        return {
          name,
          running: Boolean(nextRun),
          nextRun,
          lastRun: this.serializeCronDate(() => job.lastDate()),
        };
      },
    );

    return {
      cronJobs,
      intervals: this.schedulerRegistry.getIntervals(),
    };
  }

  private serializeCronDate(factory: () => unknown): string | null {
    try {
      const value = factory();
      if (!value) {
        return null;
      }
      if (value instanceof Date) {
        return value.toISOString();
      }
      if (typeof value === 'object' && value && 'toISO' in value && typeof (value as { toISO: () => string | null }).toISO === 'function') {
        return (value as { toISO: () => string | null }).toISO();
      }
      if (typeof value === 'object' && value && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
        return (value as { toDate: () => Date }).toDate().toISOString();
      }
      return String(value);
    } catch {
      return null;
    }
  }

  private inferLogLevel(action: string): 'ERROR' | 'WARN' | 'INFO' {
    const normalized = action.toUpperCase();
    if (
      normalized.includes('FAILED') ||
      normalized.includes('ERROR') ||
      normalized.includes('REJECTED') ||
      normalized.includes('DENIED')
    ) {
      return 'ERROR';
    }
    if (
      normalized.includes('WARN') ||
      normalized.includes('SUSPEND') ||
      normalized.includes('FLAG')
    ) {
      return 'WARN';
    }
    return 'INFO';
  }

  private aggregateStatus(statuses: string[]): 'healthy' | 'degraded' | 'unhealthy' {
    if (statuses.some((status) => status === 'unhealthy')) {
      return 'unhealthy';
    }
    if (statuses.some((status) => status === 'degraded')) {
      return 'degraded';
    }
    return 'healthy';
  }

  private average(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }
    return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
  }

  private getCpuUsage(): number {
    const coreCount = Math.max(os.cpus().length, 1);
    const oneMinuteLoad = os.loadavg()[0] || 0;
    return Number(Math.min((oneMinuteLoad / coreCount) * 100, 100).toFixed(1));
  }

  private toNumber(value: bigint | number | undefined): number {
    if (typeof value === 'bigint') {
      return Number(value);
    }
    return Number(value || 0);
  }
}
