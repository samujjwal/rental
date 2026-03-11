import { Controller, Get, Post, Body, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, CurrentUser, RolesGuard, Roles } from '@/common/auth';
import { UserRole } from '@rental-portal/database';
import { PaymentOrchestrationService } from '../services/payment-orchestration.service';
import { AuthorizePaymentDto, CapturePaymentDto, RefundPaymentDto, PayoutDto } from '../dto/marketplace.dto';

@ApiTags('Marketplace - Payment Orchestration')
@Controller('marketplace/payments')
export class PaymentOrchestrationController {
  constructor(private readonly orchestration: PaymentOrchestrationService) {}

  @Get('providers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List registered payment providers' })
  @ApiResponse({ status: 200, description: 'Provider list returned' })
  async getProviders() {
    return this.orchestration.getRegisteredProviders();
  }

  @Get('providers/health')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get health status of all payment providers' })
  @ApiResponse({ status: 200, description: 'Provider health returned' })
  async getProviderHealth() {
    return this.orchestration.getProviderHealth();
  }

  @Get('providers/select')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Select optimal provider for a country/currency pair' })
  @ApiResponse({ status: 200, description: 'Provider selected' })
  async selectProvider(@Query('country') country: string, @Query('currency') currency: string) {
    const provider = await this.orchestration.selectProvider(country, currency);
    return { provider };
  }

  @Post('authorize')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Authorize a payment via the best provider' })
  @ApiResponse({ status: 201, description: 'Payment authorized' })
  async authorize(@CurrentUser('id') userId: string, @Body() dto: AuthorizePaymentDto) {
    return this.orchestration.authorize({ ...dto, userId });
  }

  @Post('capture')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Capture a previously authorized payment' })
  @ApiResponse({ status: 200, description: 'Payment captured' })
  async capture(@Body() dto: CapturePaymentDto) {
    return this.orchestration.capture(dto.transactionId, dto.amount, dto.providerName);
  }

  @Post('refund')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refund a captured payment' })
  @ApiResponse({ status: 200, description: 'Refund issued' })
  async refund(@Body() dto: RefundPaymentDto) {
    return this.orchestration.refund(dto.transactionId, dto.amount, dto.providerName, dto.reason);
  }

  @Post('payout')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disburse payout to host' })
  @ApiResponse({ status: 201, description: 'Payout processed' })
  @HttpCode(HttpStatus.CREATED)
  async payout(@Body() dto: PayoutDto) {
    return this.orchestration.payout(dto);
  }
}
