import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("~/lib/api-client", () => ({
  api: mockApi,
  apiClient: mockApi,
}));

import { disputesApi } from "~/lib/api/disputes";

describe("disputesApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getDisputeById", async () => {
    mockApi.get.mockResolvedValue({ id: "d1" });
    const result = await disputesApi.getDisputeById("d1");
    expect(mockApi.get).toHaveBeenCalledWith("/disputes/d1");
    expect(result.id).toBe("d1");
  });

  it("getDisputesForBooking", async () => {
    mockApi.get.mockResolvedValue([]);
    await disputesApi.getDisputesForBooking("b1");
    expect(mockApi.get).toHaveBeenCalledWith("/bookings/b1/disputes");
  });

  it("getMyDisputes without params", async () => {
    mockApi.get.mockResolvedValue({ disputes: [], total: 0 });
    await disputesApi.getMyDisputes();
    expect(mockApi.get).toHaveBeenCalledWith("/disputes", { params: undefined });
  });

  it("getMyDisputes with status filter", async () => {
    mockApi.get.mockResolvedValue({ disputes: [], total: 0 });
    await disputesApi.getMyDisputes({ status: "OPEN", page: 1, limit: 10 });
    expect(mockApi.get).toHaveBeenCalledWith("/disputes", {
      params: { status: "OPEN", page: 1, limit: 10 },
    });
  });

  it("createDispute", async () => {
    const data = {
      bookingId: "b1",
      type: "PROPERTY_DAMAGE" as const,
      title: "Broken item",
      description: "Item was returned damaged",
    };
    mockApi.post.mockResolvedValue({ id: "d1" });
    await disputesApi.createDispute(data);
    expect(mockApi.post).toHaveBeenCalledWith("/disputes", data);
  });

  it("addEvidence posts to /disputes/:id/responses", async () => {
    mockApi.post.mockResolvedValue({ id: "r1" });
    await disputesApi.addEvidence("d1", {
      type: "photo",
      url: "https://cdn.np/evidence.jpg",
      description: "Photo of damage",
    });
    expect(mockApi.post).toHaveBeenCalledWith("/disputes/d1/responses", {
      message: "Photo of damage",
      evidence: ["https://cdn.np/evidence.jpg"],
    });
  });

  it("addEvidence uses default message when no description", async () => {
    mockApi.post.mockResolvedValue({ id: "r1" });
    await disputesApi.addEvidence("d1", {
      type: "document",
      url: "https://cdn.np/doc.pdf",
    });
    expect(mockApi.post).toHaveBeenCalledWith("/disputes/d1/responses", {
      message: "Evidence submitted",
      evidence: ["https://cdn.np/doc.pdf"],
    });
  });

  it("respondToDispute", async () => {
    mockApi.post.mockResolvedValue({ id: "r2" });
    await disputesApi.respondToDispute("d1", "My response text");
    expect(mockApi.post).toHaveBeenCalledWith("/disputes/d1/responses", {
      message: "My response text",
    });
  });

  it("closeDispute", async () => {
    mockApi.post.mockResolvedValue({ id: "d1", status: "CLOSED" });
    await disputesApi.closeDispute("d1", "Resolved mutually");
    expect(mockApi.post).toHaveBeenCalledWith("/disputes/d1/close", { reason: "Resolved mutually" });
  });
});
