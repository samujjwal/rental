import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { UploadService, UploadOptions } from './upload.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';

@ApiTags('upload')
@ApiBearerAuth()
@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('image')
  @ApiOperation({ summary: 'Upload single image' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: Express.Multer.File, @CurrentUser('id') userId: string) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const options: UploadOptions = {
      folder: `users/${userId}/images`,
      maxSizeBytes: 10 * 1024 * 1024, // 10MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      generateThumbnail: true,
    };

    return this.uploadService.uploadFile(file, options);
  }

  @Post('images')
  @ApiOperation({ summary: 'Upload multiple images' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadImages(
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser('id') userId: string,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    const options: UploadOptions = {
      folder: `users/${userId}/images`,
      maxSizeBytes: 10 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      generateThumbnail: true,
    };

    return this.uploadService.uploadMultiple(files, options);
  }

  @Post('document')
  @ApiOperation({ summary: 'Upload document' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('id') userId: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const options: UploadOptions = {
      folder: `users/${userId}/documents`,
      maxSizeBytes: 20 * 1024 * 1024, // 20MB
      allowedMimeTypes: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ],
    };

    return this.uploadService.uploadFile(file, options);
  }

  @Delete(':key')
  @ApiOperation({ summary: 'Delete file' })
  async deleteFile(@Param('key') key: string) {
    await this.uploadService.deleteFile(key);
    return { message: 'File deleted successfully' };
  }

  @Get('signed-url/:key')
  @ApiOperation({ summary: 'Get temporary signed URL' })
  async getSignedUrl(@Param('key') key: string) {
    const url = await this.uploadService.getSignedUrl(key);
    return { url };
  }

  @Post('presigned-upload')
  @ApiOperation({ summary: 'Get presigned URL for client-side upload' })
  async getPresignedUploadUrl(
    @Body() body: { fileName: string; mimeType: string; folder?: string },
    @CurrentUser('id') userId: string,
  ) {
    const folder = body.folder || `users/${userId}/uploads`;
    return this.uploadService.getPresignedUploadUrl(body.fileName, body.mimeType, folder);
  }
}
