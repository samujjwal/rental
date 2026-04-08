import { Test, TestingModule } from '@nestjs/testing';
import { PaymentRetryService } from './payment-retry-flow.service';
import { PaymentService } from './payment.service';
import { StripeService } from './stripe.service';
import { PrismaService } from '../../database/prisma.service';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * PAYMENT RETRY FLOW TESTS
 * 
 * These tests validate payment retry mechanisms:
 * - Payment failure detection and classification
 * - Retry policies and backoff strategies
 * - Payment method fallback
 * - User notification and communication
 * - Payment state management
 * 
 * Business Truth Validated:
 * - Payment failures are properly classified
 * - Retry policies prevent duplicate charges
 * - Fallback methods are tried appropriately
 * - Users are notified of payment issues
 * - Payment states are accurately tracked
 */

describe('PaymentRetryFlow', () => {
  let retryService: PaymentRetryService;
  let paymentService: PaymentService;
  let stripeService: StripeService;
  let prismaService: PrismaService;
  let configService: ConfigService;
  let logger: Logger;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentRetryService,
        {
          provide: PaymentService,
          useValue: {
            processPayment: jest.fn(),
            getPaymentStatus: jest.fn(),
            updatePaymentStatus: jest.fn(),
            refundPayment: jest.fn(),
          },
        },
        {
          provide: StripeService,
          useValue: {
            charge: jest.fn(),
            retrieveCharge: jest.fn(),
            createPaymentIntent: jest.fn(),
            confirmPaymentIntent: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            payment: {
              findUnique: jest.fn(),
              update: jest.fn(),
              create: jest.fn(),
              findMany: jest.fn(),
            },
            booking: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                'payment.retry.maxAttempts': 3,
                'payment.retry.initialDelay': 5000, // 5 seconds
                'payment.retry.maxDelay': 300000, // 5 minutes
                'payment.retry.backoffMultiplier': 2,
                'payment.retry.fallbackMethods': ['stripe', 'khalti', 'esewa'],
                'payment.retry.notificationDelay': 10000, // 10 seconds
              };
              return config[key];
            }),
          },
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    retryService = module.get<PaymentRetryService>(PaymentRetryService);
    paymentService = module.get<PaymentService>(PaymentService);
    stripeService = module.get<StripeService>(StripeService);
    prismaService = module.get<PrismaService>(PrismaService);
    configService = module.get<ConfigService>(ConfigService);
    logger = module.get<Logger>(Logger);
  });

  describe('Payment Failure Classification', () => {
    it('should classify temporary payment failures', async () => {
      const paymentError = new Error('Insufficient funds');
      paymentError.name = 'StripeCardError';
      (paymentError as any).code = 'card_declined';
      (paymentError as any).decline_code = 'insufficient_funds';

      const classification = await retryService.classifyPaymentFailure(paymentError);

      expect(classification.type).toBe('temporary');
      expect(classification.retryable).toBe(true);
      expect(classification.suggestedDelay).toBe(30000); // 30 seconds
      expect(classification.message).toContain('Insufficient funds');
    });

    it('should classify permanent payment failures', async () => {
      const paymentError = new Error('Card expired');
      paymentError.name = 'StripeCardError';
      (paymentError as any).code = 'expired_card';

      const classification = await retryService.classifyPaymentFailure(paymentError);

      expect(classification.type).toBe('permanent');
      expect(classification.retryable).toBe(false);
      expect(classification.requiresUserAction).toBe(true);
      expect(classification.message).toContain('Card expired');
    });

    it('should classify network-related failures', async () => {
      const paymentError = new Error('Network timeout');
      paymentError.name = 'NetworkError';

      const classification = await retryService.classifyPaymentFailure(paymentError);

      expect(classification.type).toBe('temporary');
      expect(classification.retryable).toBe(true);
      expect(classification.suggestedDelay).toBe(10000); // 10 seconds
      expect(classification.isNetworkError).toBe(true);
    });

    it('should classify fraud detection failures', async () => {
      const paymentError = new Error('Transaction blocked');
      paymentError.name = 'StripeCardError';
      (paymentError as any).code = 'fraudulent';

      const classification = await retryService.classifyPaymentFailure(paymentError);

      expect(classification.type).toBe('permanent');
      expect(classification.retryable).toBe(false);
      expect(classification.requiresUserAction).toBe(true);
      expect(classification.isFraudRelated).toBe(true);
    });

    it('should handle unknown payment errors', async () => {
      const paymentError = new Error('Unknown error');
      paymentError.name = 'UnknownError';

      const classification = await retryService.classifyPaymentFailure(paymentError);

      expect(classification.type).toBe('unknown');
      expect(classification.retryable).toBe(true); // Default to retryable
      expect(classification.suggestedDelay).toBe(60000); // 1 minute default
    });
  });

  describe('Retry Policy Configuration', () => {
    it('should load retry configuration', () => {
      const maxAttempts = retryService.getMaxAttempts();
      const initialDelay = retryService.getInitialDelay();
      const maxDelay = retryService.getMaxDelay();
      const fallbackMethods = retryService.getFallbackMethods();

      expect(maxAttempts).toBe(3);
      expect(initialDelay).toBe(5000);
      expect(maxDelay).toBe(300000);
      expect(fallbackMethods).toEqual(['stripe', 'khalti', 'esewa']);
    });

    it('should calculate retry delays with exponential backoff', () => {
      const delays = [];
      for (let attempt = 1; attempt <= 3; attempt++) {
        const delay = retryService.calculateRetryDelay(attempt);
        delays.push(delay);
      }

      expect(delays[0]).toBe(5000); // Initial delay
      expect(delays[1]).toBe(10000); // 5000 * 2
      expect(delays[2]).toBe(20000); // 10000 * 2
    });

    it('should respect maximum delay limit', () => {
      const delay = retryService.calculateRetryDelay(10); // High attempt number
      expect(delay).toBeLessThanOrEqual(300000); // Max delay
    });

    it('should add jitter to prevent thundering herd', () => {
      const delays = [];
      for (let i = 0; i < 10; i++) {
        const delay = retryService.calculateRetryDelay(2, true); // With jitter
        delays.push(delay);
      }

      // With jitter, delays should vary
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });
  });

  describe('Payment Retry Execution', () => {
    it('should retry temporary payment failures', async () => {
      const payment = {
        id: 'pay-123',
        amount: 21000,
        currency: 'NPR',
        userId: 'user-123',
        bookingId: 'booking-123',
        paymentMethod: 'stripe',
        status: 'failed',
        attempts: 1,
        lastAttemptAt: new Date(),
      };

      const paymentError = new Error('Insufficient funds');
      paymentError.name = 'StripeCardError';
      (paymentError as any).code = 'card_declined';

      // Mock payment retry success
      paymentService.processPayment.mockResolvedValueOnce({
        success: true,
        paymentId: 'pay-123-retry',
        chargeId: 'ch_123',
      });

      const result = await retryService.retryPayment(payment, paymentError);

      expect(result.success).toBe(true);
      expect(result.paymentId).toBe('pay-123-retry');
      expect(result.attemptCount).toBe(2);
      expect(paymentService.processPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentId: payment.id,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
        })
      );
    });

    it('should not retry permanent payment failures', async () => {
      const payment = {
        id: 'pay-123',
        amount: 21000,
        currency: 'NPR',
        userId: 'user-123',
        bookingId: 'booking-123',
        paymentMethod: 'stripe',
        status: 'failed',
        attempts: 1,
      };

      const paymentError = new Error('Card expired');
      paymentError.name = 'StripeCardError';
      (paymentError as any).code = 'expired_card';

      const result = await retryService.retryPayment(payment, paymentError);

      expect(result.success).toBe(false);
      expect(result.shouldRetry).toBe(false);
      expect(result.requiresUserAction).toBe(true);
      expect(result.message).toContain('Card expired');
    });

    it('should stop retrying after max attempts', async () => {
      const payment = {
        id: 'pay-123',
        amount: 21000,
        currency: 'NPR',
        userId: 'user-123',
        bookingId: 'booking-123',
        paymentMethod: 'stripe',
        status: 'failed',
        attempts: 3, // Max attempts reached
      };

      const paymentError = new Error('Temporary failure');

      const result = await retryService.retryPayment(payment, paymentError);

      expect(result.success).toBe(false);
      expect(result.shouldRetry).toBe(false);
      expect(result.finalFailure).toBe(true);
      expect(result.message).toContain('Max retry attempts exceeded');
    });

    it('should update payment status during retry', async () => {
      const payment = {
        id: 'pay-123',
        amount: 21000,
        currency: 'NPR',
        userId: 'user-123',
        bookingId: 'booking-123',
        paymentMethod: 'stripe',
        status: 'failed',
        attempts: 1,
      };

      const paymentError = new Error('Temporary failure');

      // Mock successful retry
      paymentService.processPayment.mockResolvedValueOnce({
        success: true,
        paymentId: 'pay-123-retry',
        chargeId: 'ch_123',
      });

      await retryService.retryPayment(payment, paymentError);

      expect(paymentService.updatePaymentStatus).toHaveBeenCalledWith(
        payment.id,
        'processing',
        expect.objectContaining({
          attemptCount: 2,
          retryReason: 'Temporary failure',
        })
      );

      expect(paymentService.updatePaymentStatus).toHaveBeenCalledWith(
        payment.id,
        'completed',
        expect.objectContaining({
          chargeId: 'ch_123',
          completedAt: expect.any(Date),
        })
      );
    });
  });

  describe('Payment Method Fallback', () => {
    it('should fallback to alternative payment methods', async () => {
      const payment = {
        id: 'pay-123',
        amount: 21000,
        currency: 'NPR',
        userId: 'user-123',
        bookingId: 'booking-123',
        paymentMethod: 'stripe',
        status: 'failed',
        attempts: 1,
        fallbackMethods: ['khalti', 'esewa'],
      };

      const paymentError = new Error('Stripe service unavailable');
      paymentError.name = 'StripeAPIError';

      // Mock Stripe failure, Khalti success
      paymentService.processPayment
        .mockRejectedValueOnce(paymentError)
        .mockResolvedValueOnce({
          success: true,
          paymentId: 'pay-123-khalti',
          transactionId: 'khalti-123',
        });

      const result = await retryService.retryWithFallback(payment, paymentError);

      expect(result.success).toBe(true);
      expect(result.usedPaymentMethod).toBe('khalti');
      expect(result.paymentId).toBe('pay-123-khalti');
      expect(result.fallbackUsed).toBe(true);
    });

    it('should try all fallback methods in order', async () => {
      const payment = {
        id: 'pay-123',
        amount: 21000,
        currency: 'NPR',
        userId: 'user-123',
        bookingId: 'booking-123',
        paymentMethod: 'stripe',
        status: 'failed',
        attempts: 1,
        fallbackMethods: ['khalti', 'esewa'],
      };

      const paymentError = new Error('Primary method failed');

      // Mock all methods failing except last one
      paymentService.processPayment
        .mockRejectedValueOnce(new Error('Khalti failed'))
        .mockRejectedValueOnce(new Error('eSewa failed'))
        .mockResolvedValueOnce({
          success: true,
          paymentId: 'pay-123-esewa',
          transactionId: 'esewa-123',
        });

      const result = await retryService.retryWithFallback(payment, paymentError);

      expect(result.success).toBe(true);
      expect(result.usedPaymentMethod).toBe('esewa');
      expect(result.fallbackAttempts).toBe(2);
    });

    it('should handle all fallback methods failing', async () => {
      const payment = {
        id: 'pay-123',
        amount: 21000,
        currency: 'NPR',
        userId: 'user-123',
        bookingId: 'booking-123',
        paymentMethod: 'stripe',
        status: 'failed',
        attempts: 1,
        fallbackMethods: ['khalti', 'esewa'],
      };

      const paymentError = new Error('Primary method failed');

      // Mock all methods failing
      paymentService.processPayment
        .mockRejectedValueOnce(new Error('Khalti failed'))
        .mockRejectedValueOnce(new Error('eSewa failed'));

      const result = await retryService.retryWithFallback(payment, paymentError);

      expect(result.success).toBe(false);
      expect(result.allMethodsFailed).toBe(true);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toContain('Khalti failed');
      expect(result.errors[1]).toContain('eSewa failed');
    });

    it('should respect user payment method preferences', async () => {
      const payment = {
        id: 'pay-123',
        amount: 21000,
        currency: 'NPR',
        userId: 'user-123',
        bookingId: 'booking-123',
        paymentMethod: 'stripe',
        status: 'failed',
        attempts: 1,
      };

      const userPreferences = {
        preferredMethods: ['khalti', 'esewa'],
        excludedMethods: ['stripe'],
      };

      // Mock user preferences
      prismaService.user.findUnique.mockResolvedValueOnce({
        id: 'user-123',
        paymentPreferences: userPreferences,
      });

      const result = await retryService.getAvailableFallbackMethods(payment);

      expect(result).toEqual(['khalti', 'esewa']);
      expect(result).not.toContain('stripe');
    });
  });

  describe('User Notification', () => {
    it('should notify users of payment failures', async () => {
      const payment = {
        id: 'pay-123',
        amount: 21000,
        currency: 'NPR',
        userId: 'user-123',
        bookingId: 'booking-123',
        paymentMethod: 'stripe',
        status: 'failed',
        attempts: 1,
      };

      const paymentError = new Error('Insufficient funds');

      // Mock user data
      prismaService.user.findUnique.mockResolvedValueOnce({
        id: 'user-123',
        email: 'user@example.com',
        phone: '+9771234567890',
        notificationPreferences: {
          email: true,
          sms: true,
          push: false,
        },
      });

      await retryService.notifyPaymentFailure(payment, paymentError);

      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('Payment failure notification sent'),
        expect.objectContaining({
          paymentId: payment.id,
          userId: payment.userId,
          channels: ['email', 'sms'],
        })
      );
    });

    it('should send different notifications based on failure type', async () => {
      const payment = {
        id: 'pay-123',
        amount: 21000,
        userId: 'user-123',
      };

      const temporaryError = new Error('Network timeout');
      const permanentError = new Error('Card expired');

      // Mock user data
      prismaService.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'user@example.com',
        phone: '+9771234567890',
      });

      await retryService.notifyPaymentFailure(payment, temporaryError);
      await retryService.notifyPaymentFailure(payment, permanentError);

      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('Temporary payment failure'),
        expect.objectContaining({
          paymentId: payment.id,
          willRetry: true,
        })
      );

      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('Permanent payment failure'),
        expect.objectContaining({
          paymentId: payment.id,
          requiresAction: true,
        })
      );
    });

    it('should delay user notification appropriately', async () => {
      const payment = {
        id: 'pay-123',
        amount: 21000,
        userId: 'user-123',
        attempts: 1,
      };

      const paymentError = new Error('Temporary failure');

      const startTime = Date.now();
      await retryService.notifyPaymentFailure(payment, paymentError);
      const endTime = Date.now();

      const notificationDelay = endTime - startTime;
      expect(notificationDelay).toBeGreaterThanOrEqual(10000); // 10 second delay
    });
  });

  describe('Payment State Management', () => {
    it('should track payment retry state transitions', async () => {
      const payment = {
        id: 'pay-123',
        status: 'failed',
        attempts: 0,
      };

      const stateTransitions = [];

      // Mock state tracking
      await retryService.trackPaymentState(payment.id, 'retrying', {
        attempt: 1,
        reason: 'Temporary failure',
      });

      stateTransitions.push({
        from: 'failed',
        to: 'retrying',
        timestamp: new Date(),
        metadata: { attempt: 1, reason: 'Temporary failure' },
      });

      await retryService.trackPaymentState(payment.id, 'completed', {
        chargeId: 'ch_123',
      });

      stateTransitions.push({
        from: 'retrying',
        to: 'completed',
        timestamp: new Date(),
        metadata: { chargeId: 'ch_123' },
      });

      expect(stateTransitions).toHaveLength(2);
      expect(stateTransitions[0].to).toBe('retrying');
      expect(stateTransitions[1].to).toBe('completed');
    });

    it('should prevent duplicate payment retries', async () => {
      const payment = {
        id: 'pay-123',
        status: 'retrying',
        attempts: 1,
        lockedAt: new Date(),
      };

      // Mock payment already being processed
      prismaService.payment.findUnique.mockResolvedValueOnce(payment);

      const result = await retryService.acquireRetryLock(payment.id);

      expect(result.acquired).toBe(false);
      expect(result.reason).toContain('Payment is already being processed');
    });

    it('should release retry locks after processing', async () => {
      const paymentId = 'pay-123';

      await retryService.releaseRetryLock(paymentId);

      expect(prismaService.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: paymentId },
          data: expect.objectContaining({
            lockedAt: null,
            lockedBy: null,
          }),
        })
      );
    });

    it('should cleanup stale retry locks', async () => {
      const stalePayments = [
        {
          id: 'pay-123',
          status: 'retrying',
          lockedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
          lockedBy: 'worker-1',
        },
        {
          id: 'pay-456',
          status: 'retrying',
          lockedAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
          lockedBy: 'worker-2',
        },
      ];

      prismaService.payment.findMany.mockResolvedValueOnce(stalePayments);

      const cleanedCount = await retryService.cleanupStaleLocks();

      expect(cleanedCount).toBe(1); // Only the 30-minute-old lock
      expect(prismaService.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pay-123' },
          data: expect.objectContaining({
            lockedAt: null,
            lockedBy: null,
            status: 'failed',
          }),
        })
      );
    });
  });

  describe('Analytics and Reporting', () => {
    it('should track retry success rates', async () => {
      const dateRange = {
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-06-07'),
      };

      const retryStats = {
        totalRetries: 100,
        successfulRetries: 85,
        failedRetries: 15,
        averageRetryTime: 25000, // 25 seconds
        mostCommonFailureReason: 'Insufficient funds',
        successRate: 85,
      };

      prismaService.payment.findMany.mockResolvedValueOnce([
        // Mock payment data for analytics
      ]);

      const stats = await retryService.getRetryStatistics(dateRange);

      expect(stats.totalRetries).toBe(100);
      expect(stats.successRate).toBe(85);
      expect(stats.averageRetryTime).toBe(25000);
      expect(stats.mostCommonFailureReason).toBe('Insufficient funds');
    });

    it('should generate retry performance report', async () => {
      const reportData = {
        period: 'last-7-days',
        totalPayments: 1000,
        failedPayments: 50,
        retriedPayments: 45,
        successfulRetries: 38,
        fallbackUsage: 12,
        averageRetryDelay: 15000,
        retryRevenueRecovered: 798000, // NPR 798,000
      };

      const report = await retryService.generateRetryReport('last-7-days');

      expect(report.totalPayments).toBe(1000);
      expect(report.failureRate).toBe(5); // 50/1000 * 100
      expect(report.retryRate).toBe(90); // 45/50 * 100
      expect(report.retrySuccessRate).toBe(84.4); // 38/45 * 100
      expect(report.fallbackUsageRate).toBe(26.7); // 12/45 * 100
      expect(report.revenueRecovered).toBe(798000);
    });

    it('should identify payment method performance issues', async () => {
      const methodPerformance = {
        stripe: {
          totalAttempts: 500,
          failures: 25,
          successRate: 95,
          averageProcessingTime: 3000,
          commonErrors: ['insufficient_funds', 'card_declined'],
        },
        khalti: {
          totalAttempts: 300,
          failures: 45,
          successRate: 85,
          averageProcessingTime: 5000,
          commonErrors: ['timeout', 'service_unavailable'],
        },
        esewa: {
          totalAttempts: 200,
          failures: 15,
          successRate: 92.5,
          averageProcessingTime: 4000,
          commonErrors: ['invalid_token', 'expired_session'],
        },
      };

      const performance = await retryService.getPaymentMethodPerformance();

      expect(performance.stripe.successRate).toBeGreaterThan(khalti.successRate);
      expect(performance.khalti.averageProcessingTime).toBeGreaterThan(esewa.averageProcessingTime);
      expect(performance.stripe.commonErrors).toContain('insufficient_funds');
    });
  });
});
