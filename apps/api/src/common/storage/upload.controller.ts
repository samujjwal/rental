import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '@/common/auth';
import { StorageService } from './storage.service';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';

type UploadResponse = {
  url: string;
  key: string;
  bucket: string;
  size: number;
  mimeType: string;
};

@ApiTags('upload')
@Controller('upload')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UploadController {
  constructor(
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {}

  @Post('image')
  @ApiOperation({ summary: 'Upload a single image' })
  @ApiResponse({ status: 200, description: 'Image uploaded successfully' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadImage(@UploadedFile() file: any): Promise<UploadResponse> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    if (!file.mimetype?.startsWith('image/')) {
      throw new BadRequestException('Invalid image type');
    }

    const result = await this.storageService.upload({
      file: file.buffer,
      fileName: file.originalname,
      mimeType: file.mimetype,
      folder: 'images',
    });

    return this.toUploadResponse(result, file.mimetype);
  }

  @Post('images')
  @ApiOperation({ summary: 'Upload multiple images' })
  @ApiResponse({ status: 200, description: 'Images uploaded successfully' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 10, { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadImages(
    @UploadedFiles() files: any[],
  ): Promise<UploadResponse[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    const uploads = await Promise.all(
      files.map(async (file) => {
        if (!file.mimetype?.startsWith('image/')) {
          throw new BadRequestException('Invalid image type');
        }
        const result = await this.storageService.upload({
          file: file.buffer,
          fileName: file.originalname,
          mimeType: file.mimetype,
          folder: 'images',
        });
        return this.toUploadResponse(result, file.mimetype);
      }),
    );

    return uploads;
  }

  @Post('document')
  @ApiOperation({ summary: 'Upload a document' })
  @ApiResponse({ status: 200, description: 'Document uploaded successfully' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  async uploadDocument(@UploadedFile() file: any): Promise<UploadResponse> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    const allowedDocumentTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedDocumentTypes.includes(file.mimetype)) {
      throw new BadRequestException('Unsupported document type. Allowed: PDF, JPEG, PNG, WEBP, DOC, DOCX');
    }

    const result = await this.storageService.upload({
      file: file.buffer,
      fileName: file.originalname,
      mimeType: file.mimetype,
      folder: 'documents',
    });

    return this.toUploadResponse(result, file.mimetype);
  }

  @Delete(':key')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a file' })
  @ApiResponse({ status: 200, description: 'File deleted successfully' })
  async deleteFile(@Param('key') key: string): Promise<{ success: boolean }> {
    const success = await this.storageService.delete(key);
    return { success };
  }

  @Get('signed-url/:key')
  @ApiOperation({ summary: 'Get a signed URL for a file' })
  @ApiResponse({ status: 200, description: 'Signed URL generated' })
  async getSignedUrl(@Param('key') key: string): Promise<{ url: string }> {
    const url = await this.storageService.getSignedUrl(key);
    return { url };
  }

  @Post('presigned')
  @ApiOperation({ summary: 'Get a presigned upload URL' })
  @ApiResponse({ status: 200, description: 'Presigned upload URL generated' })
  async getPresignedUploadUrl(
    @Body() body: { fileName: string; mimeType: string },
    @Query('folder') folder?: string,
  ): Promise<{ url: string; key: string }> {
    const safeName = path.basename(body.fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${folder || 'uploads'}/${Date.now()}-${safeName}`;
    const url = await this.storageService.getSignedUrl(key);
    return { url, key };
  }

  private toUploadResponse(
    result: { url: string; key: string; size: number },
    mimeType: string,
  ): UploadResponse {
    return {
      url: result.url,
      key: result.key,
      bucket: this.getBucketName(),
      size: result.size,
      mimeType,
    };
  }

  private getBucketName(): string {
    const r2Account = this.configService.get<string>('R2_ACCOUNT_ID');
    const r2Bucket = this.configService.get<string>('R2_BUCKET_NAME');
    if (r2Account && r2Bucket) {
      return r2Bucket;
    }
    return 'local';
  }
}
