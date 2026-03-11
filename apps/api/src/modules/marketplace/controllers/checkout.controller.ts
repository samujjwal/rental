import { Controller, Post, Delete, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, CurrentUser } from '@/common/auth';
import { CheckoutOrchestratorService } from '../services/checkout-orchestrator.service';
import { CheckoutDto, RefreshLockDto } from '../dto/marketplace.dto';

@ApiTags('Marketplace - Checkout')
@Controller('marketplace/checkout')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CheckoutController {
  constructor(private readonly checkout: CheckoutOrchestratorService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Execute full checkout flow (Saga pattern)' })
  @ApiResponse({ status: 201, description: 'Booking created with payment authorized' })
  @ApiResponse({ status: 400, description: 'Policy violation, fraud block, or slot conflict' })
  async executeCheckout(@CurrentUser('id') userId: string, @Body() dto: CheckoutDto) {
    return this.checkout.checkout({
      userId,
      listingId: dto.listingId,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      guestCount: dto.guestCount,
      paymentMethod: dto.paymentMethod,
      country: dto.country,
      currency: dto.currency,
      metadata: dto.metadata,
    });
  }

  @Post('lock/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh an availability lock during checkout' })
  @ApiResponse({ status: 200, description: 'Lock refreshed' })
  async refreshLock(@Body() dto: RefreshLockDto) {
    return this.checkout.refreshLock(dto.lockKey);
  }

  @Delete('lock/:lockKey')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Release a held availability lock' })
  @ApiResponse({ status: 204, description: 'Lock released' })
  async releaseLock(@Param('lockKey') lockKey: string) {
    await this.checkout.releaseLock(lockKey);
  }
}
