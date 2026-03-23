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

import { paymentsApi } from "~/lib/api/payments";

describe("paymentsApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createPaymentIntent", async () => {
    mockApi.post.mockResolvedValue({ clientSecret: "cs" });
    const result = await paymentsApi.createPaymentIntent("b1");
    expect(mockApi.post).toHaveBeenCalledWith("/payments/intents/b1");
    expect(result.clientSecret).toBe("cs");
  });

  it("getBookingPaymentStatus", async () => {
    mockApi.get.mockResolvedValue({ confirmationState: "processing" });
    const result = await paymentsApi.getBookingPaymentStatus("b1");
    expect(mockApi.get).toHaveBeenCalledWith("/payments/bookings/b1/status");
    expect(result.confirmationState).toBe("processing");
  });

  it("getPaymentHistory returns transactions array", async () => {
    mockApi.get.mockResolvedValue({ transactions: [{ id: "t1" }] });
    const result = await paymentsApi.getPaymentHistory();
    expect(mockApi.get).toHaveBeenCalledWith("/payments/transactions");
    expect(result).toEqual([{ id: "t1" }]);
  });

  it("getPaymentHistory returns empty array when no transactions field", async () => {
    mockApi.get.mockResolvedValue({});
    const result = await paymentsApi.getPaymentHistory();
    expect(result).toEqual([]);
  });

  it("getOwnerEarnings", async () => {
    mockApi.get.mockResolvedValue({ amount: 5000, currency: "NPR" });
    const result = await paymentsApi.getOwnerEarnings();
    expect(mockApi.get).toHaveBeenCalledWith("/payments/earnings");
    expect(result.amount).toBe(5000);
  });

  it("getEarningsSummary", async () => {
    mockApi.get.mockResolvedValue({ thisMonth: 100, lastMonth: 200, total: 300, currency: "NPR" });
    await paymentsApi.getEarningsSummary();
    expect(mockApi.get).toHaveBeenCalledWith("/payments/earnings/summary");
  });

  it("getTransactions without params", async () => {
    mockApi.get.mockResolvedValue({ transactions: [], total: 0 });
    await paymentsApi.getTransactions();
    expect(mockApi.get).toHaveBeenCalledWith("/payments/transactions");
  });

  it("getTransactions with filters appends query string", async () => {
    mockApi.get.mockResolvedValue({ transactions: [], total: 0 });
    await paymentsApi.getTransactions({ page: 2, type: "PAYMENT", status: "POSTED" });
    const url = mockApi.get.mock.calls[0][0] as string;
    expect(url).toContain("page=2");
    expect(url).toContain("type=PAYMENT");
    expect(url).toContain("status=POSTED");
  });

  it("getBalance", async () => {
    mockApi.get.mockResolvedValue({ balance: 1000, currency: "NPR" });
    await paymentsApi.getBalance();
    expect(mockApi.get).toHaveBeenCalledWith("/payments/balance");
  });

  it("requestPayout", async () => {
    mockApi.post.mockResolvedValue({ id: "p1", amount: 500 });
    await paymentsApi.requestPayout({ amount: 500 });
    expect(mockApi.post).toHaveBeenCalledWith("/payments/payouts", { amount: 500 });
  });

  it("getPayouts with status filter", async () => {
    mockApi.get.mockResolvedValue([{ id: "p1" }]);
    const result = await paymentsApi.getPayouts({ status: "COMPLETED" });
    const url = mockApi.get.mock.calls[0][0] as string;
    expect(url).toContain("status=COMPLETED");
    expect(result.payouts).toEqual([{ id: "p1" }]);
  });

  it("getPayouts wraps non-array response in payouts field", async () => {
    mockApi.get.mockResolvedValue("not-an-array");
    const result = await paymentsApi.getPayouts();
    expect(result.payouts).toEqual([]);
  });
});
