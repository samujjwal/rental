/**
 * Payments Client
 * 
 * Handles all payment-related API endpoints:
 * - Payment intents and processing
 * - Balance and earnings
 * - Transactions
 * - Payouts
 */

import type { PaymentBalance, PaymentTransaction } from '~/types';
import { BaseClient } from './base-client';

export class PaymentsClient extends BaseClient {
  /**
   * Create payment intent for a booking
   */
  async createPaymentIntent(bookingId: string): Promise<{
    clientSecret?: string;
    paymentIntentId?: string;
  }> {
    return this.request<any>(`/payments/intents/${bookingId}`, {
      method: 'POST',
    });
  }

  /**
   * Get payment balance
   */
  async getPaymentBalance(): Promise<PaymentBalance> {
    return this.request<PaymentBalance>('/payments/balance');
  }

  /**
   * Get payment earnings
   */
  async getPaymentEarnings(): Promise<{
    amount: number;
    currency: string;
  }> {
    return this.request<any>('/payments/earnings');
  }

  /**
   * Get payment transactions with pagination
   */
  async getPaymentTransactions(page: number = 1, limit: number = 20): Promise<{
    transactions: PaymentTransaction[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.request<any>(`/payments/transactions?page=${page}&limit=${limit}`);
  }
}
