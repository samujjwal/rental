import { Test, TestingModule } from '@nestjs/testing';
import { ClothingSizeValidationService } from './clothing-size-validation.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';

/**
 * Clothing Size Validation Service - Production-Grade Business Logic Tests
 * 
 * These tests validate exact business logic computations and invariants:
 * - Size validation
 * - Measurement range validation
 * - Size recommendation algorithms
 * - Size conversion between systems
 * - Listing attribute validation
 */
describe('ClothingSizeValidationService - Business Logic Validation', () => {
  let service: ClothingSizeValidationService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const mockPrismaService = {
      categoryAttributeDefinition: {
        findMany: jest.fn(),
      },
      listingAttributeValue: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClothingSizeValidationService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ClothingSizeValidationService>(ClothingSizeValidationService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('SIZE VALIDATION', () => {
    it('should accept all standard sizes', () => {
      const standardSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

      for (const size of standardSizes) {
        const result = service.validateSize(size);
        expect(result.valid).toBe(true);
      }
    });

    it('should accept lowercase sizes', () => {
      const lowercaseSizes = ['xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl'];

      for (const size of lowercaseSizes) {
        const result = service.validateSize(size);
        expect(result.valid).toBe(true);
      }
    });

    it('should reject invalid sizes', () => {
      const invalidSizes = ['XXS', 'XXXXL', 'SM', 'MD', 'LG', '1', '2', 'A', 'B', ''];

      for (const size of invalidSizes) {
        const result = service.validateSize(size);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('MEASUREMENT VALIDATION', () => {
    it('should validate chest measurement within size range', () => {
      const result = service.validateMeasurementsForSize('M', {
        chest: 38, // Within M range (37-40)
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject chest measurement outside size range', () => {
      const result = service.validateMeasurementsForSize('M', {
        chest: 45, // Outside M range (37-40)
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Chest');
    });

    it('should validate waist measurement within size range', () => {
      const result = service.validateMeasurementsForSize('L', {
        waist: 36, // Within L range (35-39)
      });

      expect(result.valid).toBe(true);
    });

    it('should reject waist measurement outside size range', () => {
      const result = service.validateMeasurementsForSize('L', {
        waist: 30, // Outside L range (35-39)
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Waist');
    });

    it('should validate hips measurement within size range', () => {
      const result = service.validateMeasurementsForSize('XL', {
        hips: 48, // Within XL range (46-50)
      });

      expect(result.valid).toBe(true);
    });

    it('should reject hips measurement outside size range', () => {
      const result = service.validateMeasurementsForSize('XL', {
        hips: 55, // Outside XL range (46-50)
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Hips');
    });

    it('should validate multiple measurements simultaneously', () => {
      const result = service.validateMeasurementsForSize('M', {
        chest: 38, // Within M range
        waist: 33, // Within M range
        hips: 41, // Within M range
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should collect all measurement errors', () => {
      const result = service.validateMeasurementsForSize('M', {
        chest: 50, // Outside M range
        waist: 20, // Outside M range
        hips: 60, // Outside M range
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3);
    });

    it('should handle missing measurements gracefully', () => {
      const result = service.validateMeasurementsForSize('M', {
        // No measurements provided
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate boundary values', () => {
      // Test M size boundaries: chest [37-40], waist [32-35], hips [40-43]
      const boundaryTests = [
        { chest: 37, waist: 32, hips: 40 }, // Lower boundaries
        { chest: 40, waist: 35, hips: 43 }, // Upper boundaries
      ];

      for (const measurements of boundaryTests) {
        const result = service.validateMeasurementsForSize('M', measurements);
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('SIZE RECOMMENDATION', () => {
    it('should recommend M size for medium measurements', () => {
      const result = service.recommendSize({
        chest: 38,
        waist: 33,
        hips: 41,
      });

      expect(result.recommendedSize).toBe('M');
      expect(result.confidence).toBe(100);
    });

    it('should recommend S size for small measurements', () => {
      const result = service.recommendSize({
        chest: 35,
        waist: 29,
        hips: 38,
      });

      expect(result.recommendedSize).toBe('S');
      expect(result.confidence).toBe(100);
    });

    it('should recommend L size for large measurements', () => {
      const result = service.recommendSize({
        chest: 41,
        waist: 36,
        hips: 44,
      });

      expect(result.recommendedSize).toBe('L');
      expect(result.confidence).toBe(100);
    });

    it('should recommend based on partial measurements', () => {
      const result = service.recommendSize({
        chest: 38,
        // Only chest provided
      });

      expect(result.recommendedSize).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle edge case measurements', () => {
      const result = service.recommendSize({
        chest: 36.5, // Between S and M
        waist: 31.5, // Between S and M
      });

      expect(result.recommendedSize).toBeDefined();
      expect(result.confidence).toBeLessThan(100);
    });

    it('should default to M when no measurements provided', () => {
      const result = service.recommendSize({});

      expect(result.recommendedSize).toBe('M');
      expect(result.confidence).toBe(0);
    });

    it('should include details in recommendation', () => {
      const result = service.recommendSize({
        chest: 38,
        waist: 33,
        hips: 41,
      });

      expect(result.details).toBeDefined();
      expect(result.details).toContain('Chest');
      expect(result.details).toContain('Waist');
      expect(result.details).toContain('Hips');
    });
  });

  describe('SIZE CONVERSION', () => {
    it('should convert US to EU', () => {
      const conversions = [
        { us: 'XS', eu: '34' },
        { us: 'S', eu: '36' },
        { us: 'M', eu: '38' },
        { us: 'L', eu: '40' },
        { us: 'XL', eu: '42' },
      ];

      for (const { us, eu } of conversions) {
        const result = service.convertSize(us, 'US', 'EU');
        expect(result).toBe(eu);
      }
    });

    it('should convert US to UK', () => {
      const conversions = [
        { us: 'XS', uk: '6' },
        { us: 'S', uk: '8' },
        { us: 'M', uk: '10' },
        { us: 'L', uk: '12' },
        { us: 'XL', uk: '14' },
      ];

      for (const { us, uk } of conversions) {
        const result = service.convertSize(us, 'US', 'UK');
        expect(result).toBe(uk);
      }
    });

    it('should convert EU to US', () => {
      const conversions = [
        { eu: '34', us: 'XS' },
        { eu: '36', us: 'S' },
        { eu: '38', us: 'M' },
        { eu: '40', us: 'L' },
        { eu: '42', us: 'XL' },
      ];

      for (const { eu, us } of conversions) {
        const result = service.convertSize(eu, 'EU', 'US');
        expect(result).toBe(us);
      }
    });

    it('should convert UK to US', () => {
      const conversions = [
        { uk: '6', us: 'XS' },
        { uk: '8', us: 'S' },
        { uk: '10', us: 'M' },
        { uk: '12', us: 'L' },
        { uk: '14', us: 'XL' },
      ];

      for (const { uk, us } of conversions) {
        const result = service.convertSize(uk, 'UK', 'US');
        expect(result).toBe(us);
      }
    });

    it('should handle case-insensitive input', () => {
      const result = service.convertSize('xs', 'US', 'EU');
      expect(result).toBe('34');
    });

    it('should reject invalid size for conversion', () => {
      expect(() => service.convertSize('INVALID', 'US', 'EU')).toThrow(BadRequestException);
    });

    it('should convert EU to UK', () => {
      // EU 38 -> US M -> UK 10
      const result = service.convertSize('38', 'EU', 'UK');
      expect(result).toBe('10');
    });
  });

  describe('LISTING ATTRIBUTE VALIDATION', () => {
    it('should return valid when no size attribute exists', async () => {
      (prisma.categoryAttributeDefinition.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.validateListingSizeAttributes('listing-1');

      expect(result.valid).toBe(true);
      expect(result.hasSizeAttribute).toBe(false);
      expect(result.availableSizes).toEqual([]);
    });

    it('should validate listing size attributes', async () => {
      (prisma.categoryAttributeDefinition.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'attr-1',
          slug: 'size',
          category: { slug: 'clothing' },
        },
      ]);

      (prisma.listingAttributeValue.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'val-1',
          value: 'S',
          attributeDefinition: { slug: 'size' },
        },
        {
          id: 'val-2',
          value: 'M',
          attributeDefinition: { slug: 'size' },
        },
        {
          id: 'val-3',
          value: 'L',
          attributeDefinition: { slug: 'size' },
        },
      ]);

      const result = await service.validateListingSizeAttributes('listing-1');

      expect(result.valid).toBe(true);
      expect(result.hasSizeAttribute).toBe(true);
      expect(result.availableSizes).toEqual(['S', 'M', 'L']);
    });

    it('should detect invalid sizes in listing', async () => {
      (prisma.categoryAttributeDefinition.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'attr-1',
          slug: 'size',
          category: { slug: 'clothing' },
        },
      ]);

      (prisma.listingAttributeValue.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'val-1',
          value: 'S',
          attributeDefinition: { slug: 'size' },
        },
        {
          id: 'val-2',
          value: 'INVALID',
          attributeDefinition: { slug: 'size' },
        },
      ]);

      const result = await service.validateListingSizeAttributes('listing-1');

      expect(result.valid).toBe(false);
      expect(result.hasSizeAttribute).toBe(true);
      expect(result.availableSizes).toContain('INVALID');
    });
  });
});
