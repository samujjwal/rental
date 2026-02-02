import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CategoriesService, CreateCategoryDto, UpdateCategoryDto } from './categories.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';
import { PricingMode } from '@rental-portal/database';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prismaService: jest.Mocked<PrismaService>;
  let cacheService: jest.Mocked<CacheService>;

  const mockCategory = {
    id: 'cat-123',
    name: 'Apartment',
    slug: 'apartment',
    description: 'Apartment rentals',
    icon: 'apartment-icon',
    parentId: null,
    active: true,
    featured: false,
    order: 1,
    pricingMode: PricingMode.PER_NIGHT,
    searchableFields: ['name', 'description'],
    requiredFields: ['bedrooms', 'bathrooms'],
    templateSchema: JSON.stringify({ bedrooms: 'number', bathrooms: 'number' }),
    dailyPrice: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCategories = [
    mockCategory,
    { ...mockCategory, id: 'cat-456', name: 'House', slug: 'house', order: 2 },
    { ...mockCategory, id: 'cat-789', name: 'Villa', slug: 'villa', order: 3 },
  ];

  beforeEach(async () => {
    const mockPrismaService = {
      category: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      listing: {
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _avg: {}, _sum: {} }),
      },
    };

    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    prismaService = module.get(PrismaService);
    cacheService = module.get(CacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateCategoryDto = {
      name: 'Condo',
      slug: 'condo',
      description: 'Condominium rentals',
      iconUrl: 'condo-icon',
      order: 4,
      templateSchema: { bedrooms: 'number' },
      searchableFields: ['name'],
      requiredFields: ['bedrooms'],
    };

    it('should create a new category successfully', async () => {
      const newCategory = { ...mockCategory, ...createDto, id: 'cat-new' };
      
      (prismaService.category.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.category.create as jest.Mock).mockResolvedValue(newCategory);
      (cacheService.del as jest.Mock).mockResolvedValue(undefined);

      const result = await service.create(createDto);

      expect(result).toEqual(newCategory);
      expect(prismaService.category.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: createDto.name,
            slug: createDto.slug,
          }),
        }),
      );
    });

    it('should throw BadRequestException if slug already exists', async () => {
      (prismaService.category.findUnique as jest.Mock).mockResolvedValue(mockCategory);

      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
    });

    it('should invalidate cache after creating', async () => {
      (prismaService.category.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.category.create as jest.Mock).mockResolvedValue(mockCategory);

      await service.create(createDto);

      // Verify cache invalidation was called
      expect(cacheService.del).toHaveBeenCalled();
    });

    it('should create category with default values for optional fields', async () => {
      const minimalDto: CreateCategoryDto = {
        name: 'Minimal',
        slug: 'minimal',
        templateSchema: {},
      };

      (prismaService.category.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.category.create as jest.Mock).mockResolvedValue({
        ...mockCategory,
        ...minimalDto,
        searchableFields: [],
        requiredFields: [],
        order: 0,
      });

      const result = await service.create(minimalDto);

      expect(prismaService.category.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            searchableFields: [],
            requiredFields: [],
            order: 0,
          }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return all active categories by default', async () => {
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      (prismaService.category.findMany as jest.Mock).mockResolvedValue(mockCategories);
      (cacheService.set as jest.Mock).mockResolvedValue(undefined);

      const result = await service.findAll();

      expect(result).toEqual(mockCategories);
      expect(prismaService.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { active: true },
          orderBy: { order: 'asc' },
        }),
      );
    });

    it('should return cached categories if available', async () => {
      (cacheService.get as jest.Mock).mockResolvedValue(mockCategories);

      const result = await service.findAll();

      expect(result).toEqual(mockCategories);
      expect(prismaService.category.findMany).not.toHaveBeenCalled();
    });

    it('should return all categories when activeOnly is false', async () => {
      const allCategories = [
        ...mockCategories,
        { ...mockCategory, id: 'inactive', active: false },
      ];

      (cacheService.get as jest.Mock).mockResolvedValue(null);
      (prismaService.category.findMany as jest.Mock).mockResolvedValue(allCategories);

      const result = await service.findAll(false);

      expect(result).toEqual(allCategories);
      expect(prismaService.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: undefined,
        }),
      );
    });

    it('should cache results for 1 hour', async () => {
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      (prismaService.category.findMany as jest.Mock).mockResolvedValue(mockCategories);

      await service.findAll();

      expect(cacheService.set).toHaveBeenCalledWith(
        'categories:active',
        mockCategories,
        3600,
      );
    });
  });

  describe('findById', () => {
    it('should return category by id', async () => {
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      (prismaService.category.findUnique as jest.Mock).mockResolvedValue(mockCategory);
      (cacheService.set as jest.Mock).mockResolvedValue(undefined);

      const result = await service.findById('cat-123');

      expect(result).toEqual(mockCategory);
      expect(prismaService.category.findUnique).toHaveBeenCalledWith({
        where: { id: 'cat-123' },
      });
    });

    it('should return cached category if available', async () => {
      (cacheService.get as jest.Mock).mockResolvedValue(mockCategory);

      const result = await service.findById('cat-123');

      expect(result).toEqual(mockCategory);
      expect(prismaService.category.findUnique).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if category not found', async () => {
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      (prismaService.category.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto: UpdateCategoryDto = {
      name: 'Updated Apartment',
      description: 'Updated description',
    };

    it('should update category successfully', async () => {
      const updatedCategory = { ...mockCategory, ...updateDto };
      
      (prismaService.category.findUnique as jest.Mock).mockResolvedValue(mockCategory);
      (prismaService.category.update as jest.Mock).mockResolvedValue(updatedCategory);

      const result = await service.update('cat-123', updateDto);

      expect(result).toEqual(updatedCategory);
      expect(prismaService.category.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cat-123' },
          data: expect.objectContaining(updateDto),
        }),
      );
    });

    it('should throw NotFoundException if category not found', async () => {
      (prismaService.category.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.update('non-existent', updateDto)).rejects.toThrow(NotFoundException);
    });

    it('should invalidate cache after update', async () => {
      (prismaService.category.findUnique as jest.Mock).mockResolvedValue(mockCategory);
      (prismaService.category.update as jest.Mock).mockResolvedValue(mockCategory);

      await service.update('cat-123', updateDto);

      expect(cacheService.del).toHaveBeenCalled();
    });

    it('should update category with active status toggle', async () => {
      const deactivateDto: UpdateCategoryDto = { active: false };
      const deactivatedCategory = { ...mockCategory, active: false };

      (prismaService.category.findUnique as jest.Mock).mockResolvedValue(mockCategory);
      (prismaService.category.update as jest.Mock).mockResolvedValue(deactivatedCategory);

      const result = await service.update('cat-123', deactivateDto);

      expect(result.active).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete category successfully', async () => {
      (prismaService.category.findUnique as jest.Mock).mockResolvedValue(mockCategory);
      (prismaService.listing.count as jest.Mock).mockResolvedValue(0);
      (prismaService.category.delete as jest.Mock).mockResolvedValue(mockCategory);

      await service.delete('cat-123');

      expect(prismaService.category.delete).toHaveBeenCalledWith({
        where: { id: 'cat-123' },
      });
    });

    it('should throw NotFoundException if category not found', async () => {
      (prismaService.category.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.delete('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if category has properties', async () => {
      (prismaService.category.findUnique as jest.Mock).mockResolvedValue(mockCategory);
      (prismaService.listing.count as jest.Mock).mockResolvedValue(5);

      await expect(service.delete('cat-123')).rejects.toThrow(BadRequestException);
    });

    it('should invalidate cache after deletion', async () => {
      (prismaService.category.findUnique as jest.Mock).mockResolvedValue(mockCategory);
      (prismaService.listing.count as jest.Mock).mockResolvedValue(0);
      (prismaService.category.delete as jest.Mock).mockResolvedValue(mockCategory);

      await service.delete('cat-123');

      expect(cacheService.del).toHaveBeenCalled();
    });
  });

  describe('findBySlug', () => {
    it('should return category by slug', async () => {
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      (prismaService.category.findUnique as jest.Mock).mockResolvedValue(mockCategory);

      const result = await service.findBySlug('apartment');

      expect(result).toEqual(mockCategory);
      expect(prismaService.category.findUnique).toHaveBeenCalledWith({
        where: { slug: 'apartment' },
      });
    });

    it('should throw NotFoundException if category not found by slug', async () => {
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      (prismaService.category.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findBySlug('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStats', () => {
    it('should return category statistics', async () => {
      (prismaService.category.findUnique as jest.Mock).mockResolvedValue(mockCategory);
      (prismaService.listing.count as jest.Mock).mockResolvedValue(25);
      (prismaService.listing.aggregate as jest.Mock).mockResolvedValue({
        _avg: { basePrice: 150.50 },
        _sum: { totalBookings: 500 },
      });

      const result = await service.getStats('cat-123');

      expect(result).toHaveProperty('listingCount', 25);
      expect(result).toHaveProperty('averagePrice');
      expect(result).toHaveProperty('totalBookings');
    });

    it('should throw NotFoundException if category not found', async () => {
      (prismaService.category.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getStats('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('hierarchical categories', () => {
    it('should get child categories', async () => {
      const parentCategory = { ...mockCategory, id: 'parent-123' };
      const childCategories = [
        { ...mockCategory, id: 'child-1', parentId: 'parent-123' },
        { ...mockCategory, id: 'child-2', parentId: 'parent-123' },
      ];

      (prismaService.category.findUnique as jest.Mock).mockResolvedValue(parentCategory);
      (prismaService.category.findMany as jest.Mock).mockResolvedValue(childCategories);

      const result = await service.getChildren('parent-123');

      expect(result).toEqual(childCategories);
      expect(prismaService.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { parentId: 'parent-123' },
        }),
      );
    });

    it('should get category tree', async () => {
      const rootCategories = mockCategories.map(cat => ({ ...cat, parentId: null }));
      
      (prismaService.category.findMany as jest.Mock).mockResolvedValue(rootCategories);

      const result = await service.getCategoryTree();

      expect(result).toHaveLength(3);
    });
  });

  describe('edge cases', () => {
    it('should handle empty searchableFields', async () => {
      const categoryWithNoSearchable = { ...mockCategory, searchableFields: [] };
      
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      (prismaService.category.findUnique as jest.Mock).mockResolvedValue(categoryWithNoSearchable);

      const result = await service.findById('cat-123');

      expect(result.searchableFields).toEqual([]);
    });

    it('should handle category with children on delete', async () => {
      const parentWithChildren = { ...mockCategory, id: 'parent' };
      const childCategories = [{ ...mockCategory, id: 'child', parentId: 'parent' }];

      (prismaService.category.findUnique as jest.Mock).mockResolvedValue(parentWithChildren);
      (prismaService.category.findMany as jest.Mock).mockResolvedValue(childCategories);

      await expect(service.delete('parent')).rejects.toThrow(BadRequestException);
    });

    it('should handle special characters in slug', async () => {
      const createDto: CreateCategoryDto = {
        name: 'Test & Category',
        slug: 'test-category',
        templateSchema: {},
      };

      (prismaService.category.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.category.create as jest.Mock).mockResolvedValue({
        ...mockCategory,
        ...createDto,
      });

      const result = await service.create(createDto);

      expect(result.slug).toBe('test-category');
    });
  });
});
