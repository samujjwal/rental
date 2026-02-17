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
  Query,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Request } from 'express';
import { StripeService } from '../services/stripe.service';
import { PayoutsService } from '../services/payouts.service';
import { LedgerService } from '../services/ledger.service';
import {
  StartOnboardingDto,
  AttachPaymentMethodDto,
  RequestPayoutDto,
  RequestRefundDto,
} from '../dto/payment.dto';
import { toNumber } from '@rental-portal/database';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';

type AsyncMethodResult<T extends (...args: any[]) => Promise<any>> = Awaited<ReturnType<T>>;

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
    @Body() dto: StartOnboardingDto,
  ) {
    const accountId = await this.stripe.createConnectAccount(userId, email);
    const onboardingUrl = await this.stripe.createAccountLink(accountId, dto.returnUrl, dto.refreshUrl);

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
      throw new NotFoundException('Booking not found');
    }

    if (booking.renterId !== userId) {
      throw new ForbiddenException('Not authorized to pay for this booking');
    }

    const normalizedStatus = String(booking.status || '').toUpperCase();
    if (!['PENDING', 'PENDING_PAYMENT'].includes(normalizedStatus)) {
      throw new BadRequestException('Booking is not ready for payment');
    }

    const result = await this.stripe.createPaymentIntent(
      bookingId,
      toNumber(booking.totalPrice),
      booking.currency,
      booking.renter.stripeCustomerId || undefined,
    );

    await this.stripe['prisma'].booking.update({
      where: { id: bookingId },
      data: { paymentIntentId: result.paymentIntentId },
    });

    await this.stripe['prisma'].payment.create({
      data: {
        bookingId,
        amount: booking.totalPrice,
        currency: booking.currency,
        status: 'PENDING',
        paymentIntentId: result.paymentIntentId,
        stripePaymentIntentId: result.paymentIntentId,
      },
    });

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
      throw new NotFoundException('Booking not found');
    }

    if (toNumber(booking.securityDeposit) <= 0) {
      throw new BadRequestException('No deposit required for this booking');
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
      throw new NotFoundException('Deposit or associated booking not found');
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
    @Body() dto: AttachPaymentMethodDto,
  ) {
    const user = await this.stripe['prisma'].user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId) {
      throw new BadRequestException('No Stripe customer account found. Please create one first.');
    }

    await this.stripe.attachPaymentMethod(user.stripeCustomerId, dto.paymentMethodId);

    return { success: true };
  }

  @Post('payouts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request payout' })
  @ApiResponse({ status: 201, description: 'Payout created' })
  async requestPayout(@CurrentUser('id') userId: string, @Body() dto: RequestPayoutDto) {
    return this.payouts.createPayout(userId, dto.amount);
  }

  @Get('payouts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payout history' })
  @ApiResponse({ status: 200, description: 'Payouts retrieved' })
  async getPayouts(
    @CurrentUser('id') userId: string,
  ): Promise<AsyncMethodResult<PayoutsService['getOwnerPayouts']>> {
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

  @Get('earnings/summary')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get earnings summary' })
  @ApiResponse({ status: 200, description: 'Earnings summary retrieved' })
  async getEarningsSummary(@CurrentUser('id') userId: string) {
    return this.ledger.getOwnerEarningsSummary(userId);
  }

  @Get('ledger/booking/:bookingId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get booking ledger entries' })
  @ApiResponse({ status: 200, description: 'Ledger entries retrieved' })
  async getBookingLedger(
    @Param('bookingId') bookingId: string,
  ): Promise<AsyncMethodResult<LedgerService['getBookingLedger']>> {
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

  @Get('transactions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user transactions with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Transactions retrieved' })
  async getTransactions(
    @CurrentUser('id') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const options: any = {
      page: page ? parseInt(String(page), 10) : 1,
      limit: limit ? parseInt(String(limit), 10) : 20,
      type,
      status,
    };

    if (startDate) {
      options.startDate = new Date(startDate);
    }

    if (endDate) {
      options.endDate = new Date(endDate);
    }

    return this.ledger.getUserTransactions(userId, options);
  }

  @Post('refund/:bookingId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request a refund for a booking' })
  @ApiResponse({ status: 200, description: 'Refund initiated' })
  async requestRefund(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: { id: string; role: string },
    @Body() dto: RequestRefundDto,
  ) {
    // Only the renter or admin can request a refund
    const booking = await this.ledger.getBookingLedger(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Find the payment for this booking
    const payment = await this.stripe['prisma'].payment.findFirst({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
      include: { booking: { select: { renterId: true } } },
    });

    if (!payment?.stripePaymentIntentId) {
      throw new BadRequestException('No payment found for this booking');
    }

    const refundAmount = dto.amount ? Math.round(dto.amount * 100) : undefined;
    const refundId = await this.stripe.createRefund(
      payment.stripePaymentIntentId,
      refundAmount,
      dto.reason,
    );

    // Record the refund in the ledger
    const refundAmountDecimal = refundAmount
      ? refundAmount / 100
      : toNumber(payment.amount);
    await this.ledger.recordRefund(
      bookingId,
      payment.booking.renterId,
      refundAmountDecimal,
      payment.currency || 'usd',
    );

    return { refundId, amount: refundAmountDecimal };
  }
}
