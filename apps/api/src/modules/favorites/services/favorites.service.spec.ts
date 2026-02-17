import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { PrismaService } from '@/common/prisma/prisma.service';

describe('FavoritesService', () => {
  let service: FavoritesService;
  let prisma: {
    favoriteListing: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      count: jest.Mock;
      upsert: jest.Mock;
      deleteMany: jest.Mock;
      createMany: jest.Mock;
    };
  };

  const userId = 'user-1';
  const listingId = 'listing-1';

  const mockRawListing = {
    id: listingId,
    title: 'Test Listing',
    description: 'A test listing',
    photos: ['photo1.jpg'],
    basePrice: 50,
    currency: 'USD',
    city: 'Portland',
    state: 'OR',
    country: 'US',
    status: 'ACTIVE',
    averageRating: 4.5,
    totalReviews: 10,
    bookingMode: 'INSTANT_BOOK',
    instantBookable: true,
    category: { name: 'Tools' },
    owner: { firstName: 'John', lastName: 'Doe' },
  };

  const mockFavorite = {
    id: 'fav-1',
    userId,
    listingId,
    createdAt: new Date(),
    listing: mockRawListing,
  };

  beforeEach(async () => {
    prisma = {
      favoriteListing: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavoritesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<FavoritesService>(FavoritesService);
  });

  describe('getFavorites', () => {
    it('should return paginated favorites', async () => {
      prisma.favoriteListing.findMany.mockResolvedValue([mockFavorite]);
      prisma.favoriteListing.count.mockResolvedValue(1);

      const result = await service.getFavorites(userId);

      expect(result.favorites).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.favorites[0].listing.title).toBe('Test Listing');
      expect(result.favorites[0].listing.pricePerDay).toBe(50);
      expect(result.favorites[0].listing.instantBooking).toBe(true);
    });

    it('should support sorting by price', async () => {
      prisma.favoriteListing.findMany.mockResolvedValue([]);
      prisma.favoriteListing.count.mockResolvedValue(0);

      await service.getFavorites(userId, 1, 10, 'price', 'asc');

      expect(prisma.favoriteListing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { listing: { basePrice: 'asc' } },
        }),
      );
    });

    it('should support sorting by title', async () => {
      prisma.favoriteListing.findMany.mockResolvedValue([]);
      prisma.favoriteListing.count.mockResolvedValue(0);

      await service.getFavorites(userId, 1, 10, 'title', 'desc');

      expect(prisma.favoriteListing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { listing: { title: 'desc' } },
        }),
      );
    });

    it('should filter by category', async () => {
      prisma.favoriteListing.findMany.mockResolvedValue([]);
      prisma.favoriteListing.count.mockResolvedValue(0);

      await service.getFavorites(userId, 1, 20, 'createdAt', 'desc', 'Tools');

      expect(prisma.favoriteListing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            listing: {
              category: { name: { equals: 'Tools', mode: 'insensitive' } },
            },
          }),
        }),
      );
    });

    it('should return empty list when no favorites', async () => {
      prisma.favoriteListing.findMany.mockResolvedValue([]);
      prisma.favoriteListing.count.mockResolvedValue(0);

      const result = await service.getFavorites(userId);

      expect(result.favorites).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should handle listing with missing optional fields', async () => {
      const sparseListingFav = {
        ...mockFavorite,
        listing: {
          ...mockRawListing,
          photos: null,
          category: null,
          owner: null,
          averageRating: null,
          totalReviews: null,
          bookingMode: 'REQUEST',
          instantBookable: false,
        },
      };
      prisma.favoriteListing.findMany.mockResolvedValue([sparseListingFav]);
      prisma.favoriteListing.count.mockResolvedValue(1);

      const result = await service.getFavorites(userId);

      expect(result.favorites[0].listing.images).toEqual([]);
      expect(result.favorites[0].listing.category.name).toBe('Uncategorized');
      expect(result.favorites[0].listing.owner.firstName).toBe('');
      expect(result.favorites[0].listing.instantBooking).toBe(false);
    });
  });

  describe('getFavoriteByListingId', () => {
    it('should return a favorite by listing id', async () => {
      prisma.favoriteListing.findUnique.mockResolvedValue(mockFavorite);

      const result = await service.getFavoriteByListingId(userId, listingId);

      expect(result.listing.title).toBe('Test Listing');
      expect(prisma.favoriteListing.findUnique).toHaveBeenCalledWith({
        where: { userId_listingId: { userId, listingId } },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.favoriteListing.findUnique.mockResolvedValue(null);

      await expect(service.getFavoriteByListingId(userId, 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('addFavorite', () => {
    it('should upsert a favorite', async () => {
      prisma.favoriteListing.upsert.mockResolvedValue(mockFavorite);

      const result = await service.addFavorite(userId, listingId);

      expect(result.listing.title).toBe('Test Listing');
      expect(prisma.favoriteListing.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_listingId: { userId, listingId } },
          create: { userId, listingId },
          update: {},
        }),
      );
    });
  });

  describe('removeFavorite', () => {
    it('should delete the favorite', async () => {
      prisma.favoriteListing.deleteMany.mockResolvedValue({ count: 1 });

      await service.removeFavorite(userId, listingId);

      expect(prisma.favoriteListing.deleteMany).toHaveBeenCalledWith({
        where: { userId, listingId },
      });
    });
  });

  describe('countFavorites', () => {
    it('should return the count', async () => {
      prisma.favoriteListing.count.mockResolvedValue(5);

      const result = await service.countFavorites(userId);

      expect(result).toBe(5);
    });
  });

  describe('bulkAddFavorites', () => {
    it('should return empty array when listingIds is empty', async () => {
      const result = await service.bulkAddFavorites(userId, []);

      expect(result).toEqual([]);
      expect(prisma.favoriteListing.createMany).not.toHaveBeenCalled();
    });

    it('should create many and return results', async () => {
      const ids = ['l1', 'l2'];
      prisma.favoriteListing.createMany.mockResolvedValue({ count: 2 });
      prisma.favoriteListing.findMany.mockResolvedValue([
        { ...mockFavorite, listingId: 'l1' },
        { ...mockFavorite, listingId: 'l2', listing: { ...mockRawListing, id: 'l2' } },
      ]);

      const result = await service.bulkAddFavorites(userId, ids);

      expect(result).toHaveLength(2);
      expect(prisma.favoriteListing.createMany).toHaveBeenCalledWith({
        data: ids.map((id) => ({ userId, listingId: id })),
        skipDuplicates: true,
      });
    });
  });

  describe('bulkRemoveFavorites', () => {
    it('should do nothing for empty list', async () => {
      await service.bulkRemoveFavorites(userId, []);

      expect(prisma.favoriteListing.deleteMany).not.toHaveBeenCalled();
    });

    it('should delete matching favorites', async () => {
      prisma.favoriteListing.deleteMany.mockResolvedValue({ count: 2 });

      await service.bulkRemoveFavorites(userId, ['l1', 'l2']);

      expect(prisma.favoriteListing.deleteMany).toHaveBeenCalledWith({
        where: { userId, listingId: { in: ['l1', 'l2'] } },
      });
    });
  });

  describe('clearAllFavorites', () => {
    it('should delete all favorites for a user', async () => {
      prisma.favoriteListing.deleteMany.mockResolvedValue({ count: 10 });

      await service.clearAllFavorites(userId);

      expect(prisma.favoriteListing.deleteMany).toHaveBeenCalledWith({
        where: { userId },
      });
    });
  });
});
