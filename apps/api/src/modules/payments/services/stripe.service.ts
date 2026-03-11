import { Injectable, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { i18nNotFound,i18nBadRequest } from '@/common/errors/i18n-exceptions';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { DepositStatus, BookingStatus, toNumber } from '@rental-portal/database';
import { toMinorUnits } from '@rental-portal/shared-types';
import { withRetry } from '../utils/stripe-retry';
import Stripe from 'stripe';
import {
  PaymentProvider,
  PaymentProviderConfig,
  CreatePaymentIntentParams,
  CreatePaymentIntentResult,
  HoldDepositParams,
  RefundParams,
  PayoutParams,
  AccountStatus,
} from '../interfaces/payment-provider.interface';

@Injectable()
export class StripeService implements PaymentProvider {
  private stripe: Stripe;
  private readonly logger = new Logger(StripeService.name);

  /**
   * Maps Stripe SDK errors to appropriate NestJS HTTP exceptions.
   * This prevents raw Stripe errors from surfacing as opaque 500s.
   */
  private handleStripeError(error: unknown, context: string): never {
    if (error instanceof Stripe.errors.StripeCardError) {
      throw new BadRequestException({
        message: error.message || 'Your card was declined',
        code: 'CARD_ERROR',
        declineCode: error.decline_code,
      });
    }
    if (error instanceof Stripe.errors.StripeInvalidRequestError) {
      throw new BadRequestException({
        message: error.message || 'Invalid payment request',
        code: 'INVALID_REQUEST',
      });
    }
    if (error instanceof Stripe.errors.StripeRateLimitError) {
      this.logger.error(`Stripe rate limit hit during ${context}`, error);
      throw new InternalServerErrorException({
        message: 'Payment service is temporarily busy. Please try again.',
        code: 'RATE_LIMIT',
      });
    }
    if (error instanceof Stripe.errors.StripeAuthenticationError) {
      this.logger.error(`Stripe authentication error during ${context} — check API keys`, error);
      throw new InternalServerErrorException({
        message: 'Payment service configuration error',
        code: 'AUTH_ERROR',
      });
    }
    if (error instanceof Stripe.errors.StripeConnectionError) {
      this.logger.error(`Stripe connection error during ${context}`, error);
      throw new InternalServerErrorException({
        message: 'Unable to connect to payment service. Please try again.',
        code: 'CONNECTION_ERROR',
      });
    }
    if (error instanceof Stripe.errors.StripeAPIError) {
      this.logger.error(`Stripe API error during ${context}`, error);
      throw new InternalServerErrorException({
        message: 'Payment service error. Please try again.',
        code: 'API_ERROR',
      });
    }
    // Re-throw NestJS exceptions as-is
    if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
      throw error;
    }
    // Unknown error
    this.logger.error(`Unknown error during ${context}`, error);
    throw new InternalServerErrorException({
      message: 'An unexpected payment error occurred',
    });
  }

  readonly providerId = 'stripe';
  readonly providerConfig: PaymentProviderConfig = {
    providerId: 'stripe',
    name: 'Stripe',
    supportedCountries: ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'JP', 'IN', 'SG', 'HK'],
    supportedCurrencies: ['USD', 'GBP', 'CAD', 'AUD', 'EUR', 'JPY', 'INR', 'SGD', 'HKD'],
  };

  get config(): PaymentProviderConfig {
    return this.providerConfig;
  }

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const stripeKey = configService.get<string>('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      throw new Error(
        'STRIPE_SECRET_KEY is not configured. Stripe payments will not work.',
      );
    }
    this.stripe = new Stripe(stripeKey, {
      apiVersion: '2026-01-28.clover',
    });
  }

  async createConnectAccount(userId: string, email: string): Promise<string> {
    // Check if user already has a Stripe account
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { stripeConnectId: true },
    });

    if (user?.stripeConnectId) {
      return user.stripeConnectId;
    }

    // Create Stripe Connect account
    const account = await withRetry(() =>
      this.stripe.accounts.create({
        type: 'express',
        email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      }),
    );

    // Save to database
    await this.prisma.user.update({
      where: { id: userId },
      data: { stripeConnectId: account.id },
    });

    return account.id;
  }

  async createAccountLink(
    accountId: string,
    returnUrl: string,
    refreshUrl: string,
  ): Promise<string> {
    try {
      const accountLink = await this.stripe.accountLinks.create({
        account: accountId,
        return_url: returnUrl,
        refresh_url: refreshUrl,
        type: 'account_onboarding',
      });

      return accountLink.url;
    } catch (error) {
      this.handleStripeError(error, 'createAccountLink');
    }
  }

  async getAccountStatus(accountId: string): Promise<{
    detailsSubmitted: boolean;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
  }> {
    try {
      const account = await this.stripe.accounts.retrieve(accountId);

      return {
        detailsSubmitted: account.details_submitted,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
      };
    } catch (error) {
      this.handleStripeError(error, 'getAccountStatus');
    }
  }

  async createPaymentIntent(
    bookingIdOrParams: string | CreatePaymentIntentParams,
    amount?: number,
    currency?: string,
    customerId?: string,
  ): Promise<CreatePaymentIntentResult> {
    const bookingId = typeof bookingIdOrParams === 'string' ? bookingIdOrParams : bookingIdOrParams.bookingId;
    const resolvedAmount = typeof bookingIdOrParams === 'string' ? amount : bookingIdOrParams.amount;
    const resolvedCurrency = typeof bookingIdOrParams === 'string' ? currency : bookingIdOrParams.currency;
    const resolvedCustomerId = typeof bookingIdOrParams === 'string' ? customerId : bookingIdOrParams.customerId;

    if (resolvedAmount == null || resolvedAmount <= 0) {
      throw new BadRequestException('Payment amount is required and must be greater than zero');
    }
    if (!resolvedCurrency) {
      throw new BadRequestException('Payment currency is required');
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        listing: { include: { owner: true } },
      },
    });

    if (!booking) {
      throw i18nNotFound('booking.notFound');
    }

    // ── TEST BYPASS ──────────────────────────────────────────────────────────
    // When STRIPE_TEST_BYPASS=true (E2E / CI environments without real Stripe
    // keys), return a synthetic PaymentIntent without hitting the Stripe API.
    // The client-side test flow must also skip Stripe.js confirmation and call
    // POST /bookings/:id/bypass-confirm to advance the booking to CONFIRMED.
    if (this.configService.get<string>('STRIPE_TEST_BYPASS') === 'true') {
      const syntheticPiId = `pi_test_bypass_${bookingId}`;
      this.logger.warn(
        `[STRIPE_TEST_BYPASS] Returning synthetic PaymentIntent ${syntheticPiId} for booking ${bookingId}`,
      );
      return {
        clientSecret: `${syntheticPiId}_secret`,
        paymentIntentId: syntheticPiId,
        providerId: this.providerId,
      };
    }
    // ─────────────────────────────────────────────────────────────────────────

    if (!booking.listing.owner.stripeConnectId) {
      throw i18nBadRequest('payment.ownerNotSetup');
    }

    // Create payment intent with application fee
    // Read platform fee percentage from config (default 10% as set in configuration.ts)
    const defaultFeeRate = this.configService.get<number>('fees.platformFeePercent', 10) / 100;
    const platformFeeAmount = booking.platformFee 
      ? toMinorUnits(toNumber(booking.platformFee), resolvedCurrency)
      : toMinorUnits(resolvedAmount * defaultFeeRate, resolvedCurrency);

    // Use bookingId as a deterministic idempotency key to prevent duplicate charges on network retries
    const idempotencyKey = `pi_${bookingId}`;
    const paymentIntent = await withRetry(() =>
      this.stripe.paymentIntents.create(
        {
          amount: toMinorUnits(resolvedAmount, resolvedCurrency),
          currency: resolvedCurrency.toLowerCase(),
          customer: resolvedCustomerId,
          application_fee_amount: platformFeeAmount,
          transfer_data: {
            destination: booking.listing.owner.stripeConnectId,
          },
          metadata: {
            bookingId,
            renterId: booking.renterId,
            listingId: booking.listingId,
          },
        },
        { idempotencyKey },
      ),
    );

    if (!paymentIntent.client_secret) {
      throw new Error('Failed to retrieve client secret from Stripe');
    }

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      providerId: this.providerId,
    };
  }

  async capturePaymentIntent(paymentIntentId: string): Promise<void> {
    await withRetry(() =>
      this.stripe.paymentIntents.capture(
        paymentIntentId,
        {},
        { idempotencyKey: `capture_${paymentIntentId}` },
      ),
    );
  }

  async holdDeposit(bookingIdOrParams: string | HoldDepositParams, amount?: number, currency?: string): Promise<string> {
    const bookingId = typeof bookingIdOrParams === 'string' ? bookingIdOrParams : bookingIdOrParams.bookingId;
    const resolvedAmount = typeof bookingIdOrParams === 'string' ? amount : bookingIdOrParams.amount;
    const resolvedCurrency = typeof bookingIdOrParams === 'string' ? currency : bookingIdOrParams.currency;

    if (resolvedAmount == null || resolvedAmount <= 0) {
      throw new BadRequestException('Deposit amount is required and must be greater than zero');
    }
    if (!resolvedCurrency) {
      throw new BadRequestException('Deposit currency is required');
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { renter: true },
    });

    if (!booking) {
      throw i18nNotFound('booking.notFound');
    }

    // Prevent double deposit hold — check for existing active hold on this booking
    const existingHold = await this.prisma.depositHold.findFirst({
      where: {
        bookingId,
        status: { in: [DepositStatus.AUTHORIZED, DepositStatus.HELD, DepositStatus.PENDING] },
      },
    });
    if (existingHold) {
      return existingHold.paymentIntentId;
    }

    // ── TEST BYPASS ──────────────────────────────────────────────────────────
    if (this.configService.get<string>('STRIPE_TEST_BYPASS') === 'true') {
      const syntheticPiId = `pi_test_deposit_bypass_${bookingId}`;
      this.logger.warn(
        `[STRIPE_TEST_BYPASS] Creating synthetic deposit hold ${syntheticPiId} for booking ${bookingId}`,
      );
      await this.prisma.depositHold.create({
        data: {
          bookingId,
          amount: resolvedAmount,
          currency: resolvedCurrency,
          paymentIntentId: syntheticPiId,
          status: DepositStatus.AUTHORIZED,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      return syntheticPiId;
    }
    // ─────────────────────────────────────────────────────────────────────────

    const paymentIntent = await withRetry(() =>
      this.stripe.paymentIntents.create(
        {
          amount: toMinorUnits(resolvedAmount, resolvedCurrency),
          currency: resolvedCurrency.toLowerCase(),
          customer: booking.renter.stripeCustomerId ?? undefined,
          capture_method: 'manual', // Hold funds without capturing
          metadata: {
            type: 'deposit',
            bookingId,
          },
        },
        { idempotencyKey: `deposit_hold_${bookingId}` },
      ),
    );

    // Create deposit hold record
    await this.prisma.depositHold.create({
      data: {
        bookingId,
        amount: resolvedAmount,
        currency: resolvedCurrency,
        paymentIntentId: paymentIntent.id,
        status: DepositStatus.AUTHORIZED,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days expiry approx
      },
    });

    return paymentIntent.id;
  }

  async releaseDeposit(depositHoldId: string): Promise<void> {
    const deposit = await this.prisma.depositHold.findUnique({
      where: { id: depositHoldId },
    });

    if (!deposit) {
      throw i18nNotFound('payment.depositNotFound');
    }

    // Map logic: 'HELD' means AUTHORIZED.
    if (deposit.status !== DepositStatus.AUTHORIZED) {
      throw i18nBadRequest('payment.depositNotAuthorized');
    }

    // Cancel the payment intent to release the hold
    await withRetry(() => this.stripe.paymentIntents.cancel(deposit.paymentIntentId));

    // Update status
    await this.prisma.depositHold.update({
      where: { id: depositHoldId },
      data: {
        status: DepositStatus.RELEASED,
        releasedAt: new Date(),
      },
    });
  }

  async captureDeposit(depositHoldId: string, amount?: number): Promise<void> {
    const deposit = await this.prisma.depositHold.findUnique({
      where: { id: depositHoldId },
    });

    if (!deposit) {
      throw i18nNotFound('payment.depositNotFound');
    }

    if (deposit.status !== DepositStatus.AUTHORIZED) {
      throw i18nBadRequest('payment.depositNotAuthorized');
    }

    // Capture the payment intent (or partial amount)
    const captureAmount = amount ? toMinorUnits(amount, deposit.currency) : undefined;

    await withRetry(() =>
      this.stripe.paymentIntents.capture(deposit.paymentIntentId, {
        amount_to_capture: captureAmount,
      }),
    );

    // Update status
    await this.prisma.depositHold.update({
      where: { id: depositHoldId },
      data: {
        status: DepositStatus.CAPTURED,
        capturedAt: new Date(),
        deductedAmount: amount || deposit.amount,
      },
    });
  }

  async createRefund(paymentIntentIdOrParams: string | RefundParams, amount?: number, currency?: string, reason?: string): Promise<string> {
    const piId = typeof paymentIntentIdOrParams === 'string' ? paymentIntentIdOrParams : paymentIntentIdOrParams.paymentIntentId;
    const resolvedAmount = typeof paymentIntentIdOrParams === 'string' ? amount : paymentIntentIdOrParams.amount;
    const resolvedCurrency = typeof paymentIntentIdOrParams === 'string' ? currency : paymentIntentIdOrParams.currency;
    const resolvedReason = typeof paymentIntentIdOrParams === 'string' ? reason : paymentIntentIdOrParams.reason;

    if (resolvedAmount == null || resolvedAmount <= 0) {
      throw new BadRequestException('Refund amount is required and must be greater than zero');
    }
    if (!resolvedCurrency) {
      throw new BadRequestException('Refund currency is required');
    }

    // Use deterministic idempotency key to prevent duplicate refunds on network retries
    const refundIdempotencyKey = `refund_${piId}_${toMinorUnits(resolvedAmount, resolvedCurrency)}`;
    try {
      const refund = await this.stripe.refunds.create(
        {
          payment_intent: piId,
          amount: toMinorUnits(resolvedAmount, resolvedCurrency),
          reason: resolvedReason as Stripe.RefundCreateParams.Reason,
        },
        { idempotencyKey: refundIdempotencyKey },
      );

      return refund.id;
    } catch (error) {
      this.handleStripeError(error, 'createRefund');
    }
  }

  async createPayout(accountIdOrParams: string | PayoutParams, amount?: number, currency?: string): Promise<string> {
    const accountId = typeof accountIdOrParams === 'string' ? accountIdOrParams : accountIdOrParams.accountId;
    const resolvedAmount = typeof accountIdOrParams === 'string' ? amount : accountIdOrParams.amount;
    const resolvedCurrency = typeof accountIdOrParams === 'string' ? currency : accountIdOrParams.currency;

    if (resolvedAmount == null || resolvedAmount <= 0) {
      throw new BadRequestException('Payout amount is required and must be greater than zero');
    }
    if (!resolvedCurrency) {
      throw new BadRequestException('Payout currency is required');
    }

    try {
      const payout = await withRetry(() =>
        this.stripe.payouts.create(
          {
            amount: toMinorUnits(resolvedAmount, resolvedCurrency),
            currency: resolvedCurrency.toLowerCase(),
          },
          {
            stripeAccount: accountId,
          },
        ),
      );

      return payout.id;
    } catch (error) {
      this.handleStripeError(error, 'createPayout');
    }
  }

  async createCustomer(userId: string, email: string, name: string): Promise<string> {
    try {
      const customer = await this.stripe.customers.create({
        email,
        name,
        metadata: {
          userId,
        },
      });

      // Update user with customer ID
      await this.prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customer.id },
      });

      return customer.id;
    } catch (error) {
      this.handleStripeError(error, 'createCustomer');
    }
  }

  async attachPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    try {
      await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });
    } catch (error) {
      this.handleStripeError(error, 'attachPaymentMethod');
    }
  }

  async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    try {
      await this.stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
    } catch (error) {
      this.handleStripeError(error, 'setDefaultPaymentMethod');
    }
  }

  async getPaymentMethods(customerId: string) {
    return this.stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });
  }
}
