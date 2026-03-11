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

import { disputesApi } from "./disputes";
import { messagingApi } from "./messaging";
import { notificationsApi } from "./notifications";
import { geoApi } from "./geo";
import { uploadApi } from "./upload";
import { analyticsApi } from "./analytics";
import { aiApi } from "./ai";
import { fraudApi } from "./fraud";

describe("disputesApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getDisputeById fetches by id", async () => {
    mockApi.get.mockResolvedValue({ id: "d1" });
    await disputesApi.getDisputeById("d1");
    expect(mockApi.get).toHaveBeenCalledWith("/disputes/d1");
  });

  it("getDisputesForBooking fetches by booking", async () => {
    mockApi.get.mockResolvedValue([]);
    await disputesApi.getDisputesForBooking("b1");
    expect(mockApi.get).toHaveBeenCalledWith("/bookings/b1/disputes");
  });

  it("getMyDisputes fetches user disputes", async () => {
    mockApi.get.mockResolvedValue({ disputes: [], total: 0 });
    await disputesApi.getMyDisputes();
    expect(mockApi.get).toHaveBeenCalledWith("/disputes", expect.anything());
  });

  it("createDispute posts dispute data", async () => {
    mockApi.post.mockResolvedValue({ id: "d1" });
    await disputesApi.createDispute({ bookingId: "b1", reason: "Damaged" } as any);
    expect(mockApi.post).toHaveBeenCalledWith("/disputes", expect.objectContaining({ bookingId: "b1" }));
  });

  it("respondToDispute posts response", async () => {
    mockApi.post.mockResolvedValue({ id: "d1" });
    await disputesApi.respondToDispute("d1", "I disagree");
    expect(mockApi.post).toHaveBeenCalledWith("/disputes/d1/responses", expect.objectContaining({}));
  });

  it("closeDispute posts closure", async () => {
    mockApi.post.mockResolvedValue({ id: "d1" });
    await disputesApi.closeDispute("d1", "Resolved");
    expect(mockApi.post).toHaveBeenCalledWith("/disputes/d1/close", expect.objectContaining({}));
  });
});

describe("messagingApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createConversation posts data", async () => {
    mockApi.post.mockResolvedValue({ id: "c1" });
    await messagingApi.createConversation({ participantId: "u2" } as any);
    expect(mockApi.post).toHaveBeenCalledWith("/conversations", expect.any(Object));
  });

  it("getConversations fetches list", async () => {
    mockApi.get.mockResolvedValue({ conversations: [] });
    await messagingApi.getConversations();
    expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining("/conversations"));
  });

  it("getConversation fetches by id", async () => {
    mockApi.get.mockResolvedValue({ id: "c1" });
    await messagingApi.getConversation("c1");
    expect(mockApi.get).toHaveBeenCalledWith("/conversations/c1");
  });

  it("getMessages fetches conversation messages", async () => {
    mockApi.get.mockResolvedValue({ messages: [] });
    await messagingApi.getMessages("c1");
    expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining("/conversations/c1/messages"));
  });

  it("sendMessage posts to conversation", async () => {
    mockApi.post.mockResolvedValue({ id: "m1" });
    await messagingApi.sendMessage("c1", { content: "Hello" } as any);
    expect(mockApi.post).toHaveBeenCalledWith("/conversations/c1/messages", expect.objectContaining({ content: "Hello" }));
  });

  it("markAsRead posts read status", async () => {
    mockApi.post.mockResolvedValue(undefined);
    await messagingApi.markAsRead("c1");
    expect(mockApi.post).toHaveBeenCalledWith("/conversations/c1/read");
  });

  it("getUnreadCount fetches count", async () => {
    mockApi.get.mockResolvedValue({ count: 5 });
    const result = await messagingApi.getUnreadCount();
    expect(mockApi.get).toHaveBeenCalledWith("/conversations/unread-count");
    expect(result.count).toBe(5);
  });

  it("deleteConversation sends delete", async () => {
    mockApi.delete.mockResolvedValue(undefined);
    await messagingApi.deleteConversation("c1");
    expect(mockApi.delete).toHaveBeenCalledWith("/conversations/c1");
  });

  it("deleteMessage sends delete", async () => {
    mockApi.delete.mockResolvedValue(undefined);
    await messagingApi.deleteMessage("m1");
    expect(mockApi.delete).toHaveBeenCalledWith("/conversations/messages/m1");
  });
});

describe("notificationsApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getNotifications fetches list", async () => {
    mockApi.get.mockResolvedValue({ notifications: [] });
    await notificationsApi.getNotifications();
    expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining("/notifications"));
  });

  it("getUnreadCount fetches count", async () => {
    mockApi.get.mockResolvedValue({ count: 3 });
    await notificationsApi.getUnreadCount();
    expect(mockApi.get).toHaveBeenCalledWith("/notifications/unread-count");
  });

  it("markAsRead posts for notification", async () => {
    mockApi.post.mockResolvedValue(undefined);
    await notificationsApi.markAsRead("n1");
    expect(mockApi.post).toHaveBeenCalledWith("/notifications/n1/read");
  });

  it("markAllAsRead posts read-all", async () => {
    mockApi.post.mockResolvedValue(undefined);
    await notificationsApi.markAllAsRead();
    expect(mockApi.post).toHaveBeenCalledWith("/notifications/read-all");
  });

  it("deleteNotification sends delete", async () => {
    mockApi.delete.mockResolvedValue(undefined);
    await notificationsApi.deleteNotification("n1");
    expect(mockApi.delete).toHaveBeenCalledWith("/notifications/n1");
  });

  it("getPreferences fetches prefs", async () => {
    mockApi.get.mockResolvedValue({ email: true, push: true });
    await notificationsApi.getPreferences();
    expect(mockApi.get).toHaveBeenCalledWith("/notifications/preferences");
  });

  it("updatePreferences patches prefs", async () => {
    mockApi.patch.mockResolvedValue({ email: false });
    await notificationsApi.updatePreferences({ email: false } as any);
    expect(mockApi.patch).toHaveBeenCalledWith("/notifications/preferences", { email: false });
  });
});

describe("geoApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("autocomplete fetches suggestions", async () => {
    mockApi.get.mockResolvedValue([{ display_name: "Kathmandu" }]);
    await geoApi.autocomplete("Kath");
    expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining("/geo/autocomplete"));
    expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining("q=Kath"));
  });

  it("reverse fetches address", async () => {
    mockApi.get.mockResolvedValue({ display_name: "Thamel" });
    await geoApi.reverse(27.71, 85.31);
    expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining("/geo/reverse"));
    expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining("lat=27.71"));
  });
});

describe("uploadApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uploadImage posts FormData", async () => {
    mockApi.post.mockResolvedValue({ url: "http://img.jpg" });
    const file = new File(["x"], "test.jpg", { type: "image/jpeg" });
    await uploadApi.uploadImage(file);
    expect(mockApi.post).toHaveBeenCalledWith("/upload/image", expect.any(FormData), expect.objectContaining({ headers: expect.any(Object) }));
  });

  it("uploadImages posts multiple files", async () => {
    mockApi.post.mockResolvedValue({ urls: [] });
    const files = [new File(["a"], "a.jpg"), new File(["b"], "b.jpg")];
    await uploadApi.uploadImages(files);
    expect(mockApi.post).toHaveBeenCalledWith("/upload/images", expect.any(FormData), expect.objectContaining({ headers: expect.any(Object) }));
  });

  it("uploadDocument posts document", async () => {
    mockApi.post.mockResolvedValue({ url: "http://doc.pdf" });
    const file = new File(["pdf"], "doc.pdf", { type: "application/pdf" });
    await uploadApi.uploadDocument(file);
    expect(mockApi.post).toHaveBeenCalledWith("/upload/document", expect.any(FormData), expect.objectContaining({ headers: expect.any(Object) }));
  });
});

describe("analyticsApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getPerformanceMetrics fetches with period", async () => {
    mockApi.get.mockResolvedValue({ revenue: 1000 });
    await analyticsApi.getPerformanceMetrics("monthly");
    expect(mockApi.get).toHaveBeenCalledWith("/analytics/performance", { params: { period: "monthly" } });
  });

  it("getInsights fetches insights", async () => {
    mockApi.get.mockResolvedValue({ insights: [] });
    await analyticsApi.getInsights();
    expect(mockApi.get).toHaveBeenCalledWith("/analytics/insights");
  });

  it("getListingAnalytics fetches by listing", async () => {
    mockApi.get.mockResolvedValue({ views: 100 });
    await analyticsApi.getListingAnalytics("l1");
    expect(mockApi.get).toHaveBeenCalledWith("/analytics/listings/l1");
  });

  it("getRevenueReport fetches report", async () => {
    mockApi.get.mockResolvedValue({ data: [] });
    await analyticsApi.getRevenueReport({ startDate: "2026-01-01", endDate: "2026-01-31" });
    expect(mockApi.get).toHaveBeenCalledWith("/analytics/revenue", { params: { startDate: "2026-01-01", endDate: "2026-01-31" } });
  });

  it("getCustomerAnalytics fetches customer data", async () => {
    mockApi.get.mockResolvedValue({ totalCustomers: 50 });
    await analyticsApi.getCustomerAnalytics();
    expect(mockApi.get).toHaveBeenCalledWith("/analytics/customers");
  });
});

describe("aiApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("generateDescription posts request", async () => {
    mockApi.post.mockResolvedValue({ description: "A great item" });
    await aiApi.generateDescription({ title: "Camera", category: "Electronics" });
    expect(mockApi.post).toHaveBeenCalledWith("/ai/generate-description", expect.objectContaining({ title: "Camera" }));
  });
});

describe("fraudApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getHighRiskUsers fetches list", async () => {
    mockApi.get.mockResolvedValue([]);
    await fraudApi.getHighRiskUsers(10);
    expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining("/fraud/high-risk-users"));
  });
});
