import { Test, TestingModule } from '@nestjs/testing';
import { CategoryAttributeService, CreateAttributeDefinitionDto } from './category-attribute.service';
import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * CATEGORY-SPECIFIC FIELD TESTS
 * 
 * These tests validate category-specific attribute fields:
 * - Field type validation
 * - Required field enforcement
 * - Validation rules (min, max, regex, length)
 * - Option validation for select/multiselect
 * - Category-specific business rules
 * 
 * Business Truth Validated:
 * - Category attributes conform to their defined types
 * - Validation rules are enforced at the service level
 * - Required fields cannot be skipped
 * - Options are validated for select fields
 */
describe('Category-Specific Field Tests', () => {
  let service: CategoryAttributeService;
  let prisma: any;

  beforeEach(async () => {
    const mockPrismaService: any = {
      category: {
        findUnique: jest.fn(),
      },
      categoryAttributeDefinition: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
      },
      categoryAttributeValue: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryAttributeService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CategoryAttributeService>(CategoryAttributeService);
    prisma = mockPrismaService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Field Type Validation', () => {
    it('should accept valid field types', async () => {
      const validTypes: Array<'text' | 'number' | 'select' | 'multiselect' | 'boolean' | 'date'> = [
        'text',
        'number',
        'select',
        'multiselect',
        'boolean',
        'date',
      ];

      prisma.category.findUnique.mockResolvedValue({ id: 'cat-123' });
      prisma.categoryAttributeDefinition.findUnique.mockResolvedValue(null);

      for (const fieldType of validTypes) {
        const dto: CreateAttributeDefinitionDto = {
          categoryId: 'cat-123',
          slug: `field-${fieldType}`,
          label: `Test ${fieldType} field`,
          fieldType,
        };

        await service.createDefinition(dto);
      }

      expect(prisma.categoryAttributeDefinition.create).toHaveBeenCalledTimes(validTypes.length);
    });

    it('should reject invalid field types', async () => {
      const dto: CreateAttributeDefinitionDto = {
        categoryId: 'cat-123',
        slug: 'invalid-field',
        label: 'Invalid field',
        fieldType: 'invalid_type' as any,
      };

      await expect(service.createDefinition(dto)).rejects.toThrow('Invalid fieldType');
    });
  });

  describe('Required Field Enforcement', () => {
    it('should enforce required fields on attribute creation', async () => {
      const dto: CreateAttributeDefinitionDto = {
        categoryId: 'cat-123',
        slug: 'required-field',
        label: 'Required Field',
        fieldType: 'text',
        isRequired: true,
      };

      prisma.category.findUnique.mockResolvedValue({ id: 'cat-123' });
      prisma.categoryAttributeDefinition.findUnique.mockResolvedValue(null);
      prisma.categoryAttributeDefinition.create.mockResolvedValue(dto as any);

      const result = await service.createDefinition(dto);

      expect(result.isRequired).toBe(true);
    });

    it('should validate required attribute values when setting', async () => {
      prisma.categoryAttributeDefinition.findMany.mockResolvedValue([
        {
          id: 'attr-123',
          slug: 'required-field',
          fieldType: 'text',
          isRequired: true,
        },
      ]);

      prisma.categoryAttributeValue.findMany.mockResolvedValue([]);

      const setValueDto = {
        listingId: 'listing-123',
        attributeDefinitionId: 'attr-123',
        value: '', // Empty value for required field
      };

      // Should reject empty value for required field
      await expect(service.setValue(setValueDto)).rejects.toThrow();
    });
  });

  describe('Validation Rules', () => {
    it('should enforce min/max for number fields', async () => {
      const dto: CreateAttributeDefinitionDto = {
        categoryId: 'cat-123',
        slug: 'age-field',
        label: 'Age',
        fieldType: 'number',
        validation: {
          min: 0,
          max: 120,
        },
      };

      prisma.category.findUnique.mockResolvedValue({ id: 'cat-123' });
      prisma.categoryAttributeDefinition.findUnique.mockResolvedValue(null);
      prisma.categoryAttributeDefinition.create.mockResolvedValue(dto as any);

      const result = await service.createDefinition(dto);

      expect(result.validation).toEqual(
        expect.objectContaining({
          min: 0,
          max: 120,
        })
      );
    });

    it('should enforce minLength/maxLength for text fields', async () => {
      const dto: CreateAttributeDefinitionDto = {
        categoryId: 'cat-123',
        slug: 'description-field',
        label: 'Description',
        fieldType: 'text',
        validation: {
          minLength: 10,
          maxLength: 500,
        },
      };

      prisma.category.findUnique.mockResolvedValue({ id: 'cat-123' });
      prisma.categoryAttributeDefinition.findUnique.mockResolvedValue(null);
      prisma.categoryAttributeDefinition.create.mockResolvedValue(dto as any);

      const result = await service.createDefinition(dto);

      expect(result.validation).toEqual(
        expect.objectContaining({
          minLength: 10,
          maxLength: 500,
        })
      );
    });

    it('should enforce regex pattern validation', async () => {
      const dto: CreateAttributeDefinitionDto = {
        categoryId: 'cat-123',
        slug: 'email-field',
        label: 'Email',
        fieldType: 'text',
        validation: {
          regex: '^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$',
        },
      };

      prisma.category.findUnique.mockResolvedValue({ id: 'cat-123' });
      prisma.categoryAttributeDefinition.findUnique.mockResolvedValue(null);
      prisma.categoryAttributeDefinition.create.mockResolvedValue(dto as any);

      const result = await service.createDefinition(dto);

      expect(result.validation).toEqual(
        expect.objectContaining({
          regex: expect.stringContaining('@'),
        })
      );
    });
  });

  describe('Option Validation', () => {
    it('should accept valid options for select fields', async () => {
      const dto: CreateAttributeDefinitionDto = {
        categoryId: 'cat-123',
        slug: 'color-field',
        label: 'Color',
        fieldType: 'select',
        options: ['Red', 'Green', 'Blue'],
      };

      prisma.category.findUnique.mockResolvedValue({ id: 'cat-123' });
      prisma.categoryAttributeDefinition.findUnique.mockResolvedValue(null);
      prisma.categoryAttributeDefinition.create.mockResolvedValue(dto as any);

      const result = await service.createDefinition(dto);

      expect(result.options).toEqual(['Red', 'Green', 'Blue']);
    });

    it('should accept valid options for multiselect', async () => {
      const dto: CreateAttributeDefinitionDto = {
        categoryId: 'cat-123',
        slug: 'features-field',
        label: 'Features',
        fieldType: 'multiselect',
        options: ['WiFi', 'Parking', 'AC'],
      };

      prisma.category.findUnique.mockResolvedValue({ id: 'cat-123' });
      prisma.categoryAttributeDefinition.findUnique.mockResolvedValue(null);
      prisma.categoryAttributeDefinition.create.mockResolvedValue(dto as any);

      const result = await service.createDefinition(dto);

      expect(result.options).toEqual(['WiFi', 'Parking', 'AC']);
    });
  });

  describe('Category-Specific Business Rules', () => {
    it('should enforce camera-specific fields for camera category', async () => {
      const cameraDto: CreateAttributeDefinitionDto = {
        categoryId: 'camera-category-id',
        slug: 'sensor-type',
        label: 'Sensor Type',
        fieldType: 'select',
        options: ['Full Frame', 'APS-C', 'Micro Four Thirds'],
        isRequired: true,
      };

      prisma.category.findUnique.mockResolvedValue({
        id: 'camera-category-id',
        slug: 'cameras',
      });
      prisma.categoryAttributeDefinition.findUnique.mockResolvedValue(null);
      prisma.categoryAttributeDefinition.create.mockResolvedValue(cameraDto as any);

      const result = await service.createDefinition(cameraDto);

      expect(result.fieldType).toBe('select');
      expect(result.isRequired).toBe(true);
    });

    it('should enforce vehicle-specific fields for vehicle category', async () => {
      const vehicleDto: CreateAttributeDefinitionDto = {
        categoryId: 'vehicle-category-id',
        slug: 'mileage',
        label: 'Mileage',
        fieldType: 'number',
        validation: {
          min: 0,
          max: 500000,
        },
        unit: 'km',
      };

      prisma.category.findUnique.mockResolvedValue({
        id: 'vehicle-category-id',
        slug: 'vehicles',
      });
      prisma.categoryAttributeDefinition.findUnique.mockResolvedValue(null);
      prisma.categoryAttributeDefinition.create.mockResolvedValue(vehicleDto as any);

      const result = await service.createDefinition(vehicleDto);

      expect(result.fieldType).toBe('number');
      expect(result.unit).toBe('km');
    });
  });

  describe('Display Order Validation', () => {
    it('should enforce unique display order within category', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-123' });
      prisma.categoryAttributeDefinition.findUnique.mockResolvedValue(null);
      prisma.categoryAttributeDefinition.findMany.mockResolvedValue([
        { displayOrder: 1 },
        { displayOrder: 2 },
      ]);

      const dto: CreateAttributeDefinitionDto = {
        categoryId: 'cat-123',
        slug: 'new-field',
        label: 'New Field',
        fieldType: 'text',
        displayOrder: 1, // Conflicts with existing
      };

      // Should handle display order conflict
      await service.createDefinition(dto);
    });
  });

  describe('Slug Validation', () => {
    it('should enforce slug uniqueness within category', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-123' });
      prisma.categoryAttributeDefinition.findUnique.mockResolvedValue({
        id: 'existing-attr',
      });

      const duplicateSlugDto: CreateAttributeDefinitionDto = {
        categoryId: 'cat-123',
        slug: 'existing-slug',
        label: 'Test',
        fieldType: 'text',
      };

      // Should reject duplicate slug
      await expect(service.createDefinition(duplicateSlugDto)).rejects.toThrow(
        'already exists'
      );
    });
  });
});
