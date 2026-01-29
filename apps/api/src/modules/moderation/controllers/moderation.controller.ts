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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/modules/auth/decorators/roles.decorator';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { ContentModerationService } from '../services/content-moderation.service';

@ApiTags('Moderation')
@Controller('moderation')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ModerationController {
  constructor(private readonly moderationService: ContentModerationService) {}

  @Get('queue')
  @Roles('ADMIN' as any)
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
  @Roles('ADMIN' as any)
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
  @Roles('ADMIN' as any)
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
  @Roles('ADMIN' as any)
  @ApiOperation({ summary: 'Get user moderation history (admin only)' })
  @ApiResponse({ status: 200, description: 'History retrieved' })
  async getUserHistory(@Param('userId') userId: string) {
    return this.moderationService.getUserModerationHistory(userId);
  }

  @Post('test/text')
  @Roles('ADMIN' as any)
  @ApiOperation({ summary: 'Test text moderation (admin only)' })
  @ApiResponse({ status: 200, description: 'Moderation result' })
  async testTextModeration(@Body('text') text: string) {
    return this.moderationService.moderateMessage(text);
  }
}
