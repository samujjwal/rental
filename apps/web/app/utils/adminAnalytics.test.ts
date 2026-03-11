import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock adminApi
const { mockAdminApi } = vi.hoisted(() => ({
  mockAdminApi: {
    getDashboardStats: vi.fn(),
    getAnalytics: vi.fn(),
  },
}));

vi.mock('~/lib/api/admin', () => ({
  adminApi: mockAdminApi,
}));

import { getAdminAnalytics, type AdminAnalyticsPayload } from './adminAnalytics';

const mockDashboard = {
  activeListings: 42,
  pendingBookings: 5,
  pendingDisputes: 3,
  flaggedContent: 2,
};

const mockAnalytics = {
  userGrowth: [
    { date: '2025-01-01', count: 10 },
    { date: '2025-01-02', count: 15 },
  ],
  bookingTrends: [
    { date: '2025-01-01', count: 3, revenue: 1500 },
    { date: '2025-01-02', count: 5, revenue: 2500 },
  ],
  revenueByCategory: [
    { category: 'Electronics', revenue: 2000 },
    { category: 'Vehicles', revenue: 3000 },
  ],
};

describe('getAdminAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminApi.getDashboardStats.mockResolvedValue(mockDashboard);
    mockAdminApi.getAnalytics.mockResolvedValue(mockAnalytics);
  });

  it('returns payload with correct range', async () => {
    const result = await getAdminAnalytics(new Request('http://test'), '30d');
    expect(result.range).toBe('30d');
  });

  it('defaults to 30d range', async () => {
    const result = await getAdminAnalytics(new Request('http://test'));
    expect(result.range).toBe('30d');
  });

  it('includes generatedAt timestamp', async () => {
    const result = await getAdminAnalytics(new Request('http://test'));
    expect(result.generatedAt).toBeTruthy();
    expect(new Date(result.generatedAt).getTime()).not.toBeNaN();
  });

  it('computes KPIs from API data', async () => {
    const result = await getAdminAnalytics(new Request('http://test'));
    const kpis = result.summary.kpis;
    expect(kpis.length).toBe(5);

    const newUsersKpi = kpis.find((k) => k.id === 'activeUsers');
    expect(newUsersKpi?.value).toBe(25); // 10 + 15

    const listingsKpi = kpis.find((k) => k.id === 'listings');
    expect(listingsKpi?.value).toBe(42);

    const revenueKpi = kpis.find((k) => k.id === 'revenue');
    expect(revenueKpi?.value).toBe(4000); // 1500 + 2500
  });

  it('computes booking summary', async () => {
    const result = await getAdminAnalytics(new Request('http://test'));
    expect(result.summary.bookings.total).toBe(8); // 3 + 5
    expect(result.summary.bookings.disputes).toBe(3);
  });

  it('computes revenue summary', async () => {
    const result = await getAdminAnalytics(new Request('http://test'));
    expect(result.summary.revenue.gross).toBe(4000);
    expect(result.summary.revenue.net).toBe(4000);
  });

  it('computes operations summary', async () => {
    const result = await getAdminAnalytics(new Request('http://test'));
    expect(result.summary.operations.openDisputes).toBe(3);
    expect(result.summary.operations.moderationBacklog).toBe(2);
  });

  it('builds trends from booking trends', async () => {
    const result = await getAdminAnalytics(new Request('http://test'));
    expect(result.trends.length).toBe(2);
    expect(result.trends[0].date).toBe('2025-01-01');
    expect(result.trends[0].bookings).toBe(3);
    expect(result.trends[0].revenue).toBe(1500);
  });

  it('builds topCategories from revenue data', async () => {
    const result = await getAdminAnalytics(new Request('http://test'));
    expect(result.topCategories.length).toBe(2);
    expect(result.topCategories[0].category).toBe('Electronics');
    expect(result.topCategories[0].revenue).toBe(2000);
  });

  it('creates dispute alert when disputes > 0', async () => {
    const result = await getAdminAnalytics(new Request('http://test'));
    const disputeAlert = result.alerts.find((a) => a.id === 'disputes');
    expect(disputeAlert).toBeDefined();
    expect(disputeAlert?.severity).toBe('warning');
    expect(disputeAlert?.action?.to).toBe('/admin/disputes');
  });

  it('creates flagged alert when flaggedContent > 0', async () => {
    const result = await getAdminAnalytics(new Request('http://test'));
    const flaggedAlert = result.alerts.find((a) => a.id === 'flagged');
    expect(flaggedAlert).toBeDefined();
    expect(flaggedAlert?.severity).toBe('info');
  });

  it('does not create alerts when no issues', async () => {
    mockAdminApi.getDashboardStats.mockResolvedValue({
      activeListings: 10,
      pendingBookings: 0,
      pendingDisputes: 0,
      flaggedContent: 0,
    });
    const result = await getAdminAnalytics(new Request('http://test'));
    expect(result.alerts.length).toBe(0);
  });

  it('handles empty analytics safely', async () => {
    mockAdminApi.getAnalytics.mockResolvedValue({});
    const result = await getAdminAnalytics(new Request('http://test'));
    expect(result.trends.length).toBe(0);
    expect(result.topCategories.length).toBe(0);
    expect(result.summary.kpis.find((k) => k.id === 'activeUsers')?.value).toBe(0);
  });

  it('handles NaN values safely', async () => {
    mockAdminApi.getDashboardStats.mockResolvedValue({
      activeListings: 'not-a-number',
    });
    mockAdminApi.getAnalytics.mockResolvedValue({
      userGrowth: [{ count: undefined }],
    });
    const result = await getAdminAnalytics(new Request('http://test'));
    expect(result.summary.kpis.find((k) => k.id === 'listings')?.value).toBe(0);
  });

  it('supports 7d range', async () => {
    const result = await getAdminAnalytics(new Request('http://test'), '7d');
    expect(result.range).toBe('7d');
  });

  it('supports 90d range', async () => {
    const result = await getAdminAnalytics(new Request('http://test'), '90d');
    expect(result.range).toBe('90d');
  });

  it('supports 365d range', async () => {
    const result = await getAdminAnalytics(new Request('http://test'), '365d');
    expect(result.range).toBe('365d');
  });

  it('returns empty funnel, regions, channels, userSegments', async () => {
    const result = await getAdminAnalytics(new Request('http://test'));
    expect(result.funnel).toEqual([]);
    expect(result.regions).toEqual([]);
    expect(result.channels).toEqual([]);
    expect(result.userSegments).toEqual([]);
  });
});
