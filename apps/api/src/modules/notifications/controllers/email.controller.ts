import { Controller, Post, Body, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { EmailService } from '../services/resend.service';

@ApiTags('email')
@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('send')
  @ApiOperation({ summary: 'Send email' })
  @ApiResponse({ status: 200, description: 'Email sent successfully' })
  async sendEmail(
    @Body() emailData: { to: string | string[]; subject: string; html?: string; text?: string },
  ) {
    return this.emailService.sendEmail(emailData);
  }

  @Post('send-welcome')
  @ApiOperation({ summary: 'Send welcome email' })
  @ApiResponse({ status: 200, description: 'Welcome email sent successfully' })
  async sendWelcomeEmail(@Body() data: { email: string; firstName: string; lastName: string }) {
    await this.emailService.sendWelcomeEmail(data);
    return { status: 'sent' };
  }

  @Post('send-booking-confirmation')
  @ApiOperation({ summary: 'Send booking confirmation email' })
  @ApiResponse({ status: 200, description: 'Booking confirmation sent successfully' })
  async sendBookingConfirmation(
    @Body()
    data: {
      email: string;
      firstName: string;
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
    await this.emailService.sendBookingConfirmationEmail(
      { email: data.email, firstName: data.firstName },
      {
        ...data.booking,
        startDate: new Date(data.booking.startDate),
        endDate: new Date(data.booking.endDate),
      },
    );
    return { status: 'sent' };
  }

  @Get('test')
  @ApiOperation({ summary: 'Test email configuration' })
  @ApiResponse({ status: 200, description: 'Email configuration test result' })
  async testEmail() {
    return this.emailService.testEmailConfiguration();
  }
}
