import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { i18nNotFound,i18nForbidden,i18nBadRequest } from '@/common/errors/i18n-exceptions';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { StripeService } from '../services/stripe.service';
import { PayoutsService } from '../services/payouts.service';
import { LedgerService } from '../services/ledger.service';
import { PaymentDataService } from '../services/payment-data.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import {
  StartOnboardingDto,
  AttachPaymentMethodDto,
  RequestPayoutDto,
  RequestRefundDto,
} from '../dto/payment.dto';
import { toNumber } from '@rental-portal/database';
import { JwtAuthGuard, CurrentUser } from '@/common/auth';
import { EmailVerifiedGuard, RequireEmailVerification } from '@/common/guards/email-verified.guard';

type AsyncMethodResult<T extends (...args: any[]) => Promise<any>> = Awaited<ReturnType<T>>;

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly stripe: StripeService,
    private readonly ledger: LedgerService,
    private readonly payouts: PayoutsService,
    private readonly paymentData: PaymentDataService,
    private readonly prisma: PrismaService,
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
    const stripeConnectId = await this.paymentData.getUserStripeConnectId(userId);

    if (!stripeConnectId) {
      return { connected: false };
    }

    const status = await this.stripe.getAccountStatus(stripeConnectId);

    return {
      connected: true,
      accountId: stripeConnectId,
      ...status,
    };
  }

  @Post('intents/:bookingId')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  @RequireEmailVerification()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create payment intent for booking' })
  @ApiResponse({ status: 201, description: 'Payment intent created' })
  async createPaymentIntent(
    @Param('bookingId') bookingId: string,
    @CurrentUser('id') userId: string,
  ) {
    const booking = await this.paymentData.getBookingForPayment(bookingId);

    if (booking.renterId !== userId) {
      throw i18nForbidden('booking.unauthorizedAction');
    }

    const normalizedStatus = String(booking.status || '').toUpperCase();
    if (!['PENDING_PAYMENT'].includes(normalizedStatus)) {
      throw i18nBadRequest('booking.notReady');
    }

    const result = await this.prisma.$transaction(async (tx: any) => {
      const paymentResult = await this.stripe.createPaymentIntent(
        bookingId,
        toNumber(booking.totalPrice),
        booking.currency,
        booking.renter.stripeCustomerId || undefined,
      );

      await this.paymentData.updateBookingPaymentIntent(bookingId, paymentResult.paymentIntentId, tx);

      await this.paymentData.createPaymentRecord({
        bookingId,
        amount: booking.totalPrice,
        currency: booking.currency,
        status: 'PENDING',
        paymentIntentId: paymentResult.paymentIntentId,
        stripePaymentIntentId: paymentResult.paymentIntentId,
      }, tx);

      return paymentResult;
    }) as unknown as { paymentIntentId: string; clientSecret: string };

    return result;
  }

  @Post('deposit/hold/:bookingId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Hold security deposit' })
  @ApiResponse({ status: 201, description: 'Deposit held' })
  async holdDeposit(@Param('bookingId') bookingId: string, @CurrentUser('id') userId: string) {
    const booking = await this.paymentData.getBookingMinimal(bookingId);

    if (booking.renterId !== userId) {
      throw i18nForbidden('booking.unauthorizedAction');
    }

    if (toNumber(booking.securityDeposit) <= 0) {
      throw i18nBadRequest('payment.noDeposit');
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
  async releaseDeposit(
    @Param('depositId') depositId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    const { deposit, booking } = await this.paymentData.getDepositWithBooking(depositId);

    // Only the booking owner or an admin can release a deposit
    const isOwner = booking.ownerId === user.id;
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
    if (!isOwner && !isAdmin) {
      throw i18nForbidden('booking.unauthorizedAction');
    }

    await this.stripe.releaseDeposit(depositId);

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
    const stripeCustomerId = await this.paymentData.getUserStripeCustomerId(userId);

    if (!stripeCustomerId) {
      return { data: [] as any[] };
    }

    try {
      return await this.stripe.getPaymentMethods(stripeCustomerId);
    } catch {
      // Return empty list if Stripe is unavailable or customer not found
      return { data: [] as any[] };
    }
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
    const stripeCustomerId = await this.paymentData.getUserStripeCustomerId(userId);

    if (!stripeCustomerId) {
      throw i18nBadRequest('payment.noCustomerAccount');
    }

    await this.stripe.attachPaymentMethod(stripeCustomerId, dto.paymentMethodId);

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
    @CurrentUser('id') userId: string,
    @Param('bookingId') bookingId: string,
  ): Promise<AsyncMethodResult<LedgerService['getBookingLedger']>> {
    // Verify the user is a participant in this booking
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { renterId: true, listing: { select: { ownerId: true } } },
    });
    if (!booking) {
      throw i18nNotFound('booking.notFound');
    }
    if (booking.renterId !== userId && booking.listing?.ownerId !== userId) {
      throw i18nForbidden('booking.unauthorizedAction');
    }
    return this.ledger.getBookingLedger(bookingId);
  }

  @Get('balance')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user balance' })
  @ApiResponse({ status: 200, description: 'Balance retrieved' })
  async getBalance(@CurrentUser('id') userId: string) {
    // Get user's preferred currency from their profile
    const userPrefs = await this.prisma.userPreferences.findUnique({
      where: { userId },
      select: { currency: true },
    });
    const currency = userPrefs?.currency || 'USD';
    const balance = await this.ledger.getUserBalance(userId, currency);
    return { balance, currency };
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
    const bookingLedger = await this.ledger.getBookingLedger(bookingId);
    if (!bookingLedger) {
      throw i18nNotFound('booking.notFound');
    }

    // Find the payment for this booking
    const payment = await this.paymentData.getLatestPaymentForBooking(bookingId);

    if (!payment?.stripePaymentIntentId) {
      throw i18nBadRequest('payment.paymentNotFound');
    }

    // Verify the user is the renter or an admin
    const isRenter = payment.booking.renterId === user.id;
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
    if (!isRenter && !isAdmin) {
      throw i18nForbidden('booking.unauthorizedAction');
    }

    const refundAmount = dto.amount ?? undefined;
    const refundId = await this.stripe.createRefund(
      payment.stripePaymentIntentId,
      refundAmount ?? toNumber(payment.amount),
      payment.currency || 'USD',
      dto.reason,
    );

    // Record the refund in the ledger
    const refundAmountDecimal = refundAmount
      ? refundAmount
      : toNumber(payment.amount);
    await this.ledger.recordRefund(
      bookingId,
      payment.booking.renterId,
      refundAmountDecimal,
      payment.currency,
    );

    return { refundId, amount: refundAmountDecimal };
  }
}
