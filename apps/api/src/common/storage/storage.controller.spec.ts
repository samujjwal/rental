 
import { Logger, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { StorageController } from './storage.controller';

/* ── Mocks ── */

const mockUploadFile = jest.fn();
const mockGetUploadPresignedUrl = jest.fn();
const mockGetDownloadPresignedUrl = jest.fn();
const mockDeleteFile = jest.fn();
const mockListFiles = jest.fn();
const mockUploadListingPhotos = jest.fn();
const mockUploadUserAvatar = jest.fn();
const mockUploadOrganizationLogo = jest.fn();
const mockGetFileStatistics = jest.fn();
const mockTestS3Configuration = jest.fn();
const mockBucketExists = jest.fn();
const mockEnsureBucket = jest.fn();

const mockS3Service: any = {
  uploadFile: mockUploadFile,
  getUploadPresignedUrl: mockGetUploadPresignedUrl,
  getDownloadPresignedUrl: mockGetDownloadPresignedUrl,
  deleteFile: mockDeleteFile,
  listFiles: mockListFiles,
  uploadListingPhotos: mockUploadListingPhotos,
  uploadUserAvatar: mockUploadUserAvatar,
  uploadOrganizationLogo: mockUploadOrganizationLogo,
  getFileStatistics: mockGetFileStatistics,
  testS3Configuration: mockTestS3Configuration,
  bucketExists: mockBucketExists,
  ensureBucket: mockEnsureBucket,
  bucketName: 'test-bucket',
};

const mockPrismaService: any = {
  listing: {
    findUnique: jest.fn(),
  },
  organizationMember: {
    findFirst: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
  user: {
    update: jest.fn(),
  },
  organization: {
    update: jest.fn(),
  },
};

const mockOrganizationScopeService: any = {
  requireScope: jest.fn(),
};

let controller: StorageController;

beforeEach(() => {
  jest.clearAllMocks();
  controller = new StorageController(mockS3Service, mockPrismaService, mockOrganizationScopeService);
});

describe('StorageController', () => {
  /* ── uploadFile ── */
  describe('uploadFile', () => {
    it('uploads file with metadata and ownership check', async () => {
      const file = { buffer: Buffer.from('data'), mimetype: 'image/png', originalname: 'test.png', size: 100 };
      mockUploadFile.mockResolvedValue({ url: 'https://s3/test.png', key: 'users/user-123/test.png', size: 100 });
      mockPrismaService.auditLog.create.mockResolvedValue({});

      const result = await controller.uploadFile(file, 'users/user-123/test.png', 'user-123');

      expect(mockUploadFile).toHaveBeenCalledWith({
        key: 'users/user-123/test.png',
        body: file.buffer,
        contentType: 'image/png',
        metadata: {
          originalName: 'test.png',
          size: '100',
          uploadedBy: 'user-123',
          uploadTimestamp: expect.any(String),
        },
        acl: undefined,
      });
      expect(mockPrismaService.auditLog.create).toHaveBeenCalled();
      expect(result).toEqual({ url: 'https://s3/test.png', key: 'users/user-123/test.png', size: 100 });
    });

    it('throws when no file provided', async () => {
      await expect(controller.uploadFile(null, 'key', 'user-123')).rejects.toThrow('No file provided');
    });

    it('throws when key path is not scoped to user directory', async () => {
      const file = { buffer: Buffer.from('data'), mimetype: 'image/png', originalname: 'test.png', size: 100 };

      await expect(controller.uploadFile(file, 'public/test.png', 'user-123'))
        .rejects.toThrow(ForbiddenException);
    });

    it('prevents path traversal attacks', async () => {
      const file = { buffer: Buffer.from('data'), mimetype: 'image/png', originalname: 'test.png', size: 100 };

      await expect(controller.uploadFile(file, '../etc/passwd', 'user-123'))
        .rejects.toThrow(ForbiddenException);
    });

    it('allows uploads to scoped directories (disputes, insurance, condition-reports)', async () => {
      const file = { buffer: Buffer.from('data'), mimetype: 'image/png', originalname: 'evidence.png', size: 100 };
      mockUploadFile.mockResolvedValue({ url: 'https://s3/evidence.png', key: 'disputes/dispute-1/evidence.png', size: 100 });
      mockPrismaService.auditLog.create.mockResolvedValue({});

      const result = await controller.uploadFile(file, 'disputes/dispute-1/evidence.png', 'user-123');

      expect(mockUploadFile).toHaveBeenCalled();
      expect(result).toEqual({ url: 'https://s3/evidence.png', key: 'disputes/dispute-1/evidence.png', size: 100 });
    });
  });

  /* ── getUploadPresignedUrl ── */
  describe('getUploadPresignedUrl', () => {
    it('returns presigned URL with ownership check', async () => {
      mockGetUploadPresignedUrl.mockResolvedValue('https://presigned-upload');
      mockPrismaService.auditLog.create.mockResolvedValue({});

      const result = await controller.getUploadPresignedUrl({
        key: 'users/user-123/file.jpg',
        contentType: 'image/jpeg',
        expiresIn: 3600,
      }, 'user-123');

      expect(result).toEqual({ url: 'https://presigned-upload' });
      expect(mockPrismaService.auditLog.create).toHaveBeenCalled();
    });

    it('throws when key path is not scoped to user directory', async () => {
      await expect(controller.getUploadPresignedUrl({
        key: 'public/file.jpg',
        contentType: 'image/jpeg',
      }, 'user-123')).rejects.toThrow(ForbiddenException);
    });

    it('throws when content type is not allowed', async () => {
      await expect(controller.getUploadPresignedUrl({
        key: 'users/user-123/file.exe',
        contentType: 'application/exe',
      }, 'user-123')).rejects.toThrow(BadRequestException);
    });
  });

  /* ── getDownloadPresignedUrl ── */
  describe('getDownloadPresignedUrl', () => {
    it('returns presigned download URL for own files', async () => {
      mockGetDownloadPresignedUrl.mockResolvedValue('https://presigned-download');
      mockPrismaService.auditLog.create.mockResolvedValue({});

      const result = await controller.getDownloadPresignedUrl('users/user-123/file.jpg', 'user-123', 'USER');

      expect(result).toEqual({ url: 'https://presigned-download' });
      expect(mockPrismaService.auditLog.create).toHaveBeenCalled();
    });

    it('returns presigned download URL for admin users', async () => {
      mockGetDownloadPresignedUrl.mockResolvedValue('https://presigned-download');
      mockPrismaService.auditLog.create.mockResolvedValue({});

      const result = await controller.getDownloadPresignedUrl('users/different-user/file.jpg', 'user-123', 'ADMIN');

      expect(result).toEqual({ url: 'https://presigned-download' });
    });

    it('throws when user is not authorized to access file', async () => {
      await expect(controller.getDownloadPresignedUrl('users/different-user/file.jpg', 'user-123', 'USER'))
        .rejects.toThrow(ForbiddenException);
    });

    it('prevents path traversal in download URLs', async () => {
      await expect(controller.getDownloadPresignedUrl('../etc/passwd', 'user-123', 'USER'))
        .rejects.toThrow(ForbiddenException);
    });
  });

  /* ── deleteFile ── */
  describe('deleteFile', () => {
    it('deletes own file and returns status', async () => {
      mockDeleteFile.mockResolvedValue(undefined);
      mockPrismaService.auditLog.create.mockResolvedValue({});

      const result = await controller.deleteFile('users/user-123/old.jpg', 'user-123', 'USER');

      expect(mockDeleteFile).toHaveBeenCalledWith('users/user-123/old.jpg');
      expect(mockPrismaService.auditLog.create).toHaveBeenCalled();
      expect(result).toEqual({ status: 'deleted' });
    });

    it('deletes file as admin', async () => {
      mockDeleteFile.mockResolvedValue(undefined);
      mockPrismaService.auditLog.create.mockResolvedValue({});

      const result = await controller.deleteFile('users/different-user/old.jpg', 'user-123', 'ADMIN');

      expect(mockDeleteFile).toHaveBeenCalledWith('users/different-user/old.jpg');
      expect(result).toEqual({ status: 'deleted' });
    });

    it('throws when user is not authorized to delete file', async () => {
      await expect(controller.deleteFile('users/different-user/old.jpg', 'user-123', 'USER'))
        .rejects.toThrow(ForbiddenException);
    });

    it('verifies ownership for listing files through organization scope', async () => {
      mockPrismaService.listing.findUnique.mockResolvedValue({ ownerId: 'user-123', organizationId: null });
      mockOrganizationScopeService.requireScope.mockResolvedValue(undefined);
      mockDeleteFile.mockResolvedValue(undefined);
      mockPrismaService.auditLog.create.mockResolvedValue({});

      const result = await controller.deleteFile('listings/listing-1/photo.jpg', 'user-123', 'USER');

      expect(mockOrganizationScopeService.requireScope).toHaveBeenCalledWith('user-123', 'USER', {
        resourceType: 'listing',
        resourceId: 'listing-1',
        ownerId: 'user-123',
        organizationId: null,
      });
      expect(result).toEqual({ status: 'deleted' });
    });

    it('throws when user is not organization owner or admin for org files', async () => {
      mockPrismaService.organizationMember.findFirst.mockResolvedValue(null);

      await expect(controller.deleteFile('organizations/org-1/logo.jpg', 'user-123', 'USER'))
        .rejects.toThrow(ForbiddenException);
    });
  });

  /* ── uploadListingPhotos ── */
  describe('uploadListingPhotos', () => {
    it('uploads multiple listing photos with ownership verification', async () => {
      const files = [
        { buffer: Buffer.from('a'), originalname: 'a.jpg', mimetype: 'image/jpeg', size: 50 },
        { buffer: Buffer.from('b'), originalname: 'b.jpg', mimetype: 'image/jpeg', size: 60 },
      ];
      mockPrismaService.listing.findUnique.mockResolvedValue({ ownerId: 'user-1', organizationId: null });
      mockOrganizationScopeService.requireScope.mockResolvedValue(undefined);
      mockUploadListingPhotos.mockResolvedValue([{ url: 'url-a' }, { url: 'url-b' }]);
      mockPrismaService.auditLog.create.mockResolvedValue({});

      const result = await controller.uploadListingPhotos(files, 'listing-1', 'user-1');

      expect(mockOrganizationScopeService.requireScope).toHaveBeenCalledWith('user-1', 'USER', {
        resourceType: 'listing',
        resourceId: 'listing-1',
        ownerId: 'user-1',
        organizationId: null,
      });
      expect(mockUploadListingPhotos).toHaveBeenCalledWith('listing-1', [
        { buffer: files[0].buffer, originalName: 'a.jpg', mimeType: 'image/jpeg', size: 50 },
        { buffer: files[1].buffer, originalName: 'b.jpg', mimeType: 'image/jpeg', size: 60 },
      ]);
      expect(result).toHaveLength(2);
    });

    it('throws when no files provided', async () => {
      await expect(controller.uploadListingPhotos([], 'listing-1', 'user-1')).rejects.toThrow('No files provided');
    });

    it('throws when listing not found', async () => {
      const files = [{ buffer: Buffer.from('a'), originalname: 'a.jpg', mimetype: 'image/jpeg', size: 50 }];
      mockPrismaService.listing.findUnique.mockResolvedValue(null);

      await expect(controller.uploadListingPhotos(files, 'listing-1', 'user-1'))
        .rejects.toThrow(NotFoundException);
    });
  });

  /* ── uploadUserAvatar ── */
  describe('uploadUserAvatar', () => {
    it('uploads avatar for user', async () => {
      const file = { buffer: Buffer.from('avatar'), originalname: 'me.png', mimetype: 'image/png', size: 200 };
      mockUploadUserAvatar.mockResolvedValue({ url: 'https://s3/avatar.png' });
      mockPrismaService.user.update.mockResolvedValue({});
      mockPrismaService.auditLog.create.mockResolvedValue({});

      const result = await controller.uploadUserAvatar(file, 'user-1');

      expect(mockUploadUserAvatar).toHaveBeenCalledWith('user-1', {
        buffer: file.buffer,
        originalName: 'me.png',
        mimeType: 'image/png',
        size: 200,
      });
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { profilePhotoUrl: 'https://s3/avatar.png' },
      });
      expect(result).toEqual({ url: 'https://s3/avatar.png' });
    });

    it('throws when no file', async () => {
      await expect(controller.uploadUserAvatar(null, 'user-1')).rejects.toThrow('No file provided');
    });
  });

  /* ── uploadOrganizationLogo ── */
  describe('uploadOrganizationLogo', () => {
    it('uploads logo for organization owner', async () => {
      const file = { buffer: Buffer.from('logo'), originalname: 'logo.svg', mimetype: 'image/svg+xml', size: 300 };
      mockPrismaService.organizationMember.findFirst.mockResolvedValue({ userId: 'user-1', role: 'OWNER' });
      mockUploadOrganizationLogo.mockResolvedValue({ url: 'https://s3/logo.svg' });
      mockPrismaService.organization.update.mockResolvedValue({});
      mockPrismaService.auditLog.create.mockResolvedValue({});

      const result = await controller.uploadOrganizationLogo(file, 'org-1', 'user-1');

      expect(mockUploadOrganizationLogo).toHaveBeenCalledWith('org-1', {
        buffer: file.buffer,
        originalName: 'logo.svg',
        mimeType: 'image/svg+xml',
        size: 300,
      });
      expect(result).toEqual({ url: 'https://s3/logo.svg' });
    });

    it('throws when no file', async () => {
      await expect(controller.uploadOrganizationLogo(null, 'org-1', 'user-1')).rejects.toThrow('No file provided');
    });

    it('throws when user is not organization owner or admin', async () => {
      const file = { buffer: Buffer.from('logo'), originalname: 'logo.svg', mimetype: 'image/svg+xml', size: 300 };
      mockPrismaService.organizationMember.findFirst.mockResolvedValue(null);

      await expect(controller.uploadOrganizationLogo(file, 'org-1', 'user-1'))
        .rejects.toThrow(ForbiddenException);
    });
  });

  /* ── getFileStatistics ── */
  describe('getFileStatistics', () => {
    it('returns statistics with audit log', async () => {
      const stats = { totalFiles: 100, totalSize: 1024000 };
      mockGetFileStatistics.mockResolvedValue(stats);
      mockPrismaService.auditLog.create.mockResolvedValue({});

      const result = await controller.getFileStatistics('admin-1');

      expect(result).toEqual(stats);
      expect(mockPrismaService.auditLog.create).toHaveBeenCalled();
    });
  });

  /* ── testS3Configuration ── */
  describe('testS3Configuration', () => {
    it('returns test result in non-production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      mockTestS3Configuration.mockResolvedValue({ status: 'ok' });
      mockPrismaService.auditLog.create.mockResolvedValue({});

      const result = await controller.testS3Configuration('admin-1');

      expect(result).toEqual({ status: 'ok' });
      process.env.NODE_ENV = originalEnv;
    });

    it('throws in production environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      await expect(controller.testS3Configuration('admin-1'))
        .rejects.toThrow(NotFoundException);
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  /* ── bucketExists ── */
  describe('bucketExists', () => {
    it('returns exists status with bucket name', async () => {
      mockBucketExists.mockResolvedValue(true);
      mockPrismaService.auditLog.create.mockResolvedValue({});

      const result = await controller.bucketExists('admin-1');

      expect(result).toEqual({ exists: true, bucket: 'test-bucket' });
    });
  });

  /* ── ensureBucket ── */
  describe('ensureBucket', () => {
    it('ensures bucket and returns status', async () => {
      mockEnsureBucket.mockResolvedValue(undefined);
      mockPrismaService.auditLog.create.mockResolvedValue({});

      const result = await controller.ensureBucket('admin-1');

      expect(result).toEqual({ status: 'bucket_ensured' });
      expect(mockEnsureBucket).toHaveBeenCalled();
    });
  });
});
