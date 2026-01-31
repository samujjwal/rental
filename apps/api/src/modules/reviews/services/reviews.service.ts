import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CacheService } from '../../../common/cache/cache.service';
import { Review, ReviewType } from '@rental-portal/database';

export enum ReviewDirection {
  RENTER_TO_OWNER = 'RENTER_TO_OWNER',
  OWNER_TO_RENTER = 'OWNER_TO_RENTER',
}

export interface CreateReviewDto {
  bookingId: string;
  reviewType: ReviewDirection;
  overallRating: number;
  accuracyRating?: number;
  communicationRating?: number;
  cleanlinessRating?: number;
  valueRating?: number;
  comment?: string;
}

export interface UpdateReviewDto extends Partial<
  Omit<CreateReviewDto, 'bookingId' | 'reviewType'>
> {}

export interface ReviewResponse extends Review {
  reviewer?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    profilePhotoUrl?: string | null;
  };
  reviewee?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    profilePhotoUrl?: string | null;
  };
  listing?: {
    id: string;
    title: string;
    slug: string;
  };
}

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async create(userId: string, dto: CreateReviewDto): Promise<ReviewResponse> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      include: {
        listing: {
          include: { owner: true },
        },
        renter: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Strict check for completed bookings, but allowing CONFIRMED/SETTLED for broader logic if needed
    // Typically reviews happen after completion.
    if (!['COMPLETED', 'SETTLED'].includes(booking.status)) {
      throw new BadRequestException('Can only review completed bookings');
    }

    let reviewerId: string;
    let revieweeId: string;
    let listingId: string;
    let dbReviewType: ReviewType;

    if (dto.reviewType === ReviewDirection.RENTER_TO_OWNER) {
      if (booking.renterId !== userId) {
        throw new ForbiddenException('Only the renter can review the owner');
      }
      reviewerId = booking.renterId;
      revieweeId = booking.listing.ownerId;
      listingId = booking.listingId;
      dbReviewType = ReviewType.LISTING_REVIEW;
    } else if (dto.reviewType === ReviewDirection.OWNER_TO_RENTER) {
      if (booking.listing.ownerId !== userId) {
        throw new ForbiddenException('Only the owner can review the renter');
      }
      reviewerId = booking.listing.ownerId;
      revieweeId = booking.renterId;
      listingId = booking.listingId;
      dbReviewType = ReviewType.RENTER_REVIEW;
    } else {
      throw new BadRequestException('Invalid review type');
    }

    const existingReview = await this.prisma.review.findFirst({
      where: {
        bookingId: dto.bookingId,
        reviewerId: reviewerId,
        type: dbReviewType,
      },
    });

    if (existingReview) {
      throw new BadRequestException('Review already exists for this booking');
    }

    this.validateRatings(dto);

    const review = await this.prisma.review.create({
      data: {
        bookingId: dto.bookingId,
        reviewerId,
        revieweeId,
        type: dbReviewType,
        rating: dto.overallRating,
        comment: dto.comment || '',
      },
      include: {
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhotoUrl: true,
          },
        },
        reviewee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhotoUrl: true,
          },
        },
        listing: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    });

    await this.updateAggregatedRatings(revieweeId, listingId);

    await this.cacheService.del(`user:${revieweeId}`);
    if (listingId) {
      await this.cacheService.del(`listing:${listingId}`);
    }

    return review;
  }

  async update(reviewId: string, userId: string, dto: UpdateReviewDto): Promise<ReviewResponse> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.reviewerId !== userId) {
      throw new ForbiddenException('Can only update your own reviews');
    }

    const daysSinceCreation = Math.floor(
      (Date.now() - review.createdAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysSinceCreation > 7) {
      throw new BadRequestException('Reviews can only be edited within 7 days');
    }

    if (dto.overallRating !== undefined) {
      this.validateRatings(dto as any);
    }

    const { comment, ...ratings } = dto;

    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: {
        ...ratings,
        content: comment,
      },
      include: {
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhotoUrl: true,
          },
        },
        reviewee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhotoUrl: true,
          },
        },
        listing: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    });

    await this.updateAggregatedRatings(review.revieweeId, review.listingId);

    return updated;
  }

  async delete(reviewId: string, userId: string): Promise<void> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.reviewerId !== userId) {
      throw new ForbiddenException('Can only delete your own reviews');
    }

    await this.prisma.review.delete({
      where: { id: reviewId },
    });

    await this.updateAggregatedRatings(review.revieweeId, review.listingId);
  }

  async getReview(reviewId: string): Promise<ReviewResponse> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhotoUrl: true,
          },
        },
        reviewee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhotoUrl: true,
          },
        },
        listing: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return review;
  }

  async getListingReviews(
    listingId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    reviews: ReviewResponse[];
    total: number;
    averageRating: number;
    ratingDistribution: Record<number, number>;
  }> {
    const [reviews, total, stats] = await Promise.all([
      this.prisma.review.findMany({
        where: {
          listingId,
          type: ReviewType.LISTING_REVIEW,
        },
        include: {
          reviewer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePhotoUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.review.count({
        where: {
          listingId,
          type: ReviewType.LISTING_REVIEW,
        },
      }),
      this.prisma.review.groupBy({
        by: ['overallRating'],
        where: {
          listingId,
          type: ReviewType.LISTING_REVIEW,
        },
        _count: true,
      }),
    ]);

    const ratingDistribution: Record<number, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };

    stats.forEach((stat) => {
      const rating = Math.round(stat.overallRating ?? 0);
      if (rating >= 1 && rating <= 5) {
        ratingDistribution[rating] = stat._count;
      }
    });

    const avgRating = await this.prisma.review.aggregate({
      where: {
        listingId,
        type: ReviewType.LISTING_REVIEW,
      },
      _avg: { overallRating: true },
    });

    return {
      reviews: reviews as any,
      total,
      averageRating: avgRating._avg.overallRating || 0,
      ratingDistribution,
    };
  }

  async getUserReviews(
    userId: string,
    type: 'received' | 'given',
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    reviews: ReviewResponse[];
    total: number;
  }> {
    const where = type === 'received' ? { revieweeId: userId } : { reviewerId: userId };

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: {
          reviewer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePhotoUrl: true,
            },
          },
          reviewee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePhotoUrl: true,
            },
          },
          listing: {
            select: {
              id: true,
              title: true,
              slug: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      reviews: reviews as any,
      total,
    };
  }

  async getBookingReviews(bookingId: string) {
    return this.prisma.review.findMany({
      where: { bookingId },
      include: {
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhotoUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async canUserReviewBooking(
    userId: string,
    bookingId: string,
  ): Promise<{
    canReview: boolean;
    reviewType?: ReviewDirection;
    reason?: string;
  }> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { listing: true },
    });

    if (!booking) {
      return { canReview: false, reason: 'Booking not found' };
    }

    if (!['COMPLETED', 'SETTLED', 'CONFIRMED'].includes(booking.status)) {
      // In prod: COMPLETED, SETTLED
      return { canReview: false, reason: 'Booking not completed' };
    }

    let reviewType: ReviewDirection;
    let limitType: ReviewType;

    if (booking.renterId === userId) {
      reviewType = ReviewDirection.RENTER_TO_OWNER;
      limitType = ReviewType.LISTING_REVIEW;
    } else if (booking.listing.ownerId === userId) {
      reviewType = ReviewDirection.OWNER_TO_RENTER;
      limitType = ReviewType.RENTER_REVIEW;
    } else {
      return { canReview: false, reason: 'Not part of this booking' };
    }

    const existingReview = await this.prisma.review.findFirst({
      where: {
        bookingId,
        reviewerId: userId,
        type: limitType,
      },
    });

    if (existingReview) {
      return { canReview: false, reason: 'Already reviewed' };
    }

    return { canReview: true, reviewType };
  }

  private validateRatings(dto: Partial<CreateReviewDto>) {
    const ratings = [
      dto.overallRating,
      dto.accuracyRating,
      dto.communicationRating,
      dto.cleanlinessRating,
      dto.valueRating,
    ].filter((r) => r !== undefined);

    for (const rating of ratings) {
      if (typeof rating === 'number' && (rating < 1 || rating > 5)) {
        throw new BadRequestException('Ratings must be between 1 and 5');
      }
    }
  }

  private async updateAggregatedRatings(userId: string, listingId: string | null) {
    // Update user average rating
    const userStats = await this.prisma.review.aggregate({
      where: { revieweeId: userId },
      _avg: { overallRating: true },
      _count: true,
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        averageRating: userStats._avg.overallRating || 0,
        totalReviews: userStats._count,
      },
    });

    // Update listing average rating if applicable
    if (listingId) {
      const listingStats = await this.prisma.review.aggregate({
        where: {
          listingId,
          type: ReviewType.LISTING_REVIEW,
        },
        _avg: { overallRating: true },
        _count: true,
      });

      await this.prisma.listing.update({
        where: { id: listingId },
        data: {
          averageRating: listingStats._avg.overallRating || 0,
          totalReviews: listingStats._count,
        },
      });
    }
  }
}
