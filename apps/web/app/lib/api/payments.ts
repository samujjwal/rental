import { api } from "~/lib/api-client";

export interface CreatePaymentIntentRequest {
  bookingId: string;
}

export interface CreatePaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
}

export interface OwnerEarnings {
  totalAmount: number;
  pendingAmount: number;
  availableAmount: number;
  earnings: Array<{
    id: string;
    amount: number;
    status: string;
    createdAt: string;
  }>;
}

export type TransactionType =
  | "BOOKING_PAYMENT"
  | "PAYOUT"
  | "REFUND"
  | "PLATFORM_FEE"
  | "DEPOSIT_HOLD"
  | "DEPOSIT_RELEASE";

export type TransactionStatus = "pending" | "processing" | "completed" | "failed";

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  status: TransactionStatus;
  description: string;
  createdAt: string;
  booking?: {
    id: string;
    listing: {
      title: string;
    };
    renter: {
      firstName: string;
      lastName: string | null;
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
}

export const paymentsApi = {
  async createPaymentIntent(
    bookingId: string
  ): Promise<CreatePaymentIntentResponse> {
    return api.post<CreatePaymentIntentResponse>("/payments/create-intent", {
      bookingId,
    });
  },

  async confirmPayment(paymentIntentId: string): Promise<{ success: boolean }> {
    return api.post<{ success: boolean }>(
      `/payments/${paymentIntentId}/confirm`
    );
  },

  async getPaymentHistory(userId: string): Promise<Transaction[]> {
    return api.get<Transaction[]>(`/payments/history?userId=${userId}`);
  },

  async getOwnerEarnings(userId: string): Promise<OwnerEarnings> {
    return api.get<OwnerEarnings>(`/payments/earnings?userId=${userId}`);
  },

  async getEarnings(): Promise<OwnerEarnings> {
    return api.get<OwnerEarnings>("/payments/earnings");
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
    available: number;
    pending: number;
    currency: string;
  }> {
    return api.get("/payments/balance");
  },

  async requestPayout(data: PayoutRequest): Promise<PayoutResponse> {
    return api.post<PayoutResponse>("/payments/payout", data);
  },

  async getPayouts(params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<{
    payouts: PayoutResponse[];
    total: number;
  }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.status) queryParams.append("status", params.status);
    const query = queryParams.toString();
    return api.get(`/payments/payouts${query ? `?${query}` : ""}`);
  },

  async getEarningsSummary(params?: {
    period?: "week" | "month" | "year";
  }): Promise<{
    thisMonth: number;
    lastMonth: number;
    total: number;
    currency: string;
    breakdown: { date: string; amount: number }[];
  }> {
    const queryParams = new URLSearchParams();
    if (params?.period) queryParams.append("period", params.period);
    const query = queryParams.toString();
    return api.get(`/payments/earnings/summary${query ? `?${query}` : ""}`);
  },
};
