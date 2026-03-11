import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from '../services/categories.service';
import { CategoryTemplateService } from '../services/category-template.service';

describe('CategoriesController', () => {
  let controller: CategoriesController;
  let categoriesService: jest.Mocked<CategoriesService>;
  let templateService: jest.Mocked<CategoryTemplateService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [
        {
          provide: CategoriesService,
          useValue: {
            findAll: jest.fn(),
            findById: jest.fn(),
            findBySlug: jest.fn(),
            getCategoryStats: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: CategoryTemplateService,
          useValue: {
            getAllCategoryTemplates: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(CategoriesController);
    categoriesService = module.get(CategoriesService) as jest.Mocked<CategoriesService>;
    templateService = module.get(CategoryTemplateService) as jest.Mocked<CategoryTemplateService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── findAll ──

  describe('findAll', () => {
    it('defaults to active-only categories', async () => {
      categoriesService.findAll.mockResolvedValue([]);
      await controller.findAll(undefined);
      expect(categoriesService.findAll).toHaveBeenCalledWith(true);
    });

    it('respects activeOnly=false', async () => {
      categoriesService.findAll.mockResolvedValue([]);
      await controller.findAll('false');
      expect(categoriesService.findAll).toHaveBeenCalledWith(false);
    });

    it('treats activeOnly=true as active', async () => {
      categoriesService.findAll.mockResolvedValue([]);
      await controller.findAll('true');
      expect(categoriesService.findAll).toHaveBeenCalledWith(true);
    });
  });

  // ── getAllTemplates ──

  describe('getAllTemplates', () => {
    it('delegates to templateService', async () => {
      (templateService.getAllCategoryTemplates as jest.Mock).mockResolvedValue([{ slug: 'car' }] as any);
      const result = await controller.getAllTemplates();
      expect(result).toEqual([{ slug: 'car' }]);
    });
  });

  // ── findById ──

  describe('findById', () => {
    it('returns category for valid id', async () => {
      const cat = { id: '1', name: 'Vehicle' };
      categoriesService.findById.mockResolvedValue(cat as any);
      expect(await controller.findById('1')).toBe(cat);
    });

    it('propagates not-found error', async () => {
      categoriesService.findById.mockRejectedValue(new Error('Not found'));
      await expect(controller.findById('999')).rejects.toThrow('Not found');
    });
  });

  // ── getCategoryTemplate ──

  describe('getCategoryTemplate', () => {
    it('returns category and its template schema', async () => {
      const cat = { id: '1', name: 'Car', templateSchema: { fields: [] } };
      categoriesService.findById.mockResolvedValue(cat as any);
      const result = await controller.getCategoryTemplate('1');
      expect(result.category).toBe(cat);
      expect(result.templateSchema).toBe(cat.templateSchema);
    });
  });

  // ── getCategoryStats ──

  describe('getCategoryStats', () => {
    it('delegates to service', async () => {
      const stats = { listingCount: 10, activeListingCount: 5 };
      categoriesService.getCategoryStats.mockResolvedValue(stats as any);
      expect(await controller.getCategoryStats('1')).toBe(stats);
    });
  });

  // ── findBySlug ──

  describe('findBySlug', () => {
    it('returns category for valid slug', async () => {
      const cat = { id: '1', slug: 'vehicles' };
      categoriesService.findBySlug.mockResolvedValue(cat as any);
      expect(await controller.findBySlug('vehicles')).toBe(cat);
    });
  });

  // ── create (admin-only) ──

  describe('create', () => {
    it('delegates to service with dto', async () => {
      const dto = { name: 'New Cat', slug: 'new-cat' };
      const created = { id: '2', ...dto };
      categoriesService.create.mockResolvedValue(created as any);
      expect(await controller.create(dto as any)).toBe(created);
    });
  });

  // ── update (admin-only) ──

  describe('update', () => {
    it('delegates to service with id and dto', async () => {
      const dto = { name: 'Updated' };
      categoriesService.update.mockResolvedValue({ id: '1', name: 'Updated' } as any);
      await controller.update('1', dto as any);
      expect(categoriesService.update).toHaveBeenCalledWith('1', dto);
    });
  });

  // ── delete (admin-only) ──

  describe('delete', () => {
    it('delegates to service', async () => {
      categoriesService.delete.mockResolvedValue(undefined as any);
      await controller.delete('1');
      expect(categoriesService.delete).toHaveBeenCalledWith('1');
    });
  });
});
