 
import { Logger } from '@nestjs/common';
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
};

let controller: StorageController;

beforeEach(() => {
  jest.clearAllMocks();
  controller = new StorageController(mockS3Service, mockPrismaService);
});

describe('StorageController', () => {
  /* ── uploadFile ── */
  describe('uploadFile', () => {
    it('uploads file with metadata', async () => {
      const file = { buffer: Buffer.from('data'), mimetype: 'image/png', originalname: 'test.png', size: 100 };
      mockUploadFile.mockResolvedValue({ url: 'https://s3/test.png' });

      const result = await controller.uploadFile(file, 'uploads/test.png', 'public-read');

      expect(mockUploadFile).toHaveBeenCalledWith({
        key: 'uploads/test.png',
        body: file.buffer,
        contentType: 'image/png',
        metadata: { originalName: 'test.png', size: '100' },
        acl: 'public-read',
      });
      expect(result).toEqual({ url: 'https://s3/test.png' });
    });

    it('throws when no file provided', async () => {
      await expect(controller.uploadFile(null, 'key')).rejects.toThrow('No file provided');
    });
  });

  /* ── getUploadPresignedUrl ── */
  describe('getUploadPresignedUrl', () => {
    it('returns presigned URL', async () => {
      mockGetUploadPresignedUrl.mockResolvedValue('https://presigned-upload');

      const result = await controller.getUploadPresignedUrl({
        key: 'uploads/file.jpg',
        contentType: 'image/jpeg',
        expiresIn: 3600,
      });

      expect(result).toEqual({ url: 'https://presigned-upload' });
      expect(mockGetUploadPresignedUrl).toHaveBeenCalledWith({
        key: 'uploads/file.jpg',
        contentType: 'image/jpeg',
        expiresIn: 3600,
      });
    });
  });

  /* ── getDownloadPresignedUrl ── */
  describe('getDownloadPresignedUrl', () => {
    it('returns presigned download URL', async () => {
      mockGetDownloadPresignedUrl.mockResolvedValue('https://presigned-download');

      const result = await controller.getDownloadPresignedUrl('uploads/file.jpg', 7200);

      expect(result).toEqual({ url: 'https://presigned-download' });
    });
  });

  /* ── deleteFile ── */
  describe('deleteFile', () => {
    it('deletes file and returns status', async () => {
      mockDeleteFile.mockResolvedValue(undefined);

      const result = await controller.deleteFile('users/user-123/old.jpg', 'user-123', 'RENTER');

      expect(mockDeleteFile).toHaveBeenCalledWith('users/user-123/old.jpg');
      expect(result).toEqual({ status: 'deleted' });
    });
  });

  /* ── listFiles ── */
  describe('listFiles', () => {
    it('lists files with prefix filter', async () => {
      const files = [{ key: 'uploads/a.jpg' }, { key: 'uploads/b.jpg' }];
      mockListFiles.mockResolvedValue(files);

      const result = await controller.listFiles({ prefix: 'uploads/', maxKeys: 10 });

      expect(mockListFiles).toHaveBeenCalledWith({ prefix: 'uploads/', maxKeys: 10 });
      expect(result).toEqual(files);
    });
  });

  /* ── uploadListingPhotos ── */
  describe('uploadListingPhotos', () => {
    it('uploads multiple listing photos', async () => {
      const files = [
        { buffer: Buffer.from('a'), originalname: 'a.jpg', mimetype: 'image/jpeg', size: 50 },
        { buffer: Buffer.from('b'), originalname: 'b.jpg', mimetype: 'image/jpeg', size: 60 },
      ];
      mockPrismaService.listing.findUnique.mockResolvedValue({ ownerId: 'user-1' });
      mockUploadListingPhotos.mockResolvedValue([{ url: 'url-a' }, { url: 'url-b' }]);

      const result = await controller.uploadListingPhotos(files, 'listing-1', 'user-1');

      expect(mockUploadListingPhotos).toHaveBeenCalledWith('listing-1', [
        { buffer: files[0].buffer, originalName: 'a.jpg', mimeType: 'image/jpeg', size: 50 },
        { buffer: files[1].buffer, originalName: 'b.jpg', mimeType: 'image/jpeg', size: 60 },
      ]);
      expect(result).toHaveLength(2);
    });

    it('throws when no files provided', async () => {
      await expect(controller.uploadListingPhotos([], 'listing-1', 'user-1')).rejects.toThrow('No files provided');
    });

    it('throws when files is null', async () => {
      await expect(controller.uploadListingPhotos(null as any, 'listing-1', 'user-1')).rejects.toThrow('No files provided');
    });
  });

  /* ── uploadUserAvatar ── */
  describe('uploadUserAvatar', () => {
    it('uploads avatar for user', async () => {
      const file = { buffer: Buffer.from('avatar'), originalname: 'me.png', mimetype: 'image/png', size: 200 };
      mockUploadUserAvatar.mockResolvedValue({ url: 'https://s3/avatar.png' });

      const result = await controller.uploadUserAvatar(file, 'user-1');

      expect(mockUploadUserAvatar).toHaveBeenCalledWith('user-1', {
        buffer: file.buffer,
        originalName: 'me.png',
        mimeType: 'image/png',
        size: 200,
      });
      expect(result).toEqual({ url: 'https://s3/avatar.png' });
    });

    it('throws when no file', async () => {
      await expect(controller.uploadUserAvatar(null, 'user-1')).rejects.toThrow('No file provided');
    });
  });

  /* ── uploadOrganizationLogo ── */
  describe('uploadOrganizationLogo', () => {
    it('uploads logo for organization', async () => {
      const file = { buffer: Buffer.from('logo'), originalname: 'logo.svg', mimetype: 'image/svg+xml', size: 300 };
      mockPrismaService.organizationMember.findFirst.mockResolvedValue({ userId: 'user-1', role: 'OWNER' });
      mockUploadOrganizationLogo.mockResolvedValue({ url: 'https://s3/logo.svg' });

      const result = await controller.uploadOrganizationLogo(file, 'org-1', 'user-1');

      expect(mockUploadOrganizationLogo).toHaveBeenCalledWith('org-1', {
        buffer: file.buffer,
        originalName: 'logo.svg',
        mimeType: 'image/svg+xml',
        size: 300,
      });
    });

    it('throws when no file', async () => {
      await expect(controller.uploadOrganizationLogo(null, 'org-1', 'user-1')).rejects.toThrow('No file provided');
    });
  });

  /* ── getFileStatistics ── */
  describe('getFileStatistics', () => {
    it('returns statistics', async () => {
      const stats = { totalFiles: 100, totalSize: 1024000 };
      mockGetFileStatistics.mockResolvedValue(stats);

      const result = await controller.getFileStatistics();

      expect(result).toEqual(stats);
    });
  });

  /* ── testS3Configuration ── */
  describe('testS3Configuration', () => {
    it('returns test result', async () => {
      mockTestS3Configuration.mockResolvedValue({ status: 'ok' });

      const result = await controller.testS3Configuration();

      expect(result).toEqual({ status: 'ok' });
    });
  });

  /* ── bucketExists ── */
  describe('bucketExists', () => {
    it('returns exists status with bucket name', async () => {
      mockBucketExists.mockResolvedValue(true);

      const result = await controller.bucketExists();

      expect(result).toEqual({ exists: true, bucket: 'test-bucket' });
    });
  });

  /* ── ensureBucket ── */
  describe('ensureBucket', () => {
    it('ensures bucket and returns status', async () => {
      mockEnsureBucket.mockResolvedValue(undefined);

      const result = await controller.ensureBucket();

      expect(result).toEqual({ status: 'bucket_ensured' });
      expect(mockEnsureBucket).toHaveBeenCalled();
    });
  });
});
