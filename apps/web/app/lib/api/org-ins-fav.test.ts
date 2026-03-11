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

import { organizationsApi } from "./organizations";
import { insuranceApi } from "./insurance";
import { getFavorites, addFavorite, removeFavorite, isFavorited, getFavoritesCount, toggleFavorite } from "./favorites";

describe("organizationsApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getMyOrganizations fetches list", async () => {
    mockApi.get.mockResolvedValue({ organizations: [] });
    await organizationsApi.getMyOrganizations();
    expect(mockApi.get).toHaveBeenCalledWith("/organizations/my");
  });

  it("getOrganization fetches by id", async () => {
    mockApi.get.mockResolvedValue({ id: "o1" });
    await organizationsApi.getOrganization("o1");
    expect(mockApi.get).toHaveBeenCalledWith("/organizations/o1");
  });

  it("createOrganization posts data", async () => {
    mockApi.post.mockResolvedValue({ id: "o1" });
    await organizationsApi.createOrganization({ name: "Test Org" } as any);
    expect(mockApi.post).toHaveBeenCalledWith("/organizations", expect.objectContaining({ name: "Test Org" }));
  });

  it("updateOrganization puts data", async () => {
    mockApi.put.mockResolvedValue({ id: "o1" });
    await organizationsApi.updateOrganization("o1", { name: "Updated" } as any);
    expect(mockApi.put).toHaveBeenCalledWith("/organizations/o1", expect.objectContaining({ name: "Updated" }));
  });

  it("deactivateOrganization sends delete", async () => {
    mockApi.delete.mockResolvedValue(undefined);
    await organizationsApi.deactivateOrganization("o1");
    expect(mockApi.delete).toHaveBeenCalledWith("/organizations/o1");
  });

  it("getMembers fetches org members", async () => {
    mockApi.get.mockResolvedValue({ members: [] });
    await organizationsApi.getMembers("o1");
    expect(mockApi.get).toHaveBeenCalledWith("/organizations/o1/members");
  });

  it("inviteMember posts invite", async () => {
    mockApi.post.mockResolvedValue({ id: "m1" });
    await organizationsApi.inviteMember("o1", { email: "u@t.np", role: "MEMBER" } as any);
    expect(mockApi.post).toHaveBeenCalledWith("/organizations/o1/members", expect.objectContaining({ email: "u@t.np" }));
  });

  it("updateMemberRole puts role change", async () => {
    mockApi.put.mockResolvedValue({ id: "m1" });
    await organizationsApi.updateMemberRole("o1", "m1", { role: "ADMIN" } as any);
    expect(mockApi.put).toHaveBeenCalledWith("/organizations/o1/members/m1/role", expect.objectContaining({ role: "ADMIN" }));
  });

  it("removeMember sends delete", async () => {
    mockApi.delete.mockResolvedValue(undefined);
    await organizationsApi.removeMember("o1", "u2");
    expect(mockApi.delete).toHaveBeenCalledWith("/organizations/o1/members/u2");
  });

  it("acceptInvitation posts token", async () => {
    mockApi.post.mockResolvedValue({ success: true });
    await organizationsApi.acceptInvitation("tok123");
    expect(mockApi.post).toHaveBeenCalledWith("/organizations/invitations/accept", expect.objectContaining({}));
  });

  it("getOrganizationStats fetches stats", async () => {
    mockApi.get.mockResolvedValue({ memberCount: 5 });
    await organizationsApi.getOrganizationStats("o1");
    expect(mockApi.get).toHaveBeenCalledWith("/organizations/o1/stats");
  });
});

describe("insuranceApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getListingRequirement fetches by listing", async () => {
    mockApi.get.mockResolvedValue({ required: true });
    await insuranceApi.getListingRequirement("l1");
    expect(mockApi.get).toHaveBeenCalledWith("/insurance/listings/l1/requirement");
  });

  it("uploadPolicy posts policy data", async () => {
    mockApi.post.mockResolvedValue({ id: "p1" });
    await insuranceApi.uploadPolicy({ policyNumber: "POL-1" } as any);
    expect(mockApi.post).toHaveBeenCalledWith("/insurance/policies", expect.any(Object));
  });

  it("getMyPolicies fetches user policies", async () => {
    mockApi.get.mockResolvedValue({ policies: [] });
    await insuranceApi.getMyPolicies();
    expect(mockApi.get).toHaveBeenCalledWith("/insurance/policies/me", expect.anything());
  });

  it("getPolicy fetches by id", async () => {
    mockApi.get.mockResolvedValue({ id: "p1" });
    await insuranceApi.getPolicy("p1");
    expect(mockApi.get).toHaveBeenCalledWith("/insurance/policies/p1");
  });

  it("getPolicyByBooking fetches by booking", async () => {
    mockApi.get.mockResolvedValue({ id: "p1" });
    await insuranceApi.getPolicyByBooking("b1");
    expect(mockApi.get).toHaveBeenCalledWith("/insurance/policies/booking/b1");
  });

  it("getQuotes fetches quotes", async () => {
    mockApi.get.mockResolvedValue([]);
    await insuranceApi.getQuotes("b1");
    expect(mockApi.get).toHaveBeenCalledWith("/insurance/quotes", { params: { bookingId: "b1" } });
  });

  it("purchaseInsurance posts purchase", async () => {
    mockApi.post.mockResolvedValue({ id: "p1" });
    await insuranceApi.purchaseInsurance("b1", "BASIC");
    expect(mockApi.post).toHaveBeenCalledWith("/insurance/policies", expect.any(Object));
  });

  it("cancelPolicy posts cancellation", async () => {
    mockApi.post.mockResolvedValue({ id: "p1" });
    await insuranceApi.cancelPolicy("p1");
    expect(mockApi.post).toHaveBeenCalledWith("/insurance/policies/p1/cancel");
  });

  it("getMyClaims fetches claims", async () => {
    mockApi.get.mockResolvedValue({ claims: [] });
    await insuranceApi.getMyClaims();
    expect(mockApi.get).toHaveBeenCalledWith("/insurance/claims/me", expect.anything());
  });

  it("submitClaim posts claim data", async () => {
    mockApi.post.mockResolvedValue({ id: "c1" });
    await insuranceApi.submitClaim({ policyId: "p1", reason: "Damage" } as any);
    expect(mockApi.post).toHaveBeenCalledWith("/insurance/claims", expect.any(Object));
  });

  it("getInsuranceStats fetches stats", async () => {
    mockApi.get.mockResolvedValue({ totalPolicies: 10 });
    await insuranceApi.getInsuranceStats();
    expect(mockApi.get).toHaveBeenCalledWith("/insurance/stats");
  });

  it("getCoverageRecommendations fetches by listing", async () => {
    mockApi.get.mockResolvedValue({ recommended: "PREMIUM" });
    await insuranceApi.getCoverageRecommendations("l1");
    expect(mockApi.get).toHaveBeenCalledWith("/insurance/recommendations/l1");
  });
});

describe("favorites (standalone functions)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getFavorites fetches list", async () => {
    mockApi.get.mockResolvedValue({ favorites: [] });
    await getFavorites();
    expect(mockApi.get).toHaveBeenCalledWith("/favorites", expect.anything());
  });

  it("addFavorite posts listing id", async () => {
    mockApi.post.mockResolvedValue({ id: "f1" });
    await addFavorite({ listingId: "l1" });
    expect(mockApi.post).toHaveBeenCalledWith("/favorites", expect.objectContaining({ listingId: "l1" }));
  });

  it("removeFavorite deletes by listing id", async () => {
    mockApi.delete.mockResolvedValue(undefined);
    await removeFavorite({ listingId: "l1" });
    expect(mockApi.delete).toHaveBeenCalledWith("/favorites/l1");
  });

  it("getFavoritesCount fetches count", async () => {
    mockApi.get.mockResolvedValue({ count: 5 });
    await getFavoritesCount();
    expect(mockApi.get).toHaveBeenCalledWith("/favorites/count");
  });

  it("isFavorited checks listing", async () => {
    mockApi.get.mockResolvedValue({ id: "f1" });
    const result = await isFavorited("l1");
    expect(mockApi.get).toHaveBeenCalledWith("/favorites/listing/l1");
    expect(result).toBe(true);
  });

  it("isFavorited returns false when not found", async () => {
    mockApi.get.mockRejectedValue(new Error("not found"));
    const result = await isFavorited("l1");
    expect(result).toBe(false);
  });

  it("toggleFavorite adds when not favorited", async () => {
    // getFavoriteByListingId returns null on 404 → not favorited
    mockApi.get.mockRejectedValueOnce({ response: { status: 404 } });
    // addFavorite succeeds
    mockApi.post.mockResolvedValue({ id: "f1", listingId: "l1" });
    const result = await toggleFavorite("l1");
    expect(mockApi.post).toHaveBeenCalledWith("/favorites", expect.objectContaining({ listingId: "l1" }));
    expect(result.isFavorited).toBe(true);
  });
});
