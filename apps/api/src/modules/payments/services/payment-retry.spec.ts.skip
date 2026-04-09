import { Test, TestingModule } from '@nestjs/testing';
import { PaymentRetryService } from './payment-retry.service';
import { PaymentService } from './payment.service';
import { PaymentRepository } from '../repositories/payment.repository';
import { NotificationService } from '../../notifications/services/notification.service';
import { Logger } from '@nestjs/common';

/**
 * PAYMENT RETRY TESTS
 * 
 * These tests validate payment retry logic including:
 * - Payment failure detection
 * - Retry logic implementation
 * - Retry escalation
 * - Retry limits
 * - Retry notification
 * 
 * Business Truth Validated:
 * - Payment failures are detected accurately
 * - Retry logic follows exponential backoff
 * - Retry escalation works properly
 * - Retry limits prevent infinite loops
 * - Users are notified of retry attempts
 */

describe('PaymentRetryService', () => {
  let service: PaymentRetryService;
  let paymentService: jest.Mocked<PaymentService>;
  let paymentRepository: jest.Mocked<PaymentRepository>;
  let notificationService: jest.Mocked<NotificationService>;
  let logger: jest.Mocked<Logger>;

  beforeEach(async () => {
    const mockPaymentService = {
      processPayment: jest.fn(),
      getPaymentStatus: jest.fn(),
      refundPayment: jest.fn(),
      createPaymentIntent: jest.fn(),
    };

    const mockPaymentRepository = {
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findByStatus: jest.fn(),
      findByUserId: jest.fn(),
    };

    const mockNotificationService = {
      sendPaymentFailureNotification: jest.fn(),
      sendPaymentRetryNotification: jest.fn(),
      sendPaymentSuccessNotification: jest.fn(),
    };

    const mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentRetryService,
        {
          provide: PaymentService,
          useValue: mockPaymentService,
        },
        {
          provide: PaymentRepository,
          useValue: mockPaymentRepository,
        },
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
        {
          provide: Logger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<PaymentRetryService>(PaymentRetryService);
    paymentService = module.get(PaymentService) as jest.Mocked<PaymentService>;
    paymentRepository = module.get(PaymentRepository) as jest.Mocked<PaymentRepository>;
    notificationService = module.get(NotificationService) as jest.Mocked<NotificationService>;
    logger = module.get(Logger) as jest.Mocked<Logger>;
  });

  describe('Payment Failure Detection', () => {
    it('should detect payment failure from payment gateway', async () => {
      // Arrange
      const paymentId = 'payment-123';
      const paymentStatus = {
        id: paymentId,
        status: 'failed',
        failureReason: 'Insufficient funds',
        failureCode: 'card_declined',
        timestamp: new Date(),
      };

      paymentRepository.findById.mockResolvedValue({
        id: paymentId,
        status: 'processing',
        amount: 10000,
        currency: 'USD',
      } as any);

      paymentService.getPaymentStatus.mockResolvedValue(paymentStatus);

      // Act
      const result = await service.detectPaymentFailure(paymentId);

      // Assert
      expect(result.failed).toBe(true);
      expect(result.failureReason).toBe('Insufficient funds');
      expect(result.failureCode).toBe('card_declined');
      expect(logger.warn).toHaveBeenCalledWith('Payment failure detected', {
        paymentId,
        reason: 'Insufficient funds',
        code: 'card_declined',
      });
    });

    it('should identify successful payments', async () => {
      // Arrange
      const paymentId = 'payment-123';
      const paymentStatus = {
        id: paymentId,
        status: 'succeeded',
        timestamp: new Date(),
      };

      paymentRepository.findById.mockResolvedValue({
        id: paymentId,
        status: 'processing',
      } as any);

      paymentService.getPaymentStatus.mockResolvedValue(paymentStatus);

      // Act
      const result = await service.detectPaymentFailure(paymentId);

      // Assert
      expect(result.failed).toBe(false);
      expect(result.failureReason).toBeUndefined();
    });

    it('should handle payment still processing', async () => {
      // Arrange
      const paymentId = 'payment-123';
      const paymentStatus = {
        id: paymentId,
        status: 'processing',
        timestamp: new Date(),
      };

      paymentRepository.findById.mockResolvedValue({
        id: paymentId,
        status: 'processing',
      } as any);

      paymentService.getPaymentStatus.mockResolvedValue(paymentStatus);

      // Act
      const result = await service.detectPaymentFailure(paymentId);

      // Assert
      expect(result.failed).toBe(false);
      expect(result.stillProcessing).toBe(true);
    });

    it('should categorize failure types', async () => {
      // Arrange
      const testCases = [
        {
          failureCode: 'card_declined',
          expectedCategory: 'card_error',
          expectedRetryable: true,
        },
        {
          failureCode: 'insufficient_funds',
          expectedCategory: 'insufficient_funds',
          expectedRetryable: false,
        },
        {
          failureCode: 'processing_error',
          expectedCategory: 'processing_error',
          expectedRetryable: true,
        },
        {
          failureCode: 'fraudulent',
          expectedCategory: 'fraud',
          expectedRetryable: false,
        },
      ];

      for (const testCase of testCases) {
        const paymentStatus = {
          id: 'payment-123',
          status: 'failed',
          failureCode: testCase.failureCode,
          failureReason: 'Test failure',
        };

        paymentService.getPaymentStatus.mockResolvedValue(paymentStatus);

        // Act
        const result = await service.categorizeFailure(testCase.failureCode);

        // Assert
        expect(result.category).toBe(testCase.expectedCategory);
        expect(result.retryable).toBe(testCase.expectedRetryable);
      }
    });
  });

  describe('Retry Logic Implementation', () => {
    it('should implement exponential backoff retry', async () => {
      // Arrange
      const paymentId = 'payment-123';
      const payment = {
        id: paymentId,
        userId: 'user-123',
        amount: 10000,
        currency: 'USD',
        status: 'failed',
        retryCount: 0,
        lastRetryAt: null,
        paymentMethodId: 'pm-123',
      };

      paymentRepository.findById.mockResolvedValue(payment as any);
      
      // First retry attempt fails, second succeeds
      paymentService.processPayment
        .mockRejectedValueOnce(new Error('Temporary gateway error'))
        .mockResolvedValueOnce({
          success: true,
          paymentId: 'payment-123-retry',
          status: 'succeeded',
        });

      paymentRepository.update.mockResolvedValue({} as any);

      // Act
      const result = await service.retryPayment(paymentId, { maxRetries: 3 });

      // Assert
      expect(result.success).toBe(true);
      expect(result.retryAttempt).toBe(2);
      expect(result.totalRetries).toBe(2);
      expect(paymentService.processPayment).toHaveBeenCalledTimes(2);
      
      // Check exponential backoff timing
      const firstRetryCall = paymentService.processPayment.mock.calls[0];
      const secondRetryCall = paymentService.processPayment.mock.calls[1];
      
      // Verify retry attempts were made with proper delays
      expect(logger.debug).toHaveBeenCalledWith('Payment retry attempt', {
        paymentId,
        attempt: 1,
        delay: 1000,
      });
      
      expect(logger.debug).toHaveBeenCalledWith('Payment retry attempt', {
        paymentId,
        attempt: 2,
        delay: 2000,
      });
    });

    it('should respect retry limits', async () => {
      // Arrange
      const paymentId = 'payment-123';
      const payment = {
        id: paymentId,
        userId: 'user-123',
        amount: 10000,
        currency: 'USD',
        status: 'failed',
        retryCount: 3,
        lastRetryAt: new Date(),
        paymentMethodId: 'pm-123',
      };

      paymentRepository.findById.mockResolvedValue(payment as any);

      // Act
      const result = await service.retryPayment(paymentId, { maxRetries: 3 });

      // Assert
      expect(result.success).toBe(false);
      expect(result.reason).toBe('Maximum retry limit exceeded');
      expect(paymentService.processPayment).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith('Payment retry limit exceeded', {
        paymentId,
        retryCount: 3,
        maxRetries: 3,
      });
    });

    it('should handle non-retryable failures', async () => {
      // Arrange
      const paymentId = 'payment-123';
      const payment = {
        id: paymentId,
        userId: 'user-123',
        amount: 10000,
        currency: 'USD',
        status: 'failed',
        retryCount: 0,
        failureCode: 'insufficient_funds',
        paymentMethodId: 'pm-123',
      };

      paymentRepository.findById.mockResolvedValue(payment as any);

      // Act
      const result = await service.retryPayment(paymentId, { maxRetries: 3 });

      // Assert
      expect(result.success).toBe(false);
      expect(result.reason).toBe('Failure type is not retryable');
      expect(paymentService.processPayment).not.toHaveBeenCalled();
    });

    it('should update payment retry metadata', async () => {
      // Arrange
      const paymentId = 'payment-123';
      const payment = {
        id: paymentId,
        userId: 'user-123',
        amount: 10000,
        currency: 'USD',
        status: 'failed',
        retryCount: 0,
        lastRetryAt: null,
        paymentMethodId: 'pm-123',
      };

      paymentRepository.findById.mockResolvedValue(payment as any);
      paymentService.processPayment.mockResolvedValue({
        success: true,
        paymentId: 'payment-123-retry',
        status: 'succeeded',
      });

      paymentRepository.update.mockResolvedValue({} as any);

      // Act
      await service.retryPayment(paymentId, { maxRetries: 3 });

      // Assert
      expect(paymentRepository.update).toHaveBeenCalledWith(paymentId, {
        retryCount: 1,
        lastRetryAt: expect.any(Date),
        status: 'succeeded',
      });
    });
  });

  describe('Retry Escalation', () => {
    it('should escalate to manual review after multiple failures', async () => {
      // Arrange
      const paymentId = 'payment-123';
      const payment = {
        id: paymentId,
        userId: 'user-123',
        amount: 10000,
        currency: 'USD',
        status: 'failed',
        retryCount: 2,
        lastRetryAt: new Date(),
        paymentMethodId: 'pm-123',
      };

      paymentRepository.findById.mockResolvedValue(payment as any);
      paymentService.processPayment.mockRejectedValue(new Error('Persistent failure'));

      paymentRepository.update.mockResolvedValue({} as any);

      // Act
      const result = await service.retryPayment(paymentId, { maxRetries: 3 });

      // Assert
      expect(result.success).toBe(false);
      expect(result.escalated).toBe(true);
      expect(result.escalationReason).toBe('Multiple retry failures');
      expect(paymentRepository.update).toHaveBeenCalledWith(paymentId, {
        status: 'manual_review',
        escalatedAt: expect.any(Date),
        escalationReason: 'Multiple retry failures',
      });
      
      expect(logger.warn).toHaveBeenCalledWith('Payment escalated to manual review', {
        paymentId,
        retryCount: 3,
        amount: 10000,
      });
    });

    it('should notify support team on escalation', async () => {
      // Arrange
      const paymentId = 'payment-123';
      const payment = {
        id: paymentId,
        userId: 'user-123',
        amount: 50000, // High amount
        currency: 'USD',
        status: 'failed',
        retryCount: 2,
        paymentMethodId: 'pm-123',
      };

      paymentRepository.findById.mockResolvedValue(payment as any);
      paymentService.processPayment.mockRejectedValue(new Error('Persistent failure'));

      // Act
      await service.retryPayment(paymentId, { maxRetries: 3 });

      // Assert
      expect(notificationService.sendPaymentFailureNotification).toHaveBeenCalledWith({
        type: 'escalation',
        paymentId,
        userId: 'user-123',
        amount: 50000,
        reason: 'Multiple retry failures',
        notifySupport: true,
      });
    });

    it('should escalate high-value payments immediately', async () => {
      // Arrange
      const paymentId = 'payment-123';
      const payment = {
        id: paymentId,
        userId: 'user-123',
        amount: 100000, // High value ($1000)
        currency: 'USD',
        status: 'failed',
        retryCount: 0,
        failureCode: 'card_declined',
        paymentMethodId: 'pm-123',
      };

      paymentRepository.findById.mockResolvedValue(payment as any);

      // Act
      const result = await service.retryPayment(paymentId, { maxRetries: 3 });

      // Assert
      expect(result.success).toBe(false);
      expect(result.escalated).toBe(true);
      expect(result.escalationReason).toBe('High-value payment failure');
      expect(logger.warn).toHaveBeenCalledWith('High-value payment escalated', {
        paymentId,
        amount: 100000,
      });
    });
  });

  describe('Retry Limits', () => {
    it('should enforce maximum retry attempts', async () => {
      // Arrange
      const paymentId = 'payment-123';
      const payment = {
        id: paymentId,
        userId: 'user-123',
        amount: 10000,
        currency: 'USD',
        status: 'failed',
        retryCount: 0,
        paymentMethodId: 'pm-123',
      };

      paymentRepository.findById.mockResolvedValue(payment as any);
      
      // All retry attempts fail
      paymentService.processPayment.mockRejectedValue(new Error('Persistent failure'));
      paymentRepository.update.mockResolvedValue({} as any);

      // Act
      const result = await service.retryPayment(paymentId, { maxRetries: 2 });

      // Assert
      expect(result.success).toBe(false);
      expect(result.retryAttempt).toBe(2);
      expect(result.totalRetries).toBe(2);
      expect(result.reason).toBe('Maximum retry limit exceeded');
      expect(paymentService.processPayment).toHaveBeenCalledTimes(2);
    });

    it('should respect time-based retry limits', async () => {
      // Arrange
      const paymentId = 'payment-123';
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      
      const payment = {
        id: paymentId,
        userId: 'user-123',
        amount: 10000,
        currency: 'USD',
        status: 'failed',
        retryCount: 1,
        lastRetryAt: twoHoursAgo,
        paymentMethodId: 'pm-123',
      };

      paymentRepository.findById.mockResolvedValue(payment as any);

      // Act
      const result = await service.retryPayment(paymentId, { 
        maxRetries: 3,
        retryWindowHours: 1, // Only retry within 1 hour
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.reason).toBe('Retry window expired');
      expect(paymentService.processPayment).not.toHaveBeenCalled();
    });

    it('should implement cooldown period between retries', async () => {
      // Arrange
      const paymentId = 'payment-123';
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
      
      const payment = {
        id: paymentId,
        userId: 'user-123',
        amount: 10000,
        currency: 'USD',
        status: 'failed',
        retryCount: 1,
        lastRetryAt: oneMinuteAgo,
        paymentMethodId: 'pm-123',
      };

      paymentRepository.findById.mockResolvedValue(payment as any);

      // Act
      const result = await service.retryPayment(paymentId, { 
        maxRetries: 3,
        cooldownMinutes: 5, // 5 minute cooldown
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.reason).toBe('Retry cooldown period active');
      expect(paymentService.processPayment).not.toHaveBeenCalled();
    });
  });

  describe('Retry Notification', () => {
    it('should notify user on retry attempt', async () => {
      // Arrange
      const paymentId = 'payment-123';
      const payment = {
        id: paymentId,
        userId: 'user-123',
        amount: 10000,
        currency: 'USD',
        status: 'failed',
        retryCount: 0,
        paymentMethodId: 'pm-123',
      };

      paymentRepository.findById.mockResolvedValue(payment as any);
      paymentService.processPayment.mockResolvedValue({
        success: true,
        paymentId: 'payment-123-retry',
        status: 'succeeded',
      });

      paymentRepository.update.mockResolvedValue({} as any);

      // Act
      await service.retryPayment(paymentId, { maxRetries: 3 });

      // Assert
      expect(notificationService.sendPaymentRetryNotification).toHaveBeenCalledWith({
        userId: 'user-123',
        paymentId,
        amount: 10000,
        attempt: 1,
        maxAttempts: 3,
      });
    });

    it('should notify user on successful retry', async () => {
      // Arrange
      const paymentId = 'payment-123';
      const payment = {
        id: paymentId,
        userId: 'user-123',
        amount: 10000,
        currency: 'USD',
        status: 'failed',
        retryCount: 0,
        paymentMethodId: 'pm-123',
      };

      paymentRepository.findById.mockResolvedValue(payment as any);
      paymentService.processPayment.mockResolvedValue({
        success: true,
        paymentId: 'payment-123-retry',
        status: 'succeeded',
      });

      paymentRepository.update.mockResolvedValue({} as any);

      // Act
      await service.retryPayment(paymentId, { maxRetries: 3 });

      // Assert
      expect(notificationService.sendPaymentSuccessNotification).toHaveBeenCalledWith({
        userId: 'user-123',
        paymentId: 'payment-123-retry',
        amount: 10000,
        wasRetry: true,
        retryAttempt: 1,
      });
    });

    it('should notify user on final failure', async () => {
      // Arrange
      const paymentId = 'payment-123';
      const payment = {
        id: paymentId,
        userId: 'user-123',
        amount: 10000,
        currency: 'USD',
        status: 'failed',
        retryCount: 2,
        paymentMethodId: 'pm-123',
      };

      paymentRepository.findById.mockResolvedValue(payment as any);
      paymentService.processPayment.mockRejectedValue(new Error('Final failure'));

      paymentRepository.update.mockResolvedValue({} as any);

      // Act
      await service.retryPayment(paymentId, { maxRetries: 3 });

      // Assert
      expect(notificationService.sendPaymentFailureNotification).toHaveBeenCalledWith({
        type: 'final_failure',
        userId: 'user-123',
        paymentId,
        amount: 10000,
        reason: 'Maximum retry limit exceeded',
        retryAttempts: 3,
      });
    });

    it('should send appropriate notifications based on failure type', async () => {
      // Arrange
      const paymentId = 'payment-123';
      const payment = {
        id: paymentId,
        userId: 'user-123',
        amount: 10000,
        currency: 'USD',
        status: 'failed',
        retryCount: 0,
        failureCode: 'insufficient_funds', // Non-retryable
        paymentMethodId: 'pm-123',
      };

      paymentRepository.findById.mockResolvedValue(payment as any);

      // Act
      await service.retryPayment(paymentId, { maxRetries: 3 });

      // Assert
      expect(notificationService.sendPaymentFailureNotification).toHaveBeenCalledWith({
        type: 'action_required',
        userId: 'user-123',
        paymentId,
        amount: 10000,
        reason: 'Insufficient funds - please update payment method',
        actionRequired: true,
      });
    });
  });

  describe('Retry Configuration', () => {
    it('should use custom retry configuration', async () => {
      // Arrange
      const paymentId = 'payment-123';
      const payment = {
        id: paymentId,
        userId: 'user-123',
        amount: 10000,
        currency: 'USD',
        status: 'failed',
        retryCount: 0,
        paymentMethodId: 'pm-123',
      };

      const customConfig = {
        maxRetries: 5,
        baseDelayMs: 2000,
        maxDelayMs: 30000,
        backoffMultiplier: 3,
        cooldownMinutes: 10,
        retryWindowHours: 24,
      };

      paymentRepository.findById.mockResolvedValue(payment as any);
      paymentService.processPayment.mockRejectedValue(new Error('Test failure'));
      paymentRepository.update.mockResolvedValue({} as any);

      // Act
      const result = await service.retryPayment(paymentId, customConfig);

      // Assert
      expect(result.totalRetries).toBe(5);
      expect(result.config).toEqual(customConfig);
    });

    it('should validate retry configuration', async () => {
      // Arrange
      const invalidConfigs = [
        { maxRetries: 0 }, // Too low
        { maxRetries: 11 }, // Too high
        { baseDelayMs: -1 }, // Negative
        { cooldownMinutes: -1 }, // Negative
      ];

      for (const config of invalidConfigs) {
        // Act & Assert
        expect(() => service.validateRetryConfig(config)).toThrow();
      }
    });

    it('should apply different strategies for different payment types', async () => {
      // Arrange
      const testCases = [
        {
          paymentType: 'subscription',
          expectedConfig: { maxRetries: 5, baseDelayMs: 3600000 }, // 1 hour
        },
        {
          paymentType: 'one_time',
          expectedConfig: { maxRetries: 3, baseDelayMs: 60000 }, // 1 minute
        },
        {
          paymentType: 'deposit',
          expectedConfig: { maxRetries: 2, baseDelayMs: 300000 }, // 5 minutes
        },
      ];

      for (const testCase of testCases) {
        // Act
        const config = service.getRetryConfigForPaymentType(testCase.paymentType);

        // Assert
        expect(config.maxRetries).toBe(testCase.expectedConfig.maxRetries);
        expect(config.baseDelayMs).toBe(testCase.expectedConfig.baseDelayMs);
      }
    });
  });

  describe('Retry Analytics', () => {
    it('should track retry statistics', async () => {
      // Arrange
      const startDate = new Date('2024-06-01');
      const endDate = new Date('2024-06-30');

      paymentRepository.findByStatus.mockResolvedValue([
        { status: 'succeeded', retryCount: 1, amount: 10000 },
        { status: 'succeeded', retryCount: 2, amount: 15000 },
        { status: 'failed', retryCount: 3, amount: 20000 },
        { status: 'manual_review', retryCount: 3, amount: 25000 },
      ] as any);

      // Act
      const stats = await service.getRetryStatistics(startDate, endDate);

      // Assert
      expect(stats.totalRetries).toBe(9);
      expect(stats.successfulRetries).toBe(3);
      expect(stats.failedRetries).toBe(6);
      expect(stats.retrySuccessRate).toBe(33.33);
      expect(stats.averageRetriesPerPayment).toBe(2.25);
    });

    it('should identify retry patterns', async () => {
      // Arrange
      const paymentId = 'payment-123';
      const retryHistory = [
        { attempt: 1, timestamp: new Date('2024-06-01T10:00:00Z'), result: 'failed', error: 'timeout' },
        { attempt: 2, timestamp: new Date('2024-06-01T10:01:00Z'), result: 'failed', error: 'timeout' },
        { attempt: 3, timestamp: new Date('2024-06-01T10:03:00Z'), result: 'succeeded', error: null },
      ];

      paymentRepository.findById.mockResolvedValue({
        id: paymentId,
        retryHistory,
      } as any);

      // Act
      const patterns = await service.analyzeRetryPatterns(paymentId);

      // Assert
      expect(patterns.commonFailureReason).toBe('timeout');
      expect(patterns.averageRetryDelay).toBe(60000); // 1 minute
      expect(patterns.successOnAttempt).toBe(3);
      expect(patterns.retryPattern).toBe('exponential_backoff');
    });
  describe('Payment Recovery Tests', () => {
    it('should handle partial payment recovery', async () => {
      // Arrange
      const paymentId = 'payment-123';
      const partialPayment = {
        id: paymentId,
        userId: 'user-123',
        amount: 10000,
        currency: 'USD',
        status: 'partial',
        paidAmount: 5000,
        remainingAmount: 5000,
        paymentMethodId: 'pm-123',
      };

      paymentRepository.findById.mockResolvedValue(partialPayment as any);
      
      // Mock successful recovery of remaining amount
      paymentService.processPayment.mockResolvedValue({
        success: true,
        paymentId: 'payment-123-recovery',
        amount: 5000,
        status: 'succeeded',
      });

      paymentRepository.update.mockResolvedValue({} as any);

      // Act
      const result = await service.recoverPartialPayment(paymentId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.recoveredAmount).toBe(5000);
      expect(result.totalPaidAmount).toBe(10000);
      expect(result.status).toBe('fully_paid');
      expect(paymentService.processPayment).toHaveBeenCalledWith({
        paymentMethodId: 'pm-123',
        amount: 5000,
        currency: 'USD',
        userId: 'user-123',
        paymentType: 'recovery',
      });
    });

    it('should handle payment method updates during recovery', async () => {
      // Arrange
      const paymentId = 'payment-123';
      const failedPayment = {
        id: paymentId,
        userId: 'user-123',
        amount: 10000,
        currency: 'USD',
        status: 'failed',
        paymentMethodId: 'pm-old-123',
      };

      const newPaymentMethod = {
        id: 'pm-new-456',
        type: 'card',
        last4: '4242',
        brand: 'visa',
      };

      paymentRepository.findById.mockResolvedValue(failedPayment as any);
      
      // Mock payment method update service
      const mockUpdatePaymentMethod = jest.fn().mockResolvedValue(newPaymentMethod);
      service.updatePaymentMethod = mockUpdatePaymentMethod;
      
      // Mock successful payment with new method
      paymentService.processPayment.mockResolvedValue({
        success: true,
        paymentId: 'payment-123-recovered',
        status: 'succeeded',
      });

      paymentRepository.update.mockResolvedValue({} as any);

      // Act
      const result = await service.recoverWithNewPaymentMethod(paymentId, 'pm-new-456');

      // Assert
      expect(result.success).toBe(true);
      expect(result.newPaymentMethodUsed).toBe(true);
      expect(result.previousPaymentMethodId).toBe('pm-old-123');
      expect(result.newPaymentMethodId).toBe('pm-new-456');
      expect(paymentService.processPayment).toHaveBeenCalledWith({
        paymentMethodId: 'pm-new-456',
        amount: 10000,
        currency: 'USD',
        userId: 'user-123',
        paymentType: 'recovery',
      });
    });

    it('should handle manual retry triggers', async () => {
      // Arrange
      const paymentId = 'payment-123';
      const payment = {
        id: paymentId,
        userId: 'user-123',
        amount: 10000,
        currency: 'USD',
        status: 'failed',
        retryCount: 2,
        lastRetryAt: new Date(),
        paymentMethodId: 'pm-123',
        manualRetryAllowed: true,
      };

      paymentRepository.findById.mockResolvedValue(payment as any);
      paymentService.processPayment.mockResolvedValue({
        success: true,
        paymentId: 'payment-123-manual-retry',
        status: 'succeeded',
      });

      paymentRepository.update.mockResolvedValue({} as any);

      // Act
      const result = await service.triggerManualRetry(paymentId, 'user-456', 'Customer requested retry');

      // Assert
      expect(result.success).toBe(true);
      expect(result.triggeredBy).toBe('user-456');
      expect(result.reason).toBe('Customer requested retry');
      expect(result.isManualRetry).toBe(true);
      expect(paymentRepository.update).toHaveBeenCalledWith(paymentId, {
        manualRetryAt: expect.any(Date),
        manualRetryBy: 'user-456',
        manualRetryReason: 'Customer requested retry',
        status: 'succeeded',
      });
    });

    it('should validate manual retry permissions', async () => {
      // Arrange
      const paymentId = 'payment-123';
      const payment = {
        id: paymentId,
        userId: 'user-123',
        amount: 10000,
        currency: 'USD',
        status: 'failed',
        retryCount: 2,
        manualRetryAllowed: false, // Manual retry not allowed
      };

      paymentRepository.findById.mockResolvedValue(payment as any);

      // Act
      const result = await service.triggerManualRetry(paymentId, 'user-456', 'Unauthorized retry');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Manual retry not allowed for this payment');
      expect(paymentService.processPayment).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith('Unauthorized manual retry attempt', {
        paymentId,
        triggeredBy: 'user-456',
        reason: 'Unauthorized retry',
      });
    });

    it('should handle payment reconciliation', async () => {
      // Arrange
      const paymentId = 'payment-123';
      const payment = {
        id: paymentId,
        userId: 'user-123',
        amount: 10000,
        currency: 'USD',
        status: 'pending',
        externalTransactionId: 'ext-123',
      };

      const externalPaymentStatus = {
        transactionId: 'ext-123',
        status: 'completed',
        amount: 10000,
        currency: 'USD',
        completedAt: new Date(),
        metadata: {
          gateway: 'stripe',
          method: 'card',
        },
      };

      paymentRepository.findById.mockResolvedValue(payment as any);
      
      // Mock external payment service
      const mockGetExternalStatus = jest.fn().mockResolvedValue(externalPaymentStatus);
      service.getExternalPaymentStatus = mockGetExternalStatus;

      paymentRepository.update.mockResolvedValue({} as any);

      // Act
      const result = await service.reconcilePayment(paymentId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.reconciled).toBe(true);
      expect(result.externalStatus).toBe('completed');
      expect(result.statusUpdate).toBe('succeeded');
      expect(paymentRepository.update).toHaveBeenCalledWith(paymentId, {
        status: 'succeeded',
        externalStatus: 'completed',
        reconciledAt: expect.any(Date),
        reconciliationData: externalPaymentStatus,
      });
    });

    it('should handle payment reconciliation mismatches', async () => {
      // Arrange
      const paymentId = 'payment-123';
      const payment = {
        id: paymentId,
        userId: 'user-123',
        amount: 10000,
        currency: 'USD',
        status: 'pending',
        externalTransactionId: 'ext-123',
      };

      const externalPaymentStatus = {
        transactionId: 'ext-123',
        status: 'completed',
        amount: 8000, // Amount mismatch!
        currency: 'USD',
        completedAt: new Date(),
      };

      paymentRepository.findById.mockResolvedValue(payment as any);
      service.getExternalPaymentStatus = jest.fn().mockResolvedValue(externalPaymentStatus);

      // Act
      const result = await service.reconcilePayment(paymentId);

      // Assert
      expect(result.reconciled).toBe(false);
      expect(result.discrepancy).toBe(true);
      expect(result.discrepancyType).toBe('amount_mismatch');
      expect(result.expectedAmount).toBe(10000);
      expect(result.actualAmount).toBe(8000);
      expect(logger.warn).toHaveBeenCalledWith('Payment reconciliation discrepancy', {
        paymentId,
        discrepancyType: 'amount_mismatch',
        expected: 10000,
        actual: 8000,
      });
    });

    it('should handle refund retry logic', async () => {
      // Arrange
      const refundId = 'refund-123';
      const refund = {
        id: refundId,
        paymentId: 'payment-123',
        amount: 5000,
        currency: 'USD',
        status: 'failed',
        retryCount: 1,
        reason: 'customer_request',
      };

      paymentRepository.findById.mockResolvedValue(refund as any);
      
      // Mock refund service
      const mockRefundPayment = jest.fn()
        .mockRejectedValueOnce(new Error('Refund gateway timeout'))
        .mockResolvedValueOnce({
          success: true,
          refundId: 'refund-123-retry',
          status: 'succeeded',
        });

      service.refundPayment = mockRefundPayment;
      paymentRepository.update.mockResolvedValue({} as any);

      // Act
      const result = await service.retryRefund(refundId, { maxRetries: 2 });

      // Assert
      expect(result.success).toBe(true);
      expect(result.retryAttempt).toBe(2);
      expect(result.totalRetries).toBe(2);
      expect(mockRefundPayment).toHaveBeenCalledTimes(2);
      expect(paymentRepository.update).toHaveBeenCalledWith(refundId, {
        status: 'succeeded',
        retryCount: 2,
        lastRetryAt: expect.any(Date),
      });
    });

    it('should handle payment recovery analytics', async () => {
      // Arrange
      const startDate = new Date('2024-06-01');
      const endDate = new Date('2024-06-30');

      paymentRepository.findByStatus.mockResolvedValue([
        {
          id: 'payment-1',
          status: 'succeeded',
          recoveryAttempted: true,
          recoverySuccessful: true,
          recoveredAmount: 5000,
          originalAmount: 10000,
          recoveryMethod: 'partial_payment',
        },
        {
          id: 'payment-2',
          status: 'succeeded',
          recoveryAttempted: true,
          recoverySuccessful: true,
          recoveredAmount: 10000,
          originalAmount: 10000,
          recoveryMethod: 'new_payment_method',
        },
        {
          id: 'payment-3',
          status: 'failed',
          recoveryAttempted: true,
          recoverySuccessful: false,
          recoveredAmount: 0,
          originalAmount: 8000,
          recoveryMethod: 'manual_retry',
        },
      ] as any);

      // Act
      const analytics = await service.getRecoveryAnalytics(startDate, endDate);

      // Assert
      expect(analytics.totalRecoveryAttempts).toBe(3);
      expect(analytics.successfulRecoveries).toBe(2);
      expect(analytics.failedRecoveries).toBe(1);
      expect(analytics.recoverySuccessRate).toBe(66.67);
      expect(analytics.totalRecoveredAmount).toBe(15000);
      expect(analytics.totalOriginalAmount).toBe(28000);
      expect(analytics.recoveryRate).toBe(53.57);
      expect(analytics.methodBreakdown.partial_payment).toBe(1);
      expect(analytics.methodBreakdown.new_payment_method).toBe(1);
      expect(analytics.methodBreakdown.manual_retry).toBe(1);
    });

    it('should handle batch payment recovery', async () => {
      // Arrange
      const paymentIds = ['payment-1', 'payment-2', 'payment-3'];
      const payments = [
        {
          id: 'payment-1',
          userId: 'user-1',
          amount: 5000,
          status: 'failed',
          paymentMethodId: 'pm-1',
        },
        {
          id: 'payment-2',
          userId: 'user-2',
          amount: 7500,
          status: 'failed',
          paymentMethodId: 'pm-2',
        },
        {
          id: 'payment-3',
          userId: 'user-3',
          amount: 3000,
          status: 'failed',
          paymentMethodId: 'pm-3',
        },
      ];

      paymentRepository.findById.mockImplementation((id) => {
        const payment = payments.find(p => p.id === id);
        return Promise.resolve(payment as any);
      });

      // Mock payment service results
      paymentService.processPayment
        .mockResolvedValueOnce({ success: true, paymentId: 'payment-1-recovered' })
        .mockRejectedValueOnce(new Error('Insufficient funds'))
        .mockResolvedValueOnce({ success: true, paymentId: 'payment-3-recovered' });

      paymentRepository.update.mockResolvedValue({} as any);

      // Act
      const result = await service.batchRecoverPayments(paymentIds, { maxRetries: 1 });

      // Assert
      expect(result.totalPayments).toBe(3);
      expect(result.successfulRecoveries).toBe(2);
      expect(result.failedRecoveries).toBe(1);
      expect(result.totalRecoveredAmount).toBe(8000);
      expect(result.results).toHaveLength(3);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(false);
      expect(result.results[2].success).toBe(true);
    });

    it('should handle payment recovery notifications', async () => {
      // Arrange
      const paymentId = 'payment-123';
      const payment = {
        id: paymentId,
        userId: 'user-123',
        amount: 10000,
        currency: 'USD',
        status: 'failed',
        paymentMethodId: 'pm-123',
      };

      paymentRepository.findById.mockResolvedValue(payment as any);
      paymentService.processPayment.mockResolvedValue({
        success: true,
        paymentId: 'payment-123-recovered',
        status: 'succeeded',
      });

      paymentRepository.update.mockResolvedValue({} as any);

      // Act
      await service.recoverWithNewPaymentMethod(paymentId, 'pm-new-456');

      // Assert
      expect(notificationService.sendPaymentRecoveryNotification).toHaveBeenCalledWith({
        type: 'recovery_success',
        userId: 'user-123',
        paymentId,
        originalAmount: 10000,
        recoveredAmount: 10000,
        recoveryMethod: 'new_payment_method',
      });
    });

    it('should handle recovery failure notifications', async () => {
      // Arrange
      const paymentId = 'payment-123';
      const payment = {
        id: paymentId,
        userId: 'user-123',
        amount: 10000,
        currency: 'USD',
        status: 'failed',
        paymentMethodId: 'pm-123',
      };

      paymentRepository.findById.mockResolvedValue(payment as any);
      paymentService.processPayment.mockRejectedValue(new Error('Payment method declined'));

      // Act
      await service.recoverWithNewPaymentMethod(paymentId, 'pm-new-456');

      // Assert
      expect(notificationService.sendPaymentRecoveryNotification).toHaveBeenCalledWith({
        type: 'recovery_failed',
        userId: 'user-123',
        paymentId,
        originalAmount: 10000,
        recoveredAmount: 0,
        error: 'Payment method declined',
        actionRequired: true,
      });
    });
  });
});
