import { Controller, Get, Put, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { NotificationPreferencesService } from '../services/notification-preferences.service';
import { PushNotificationService } from '../services/push-notification.service';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationController {
  constructor(
    private readonly preferencesService: NotificationPreferencesService,
    private readonly pushService: PushNotificationService,
  ) {}

  @Get('preferences')
  @ApiOperation({ summary: 'Get notification preferences' })
  @ApiResponse({ status: 200, description: 'Preferences retrieved' })
  async getPreferences(@CurrentUser('id') userId: string) {
    return this.preferencesService.getUserPreferences(userId);
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update notification preferences' })
  @ApiResponse({ status: 200, description: 'Preferences updated' })
  async updatePreferences(
    @CurrentUser('id') userId: string,
    @Body() preferences: Record<string, any>,
  ) {
    await this.preferencesService.updatePreferences(userId, preferences);
    return { success: true };
  }

  @Post('devices/register')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register device for push notifications' })
  @ApiResponse({ status: 200, description: 'Device registered' })
  async registerDevice(
    @CurrentUser('id') userId: string,
    @Body('token') token: string,
    @Body('platform') platform: 'ios' | 'android' | 'web',
  ) {
    await this.pushService.registerDeviceToken(userId, token, platform);
    return { success: true };
  }

  @Post('devices/unregister')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unregister device' })
  @ApiResponse({ status: 200, description: 'Device unregistered' })
  async unregisterDevice(@Body('token') token: string) {
    await this.pushService.unregisterDeviceToken(token);
    return { success: true };
  }
}
