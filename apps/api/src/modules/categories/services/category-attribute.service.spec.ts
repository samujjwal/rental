import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { CategoryAttributeService } from './category-attribute.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

describe('CategoryAttributeService', () => {
  let service: CategoryAttributeService;
  let prisma: any;

  const categoryId = 'cat-1';
  const definitionId = 'def-1';
  const listingId = 'listing-1';

  const mockDefinition = {
    id: definitionId,
    categoryId,
    slug: 'year',
    label: 'Year',
    fieldType: 'number',
    isRequired: true,
    isSearchable: true,
    isFilterable: true,
    options: null,
    validation: JSON.stringify({ min: 1900, max: 2030 }),
    displayOrder: 0,
    unit: null,
    helpText: 'Manufacturing year',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockValue = {
    id: 'val-1',
    listingId,
    attributeDefinitionId: definitionId,
    value: '2020',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      category: {
        findUnique: jest.fn(),
      },
      categoryAttributeDefinition: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      listingAttributeValue: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryAttributeService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CategoryAttributeService>(CategoryAttributeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ──────── Definition CRUD ────────

  describe('createDefinition', () => {
    it('should create a definition successfully', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: categoryId });
      prisma.categoryAttributeDefinition.findUnique.mockResolvedValue(null);
      prisma.categoryAttributeDefinition.create.mockResolvedValue(mockDefinition);

      const result = await service.createDefinition({
        categoryId,
        slug: 'year',
        label: 'Year',
        fieldType: 'number',
        isRequired: true,
        isSearchable: true,
        isFilterable: true,
        validation: { min: 1900, max: 2030 },
        helpText: 'Manufacturing year',
      });

      expect(result).toEqual(mockDefinition);
    });

    it('should throw BadRequestException for invalid fieldType', async () => {
      await expect(
        service.createDefinition({
          categoryId,
          slug: 'test',
          label: 'Test',
          fieldType: 'invalid' as any,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if category does not exist', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(
        service.createDefinition({
          categoryId,
          slug: 'year',
          label: 'Year',
          fieldType: 'number',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException on duplicate slug', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: categoryId });
      prisma.categoryAttributeDefinition.findUnique.mockResolvedValue(mockDefinition);

      await expect(
        service.createDefinition({
          categoryId,
          slug: 'year',
          label: 'Year',
          fieldType: 'number',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should serialize options as JSON', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: categoryId });
      prisma.categoryAttributeDefinition.findUnique.mockResolvedValue(null);
      prisma.categoryAttributeDefinition.create.mockResolvedValue(mockDefinition);

      await service.createDefinition({
        categoryId,
        slug: 'color',
        label: 'Color',
        fieldType: 'select',
        options: ['red', 'blue', 'green'],
      });

      expect(prisma.categoryAttributeDefinition.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          options: JSON.stringify(['red', 'blue', 'green']),
        }),
      });
    });

    it('should use default values for optional fields', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: categoryId });
      prisma.categoryAttributeDefinition.findUnique.mockResolvedValue(null);
      prisma.categoryAttributeDefinition.create.mockResolvedValue(mockDefinition);

      await service.createDefinition({
        categoryId,
        slug: 'test',
        label: 'Test',
        fieldType: 'text',
      });

      expect(prisma.categoryAttributeDefinition.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isRequired: false,
          isSearchable: false,
          isFilterable: false,
          displayOrder: 0,
          unit: null,
          helpText: null,
        }),
      });
    });
  });

  describe('updateDefinition', () => {
    it('should update a definition', async () => {
      prisma.categoryAttributeDefinition.findUnique.mockResolvedValue(mockDefinition);
      prisma.categoryAttributeDefinition.update.mockResolvedValue({
        ...mockDefinition,
        label: 'Updated Year',
      });

      const result = await service.updateDefinition(definitionId, {
        label: 'Updated Year',
      });

      expect(result.label).toBe('Updated Year');
    });

    it('should throw NotFoundException if definition not found', async () => {
      prisma.categoryAttributeDefinition.findUnique.mockResolvedValue(null);

      await expect(
        service.updateDefinition('bad-id', { label: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid fieldType in update', async () => {
      prisma.categoryAttributeDefinition.findUnique.mockResolvedValue(mockDefinition);

      await expect(
        service.updateDefinition(definitionId, { fieldType: 'invalid' as any }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteDefinition', () => {
    it('should delete a definition', async () => {
      prisma.categoryAttributeDefinition.findUnique.mockResolvedValue({
        ...mockDefinition,
        _count: { values: 0 },
      });
      prisma.categoryAttributeDefinition.delete.mockResolvedValue(mockDefinition);

      const result = await service.deleteDefinition(definitionId);

      expect(result).toEqual(mockDefinition);
    });

    it('should throw NotFoundException if definition not found', async () => {
      prisma.categoryAttributeDefinition.findUnique.mockResolvedValue(null);

      await expect(service.deleteDefinition('bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findDefinitionsByCategory', () => {
    it('should return definitions ordered by displayOrder', async () => {
      prisma.categoryAttributeDefinition.findMany.mockResolvedValue([
        mockDefinition,
      ]);

      const result = await service.findDefinitionsByCategory(categoryId);

      expect(result).toHaveLength(1);
      expect(prisma.categoryAttributeDefinition.findMany).toHaveBeenCalledWith({
        where: { categoryId },
        orderBy: { displayOrder: 'asc' },
      });
    });
  });

  describe('findDefinitionById', () => {
    it('should return definition by id', async () => {
      prisma.categoryAttributeDefinition.findUnique.mockResolvedValue(mockDefinition);

      const result = await service.findDefinitionById(definitionId);

      expect(result).toEqual(mockDefinition);
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.categoryAttributeDefinition.findUnique.mockResolvedValue(null);

      await expect(service.findDefinitionById('bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ──────── Value CRUD ────────

  describe('setValue', () => {
    it('should set a valid number value', async () => {
      prisma.categoryAttributeDefinition.findUnique.mockResolvedValue(mockDefinition);
      prisma.listingAttributeValue.upsert.mockResolvedValue(mockValue);

      const result = await service.setValue({
        listingId,
        attributeDefinitionId: definitionId,
        value: '2020',
      });

      expect(result).toEqual(mockValue);
    });

    it('should throw NotFoundException if definition not found', async () => {
      prisma.categoryAttributeDefinition.findUnique.mockResolvedValue(null);

      await expect(
        service.setValue({
          listingId,
          attributeDefinitionId: 'bad-id',
          value: '2020',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for non-numeric value on number field', async () => {
      prisma.categoryAttributeDefinition.findUnique.mockResolvedValue(mockDefinition);

      await expect(
        service.setValue({
          listingId,
          attributeDefinitionId: definitionId,
          value: 'not-a-number',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when number below min', async () => {
      prisma.categoryAttributeDefinition.findUnique.mockResolvedValue(mockDefinition);

      await expect(
        service.setValue({
          listingId,
          attributeDefinitionId: definitionId,
          value: '1800', // Below min 1900
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when number above max', async () => {
      prisma.categoryAttributeDefinition.findUnique.mockResolvedValue(mockDefinition);

      await expect(
        service.setValue({
          listingId,
          attributeDefinitionId: definitionId,
          value: '2100', // Above max 2030
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate boolean values', async () => {
      const boolDef = { ...mockDefinition, fieldType: 'boolean', validation: null };
      prisma.categoryAttributeDefinition.findUnique.mockResolvedValue(boolDef);

      await expect(
        service.setValue({
          listingId,
          attributeDefinitionId: definitionId,
          value: 'maybe',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept valid boolean values', async () => {
      const boolDef = { ...mockDefinition, fieldType: 'boolean', validation: null };
      prisma.categoryAttributeDefinition.findUnique.mockResolvedValue(boolDef);
      prisma.listingAttributeValue.upsert.mockResolvedValue(mockValue);

      // These should all work
      for (const val of ['true', 'false', '1', '0']) {
        prisma.categoryAttributeDefinition.findUnique.mockResolvedValue(boolDef);
        await expect(
          service.setValue({
            listingId,
            attributeDefinitionId: definitionId,
            value: val,
          }),
        ).resolves.toBeDefined();
      }
    });

    it('should validate select values against options', async () => {
      const selectDef = {
        ...mockDefinition,
        fieldType: 'select',
        options: JSON.stringify(['red', 'blue']),
        validation: null,
      };
      prisma.categoryAttributeDefinition.findUnique.mockResolvedValue(selectDef);

      await expect(
        service.setValue({
          listingId,
          attributeDefinitionId: definitionId,
          value: 'green', // Not in list
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept valid select values', async () => {
      const selectDef = {
        ...mockDefinition,
        fieldType: 'select',
        options: JSON.stringify(['red', 'blue']),
        validation: null,
      };
      prisma.categoryAttributeDefinition.findUnique.mockResolvedValue(selectDef);
      prisma.listingAttributeValue.upsert.mockResolvedValue(mockValue);

      await expect(
        service.setValue({
          listingId,
          attributeDefinitionId: definitionId,
          value: 'red',
        }),
      ).resolves.toBeDefined();
    });

    it('should validate multiselect values', async () => {
      const multiDef = {
        ...mockDefinition,
        fieldType: 'multiselect',
        options: JSON.stringify(['red', 'blue', 'green']),
        validation: null,
      };
      prisma.categoryAttributeDefinition.findUnique.mockResolvedValue(multiDef);

      // Invalid: 'yellow' not in options
      await expect(
        service.setValue({
          listingId,
          attributeDefinitionId: definitionId,
          value: JSON.stringify(['red', 'yellow']),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject non-JSON multiselect values', async () => {
      const multiDef = {
        ...mockDefinition,
        fieldType: 'multiselect',
        options: JSON.stringify(['red', 'blue']),
        validation: null,
      };
      prisma.categoryAttributeDefinition.findUnique.mockResolvedValue(multiDef);

      await expect(
        service.setValue({
          listingId,
          attributeDefinitionId: definitionId,
          value: 'not-json',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate date values', async () => {
      const dateDef = { ...mockDefinition, fieldType: 'date', validation: null };
      prisma.categoryAttributeDefinition.findUnique.mockResolvedValue(dateDef);

      await expect(
        service.setValue({
          listingId,
          attributeDefinitionId: definitionId,
          value: 'not-a-date',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate text length constraints', async () => {
      const textDef = {
        ...mockDefinition,
        fieldType: 'text',
        validation: JSON.stringify({ minLength: 3, maxLength: 10 }),
      };
      prisma.categoryAttributeDefinition.findUnique.mockResolvedValue(textDef);

      // Too short
      await expect(
        service.setValue({
          listingId,
          attributeDefinitionId: definitionId,
          value: 'ab',
        }),
      ).rejects.toThrow(BadRequestException);

      // Too long
      prisma.categoryAttributeDefinition.findUnique.mockResolvedValue(textDef);
      await expect(
        service.setValue({
          listingId,
          attributeDefinitionId: definitionId,
          value: 'a'.repeat(11),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate text regex pattern', async () => {
      const textDef = {
        ...mockDefinition,
        fieldType: 'text',
        validation: JSON.stringify({ regex: '^[A-Z]+$' }),
      };
      prisma.categoryAttributeDefinition.findUnique.mockResolvedValue(textDef);

      await expect(
        service.setValue({
          listingId,
          attributeDefinitionId: definitionId,
          value: 'lowercase',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('bulkSetValues', () => {
    it('should set multiple values atomically', async () => {
      prisma.categoryAttributeDefinition.findMany.mockResolvedValue([
        mockDefinition,
        { ...mockDefinition, id: 'def-2', slug: 'make', fieldType: 'text', validation: null },
      ]);
      prisma.$transaction.mockResolvedValue([mockValue, { ...mockValue, id: 'val-2' }]);

      const result = await service.bulkSetValues({
        listingId,
        values: [
          { attributeDefinitionId: definitionId, value: '2020' },
          { attributeDefinitionId: 'def-2', value: 'Toyota' },
        ],
      });

      expect(result).toHaveLength(2);
    });

    it('should throw NotFoundException if any definition not found', async () => {
      prisma.categoryAttributeDefinition.findMany.mockResolvedValue([
        mockDefinition,
        // 'def-2' is missing
      ]);

      await expect(
        service.bulkSetValues({
          listingId,
          values: [
            { attributeDefinitionId: definitionId, value: '2020' },
            { attributeDefinitionId: 'def-2', value: 'Toyota' },
          ],
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getValuesForListing', () => {
    it('should return attribute values with definitions', async () => {
      prisma.listingAttributeValue.findMany.mockResolvedValue([
        { ...mockValue, attributeDefinition: mockDefinition },
      ]);

      const result = await service.getValuesForListing(listingId);

      expect(result).toHaveLength(1);
      expect(result[0].attributeDefinition).toBeDefined();
    });
  });

  describe('deleteValue', () => {
    it('should delete an attribute value', async () => {
      prisma.listingAttributeValue.findUnique.mockResolvedValue(mockValue);
      prisma.listingAttributeValue.delete.mockResolvedValue(mockValue);

      const result = await service.deleteValue(listingId, definitionId);

      expect(result).toEqual(mockValue);
    });

    it('should throw NotFoundException if value not found', async () => {
      prisma.listingAttributeValue.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteValue(listingId, 'bad-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('validateRequiredAttributes', () => {
    it('should return valid when all required attributes are set', async () => {
      prisma.categoryAttributeDefinition.findMany.mockResolvedValue([
        { id: definitionId, slug: 'year', label: 'Year' },
      ]);
      prisma.listingAttributeValue.findMany.mockResolvedValue([
        { attributeDefinitionId: definitionId },
      ]);

      const result = await service.validateRequiredAttributes(listingId, categoryId);

      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('should return invalid with missing labels', async () => {
      prisma.categoryAttributeDefinition.findMany.mockResolvedValue([
        { id: definitionId, slug: 'year', label: 'Year' },
        { id: 'def-2', slug: 'make', label: 'Make' },
      ]);
      prisma.listingAttributeValue.findMany.mockResolvedValue([
        { attributeDefinitionId: definitionId }, // Only 'year' is set
      ]);

      const result = await service.validateRequiredAttributes(listingId, categoryId);

      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(['Make']);
    });

    it('should return valid when no required attributes exist', async () => {
      prisma.categoryAttributeDefinition.findMany.mockResolvedValue([]);
      prisma.listingAttributeValue.findMany.mockResolvedValue([]);

      const result = await service.validateRequiredAttributes(listingId, categoryId);

      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });
  });
});
