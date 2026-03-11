import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, CurrentUser } from '@/common/auth';
import { AnalyticsService } from '../services/analytics.service';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('performance')
  @ApiOperation({ summary: 'Get owner performance metrics' })
  async getPerformanceMetrics(
    @CurrentUser('id') userId: string,
    @Query('period') period?: string,
  ) {
    return this.analyticsService.getPerformanceMetrics(userId, period);
  }

  @Get('insights')
  @ApiOperation({ summary: 'Get owner business insights' })
  async getInsights(@CurrentUser('id') userId: string) {
    return this.analyticsService.getInsights(userId);
  }
}
