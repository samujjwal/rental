import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { BookingStatus } from '@rental-portal/database';
import { CacheService } from '../../../common/cache/cache.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FraudIntelligenceService } from './fraud-intelligence.service';
import { AvailabilityGraphService } from './availability-graph.service';
import { PaymentOrchestrationService } from './payment-orchestration.service';
import { TaxPolicyEngineService } from './tax-policy-engine.service';
import { CountryPolicyPackService } from './country-policy-pack.service';

/**
 * Checkout Orchestrator Service (V5 Prompt 1 — Domain Model §CheckoutOrchestrator)
 *
 * Implements the Saga pattern for the booking checkout flow:
 *   1. Validate Policy Pack rules (country compliance, guest eligibility)
 *   2. Fraud Risk Assessment (synchronous intercept)
 *   3. Availability Lock (10-min TTL via Redis distributed lock)
 *   4. Tax Calculation (cascading policy engine)
 *   5. Payment Authorization (pluggable provider)
 *   6. Booking Confirmation (Prisma transaction)
 *   7. Event Emission (for downstream: inventory graph, demand signals, etc.)
 *
 * Compensating actions roll back prior steps on failure at any point.
 */

interface CheckoutParams {
  userId: string;
  listingId: string;
  startDate: Date;
  endDate: Date;
  guestCount: number;
  paymentMethod: string;
  country: string;
  currency: string;
  metadata?: Record<string, any>;
}

export interface CheckoutResult {
  bookingId: string;
  status: string;
  totalAmount: number;
  taxAmount: number;
  serviceFee: number;
  paymentTransactionId: string;
  provider: string;
  lockId: string;
}

@Injectable()
export class CheckoutOrchestratorService {
  private readonly logger = new Logger(CheckoutOrchestratorService.name);
  private static readonly LOCK_TTL_SECONDS = 600; // 10 minutes
  private static readonly LOCK_PREFIX = 'avail_lock:';

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly eventEmitter: EventEmitter2,
    private readonly fraudService: FraudIntelligenceService,
    private readonly availabilityService: AvailabilityGraphService,
    private readonly paymentService: PaymentOrchestrationService,
    private readonly taxService: TaxPolicyEngineService,
    private readonly policyService: CountryPolicyPackService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Execute the full checkout saga.
   */
  async checkout(params: CheckoutParams): Promise<CheckoutResult> {
    const sagaSteps: string[] = [];
    let lockId: string | null = null;
    let paymentTxId: string | null = null;
    let paymentProvider: string | null = null;

    try {
      // ── Step 1: Policy Pack Validation ──
      this.logger.log(`Checkout[${params.listingId}] Step 1: Policy validation`);
      await this.validatePolicyRules(params);
      sagaSteps.push('POLICY_VALIDATED');

      // ── Step 2: Fraud Risk Assessment ──
      this.logger.log(`Checkout[${params.listingId}] Step 2: Fraud assessment`);
      await this.assessFraudRisk(params);
      sagaSteps.push('FRAUD_CLEARED');

      // ── Step 3: Availability Lock (Redis distributed lock, 10-min TTL) ──
      this.logger.log(`Checkout[${params.listingId}] Step 3: Availability lock`);
      lockId = await this.acquireAvailabilityLock(params);
      sagaSteps.push('AVAILABILITY_LOCKED');

      // ── Step 4: Verify availability (DB check while lock held) ──
      this.logger.log(`Checkout[${params.listingId}] Step 4: Availability verify`);
      const listing = await this.verifyAvailability(params);
      sagaSteps.push('AVAILABILITY_VERIFIED');

      // ── Step 5: Calculate pricing + taxes ──
      this.logger.log(`Checkout[${params.listingId}] Step 5: Price calculation`);
      const pricing = await this.calculatePricing(params, listing);
      sagaSteps.push('PRICING_CALCULATED');

      // ── Step 6: Payment Authorization ──
      this.logger.log(`Checkout[${params.listingId}] Step 6: Payment authorization`);
      const paymentResult = await this.authorizePayment(params, pricing);
      paymentTxId = paymentResult.transactionId;
      paymentProvider = paymentResult.provider;
      sagaSteps.push('PAYMENT_AUTHORIZED');

      // ── Step 7: Create booking (Prisma transaction) ──
      this.logger.log(`Checkout[${params.listingId}] Step 7: Booking creation`);
      const booking: any = await this.createBooking(params, pricing, paymentResult);
      sagaSteps.push('BOOKING_CREATED');

      // ── Step 8: Emit domain events ──
      this.emitCheckoutEvents(booking, params, pricing);
      sagaSteps.push('EVENTS_EMITTED');

      this.logger.log(`Checkout[${params.listingId}] completed: ${booking.id}`);

      return {
        bookingId: booking.id,
        status: 'CONFIRMED',
        totalAmount: pricing.totalAmount,
        taxAmount: pricing.taxAmount,
        serviceFee: pricing.serviceFee,
        paymentTransactionId: paymentTxId,
        provider: paymentProvider,
        lockId: lockId!,
      };
    } catch (error) {
      // ── Compensating Actions ──
      this.logger.error(
        `Checkout[${params.listingId}] failed at steps [${sagaSteps.join(',')}]: ${error.message}`,
      );
      await this.compensate(sagaSteps, lockId, paymentTxId, paymentProvider, params);
      throw error;
    }
  }

  /**
   * Refresh an existing availability lock (heartbeat during payment processing).
   */
  async refreshLock(lockId: string): Promise<boolean> {
    const key = `${CheckoutOrchestratorService.LOCK_PREFIX}${lockId}`;
    try {
      const exists = await this.cache.exists(key);
      if (exists) {
        await this.cache.set(key, { refreshedAt: new Date().toISOString() }, CheckoutOrchestratorService.LOCK_TTL_SECONDS);
        return true;
      }
      return false;
    } catch (error) {
      this.logger.warn(`Failed to refresh availability lock ${lockId}: ${error instanceof Error ? error.message : error}`);
      return false;
    }
  }

  /**
   * Release an availability lock explicitly.
   */
  async releaseLock(lockId: string): Promise<void> {
    const key = `${CheckoutOrchestratorService.LOCK_PREFIX}${lockId}`;
    await this.cache.del(key);
  }

  // ── Saga Step Implementations ──────────────────────────────

  private async validatePolicyRules(params: CheckoutParams): Promise<void> {
    try {
      const validation = await this.policyService.validateBooking(
        params.country,
        {
          startDate: params.startDate,
          endDate: params.endDate,
          guestCount: params.guestCount,
          currency: params.currency,
        },
      );

      if (!validation.valid) {
        throw new BadRequestException(
          `Policy validation failed: ${validation.violations.join(', ')}`,
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      // If policy pack not found, allow checkout (graceful degradation)
      this.logger.warn(`Policy validation skipped for ${params.country}: ${error.message}`);
    }
  }

  private async assessFraudRisk(params: CheckoutParams): Promise<void> {
    const riskResult = await this.fraudService.analyzeRisk({
      userId: params.userId,
      action: 'BOOKING',
      amount: 0, // Will be calculated later; initial check is velocity/device based
      metadata: {
        listingId: params.listingId,
        country: params.country,
      },
    });

    if (riskResult.decision === 'BLOCK') {
      throw new BadRequestException(
        'Booking blocked by fraud prevention. Please contact support.',
      );
    }

    if (riskResult.decision === 'REVIEW') {
      this.logger.warn(
        `Checkout[${params.listingId}] flagged for review: risk ${riskResult.riskScore}`,
      );
      // Allow checkout but flag for manual review
      this.eventEmitter.emit('fraud.checkout_flagged', {
        userId: params.userId,
        listingId: params.listingId,
        riskScore: riskResult.riskScore,
      });
    }
  }

  private async acquireAvailabilityLock(params: CheckoutParams): Promise<string> {
    const lockId = `${params.listingId}:${params.startDate.toISOString()}:${params.endDate.toISOString()}`;
    const lockKey = `${CheckoutOrchestratorService.LOCK_PREFIX}${lockId}`;

    const acquired = await this.cache.setNx(
      lockKey,
      {
        userId: params.userId,
        listingId: params.listingId,
        startDate: params.startDate,
        endDate: params.endDate,
        acquiredAt: new Date().toISOString(),
      },
      CheckoutOrchestratorService.LOCK_TTL_SECONDS,
    );

    if (!acquired) {
      throw new BadRequestException(
        'These dates are currently being booked by another user. Please try again shortly.',
      );
    }

    return lockId;
  }

  private async verifyAvailability(params: CheckoutParams) {
    const availability = await this.availabilityService.checkRealTimeAvailability(
      params.listingId,
      params.startDate,
      params.endDate,
    );

    if (!availability.available) {
      throw new BadRequestException(
        'This listing is not available for the selected dates.',
      );
    }

    const listing = await this.prisma.listing.findUnique({
      where: { id: params.listingId },
      include: { owner: { select: { id: true, stripeConnectId: true } } },
    });

    if (!listing) {
      throw new BadRequestException('Listing not found.');
    }

    return listing;
  }

  private async calculatePricing(
    params: CheckoutParams,
    listing: any,
  ): Promise<{
    baseAmount: number;
    nights: number;
    serviceFee: number;
    taxAmount: number;
    totalAmount: number;
    taxBreakdown: any[];
  }> {
    const nights = Math.ceil(
      (params.endDate.getTime() - params.startDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const baseAmount = Number(listing.basePrice) * nights;
    const feeRate = this.configService.get<number>('fees.platformFeePercent', 10) / 100;
    const serviceFee = Math.round(baseAmount * feeRate * 100) / 100;

    // Tax calculation via cascading policy engine
    let taxAmount = 0;
    let taxBreakdown: any[] = [];
    try {
      const taxResult = await this.taxService.calculateTax(
        params.country,
        baseAmount + serviceFee,
      );
      taxAmount = taxResult.totalTax;
      taxBreakdown = taxResult.breakdown;
    } catch (error) {
      const taxRequired = this.configService.get<boolean>('TAX_CALC_REQUIRED', false);
      if (taxRequired) {
        throw new BadRequestException(
          `Tax calculation is required but failed: ${error.message}`,
        );
      }
      this.logger.warn(`Tax calculation failed, proceeding without tax: ${error.message}`);
    }

    const totalAmount = Math.round((baseAmount + serviceFee + taxAmount) * 100) / 100;

    return { baseAmount, nights, serviceFee, taxAmount, totalAmount, taxBreakdown };
  }

  private async authorizePayment(
    params: CheckoutParams,
    pricing: { totalAmount: number },
  ) {
    return this.paymentService.authorize({
      amount: pricing.totalAmount,
      currency: params.currency,
      country: params.country,
      userId: params.userId,
      bookingId: undefined, // Will be set after booking creation
      metadata: {
        listingId: params.listingId,
        startDate: params.startDate.toISOString(),
        endDate: params.endDate.toISOString(),
      },
    });
  }

  private async createBooking(
    params: CheckoutParams,
    pricing: any,
    paymentResult: any,
  ) {
    // Fetch listing for ownerId
    const listing = await this.prisma.listing.findUnique({
      where: { id: params.listingId },
      select: { ownerId: true },
    });
    if (!listing) {
      throw new BadRequestException('Listing not found during booking creation.');
    }

    return this.prisma.$transaction(async (tx: any) => {
      // Database-level advisory lock using two 32-bit halves of the UUID for collision resistance
      const buf = Buffer.from(params.listingId.replace(/-/g, ''), 'hex');
      const lockKey1 = buf.readInt32BE(0);
      const lockKey2 = buf.readInt32BE(4);
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock($1, $2)`, lockKey1, lockKey2);

      const booking = await tx.booking.create({
        data: {
          listingId: params.listingId,
          renterId: params.userId,
          ownerId: listing.ownerId,
          startDate: params.startDate,
          endDate: params.endDate,
          basePrice: pricing.baseAmount,
          totalPrice: pricing.totalAmount,
          serviceFee: pricing.serviceFee,
          taxAmount: pricing.taxAmount,
          status: BookingStatus.CONFIRMED,
          guestCount: params.guestCount,
          currency: params.currency,
          metadata: JSON.stringify({
            nights: pricing.nights,
            taxBreakdown: pricing.taxBreakdown,
            paymentProvider: paymentResult.provider,
            paymentTransactionId: paymentResult.transactionId,
          }),
        },
      });

      // Record initial state history
      await tx.bookingStateHistory.create({
        data: {
          bookingId: booking.id,
          toStatus: BookingStatus.CONFIRMED,
          changedBy: params.userId,
          reason: 'Checkout saga — booking created',
        },
      });

      // Create ledger entry (double-entry)
      await tx.ledgerEntry.create({
        data: {
          bookingId: booking.id,
          accountId: `platform_${booking.id}`,
          accountType: 'RECEIVABLE',
          side: 'DEBIT',
          transactionType: 'PAYMENT',
          amount: pricing.totalAmount,
          currency: params.currency,
          description: `Booking ${booking.id} - Authorization`,
          referenceId: paymentResult.transactionId,
          status: 'POSTED',
          metadata: JSON.stringify({
            provider: paymentResult.provider,
            baseAmount: pricing.baseAmount,
            serviceFee: pricing.serviceFee,
            taxAmount: pricing.taxAmount,
          }),
        },
      });

      return booking;
    });
  }

  private emitCheckoutEvents(booking: any, params: CheckoutParams, pricing: any) {
    this.eventEmitter.emit('booking.created', {
      bookingId: booking.id,
      listingId: params.listingId,
      startDate: params.startDate,
      endDate: params.endDate,
      userId: params.userId,
      totalAmount: pricing.totalAmount,
    });

    this.eventEmitter.emit('demand.signal', {
      type: 'BOOKING',
      country: params.country,
      listingId: params.listingId,
      value: pricing.totalAmount,
    });

    this.eventEmitter.emit('inventory.booking_created', {
      listingId: params.listingId,
      startDate: params.startDate,
      endDate: params.endDate,
    });
  }

  // ── Compensating Actions ──────────────────────────────

  private async compensate(
    completedSteps: string[],
    lockId: string | null,
    paymentTxId: string | null,
    paymentProvider: string | null,
    params: CheckoutParams,
  ) {
    // Reverse in LIFO order
    if (completedSteps.includes('PAYMENT_AUTHORIZED') && paymentTxId && paymentProvider) {
      try {
        this.logger.log(`Compensating: cancelling payment ${paymentTxId}`);
        // Cancel (void) the payment intent instead of issuing a $0 refund
        await this.paymentService.cancel(paymentTxId, paymentProvider, 'Checkout saga rollback');
      } catch (cancelErr: any) {
        // Fallback to refund if cancel is not available/supported
        try {
          this.logger.warn(`Cancel failed, falling back to refund for ${paymentTxId}`);
          // Refund full authorized amount (not $0) as cancel fallback
          await this.paymentService.refund(paymentTxId, undefined as any, paymentProvider, 'Checkout saga rollback — cancel fallback');
        } catch (refundErr: any) {
          this.logger.error(`Failed to void/refund payment ${paymentTxId}: ${refundErr.message}`);
        }
      }
    }

    if (completedSteps.includes('AVAILABILITY_LOCKED') && lockId) {
      try {
        this.logger.log(`Compensating: releasing lock ${lockId}`);
        await this.releaseLock(lockId);
      } catch (err) {
        this.logger.error(`Failed to release lock ${lockId}: ${err.message}`);
      }
    }

    this.eventEmitter.emit('checkout.failed', {
      userId: params.userId,
      listingId: params.listingId,
      completedSteps,
      failedAt: new Date().toISOString(),
    });
  }
}
