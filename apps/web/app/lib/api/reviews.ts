import { api } from '~/lib/api-client';
import type { Review } from '~/types/review';

export interface CreateReviewRequest {
  bookingId: string;
  rating: number;
  comment: string;
}

export const reviewsApi = {
  async getReviewsForListing(listingId: string): Promise<Review[]> {
    return api.get<Review[]>(`/reviews/listing/${listingId}`);
  },

  async getReviewsForUser(userId: string): Promise<Review[]> {
    return api.get<Review[]>(`/reviews/user/${userId}`);
  },

  async getReviewsByReviewer(reviewerId: string): Promise<Review[]> {
    return api.get<Review[]>(`/reviews/reviewer/${reviewerId}`);
  },

  async createReview(data: CreateReviewRequest): Promise<Review> {
    return api.post<Review>('/reviews', data);
  },

  async updateReview(reviewId: string, data: Partial<CreateReviewRequest>): Promise<Review> {
    return api.put<Review>(`/reviews/${reviewId}`, data);
  },

  async deleteReview(reviewId: string): Promise<void> {
    return api.delete(`/reviews/${reviewId}`);
  },
};
