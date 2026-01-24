import { Test, TestingModule } from '@nestjs/testing';
import { ContentModerationService, ModerationStatus } from './content-moderation.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';
import { ImageModerationService } from './image-moderation.service';
import { TextModerationService } from './text-moderation.service';
import { ModerationQueueService } from './moderation-queue.service';

describe('ContentModerationService', () => {
  let service: ContentModerationService;
  let prismaService: jest.Mocked<PrismaService>;
  let cacheService: jest.Mocked<CacheService>;
  let imageModerationService: jest.Mocked<ImageModerationService>;
  let textModerationService: jest.Mocked<TextModerationService>;
  let moderationQueueService: jest.Mocked<ModerationQueueService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentModerationService,
        {
          provide: PrismaService,
          useValue: {
            moderationLog: {
              create: jest.fn(),
            },
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
          },
        },
        {
          provide: ImageModerationService,
          useValue: {
            moderateImage: jest.fn(),
          },
        },
        {
          provide: TextModerationService,
          useValue: {
            moderateText: jest.fn(),
          },
        },
        {
          provide: ModerationQueueService,
          useValue: {
            addToQueue: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ContentModerationService>(ContentModerationService);
    prismaService = module.get(PrismaService);
    cacheService = module.get(CacheService);
    imageModerationService = module.get(ImageModerationService);
    textModerationService = module.get(TextModerationService);
    moderationQueueService = module.get(ModerationQueueService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('moderateListing', () => {
    const mockListingData = {
      title: 'Test Listing',
      description: 'This is a test description',
      photos: ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'],
      userId: 'user-123',
    };

    it('should approve clean content', async () => {
      textModerationService.moderateText.mockResolvedValue({
        flags: [],
        confidence: 1,
      });

      imageModerationService.moderateImage.mockResolvedValue({
        flags: [],
        confidence: 1,
      });

      const result = await service.moderateListing(mockListingData);

      expect(result.status).toBe(ModerationStatus.APPROVED);
      expect(result.requiresHumanReview).toBe(false);
      expect(result.flags).toHaveLength(0);
      expect(result.confidence).toBe(1);
    });

    it('should reject content with critical flags', async () => {
      const criticalFlag = {
        type: 'EXPLICIT_CONTENT',
        severity: 'CRITICAL' as const,
        confidence: 0.95,
        description: 'Explicit content detected',
      };

      textModerationService.moderateText.mockResolvedValue({
        flags: [criticalFlag],
        confidence: 0.95,
      });

      imageModerationService.moderateImage.mockResolvedValue({
        flags: [],
        confidence: 1,
      });

      const result = await service.moderateListing(mockListingData);

      expect(result.status).toBe(ModerationStatus.REJECTED);
      expect(result.flags).toContainEqual(criticalFlag);
      expect(result.blockedReasons).toBeDefined();
      expect(result.blockedReasons).toContain('Explicit content detected');
    });

    it('should flag content with high severity flags for human review', async () => {
      const highFlag = {
        type: 'SUSPICIOUS_CONTENT',
        severity: 'HIGH' as const,
        confidence: 0.85,
        description: 'Suspicious content detected',
      };

      textModerationService.moderateText.mockResolvedValue({
        flags: [highFlag],
        confidence: 0.85,
      });

      imageModerationService.moderateImage.mockResolvedValue({
        flags: [],
        confidence: 1,
      });

      const result = await service.moderateListing(mockListingData);

      expect(result.status).toBe(ModerationStatus.FLAGGED);
      expect(result.requiresHumanReview).toBe(true);
      expect(moderationQueueService.addToQueue).toHaveBeenCalledWith({
        entityType: 'LISTING',
        entityId: mockListingData.userId,
        flags: [highFlag],
        priority: 'MEDIUM',
      });
    });

    it('should flag content with multiple low/medium flags', async () => {
      const flags = [
        {
          type: 'SPAM',
          severity: 'LOW' as const,
          confidence: 0.6,
          description: 'Possible spam',
        },
        {
          type: 'MISLEADING',
          severity: 'MEDIUM' as const,
          confidence: 0.7,
          description: 'Misleading information',
        },
        {
          type: 'INAPPROPRIATE',
          severity: 'LOW' as const,
          confidence: 0.5,
          description: 'Inappropriate content',
        },
        {
          type: 'QUALITY',
          severity: 'LOW' as const,
          confidence: 0.65,
          description: 'Low quality content',
        },
      ];

      textModerationService.moderateText.mockResolvedValue({
        flags: flags.slice(0, 2),
        confidence: 0.65,
      });

      imageModerationService.moderateImage
        .mockResolvedValueOnce({
          flags: [flags[2]],
          confidence: 0.5,
        })
        .mockResolvedValueOnce({
          flags: [flags[3]],
          confidence: 0.65,
        });

      const result = await service.moderateListing(mockListingData);

      expect(result.status).toBe(ModerationStatus.FLAGGED);
      expect(result.requiresHumanReview).toBe(true);
      expect(result.flags.length).toBeGreaterThan(3);
    });

    it('should moderate each image independently', async () => {
      textModerationService.moderateText.mockResolvedValue({
        flags: [],
        confidence: 1,
      });

      const imageFlag = {
        type: 'LOW_QUALITY',
        severity: 'LOW' as const,
        confidence: 0.6,
        description: 'Low quality image',
      };

      imageModerationService.moderateImage
        .mockResolvedValueOnce({
          flags: [],
          confidence: 1,
        })
        .mockResolvedValueOnce({
          flags: [imageFlag],
          confidence: 0.6,
        });

      await service.moderateListing(mockListingData);

      expect(imageModerationService.moderateImage).toHaveBeenCalledTimes(2);
      expect(imageModerationService.moderateImage).toHaveBeenCalledWith(
        'https://example.com/photo1.jpg',
      );
      expect(imageModerationService.moderateImage).toHaveBeenCalledWith(
        'https://example.com/photo2.jpg',
      );
    });

    it('should handle moderation service errors gracefully', async () => {
      textModerationService.moderateText.mockRejectedValue(
        new Error('Moderation API error'),
      );

      const result = await service.moderateListing(mockListingData);

      expect(result.status).toBe(ModerationStatus.PENDING);
      expect(result.requiresHumanReview).toBe(true);
      expect(result.confidence).toBe(0);
      expect(result.flags).toHaveLength(1);
      expect(result.flags[0].type).toBe('MODERATION_ERROR');
    });

    it('should calculate average confidence correctly', async () => {
      textModerationService.moderateText.mockResolvedValue({
        flags: [
          {
            type: 'TEST',
            severity: 'LOW' as const,
            confidence: 0.8,
            description: 'Test',
          },
        ],
        confidence: 0.8,
      });

      imageModerationService.moderateImage
        .mockResolvedValueOnce({
          flags: [
            {
              type: 'TEST',
              severity: 'LOW' as const,
              confidence: 0.6,
              description: 'Test',
            },
          ],
          confidence: 0.6,
        })
        .mockResolvedValueOnce({
          flags: [],
          confidence: 1,
        });

      const result = await service.moderateListing(mockListingData);

      // (0.8 + 0.6) / 2 = 0.7
      expect(result.confidence).toBe(0.7);
    });
  });

  describe('moderateProfile', () => {
    it('should approve clean profile', async () => {
      const profileData = {
        bio: 'I love renting things',
        profilePhotoUrl: 'https://example.com/profile.jpg',
        userId: 'user-123',
      };

      textModerationService.moderateText.mockResolvedValue({
        flags: [],
        confidence: 1,
      });

      imageModerationService.moderateImage.mockResolvedValue({
        flags: [],
        confidence: 1,
      });

      const result = await service.moderateProfile(profileData);

      expect(result.status).toBe(ModerationStatus.APPROVED);
      expect(result.requiresHumanReview).toBe(false);
    });

    it('should handle profiles without bio', async () => {
      const profileData = {
        profilePhotoUrl: 'https://example.com/profile.jpg',
        userId: 'user-123',
      };

      imageModerationService.moderateImage.mockResolvedValue({
        flags: [],
        confidence: 1,
      });

      const result = await service.moderateProfile(profileData);

      expect(result.status).toBe(ModerationStatus.APPROVED);
      expect(textModerationService.moderateText).not.toHaveBeenCalled();
    });

    it('should handle profiles without photo', async () => {
      const profileData = {
        bio: 'I love renting things',
        userId: 'user-123',
      };

      textModerationService.moderateText.mockResolvedValue({
        flags: [],
        confidence: 1,
      });

      const result = await service.moderateProfile(profileData);

      expect(result.status).toBe(ModerationStatus.APPROVED);
      expect(imageModerationService.moderateImage).not.toHaveBeenCalled();
    });
  });

  describe('moderateMessage', () => {
    it('should approve clean messages', async () => {
      textModerationService.moderateText.mockResolvedValue({
        flags: [],
        confidence: 1,
      });

      const result = await service.moderateMessage({
        content: 'Hello, is this item still available?',
        senderId: 'user-123',
        recipientId: 'user-456',
      });

      expect(result.status).toBe(ModerationStatus.APPROVED);
      expect(result.requiresHumanReview).toBe(false);
    });

    it('should reject messages with critical flags immediately', async () => {
      const criticalFlag = {
        type: 'HARASSMENT',
        severity: 'CRITICAL' as const,
        confidence: 0.95,
        description: 'Harassment detected',
      };

      textModerationService.moderateText.mockResolvedValue({
        flags: [criticalFlag],
        confidence: 0.95,
      });

      const result = await service.moderateMessage({
        content: 'Offensive message content',
        senderId: 'user-123',
        recipientId: 'user-456',
      });

      expect(result.status).toBe(ModerationStatus.REJECTED);
      expect(result.blockedReasons).toContain('Harassment detected');
    });
  });

  describe('moderateReview', () => {
    it('should approve legitimate reviews', async () => {
      textModerationService.moderateText.mockResolvedValue({
        flags: [],
        confidence: 1,
      });

      const result = await service.moderateReview({
        content: 'Great item, arrived on time!',
        rating: 5,
        userId: 'user-123',
        listingId: 'listing-456',
      });

      expect(result.status).toBe(ModerationStatus.APPROVED);
    });

    it('should detect review bombing patterns', async () => {
      textModerationService.moderateText.mockResolvedValue({
        flags: [],
        confidence: 1,
      });

      cacheService.get.mockResolvedValue(5); // 5 reviews in short time

      const result = await service.moderateReview({
        content: 'Bad experience',
        rating: 1,
        userId: 'user-123',
        listingId: 'listing-456',
      });

      expect(result.requiresHumanReview).toBe(true);
      expect(result.flags.some((f) => f.type === 'REVIEW_BOMBING')).toBe(true);
    });
  });
});
