import { ListingContentController } from './listing-content.controller';
import { PrismaService } from '@/common/prisma/prisma.service';

describe('ListingContentController', () => {
  let controller: ListingContentController;
  let contentService: any;
  let prisma: any;

  beforeEach(() => {
    contentService = {
      upsert: jest.fn().mockResolvedValue({ listingId: 'l-1', locale: 'ne', title: 'कोठा' }),
      findAllForListing: jest.fn().mockResolvedValue([
        { locale: 'en', title: 'Room' },
        { locale: 'ne', title: 'कोठा' },
      ]),
      getAvailableLocales: jest.fn().mockResolvedValue(['en', 'ne']),
      findByLocale: jest.fn().mockResolvedValue({ locale: 'ne', title: 'कोठा' }),
      deleteByLocale: jest.fn().mockResolvedValue(undefined),
    };

    prisma = {
      listing: { findUnique: jest.fn().mockResolvedValue({ ownerId: 'user-1' }) },
      user: { findUnique: jest.fn() },
      booking: { findUnique: jest.fn() },
    };

    controller = new ListingContentController(contentService, prisma);
  });

  describe('upsert', () => {
    it('should upsert listing content for locale', async () => {
      const body = { title: 'कोठा', description: 'राम्रो कोठा' };
      const result = await controller.upsert('l-1', 'ne', body as any, 'user-1');

      expect(result).toBeDefined();
      expect(contentService.upsert).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all content for listing', async () => {
      const result = await controller.findAll('l-1');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
    });
  });

  describe('getLocales', () => {
    it('should return available locales', async () => {
      const result = await controller.getLocales('l-1');

      expect(result).toContain('en');
      expect(result).toContain('ne');
    });
  });

  describe('findByLocale', () => {
    it('should return content for specific locale', async () => {
      const result = await controller.findByLocale('l-1', 'ne');

      expect(result.locale).toBe('ne');
      expect(contentService.findByLocale).toHaveBeenCalledWith('l-1', 'ne');
    });
  });

  describe('deleteByLocale', () => {
    it('should delete content for locale', async () => {
      await controller.deleteByLocale('l-1', 'ne', 'user-1');

      expect(contentService.deleteByLocale).toHaveBeenCalledWith('l-1', 'ne');
    });
  });
});
