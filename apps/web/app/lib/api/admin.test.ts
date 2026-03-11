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

import { adminApi } from "~/lib/api/admin";

describe("adminApi", () => {
  beforeEach(() => vi.clearAllMocks());

  // ====== Dashboard ======
  describe("dashboard", () => {
    it("getDashboardStats calls GET /admin/dashboard", async () => {
      const stats = { totalUsers: 100 };
      mockApi.get.mockResolvedValue(stats);
      const result = await adminApi.getDashboardStats();
      expect(mockApi.get).toHaveBeenCalledWith("/admin/dashboard");
      expect(result).toEqual(stats);
    });

    it("getAnalytics calls GET /admin/analytics without params", async () => {
      mockApi.get.mockResolvedValue({ period: "month" });
      await adminApi.getAnalytics();
      expect(mockApi.get).toHaveBeenCalledWith("/admin/analytics");
    });

    it("getAnalytics passes query params", async () => {
      mockApi.get.mockResolvedValue({});
      await adminApi.getAnalytics({ period: "week", startDate: "2025-01-01" });
      expect(mockApi.get).toHaveBeenCalledWith(
        expect.stringContaining("period=week")
      );
      expect(mockApi.get).toHaveBeenCalledWith(
        expect.stringContaining("startDate=2025-01-01")
      );
    });
  });

  // ====== User Management ======
  describe("user management", () => {
    it("getUsers calls GET /admin/users", async () => {
      mockApi.get.mockResolvedValue({ users: [], total: 0 });
      await adminApi.getUsers();
      expect(mockApi.get).toHaveBeenCalledWith("/admin/users");
    });

    it("getUsers passes search/role/status params", async () => {
      mockApi.get.mockResolvedValue({ users: [], total: 0 });
      await adminApi.getUsers({ search: "john", role: "HOST", page: 2 });
      const url = mockApi.get.mock.calls[0][0] as string;
      expect(url).toContain("search=john");
      expect(url).toContain("role=HOST");
      expect(url).toContain("page=2");
    });

    it("getUserById calls GET /admin/users/:id", async () => {
      mockApi.get.mockResolvedValue({ id: "u1" });
      const result = await adminApi.getUserById("u1");
      expect(mockApi.get).toHaveBeenCalledWith("/admin/users/u1");
      expect(result).toEqual({ id: "u1" });
    });

    it("updateUserRole calls PATCH /admin/users/:id/role", async () => {
      mockApi.patch.mockResolvedValue({ id: "u1", role: "ADMIN" });
      await adminApi.updateUserRole("u1", "ADMIN");
      expect(mockApi.patch).toHaveBeenCalledWith("/admin/users/u1/role", { role: "ADMIN" });
    });

    it("suspendUser calls POST /admin/users/:id/suspend", async () => {
      mockApi.post.mockResolvedValue({ id: "u1", status: "SUSPENDED" });
      await adminApi.suspendUser("u1", "Violation");
      expect(mockApi.post).toHaveBeenCalledWith("/admin/users/u1/suspend", { reason: "Violation" });
    });

    it("activateUser calls POST /admin/users/:id/activate", async () => {
      mockApi.post.mockResolvedValue({ id: "u1", status: "ACTIVE" });
      await adminApi.activateUser("u1");
      expect(mockApi.post).toHaveBeenCalledWith("/admin/users/u1/activate");
    });

    it("deleteUser calls DELETE /admin/users/:id", async () => {
      mockApi.delete.mockResolvedValue(undefined);
      await adminApi.deleteUser("u1");
      expect(mockApi.delete).toHaveBeenCalledWith("/admin/users/u1");
    });
  });

  // ====== Listing Management ======
  describe("listing management", () => {
    it("getListings calls GET /admin/listings", async () => {
      mockApi.get.mockResolvedValue({ listings: [], total: 0 });
      await adminApi.getListings();
      expect(mockApi.get).toHaveBeenCalledWith("/admin/listings");
    });

    it("getListings passes filter params", async () => {
      mockApi.get.mockResolvedValue({ listings: [], total: 0 });
      await adminApi.getListings({ status: "ACTIVE", categoryId: "c1" });
      const url = mockApi.get.mock.calls[0][0] as string;
      expect(url).toContain("status=ACTIVE");
      expect(url).toContain("categoryId=c1");
    });

    it("getListingById calls GET /admin/listings/:id", async () => {
      mockApi.get.mockResolvedValue({ id: "l1" });
      await adminApi.getListingById("l1");
      expect(mockApi.get).toHaveBeenCalledWith("/admin/listings/l1");
    });

    it("getPendingListings calls GET /admin/listings/pending", async () => {
      mockApi.get.mockResolvedValue({ listings: [] });
      await adminApi.getPendingListings();
      expect(mockApi.get).toHaveBeenCalledWith("/admin/listings/pending");
    });

    it("updateListingStatus calls PATCH with status and reason", async () => {
      mockApi.patch.mockResolvedValue({ id: "l1" });
      await adminApi.updateListingStatus("l1", "APPROVED", "Looks good");
      expect(mockApi.patch).toHaveBeenCalledWith("/admin/listings/l1/status", {
        status: "APPROVED",
        reason: "Looks good",
      });
    });

    it("deleteListing calls DELETE /admin/listings/:id", async () => {
      mockApi.delete.mockResolvedValue(undefined);
      await adminApi.deleteListing("l1");
      expect(mockApi.delete).toHaveBeenCalledWith("/admin/listings/l1");
    });
  });

  // ====== Booking Management ======
  describe("booking management", () => {
    it("getBookings calls GET /admin/bookings", async () => {
      mockApi.get.mockResolvedValue({ bookings: [], total: 0 });
      await adminApi.getBookings();
      expect(mockApi.get).toHaveBeenCalledWith("/admin/bookings");
    });

    it("getBookings passes date range params", async () => {
      mockApi.get.mockResolvedValue({ bookings: [] });
      await adminApi.getBookings({ startDate: "2025-01-01", endDate: "2025-12-31" });
      const url = mockApi.get.mock.calls[0][0] as string;
      expect(url).toContain("startDate=2025-01-01");
      expect(url).toContain("endDate=2025-12-31");
    });

    it("getBookingById calls GET /admin/bookings/:id", async () => {
      mockApi.get.mockResolvedValue({ id: "b1" });
      await adminApi.getBookingById("b1");
      expect(mockApi.get).toHaveBeenCalledWith("/admin/bookings/b1");
    });
  });

  // ====== Payment Management ======
  describe("payment management", () => {
    it("getPayments calls GET /admin/payments", async () => {
      mockApi.get.mockResolvedValue({ payments: [] });
      await adminApi.getPayments();
      expect(mockApi.get).toHaveBeenCalledWith("/admin/payments");
    });

    it("getRefunds calls GET /admin/refunds", async () => {
      mockApi.get.mockResolvedValue({ payments: [] });
      await adminApi.getRefunds({ status: "PENDING" });
      const url = mockApi.get.mock.calls[0][0] as string;
      expect(url).toContain("status=PENDING");
    });

    it("updateRefundStatus calls PATCH /admin/refunds/:id/status", async () => {
      mockApi.patch.mockResolvedValue({ id: "r1" });
      await adminApi.updateRefundStatus("r1", "APPROVED");
      expect(mockApi.patch).toHaveBeenCalledWith("/admin/refunds/r1/status", { status: "APPROVED" });
    });

    it("getPayouts calls GET /admin/payouts", async () => {
      mockApi.get.mockResolvedValue({ payments: [] });
      await adminApi.getPayouts();
      expect(mockApi.get).toHaveBeenCalledWith("/admin/payouts");
    });
  });

  // ====== Dispute Management ======
  describe("dispute management", () => {
    it("getDisputes calls GET /admin/disputes", async () => {
      mockApi.get.mockResolvedValue({ disputes: [] });
      await adminApi.getDisputes();
      expect(mockApi.get).toHaveBeenCalledWith("/admin/disputes");
    });

    it("getDisputes passes status/type params", async () => {
      mockApi.get.mockResolvedValue({ disputes: [] });
      await adminApi.getDisputes({ status: "OPEN", type: "DAMAGE" });
      const url = mockApi.get.mock.calls[0][0] as string;
      expect(url).toContain("status=OPEN");
      expect(url).toContain("type=DAMAGE");
    });

    it("updateDisputeStatus calls PATCH /admin/disputes/:id/status", async () => {
      mockApi.patch.mockResolvedValue({ id: "d1" });
      await adminApi.updateDisputeStatus("d1", "RESOLVED", "Refund issued");
      expect(mockApi.patch).toHaveBeenCalledWith("/admin/disputes/d1/status", {
        status: "RESOLVED",
        resolution: "Refund issued",
      });
    });

    it("updateDispute calls PATCH /disputes/:id", async () => {
      mockApi.patch.mockResolvedValue({ id: "d1" });
      await adminApi.updateDispute("d1", { status: "CLOSED", adminNotes: "Done" });
      expect(mockApi.patch).toHaveBeenCalledWith("/disputes/d1", {
        status: "CLOSED",
        adminNotes: "Done",
      });
    });

    it("resolveDispute delegates to updateDispute with RESOLVED status", async () => {
      mockApi.patch.mockResolvedValue({ id: "d1" });
      await adminApi.resolveDispute("d1", {
        resolution: "Partial refund",
        notes: "50% refund",
        resolvedAmount: 500,
      });
      expect(mockApi.patch).toHaveBeenCalledWith("/disputes/d1", {
        status: "RESOLVED",
        resolution: "Partial refund",
        adminNotes: "50% refund",
        resolvedAmount: 500,
      });
    });

    it("assignDispute sets UNDER_REVIEW status", async () => {
      mockApi.patch.mockResolvedValue({ id: "d1" });
      await adminApi.assignDispute("d1", "admin-123");
      expect(mockApi.patch).toHaveBeenCalledWith("/disputes/d1", {
        status: "UNDER_REVIEW",
        adminNotes: "Assigned to admin-123",
      });
    });

    it("assignDispute without assigneeId uses default note", async () => {
      mockApi.patch.mockResolvedValue({ id: "d1" });
      await adminApi.assignDispute("d1");
      expect(mockApi.patch).toHaveBeenCalledWith("/disputes/d1", {
        status: "UNDER_REVIEW",
        adminNotes: "Assigned for review",
      });
    });
  });

  // ====== Review Management ======
  describe("review management", () => {
    it("getReviews calls GET /admin/reviews", async () => {
      mockApi.get.mockResolvedValue({ reviews: [], total: 0 });
      await adminApi.getReviews();
      expect(mockApi.get).toHaveBeenCalledWith("/admin/reviews");
    });

    it("getReviews passes flagged param", async () => {
      mockApi.get.mockResolvedValue({ reviews: [], total: 0 });
      await adminApi.getReviews({ flagged: true });
      const url = mockApi.get.mock.calls[0][0] as string;
      expect(url).toContain("flagged=true");
    });

    it("updateReviewStatus calls PATCH /admin/reviews/:id/status", async () => {
      mockApi.patch.mockResolvedValue({});
      await adminApi.updateReviewStatus("rev1", "HIDDEN");
      expect(mockApi.patch).toHaveBeenCalledWith("/admin/reviews/rev1/status", { status: "HIDDEN" });
    });
  });

  // ====== System Operations ======
  describe("system operations", () => {
    it("getSystemHealth calls GET /admin/system/health", async () => {
      mockApi.get.mockResolvedValue({ status: "healthy" });
      await adminApi.getSystemHealth();
      expect(mockApi.get).toHaveBeenCalledWith("/admin/system/health");
    });

    it("getSystemOverview calls GET /admin/system/overview", async () => {
      mockApi.get.mockResolvedValue({ version: "1.0" });
      await adminApi.getSystemOverview();
      expect(mockApi.get).toHaveBeenCalledWith("/admin/system/overview");
    });

    it("getDatabaseInfo calls GET /admin/system/database", async () => {
      mockApi.get.mockResolvedValue({ size: 1024 });
      await adminApi.getDatabaseInfo();
      expect(mockApi.get).toHaveBeenCalledWith("/admin/system/database");
    });

    it("getBackups calls GET /admin/system/backups", async () => {
      mockApi.get.mockResolvedValue({ backups: [] });
      await adminApi.getBackups();
      expect(mockApi.get).toHaveBeenCalledWith("/admin/system/backups");
    });

    it("createBackup calls POST /admin/system/backups", async () => {
      mockApi.post.mockResolvedValue({ id: "bk1" });
      await adminApi.createBackup("full");
      expect(mockApi.post).toHaveBeenCalledWith("/admin/system/backups", { type: "full" });
    });

    it("restoreBackup calls POST /admin/system/backups/:id/restore", async () => {
      mockApi.post.mockResolvedValue({ message: "Restoring..." });
      await adminApi.restoreBackup("bk1");
      expect(mockApi.post).toHaveBeenCalledWith("/admin/system/backups/bk1/restore");
    });

    it("getAuditLogs calls GET /admin/system/audit", async () => {
      mockApi.get.mockResolvedValue({ logs: [] });
      await adminApi.getAuditLogs();
      expect(mockApi.get).toHaveBeenCalledWith("/admin/system/audit");
    });

    it("getAuditLogs passes filter params", async () => {
      mockApi.get.mockResolvedValue({ logs: [] });
      await adminApi.getAuditLogs({ action: "CREATE", entity: "listing" });
      const url = mockApi.get.mock.calls[0][0] as string;
      expect(url).toContain("action=CREATE");
      expect(url).toContain("entity=listing");
    });

    it("getSystemLogs calls GET /admin/system/logs", async () => {
      mockApi.get.mockResolvedValue({ logs: [] });
      await adminApi.getSystemLogs({ level: "error" });
      const url = mockApi.get.mock.calls[0][0] as string;
      expect(url).toContain("level=error");
    });
  });

  // ====== Settings ======
  describe("settings", () => {
    it("getGeneralSettings calls GET /admin/settings/general", async () => {
      mockApi.get.mockResolvedValue({ siteName: "GharBatai" });
      await adminApi.getGeneralSettings();
      expect(mockApi.get).toHaveBeenCalledWith("/admin/settings/general");
    });

    it("updateGeneralSettings calls PATCH /admin/settings/general", async () => {
      mockApi.patch.mockResolvedValue(undefined);
      await adminApi.updateGeneralSettings({ siteName: "New Name" });
      expect(mockApi.patch).toHaveBeenCalledWith("/admin/settings/general", { siteName: "New Name" });
    });

    it("getApiKeys calls GET /admin/settings/api-keys", async () => {
      mockApi.get.mockResolvedValue({ keys: [] });
      await adminApi.getApiKeys();
      expect(mockApi.get).toHaveBeenCalledWith("/admin/settings/api-keys");
    });

    it("getServiceStatus calls GET /admin/settings/services", async () => {
      mockApi.get.mockResolvedValue({ services: [] });
      await adminApi.getServiceStatus();
      expect(mockApi.get).toHaveBeenCalledWith("/admin/settings/services");
    });

    it("getEnvironmentConfig calls GET /admin/settings/environment", async () => {
      mockApi.get.mockResolvedValue({});
      await adminApi.getEnvironmentConfig();
      expect(mockApi.get).toHaveBeenCalledWith("/admin/settings/environment");
    });

    it("getSettings calls GET /admin/settings", async () => {
      mockApi.get.mockResolvedValue({ settings: {} });
      await adminApi.getSettings();
      expect(mockApi.get).toHaveBeenCalledWith("/admin/settings");
    });

    it("updateSettings calls PATCH /admin/settings", async () => {
      mockApi.patch.mockResolvedValue(undefined);
      await adminApi.updateSettings({ maintenanceMode: true });
      expect(mockApi.patch).toHaveBeenCalledWith("/admin/settings", { maintenanceMode: true });
    });
  });

  // ====== Revenue & Analytics ======
  describe("revenue & analytics", () => {
    it("getRevenueReport calls GET /admin/revenue", async () => {
      mockApi.get.mockResolvedValue({ total: 50000 });
      await adminApi.getRevenueReport({ period: "month" });
      const url = mockApi.get.mock.calls[0][0] as string;
      expect(url).toContain("/admin/revenue");
      expect(url).toContain("period=month");
    });

    it("getUserAnalytics calls GET /admin/analytics/users", async () => {
      mockApi.get.mockResolvedValue({ totalUsers: 500 });
      await adminApi.getUserAnalytics();
      expect(mockApi.get).toHaveBeenCalledWith("/admin/analytics/users");
    });

    it("getBusinessAnalytics calls GET /admin/analytics/business", async () => {
      mockApi.get.mockResolvedValue({ totalListings: 200 });
      await adminApi.getBusinessAnalytics();
      expect(mockApi.get).toHaveBeenCalledWith("/admin/analytics/business");
    });

    it("getPerformanceMetrics calls GET /admin/analytics/performance", async () => {
      mockApi.get.mockResolvedValue({ avgResponseTime: 150 });
      await adminApi.getPerformanceMetrics();
      expect(mockApi.get).toHaveBeenCalledWith("/admin/analytics/performance");
    });
  });

  // ====== Database Operations ======
  describe("database operations", () => {
    it("runDatabaseVacuum calls POST /admin/system/database/vacuum", async () => {
      mockApi.post.mockResolvedValue({ message: "Done" });
      await adminApi.runDatabaseVacuum();
      expect(mockApi.post).toHaveBeenCalledWith("/admin/system/database/vacuum");
    });

    it("runDatabaseAnalyze calls POST /admin/system/database/analyze", async () => {
      mockApi.post.mockResolvedValue({ message: "Done" });
      await adminApi.runDatabaseAnalyze();
      expect(mockApi.post).toHaveBeenCalledWith("/admin/system/database/analyze");
    });

    it("clearCache calls POST /admin/system/cache/clear", async () => {
      mockApi.post.mockResolvedValue({ message: "Cleared" });
      await adminApi.clearCache("redis");
      expect(mockApi.post).toHaveBeenCalledWith("/admin/system/cache/clear", { type: "redis" });
    });
  });

  // ====== API Keys CRUD ======
  describe("API keys CRUD", () => {
    it("createApiKey calls POST /admin/settings/api-keys", async () => {
      mockApi.post.mockResolvedValue({ key: "secret", apiKey: { id: "k1" } });
      await adminApi.createApiKey({ name: "Test", scopes: ["read"], expiresInDays: 30 });
      expect(mockApi.post).toHaveBeenCalledWith("/admin/settings/api-keys", {
        name: "Test",
        scopes: ["read"],
        expiresInDays: 30,
      });
    });

    it("revokeApiKey calls DELETE /admin/settings/api-keys/:id", async () => {
      mockApi.delete.mockResolvedValue(undefined);
      await adminApi.revokeApiKey("k1");
      expect(mockApi.delete).toHaveBeenCalledWith("/admin/settings/api-keys/k1");
    });

    it("regenerateApiKey calls POST /admin/settings/api-keys/:id/regenerate", async () => {
      mockApi.post.mockResolvedValue({ key: "new-secret" });
      await adminApi.regenerateApiKey("k1");
      expect(mockApi.post).toHaveBeenCalledWith("/admin/settings/api-keys/k1/regenerate");
    });
  });

  // ====== Email & Environment ======
  describe("email & environment", () => {
    it("sendTestEmail calls POST /admin/settings/email/test", async () => {
      mockApi.post.mockResolvedValue({ message: "Sent" });
      await adminApi.sendTestEmail("test@gharbatai.np");
      expect(mockApi.post).toHaveBeenCalledWith("/admin/settings/email/test", { email: "test@gharbatai.np" });
    });

    it("getEnvironmentVariables calls GET /admin/settings/environment/variables", async () => {
      mockApi.get.mockResolvedValue({ variables: [], environment: "production" });
      await adminApi.getEnvironmentVariables();
      expect(mockApi.get).toHaveBeenCalledWith("/admin/settings/environment/variables");
    });
  });
});
