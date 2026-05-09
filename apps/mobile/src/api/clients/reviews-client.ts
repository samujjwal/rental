/**
 * Reviews Client
 * 
 * Handles all review-related API endpoints:
 * - Create reviews
 * - Get reviews for listings and users
 * - Review statistics
 */

import type { ReviewResponse } from '~/types';
import { BaseClient } from './base-client';

export class ReviewsClient extends BaseClient {
  /**
   * Get reviews for a listing
   */
  async getListingReviews(listingId: string, page: number = 1, limit: number = 10): Promise<{
    reviews: ReviewResponse[];
    total: number;
    averageRating: number;
    ratingDistribution: Record<number, number>;
  }> {
    return this.request<any>(`/reviews/listing/${listingId}?page=${page}&limit=${limit}`);
  }

  /**
   * Get user's reviews (received or given)
   */
  async getUserReviews(
    userId: string,
    type: 'received' | 'given' = 'received',
    page: number = 1,
    limit: number = 10,
  ): Promise<{ reviews: ReviewResponse[]; total: number }> {
    return this.request<any>(
      `/reviews/user/${encodeURIComponent(userId)}?type=${type}&page=${page}&limit=${limit}`,
    );
  }

  /**
   * Create a new review
   */
  async createReview(payload: {
    bookingId: string;
    reviewType: 'RENTER_TO_OWNER' | 'OWNER_TO_RENTER';
    overallRating: number;
    accuracyRating?: number;
    communicationRating?: number;
    cleanlinessRating?: number;
    valueRating?: number;
    comment?: string;
  }): Promise<ReviewResponse> {
    return this.request<ReviewResponse>('/reviews', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}
