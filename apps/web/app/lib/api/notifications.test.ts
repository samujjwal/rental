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

import { notificationsApi } from "~/lib/api/notifications";

describe("notificationsApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getNotifications without params", async () => {
    mockApi.get.mockResolvedValue({ notifications: [], total: 0 });
    await notificationsApi.getNotifications();
    expect(mockApi.get).toHaveBeenCalledWith("/notifications");
  });

  it("getNotifications with filters", async () => {
    mockApi.get.mockResolvedValue({ notifications: [], total: 0 });
    await notificationsApi.getNotifications({
      page: 2,
      limit: 5,
      unreadOnly: true,
      type: "BOOKING_REQUEST",
    });
    expect(mockApi.get).toHaveBeenCalledWith(
      expect.stringContaining("page=2"),
    );
    expect(mockApi.get).toHaveBeenCalledWith(
      expect.stringContaining("unreadOnly=true"),
    );
  });

  it("normalizes string notification payloads", async () => {
    mockApi.get.mockResolvedValue({
      notifications: [
        {
          id: "n1",
          userId: "u1",
          type: "BOOKING_CONFIRMED",
          title: "Booked",
          message: "Confirmed",
          data: JSON.stringify({ bookingId: "b1" }),
          read: false,
          createdAt: "2026-03-16T00:00:00.000Z",
          updatedAt: "2026-03-16T00:00:00.000Z",
        },
      ],
      total: 1,
    });

    const result = await notificationsApi.getNotifications();

    expect(result.notifications[0].data).toEqual({ bookingId: "b1" });
  });

  it("getUnreadCount", async () => {
    mockApi.get.mockResolvedValue({ count: 3 });
    const result = await notificationsApi.getUnreadCount();
    expect(mockApi.get).toHaveBeenCalledWith("/notifications/unread-count");
    expect(result.count).toBe(3);
  });

  it("markAsRead", async () => {
    mockApi.post.mockResolvedValue(undefined);
    await notificationsApi.markAsRead("n1");
    expect(mockApi.post).toHaveBeenCalledWith("/notifications/n1/read");
  });

  it("markAllAsRead", async () => {
    mockApi.post.mockResolvedValue({ count: 5 });
    const result = await notificationsApi.markAllAsRead();
    expect(mockApi.post).toHaveBeenCalledWith("/notifications/read-all");
    expect(result.count).toBe(5);
  });

  it("deleteNotification", async () => {
    mockApi.delete.mockResolvedValue(undefined);
    await notificationsApi.deleteNotification("n1");
    expect(mockApi.delete).toHaveBeenCalledWith("/notifications/n1");
  });

  it("getPreferences", async () => {
    mockApi.get.mockResolvedValue({ email: true, push: false });
    const result = await notificationsApi.getPreferences();
    expect(mockApi.get).toHaveBeenCalledWith("/notifications/preferences");
    expect(result.email).toBe(true);
  });

  it("updatePreferences", async () => {
    mockApi.patch.mockResolvedValue({ email: false });
    await notificationsApi.updatePreferences({ email: false });
    expect(mockApi.patch).toHaveBeenCalledWith("/notifications/preferences", { email: false });
  });
});
