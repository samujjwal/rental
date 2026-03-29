import { Test, TestingModule } from '@nestjs/testing';
import { MarketInsightsService, MarketInsights } from './market-insights.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('MarketInsightsService', () => {
  let service: MarketInsightsService;
  let mockPrisma: { category: { findUnique: jest.Mock } };

  const mockPrismaService = {
    category: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketInsightsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<MarketInsightsService>(MarketInsightsService);
    mockPrisma = mockPrismaService as any;
    jest.clearAllMocks();
  });

  describe('getForCategory', () => {
    it('should return market insights for valid category', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({
        id: 'cat-1',
        name: 'Luxury Apartments',
        slug: 'luxury-apartments',
        listings: [
          { basePrice: 1500, features: ['wifi', 'pool', 'gym'], totalBookings: 10 },
          { basePrice: 2000, features: ['wifi', 'parking'], totalBookings: 8 },
          { basePrice: 1200, features: ['wifi', 'pool'], totalBookings: 5 },
        ],
      });

      const result = await service.getForCategory('luxury-apartments');

      expect(result.category).toBe('Luxury Apartments');
      expect(result.currency).toBe('USD');
      expect(result.averagePrice).toBe(1566.67);
      expect(result.priceRange).toEqual({ min: 1200, max: 2000 });
      expect(result.competitorCount).toBe(3);
    });

    it('should throw NotFoundException for non-existent category', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);

      await expect(service.getForCategory('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should return empty insights for category with no listings', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({
        id: 'cat-2',
        name: 'Empty Category',
        slug: 'empty-category',
        listings: [],
      });

      const result = await service.getForCategory('empty-category');

      expect(result.category).toBe('Empty Category');
      expect(result.averagePrice).toBe(0);
      expect(result.priceRange).toEqual({ min: 0, max: 0 });
      expect(result.competitorCount).toBe(0);
      expect(result.demand).toBe('low');
      expect(result.popularFeatures).toEqual([]);
    });

    it('should calculate demand as high for high booking volume', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({
        id: 'cat-3',
        name: 'High Demand',
        slug: 'high-demand',
        listings: [
          { basePrice: 1000, features: [], totalBookings: 10 },
          { basePrice: 1200, features: [], totalBookings: 8 },
          { basePrice: 900, features: [], totalBookings: 12 },
        ],
      });

      const result = await service.getForCategory('high-demand');

      expect(result.demand).toBe('high');
    });

    it('should calculate demand as medium for moderate booking volume', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({
        id: 'cat-4',
        name: 'Medium Demand',
        slug: 'medium-demand',
        listings: [
          { basePrice: 1000, features: [], totalBookings: 3 },
          { basePrice: 1200, features: [], totalBookings: 4 },
          { basePrice: 900, features: [], totalBookings: 2 },
        ],
      });

      const result = await service.getForCategory('medium-demand');

      expect(result.demand).toBe('medium');
    });

    it('should calculate demand as low for few listings', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({
        id: 'cat-5',
        name: 'Few Listings',
        slug: 'few-listings',
        listings: [
          { basePrice: 1000, features: [], totalBookings: 10 },
        ],
      });

      const result = await service.getForCategory('few-listings');

      expect(result.demand).toBe('low');
    });

    it('should identify popular features correctly', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({
        id: 'cat-6',
        name: 'Popular Features',
        slug: 'popular-features',
        listings: [
          { basePrice: 1000, features: ['wifi', 'pool', 'gym'], totalBookings: 0 },
          { basePrice: 1200, features: ['wifi', 'pool', 'parking'], totalBookings: 0 },
          { basePrice: 900, features: ['wifi', 'ac', 'pool'], totalBookings: 0 },
          { basePrice: 1100, features: ['wifi', 'gym'], totalBookings: 0 },
        ],
      });

      const result = await service.getForCategory('popular-features');

      expect(result.popularFeatures).toContain('wifi');
      expect(result.popularFeatures).toContain('pool');
      expect(result.popularFeatures).toHaveLength(5); // Top 5 features
    });

    it('should handle listings with null features', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({
        id: 'cat-7',
        name: 'Null Features',
        slug: 'null-features',
        listings: [
          { basePrice: 1000, features: null, totalBookings: 0 },
          { basePrice: 1200, features: ['wifi'], totalBookings: 0 },
        ],
      });

      const result = await service.getForCategory('null-features');

      expect(result.popularFeatures).toEqual(['wifi']);
    });

    it('should handle listings with null bookings', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({
        id: 'cat-8',
        name: 'Null Bookings',
        slug: 'null-bookings',
        listings: [
          { basePrice: 1000, features: [], totalBookings: null },
          { basePrice: 1200, features: [], totalBookings: 3 },
          { basePrice: 900, features: [], totalBookings: null },
        ],
      });

      const result = await service.getForCategory('null-bookings');

      expect(result.averagePrice).toBe(1033.33);
      expect(result.demand).toBeDefined();
    });

    it('should round average price to 2 decimal places', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({
        id: 'cat-9',
        name: 'Price Rounding',
        slug: 'price-rounding',
        listings: [
          { basePrice: 1000.555, features: [], totalBookings: 0 },
          { basePrice: 1200.666, features: [], totalBookings: 0 },
        ],
      });

      const result = await service.getForCategory('price-rounding');

      expect(result.averagePrice).toBe(1100.61);
    });

    it('should filter out deleted listings', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({
        id: 'cat-10',
        name: 'Available Only',
        slug: 'available-only',
        listings: [
          { basePrice: 1000, features: [], totalBookings: 0 },
          { basePrice: 1200, features: [], totalBookings: 0 },
        ],
      });

      await service.getForCategory('available-only');

      expect(mockPrisma.category.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            listings: expect.objectContaining({
              where: expect.objectContaining({
                status: 'AVAILABLE',
                deletedAt: null,
              }),
            }),
          }),
        }),
      );
    });

    it('should return empty seasonal trends (not yet implemented)', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({
        id: 'cat-11',
        name: 'No Seasonal',
        slug: 'no-seasonal',
        listings: [
          { basePrice: 1000, features: [], totalBookings: 10 },
        ],
      });

      const result = await service.getForCategory('no-seasonal');

      expect(result.seasonalTrends).toEqual([]);
    });
  });

  describe('demand classification edge cases', () => {
    it('should classify low demand with no bookings', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({
        id: 'cat-12',
        name: 'No Bookings',
        slug: 'no-bookings',
        listings: [
          { basePrice: 1000, features: [], totalBookings: 0 },
          { basePrice: 1200, features: [], totalBookings: 0 },
          { basePrice: 900, features: [], totalBookings: 0 },
        ],
      });

      const result = await service.getForCategory('no-bookings');

      expect(result.demand).toBe('low');
    });

    it('should handle exactly 3 listings (threshold case)', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({
        id: 'cat-13',
        name: 'Three Listings',
        slug: 'three-listings',
        listings: [
          { basePrice: 1000, features: [], totalBookings: 2 },
          { basePrice: 1200, features: [], totalBookings: 2 },
          { basePrice: 900, features: [], totalBookings: 2 },
        ],
      });

      const result = await service.getForCategory('three-listings');

      // 3 listings is the threshold, so demand should be based on avg bookings (2)
      expect(result.demand).toBe('medium');
    });
  });
});
