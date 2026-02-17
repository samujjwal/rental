// ============================================================================
// Payment Types
// Shared contract for payment data between frontend and backend
// ============================================================================

import { PayoutStatus, DepositStatus } from './enums';

/** Payment intent creation input */
export interface CreatePaymentInput {
  bookingId: string;
  paymentMethodId?: string;
}

/** Payment intent response */
export interface PaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
  status: string;
}

/** Transaction record */
export interface TransactionRecord {
  id: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  description?: string;
  bookingId?: string;
  createdAt: string;
}

/** Earnings summary */
export interface EarningsSummary {
  totalEarnings: number;
  pendingPayouts: number;
  completedPayouts: number;
  currentBalance: number;
  currency: string;
}

/** Earnings detail (per-period) */
export interface EarningsDetail {
  period: string;
  earnings: number;
  bookingCount: number;
  avgBookingValue: number;
}

/** Payout record */
export interface PayoutRecord {
  id: string;
  amount: number;
  currency: string;
  status: PayoutStatus | string;
  method?: string;
  initiatedAt: string;
  completedAt?: string;
}

/** Deposit record */
export interface DepositRecord {
  id: string;
  bookingId: string;
  amount: number;
  status: DepositStatus | string;
  heldAt?: string;
  releasedAt?: string;
}

/** Balance response */
export interface BalanceResponse {
  available: number;
  pending: number;
  currency: string;
}
