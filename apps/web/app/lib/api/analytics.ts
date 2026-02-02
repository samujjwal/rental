import { api } from "~/lib/api-client";

export interface PerformanceMetrics {
  overview: {
    totalViews: number;
    viewsChange: number;
    totalBookings: number;
    bookingsChange: number;
    conversionRate: number;
    conversionChange: number;
    averageRating: number;
    ratingChange: number;
  };
  earnings: {
    total: number;
    thisMonth: number;
    lastMonth: number;
    change: number;
  };
  topListings: Array<{
    id: string;
    title: string;
    views: number;
    bookings: number;
    revenue: number;
    rating: number;
  }>;
  monthlyData: Array<{
    month: string;
    views: number;
    bookings: number;
    revenue: number;
  }>;
  responseMetrics: {
    averageResponseTime: number;
    responseRate: number;
    acceptanceRate: number;
  };
}

export interface InsightData {
  score: number;
  insights: Array<{
    id: string;
    type: "opportunity" | "warning" | "success";
    title: string;
    description: string;
    impact: string;
    action: string;
    actionUrl: string;
  }>;
  seasonalTrends: Array<{
    period: string;
    demand: "high" | "medium" | "low";
    recommendation: string;
  }>;
  competitorAnalysis: {
    averagePrice: number;
    yourPrice: number;
    pricePosition: "below" | "at" | "above";
    recommendation: string;
  };
  customerSegments: Array<{
    segment: string;
    percentage: number;
    trend: "up" | "down" | "stable";
    description: string;
  }>;
  optimizations: Array<{
    area: string;
    current: number;
    target: number;
    tips: string[];
  }>;
}

export const analyticsApi = {
  async getPerformanceMetrics(period?: string): Promise<PerformanceMetrics> {
    return api.get<PerformanceMetrics>("/analytics/performance", { params: { period } });
  },

  async getInsights(): Promise<InsightData> {
    return api.get<InsightData>("/analytics/insights");
  },

  async getListingAnalytics(listingId: string): Promise<{
    views: number;
    bookings: number;
    revenue: number;
    conversionRate: number;
    averageRating: number;
    dailyViews: Array<{ date: string; views: number }>;
  }> {
    return api.get(`/analytics/listings/${listingId}`);
  },

  async getRevenueReport(params: {
    startDate: string;
    endDate: string;
    groupBy?: "day" | "week" | "month";
  }): Promise<{
    total: number;
    data: Array<{ period: string; revenue: number; bookings: number }>;
  }> {
    return api.get("/analytics/revenue", { params });
  },

  async getCustomerAnalytics(): Promise<{
    totalCustomers: number;
    repeatCustomers: number;
    newCustomers: number;
    segments: Array<{
      name: string;
      count: number;
      percentage: number;
    }>;
  }> {
    return api.get("/analytics/customers");
  },
};
