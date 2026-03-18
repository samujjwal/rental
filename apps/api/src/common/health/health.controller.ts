import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorResult,
  HttpHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ExternalServicesHealthIndicator } from './external-services.health';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private http: HttpHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private prisma: PrismaService,
    private externalServices: ExternalServicesHealthIndicator,
    @InjectQueue('bookings') private bookingsQueue: Queue,
    @InjectQueue('notifications') private notificationsQueue: Queue,
    @InjectQueue('search-indexing') private searchQueue: Queue,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'General health check' })
  check() {
    return this.health.check([
      // Database check
      () => this.probeDatabase(),

      // Memory check - heap should not exceed 300MB
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),

      // Memory check - RSS should not exceed 500MB
      () => this.memory.checkRSS('memory_rss', 500 * 1024 * 1024),

      // Disk check - storage should have at least 50% free space
      () =>
        this.disk.checkStorage('disk', {
          thresholdPercent: 0.5,
          path: '/',
        }),
    ]);
  }

  @Get('database')
  @HealthCheck()
  @ApiOperation({ summary: 'Database health check' })
  checkDatabase() {
    return this.health.check([() => this.probeDatabase()]);
  }

  @Get('queues')
  @HealthCheck()
  @ApiOperation({ summary: 'Queue health check' })
  async checkQueues() {
    return this.health.check([
      async () => {
        const [bookingsActive, notificationsActive, searchActive] = await Promise.all([
          this.bookingsQueue.getActiveCount(),
          this.notificationsQueue.getActiveCount(),
          this.searchQueue.getActiveCount(),
        ]);

        const [bookingsFailed, notificationsFailed, searchFailed] = await Promise.all([
          this.bookingsQueue.getFailedCount(),
          this.notificationsQueue.getFailedCount(),
          this.searchQueue.getFailedCount(),
        ]);

        const [bookingsWaiting, notificationsWaiting, searchWaiting] = await Promise.all([
          this.bookingsQueue.getWaitingCount(),
          this.notificationsQueue.getWaitingCount(),
          this.searchQueue.getWaitingCount(),
        ]);

        return {
          queues: {
            status: 'up',
            bookings: {
              active: bookingsActive,
              waiting: bookingsWaiting,
              failed: bookingsFailed,
            },
            notifications: {
              active: notificationsActive,
              waiting: notificationsWaiting,
              failed: notificationsFailed,
            },
            search: {
              active: searchActive,
              waiting: searchWaiting,
              failed: searchFailed,
            },
          },
        };
      },
    ]);
  }

  @Get('memory')
  @HealthCheck()
  @ApiOperation({ summary: 'Memory health check' })
  checkMemory() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 500 * 1024 * 1024),
    ]);
  }

  @Get('disk')
  @HealthCheck()
  @ApiOperation({ summary: 'Disk health check' })
  checkDisk() {
    return this.health.check([
      () =>
        this.disk.checkStorage('disk', {
          thresholdPercent: 0.5,
          path: '/',
        }),
    ]);
  }

  @Get('external-services')
  @HealthCheck()
  @ApiOperation({ summary: 'External services health check (email, SMS, payments)' })
  async checkExternalServices() {
    return this.health.check([
      () => this.externalServices.checkEmailProvider(),
      () => this.externalServices.checkSmsProvider(),
      () => this.externalServices.checkPaymentProvider(),
    ]);
  }

  @Get('liveness')
  @ApiOperation({ summary: 'Liveness probe for Kubernetes' })
  liveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('readiness')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe for Kubernetes' })
  readiness() {
    return this.health.check([
      () => this.probeDatabase(),
      async () => {
        try {
          await this.bookingsQueue.isReady();
          return { redis: { status: 'up' } };
        } catch (error) {
          return { redis: { status: 'down', message: error.message } };
        }
      },
    ]);
  }

  private async probeDatabase(): Promise<HealthIndicatorResult> {
    const startedAt = Date.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        database: {
          status: 'up',
          responseTime: Date.now() - startedAt,
        },
      };
    } catch (error) {
      return {
        database: {
          status: 'down',
          message: error instanceof Error ? error.message : 'Database unavailable',
        },
      };
    }
  }
}
