import { apiClient } from "~/lib/api-client";

export interface Dispute {
  id: string;
  bookingId: string;
  type: string;
  description: string;
  amount?: number;
  status: string;
  evidence?: any[];
  resolution?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDisputeRequest {
  bookingId: string;
  type:
    | "NON_DELIVERY"
    | "DAMAGED_ITEM"
    | "INCORRECT_ITEM"
    | "OVERCHARGE"
    | "OTHER";
  description: string;
  requestedAmount?: number;
  evidence?: {
    type: "photo" | "document" | "message";
    url: string;
    description?: string;
  }[];
}

export const disputesApi = {
  getDisputeById: async (id: string): Promise<Dispute> => {
    const response = await apiClient.get(`/disputes/${id}`);
    return response.data;
  },

  getDisputesForBooking: async (bookingId: string): Promise<Dispute[]> => {
    const response = await apiClient.get(`/bookings/${bookingId}/disputes`);
    return response.data;
  },

  getMyDisputes: async (): Promise<Dispute[]> => {
    const response = await apiClient.get("/disputes/my-disputes");
    return response.data;
  },

  createDispute: async (data: CreateDisputeRequest): Promise<Dispute> => {
    const response = await apiClient.post("/disputes", data);
    return response.data;
  },

  addEvidence: async (
    disputeId: string,
    evidence: {
      type: "photo" | "document" | "message";
      url: string;
      description?: string;
    }
  ): Promise<Dispute> => {
    const response = await apiClient.post(
      `/disputes/${disputeId}/evidence`,
      evidence
    );
    return response.data;
  },

  respondToDispute: async (
    disputeId: string,
    response: string
  ): Promise<Dispute> => {
    const apiResponse = await apiClient.post(`/disputes/${disputeId}/respond`, {
      response,
    });
    return apiResponse.data;
  },
};
