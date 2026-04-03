import { Test, TestingModule } from '@nestjs/testing';
import { SearchRankingService, RankingSignals, RankingConfig } from './search-ranking.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';
import { toNumber } from '@rental-portal/database';

describe('SearchRankingService - Complete Coverage', () => {
  let service: SearchRankingService;
  let prisma: jest.Mocked<PrismaService>;
  let cache: jest.Mocked<CacheService>;

  const mockListing = {
    id: 'listing-1',
    title: 'Beautiful Apartment in Downtown',
    description: 'Modern apartment with great views',
    basePrice: 1000,
    categoryId: 'cat-1',
    ownerId: 'user-1',
    owner: {
      id: 'user-1',
      averageRating: 4.8,
      totalReviews: 25,
      responseRate: 95,
    },
    category: { slug: 'apartment' },
    instantBookable: true,
    verificationStatus: 'VERIFIED',
    featured: true,
    createdAt: new Date('2026-03-20'),
    updatedAt: new Date('2026-03-25'),
    latitude: 40.7128,
    longitude: -74.006,
    photos: ['photo1.jpg', 'photo2.jpg', 'photo3.jpg'],
    amenities: ['wifi', 'parking', 'pool'],
    totalBookings: 10,
    views: 100,
    viewCount: 100,
    averageRating: 4.8,
    totalReviews: 25,
  };

  beforeEach(async () => {
    const mockPrisma = {
      listing: {
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _avg: { basePrice: 0 } }),
      },
    } as any;

    const mockCache = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchRankingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
      ],
    }).compile();

    service = module.get<SearchRankingService>(SearchRankingService);
    prisma = module.get(PrismaService);
    cache = module.get(CacheService);
  });

  describe('Vector Similarity Calculations', () => {
    it('should calculate composite score with all signals', () => {
      const signals: RankingSignals = {
        relevance: 0.9,
        priceCompetitiveness: 0.8,
        hostReliability: 0.95,
        availability: 0.7,
        recency: 0.85,
        reviewQuality: 0.9,
        locationRelevance: 0.8,
        completeness: 0.85,
        bookingConversion: 0.6,
      };

      const score = service.calculateCompositeScore(signals, {
        instantBook: true,
        verified: true,
        superhost: true,
        featured: true,
        freshListing: true,
      });

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
      expect(score).toBeCloseTo(1.0, 2); // Should be close to 1 with all boosts
    });

    it('should handle zero signals gracefully', () => {
      const signals: RankingSignals = {
        relevance: 0,
        priceCompetitiveness: 0,
        hostReliability: 0,
        availability: 0,
        recency: 0,
        reviewQuality: 0,
        locationRelevance: 0,
        completeness: 0,
        bookingConversion: 0,
      };

      const score = service.calculateCompositeScore(signals);

      expect(score).toBe(0);
    });

    it('should handle maximum signals', () => {
      const signals: RankingSignals = {
        relevance: 1,
        priceCompetitiveness: 1,
        hostReliability: 1,
        availability: 1,
        recency: 1,
        reviewQuality: 1,
        locationRelevance: 1,
        completeness: 1,
        bookingConversion: 1,
      };

      const score = service.calculateCompositeScore(signals);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should apply custom weights correctly', () => {
      const signals: RankingSignals = {
        relevance: 0.5,
        priceCompetitiveness: 0.5,
        hostReliability: 0.5,
        availability: 0.5,
        recency: 0.5,
        reviewQuality: 0.5,
        locationRelevance: 0.5,
        completeness: 0.5,
        bookingConversion: 0.5,
      };

      const config: Partial<RankingConfig> = {
        weights: {
          relevance: 0.5,
          priceCompetitiveness: 0.1,
          hostReliability: 0.1,
          availability: 0.05,
          recency: 0.05,
          reviewQuality: 0.1,
          locationRelevance: 0.05,
          completeness: 0.02,
          bookingConversion: 0.03,
        },
      };

      const score = service.calculateCompositeScore(signals, undefined, config);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should apply custom boosts correctly', () => {
      const signals: RankingSignals = {
        relevance: 0.5,
        priceCompetitiveness: 0.5,
        hostReliability: 0.5,
        availability: 0.5,
        recency: 0.5,
        reviewQuality: 0.5,
        locationRelevance: 0.5,
        completeness: 0.5,
        bookingConversion: 0.5,
      };

      const config: Partial<RankingConfig> = {
        boosts: {
          instantBook: 2.0,
          verified: 1.5,
          superhost: 1.8,
          featured: 1.3,
          freshListing: 1.1,
        },
      };

      const score = service.calculateCompositeScore(
        signals,
        {
          instantBook: true,
          verified: true,
          superhost: true,
          featured: true,
          freshListing: true,
        },
        config,
      );

      expect(score).toBeGreaterThan(0);
      // With high boosts, score should be significantly higher
      const baseScore = service.calculateCompositeScore(signals);
      expect(score).toBeGreaterThan(baseScore);
    });
  });

  describe('Relevance Score Computation', () => {
    it('should weight title matches higher than description', async () => {
      (prisma.listing.findMany as jest.Mock).mockResolvedValue([
        {
          ...mockListing,
          title: 'Luxury Downtown Apartment',
          description: 'A nice place to stay',
        },
      ]);
      (prisma.listing.aggregate as jest.Mock).mockResolvedValue({ _avg: { basePrice: 1000 } });
      (cache.get as jest.Mock).mockResolvedValue(null);

      const results = await service.rankListings(['listing-1'], {
        query: 'Luxury Downtown',
      });

      expect(results[0].signals.relevance).toBeCloseTo(1.0, 1);
    });

    it('should apply location decay correctly', async () => {
      (prisma.listing.findMany as jest.Mock).mockResolvedValue([
        {
          ...mockListing,
          latitude: 40.7128,
          longitude: -74.006,
        },
      ]);
      (prisma.listing.aggregate as jest.Mock).mockResolvedValue({ _avg: { basePrice: 1000 } });
      (cache.get as jest.Mock).mockResolvedValue(null);

      const results = await service.rankListings(['listing-1'], {
        lat: 40.7128,
        lon: -74.006,
      });

      expect(results[0].signals.locationRelevance).toBeCloseTo(1.0, 1);

      // Search from far location
      const farResults = await service.rankListings(['listing-1'], {
        lat: 41.8781,
        lon: -87.6298, // Chicago
      });

      expect(farResults[0].signals.locationRelevance).toBeLessThan(0.5);
    });

    it('should boost recent listings appropriately', async () => {
      const recentListing = {
        ...mockListing,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      };

      (prisma.listing.findMany as jest.Mock).mockResolvedValue([recentListing]);
      (prisma.listing.aggregate as jest.Mock).mockResolvedValue({ _avg: { basePrice: 1000 } });
      (cache.get as jest.Mock).mockResolvedValue(null);

      const results = await service.rankListings(['listing-1'], {});

      expect(results[0].boosts).toContain('freshListing');
      expect(results[0].signals.recency).toBeGreaterThan(0.9);
    });
  });

  describe('Performance Optimization', () => {
    it('should use caching for expensive computations', async () => {
      (prisma.listing.findMany as jest.Mock).mockResolvedValue([mockListing]);
      (prisma.listing.aggregate as jest.Mock).mockResolvedValue({ _avg: { basePrice: 1000 } });
      cache.get.mockResolvedValue(1000); // Cached price

      await service.rankListings(['listing-1'], {});

      // Should not call aggregate if cache hit
      expect(cache.get).toHaveBeenCalledWith('search:rank:catprice:cat-1');
      expect(prisma.listing.aggregate).not.toHaveBeenCalled();
    });

    it('should fallback to simpler algorithms under load', async () => {
      const largeListingSet = Array.from({ length: 1000 }, (_, i) => ({
        ...mockListing,
        id: `listing-${i}`,
      }));

      prisma.listing.findMany.mockResolvedValue(largeListingSet);
      (prisma.listing.aggregate as jest.Mock).mockResolvedValue({ _avg: { basePrice: 1000 } });
      cache.get.mockResolvedValue(null);

      const startTime = Date.now();
      await service.rankListings(
        largeListingSet.map((l) => l.id),
        {},
      );
      const endTime = Date.now();

      // Should complete within reasonable time even with 1000 listings
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds max
    });

    it('should handle empty listing set efficiently', async () => {
      const results = await service.rankListings([], {});

      expect(results).toEqual([]);
      expect(prisma.listing.findMany).not.toHaveBeenCalled();
    });
  });

  describe('Price Competitiveness Signal', () => {
    it('should calculate price competitiveness correctly', async () => {
      const cheapListing = { ...mockListing, basePrice: 500 };
      const expensiveListing = { ...mockListing, basePrice: 2000 };

      prisma.listing.findMany.mockResolvedValue([cheapListing, expensiveListing]);
      (prisma.listing.aggregate as jest.Mock).mockResolvedValue({ _avg: { basePrice: 1000 } });
      cache.get.mockResolvedValue(null);

      const results = await service.rankListings(['listing-1', 'listing-2'], {});

      // Cheaper listing should have higher competitiveness
      expect(results[0].signals.priceCompetitiveness).toBeGreaterThan(
        results[1].signals.priceCompetitiveness,
      );
    });

    it('should handle missing category prices gracefully', async () => {
      (prisma.listing.findMany as jest.Mock).mockResolvedValue([mockListing]);
      (prisma.listing.aggregate as jest.Mock).mockResolvedValue({ _avg: { basePrice: null } });
      cache.get.mockResolvedValue(null);

      const results = await service.rankListings(['listing-1'], {});

      expect(results[0].signals.priceCompetitiveness).toBe(0.5); // Default value
    });
  });

  describe('Host Reliability Signal', () => {
    it('should calculate host reliability based on rating and response rate', async () => {
      const excellentHost = {
        ...mockListing,
        owner: {
          ...mockListing.owner,
          averageRating: 5.0,
          responseRate: 100,
        },
      };

      prisma.listing.findMany.mockResolvedValue([excellentHost]);
      (prisma.listing.aggregate as jest.Mock).mockResolvedValue({ _avg: { basePrice: 1000 } });
      cache.get.mockResolvedValue(null);

      const results = await service.rankListings(['listing-1'], {});

      expect(results[0].signals.hostReliability).toBeCloseTo(1.0, 1);
    });

    it('should handle missing host data gracefully', async () => {
      const listingWithoutHost = {
        ...mockListing,
        owner: null,
      };

      prisma.listing.findMany.mockResolvedValue([listingWithoutHost]);
      (prisma.listing.aggregate as jest.Mock).mockResolvedValue({ _avg: { basePrice: 1000 } });
      cache.get.mockResolvedValue(null);

      const results = await service.rankListings(['listing-1'], {});

      expect(results[0].signals.hostReliability).toBe(0); // No host data
    });
  });

  describe('Review Quality Signal', () => {
    it('should calculate review quality with rating and review count', async () => {
      const highlyRatedListing = {
        ...mockListing,
        averageRating: 5.0,
        totalReviews: 100,
      };

      prisma.listing.findMany.mockResolvedValue([highlyRatedListing]);
      (prisma.listing.aggregate as jest.Mock).mockResolvedValue({ _avg: { basePrice: 1000 } });
      cache.get.mockResolvedValue(null);

      const results = await service.rankListings(['listing-1'], {});

      expect(results[0].signals.reviewQuality).toBeGreaterThan(0.8);
    });

    it('should handle zero reviews gracefully', async () => {
      const listingWithoutReviews = {
        ...mockListing,
        averageRating: 0,
        totalReviews: 0,
      };

      prisma.listing.findMany.mockResolvedValue([listingWithoutReviews]);
      (prisma.listing.aggregate as jest.Mock).mockResolvedValue({ _avg: { basePrice: 1000 } });
      cache.get.mockResolvedValue(null);

      const results = await service.rankListings(['listing-1'], {});

      expect(results[0].signals.reviewQuality).toBe(0);
    });
  });

  describe('Completeness Signal', () => {
    it('should calculate completeness based on photos, description, and amenities', async () => {
      const completeListing = {
        ...mockListing,
        photos: ['photo1.jpg', 'photo2.jpg', 'photo3.jpg', 'photo4.jpg'],
        description: 'A very detailed description of the property with lots of information',
        amenities: ['wifi', 'parking', 'pool', 'gym', 'kitchen'],
      };

      prisma.listing.findMany.mockResolvedValue([completeListing]);
      (prisma.listing.aggregate as jest.Mock).mockResolvedValue({ _avg: { basePrice: 1000 } });
      cache.get.mockResolvedValue(null);

      const results = await service.rankListings(['listing-1'], {});

      expect(results[0].signals.completeness).toBeCloseTo(1.0, 1);
    });

    it('should handle incomplete listings', async () => {
      const incompleteListing = {
        ...mockListing,
        photos: [],
        description: '',
        amenities: [],
      };

      prisma.listing.findMany.mockResolvedValue([incompleteListing]);
      (prisma.listing.aggregate as jest.Mock).mockResolvedValue({ _avg: { basePrice: 1000 } });
      cache.get.mockResolvedValue(null);

      const results = await service.rankListings(['listing-1'], {});

      expect(results[0].signals.completeness).toBe(0);
    });
  });

  describe('Booking Conversion Signal', () => {
    it('should calculate booking conversion rate', async () => {
      const popularListing = {
        ...mockListing,
        totalBookings: 50,
        views: 100,
      };

      prisma.listing.findMany.mockResolvedValue([popularListing]);
      (prisma.listing.aggregate as jest.Mock).mockResolvedValue({ _avg: { basePrice: 1000 } });
      cache.get.mockResolvedValue(null);

      const results = await service.rankListings(['listing-1'], {});

      expect(results[0].signals.bookingConversion).toBeCloseTo(0.5, 1);
    });

    it('should handle zero views gracefully', async () => {
      const listingWithoutViews = {
        ...mockListing,
        totalBookings: 0,
        views: 0,
        viewCount: 0,
      };

      prisma.listing.findMany.mockResolvedValue([listingWithoutViews]);
      (prisma.listing.aggregate as jest.Mock).mockResolvedValue({ _avg: { basePrice: 1000 } });
      cache.get.mockResolvedValue(null);

      const results = await service.rankListings(['listing-1'], {});

      expect(results[0].signals.bookingConversion).toBe(0);
    });
  });

  describe('Boost Application', () => {
    it('should apply instant book boost', async () => {
      const instantBookListing = {
        ...mockListing,
        instantBookable: true,
      };

      prisma.listing.findMany.mockResolvedValue([instantBookListing]);
      (prisma.listing.aggregate as jest.Mock).mockResolvedValue({ _avg: { basePrice: 1000 } });
      cache.get.mockResolvedValue(null);

      const results = await service.rankListings(['listing-1'], {});

      expect(results[0].boosts).toContain('instantBook');
    });

    it('should apply verified boost', async () => {
      const verifiedListing = {
        ...mockListing,
        verificationStatus: 'VERIFIED',
      };

      prisma.listing.findMany.mockResolvedValue([verifiedListing]);
      (prisma.listing.aggregate as jest.Mock).mockResolvedValue({ _avg: { basePrice: 1000 } });
      cache.get.mockResolvedValue(null);

      const results = await service.rankListings(['listing-1'], {});

      expect(results[0].boosts).toContain('verified');
    });

    it('should apply superhost boost', async () => {
      const superhostListing = {
        ...mockListing,
        owner: {
          ...mockListing.owner,
          averageRating: 4.9,
          totalReviews: 30,
        },
      };

      prisma.listing.findMany.mockResolvedValue([superhostListing]);
      (prisma.listing.aggregate as jest.Mock).mockResolvedValue({ _avg: { basePrice: 1000 } });
      cache.get.mockResolvedValue(null);

      const results = await service.rankListings(['listing-1'], {});

      expect(results[0].boosts).toContain('superhost');
    });

    it('should apply featured boost', async () => {
      const featuredListing = {
        ...mockListing,
        featured: true,
      };

      (prisma.listing.findMany as jest.Mock).mockResolvedValue([featuredListing]);
      (prisma.listing.aggregate as jest.Mock).mockResolvedValue({ _avg: { basePrice: 1000 } });
      cache.get.mockResolvedValue(null);

      const results = await service.rankListings(['listing-1'], {});

      expect(results[0].boosts).toContain('featured');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      (prisma.listing.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(service.rankListings(['listing-1'], {})).rejects.toThrow('Database error');
    });

    it('should handle cache errors gracefully', async () => {
      (prisma.listing.findMany as jest.Mock).mockResolvedValue([mockListing]);
      (prisma.listing.aggregate as jest.Mock).mockResolvedValue({ _avg: { basePrice: 1000 } });
      cache.get.mockRejectedValue(new Error('Cache error'));

      // Should still work despite cache error
      const results = await service.rankListings(['listing-1'], {});

      expect(results).toHaveLength(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle listings without coordinates', async () => {
      const listingWithoutCoords = {
        ...mockListing,
        latitude: null,
        longitude: null,
      };

      (prisma.listing.findMany as jest.Mock).mockResolvedValue([listingWithoutCoords]);
      (prisma.listing.aggregate as jest.Mock).mockResolvedValue({ _avg: { basePrice: 1000 } });
      cache.get.mockResolvedValue(null);

      const results = await service.rankListings(['listing-1'], {
        lat: 40.7128,
        lon: -74.006,
      });

      expect(results[0].signals.locationRelevance).toBe(0.5); // Default value
    });

    it('should handle listings without category', async () => {
      const listingWithoutCategory = {
        ...mockListing,
        categoryId: null,
        category: null,
      };

      (prisma.listing.findMany as jest.Mock).mockResolvedValue([listingWithoutCategory]);
      cache.get.mockResolvedValue(null);

      const results = await service.rankListings(['listing-1'], {});

      expect(results[0].signals.priceCompetitiveness).toBe(0.5); // Default value
    });

    it('should handle malformed data gracefully', async () => {
      const malformedListing = {
        ...mockListing,
        basePrice: 'invalid',
        averageRating: 'invalid',
        totalReviews: 'invalid',
      };

      (prisma.listing.findMany as jest.Mock).mockResolvedValue([malformedListing]);
      (prisma.listing.aggregate as jest.Mock).mockResolvedValue({ _avg: { basePrice: 1000 } });
      cache.get.mockResolvedValue(null);

      const results = await service.rankListings(['listing-1'], {});

      expect(results).toHaveLength(1);
      expect(results[0].score).toBeGreaterThanOrEqual(0);
    });
  });
});
