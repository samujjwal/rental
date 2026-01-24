import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';
import { Category, PricingMode } from '@rental-portal/database';

export interface CreateCategoryDto {
  name: string;
  slug: string;
  description?: string;
  iconUrl?: string;
  order?: number;
  templateSchema: Record<string, any>;
  searchableFields?: string[];
  requiredFields?: string[];
  defaultPricingMode?: PricingMode;
  allowInstantBook?: boolean;
  requiresDepositDefault?: boolean;
  defaultDepositPercentage?: number;
  insuranceRequired?: boolean;
  minimumInsuranceAmount?: number;
}

export interface UpdateCategoryDto {
  name?: string;
  description?: string;
  iconUrl?: string;
  order?: number;
  templateSchema?: Record<string, any>;
  searchableFields?: string[];
  requiredFields?: string[];
  active?: boolean;
  defaultPricingMode?: PricingMode;
  allowInstantBook?: boolean;
  requiresDepositDefault?: boolean;
  defaultDepositPercentage?: number;
  insuranceRequired?: boolean;
  minimumInsuranceAmount?: number;
}

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async create(dto: CreateCategoryDto): Promise<Category> {
    // Check if slug already exists
    const existing = await this.prisma.category.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new BadRequestException(`Category with slug '${dto.slug}' already exists`);
    }

    const category = await this.prisma.category.create({
      data: {
        ...dto,
        searchableFields: dto.searchableFields || [],
        requiredFields: dto.requiredFields || [],
      },
    });

    await this.invalidateCache();

    return category;
  }

  async findAll(activeOnly: boolean = true): Promise<Category[]> {
    const cacheKey = `categories:${activeOnly ? 'active' : 'all'}`;
    const cached = await this.cacheService.get<Category[]>(cacheKey);

    if (cached) {
      return cached;
    }

    const categories = await this.prisma.category.findMany({
      where: activeOnly ? { active: true } : undefined,
      orderBy: { order: 'asc' },
    });

    // Cache for 1 hour
    await this.cacheService.set(cacheKey, categories, 3600);

    return categories;
  }

  async findById(id: string): Promise<Category> {
    const cacheKey = `category:${id}`;
    const cached = await this.cacheService.get<Category>(cacheKey);

    if (cached) {
      return cached;
    }

    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID '${id}' not found`);
    }

    await this.cacheService.set(cacheKey, category, 3600);

    return category;
  }

  async findBySlug(slug: string): Promise<Category> {
    const cacheKey = `category:slug:${slug}`;
    const cached = await this.cacheService.get<Category>(cacheKey);

    if (cached) {
      return cached;
    }

    const category = await this.prisma.category.findUnique({
      where: { slug },
    });

    if (!category) {
      throw new NotFoundException(`Category with slug '${slug}' not found`);
    }

    await this.cacheService.set(cacheKey, category, 3600);

    return category;
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.prisma.category.update({
      where: { id },
      data: dto,
    });

    await this.invalidateCache();
    await this.cacheService.del(`category:${id}`);

    return category;
  }

  async delete(id: string): Promise<void> {
    // Check if category has listings
    const listingCount = await this.prisma.listing.count({
      where: { categoryId: id },
    });

    if (listingCount > 0) {
      throw new BadRequestException(
        `Cannot delete category with ${listingCount} associated listings`,
      );
    }

    await this.prisma.category.delete({
      where: { id },
    });

    await this.invalidateCache();
  }

  async getCategoryStats(id: string) {
    const [category, listingCount, activeListings, avgPrice] = await Promise.all([
      this.findById(id),
      this.prisma.listing.count({ where: { categoryId: id } }),
      this.prisma.listing.count({
        where: {
          categoryId: id,
          status: 'ACTIVE',
        },
      }),
      this.prisma.listing.aggregate({
        where: {
          categoryId: id,
          status: 'ACTIVE',
        },
        _avg: {
          basePrice: true,
        },
      }),
    ]);

    return {
      category,
      stats: {
        totalListings: listingCount,
        activeListings,
        averagePrice: avgPrice._avg.basePrice || 0,
      },
    };
  }

  private async invalidateCache(): Promise<void> {
    await Promise.all([
      this.cacheService.del('categories:active'),
      this.cacheService.del('categories:all'),
    ]);
  }
}
