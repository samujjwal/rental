import { ConfigService } from '@nestjs/config';
import { S3StorageService } from './s3.service';
import { PrismaService } from '@/common/prisma/prisma.service';

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3', () => {
  const mockSend = jest.fn();
  return {
    S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
    PutObjectCommand: jest.fn(),
    GetObjectCommand: jest.fn(),
    DeleteObjectCommand: jest.fn(),
    ListObjectsV2Command: jest.fn(),
    HeadBucketCommand: jest.fn(),
    CreateBucketCommand: jest.fn(),
    __mockSend: mockSend,
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed-url.example.com'),
}));

jest.mock('@/common/prisma/prisma.service');

const { __mockSend } = jest.requireMock('@aws-sdk/client-s3');
const { getSignedUrl } = jest.requireMock('@aws-sdk/s3-request-presigner');

describe('S3StorageService', () => {
  let service: S3StorageService;
  let configService: jest.Mocked<ConfigService>;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(() => {
    jest.clearAllMocks();

    configService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        const config: Record<string, string> = {
          AWS_REGION: 'us-east-1',
          AWS_S3_BUCKET_NAME: 'test-bucket',
          AWS_ACCESS_KEY_ID: 'AKID',
          AWS_SECRET_ACCESS_KEY: 'SECRET',
        };
        return config[key] || defaultValue;
      }),
    } as any;

    prisma = {
      file: {
        create: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as any;

    service = new S3StorageService(configService, prisma);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  it('warns when bucket name is not configured', () => {
    const emptyConfig = {
      get: jest.fn((key: string, def?: string) => {
        if (key === 'AWS_S3_BUCKET_NAME') return undefined;
        return def;
      }),
    } as any;

    // Should not throw, just warn
    expect(() => new S3StorageService(emptyConfig, prisma)).not.toThrow();
  });

  describe('uploadFile', () => {
    it('uploads file and returns result', async () => {
      __mockSend.mockResolvedValue({ ETag: '"abc123"' });

      const result = await service.uploadFile({
        key: 'uploads/test.jpg',
        body: Buffer.from('image-data'),
        contentType: 'image/jpeg',
      });

      expect(result.key).toBe('uploads/test.jpg');
      expect(result.bucket).toBe('test-bucket');
      expect(result.contentType).toBe('image/jpeg');
      expect(result.location).toContain('test-bucket');
      expect(result.etag).toBe('"abc123"');
    });

    it('throws on S3 error', async () => {
      __mockSend.mockRejectedValue(new Error('S3 failure'));

      await expect(
        service.uploadFile({
          key: 'uploads/fail.jpg',
          body: Buffer.from('data'),
          contentType: 'image/jpeg',
        }),
      ).rejects.toThrow('S3 failure');
    });
  });

  describe('getUploadPresignedUrl', () => {
    it('returns signed URL', async () => {
      const url = await service.getUploadPresignedUrl({ key: 'uploads/new.jpg' });
      expect(url).toBe('https://signed-url.example.com');
      expect(getSignedUrl).toHaveBeenCalled();
    });

    it('uses custom expiry', async () => {
      await service.getUploadPresignedUrl({ key: 'x.jpg', expiresIn: 600 });
      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { expiresIn: 600 },
      );
    });
  });

  describe('getDownloadPresignedUrl', () => {
    it('returns signed download URL', async () => {
      const url = await service.getDownloadPresignedUrl({ key: 'uploads/test.jpg' });
      expect(url).toBe('https://signed-url.example.com');
    });
  });

  describe('deleteFile', () => {
    it('deletes file from S3', async () => {
      __mockSend.mockResolvedValue({});

      await expect(service.deleteFile('uploads/test.jpg')).resolves.toBeUndefined();
      expect(__mockSend).toHaveBeenCalled();
    });

    it('throws on S3 error', async () => {
      __mockSend.mockRejectedValue(new Error('Delete failed'));

      await expect(service.deleteFile('uploads/bad.jpg')).rejects.toThrow('Delete failed');
    });
  });

  describe('listFiles', () => {
    it('returns files list', async () => {
      __mockSend.mockResolvedValue({
        Contents: [
          { Key: 'a.jpg', Size: 100, LastModified: new Date(), ETag: '"e1"', StorageClass: 'STANDARD' },
          { Key: 'b.jpg', Size: 200, LastModified: new Date(), ETag: '"e2"', StorageClass: 'STANDARD' },
        ],
        IsTruncated: false,
        MaxKeys: 1000,
      });

      const result = await service.listFiles({ prefix: 'uploads/' });

      expect(result.files).toHaveLength(2);
      expect(result.files[0].key).toBe('a.jpg');
      expect(result.isTruncated).toBe(false);
    });

    it('returns empty list when no contents', async () => {
      __mockSend.mockResolvedValue({
        Contents: undefined,
        IsTruncated: false,
        MaxKeys: 1000,
      });

      const result = await service.listFiles();
      expect(result.files).toHaveLength(0);
    });
  });

  describe('bucketExists', () => {
    it('returns true when bucket exists', async () => {
      __mockSend.mockResolvedValue({});
      const exists = await service.bucketExists();
      expect(exists).toBe(true);
    });

    it('returns false for NoSuchBucket', async () => {
      const err = new Error('No bucket');
      (err as any).name = 'NoSuchBucket';
      __mockSend.mockRejectedValue(err);

      const exists = await service.bucketExists();
      expect(exists).toBe(false);
    });

    it('throws on other errors', async () => {
      __mockSend.mockRejectedValue(new Error('Network error'));

      await expect(service.bucketExists()).rejects.toThrow('Network error');
    });
  });
});
