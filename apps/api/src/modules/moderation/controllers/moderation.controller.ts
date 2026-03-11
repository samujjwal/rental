import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { i18nNotFound } from '@/common/errors/i18n-exceptions';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '@/common/auth';
import { UserRole } from '@rental-portal/database';
import { ContentModerationService } from '../services/content-moderation.service';

@ApiTags('Moderation')
@Controller('moderation')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ModerationController {
  constructor(private readonly moderationService: ContentModerationService) {}

  @Get('queue')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get moderation queue (admin only)' })
  @ApiResponse({ status: 200, description: 'Queue retrieved' })
  async getQueue(
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('entityType') entityType?: string,
  ) {
    return this.moderationService.getModerationQueue({
      status: status as any,
      priority: priority as any,
      entityType,
    });
  }

  @Post('queue/:entityId/approve')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve flagged content (admin only)' })
  @ApiResponse({ status: 200, description: 'Content approved' })
  async approveContent(
    @Param('entityId') entityId: string,
    @CurrentUser('id') adminId: string,
    @Body('entityType') entityType: string,
    @Body('notes') notes?: string,
  ) {
    await this.moderationService.approveContent(entityType, entityId, adminId, notes);
    return { success: true, message: 'Content approved' };
  }

  @Post('queue/:entityId/reject')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject flagged content (admin only)' })
  @ApiResponse({ status: 200, description: 'Content rejected' })
  async rejectContent(
    @Param('entityId') entityId: string,
    @CurrentUser('id') adminId: string,
    @Body('entityType') entityType: string,
    @Body('reason') reason: string,
  ) {
    await this.moderationService.rejectContent(entityType, entityId, adminId, reason);
    return { success: true, message: 'Content rejected' };
  }

  @Get('history/:userId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get user moderation history (admin only)' })
  @ApiResponse({ status: 200, description: 'History retrieved' })
  async getUserHistory(@Param('userId') userId: string) {
    return this.moderationService.getUserModerationHistory(userId);
  }

  @Post('test/text')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Test text moderation (admin only)' })
  @ApiResponse({ status: 200, description: 'Moderation result' })
  async testTextModeration(@Body('text') text: string) {
    if (process.env.NODE_ENV === 'production') {
      throw i18nNotFound('common.notFound');
    }
    return this.moderationService.moderateMessage(text);
  }
}
