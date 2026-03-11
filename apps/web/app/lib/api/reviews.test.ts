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

import { reviewsApi } from "~/lib/api/reviews";

describe("reviewsApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getReviewsForListing with defaults", async () => {
    mockApi.get.mockResolvedValue({ reviews: [] });
    await reviewsApi.getReviewsForListing("l1");
    expect(mockApi.get).toHaveBeenCalledWith("/reviews/listing/l1?page=1&limit=10");
  });

  it("getReviewsForListing with custom page/limit", async () => {
    mockApi.get.mockResolvedValue({ reviews: [] });
    await reviewsApi.getReviewsForListing("l1", 2, 5);
    expect(mockApi.get).toHaveBeenCalledWith("/reviews/listing/l1?page=2&limit=5");
  });

  it("getUserReviews received", async () => {
    mockApi.get.mockResolvedValue({ reviews: [] });
    await reviewsApi.getUserReviews("u1", "received");
    expect(mockApi.get).toHaveBeenCalledWith("/reviews/user/u1?type=received&page=1&limit=10");
  });

  it("getUserReviews given with page", async () => {
    mockApi.get.mockResolvedValue({ reviews: [] });
    await reviewsApi.getUserReviews("u1", "given", 3, 20);
    expect(mockApi.get).toHaveBeenCalledWith("/reviews/user/u1?type=given&page=3&limit=20");
  });

  it("getPublicUserReviews", async () => {
    mockApi.get.mockResolvedValue({ reviews: [] });
    await reviewsApi.getPublicUserReviews("u1");
    expect(mockApi.get).toHaveBeenCalledWith("/reviews/user/u1/public?page=1&limit=10");
  });

  it("createReview", async () => {
    const data = { bookingId: "b1", reviewType: "RENTER_TO_OWNER" as const, overallRating: 5, comment: "Great" };
    mockApi.post.mockResolvedValue({ id: "r1" });
    await reviewsApi.createReview(data);
    expect(mockApi.post).toHaveBeenCalledWith("/reviews", data);
  });

  it("updateReview", async () => {
    mockApi.patch.mockResolvedValue({ id: "r1" });
    await reviewsApi.updateReview("r1", { overallRating: 4 });
    expect(mockApi.patch).toHaveBeenCalledWith("/reviews/r1", { overallRating: 4 });
  });

  it("deleteReview", async () => {
    mockApi.delete.mockResolvedValue(undefined);
    await reviewsApi.deleteReview("r1");
    expect(mockApi.delete).toHaveBeenCalledWith("/reviews/r1");
  });
});
