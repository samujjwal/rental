import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ListingsController } from './listings.controller';
import { ListingsService } from '../services/listings.service';
import { AvailabilityService } from '../services/availability.service';
import { ListingCompletenessService } from '../services/listing-completeness.service';
import { ListingVersionService } from '../services/listing-version.service';
import { JwtService } from '@nestjs/jwt';
import { SearchService } from '@/modules/search/services/search.service';

describe('ListingsController', () => {
  let controller: ListingsController;
  let listingsService: jest.Mocked<ListingsService>;
  let availabilityService: jest.Mocked<AvailabilityService>;
  let completenessService: jest.Mocked<ListingCompletenessService>;
  let versionService: jest.Mocked<ListingVersionService>;
  let jwtService: jest.Mocked<JwtService>;

  const mockListing = {
    id: 'l1',
    ownerId: 'u1',
    title: 'Test Listing',
    description: 'Desc',
    basePrice: 100,
    currency: 'NPR',
    condition: 'GOOD',
    address: '123 St',
    city: 'Kathmandu',
    state: 'Bagmati',
    country: 'Nepal',
    zipCode: '44600',
    latitude: 27.7,
    longitude: 85.3,
    photos: ['img1.jpg'],
    features: ['wifi'],
    status: 'AVAILABLE',
    averageRating: 4.5,
    totalReviews: 5,
    totalBookings: 10,
    views: 100,
    featured: true,
    verificationStatus: 'VERIFIED',
    bookingMode: 'INSTANT_BOOK',
    securityDeposit: 500,
    weeklyDiscount: 10,
    monthlyDiscount: 20,
    metadata: null,
    category: { id: 'c1', name: 'Electronics', slug: 'electronics' },
    owner: { id: 'u1', firstName: 'Sam', lastName: 'D', profilePhotoUrl: null, averageRating: 4, idVerificationStatus: 'VERIFIED' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ListingsController],
      providers: [
        {
          provide: ListingsService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findById: jest.fn(),
            findOne: jest.fn(),
            findBySlug: jest.fn(),
            getOwnerProperties: jest.fn(),
            getPriceSuggestion: jest.fn(),
            update: jest.fn(),
            publish: jest.fn(),
            pause: jest.fn(),
            activate: jest.fn(),
            delete: jest.fn(),
            getPropertyStats: jest.fn(),
            incrementViewCount: jest.fn(),
          },
        },
        {
          provide: ListingVersionService,
          useValue: {
            getVersion: jest.fn(),
            createVersion: jest.fn(),
            getCompleteness: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn(),
          },
        },
        {
          provide: AvailabilityService,
          useValue: {
            createAvailability: jest.fn(),
            getListingAvailability: jest.fn(),
            checkAvailability: jest.fn(),
            getAvailableDates: jest.fn(),
          },
        },
        {
          provide: ListingCompletenessService,
          useValue: {
            getCompleteness: jest.fn(),
          },
        },
        {
          provide: SearchService,
          useValue: {
            search: jest.fn().mockResolvedValue({ listings: [], total: 0 }),
          },
        },
      ],
    }).compile();

    controller = module.get(ListingsController);
    listingsService = module.get(ListingsService) as jest.Mocked<ListingsService>;
    availabilityService = module.get(AvailabilityService) as jest.Mocked<AvailabilityService>;
    completenessService = module.get(ListingCompletenessService) as jest.Mocked<ListingCompletenessService>;
    versionService = module.get(ListingVersionService) as jest.Mocked<ListingVersionService>;
    jwtService = module.get(JwtService) as jest.Mocked<JwtService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── create ──
  describe('create', () => {
    it('delegates to listingsService.create', async () => {
      listingsService.create.mockResolvedValue(mockListing as any);
      const dto = { title: 'New', categoryId: 'c1' } as any;
      const result = await controller.create('u1', dto);
      expect(listingsService.create).toHaveBeenCalledWith('u1', dto);
      expect(result).toBe(mockListing);
    });
  });

  // ── findAll ──
  describe('findAll', () => {
    it('defaults to page 1 and limit 20', async () => {
      listingsService.findAll.mockResolvedValue({ listings: [mockListing], total: 1 } as any);
      await controller.findAll(undefined, undefined, undefined);
      expect(listingsService.findAll).toHaveBeenCalledWith({}, 1, 20);
    });

    it('maps listings via mapToFrontendListing', async () => {
      listingsService.findAll.mockResolvedValue({ listings: [mockListing], total: 1 } as any);
      const result = await controller.findAll(2, 10, { city: 'Kathmandu' } as any);
      expect(result.listings[0]).toHaveProperty('pricePerDay', 100);
      expect(result.listings[0]).toHaveProperty('location');
    });
  });

  // ── getMyListings ──
  describe('getMyListings', () => {
    it('calls getOwnerProperties with userId', async () => {
      listingsService.getOwnerProperties.mockResolvedValue([mockListing] as any);
      const result = await controller.getMyListings('u1', undefined);
      expect(listingsService.getOwnerProperties).toHaveBeenCalledWith('u1', false);
      expect(result).toHaveLength(1);
    });

    it('passes all=true when requested', async () => {
      listingsService.getOwnerProperties.mockResolvedValue([] as any);
      await controller.getMyListings('u1', true);
      expect(listingsService.getOwnerProperties).toHaveBeenCalledWith('u1', true);
    });
  });

  // ── getFeaturedListings ──
  describe('getFeaturedListings', () => {
    it('defaults limit to 8', async () => {
      listingsService.findAll.mockResolvedValue({ listings: [], total: 0 } as any);
      await controller.getFeaturedListings(undefined);
      expect(listingsService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ featured: true }),
        1,
        8,
      );
    });
  });

  // ── getPriceSuggestion ──
  describe('getPriceSuggestion', () => {
    it('delegates query params to service', async () => {
      const suggestion = { min: 50, max: 200, average: 120 };
      listingsService.getPriceSuggestion.mockResolvedValue(suggestion as any);
      const result = await controller.getPriceSuggestion('c1', 'Kathmandu', 'good');
      expect(listingsService.getPriceSuggestion).toHaveBeenCalledWith({
        categoryId: 'c1',
        city: 'Kathmandu',
        condition: 'good',
      });
      expect(result).toBe(suggestion);
    });
  });

  // ── getCompleteness ──
  describe('getCompleteness', () => {
    it('delegates to completenessService', async () => {
      const score = { score: 85, missing: ['images'] };
      completenessService.getCompleteness.mockResolvedValue(score as any);
      expect(await controller.getCompleteness('l1')).toBe(score);
    });
  });

  // ── findBySlug ──
  describe('findBySlug', () => {
    it('returns mapped listing', async () => {
      listingsService.findBySlug.mockResolvedValue(mockListing as any);
      const result = await controller.findBySlug('test-slug');
      expect(result).toHaveProperty('id', 'l1');
      expect(result).toHaveProperty('pricePerDay');
    });
  });

  // ── findById ──
  describe('findById', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('returns mapped listing for any status', async () => {
      listingsService.findById.mockResolvedValue({ ...mockListing, status: 'AVAILABLE' } as any);
      const result = await controller.findById('l1', { user: undefined });
      expect(result).toHaveProperty('id', 'l1');
      expect(listingsService.findById).toHaveBeenCalledWith('l1', false, undefined, undefined);
    });

    it('returns RENTED listing', async () => {
      listingsService.findById.mockResolvedValue({ ...mockListing, status: 'RENTED' } as any);
      const result = await controller.findById('l1', { user: undefined });
      expect(result).toHaveProperty('id', 'l1');
    });

    it('returns DRAFT listing (service handles visibility)', async () => {
      listingsService.findById.mockResolvedValue({ ...mockListing, status: 'DRAFT' } as any);
      const result = await controller.findById('l1', { user: undefined });
      expect(result).toHaveProperty('id', 'l1');
      expect(result).toHaveProperty('status', 'DRAFT');
    });

    it('propagates NotFoundException when service throws', async () => {
      listingsService.findById.mockRejectedValue(new NotFoundException('Not found'));
      await expect(controller.findById('l1', { user: undefined })).rejects.toThrow(NotFoundException);
    });

    it('returns listing with mapped properties', async () => {
      listingsService.findById.mockResolvedValue(mockListing as any);
      const result = await controller.findById('l1', { user: undefined });
      expect(result).toHaveProperty('pricePerDay');
      expect(result).toHaveProperty('location');
      expect(result).toHaveProperty('owner');
    });
  });

  // ── update ──
  describe('update', () => {
    it('delegates to service with id, userId, dto', async () => {
      listingsService.update.mockResolvedValue(mockListing as any);
      const dto = { title: 'Updated' } as any;
      await controller.update('l1', 'u1', dto);
      expect(listingsService.update).toHaveBeenCalledWith('l1', 'u1', dto);
    });
  });

  // ── publish / pause / activate ──
  describe('publish', () => {
    it('delegates to service', async () => {
      listingsService.publish.mockResolvedValue(mockListing as any);
      await controller.publish('l1', 'u1');
      expect(listingsService.publish).toHaveBeenCalledWith('l1', 'u1');
    });
  });

  describe('pause', () => {
    it('delegates to service', async () => {
      listingsService.pause.mockResolvedValue(mockListing as any);
      await controller.pause('l1', 'u1');
      expect(listingsService.pause).toHaveBeenCalledWith('l1', 'u1');
    });
  });

  describe('activate', () => {
    it('delegates to service', async () => {
      listingsService.activate.mockResolvedValue(mockListing as any);
      await controller.activate('l1', 'u1');
      expect(listingsService.activate).toHaveBeenCalledWith('l1', 'u1');
    });
  });

  // ── delete ──
  describe('delete', () => {
    it('calls service delete', async () => {
      await controller.delete('l1', 'u1');
      expect(listingsService.delete).toHaveBeenCalledWith('l1', 'u1');
    });
  });

  // ── getStats ──
  describe('getStats', () => {
    it('delegates to getPropertyStats', async () => {
      const stats = { views: 100, bookings: 10 };
      listingsService.getPropertyStats.mockResolvedValue(stats as any);
      expect(await controller.getStats('l1')).toBe(stats);
    });

    it('propagates errors from service', async () => {
      listingsService.getPropertyStats.mockRejectedValue(new NotFoundException('Not found'));
      await expect(controller.getStats('l1')).rejects.toThrow(NotFoundException);
    });
  });

  // ── incrementView ──
  describe('incrementView', () => {
    it('calls incrementViewCount', async () => {
      await controller.incrementView('l1');
      expect(listingsService.incrementViewCount).toHaveBeenCalledWith('l1');
    });
  });

  // ── availability endpoints ──
  describe('createAvailability', () => {
    it('merges listingId as propertyId', async () => {
      const dto = { startDate: new Date(), endDate: new Date(), isAvailable: true };
      availabilityService.createAvailability.mockResolvedValue({} as any);
      await controller.createAvailability('l1', dto as any);
      expect(availabilityService.createAvailability).toHaveBeenCalledWith(
        expect.objectContaining({ propertyId: 'l1' }),
      );
    });

    it('propagates errors from availabilityService', async () => {
      availabilityService.createAvailability.mockRejectedValue(new ForbiddenException('Forbidden'));
      const dto = { startDate: new Date(), endDate: new Date(), isAvailable: true };
      await expect(controller.createAvailability('l1', dto as any)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getAvailability', () => {
    it('passes dates as Date objects', async () => {
      availabilityService.getListingAvailability.mockResolvedValue([] as any);
      await controller.getAvailability('l1', '2025-01-01', '2025-01-31');
      expect(availabilityService.getListingAvailability).toHaveBeenCalledWith(
        'l1',
        new Date('2025-01-01'),
        new Date('2025-01-31'),
      );
    });
  });

  describe('checkAvailability', () => {
    it('returns available status', async () => {
      availabilityService.checkAvailability.mockResolvedValue({ isAvailable: true, conflicts: [] } as any);
      const result = await controller.checkAvailability('l1', { startDate: new Date('2025-01-01'), endDate: new Date('2025-01-05') });
      expect(result).toHaveProperty('available', true);
      expect(result).toHaveProperty('message', 'Listing is available for selected dates');
    });

    it('returns unavailable with conflict reason', async () => {
      availabilityService.checkAvailability.mockResolvedValue({
        isAvailable: false,
        conflicts: [{ reason: 'Already booked', startDate: new Date(), endDate: new Date() }],
      } as any);
      const result = await controller.checkAvailability('l1', { startDate: new Date('2025-01-01'), endDate: new Date('2025-01-05') });
      expect(result.available).toBe(false);
      expect(result.message).toBe('Already booked');
    });
  });

  describe('getAvailableDates', () => {
    it('delegates to availabilityService', async () => {
      availabilityService.getAvailableDates.mockResolvedValue(['2025-01-01'] as any);
      await controller.getAvailableDates('l1', '2025-01-01', '2025-01-31');
      expect(availabilityService.getAvailableDates).toHaveBeenCalledWith(
        'l1',
        new Date('2025-01-01'),
        new Date('2025-01-31'),
      );
    });
  });

  // ── images ──
  describe('uploadImages', () => {
    it('appends new urls to existing photos', async () => {
      listingsService.findOne.mockResolvedValue({ photos: ['old.jpg'] } as any);
      listingsService.update.mockResolvedValue({} as any);
      const result = await controller.uploadImages('l1', 'u1', ['new.jpg']);
      expect(result.images).toEqual(['old.jpg', 'new.jpg']);
    });

    it('throws NotFoundException when listing not found', async () => {
      listingsService.findOne.mockResolvedValue(null as any);
      await expect(controller.uploadImages('l1', 'u1', ['img.jpg'])).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteImages', () => {
    it('filters out specified urls', async () => {
      listingsService.findOne.mockResolvedValue({ photos: ['a.jpg', 'b.jpg', 'c.jpg'] } as any);
      listingsService.update.mockResolvedValue({} as any);
      const result = await controller.deleteImages('l1', 'u1', ['b.jpg']);
      expect(result.images).toEqual(['a.jpg', 'c.jpg']);
    });
  });

  // ── mapToFrontendListing shape ──
  describe('mapToFrontendListing (via findById)', () => {
    it('computes weekly/monthly prices from discounts', async () => {
      listingsService.findById.mockResolvedValue(mockListing as any);
      const result = await controller.findById('l1', { user: undefined });
      expect(result.pricePerWeek).toBe(Math.round(100 * 7 * 0.9));
      expect(result.pricePerMonth).toBe(Math.round(100 * 30 * 0.8));
    });

    it('sets availability string based on status', async () => {
      listingsService.findById.mockResolvedValue({ ...mockListing, status: 'RENTED' } as any);
      const result = await controller.findById('l1', { user: undefined });
      expect(result.availability).toBe('rented');
    });

    it('parses metadata when present', async () => {
      const withMeta = { ...mockListing, metadata: JSON.stringify({ subcategory: 'Laptops' }) };
      listingsService.findById.mockResolvedValue(withMeta as any);
      const result = await controller.findById('l1', { user: undefined });
      expect(result.subcategory).toBe('Laptops');
    });
  });
});
