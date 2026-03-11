import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ListingContentService } from './listing-content.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

describe('ListingContentService', () => {
  let service: ListingContentService;
  let prisma: any;

  const listingId = 'listing-1';
  const locale = 'en';
  const mockContent = {
    id: 'content-1',
    listingId,
    locale,
    title: 'Test Listing',
    description: 'A great place',
    rules: 'No smoking',
    highlights: JSON.stringify(['Pool', 'WiFi']),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      listing: {
        findUnique: jest.fn(),
      },
      listingContent: {
        upsert: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingContentService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ListingContentService>(ListingContentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('upsert', () => {
    const dto = {
      listingId,
      locale: 'en',
      title: 'Test Listing',
      description: 'A great place',
      rules: 'No smoking',
      highlights: ['Pool', 'WiFi'],
    };

    it('should upsert content successfully', async () => {
      prisma.listing.findUnique.mockResolvedValue({ id: listingId });
      prisma.listingContent.upsert.mockResolvedValue(mockContent);

      const result = await service.upsert(listingId, 'en', dto);

      expect(result).toEqual(mockContent);
      expect(prisma.listingContent.upsert).toHaveBeenCalledWith({
        where: { listingId_locale: { listingId, locale: 'en' } },
        create: expect.objectContaining({
          listingId,
          locale: 'en',
          title: 'Test Listing',
          description: 'A great place',
        }),
        update: expect.objectContaining({
          title: 'Test Listing',
          description: 'A great place',
        }),
      });
    });

    it('should throw NotFoundException if listing does not exist', async () => {
      prisma.listing.findUnique.mockResolvedValue(null);

      await expect(service.upsert(listingId, 'en', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle partial update (only title)', async () => {
      prisma.listing.findUnique.mockResolvedValue({ id: listingId });
      prisma.listingContent.upsert.mockResolvedValue({
        ...mockContent,
        title: 'Updated Title',
      });

      const result = await service.upsert(listingId, 'en', {
        title: 'Updated Title',
      } as any);

      expect(result.title).toBe('Updated Title');
    });

    it('should serialize highlights as JSON', async () => {
      prisma.listing.findUnique.mockResolvedValue({ id: listingId });
      prisma.listingContent.upsert.mockResolvedValue(mockContent);

      await service.upsert(listingId, 'en', dto);

      expect(prisma.listingContent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            highlights: JSON.stringify(['Pool', 'WiFi']),
          }),
        }),
      );
    });

    it('should set highlights to null when not provided', async () => {
      prisma.listing.findUnique.mockResolvedValue({ id: listingId });
      prisma.listingContent.upsert.mockResolvedValue(mockContent);

      await service.upsert(listingId, 'en', {
        title: 'Test',
        description: 'Desc',
      } as any);

      expect(prisma.listingContent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            highlights: null,
          }),
        }),
      );
    });
  });

  describe('findAllForListing', () => {
    it('should return all content entries ordered by locale', async () => {
      const contents = [
        { ...mockContent, locale: 'de' },
        { ...mockContent, locale: 'en' },
        { ...mockContent, locale: 'fr' },
      ];
      prisma.listingContent.findMany.mockResolvedValue(contents);

      const result = await service.findAllForListing(listingId);

      expect(result).toHaveLength(3);
      expect(prisma.listingContent.findMany).toHaveBeenCalledWith({
        where: { listingId },
        orderBy: { locale: 'asc' },
      });
    });

    it('should return empty array when no content exists', async () => {
      prisma.listingContent.findMany.mockResolvedValue([]);

      const result = await service.findAllForListing(listingId);

      expect(result).toEqual([]);
    });
  });

  describe('findByLocale', () => {
    it('should return content for the exact locale', async () => {
      prisma.listingContent.findUnique.mockResolvedValue(mockContent);

      const result = await service.findByLocale(listingId, 'en');

      expect(result).toEqual(mockContent);
    });

    it('should fall back to en when requested locale not found', async () => {
      const enContent = { ...mockContent, locale: 'en' };
      prisma.listingContent.findUnique
        .mockResolvedValueOnce(null) // fr not found
        .mockResolvedValueOnce(enContent); // fallback to en

      const result = await service.findByLocale(listingId, 'fr');

      expect(result).toEqual({ ...enContent, _fallbackLocale: 'en' });
      expect(prisma.listingContent.findUnique).toHaveBeenCalledTimes(2);
    });

    it('should return null when locale and en fallback both missing', async () => {
      prisma.listingContent.findUnique
        .mockResolvedValueOnce(null) // fr not found
        .mockResolvedValueOnce(null); // en not found either

      const result = await service.findByLocale(listingId, 'fr');

      expect(result).toBeNull();
    });

    it('should return null without fallback when en itself is missing', async () => {
      prisma.listingContent.findUnique.mockResolvedValue(null);

      const result = await service.findByLocale(listingId, 'en');

      expect(result).toBeNull();
      // Should NOT attempt fallback since locale is already 'en'
      expect(prisma.listingContent.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteByLocale', () => {
    it('should delete content for a given locale', async () => {
      prisma.listingContent.findUnique.mockResolvedValue(mockContent);
      prisma.listingContent.delete.mockResolvedValue(mockContent);

      const result = await service.deleteByLocale(listingId, 'fr');

      expect(result).toEqual(mockContent);
    });

    it('should throw NotFoundException if content not found', async () => {
      prisma.listingContent.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteByLocale(listingId, 'fr'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should prevent deleting en when it is the only locale', async () => {
      prisma.listingContent.count.mockResolvedValue(1);

      await expect(
        service.deleteByLocale(listingId, 'en'),
      ).rejects.toThrow(ConflictException);
    });

    it('should allow deleting en when other locales exist', async () => {
      prisma.listingContent.count.mockResolvedValue(3);
      prisma.listingContent.findUnique.mockResolvedValue(mockContent);
      prisma.listingContent.delete.mockResolvedValue(mockContent);

      const result = await service.deleteByLocale(listingId, 'en');

      expect(result).toEqual(mockContent);
    });
  });

  describe('getAvailableLocales', () => {
    it('should return list of available locales', async () => {
      prisma.listingContent.findMany.mockResolvedValue([
        { locale: 'de' },
        { locale: 'en' },
        { locale: 'fr' },
      ]);

      const result = await service.getAvailableLocales(listingId);

      expect(result).toEqual(['de', 'en', 'fr']);
    });

    it('should return empty array for no content', async () => {
      prisma.listingContent.findMany.mockResolvedValue([]);

      const result = await service.getAvailableLocales(listingId);

      expect(result).toEqual([]);
    });
  });
});
