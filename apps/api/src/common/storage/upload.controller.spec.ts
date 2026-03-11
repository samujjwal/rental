import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/* ── mock StorageService to avoid ESM uuid import ── */
const mockUpload = jest.fn();
const mockDelete = jest.fn();
const mockGetSignedUrl = jest.fn();

jest.mock('./storage.service', () => ({
  StorageService: jest.fn(),
}));

const storageService = {
  upload: mockUpload,
  delete: mockDelete,
  getSignedUrl: mockGetSignedUrl,
} as any;

import { UploadController } from './upload.controller';

const configService = {
  get: jest.fn((key: string) => {
    if (key === 'R2_ACCOUNT_ID') return 'acct-123';
    if (key === 'R2_BUCKET_NAME') return 'rental-bucket';
    return undefined;
  }),
} as unknown as ConfigService;

const controller = new UploadController(storageService, configService);

const makeFile = (overrides: Partial<{ mimetype: string; buffer: Buffer; originalname: string; size: number }> = {}) => ({
  mimetype: 'image/jpeg',
  buffer: Buffer.from('img'),
  originalname: 'photo.jpg',
  size: 1024,
  ...overrides,
});

describe('UploadController', () => {
  beforeEach(() => jest.clearAllMocks());

  /* ── uploadImage ── */

  describe('uploadImage', () => {
    it('uploads a valid image', async () => {
      mockUpload.mockResolvedValue({ url: 'https://r2/images/photo.jpg', key: 'images/photo.jpg', size: 1024 });
      const result = await controller.uploadImage(makeFile());
      expect(result).toEqual({
        url: 'https://r2/images/photo.jpg',
        key: 'images/photo.jpg',
        bucket: 'rental-bucket',
        size: 1024,
        mimeType: 'image/jpeg',
      });
      expect(mockUpload).toHaveBeenCalledWith(
        expect.objectContaining({ folder: 'images', mimeType: 'image/jpeg' }),
      );
    });

    it('throws when no file provided', async () => {
      await expect(controller.uploadImage(null as any)).rejects.toThrow(BadRequestException);
    });

    it('throws for non-image mimetype', async () => {
      await expect(controller.uploadImage(makeFile({ mimetype: 'application/pdf' }))).rejects.toThrow(
        'Invalid image type',
      );
    });
  });

  /* ── uploadImages ── */

  describe('uploadImages', () => {
    it('uploads multiple images', async () => {
      mockUpload.mockResolvedValue({ url: 'u', key: 'k', size: 512 });
      const result = await controller.uploadImages([makeFile(), makeFile()]);
      expect(result).toHaveLength(2);
      expect(mockUpload).toHaveBeenCalledTimes(2);
    });

    it('throws when files array is empty', async () => {
      await expect(controller.uploadImages([])).rejects.toThrow('No files provided');
    });

    it('throws when files is null', async () => {
      await expect(controller.uploadImages(null as any)).rejects.toThrow(BadRequestException);
    });

    it('rejects if any file has non-image mimetype', async () => {
      await expect(
        controller.uploadImages([makeFile(), makeFile({ mimetype: 'text/plain' })]),
      ).rejects.toThrow('Invalid image type');
    });
  });

  /* ── uploadDocument ── */

  describe('uploadDocument', () => {
    it('uploads a document', async () => {
      mockUpload.mockResolvedValue({ url: 'u', key: 'documents/f.pdf', size: 2048 });
      const result = await controller.uploadDocument(makeFile({ mimetype: 'application/pdf', originalname: 'f.pdf' }));
      expect(result.mimeType).toBe('application/pdf');
      expect(mockUpload).toHaveBeenCalledWith(expect.objectContaining({ folder: 'documents' }));
    });

    it('throws when no file', async () => {
      await expect(controller.uploadDocument(null as any)).rejects.toThrow('No file provided');
    });
  });

  /* ── deleteFile ── */

  describe('deleteFile', () => {
    it('returns success status', async () => {
      mockDelete.mockResolvedValue(true);
      const result = await controller.deleteFile('images/photo.jpg');
      expect(result).toEqual({ success: true });
    });
  });

  /* ── getSignedUrl ── */

  describe('getSignedUrl', () => {
    it('returns signed url', async () => {
      mockGetSignedUrl.mockResolvedValue('https://signed-url');
      const result = await controller.getSignedUrl('images/photo.jpg');
      expect(result).toEqual({ url: 'https://signed-url' });
    });
  });

  /* ── getPresignedUploadUrl ── */

  describe('getPresignedUploadUrl', () => {
    it('generates key with folder prefix and returns url', async () => {
      mockGetSignedUrl.mockResolvedValue('https://presigned');
      const result = await controller.getPresignedUploadUrl(
        { fileName: 'doc.pdf', mimeType: 'application/pdf' },
        'docs',
      );
      expect(result.url).toBe('https://presigned');
      expect(result.key).toContain('docs/');
      expect(result.key).toContain('doc.pdf');
    });

    it('defaults folder to uploads', async () => {
      mockGetSignedUrl.mockResolvedValue('https://u');
      const result = await controller.getPresignedUploadUrl(
        { fileName: 'file.txt', mimeType: 'text/plain' },
      );
      expect(result.key).toMatch(/^uploads\//);
    });
  });

  /* ── getBucketName (private, tested via response) ── */

  describe('bucket name resolution', () => {
    it('uses R2 bucket name when configured', async () => {
      mockUpload.mockResolvedValue({ url: 'u', key: 'k', size: 1 });
      const result = await controller.uploadImage(makeFile());
      expect(result.bucket).toBe('rental-bucket');
    });

    it('falls back to local when R2 not configured', async () => {
      const localConfig = {
        get: jest.fn(() => undefined),
      } as unknown as ConfigService;
      const localCtrl = new UploadController(storageService, localConfig);
      mockUpload.mockResolvedValue({ url: 'u', key: 'k', size: 1 });
      const result = await localCtrl.uploadImage(makeFile());
      expect(result.bucket).toBe('local');
    });
  });
});
