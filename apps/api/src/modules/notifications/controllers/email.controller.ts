import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { EmailService } from '../services/resend.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/modules/auth/decorators/roles.decorator';
import { UserRole } from '@rental-portal/database';

/**
 * Email controller — restricted to SUPER_ADMIN only.
 * All production email sending is triggered internally by services
 * (booking confirmation, password reset, welcome, etc.).
 * These endpoints exist solely for admin testing/debugging.
 */
@ApiTags('email')
@Controller('email')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('send')
  @ApiOperation({ summary: 'Send email (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Email sent successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — Super Admin only' })
  async sendEmail(
    @Body() emailData: { to: string | string[]; subject: string; html?: string; text?: string },
  ) {
    return this.emailService.sendEmail(emailData);
  }

  @Get('test')
  @ApiOperation({ summary: 'Test email configuration (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Email configuration test result' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — Super Admin only' })
  async testEmail() {
    return this.emailService.testEmailConfiguration();
  }
}
