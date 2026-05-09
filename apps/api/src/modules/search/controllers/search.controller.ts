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
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth, ApiOkResponse, ApiProperty } from '@nestjs/swagger';
import { SearchService, SearchQuery } from '../services/search.service';
import { RecommendationService } from '../services/recommendation.service';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '@/common/auth';
import { UserRole } from '@rental-portal/database';
import { SearchResponseDto } from '../dto/search.dto';
import { IsNumber, IsOptional, Min, Max, IsString, MaxLength, IsBoolean, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

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

export class SearchListingsDto {
  @ApiProperty({ description: 'Search query string', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  query?: string;

  @ApiProperty({ description: 'Category ID filter', required: false })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ description: 'Latitude for location-based search', required: false })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  @Type(() => Number)
  lat?: number;

  @ApiProperty({ description: 'Longitude for location-based search', required: false })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  lon?: number;

  @ApiProperty({ description: 'Radius in km (max 500)', required: false })
  @IsOptional()
  @IsString()
  radius?: string;

  @ApiProperty({ description: 'Minimum price filter', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000000)
  @Type(() => Number)
  minPrice?: number;

  @ApiProperty({ description: 'Maximum price filter', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000000)
  @Type(() => Number)
  maxPrice?: number;

  @ApiProperty({ description: 'Delivery method filter', required: false })
  @IsOptional()
  @IsBoolean()
  delivery?: boolean;

  @ApiProperty({ description: 'Sort order', required: false, enum: ['relevance', 'price_asc', 'price_desc', 'rating', 'newest', 'distance'] })
  @IsOptional()
  @IsString()
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'rating' | 'newest' | 'distance';

  @ApiProperty({ description: 'Page number (max 1000)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  @Type(() => Number)
  page?: number;

  @ApiProperty({ description: 'Results per page (max 100)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  size?: number;

  @ApiProperty({ description: 'Availability start date (ISO 8601)', required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ description: 'Availability end date (ISO 8601)', required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly recommendationService: RecommendationService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Search listings' })
  @ApiOkResponse({ type: SearchResponseDto, description: 'Search results retrieved' })
  async search(@Query() dto: SearchListingsDto) {
    const searchQuery: SearchQuery = {
      query: dto.query,
      categoryId: dto.categoryId,
      page: dto.page,
      size: dto.size,
      sort: dto.sort as any,
    };

    if (dto.lat && dto.lon) {
      searchQuery.location = { lat: dto.lat, lon: dto.lon, radius: dto.radius };
    }

    if (dto.minPrice || dto.maxPrice) {
      searchQuery.priceRange = { min: dto.minPrice, max: dto.maxPrice };
    }

    if (dto.startDate || dto.endDate) {
      searchQuery.dates = {
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
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
  @ApiResponse({ status: 200, description: 'Nearby listings retrieved' })
  async getNearbyListings(@Query() dto: NearbyListingsDto) {
    const radiusKm = dto.radius ?? 10;
    const maxResults = dto.limit ?? 20;

    return this.searchService.search({
      location: {
        lat: dto.lat,
        lon: dto.lng,
        radius: `${radiusKm}km`,
      },
      size: maxResults,
    } as SearchQuery);
  }
}
