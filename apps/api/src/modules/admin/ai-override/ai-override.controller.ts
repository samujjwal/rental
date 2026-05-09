/**
 * AI Override Controller
 *
 * Provides REST API endpoints for AI suggestion management:
 * - Get pending suggestions
 * - Review and override suggestions
 * - Get audit trail
 * - Get statistics
 *
 * All sensitive actions require MFA verification for admin users.
 */

import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RolesGuard } from '@/common/auth/guards/roles.guard';
import { MfaGuard, RequireMFA } from '@/modules/auth/guards/mfa.guard';
import { Roles } from '@/common/auth/decorators/roles.decorator';
import { AIOverrideService, AISuggestion, CreateSuggestionDto, OverrideSuggestionDto } from './ai-override.service';

@ApiTags('admin-ai-override')
@Controller('admin/ai-override')
@UseGuards(RolesGuard, MfaGuard)
@ApiBearerAuth()
@Roles('ADMIN', 'SUPER_ADMIN', 'OPERATIONS_ADMIN')
export class AIOverrideController {
  constructor(private readonly aiOverrideService: AIOverrideService) {}

  /**
   * Get all pending AI suggestions
   */
  @Get('suggestions/pending')
  @ApiOperation({ summary: 'Get all pending AI suggestions' })
  async getPendingSuggestions(@Query('type') type?: AISuggestion['type']): Promise<AISuggestion[]> {
    return this.aiOverrideService.getPendingSuggestions(type);
  }

  /**
   * Get suggestions for a specific entity
   */
  @Get('suggestions/entity/:entityType/:entityId')
  @ApiOperation({ summary: 'Get suggestions for a specific entity' })
  async getEntitySuggestions(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ): Promise<AISuggestion[]> {
    return this.aiOverrideService.getEntitySuggestions(entityId, entityType);
  }

  /**
   * Get a specific suggestion
   */
  @Get('suggestions/:id')
  @ApiOperation({ summary: 'Get a specific AI suggestion' })
  async getSuggestion(@Param('id') id: string): Promise<AISuggestion | null> {
    return this.aiOverrideService.getSuggestion(id);
  }

  /**
   * Review and override/approve/reject a suggestion - REQUIRES MFA
   */
  @Post('suggestions/:id/review')
  @RequireMFA()
  @ApiOperation({ summary: 'Review and override/approve/reject a suggestion (MFA required)' })
  async reviewSuggestion(
    @Param('id') id: string,
    @Body() dto: OverrideSuggestionDto,
  ): Promise<AISuggestion> {
    // In a real implementation, adminId would come from the authenticated user
    const adminId = 'current_admin';
    return this.aiOverrideService.reviewSuggestion(id, dto, adminId);
  }

  /**
   * Get audit trail for overrides
   */
  @Get('overrides/history')
  @ApiOperation({ summary: 'Get audit trail for overrides' })
  async getOverrideHistory(
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('limit') limit?: number,
  ): Promise<AISuggestion[]> {
    return this.aiOverrideService.getOverrideHistory(
      entityType as AISuggestion['entityType'],
      entityId,
      limit,
    );
  }

  /**
   * Get AI suggestion statistics
   */
  @Get('stats')
  @ApiOperation({ summary: 'Get AI suggestion statistics' })
  async getSuggestionStats(): Promise<{
    total: number;
    pending: number;
    approved: number;
    overridden: number;
    rejected: number;
    byType: Record<string, number>;
  }> {
    return this.aiOverrideService.getSuggestionStats();
  }

  /**
   * Create a new AI suggestion - REQUIRES MFA
   */
  @Post('suggestions')
  @RequireMFA()
  @ApiOperation({ summary: 'Create a new AI suggestion (MFA required)' })
  async createSuggestion(@Body() dto: CreateSuggestionDto): Promise<AISuggestion> {
    const adminId = 'current_admin';
    return this.aiOverrideService.createSuggestion(dto, adminId);
  }

  /**
   * Generate fraud detection suggestion - REQUIRES MFA
   */
  @Post('generate/fraud-detection/:bookingId')
  @RequireMFA()
  @ApiOperation({ summary: 'Generate fraud detection suggestion (MFA required)' })
  async generateFraudDetection(
    @Param('bookingId') bookingId: string,
    @Body() bookingData: any,
  ): Promise<AISuggestion> {
    return this.aiOverrideService.generateFraudDetection(bookingId, bookingData);
  }

  /**
   * Generate dispute resolution suggestion - REQUIRES MFA
   */
  @Post('generate/dispute-resolution/:disputeId')
  @RequireMFA()
  @ApiOperation({ summary: 'Generate dispute resolution suggestion (MFA required)' })
  async generateDisputeResolution(
    @Param('disputeId') disputeId: string,
    @Body() disputeData: any,
  ): Promise<AISuggestion> {
    return this.aiOverrideService.generateDisputeResolution(disputeId, disputeData);
  }

  /**
   * Generate pricing recommendation - REQUIRES MFA
   */
  @Post('generate/pricing-recommendation/:listingId')
  @RequireMFA()
  @ApiOperation({ summary: 'Generate pricing recommendation (MFA required)' })
  async generatePricingRecommendation(
    @Param('listingId') listingId: string,
    @Body() listingData: any,
  ): Promise<AISuggestion> {
    return this.aiOverrideService.generatePricingRecommendation(listingId, listingData);
  }
}
