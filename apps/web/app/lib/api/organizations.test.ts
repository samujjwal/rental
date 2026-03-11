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

import { organizationsApi } from "~/lib/api/organizations";

describe("organizationsApi", () => {
  beforeEach(() => vi.clearAllMocks());

  // ====== Organization CRUD ======
  it("getMyOrganizations calls GET /organizations/my", async () => {
    mockApi.get.mockResolvedValue({ organizations: [], total: 0 });
    const result = await organizationsApi.getMyOrganizations();
    expect(mockApi.get).toHaveBeenCalledWith("/organizations/my");
    expect(result).toEqual({ organizations: [], total: 0 });
  });

  it("getOrganization calls GET /organizations/:id", async () => {
    mockApi.get.mockResolvedValue({ id: "org1", name: "Test Org" });
    const result = await organizationsApi.getOrganization("org1");
    expect(mockApi.get).toHaveBeenCalledWith("/organizations/org1");
    expect(result.name).toBe("Test Org");
  });

  it("createOrganization calls POST /organizations", async () => {
    const data = {
      name: "My Org",
      businessType: "LLC" as const,
      email: "org@test.np",
    };
    mockApi.post.mockResolvedValue({ id: "org1", ...data });
    await organizationsApi.createOrganization(data);
    expect(mockApi.post).toHaveBeenCalledWith("/organizations", data);
  });

  it("updateOrganization calls PUT /organizations/:id", async () => {
    const data = { name: "Updated Org", description: "New desc" };
    mockApi.put.mockResolvedValue({ id: "org1", ...data });
    await organizationsApi.updateOrganization("org1", data);
    expect(mockApi.put).toHaveBeenCalledWith("/organizations/org1", data);
  });

  it("deactivateOrganization calls DELETE /organizations/:id", async () => {
    mockApi.delete.mockResolvedValue(undefined);
    await organizationsApi.deactivateOrganization("org1");
    expect(mockApi.delete).toHaveBeenCalledWith("/organizations/org1");
  });

  // ====== Member Management ======
  it("getMembers calls GET /organizations/:id/members", async () => {
    mockApi.get.mockResolvedValue({ members: [], total: 0 });
    await organizationsApi.getMembers("org1");
    expect(mockApi.get).toHaveBeenCalledWith("/organizations/org1/members");
  });

  it("inviteMember calls POST /organizations/:id/members", async () => {
    const invite = { email: "new@test.np", role: "MEMBER" as const };
    mockApi.post.mockResolvedValue({ message: "Invited", invitationId: "inv1" });
    const result = await organizationsApi.inviteMember("org1", invite);
    expect(mockApi.post).toHaveBeenCalledWith("/organizations/org1/members", invite);
    expect(result.invitationId).toBe("inv1");
  });

  it("updateMemberRole calls PUT /organizations/:orgId/members/:memberId/role", async () => {
    const roleData = { role: "ADMIN" as const };
    mockApi.put.mockResolvedValue({ id: "m1", role: "ADMIN" });
    await organizationsApi.updateMemberRole("org1", "m1", roleData);
    expect(mockApi.put).toHaveBeenCalledWith(
      "/organizations/org1/members/m1/role",
      roleData
    );
  });

  it("removeMember calls DELETE /organizations/:orgId/members/:userId", async () => {
    mockApi.delete.mockResolvedValue(undefined);
    await organizationsApi.removeMember("org1", "u1");
    expect(mockApi.delete).toHaveBeenCalledWith("/organizations/org1/members/u1");
  });

  // ====== Invitations ======
  it("acceptInvitation calls POST /organizations/invitations/accept", async () => {
    mockApi.post.mockResolvedValue({ id: "org1", name: "Test Org" });
    await organizationsApi.acceptInvitation("token-123");
    expect(mockApi.post).toHaveBeenCalledWith("/organizations/invitations/accept", {
      token: "token-123",
    });
  });

  it("declineInvitation calls POST /organizations/invitations/decline", async () => {
    mockApi.post.mockResolvedValue(undefined);
    await organizationsApi.declineInvitation("token-456");
    expect(mockApi.post).toHaveBeenCalledWith("/organizations/invitations/decline", {
      token: "token-456",
    });
  });

  // ====== Stats ======
  it("getOrganizationStats calls GET /organizations/:id/stats", async () => {
    const stats = {
      totalListings: 10,
      activeListings: 8,
      totalBookings: 50,
      totalRevenue: 250000,
      pendingPayouts: 5000,
      averageRating: 4.5,
    };
    mockApi.get.mockResolvedValue(stats);
    const result = await organizationsApi.getOrganizationStats("org1");
    expect(mockApi.get).toHaveBeenCalledWith("/organizations/org1/stats");
    expect(result).toEqual(stats);
  });

  // ====== Logo Upload ======
  it("uploadLogo sends FormData via POST /storage/organization-logo", async () => {
    const file = new File(["logo"], "logo.png", { type: "image/png" });
    mockApi.post.mockResolvedValue({ url: "https://storage.np/logo.png" });
    const result = await organizationsApi.uploadLogo("org1", file);
    expect(mockApi.post).toHaveBeenCalledWith(
      "/storage/organization-logo",
      expect.any(FormData),
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    expect(result.url).toBe("https://storage.np/logo.png");
  });
});
