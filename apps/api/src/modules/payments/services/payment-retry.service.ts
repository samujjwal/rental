import { Injectable, Logger } from '@nestjs/common';
import { PaymentDataService } from './payment-data.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

export interface PaymentFailureDetection {
  failed: boolean;
  failureReason?: string;
  failureCode?: string;
  stillProcessing?: boolean;
  retryable?: boolean;
}

export interface FailureCategory {
  category: 'card_error' | 'insufficient_funds' | 'processing_error' | 'fraud' | 'network_error';
  retryable: boolean;
  severity: 'low' | 'medium' | 'high';
}

export interface RetryResult {
  success: boolean;
  retryAttempt?: number;
  totalRetries?: number;
  reason?: string;
  escalated?: boolean;
  escalationReason?: string;
  config?: RetryConfig;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  cooldownMinutes: number;
  retryWindowHours: number;
}

export interface RetryStatistics {
  totalRetries: number;
  successfulRetries: number;
  failedRetries: number;
  retrySuccessRate: number;
  averageRetriesPerPayment: number;
  escalatedPayments: number;
}

export interface RetryPattern {
  commonFailureReason: string;
  averageRetryDelay: number;
  successOnAttempt?: number;
  retryPattern: 'linear' | 'exponential_backoff' | 'immediate';
  failureFrequency: 'consistent' | 'decreasing' | 'increasing';
}

@Injectable()
export class PaymentRetryService {
  private readonly logger = new Logger(PaymentRetryService.name);

  constructor(
    private readonly paymentDataService: PaymentDataService,
    private readonly prisma: PrismaService,
  ) {}

  async detectPaymentFailure(paymentId: string): Promise<PaymentFailureDetection> {
    try {
      const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
      
      if (!payment) {
        throw new Error('Payment not found');
      }

      // Stub implementation - would check actual payment status
      return {
        failed: false,
        stillProcessing: true,
        retryable: true,
      };
    } catch (error) {
      this.logger.error('Failed to detect payment failure', {
        paymentId,
        error: error.message,
      });
      throw error;
    }
  }

  async analyzeFailurePattern(paymentId: string): Promise<RetryPattern> {
    return {
      commonFailureReason: 'processing_error',
      averageRetryDelay: 5000,
      retryPattern: 'exponential_backoff',
      failureFrequency: 'decreasing',
    };
  }

  async retryPayment(
    paymentId: string,
    options?: { maxRetries?: number; backoffMs?: number }
  ): Promise<RetryResult> {
    try {
      this.logger.log('Retrying payment', { paymentId });

      // Stub implementation - would actually retry the payment
      return {
        success: true,
        retryAttempt: 1,
        totalRetries: 3,
        config: {
          maxRetries: options?.maxRetries || 3,
          baseDelayMs: options?.backoffMs || 1000,
          maxDelayMs: 30000,
          backoffMultiplier: 2,
          cooldownMinutes: 5,
          retryWindowHours: 24,
        },
      };
    } catch (error) {
      this.logger.error('Payment retry failed', {
        paymentId,
        error: error.message,
      });

      return {
        success: false,
        reason: error.message,
        escalated: true,
        escalationReason: 'Max retries exceeded',
      };
    }
  }

  async getRetryStatistics(timeRange?: { start: Date; end: Date }): Promise<RetryStatistics> {
    // Stub implementation - would query actual retry statistics
    return {
      totalRetries: 100,
      successfulRetries: 75,
      failedRetries: 25,
      retrySuccessRate: 75,
      averageRetriesPerPayment: 1.5,
      escalatedPayments: 5,
    };
  }

  async shouldRetryPayment(paymentId: string): Promise<{ shouldRetry: boolean; reason?: string }> {
    return { shouldRetry: true };
  }

  async getRetryDelay(paymentId: string, attemptNumber: number): Promise<number> {
    // Exponential backoff: 1s, 2s, 4s, 8s, etc.
    return Math.min(1000 * Math.pow(2, attemptNumber - 1), 30000);
  }

  async escalatePayment(paymentId: string, reason: string): Promise<{ success: boolean; ticketId?: string }> {
    this.logger.warn('Payment escalated', { paymentId, reason });
    return { success: true, ticketId: 'stub-ticket-id' };
  }

  async getFailedPaymentsForRetry(): Promise<Array<{ paymentId: string; failedAt: Date; retryCount: number }>> {
    // Stub implementation - would query failed payments
    return [];
  }

  private categorizeFailure(failureCode: string): FailureCategory {
    const categories: Record<string, FailureCategory> = {
      'card_declined': { category: 'card_error', retryable: true, severity: 'medium' },
      'insufficient_funds': { category: 'insufficient_funds', retryable: true, severity: 'medium' },
      'processing_error': { category: 'processing_error', retryable: true, severity: 'low' },
      'fraud_detected': { category: 'fraud', retryable: false, severity: 'high' },
      'network_error': { category: 'network_error', retryable: true, severity: 'low' },
    };

    return categories[failureCode] || { category: 'processing_error', retryable: true, severity: 'medium' };
  }
}
