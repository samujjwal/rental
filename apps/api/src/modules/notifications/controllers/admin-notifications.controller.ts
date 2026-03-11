import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { i18nForbidden } from '@/common/errors/i18n-exceptions';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SkipCsrf } from '@/common/guards/csrf.guard';
import { EmailService } from '../services/resend.service';
import { SmsService } from '../services/twilio.service';
import { JwtAuthGuard, RolesGuard, Roles } from '@/common/auth';
import { UserRole } from '@rental-portal/database';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Admin notifications controller — merges email + SMS admin endpoints.
 *
 * All production email/SMS sending is triggered internally by services.
 * These endpoints exist solely for SUPER_ADMIN testing/debugging,
 * except for the Twilio webhook which validates request signatures.
 */
@Controller()
export class AdminNotificationsController {
  private readonly logger = new Logger(AdminNotificationsController.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    private readonly configService: ConfigService,
  ) {}

  // ─── Email endpoints (/email) ──────────────────────────────────

  @Post('email/send')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiTags('email')
  @ApiOperation({ summary: 'Send email (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Email sent successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — Super Admin only' })
  async sendEmail(
    @Body() emailData: { to: string | string[]; subject: string; html?: string; text?: string },
  ) {
    return this.emailService.sendEmail(emailData);
  }

  @Get('email/test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiTags('email')
  @ApiOperation({ summary: 'Test email configuration (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Email configuration test result' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — Super Admin only' })
  async testEmail() {
    return this.emailService.testEmailConfiguration();
  }

  // ─── SMS endpoints (/sms) ─────────────────────────────────────

  @Post('sms/send')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiTags('sms')
  @ApiOperation({ summary: 'Send SMS (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'SMS sent successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — Super Admin only' })
  async sendSms(@Body() smsData: { to: string; body: string; from?: string }) {
    return this.smsService.sendSms(smsData);
  }

  @Post('sms/validate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiTags('sms')
  @ApiOperation({ summary: 'Validate phone number (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Phone number validation result' })
  async validatePhoneNumber(@Body() data: { phone: string }) {
    return this.smsService.validatePhoneNumber(data.phone);
  }

  @Get('sms/status/:sid')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiTags('sms')
  @ApiOperation({ summary: 'Get SMS delivery status (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'SMS status retrieved successfully' })
  async getSmsStatus(@Param('sid') sid: string) {
    return this.smsService.getSmsStatus(sid);
  }

  @Get('sms/test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiTags('sms')
  @ApiOperation({ summary: 'Test SMS configuration (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'SMS configuration test result' })
  async testSms() {
    return this.smsService.testSmsConfiguration();
  }

  // ─── Twilio webhook (signature-validated, no JWT) ──────────────

  @Post('sms/webhook')
  @SkipCsrf()
  @HttpCode(HttpStatus.OK)
  @ApiTags('sms')
  @ApiOperation({ summary: 'Handle Twilio webhook events (signature-validated)' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 403, description: 'Invalid Twilio signature' })
  async handleWebhook(@Req() req: Request, @Body() eventData: any) {
    const twilioSignature = req.headers['x-twilio-signature'] as string;
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');

    if (authToken && twilioSignature) {
      try {
        const twilio = await import('twilio');
        const requestUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const isValid = twilio.validateRequest(authToken, twilioSignature, requestUrl, req.body);
        if (!isValid) {
          this.logger.warn('Invalid Twilio signature on SMS webhook');
          throw i18nForbidden('notification.invalidTwilioSignature');
        }
      } catch (error) {
        if (error instanceof ForbiddenException) throw error;
        this.logger.warn(`Twilio signature validation error: ${error.message}`);
      }
    } else if (authToken && !twilioSignature) {
      this.logger.warn('Twilio auth token configured but signature header missing — rejecting request');
      throw i18nForbidden('notification.missingTwilioSignature');
    } else {
      this.logger.warn('No Twilio auth token configured — skipping signature validation');
    }

    await this.smsService.handleWebhook(eventData);
    return { status: 'processed' };
  }
}
