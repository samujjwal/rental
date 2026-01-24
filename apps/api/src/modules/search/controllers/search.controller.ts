import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { SearchService, SearchQuery } from '../services/search.service';
import { SearchIndexService } from '../services/search-index.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/modules/auth/decorators/roles.decorator';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly indexService: SearchIndexService,
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
  @ApiQuery({
    name: 'sort',
    required: false,
    enum: ['relevance', 'price_asc', 'price_desc', 'rating', 'newest'],
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Search results retrieved' })
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
    @Query('features') features?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: number,
    @Query('size') size?: number,
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

    if (bookingMode || condition || features) {
      searchQuery.filters = {
        bookingMode,
        condition,
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

  // Admin endpoints
  @Post('index/listing/:listingId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Index a specific listing (admin only)' })
  @ApiResponse({ status: 200, description: 'Listing indexed successfully' })
  async indexListing(@Param('listingId') listingId: string) {
    await this.indexService.updateListing(listingId);
    return { success: true, message: 'Listing indexed successfully' };
  }

  @Delete('index/listing/:listingId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove listing from index (admin only)' })
  @ApiResponse({ status: 200, description: 'Listing removed from index' })
  async removeListing(@Param('listingId') listingId: string) {
    await this.indexService.removeListing(listingId);
    return { success: true, message: 'Listing removed from index' };
  }

  @Post('reindex')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Reindex all listings (admin only)' })
  @ApiResponse({ status: 202, description: 'Reindex started' })
  async reindex() {
    // Run in background
    this.indexService.reindexAll().catch((error) => {
      console.error('Reindex failed:', error);
    });

    return {
      success: true,
      message: 'Reindex started in background',
    };
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get search index statistics (admin only)' })
  @ApiResponse({ status: 200, description: 'Index statistics retrieved' })
  async getStats() {
    return this.indexService.getIndexStats();
  }
}

// Add missing decorator import
import { Delete } from '@nestjs/common';
