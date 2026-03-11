import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  UseGuards,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '@/common/auth';
import { UserRole } from '@rental-portal/database';
import { PrismaService } from '@/common/prisma/prisma.service';
import { S3StorageService } from './s3.service';

@ApiTags('storage')
@Controller('storage')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StorageController {
  constructor(
    private readonly s3StorageService: S3StorageService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload file to S3' })
  @ApiResponse({ status: 200, description: 'File uploaded successfully' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
    fileFilter: (_req, file, cb) => {
      const allowed = /^(image\/(jpeg|png|gif|webp|svg\+xml)|application\/pdf|text\/plain)$/;
      if (!allowed.test(file.mimetype)) {
        return cb(new BadRequestException(`File type '${file.mimetype}' is not allowed`), false);
      }
      cb(null, true);
    },
  }))
  async uploadFile(@UploadedFile() file: any, @Body('key') key: string, @Body('acl') acl?: string) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const sanitizedKey = key.replace(/\.\.\//g, '').replace(/^\/+/, '');

    return this.s3StorageService.uploadFile({
      key: sanitizedKey,
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
    const sanitizedKey = data.key.replace(/\.\.\//g, '').replace(/^\/+/, '');
    return {
      url: await this.s3StorageService.getUploadPresignedUrl({
        key: sanitizedKey,
        contentType: data.contentType,
        expiresIn: data.expiresIn,
      }),
    };
  }

  @Get('download-url')
  @ApiOperation({ summary: 'Get presigned download URL' })
  @ApiResponse({ status: 200, description: 'Presigned URL generated successfully' })
  async getDownloadPresignedUrl(@Query('key') key: string, @Query('expiresIn') expiresIn?: number) {
    const sanitizedKey = key.replace(/\.\.\//g, '').replace(/^\/+/, '');
    return {
      url: await this.s3StorageService.getDownloadPresignedUrl({
        key: sanitizedKey,
        expiresIn,
      }),
    };
  }

  @Delete('file')
  @ApiOperation({ summary: 'Delete file from S3' })
  @ApiResponse({ status: 200, description: 'File deleted successfully' })
  async deleteFile(@Body('key') key: string) {
    const sanitizedKey = key.replace(/\.\.\//g, '').replace(/^\/+/, '');
    await this.s3StorageService.deleteFile(sanitizedKey);
    return { status: 'deleted' };
  }

  @Get('list')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List files in S3 bucket' })
  @ApiResponse({ status: 200, description: 'Files listed successfully' })
  async listFiles(
    @Query() query: { prefix?: string; maxKeys?: number; continuationToken?: string },
  ) {
    if (query.prefix) {
      query.prefix = query.prefix.replace(/\.\.\//g, '').replace(/^\/+/, '');
    }
    return this.s3StorageService.listFiles(query);
  }

  @Post('listing-photos')
  @ApiOperation({ summary: 'Upload listing photos' })
  @ApiResponse({ status: 200, description: 'Listing photos uploaded successfully' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadListingPhotos(
    @UploadedFiles() files: any[],
    @Body('listingId') listingId: string,
    @CurrentUser('id') currentUserId: string,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    const listing = await this.prisma.listing.findUnique({ where: { id: listingId }, select: { ownerId: true } });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.ownerId !== currentUserId) throw new ForbiddenException('You do not own this listing');

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
  async uploadUserAvatar(@UploadedFile() file: any, @CurrentUser('id') userId: string) {
    if (!file) {
      throw new BadRequestException('No file provided');
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
    @CurrentUser('id') currentUserId: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const member = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: currentUserId,
        role: { in: ['OWNER', 'ADMIN'] as any[] },
      },
    });
    if (!member) throw new ForbiddenException('You must be an OWNER or ADMIN of this organization');

    return this.s3StorageService.uploadOrganizationLogo(organizationId, {
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    });
  }

  @Get('statistics')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get file storage statistics' })
  @ApiResponse({ status: 200, description: 'Storage statistics retrieved successfully' })
  async getFileStatistics() {
    return this.s3StorageService.getFileStatistics();
  }

  @Get('test')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Test S3 configuration' })
  @ApiResponse({ status: 200, description: 'S3 configuration test result' })
  async testS3Configuration() {
    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException('Not Found');
    }
    return this.s3StorageService.testS3Configuration();
  }

  @Get('bucket-exists')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Check if bucket exists' })
  @ApiResponse({ status: 200, description: 'Bucket existence checked successfully' })
  async bucketExists() {
    return {
      exists: await this.s3StorageService.bucketExists(),
      bucket: this.s3StorageService['bucketName'],
    };
  }

  @Post('ensure-bucket')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Ensure bucket exists' })
  @ApiResponse({ status: 200, description: 'Bucket ensured successfully' })
  async ensureBucket() {
    await this.s3StorageService.ensureBucket();
    return { status: 'bucket_ensured' };
  }
}
