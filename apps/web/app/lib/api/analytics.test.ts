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

import { analyticsApi } from "~/lib/api/analytics";

describe("analyticsApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getPerformanceMetrics calls GET /analytics/performance with period param", async () => {
    const metrics = { overview: { totalViews: 1000 } };
    mockApi.get.mockResolvedValue(metrics);
    const result = await analyticsApi.getPerformanceMetrics("month");
    expect(mockApi.get).toHaveBeenCalledWith("/analytics/performance", {
      params: { period: "month" },
    });
    expect(result).toEqual(metrics);
  });

  it("getPerformanceMetrics works without period", async () => {
    mockApi.get.mockResolvedValue({});
    await analyticsApi.getPerformanceMetrics();
    expect(mockApi.get).toHaveBeenCalledWith("/analytics/performance", {
      params: { period: undefined },
    });
  });

  it("getInsights calls GET /analytics/insights", async () => {
    const insights = { score: 85, insights: [] };
    mockApi.get.mockResolvedValue(insights);
    const result = await analyticsApi.getInsights();
    expect(mockApi.get).toHaveBeenCalledWith("/analytics/insights");
    expect(result.score).toBe(85);
  });

  it("getListingAnalytics calls GET /analytics/listings/:id", async () => {
    const data = { views: 500, bookings: 20, revenue: 10000 };
    mockApi.get.mockResolvedValue(data);
    const result = await analyticsApi.getListingAnalytics("l1");
    expect(mockApi.get).toHaveBeenCalledWith("/analytics/listings/l1");
    expect(result.views).toBe(500);
  });

  it("getRevenueReport calls GET /analytics/revenue with date params", async () => {
    const params = { startDate: "2025-01-01", endDate: "2025-06-30", groupBy: "month" as const };
    mockApi.get.mockResolvedValue({ total: 50000, data: [] });
    await analyticsApi.getRevenueReport(params);
    expect(mockApi.get).toHaveBeenCalledWith("/analytics/revenue", { params });
  });

  it("getCustomerAnalytics calls GET /analytics/customers", async () => {
    const data = { totalCustomers: 200, repeatCustomers: 50, newCustomers: 30, segments: [] };
    mockApi.get.mockResolvedValue(data);
    const result = await analyticsApi.getCustomerAnalytics();
    expect(mockApi.get).toHaveBeenCalledWith("/analytics/customers");
    expect(result.totalCustomers).toBe(200);
  });
});
