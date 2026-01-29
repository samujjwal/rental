import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  UseGuards,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { S3StorageService } from './s3.service';

@ApiTags('storage')
@Controller('storage')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StorageController {
  constructor(private readonly s3StorageService: S3StorageService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload file to S3' })
  @ApiResponse({ status: 200, description: 'File uploaded successfully' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: any, @Body('key') key: string, @Body('acl') acl?: string) {
    if (!file) {
      throw new Error('No file provided');
    }

    return this.s3StorageService.uploadFile({
      key,
      body: file.buffer,
      contentType: file.mimetype,
      metadata: {
        originalName: file.originalname,
        size: file.size.toString(),
      },
      acl: acl as any,
    });
  }

  @Post('upload-url')
  @ApiOperation({ summary: 'Get presigned upload URL' })
  @ApiResponse({ status: 200, description: 'Presigned URL generated successfully' })
  async getUploadPresignedUrl(
    @Body() data: { key: string; contentType: string; expiresIn?: number },
  ) {
    return {
      url: await this.s3StorageService.getUploadPresignedUrl({
        key: data.key,
        contentType: data.contentType,
        expiresIn: data.expiresIn,
      }),
    };
  }

  @Get('download-url')
  @ApiOperation({ summary: 'Get presigned download URL' })
  @ApiResponse({ status: 200, description: 'Presigned URL generated successfully' })
  async getDownloadPresignedUrl(@Query('key') key: string, @Query('expiresIn') expiresIn?: number) {
    return {
      url: await this.s3StorageService.getDownloadPresignedUrl({
        key,
        expiresIn,
      }),
    };
  }

  @Delete('file')
  @ApiOperation({ summary: 'Delete file from S3' })
  @ApiResponse({ status: 200, description: 'File deleted successfully' })
  async deleteFile(@Body('key') key: string) {
    await this.s3StorageService.deleteFile(key);
    return { status: 'deleted' };
  }

  @Get('list')
  @ApiOperation({ summary: 'List files in S3 bucket' })
  @ApiResponse({ status: 200, description: 'Files listed successfully' })
  async listFiles(
    @Query() query: { prefix?: string; maxKeys?: number; continuationToken?: string },
  ) {
    return this.s3StorageService.listFiles(query);
  }

  @Post('listing-photos')
  @ApiOperation({ summary: 'Upload listing photos' })
  @ApiResponse({ status: 200, description: 'Listing photos uploaded successfully' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('files'))
  async uploadListingPhotos(@UploadedFile() files: any[], @Body('listingId') listingId: string) {
    if (!files || files.length === 0) {
      throw new Error('No files provided');
    }

    const fileData = files.map((file) => ({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    }));

    return this.s3StorageService.uploadListingPhotos(listingId, fileData);
  }

  @Post('user-avatar')
  @ApiOperation({ summary: 'Upload user avatar' })
  @ApiResponse({ status: 200, description: 'User avatar uploaded successfully' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadUserAvatar(@UploadedFile() file: any, @Body('userId') userId: string) {
    if (!file) {
      throw new Error('No file provided');
    }

    return this.s3StorageService.uploadUserAvatar(userId, {
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    });
  }

  @Post('organization-logo')
  @ApiOperation({ summary: 'Upload organization logo' })
  @ApiResponse({ status: 200, description: 'Organization logo uploaded successfully' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadOrganizationLogo(
    @UploadedFile() file: any,
    @Body('organizationId') organizationId: string,
  ) {
    if (!file) {
      throw new Error('No file provided');
    }

    return this.s3StorageService.uploadOrganizationLogo(organizationId, {
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    });
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get file storage statistics' })
  @ApiResponse({ status: 200, description: 'Storage statistics retrieved successfully' })
  async getFileStatistics() {
    return this.s3StorageService.getFileStatistics();
  }

  @Get('test')
  @ApiOperation({ summary: 'Test S3 configuration' })
  @ApiResponse({ status: 200, description: 'S3 configuration test result' })
  async testS3Configuration() {
    return this.s3StorageService.testS3Configuration();
  }

  @Get('bucket-exists')
  @ApiOperation({ summary: 'Check if bucket exists' })
  @ApiResponse({ status: 200, description: 'Bucket existence checked successfully' })
  async bucketExists() {
    return {
      exists: await this.s3StorageService.bucketExists(),
      bucket: this.s3StorageService['bucketName'],
    };
  }

  @Post('ensure-bucket')
  @ApiOperation({ summary: 'Ensure bucket exists' })
  @ApiResponse({ status: 200, description: 'Bucket ensured successfully' })
  async ensureBucket() {
    await this.s3StorageService.ensureBucket();
    return { status: 'bucket_ensured' };
  }
}
