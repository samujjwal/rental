import { Controller, Get, Post, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, CurrentUser } from '@/common/auth';
import { PricingIntelligenceService } from '../services/pricing-intelligence.service';
import { PricingRecommendationQueryDto, AutoAcceptDto } from '../dto/marketplace.dto';

@ApiTags('Marketplace - Dynamic Pricing Intelligence')
@Controller('marketplace/pricing')
export class PricingIntelligenceController {
  constructor(private readonly pricing: PricingIntelligenceService) {}

  @Get('recommendation')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate dynamic pricing recommendation for a listing' })
  @ApiResponse({ status: 200, description: 'Pricing recommendation generated' })
  async getRecommendation(@Query() query: PricingRecommendationQueryDto) {
    return this.pricing.generateRecommendation(
      query.listingId,
      query.targetDate ? new Date(query.targetDate) : new Date(),
    );
  }

  @Get('recommendation/history/:listingId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get pricing recommendation history for a listing' })
  @ApiResponse({ status: 200, description: 'Recommendation history retrieved' })
  async getHistory(@Param('listingId') listingId: string, @Query('days') days?: number) {
    return this.pricing.getRecommendationHistory(listingId, days ?? 30);
  }

  @Post('auto-accept')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Auto-accept pricing recommendations within deviation threshold' })
  @ApiResponse({ status: 200, description: 'Recommendations auto-accepted' })
  async autoAccept(@Body() dto: AutoAcceptDto) {
    return this.pricing.autoAcceptRecommendations(dto.listingId, dto.maxDeviationPercent);
  }
}
