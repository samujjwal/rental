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

  async getPaymentHistory(userId: string): Promise<any[]> {
    return api.get<any[]>(`/payments/history?userId=${userId}`);
  },

  async getOwnerEarnings(userId: string): Promise<OwnerEarnings> {
    return api.get<OwnerEarnings>(`/payments/earnings?userId=${userId}`);
  },
};
