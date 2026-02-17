import { api } from "~/lib/api-client";

export interface Dispute {
  id: string;
  bookingId: string;
  type: string;
  description: string;
  amount?: number;
  status: string;
  evidence?: unknown[];
  resolution?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DisputeParticipant {
  id: string;
  email?: string;
}

export interface DisputeResponse {
  id: string;
  content: string;
  createdAt: string;
  user?: DisputeParticipant;
}

export interface DisputeDetail extends Dispute {
  initiatorId?: string;
  defendantId?: string;
  booking?: {
    id: string;
    listing?: {
      id: string;
      title: string;
      owner?: DisputeParticipant;
    };
    renter?: DisputeParticipant;
  };
  initiator?: DisputeParticipant;
  defendant?: DisputeParticipant;
  responses?: DisputeResponse[];
}

export interface CreateDisputeRequest {
  bookingId: string;
  type:
    | "PROPERTY_DAMAGE"
    | "MISSING_ITEMS"
    | "CONDITION_MISMATCH"
    | "REFUND_REQUEST"
    | "PAYMENT_ISSUE"
    | "OTHER";
  title: string;
  description: string;
  amount?: number;
  evidence?: string[];
}

export const disputesApi = {
  getDisputeById: async (id: string): Promise<DisputeDetail> => {
    return api.get<DisputeDetail>(`/disputes/${id}`);
  },

  getDisputesForBooking: async (bookingId: string): Promise<Dispute[]> => {
    return api.get<Dispute[]>(`/bookings/${bookingId}/disputes`);
  },

  getMyDisputes: async (params?: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ disputes: Dispute[]; total: number }> => {
    return api.get<{ disputes: Dispute[]; total: number }>("/disputes", {
      params,
    });
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
  ): Promise<DisputeResponse> => {
    return api.post<DisputeResponse>(`/disputes/${disputeId}/responses`, {
      message: evidence.description || "Evidence submitted",
      evidence: evidence.url ? [evidence.url] : [],
    });
  },

  respondToDispute: async (
    disputeId: string,
    responseText: string
  ): Promise<DisputeResponse> => {
    return api.post<DisputeResponse>(`/disputes/${disputeId}/responses`, {
      message: responseText,
    });
  },

  closeDispute: async (disputeId: string, reason: string): Promise<DisputeDetail> => {
    return api.post<DisputeDetail>(`/disputes/${disputeId}/close`, { reason });
  },
};
