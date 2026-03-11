import { Controller, Get, Post, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, CurrentUser } from '@/common/auth';
import { MultiModalSearchService } from '../services/multi-modal-search.service';
import { MarketplaceSearchDto, RecordClickDto, SearchAnalyticsQueryDto } from '../dto/marketplace.dto';

@ApiTags('Marketplace - Multi-Modal Search')
@Controller('marketplace/search')
export class MarketplaceSearchController {
  constructor(private readonly searchService: MultiModalSearchService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Execute multi-modal marketplace search (text, map, semantic)' })
  @ApiResponse({ status: 200, description: 'Search results returned' })
  async search(@CurrentUser('id') userId: string, @Body() dto: MarketplaceSearchDto) {
    return this.searchService.search({
      ...dto,
      userId,
      filters: dto.filters
        ? {
            ...dto.filters,
            startDate: dto.filters.startDate ? new Date(dto.filters.startDate) : undefined,
            endDate: dto.filters.endDate ? new Date(dto.filters.endDate) : undefined,
          }
        : undefined,
    });
  }

  @Post('click')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Record a search result click for analytics' })
  async recordClick(@Body() dto: RecordClickDto) {
    await this.searchService.recordClick(dto.searchEventId, dto.listingId);
  }

  @Post('conversion')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Record a search-to-booking conversion' })
  async recordConversion(@Body() dto: RecordClickDto) {
    await this.searchService.recordConversion(dto.searchEventId, dto.listingId);
  }

  @Get('analytics')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get search analytics and metrics' })
  @ApiResponse({ status: 200, description: 'Analytics data returned' })
  async getAnalytics(@Query() query: SearchAnalyticsQueryDto) {
    return this.searchService.getSearchAnalytics(query.country, query.days);
  }

  @Get('personalization/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user personalization signals' })
  @ApiResponse({ status: 200, description: 'Personalization signals returned' })
  async getPersonalization(@Param('userId') userId: string) {
    return this.searchService.getPersonalizationSignals(userId);
  }
}
