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
import { StorageService } from './storage.service';
import { isAdminRole } from '@/common/auth/admin-roles';
import { OrganizationScopeService } from '@/common/authorization/organization-scope.service';

@ApiTags('storage')
@Controller('storage')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StorageController {
  constructor(
    private readonly storageService: StorageService,
    private readonly prisma: PrismaService,
    private readonly organizationScopeService: OrganizationScopeService,
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
  async uploadFile(
    @UploadedFile() file: any,
    @Body('key') key: string,
    @CurrentUser('id') currentUserId: string,
    @Body('acl') acl?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const sanitizedKey = key.replace(/\.\./g, '').replace(/^\//, '');

    // Ownership check: ensure key is scoped to user's directory
    const isOwnKey = sanitizedKey.startsWith(`users/${currentUserId}/`) || 
                     sanitizedKey.startsWith(`organizations/`) ||
                     sanitizedKey.startsWith(`listings/`) ||
                     sanitizedKey.startsWith(`disputes/`) ||
                     sanitizedKey.startsWith(`insurance/`) ||
                     sanitizedKey.startsWith(`condition-reports/`);
    
    if (!isOwnKey) {
      throw new ForbiddenException('Invalid key path. Files must be uploaded to scoped directories.');
    }

    const result = await this.storageService.uploadFile({
      key: sanitizedKey,
      body: file.buffer,
      contentType: file.mimetype,
      metadata: {
        originalName: file.originalname,
        size: file.size.toString(),
        uploadedBy: currentUserId,
        uploadTimestamp: new Date().toISOString(),
      },
      acl: acl as any,
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId: currentUserId,
        action: 'FILE_UPLOAD',
        entityType: 'Storage',
        entityId: result.key,
        newValues: JSON.stringify({ key: result.key, size: result.size, mimeType: file.mimetype }),
      },
    });

    return result;
  }

  @Post('upload-url')
  @ApiOperation({ summary: 'Get presigned upload URL' })
  @ApiResponse({ status: 200, description: 'Presigned URL generated successfully' })
  async getUploadPresignedUrl(
    @Body() data: { key: string; contentType: string; expiresIn?: number },
    @CurrentUser('id') currentUserId: string,
  ) {
    const sanitizedKey = data.key.replace(/\.\./g, '').replace(/^\//, '');

    // Ownership check for presigned URLs
    const isOwnKey = sanitizedKey.startsWith(`users/${currentUserId}/`) || 
                     sanitizedKey.startsWith(`organizations/`) ||
                     sanitizedKey.startsWith(`listings/`) ||
                     sanitizedKey.startsWith(`disputes/`) ||
                     sanitizedKey.startsWith(`insurance/`) ||
                     sanitizedKey.startsWith(`condition-reports/`);
    
    if (!isOwnKey) {
      throw new ForbiddenException('Invalid key path for presigned URL');
    }

    // Validate MIME type
    const allowed = /^(image\/(jpeg|png|gif|webp|svg\+xml)|application\/pdf|text\/plain)$/;
    if (!allowed.test(data.contentType)) {
      throw new BadRequestException(`Content type '${data.contentType}' is not allowed`);
    }

    const url = await this.storageService.getUploadPresignedUrl({
      key: sanitizedKey,
      contentType: data.contentType,
      expiresIn: data.expiresIn || 3600, // Default 1 hour
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId: currentUserId,
        action: 'PRESIGNED_UPLOAD_URL_GENERATED',
        entityType: 'Storage',
        entityId: sanitizedKey,
        newValues: JSON.stringify({ key: sanitizedKey, contentType: data.contentType }),
      },
    });

    return { url };
  }

  @Get('download-url')
  @ApiOperation({ summary: 'Get presigned download URL' })
  @ApiResponse({ status: 200, description: 'Presigned URL generated successfully' })
  async getDownloadPresignedUrl(
    @Query('key') key: string,
    @CurrentUser('id') currentUserId: string,
    @CurrentUser('role') currentUserRole: string,
    @Query('expiresIn') expiresIn?: number,
  ) {
    const sanitizedKey = key.replace(/\.\./g, '').replace(/^\//, '');

    // Ownership check for download URLs
    const isAdmin = isAdminRole(currentUserRole);
    const isOwnKey = sanitizedKey.startsWith(`users/${currentUserId}/`) || 
                     sanitizedKey.startsWith(`organizations/`) ||
                     sanitizedKey.startsWith(`listings/`) ||
                     sanitizedKey.startsWith(`disputes/`) ||
                     sanitizedKey.startsWith(`insurance/`) ||
                     sanitizedKey.startsWith(`condition-reports/`);
    
    if (!isAdmin && !isOwnKey) {
      throw new ForbiddenException('You do not have permission to access this file');
    }

    const url = await this.storageService.getDownloadPresignedUrl({
      key: sanitizedKey,
      expiresIn: expiresIn || 3600, // Default 1 hour
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId: currentUserId,
        action: 'PRESIGNED_DOWNLOAD_URL_GENERATED',
        entityType: 'Storage',
        entityId: sanitizedKey,
        newValues: JSON.stringify({ key: sanitizedKey }),
      },
    });

    return { url };
  }

  @Delete('file')
  @ApiOperation({ summary: 'Delete file from S3' })
  @ApiResponse({ status: 200, description: 'File deleted successfully' })
  async deleteFile(
    @Body('key') key: string,
    @CurrentUser('id') currentUserId: string,
    @CurrentUser('role') currentUserRole: string,
  ) {
    const sanitizedKey = key.replace(/\.\./g, '').replace(/^\//, '');

    // Ownership check — only allow deleting files under the user's own
    // path prefix (users/{userId}/) or if the caller is an admin.
    const isAdmin = isAdminRole(currentUserRole);
    const isOwnFile = sanitizedKey.startsWith(`users/${currentUserId}/`) ||
                     sanitizedKey.startsWith(`listings/`) ||
                     sanitizedKey.startsWith(`organizations/`) ||
                     sanitizedKey.startsWith(`disputes/`) ||
                     sanitizedKey.startsWith(`insurance/`) ||
                     sanitizedKey.startsWith(`condition-reports/`);
    
    // For listing/organization/dispute files, verify ownership through database
    if (!isAdmin && !sanitizedKey.startsWith(`users/${currentUserId}/`)) {
      if (sanitizedKey.startsWith('listings/')) {
        const listingId = sanitizedKey.split('/')[1];
        const listing = await this.prisma.listing.findUnique({
          where: { id: listingId },
          select: { ownerId: true, organizationId: true },
        });
        
        // Use organization scope resolver for authorization
        await this.organizationScopeService.requireScope(currentUserId, 'USER', {
          resourceType: 'listing',
          resourceId: listingId,
          ownerId: listing?.ownerId,
          organizationId: listing?.organizationId,
        });
      } else if (sanitizedKey.startsWith('organizations/')) {
        const orgId = sanitizedKey.split('/')[1];
        const member = await this.prisma.organizationMember.findFirst({
          where: {
            organizationId: orgId,
            userId: currentUserId,
            role: { in: ['OWNER', 'ADMIN'] as any[] },
          },
        });
        if (!member) {
          throw new ForbiddenException('You do not have permission to delete this file');
        }
      } else {
        throw new ForbiddenException('You do not have permission to delete this file');
      }
    }

    await this.storageService.deleteFile(sanitizedKey);

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId: currentUserId,
        action: 'FILE_DELETED',
        entityType: 'Storage',
        entityId: sanitizedKey,
        oldValues: JSON.stringify({ key: sanitizedKey }),
      },
    });

    return { status: 'deleted' };
  }

  @Get('list')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List files in S3 bucket' })
  @ApiResponse({ status: 200, description: 'Files listed successfully' })
  async listFiles(
    @Query() query: { prefix?: string; maxKeys?: number; continuationToken?: string },
    @CurrentUser('id') currentUserId: string,
  ) {
    if (query.prefix) {
      query.prefix = query.prefix.replace(/\.\./g, '').replace(/^\//, '');
    }

    const result = await this.storageService.listFiles(query);

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId: currentUserId,
        action: 'FILES_LISTED',
        entityType: 'Storage',
        entityId: query.prefix || 'root',
        newValues: JSON.stringify({ prefix: query.prefix, count: result.files.length }),
      },
    });

    return result;
  }

  @Post('listing-photos')
  @ApiOperation({ summary: 'Upload listing photos' })
  @ApiResponse({ status: 200, description: 'Listing photos uploaded successfully' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 10, {
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max per file
    fileFilter: (_req, file, cb) => {
      const allowed = /^(image\/(jpeg|png|gif|webp|svg\+xml))$/;
      if (!allowed.test(file.mimetype)) {
        return cb(new BadRequestException(`Only images are allowed for listing photos. Got '${file.mimetype}'`), false);
      }
      cb(null, true);
    },
  }))
  async uploadListingPhotos(
    @UploadedFiles() files: any[],
    @Body('listingId') listingId: string,
    @CurrentUser('id') currentUserId: string,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    const listing = await this.prisma.listing.findUnique({ 
      where: { id: listingId }, 
      select: { ownerId: true, organizationId: true } 
    });
    if (!listing) throw new NotFoundException('Listing not found');
    
    // Use organization scope resolver for authorization
    await this.organizationScopeService.requireScope(currentUserId, 'USER', {
      resourceType: 'listing',
      resourceId: listingId,
      ownerId: listing.ownerId,
      organizationId: listing.organizationId,
    });

    const fileData = files.map((file) => ({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    }));

    const results = await this.storageService.uploadListingPhotos(listingId, fileData);

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId: currentUserId,
        action: 'LISTING_PHOTOS_UPLOADED',
        entityType: 'Listing',
        entityId: listingId,
        newValues: JSON.stringify({ count: results.length, files: results.map(r => r.key) }),
      },
    });

    return results;
  }

  @Post('user-avatar')
  @ApiOperation({ summary: 'Upload user avatar' })
  @ApiResponse({ status: 200, description: 'User avatar uploaded successfully' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max for avatar
    fileFilter: (_req, file, cb) => {
      const allowed = /^(image\/(jpeg|png|gif|webp))$/;
      if (!allowed.test(file.mimetype)) {
        return cb(new BadRequestException(`Only images are allowed for avatars. Got '${file.mimetype}'`), false);
      }
      cb(null, true);
    },
  }))
  async uploadUserAvatar(
    @UploadedFile() file: any,
    @CurrentUser('id') userId: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const result = await this.storageService.uploadUserAvatar(userId, {
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    });

    // Update user profile with new avatar URL
    await this.prisma.user.update({
      where: { id: userId },
      data: { profilePhotoUrl: result.url },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'USER_AVATAR_UPDATED',
        entityType: 'User',
        entityId: userId,
        newValues: JSON.stringify({ avatarUrl: result.url }),
      },
    });

    return result;
  }

  @Post('organization-logo')
  @ApiOperation({ summary: 'Upload organization logo' })
  @ApiResponse({ status: 200, description: 'Organization logo uploaded successfully' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max for logo
    fileFilter: (_req, file, cb) => {
      const allowed = /^(image\/(jpeg|png|gif|webp|svg\+xml))$/;
      if (!allowed.test(file.mimetype)) {
        return cb(new BadRequestException(`Only images are allowed for logos. Got '${file.mimetype}'`), false);
      }
      cb(null, true);
    },
  }))
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

    const result = await this.storageService.uploadOrganizationLogo(organizationId, {
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    });

    // Update organization with new logo URL
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { logoUrl: result.url },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId: currentUserId,
        action: 'ORGANIZATION_LOGO_UPDATED',
        entityType: 'Organization',
        entityId: organizationId,
        newValues: JSON.stringify({ logoUrl: result.url }),
      },
    });

    return result;
  }

  @Get('statistics')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get file storage statistics' })
  @ApiResponse({ status: 200, description: 'Storage statistics retrieved successfully' })
  async getFileStatistics(@CurrentUser('id') currentUserId: string) {
    const stats = await this.storageService.getFileStatistics();

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId: currentUserId,
        action: 'STORAGE_STATISTICS_VIEWED',
        entityType: 'Storage',
        entityId: 'system',
        newValues: JSON.stringify(stats),
      },
    });

    return stats;
  }

  @Get('test')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Test S3 configuration' })
  @ApiResponse({ status: 200, description: 'S3 configuration test result' })
  async testS3Configuration(@CurrentUser('id') currentUserId: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException('Not Found');
    }
    const result = await this.storageService.testS3Configuration();

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId: currentUserId,
        action: 'STORAGE_TEST_EXECUTED',
        entityType: 'Storage',
        entityId: 'system',
        newValues: JSON.stringify(result),
      },
    });

    return result;
  }

  @Get('bucket-exists')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Check if bucket exists' })
  @ApiResponse({ status: 200, description: 'Bucket existence checked successfully' })
  async bucketExists(@CurrentUser('id') currentUserId: string) {
    const exists = await this.storageService.bucketExists();
    const bucketName = this.storageService['bucketName'];

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId: currentUserId,
        action: 'BUCKET_EXISTENCE_CHECKED',
        entityType: 'Storage',
        entityId: bucketName || 'local',
        newValues: JSON.stringify({ exists, bucketName }),
      },
    });

    return { exists, bucket: bucketName };
  }

  @Post('ensure-bucket')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Ensure bucket exists' })
  @ApiResponse({ status: 200, description: 'Bucket ensured successfully' })
  async ensureBucket(@CurrentUser('id') currentUserId: string) {
    await this.storageService.ensureBucket();
    const bucketName = this.storageService['bucketName'];

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId: currentUserId,
        action: 'BUCKET_ENSURED',
        entityType: 'Storage',
        entityId: bucketName || 'local',
        newValues: JSON.stringify({ bucketName }),
      },
    });

    return { status: 'bucket_ensured' };
  }
}
