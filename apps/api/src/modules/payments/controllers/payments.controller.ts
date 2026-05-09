import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  ParseArrayPipe,
  HttpCode,
  HttpStatus,
  Inject,
  forwardRef,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  HttpException,
  Req,
  UseInterceptors,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { i18nNotFound,i18nForbidden,i18nBadRequest } from '@/common/errors/i18n-exceptions';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Queue } from 'bull';
import { StripeService } from '../services/stripe.service';
import { PayoutsService } from '../services/payouts.service';
import { LedgerService } from '../services/ledger.service';
import { PaymentDataService } from '../services/payment-data.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { BookingStateMachineService } from '@/modules/bookings/services/booking-state-machine.service';
import { PaymentCommandLogService } from '../services/payment-command-log.service';
import {
  StartOnboardingDto,
  RequestPayoutDto,
  RequestRefundDto,
} from '../dto/payment.dto';
import { toNumber } from '@rental-portal/database';
import { JwtAuthGuard, CurrentUser } from '@/common/auth';
import { EmailVerifiedGuard, RequireEmailVerification } from '@/common/guards/email-verified.guard';
import { Idempotent } from '@/common/guards/idempotency.guard';
import { isAdminRole } from '@/common/auth/admin-roles';
import { randomUUID } from 'crypto';
import { OrganizationScopeService } from '@/common/authorization/organization-scope.service';

type AsyncMethodResult<T extends (...args: any[]) => Promise<any>> = Awaited<ReturnType<T>>;

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly stripe: StripeService,
    private readonly ledger: LedgerService,
    private readonly payouts: PayoutsService,
    private readonly paymentData: PaymentDataService,
    private readonly prisma: PrismaService,
    private readonly stateMachine: BookingStateMachineService,
    private readonly paymentCommandLog: PaymentCommandLogService,
    private readonly organizationScopeService: OrganizationScopeService,
    @InjectQueue('payments') private readonly paymentsQueue: Queue,
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
  @Idempotent()
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
    if (normalizedStatus === 'PENDING_PAYMENT') {
      const existingPayment = await this.paymentData.getLatestPaymentForBooking(bookingId);
      const existingClientSecret = this.getReusableClientSecret(existingPayment, booking.paymentIntentId);

      if (existingPayment?.paymentIntentId && existingClientSecret) {
        return {
          paymentIntentId: existingPayment.paymentIntentId,
          clientSecret: existingClientSecret,
        };
      }
    }

    if (normalizedStatus === 'PAYMENT_FAILED') {
      await this.stateMachine.transition(
        bookingId,
        'RETRY_PAYMENT',
        userId,
        'RENTER',
      );
    } else if (!['PENDING_PAYMENT'].includes(normalizedStatus)) {
      throw i18nBadRequest('booking.notReady');
    }

    // Move Stripe call OUTSIDE transaction to avoid long-running transactions
    const paymentResult = await this.stripe.createPaymentIntent(
      bookingId,
      toNumber(booking.totalPrice),
      booking.currency,
      booking.renter.stripeCustomerId || undefined,
    );

    // Transaction only for DB writes - much faster
    await this.prisma.$transaction(async (tx: any) => {
      await this.paymentData.updateBookingPaymentIntent(bookingId, paymentResult.paymentIntentId, tx);

      await this.paymentData.createPaymentRecord({
        bookingId,
        amount: booking.totalPrice,
        currency: booking.currency,
        status: 'PENDING',
        paymentIntentId: paymentResult.paymentIntentId,
        stripePaymentIntentId: paymentResult.paymentIntentId,
        metadata: {
          clientSecret: paymentResult.clientSecret,
          providerId: paymentResult.providerId ?? null,
        },
      }, tx);
    });

    return paymentResult;
  }

  @Get('bookings/:bookingId/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get checkout confirmation status for a booking payment' })
  @ApiResponse({ status: 200, description: 'Payment confirmation status retrieved' })
  async getBookingPaymentStatus(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    const booking = await this.paymentData.getBookingForPayment(bookingId);
    const isAdmin = isAdminRole(user.role);

    // Use organization scope resolver for authorization
    const hasAccess = (await this.organizationScopeService.checkScope(
      user.id,
      user.role,
      {
        resourceType: 'booking',
        resourceId: bookingId,
        ownerId: booking.ownerId,
        renterId: booking.renterId,
      },
    )).allowed;

    if (!hasAccess && !isAdmin) {
      throw i18nForbidden('booking.unauthorizedAction');
    }

    const payment = await this.paymentData.getLatestPaymentForBooking(bookingId);
    const paymentIntentId =
      payment?.paymentIntentId ||
      payment?.stripePaymentIntentId ||
      booking.paymentIntentId ||
      null;

    let providerStatus: string | null = null;
    let providerFailureReason: string | null = null;
    const shouldQueryProvider =
      Boolean(paymentIntentId) &&
      process.env['STRIPE_TEST_BYPASS'] !== 'true' &&
      !String(paymentIntentId).startsWith('pi_test_');

    if (shouldQueryProvider && paymentIntentId) {
      try {
        const providerState = await this.stripe.getPaymentIntentStatus(paymentIntentId);
        providerStatus = providerState.status;
        providerFailureReason = providerState.failureReason ?? null;
      } catch {
        providerStatus = null;
      }
    }

    const paymentStatus = String(payment?.status || 'PENDING').toUpperCase();
    const bookingStatus = String(booking.status || '').toUpperCase();
    const metadata = this.parsePaymentMetadata(payment?.metadata);
    const actionRequired =
      Boolean(metadata.requiresAction) ||
      ['requires_action', 'requires_confirmation'].includes(providerStatus || '');

    return {
      bookingId,
      paymentIntentId,
      bookingStatus,
      paymentStatus,
      providerStatus,
      actionRequired,
      failureReason: payment?.failureReason || providerFailureReason || null,
      confirmationState: this.resolveConfirmationState({
        bookingStatus,
        paymentStatus,
        providerStatus,
        actionRequired,
      }),
      updatedAt: payment?.updatedAt ?? null,
    };
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
  @ApiOperation({ summary: 'Queue security deposit release' })
  @ApiResponse({ status: 200, description: 'Deposit release queued' })
  async releaseDeposit(
    @Param('depositId') depositId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    const { deposit, booking } = await this.paymentData.getDepositWithBooking(depositId);

    // Use organization scope resolver for authorization
    await this.organizationScopeService.requireScope(user.id, user.role, {
      resourceType: 'booking',
      resourceId: booking.id,
      ownerId: booking.ownerId,
      renterId: booking.renterId,
    });

    const command = await this.paymentCommandLog.createCommand({
      userId: user.id,
      entityType: 'DEPOSIT_RELEASE',
      entityId: depositId,
      amount: toNumber(deposit.amount),
      currency: deposit.currency,
      requestedByRole: user.role,
      metadata: {
        bookingId: deposit.bookingId,
        depositId,
      },
    });

    await this.paymentsQueue.add(
      'release-deposit',
      {
        bookingId: deposit.bookingId,
        commandId: command.id,
        timestamp: new Date().toISOString(),
      },
      {
        jobId: `deposit-release:${depositId}`,
      },
    );

    await this.paymentCommandLog.markEnqueued(command.id, {
      jobName: 'release-deposit',
      jobId: `deposit-release:${depositId}`,
    });

    return { success: true, status: 'PENDING' };
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

  @Post('payouts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request payout' })
  @ApiResponse({ status: 201, description: 'Payout created' })
  async requestPayout(@CurrentUser('id') userId: string, @Body() dto: RequestPayoutDto) {
    // Validate amount is positive
    if (dto.amount <= 0) {
      throw i18nBadRequest('payment.invalidAmount');
    }
    
    // Check user has sufficient earnings
    const pendingEarnings = await this.payouts.getPendingEarnings(userId);
    if (!pendingEarnings || pendingEarnings.amount < dto.amount) {
      throw i18nBadRequest('payment.insufficientFunds');
    }
    
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

    // Use organization scope resolver for authorization
    await this.organizationScopeService.requireScope(userId, 'USER', {
      resourceType: 'booking',
      resourceId: bookingId,
      ownerId: booking.listing.ownerId,
      renterId: booking.renterId,
    });
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
  @Idempotent()
  @ApiOperation({ summary: 'Request a refund for a booking' })
  @ApiResponse({ status: 202, description: 'Refund queued for processing' })
  async requestRefund(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: { id: string; role: string },
    @Body() dto: RequestRefundDto,
  ) {
    // Get booking to verify ownership
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { renterId: true },
    });

    if (!booking) {
      throw i18nNotFound('booking.notFound');
    }

    // Find the payment for this booking
    const payment = await this.paymentData.getLatestPaymentForBooking(bookingId);

    if (!payment?.stripePaymentIntentId) {
      throw i18nBadRequest('payment.paymentNotFound');
    }

    // Verify the user is the renter or an admin
    const isRenter = booking.renterId === user.id;
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
    if (!isRenter && !isAdmin) {
      throw i18nForbidden('booking.unauthorizedAction');
    }

    const refundAmount = dto.amount ?? toNumber(payment.amount);
    const refundId = `refund_${randomUUID()}`;
    const refundRecord = await this.prisma.refund.create({
      data: {
        bookingId,
        amount: refundAmount,
        currency: payment.currency || 'USD',
        status: 'PENDING',
        refundId,
        reason: dto.reason,
        metadata: JSON.stringify({
          requestedBy: user.id,
          requestedByRole: user.role,
          paymentIntentId: payment.stripePaymentIntentId,
        }),
      },
    });

    const command = await this.paymentCommandLog.createCommand({
      userId: user.id,
      entityType: 'REFUND',
      entityId: refundRecord.id,
      amount: refundAmount,
      currency: payment.currency || 'USD',
      reason: dto.reason,
      requestedByRole: user.role,
      metadata: {
        bookingId,
        paymentIntentId: payment.stripePaymentIntentId,
      },
    });

    await this.paymentsQueue.add(
      'process-refund',
      {
        bookingId,
        refundRecordId: refundRecord.id,
        paymentIntentId: payment.stripePaymentIntentId,
        amount: refundAmount,
        currency: payment.currency || 'USD',
        reason: dto.reason || 'requested_by_customer',
        commandId: command.id,
        timestamp: new Date().toISOString(),
      },
      {
        jobId: `refund:${refundRecord.id}`,
      },
    );

    await this.paymentCommandLog.markEnqueued(command.id, {
      jobName: 'process-refund',
      jobId: `refund:${refundRecord.id}`,
    });

    return {
      refundId: refundRecord.id,
      amount: refundAmount,
      status: 'PENDING',
    };
  }

  private getReusableClientSecret(
    payment: { paymentIntentId?: string | null; status?: string | null; metadata?: string | null } | null | undefined,
    bookingPaymentIntentId?: string | null,
  ): string | null {
    if (!payment?.paymentIntentId || !bookingPaymentIntentId) {
      return null;
    }

    if (payment.paymentIntentId !== bookingPaymentIntentId) {
      return null;
    }

    const normalizedStatus = String(payment.status || '').toUpperCase();
    if (!['PENDING', 'PROCESSING'].includes(normalizedStatus)) {
      return null;
    }

    const metadata = this.parsePaymentMetadata(payment.metadata);
    return typeof metadata.clientSecret === 'string' && metadata.clientSecret.trim().length > 0
      ? metadata.clientSecret
      : null;
  }

  private parsePaymentMetadata(metadata: string | null | undefined): Record<string, unknown> {
    if (!metadata) {
      return {};
    }

    try {
      return JSON.parse(metadata);
    } catch {
      return {};
    }
  }

  private resolveConfirmationState(input: {
    bookingStatus: string;
    paymentStatus: string;
    providerStatus: string | null;
    actionRequired: boolean;
  }): 'confirmed' | 'processing' | 'action_required' | 'failed' | 'pending' {
    const {
      paymentStatus,
      providerStatus,
      actionRequired,
    } = input;

    // Payment status truth comes from Payment/Stripe state, not inferred booking status
    // Only use paymentStatus and providerStatus to determine confirmation state

    if (
      ['FAILED', 'CANCELLED'].includes(paymentStatus) ||
      ['requires_payment_method', 'canceled'].includes(providerStatus || '')
    ) {
      return 'failed';
    }

    if (actionRequired) {
      return 'action_required';
    }

    if (
      ['SUCCEEDED', 'COMPLETED'].includes(paymentStatus) ||
      ['succeeded'].includes(providerStatus || '')
    ) {
      return 'confirmed';
    }

    if (
      ['PROCESSING'].includes(paymentStatus) ||
      ['processing'].includes(providerStatus || '')
    ) {
      return 'processing';
    }

    return 'pending';
  }
}
