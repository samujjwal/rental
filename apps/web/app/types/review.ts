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
  status: "DRAFT" | "PUBLISHED" | "HIDDEN";
  type: "LISTING_REVIEW" | "RENTER_REVIEW" | "OWNER_REVIEW";
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

export interface CreateReviewRequest {
  bookingId: string;
  rating: number;
  comment: string;
}

export interface ReviewListResponse {
  reviews: Review[];
  total: number;
}

export interface ReviewResponse {
  reviewId: string;
  response: string;
}
