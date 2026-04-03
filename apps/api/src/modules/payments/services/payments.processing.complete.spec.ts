import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';
import { ConfigService } from '@nestjs/config';
import { StripeService } from '../services/stripe.service';
import { LedgerService } from '../services/ledger.service';
import { PayoutsService } from '../services/payouts.service';
import { EscrowService } from '../services/escrow.service';
import { PaymentProcessor } from '../processors/payment.processor';
import { PaymentStatus, TransactionType, LedgerEntryStatus } from '@rental-portal/database';

/**
 * Payment Processing - Complete Coverage
 * 
 * These tests validate complete payment processing including
 * Stripe integration, refunds, reconciliation, and financial integrity.
 */
describe('Payment Processing - Complete Coverage', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cache: CacheService;
  let stripeService: StripeService;
  let ledgerService: LedgerService;
  let payoutsService: PayoutsService;
  let escrowService: EscrowService;
  let paymentProcessor: PaymentProcessor;

  const mockStripe = {
    paymentIntents: {
      create: jest.fn(),
      retrieve: jest.fn(),
      confirm: jest.fn(),
      cancel: jest.fn(),
      update: jest.fn(),
    },
    paymentMethods: {
      create: jest.fn(),
      retrieve: jest.fn(),
      list: jest.fn(),
    },
    refunds: {
      create: jest.fn(),
      retrieve: jest.fn(),
      update: jest.fn(),
    },
    payouts: {
      create: jest.fn(),
      retrieve: jest.fn(),
      update: jest.fn(),
      cancel: jest.fn(),
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
    accounts: {
      create: jest.fn(),
      retrieve: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockBooking = {
    id: 'booking-1',
    userId: 'user-1',
    listingId: 'listing-1',
    hostId: 'host-1',
    totalAmount: 1000,
    currency: 'USD',
    status: 'PENDING_PAYMENT',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrisma = {
      booking: {
        findUnique: jest.fn().mockResolvedValue(mockBooking),
        update: jest.fn().mockResolvedValue(mockBooking),
        findMany: jest.fn().mockResolvedValue([mockBooking]),
      },
      payment: {
        create: jest.fn().mockResolvedValue({ id: 'payment-1' }),
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue(null),
      },
      ledgerEntry: {
        create: jest.fn().mockResolvedValue({ id: 'ledger-1' }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue(null),
      },
      payout: {
        create: jest.fn().mockResolvedValue({ id: 'payout-1' }),
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue(null),
      },
      depositHold: {
        create: jest.fn().mockResolvedValue({ id: 'hold-1' }),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(null),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      $transaction: jest.fn().mockImplementation((callback) => callback()),
    } as any;

    const mockCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeService,
        LedgerService,
        PayoutsService,
        EscrowService,
        PaymentProcessor,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    })
      .overrideProvider('StripeService')
      .useValue(mockStripe)
      .compile();

    stripeService = module.get<StripeService>(StripeService);
    ledgerService = module.get<LedgerService>(LedgerService);
    payoutsService = module.get<PayoutsService>(PayoutsService);
    escrowService = module.get<EscrowService>(EscrowService);
    paymentProcessor = module.get<PaymentProcessor>(PaymentProcessor);
    prisma = module.get<PrismaService>(PrismaService);
    cache = module.get<CacheService>(CacheService);
  });

  describe('Stripe Integration', () => {
    it('should handle all payment methods', async () => {
      const paymentMethods = [
        {
          type: 'card',
          card: {
            number: '4242424242424242',
            exp_month: 12,
            exp_year: 2026,
            cvc: '123',
          },
        },
        {
          type: 'us_bank_account',
          us_bank_account: {
            account_number: '000123456789',
            routing_number: '110000000',
            account_holder_name: 'John Doe',
          },
        },
        {
          type: 'sepa_debit',
          sepa_debit: {
            iban: 'DE89370400440532013000',
            account_holder_name: 'John Doe',
          },
        },
      ];

      for (const paymentMethod of paymentMethods) {
        (mockStripe.paymentMethods.create as jest.Mock).mockResolvedValue({
          id: `pm_${paymentMethod.type}`,
          type: paymentMethod.type,
        });

        const result = await stripeService.createPaymentMethod(
          'user-1',
          paymentMethod
        );

        expect(result.id).toBeDefined();
        expect(result.type).toBe(paymentMethod.type);
        expect(mockStripe.paymentMethods.create).toHaveBeenCalledWith(paymentMethod);
      }
    });

    it('should process 3D Secure correctly', async () => {
      const paymentIntentWith3DS = {
        id: 'pi_123',
        status: 'requires_action',
        next_action: {
          type: 'use_stripe_sdk',
          use_stripe_sdk: {
            type: 'three_d_secure_redirect',
            redirect_url: 'https://stripe.com/3ds',
          },
        },
      };

      (mockStripe.paymentIntents.create as jest.Mock).mockResolvedValue(
        paymentIntentWith3DS
      );

      const result = await stripeService.createPaymentIntent({
        amount: 100000, // $1000 in cents
        currency: 'usd',
        payment_method_types: ['card'],
        confirmation_method: 'manual',
        confirm: true,
        return_url: 'https://example.com/return',
      });

      expect(result.status).toBe('requires_action');
      expect(result.next_action).toBeDefined();
      expect(result.next_action.type).toBe('use_stripe_sdk');
    });

    it('should handle payment failures gracefully', async () => {
      const failureScenarios = [
        {
          error: { code: 'card_declined', message: 'Card was declined' },
          expectedStatus: PaymentStatus.FAILED,
        },
        {
          error: { code: 'insufficient_funds', message: 'Insufficient funds' },
          expectedStatus: PaymentStatus.FAILED,
        },
        {
          error: { code: 'processing_error', message: 'Processing error' },
          expectedStatus: PaymentStatus.REQUIRES_RETRY,
        },
        {
          error: { code: 'rate_limit', message: 'Rate limit exceeded' },
          expectedStatus: PaymentStatus.REQUIRES_RETRY,
        },
      ];

      for (const scenario of failureScenarios) {
        (mockStripe.paymentIntents.create as jest.Mock).mockRejectedValue(
          scenario.error
        );

        try {
          await stripeService.createPaymentIntent({
            amount: 100000,
            currency: 'usd',
          });
        } catch (error) {
          expect(error.code).toBe(scenario.error.code);
          expect(error.message).toBe(scenario.error.message);
        }
      }
    });

    it('should handle webhook events correctly', async () => {
      const webhookEvents = [
        {
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: 'pi_123',
              status: 'succeeded',
              amount: 100000,
              metadata: { bookingId: 'booking-1' },
            },
          },
        },
        {
          type: 'payment_intent.payment_failed',
          data: {
            object: {
              id: 'pi_124',
              status: 'requires_payment_method',
              last_payment_error: {
                code: 'card_declined',
                message: 'Card was declined',
              },
              metadata: { bookingId: 'booking-2' },
            },
          },
        },
        {
          type: 'payout.created',
          data: {
            object: {
              id: 'po_123',
              amount: 50000,
              currency: 'usd',
              destination: 'acct_123',
              metadata: { hostId: 'host-1' },
            },
          },
        },
      ];

      for (const event of webhookEvents) {
        (mockStripe.webhooks.constructEvent as jest.Mock).mockReturnValue(
          event
        );

        const result = await stripeService.handleWebhook(event);
        expect(result.processed).toBe(true);
        expect(result.eventType).toBe(event.type);
      }
    });
  });

  describe('Refund Processing', () => {
    it('should calculate partial refunds correctly', async () => {
      const refundScenarios = [
        {
          originalAmount: 100000, // $1000
          refundAmount: 50000,    // $500
          expectedRefund: 50000,
          reason: 'requested_by_customer',
        },
        {
          originalAmount: 100000,
          refundAmount: 25000,    // $250
          expectedRefund: 25000,
          reason: 'duplicate',
        },
        {
          originalAmount: 100000,
          refundAmount: 100000,   // Full refund
          expectedRefund: 100000,
          reason: 'fraudulent',
        },
      ];

      for (const scenario of refundScenarios) {
        (mockStripe.refunds.create as jest.Mock).mockResolvedValue({
          id: 're_123',
          amount: scenario.expectedRefund,
          status: 'succeeded',
        });

        const result = await stripeService.createRefund({
          paymentIntentId: 'pi_123',
          amount: scenario.refundAmount,
          reason: scenario.reason,
        });

        expect(result.amount).toBe(scenario.expectedRefund);
        expect(result.status).toBe('succeeded');
        expect(mockStripe.refunds.create).toHaveBeenCalledWith({
          payment_intent: 'pi_123',
          amount: scenario.refundAmount,
          reason: scenario.reason,
        });
      }
    });

    it('should handle refund disputes', async () => {
      const disputeScenarios = [
        {
          type: 'chargeback',
          reason: 'fraudulent',
          amount: 100000,
          evidence: {
            customer_email: 'customer@example.com',
            shipping_documentation: 'tracking_number_123',
          },
        },
        {
          type: 'inquiry',
          reason: 'unrecognized',
          amount: 50000,
          evidence: {
            customer_email: 'customer@example.com',
          },
        },
      ];

      for (const dispute of disputeScenarios) {
        const disputeResult = await stripeService.handleDispute({
          disputeId: 'dp_123',
          type: dispute.type,
          reason: dispute.reason,
          amount: dispute.amount,
          evidence: dispute.evidence,
        });

        expect(disputeResult.status).toBe('processing');
        expect(disputeResult.evidenceSubmitted).toBe(true);
        expect(prisma.auditLog.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            action: 'dispute_initiated',
            metadata: expect.objectContaining({
              disputeId: 'dp_123',
              type: dispute.type,
            }),
          }),
        });
      }
    });

    it('should handle refund failures and retries', async () => {
      const retryScenarios = [
        {
          error: { code: 'network_error', message: 'Network timeout' },
          maxRetries: 3,
          expectedRetry: true,
        },
        {
          error: { code: 'rate_limit', message: 'Rate limit exceeded' },
          maxRetries: 3,
          expectedRetry: true,
        },
        {
          error: { code: 'invalid_request_error', message: 'Invalid request' },
          maxRetries: 0,
          expectedRetry: false,
        },
      ];

      for (const scenario of retryScenarios) {
        let attemptCount = 0;
        (mockStripe.refunds.create as jest.Mock).mockImplementation(() => {
          attemptCount++;
          if (attemptCount < scenario.maxRetries) {
            throw scenario.error;
          }
          return { id: 're_123', status: 'succeeded' };
        });

        const result = await stripeService.createRefundWithRetry({
          paymentIntentId: 'pi_123',
          amount: 50000,
          maxRetries: scenario.maxRetries,
        });

        if (scenario.expectedRetry) {
          expect(result.status).toBe('succeeded');
          expect(attemptCount).toBeGreaterThan(1);
        } else {
          expect(result.status).toBe('failed');
          expect(result.error).toBe(scenario.error.message);
        }
      }
    });
  });

  describe('Financial Reconciliation', () => {
    it('should reconcile daily transactions', async () => {
      const dailyTransactions = [
        {
          id: 'payment-1',
          type: 'PAYMENT',
          amount: 100000,
          status: 'succeeded',
          stripeId: 'pi_123',
          createdAt: new Date(),
        },
        {
          id: 'payment-2',
          type: 'PAYMENT',
          amount: 75000,
          status: 'succeeded',
          stripeId: 'pi_124',
          createdAt: new Date(),
        },
        {
          id: 'refund-1',
          type: 'REFUND',
          amount: -25000,
          status: 'succeeded',
          stripeId: 're_123',
          createdAt: new Date(),
        },
      ];

      (prisma.payment.findMany as jest.Mock).mockResolvedValue(dailyTransactions);

      const reconciliation = await ledgerService.reconcileDailyTransactions(
        new Date()
      );

      expect(reconciliation.totalPayments).toBe(175000);
      expect(reconciliation.totalRefunds).toBe(25000);
      expect(reconciliation.netAmount).toBe(150000);
      expect(reconciliation.discrepancies).toEqual([]);
    });

    it('should detect and report discrepancies', async () => {
      const transactionsWithDiscrepancies = [
        {
          id: 'payment-1',
          type: 'PAYMENT',
          amount: 100000,
          status: 'succeeded',
          stripeId: 'pi_123',
          localAmount: 100000,
          stripeAmount: 95000, // $5 difference
          createdAt: new Date(),
        },
        {
          id: 'payment-2',
          type: 'PAYMENT',
          amount: 75000,
          status: 'succeeded',
          stripeId: 'pi_124',
          localAmount: 75000,
          stripeAmount: 75000,
          createdAt: new Date(),
        },
      ];

      // Mock Stripe balance transaction retrieval
      jest.spyOn(stripeService, 'getBalanceTransaction').mockResolvedValue({
        id: 'txn_123',
        amount: 95000,
        fee: 5000,
        net: 90000,
      });

      const reconciliation = await ledgerService.reconcileWithStripe(
        transactionsWithDiscrepancies
      );

      expect(reconciliation.discrepancies).toHaveLength(1);
      expect(reconciliation.discrepancies[0].paymentId).toBe('payment-1');
      expect(reconciliation.discrepancies[0].difference).toBe(5000);
      expect(reconciliation.discrepancies[0].type).toBe('amount_mismatch');

      // Verify discrepancy logging
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'discrepancy_detected',
          metadata: expect.objectContaining({
            paymentId: 'payment-1',
            difference: 5000,
          }),
        }),
      });
    });

    it('should handle reconciliation failures gracefully', async () => {
      // Mock Stripe API failure
      jest.spyOn(stripeService, 'getBalanceTransaction').mockRejectedValue(
        new Error('Stripe API unavailable')
      );

      const transactions = [
        {
          id: 'payment-1',
          type: 'PAYMENT',
          amount: 100000,
          status: 'succeeded',
          stripeId: 'pi_123',
          createdAt: new Date(),
        },
      ];

      const reconciliation = await ledgerService.reconcileWithStripe(transactions);

      expect(reconciliation.status).toBe('partial');
      expect(reconciliation.errors).toHaveLength(1);
      expect(reconciliation.errors[0].message).toBe('Stripe API unavailable');
      expect(reconciliation.processedCount).toBe(0);
    });
  });

  describe('Escrow Management', () => {
    it('should manage escrow holds correctly', async () => {
      const escrowScenarios = [
        {
          bookingId: 'booking-1',
          amount: 100000,
          releaseDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          status: 'HELD',
        },
        {
          bookingId: 'booking-2',
          amount: 75000,
          releaseDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
          status: 'RELEASED',
        },
      ];

      for (const scenario of escrowScenarios) {
        (prisma.depositHold.create as jest.Mock).mockResolvedValue({
          id: 'hold-1',
          ...scenario,
        });

        const result = await escrowService.createHold(scenario);

        expect(result.bookingId).toBe(scenario.bookingId);
        expect(result.amount).toBe(scenario.amount);
        expect(result.status).toBe(scenario.status);
        expect(prisma.depositHold.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            bookingId: scenario.bookingId,
            amount: scenario.amount,
            releaseDate: scenario.releaseDate,
          }),
        });
      }
    });

    it('should release escrow funds on booking completion', async () => {
      const completedBooking = {
        ...mockBooking,
        status: 'COMPLETED',
        completedAt: new Date(),
      };

      const depositHold = {
        id: 'hold-1',
        bookingId: 'booking-1',
        amount: 100000,
        status: 'HELD',
        releaseDate: new Date(),
      };

      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(completedBooking);
      (prisma.depositHold.findUnique as jest.Mock).mockResolvedValue(depositHold);
      (mockStripe.payouts.create as jest.Mock).mockResolvedValue({
        id: 'po_123',
        amount: 100000,
        status: 'in_transit',
      });

      const result = await escrowService.releaseFunds('booking-1');

      expect(result.status).toBe('released');
      expect(result.payoutId).toBe('po_123');
      expect(mockStripe.payouts.create).toHaveBeenCalledWith({
        amount: 100000,
        currency: 'usd',
        destination: expect.any(String),
      });
    });

    it('should handle escrow disputes', async () => {
      const disputeHold = {
        id: 'hold-1',
        bookingId: 'booking-1',
        amount: 100000,
        status: 'DISPUTED',
        disputeReason: 'property_damage',
        disputeEvidence: ['photo1.jpg', 'photo2.jpg'],
        createdAt: new Date(),
      };

      (prisma.depositHold.findUnique as jest.Mock).mockResolvedValue(disputeHold);

      const result = await escrowService.handleDispute('booking-1', {
        resolution: 'partial_release',
        releaseAmount: 70000,
        reason: 'Guest responsible for partial damage',
      });

      expect(result.status).toBe('partially_released');
      expect(result.releaseAmount).toBe(70000);
      expect(result.holdAmount).toBe(30000);
      expect(prisma.depositHold.update).toHaveBeenCalledWith({
        where: { id: 'hold-1' },
        data: expect.objectContaining({
          status: 'PARTIALLY_RELEASED',
          releasedAmount: 70000,
          remainingAmount: 30000,
        }),
      });
    });
  });

  describe('Payout Processing', () => {
    it('should process host payouts correctly', async () => {
      const payoutScenarios = [
        {
          hostId: 'host-1',
          amount: 85000, // $850 after fees
          currency: 'usd',
          method: 'instant',
          expectedFee: 15000, // $15 instant fee
        },
        {
          hostId: 'host-2',
          amount: 90000, // $900 standard
          currency: 'usd',
          method: 'standard',
          expectedFee: 0,
        },
      ];

      for (const scenario of payoutScenarios) {
        (mockStripe.payouts.create as jest.Mock).mockResolvedValue({
          id: 'po_123',
          amount: scenario.amount - scenario.expectedFee,
          currency: scenario.currency,
          arrival_date: scenario.method === 'instant' 
            ? Math.floor(Date.now() / 1000) + 30 * 60 // 30 minutes
            : Math.floor(Date.now() / 1000) + 2 * 24 * 60 * 60 // 2 days,
        });

        const result = await payoutsService.createPayout(scenario);

        expect(result.hostId).toBe(scenario.hostId);
        expect(result.amount).toBe(scenario.amount - scenario.expectedFee);
        expect(result.method).toBe(scenario.method);
        expect(result.fee).toBe(scenario.expectedFee);
      }
    });

    it('should handle payout failures and retries', async () => {
      const failureScenarios = [
        {
          error: { code: 'insufficient_funds', message: 'Insufficient funds' },
          shouldRetry: false,
        },
        {
          error: { code: 'account_closed', message: 'Account closed' },
          shouldRetry: false,
        },
        {
          error: { code: 'rate_limit', message: 'Rate limit exceeded' },
          shouldRetry: true,
        },
      ];

      for (const scenario of failureScenarios) {
        (mockStripe.payouts.create as jest.Mock).mockRejectedValue(
          scenario.error
        );

        const result = await payoutsService.createPayoutWithRetry({
          hostId: 'host-1',
          amount: 85000,
          currency: 'usd',
          maxRetries: 3,
        });

        if (scenario.shouldRetry) {
          expect(result.status).toBe('retry_scheduled');
          expect(result.retryCount).toBeGreaterThan(0);
        } else {
          expect(result.status).toBe('failed');
          expect(result.error).toBe(scenario.error.message);
        }
      }
    });

    it('should track payout status changes', async () => {
      const payoutLifecycle = [
        { status: 'in_transit', event: 'payout_created' },
        { status: 'paid', event: 'payout_completed' },
        { status: 'failed', event: 'payout_failed' },
      ];

      for (const stage of payoutLifecycle) {
        (prisma.payout.update as jest.Mock).mockResolvedValue({
          id: 'po_123',
          status: stage.status,
          updatedAt: new Date(),
        });

        const result = await payoutsService.updatePayoutStatus('po_123', stage.status);

        expect(result.status).toBe(stage.status);
        expect(prisma.auditLog.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            action: stage.event,
            metadata: expect.objectContaining({
              payoutId: 'po_123',
              newStatus: stage.status,
            }),
          }),
        });
      }
    });
  });

  describe('Financial Security & Compliance', () => {
    it('should prevent duplicate payments', async () => {
      const duplicatePayment = {
        bookingId: 'booking-1',
        amount: 100000,
        stripeId: 'pi_123',
        status: 'succeeded',
      };

      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(duplicatePayment);

      const result = await stripeService.validatePaymentIntent('pi_123', 'booking-1');

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('duplicate_payment');
      expect(result.existingPaymentId).toBe('payment-1');
    });

    it('should enforce payment amount limits', async () => {
      const paymentLimits = {
        minimum: 1000,    // $10
        maximum: 10000000, // $100,000
      };

      const invalidAmounts = [
        { amount: 500, expectedError: 'below_minimum' },
        { amount: 15000000, expectedError: 'above_maximum' },
      ];

      for (const invalidAmount of invalidAmounts) {
        const result = await stripeService.validatePaymentAmount(
          invalidAmount.amount,
          paymentLimits
        );

        expect(result.isValid).toBe(false);
        expect(result.reason).toBe(invalidAmount.expectedError);
      }
    });

    it('should maintain audit trail for all financial transactions', async () => {
      const financialEvents = [
        {
          action: 'payment_created',
          paymentId: 'payment-1',
          amount: 100000,
          userId: 'user-1',
        },
        {
          action: 'refund_processed',
          refundId: 'refund-1',
          amount: -25000,
          userId: 'user-1',
        },
        {
          action: 'payout_created',
          payoutId: 'payout-1',
          amount: 85000,
          hostId: 'host-1',
        },
      ];

      for (const event of financialEvents) {
        await ledgerService.logFinancialEvent(event);

        expect(prisma.auditLog.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            action: event.action,
            metadata: expect.objectContaining({
              amount: event.amount,
            }),
          }),
        });
      }
    });

    it('should handle currency conversion and multi-currency support', async () => {
      const multiCurrencyPayments = [
        {
          amount: 100000,
          currency: 'usd',
          targetCurrency: 'eur',
          exchangeRate: 0.85,
        },
        {
          amount: 85000,
          currency: 'eur',
          targetCurrency: 'usd',
          exchangeRate: 1.18,
        },
      ];

      for (const payment of multiCurrencyPayments) {
        const convertedAmount = await stripeService.convertCurrency(
          payment.amount,
          payment.currency,
          payment.targetCurrency,
          payment.exchangeRate
        );

        expect(convertedAmount.amount).toBe(
          Math.round(payment.amount * payment.exchangeRate)
        );
        expect(convertedAmount.currency).toBe(payment.targetCurrency);
      }
    });
  });
});
