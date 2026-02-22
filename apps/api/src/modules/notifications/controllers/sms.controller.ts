import { Controller, Post, Body, Get, Param, UseGuards, RawBodyRequest, Req, HttpCode, HttpStatus, Logger, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SmsService } from '../services/twilio.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/modules/auth/decorators/roles.decorator';
import { UserRole } from '@rental-portal/database';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * SMS controller — restricted to SUPER_ADMIN for testing endpoints.
 * The webhook endpoint validates Twilio request signatures.
 * Production SMS sending is triggered internally by services.
 */
@ApiTags('sms')
@Controller('sms')
export class SmsController {
  private readonly logger = new Logger(SmsController.name);

  constructor(
    private readonly smsService: SmsService,
    private readonly configService: ConfigService,
  ) {}

  @Post('send')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send SMS (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'SMS sent successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — Super Admin only' })
  async sendSms(@Body() smsData: { to: string; body: string; from?: string }) {
    return this.smsService.sendSms(smsData);
  }

  @Post('validate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Validate phone number (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Phone number validation result' })
  async validatePhoneNumber(@Body() data: { phone: string }) {
    return this.smsService.validatePhoneNumber(data.phone);
  }

  @Get('status/:sid')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get SMS delivery status (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'SMS status retrieved successfully' })
  async getSmsStatus(@Param('sid') sid: string) {
    return this.smsService.getSmsStatus(sid);
  }

  @Get('test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Test SMS configuration (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'SMS configuration test result' })
  async testSms() {
    return this.smsService.testSmsConfiguration();
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Twilio webhook events (signature-validated)' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 403, description: 'Invalid Twilio signature' })
  async handleWebhook(@Req() req: Request, @Body() eventData: any) {
    // Validate Twilio request signature
    const twilioSignature = req.headers['x-twilio-signature'] as string;
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');

    if (authToken && twilioSignature) {
      try {
        const twilio = await import('twilio');
        const requestUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const isValid = twilio.validateRequest(authToken, twilioSignature, requestUrl, req.body);
        if (!isValid) {
          this.logger.warn('Invalid Twilio signature on SMS webhook');
          throw new ForbiddenException('Invalid Twilio signature');
        }
      } catch (error) {
        if (error instanceof ForbiddenException) throw error;
        this.logger.warn(`Twilio signature validation error: ${error.message}`);
      }
    } else {
      this.logger.warn('Missing Twilio signature or auth token — skipping validation');
    }

    await this.smsService.handleWebhook(eventData);
    return { status: 'processed' };
  }
}
