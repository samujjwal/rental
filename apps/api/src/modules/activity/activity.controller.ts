import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActivityService } from './activity.service';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { User } from '@rental-portal/database';

@Controller('activity')
@UseGuards(JwtAuthGuard)
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get('recent')
  async getRecentActivity(
    @CurrentUser() user: User,
    @Query('limit') limit?: string,
    @Query('types') types?: string,
    @Query('cursor') cursor?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    const parsedTypes = types ? types.split(',') : undefined;
    
    return this.activityService.getRecentActivity(user.id, {
      limit: parsedLimit,
      types: parsedTypes,
      cursor,
      startDate,
      endDate,
    });
  }

  @Get('stats')
  async getActivityStats(
    @CurrentUser() user: User,
    @Query('period') period: string = '30d',
  ) {
    return this.activityService.getActivityStats(user.id, period as '7d' | '30d' | '90d');
  }

  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: User) {
    return this.activityService.getUnreadCount(user.id);
  }
}
