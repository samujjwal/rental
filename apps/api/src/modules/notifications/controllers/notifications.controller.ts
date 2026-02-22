import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService, NotificationPreferences } from '../services/notifications.service';
import { PushNotificationService } from '../services/push-notification.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/modules/auth/decorators/roles.decorator';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { NotificationType, UserRole } from '@rental-portal/database';
import {
  RegisterDeviceDto,
  UnregisterDeviceDto,
} from '../dto/notification.dto';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly pushService: PushNotificationService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get user notifications' })
  async getNotifications(
    @CurrentUser('id') userId: string,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('type') type?: NotificationType,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.notificationsService.getUserNotifications(userId, {
      type,
      unreadOnly: unreadOnly === 'true',
      page: page ? parseInt(page.toString()) : undefined,
      limit: limit ? parseInt(limit.toString()) : undefined,
    });
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  async getUnreadCount(@CurrentUser('id') userId: string) {
    const count = await this.notificationsService.getUnreadCount(userId);
    return { count };
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async markAsRead(@Param('id') notificationId: string, @CurrentUser('id') userId: string) {
    return this.notificationsService.markAsRead(notificationId, userId);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@CurrentUser('id') userId: string) {
    const count = await this.notificationsService.markAllAsRead(userId);
    return { count };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete notification' })
  async deleteNotification(@Param('id') notificationId: string, @CurrentUser('id') userId: string) {
    await this.notificationsService.deleteNotification(notificationId, userId);
    return { message: 'Notification deleted successfully' };
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get notification preferences' })
  async getPreferences(@CurrentUser('id') userId: string) {
    return this.notificationsService.getPreferences(userId);
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Update notification preferences' })
  async updatePreferences(
    @CurrentUser('id') userId: string,
    @Body() preferences: Partial<NotificationPreferences>,
  ) {
    await this.notificationsService.updatePreferences(userId, preferences);
    return this.notificationsService.getPreferences(userId);
  }

  // ─── Device Registration (Push Notifications) ─────────────────

  @Post('devices/register')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register device for push notifications' })
  async registerDevice(
    @CurrentUser('id') userId: string,
    @Body() dto: RegisterDeviceDto,
  ) {
    await this.pushService.registerDeviceToken(userId, dto.token, dto.platform);
    return { success: true };
  }

  @Post('devices/unregister')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unregister device from push notifications' })
  async unregisterDevice(@Body() dto: UnregisterDeviceDto) {
    await this.pushService.unregisterDeviceToken(dto.token);
    return { success: true };
  }

  // ─── Admin: Create notification ────────────────────────────────

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create notification (admin only)' })
  async createNotification(
    @Body() data: {
      userId: string;
      type: string;
      title: string;
      message: string;
      channels?: ('EMAIL' | 'SMS' | 'PUSH' | 'IN_APP')[];
      priority?: 'LOW' | 'NORMAL' | 'HIGH';
    },
  ) {
    return this.notificationsService.sendNotification({
      userId: data.userId,
      type: data.type as NotificationType,
      title: data.title,
      message: data.message,
      channels: data.channels,
      priority: data.priority,
    });
  }
}
