import { Test, TestingModule } from '@nestjs/testing';
import { ListingsService } from './listings.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CacheService } from '../../../common/cache/cache.service';
import { CategoryTemplateService } from '../../categories/services/category-template.service';
import { ListingValidationService } from './listing-validation.service';
import { ContentModerationService } from '../../moderation/services/content-moderation.service';
import { EmbeddingService } from '../../ai/services/embedding.service';
import { ListingVersionService } from './listing-version.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  PropertyStatus,
  VerificationStatus,
} from '@rental-portal/database';

describe('ListingsService', () => {
  let service: InstanceType<typeof ListingsService>;
  let prismaService: any;
  let cacheService: any;
  let templateService: any;
  let validationService: InstanceType<typeof ListingValidationService> | any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingsService,
        {
          provide: PrismaService,
          useValue: {
            category: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
            },
            listing: {
              create: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
              count: jest.fn(),
            },
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
        {
          provide: CategoryTemplateService,
          useValue: {
            getTemplate: jest.fn(),
          },
        },
        {
          provide: ListingValidationService,
          useValue: {
            validateCategoryData: jest.fn(),
            validatePropertyCompleteness: jest
              .fn()
              .mockReturnValue({ isValid: true, errors: [] }),
          },
        },
        {
          provide: ContentModerationService,
          useValue: {
            moderateText: jest.fn().mockResolvedValue({ isApproved: true, flags: [] }),
            moderateImage: jest.fn().mockResolvedValue({ isApproved: true, flags: [] }),
            moderateListing: jest.fn().mockResolvedValue({ status: 'APPROVED', flags: [], confidence: 1 }),
          },
        },
        {
          provide: EmbeddingService,
          useValue: {
            updateListingEmbedding: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ListingVersionService,
          useValue: {
            createSnapshot: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<InstanceType<typeof ListingsService>>(ListingsService);
    prismaService = module.get(PrismaService);
    cacheService = module.get(CacheService);
    templateService = module.get(CategoryTemplateService);
    validationService = module.get(ListingValidationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const mockOwnerId = 'owner-123';
    const mockDto: any = {
      categoryId: 'cat-123',
      title: 'Test Listing',
      description: 'Test Description',
      pricingMode: 'PER_DAY',
      basePrice: 100,
      bookingMode: 'INSTANT_BOOKING',
      categorySpecificData: {},
    };

    it('should create a listing successfully', async () => {
      prismaService.category.findFirst.mockResolvedValue({ id: 'cat-123', name: 'Test' });
      validationService.validateCategoryData.mockResolvedValue({ isValid: true });
      prismaService.listing.create.mockResolvedValue({ id: 'listing-123', ...mockDto });

      const result = await service.create(mockOwnerId, mockDto);

      expect(result).toBeDefined();
      expect(result.id).toBe('listing-123');
      expect(prismaService.listing.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException if category is invalid', async () => {
      prismaService.category.findFirst.mockResolvedValue(null);

      await expect(service.create(mockOwnerId, mockDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('create — moderation fail-closed behavior', () => {
    const mockOwnerId = 'owner-123';
    const mockDto: any = {
      categoryId: 'cat-123',
      title: 'Test Listing',
      description: 'Test Description',
      pricingMode: 'PER_DAY',
      basePrice: 100,
      bookingMode: 'INSTANT_BOOKING',
      categorySpecificData: {},
    };

    beforeEach(() => {
      prismaService.category.findFirst.mockResolvedValue({ id: 'cat-123', name: 'Test' });
      validationService.validateCategoryData.mockResolvedValue({ isValid: true });
    });

    it('should block listing creation when moderation service is unavailable (fail-closed)', async () => {
      const moderationService = service['moderationService'] as any;
      moderationService.moderateListing.mockRejectedValueOnce(
        new Error('Moderation service unavailable'),
      );

      try {
        await service.create(mockOwnerId, mockDto);
        fail('Expected BadRequestException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BadRequestException);
        const response = error.getResponse();
        expect(response.code).toBe('MODERATION_SERVICE_UNAVAILABLE');
      }

      expect(prismaService.listing.create).not.toHaveBeenCalled();
    });

    it('should block listing when moderation explicitly rejects content', async () => {
      const moderationService = service['moderationService'] as any;
      moderationService.moderateListing.mockResolvedValueOnce({
        status: 'REJECTED',
        flags: [{ type: 'spam', description: 'Content is spam' }],
        confidence: 0.95,
      });

      await expect(service.create(mockOwnerId, mockDto)).rejects.toThrow(BadRequestException);
      expect(prismaService.listing.create).not.toHaveBeenCalled();
    });

    it('should block listing when moderation flags content', async () => {
      const moderationService = service['moderationService'] as any;
      moderationService.moderateListing.mockResolvedValueOnce({
        status: 'FLAGGED',
        flags: [{ type: 'inappropriate', description: 'Inappropriate language' }],
        confidence: 0.8,
      });

      await expect(service.create(mockOwnerId, mockDto)).rejects.toThrow(BadRequestException);
      expect(prismaService.listing.create).not.toHaveBeenCalled();
    });

    it('should allow listing when moderation approves', async () => {
      const moderationService = service['moderationService'] as any;
      moderationService.moderateListing.mockResolvedValueOnce({
        status: 'APPROVED',
        flags: [],
        confidence: 1,
      });
      prismaService.listing.create.mockResolvedValue({ id: 'listing-123', ...mockDto });

      const result = await service.create(mockOwnerId, mockDto);
      expect(result).toBeDefined();
    });
  });

  describe('publish', () => {
    const baseListing = {
      id: 'listing-123',
      ownerId: 'owner-123',
      title: 'Test Listing',
      description: 'Test Description',
      status: PropertyStatus.DRAFT,
      verificationStatus: VerificationStatus.PENDING,
      slug: 'test-listing',
      photos: [],
    };

    it('submits approved listings into review instead of making them immediately available', async () => {
      prismaService.listing.findUnique.mockResolvedValue(baseListing);
      prismaService.listing.update.mockResolvedValue({
        ...baseListing,
        status: PropertyStatus.UNAVAILABLE,
        verificationStatus: VerificationStatus.PENDING,
      });

      const result = await service.publish('listing-123', 'owner-123');

      expect(prismaService.listing.update).toHaveBeenCalledWith({
        where: { id: 'listing-123' },
        data: {
          status: PropertyStatus.UNAVAILABLE,
          verificationStatus: VerificationStatus.PENDING,
        },
      });
      expect(result.status).toBe(PropertyStatus.UNAVAILABLE);
      expect(result.verificationStatus).toBe(VerificationStatus.PENDING);
    });
  });

  describe('activate', () => {
    const pausedListing = {
      id: 'listing-123',
      ownerId: 'owner-123',
      title: 'Test Listing',
      description: 'Test Description',
      status: PropertyStatus.UNAVAILABLE,
      verificationStatus: VerificationStatus.VERIFIED,
      slug: 'test-listing',
      photos: [],
    };

    it('reactivates previously verified listings', async () => {
      prismaService.listing.findUnique.mockResolvedValue(pausedListing);
      prismaService.listing.update.mockResolvedValue({
        ...pausedListing,
        status: PropertyStatus.AVAILABLE,
      });

      const result = await service.activate('listing-123', 'owner-123');

      expect(prismaService.listing.update).toHaveBeenCalledWith({
        where: { id: 'listing-123' },
        data: { status: PropertyStatus.AVAILABLE },
      });
      expect(result.status).toBe(PropertyStatus.AVAILABLE);
    });

    it('blocks activation while a listing is still under review', async () => {
      prismaService.listing.findUnique.mockResolvedValue({
        ...pausedListing,
        verificationStatus: VerificationStatus.PENDING,
      });

      await expect(service.activate('listing-123', 'owner-123')).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaService.listing.update).not.toHaveBeenCalled();
    });
  });
});
