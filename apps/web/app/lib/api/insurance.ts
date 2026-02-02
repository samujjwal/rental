import { api } from "~/lib/api-client";

// Types
export type InsuranceStatus = "ACTIVE" | "EXPIRED" | "PENDING" | "CANCELLED" | "CLAIMED";
export type InsuranceType = "BASIC" | "STANDARD" | "PREMIUM" | "COMPREHENSIVE";
export type ClaimStatus = "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "DENIED" | "PAID";

export interface InsurancePolicy {
  id: string;
  bookingId: string;
  type: InsuranceType;
  status: InsuranceStatus;
  premiumAmount: number;
  coverageAmount: number;
  deductible: number;
  startDate: string;
  endDate: string;
  provider: string;
  policyNumber: string;
  coverageDetails: {
    damage: boolean;
    theft: boolean;
    liability: boolean;
    cancellation: boolean;
    weather: boolean;
  };
  listing?: {
    id: string;
    title: string;
    images: string[];
  };
  booking?: {
    id: string;
    startDate: string;
    endDate: string;
    renter: {
      id: string;
      firstName: string;
      lastName: string;
    };
  };
  createdAt: string;
  updatedAt: string;
}

export interface InsuranceClaim {
  id: string;
  policyId: string;
  status: ClaimStatus;
  claimAmount: number;
  approvedAmount?: number;
  description: string;
  incidentDate: string;
  incidentType: "DAMAGE" | "THEFT" | "LIABILITY" | "OTHER";
  evidence: {
    id: string;
    type: "IMAGE" | "DOCUMENT" | "VIDEO";
    url: string;
    description?: string;
  }[];
  timeline: {
    date: string;
    status: ClaimStatus;
    note?: string;
    updatedBy?: string;
  }[];
  policy?: InsurancePolicy;
  submittedAt: string;
  resolvedAt?: string;
}

export interface InsuranceQuote {
  type: InsuranceType;
  premiumAmount: number;
  coverageAmount: number;
  deductible: number;
  provider: string;
  coverageDetails: {
    damage: boolean;
    theft: boolean;
    liability: boolean;
    cancellation: boolean;
    weather: boolean;
  };
  description: string;
}

export interface CreateClaimDto {
  policyId: string;
  claimAmount: number;
  description: string;
  incidentDate: string;
  incidentType: "DAMAGE" | "THEFT" | "LIABILITY" | "OTHER";
  evidence?: {
    type: "IMAGE" | "DOCUMENT" | "VIDEO";
    url: string;
    description?: string;
  }[];
}

export interface InsurancePoliciesResponse {
  data: InsurancePolicy[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface InsuranceClaimsResponse {
  data: InsuranceClaim[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// API Client
export const insuranceApi = {
  // Get all insurance policies for the current user
  getMyPolicies: async (params?: {
    page?: number;
    limit?: number;
    status?: InsuranceStatus;
  }): Promise<InsurancePoliciesResponse> => {
    const response = await api.get<InsurancePoliciesResponse>("/insurance/policies/me", {
      params,
    });
    return response;
  },

  // Get a specific policy by ID
  getPolicy: async (policyId: string): Promise<InsurancePolicy> => {
    const response = await api.get<InsurancePolicy>(`/insurance/policies/${policyId}`);
    return response;
  },

  // Get policy by booking ID
  getPolicyByBooking: async (bookingId: string): Promise<InsurancePolicy | null> => {
    try {
      const response = await api.get<InsurancePolicy>(`/insurance/policies/booking/${bookingId}`);
      return response;
    } catch (error: any) {
      if (error?.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  // Get insurance quotes for a booking
  getQuotes: async (bookingId: string): Promise<InsuranceQuote[]> => {
    const response = await api.get<InsuranceQuote[]>(`/insurance/quotes`, {
      params: { bookingId },
    });
    return response;
  },

  // Purchase insurance for a booking
  purchaseInsurance: async (
    bookingId: string,
    insuranceType: InsuranceType
  ): Promise<InsurancePolicy> => {
    const response = await api.post<InsurancePolicy>("/insurance/policies", {
      bookingId,
      type: insuranceType,
    });
    return response;
  },

  // Cancel an insurance policy
  cancelPolicy: async (policyId: string): Promise<InsurancePolicy> => {
    const response = await api.post<InsurancePolicy>(`/insurance/policies/${policyId}/cancel`);
    return response;
  },

  // Get all claims for the current user
  getMyClaims: async (params?: {
    page?: number;
    limit?: number;
    status?: ClaimStatus;
  }): Promise<InsuranceClaimsResponse> => {
    const response = await api.get<InsuranceClaimsResponse>("/insurance/claims/me", {
      params,
    });
    return response;
  },

  // Get a specific claim by ID
  getClaim: async (claimId: string): Promise<InsuranceClaim> => {
    const response = await api.get<InsuranceClaim>(`/insurance/claims/${claimId}`);
    return response;
  },

  // Submit a new claim
  submitClaim: async (data: CreateClaimDto): Promise<InsuranceClaim> => {
    const response = await api.post<InsuranceClaim>("/insurance/claims", data);
    return response;
  },

  // Add evidence to an existing claim
  addClaimEvidence: async (
    claimId: string,
    evidence: { type: "IMAGE" | "DOCUMENT" | "VIDEO"; url: string; description?: string }
  ): Promise<InsuranceClaim> => {
    const response = await api.post<InsuranceClaim>(
      `/insurance/claims/${claimId}/evidence`,
      evidence
    );
    return response;
  },

  // Get insurance statistics for dashboard
  getInsuranceStats: async (): Promise<{
    activePolicies: number;
    totalCoverage: number;
    pendingClaims: number;
    totalClaimsAmount: number;
  }> => {
    const response = await api.get<{
      activePolicies: number;
      totalCoverage: number;
      pendingClaims: number;
      totalClaimsAmount: number;
    }>("/insurance/stats");
    return response;
  },

  // Get coverage recommendations based on listing category
  getCoverageRecommendations: async (
    listingId: string
  ): Promise<{
    recommended: InsuranceType;
    reason: string;
    quotes: InsuranceQuote[];
  }> => {
    const response = await api.get<{
      recommended: InsuranceType;
      reason: string;
      quotes: InsuranceQuote[];
    }>(`/insurance/recommendations/${listingId}`);
    return response;
  },
};

export default insuranceApi;
