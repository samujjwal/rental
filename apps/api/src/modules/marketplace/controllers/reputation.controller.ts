import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, CurrentUser, RolesGuard, Roles } from '@/common/auth';
import { UserRole } from '@rental-portal/database';
import { ReputationService } from '../services/reputation.service';
import { CreateModerationActionDto, ResolveModerationDto } from '../dto/marketplace.dto';

@ApiTags('Marketplace - Trust & Reputation')
@Controller('marketplace/reputation')
export class ReputationController {
  constructor(private readonly reputation: ReputationService) {}

  @Post('calculate/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Calculate/recalculate reputation score for a user (admin only)' })
  @ApiResponse({ status: 200, description: 'Reputation calculated' })
  async calculate(@Param('userId') userId: string) {
    return this.reputation.calculateReputation(userId);
  }

  @Get(':userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current reputation score for a user' })
  @ApiResponse({ status: 200, description: 'Reputation score returned' })
  async getReputation(@Param('userId') userId: string) {
    return this.reputation.getReputation(userId);
  }

  @Get(':userId/tier-access')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check if user meets a required reputation tier' })
  @ApiResponse({ status: 200, description: 'Tier access check result' })
  async checkTierAccess(@Param('userId') userId: string, @Query('requiredTier') requiredTier: string) {
    const allowed = await this.reputation.checkTierAccess(userId, requiredTier);
    return { allowed };
  }

  @Post('moderation')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a moderation action against a user/listing' })
  @ApiResponse({ status: 201, description: 'Moderation action created' })
  async createModeration(@CurrentUser('id') moderatorId: string, @Body() dto: CreateModerationActionDto) {
    return this.reputation.createModerationAction({ ...dto, moderatorId });
  }

  @Patch('moderation/:actionId/resolve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resolve a pending moderation action' })
  @ApiResponse({ status: 200, description: 'Moderation action resolved' })
  async resolveModeration(
    @Param('actionId') actionId: string,
    @CurrentUser('id') resolvedBy: string,
    @Body() dto: ResolveModerationDto,
  ) {
    return this.reputation.resolveModerationAction(actionId, dto.resolution, resolvedBy);
  }

  @Get('moderation/pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get pending moderation actions' })
  @ApiResponse({ status: 200, description: 'Pending moderations returned' })
  async getPendingModerations(@Query('limit') limit?: number) {
    return this.reputation.getPendingModerations(limit ?? 50);
  }
}
