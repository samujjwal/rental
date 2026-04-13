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
    mockApi.get.mockResolvedValue({
      bookings: [{ id: "b1", status: "CONFIRMED" }],
      total: 1,
      page: 1,
      pageSize: 20
    });
    const result = await bookingsApi.getMyBookings();

    // Validate method call
    expect(mockApi.get).toHaveBeenCalledWith("/bookings/my-bookings");

    // Validate response structure
    expect(result).toMatchObject({
      bookings: expect.arrayContaining([expect.objectContaining({
        id: expect.any(String),
        status: expect.any(String)
      })]),
      total: expect.any(Number),
      page: expect.any(Number),
      pageSize: expect.any(Number)
    });
  });

  it("getMyBookings with status filter", async () => {
    mockApi.get.mockResolvedValue({
      bookings: [{ id: "b1", status: "CONFIRMED" }],
      total: 1,
      page: 1,
      pageSize: 20
    });
    const result = await bookingsApi.getMyBookings("CONFIRMED");

    // Validate method call
    expect(mockApi.get).toHaveBeenCalledWith("/bookings/my-bookings?status=CONFIRMED");

    // Validate response structure
    expect(result).toMatchObject({
      bookings: expect.arrayContaining([expect.objectContaining({ status: "CONFIRMED" })]),
      total: expect.any(Number)
    });
  });

  it("getOwnerBookings with status filter", async () => {
    mockApi.get.mockResolvedValue({
      bookings: [{ id: "b1", status: "PENDING" }],
      total: 1,
      page: 1,
      pageSize: 20
    });
    const result = await bookingsApi.getOwnerBookings("PENDING");

    // Validate method call
    expect(mockApi.get).toHaveBeenCalledWith("/bookings/host-bookings?status=PENDING");

    // Validate response structure
    expect(result).toMatchObject({
      bookings: expect.arrayContaining([expect.objectContaining({ status: "PENDING" })]),
      total: expect.any(Number)
    });
  });

  it("getBookingById", async () => {
    mockApi.get.mockResolvedValue({
      id: "b1",
      status: "CONFIRMED",
      listingId: "l1",
      renterId: "r1",
      ownerId: "o1",
      startDate: "2026-01-01",
      endDate: "2026-01-05",
      totalPrice: 500,
      currency: "USD"
    });
    const result = await bookingsApi.getBookingById("b1");

    // Validate method call
    expect(mockApi.get).toHaveBeenCalledWith("/bookings/b1");

    // Validate response structure
    expect(result).toMatchObject({
      id: "b1",
      status: expect.any(String),
      listingId: expect.any(String),
      renterId: expect.any(String),
      ownerId: expect.any(String),
      startDate: expect.any(String),
      endDate: expect.any(String),
      totalPrice: expect.any(Number),
      currency: expect.any(String)
    });

    // Validate error handling
    mockApi.get.mockRejectedValue(new Error("Network error"));
    await expect(bookingsApi.getBookingById("b1")).rejects.toThrow("Network error");

    mockApi.get.mockRejectedValue({ status: 404, message: "Booking not found" });
    await expect(bookingsApi.getBookingById("b1")).rejects.toMatchObject({
      status: 404,
      message: "Booking not found"
    });
  });

  it("getAvailableTransitions", async () => {
    mockApi.get.mockResolvedValue({
      availableTransitions: ["CANCEL", "APPROVE"],
      currentStatus: "PENDING_OWNER_APPROVAL",
      bookingId: "b1"
    });
    const result = await bookingsApi.getAvailableTransitions("b1");

    // Validate method call
    expect(mockApi.get).toHaveBeenCalledWith(
      "/bookings/b1/available-transitions"
    );

    // Validate response structure and state transitions
    expect(result).toMatchObject({
      availableTransitions: expect.arrayContaining([expect.any(String)]),
      currentStatus: expect.any(String),
      bookingId: "b1"
    });

    // Validate error handling
    mockApi.get.mockRejectedValue({ status: 404, message: "Booking not found" });
    await expect(bookingsApi.getAvailableTransitions("b1")).rejects.toMatchObject({
      status: 404,
      message: "Booking not found"
    });
  });

  it("createBooking", async () => {
    const data = { listingId: "l1", startDate: "2026-03-01", endDate: "2026-03-05" };
    mockApi.post.mockResolvedValue({
      id: "b2",
      status: "PENDING_OWNER_APPROVAL",
      listingId: "l1",
      renterId: "r1",
      totalPrice: 500,
      currency: "USD"
    });
    const result = await bookingsApi.createBooking(data as any);

    // Validate method call
    expect(mockApi.post).toHaveBeenCalledWith("/bookings", data);

    // Validate response structure
    expect(result).toMatchObject({
      id: expect.any(String),
      status: expect.any(String),
      listingId: "l1",
      renterId: expect.any(String),
      totalPrice: expect.any(Number),
      currency: expect.any(String)
    });

    // Validate error handling
    mockApi.post.mockRejectedValue({ status: 400, message: "Invalid date range" });
    await expect(bookingsApi.createBooking(data as any)).rejects.toMatchObject({
      status: 400,
      message: "Invalid date range"
    });

    mockApi.post.mockRejectedValue({ status: 409, message: "Listing unavailable" });
    await expect(bookingsApi.createBooking(data as any)).rejects.toMatchObject({
      status: 409,
      message: "Listing unavailable"
    });
  });

  it("cancelBooking with reason", async () => {
    mockApi.post.mockResolvedValue({
      booking: { id: "b1", status: "CANCELLED" },
      refund: { amount: 100, currency: "USD", status: "PENDING" }
    });
    const result = await bookingsApi.cancelBooking("b1", "changed plans");

    // Validate method call
    expect(mockApi.post).toHaveBeenCalledWith("/bookings/b1/cancel", { reason: "changed plans" });

    // Validate response structure and refund calculation
    expect(result).toMatchObject({
      booking: expect.objectContaining({
        id: "b1",
        status: "CANCELLED"
      }),
      refund: expect.objectContaining({
        amount: expect.any(Number),
        currency: expect.any(String),
        status: expect.any(String)
      })
    });

    // Validate error handling
    mockApi.post.mockRejectedValue({ status: 403, message: "Not authorized" });
    await expect(bookingsApi.cancelBooking("b1", "changed plans")).rejects.toMatchObject({
      status: 403,
      message: "Not authorized"
    });

    mockApi.post.mockRejectedValue({ status: 400, message: "Cannot cancel confirmed booking" });
    await expect(bookingsApi.cancelBooking("b1", "changed plans")).rejects.toMatchObject({
      status: 400,
      message: "Cannot cancel confirmed booking"
    });
  });

  it("approveBooking", async () => {
    mockApi.post.mockResolvedValue({
      id: "b1",
      status: "PENDING_PAYMENT",
      listingId: "l1",
      renterId: "r1",
      ownerId: "o1"
    });
    const result = await bookingsApi.approveBooking("b1");

    // Validate method call
    expect(mockApi.post).toHaveBeenCalledWith("/bookings/b1/approve");

    // Validate response structure and state transition
    expect(result).toMatchObject({
      id: "b1",
      status: "PENDING_PAYMENT",
      listingId: expect.any(String),
      renterId: expect.any(String),
      ownerId: expect.any(String)
    });

    // Validate error handling
    mockApi.post.mockRejectedValue({ status: 403, message: "Not authorized" });
    await expect(bookingsApi.approveBooking("b1")).rejects.toMatchObject({
      status: 403,
      message: "Not authorized"
    });

    mockApi.post.mockRejectedValue({ status: 400, message: "Invalid state transition" });
    await expect(bookingsApi.approveBooking("b1")).rejects.toMatchObject({
      status: 400,
      message: "Invalid state transition"
    });
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
    mockApi.post.mockResolvedValue({
      totalPrice: 500,
      currency: "USD",
      breakdown: {
        basePrice: 400,
        serviceFee: 50,
        tax: 50
      }
    });
    const result = await bookingsApi.calculatePrice("l1", "2026-03-01", "2026-03-05", "pickup");

    // Validate method call
    expect(mockApi.post).toHaveBeenCalledWith("/bookings/calculate-price", {
      listingId: "l1",
      startDate: "2026-03-01",
      endDate: "2026-03-05",
      deliveryMethod: "pickup",
    });

    // Validate response structure and price calculation
    expect(result).toMatchObject({
      totalPrice: expect.any(Number),
      currency: expect.any(String),
      breakdown: expect.objectContaining({
        basePrice: expect.any(Number),
        serviceFee: expect.any(Number),
        tax: expect.any(Number)
      })
    });

    // Validate error handling
    mockApi.post.mockRejectedValue({ status: 400, message: "Invalid date range" });
    await expect(bookingsApi.calculatePrice("l1", "2026-03-01", "2026-03-05", "pickup")).rejects.toMatchObject({
      status: 400,
      message: "Invalid date range"
    });

    mockApi.post.mockRejectedValue({ status: 404, message: "Listing not found" });
    await expect(bookingsApi.calculatePrice("l1", "2026-03-01", "2026-03-05", "pickup")).rejects.toMatchObject({
      status: 404,
      message: "Listing not found"
    });
  });

  it("checkAvailability", async () => {
    mockApi.post.mockResolvedValue({
      available: true,
      blockedDates: [],
      price: { dailyRate: 100, currency: "USD" }
    });
    const result = await bookingsApi.checkAvailability("l1", "2026-03-01", "2026-03-05");

    // Validate method call
    expect(mockApi.post).toHaveBeenCalledWith("/listings/l1/check-availability", {
      startDate: "2026-03-01",
      endDate: "2026-03-05",
    });

    // Validate response structure
    expect(result).toMatchObject({
      available: expect.any(Boolean),
      blockedDates: expect.any(Array),
      price: expect.objectContaining({
        dailyRate: expect.any(Number),
        currency: expect.any(String)
      })
    });

    // Validate error handling
    mockApi.post.mockRejectedValue({ status: 404, message: "Listing not found" });
    await expect(bookingsApi.checkAvailability("l1", "2026-03-01", "2026-03-05")).rejects.toMatchObject({
      status: 404,
      message: "Listing not found"
    });

    mockApi.post.mockRejectedValue({ status: 400, message: "Invalid date range" });
    await expect(bookingsApi.checkAvailability("l1", "2026-03-01", "2026-03-05")).rejects.toMatchObject({
      status: 400,
      message: "Invalid date range"
    });
  });

  it("getBlockedDates", async () => {
    mockApi.get.mockResolvedValue({
      blockedDates: ["2026-03-01", "2026-03-02"],
      nextAvailableDate: "2026-03-06"
    });
    const result = await bookingsApi.getBlockedDates("l1");

    // Validate method call
    expect(mockApi.get).toHaveBeenCalledWith("/bookings/blocked-dates/l1");

    // Validate response structure
    expect(result).toMatchObject({
      blockedDates: expect.arrayContaining([expect.any(String)]),
      nextAvailableDate: expect.any(String)
    });

    // Validate error handling
    mockApi.get.mockRejectedValue({ status: 404, message: "Listing not found" });
    await expect(bookingsApi.getBlockedDates("l1")).rejects.toMatchObject({
      status: 404,
      message: "Listing not found"
    });
  });
});
