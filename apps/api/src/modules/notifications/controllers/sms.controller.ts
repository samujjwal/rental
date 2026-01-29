import { Controller, Post, Body, Get, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SmsService } from '../services/twilio.service';

@ApiTags('sms')
@Controller('sms')
export class SmsController {
  constructor(private readonly smsService: SmsService) {}

  @Post('send')
  @ApiOperation({ summary: 'Send SMS' })
  @ApiResponse({ status: 200, description: 'SMS sent successfully' })
  async sendSms(@Body() smsData: { to: string; body: string; from?: string }) {
    return this.smsService.sendSms(smsData);
  }

  @Post('send-verification')
  @ApiOperation({ summary: 'Send verification code' })
  @ApiResponse({ status: 200, description: 'Verification code sent successfully' })
  async sendVerificationCode(
    @Body() data: { to: string; code: string; purpose?: 'login' | 'phone_verification' },
  ) {
    await this.smsService.sendVerificationCode(data.to, data.code, data.purpose);
    return { status: 'sent' };
  }

  @Post('send-booking-confirmation')
  @ApiOperation({ summary: 'Send booking confirmation SMS' })
  @ApiResponse({ status: 200, description: 'Booking confirmation sent successfully' })
  async sendBookingConfirmation(
    @Body()
    data: {
      to: string;
      booking: {
        id: string;
        listingTitle: string;
        startDate: string;
        endDate: string;
        totalPrice: number;
        currency: string;
      };
    },
  ) {
    await this.smsService.sendBookingConfirmationSms(data.to, {
      ...data.booking,
      startDate: new Date(data.booking.startDate),
      endDate: new Date(data.booking.endDate),
    });
    return { status: 'sent' };
  }

  @Get('status/:sid')
  @ApiOperation({ summary: 'Get SMS delivery status' })
  @ApiResponse({ status: 200, description: 'SMS status retrieved successfully' })
  async getSmsStatus(@Param('sid') sid: string) {
    return this.smsService.getSmsStatus(sid);
  }

  @Get('test')
  @ApiOperation({ summary: 'Test SMS configuration' })
  @ApiResponse({ status: 200, description: 'SMS configuration test result' })
  async testSms() {
    return this.smsService.testSmsConfiguration();
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validate phone number' })
  @ApiResponse({ status: 200, description: 'Phone number validation result' })
  async validatePhoneNumber(@Body() data: { phone: string }) {
    return this.smsService.validatePhoneNumber(data.phone);
  }

  @Post('webhook')
  @ApiOperation({ summary: 'Handle Twilio webhook events' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  async handleWebhook(@Body() eventData: any) {
    await this.smsService.handleWebhook(eventData);
    return { status: 'processed' };
  }
}
