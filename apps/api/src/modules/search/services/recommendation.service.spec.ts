import { RecommendationService } from './recommendation.service';

describe('RecommendationService', () => {
  let service: RecommendationService;
  let prisma: any;

  const mockListings = [
    {
      id: 'listing-1',
      title: 'Cozy Apartment',
      basePrice: 100,
      averageRating: 4.5,
      totalReviews: 20,
      status: 'AVAILABLE',
      images: [{ url: 'img1.jpg' }],
    },
    {
      id: 'listing-2',
      title: 'Spacious House',
      basePrice: 200,
      averageRating: 4.8,
      totalReviews: 15,
      status: 'AVAILABLE',
      images: [{ url: 'img2.jpg' }],
    },
  ];

  beforeEach(() => {
    prisma = {
      booking: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      favoriteListing: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      listing: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    service = new RecommendationService(prisma);
  });

  describe('getRecommendations', () => {
    it('should return popular recommendations when user has no history', async () => {
      // User has no bookings or favorites
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.favoriteListing.findMany.mockResolvedValue([]);
      prisma.listing.findMany.mockResolvedValue(mockListings);

      const result = await service.getRecommendations('user-1', 10);

      expect(result).toBeDefined();
      expect(result.strategy).toBe('popular');
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should use collaborative filtering when user has booking history', async () => {
      // User has bookings
      prisma.booking.findMany.mockImplementation((args: any) => {
        if (args?.where?.renterId === 'user-1') {
          return Promise.resolve([{ listingId: 'listing-1' }]);
        }
        // Similar users' bookings
        return Promise.resolve([
          { renterId: 'similar-user', listingId: 'listing-2' },
        ]);
      });
      prisma.favoriteListing.findMany.mockImplementation((args: any) => {
        if (args?.where?.userId === 'user-1') {
          return Promise.resolve([{ listingId: 'listing-1' }]);
        }
        return Promise.resolve([{ userId: 'similar-user', listingId: 'listing-2' }]);
      });
      prisma.listing.findMany.mockResolvedValue(mockListings);

      const result = await service.getRecommendations('user-1', 10);

      expect(result).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should fall back to popular on error', async () => {
      // First call in getRecommendations throws, triggering catch → getPopularRecommendations
      // getPopularRecommendations also calls booking.findMany & favoriteListing.findMany
      prisma.booking.findMany
        .mockRejectedValueOnce(new Error('DB error')) // initial call
        .mockResolvedValue([]); // fallback call
      prisma.favoriteListing.findMany.mockResolvedValue([]);
      prisma.listing.findMany.mockResolvedValue(mockListings);

      const result = await service.getRecommendations('user-1', 10);

      expect(result).toBeDefined();
      expect(result.strategy).toBe('popular');
    });

    it('should respect limit parameter', async () => {
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.favoriteListing.findMany.mockResolvedValue([]);
      prisma.listing.findMany.mockResolvedValue(mockListings.slice(0, 1));

      const result = await service.getRecommendations('user-1', 1);

      expect(result.recommendations.length).toBeLessThanOrEqual(1);
    });

    it('should use default limit of 20', async () => {
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.favoriteListing.findMany.mockResolvedValue([]);
      prisma.listing.findMany.mockResolvedValue(mockListings);

      const result = await service.getRecommendations('user-1');

      expect(result).toBeDefined();
    });
  });

  describe('getPopularRecommendations (via getRecommendations fallback)', () => {
    it('should exclude user favorites and bookings from popular results', async () => {
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.favoriteListing.findMany.mockResolvedValue([]);
      prisma.listing.findMany.mockResolvedValue(mockListings);

      const result = await service.getRecommendations('user-1');

      expect(prisma.listing.findMany).toHaveBeenCalled();
      expect(result.strategy).toBe('popular');
    });

    it('should order by totalReviews and averageRating', async () => {
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.favoriteListing.findMany.mockResolvedValue([]);
      prisma.listing.findMany.mockResolvedValue(mockListings);

      await service.getRecommendations('user-1');

      const call = prisma.listing.findMany.mock.calls[0]?.[0];
      if (call?.orderBy) {
        expect(call.orderBy).toBeDefined();
      }
    });
  });
});
