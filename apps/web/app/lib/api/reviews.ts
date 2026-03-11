import { api } from "~/lib/api-client";
import type { Review, ReviewListResponse } from "~/types/review";

export interface CreateReviewRequest {
  bookingId: string;
  reviewType: "RENTER_TO_OWNER" | "OWNER_TO_RENTER";
  overallRating: number;
  comment?: string;
}

export const reviewsApi = {
  async getReviewsForListing(listingId: string, page: number = 1, limit: number = 10): Promise<ReviewListResponse> {
    return api.get<ReviewListResponse>(`/reviews/listing/${listingId}?page=${page}&limit=${limit}`);
  },

  async getUserReviews(
    userId: string,
    type: "received" | "given",
    page: number = 1,
    limit: number = 10,
    rating?: number
  ): Promise<ReviewListResponse> {
    const params = new URLSearchParams({ type, page: String(page), limit: String(limit) });
    if (rating) params.set("rating", String(rating));
    return api.get<ReviewListResponse>(`/reviews/user/${userId}?${params}`);
  },

  async getPublicUserReviews(
    userId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<ReviewListResponse> {
    return api.get<ReviewListResponse>(`/reviews/user/${userId}/public?page=${page}&limit=${limit}`);
  },

  async createReview(data: CreateReviewRequest): Promise<Review> {
    return api.post<Review>("/reviews", data);
  },

  async updateReview(
    reviewId: string,
    data: Partial<CreateReviewRequest>
  ): Promise<Review> {
    return api.patch<Review>(`/reviews/${reviewId}`, data);
  },

  async deleteReview(reviewId: string): Promise<void> {
    return api.delete(`/reviews/${reviewId}`);
  },

};
