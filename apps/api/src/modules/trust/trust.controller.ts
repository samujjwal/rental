/**
 * Trust Score Controller
 * 
 * Provides REST API endpoints for trust score management:
 * - Get user trust score
 * - Get listing trust score
 * - Batch trust score queries
 */

import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TrustService, TrustScore } from './trust.service';

@ApiTags('trust')
@Controller('trust')
@ApiBearerAuth()
export class TrustController {
  constructor(private readonly trustService: TrustService) {}

  /**
   * Get trust score for a user
   */
  @Get('user/:userId')
  @ApiOperation({ summary: 'Get trust score for a user' })
  @ApiResponse({ status: 200, description: 'Returns user trust score' })
  async getUserTrustScore(@Param('userId') userId: string): Promise<TrustScore> {
    return this.trustService.calculateUserTrustScore(userId);
  }

  /**
   * Get trust score for a listing
   */
  @Get('listing/:listingId')
  @ApiOperation({ summary: 'Get trust score for a listing' })
  @ApiResponse({ status: 200, description: 'Returns listing trust score' })
  async getListingTrustScore(@Param('listingId') listingId: string): Promise<TrustScore> {
    return this.trustService.calculateListingTrustScore(listingId);
  }

  /**
   * Get trust scores for multiple users in batch
   */
  @Post('users/batch')
  @ApiOperation({ summary: 'Get trust scores for multiple users in batch' })
  @ApiResponse({ status: 200, description: 'Returns map of user IDs to trust scores' })
  async getBatchUserTrustScores(@Body() body: { userIds: string[] }): Promise<Record<string, TrustScore>> {
    const scores = await this.trustService.getBatchUserTrustScores(body.userIds);
    return Object.fromEntries(scores);
  }

  /**
   * Get trust scores for multiple listings in batch
   */
  @Post('listings/batch')
  @ApiOperation({ summary: 'Get trust scores for multiple listings in batch' })
  @ApiResponse({ status: 200, description: 'Returns map of listing IDs to trust scores' })
  async getBatchListingTrustScores(@Body() body: { listingIds: string[] }): Promise<Record<string, TrustScore>> {
    const scores = await this.trustService.getBatchListingTrustScores(body.listingIds);
    return Object.fromEntries(scores);
  }
}
