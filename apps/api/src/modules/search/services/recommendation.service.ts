import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';

export interface RecommendedListing {
  id: string;
  title: string;
  slug: string;
  basePrice: number | null;
  photos: string[];
  city: string | null;
  averageRating: number | null;
  totalReviews: number;
  score: number;
  reason: string;
}

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get personalized recommendations for a user using collaborative filtering.
   *
   * Algorithm:
   * 1. Get user's interacted listings (booked + favorited)
   * 2. Find similar users who interacted with the same listings
   * 3. Get listings those similar users interacted with that current user hasn't seen
   * 4. Rank by overlap score (how many similar users interacted)
   * 5. Fall back to popular listings if not enough data
   */
  async getRecommendations(
    userId: string,
    limit: number = 20,
  ): Promise<{ recommendations: RecommendedListing[]; strategy: string }> {
    try {
      // Step 1: Get user's interacted listing IDs (bookings + favorites)
      const [userBookings, userFavorites] = await Promise.all([
        this.prisma.booking.findMany({
          where: { renterId: userId },
          select: { listingId: true },
          distinct: ['listingId'],
        }),
        this.prisma.favoriteListing.findMany({
          where: { userId },
          select: { listingId: true },
        }),
      ]);

      const userListingIds = new Set([
        ...userBookings.map((b) => b.listingId),
        ...userFavorites.map((f) => f.listingId),
      ]);

      if (userListingIds.size === 0) {
        // No interactions — fall back to popular listings
        return this.getPopularRecommendations(userId, limit);
      }

      const interactedIds = Array.from(userListingIds);

      // Step 2: Find similar users (who booked/favorited the same listings)
      const [similarByBooking, similarByFavorite] = await Promise.all([
        this.prisma.booking.findMany({
          where: {
            listingId: { in: interactedIds },
            renterId: { not: userId },
          },
          select: { renterId: true, listingId: true },
        }),
        this.prisma.favoriteListing.findMany({
          where: {
            listingId: { in: interactedIds },
            userId: { not: userId },
          },
          select: { userId: true, listingId: true },
        }),
      ]);

      // Count overlap per similar user
      const userOverlap = new Map<string, number>();
      for (const b of similarByBooking) {
        userOverlap.set(b.renterId, (userOverlap.get(b.renterId) || 0) + 1);
      }
      for (const f of similarByFavorite) {
        userOverlap.set(f.userId, (userOverlap.get(f.userId) || 0) + 1);
      }

      if (userOverlap.size === 0) {
        return this.getPopularRecommendations(userId, limit);
      }

      // Sort by overlap and take top 50 similar users
      const similarUserIds = Array.from(userOverlap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 50)
        .map(([uid]) => uid);

      // Step 3: Get listings those similar users interacted with
      const [candidateBookings, candidateFavorites] = await Promise.all([
        this.prisma.booking.findMany({
          where: {
            renterId: { in: similarUserIds },
            listingId: { notIn: interactedIds },
          },
          select: { listingId: true, renterId: true },
        }),
        this.prisma.favoriteListing.findMany({
          where: {
            userId: { in: similarUserIds },
            listingId: { notIn: interactedIds },
          },
          select: { listingId: true, userId: true },
        }),
      ]);

      // Step 4: Score candidate listings by weighted overlap
      const listingScores = new Map<string, number>();
      for (const b of candidateBookings) {
        const overlap = userOverlap.get(b.renterId) || 1;
        // Bookings weighted 2x over favorites
        listingScores.set(b.listingId, (listingScores.get(b.listingId) || 0) + overlap * 2);
      }
      for (const f of candidateFavorites) {
        const overlap = userOverlap.get(f.userId) || 1;
        listingScores.set(f.listingId, (listingScores.get(f.listingId) || 0) + overlap);
      }

      // Sort by score, take top N+buffer for filtering
      const rankedIds = Array.from(listingScores.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit + 10)
        .map(([id]) => id);

      if (rankedIds.length === 0) {
        return this.getPopularRecommendations(userId, limit);
      }

      // Step 5: Fetch listing details (only available ones)
      const listings = await this.prisma.listing.findMany({
        where: {
          id: { in: rankedIds },
          status: 'AVAILABLE',
        },
        select: {
          id: true,
          title: true,
          slug: true,
          basePrice: true,
          photos: true,
          city: true,
          averageRating: true,
          totalReviews: true,
        },
      });

      // Preserve score ordering
      const listingMap = new Map(listings.map((l) => [l.id, l]));
      const recommendations: RecommendedListing[] = rankedIds
        .filter((id) => listingMap.has(id))
        .slice(0, limit)
        .map((id) => {
          const l = listingMap.get(id)!;
          return {
            ...l,
            basePrice: l.basePrice != null ? Number(l.basePrice) : null,
            score: listingScores.get(id) || 0,
            reason: 'Based on your bookings and favorites',
          };
        });

      // If not enough, pad with popular
      if (recommendations.length < limit) {
        const popular = await this.getPopularRecommendations(
          userId,
          limit - recommendations.length,
          [...interactedIds, ...rankedIds],
        );
        recommendations.push(...popular.recommendations);
      }

      return { recommendations, strategy: 'collaborative' };
    } catch (error) {
      this.logger.error('Recommendation engine failed, falling back to popular', error);
      return this.getPopularRecommendations(userId, limit);
    }
  }

  /**
   * Fallback: return popular listings the user hasn't interacted with.
   */
  private async getPopularRecommendations(
    userId: string,
    limit: number,
    excludeIds: string[] = [],
  ): Promise<{ recommendations: RecommendedListing[]; strategy: string }> {
    // Get user's interacted IDs to exclude
    const userFavorites = await this.prisma.favoriteListing.findMany({
      where: { userId },
      select: { listingId: true },
    });
    const userBookings = await this.prisma.booking.findMany({
      where: { renterId: userId },
      select: { listingId: true },
      distinct: ['listingId'],
    });

    const allExcluded = [
      ...new Set([
        ...excludeIds,
        ...userFavorites.map((f) => f.listingId),
        ...userBookings.map((b) => b.listingId),
      ]),
    ];

    const where: any = {
      status: 'AVAILABLE',
      ownerId: { not: userId },
    };
    if (allExcluded.length > 0) {
      where.id = { notIn: allExcluded };
    }

    const listings = await this.prisma.listing.findMany({
      where,
      orderBy: [
        { totalReviews: 'desc' },
        { averageRating: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
      select: {
        id: true,
        title: true,
        slug: true,
        basePrice: true,
        photos: true,
        city: true,
        averageRating: true,
        totalReviews: true,
      },
    });

    return {
      recommendations: listings.map((l) => ({
        ...l,
        basePrice: l.basePrice != null ? Number(l.basePrice) : null,
        score: 0,
        reason: 'Popular in your area',
      })),
      strategy: 'popular',
    };
  }
}
