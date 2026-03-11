import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '@/common/auth';
import { UserRole } from '@rental-portal/database';
import { InAppNotificationService } from '../services/notification.service';

@ApiTags('in-app notifications')
@Controller('notifications/inapp')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InAppNotificationController {
  constructor(private readonly notificationService: InAppNotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user notifications' })
  @ApiResponse({ status: 200, description: 'Notifications retrieved successfully' })
  async getNotifications(
    @CurrentUser('id') userId: string,
    @Query()
    query: {
      type?: string;
      read?: boolean;
      priority?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    return this.notificationService.getUserNotifications({
      ...query,
      userId,
    } as any);
  }

  @Get('count')
  @ApiOperation({ summary: 'Get current user notification count' })
  @ApiResponse({ status: 200, description: 'Notification count retrieved successfully' })
  async getNotificationCount(@CurrentUser('id') userId: string) {
    return this.notificationService.getNotificationCount(userId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create notification (admin only)' })
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
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.notificationService.markAsRead(id, userId);
    return { status: 'marked_as_read' };
  }

  @Put('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  async markAllAsRead(@CurrentUser('id') userId: string) {
    await this.notificationService.markAllAsRead(userId);
    return { status: 'all_marked_as_read' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete notification' })
  @ApiResponse({ status: 200, description: 'Notification deleted successfully' })
  async deleteNotification(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.notificationService.deleteNotification(id, userId);
    return { status: 'deleted' };
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get current user notification preferences' })
  @ApiResponse({ status: 200, description: 'Notification preferences retrieved successfully' })
  async getNotificationPreferences(@CurrentUser('id') userId: string) {
    return this.notificationService.getNotificationPreferences(userId);
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update current user notification preferences' })
  @ApiResponse({ status: 200, description: 'Notification preferences updated successfully' })
  async updateNotificationPreferences(
    @CurrentUser('id') userId: string,
    @Body()
    data: {
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
    await this.notificationService.updateNotificationPreferences(userId, data.preferences);
    return { status: 'updated' };
  }
}
