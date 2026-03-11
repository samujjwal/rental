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

vi.mock("~/lib/api-error", () => ({
  withRetry: vi.fn((fn: (...args: any[]) => any) => fn()),
  parseApiError: vi.fn((e: any) => e),
  ApiError: class ApiError extends Error {},
  CircuitBreaker: vi.fn().mockImplementation(() => ({
    execute: vi.fn((fn: (...args: any[]) => any) => fn()),
  })),
}));

import { authApi } from "./auth";
import { bookingsApi } from "./bookings";

describe("authApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("login posts credentials", async () => {
    mockApi.post.mockResolvedValue({ accessToken: "at", refreshToken: "rt" });
    const result = await authApi.login({ email: "u@t.np", password: "pass" });
    expect(mockApi.post).toHaveBeenCalledWith("/auth/login", {
      email: "u@t.np",
      password: "pass",
    });
    expect(result.accessToken).toBe("at");
  });

  it("signup posts registration data", async () => {
    mockApi.post.mockResolvedValue({ accessToken: "at" });
    await authApi.signup({
      email: "u@t.np",
      password: "Pass1!",
      firstName: "Ram",
    } as any);
    expect(mockApi.post).toHaveBeenCalledWith(
      "/auth/register",
      expect.objectContaining({ email: "u@t.np" }),
    );
  });

  it("logout posts with refreshToken", async () => {
    mockApi.post.mockResolvedValue(undefined);
    await authApi.logout("rt");
    expect(mockApi.post).toHaveBeenCalledWith("/auth/logout", {
      refreshToken: "rt",
    });
  });

  it("refreshToken posts token", async () => {
    mockApi.post.mockResolvedValue({ accessToken: "new-at" });
    const result = await authApi.refreshToken("rt");
    expect(mockApi.post).toHaveBeenCalledWith("/auth/refresh", {
      refreshToken: "rt",
    });
    expect(result.accessToken).toBe("new-at");
  });

  it("forgotPassword posts email", async () => {
    mockApi.post.mockResolvedValue({ message: "sent" });
    await authApi.forgotPassword({ email: "u@t.np" });
    expect(mockApi.post).toHaveBeenCalledWith(
      "/auth/password/reset-request",
      { email: "u@t.np" },
    );
  });

  it("resetPassword posts token and new password", async () => {
    mockApi.post.mockResolvedValue({ message: "ok" });
    await authApi.resetPassword({ token: "tok", password: "New1!" } as any);
    expect(mockApi.post).toHaveBeenCalledWith(
      "/auth/password/reset",
      expect.objectContaining({ token: "tok" }),
    );
  });

  it("changePassword posts current and new password", async () => {
    mockApi.post.mockResolvedValue(undefined);
    await authApi.changePassword({
      currentPassword: "old",
      newPassword: "new",
    });
    expect(mockApi.post).toHaveBeenCalledWith("/auth/password/change", {
      currentPassword: "old",
      newPassword: "new",
    });
  });

  it("getCurrentUser gets /auth/me", async () => {
    mockApi.get.mockResolvedValue({ id: "u1", email: "u@t.np" });
    const user = await authApi.getCurrentUser();
    expect(mockApi.get).toHaveBeenCalledWith("/auth/me");
    expect(user).toEqual({ id: "u1", email: "u@t.np" });
  });

  it("devLogin posts role", async () => {
    mockApi.post.mockResolvedValue({ accessToken: "dev-at" });
    await authApi.devLogin({ email: "admin@test.np", role: "admin" });
    expect(mockApi.post).toHaveBeenCalledWith("/auth/dev-login", {
      email: "admin@test.np",
      role: "admin",
    });
  });
});

describe("bookingsApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getMyBookings fetches renter bookings", async () => {
    mockApi.get.mockResolvedValue([]);
    await bookingsApi.getMyBookings();
    expect(mockApi.get).toHaveBeenCalledWith("/bookings/my-bookings");
  });

  it("getMyBookings with status filter", async () => {
    mockApi.get.mockResolvedValue([]);
    await bookingsApi.getMyBookings("CONFIRMED");
    expect(mockApi.get).toHaveBeenCalledWith(
      "/bookings/my-bookings?status=CONFIRMED",
    );
  });

  it("getBookingById fetches by id", async () => {
    mockApi.get.mockResolvedValue({ id: "b1" });
    const result = await bookingsApi.getBookingById("b1");
    expect(mockApi.get).toHaveBeenCalledWith("/bookings/b1");
    expect(result.id).toBe("b1");
  });

  it("createBooking posts booking data", async () => {
    mockApi.post.mockResolvedValue({ id: "b-new" });
    await bookingsApi.createBooking({
      listingId: "l1",
      startDate: "2026-03-01",
      endDate: "2026-03-05",
      deliveryMethod: "pickup",
    } as any);
    expect(mockApi.post).toHaveBeenCalledWith(
      "/bookings",
      expect.objectContaining({ listingId: "l1" }),
    );
  });

  it("cancelBooking posts with reason", async () => {
    mockApi.post.mockResolvedValue({ booking: {}, refund: 100 });
    await bookingsApi.cancelBooking("b1", "Changed plans");
    expect(mockApi.post).toHaveBeenCalledWith("/bookings/b1/cancel", {
      reason: "Changed plans",
    });
  });

  it("approveBooking posts approval", async () => {
    mockApi.post.mockResolvedValue({ id: "b1", status: "CONFIRMED" });
    await bookingsApi.approveBooking("b1");
    expect(mockApi.post).toHaveBeenCalledWith("/bookings/b1/approve");
  });

  it("rejectBooking posts rejection", async () => {
    mockApi.post.mockResolvedValue({ id: "b1", status: "REJECTED" });
    await bookingsApi.rejectBooking("b1", "Not available");
    expect(mockApi.post).toHaveBeenCalledWith("/bookings/b1/reject", {
      reason: "Not available",
    });
  });

  it("calculatePrice posts params", async () => {
    mockApi.post.mockResolvedValue({ totalAmount: 500, totalDays: 5 });
    const result = await bookingsApi.calculatePrice(
      "l1",
      "2026-03-01",
      "2026-03-05",
      "pickup",
    );
    expect(mockApi.post).toHaveBeenCalledWith("/bookings/calculate-price", {
      listingId: "l1",
      startDate: "2026-03-01",
      endDate: "2026-03-05",
      deliveryMethod: "pickup",
    });
    expect(result.totalAmount).toBe(500);
  });

  it("checkAvailability posts date range", async () => {
    mockApi.post.mockResolvedValue({ available: true });
    await bookingsApi.checkAvailability("l1", "2026-03-01", "2026-03-05");
    expect(mockApi.post).toHaveBeenCalledWith(
      "/listings/l1/check-availability",
      { startDate: "2026-03-01", endDate: "2026-03-05" },
    );
  });

  it("getBlockedDates fetches dates for listing", async () => {
    mockApi.get.mockResolvedValue(["2026-03-10", "2026-03-11"]);
    const dates = await bookingsApi.getBlockedDates("l1");
    expect(mockApi.get).toHaveBeenCalledWith("/bookings/blocked-dates/l1");
    expect(dates).toEqual(["2026-03-10", "2026-03-11"]);
  });

  it("getOwnerBookings fetches host bookings", async () => {
    mockApi.get.mockResolvedValue([]);
    await bookingsApi.getOwnerBookings("PENDING");
    expect(mockApi.get).toHaveBeenCalledWith(
      "/bookings/host-bookings?status=PENDING",
    );
  });

  it("startBooking posts start transition", async () => {
    mockApi.post.mockResolvedValue({ id: "b1", status: "ACTIVE" });
    await bookingsApi.startBooking("b1");
    expect(mockApi.post).toHaveBeenCalledWith("/bookings/b1/start");
  });

  it("requestReturn posts return request", async () => {
    mockApi.post.mockResolvedValue({ id: "b1" });
    await bookingsApi.requestReturn("b1");
    expect(mockApi.post).toHaveBeenCalledWith("/bookings/b1/request-return");
  });

  it("approveReturn posts return approval", async () => {
    mockApi.post.mockResolvedValue({ id: "b1" });
    await bookingsApi.approveReturn("b1");
    expect(mockApi.post).toHaveBeenCalledWith("/bookings/b1/approve-return");
  });
});
