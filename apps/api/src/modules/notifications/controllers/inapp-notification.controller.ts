import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { InAppNotificationService } from '../services/notification.service';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationController {
  constructor(private readonly notificationService: InAppNotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Get user notifications' })
  @ApiResponse({ status: 200, description: 'Notifications retrieved successfully' })
  async getNotifications(
    @Query()
    query: {
      type?: string;
      read?: boolean;
      priority?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    return this.notificationService.getUserNotifications(query);
  }

  @Get('count')
  @ApiOperation({ summary: 'Get notification count' })
  @ApiResponse({ status: 200, description: 'Notification count retrieved successfully' })
  async getNotificationCount(@Query('userId') userId: string) {
    return this.notificationService.getNotificationCount(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create notification' })
  @ApiResponse({ status: 201, description: 'Notification created successfully' })
  async createNotification(
    @Body()
    data: {
      userId: string;
      type: string;
      title: string;
      message: string;
      actionUrl?: string;
      actionText?: string;
      priority?: string;
    },
  ) {
    return this.notificationService.createNotification({
      userId: data.userId,
      type: data.type as any,
      title: data.title,
      message: data.message,
      actionUrl: data.actionUrl,
    });
  }

  @Put(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  async markAsRead(@Param('id') id: string, @Body('userId') userId: string) {
    await this.notificationService.markAsRead(id, userId);
    return { status: 'marked_as_read' };
  }

  @Put('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  async markAllAsRead(@Body('userId') userId: string) {
    await this.notificationService.markAllAsRead(userId);
    return { status: 'all_marked_as_read' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete notification' })
  @ApiResponse({ status: 200, description: 'Notification deleted successfully' })
  async deleteNotification(@Param('id') id: string, @Body('userId') userId: string) {
    await this.notificationService.deleteNotification(id, userId);
    return { status: 'deleted' };
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get notification preferences' })
  @ApiResponse({ status: 200, description: 'Notification preferences retrieved successfully' })
  async getNotificationPreferences(@Query('userId') userId: string) {
    return this.notificationService.getNotificationPreferences(userId);
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update notification preferences' })
  @ApiResponse({ status: 200, description: 'Notification preferences updated successfully' })
  async updateNotificationPreferences(
    @Body()
    data: {
      userId: string;
      preferences: {
        email?: boolean;
        push?: boolean;
        inApp?: boolean;
        types?: {
          booking: boolean;
          payment: boolean;
          review: boolean;
          message: boolean;
          system: boolean;
          organization: boolean;
        };
      };
    },
  ) {
    await this.notificationService.updateNotificationPreferences(data.userId, data.preferences);
    return { status: 'updated' };
  }
}
