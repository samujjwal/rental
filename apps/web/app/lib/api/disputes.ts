import { api } from "~/lib/api-client";

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
    return api.get<Dispute>(`/disputes/${id}`);
  },

  getDisputesForBooking: async (bookingId: string): Promise<Dispute[]> => {
    return api.get<Dispute[]>(`/bookings/${bookingId}/disputes`);
  },

  getMyDisputes: async (params?: { status?: string }): Promise<Dispute[]> => {
    return api.get<Dispute[]>("/disputes/my-disputes", { params });
  },

  createDispute: async (data: CreateDisputeRequest): Promise<Dispute> => {
    return api.post<Dispute>("/disputes", data);
  },

  addEvidence: async (
    disputeId: string,
    evidence: {
      type: "photo" | "document" | "message";
      url: string;
      description?: string;
    }
  ): Promise<Dispute> => {
    return api.post<Dispute>(`/disputes/${disputeId}/evidence`, evidence);
  },

  respondToDispute: async (
    disputeId: string,
    responseText: string
  ): Promise<Dispute> => {
    return api.post<Dispute>(`/disputes/${disputeId}/respond`, {
      response: responseText,
    });
  },
};
