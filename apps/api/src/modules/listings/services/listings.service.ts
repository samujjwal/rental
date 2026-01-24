import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';
import {
  Listing,
  ListingStatus,
  BookingMode,
  PricingMode,
  VerificationStatus,
  ListingCondition,
  DepositType,
} from '@rental-portal/database';
import { CategoryTemplateService } from '@/modules/categories/services/category-template.service';
import { ListingValidationService } from './listing-validation.service';

export interface CreateListingDto {
  categoryId: string;
  organizationId?: string;
  title: string;
  description: string;
  addressLine1?: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode?: string;
  country: string;
  latitude: number;
  longitude: number;
  photos?: Array<{ url: string; order: number; caption?: string }>;
  videos?: Array<{ url: string; type: string; thumbnailUrl?: string }>;
  pricingMode: PricingMode;
  basePrice: number;
  hourlyPrice?: number;
  dailyPrice?: number;
  weeklyPrice?: number;
  monthlyPrice?: number;
  currency?: string;
  requiresDeposit?: boolean;
  depositAmount?: number;
  depositType?: DepositType;
  bookingMode: BookingMode;
  minBookingHours?: number;
  maxBookingDays?: number;
  leadTime?: number;
  advanceNotice?: number;
  capacity?: number;
  categorySpecificData: Record<string, any>;
  condition?: ListingCondition;
  features?: string[];
  amenities?: any[];
  cancellationPolicyId?: string;
  rules?: string[];
  metaTitle?: string;
  metaDescription?: string;
}

export interface UpdateListingDto extends Partial<CreateListingDto> {
  status?: ListingStatus;
}

export interface ListingFilters {
  categoryId?: string;
  ownerId?: string;
  organizationId?: string;
  status?: ListingStatus;
  bookingMode?: BookingMode;
  city?: string;
  country?: string;
  minPrice?: number;
  maxPrice?: number;
  verificationStatus?: VerificationStatus;
  search?: string;
}

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly templateService: CategoryTemplateService,
    private readonly validationService: ListingValidationService,
  ) {}

  async create(ownerId: string, dto: CreateListingDto): Promise<Listing> {
    // Validate category
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });

    if (!category) {
      throw new BadRequestException('Invalid category');
    }

    // Validate category-specific data
    const validation = await this.validationService.validateCategoryData(
      dto.categoryId,
      dto.categorySpecificData,
    );

    if (!validation.isValid) {
      throw new BadRequestException({
        message: 'Invalid category-specific data',
        errors: validation.errors,
      });
    }

    // Generate slug
    const slug = await this.generateUniqueSlug(dto.title);

    // Create listing
    const listing = await this.prisma.listing.create({
      data: {
        ownerId,
        organizationId: dto.organizationId,
        categoryId: dto.categoryId,
        title: dto.title,
        description: dto.description,
        slug,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        city: dto.city,
        state: dto.state,
        postalCode: dto.postalCode,
        country: dto.country,
        latitude: dto.latitude,
        longitude: dto.longitude,
        photos: dto.photos || [],
        videos: dto.videos || [],
        pricingMode: dto.pricingMode,
        basePrice: dto.basePrice,
        hourlyPrice: dto.hourlyPrice,
        dailyPrice: dto.dailyPrice,
        weeklyPrice: dto.weeklyPrice,
        monthlyPrice: dto.monthlyPrice,
        currency: dto.currency || 'USD',
        requiresDeposit: dto.requiresDeposit || false,
        depositAmount: dto.depositAmount,
        depositType: dto.depositType,
        bookingMode: dto.bookingMode,
        minBookingHours: dto.minBookingHours,
        maxBookingDays: dto.maxBookingDays,
        leadTime: dto.leadTime || 24,
        advanceNotice: dto.advanceNotice || 1,
        capacity: dto.capacity,
        categorySpecificData: dto.categorySpecificData,
        condition: dto.condition,
        features: dto.features || [],
        amenities: dto.amenities || [],
        cancellationPolicyId: dto.cancellationPolicyId,
        rules: dto.rules || [],
        metaTitle: dto.metaTitle,
        metaDescription: dto.metaDescription,
        status: ListingStatus.DRAFT,
        verificationStatus: VerificationStatus.PENDING,
      },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhotoUrl: true,
            averageRating: true,
            totalReviews: true,
          },
        },
        category: true,
      },
    });

    return listing;
  }

  async findAll(
    filters: ListingFilters,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    listings: Listing[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const where: any = {};

    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.ownerId) where.ownerId = filters.ownerId;
    if (filters.organizationId) where.organizationId = filters.organizationId;
    if (filters.status) where.status = filters.status;
    if (filters.bookingMode) where.bookingMode = filters.bookingMode;
    if (filters.city) where.city = { contains: filters.city, mode: 'insensitive' };
    if (filters.country) where.country = filters.country;
    if (filters.verificationStatus) where.verificationStatus = filters.verificationStatus;

    if (filters.minPrice || filters.maxPrice) {
      where.basePrice = {};
      if (filters.minPrice) where.basePrice.gte = filters.minPrice;
      if (filters.maxPrice) where.basePrice.lte = filters.maxPrice;
    }

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { city: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [listings, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        include: {
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePhotoUrl: true,
              averageRating: true,
              totalReviews: true,
              idVerificationStatus: true,
            },
          },
          category: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.listing.count({ where }),
    ]);

    return {
      listings,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string, includePrivate: boolean = false): Promise<Listing> {
    const cacheKey = `listing:${id}`;

    if (!includePrivate) {
      const cached = await this.cacheService.get<Listing>(cacheKey);
      if (cached) return cached;
    }

    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhotoUrl: true,
            bio: true,
            averageRating: true,
            totalReviews: true,
            responseRate: true,
            responseTime: true,
            idVerificationStatus: true,
            createdAt: true,
          },
        },
        category: true,
        cancellationPolicy: true,
        organization: includePrivate,
      },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (!includePrivate && listing.status === ListingStatus.ACTIVE) {
      await this.cacheService.set(cacheKey, listing, 1800); // 30 minutes
    }

    return listing;
  }

  async findBySlug(slug: string): Promise<Listing> {
    const cacheKey = `listing:slug:${slug}`;
    const cached = await this.cacheService.get<Listing>(cacheKey);
    if (cached) return cached;

    const listing = await this.prisma.listing.findUnique({
      where: { slug },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhotoUrl: true,
            bio: true,
            averageRating: true,
            totalReviews: true,
            responseRate: true,
            responseTime: true,
            idVerificationStatus: true,
            createdAt: true,
          },
        },
        category: true,
        cancellationPolicy: true,
      },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.status === ListingStatus.ACTIVE) {
      await this.cacheService.set(cacheKey, listing, 1800);
    }

    return listing;
  }

  async update(id: string, userId: string, dto: UpdateListingDto): Promise<Listing> {
    const listing = await this.findById(id, true);

    // Check ownership
    if (listing.ownerId !== userId) {
      throw new ForbiddenException('You do not have permission to update this listing');
    }

    // Validate category-specific data if provided
    if (dto.categorySpecificData) {
      const validation = await this.validationService.validateCategoryData(
        listing.categoryId,
        dto.categorySpecificData,
      );

      if (!validation.isValid) {
        throw new BadRequestException({
          message: 'Invalid category-specific data',
          errors: validation.errors,
        });
      }
    }

    const updated = await this.prisma.listing.update({
      where: { id },
      data: dto,
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhotoUrl: true,
            averageRating: true,
            totalReviews: true,
          },
        },
        category: true,
      },
    });

    // Invalidate cache
    await this.cacheService.del(`listing:${id}`);
    await this.cacheService.del(`listing:slug:${listing.slug}`);

    return updated;
  }

  async publish(id: string, userId: string): Promise<Listing> {
    const listing = await this.findById(id, true);

    if (listing.ownerId !== userId) {
      throw new ForbiddenException('You do not have permission to publish this listing');
    }

    if (listing.status !== ListingStatus.DRAFT) {
      throw new BadRequestException('Only draft listings can be published');
    }

    // Validate listing is complete
    const validation = this.validationService.validateListingCompleteness(listing);
    if (!validation.isValid) {
      throw new BadRequestException({
        message: 'Listing is incomplete',
        errors: validation.errors,
      });
    }

    const updated = await this.prisma.listing.update({
      where: { id },
      data: {
        status: ListingStatus.PENDING_REVIEW,
        publishedAt: new Date(),
      },
    });

    await this.cacheService.del(`listing:${id}`);

    return updated;
  }

  async pause(id: string, userId: string): Promise<Listing> {
    const listing = await this.findById(id, true);

    if (listing.ownerId !== userId) {
      throw new ForbiddenException('You do not have permission to pause this listing');
    }

    const updated = await this.prisma.listing.update({
      where: { id },
      data: { status: ListingStatus.PAUSED },
    });

    await this.cacheService.del(`listing:${id}`);
    await this.cacheService.del(`listing:slug:${listing.slug}`);

    return updated;
  }

  async activate(id: string, userId: string): Promise<Listing> {
    const listing = await this.findById(id, true);

    if (listing.ownerId !== userId) {
      throw new ForbiddenException('You do not have permission to activate this listing');
    }

    if (listing.verificationStatus !== VerificationStatus.VERIFIED) {
      throw new BadRequestException('Listing must be verified before activation');
    }

    const updated = await this.prisma.listing.update({
      where: { id },
      data: { status: ListingStatus.ACTIVE },
    });

    await this.cacheService.del(`listing:${id}`);

    return updated;
  }

  async delete(id: string, userId: string): Promise<void> {
    const listing = await this.findById(id, true);

    if (listing.ownerId !== userId) {
      throw new ForbiddenException('You do not have permission to delete this listing');
    }

    // Check for active bookings
    const activeBookings = await this.prisma.booking.count({
      where: {
        listingId: id,
        status: { in: ['CONFIRMED', 'IN_PROGRESS'] },
      },
    });

    if (activeBookings > 0) {
      throw new BadRequestException('Cannot delete listing with active bookings');
    }

    await this.prisma.listing.update({
      where: { id },
      data: {
        status: ListingStatus.ARCHIVED,
        deletedAt: new Date(),
      },
    });

    await this.cacheService.del(`listing:${id}`);
    await this.cacheService.del(`listing:slug:${listing.slug}`);
  }

  async incrementViewCount(id: string): Promise<void> {
    await this.prisma.listing.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });
  }

  async getOwnerListings(ownerId: string, includeAll: boolean = false): Promise<Listing[]> {
    const where: any = { ownerId };

    if (!includeAll) {
      where.status = { not: ListingStatus.ARCHIVED };
    }

    return this.prisma.listing.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getListingStats(id: string) {
    const [listing, bookingCount, activeBookings, revenue, reviewStats] = await Promise.all([
      this.findById(id),
      this.prisma.booking.count({ where: { listingId: id } }),
      this.prisma.booking.count({
        where: {
          listingId: id,
          status: { in: ['CONFIRMED', 'IN_PROGRESS'] },
        },
      }),
      this.prisma.booking.aggregate({
        where: {
          listingId: id,
          status: { in: ['COMPLETED', 'SETTLED'] },
        },
        _sum: { ownerEarnings: true },
      }),
      this.prisma.review.aggregate({
        where: { listingId: id },
        _avg: { overallRating: true },
        _count: true,
      }),
    ]);

    return {
      listing,
      stats: {
        totalBookings: bookingCount,
        activeBookings,
        totalRevenue: revenue._sum.ownerEarnings || 0,
        averageRating: reviewStats._avg.overallRating || 0,
        totalReviews: reviewStats._count,
        viewCount: listing.viewCount,
      },
    };
  }

  private async generateUniqueSlug(title: string): Promise<string> {
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    let slug = baseSlug;
    let counter = 1;

    while (await this.prisma.listing.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }
}
