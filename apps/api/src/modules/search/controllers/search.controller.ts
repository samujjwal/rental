import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import { SearchService, SearchQuery } from '../services/search.service';
import { RecommendationService } from '../services/recommendation.service';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '@/common/auth';
import { UserRole } from '@rental-portal/database';
import { SearchResponseDto } from '../dto/search.dto';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly recommendationService: RecommendationService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Search listings' })
  @ApiQuery({ name: 'query', required: false, type: String })
  @ApiQuery({ name: 'categoryId', required: false, type: String })
  @ApiQuery({ name: 'lat', required: false, type: Number })
  @ApiQuery({ name: 'lon', required: false, type: Number })
  @ApiQuery({ name: 'radius', required: false, type: String })
  @ApiQuery({ name: 'minPrice', required: false, type: Number })
  @ApiQuery({ name: 'maxPrice', required: false, type: Number })
  @ApiQuery({ name: 'delivery', required: false, type: Boolean })
  @ApiQuery({
    name: 'sort',
    required: false,
    enum: ['relevance', 'price_asc', 'price_desc', 'rating', 'newest', 'distance'],
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'ISO 8601 date for availability start' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'ISO 8601 date for availability end' })
  @ApiOkResponse({ type: SearchResponseDto, description: 'Search results retrieved' })
  async search(
    @Query('query') query?: string,
    @Query('categoryId') categoryId?: string,
    @Query('lat') lat?: number,
    @Query('lon') lon?: number,
    @Query('radius') radius?: string,
    @Query('minPrice') minPrice?: number,
    @Query('maxPrice') maxPrice?: number,
    @Query('bookingMode') bookingMode?: string,
    @Query('condition') condition?: string,
    @Query('delivery') delivery?: string,
    @Query('features') features?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: number,
    @Query('size') size?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const searchQuery: SearchQuery = {
      query,
      categoryId,
      page,
      size,
      sort: sort as any,
    };

    if (lat && lon) {
      searchQuery.location = { lat, lon, radius };
    }

    if (minPrice || maxPrice) {
      searchQuery.priceRange = { min: minPrice, max: maxPrice };
    }

    if (startDate && endDate) {
      const parsedStart = new Date(startDate);
      const parsedEnd = new Date(endDate);
      if (!isNaN(parsedStart.getTime()) && !isNaN(parsedEnd.getTime())) {
        searchQuery.dates = { startDate: parsedStart, endDate: parsedEnd };
      }
    }

    const deliveryEnabled = delivery === 'true' || delivery === '1';
    const normalizedBookingMode = bookingMode
      ? bookingMode.toUpperCase() === 'INSTANT'
        ? 'INSTANT_BOOK'
        : bookingMode.toUpperCase()
      : undefined;

    if (normalizedBookingMode || condition || features || deliveryEnabled) {
      searchQuery.filters = {
        bookingMode: normalizedBookingMode,
        condition,
        delivery: deliveryEnabled,
        features: features ? features.split(',') : undefined,
      };
    }

    return this.searchService.search(searchQuery);
  }

  @Post('advanced')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Advanced search with complex filters' })
  @ApiResponse({ status: 200, description: 'Search results retrieved' })
  async advancedSearch(@Body() searchQuery: SearchQuery) {
    return this.searchService.search(searchQuery);
  }

  @Get('autocomplete')
  @ApiOperation({ summary: 'Autocomplete search suggestions' })
  @ApiQuery({ name: 'q', required: true, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Autocomplete suggestions' })
  async autocomplete(@Query('q') query: string, @Query('limit') limit?: number) {
    return this.searchService.autocomplete(query, limit);
  }

  @Get('suggestions')
  @ApiOperation({ summary: 'Get search suggestions (listings, categories, locations)' })
  @ApiQuery({ name: 'q', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Search suggestions' })
  async getSuggestions(@Query('q') query: string) {
    return this.searchService.getSuggestions(query);
  }

  @Get('similar/:listingId')
  @ApiOperation({ summary: 'Find similar listings' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Similar listings retrieved' })
  async findSimilar(@Param('listingId') listingId: string, @Query('limit') limit?: number) {
    return this.searchService.findSimilar(listingId, limit);
  }

  @Get('popular')
  @ApiOperation({ summary: 'Get popular searches' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Popular searches retrieved' })
  async getPopularSearches(@Query('limit') limit?: number) {
    const searches = await this.searchService.getPopularSearches(limit);
    return { searches };
  }

  @Get('recommendations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get personalized listing recommendations' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Personalized recommendations' })
  async getRecommendations(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: number,
  ) {
    return this.recommendationService.getRecommendations(
      userId,
      limit ? Math.min(Number(limit), 50) : 20,
    );
  }

  // Admin endpoints
  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get search statistics (admin only)' })
  @ApiResponse({ status: 200, description: 'Search statistics retrieved' })
  async getStats() {
    return {
      message: 'Search statistics - PostgreSQL based',
      type: 'postgresql',
    };
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

    if (isNaN(latitude) || isNaN(longitude)) {
      throw new BadRequestException('lat and lng must be valid numbers');
    }

    const radiusKm = radius ? parseFloat(radius) : 10;
    const maxResults = limit ? parseInt(limit, 10) : 20;

    return this.searchService.search({
      location: {
        lat: latitude,
        lon: longitude,
        radius: `${radiusKm}km`,
      },
      size: maxResults,
    } as SearchQuery);
  }
}
