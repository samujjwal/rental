import { api } from "~/lib/api-client";
import type { Review, ReviewListResponse } from "~/types/review";

export interface CreateReviewRequest {
  bookingId: string;
  rating: number;
  comment: string;
}

export const reviewsApi = {
  async getReviewsForListing(listingId: string): Promise<Review[]> {
    return api.get<Review[]>(`/reviews/listing/${listingId}`);
  },

  async getReviewsForUser(userId: string): Promise<ReviewListResponse> {
    return api.get<ReviewListResponse>(`/reviews/user/${userId}?type=received`);
  },

  async getReviewsByReviewer(reviewerId: string): Promise<Review[]> {
    return api.get<Review[]>(`/reviews/reviewer/${reviewerId}`);
  },

  async getReceivedReviews(): Promise<Review[]> {
    return api.get<Review[]>("/reviews/received");
  },

  async getGivenReviews(): Promise<Review[]> {
    return api.get<Review[]>("/reviews/given");
  },

  async createReview(data: CreateReviewRequest): Promise<Review> {
    return api.post<Review>("/reviews", data);
  },

  async updateReview(
    reviewId: string,
    data: Partial<CreateReviewRequest>
  ): Promise<Review> {
    return api.put<Review>(`/reviews/${reviewId}`, data);
  },

  async deleteReview(reviewId: string): Promise<void> {
    return api.delete(`/reviews/${reviewId}`);
  },

  async respondToReview(reviewId: string, response: string): Promise<Review> {
    return api.post<Review>(`/reviews/${reviewId}/respond`, { response });
  },

  async reportReview(reviewId: string, reason: string): Promise<void> {
    return api.post(`/reviews/${reviewId}/report`, { reason });
  },
};
