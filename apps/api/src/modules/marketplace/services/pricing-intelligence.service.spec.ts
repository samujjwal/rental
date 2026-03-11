import { Test, TestingModule } from '@nestjs/testing';
import { PricingIntelligenceService } from './pricing-intelligence.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('PricingIntelligenceService', () => {
  let service: PricingIntelligenceService;
  let prisma: any;

  const mockListing = {
    id: 'listing-1',
    title: 'Cozy Room',
    basePrice: 3000,
    country: 'NP',
    city: 'Kathmandu',
    categoryId: 'cat-1',
    category: { name: 'Room' },
  };

  beforeEach(async () => {
    prisma = {
      listing: {
        findUnique: jest.fn().mockResolvedValue(mockListing),
        findMany: jest.fn().mockResolvedValue([mockListing]),
        count: jest.fn().mockResolvedValue(50),
        aggregate: jest.fn().mockResolvedValue({ _avg: { basePrice: 3000 } }),
      },
      booking: {
        count: jest.fn().mockResolvedValue(15),
        findMany: jest.fn().mockResolvedValue([]),
      },
      pricingRecommendation: {
        upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve({ id: 'pr-1', ...create })),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
      searchEvent: {
        count: jest.fn().mockResolvedValue(200),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricingIntelligenceService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<PricingIntelligenceService>(PricingIntelligenceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateRecommendation', () => {
    it('should generate pricing recommendation for a listing', async () => {
      const result = await service.generateRecommendation('listing-1', new Date());
      expect(result).toBeDefined();
      expect(result.recommendedPrice).toBeGreaterThan(0);
      expect(prisma.pricingRecommendation.upsert).toHaveBeenCalled();
    });

    it('should throw for non-existent listing', async () => {
      prisma.listing.findUnique.mockResolvedValue(null);
      await expect(service.generateRecommendation('bad-id', new Date())).rejects.toThrow();
    });
  });

  describe('getRecommendationHistory', () => {
    it('should return recommendation history', async () => {
      prisma.pricingRecommendation.findMany.mockResolvedValue([
        { id: 'pr-1', listingId: 'listing-1', recommendedPrice: 3200, date: new Date() },
      ]);
      const result = await service.getRecommendationHistory('listing-1', 30);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('autoAcceptRecommendations', () => {
    it('should auto-accept within deviation threshold', async () => {
      prisma.pricingRecommendation.findMany.mockResolvedValue([
        { id: 'pr-1', listingId: 'listing-1', recommendedPrice: 3100, currentPrice: 3000, status: 'PENDING' },
      ]);
      const result = await service.autoAcceptRecommendations('listing-1', 10);
      expect(result).toBeDefined();
    });
  });
});
