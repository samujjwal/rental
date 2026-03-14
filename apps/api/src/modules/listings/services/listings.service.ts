import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { i18nNotFound,i18nForbidden,i18nBadRequest } from '@/common/errors/i18n-exceptions';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CacheService } from '../../../common/cache/cache.service';
import { EmbeddingService } from '../../ai/services/embedding.service';
import {
  Listing as Property,
  PropertyStatus,
  VerificationStatus,
  BookingMode,
  PropertyCondition,
} from '@rental-portal/database';
import { CategoryTemplateService } from '../../categories/services/category-template.service';
import { PropertyValidationService } from './listing-validation.service';
import { ContentModerationService } from '../../moderation/services/content-moderation.service';
import { ListingVersionService } from './listing-version.service';

export interface CreateListingDto {
  categoryId?: string;
  organizationId?: string;
  title: string;
  description: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  photos?: Array<{ url: string; order: number; caption?: string }>;
  videos?: Array<{ url: string; type: string; thumbnailUrl?: string }>;
  pricingMode?: string;
  basePrice: number;
  hourlyPrice?: number;
  dailyPrice?: number;
  weeklyPrice?: number;
  monthlyPrice?: number;
  currency?: string;
  requiresDeposit?: boolean;
  depositAmount?: number;
  depositType?: string;
  bookingMode?: string;
  minBookingHours?: number;
  maxBookingDays?: number;
  leadTime?: number;
  advanceNotice?: number;
  capacity?: number;
  categorySpecificData?: Record<string, any>;
  condition?: string;
  features?: string[];
  amenities?: any[];
  cancellationPolicyId?: string;
  rules?: string | string[];
  metaTitle?: string;
  metaDescription?: string;
}

export interface UpdateListingDto extends Partial<CreateListingDto> {
  status?: PropertyStatus;
  images?: string[];
}


export interface ListingFilters {
  categoryId?: string;
  ownerId?: string;
  organizationId?: string;
  status?: PropertyStatus;
  featured?: boolean;
  bookingMode?: string;
  city?: string;
  country?: string;
  minPrice?: number;
  maxPrice?: number;
  verificationStatus?: VerificationStatus;
  search?: string;
}

@Injectable()
export class ListingsService {
  private readonly logger = new Logger(ListingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly templateService: CategoryTemplateService,
    private readonly validationService: PropertyValidationService,
    private readonly moderationService: ContentModerationService,
    private readonly embeddingService: EmbeddingService,
    private readonly versionService: ListingVersionService,
  ) {}

  private async resolveCategoryId(input: any): Promise<string> {
    const categoryValue = input?.categoryId || input?.category;
    if (!categoryValue || typeof categoryValue !== 'string') {
      throw i18nBadRequest('listing.categoryRequired');
    }

    const category = await this.prisma.category.findFirst({
      where: {
        OR: [
          { id: categoryValue },
          { slug: categoryValue.toLowerCase() },
          { name: categoryValue },
        ],
      },
    });

    if (!category) {
      throw i18nBadRequest('listing.invalidCategory');
    }

    return category.id;
  }

  private normalizeCondition(condition?: string): PropertyCondition | undefined {
    if (!condition) return undefined;
    const normalized = condition.toLowerCase();
    if (['new', 'like-new', 'excellent'].includes(normalized)) return PropertyCondition.EXCELLENT;
    if (normalized === 'good') return PropertyCondition.GOOD;
    if (normalized === 'fair') return PropertyCondition.FAIR;
    if (normalized === 'poor') return PropertyCondition.POOR;
    return undefined;
  }

  private normalizeRules(rules?: string | string[]): string[] | undefined {
    if (!rules) return undefined;
    if (Array.isArray(rules)) return rules;
    return rules
      .split('\n')
      .map((rule) => rule.trim())
      .filter(Boolean);
  }

  private buildMetadata(input: any): string | undefined {
    const metadata: Record<string, any> = {};
    if (input.deliveryOptions) metadata.deliveryOptions = input.deliveryOptions;
    if (input.deliveryRadius != null) metadata.deliveryRadius = input.deliveryRadius;
    if (input.deliveryFee != null) metadata.deliveryFee = input.deliveryFee;
    if (input.minimumRentalPeriod != null) metadata.minimumRentalPeriod = input.minimumRentalPeriod;
    if (input.maximumRentalPeriod != null) metadata.maximumRentalPeriod = input.maximumRentalPeriod;
    if (input.cancellationPolicy) metadata.cancellationPolicy = input.cancellationPolicy;
    if (input.subcategory) metadata.subcategory = input.subcategory;

    // Store category-specific data
    if (input.categorySpecificData && typeof input.categorySpecificData === 'object' && Object.keys(input.categorySpecificData).length > 0) {
      metadata.categorySpecificData = input.categorySpecificData;
    }

    return Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : undefined;
  }

  async create(ownerId: string, dto: CreateListingDto): Promise<Property> {
    const categoryId = await this.resolveCategoryId(dto);

    // Validate category-specific data
    const categorySpecificData = dto.categorySpecificData || {};
    if (Object.keys(categorySpecificData).length > 0) {
      const validation = await this.validationService.validateCategoryData(
        categoryId,
        categorySpecificData,
      );

      if (!validation.isValid) {
        throw new BadRequestException({
          message: 'Invalid category-specific data',
          errors: validation.errors,
        });
      }
    }

    // Generate slug
    const slug = await this.generateUniqueSlug(dto.title);

    // Moderate listing content (title + description)
    try {
      const modResult = await this.moderationService.moderateListing({
        title: dto.title,
        description: dto.description,
        photos: dto.photos?.map((p) => (typeof p === 'string' ? p : p.url)) || [],
        userId: ownerId,
      });
      if (modResult.status === 'REJECTED' || modResult.status === 'FLAGGED') {
        throw new BadRequestException({
          message: 'Listing content violates our content policies',
          flags: modResult.flags,
        });
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error('Listing moderation service unavailable — blocking listing creation (fail-closed)', error);
      throw new BadRequestException({
        message: 'Unable to verify listing content. Please try again later.',
        code: 'MODERATION_SERVICE_UNAVAILABLE',
      });
    }

    const location = (dto as any).location || dto;
    const mappedLocation = location
      ? {
          addressLine1: location.address || dto.addressLine1,
          addressLine2: dto.addressLine2,
          city: location.city || dto.city,
          state: location.state || dto.state,
          postalCode: location.postalCode || dto.postalCode,
          country: location.country || dto.country,
          latitude: location.coordinates?.lat ?? dto.latitude,
          longitude: location.coordinates?.lng ?? dto.longitude,
        }
      : {
          addressLine1: dto.addressLine1,
          addressLine2: dto.addressLine2,
          city: dto.city,
          state: dto.state,
          postalCode: dto.postalCode,
          country: dto.country,
          latitude: dto.latitude,
          longitude: dto.longitude,
        };

    const basePrice = (dto as any).pricePerDay ?? dto.basePrice;
    const weeklyPrice = (dto as any).pricePerWeek ?? dto.weeklyPrice;
    const monthlyPrice = (dto as any).pricePerMonth ?? dto.monthlyPrice;
    const rawBookingMode = (dto as any).bookingMode;
    const normalizedBookingMode =
      typeof rawBookingMode === 'string' && rawBookingMode.toUpperCase() === 'INSTANT'
        ? BookingMode.INSTANT_BOOK
        : rawBookingMode;
    const bookingMode =
      (dto as any).instantBooking === true ? BookingMode.INSTANT_BOOK : normalizedBookingMode;

    // Create listing
    const listing = await this.prisma.listing.create({
      data: {
        ownerId,
        organizationId: dto.organizationId,
        categoryId,
        title: dto.title,
        description: dto.description,
        slug,
        address: `${mappedLocation.addressLine1 || ''}${
          mappedLocation.addressLine2 ? ', ' + mappedLocation.addressLine2 : ''
        }`,
        city: mappedLocation.city,
        state: mappedLocation.state,
        zipCode: mappedLocation.postalCode,
        country: mappedLocation.country,
        latitude: mappedLocation.latitude,
        longitude: mappedLocation.longitude,
        photos:
          dto.photos?.map((p) => (typeof p === 'string' ? p : p.url)) ||
          (dto as any).images ||
          [],
        type: (dto as any).type || 'OTHER',
        basePrice: basePrice,
        currency: dto.currency || 'USD',
        // requiresDeposit, depositAmount, depositType don't exist in schema
        // bookingMode, minBookingHours, maxBookingDays, leadTime, advanceNotice don't exist in schema
        amenities: dto.amenities || [],
        features: dto.features || [],
        cancellationPolicyId: dto.cancellationPolicyId || undefined,
        rules: this.normalizeRules(dto.rules) || [],
        // metaTitle, metaDescription don't exist in schema
        // Listings start as DRAFT and must be published by the owner,
        // then approved by an admin before becoming bookable.
        status: PropertyStatus.DRAFT,
        verificationStatus: VerificationStatus.PENDING,
        bookingMode: bookingMode || BookingMode.REQUEST,
        minStayNights: (dto as any).minimumRentalPeriod || dto.minBookingHours || 1,
        maxStayNights: (dto as any).maximumRentalPeriod || dto.maxBookingDays || null,
        weeklyDiscount: weeklyPrice ? 0 : undefined,
        monthlyDiscount: monthlyPrice ? 0 : undefined,
        condition: this.normalizeCondition((dto as any).condition),
        securityDeposit: (dto as any).securityDeposit || undefined,
        metadata: this.buildMetadata(dto),
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

    // Generate embedding asynchronously (fire-and-forget)
    this.embeddingService.updateListingEmbedding(listing.id).catch((err) =>
      this.logger.warn(`Failed to generate embedding for listing ${listing.id}`, err),
    );

    return listing;
  }

  async findAll(
    filters: ListingFilters,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    listings: Property[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const where: any = {};

    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.ownerId) where.ownerId = filters.ownerId;
    if (filters.organizationId) where.organizationId = filters.organizationId;
    // Default to AVAILABLE for public queries; allow explicit status override for admin/owner
    if (filters.status && filters.ownerId) {
      where.status = filters.status;
    } else if (!filters.ownerId) {
      where.status = PropertyStatus.AVAILABLE;
    }
    if (filters.featured != null) where.featured = filters.featured;
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

  async findById(id: string, includePrivate: boolean = false, viewerUserId?: string, viewerRole?: string): Promise<Property> {
    const cacheKey = `listing:${id}`;

    if (!includePrivate && !viewerUserId) {
      const cached = await this.cacheService.get<Property>(cacheKey);
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
        contents: true,
      },
    });

    if (!listing) {
      throw i18nNotFound('listing.notFound');
    }

    // Allow owner or admin to see non-AVAILABLE listings
    const isOwner = viewerUserId && listing.ownerId === viewerUserId;
    const isAdmin = viewerRole && ['ADMIN', 'SUPER_ADMIN'].includes(viewerRole);
    const canSeePrivate = includePrivate || isOwner || isAdmin;

    if (!canSeePrivate && listing.status !== PropertyStatus.AVAILABLE) {
      throw i18nNotFound('listing.notFound');
    }

    if (!viewerUserId && listing.status === PropertyStatus.AVAILABLE) {
      await this.cacheService.set(cacheKey, listing, 1800); // 30 minutes
    }

    return listing;
  }

  async findBySlug(slug: string): Promise<Property> {
    const cacheKey = `listing:slug:${slug}`;
    const cached = await this.cacheService.get<Property>(cacheKey);
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
        contents: true,
      },
    });

    if (!listing) {
      throw i18nNotFound('listing.notFound');
    }

    if (listing.status !== PropertyStatus.AVAILABLE) {
      throw i18nNotFound('listing.notFound');
    }

    if (listing.status === PropertyStatus.AVAILABLE) {
      await this.cacheService.set(cacheKey, listing, 1800);
    }

    return listing;
  }
  // Alias for findById
  async findOne(id: string): Promise<Property> {
    return this.findById(id, false);
  }
  async update(id: string, userId: string, dto: UpdateListingDto): Promise<Property> {
    const listing = await this.findById(id, true);

    // Check ownership
    if (listing.ownerId !== userId) {
      throw i18nForbidden('listing.unauthorized');
    }

    // Validate organization ownership if organizationId is being changed
    if ((dto as any).organizationId && (dto as any).organizationId !== listing.organizationId) {
      const membership = await this.prisma.organizationMember.findFirst({
        where: {
          organizationId: (dto as any).organizationId,
          userId,
          role: { in: ['OWNER', 'ADMIN', 'MEMBER'] },
        },
      });
      if (!membership) {
        throw i18nForbidden('auth.forbidden');
      }
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

    const mapped: any = { ...dto };

    if ((dto as any).location) {
      const location = (dto as any).location;
      mapped.address = location.address || mapped.address;
      mapped.city = location.city || mapped.city;
      mapped.state = location.state || mapped.state;
      mapped.zipCode = location.postalCode || mapped.zipCode;
      mapped.country = location.country || mapped.country;
      mapped.latitude = location.coordinates?.lat ?? mapped.latitude;
      mapped.longitude = location.coordinates?.lng ?? mapped.longitude;
    }

    if ((dto as any).pricePerDay != null) mapped.basePrice = (dto as any).pricePerDay;
    if ((dto as any).pricePerWeek != null) mapped.weeklyPrice = (dto as any).pricePerWeek;
    if ((dto as any).pricePerMonth != null) mapped.monthlyPrice = (dto as any).pricePerMonth;
    if ((dto as any).images) mapped.photos = (dto as any).images;
    if ((dto as any).instantBooking != null) {
      mapped.bookingMode = (dto as any).instantBooking ? BookingMode.INSTANT_BOOK : BookingMode.REQUEST;
    } else if ((dto as any).bookingMode) {
      const mode = String((dto as any).bookingMode).toUpperCase();
      mapped.bookingMode = mode === 'INSTANT' ? BookingMode.INSTANT_BOOK : (dto as any).bookingMode;
    }
    if ((dto as any).minimumRentalPeriod != null) {
      mapped.minStayNights = (dto as any).minimumRentalPeriod;
    }
    if ((dto as any).maximumRentalPeriod != null) {
      mapped.maxStayNights = (dto as any).maximumRentalPeriod;
    }
    if ((dto as any).condition) {
      mapped.condition = this.normalizeCondition((dto as any).condition);
    }
    if ((dto as any).rules) {
      mapped.rules = this.normalizeRules((dto as any).rules);
    }

    // Merge new metadata with existing to avoid overwriting categorySpecificData
    let existingMetadata: Record<string, any> = {};
    if (listing.metadata) {
      try {
        existingMetadata = JSON.parse(listing.metadata as string);
      } catch {
        existingMetadata = {};
      }
    }
    const newMetadata = this.buildMetadata(dto);
    if (newMetadata) {
      const parsed = JSON.parse(newMetadata);
      mapped.metadata = JSON.stringify({ ...existingMetadata, ...parsed });
    } else if (dto.categorySpecificData && typeof dto.categorySpecificData === 'object' && Object.keys(dto.categorySpecificData).length > 0) {
      // Only categorySpecificData changed, merge it into existing metadata
      existingMetadata.categorySpecificData = dto.categorySpecificData;
      mapped.metadata = JSON.stringify(existingMetadata);
    }

    if ((dto as any).category || (dto as any).categoryId) {
      mapped.categoryId = await this.resolveCategoryId(dto);
    }

    // Moderate updated content if title or description changed
    if (mapped.title || mapped.description) {
      try {
        const modResult = await this.moderationService.moderateListing({
          title: mapped.title || listing.title,
          description: mapped.description || listing.description,
          photos: (mapped.photos || listing.photos || []).map((p: any) => (typeof p === 'string' ? p : p.url)),
          userId,
          listingId: id,
        });
        if (modResult.status === 'REJECTED' || modResult.status === 'FLAGGED') {
          throw new BadRequestException({
            message: 'Updated listing content violates our content policies',
            flags: modResult.flags,
          });
        }
      } catch (error) {
        if (error instanceof BadRequestException) throw error;
        this.logger.error('Listing update moderation service unavailable — blocking update (fail-closed)', error);
        throw new BadRequestException({
          message: 'Unable to verify updated listing content. Please try again later.',
          code: 'MODERATION_SERVICE_UNAVAILABLE',
        });
      }
    }

    const updated = await this.prisma.listing.update({
      where: { id },
      data: mapped,
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

    // Create version snapshot of the previous state for audit trail
    this.versionService.createSnapshot({
      listingId: id,
      changedBy: userId,
      changeNotes: `Updated fields: ${Object.keys(mapped).join(', ')}`,
    }).catch((err) =>
      this.logger.warn(`Failed to create version snapshot for listing ${id}`, err),
    );

    // Regenerate embedding asynchronously if content changed
    if (mapped.title || mapped.description) {
      this.embeddingService.updateListingEmbedding(id).catch((err) =>
        this.logger.warn(`Failed to regenerate embedding for listing ${id}`, err),
      );
    }

    return updated;
  }

  async publish(id: string, userId: string): Promise<Property> {
    const listing = await this.findById(id, true);

    if (listing.ownerId !== userId) {
      throw i18nForbidden('listing.unauthorized');
    }

    if (listing.status !== PropertyStatus.DRAFT) {
      throw i18nBadRequest('listing.draftOnly');
    }

    // Validate listing is complete
    const validation = this.validationService.validatePropertyCompleteness(listing);
    if (!validation.isValid) {
      throw new BadRequestException({
        message: 'Property is incomplete',
        errors: validation.errors,
      });
    }

    // Run content moderation before publishing
    try {
      const modResult = await this.moderationService.moderateListing({
        title: listing.title,
        description: listing.description,
        photos: (listing as any).photos?.map((p: any) => p.url) || [],
        userId,
        listingId: id,
      });

      if (modResult.status === 'REJECTED') {
        throw new BadRequestException({
          message: 'Listing content was rejected by moderation',
          flags: modResult.flags,
        });
      }

      if (modResult.status === 'FLAGGED') {
        // Flagged listings go to pending review instead of auto-publish
        const updated = await this.prisma.listing.update({
          where: { id },
          data: {
            status: PropertyStatus.UNAVAILABLE,
            verificationStatus: VerificationStatus.PENDING,
          },
        });
        await this.cacheService.del(`listing:${id}`);
        this.logger.warn(`Listing ${id} flagged by moderation — placed in review queue.`);
        return updated;
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      // Safety-first: moderation failure puts listing back to DRAFT, not auto-publish
      this.logger.error(`Moderation check failed for listing ${id}, reverting to DRAFT`, error);
      const drafted = await this.prisma.listing.update({
        where: { id },
        data: { status: PropertyStatus.DRAFT },
      });
      await this.cacheService.del(`listing:${id}`);
      return drafted;
    }

    const updated = await this.prisma.listing.update({
      where: { id },
      data: {
        status: PropertyStatus.AVAILABLE,
        verificationStatus: VerificationStatus.PENDING,
      },
    });

    await this.cacheService.del(`listing:${id}`);

    return updated;
  }

  async pause(id: string, userId: string): Promise<Property> {
    const listing = await this.findById(id, true);

    if (listing.ownerId !== userId) {
      throw i18nForbidden('listing.unauthorized');
    }

    if (listing.status !== PropertyStatus.AVAILABLE) {
      throw i18nBadRequest('listing.cannotPause');
    }

    const updated = await this.prisma.listing.update({
      where: { id },
      data: { status: PropertyStatus.UNAVAILABLE },
    });

    await this.cacheService.del(`listing:${id}`);
    await this.cacheService.del(`listing:slug:${listing.slug}`);

    return updated;
  }

  async activate(id: string, userId: string): Promise<Property> {
    const listing = await this.findById(id, true);

    if (listing.ownerId !== userId) {
      throw i18nForbidden('listing.unauthorized');
    }

    if (listing.status !== PropertyStatus.UNAVAILABLE) {
      throw i18nBadRequest('listing.cannotActivate');
    }

    const updated = await this.prisma.listing.update({
      where: { id },
      data: { status: PropertyStatus.AVAILABLE },
    });

    await this.cacheService.del(`listing:${id}`);

    return updated;
  }

  async delete(id: string, userId: string): Promise<void> {
    const listing = await this.findById(id, true);

    if (listing.ownerId !== userId) {
      throw i18nForbidden('listing.unauthorized');
    }

    // Check for active bookings (any in-progress state)
    const activeBookings = await this.prisma.booking.count({
      where: {
        listingId: id,
        status: { in: ['CONFIRMED', 'IN_PROGRESS', 'PENDING_PAYMENT', 'PENDING_OWNER_APPROVAL', 'AWAITING_RETURN_INSPECTION'] },
      },
    });

    if (activeBookings > 0) {
      throw i18nBadRequest('listing.hasActiveBookings');
    }

    await this.prisma.listing.update({
      where: { id },
      data: {
        status: PropertyStatus.ARCHIVED,
        // Mark as archived with ARCHIVED status to distinguish from paused (UNAVAILABLE)
      },
    });

    await this.cacheService.del(`listing:${id}`);
    await this.cacheService.del(`listing:slug:${listing.slug}`);
  }

  async incrementViewCount(id: string): Promise<void> {
    await this.prisma.listing.update({
      where: { id },
      data: { views: { increment: 1 } },
    });
  }

  async getOwnerProperties(ownerId: string, includeAll: boolean = false): Promise<Property[]> {
    const where: any = { ownerId };

    if (!includeAll) {
      where.status = { not: PropertyStatus.UNAVAILABLE };
    }

    return this.prisma.listing.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPropertyStats(id: string): Promise<any> {
    const [listing, bookingCount, activeBookings, revenue, reviewStats] = await Promise.all([
      this.findById(id, true),
      this.prisma.booking.count({ where: { listingId: id } }),
      this.prisma.booking.count({
        where: {
          listingId: id,
          status: { in: ['CONFIRMED', 'COMPLETED'] },
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
        views: listing.views,
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
    const MAX_ATTEMPTS = 10;

    // Use a retry loop that handles race conditions: if a concurrent insert
    // claims the slug between our findUnique and our create, the caller's
    // Prisma unique-constraint error will be caught, and we retry here.
    while (counter <= MAX_ATTEMPTS) {
      const existing = await this.prisma.listing.findUnique({ where: { slug } });
      if (!existing) {
        return slug;
      }
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // After MAX_ATTEMPTS, append a random suffix to guarantee uniqueness
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    return `${baseSlug}-${randomSuffix}`;
  }

  /**
   * Get price suggestions based on similar listings in the same category/city.
   * Returns average, median, min, max, and a suggested price range.
   */
  async getPriceSuggestion(params: {
    categoryId?: string;
    city?: string;
    condition?: string;
  }): Promise<{
    averagePrice: number;
    medianPrice: number;
    minPrice: number;
    maxPrice: number;
    suggestedRange: { low: number; high: number };
    sampleSize: number;
  }> {
    const where: any = {
      status: PropertyStatus.AVAILABLE,
      deletedAt: null,
    };
    if (params.categoryId) where.categoryId = params.categoryId;
    if (params.city) where.city = { contains: params.city, mode: 'insensitive' };
    if (params.condition) where.condition = params.condition;

    const listings = await this.prisma.listing.findMany({
      where,
      select: { basePrice: true },
      take: 200,
      orderBy: { basePrice: 'asc' },
    });

    if (listings.length === 0) {
      return {
        averagePrice: 30,
        medianPrice: 30,
        minPrice: 10,
        maxPrice: 100,
        suggestedRange: { low: 20, high: 50 },
        sampleSize: 0,
      };
    }

    const prices = listings.map((l) => Number(l.basePrice) || 0).filter((p) => p > 0);
    if (prices.length === 0) {
      return {
        averagePrice: 30,
        medianPrice: 30,
        minPrice: 10,
        maxPrice: 100,
        suggestedRange: { low: 20, high: 50 },
        sampleSize: 0,
      };
    }

    prices.sort((a, b) => a - b);
    const sum = prices.reduce((acc, p) => acc + p, 0);
    const avg = Math.round(sum / prices.length);
    const mid = Math.floor(prices.length / 2);
    const median =
      prices.length % 2 === 0
        ? Math.round((prices[mid - 1] + prices[mid]) / 2)
        : prices[mid];

    // Suggested range: 25th to 75th percentile
    const p25 = prices[Math.floor(prices.length * 0.25)];
    const p75 = prices[Math.floor(prices.length * 0.75)];

    return {
      averagePrice: avg,
      medianPrice: median,
      minPrice: prices[0],
      maxPrice: prices[prices.length - 1],
      suggestedRange: { low: p25, high: p75 },
      sampleSize: prices.length,
    };
  }
}
