import { Test, TestingModule } from '@nestjs/testing';
import { ListingValidationService } from './listing-validation.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CategoryTemplateService } from '../../categories/services/category-template.service';

describe('ListingValidationService', () => {
  let service: InstanceType<typeof ListingValidationService>;
  let prismaService: any;
  let templateService: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingValidationService,
        {
          provide: PrismaService,
          useValue: {
            category: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: CategoryTemplateService,
          useValue: {
            getTemplate: jest.fn(),
            validateData: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<InstanceType<typeof ListingValidationService>>(ListingValidationService);
    prismaService = module.get(PrismaService);
    templateService = module.get(CategoryTemplateService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateCategoryData', () => {
    it('should validate valid data', async () => {
      const categoryId = 'cat-123';
      const data = { year: 2020 };

      prismaService.category.findUnique.mockResolvedValue({ id: categoryId, slug: 'vehicles' });
      templateService.getTemplate.mockReturnValue({
        fields: [{ key: 'year', required: true, type: 'number' }],
      });
      templateService.validateData.mockReturnValue({ isValid: true, errors: [] });

      const result = await service.validateCategoryData(categoryId, data);

      expect(result.isValid).toBe(true);
    });

    it('should return invalid if category not found', async () => {
      prismaService.category.findUnique.mockResolvedValue(null);

      const result = await service.validateCategoryData('bad-id', {});

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Category not found');
    });

    it('should return invalid if template not found', async () => {
      prismaService.category.findUnique.mockResolvedValue({ id: 'cat-1', slug: 'unknown' });
      templateService.getTemplate.mockReturnValue(null);

      const result = await service.validateCategoryData('cat-1', {});

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Category template not found');
    });
  });

  describe('validatePricingConfiguration', () => {
    it('should validate valid pricing config', () => {
      const result = service.validatePricingConfiguration({
        basePrice: 100,
      } as any);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject negative base price', () => {
      const result = service.validatePricingConfiguration({
        basePrice: -10,
      } as any);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Base price cannot be negative');
    });

    it('should require deposit amount when deposit is required', () => {
      const result = service.validatePricingConfiguration({
        basePrice: 100,
        requiresDeposit: true,
        depositAmount: null,
      } as any);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Deposit amount must be positive when deposit is required',
      );
    });

    it('should accept valid deposit configuration', () => {
      const result = service.validatePricingConfiguration({
        basePrice: 100,
        requiresDeposit: true,
        depositAmount: 200,
      } as any);

      expect(result.isValid).toBe(true);
    });
  });

  describe('validateBookingConfiguration', () => {
    it('should validate valid booking config', () => {
      const result = service.validateBookingConfiguration({
        minBookingHours: 2,
        maxBookingDays: 30,
      } as any);

      expect(result.isValid).toBe(true);
    });

    it('should reject min booking hours < 1', () => {
      const result = service.validateBookingConfiguration({
        minBookingHours: 0,
      } as any);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Minimum booking duration must be at least 1 hour',
      );
    });

    it('should reject max booking days < 1', () => {
      const result = service.validateBookingConfiguration({
        maxBookingDays: 0,
      } as any);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Maximum booking duration must be at least 1 day',
      );
    });

    it('should reject when min hours exceed max days in hours', () => {
      const result = service.validateBookingConfiguration({
        minBookingHours: 100,
        maxBookingDays: 2, // 48 hours
      } as any);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Minimum booking hours cannot exceed maximum booking days',
      );
    });

    it('should pass when min hours fit within max days', () => {
      const result = service.validateBookingConfiguration({
        minBookingHours: 24,
        maxBookingDays: 7, // 168 hours
      } as any);

      expect(result.isValid).toBe(true);
    });
  });

  describe('validatePropertyCompleteness', () => {
    const validListing = {
      title: 'A Great Rental Property',
      description: 'This is a long description that definitely exceeds the fifty character minimum requirement for descriptions.',
      address: '123 Main St',
      city: 'Anytown',
      country: 'US',
      photos: ['photo1.jpg'],
      basePrice: 100,
    };

    it('should validate a complete listing', () => {
      const result = service.validatePropertyCompleteness(validListing as any);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require title of at least 10 chars', () => {
      const result = service.validatePropertyCompleteness({
        ...validListing,
        title: 'Short',
      } as any);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Title must be at least 10 characters long');
    });

    it('should require description of at least 50 chars', () => {
      const result = service.validatePropertyCompleteness({
        ...validListing,
        description: 'Too short',
      } as any);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Description must be at least 50 characters long');
    });

    it('should require complete address', () => {
      const result = service.validatePropertyCompleteness({
        ...validListing,
        city: null,
      } as any);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Complete address information is required');
    });

    it('should require at least one photo', () => {
      const result = service.validatePropertyCompleteness({
        ...validListing,
        photos: [],
      } as any);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('At least one photo is required');
    });

    it('should require positive base price', () => {
      const result = service.validatePropertyCompleteness({
        ...validListing,
        basePrice: 0,
      } as any);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Base price must be greater than zero');
    });
  });

  describe('validatePhotoUrls', () => {
    it('should accept valid photos', () => {
      const result = service.validatePhotoUrls([
        { url: 'https://example.com/photo1.jpg', order: 0 },
        { url: 'https://example.com/photo2.jpg', order: 1 },
      ]);

      expect(result.isValid).toBe(true);
    });

    it('should reject empty photos array', () => {
      const result = service.validatePhotoUrls([]);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('At least one photo is required');
    });

    it('should reject invalid URL', () => {
      const result = service.validatePhotoUrls([
        { url: 'not-a-url', order: 0 },
      ]);

      expect(result.isValid).toBe(false);
    });

    it('should reject duplicate order values', () => {
      const result = service.validatePhotoUrls([
        { url: 'https://example.com/a.jpg', order: 0 },
        { url: 'https://example.com/b.jpg', order: 0 },
      ]);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Duplicate photo order: 0');
    });

    it('should reject negative order', () => {
      const result = service.validatePhotoUrls([
        { url: 'https://example.com/a.jpg', order: -1 },
      ]);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Photo order must be non-negative');
    });
  });
});
