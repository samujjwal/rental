import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  PhotoDto,
  VideoDto,
  CreateListingDto,
  UpdateListingDto,
} from './listing.dto';

describe('Listing DTOs', () => {
  // ─── PhotoDto ───────────────────────────────────────────────
  describe('PhotoDto', () => {
    it('passes with valid data', async () => {
      const dto = plainToInstance(PhotoDto, { url: 'https://img.co/1.jpg', order: 0 });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('passes with optional caption', async () => {
      const dto = plainToInstance(PhotoDto, {
        url: 'https://img.co/1.jpg',
        order: 1,
        caption: 'Front view',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails when url is missing', async () => {
      const dto = plainToInstance(PhotoDto, { order: 0 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'url')).toBe(true);
    });

    it('fails when order is missing', async () => {
      const dto = plainToInstance(PhotoDto, { url: 'https://img.co/1.jpg' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'order')).toBe(true);
    });

    it('fails when caption exceeds 200 chars', async () => {
      const dto = plainToInstance(PhotoDto, {
        url: 'https://img.co/1.jpg',
        order: 0,
        caption: 'A'.repeat(201),
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'caption')).toBe(true);
    });

    it('passes when caption is exactly 200 chars', async () => {
      const dto = plainToInstance(PhotoDto, {
        url: 'https://img.co/1.jpg',
        order: 0,
        caption: 'A'.repeat(200),
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  // ─── VideoDto ───────────────────────────────────────────────
  describe('VideoDto', () => {
    it('passes with valid data', async () => {
      const dto = plainToInstance(VideoDto, { url: 'https://vid.co/1.mp4', type: 'mp4' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('passes with optional thumbnailUrl', async () => {
      const dto = plainToInstance(VideoDto, {
        url: 'https://vid.co/1.mp4',
        type: 'mp4',
        thumbnailUrl: 'https://img.co/thumb.jpg',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails when url is missing', async () => {
      const dto = plainToInstance(VideoDto, { type: 'mp4' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'url')).toBe(true);
    });

    it('fails when type is missing', async () => {
      const dto = plainToInstance(VideoDto, { url: 'https://vid.co/1.mp4' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'type')).toBe(true);
    });
  });

  // ─── CreateListingDto ───────────────────────────────────────
  describe('CreateListingDto', () => {
    const validData = {
      title: 'Mountain Bike for Rent',
      description: 'A premium mountain bike available for daily rental.',
      basePrice: 1500,
    };

    it('passes with minimum required fields', async () => {
      const dto = plainToInstance(CreateListingDto, validData);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('passes with all optional fields', async () => {
      const dto = plainToInstance(CreateListingDto, {
        ...validData,
        categoryId: 'cat-123',
        organizationId: 'org-456',
        addressLine1: '123 Main St',
        addressLine2: 'Suite 100',
        city: 'Kathmandu',
        state: 'Bagmati',
        postalCode: '44600',
        country: 'Nepal',
        latitude: 27.7172,
        longitude: 85.324,
        pricingMode: 'DAILY',
        hourlyPrice: 200,
        dailyPrice: 1500,
        weeklyPrice: 8000,
        monthlyPrice: 25000,
        currency: 'NPR',
        requiresDeposit: true,
        depositAmount: 5000,
        depositType: 'FIXED',
        bookingMode: 'INSTANT',
        minBookingHours: 2,
        maxBookingDays: 30,
        leadTime: 4,
        advanceNotice: 12,
        capacity: 1,
        categorySpecificData: { frameSize: 'M' },
        condition: 'EXCELLENT',
        features: ['21-speed', 'disc brakes'],
        amenities: [{ name: 'helmet' }],
        rules: ['No off-road racing'],
        metaTitle: 'Rent a mountain bike',
        metaDescription: 'Premium mountain bike rental in Kathmandu',
        category: 'bikes',
        subcategory: 'mountain',
        location: { lat: 27.7172, lng: 85.324 },
        images: ['https://img.co/1.jpg'],
        instantBooking: true,
        securityDeposit: 5000,
        deliveryOptions: { pickup: true, delivery: false },
        deliveryRadius: 10,
        deliveryFee: 200,
        minimumRentalPeriod: 1,
        maximumRentalPeriod: 90,
        cancellationPolicy: 'MODERATE',
        pricePerDay: 1500,
        pricePerWeek: 8000,
        pricePerMonth: 25000,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    // Required field validations
    it('fails when title is missing', async () => {
      const dto = plainToInstance(CreateListingDto, { description: 'desc', basePrice: 100 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'title')).toBe(true);
    });

    it('fails when description is missing', async () => {
      const dto = plainToInstance(CreateListingDto, { title: 'Title', basePrice: 100 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'description')).toBe(true);
    });

    it('fails when basePrice is missing', async () => {
      const dto = plainToInstance(CreateListingDto, { title: 'Title', description: 'desc' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'basePrice')).toBe(true);
    });

    // MaxLength validations
    it('fails when title exceeds 200 chars', async () => {
      const dto = plainToInstance(CreateListingDto, {
        ...validData,
        title: 'T'.repeat(201),
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'title')).toBe(true);
    });

    it('fails when description exceeds 5000 chars', async () => {
      const dto = plainToInstance(CreateListingDto, {
        ...validData,
        description: 'D'.repeat(5001),
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'description')).toBe(true);
    });

    it('passes with title at exactly 200 chars', async () => {
      const dto = plainToInstance(CreateListingDto, {
        ...validData,
        title: 'T'.repeat(200),
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'title')).toBe(false);
    });

    // Min(0) validations
    it('fails when basePrice is negative', async () => {
      const dto = plainToInstance(CreateListingDto, { ...validData, basePrice: -1 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'basePrice')).toBe(true);
    });

    it('passes when basePrice is 0', async () => {
      const dto = plainToInstance(CreateListingDto, { ...validData, basePrice: 0 });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails when hourlyPrice is negative', async () => {
      const dto = plainToInstance(CreateListingDto, { ...validData, hourlyPrice: -5 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'hourlyPrice')).toBe(true);
    });

    it('fails when dailyPrice is negative', async () => {
      const dto = plainToInstance(CreateListingDto, { ...validData, dailyPrice: -1 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'dailyPrice')).toBe(true);
    });

    it('fails when weeklyPrice is negative', async () => {
      const dto = plainToInstance(CreateListingDto, { ...validData, weeklyPrice: -10 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'weeklyPrice')).toBe(true);
    });

    it('fails when monthlyPrice is negative', async () => {
      const dto = plainToInstance(CreateListingDto, { ...validData, monthlyPrice: -100 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'monthlyPrice')).toBe(true);
    });

    it('fails when depositAmount is negative', async () => {
      const dto = plainToInstance(CreateListingDto, { ...validData, depositAmount: -500 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'depositAmount')).toBe(true);
    });

    it('fails when securityDeposit is negative', async () => {
      const dto = plainToInstance(CreateListingDto, { ...validData, securityDeposit: -1 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'securityDeposit')).toBe(true);
    });

    it('fails when deliveryFee is negative', async () => {
      const dto = plainToInstance(CreateListingDto, { ...validData, deliveryFee: -50 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'deliveryFee')).toBe(true);
    });

    it('fails when deliveryRadius is negative', async () => {
      const dto = plainToInstance(CreateListingDto, { ...validData, deliveryRadius: -1 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'deliveryRadius')).toBe(true);
    });

    // Min(1) validations
    it('fails when minBookingHours is 0', async () => {
      const dto = plainToInstance(CreateListingDto, { ...validData, minBookingHours: 0 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'minBookingHours')).toBe(true);
    });

    it('fails when maxBookingDays is 0', async () => {
      const dto = plainToInstance(CreateListingDto, { ...validData, maxBookingDays: 0 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'maxBookingDays')).toBe(true);
    });

    it('fails when capacity is 0', async () => {
      const dto = plainToInstance(CreateListingDto, { ...validData, capacity: 0 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'capacity')).toBe(true);
    });

    it('fails when minimumRentalPeriod is 0', async () => {
      const dto = plainToInstance(CreateListingDto, { ...validData, minimumRentalPeriod: 0 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'minimumRentalPeriod')).toBe(true);
    });

    it('fails when maximumRentalPeriod is 0', async () => {
      const dto = plainToInstance(CreateListingDto, { ...validData, maximumRentalPeriod: 0 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'maximumRentalPeriod')).toBe(true);
    });

    // Latitude / Longitude validations
    it('passes with valid latitude and longitude', async () => {
      const dto = plainToInstance(CreateListingDto, {
        ...validData,
        latitude: 27.7172,
        longitude: 85.324,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails when latitude exceeds 90', async () => {
      const dto = plainToInstance(CreateListingDto, { ...validData, latitude: 91 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'latitude')).toBe(true);
    });

    it('fails when latitude is below -90', async () => {
      const dto = plainToInstance(CreateListingDto, { ...validData, latitude: -91 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'latitude')).toBe(true);
    });

    it('fails when longitude exceeds 180', async () => {
      const dto = plainToInstance(CreateListingDto, { ...validData, longitude: 181 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'longitude')).toBe(true);
    });

    it('fails when longitude is below -180', async () => {
      const dto = plainToInstance(CreateListingDto, { ...validData, longitude: -181 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'longitude')).toBe(true);
    });

    it('passes with boundary latitude 90', async () => {
      const dto = plainToInstance(CreateListingDto, { ...validData, latitude: 90 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'latitude')).toBe(false);
    });

    it('passes with boundary latitude -90', async () => {
      const dto = plainToInstance(CreateListingDto, { ...validData, latitude: -90 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'latitude')).toBe(false);
    });

    it('passes with boundary longitude 180', async () => {
      const dto = plainToInstance(CreateListingDto, { ...validData, longitude: 180 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'longitude')).toBe(false);
    });

    it('passes with boundary longitude -180', async () => {
      const dto = plainToInstance(CreateListingDto, { ...validData, longitude: -180 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'longitude')).toBe(false);
    });

    // MaxLength on address fields
    it('fails when addressLine1 exceeds 200 chars', async () => {
      const dto = plainToInstance(CreateListingDto, {
        ...validData,
        addressLine1: 'A'.repeat(201),
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'addressLine1')).toBe(true);
    });

    it('fails when city exceeds 100 chars', async () => {
      const dto = plainToInstance(CreateListingDto, { ...validData, city: 'C'.repeat(101) });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'city')).toBe(true);
    });

    it('fails when country exceeds 100 chars', async () => {
      const dto = plainToInstance(CreateListingDto, { ...validData, country: 'C'.repeat(101) });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'country')).toBe(true);
    });

    it('fails when metaTitle exceeds 70 chars', async () => {
      const dto = plainToInstance(CreateListingDto, { ...validData, metaTitle: 'M'.repeat(71) });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'metaTitle')).toBe(true);
    });

    it('fails when metaDescription exceeds 160 chars', async () => {
      const dto = plainToInstance(CreateListingDto, {
        ...validData,
        metaDescription: 'M'.repeat(161),
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'metaDescription')).toBe(true);
    });

    it('fails when currency exceeds 3 chars', async () => {
      const dto = plainToInstance(CreateListingDto, { ...validData, currency: 'LONG' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'currency')).toBe(true);
    });

    // Type-level validations
    it('fails when requiresDeposit is not boolean', async () => {
      const dto = plainToInstance(CreateListingDto, { ...validData, requiresDeposit: 'yes' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'requiresDeposit')).toBe(true);
    });

    it('fails when instantBooking is not boolean', async () => {
      const dto = plainToInstance(CreateListingDto, { ...validData, instantBooking: 'true' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'instantBooking')).toBe(true);
    });

    it('fails when features contain non-strings', async () => {
      const dto = plainToInstance(CreateListingDto, { ...validData, features: [1, 2, 3] });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'features')).toBe(true);
    });

    it('fails when rules contain non-strings', async () => {
      const dto = plainToInstance(CreateListingDto, { ...validData, rules: [true, false] });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'rules')).toBe(true);
    });

    it('fails when images contain non-strings', async () => {
      const dto = plainToInstance(CreateListingDto, { ...validData, images: [123, 456] });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'images')).toBe(true);
    });
  });

  // ─── UpdateListingDto ───────────────────────────────────────
  describe('UpdateListingDto', () => {
    it('passes with empty object (all optional)', async () => {
      const dto = plainToInstance(UpdateListingDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('passes with partial update', async () => {
      const dto = plainToInstance(UpdateListingDto, {
        title: 'Updated Title',
        basePrice: 2000,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails when title exceeds 200 chars', async () => {
      const dto = plainToInstance(UpdateListingDto, { title: 'T'.repeat(201) });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'title')).toBe(true);
    });

    it('fails when description exceeds 5000 chars', async () => {
      const dto = plainToInstance(UpdateListingDto, { description: 'D'.repeat(5001) });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'description')).toBe(true);
    });

    it('fails when basePrice is negative', async () => {
      const dto = plainToInstance(UpdateListingDto, { basePrice: -1 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'basePrice')).toBe(true);
    });

    it('fails when latitude exceeds 90', async () => {
      const dto = plainToInstance(UpdateListingDto, { latitude: 91 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'latitude')).toBe(true);
    });

    it('fails when longitude exceeds 180', async () => {
      const dto = plainToInstance(UpdateListingDto, { longitude: 181 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'longitude')).toBe(true);
    });

    it('fails when hourlyPrice is negative', async () => {
      const dto = plainToInstance(UpdateListingDto, { hourlyPrice: -1 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'hourlyPrice')).toBe(true);
    });

    it('fails when metaTitle exceeds 70 chars', async () => {
      const dto = plainToInstance(UpdateListingDto, { metaTitle: 'M'.repeat(71) });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'metaTitle')).toBe(true);
    });

    it('fails when minimumRentalPeriod is 0', async () => {
      const dto = plainToInstance(UpdateListingDto, { minimumRentalPeriod: 0 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'minimumRentalPeriod')).toBe(true);
    });

    it('passes with frontend alias fields', async () => {
      const dto = plainToInstance(UpdateListingDto, {
        category: 'bikes',
        location: { lat: 27.7, lng: 85.3 },
        images: ['https://img.co/1.jpg'],
        photos: ['https://img.co/2.jpg'],
        instantBooking: true,
        securityDeposit: 1000,
        deliveryOptions: { pickup: true },
        cancellationPolicy: 'FLEXIBLE',
        subcategory: 'road',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails when images contain non-strings', async () => {
      const dto = plainToInstance(UpdateListingDto, { images: [42] });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'images')).toBe(true);
    });
  });
});
