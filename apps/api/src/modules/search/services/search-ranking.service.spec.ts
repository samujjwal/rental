import { Test, TestingModule } from '@nestjs/testing';
import { SearchRankingService, RankingSignals, RankingConfig } from './search-ranking.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';

describe('SearchRankingService', () => {
  let service: SearchRankingService;
  let prisma: any;
  let cache: any;

  beforeEach(async () => {
    prisma = {
      listing: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      booking: { count: jest.fn() },
      review: { aggregate: jest.fn() },
    };

    cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchRankingService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();

    service = module.get<SearchRankingService>(SearchRankingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateCompositeScore', () => {
    it('should return a weighted composite score', () => {
      const signals: RankingSignals = {
        relevance: 0.9,
        priceCompetitiveness: 0.7,
        hostReliability: 0.8,
        availability: 0.6,
        recency: 0.5,
        reviewQuality: 0.85,
        locationRelevance: 0.9,
        completeness: 0.95,
        bookingConversion: 0.3,
      };

      const score = service.calculateCompositeScore(signals);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should apply boosts correctly', () => {
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

      const baseScore = service.calculateCompositeScore(signals);
      const boostedScore = service.calculateCompositeScore(signals, {
        instantBook: true,
        verified: true,
        superhost: true,
      });

      expect(boostedScore).toBeGreaterThan(baseScore);
    });

    it('should cap scores at 1.0', () => {
      const maxSignals: RankingSignals = {
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

      const score = service.calculateCompositeScore(maxSignals, {
        instantBook: true,
        verified: true,
        superhost: true,
        featured: true,
      });

      expect(score).toBeLessThanOrEqual(1);
    });

    it('should handle all-zero signals', () => {
      const zeroSignals: RankingSignals = {
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

      const score = service.calculateCompositeScore(zeroSignals);
      expect(score).toBe(0);
    });

    it('should use custom weights when provided', () => {
      const signals: RankingSignals = {
        relevance: 1,
        priceCompetitiveness: 0,
        hostReliability: 0,
        availability: 0,
        recency: 0,
        reviewQuality: 0,
        locationRelevance: 0,
        completeness: 0,
        bookingConversion: 0,
      };

      const customConfig: Partial<RankingConfig> = {
        weights: {
          relevance: 1.0,
          priceCompetitiveness: 0,
          hostReliability: 0,
          availability: 0,
          recency: 0,
          reviewQuality: 0,
          locationRelevance: 0,
          completeness: 0,
          bookingConversion: 0,
        },
      };

      const score = service.calculateCompositeScore(signals, undefined, customConfig);
      expect(score).toBeCloseTo(1.0, 1);
    });
  });

  describe('haversineDistance', () => {
    it('should calculate distance between two points', () => {
      // Kathmandu to Pokhara: ~123 km
      const distance = (service as any).haversineDistance(
        27.7172, 85.324,  // Kathmandu
        28.2096, 83.9856, // Pokhara
      );

      expect(distance).toBeGreaterThan(100);
      expect(distance).toBeLessThan(200);
    });

    it('should return 0 for identical points', () => {
      const distance = (service as any).haversineDistance(27.7, 85.3, 27.7, 85.3);
      expect(distance).toBe(0);
    });
  });
});
