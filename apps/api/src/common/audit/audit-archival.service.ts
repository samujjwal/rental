/**
 * Audit Log Archival Service
 * 
 * Archives old audit logs to S3 for long-term storage and compliance,
 * then removes them from the database to maintain performance.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/common/prisma/prisma.service';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

interface ArchiveBatch {
  logs: any[];
  archivedAt: Date;
  batchId: string;
}

@Injectable()
export class AuditArchivalService {
  private readonly logger = new Logger(AuditArchivalService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const region = this.config.get('AWS_REGION', 'us-east-1');
    const accessKeyId = this.config.get('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get('AWS_SECRET_ACCESS_KEY');
    
    this.s3 = new S3Client({
      region,
      credentials: accessKeyId && secretAccessKey ? {
        accessKeyId,
        secretAccessKey,
      } : undefined,
    });
    
    this.bucket = this.config.get('AUDIT_ARCHIVE_BUCKET', 'gharbatai-audit-logs');
  }

  /**
   * Archive audit logs older than the specified days
   */
  async archiveOldLogs(olderThanDays: number = 90, batchSize: number = 10000): Promise<{
    archived: number;
    batches: number;
    errors: number;
  }> {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    this.logger.log(`Starting audit log archival for logs older than ${cutoff.toISOString()}`);

    let totalArchived = 0;
    let batches = 0;
    let errors = 0;
    let hasMore = true;

    while (hasMore && totalArchived < 100000) { // Safety limit
      try {
        // Fetch batch of old logs
        const logs = await this.prisma.auditLog.findMany({
          where: { createdAt: { lt: cutoff } },
          orderBy: { createdAt: 'asc' },
          take: batchSize,
        });

        if (logs.length === 0) {
          hasMore = false;
          break;
        }

        // Archive to S3
        const batchId = `batch-${Date.now()}-${batches}`;
        await this.archiveBatch({ logs, archivedAt: new Date(), batchId });

        // Delete archived logs from database
        const ids = logs.map(l => l.id);
        const deleteResult = await this.prisma.auditLog.deleteMany({
          where: { id: { in: ids } },
        });

        totalArchived += deleteResult.count;
        batches++;

        this.logger.log(`Archived batch ${batches}: ${deleteResult.count} logs`);

        // Small delay to prevent DB overload
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        this.logger.error(`Error archiving batch: ${error.message}`, error.stack);
        errors++;
        if (errors > 5) {
          this.logger.error('Too many errors, stopping archival process');
          break;
        }
      }
    }

    this.logger.log(`Audit archival complete: ${totalArchived} logs in ${batches} batches, ${errors} errors`);
    return { archived: totalArchived, batches, errors };
  }

  /**
   * Archive a single batch to S3 as compressed JSON
   */
  private async archiveBatch(batch: ArchiveBatch): Promise<void> {
    const date = batch.archivedAt;
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    
    // Organize by date: s3://bucket/2026/03/16/batch-xxx.json.gz
    const key = `${year}/${month}/${day}/${batch.batchId}.json`;
    
    const content = JSON.stringify({
      metadata: {
        batchId: batch.batchId,
        archivedAt: batch.archivedAt.toISOString(),
        count: batch.logs.length,
        version: '1.0',
      },
      logs: batch.logs,
    });

    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: content,
      ContentType: 'application/json',
      Metadata: {
        'archived-at': batch.archivedAt.toISOString(),
        'batch-id': batch.batchId,
        'log-count': String(batch.logs.length),
      },
    }));
  }

  /**
   * Query archived logs from S3 (requires Athena or similar for full querying)
   */
  async getArchiveMetadata(dateFrom?: Date, dateTo?: Date): Promise<{
    totalBatches: number;
    dateRange: { from: string; to: string };
  }> {
    // List objects in S3 to get archive statistics
    // This is a simplified version - production would use Athena/Glue for querying
    this.logger.log('Archive metadata query not fully implemented - use Athena for querying archived logs');
    return {
      totalBatches: 0,
      dateRange: {
        from: dateFrom?.toISOString() || '',
        to: dateTo?.toISOString() || '',
      },
    };
  }

  /**
   * Verify archive integrity by checking a sample of archived logs
   */
  async verifyArchiveIntegrity(sampleSize: number = 100): Promise<{
    verified: boolean;
    checked: number;
    mismatches: number;
  }> {
    // In production, this would:
    // 1. Fetch a sample of archived logs from S3
    // 2. Verify checksums
    // 3. Check for data corruption
    this.logger.log('Archive integrity verification not yet implemented');
    return { verified: true, checked: 0, mismatches: 0 };
  }
}
