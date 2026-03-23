import { ImageModerationService } from './image-moderation.service';

// Mock global fetch
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

describe('ImageModerationService', () => {
  let service: ImageModerationService;
  let configService: any;

  beforeEach(() => {
    configService = {
      get: jest.fn(),
    };

    service = new ImageModerationService(configService);
    mockFetch.mockReset();
  });

  describe('moderateImage', () => {
    it('should require manual review when automated moderation is disabled', async () => {
      configService.get.mockImplementation((key: string) =>
        key === 'FEATURE_IMAGE_MODERATION' ? 'false' : undefined,
      );

      const result = await service.moderateImage('https://example.com/image.jpg');

      expect(result).toBeDefined();
      expect(result.confidence).toBe(0);
      expect(result.flags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'PENDING_HUMAN_REVIEW',
          }),
        ]),
      );
    });

    it('should flag inaccessible images when automated moderation is enabled', async () => {
      configService.get.mockImplementation((key: string) =>
        key === 'FEATURE_IMAGE_MODERATION' ? 'true' : undefined,
      );
      mockFetch.mockResolvedValueOnce({ ok: false });

      const result = await service.moderateImage('https://bad-url.com/missing.jpg');

      expect(result).toBeDefined();
      expect(result.flags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'IMAGE_INACCESSIBLE' }),
        ]),
      );
      expect(result.confidence).toBe(0.5);
    });

    it('should handle network errors gracefully when automated moderation is enabled', async () => {
      configService.get.mockImplementation((key: string) =>
        key === 'FEATURE_IMAGE_MODERATION' ? 'true' : undefined,
      );
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.moderateImage('https://example.com/image.jpg');

      expect(result).toBeDefined();
      // checkImageAccessibility catches the fetch error internally and returns false
      // So the image is flagged as inaccessible rather than triggering MODERATION_ERROR
      const inaccessibleFlag = result.flags.find((f: any) =>
        f.type === 'IMAGE_INACCESSIBLE',
      );
      expect(inaccessibleFlag).toBeDefined();
      expect(result.confidence).toBe(0.5);
    });

    it('should return confidence 0.5 when no API result is available and automated moderation is enabled', async () => {
      configService.get.mockImplementation((key: string) =>
        key === 'FEATURE_IMAGE_MODERATION' ? 'true' : undefined,
      );
      mockFetch.mockResolvedValueOnce({ ok: true }); // HEAD success

      const result = await service.moderateImage('https://example.com/safe.jpg');

      // No moderation API result -> confidence 0.5
      expect(result.confidence).toBe(0.5);
    });
  });

  describe('moderateWithRekognition', () => {
    it('should return empty array (placeholder)', async () => {
      const result = await service.moderateWithRekognition('https://img.com/test.jpg');

      expect(result).toEqual([]);
    });
  });

  describe('moderateWithVision', () => {
    it('should return empty array (placeholder)', async () => {
      const result = await service.moderateWithVision('https://img.com/test.jpg');

      expect(result).toEqual([]);
    });
  });

  describe('detectFaces', () => {
    it('should return zero face count (placeholder)', async () => {
      const result = await service.detectFaces('https://img.com/face.jpg');

      expect(result.faceCount).toBe(0);
      expect(result.confidence).toBe(0);
    });
  });

  describe('detectTextInImage', () => {
    it('should return empty array (placeholder)', async () => {
      const result = await service.detectTextInImage('https://img.com/text.jpg');

      expect(result).toEqual([]);
    });
  });

  describe('checkImageQuality', () => {
    it('should return default quality assessment (placeholder)', async () => {
      const result = await service.checkImageQuality('https://img.com/quality.jpg');

      expect(result).toBeDefined();
      expect(result.resolution).toBeDefined();
    });
  });

  describe('checkImageAccessibility (via moderateImage)', () => {
    it('should call HEAD on image URL', async () => {
      configService.get.mockImplementation((key: string) =>
        key === 'FEATURE_IMAGE_MODERATION' ? 'true' : undefined,
      );
      mockFetch.mockResolvedValueOnce({ ok: true });

      await service.moderateImage('https://example.com/test.jpg');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/test.jpg',
        expect.objectContaining({ method: 'HEAD' }),
      );
    });

    it('should handle fetch rejection gracefully', async () => {
      configService.get.mockImplementation((key: string) =>
        key === 'FEATURE_IMAGE_MODERATION' ? 'true' : undefined,
      );
      mockFetch.mockRejectedValueOnce(new Error('DNS failure'));

      const result = await service.moderateImage('https://invalid.xyz/img.jpg');

      expect(result).toBeDefined();
    });
  });
});
