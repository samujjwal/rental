// ============================================================================
// Review Types
// Shared contract for review data between frontend and backend
// ============================================================================

import { ReviewType } from './enums';

/** Full review record (as returned by API) */
export interface Review {
  id: string;
  bookingId: string;
  reviewerId: string;
  revieweeId: string;
  listingId?: string;
  rating?: number;
  overallRating?: number;
  comment: string;
  response?: string;
  responseAt?: string;
  status: 'DRAFT' | 'PUBLISHED' | 'HIDDEN';
  type: 'LISTING_REVIEW' | 'RENTER_REVIEW' | 'OWNER_REVIEW';
  reviewer: {
    id: string;
    firstName: string;
    lastName: string | null;
    profilePhotoUrl: string | null;
  };
  reviewee: {
    id: string;
    firstName: string;
    lastName: string | null;
    profilePhotoUrl: string | null;
  };
  listing?: {
    id: string;
    title: string;
    images: string[];
  };
  booking?: {
    id: string;
    startDate: string;
    endDate: string;
  };
  createdAt: string;
  updatedAt: string;
}

/** Review statistics */
export interface ReviewStats {
  totalReviews: number;
  averageRating: number;
  ratings: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  received: number;
  given: number;
}

/** Review list response */
export interface ReviewListResponse {
  reviews: Review[];
  total: number;
  stats?: {
    totalReviews: number;
    averageRating: number;
    ratings: {
      1: number;
      2: number;
      3: number;
      4: number;
      5: number;
    };
    pending: number;
  };
}

/** Review response (owner reply to review) */
export interface ReviewResponse {
  reviewId: string;
  response: string;
}

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
  distribution: Record<number, number>;
  categoryAverages?: ReviewRatingCategories;
}
