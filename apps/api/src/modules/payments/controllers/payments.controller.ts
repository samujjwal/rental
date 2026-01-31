import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  RawBodyRequest,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { StripeService } from '../services/stripe.service';
import { PayoutsService } from '../services/payouts.service';
import { LedgerService } from '../services/ledger.service';
import { toNumber } from '@rental-portal/database';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly stripe: StripeService,
    private readonly ledger: LedgerService,
    private readonly payouts: PayoutsService,
  ) {}

  @Post('connect/onboard')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start Stripe Connect onboarding' })
  @ApiResponse({ status: 200, description: 'Onboarding URL created' })
  async startOnboarding(
    @CurrentUser('id') userId: string,
    @CurrentUser('email') email: string,
    @Body('returnUrl') returnUrl: string,
    @Body('refreshUrl') refreshUrl: string,
  ) {
    const accountId = await this.stripe.createConnectAccount(userId, email);
    const onboardingUrl = await this.stripe.createAccountLink(accountId, returnUrl, refreshUrl);

    return { url: onboardingUrl, accountId };
  }

  @Get('connect/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Stripe Connect account status' })
  @ApiResponse({ status: 200, description: 'Account status retrieved' })
  async getAccountStatus(@CurrentUser('id') userId: string) {
    const user = await this.stripe['prisma'].user.findUnique({
      where: { id: userId },
      select: { stripeConnectId: true },
    });

    if (!user?.stripeConnectId) {
      return { connected: false };
    }

    const status = await this.stripe.getAccountStatus(user.stripeConnectId);

    return {
      connected: true,
      accountId: user.stripeConnectId,
      ...status,
    };
  }

  @Post('intents/:bookingId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create payment intent for booking' })
  @ApiResponse({ status: 201, description: 'Payment intent created' })
  async createPaymentIntent(
    @Param('bookingId') bookingId: string,
    @CurrentUser('id') userId: string,
  ) {
    const booking = await this.stripe['prisma'].booking.findUnique({
      where: { id: bookingId },
      include: { renter: true },
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    if (booking.renterId !== userId) {
      throw new Error('Not authorized');
    }

    const result = await this.stripe.createPaymentIntent(
      bookingId,
      toNumber(booking.totalPrice),
      booking.currency,
      booking.renter.stripeCustomerId || undefined,
    );

    return result;
  }

  @Post('deposit/hold/:bookingId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Hold security deposit' })
  @ApiResponse({ status: 201, description: 'Deposit held' })
  async holdDeposit(@Param('bookingId') bookingId: string, @CurrentUser('id') userId: string) {
    const booking = await this.stripe['prisma'].booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    if (toNumber(booking.securityDeposit) <= 0) {
      throw new Error('No deposit required');
    }

    const paymentIntentId = await this.stripe.holdDeposit(
      bookingId,
      toNumber(booking.securityDeposit),
      booking.currency,
    );

    await this.ledger.recordDepositHold(
      bookingId,
      booking.renterId,
      toNumber(booking.securityDeposit),
      booking.currency,
    );

    return { paymentIntentId };
  }

  @Post('deposit/release/:depositId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Release security deposit' })
  @ApiResponse({ status: 200, description: 'Deposit released' })
  async releaseDeposit(@Param('depositId') depositId: string) {
    await this.stripe.releaseDeposit(depositId);

    const deposit = await this.stripe['prisma'].depositHold.findUnique({
      where: { id: depositId },
    });

    if (!deposit || !deposit.bookingId) {
      throw new Error('Deposit or booking not found');
    }

    const booking = await this.stripe['prisma'].booking.findUnique({
      where: { id: deposit.bookingId },
    });

    await this.ledger.recordDepositRelease(
      deposit.bookingId,
      booking.renterId,
      toNumber(deposit.amount),
      deposit.currency,
    );

    return { success: true };
  }

  @Post('customer')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create Stripe customer' })
  @ApiResponse({ status: 201, description: 'Customer created' })
  async createCustomer(
    @CurrentUser('id') userId: string,
    @CurrentUser('email') email: string,
    @CurrentUser('firstName') firstName: string,
    @CurrentUser('lastName') lastName: string,
  ) {
    const customerId = await this.stripe.createCustomer(userId, email, `${firstName} ${lastName}`);

    return { customerId };
  }

  @Get('methods')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment methods' })
  @ApiResponse({ status: 200, description: 'Payment methods retrieved' })
  async getPaymentMethods(@CurrentUser('id') userId: string) {
    const user = await this.stripe['prisma'].user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId) {
      return { data: [] };
    }

    return this.stripe.getPaymentMethods(user.stripeCustomerId);
  }

  @Post('methods/attach')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Attach payment method to customer' })
  @ApiResponse({ status: 200, description: 'Payment method attached' })
  async attachPaymentMethod(
    @CurrentUser('id') userId: string,
    @Body('paymentMethodId') paymentMethodId: string,
  ) {
    const user = await this.stripe['prisma'].user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId) {
      throw new Error('No customer account found');
    }

    await this.stripe.attachPaymentMethod(user.stripeCustomerId, paymentMethodId);

    return { success: true };
  }

  @Post('payouts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request payout' })
  @ApiResponse({ status: 201, description: 'Payout created' })
  async requestPayout(@CurrentUser('id') userId: string, @Body('amount') amount?: number) {
    return this.payouts.createPayout(userId, amount);
  }

  @Get('payouts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payout history' })
  @ApiResponse({ status: 200, description: 'Payouts retrieved' })
  async getPayouts(@CurrentUser('id') userId: string) {
    return this.payouts.getOwnerPayouts(userId);
  }

  @Get('earnings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get pending earnings' })
  @ApiResponse({ status: 200, description: 'Earnings retrieved' })
  async getEarnings(@CurrentUser('id') userId: string) {
    return this.payouts.getPendingEarnings(userId);
  }

  @Get('ledger/booking/:bookingId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get booking ledger entries' })
  @ApiResponse({ status: 200, description: 'Ledger entries retrieved' })
  async getBookingLedger(@Param('bookingId') bookingId: string) {
    return this.ledger.getBookingLedger(bookingId);
  }

  @Get('balance')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user balance' })
  @ApiResponse({ status: 200, description: 'Balance retrieved' })
  async getBalance(@CurrentUser('id') userId: string) {
    const balance = await this.ledger.getUserBalance(userId);
    return { balance, currency: 'USD' };
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook endpoint' })
  async handleWebhook(@Req() req: RawBodyRequest<Request>) {
    const signature = req.headers['stripe-signature'] as string;
    const payload = req.rawBody;

    const event = await this.stripe.handleWebhook(signature, payload);
    await this.stripe.processWebhookEvent(event);

    return { received: true };
  }
}
