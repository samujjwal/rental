import { Controller, Post, Get, Body, Param, UseGuards, HttpCode, HttpStatus, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '@/common/auth';
import { AiService, GenerateDescriptionDto, GenerateListingSuggestionsDto } from './services/ai.service';
import { MarketInsightsService } from './services/market-insights.service';
import { AiTelemetryInterceptor } from './interceptors/ai-telemetry.interceptor';

@ApiTags('AI')
@Controller('ai')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
// AI generation endpoints are rate-limited more strictly than the global default
// (10 requests per minute per user) to prevent runaway OpenAI spending.
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly marketInsightsService: MarketInsightsService,
  ) {}

  @Post('generate-description')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(AiTelemetryInterceptor)
  @ApiOperation({ summary: 'Generate a listing description using AI' })
  async generateDescription(@Body() dto: GenerateDescriptionDto) {
    return this.aiService.generateListingDescription(dto);
  }

  @Post('listing-suggestions')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(AiTelemetryInterceptor)
  @ApiOperation({
    summary: 'Generate AI suggestions for a partial listing',
    description:
      'Returns an array of improvement suggestions. When the AI provider is ' +
      'unavailable the response is { suggestions: [], fromProvider: false } — ' +
      'callers must render an honest unavailable state rather than falling back to mock data.',
  })
  async generateListingSuggestions(@Body() dto: GenerateListingSuggestionsDto) {
    return this.aiService.generateListingSuggestions(dto);
  }

  @Get('market-insights/:categorySlug')
  @ApiOperation({
    summary: 'Get real market insights for a category',
    description:
      'Returns aggregated price, demand, and feature data computed from live listing records. ' +
      'All values are derived from real platform data — not AI-generated.',
  })
  async getMarketInsights(@Param('categorySlug') categorySlug: string) {
    return this.marketInsightsService.getForCategory(categorySlug);
  }
}
