import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PrismaService } from '@/common/prisma/prisma.service';

export interface FileUploadOptions {
  key: string;
  body: Buffer | Uint8Array | string;
  contentType: string;
  metadata?: Record<string, string>;
  acl?:
    | 'private'
    | 'public-read'
    | 'public-read-write'
    | 'authenticated-read'
    | 'aws-exec-read'
    | 'bucket-owner-read'
    | 'bucket-owner-full-control';
}

export interface FileUploadResult {
  key: string;
  location: string;
  bucket: string;
  etag?: string;
  size?: number;
  contentType: string;
}

export interface PresignedUrlOptions {
  key: string;
  expiresIn?: number; // seconds
  contentType?: string;
}

export interface FileListOptions {
  prefix?: string;
  maxKeys?: number;
  continuationToken?: string;
}

export interface FileListResult {
  files: Array<{
    key: string;
    size: number;
    lastModified: Date;
    etag: string;
    storageClass: string;
  }>;
  isTruncated: boolean;
  nextContinuationToken?: string;
  maxKeys: number;
  commonPrefixes?: string[];
}

@Injectable()
export class S3StorageService {
  private readonly logger = new Logger(S3StorageService.name);
  private s3Client: S3Client;
  private bucketName: string;
  private region: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.region = this.config.get('AWS_REGION', 'us-east-1');
    this.bucketName = this.config.get('AWS_S3_BUCKET_NAME');

    if (!this.bucketName) {
      this.logger.warn('AWS S3 bucket name not configured');
      return;
    }

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.config.get('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.config.get('AWS_SECRET_ACCESS_KEY'),
      },
    });
  }

  /**
   * Upload file to S3
   */
  async uploadFile(options: FileUploadOptions): Promise<FileUploadResult> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: options.key,
        Body: options.body,
        ContentType: options.contentType,
        Metadata: options.metadata || {},
        ACL: options.acl || 'private',
      });

      const response = await this.s3Client.send(command);

      const result: FileUploadResult = {
        key: options.key,
        location: `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${options.key}`,
        bucket: this.bucketName,
        etag: response.ETag,
        size: typeof options.body === 'string' ? options.body.length : options.body.byteLength,
        contentType: options.contentType,
      };

      // Save file record to database
      await this.saveFileRecord(result, options.metadata);

      this.logger.log(`File uploaded successfully: ${options.key}`);

      return result;
    } catch (error) {
      this.logger.error('Failed to upload file to S3', error);
      throw error;
    }
  }

  /**
   * Get presigned URL for file upload
   */
  async getUploadPresignedUrl(options: PresignedUrlOptions): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: options.key,
        ContentType: options.contentType,
        ACL: 'private',
      });

      const expiresIn = options.expiresIn || 3600; // 1 hour default
      const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn });

      return signedUrl;
    } catch (error) {
      this.logger.error('Failed to generate upload presigned URL', error);
      throw error;
    }
  }

  /**
   * Get presigned URL for file download
   */
  async getDownloadPresignedUrl(options: PresignedUrlOptions): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: options.key,
      });

      const expiresIn = options.expiresIn || 3600; // 1 hour default
      const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn });

      return signedUrl;
    } catch (error) {
      this.logger.error('Failed to generate download presigned URL', error);
      throw error;
    }
  }

  /**
   * Delete file from S3
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);

      // Delete file record from database
      await this.deleteFileRecord(key);

      this.logger.log(`File deleted successfully: ${key}`);
    } catch (error) {
      this.logger.error('Failed to delete file from S3', error);
      throw error;
    }
  }

  /**
   * List files in S3 bucket
   */
  async listFiles(options: FileListOptions = {}): Promise<FileListResult> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: options.prefix,
        MaxKeys: options.maxKeys || 1000,
        ContinuationToken: options.continuationToken,
      });

      const response = await this.s3Client.send(command);

      const files = (response.Contents || []).map((item) => ({
        key: item.Key || '',
        size: item.Size || 0,
        lastModified: item.LastModified || new Date(),
        etag: item.ETag || '',
        storageClass: item.StorageClass || 'STANDARD',
      }));

      return {
        files,
        isTruncated: response.IsTruncated || false,
        nextContinuationToken: response.NextContinuationToken,
        maxKeys: response.MaxKeys || 1000,
        commonPrefixes:
          (response.CommonPrefixes?.map((prefix) => prefix.Prefix || []) as string[]) || [],
      };
    } catch (error) {
      this.logger.error('Failed to list files in S3', error);
      throw error;
    }
  }

  /**
   * Check if bucket exists
   */
  async bucketExists(): Promise<boolean> {
    try {
      const command = new HeadBucketCommand({
        Bucket: this.bucketName,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'NoSuchBucket') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Create bucket if it doesn't exist
   */
  async ensureBucket(): Promise<void> {
    try {
      const exists = await this.bucketExists();

      if (!exists) {
        const command = new CreateBucketCommand({
          Bucket: this.bucketName,
          CreateBucketConfiguration:
            this.region !== 'us-east-1'
              ? {
                  LocationConstraint: this.region as any,
                }
              : undefined,
        });

        await this.s3Client.send(command);
        this.logger.log(`Bucket created: ${this.bucketName}`);
      }
    } catch (error) {
      this.logger.error('Failed to ensure bucket exists', error);
      throw error;
    }
  }

  /**
   * Upload listing photos
   */
  async uploadListingPhotos(
    listingId: string,
    files: Array<{
      buffer: Buffer;
      originalName: string;
      mimeType: string;
      size: number;
    }>,
  ): Promise<FileUploadResult[]> {
    const results: FileUploadResult[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const key = `listings/${listingId}/photos/${Date.now()}-${i}-${file.originalName}`;

      const result = await this.uploadFile({
        key,
        body: file.buffer,
        contentType: file.mimeType,
        metadata: {
          listingId,
          originalName: file.originalName,
          size: file.size.toString(),
          uploadIndex: i.toString(),
        },
        acl: 'public-read',
      });

      results.push(result);
    }

    // Update listing with photo URLs
    await this.prisma.listing.update({
      where: { id: listingId },
      data: {
        photos: results.map((r) => r.location),
      },
    });

    return results;
  }

  /**
   * Upload user avatar
   */
  async uploadUserAvatar(
    userId: string,
    file: {
      buffer: Buffer;
      originalName: string;
      mimeType: string;
      size: number;
    },
  ): Promise<FileUploadResult> {
    const key = `users/${userId}/avatar/${Date.now()}-${file.originalName}`;

    const result = await this.uploadFile({
      key,
      body: file.buffer,
      contentType: file.mimeType,
      metadata: {
        userId,
        originalName: file.originalName,
        size: file.size.toString(),
        type: 'avatar',
      },
      acl: 'public-read',
    });

    return result;
  }

  /**
   * Upload organization logo
   */
  async uploadOrganizationLogo(
    organizationId: string,
    file: {
      buffer: Buffer;
      originalName: string;
      mimeType: string;
      size: number;
    },
  ): Promise<FileUploadResult> {
    const key = `organizations/${organizationId}/logo/${Date.now()}-${file.originalName}`;

    const result = await this.uploadFile({
      key,
      body: file.buffer,
      contentType: file.mimeType,
      metadata: {
        organizationId,
        originalName: file.originalName,
        size: file.size.toString(),
        type: 'logo',
      },
      acl: 'public-read',
    });

    // Update organization with logo URL
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        logoUrl: result.location,
      },
    });

    return result;
  }

  /**
   * Get file statistics
   */
  async getFileStatistics(): Promise<{
    totalFiles: number;
    totalSize: number;
    byType: Record<string, { count: number; size: number }>;
  }> {
    try {
      const files = await this.listFiles({ maxKeys: 10000 });

      const stats = {
        totalFiles: files.files.length,
        totalSize: files.files.reduce((sum, file) => sum + file.size, 0),
        byType: {} as Record<string, { count: number; size: number }>,
      };

      for (const file of files.files) {
        const extension = file.key.split('.').pop()?.toLowerCase() || 'unknown';

        if (!stats.byType[extension]) {
          stats.byType[extension] = { count: 0, size: 0 };
        }

        stats.byType[extension].count++;
        stats.byType[extension].size += file.size;
      }

      return stats;
    } catch (error) {
      this.logger.error('Failed to get file statistics', error);
      return {
        totalFiles: 0,
        totalSize: 0,
        byType: {},
      };
    }
  }

  /**
   * Test S3 configuration
   */
  async testS3Configuration(): Promise<{ success: boolean; message: string }> {
    try {
      await this.ensureBucket();

      // Test upload
      const testKey = `test/${Date.now()}-test.txt`;
      await this.uploadFile({
        key: testKey,
        body: 'S3 configuration test',
        contentType: 'text/plain',
      });

      // Test download
      const downloadUrl = await this.getDownloadPresignedUrl({ key: testKey });

      // Cleanup
      await this.deleteFile(testKey);

      return { success: true, message: 'S3 configuration test passed' };
    } catch (error) {
      this.logger.error('S3 configuration test failed', error);
      return { success: false, message: error.message };
    }
  }

  private async saveFileRecord(
    result: FileUploadResult,
    metadata?: Record<string, string>,
  ): Promise<void> {
    try {
      // Save to database (simplified - would use proper schema in production)
      // await this.prisma.file.create({
      //   data: {
      //     key: result.key,
      //     location: result.location,
      //     bucket: result.bucket,
      //     etag: result.etag,
      //     size: result.size,
      //     contentType: result.contentType,
      //     metadata: metadata || {},
      //     createdAt: new Date(),
      //   },
      // });
      this.logger.log('File record saved (mock implementation)');
    } catch (error) {
      this.logger.error('Failed to save file record', error);
    }
  }

  private async deleteFileRecord(key: string): Promise<void> {
    try {
      // Delete from database (simplified - would use proper schema in production)
      // await this.prisma.file.deleteMany({
      //   where: { key },
      // });
      this.logger.log('File record deleted (mock implementation)');
    } catch (error) {
      this.logger.error('Failed to delete file record', error);
    }
  }
}
