import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { i18nNotFound,i18nForbidden,i18nBadRequest } from '@/common/errors/i18n-exceptions';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CacheService } from '../../../common/cache/cache.service';
import { Review, ReviewType } from '@rental-portal/database';
import { ContentModerationService } from '../../moderation/services/content-moderation.service';

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

export type UpdateReviewDto = Partial<
  Omit<CreateReviewDto, 'bookingId' | 'reviewType'>
>;

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
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly moderationService: ContentModerationService,
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
      throw i18nNotFound('booking.notFound');
    }

    // Strict check for completed bookings, but allowing CONFIRMED/SETTLED for broader logic if needed
    // Typically reviews happen after completion.
    if (!['COMPLETED', 'SETTLED'].includes(booking.status)) {
      throw i18nBadRequest('review.completedOnly');
    }

    // Enforce 30-day review window — reviews after the completion date are no longer meaningful
    const REVIEW_WINDOW_DAYS = 30;
    const completedAt = booking.updatedAt; // updatedAt reflects the last status change (completion)
    const cutoff = new Date(Date.now() - REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    if (completedAt < cutoff) {
      throw i18nBadRequest('review.windowExpired');
    }

    let reviewerId: string;
    let revieweeId: string;
    let listingId: string;
    let dbReviewType: ReviewType;

    if (dto.reviewType === ReviewDirection.RENTER_TO_OWNER) {
      if (booking.renterId !== userId) {
        throw i18nForbidden('review.renterOnly');
      }
      reviewerId = booking.renterId;
      revieweeId = booking.listing.ownerId;
      listingId = booking.listingId;
      dbReviewType = ReviewType.LISTING_REVIEW;
    } else if (dto.reviewType === ReviewDirection.OWNER_TO_RENTER) {
      if (booking.listing.ownerId !== userId) {
        throw i18nForbidden('review.ownerOnly');
      }
      reviewerId = booking.listing.ownerId;
      revieweeId = booking.renterId;
      listingId = booking.listingId;
      dbReviewType = ReviewType.RENTER_REVIEW;
    } else {
      throw i18nBadRequest('review.invalidType');
    }

    const existingReview = await this.prisma.review.findFirst({
      where: {
        bookingId: dto.bookingId,
        reviewerId: reviewerId,
        type: dbReviewType,
      },
    });

    if (existingReview) {
      throw i18nBadRequest('review.alreadyReviewed');
    }

    // Moderate review content before saving
    if (dto.comment) {
      try {
        const modResult = await this.moderationService.moderateReview({
          content: dto.comment,
          rating: dto.overallRating,
        });
        if (modResult.status === 'REJECTED' || modResult.status === 'FLAGGED') {
          throw new BadRequestException({
            message: 'Your review contains content that violates our policies',
            flags: modResult.flags,
          });
        }
      } catch (error) {
        if (error instanceof BadRequestException) throw error;
        this.logger.warn('Review moderation check failed, proceeding', error);
      }
    }

    this.validateRatings(dto);

    // Use transaction to ensure data consistency
    const review: ReviewResponse = await (this.prisma.$transaction(async (tx: any): Promise<ReviewResponse> => {
      const newReview = await tx.review.create({
        data: {
          bookingId: dto.bookingId,
          listingId,
          reviewerId,
          revieweeId,
          type: dbReviewType,
          rating: dto.overallRating,
          overallRating: dto.overallRating,
          accuracyRating: dto.accuracyRating,
          communicationRating: dto.communicationRating,
          cleanlinessRating: dto.cleanlinessRating,
          valueRating: dto.valueRating,
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

      // Update aggregated ratings within the same transaction
      await this.updateAggregatedRatingsInTransaction(tx, revieweeId, listingId);

      return newReview as ReviewResponse;
    }) as unknown as Promise<ReviewResponse>);

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
      throw i18nNotFound('review.notFound');
    }

    if (review.reviewerId !== userId) {
      throw i18nForbidden('review.ownOnly');
    }

    const daysSinceCreation = Math.floor(
      (Date.now() - review.createdAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysSinceCreation > 7) {
      throw i18nBadRequest('review.editWindow');
    }

    if (dto.overallRating !== undefined) {
      this.validateRatings(dto as any);
    }

    const { comment, ...ratings } = dto;

    // Moderate updated review content
    if (comment) {
      try {
        const modResult = await this.moderationService.moderateReview({
          content: comment,
          rating: dto.overallRating ?? review.overallRating,
        });
        if (modResult.status === 'REJECTED' || modResult.status === 'FLAGGED') {
          throw new BadRequestException({
            message: 'Review content violates our content policies',
            flags: modResult.flags,
          });
        }
      } catch (error) {
        if (error instanceof BadRequestException) throw error;
        // Log and proceed if moderation service fails
      }
    }

    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: {
        ...ratings,
        comment: comment,
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
      throw i18nNotFound('review.notFound');
    }

    if (review.reviewerId !== userId) {
      throw i18nForbidden('review.ownOnly');
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
      throw i18nNotFound('review.notFound');
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
    rating?: number,
  ): Promise<{
    reviews: ReviewResponse[];
    total: number;
    stats: {
      totalReviews: number;
      averageRating: number;
      ratings: Record<number, number>;
      pending: number;
    };
  }> {
    const baseWhere: any = type === 'received' ? { revieweeId: userId } : { reviewerId: userId };
    const where: any = { ...baseWhere };
    if (rating && rating >= 1 && rating <= 5) {
      where.rating = rating;
    }

    const [reviews, total, totalReviews, ratingStats, avgRating, pending] = await Promise.all([
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
              photos: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.review.count({ where }),
      this.prisma.review.count({ where: baseWhere }),
      this.prisma.review.groupBy({
        by: ['rating'],
        where: baseWhere,
        _count: true,
      }),
      this.prisma.review.aggregate({
        where: baseWhere,
        _avg: { rating: true },
      }),
      this.prisma.review.count({
        where: {
          ...baseWhere,
          status: 'DRAFT',
        },
      }),
    ]);

    const stats = {
      totalReviews,
      averageRating: avgRating._avg.rating || 0,
      ratings: {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      } as Record<number, number>,
      pending,
    };

    ratingStats.forEach((stat) => {
      const currentRating = Math.round(stat.rating ?? 0);
      if (currentRating >= 1 && currentRating <= 5) {
        stats.ratings[currentRating] = stat._count;
      }
    });

    return {
      reviews: reviews as any,
      total,
      stats,
    };
  }

  async getPublicUserReviews(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    reviews: ReviewResponse[];
    total: number;
  }> {
    const where = {
      revieweeId: userId,
      status: 'PUBLISHED' as const,
    };

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
          listing: {
            select: {
              id: true,
              title: true,
              slug: true,
              photos: true,
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

  async getBookingReviews(bookingId: string, userId?: string): Promise<any> {
    // If userId provided, verify they're a party to this booking
    if (userId) {
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        select: { renterId: true, listing: { select: { ownerId: true } } },
      });

      if (booking) {
        const isParty = booking.renterId === userId || booking.listing.ownerId === userId;
        if (!isParty) {
          // Check admin
          const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { role: true },
          });
          const adminRoles = ['ADMIN', 'SUPER_ADMIN', 'OPERATIONS_ADMIN', 'SUPPORT_ADMIN'];
          if (!user?.role || !adminRoles.includes(user.role)) {
            throw i18nForbidden('review.unauthorized');
          }
        }
      }
    }

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

    if (!['COMPLETED', 'SETTLED'].includes(booking.status)) {
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
        throw i18nBadRequest('review.invalidRating');
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

  private async updateAggregatedRatingsInTransaction(
    tx: {
      review: any;
      user: any;
      listing: any;
    },
    userId: string,
    listingId: string | null,
  ) {
    // Update user average rating within transaction
    const userStats = await tx.review.aggregate({
      where: { revieweeId: userId },
      _avg: { overallRating: true },
      _count: true,
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        averageRating: userStats._avg.overallRating || 0,
        totalReviews: userStats._count,
      },
    });

    // Update listing average rating if applicable
    if (listingId) {
      const listingStats = await tx.review.aggregate({
        where: {
          listingId,
          type: ReviewType.LISTING_REVIEW,
        },
        _avg: { overallRating: true },
        _count: true,
      });

      await tx.listing.update({
        where: { id: listingId },
        data: {
          averageRating: listingStats._avg.overallRating || 0,
          totalReviews: listingStats._count,
        },
      });
    }
  }
}
