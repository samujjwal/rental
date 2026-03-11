import {
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { i18nForbidden } from '@/common/errors/i18n-exceptions';
import { PrismaService } from '@/common/prisma/prisma.service';
import { UserRole } from '@rental-portal/database';

/**
 * Extracted from admin.service.ts — handles system configuration,
 * health checks, logs, backups, and infrastructure settings.
 */
@Injectable()
export class AdminSystemService {
  constructor(private readonly prisma: PrismaService) {}

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

    return {
      system: {
        overallStatus: 'healthy',
        activeServices: 8,
        systemLoad: 35,
      },
    };
  }

  /**
   * Get system health
   */
  async getSystemHealth(adminId: string): Promise<any> {
    await this.verifyAdmin(adminId);

    return {
      health: {
        api: { status: 'healthy', responseTime: 145 },
        database: { status: 'healthy', responseTime: 25 },
        redis: { status: 'healthy', responseTime: 5 },
        uptime: 99.9,
      },
    };
  }

  /**
   * Get system logs
   */
  async getSystemLogs(adminId: string, level?: string, limit?: number): Promise<any> {
    await this.verifyAdmin(adminId);

    const logs = [
      {
        id: 'log-1',
        level: 'INFO',
        message: 'Application started successfully',
        timestamp: new Date(),
      },
      {
        id: 'log-2',
        level: 'WARN',
        message: 'High memory usage detected',
        timestamp: new Date(Date.now() - 3600000),
      },
      {
        id: 'log-3',
        level: 'ERROR',
        message: 'Database connection timeout',
        timestamp: new Date(Date.now() - 7200000),
      },
    ];

    let filteredLogs = logs;
    if (level) filteredLogs = logs.filter((l) => l.level === level);

    return { logs: filteredLogs.slice(0, limit || 100) };
  }

  /**
   * Get database information
   */
  async getDatabaseInfo(adminId: string): Promise<any> {
    await this.verifyAdmin(adminId);

    return {
      database: {
        status: 'healthy',
        activeConnections: 15,
        maxConnections: 100,
        avgQueryTime: 25,
        totalConnections: 150,
      },
    };
  }

  /**
   * Get backup information
   */
  async getBackupInfo(adminId: string): Promise<any> {
    await this.verifyAdmin(adminId);

    const backups = [
      {
        id: 'backup-1',
        type: 'FULL',
        size: 15728640,
        status: 'COMPLETED',
        createdAt: new Date('2024-01-25'),
      },
      {
        id: 'backup-2',
        type: 'INCREMENTAL',
        size: 5242880,
        status: 'COMPLETED',
        createdAt: new Date('2024-01-26'),
      },
    ];

    return { backups };
  }
}
