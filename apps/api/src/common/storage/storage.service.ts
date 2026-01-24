import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
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

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client | null = null;
  private readonly bucketName: string;
  private readonly useLocalStorage: boolean;
  private readonly localStoragePath: string;
  private readonly publicUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.useLocalStorage = this.configService.get<string>('NODE_ENV') === 'development' || 
                          !this.configService.get<string>('R2_ACCOUNT_ID');
    
    if (this.useLocalStorage) {
      // Local storage for development
      this.localStoragePath = this.configService.get<string>('LOCAL_STORAGE_PATH') || './uploads';
      this.publicUrl = this.configService.get<string>('API_URL') || 'http://localhost:3000';
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
          endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        });
        
        this.publicUrl = this.configService.get<string>('R2_PUBLIC_URL') || 
                         `https://pub-${accountId}.r2.dev/${this.bucketName}`;
        this.logger.log('Using Cloudflare R2 storage for production');
      } else {
        this.logger.warn('R2 credentials not configured, falling back to local storage');
        this.useLocalStorage = true;
        this.localStoragePath = './uploads';
        this.publicUrl = 'http://localhost:3000';
        this.bucketName = '';
      }
    }
  }

  async upload(options: UploadOptions): Promise<UploadResult> {
    const { file, fileName, mimeType, folder = 'general' } = options;
    
    // Generate unique key
    const extension = path.extname(fileName);
    const uniqueName = `${uuidv4()}${extension}`;
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

  async uploadListingImage(file: Buffer, fileName: string, mimeType: string): Promise<UploadResult> {
    return this.upload({
      file,
      fileName,
      mimeType,
      folder: 'listings',
    });
  }

  async uploadProfilePicture(file: Buffer, fileName: string, mimeType: string): Promise<UploadResult> {
    return this.upload({
      file,
      fileName,
      mimeType,
      folder: 'profiles',
    });
  }

  async uploadInsuranceDocument(file: Buffer, fileName: string, mimeType: string): Promise<UploadResult> {
    return this.upload({
      file,
      fileName,
      mimeType,
      folder: 'insurance',
    });
  }

  async uploadConditionReport(file: Buffer, fileName: string, mimeType: string): Promise<UploadResult> {
    return this.upload({
      file,
      fileName,
      mimeType,
      folder: 'condition-reports',
    });
  }
}
