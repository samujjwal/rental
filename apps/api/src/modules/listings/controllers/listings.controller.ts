import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Inject,
  forwardRef,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UserRole } from '@rental-portal/database';
import { PropertyStatus } from '@rental-portal/database';
import {
  PropertysService,
  ListingFilters,
} from '../services/listings.service';
import { CreateListingDto, UpdateListingDto } from '../dto/listing.dto';
import {
  AvailabilityService,
  CreateAvailabilityDto,
  AvailabilityCheckDto,
} from '../services/availability.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/modules/auth/decorators/roles.decorator';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { SearchService, SearchQuery } from '@/modules/search/services/search.service';

type AsyncMethodResult<T extends (...args: any[]) => Promise<any>> = Awaited<ReturnType<T>>;

@ApiTags('Listings')
@Controller('listings')
export class ListingsController {
  constructor(
    private readonly listingsService: PropertysService,
    private readonly availabilityService: AvailabilityService,
    @Inject(forwardRef(() => SearchService))
    private readonly searchService: SearchService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER, UserRole.HOST, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new listing' })
  @ApiResponse({ status: 201, description: 'Listing created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateListingDto,
  ): Promise<AsyncMethodResult<PropertysService['create']>> {
    return this.listingsService.create(userId, dto);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search listings' })
  @ApiQuery({ name: 'query', required: false, type: String })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'location', required: false, type: String })
  @ApiQuery({ name: 'minPrice', required: false, type: Number })
  @ApiQuery({ name: 'maxPrice', required: false, type: Number })
  @ApiQuery({ name: 'delivery', required: false, type: Boolean })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Search results retrieved successfully' })
  async searchListings(
    @Query('query') query?: string,
    @Query('category') categoryId?: string,
    @Query('location') location?: string,
    @Query('minPrice') minPrice?: number,
    @Query('maxPrice') maxPrice?: number,
    @Query('condition') condition?: string,
    @Query('instantBooking') instantBooking?: boolean,
    @Query('delivery') delivery?: string | boolean,
    @Query('sortBy') sortBy?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const searchQuery: SearchQuery = {
      query,
      categoryId,
      page: page || 1,
      size: limit || 20,
      sort: sortBy as any,
    };

    if (location) {
      searchQuery.location = { city: location };
    }

    if (minPrice || maxPrice) {
      searchQuery.priceRange = { min: minPrice, max: maxPrice };
    }

    const deliveryEnabled = delivery === true || delivery === 'true' || delivery === '1';

    if (condition || instantBooking || deliveryEnabled) {
      searchQuery.filters = {
        condition,
        bookingMode: instantBooking ? 'INSTANT_BOOK' : undefined,
        delivery: deliveryEnabled,
      };
    }

    const result = await this.searchService.search(searchQuery);
    
    // Transform to match frontend expectation
    return {
      listings: result.results.map((listing) => ({
        id: listing.id,
        title: listing.title,
        description: listing.description,
        slug: listing.slug,
        category: listing.categoryName,
        categorySlug: listing.categorySlug,
        images: listing.photos,
        location: {
          city: listing.city,
          state: listing.state,
          country: listing.country,
          lat: listing.location?.lat,
          lon: listing.location?.lon,
        },
        pricePerDay: Number(listing.basePrice),
        currency: listing.currency,
        rating: listing.averageRating,
        totalReviews: listing.totalReviews,
        owner: {
          name: listing.ownerName,
          rating: listing.ownerRating,
        },
        instantBooking: listing.bookingMode === 'INSTANT_BOOK',
        condition: listing.condition,
        features: listing.features || [],
        deliveryOptions: {
          pickup: true,
          delivery: false,
          shipping: false,
        },
      })),
      total: result.total,
      page: result.page,
      limit: result.size,
      totalPages: Math.ceil(result.total / result.size),
    };
  }

  @Get()
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
    const listings = await this.listingsService.getOwnerPropertys(
      userId,
      all === true,
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

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get listing by slug' })
  @ApiResponse({ status: 200, description: 'Listing retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  async findBySlug(@Param('slug') slug: string) {
    const listing = await this.listingsService.findBySlug(slug);
    return this.mapToFrontendListing(listing);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get listing by ID' })
  @ApiResponse({ status: 200, description: 'Listing retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  async findById(@Param('id') id: string) {
    const listing = await this.listingsService.findById(id);
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
      status: listing.status,
      availability,
      features: listing.features || [],
      rating: listing.averageRating || 0,
      totalReviews: listing.totalReviews || 0,
      totalBookings: listing.totalBookings || 0,
      bookingsCount: listing.totalBookings || 0,
      views: listing.views || listing.viewCount || 0,
      featured: listing.featured || false,
      verified: listing.verificationStatus === 'VERIFIED',
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
  ): Promise<AsyncMethodResult<PropertysService['update']>> {
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
  ): Promise<AsyncMethodResult<PropertysService['publish']>> {
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
  ): Promise<AsyncMethodResult<PropertysService['pause']>> {
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
  ): Promise<AsyncMethodResult<PropertysService['activate']>> {
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
  async createAvailability(
    @Param('id') listingId: string,
    @Body() dto: Omit<CreateAvailabilityDto, 'propertyId'>,
  ) {
    return this.availabilityService.createAvailability({ ...dto, propertyId: listingId });
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
    @Body() dto: Omit<AvailabilityCheckDto, 'propertyId'>,
  ) {
    const result = await this.availabilityService.checkAvailability({
      ...dto,
      propertyId: listingId,
    });

    const blockedDates =
      result.conflicts?.flatMap((conflict) => [
        conflict.startDate.toISOString(),
        conflict.endDate.toISOString(),
      ]) || [];

    return {
      available: result.isAvailable,
      blockedDates,
      availableDates: [],
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
  async updateAvailability(
    @Param('id') listingId: string,
    @Body() dto: Omit<CreateAvailabilityDto, 'propertyId'>,
  ) {
    return this.availabilityService.createAvailability({ ...dto, propertyId: listingId });
  }

  @Post(':id/images')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload images for a listing' })
  @ApiResponse({ status: 200, description: 'Images uploaded' })
  async uploadImages(
    @Param('id') listingId: string,
    @CurrentUser('id') userId: string,
    @Body('urls') urls: string[],
  ) {
    const listing = await this.listingsService.findOne(listingId);
    if (!listing) throw new NotFoundException('Listing not found');
    const existingImages = Array.isArray(listing.photos) ? listing.photos : [];
    const updatedImages = [...existingImages, ...(urls || [])];
    await this.listingsService.update(listingId, userId, { images: updatedImages });
    return { images: updatedImages };
  }

  @Delete(':id/images')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete images from a listing' })
  @ApiResponse({ status: 200, description: 'Images removed' })
  async deleteImages(
    @Param('id') listingId: string,
    @CurrentUser('id') userId: string,
    @Body('urls') urls: string[],
  ) {
    const listing = await this.listingsService.findOne(listingId);
    if (!listing) throw new NotFoundException('Listing not found');
    const existingImages = Array.isArray(listing.photos) ? listing.photos : [];
    const updatedImages = existingImages.filter((img: string) => !urls.includes(img));
    await this.listingsService.update(listingId, userId, { images: updatedImages });
    return { images: updatedImages };
  }

  @Get('nearby')
  @ApiOperation({ summary: 'Get nearby listings by coordinates' })
  @ApiQuery({ name: 'lat', required: true, type: Number })
  @ApiQuery({ name: 'lng', required: true, type: Number })
  @ApiQuery({ name: 'radius', required: false, type: Number, description: 'Radius in km (default 10)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max results (default 20)' })
  @ApiResponse({ status: 200, description: 'Nearby listings retrieved' })
  async getNearbyListings(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius?: string,
    @Query('limit') limit?: string,
  ) {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const radiusKm = radius ? parseFloat(radius) : 10;
    const maxResults = limit ? parseInt(limit, 10) : 20;

    // Haversine-based search using raw SQL for distance calculation
    return this.searchService.search({
      latitude,
      longitude,
      radius: radiusKm,
      limit: maxResults,
    } as SearchQuery);
  }
}
