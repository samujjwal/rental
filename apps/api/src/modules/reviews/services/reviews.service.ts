import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';
import { Review, ReviewType } from '@rental-portal/database';

export interface CreateReviewDto {
  bookingId: string;
  reviewType: ReviewType;
  overallRating: number;
  accuracyRating?: number;
  communicationRating?: number;
  cleanlinessRating?: number;
  locationRating?: number;
  valueRating?: number;
  comment?: string;
  privateComment?: string;
}

export interface UpdateReviewDto extends Partial<
  Omit<CreateReviewDto, 'bookingId' | 'reviewType'>
> {}

export interface ReviewResponse extends Review {
  reviewer?: {
    id: string;
    firstName: string;
    lastName: string;
    profilePhotoUrl?: string;
  };
  reviewee?: {
    id: string;
    firstName: string;
    lastName: string;
    profilePhotoUrl?: string;
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
    // Validate booking exists and is completed
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

    if (!['COMPLETED', 'SETTLED'].includes(booking.status)) {
      throw new BadRequestException('Can only review completed bookings');
    }

    // Determine reviewer and reviewee
    let reviewerId: string;
    let revieweeId: string;
    let listingId: string | null = null;

    if (dto.reviewType === ReviewType.RENTER_TO_OWNER) {
      if (booking.renterId !== userId) {
        throw new ForbiddenException('Only the renter can review the owner');
      }
      reviewerId = booking.renterId;
      revieweeId = booking.listing.ownerId;
      listingId = booking.listingId;
    } else if (dto.reviewType === ReviewType.OWNER_TO_RENTER) {
      if (booking.listing.ownerId !== userId) {
        throw new ForbiddenException('Only the owner can review the renter');
      }
      reviewerId = booking.listing.ownerId;
      revieweeId = booking.renterId;
    } else {
      throw new BadRequestException('Invalid review type');
    }

    // Check if review already exists
    const existingReview = await this.prisma.review.findFirst({
      where: {
        bookingId: dto.bookingId,
        reviewType: dto.reviewType,
      },
    });

    if (existingReview) {
      throw new BadRequestException('Review already exists for this booking');
    }

    // Validate ratings
    this.validateRatings(dto);

    // Create review
    const review = await this.prisma.review.create({
      data: {
        bookingId: dto.bookingId,
        listingId,
        reviewerId,
        revieweeId,
        reviewType: dto.reviewType,
        overallRating: dto.overallRating,
        accuracyRating: dto.accuracyRating,
        communicationRating: dto.communicationRating,
        cleanlinessRating: dto.cleanlinessRating,
        locationRating: dto.locationRating,
        valueRating: dto.valueRating,
        comment: dto.comment,
        privateComment: dto.privateComment,
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

    // Update aggregated ratings
    await this.updateAggregatedRatings(revieweeId, listingId);

    // Invalidate caches
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

    // Check if review is still editable (within 7 days)
    const daysSinceCreation = Math.floor(
      (Date.now() - review.createdAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysSinceCreation > 7) {
      throw new BadRequestException('Reviews can only be edited within 7 days');
    }

    // Validate ratings if provided
    if (dto.overallRating !== undefined) {
      this.validateRatings(dto as any);
    }

    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: dto,
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

    // Update aggregated ratings
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

    // Update aggregated ratings
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
          reviewType: ReviewType.RENTER_TO_OWNER,
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
          reviewType: ReviewType.RENTER_TO_OWNER,
        },
      }),
      this.prisma.review.groupBy({
        by: ['overallRating'],
        where: {
          listingId,
          reviewType: ReviewType.RENTER_TO_OWNER,
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
      ratingDistribution[stat.overallRating] = stat._count;
    });

    const avgRating = await this.prisma.review.aggregate({
      where: {
        listingId,
        reviewType: ReviewType.RENTER_TO_OWNER,
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
    reviewType?: ReviewType;
    reason?: string;
  }> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { listing: true },
    });

    if (!booking) {
      return { canReview: false, reason: 'Booking not found' };
    }

    if (!['COMPLETED', 'SETTLED'].includes(booking.status)) {
      return { canReview: false, reason: 'Booking not completed' };
    }

    let reviewType: ReviewType;
    if (booking.renterId === userId) {
      reviewType = ReviewType.RENTER_TO_OWNER;
    } else if (booking.listing.ownerId === userId) {
      reviewType = ReviewType.OWNER_TO_RENTER;
    } else {
      return { canReview: false, reason: 'Not part of this booking' };
    }

    // Check if already reviewed
    const existingReview = await this.prisma.review.findFirst({
      where: {
        bookingId,
        reviewType,
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
      dto.locationRating,
      dto.valueRating,
    ].filter((r) => r !== undefined);

    for (const rating of ratings) {
      if (rating < 1 || rating > 5) {
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
          reviewType: ReviewType.RENTER_TO_OWNER,
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
