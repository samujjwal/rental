/**
 * Search Analytics Interfaces
 * 
 * Defines types and interfaces for search analytics functionality
 */

export interface SearchQuery {
  id: string;
  userId?: string;
  query: string;
  filters: SearchFilters;
  resultsCount: number;
  clickedResults: string[];
  searchDuration: number;
  createdAt: Date;
  sessionId: string;
}

export interface SearchFilters {
  location?: string;
  category?: string;
  priceMin?: number;
  priceMax?: number;
  dateFrom?: Date;
  dateTo?: Date;
  amenities?: string[];
  rating?: number;
  [key: string]: unknown;
}

export interface SearchAnalyticsMetrics {
  totalSearches: number;
  uniqueQueries: number;
  averageResultsCount: number;
  clickThroughRate: number;
  averageSearchDuration: number;
  topQueries: TopQuery[];
  trendingQueries: TrendingQuery[];
  searchPerformance: SearchPerformanceMetrics;
  userBehavior: UserBehaviorMetrics;
  searchQuality: SearchQualityMetrics;
}

export interface TopQuery {
  query: string;
  count: number;
  clickThroughRate: number;
}

export interface TrendingQuery {
  query: string;
  growthRate: number;
  currentCount: number;
  previousCount: number;
}

export interface SearchPerformanceMetrics {
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  cacheHitRate: number;
}

export interface UserBehaviorMetrics {
  searchesPerUser: number;
  averageSessionSearches: number;
  conversionRate: number;
  bounceRate: number;
  refinementRate: number;
}

export interface SearchQualityMetrics {
  relevanceScore: number;
  diversityScore: number;
  coverageScore: number;
  userSatisfaction: number;
}

export interface SearchAnalyticsDashboard {
  period: string;
  startDate: Date;
  endDate: Date;
  metrics: SearchAnalyticsMetrics;
  popularSearches: PopularSearch[];
  searchTrends: SearchTrend[];
  geographicDistribution: GeographicStats[];
  deviceBreakdown: DeviceStats[];
}

export interface PopularSearch {
  query: string;
  count: number;
  conversionRate: number;
  avgBookingValue: number;
}

export interface SearchTrend {
  date: Date;
  totalSearches: number;
  uniqueQueries: number;
  clickThroughRate: number;
}

export interface GeographicStats {
  region: string;
  searchCount: number;
  userCount: number;
  conversionRate: number;
}

export interface DeviceStats {
  deviceType: string;
  searchCount: number;
  percentage: number;
  avgResponseTime: number;
}

export interface SearchRankingFactors {
  relevance: number;
  popularity: number;
  recency: number;
  location: number;
  rating: number;
  price: number;
  availability: number;
}

export interface RealtimeSearchAnalytics {
  currentQueries: number;
  queriesPerSecond: number;
  activeUsers: number;
  topQueriesNow: string[];
  performanceHealth: 'healthy' | 'degraded' | 'critical';
}

export interface SearchInsight {
  type: 'trend' | 'anomaly' | 'opportunity' | 'warning';
  title: string;
  description: string;
  metric: string;
  change: number;
  recommendation: string;
  severity: 'low' | 'medium' | 'high';
}
