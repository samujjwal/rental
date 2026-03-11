import { Test, TestingModule } from '@nestjs/testing';
import { DynamicPricingService } from './dynamic-pricing.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';
import { EventsService } from '@/common/events/events.service';

describe('DynamicPricingService', () => {
  let service: DynamicPricingService;
  let prisma: any;
  let cache: any;
  let events: any;

  const mockListing = {
    id: 'listing-1',
    basePrice: 5000,
    categoryId: 'cat-1',
    address: { city: 'Kathmandu' },
    category: { id: 'cat-1', name: 'Apartment' },
  };

  beforeEach(async () => {
    prisma = {
      listing: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      pricingRule: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      booking: {
        count: jest.fn().mockResolvedValue(5),
        findMany: jest.fn().mockResolvedValue([]),
      },
      availabilitySlot: {
        count: jest.fn().mockResolvedValue(10),
      },
    };

    cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    events = {
      emitPricingUpdated: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DynamicPricingService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cache },
        { provide: EventsService, useValue: events },
      ],
    }).compile();

    service = module.get<DynamicPricingService>(DynamicPricingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateDynamicPrice', () => {
    it('should return base price when no rules match', async () => {
      prisma.listing.findUnique.mockResolvedValue(mockListing);

      const result = await service.calculateDynamicPrice({
        listingId: 'listing-1',
        basePrice: 5000,
        currency: 'NPR',
        country: 'NP',
        startDate: new Date('2025-08-01'),
        endDate: new Date('2025-08-03'),
        guestCount: 2,
      });

      expect(result).toBeDefined();
      expect(result.basePrice).toBe(5000);
      expect(result.recommendedPrice).toBeGreaterThan(0);
      // Recommended price should be within floor/ceiling bounds (50%-300% of base)
      expect(result.recommendedPrice).toBeGreaterThanOrEqual(2500);
      expect(result.recommendedPrice).toBeLessThanOrEqual(15000);
    });

    it('should apply MULTIPLIER pricing rule', async () => {
      prisma.listing.findUnique.mockResolvedValue(mockListing);
      prisma.pricingRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          type: 'SURGE',
          strategy: 'MULTIPLIER',
          name: 'Weekend Surge',
          conditions: [],
          parameters: { baseMultiplier: 1.5 },
          priority: 100,
          isActive: true,
          effectiveFrom: new Date('2024-01-01'),
          effectiveTo: new Date('2099-12-31'),
        },
      ]);

      const result = await service.calculateDynamicPrice({
        listingId: 'listing-1',
        basePrice: 5000,
        currency: 'NPR',
        country: 'NP',
        startDate: new Date('2025-08-01'),
        endDate: new Date('2025-08-03'),
        guestCount: 2,
      });

      expect(result.recommendedPrice).toBeGreaterThan(0);
    });
  });

  describe('forecastDemand', () => {
    it('should return a demand forecast', async () => {
      prisma.listing.findUnique.mockResolvedValue({
        city: 'Kathmandu',
        country: 'NP',
        categoryId: 'cat-1',
        basePrice: 5000,
      });
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.booking.count.mockResolvedValue(5);

      const result = await service.forecastDemand(
        'listing-1',
        new Date('2025-08-01'),
        new Date('2025-08-07'),
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].demandLevel).toBeDefined();
      expect(['LOW', 'MEDIUM', 'HIGH', 'PEAK']).toContain(result[0].demandLevel);
    });
  });

  describe('getCompetitorAnalysis', () => {
    it('should return competitor price statistics', async () => {
      prisma.listing.findUnique.mockResolvedValue(mockListing);
      prisma.listing.findMany.mockResolvedValue([
        { basePrice: 4000 },
        { basePrice: 5000 },
        { basePrice: 6000 },
      ]);

      const result = await service.getCompetitorAnalysis('listing-1');

      expect(result).toBeDefined();
      expect(result.avgPrice).toBeDefined();
      expect(result.minPrice).toBeDefined();
      expect(result.maxPrice).toBeDefined();
    });
  });
});
