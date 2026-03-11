// ============================================================================
// Dispute Types
// ============================================================================

import type { DisputeType } from './enums';

export interface CreateDisputePayload {
  bookingId: string;
  type: DisputeType;
  title: string;
  description: string;
  amount?: number;
}

export interface Dispute {
  id: string;
  bookingId: string;
  title?: string | null;
  type: string;
  description: string;
  amount?: number;
  status: string;
  createdAt: string;
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
    };
    renter?: DisputeParticipant;
  };
  initiator?: DisputeParticipant;
  defendant?: DisputeParticipant;
  responses?: DisputeResponse[];
}
