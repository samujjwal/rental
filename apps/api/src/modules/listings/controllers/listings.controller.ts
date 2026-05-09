import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  ParseArrayPipe,
  HttpCode,
  HttpStatus,
  Inject,
  forwardRef,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiProperty, ApiConsumes } from '@nestjs/swagger';
import { UserRole } from '@rental-portal/database';
import { PropertyStatus } from '@rental-portal/database';
import { IsNumber, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import {
  ListingsService,
  ListingFilters,
} from '../services/listings.service';
import { CreateListingDto, UpdateListingDto } from '../dto/listing.dto';
import { AvailabilityService,
  CreateAvailabilityDto,
  AvailabilityCheckDto,
} from '../services/availability.service';
import { OrganizationScopeService } from '@/common/authorization/organization-scope.service';

export class NearbyListingsDto {
  @ApiProperty({ description: 'Latitude', required: true })
  @IsNumber()
  @Min(-90)
  @Max(90)
  @Type(() => Number)
  lat: number;

  @ApiProperty({ description: 'Longitude', required: true })
  @IsNumber()
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  lng: number;

  @ApiProperty({ description: 'Radius in km (max 100, default 10)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(100)
  @Type(() => Number)
  radius?: number;

  @ApiProperty({ description: 'Max results (max 100, default 20)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;
}
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '@/modules/auth/guards/optional-jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/modules/auth/decorators/roles.decorator';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { Idempotent } from '@/common/guards/idempotency.guard';
import { SearchService, SearchQuery } from '@/modules/search/services/search.service';
import { ListingCompletenessService } from '../services/listing-completeness.service';

type AsyncMethodResult<T extends (...args: any[]) => Promise<any>> = Awaited<ReturnType<T>>;

@ApiTags('Listings')
@Controller('listings')
export class ListingsController {
  constructor(
    private readonly listingsService: ListingsService,
    private readonly availabilityService: AvailabilityService,
    private readonly completenessService: ListingCompletenessService,
    private readonly searchService: SearchService,
    private readonly organizationScopeService: OrganizationScopeService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER, UserRole.HOST, UserRole.ADMIN)
  @Idempotent()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new listing' })
  @ApiResponse({ status: 201, description: 'Listing created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateListingDto,
  ): Promise<AsyncMethodResult<ListingsService['create']>> {
    return this.listingsService.create(userId, dto);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get all listings' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'categoryId', required: false, type: String })
  @ApiQuery({ name: 'city', required: false, type: String })
  @ApiQuery({ name: 'country', required: false, type: String })
  @ApiQuery({ name: 'minPrice', required: false, type: Number })
  @ApiQuery({ name: 'maxPrice', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Listings retrieved successfully' })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query() filters?: ListingFilters,
  ) {
    const result = await this.listingsService.findAll(
      filters || {},
      page || 1,
      limit || 20,
    );
    return {
      ...result,
      listings: result.listings.map((l) => this.mapToFrontendListing(l)),
    };
  }

  @Get('my-listings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user listings' })
  @ApiResponse({ status: 200, description: 'Listings retrieved successfully' })
  async getMyListings(
    @CurrentUser('id') userId: string,
    @Query('all') all?: boolean,
  ) {
    const listings = await this.listingsService.getOwnerProperties(
      userId,
      all === true,
    );
    return listings.map((l) => this.mapToFrontendListing(l));
  }

  @Get('user/:userId')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get public listings for a specific user (public-safe endpoint)' })
  @ApiQuery({ name: 'all', required: false, type: Boolean, description: 'Include all statuses (owner only)' })
  @ApiResponse({ status: 200, description: 'User listings retrieved successfully' })
  async getUserListings(
    @Param('userId') userId: string,
    @Query('all') all?: boolean,
    @CurrentUser('id') currentUserId?: string,
  ) {
    // Only the owner themselves can request 'all' statuses
    const includeAll = all === true && currentUserId === userId;

    const listings = await this.listingsService.getOwnerProperties(
      userId,
      includeAll,
    );
    return listings.map((l) => this.mapToFrontendListing(l));
  }

  @Get('featured')
  @ApiOperation({ summary: 'Get featured listings' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Featured listings retrieved successfully' })
  async getFeaturedListings(@Query('limit') limit?: number) {
    const result = await this.listingsService.findAll(
      { featured: true, status: PropertyStatus.AVAILABLE },
      1,
      limit || 8,
    );
    return {
      ...result,
      listings: result.listings.map((l) => this.mapToFrontendListing(l)),
    };
  }

  @Get('price-suggestion')
  @ApiOperation({ summary: 'Get price suggestion based on similar listings' })
  @ApiQuery({ name: 'categoryId', required: false, type: String })
  @ApiQuery({ name: 'city', required: false, type: String })
  @ApiQuery({ name: 'condition', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Price suggestion retrieved successfully' })
  async getPriceSuggestion(
    @Query('categoryId') categoryId?: string,
    @Query('city') city?: string,
    @Query('condition') condition?: string,
  ) {
    return this.listingsService.getPriceSuggestion({ categoryId, city, condition });
  }

  @Get(':id/completeness')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get listing completeness score' })
  @ApiResponse({ status: 200, description: 'Completeness score retrieved' })
  async getCompleteness(@Param('id') id: string) {
    return this.completenessService.getCompleteness(id);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get listing by slug' })
  @ApiResponse({ status: 200, description: 'Listing retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  async findBySlug(@Param('slug') slug: string) {
    const listing = await this.listingsService.findBySlug(slug);
    return this.mapToFrontendListing(listing);
  }

  private mapToFrontendListing(listing: any) {
    let metadata: Record<string, any> = {};
    if (listing.metadata) {
      try {
        metadata = JSON.parse(listing.metadata);
      } catch {
        metadata = {};
      }
    }

    const availability =
      listing.status === 'AVAILABLE'
        ? 'available'
        : listing.status === 'RENTED'
          ? 'rented'
          : listing.status === 'MAINTENANCE'
            ? 'maintenance'
            : 'unavailable';

    return {
      id: listing.id,
      ownerId: listing.ownerId,
      title: listing.title,
      description: listing.description,
      category: listing.category?.name || 'Uncategorized',
      categoryId: listing.categoryId || listing.category?.id || null,
      subcategory: metadata.subcategory || null,
      pricePerDay: Number(listing.basePrice),
      basePrice: Number(listing.basePrice),
      currency: listing.currency,
      condition: listing.condition?.toLowerCase() || 'good',
      location: {
        address: listing.address,
        city: listing.city,
        state: listing.state,
        country: listing.country,
        postalCode: listing.zipCode,
        coordinates: {
          lat: listing.latitude,
          lng: listing.longitude,
        },
      },
      images: listing.photos || listing.images || [],
      photos: listing.photos || listing.images || [],
      pricePerWeek: listing.weeklyDiscount
        ? Math.round(Number(listing.basePrice) * 7 * (1 - listing.weeklyDiscount / 100))
        : null,
      pricePerMonth: listing.monthlyDiscount
        ? Math.round(Number(listing.basePrice) * 30 * (1 - listing.monthlyDiscount / 100))
        : null,
      status: listing.status,
      availability,
      features: listing.features || [],
      rating: listing.averageRating || 0,
      totalReviews: listing.totalReviews || 0,
      totalBookings: listing.totalBookings || 0,
      bookingsCount: listing.totalBookings || 0,
      views: listing.views || listing.viewCount || 0,
      featured: listing.featured || false,
      verified: ['VERIFIED', 'APPROVED'].includes(listing.verificationStatus),
      verificationStatus: listing.verificationStatus || null,
      rejectionReason:
        typeof metadata.rejectionReason === 'string'
          ? metadata.rejectionReason
          : null,
      instantBooking:
        listing.bookingMode === 'INSTANT_BOOK' || listing.instantBookable,
      deliveryOptions: metadata.deliveryOptions || {
        pickup: true,
        delivery: false,
        shipping: false,
      },
      deliveryRadius: metadata.deliveryRadius ?? null,
      deliveryFee: metadata.deliveryFee ?? null,
      securityDeposit: Number(listing.securityDeposit || 0),
      minimumRentalPeriod: metadata.minimumRentalPeriod || listing.minStayNights || 1,
      maximumRentalPeriod: metadata.maximumRentalPeriod || listing.maxStayNights || null,
      cancellationPolicy:
        metadata.cancellationPolicy ||
        listing.cancellationPolicy?.name?.toLowerCase() ||
        'flexible',
      rules: Array.isArray(listing.rules) ? listing.rules.join('\n') : listing.rules || '',
      categorySlug: listing.category?.slug || null,
      categorySpecificData: metadata.categorySpecificData || {},
      owner: {
        id: listing.owner?.id,
        firstName: listing.owner?.firstName,
        lastName: listing.owner?.lastName,
        avatar: listing.owner?.profilePhotoUrl,
        rating: listing.owner?.averageRating,
        verified: listing.owner?.idVerificationStatus === 'VERIFIED',
      },
      createdAt: listing.createdAt,
      updatedAt: listing.updatedAt,
    };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update listing' })
  @ApiResponse({ status: 200, description: 'Listing updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - not listing owner' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  async update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateListingDto,
  ): Promise<AsyncMethodResult<ListingsService['update']>> {
    return this.listingsService.update(id, userId, dto as any);
  }

  @Post(':id/publish')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish listing for review' })
  @ApiResponse({ status: 200, description: 'Listing published successfully' })
  @ApiResponse({ status: 400, description: 'Listing incomplete or not in draft status' })
  @ApiResponse({ status: 403, description: 'Forbidden - not listing owner' })
  async publish(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ): Promise<AsyncMethodResult<ListingsService['publish']>> {
    return this.listingsService.publish(id, userId);
  }

  @Post(':id/pause')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pause listing' })
  @ApiResponse({ status: 200, description: 'Listing paused successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - not listing owner' })
  async pause(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ): Promise<AsyncMethodResult<ListingsService['pause']>> {
    return this.listingsService.pause(id, userId);
  }

  @Post(':id/activate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate listing' })
  @ApiResponse({ status: 200, description: 'Listing activated successfully' })
  @ApiResponse({ status: 400, description: 'Listing not verified' })
  @ApiResponse({ status: 403, description: 'Forbidden - not listing owner' })
  async activate(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ): Promise<AsyncMethodResult<ListingsService['activate']>> {
    return this.listingsService.activate(id, userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete (archive) listing' })
  @ApiResponse({ status: 204, description: 'Listing archived successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete listing with active bookings' })
  @ApiResponse({ status: 403, description: 'Forbidden - not listing owner' })
  async delete(@Param('id') id: string, @CurrentUser('id') userId: string) {
    await this.listingsService.delete(id, userId);
  }

  @Get(':id/stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get listing statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getStats(@Param('id') id: string) {
    return this.listingsService.getPropertyStats(id);
  }

  @Post(':id/view')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Increment listing view count' })
  @ApiResponse({ status: 204, description: 'View count incremented' })
  async incrementView(@Param('id') id: string) {
    await this.listingsService.incrementViewCount(id);
  }

  // Availability endpoints
  @Post(':id/availability')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create availability rule for listing' })
  @ApiResponse({ status: 201, description: 'Availability rule created' })
  @ApiResponse({ status: 403, description: 'Forbidden - not listing owner or authorized org member' })
  async createAvailability(
    @Param('id') listingId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
    @Body() dto: Omit<CreateAvailabilityDto, 'listingId'>,
  ) {
    return this.availabilityService.createAvailability(
      { ...dto, listingId },
      userId,
      userRole,
    );
  }

  @Get(':id/availability')
  @ApiOperation({ summary: 'Get listing availability' })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Availability retrieved successfully' })
  async getAvailability(
    @Param('id') listingId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.availabilityService.getListingAvailability(
      listingId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Post(':id/check-availability')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check if listing is available for booking' })
  @ApiResponse({ status: 200, description: 'Availability check completed' })
  async checkAvailability(
    @Param('id') listingId: string,
    @Body() dto: Omit<AvailabilityCheckDto, 'listingId'>,
  ) {
    const result = await this.availabilityService.checkAvailability({
      ...dto,
      listingId,
    });

    const blockedDates =
      result.conflicts?.flatMap((conflict) => [
        conflict.startTime.toISOString(),
        conflict.endTime.toISOString(),
      ]) || [];

    return {
      available: result.isAvailable,
      blockedDates,
      availableDates: [] as any[],
      message: result.isAvailable
        ? 'Listing is available for selected dates'
        : result.conflicts?.[0]?.reason || 'Listing is not available for selected dates',
    };
  }

  @Get(':id/available-dates')
  @ApiOperation({ summary: 'Get all available dates in range' })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Available dates retrieved successfully' })
  async getAvailableDates(
    @Param('id') listingId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.availabilityService.getAvailableDates(
      listingId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Patch(':id/availability')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update listing availability (alias for POST)' })
  @ApiResponse({ status: 200, description: 'Availability updated' })
  @ApiResponse({ status: 403, description: 'Forbidden - not listing owner or authorized org member' })
  async updateAvailability(
    @Param('id') listingId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
    @Body() dto: Omit<CreateAvailabilityDto, 'listingId'>,
  ) {
    return this.availabilityService.createAvailability(
      { ...dto, listingId },
      userId,
      userRole,
    );
  }

  @Post(':id/check-and-reserve')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atomically check and reserve availability for booking' })
  @ApiResponse({ status: 200, description: 'Availability checked and reserved' })
  async checkAndReserve(
    @Param('id') listingId: string,
    @Body() dto: { startDate: string | Date; endDate: string | Date; inventoryUnitId?: string },
  ) {
    return this.availabilityService.checkAndReserve(
      listingId,
      new Date(dto.startDate),
      new Date(dto.endDate),
      dto.inventoryUnitId,
    );
  }

  @Post(':id/release-reservation')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Release a previously reserved time slot' })
  @ApiResponse({ status: 200, description: 'Reservation released' })
  async releaseReservation(
    @Param('id') listingId: string,
    @Body() dto: { startDate: string | Date; endDate: string | Date; inventoryUnitId?: string },
  ) {
    return this.availabilityService.releaseReservation(
      listingId,
      new Date(dto.startDate),
      new Date(dto.endDate),
      dto.inventoryUnitId,
    );
  }

  @Post(':id/confirm-reservation')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm a reservation as booked' })
  @ApiResponse({ status: 200, description: 'Reservation confirmed' })
  async confirmReservation(
    @Param('id') listingId: string,
    @Body() dto: { startDate: string | Date; endDate: string | Date; bookingId: string; inventoryUnitId?: string },
  ) {
    return this.availabilityService.confirmReservation(
      listingId,
      new Date(dto.startDate),
      new Date(dto.endDate),
      dto.bookingId,
      dto.inventoryUnitId,
    );
  }

  @Get(':id/availability-summary')
  @ApiOperation({ summary: 'Get availability summary for a date range' })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Availability summary retrieved' })
  async getAvailabilitySummary(
    @Param('id') listingId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.availabilityService.getAvailabilitySummary(
      listingId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Post(':id/images')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload images for a listing (canonical multipart endpoint)' })
  @ApiResponse({ status: 200, description: 'Images uploaded successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - not listing owner' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('images', 20, { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadImages(
    @Param('id') listingId: string,
    @CurrentUser('id') userId: string,
    @Req() req: any,
  ) {
    const files = req.files as any[];
    const listing = await this.listingsService.findOne(listingId);
    if (!listing) throw new NotFoundException('Listing not found');
    
    // Use organization scope resolver for authorization
    await this.organizationScopeService.requireScope(userId, 'USER', {
      resourceType: 'listing',
      resourceId: listingId,
      ownerId: listing.ownerId,
      organizationId: listing.organizationId,
    });

    // Validate files
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    const validFiles = files.filter((file) => {
      if (!file.mimetype || !validImageTypes.includes(file.mimetype)) {
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) {
      throw new BadRequestException('No valid image files provided. Allowed types: JPEG, PNG, WebP, GIF (max 10MB each)');
    }

    // Upload files using storage service
    const { StorageService } = await import('@/common/storage/storage.service');
    const storageService = new StorageService(this.listingsService['configService']);

    const uploadPromises = validFiles.map(async (file) => {
      return storageService.uploadListingImage(
        file.buffer,
        file.originalname,
        file.mimetype,
      );
    });

    const uploadResults = await Promise.all(uploadPromises);
    const newImageUrls = uploadResults.map((result) => result.url);

    // Update listing with new image URLs
    const existingImages = Array.isArray(listing.photos) ? listing.photos : [];
    const updatedImages = [...existingImages, ...newImageUrls];

    await this.listingsService.update(listingId, userId, { images: updatedImages });

    return { images: updatedImages, uploaded: newImageUrls };
  }

  @Delete(':id/images')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete images from a listing' })
  @ApiResponse({ status: 200, description: 'Images removed' })
  @ApiResponse({ status: 403, description: 'Forbidden - not listing owner' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  async deleteImages(
    @Param('id') listingId: string,
    @CurrentUser('id') userId: string,
    @Body('urls') urls: string[],
  ) {
    const listing = await this.listingsService.findOne(listingId);
    if (!listing) throw new NotFoundException('Listing not found');
    
    // Use organization scope resolver for authorization
    await this.organizationScopeService.requireScope(userId, 'USER', {
      resourceType: 'listing',
      resourceId: listingId,
      ownerId: listing.ownerId,
      organizationId: listing.organizationId,
    });
    // Validate URLs
    if (!Array.isArray(urls)) {
      throw new BadRequestException('urls must be an array');
    }
    const existingImages = Array.isArray(listing.photos) ? listing.photos : [];
    const updatedImages = existingImages.filter((img: string) => !urls.includes(img));
    await this.listingsService.update(listingId, userId, { images: updatedImages });
    return { images: updatedImages };
  }

  @Get('nearby')
  @ApiOperation({ summary: 'Get nearby listings by coordinates' })
  @ApiResponse({ status: 200, description: 'Nearby listings retrieved' })
  async getNearbyListings(@Query() dto: NearbyListingsDto) {
    const radiusKm = dto.radius ?? 10;
    const maxResults = dto.limit ?? 20;

    // Haversine-based search using raw SQL for distance calculation
    return this.searchService.search({
      latitude: dto.lat,
      longitude: dto.lng,
      radius: radiusKm,
      limit: maxResults,
    } as SearchQuery);
  }

  // IMPORTANT: This route must be LAST to avoid conflicts with nested routes like :id/stats, :id/availability, etc.
  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get listing by ID' })
  @ApiResponse({ status: 200, description: 'Listing retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  async findById(@Param('id') id: string, @Req() req: any) {
    // Optionally use authenticated user context to allow owners/admins to see their own non-AVAILABLE listings
    const user = req.user as { id?: string; role?: string } | undefined;
    const listing = await this.listingsService.findById(id, false, user?.id, user?.role);
    return this.mapToFrontendListing(listing);
  }
}
