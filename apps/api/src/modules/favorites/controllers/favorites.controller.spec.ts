import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from '../services/favorites.service';
import { JwtService } from '@nestjs/jwt';

// Mock the JWT module
jest.mock('@nestjs/jwt', () => ({
  JwtService: jest.fn().mockImplementation(() => ({
    verify: jest.fn().mockReturnValue({ sub: 'u1' }),
  })),
}));

describe('FavoritesController', () => {
  let controller: FavoritesController;
  let service: jest.Mocked<FavoritesService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FavoritesController],
      providers: [
        {
          provide: FavoritesService,
          useValue: {
            getFavorites: jest.fn(),
            getFavoriteByListingId: jest.fn(),
            countFavorites: jest.fn(),
            addFavorite: jest.fn(),
            bulkAddFavorites: jest.fn(),
            removeFavorite: jest.fn(),
            bulkRemoveFavorites: jest.fn(),
            clearAllFavorites: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(FavoritesController);
    service = module.get(FavoritesService) as jest.Mocked<FavoritesService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── getFavorites ──

  describe('getFavorites', () => {
    it('passes default pagination when no query params', async () => {
      service.getFavorites.mockResolvedValue({ data: [] as any[], total: 0 } as any);
      await controller.getFavorites('u1');
      expect(service.getFavorites).toHaveBeenCalledWith('u1', 1, 20, 'createdAt', 'desc', undefined);
    });

    it('parses numeric page and limit', async () => {
      service.getFavorites.mockResolvedValue({ data: [] as any[] } as any);
      await controller.getFavorites('u1', 2 as any, 10 as any, 'price', 'asc', 'vehicles');
      expect(service.getFavorites).toHaveBeenCalledWith('u1', 2, 10, 'price', 'asc', 'vehicles');
    });
  });

  // ── getFavoriteByListingId ──

  describe('getFavoriteByListingId', () => {
    it('delegates to service with valid auth', async () => {
      service.getFavoriteByListingId.mockResolvedValue({ favorited: true, id: 'f1' } as any);
      const result = await controller.getFavoriteByListingId('l1', 'Bearer valid.token');
      expect(result).toEqual({ isFavorite: true });
      expect(service.getFavoriteByListingId).toHaveBeenCalledWith('u1', 'l1');
    });

    it('returns favorited: false without auth', async () => {
      const result = await controller.getFavoriteByListingId('l1');
      expect(result).toEqual({ isFavorite: false });
    });
  });

  // ── getFavoritesCount ──

  describe('getFavoritesCount', () => {
    it('wraps count in { count } object', async () => {
      service.countFavorites.mockResolvedValue(42);
      const result = await controller.getFavoritesCount('u1');
      expect(result).toEqual({ count: 42 });
    });
  });

  // ── addFavorite ──

  describe('addFavorite', () => {
    it('delegates to service', async () => {
      service.addFavorite.mockResolvedValue({ id: 'f1' } as any);
      await controller.addFavorite('u1', 'l1');
      expect(service.addFavorite).toHaveBeenCalledWith('u1', 'l1');
    });
  });

  // ── bulkAddFavorites ──

  describe('bulkAddFavorites', () => {
    it('passes listing IDs array', async () => {
      service.bulkAddFavorites.mockResolvedValue([{ id: 'f1' }, { id: 'f2' }] as any);
      await controller.bulkAddFavorites('u1', ['l1', 'l2']);
      expect(service.bulkAddFavorites).toHaveBeenCalledWith('u1', ['l1', 'l2']);
    });

    it('throws BadRequestException when listingIds is undefined', async () => {
      await expect(controller.bulkAddFavorites('u1', undefined as any)).rejects.toThrow(BadRequestException);
    });
  });

  // ── removeFavorite ──

  describe('removeFavorite', () => {
    it('delegates to service', async () => {
      await controller.removeFavorite('u1', 'l1');
      expect(service.removeFavorite).toHaveBeenCalledWith('u1', 'l1');
    });
  });

  // ── bulkRemoveFavorites ──

  describe('bulkRemoveFavorites', () => {
    it('passes listing IDs array', async () => {
      await controller.bulkRemoveFavorites('u1', ['l1', 'l2']);
      expect(service.bulkRemoveFavorites).toHaveBeenCalledWith('u1', ['l1', 'l2']);
    });

    it('throws BadRequestException when listingIds is undefined', async () => {
      await expect(controller.bulkRemoveFavorites('u1', undefined as any)).rejects.toThrow(BadRequestException);
    });
  });

  // ── clearAllFavorites ──

  describe('clearAllFavorites', () => {
    it('delegates to service', async () => {
      await controller.clearAllFavorites('u1');
      expect(service.clearAllFavorites).toHaveBeenCalledWith('u1');
    });
  });
});
