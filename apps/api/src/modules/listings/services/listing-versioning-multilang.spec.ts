import { Test, TestingModule } from '@nestjs/testing';
import { ListingVersioningService } from './listing-versioning.service';
import { MultiLanguageService } from './multi-language.service';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * LISTING VERSIONING AND MULTI-LANGUAGE TESTS
 * 
 * These tests validate listing versioning and internationalization:
 * - Listing version control and history
 * - Multi-language content management
 * - Translation accuracy and consistency
 * - Version rollback capabilities
 * - Language switching and fallbacks
 * 
 * Business Truth Validated:
 * - Listing changes are versioned properly
 * - Multi-language content is consistent
 * - Translations are accurate and complete
 * - Version history is maintained
 * - Language fallbacks work correctly
 */

describe('ListingVersioningMultiLanguage', () => {
  let versioningService: ListingVersioningService;
  let multiLanguageService: MultiLanguageService;
  let prismaService: PrismaService;
  let cacheService: CacheService;
  let configService: ConfigService;
  let logger: Logger;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingVersioningService,
        MultiLanguageService,
        {
          provide: PrismaService,
          useValue: {
            listing: {
              findUnique: jest.fn(),
              update: jest.fn(),
              create: jest.fn(),
              findMany: jest.fn(),
            },
            listingVersion: {
              create: jest.fn(),
              findMany: jest.fn(),
              findFirst: jest.fn(),
            },
            listingTranslation: {
              create: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            language: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            exists: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                'listing.versioning.maxVersions': 50,
                'listing.translation.defaultLanguage': 'en',
                'listing.translation.supportedLanguages': ['en', 'ne', 'hi', 'zh', 'es'],
                'listing.translation.autoTranslate': true,
                'listing.translation.fallbackLanguage': 'en',
              };
              return config[key];
            }),
          },
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    versioningService = module.get<ListingVersioningService>(ListingVersioningService);
    multiLanguageService = module.get<MultiLanguageService>(MultiLanguageService);
    prismaService = module.get<PrismaService>(PrismaService);
    cacheService = module.get<CacheService>(CacheService);
    configService = module.get<ConfigService>(ConfigService);
    logger = module.get<Logger>(Logger);
  });

  describe('Listing Versioning', () => {
    it('should create new listing version on update', async () => {
      const listing = {
        id: 'listing-123',
        title: 'Luxury Apartment in Kathmandu',
        description: 'Beautiful apartment with mountain views',
        price: 5000,
        amenities: ['wifi', 'parking', 'gym'],
        location: 'Kathmandu',
        userId: 'user-123',
      };

      const updatedListing = {
        ...listing,
        title: 'Premium Luxury Apartment in Kathmandu',
        price: 5500,
        amenities: ['wifi', 'parking', 'gym', 'pool'],
      };

      // Mock existing listing
      prismaService.listing.findUnique.mockResolvedValueOnce(listing);
      
      // Mock version creation
      prismaService.listingVersion.create.mockResolvedValueOnce({
        id: 'version-2',
        listingId: 'listing-123',
        versionNumber: 2,
        data: listing,
        createdAt: new Date(),
        createdBy: 'user-123',
      });

      // Mock listing update
      prismaService.listing.update.mockResolvedValueOnce(updatedListing);

      const versionResult = await versioningService.createVersion(listing.id, updatedListing);

      expect(versionResult.success).toBe(true);
      expect(versionResult.versionNumber).toBe(2);
      expect(versionResult.previousVersion).toBe(1);
      expect(prismaService.listingVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          listingId: listing.id,
          versionNumber: 2,
          data: listing,
        })
      );
    });

    it('should maintain version history', async () => {
      const listingId = 'listing-123';
      const versions = [
        {
          id: 'version-1',
          listingId,
          versionNumber: 1,
          data: { title: 'Original Title', price: 4000 },
          createdAt: new Date('2024-06-01'),
          createdBy: 'user-123',
        },
        {
          id: 'version-2',
          listingId,
          versionNumber: 2,
          data: { title: 'Updated Title', price: 4500 },
          createdAt: new Date('2024-06-02'),
          createdBy: 'user-123',
        },
        {
          id: 'version-3',
          listingId,
          versionNumber: 3,
          data: { title: 'Final Title', price: 5000 },
          createdAt: new Date('2024-06-03'),
          createdBy: 'user-123',
        },
      ];

      prismaService.listingVersion.findMany.mockResolvedValueOnce(versions);

      const history = await versioningService.getVersionHistory(listingId);

      expect(history).toHaveLength(3);
      expect(history[0].versionNumber).toBe(3); // Most recent first
      expect(history[1].versionNumber).toBe(2);
      expect(history[2].versionNumber).toBe(1);
      expect(history[0].data.title).toBe('Final Title');
    });

    it('should rollback to previous version', async () => {
      const listingId = 'listing-123';
      const targetVersion = 2;

      const previousVersion = {
        id: 'version-2',
        listingId,
        versionNumber: 2,
        data: {
          title: 'Previous Title',
          description: 'Previous description',
          price: 4500,
          amenities: ['wifi', 'parking'],
        },
        createdAt: new Date('2024-06-02'),
      };

      prismaService.listingVersion.findFirst.mockResolvedValueOnce(previousVersion);
      prismaService.listing.update.mockResolvedValueOnce({
        id: listingId,
        ...previousVersion.data,
        updatedAt: new Date(),
      });

      const rollbackResult = await versioningService.rollbackToVersion(listingId, targetVersion);

      expect(rollbackResult.success).toBe(true);
      expect(rollbackResult.rollbackToVersion).toBe(2);
      expect(rollbackResult.title).toBe('Previous Title');
      expect(rollbackResult.price).toBe(4500);
      expect(prismaService.listing.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: listingId },
          data: previousVersion.data,
        })
      );
    });

    it('should compare versions and show differences', async () => {
      const listingId = 'listing-123';
      const version1 = {
        id: 'version-1',
        versionNumber: 1,
        data: {
          title: 'Original Title',
          price: 4000,
          amenities: ['wifi', 'parking'],
          description: 'Original description',
        },
      };

      const version2 = {
        id: 'version-2',
        versionNumber: 2,
        data: {
          title: 'Updated Title',
          price: 4500,
          amenities: ['wifi', 'parking', 'gym'],
          description: 'Updated description with more details',
        },
      };

      prismaService.listingVersion.findFirst
        .mockResolvedValueOnce(version1)
        .mockResolvedValueOnce(version2);

      const comparison = await versioningService.compareVersions(listingId, 1, 2);

      expect(comparison.differences).toHaveLength(4);
      expect(comparison.differences[0]).toEqual({
        field: 'title',
        oldValue: 'Original Title',
        newValue: 'Updated Title',
        changeType: 'modified',
      });
      expect(comparison.differences[1]).toEqual({
        field: 'price',
        oldValue: 4000,
        newValue: 4500,
        changeType: 'modified',
      });
      expect(comparison.differences[2]).toEqual({
        field: 'amenities',
        oldValue: ['wifi', 'parking'],
        newValue: ['wifi', 'parking', 'gym'],
        changeType: 'array_modified',
      });
    });

    it('should limit version history to prevent storage bloat', async () => {
      const listingId = 'listing-123';
      const maxVersions = 50;

      // Mock existing versions (already at limit)
      const existingVersions = Array.from({ length: maxVersions }, (_, i) => ({
        id: `version-${i + 1}`,
        listingId,
        versionNumber: i + 1,
        data: { title: `Version ${i + 1}` },
        createdAt: new Date(`2024-06-${i + 1}`),
      }));

      prismaService.listingVersion.findMany.mockResolvedValueOnce(existingVersions);

      // Create new version (should trigger cleanup)
      const newVersion = {
        id: 'version-51',
        listingId,
        versionNumber: 51,
        data: { title: 'New Version' },
        createdAt: new Date(),
      };

      prismaService.listingVersion.create.mockResolvedValueOnce(newVersion);
      prismaService.listingVersion.delete.mockResolvedValueOnce({});

      const versionResult = await versioningService.createVersion(listingId, { title: 'New Version' });

      expect(versionResult.success).toBe(true);
      expect(versionResult.versionNumber).toBe(51);
      expect(prismaService.listingVersion.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            versionNumber: 1, // Oldest version should be deleted
          }),
        })
      );
    });

    it('should track version changes for audit purposes', async () => {
      const listingId = 'listing-123';
      const changes = [
        {
          field: 'title',
          oldValue: 'Old Title',
          newValue: 'New Title',
          timestamp: new Date(),
          userId: 'user-123',
          reason: 'Improved SEO',
        },
        {
          field: 'price',
          oldValue: 4000,
          newValue: 4500,
          timestamp: new Date(),
          userId: 'user-123',
          reason: 'Market adjustment',
        },
      ];

      const auditTrail = await versioningService.getAuditTrail(listingId);

      expect(auditTrail).toBeDefined();
      expect(auditTrail.changes).toEqual(changes);
      expect(auditTrail.totalChanges).toBe(2);
      expect(auditTrail.lastUpdated).toBeInstanceOf(Date);
    });
  });

  describe('Multi-Language Support', () => {
    it('should create translations for supported languages', async () => {
      const listing = {
        id: 'listing-123',
        title: 'Luxury Apartment in Kathmandu',
        description: 'Beautiful apartment with mountain views and modern amenities',
        amenities: ['WiFi', 'Parking', 'Gym', 'Pool'],
        location: 'Kathmandu, Nepal',
      };

      const translations = {
        ne: {
          title: 'काठमाडौंमा विलासी अपार्टमेन्ट',
          description: 'पहाडको दृश्य र आधुनिक सुविधाहरू सहित सुन्दर अपार्टमेन्ट',
          amenities: ['वाईफाई', 'पार्किङ', 'जिम', 'पुल'],
          location: 'काठमाडौं, नेपाल',
        },
        hi: {
          title: 'काठमांडौ में लक्जरी अपार्टमेंट',
          description: 'पहाड़ के दृश्य और आधुनिक सुविधाओं के साथ सुंदर अपार्टमेंट',
          amenities: ['वाईफाई', 'पार्किंग', 'जिम', 'पूल'],
          location: 'काठमांडौ, नेपाल',
        },
      };

      // Mock translation service
      multiLanguageService.translateContent.mockResolvedValueOnce(translations.ne);
      multiLanguageService.translateContent.mockResolvedValueOnce(translations.hi);

      // Mock database saves
      prismaService.listingTranslation.create
        .mockResolvedValueOnce({ id: 'trans-ne', language: 'ne', ...translations.ne })
        .mockResolvedValueOnce({ id: 'trans-hi', language: 'hi', ...translations.hi });

      const translationResult = await multiLanguageService.createTranslations(listing.id, listing);

      expect(translationResult.success).toBe(true);
      expect(translationResult.translations).toHaveLength(2);
      expect(translationResult.translations[0].language).toBe('ne');
      expect(translationResult.translations[1].language).toBe('hi');
      expect(translationResult.translations[0].title).toBe('काठमाडौंमा विलासी अपार्टमेन्ट');
    });

    it('should handle language fallbacks gracefully', async () => {
      const listingId = 'listing-123';
      const requestedLanguage = 'fr'; // French (not supported)
      const fallbackLanguage = 'en';

      const englishContent = {
        title: 'Luxury Apartment in Kathmandu',
        description: 'Beautiful apartment with mountain views',
      };

      // Mock no translation found for French
      prismaService.listingTranslation.findMany.mockResolvedValueOnce([]);

      // Mock fallback to English
      prismaService.listing.findUnique.mockResolvedValueOnce({
        id: listingId,
        title: englishContent.title,
        description: englishContent.description,
      });

      const localizedContent = await multiLanguageService.getLocalizedContent(listingId, requestedLanguage);

      expect(localizedContent.language).toBe(fallbackLanguage);
      expect(localizedContent.title).toBe(englishContent.title);
      expect(localizedContent.description).toBe(englishContent.description);
      expect(localizedContent.isFallback).toBe(true);
    });

    it('should validate translation completeness', async () => {
      const listingId = 'listing-123';
      const translations = [
        {
          language: 'ne',
          title: 'काठमाडौंमा विलासी अपार्टमेन्ट',
          description: 'सुन्दर अपार्टमेन्ट',
          // Missing amenities and location
        },
        {
          language: 'hi',
          title: 'काठमांडौ में लक्जरी अपार्टमेंट',
          description: 'पहाड़ के दृश्य के साथ सुंदर अपार्टमेंट',
          amenities: ['वाईफाई', 'पार्किंग'],
          location: 'काठमांडौ, नेपाल',
        },
      ];

      const validation = await multiLanguageService.validateTranslations(listingId, translations);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toHaveLength(1);
      expect(validation.errors[0]).toEqual({
        language: 'ne',
        missingFields: ['amenities', 'location'],
        message: 'Translation incomplete for language: ne',
      });
      expect(validation.completenessPercentage).toBe(75); // 6/8 fields translated
    });

    it('should sync translations across languages', async () => {
      const listingId = 'listing-123';
      const updateData = {
        title: 'Updated Apartment Title',
        newAmenity: 'Air Conditioning',
      };

      const existingTranslations = [
        { language: 'ne', title: 'पुरानो शीर्षक', amenities: ['वाईफाई'] },
        { language: 'hi', title: 'पुराना शीर्षक', amenities: ['वाईफाई'] },
      ];

      prismaService.listingTranslation.findMany.mockResolvedValueOnce(existingTranslations);

      // Mock translation updates
      multiLanguageService.translateField.mockResolvedValueOnce('अपडेटेड अपार्टमेन्ट शीर्षक');
      multiLanguageService.translateField.mockResolvedValueOnce('एयर कंडीशनिंग');
      multiLanguageService.translateField.mockResolvedValueOnce('अपडेटेड अपार्टमेंट शीर्षक');
      multiLanguageService.translateField.mockResolvedValueOnce('एयर कंडीशनिंग');

      const syncResult = await multiLanguageService.syncTranslations(listingId, updateData);

      expect(syncResult.success).toBe(true);
      expect(syncResult.updatedLanguages).toHaveLength(2);
      expect(syncResult.updatedLanguages).toContain('ne');
      expect(syncResult.updatedLanguages).toContain('hi');
      expect(syncResult.translatedFields).toEqual(['title', 'newAmenity']);
    });

    it('should handle language-specific formatting', async () => {
      const listingId = 'listing-123';
      const languages = ['en', 'ne', 'hi', 'ar'];

      const localizedFormats = await multiLanguageService.getLocalizedFormats(listingId, languages);

      expect(localizedFormats.en.dateFormat).toBe('MM/DD/YYYY');
      expect(localizedFormats.en.currency).toBe('USD');
      expect(localizedFormats.ne.dateFormat).toBe('YYYY-MM-DD');
      expect(localizedFormats.ne.currency).toBe('NPR');
      expect(localizedFormats.hi.dateFormat).toBe('DD/MM/YYYY');
      expect(localizedFormats.hi.currency).toBe('INR');
      expect(localizedFormats.ar.dateFormat).toBe('DD/MM/YYYY');
      expect(localizedFormats.ar.currency).toBe('SAR');
      expect(localizedFormats.ar.textDirection).toBe('rtl');
    });

    it('should detect and handle translation conflicts', async () => {
      const listingId = 'listing-123';
      const conflictingTranslations = [
        {
          language: 'ne',
          field: 'title',
          manualTranslation: 'काठमाडौंमा विलासी अपार्टमेन्ट',
          autoTranslation: 'काठमाडौं विलासी अपार्टमेन्ट',
          confidence: 0.85,
        },
      ];

      const conflictDetection = await multiLanguageService.detectConflicts(listingId);

      expect(conflictDetection.hasConflicts).toBe(true);
      expect(conflictDetection.conflicts).toHaveLength(1);
      expect(conflictDetection.conflicts[0]).toEqual({
        language: 'ne',
        field: 'title',
        type: 'translation_variance',
        manualVersion: 'काठमाडौंमा विलासी अपार्टमेन्ट',
        autoVersion: 'काठमाडौं विलासी अपार्टमेन्ट',
        confidence: 0.85,
        requiresReview: true,
      });
    });

    it('should support bulk translation operations', async () => {
      const listings = [
        { id: 'listing-1', title: 'Apartment 1', description: 'Description 1' },
        { id: 'listing-2', title: 'Apartment 2', description: 'Description 2' },
        { id: 'listing-3', title: 'Apartment 3', description: 'Description 3' },
      ];

      const targetLanguages = ['ne', 'hi'];

      // Mock bulk translation
      multiLanguageService.bulkTranslate.mockResolvedValueOnce([
        { listingId: 'listing-1', language: 'ne', translations: { title: 'अपार्टमेन्ट 1' } },
        { listingId: 'listing-1', language: 'hi', translations: { title: 'अपार्टमेंट 1' } },
        { listingId: 'listing-2', language: 'ne', translations: { title: 'अपार्टमेन्ट 2' } },
        { listingId: 'listing-2', language: 'hi', translations: { title: 'अपार्टमेंट 2' } },
        { listingId: 'listing-3', language: 'ne', translations: { title: 'अपार्टमेन्ट 3' } },
        { listingId: 'listing-3', language: 'hi', translations: { title: 'अपार्टमेन्ट 3' } },
      ]);

      const bulkResult = await multiLanguageService.bulkTranslate(listings, targetLanguages);

      expect(bulkResult.success).toBe(true);
      expect(bulkResult.translatedCount).toBe(6); // 3 listings × 2 languages
      expect(bulkResult.processingTime).toBeGreaterThan(0);
      expect(bulkResult.averageConfidence).toBeGreaterThan(0.8);
    });
  });

  describe('Integration Between Versioning and Multi-Language', () => {
    it('should version translations with listing changes', async () => {
      const listingId = 'listing-123';
      const versionNumber = 2;

      const listingData = {
        title: 'Updated Title',
        description: 'Updated description',
      };

      const translationData = {
        ne: {
          title: 'अपडेटेड शीर्षक',
          description: 'अपडेटेड विवरण',
        },
        hi: {
          title: 'अपडेटेड शीर्षक',
          description: 'अपडेटेड विवरण',
        },
      };

      // Mock version creation with translations
      prismaService.listingVersion.create.mockResolvedValueOnce({
        id: 'version-2',
        listingId,
        versionNumber,
        data: listingData,
        translations: translationData,
        createdAt: new Date(),
      });

      const versionResult = await versioningService.createVersionWithTranslations(
        listingId,
        listingData,
        translationData
      );

      expect(versionResult.success).toBe(true);
      expect(versionResult.versionNumber).toBe(2);
      expect(versionResult.translations).toEqual(translationData);
      expect(prismaService.listingVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: listingData,
          translations: translationData,
        })
      );
    });

    it('should rollback translations with listing rollback', async () => {
      const listingId = 'listing-123';
      const targetVersion = 2;

      const versionData = {
        data: {
          title: 'Previous Title',
          description: 'Previous description',
        },
        translations: {
          ne: {
            title: 'पुरानो शीर्षक',
            description: 'पुरानो विवरण',
          },
          hi: {
            title: 'पुराना शीर्षक',
            description: 'पुराना विवरण',
          },
        },
      };

      prismaService.listingVersion.findFirst.mockResolvedValueOnce(versionData);
      prismaService.listing.update.mockResolvedValueOnce({
        id: listingId,
        ...versionData.data,
        updatedAt: new Date(),
      });

      // Mock translation updates
      prismaService.listingTranslation.update
        .mockResolvedValueOnce({ language: 'ne', ...versionData.translations.ne })
        .mockResolvedValueOnce({ language: 'hi', ...versionData.translations.hi });

      const rollbackResult = await versioningService.rollbackWithTranslations(listingId, targetVersion);

      expect(rollbackResult.success).toBe(true);
      expect(rollbackResult.rollbackToVersion).toBe(2);
      expect(rollbackResult.translations).toEqual(versionData.translations);
      expect(rollbackResult.translations.ne.title).toBe('पुरानो शीर्षक');
    });

    it('should track translation changes across versions', async () => {
      const listingId = 'listing-123';

      const versionHistory = [
        {
          versionNumber: 1,
          translations: {
            ne: { title: 'शीर्षक १' },
            hi: { title: 'शीर्षक १' },
          },
        },
        {
          versionNumber: 2,
          translations: {
            ne: { title: 'शीर्षक २' },
            hi: { title: 'शीर्षक २' },
          },
        },
      ];

      prismaService.listingVersion.findMany.mockResolvedValueOnce(versionHistory);

      const translationHistory = await multiLanguageService.getTranslationHistory(listingId);

      expect(translationHistory).toHaveLength(2);
      expect(translationHistory[0].changes.ne.title).toEqual({
        from: 'शीर्षक १',
        to: 'शीर्षक २',
        version: 2,
      });
      expect(translationHistory[0].changes.hi.title).toEqual({
        from: 'शीर्षक १',
        to: 'शीर्षक २',
        version: 2,
      });
    });
  });

  describe('Performance and Caching', () => {
    it('should cache translated content for performance', async () => {
      const listingId = 'listing-123';
      const language = 'ne';
      const cacheKey = `listing:${listingId}:translation:${language}`;

      const translatedContent = {
        title: 'काठमाडौंमा विलासी अपार्टमेन्ट',
        description: 'सुन्दर अपार्टमेन्ट',
      };

      // Cache miss
      cacheService.exists.mockResolvedValueOnce(false);
      prismaService.listingTranslation.findUnique.mockResolvedValueOnce({
        ...translatedContent,
        language,
      });

      // Should cache the result
      cacheService.set.mockResolvedValueOnce(true);

      const content = await multiLanguageService.getLocalizedContent(listingId, language);

      expect(content).toEqual(translatedContent);
      expect(cacheService.set).toHaveBeenCalledWith(
        cacheKey,
        translatedContent,
        expect.any(Object) // TTL options
      );
    });

    it('should serve from cache when available', async () => {
      const listingId = 'listing-123';
      const language = 'ne';
      const cacheKey = `listing:${listingId}:translation:${language}`;

      const cachedContent = {
        title: 'काठमाडौंमा विलासी अपार्टमेन्ट',
        description: 'सुन्दर अपार्टमेन्ट',
      };

      // Cache hit
      cacheService.exists.mockResolvedValueOnce(true);
      cacheService.get.mockResolvedValueOnce(cachedContent);

      const content = await multiLanguageService.getLocalizedContent(listingId, language);

      expect(content).toEqual(cachedContent);
      expect(cacheService.get).toHaveBeenCalledWith(cacheKey);
      // Should not hit database
      expect(prismaService.listingTranslation.findUnique).not.toHaveBeenCalled();
    });

    it('should invalidate cache on content updates', async () => {
      const listingId = 'listing-123';
      const languages = ['en', 'ne', 'hi'];

      const updateData = {
        title: 'Updated Title',
        description: 'Updated description',
      };

      await multiLanguageService.updateContent(listingId, updateData, languages);

      // Should invalidate all language caches
      expect(cacheService.del).toHaveBeenCalledTimes(3);
      expect(cacheService.del).toHaveBeenCalledWith(`listing:${listingId}:translation:en`);
      expect(cacheService.del).toHaveBeenCalledWith(`listing:${listingId}:translation:ne`);
      expect(cacheService.del).toHaveBeenCalledWith(`listing:${listingId}:translation:hi`);
    });

    it('should handle cache warming for popular content', async () => {
      const popularListings = ['listing-1', 'listing-2', 'listing-3'];
      const languages = ['ne', 'hi'];

      // Mock database queries for cache warming
      prismaService.listing.findMany.mockResolvedValueOnce(
        popularListings.map(id => ({ id, title: `Title ${id}` }))
      );

      const warmResult = await multiLanguageService.warmCache(popularListings, languages);

      expect(warmResult.warmedItems).toBe(6); // 3 listings × 2 languages
      expect(cacheService.set).toHaveBeenCalledTimes(6);
    });
  });

  describe('Quality Assurance', () => {
    it('should validate translation quality metrics', async () => {
      const translations = [
        {
          language: 'ne',
          sourceText: 'Luxury Apartment with Mountain Views',
          translatedText: 'पहाडको दृश्य भएको विलासी अपार्टमेन्ट',
          confidence: 0.92,
          professionalReviewed: true,
        },
        {
          language: 'hi',
          sourceText: 'Luxury Apartment with Mountain Views',
          translatedText: 'पहाड़ के दृश्य वाला लक्जरी अपार्टमेंट',
          confidence: 0.88,
          professionalReviewed: false,
        },
      ];

      const qualityMetrics = await multiLanguageService.assessTranslationQuality(translations);

      expect(qualityMetrics.overallScore).toBeGreaterThan(0.8);
      expect(qualityMetrics.ne.score).toBe(0.92);
      expect(qualityMetrics.ne.professionalReviewed).toBe(true);
      expect(qualityMetrics.hi.score).toBe(0.88);
      expect(qualityMetrics.hi.professionalReviewed).toBe(false);
      expect(qualityMetrics.requiresReview).toContain('hi');
    });

    it('should detect potential translation errors', async () => {
      const suspiciousTranslations = [
        {
          language: 'ne',
          sourceText: 'Free WiFi',
          translatedText: 'मुफ्त वाईफाई',
          confidence: 0.95,
        },
        {
          language: 'ne',
          sourceText: 'Free WiFi',
          translatedText: 'सशुल्क वाईफाई', // Wrong translation
          confidence: 0.45,
        },
      ];

      const errorDetection = await multiLanguageService.detectTranslationErrors(suspiciousTranslations);

      expect(errorDetection.hasErrors).toBe(true);
      expect(errorDetection.errors).toHaveLength(1);
      expect(errorDetection.errors[0]).toEqual({
        language: 'ne',
        sourceText: 'Free WiFi',
        translatedText: 'सशुल्क वाईफाई',
        issue: 'low_confidence',
        confidence: 0.45,
        suggestedFix: 'मुफ्त वाईफाई',
      });
    });

    it('should maintain translation consistency across similar content', async () => {
      const similarListings = [
        {
          id: 'listing-1',
          title: 'Luxury Apartment in Kathmandu',
          translations: { ne: 'काठमाडौंमा विलासी अपार्टमेन्ट' },
        },
        {
          id: 'listing-2',
          title: 'Luxury Apartment in Pokhara',
          translations: { ne: 'पोखरामा विलासी अपार्टमेन्ट' },
        },
        {
          id: 'listing-3',
          title: 'Luxury Apartment in Lalitpur',
          translations: { ne: 'ललितपुरमा विलासी अपार्टमेन्ट' },
        },
      ];

      const consistencyCheck = await multiLanguageService.checkConsistency(similarListings);

      expect(consistencyCheck.isConsistent).toBe(true);
      expect(consistencyCheck.consistencyScore).toBeGreaterThan(0.9);
      expect(consistencyCheck.patterns).toContain('Luxury Apartment -> विलासी अपार्टमेन्ट');
    });
  });
});
