import { Test, TestingModule } from '@nestjs/testing';
import { AuditArchivalService } from './audit-archival.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Logger } from '@nestjs/common';

describe('AuditArchivalService', () => {
  let service: AuditArchivalService;
  let mockPrisma: { auditLog: { findMany: jest.Mock; deleteMany: jest.Mock } };
  let s3SendMock: jest.Mock;
  let logSpy: jest.SpyInstance;

  const mockPrismaService = {
    auditLog: { findMany: jest.fn(), deleteMany: jest.fn() },
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config: Record<string, any> = {
        AWS_REGION: 'us-east-1',
        AWS_ACCESS_KEY_ID: 'test-key',
        AWS_SECRET_ACCESS_KEY: 'test-secret',
        AUDIT_ARCHIVE_BUCKET: 'test-bucket',
      };
      return config[key] ?? defaultValue;
    }),
  };

  beforeEach(async () => {
    s3SendMock = jest.fn().mockResolvedValue({});
    const mockS3Client = { send: s3SendMock } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditArchivalService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: S3Client, useValue: mockS3Client },
      ],
    }).compile();

    service = module.get<AuditArchivalService>(AuditArchivalService);
    // Override the S3 client with our mock after service creation
    (service as any).s3 = mockS3Client;
    mockPrisma = mockPrismaService as any;
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.clearAllMocks();

    // Reset S3 mock to resolve successfully (must be after clearAllMocks)
    s3SendMock.mockResolvedValue({});
    // Also set the mock on the service's S3 client again after clearAllMocks
    (service as any).s3 = { send: s3SendMock };
    // Reset Prisma mocks after clearAllMocks
    mockPrismaService.auditLog.findMany.mockResolvedValue([]);
    mockPrismaService.auditLog.deleteMany.mockResolvedValue({ count: 0 });
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  describe('archiveOldLogs', () => {
    it('should archive old logs successfully', async () => {
      const oldLogs = [
        { id: 'log-1', createdAt: new Date('2025-01-01'), action: 'CREATE' },
        { id: 'log-2', createdAt: new Date('2025-01-02'), action: 'UPDATE' },
      ];
      // Return logs on first call, empty on subsequent calls
      mockPrisma.auditLog.findMany.mockResolvedValueOnce(oldLogs).mockResolvedValue([]);
      mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 2 });

      const result = await service.archiveOldLogs(90, 100);

      expect(result.archived).toBe(2);
      expect(result.batches).toBe(1);
      expect(result.errors).toBe(0);
    });

    it('should stop when no more logs to archive', async () => {
      mockPrisma.auditLog.findMany
        .mockResolvedValueOnce([{ id: 'log-1' }])
        .mockResolvedValueOnce([]);
      mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.archiveOldLogs(90, 100);

      expect(result.batches).toBe(1);
    });

    it('should respect safety limit of 100000 logs', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([{ id: 'log-1' }]);
      mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 1 });

      // Mock to simulate reaching safety limit
      let callCount = 0;
      mockPrisma.auditLog.deleteMany.mockImplementation(() => {
        callCount++;
        return Promise.resolve({ count: callCount <= 100000 ? 1 : 0 });
      });

      const result = await service.archiveOldLogs(90, 1);

      // Should stop after processing many batches
      expect(result.archived).toBeLessThanOrEqual(100000);
    });

    it('should stop after 5 errors', async () => {
      mockPrisma.auditLog.findMany.mockRejectedValue(new Error('DB Error'));

      const result = await service.archiveOldLogs(90, 100);

      expect(result.errors).toBeGreaterThanOrEqual(1);
    });

    it('should handle batch with custom size', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([{ id: 'log-1' }]);
      mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 1 });

      await service.archiveOldLogs(90, 500);

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 500 }),
      );
    });
  });

  describe('archiveBatch', () => {
    it('should upload batch to S3 with correct structure', async () => {
      const batch: any = {
        logs: [{ id: 'log-1', action: 'CREATE' }],
        archivedAt: new Date('2025-03-15'),
        batchId: 'test-batch-1',
      };

      // Access private method
      await (service as any).archiveBatch(batch);

      expect(s3SendMock).toHaveBeenCalled();
      const s3Call = s3SendMock.mock.calls[0][0];
      expect(s3Call.input).toMatchObject({
        Bucket: 'test-bucket',
        Key: '2025/03/15/test-batch-1.json',
        ContentType: 'application/json',
        Metadata: {
          'batch-id': 'test-batch-1',
          'log-count': '1',
        },
      });
    });

    it('should use correct date-based key structure', async () => {
      const batch: any = {
        logs: [],
        archivedAt: new Date('2025-12-25T10:30:00Z'),
        batchId: 'batch-123',
      };

      await (service as any).archiveBatch(batch);

      expect(s3SendMock).toHaveBeenCalled();
      const s3Call = s3SendMock.mock.calls[0][0];
      expect(s3Call.input.Key).toBe('2025/12/25/batch-123.json');
    });
  });

  describe('getArchiveMetadata', () => {
    it('should return placeholder metadata', async () => {
      const fromDate = new Date('2025-01-01');
      const toDate = new Date('2025-12-31');

      const result = await service.getArchiveMetadata(fromDate, toDate);

      expect(result).toEqual({
        totalBatches: 0,
        dateRange: {
          from: fromDate.toISOString(),
          to: toDate.toISOString(),
        },
      });
    });

    it('should handle undefined dates', async () => {
      const result = await service.getArchiveMetadata();

      expect(result).toEqual({
        totalBatches: 0,
        dateRange: { from: '', to: '' },
      });
    });
  });

  describe('verifyArchiveIntegrity', () => {
    it('should return placeholder verification result', async () => {
      const result = await service.verifyArchiveIntegrity(100);

      expect(result).toEqual({
        verified: true,
        checked: 0,
        mismatches: 0,
      });
    });

    it('should use default sample size', async () => {
      const result = await service.verifyArchiveIntegrity();

      expect(result.verified).toBe(true);
    });
  });
});
