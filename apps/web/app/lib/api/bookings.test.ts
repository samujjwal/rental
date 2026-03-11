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

import { bookingsApi } from "~/lib/api/bookings";

describe("bookingsApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getMyBookings without status", async () => {
    mockApi.get.mockResolvedValue([]);
    await bookingsApi.getMyBookings();
    expect(mockApi.get).toHaveBeenCalledWith("/bookings/my-bookings");
  });

  it("getMyBookings with status filter", async () => {
    mockApi.get.mockResolvedValue([]);
    await bookingsApi.getMyBookings("CONFIRMED");
    expect(mockApi.get).toHaveBeenCalledWith("/bookings/my-bookings?status=CONFIRMED");
  });

  it("getOwnerBookings with status filter", async () => {
    mockApi.get.mockResolvedValue([]);
    await bookingsApi.getOwnerBookings("PENDING");
    expect(mockApi.get).toHaveBeenCalledWith("/bookings/host-bookings?status=PENDING");
  });

  it("getBookingById", async () => {
    mockApi.get.mockResolvedValue({ id: "b1" });
    const result = await bookingsApi.getBookingById("b1");
    expect(mockApi.get).toHaveBeenCalledWith("/bookings/b1");
    expect(result.id).toBe("b1");
  });

  it("createBooking", async () => {
    const data = { listingId: "l1", startDate: "2026-03-01", endDate: "2026-03-05" };
    mockApi.post.mockResolvedValue({ id: "b2" });
    await bookingsApi.createBooking(data as any);
    expect(mockApi.post).toHaveBeenCalledWith("/bookings", data);
  });

  it("cancelBooking with reason", async () => {
    mockApi.post.mockResolvedValue({ booking: {}, refund: 100 });
    await bookingsApi.cancelBooking("b1", "changed plans");
    expect(mockApi.post).toHaveBeenCalledWith("/bookings/b1/cancel", { reason: "changed plans" });
  });

  it("approveBooking", async () => {
    mockApi.post.mockResolvedValue({ id: "b1", status: "CONFIRMED" });
    await bookingsApi.approveBooking("b1");
    expect(mockApi.post).toHaveBeenCalledWith("/bookings/b1/approve");
  });

  it("rejectBooking with reason", async () => {
    mockApi.post.mockResolvedValue({});
    await bookingsApi.rejectBooking("b1", "not available");
    expect(mockApi.post).toHaveBeenCalledWith("/bookings/b1/reject", { reason: "not available" });
  });

  it("startBooking", async () => {
    mockApi.post.mockResolvedValue({});
    await bookingsApi.startBooking("b1");
    expect(mockApi.post).toHaveBeenCalledWith("/bookings/b1/start");
  });

  it("requestReturn", async () => {
    mockApi.post.mockResolvedValue({});
    await bookingsApi.requestReturn("b1");
    expect(mockApi.post).toHaveBeenCalledWith("/bookings/b1/request-return");
  });

  it("approveReturn", async () => {
    mockApi.post.mockResolvedValue({});
    await bookingsApi.approveReturn("b1");
    expect(mockApi.post).toHaveBeenCalledWith("/bookings/b1/approve-return");
  });

  it("calculatePrice", async () => {
    mockApi.post.mockResolvedValue({ totalPrice: 500 });
    await bookingsApi.calculatePrice("l1", "2026-03-01", "2026-03-05", "pickup");
    expect(mockApi.post).toHaveBeenCalledWith("/bookings/calculate-price", {
      listingId: "l1",
      startDate: "2026-03-01",
      endDate: "2026-03-05",
      deliveryMethod: "pickup",
    });
  });

  it("checkAvailability", async () => {
    mockApi.post.mockResolvedValue({ available: true });
    await bookingsApi.checkAvailability("l1", "2026-03-01", "2026-03-05");
    expect(mockApi.post).toHaveBeenCalledWith("/listings/l1/check-availability", {
      startDate: "2026-03-01",
      endDate: "2026-03-05",
    });
  });

  it("getBlockedDates", async () => {
    mockApi.get.mockResolvedValue(["2026-03-01"]);
    const result = await bookingsApi.getBlockedDates("l1");
    expect(mockApi.get).toHaveBeenCalledWith("/bookings/blocked-dates/l1");
    expect(result).toEqual(["2026-03-01"]);
  });
});
