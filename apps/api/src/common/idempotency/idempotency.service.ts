import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { createHash } from 'crypto';

export interface IdempotencyRecord {
  id: string;
  key: string;
  userId: string | null;
  route: string;
  method: string;
  bodyHash: string;
  response: any;
  statusCode: number;
  createdAt: Date;
  expiresAt: Date;
}

export interface IdempotencyCheckOptions {
  key: string;
  userId?: string;
  route: string;
  method: string;
  body?: any;
  ttlHours?: number;
}

export interface IdempotencyResult {
  isReplay: boolean;
  response?: any;
  statusCode?: number;
  record?: IdempotencyRecord;
}

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly defaultTTLHours: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.defaultTTLHours = this.config.get<number>('idempotency.ttlHours', 24);
  }

  /**
   * Check if an idempotency key exists and return cached response if found
   * Uses fingerprinting to detect key reuse across different requests
   */
  async check(options: IdempotencyCheckOptions): Promise<IdempotencyResult> {
    const { key, userId, route, method, body, ttlHours = this.defaultTTLHours } = options;

    // Generate request fingerprint
    const bodyHash = this.generateBodyHash(body);
    const fingerprint = this.generateFingerprint(key, userId, route, method, bodyHash);

    // Try to find existing record
    const existing = await this.prisma.$queryRaw<Array<IdempotencyRecord>>`
      SELECT * FROM idempotency_records
      WHERE key = ${key}
        AND route = ${route}
        AND method = ${method}
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (existing && existing.length > 0) {
      const record = existing[0];

      // Check if body hash matches (same request payload)
      if (record.bodyHash === bodyHash) {
        this.logger.log(`Idempotency replay detected for key: ${key}`);
        return {
          isReplay: true,
          response: record.response,
          statusCode: record.statusCode,
          record,
        };
      }

      // Body hash differs - potential key reuse conflict
      this.logger.warn(
        `Idempotency key reuse detected with different payload. Key: ${key}, Route: ${route}`,
      );
      throw new NotFoundException(
        'Idempotency key already used with different request payload. Use a new idempotency key.',
      );
    }

    // No existing record - return new record data for storage
    return {
      isReplay: false,
      record: {
        id: crypto.randomUUID(),
        key,
        userId: userId || null,
        route,
        method,
        bodyHash,
        response: null,
        statusCode: null,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + ttlHours * 60 * 60 * 1000),
      },
    };
  }

  /**
   * Store the response for an idempotency key
   */
  async storeResponse(record: IdempotencyRecord, response: any, statusCode: number): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        INSERT INTO idempotency_records (id, key, user_id, route, method, body_hash, response, status_code, created_at, expires_at)
        VALUES (
          ${record.id},
          ${record.key},
          ${record.userId},
          ${record.route},
          ${record.method},
          ${record.bodyHash},
          ${JSON.stringify(response)}::jsonb,
          ${statusCode},
          ${record.createdAt},
          ${record.expiresAt}
        )
        ON CONFLICT (key, route, method) DO NOTHING
      `;

      this.logger.log(`Idempotency response stored for key: ${record.key}`);
    } catch (error) {
      this.logger.error('Failed to store idempotency response', error);
      // Don't throw - idempotency failures should not break the main flow
    }
  }

  /**
   * Clean up expired idempotency records
   */
  async cleanupExpired(): Promise<number> {
    try {
      const result = await this.prisma.$executeRaw`
        DELETE FROM idempotency_records
        WHERE expires_at IS NOT NULL AND expires_at < NOW()
      `;

      this.logger.log(`Cleaned up ${result} expired idempotency records`);
      return result as number;
    } catch (error) {
      this.logger.error('Failed to cleanup expired idempotency records', error);
      return 0;
    }
  }

  /**
   * Generate a hash of the request body for fingerprinting
   */
  private generateBodyHash(body?: any): string {
    if (!body) {
      return 'empty';
    }

    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
    return createHash('sha256').update(bodyString).digest('hex');
  }

  /**
   * Generate a unique fingerprint combining all request context
   */
  private generateFingerprint(
    key: string,
    userId: string | undefined,
    route: string,
    method: string,
    bodyHash: string,
  ): string {
    const parts = [key, userId || 'anonymous', route, method, bodyHash];
    return createHash('sha256').update(parts.join('|')).digest('hex');
  }

  /**
   * Get statistics about idempotency records
   */
  async getStats(): Promise<{
    totalRecords: number;
    expiredRecords: number;
    activeRecords: number;
    recordsByRoute: Record<string, number>;
  }> {
    try {
      const total = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count FROM idempotency_records
      `;

      const expired = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count FROM idempotency_records
        WHERE expires_at IS NOT NULL AND expires_at < NOW()
      `;

      const active = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count FROM idempotency_records
        WHERE expires_at IS NULL OR expires_at > NOW()
      `;

      const byRoute = await this.prisma.$queryRaw<Array<{ route: string; count: bigint }>>`
        SELECT route, COUNT(*) as count
        FROM idempotency_records
        WHERE expires_at IS NULL OR expires_at > NOW()
        GROUP BY route
      `;

      const recordsByRoute: Record<string, number> = {};
      for (const row of byRoute) {
        recordsByRoute[row.route] = Number(row.count);
      }

      return {
        totalRecords: Number(total[0].count),
        expiredRecords: Number(expired[0].count),
        activeRecords: Number(active[0].count),
        recordsByRoute,
      };
    } catch (error) {
      this.logger.error('Failed to get idempotency stats', error);
      return {
        totalRecords: 0,
        expiredRecords: 0,
        activeRecords: 0,
        recordsByRoute: {},
      };
    }
  }
}
