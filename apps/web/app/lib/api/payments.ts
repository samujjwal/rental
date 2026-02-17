import { api } from "~/lib/api-client";
import type {
  PaymentIntentResponse,
  BalanceResponse,
  PayoutRecord,
} from "~/lib/shared-types";

export type CreatePaymentIntentResponse = PaymentIntentResponse;

export interface OwnerEarnings {
  amount: number;
  currency: string;
}

export type TransactionType =
  | "PAYMENT"
  | "PAYOUT"
  | "REFUND"
  | "PLATFORM_FEE"
  | "DEPOSIT_HOLD"
  | "DEPOSIT_RELEASE"
  | "OWNER_EARNING";

export type TransactionStatus = "PENDING" | "POSTED" | "SETTLED" | "CANCELLED";

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  amountSigned?: number;
  currency: string;
  status: TransactionStatus;
  description: string;
  createdAt: string;
  booking?: {
    id: string;
    listing: {
      id?: string;
      title: string;
    };
  };
}

export interface TransactionsResponse {
  transactions: Transaction[];
  total: number;
  page: number;
  limit: number;
}

export interface PayoutRequest {
  amount: number;
  currency?: string;
}

export interface PayoutResponse {
  id: string;
  amount: number;
  status: string;
  estimatedArrival: string;
  createdAt?: string;
  accountLast4?: string;
}

export const paymentsApi = {
  async createPaymentIntent(
    bookingId: string
  ): Promise<CreatePaymentIntentResponse> {
    return api.post<CreatePaymentIntentResponse>(`/payments/intents/${bookingId}`);
  },

  async getPaymentHistory(userId: string): Promise<Transaction[]> {
    const response = await api.get<TransactionsResponse>(`/payments/transactions`);
    return response.transactions || [];
  },

  async getOwnerEarnings(userId: string): Promise<OwnerEarnings> {
    return api.get<OwnerEarnings>("/payments/earnings");
  },

  async getEarnings(): Promise<OwnerEarnings> {
    return api.get<OwnerEarnings>("/payments/earnings");
  },

  async getEarningsSummary(): Promise<{
    thisMonth: number;
    lastMonth: number;
    total: number;
    currency: string;
  }> {
    return api.get("/payments/earnings/summary");
  },

  async getTransactions(params?: {
    page?: number;
    limit?: number;
    type?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<TransactionsResponse> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.type) queryParams.append("type", params.type);
    if (params?.status) queryParams.append("status", params.status);
    if (params?.startDate) queryParams.append("startDate", params.startDate);
    if (params?.endDate) queryParams.append("endDate", params.endDate);
    const query = queryParams.toString();
    return api.get<TransactionsResponse>(`/payments/transactions${query ? `?${query}` : ""}`);
  },

  async getBalance(): Promise<{
    balance: number;
    currency: string;
  }> {
    return api.get("/payments/balance");
  },

  async requestPayout(data: PayoutRequest): Promise<PayoutResponse> {
    return api.post<PayoutResponse>("/payments/payouts", data);
  },

  async getPayouts(params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<{
    payouts: PayoutResponse[];
  }> {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append("status", params.status);
    const query = queryParams.toString();
    return api.get(`/payments/payouts${query ? `?${query}` : ""}`).then((payouts) => ({
      payouts: Array.isArray(payouts) ? payouts : [],
    }));
  },
};
