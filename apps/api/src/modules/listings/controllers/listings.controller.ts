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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import {
  ListingsService,
  CreateListingDto,
  UpdateListingDto,
  ListingFilters,
} from '../services/listings.service';
import {
  AvailabilityService,
  CreateAvailabilityDto,
  AvailabilityCheckDto,
} from '../services/availability.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/modules/auth/decorators/roles.decorator';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';

@ApiTags('Listings')
@Controller('listings')
export class ListingsController {
  constructor(
    private readonly listingsService: ListingsService,
    private readonly availabilityService: AvailabilityService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER', 'OWNER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new listing' })
  @ApiResponse({ status: 201, description: 'Listing created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(@CurrentUser('id') userId: string, @Body() dto: CreateListingDto) {
    return this.listingsService.create(userId, dto);
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
    return this.listingsService.findAll(filters || {}, page || 1, limit || 20);
  }

  @Get('my-listings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user listings' })
  @ApiResponse({ status: 200, description: 'Listings retrieved successfully' })
  async getMyListings(@CurrentUser('id') userId: string, @Query('all') all?: boolean) {
    return this.listingsService.getOwnerListings(userId, all === true);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get listing by ID' })
  @ApiResponse({ status: 200, description: 'Listing retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  async findById(@Param('id') id: string) {
    return this.listingsService.findById(id);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get listing by slug' })
  @ApiResponse({ status: 200, description: 'Listing retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  async findBySlug(@Param('slug') slug: string) {
    return this.listingsService.findBySlug(slug);
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
  ) {
    return this.listingsService.update(id, userId, dto);
  }

  @Post(':id/publish')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish listing for review' })
  @ApiResponse({ status: 200, description: 'Listing published successfully' })
  @ApiResponse({ status: 400, description: 'Listing incomplete or not in draft status' })
  @ApiResponse({ status: 403, description: 'Forbidden - not listing owner' })
  async publish(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.listingsService.publish(id, userId);
  }

  @Post(':id/pause')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pause listing' })
  @ApiResponse({ status: 200, description: 'Listing paused successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - not listing owner' })
  async pause(@Param('id') id: string, @CurrentUser('id') userId: string) {
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
  async activate(@Param('id') id: string, @CurrentUser('id') userId: string) {
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
    return this.listingsService.getListingStats(id);
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
    @Body() dto: Omit<CreateAvailabilityDto, 'listingId'>,
  ) {
    return this.availabilityService.createAvailability({ ...dto, listingId });
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
    return this.availabilityService.checkAvailability({ ...dto, listingId });
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
}
