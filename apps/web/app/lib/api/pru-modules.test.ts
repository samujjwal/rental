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

import { paymentsApi } from "./payments";
import { reviewsApi } from "./reviews";
import { usersApi } from "./users";

describe("paymentsApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createPaymentIntent posts to intents endpoint", async () => {
    mockApi.post.mockResolvedValue({ clientSecret: "cs_123" });
    const result = await paymentsApi.createPaymentIntent("b1");
    expect(mockApi.post).toHaveBeenCalledWith("/payments/intents/b1");
    expect(result.clientSecret).toBe("cs_123");
  });

  it("getPaymentHistory returns transactions array", async () => {
    mockApi.get.mockResolvedValue({
      transactions: [{ id: "t1", type: "PAYMENT", amount: 500 }],
    });
    const result = await paymentsApi.getPaymentHistory("u1");
    expect(mockApi.get).toHaveBeenCalledWith("/payments/transactions");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("t1");
  });

  it("getPaymentHistory handles empty transactions", async () => {
    mockApi.get.mockResolvedValue({ transactions: undefined });
    const result = await paymentsApi.getPaymentHistory("u1");
    expect(result).toEqual([]);
  });

  it("getOwnerEarnings fetches earnings", async () => {
    mockApi.get.mockResolvedValue({ amount: 5000, currency: "NPR" });
    const result = await paymentsApi.getOwnerEarnings("u1");
    expect(mockApi.get).toHaveBeenCalledWith("/payments/earnings");
    expect(result.amount).toBe(5000);
  });

  it("getEarningsSummary fetches summary", async () => {
    mockApi.get.mockResolvedValue({
      thisMonth: 1000,
      lastMonth: 800,
      total: 5000,
      currency: "NPR",
    });
    const result = await paymentsApi.getEarningsSummary();
    expect(mockApi.get).toHaveBeenCalledWith("/payments/earnings/summary");
    expect(result.total).toBe(5000);
  });

  it("getTransactions with filters builds query", async () => {
    mockApi.get.mockResolvedValue({ transactions: [], total: 0 });
    await paymentsApi.getTransactions({
      page: 2,
      limit: 10,
      type: "PAYMENT",
      status: "POSTED",
    });
    const url = mockApi.get.mock.calls[0][0] as string;
    expect(url).toContain("page=2");
    expect(url).toContain("limit=10");
    expect(url).toContain("type=PAYMENT");
    expect(url).toContain("status=POSTED");
  });

  it("getTransactions without filters calls base url", async () => {
    mockApi.get.mockResolvedValue({ transactions: [], total: 0 });
    await paymentsApi.getTransactions();
    expect(mockApi.get).toHaveBeenCalledWith("/payments/transactions");
  });

  it("getBalance fetches balance", async () => {
    mockApi.get.mockResolvedValue({ balance: 3000, currency: "NPR" });
    const result = await paymentsApi.getBalance();
    expect(mockApi.get).toHaveBeenCalledWith("/payments/balance");
    expect(result.balance).toBe(3000);
  });

  it("requestPayout posts payout request", async () => {
    mockApi.post.mockResolvedValue({
      id: "p1",
      amount: 2000,
      status: "PENDING",
    });
    const result = await paymentsApi.requestPayout({
      amount: 2000,
      currency: "NPR",
    });
    expect(mockApi.post).toHaveBeenCalledWith("/payments/payouts", {
      amount: 2000,
      currency: "NPR",
    });
    expect(result.id).toBe("p1");
  });

  it("getPayouts with status filter", async () => {
    mockApi.get.mockResolvedValue([{ id: "p1" }]);
    const result = await paymentsApi.getPayouts({ status: "COMPLETED" });
    const url = mockApi.get.mock.calls[0][0] as string;
    expect(url).toContain("status=COMPLETED");
  });
});

describe("reviewsApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getReviewsForListing fetches listing reviews", async () => {
    mockApi.get.mockResolvedValue({ reviews: [], total: 0 });
    await reviewsApi.getReviewsForListing("l1", 2, 5);
    expect(mockApi.get).toHaveBeenCalledWith(
      "/reviews/listing/l1?page=2&limit=5",
    );
  });

  it("getReviewsForListing uses defaults", async () => {
    mockApi.get.mockResolvedValue({ reviews: [] });
    await reviewsApi.getReviewsForListing("l1");
    expect(mockApi.get).toHaveBeenCalledWith(
      "/reviews/listing/l1?page=1&limit=10",
    );
  });

  it("getUserReviews fetches with type", async () => {
    mockApi.get.mockResolvedValue({ reviews: [] });
    await reviewsApi.getUserReviews("u1", "received");
    expect(mockApi.get).toHaveBeenCalledWith(
      "/reviews/user/u1?type=received&page=1&limit=10",
    );
  });

  it("getPublicUserReviews fetches public reviews", async () => {
    mockApi.get.mockResolvedValue({ reviews: [] });
    await reviewsApi.getPublicUserReviews("u1", 1, 20);
    expect(mockApi.get).toHaveBeenCalledWith(
      "/reviews/user/u1/public?page=1&limit=20",
    );
  });

  it("createReview posts review data", async () => {
    mockApi.post.mockResolvedValue({ id: "r1" });
    const data = {
      bookingId: "b1",
      reviewType: "RENTER_TO_OWNER" as const,
      overallRating: 5,
      comment: "Great!",
    };
    await reviewsApi.createReview(data);
    expect(mockApi.post).toHaveBeenCalledWith("/reviews", data);
  });

  it("updateReview patches review", async () => {
    mockApi.patch.mockResolvedValue({ id: "r1" });
    await reviewsApi.updateReview("r1", { overallRating: 4 });
    expect(mockApi.patch).toHaveBeenCalledWith("/reviews/r1", {
      overallRating: 4,
    });
  });

  it("deleteReview sends delete", async () => {
    mockApi.delete.mockResolvedValue(undefined);
    await reviewsApi.deleteReview("r1");
    expect(mockApi.delete).toHaveBeenCalledWith("/reviews/r1");
  });
});

describe("usersApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getUserById fetches public user", async () => {
    mockApi.get.mockResolvedValue({ id: "u1", firstName: "Ram" });
    const result = await usersApi.getUserById("u1");
    expect(mockApi.get).toHaveBeenCalledWith("/users/u1");
    expect(result.firstName).toBe("Ram");
  });

  it("getCurrentUser fetches /users/me", async () => {
    mockApi.get.mockResolvedValue({ id: "u1", email: "u@t.np" });
    const result = await usersApi.getCurrentUser();
    expect(mockApi.get).toHaveBeenCalledWith("/users/me");
    expect(result.email).toBe("u@t.np");
  });

  it("getUserStats fetches stats", async () => {
    mockApi.get.mockResolvedValue({
      listingsCount: 5,
      bookingsAsRenter: 10,
      averageRating: 4.5,
    });
    const result = await usersApi.getUserStats();
    expect(mockApi.get).toHaveBeenCalledWith("/users/me/stats");
    expect(result.listingsCount).toBe(5);
  });

  it("updateCurrentUser patches /users/me", async () => {
    mockApi.patch.mockResolvedValue({ id: "u1", firstName: "Sita" });
    const result = await usersApi.updateCurrentUser({ firstName: "Sita" } as any);
    expect(mockApi.patch).toHaveBeenCalledWith("/users/me", {
      firstName: "Sita",
    });
    expect(result.firstName).toBe("Sita");
  });

  it("deleteAccount sends delete", async () => {
    mockApi.delete.mockResolvedValue({ message: "Account deleted" });
    const result = await usersApi.deleteAccount();
    expect(mockApi.delete).toHaveBeenCalledWith("/users/me");
    expect(result.message).toBe("Account deleted");
  });

  it("upgradeToOwner posts upgrade", async () => {
    mockApi.post.mockResolvedValue({ id: "u1", role: "OWNER" });
    const result = await usersApi.upgradeToOwner();
    expect(mockApi.post).toHaveBeenCalledWith("/users/upgrade-to-owner");
    expect(result.role).toBe("OWNER");
  });
});
