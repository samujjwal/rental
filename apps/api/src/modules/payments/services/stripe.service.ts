import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { DepositStatus, BookingStatus, toNumber } from '@rental-portal/database';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.stripe = new Stripe(config.get<string>('STRIPE_SECRET_KEY') || '', {
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
    const account = await this.stripe.accounts.create({
      type: 'express',
      email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

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
    const accountLink = await this.stripe.accountLinks.create({
      account: accountId,
      return_url: returnUrl,
      refresh_url: refreshUrl,
      type: 'account_onboarding',
    });

    return accountLink.url;
  }

  async getAccountStatus(accountId: string): Promise<{
    detailsSubmitted: boolean;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
  }> {
    const account = await this.stripe.accounts.retrieve(accountId);

    return {
      detailsSubmitted: account.details_submitted,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
    };
  }

  async createPaymentIntent(
    bookingId: string,
    amount: number,
    currency: string,
    customerId?: string,
  ): Promise<{ clientSecret: string; paymentIntentId: string }> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        listing: { include: { owner: true } },
      },
    });

    if (!booking) {
      throw new BadRequestException('Booking not found');
    }

    if (!booking.listing.owner.stripeConnectId) {
      throw new BadRequestException('Owner has not set up payments');
    }

    // Create payment intent with application fee
    const platformFeeAmount = Math.round(toNumber(booking.platformFee) * 100);

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      customer: customerId,
      application_fee_amount: platformFeeAmount,
      transfer_data: {
        destination: booking.listing.owner.stripeConnectId,
      },
      metadata: {
        bookingId,
        renterId: booking.renterId,
        listingId: booking.listingId,
      },
    });

    if (!paymentIntent.client_secret) {
      throw new Error('Failed to retrieve client secret from Stripe');
    }

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    };
  }

  async capturePaymentIntent(paymentIntentId: string): Promise<void> {
    await this.stripe.paymentIntents.capture(paymentIntentId);
  }

  async holdDeposit(bookingId: string, amount: number, currency: string): Promise<string> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { renter: true },
    });

    if (!booking) {
      throw new BadRequestException('Booking not found');
    }

    // Create a payment method for deposit hold (authorization)
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: currency.toLowerCase(),
      customer: booking.renter.stripeCustomerId ?? undefined,
      capture_method: 'manual', // Hold funds without capturing
      metadata: {
        type: 'deposit',
        bookingId,
      },
    });

    // Create deposit hold record
    await this.prisma.depositHold.create({
      data: {
        bookingId,
        amount,
        currency,
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
      throw new BadRequestException('Deposit hold not found');
    }

    // Map logic: 'HELD' means AUTHORIZED.
    if (deposit.status !== DepositStatus.AUTHORIZED) {
      throw new BadRequestException('Deposit not in AUTHORIZED status');
    }

    // Cancel the payment intent to release the hold
    await this.stripe.paymentIntents.cancel(deposit.paymentIntentId);

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
      throw new BadRequestException('Deposit hold not found');
    }

    if (deposit.status !== DepositStatus.AUTHORIZED) {
      throw new BadRequestException('Deposit not in AUTHORIZED status');
    }

    // Capture the payment intent (or partial amount)
    const captureAmount = amount ? Math.round(amount * 100) : undefined;

    await this.stripe.paymentIntents.capture(deposit.paymentIntentId, {
      amount_to_capture: captureAmount,
    });

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

  async createRefund(paymentIntentId: string, amount: number, reason?: string): Promise<string> {
    const refund = await this.stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: Math.round(amount * 100),
      reason: reason as any,
    });

    return refund.id;
  }

  async createPayout(accountId: string, amount: number, currency: string): Promise<string> {
    const payout = await this.stripe.payouts.create(
      {
        amount: Math.round(amount * 100),
        currency: currency.toLowerCase(),
      },
      {
        stripeAccount: accountId,
      },
    );

    return payout.id;
  }

  async createCustomer(userId: string, email: string, name: string): Promise<string> {
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
  }

  async attachPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    await this.stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });
  }

  async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    await this.stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
  }

  async getPaymentMethods(customerId: string) {
    return this.stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });
  }

  async handleWebhook(signature: string, payload: Buffer): Promise<any> {
    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new BadRequestException('Stripe webhook secret is not configured');
    }

    try {
      const event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
      return event;
    } catch (err) {
      throw new BadRequestException(`Webhook signature verification failed: ${err.message}`);
    }
  }

  async processWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case 'account.updated':
        await this.handleAccountUpdated(event.data.object as Stripe.Account);
        break;

      case 'payout.paid':
        await this.handlePayoutPaid(event.data.object as Stripe.Payout);
        break;

      case 'payout.failed':
        await this.handlePayoutFailed(event.data.object as Stripe.Payout);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  }

  private async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const bookingId = paymentIntent.metadata.bookingId;
    if (!bookingId) return;

    // Update booking with payment info
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        paymentIntentId: paymentIntent.id,
        // CONFIRMED normally means approved by owner, but also payment successful.
        // Assuming flow is: Request -> Owner Approves (PendingPayment) -> Payment Succeeds (CONFIRMED).
        status: BookingStatus.CONFIRMED,
      },
    });

    // Transition booking state if payment was pending
    // This would call BookingStateMachineService
    console.log(`Payment succeeded for booking ${bookingId}`);
  }

  private async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const bookingId = paymentIntent.metadata.bookingId;
    if (!bookingId) return;

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        // If payment fails, it might go back to pending payment or stay there.
        // We don't have a 'PAYMENT_FAILED' status.
        // We can leave it as PENDING_PAYMENT or move to CANCELLED if expired?
        // Let's not change status blindly to something that doesn't exist.
        // paymentStatus: 'FAILED', // Removed
      },
    });

    console.log(`Payment failed for booking ${bookingId}`);
  }

  private async handleAccountUpdated(account: Stripe.Account): Promise<void> {
    await this.prisma.user.updateMany({
      where: { stripeConnectId: account.id },
      data: {
        stripeOnboardingComplete: account.details_submitted,
      },
    });
  }

  private async handlePayoutPaid(payout: Stripe.Payout): Promise<void> {
    console.log(`Payout ${payout.id} paid successfully`);
  }

  private async handlePayoutFailed(payout: Stripe.Payout): Promise<void> {
    console.log(`Payout ${payout.id} failed`);
  }
}
