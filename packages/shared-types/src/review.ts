// ============================================================================
// Review Types
// Shared contract for review data between frontend and backend
// ============================================================================

import { ReviewType } from './enums';

/** Rating categories */
export interface ReviewRatingCategories {
  accuracy?: number;
  communication?: number;
  cleanliness?: number;
  value?: number;
}

/** Create review input */
export interface CreateReviewInput {
  bookingId: string;
  rating: number;
  comment: string;
  categories?: ReviewRatingCategories;
  direction?: 'RENTER_TO_LISTING' | 'OWNER_TO_RENTER';
}

/** Update review input */
export interface UpdateReviewInput {
  rating?: number;
  comment?: string;
  categories?: ReviewRatingCategories;
}

/** Review summary */
export interface ReviewSummary {
  id: string;
  bookingId: string;
  reviewerId: string;
  reviewerName: string;
  reviewerAvatar?: string;
  rating: number;
  comment: string;
  type?: ReviewType | string;
  categories?: ReviewRatingCategories;
  createdAt: string;
  updatedAt?: string;
}

/** Aggregate rating stats */
export interface RatingStats {
  averageRating: number;
  totalReviews: number;
  distribution: Record<number, number>; // { 5: 20, 4: 15, 3: 5, 2: 1, 1: 0 }
  categoryAverages?: ReviewRatingCategories;
}
