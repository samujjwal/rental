import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("~/lib/api-client", () => ({
  api: mockApi,
  apiClient: mockApi,
}));

import { insuranceApi } from "~/lib/api/insurance";

describe("insuranceApi", () => {
  beforeEach(() => vi.clearAllMocks());

  // ====== Listing Requirement ======
  it("getListingRequirement calls GET /insurance/listings/:id/requirement", async () => {
    mockApi.get.mockResolvedValue({ required: true, type: "BASIC" });
    const result = await insuranceApi.getListingRequirement("l1");
    expect(mockApi.get).toHaveBeenCalledWith("/insurance/listings/l1/requirement");
    expect(result).toEqual({ required: true, type: "BASIC" });
  });

  // ====== Policy CRUD ======
  it("uploadPolicy calls POST /insurance/policies", async () => {
    const data = {
      listingId: "l1",
      policyNumber: "POL-001",
      provider: "Nepal Insurance",
      type: "STANDARD",
      coverageAmount: 100000,
      effectiveDate: "2025-01-01",
      expirationDate: "2026-01-01",
      documentUrl: "https://docs.np/pol.pdf",
    };
    mockApi.post.mockResolvedValue({ id: "p1", ...data });
    await insuranceApi.uploadPolicy(data);
    expect(mockApi.post).toHaveBeenCalledWith("/insurance/policies", data);
  });

  it("getMyPolicies calls GET /insurance/policies/me with params", async () => {
    mockApi.get.mockResolvedValue({ data: [], pagination: { total: 0 } });
    await insuranceApi.getMyPolicies({ page: 1, status: "ACTIVE" });
    expect(mockApi.get).toHaveBeenCalledWith("/insurance/policies/me", {
      params: { page: 1, status: "ACTIVE" },
    });
  });

  it("getMyPolicies works without params", async () => {
    mockApi.get.mockResolvedValue({ data: [], pagination: { total: 0 } });
    await insuranceApi.getMyPolicies();
    expect(mockApi.get).toHaveBeenCalledWith("/insurance/policies/me", {
      params: undefined,
    });
  });

  it("getPolicy calls GET /insurance/policies/:id", async () => {
    mockApi.get.mockResolvedValue({ id: "p1" });
    const result = await insuranceApi.getPolicy("p1");
    expect(mockApi.get).toHaveBeenCalledWith("/insurance/policies/p1");
    expect(result).toEqual({ id: "p1" });
  });

  // ====== Policy by Booking ======
  it("getPolicyByBooking returns policy on success", async () => {
    mockApi.get.mockResolvedValue({ id: "p1", bookingId: "b1" });
    const result = await insuranceApi.getPolicyByBooking("b1");
    expect(mockApi.get).toHaveBeenCalledWith("/insurance/policies/booking/b1");
    expect(result).toEqual({ id: "p1", bookingId: "b1" });
  });

  it("getPolicyByBooking returns null on 404", async () => {
    mockApi.get.mockRejectedValue({ response: { status: 404 } });
    const result = await insuranceApi.getPolicyByBooking("b999");
    expect(result).toBeNull();
  });

  it("getPolicyByBooking rethrows non-404 errors", async () => {
    mockApi.get.mockRejectedValue({ response: { status: 500 } });
    await expect(insuranceApi.getPolicyByBooking("b1")).rejects.toEqual({
      response: { status: 500 },
    });
  });

  // ====== Quotes & Purchase ======
  it("getQuotes calls GET /insurance/quotes with bookingId param", async () => {
    mockApi.get.mockResolvedValue([{ type: "BASIC", premiumAmount: 500 }]);
    const result = await insuranceApi.getQuotes("b1");
    expect(mockApi.get).toHaveBeenCalledWith("/insurance/quotes", {
      params: { bookingId: "b1" },
    });
    expect(result).toHaveLength(1);
  });

  it("purchaseInsurance calls POST /insurance/policies with booking + type", async () => {
    mockApi.post.mockResolvedValue({ id: "p1", type: "PREMIUM" });
    await insuranceApi.purchaseInsurance("b1", "PREMIUM");
    expect(mockApi.post).toHaveBeenCalledWith("/insurance/policies", {
      bookingId: "b1",
      type: "PREMIUM",
    });
  });

  it("cancelPolicy calls POST /insurance/policies/:id/cancel", async () => {
    mockApi.post.mockResolvedValue({ id: "p1", status: "CANCELLED" });
    const result = await insuranceApi.cancelPolicy("p1");
    expect(mockApi.post).toHaveBeenCalledWith("/insurance/policies/p1/cancel");
    expect(result.status).toBe("CANCELLED");
  });

  // ====== Claims ======
  it("getMyClaims calls GET /insurance/claims/me", async () => {
    mockApi.get.mockResolvedValue({ data: [], pagination: { total: 0 } });
    await insuranceApi.getMyClaims({ status: "SUBMITTED" });
    expect(mockApi.get).toHaveBeenCalledWith("/insurance/claims/me", {
      params: { status: "SUBMITTED" },
    });
  });

  it("getClaim calls GET /insurance/claims/:id", async () => {
    mockApi.get.mockResolvedValue({ id: "c1" });
    await insuranceApi.getClaim("c1");
    expect(mockApi.get).toHaveBeenCalledWith("/insurance/claims/c1");
  });

  it("submitClaim calls POST /insurance/claims", async () => {
    const claimData = {
      policyId: "p1",
      claimAmount: 5000,
      description: "Window damage",
      incidentDate: "2025-06-01",
      incidentType: "DAMAGE" as const,
    };
    mockApi.post.mockResolvedValue({ id: "c1", ...claimData });
    await insuranceApi.submitClaim(claimData);
    expect(mockApi.post).toHaveBeenCalledWith("/insurance/claims", claimData);
  });

  it("addClaimEvidence calls POST /insurance/claims/:id/evidence", async () => {
    const evidence = { type: "IMAGE" as const, url: "https://img.np/ev.jpg", description: "Damage photo" };
    mockApi.post.mockResolvedValue({ id: "c1" });
    await insuranceApi.addClaimEvidence("c1", evidence);
    expect(mockApi.post).toHaveBeenCalledWith("/insurance/claims/c1/evidence", evidence);
  });

  // ====== Stats & Recommendations ======
  it("getInsuranceStats calls GET /insurance/stats", async () => {
    mockApi.get.mockResolvedValue({ activePolicies: 10, totalCoverage: 500000 });
    const result = await insuranceApi.getInsuranceStats();
    expect(mockApi.get).toHaveBeenCalledWith("/insurance/stats");
    expect(result.activePolicies).toBe(10);
  });

  it("getCoverageRecommendations calls GET /insurance/recommendations/:listingId", async () => {
    mockApi.get.mockResolvedValue({ recommended: "STANDARD", reason: "High value item" });
    await insuranceApi.getCoverageRecommendations("l1");
    expect(mockApi.get).toHaveBeenCalledWith("/insurance/recommendations/l1");
  });
});
