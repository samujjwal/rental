import { Test, TestingModule } from '@nestjs/testing';
import { ListingsService } from './listings.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CacheService } from '../../../common/cache/cache.service';
import { CategoryTemplateService } from '../../categories/services/category-template.service';
import { ListingValidationService } from './listing-validation.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

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
      prismaService.category.findUnique.mockResolvedValue({ id: 'cat-123', name: 'Test' });
      validationService.validateCategoryData.mockResolvedValue({ isValid: true });
      prismaService.listing.create.mockResolvedValue({ id: 'listing-123', ...mockDto });

      const result = await service.create(mockOwnerId, mockDto);

      expect(result).toBeDefined();
      expect(result.id).toBe('listing-123');
      expect(prismaService.listing.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException if category is invalid', async () => {
      prismaService.category.findUnique.mockResolvedValue(null);

      await expect(service.create(mockOwnerId, mockDto)).rejects.toThrow(BadRequestException);
    });
  });
});
