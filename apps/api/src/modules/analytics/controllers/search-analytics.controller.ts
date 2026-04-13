/**
 * Search Analytics Controller
 * 
 * REST API endpoints for search analytics
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SearchAnalyticsService } from '../services/search-analytics.service';
import {
  LogSearchDto,
  GetDashboardDto,
  GetTrendsDto,
  GetTopQueriesDto,
  SearchAnalyticsResponseDto,
} from '../dto/search-analytics.dto';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/modules/auth/decorators/roles.decorator';

@Controller('analytics/search')
export class SearchAnalyticsController {
  constructor(private readonly searchAnalyticsService: SearchAnalyticsService) {}

  @Post('log')
  @HttpCode(HttpStatus.OK)
  async logSearch(@Body() logSearchDto: LogSearchDto): Promise<SearchAnalyticsResponseDto> {
    try {
      await this.searchAnalyticsService.logSearch({
        userId: logSearchDto.userId,
        query: logSearchDto.query,
        filters: logSearchDto.filters || {},
        resultsCount: logSearchDto.resultsCount,
        clickedResults: logSearchDto.clickedResults || [],
        searchDuration: logSearchDto.searchDuration,
        sessionId: logSearchDto.sessionId,
      });

      return {
        success: true,
        data: { message: 'Search logged successfully' },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to log search',
      };
    }
  }

  @Get('dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getDashboard(
    @Query() getDashboardDto: GetDashboardDto,
  ): Promise<SearchAnalyticsResponseDto> {
    try {
      const dashboard = await this.searchAnalyticsService.getAnalyticsDashboard(
        getDashboardDto.startDate,
        getDashboardDto.endDate,
        getDashboardDto.period,
      );

      return {
        success: true,
        data: dashboard,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get dashboard',
      };
    }
  }

  @Get('metrics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getMetrics(
    @Query() getTrendsDto: GetTrendsDto,
  ): Promise<SearchAnalyticsResponseDto> {
    try {
      const metrics = await this.searchAnalyticsService.calculateMetrics(
        getTrendsDto.startDate,
        getTrendsDto.endDate,
      );

      return {
        success: true,
        data: metrics,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get metrics',
      };
    }
  }

  @Get('top-queries')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getTopQueries(
    @Query() getTopQueriesDto: GetTopQueriesDto,
  ): Promise<SearchAnalyticsResponseDto> {
    try {
      const topQueries = await this.searchAnalyticsService.getTopQueries(
        getTopQueriesDto.startDate,
        getTopQueriesDto.endDate,
        getTopQueriesDto.limit,
      );

      return {
        success: true,
        data: topQueries,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get top queries',
      };
    }
  }

  @Get('trending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getTrendingQueries(
    @Query() getTrendsDto: GetTrendsDto,
  ): Promise<SearchAnalyticsResponseDto> {
    try {
      const periodLength = getTrendsDto.endDate.getTime() - getTrendsDto.startDate.getTime();
      const previousStart = new Date(getTrendsDto.startDate.getTime() - periodLength);
      const previousEnd = new Date(getTrendsDto.startDate.getTime());

      const trending = await this.searchAnalyticsService.getTrendingQueries(
        getTrendsDto.startDate,
        getTrendsDto.endDate,
      );

      return {
        success: true,
        data: trending,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get trending queries',
      };
    }
  }

  @Get('realtime')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getRealtimeAnalytics(): Promise<SearchAnalyticsResponseDto> {
    try {
      const realtime = await this.searchAnalyticsService.getRealtimeAnalytics();

      return {
        success: true,
        data: realtime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get realtime analytics',
      };
    }
  }

  @Get('insights')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getInsights(
    @Query() getTrendsDto: GetTrendsDto,
  ): Promise<SearchAnalyticsResponseDto> {
    try {
      const insights = await this.searchAnalyticsService.getSearchInsights(
        getTrendsDto.startDate,
        getTrendsDto.endDate,
      );

      return {
        success: true,
        data: insights,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get insights',
      };
    }
  }
}
