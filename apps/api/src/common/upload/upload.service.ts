import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import * as path from 'path';

export interface UploadOptions {
  folder?: string;
  maxSizeBytes?: number;
  allowedMimeTypes?: string[];
  generateThumbnail?: boolean;
  thumbnailSizes?: Array<{ width: number; height: number; suffix: string }>;
}

export interface UploadResult {
  url: string;
  key: string;
  bucket: string;
  size: number;
  mimeType: string;
  thumbnails?: Array<{ url: string; key: string; size: string }>;
}

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly cdnUrl: string;

  constructor(private configService: ConfigService) {
    this.bucket = this.configService.get('AWS_S3_BUCKET');
    this.cdnUrl = this.configService.get('CDN_URL');

    const endpoint = this.configService.get('AWS_S3_ENDPOINT');

    this.s3Client = new S3Client({
      region: this.configService.get('AWS_REGION'),
      endpoint: endpoint || undefined, // Use MinIO endpoint if provided
      forcePathStyle: !!endpoint, // Required for MinIO compatibility
      credentials: {
        accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
      },
    });

    this.logger.log(
      `S3 Client initialized with bucket: ${this.bucket}${endpoint ? ` and endpoint: ${endpoint}` : ''}`,
    );
  }

  /**
   * Upload a file to S3
   */
  async uploadFile(file: any, options: UploadOptions = {}): Promise<UploadResult> {
    const {
      folder = 'uploads',
      maxSizeBytes = 10 * 1024 * 1024, // 10MB default
      allowedMimeTypes = [],
      generateThumbnail = false,
      thumbnailSizes = [
        { width: 150, height: 150, suffix: 'thumb' },
        { width: 400, height: 400, suffix: 'medium' },
        { width: 800, height: 800, suffix: 'large' },
      ],
    } = options;

    // Validate file size
    if (file.size > maxSizeBytes) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${maxSizeBytes / 1024 / 1024}MB`,
      );
    }

    // Validate mime type
    if (allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed. Allowed types: ${allowedMimeTypes.join(', ')}`,
      );
    }

    // Generate unique filename
    const fileExtension = path.extname(file.originalname);
    const fileName = `${uuidv4()}${fileExtension}`;
    const key = `${folder}/${fileName}`;

    try {
      // Upload original file
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          CacheControl: 'max-age=31536000', // 1 year
          Metadata: {
            originalName: file.originalname,
            uploadedAt: new Date().toISOString(),
          },
        }),
      );

      const url = this.getPublicUrl(key);
      const result: UploadResult = {
        url,
        key,
        bucket: this.bucket,
        size: file.size,
        mimeType: file.mimetype,
      };

      // Generate thumbnails for images
      if (generateThumbnail && file.mimetype.startsWith('image/')) {
        result.thumbnails = await this.generateThumbnails(
          file.buffer,
          folder,
          fileName,
          thumbnailSizes,
        );
      }

      this.logger.log(`File uploaded successfully: ${key}`);
      return result;
    } catch (error) {
      this.logger.error(`Error uploading file: ${error.message}`);
      throw error;
    }
  }

  /**
   * Upload multiple files
   */
  async uploadMultiple(files: any[], options: UploadOptions = {}): Promise<UploadResult[]> {
    const results = await Promise.all(files.map((file) => this.uploadFile(file, options)));
    return results;
  }

  /**
   * Generate thumbnails for an image
   */
  private async generateThumbnails(
    buffer: Buffer,
    folder: string,
    originalFileName: string,
    sizes: Array<{ width: number; height: number; suffix: string }>,
  ): Promise<Array<{ url: string; key: string; size: string }>> {
    const thumbnails = [];

    for (const size of sizes) {
      const baseFileName = path.parse(originalFileName).name;
      const extension = path.parse(originalFileName).ext;
      const thumbnailFileName = `${baseFileName}_${size.suffix}${extension}`;
      const key = `${folder}/thumbnails/${thumbnailFileName}`;

      try {
        // Resize image
        const resizedBuffer = await sharp(buffer)
          .resize(size.width, size.height, {
            fit: 'cover',
            position: 'center',
          })
          .jpeg({ quality: 85 })
          .toBuffer();

        // Upload thumbnail
        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: resizedBuffer,
            ContentType: 'image/jpeg',
            CacheControl: 'max-age=31536000',
          }),
        );

        thumbnails.push({
          url: this.getPublicUrl(key),
          key,
          size: `${size.width}x${size.height}`,
        });
      } catch (error) {
        this.logger.error(`Error generating thumbnail ${size.suffix}: ${error.message}`);
      }
    }

    return thumbnails;
  }

  /**
   * Delete a file from S3
   */
  async deleteFile(key: string): Promise<void> {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );

      this.logger.log(`File deleted successfully: ${key}`);
    } catch (error) {
      this.logger.error(`Error deleting file: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete multiple files
   */
  async deleteMultiple(keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => this.deleteFile(key)));
  }

  /**
   * Get a pre-signed URL for temporary access
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  /**
   * Get presigned URL for upload (client-side upload)
   */
  async getPresignedUploadUrl(
    fileName: string,
    mimeType: string,
    folder: string = 'uploads',
  ): Promise<{ url: string; key: string; fields: Record<string, string> }> {
    const fileExtension = path.extname(fileName);
    const uniqueFileName = `${uuidv4()}${fileExtension}`;
    const key = `${folder}/${uniqueFileName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
    });

    const url = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });

    return {
      url,
      key,
      fields: {
        'Content-Type': mimeType,
        key,
      },
    };
  }

  /**
   * Check if file exists
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      return true;
    } catch (error) {
      if (error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(key: string): Promise<any> {
    const response = await this.s3Client.send(
      new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    return {
      size: response.ContentLength,
      contentType: response.ContentType,
      lastModified: response.LastModified,
      metadata: response.Metadata,
    };
  }

  /**
   * Get public URL for a file
   */
  getPublicUrl(key: string): string {
    if (this.cdnUrl) {
      return `${this.cdnUrl}/${key}`;
    }
    return `https://${this.bucket}.s3.${this.configService.get('AWS_REGION')}.amazonaws.com/${key}`;
  }

  /**
   * Copy file to a new location
   */
  async copyFile(sourceKey: string, destinationKey: string): Promise<void> {
    try {
      const copySource = `${this.bucket}/${sourceKey}`;

      await this.s3Client.send(
        new CopyObjectCommand({
          Bucket: this.bucket,
          Key: destinationKey,
          CopySource: copySource,
        }),
      );

      this.logger.log(`File copied from ${sourceKey} to ${destinationKey}`);
    } catch (error) {
      this.logger.error(`Error copying file: ${error.message}`);
      throw error;
    }
  }
}
