import { Test, TestingModule } from '@nestjs/testing';
import { ListingContentService, CreateListingContentDto } from './listing-content.service';
import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * MULTI-LANGUAGE TESTS
 * 
 * These tests validate multi-language content support:
 * - Content creation in multiple locales
 * - Locale-specific content retrieval
 * - Fallback to default locale
 * - Content updates per locale
 * - Unicode character support
 * 
 * Business Truth Validated:
 * - Listings can have content in multiple languages
 * - Users can retrieve content in their preferred locale
 * - Fallback to English when translation is missing
 * - Unicode characters are properly handled
 * - Content can be updated per locale independently
 */
describe('Multi-Language Tests', () => {
  let service: ListingContentService;
  let prisma: any;

  beforeEach(async () => {
    const mockPrismaService: any = {
      listing: {
        findUnique: jest.fn(),
      },
      listingContent: {
        upsert: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingContentService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ListingContentService>(ListingContentService);
    prisma = mockPrismaService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Content Creation in Multiple Locales', () => {
    it('should create content in English', async () => {
      prisma.listing.findUnique.mockResolvedValue({ id: 'listing-123' });
      prisma.listingContent.upsert.mockResolvedValue({
        id: 'content-123',
        listingId: 'listing-123',
        locale: 'en',
        title: 'Test Listing',
        description: 'Test Description',
      });

      const dto: CreateListingContentDto = {
        listingId: 'listing-123',
        locale: 'en',
        title: 'Test Listing',
        description: 'Test Description',
      };

      const result = await service.upsert('listing-123', 'en', dto);

      expect(result.locale).toBe('en');
      expect(prisma.listingContent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ locale: 'en' }),
        })
      );
    });

    it('should create content in Nepali', async () => {
      prisma.listing.findUnique.mockResolvedValue({ id: 'listing-123' });
      prisma.listingContent.upsert.mockResolvedValue({
        id: 'content-123',
        listingId: 'listing-123',
        locale: 'ne',
        title: 'परीक्षण सूची',
        description: 'परीक्षण विवरण',
      });

      const dto: CreateListingContentDto = {
        listingId: 'listing-123',
        locale: 'ne',
        title: 'परीक्षण सूची',
        description: 'परीक्षण विवरण',
      };

      const result = await service.upsert('listing-123', 'ne', dto);

      expect(result.locale).toBe('ne');
    });

    it('should create content in Spanish', async () => {
      prisma.listing.findUnique.mockResolvedValue({ id: 'listing-123' });
      prisma.listingContent.upsert.mockResolvedValue({
        id: 'content-123',
        listingId: 'listing-123',
        locale: 'es',
        title: 'Listado de Prueba',
        description: 'Descripción de Prueba',
      });

      const dto: CreateListingContentDto = {
        listingId: 'listing-123',
        locale: 'es',
        title: 'Listado de Prueba',
        description: 'Descripción de Prueba',
      };

      const result = await service.upsert('listing-123', 'es', dto);

      expect(result.locale).toBe('es');
    });
  });

  describe('Locale-Specific Content Retrieval', () => {
    it('should retrieve content for specific locale', async () => {
      prisma.listingContent.findUnique.mockResolvedValue({
        id: 'content-123',
        listingId: 'listing-123',
        locale: 'ne',
        title: 'नेपाली शीर्षक',
        description: 'नेपाली विवरण',
      });

      const result = await service.findByLocale('listing-123', 'ne');

      expect(result?.locale).toBe('ne');
      expect(result?.title).toBe('नेपाली शीर्षक');
    });

    it('should retrieve all locales for a listing', async () => {
      prisma.listingContent.findMany.mockResolvedValue([
        {
          id: 'content-1',
          listingId: 'listing-123',
          locale: 'en',
          title: 'English Title',
        },
        {
          id: 'content-2',
          listingId: 'listing-123',
          locale: 'ne',
          title: 'नेपाली शीर्षक',
        },
        {
          id: 'content-3',
          listingId: 'listing-123',
          locale: 'es',
          title: 'Título en Español',
        },
      ]);

      const result = await service.findAllForListing('listing-123');

      expect(result).toHaveLength(3);
      expect(result[0].locale).toBe('en');
      expect(result[1].locale).toBe('ne');
      expect(result[2].locale).toBe('es');
    });
  });

  describe('Fallback to Default Locale', () => {
    it('should fallback to English when locale not found', async () => {
      prisma.listingContent.findUnique
        .mockResolvedValueOnce(null) // ne not found
        .mockResolvedValueOnce({
          id: 'content-en',
          listingId: 'listing-123',
          locale: 'en',
          title: 'English Title',
          description: 'English Description',
        }); // English fallback

      const result = await service.findByLocale('listing-123', 'ne');

      expect(result?.locale).toBe('en');
      expect((result as any)?._fallbackLocale).toBe('en');
    });

    it('should not fallback when English is requested', async () => {
      prisma.listingContent.findUnique.mockResolvedValue(null);

      const result = await service.findByLocale('listing-123', 'en');

      expect(result).toBeNull();
    });

    it('should return null when no content exists for any locale', async () => {
      prisma.listingContent.findUnique.mockResolvedValue(null);

      const result = await service.findByLocale('listing-123', 'fr');

      expect(result).toBeNull();
    });
  });

  describe('Content Updates Per Locale', () => {
    it('should update content for specific locale only', async () => {
      prisma.listing.findUnique.mockResolvedValue({ id: 'listing-123' });
      prisma.listingContent.upsert.mockResolvedValue({
        id: 'content-123',
        listingId: 'listing-123',
        locale: 'ne',
        title: 'Updated Nepali Title',
        description: 'Updated Nepali Description',
      });

      const updateDto = {
        title: 'Updated Nepali Title',
        description: 'Updated Nepali Description',
      };

      const result = await service.upsert('listing-123', 'ne', updateDto);

      expect(result.locale).toBe('ne');
      expect(result.title).toBe('Updated Nepali Title');
    });

    it('should not affect other locales when updating one', async () => {
      prisma.listing.findUnique.mockResolvedValue({ id: 'listing-123' });
      prisma.listingContent.upsert.mockResolvedValue({
        id: 'content-ne',
        listingId: 'listing-123',
        locale: 'ne',
        title: 'Updated Nepali Title',
        description: 'Updated Nepali Description',
      });

      const updateDto = {
        title: 'Updated Nepali Title',
        description: 'Updated Nepali Description',
      };

      await service.upsert('listing-123', 'ne', updateDto);

      // Should only update Nepali locale
      expect(prisma.listingContent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            listingId_locale: { listingId: 'listing-123', locale: 'ne' },
          }),
        })
      );
    });
  });

  describe('Unicode Character Support', () => {
    it('should handle Nepali unicode characters', async () => {
      prisma.listing.findUnique.mockResolvedValue({ id: 'listing-123' });
      prisma.listingContent.upsert.mockResolvedValue({
        id: 'content-123',
        listingId: 'listing-123',
        locale: 'ne',
        title: 'क्यामेरा भाडामा लिन',
        description: 'प्रोफेशनल क्यामेरा किट लेन्स, ब्याट्री, र क्यारिंग केस सहित।',
      });

      const dto: CreateListingContentDto = {
        listingId: 'listing-123',
        locale: 'ne',
        title: 'क्यामेरा भाडामा लिन',
        description: 'प्रोफेशनल क्यामेरा किट लेन्स, ब्याट्री, र क्यारिंग केस सहित।',
      };

      const result = await service.upsert('listing-123', 'ne', dto);

      expect(result.title).toBe('क्यामेरा भाडामा लिन');
    });

    it('should handle Chinese unicode characters', async () => {
      prisma.listing.findUnique.mockResolvedValue({ id: 'listing-123' });
      prisma.listingContent.upsert.mockResolvedValue({
        id: 'content-123',
        listingId: 'listing-123',
        locale: 'zh',
        title: '相机租赁',
        description: '专业相机套件，包括镜头、电池和携带包。',
      });

      const dto: CreateListingContentDto = {
        listingId: 'listing-123',
        locale: 'zh',
        title: '相机租赁',
        description: '专业相机套件，包括镜头、电池和携带包。',
      };

      const result = await service.upsert('listing-123', 'zh', dto);

      expect(result.title).toBe('相机租赁');
    });

    it('should handle Arabic unicode characters', async () => {
      prisma.listing.findUnique.mockResolvedValue({ id: 'listing-123' });
      prisma.listingContent.upsert.mockResolvedValue({
        id: 'content-123',
        listingId: 'listing-123',
        locale: 'ar',
        title: 'تأجير الكاميرا',
        description: 'طقم الكاميرا الاحترافي مع العدسة والبطاريات وحقيبة الحمل.',
      });

      const dto: CreateListingContentDto = {
        listingId: 'listing-123',
        locale: 'ar',
        title: 'تأجير الكاميرا',
        description: 'طقم الكاميرا الاحترافي مع العدسة والبطاريات وحقيبة الحمل.',
      };

      const result = await service.upsert('listing-123', 'ar', dto);

      expect(result.title).toBe('تأجير الكاميرا');
    });
  });

  describe('Locale Validation', () => {
    it('should accept valid locale codes', async () => {
      const validLocales = ['en', 'ne', 'es', 'fr', 'de', 'zh', 'ar', 'ja', 'ko'];

      prisma.listing.findUnique.mockResolvedValue({ id: 'listing-123' });
      prisma.listingContent.upsert.mockResolvedValue({
        id: 'content-123',
        listingId: 'listing-123',
        locale: 'en',
        title: 'Test',
        description: 'Test',
      });

      for (const locale of validLocales) {
        const dto: CreateListingContentDto = {
          listingId: 'listing-123',
          locale,
          title: 'Test',
          description: 'Test',
        };
        await service.upsert('listing-123', locale, dto);
      }

      expect(prisma.listingContent.upsert).toHaveBeenCalledTimes(validLocales.length);
    });
  });

  describe('Highlights and Rules', () => {
    it('should store highlights in locale-specific content', async () => {
      prisma.listing.findUnique.mockResolvedValue({ id: 'listing-123' });
      prisma.listingContent.upsert.mockResolvedValue({
        id: 'content-123',
        listingId: 'listing-123',
        locale: 'en',
        title: 'Test',
        description: 'Test',
        highlights: '["WiFi", "Parking"]',
      });

      const dto: CreateListingContentDto = {
        listingId: 'listing-123',
        locale: 'en',
        title: 'Test',
        description: 'Test',
        highlights: ['WiFi', 'Parking'],
      };

      const result = await service.upsert('listing-123', 'en', dto);

      expect(result.highlights).toBeDefined();
    });

    it('should store rules in locale-specific content', async () => {
      prisma.listing.findUnique.mockResolvedValue({ id: 'listing-123' });
      prisma.listingContent.upsert.mockResolvedValue({
        id: 'content-123',
        listingId: 'listing-123',
        locale: 'en',
        title: 'Test',
        description: 'Test',
        rules: 'No smoking, No pets',
      });

      const dto: CreateListingContentDto = {
        listingId: 'listing-123',
        locale: 'en',
        title: 'Test',
        description: 'Test',
        rules: 'No smoking, No pets',
      };

      const result = await service.upsert('listing-123', 'en', dto);

      expect(result.rules).toBe('No smoking, No pets');
    });
  });
});
