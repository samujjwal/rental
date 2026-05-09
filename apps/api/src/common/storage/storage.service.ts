import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID, createHash } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface UploadOptions {
  file: Buffer;
  fileName: string;
  mimeType: string;
  folder?: string;
}

export interface UploadResult {
  url: string;
  key: string;
  size: number;
}

export interface UploadFileOptions {
  key: string;
  body: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
  acl?: string;
}

export interface PresignedUrlOptions {
  key: string;
  contentType?: string;
  expiresIn?: number;
}

export interface ListFilesOptions {
  prefix?: string;
  maxKeys?: number;
  continuationToken?: string;
}

export interface FileData {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client | null = null;
  private readonly bucketName: string;
  private readonly useLocalStorage: boolean;
  private readonly localStoragePath: string;
  private readonly publicUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.useLocalStorage =
      this.configService.get<string>('NODE_ENV') === 'development' ||
      !this.configService.get<string>('R2_ACCOUNT_ID');

    if (this.useLocalStorage) {
      // Local storage for development
      this.localStoragePath = this.configService.get<string>('LOCAL_STORAGE_PATH') || './uploads';
      this.publicUrl = this.configService.get<string>('API_URL') || 'http://localhost:3400';
      this.bucketName = '';
      this.logger.log('Using local file storage for development');
    } else {
      // Cloudflare R2 for production
      const accountId = this.configService.get<string>('R2_ACCOUNT_ID') || '';
      const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID') || '';
      const secretAccessKey = this.configService.get<string>('R2_SECRET_ACCESS_KEY') || '';
      this.bucketName = this.configService.get<string>('R2_BUCKET_NAME') || 'rental-portal-uploads';

      if (accountId && accessKeyId && secretAccessKey) {
        this.s3Client = new S3Client({
          region: 'auto',
          endpoint: accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined,
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        });

        this.publicUrl =
          this.configService.get<string>('R2_PUBLIC_URL') ||
          (accountId ? `https://pub-${accountId}.r2.dev/${this.bucketName}` : undefined);
        this.logger.log('Using Cloudflare R2 storage for production');
      } else {
        this.logger.warn('R2 credentials not configured, falling back to local storage');
        this.useLocalStorage = true;
        this.localStoragePath = './uploads';
        this.publicUrl = 'http://localhost:3400';
        this.bucketName = '';
      }
    }
  }

  async upload(options: UploadOptions): Promise<UploadResult> {
    const { file, fileName, mimeType, folder = 'general' } = options;

    // Generate unique key
    const extension = path.extname(fileName);
    const uniqueName = `${randomUUID()}${extension}`;
    const key = folder ? `${folder}/${uniqueName}` : uniqueName;

    if (this.useLocalStorage) {
      return this.uploadLocal(file, key, mimeType);
    } else {
      return this.uploadR2(file, key, mimeType);
    }
  }

  private async uploadLocal(file: Buffer, key: string, mimeType: string): Promise<UploadResult> {
    try {
      const fullPath = path.join(this.localStoragePath, key);
      const directory = path.dirname(fullPath);

      // Create directory if it doesn't exist
      await fs.mkdir(directory, { recursive: true });

      // Write file
      await fs.writeFile(fullPath, file);

      const url = `${this.publicUrl}/uploads/${key}`;

      this.logger.log(`File uploaded to local storage: ${key}`);

      return {
        url,
        key,
        size: file.length,
      };
    } catch (error) {
      this.logger.error('Error uploading file to local storage', error);
      throw new Error('Failed to upload file to local storage');
    }
  }

  private async uploadR2(file: Buffer, key: string, mimeType: string): Promise<UploadResult> {
    if (!this.s3Client) {
      throw new Error('S3 client not initialized');
    }

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file,
        ContentType: mimeType,
      });

      await this.s3Client.send(command);

      const url = `${this.publicUrl}/${key}`;

      this.logger.log(`File uploaded to R2: ${key}`);

      return {
        url,
        key,
        size: file.length,
      };
    } catch (error) {
      this.logger.error('Error uploading file to R2', error);
      throw new Error('Failed to upload file to R2');
    }
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    if (this.useLocalStorage) {
      // For local storage, return direct URL (no signing needed)
      return `${this.publicUrl}/uploads/${key}`;
    }

    if (!this.s3Client) {
      throw new Error('S3 client not initialized');
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn });
      return signedUrl;
    } catch (error) {
      this.logger.error('Error generating signed URL', error);
      throw new Error('Failed to generate signed URL');
    }
  }

  async delete(key: string): Promise<boolean> {
    if (this.useLocalStorage) {
      return this.deleteLocal(key);
    } else {
      return this.deleteR2(key);
    }
  }

  private async deleteLocal(key: string): Promise<boolean> {
    try {
      const fullPath = path.join(this.localStoragePath, key);
      await fs.unlink(fullPath);
      this.logger.log(`File deleted from local storage: ${key}`);
      return true;
    } catch (error) {
      this.logger.error('Error deleting file from local storage', error);
      return false;
    }
  }

  private async deleteR2(key: string): Promise<boolean> {
    if (!this.s3Client) {
      this.logger.error('S3 client not initialized for R2 delete operation');
      return false;
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      this.logger.log(`File deleted from R2: ${key}`);
      return true;
    } catch (error) {
      this.logger.error('Error deleting file from R2', error);
      return false;
    }
  }

  async uploadListingImage(
    file: Buffer,
    fileName: string,
    mimeType: string,
  ): Promise<UploadResult> {
    return this.upload({
      file,
      fileName,
      mimeType,
      folder: 'listings',
    });
  }

  async uploadProfilePicture(
    file: Buffer,
    fileName: string,
    mimeType: string,
  ): Promise<UploadResult> {
    return this.upload({
      file,
      fileName,
      mimeType,
      folder: 'profiles',
    });
  }

  async uploadInsuranceDocument(
    file: Buffer,
    fileName: string,
    mimeType: string,
  ): Promise<UploadResult> {
    return this.upload({
      file,
      fileName,
      mimeType,
      folder: 'insurance',
    });
  }

  async uploadConditionReport(
    file: Buffer,
    fileName: string,
    mimeType: string,
  ): Promise<UploadResult> {
    return this.upload({
      file,
      fileName,
      mimeType,
      folder: 'condition-reports',
    });
  }

  /**
   * Upload file with explicit key and metadata (for direct controller use)
   */
  async uploadFile(options: UploadFileOptions): Promise<UploadResult> {
    const { key, body, contentType, metadata, acl } = options;

    if (this.useLocalStorage) {
      return this.uploadLocalWithKey(body, key, contentType, metadata);
    } else {
      return this.uploadR2WithKey(body, key, contentType, metadata, acl);
    }
  }

  /**
   * Generate presigned upload URL for client-side uploads
   */
  async getUploadPresignedUrl(options: PresignedUrlOptions): Promise<string> {
    const { key, contentType, expiresIn = 3600 } = options;

    if (this.useLocalStorage) {
      // For local storage, return direct upload endpoint URL
      return `${this.publicUrl}/storage/upload?key=${encodeURIComponent(key)}`;
    }

    if (!this.s3Client) {
      throw new Error('S3 client not initialized');
    }

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: contentType,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn });
      return signedUrl;
    } catch (error) {
      this.logger.error('Error generating upload presigned URL', error);
      throw new Error('Failed to generate upload presigned URL');
    }
  }

  /**
   * Generate presigned download URL
   */
  async getDownloadPresignedUrl(options: PresignedUrlOptions): Promise<string> {
    const { key, expiresIn = 3600 } = options;

    if (this.useLocalStorage) {
      return `${this.publicUrl}/uploads/${key}`;
    }

    if (!this.s3Client) {
      throw new Error('S3 client not initialized');
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn });
      return signedUrl;
    } catch (error) {
      this.logger.error('Error generating download presigned URL', error);
      throw new Error('Failed to generate download presigned URL');
    }
  }

  /**
   * Delete file by key
   */
  async deleteFile(key: string): Promise<boolean> {
    return this.delete(key);
  }

  /**
   * List files in bucket with optional prefix
   */
  async listFiles(options: ListFilesOptions = {}): Promise<{
    files: Array<{ key: string; size: number; lastModified: Date }>;
    nextContinuationToken?: string;
  }> {
    const { prefix, maxKeys = 1000, continuationToken } = options;

    if (this.useLocalStorage) {
      return this.listLocalFiles(prefix, maxKeys);
    }

    if (!this.s3Client) {
      throw new Error('S3 client not initialized');
    }

    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
        MaxKeys: maxKeys,
        ContinuationToken: continuationToken,
      });

      const response = await this.s3Client.send(command);

      const files = (response.Contents || []).map((obj) => ({
        key: obj.Key!,
        size: obj.Size || 0,
        lastModified: obj.LastModified || new Date(),
      }));

      return {
        files,
        nextContinuationToken: response.NextContinuationToken || undefined,
      };
    } catch (error) {
      this.logger.error('Error listing files', error);
      throw new Error('Failed to list files');
    }
  }

  /**
   * Upload multiple listing photos with scoped keys
   */
  async uploadListingPhotos(
    listingId: string,
    files: FileData[],
  ): Promise<Array<{ url: string; key: string; size: number }>> {
    const results: Array<{ url: string; key: string; size: number }> = [];

    for (const fileData of files) {
      const extension = path.extname(fileData.originalName);
      const uniqueName = `${randomUUID()}${extension}`;
      const key = `listings/${listingId}/${uniqueName}`;

      const result = await this.uploadFile({
        key,
        body: fileData.buffer,
        contentType: fileData.mimeType,
        metadata: {
          originalName: fileData.originalName,
          size: fileData.size.toString(),
          listingId,
          uploadType: 'listing-photo',
        },
      });

      results.push(result);
    }

    return results;
  }

  /**
   * Upload user avatar with scoped key
   */
  async uploadUserAvatar(
    userId: string,
    fileData: FileData,
  ): Promise<UploadResult> {
    const extension = path.extname(fileData.originalName);
    const uniqueName = `${randomUUID()}${extension}`;
    const key = `users/${userId}/avatar/${uniqueName}`;

    return this.uploadFile({
      key,
      body: fileData.buffer,
      contentType: fileData.mimeType,
      metadata: {
        originalName: fileData.originalName,
        size: fileData.size.toString(),
        userId,
        uploadType: 'user-avatar',
      },
    });
  }

  /**
   * Upload organization logo with scoped key
   */
  async uploadOrganizationLogo(
    organizationId: string,
    fileData: FileData,
  ): Promise<UploadResult> {
    const extension = path.extname(fileData.originalName);
    const uniqueName = `${randomUUID()}${extension}`;
    const key = `organizations/${organizationId}/logo/${uniqueName}`;

    return this.uploadFile({
      key,
      body: fileData.buffer,
      contentType: fileData.mimeType,
      metadata: {
        originalName: fileData.originalName,
        size: fileData.size.toString(),
        organizationId,
        uploadType: 'organization-logo',
      },
    });
  }

  /**
   * Get file storage statistics
   */
  async getFileStatistics(): Promise<{
    totalFiles: number;
    totalSize: number;
    byType: Record<string, { count: number; size: number }>;
  }> {
    const listed = await this.listFiles({ maxKeys: 10000 });

    const byType: Record<string, { count: number; size: number }> = {};
    let totalSize = 0;

    for (const file of listed.files) {
      const ext = path.extname(file.key).toLowerCase() || 'unknown';
      if (!byType[ext]) {
        byType[ext] = { count: 0, size: 0 };
      }
      byType[ext].count++;
      byType[ext].size += file.size;
      totalSize += file.size;
    }

    return {
      totalFiles: listed.files.length,
      totalSize,
      byType,
    };
  }

  /**
   * Test S3/R2 configuration
   */
  async testS3Configuration(): Promise<{ success: boolean; message: string }> {
    if (this.useLocalStorage) {
      try {
        await fs.mkdir(this.localStoragePath, { recursive: true });
        return { success: true, message: 'Local storage configured' };
      } catch (error) {
        return { success: false, message: 'Local storage configuration failed' };
      }
    }

    if (!this.s3Client) {
      return { success: false, message: 'S3 client not initialized' };
    }

    try {
      const exists = await this.bucketExists();
      if (!exists) {
        await this.ensureBucket();
      }
      return { success: true, message: 'R2 configuration successful' };
    } catch (error) {
      this.logger.error('S3 configuration test failed', error);
      return { success: false, message: 'R2 configuration test failed' };
    }
  }

  /**
   * Check if bucket exists
   */
  async bucketExists(): Promise<boolean> {
    if (this.useLocalStorage) {
      try {
        await fs.access(this.localStoragePath);
        return true;
      } catch {
        return false;
      }
    }

    if (!this.s3Client) {
      return false;
    }

    try {
      const command = new HeadBucketCommand({ Bucket: this.bucketName });
      await this.s3Client.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Ensure bucket exists, create if not
   */
  async ensureBucket(): Promise<void> {
    if (this.useLocalStorage) {
      await fs.mkdir(this.localStoragePath, { recursive: true });
      return;
    }

    if (!this.s3Client) {
      throw new Error('S3 client not initialized');
    }

    const exists = await this.bucketExists();
    if (exists) {
      return;
    }

    try {
      const command = new CreateBucketCommand({ Bucket: this.bucketName });
      await this.s3Client.send(command);
      this.logger.log(`Bucket created: ${this.bucketName}`);
    } catch (error) {
      this.logger.error('Error creating bucket', error);
      throw new Error('Failed to create bucket');
    }
  }

  // Private helper methods

  private async uploadLocalWithKey(
    body: Buffer,
    key: string,
    contentType: string,
    metadata?: Record<string, string>,
  ): Promise<UploadResult> {
    try {
      const fullPath = path.join(this.localStoragePath, key);
      const directory = path.dirname(fullPath);

      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(fullPath, body);

      const url = `${this.publicUrl}/uploads/${key}`;
      this.logger.log(`File uploaded to local storage: ${key}`);

      return { url, key, size: body.length };
    } catch (error) {
      this.logger.error('Error uploading file to local storage', error);
      throw new Error('Failed to upload file to local storage');
    }
  }

  private async uploadR2WithKey(
    body: Buffer,
    key: string,
    contentType: string,
    metadata?: Record<string, string>,
    acl?: string,
  ): Promise<UploadResult> {
    if (!this.s3Client) {
      throw new Error('S3 client not initialized');
    }

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
        Metadata: metadata,
      });

      await this.s3Client.send(command);

      const url = `${this.publicUrl}/${key}`;
      this.logger.log(`File uploaded to R2: ${key}`);

      return { url, key, size: body.length };
    } catch (error) {
      this.logger.error('Error uploading file to R2', error);
      throw new Error('Failed to upload file to R2');
    }
  }

  private async listLocalFiles(
    prefix?: string,
    maxKeys?: number,
  ): Promise<{
    files: Array<{ key: string; size: number; lastModified: Date }>;
    nextContinuationToken?: string;
  }> {
    try {
      const basePath = prefix ? path.join(this.localStoragePath, prefix) : this.localStoragePath;
      const files: Array<{ key: string; size: number; lastModified: Date }> = [];

      const entries = await fs.readdir(basePath, { recursive: true, withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile()) {
          const fullPath = path.join(entry.parentPath, entry.name);
          const relativePath = path.relative(this.localStoragePath, fullPath);
          const stats = await fs.stat(fullPath);

          files.push({
            key: relativePath.replace(/\\/g, '/'),
            size: stats.size,
            lastModified: stats.mtime,
          });

          if (maxKeys && files.length >= maxKeys) {
            break;
          }
        }
      }

      return { files };
    } catch (error) {
      this.logger.error('Error listing local files', error);
      throw new Error('Failed to list local files');
    }
  }
}
