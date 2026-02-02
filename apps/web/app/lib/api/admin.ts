import { api } from "~/lib/api-client";

// ============= Dashboard Types =============
export interface DashboardStats {
  totalUsers: number;
  newUsersToday: number;
  activeListings: number;
  totalBookings: number;
  pendingBookings: number;
  totalRevenue: number;
  pendingDisputes: number;
  flaggedContent: number;
}

export interface AnalyticsData {
  period: string;
  userGrowth: { date: string; count: number }[];
  bookingTrends: { date: string; count: number; revenue: number }[];
  revenueByCategory: { category: string; revenue: number }[];
  topListings: { id: string; title: string; bookings: number; revenue: number }[];
}

// ============= User Management Types =============
export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  role: "USER" | "HOST" | "ADMIN" | "SUPER_ADMIN";
  status: "ACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION" | "DEACTIVATED";
  emailVerified: boolean;
  phoneVerified: boolean;
  identityVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  _count?: {
    listings: number;
    bookingsAsRenter: number;
    bookingsAsOwner: number;
  };
}

export interface UsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
}

// ============= Listing Management Types =============
export interface AdminListing {
  id: string;
  title: string;
  status: string;
  categoryId: string;
  ownerId: string;
  basePrice: number;
  currency: string;
  moderationStatus: string;
  createdAt: string;
  owner: {
    id: string;
    email: string;
    firstName: string;
    lastName: string | null;
  };
  category: {
    id: string;
    name: string;
  };
}

export interface ListingsResponse {
  listings: AdminListing[];
  total: number;
  page: number;
  limit: number;
}

// ============= Booking Management Types =============
export interface AdminBooking {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  totalPrice: number;
  currency: string;
  createdAt: string;
  listing: {
    id: string;
    title: string;
  };
  renter: {
    id: string;
    email: string;
    firstName: string;
    lastName: string | null;
  };
  owner: {
    id: string;
    email: string;
    firstName: string;
    lastName: string | null;
  };
}

export interface BookingsResponse {
  bookings: AdminBooking[];
  total: number;
  page: number;
  limit: number;
}

// ============= Payment Types =============
export interface AdminPayment {
  id: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  stripePaymentId: string | null;
  createdAt: string;
  booking?: {
    id: string;
    listing: { title: string };
  };
  user?: {
    id: string;
    email: string;
    firstName: string;
  };
}

export interface PaymentsResponse {
  payments: AdminPayment[];
  total: number;
  page: number;
  limit: number;
}

// ============= Dispute Types =============
export interface AdminDispute {
  id: string;
  type: string;
  status: string;
  reason: string;
  amount: number | null;
  createdAt: string;
  booking: {
    id: string;
    listing: { title: string };
  };
  initiator: {
    id: string;
    email: string;
    firstName: string;
  };
}

export interface DisputesResponse {
  disputes: AdminDispute[];
  total: number;
  page: number;
  limit: number;
}

// ============= System Types =============
export interface SystemHealth {
  status: "healthy" | "degraded" | "unhealthy";
  services: {
    database: { status: string; latency: number };
    redis: { status: string; latency: number };
    elasticsearch: { status: string; latency: number };
    storage: { status: string; latency: number };
  };
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
    cores: number;
  };
}

export interface SystemBackup {
  id: string;
  type: "full" | "incremental";
  status: "pending" | "in_progress" | "completed" | "failed";
  size: number;
  createdAt: string;
  completedAt: string | null;
  downloadUrl?: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  userId: string;
  userEmail: string;
  metadata: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
}

export interface AuditLogsResponse {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
}

// ============= Settings Types =============
export interface SystemSettings {
  siteName: string;
  supportEmail: string;
  defaultCurrency: string;
  timezone: string;
  maintenanceMode: boolean;
  allowRegistration: boolean;
  requireEmailVerification: boolean;
  maxListingsPerUser: number;
  commissionRate: number;
  minRentalDays: number;
  maxRentalDays: number;
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  suffix: string;
  scopes: string[];
  status: "active" | "revoked" | "expired";
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
}

export interface EnvVariable {
  key: string;
  value: string;
  category: "database" | "auth" | "storage" | "email" | "api" | "other";
  sensitive: boolean;
  description?: string;
}

export const adminApi = {
  // ============= Dashboard =============
  async getDashboardStats(): Promise<DashboardStats> {
    return api.get<DashboardStats>("/admin/dashboard");
  },

  async getAnalytics(params?: {
    period?: "day" | "week" | "month" | "year";
    startDate?: string;
    endDate?: string;
  }): Promise<AnalyticsData> {
    const queryParams = new URLSearchParams();
    if (params?.period) queryParams.append("period", params.period);
    if (params?.startDate) queryParams.append("startDate", params.startDate);
    if (params?.endDate) queryParams.append("endDate", params.endDate);
    const query = queryParams.toString();
    return api.get<AnalyticsData>(`/admin/analytics${query ? `?${query}` : ""}`);
  },

  // ============= User Management =============
  async getUsers(params?: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }): Promise<UsersResponse> {
    const queryParams = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined) queryParams.append(key, String(value));
    });
    const query = queryParams.toString();
    return api.get<UsersResponse>(`/admin/users${query ? `?${query}` : ""}`);
  },

  async getUserById(id: string): Promise<AdminUser> {
    return api.get<AdminUser>(`/admin/users/${id}`);
  },

  async updateUserRole(id: string, role: AdminUser["role"]): Promise<AdminUser> {
    return api.patch<AdminUser>(`/admin/users/${id}/role`, { role });
  },

  async suspendUser(id: string, reason?: string): Promise<AdminUser> {
    return api.post<AdminUser>(`/admin/users/${id}/suspend`, { reason });
  },

  async activateUser(id: string): Promise<AdminUser> {
    return api.post<AdminUser>(`/admin/users/${id}/activate`);
  },

  async deleteUser(id: string): Promise<void> {
    return api.delete<void>(`/admin/users/${id}`);
  },

  // ============= Listing Management =============
  async getListings(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    categoryId?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }): Promise<ListingsResponse> {
    const queryParams = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined) queryParams.append(key, String(value));
    });
    const query = queryParams.toString();
    return api.get<ListingsResponse>(`/admin/listings${query ? `?${query}` : ""}`);
  },

  async getListingById(id: string): Promise<AdminListing> {
    return api.get<AdminListing>(`/admin/listings/${id}`);
  },

  async getPendingListings(): Promise<ListingsResponse> {
    return api.get<ListingsResponse>("/admin/listings/pending");
  },

  async updateListingStatus(
    id: string,
    status: string,
    reason?: string
  ): Promise<AdminListing> {
    return api.patch<AdminListing>(`/admin/listings/${id}/status`, {
      status,
      reason,
    });
  },

  async deleteListing(id: string): Promise<void> {
    return api.delete<void>(`/admin/listings/${id}`);
  },

  // ============= Booking Management =============
  async getBookings(params?: {
    page?: number;
    limit?: number;
    status?: string;
    startDate?: string;
    endDate?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }): Promise<BookingsResponse> {
    const queryParams = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined) queryParams.append(key, String(value));
    });
    const query = queryParams.toString();
    return api.get<BookingsResponse>(`/admin/bookings${query ? `?${query}` : ""}`);
  },

  async getBookingById(id: string): Promise<AdminBooking> {
    return api.get<AdminBooking>(`/admin/bookings/${id}`);
  },

  // ============= Payment Management =============
  async getPayments(params?: {
    page?: number;
    limit?: number;
    type?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<PaymentsResponse> {
    const queryParams = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined) queryParams.append(key, String(value));
    });
    const query = queryParams.toString();
    return api.get<PaymentsResponse>(`/admin/payments${query ? `?${query}` : ""}`);
  },

  async getRefunds(params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<PaymentsResponse> {
    const queryParams = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined) queryParams.append(key, String(value));
    });
    const query = queryParams.toString();
    return api.get<PaymentsResponse>(`/admin/refunds${query ? `?${query}` : ""}`);
  },

  async updateRefundStatus(id: string, status: string): Promise<AdminPayment> {
    return api.patch<AdminPayment>(`/admin/refunds/${id}/status`, { status });
  },

  async getPayouts(params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<PaymentsResponse> {
    const queryParams = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined) queryParams.append(key, String(value));
    });
    const query = queryParams.toString();
    return api.get<PaymentsResponse>(`/admin/payouts${query ? `?${query}` : ""}`);
  },

  // ============= Dispute Management =============
  async getDisputes(params?: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
  }): Promise<DisputesResponse> {
    const queryParams = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined) queryParams.append(key, String(value));
    });
    const query = queryParams.toString();
    return api.get<DisputesResponse>(`/admin/disputes${query ? `?${query}` : ""}`);
  },

  async updateDisputeStatus(
    id: string,
    status: string,
    resolution?: string
  ): Promise<AdminDispute> {
    return api.patch<AdminDispute>(`/admin/disputes/${id}/status`, {
      status,
      resolution,
    });
  },

  async resolveDispute(
    id: string,
    data: { resolution: string; notes?: string }
  ): Promise<AdminDispute> {
    return api.post<AdminDispute>(`/admin/disputes/${id}/resolve`, data);
  },

  async assignDispute(id: string, assigneeId?: string): Promise<AdminDispute> {
    return api.post<AdminDispute>(`/admin/disputes/${id}/assign`, { assigneeId });
  },

  // ============= Review Management =============
  async getReviews(params?: {
    page?: number;
    limit?: number;
    status?: string;
    flagged?: boolean;
  }): Promise<{
    reviews: unknown[];
    total: number;
  }> {
    const queryParams = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined) queryParams.append(key, String(value));
    });
    const query = queryParams.toString();
    return api.get(`/admin/reviews${query ? `?${query}` : ""}`);
  },

  async updateReviewStatus(id: string, status: string): Promise<unknown> {
    return api.patch(`/admin/reviews/${id}/status`, { status });
  },

  // ============= System Operations =============
  async getSystemHealth(): Promise<SystemHealth> {
    return api.get<SystemHealth>("/admin/system/health");
  },

  async getSystemOverview(): Promise<{
    version: string;
    environment: string;
    nodeVersion: string;
    uptime: number;
    connections: number;
  }> {
    return api.get("/admin/system/overview");
  },

  async getDatabaseInfo(): Promise<{
    size: number;
    tables: { name: string; rows: number; size: number }[];
    connections: number;
  }> {
    return api.get("/admin/system/database");
  },

  async getBackups(): Promise<{ backups: SystemBackup[] }> {
    return api.get<{ backups: SystemBackup[] }>("/admin/system/backups");
  },

  async createBackup(type: "full" | "incremental"): Promise<SystemBackup> {
    return api.post<SystemBackup>("/admin/system/backups", { type });
  },

  async restoreBackup(backupId: string): Promise<{ message: string }> {
    return api.post<{ message: string }>(`/admin/system/backups/${backupId}/restore`);
  },

  async getAuditLogs(params?: {
    page?: number;
    limit?: number;
    action?: string;
    entity?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<AuditLogsResponse> {
    const queryParams = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined) queryParams.append(key, String(value));
    });
    const query = queryParams.toString();
    return api.get<AuditLogsResponse>(`/admin/system/audit${query ? `?${query}` : ""}`);
  },

  async getSystemLogs(params?: {
    level?: "error" | "warn" | "info" | "debug";
    search?: string;
    limit?: number;
  }): Promise<{
    logs: { timestamp: string; level: string; message: string; meta?: unknown }[];
  }> {
    const queryParams = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined) queryParams.append(key, String(value));
    });
    const query = queryParams.toString();
    return api.get(`/admin/system/logs${query ? `?${query}` : ""}`);
  },

  // ============= Settings =============
  async getGeneralSettings(): Promise<Record<string, unknown>> {
    return api.get("/admin/settings/general");
  },

  async updateGeneralSettings(settings: Record<string, unknown>): Promise<void> {
    return api.patch("/admin/settings/general", settings);
  },

  async getApiKeys(): Promise<{ keys: { id: string; name: string; lastUsed: string }[] }> {
    return api.get("/admin/settings/api-keys");
  },

  async getServiceStatus(): Promise<{
    services: { name: string; status: string; version: string }[];
  }> {
    return api.get("/admin/settings/services");
  },

  async getEnvironmentConfig(): Promise<Record<string, string | boolean | number>> {
    return api.get("/admin/settings/environment");
  },

  // ============= Revenue & Analytics =============
  async getRevenueReport(params?: {
    period?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    total: number;
    platformFees: number;
    ownerPayouts: number;
    breakdown: { date: string; amount: number }[];
  }> {
    const queryParams = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined) queryParams.append(key, String(value));
    });
    const query = queryParams.toString();
    return api.get(`/admin/revenue${query ? `?${query}` : ""}`);
  },

  async getUserAnalytics(): Promise<{
    totalUsers: number;
    activeUsers: number;
    newUsersThisWeek: number;
    usersByRole: { role: string; count: number }[];
    retentionRate: number;
  }> {
    return api.get("/admin/analytics/users");
  },

  async getBusinessAnalytics(): Promise<{
    totalListings: number;
    activeListings: number;
    bookingRate: number;
    averageBookingValue: number;
    topCategories: { category: string; count: number }[];
  }> {
    return api.get("/admin/analytics/business");
  },

  async getPerformanceMetrics(): Promise<{
    avgResponseTime: number;
    errorRate: number;
    requestsPerMinute: number;
    activeConnections: number;
  }> {
    return api.get("/admin/analytics/performance");
  },

  // ============= System Settings =============
  async getSettings(): Promise<{
    settings: SystemSettings;
    notifications?: Record<string, unknown>;
    security?: Record<string, unknown>;
    email?: Record<string, unknown>;
  }> {
    return api.get("/admin/settings");
  },

  async updateSettings(settings: Record<string, unknown>): Promise<void> {
    return api.patch("/admin/settings", settings);
  },

  // ============= Database Operations =============
  async runDatabaseVacuum(): Promise<{ message: string }> {
    return api.post("/admin/system/database/vacuum");
  },

  async runDatabaseAnalyze(): Promise<{ message: string }> {
    return api.post("/admin/system/database/analyze");
  },

  async clearCache(type: string): Promise<{ message: string }> {
    return api.post("/admin/system/cache/clear", { type });
  },

  // ============= API Keys =============
  async createApiKey(data: {
    name: string;
    scopes: string[];
    expiresInDays: number;
  }): Promise<{ key: string; apiKey: ApiKey }> {
    return api.post("/admin/settings/api-keys", data);
  },

  async revokeApiKey(keyId: string): Promise<void> {
    return api.delete(`/admin/settings/api-keys/${keyId}`);
  },

  async regenerateApiKey(keyId: string): Promise<{ key: string }> {
    return api.post(`/admin/settings/api-keys/${keyId}/regenerate`);
  },

  // ============= Email =============
  async sendTestEmail(email: string): Promise<{ message: string }> {
    return api.post("/admin/settings/email/test", { email });
  },

  // ============= Environment =============
  async getEnvironmentVariables(): Promise<{
    variables: EnvVariable[];
    environment: string;
  }> {
    return api.get("/admin/settings/environment/variables");
  },
};
