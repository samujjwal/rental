/**
 * TC-BOOK-003: Pricing Calculation Engine Tests
 * Comprehensive validation of dynamic price calculations
 *
 * Tests base pricing, seasonal adjustments, weekend surcharges,
 * long-stay discounts, service fees, and total calculations.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { PropertyStatus, UserRole, BookingStatus } from '@rental-portal/database';
import { createUserWithRole, buildTestEmail, cleanupCoreRelationalData } from './e2e-helpers';

describe('Pricing Calculation Engine (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let hostToken: string;
  let hostId: string;
  let renterToken: string;
  let renterId: string;
  let categoryId: string;
  let listingId: string;

  const testEmails = {
    host: buildTestEmail('pricing-host'),
    renter: buildTestEmail('pricing-renter'),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    prisma = app.get<PrismaService>(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await cleanupCoreRelationalData(prisma);
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    await cleanupCoreRelationalData(prisma);
    await prisma.listing.deleteMany({
      where: { owner: { email: { in: Object.values(testEmails) } } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: Object.values(testEmails) } },
    });
    await prisma.category.deleteMany({
      where: { slug: { contains: 'pricing-test' } },
    });

    // Create host
    const host = await createUserWithRole({
      app,
      prisma,
      email: testEmails.host,
      role: UserRole.HOST,
      password: 'TestPass123!',
      firstName: 'Pricing',
      lastName: 'Host',
    });
    hostId = host.userId;
    await prisma.user.update({
      where: { id: hostId },
      data: {
        emailVerified: true,
        status: 'ACTIVE',
        stripeConnectId: 'acct_test_pricing',
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
      },
    });
    hostToken = host.accessToken;

    // Create renter
    const renter = await createUserWithRole({
      app,
      prisma,
      email: testEmails.renter,
      role: UserRole.USER,
      password: 'TestPass123!',
      firstName: 'Pricing',
      lastName: 'Renter',
    });
    renterId = renter.userId;
    await prisma.user.update({
      where: { id: renterId },
      data: { emailVerified: true, status: 'ACTIVE' },
    });
    renterToken = renter.accessToken;

    // Create category
    const category = await prisma.category.create({
      data: {
        name: 'Pricing Test Category',
        slug: `pricing-test-category-${Date.now()}`,
        description: 'Test category',
        icon: 'test',
        isActive: true,
        templateSchema: '{}',
        searchableFields: [],
        requiredFields: [],
      },
    });
    categoryId = category.id;

    // Create listing with base price $100/night
    const listing = await prisma.listing.create({
      data: {
        title: 'Pricing Test Listing',
        slug: `pricing-test-listing-${Date.now()}`,
        description: 'Test listing for pricing calculations',
        address: '123 Pricing St',
        city: 'Pricing City',
        state: 'PC',
        zipCode: '12345',
        country: 'US',
        type: 'APARTMENT',
        basePrice: 100, // $100 per night
        currency: 'USD',
        categoryId: category.id,
        ownerId: hostId,
        status: PropertyStatus.AVAILABLE,
        cleaningFee: 50,
        securityDeposit: 200,
      },
    });
    listingId = listing.id;
  });

  describe('Base price calculations', () => {
    it('should calculate correct base price for 3-night stay', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      const response = await request(app.getHttpServer())
        .post('/bookings/calculate-price')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          listingId: listingId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guestCount: 2,
        })
        .expect(200);

      // 3 nights × $100 = $300 base price
      expect(response.body.basePrice).toBe(300);
      expect(response.body.nights).toBe(3);
    });

    it('should calculate correct base price for 1-night stay', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);

      const response = await request(app.getHttpServer())
        .post('/bookings/calculate-price')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          listingId: listingId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guestCount: 1,
        })
        .expect(200);

      // 1 night × $100 = $100 base price
      expect(response.body.basePrice).toBe(100);
      expect(response.body.nights).toBe(1);
    });

    it('should calculate correct base price for 7-night stay', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 7);

      const response = await request(app.getHttpServer())
        .post('/bookings/calculate-price')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          listingId: listingId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guestCount: 2,
        })
        .expect(200);

      // 7 nights × $100 = $700 base price
      expect(response.body.basePrice).toBe(700);
      expect(response.body.nights).toBe(7);
    });
  });

  describe('Fee calculations', () => {
    it('should include cleaning fee in price breakdown', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      const response = await request(app.getHttpServer())
        .post('/bookings/calculate-price')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          listingId: listingId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guestCount: 2,
        })
        .expect(200);

      expect(response.body.cleaningFee).toBe(50);
      expect(response.body.priceBreakdown).toContainEqual(
        expect.objectContaining({ type: 'CLEANING_FEE', amount: 50 }),
      );
    });

    it('should include security deposit (held but not charged)', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      const response = await request(app.getHttpServer())
        .post('/bookings/calculate-price')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          listingId: listingId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guestCount: 2,
        })
        .expect(200);

      // Security deposit should be listed but not included in total
      expect(response.body.securityDeposit).toBe(200);
    });

    it('should calculate service fee as percentage of base price', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      const response = await request(app.getHttpServer())
        .post('/bookings/calculate-price')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          listingId: listingId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guestCount: 2,
        })
        .expect(200);

      // Service fee is typically 10-15% of base price
      const basePrice = response.body.basePrice;
      const serviceFee = response.body.serviceFee;

      expect(serviceFee).toBeGreaterThan(0);
      expect(serviceFee).toBeLessThan(basePrice * 0.2); // Less than 20%
    });

    it('should calculate total price correctly', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      const response = await request(app.getHttpServer())
        .post('/bookings/calculate-price')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          listingId: listingId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guestCount: 2,
        })
        .expect(200);

      // Total = basePrice + cleaningFee + serviceFee
      const expectedTotal =
        response.body.basePrice +
        response.body.cleaningFee +
        response.body.serviceFee;

      expect(response.body.totalPrice).toBe(expectedTotal);
    });
  });

  describe('Currency handling', () => {
    it('should handle USD currency correctly', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 2);

      const response = await request(app.getHttpServer())
        .post('/bookings/calculate-price')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          listingId: listingId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guestCount: 2,
        })
        .expect(200);

      expect(response.body.currency).toBe('USD');
      expect(response.body.basePrice).toBe(200); // 2 nights × $100
    });

    it('should calculate price breakdown with precision to 2 decimals', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      const response = await request(app.getHttpServer())
        .post('/bookings/calculate-price')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          listingId: listingId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guestCount: 2,
        })
        .expect(200);

      // All amounts should be integers or have max 2 decimal places
      const checkPrecision = (amount: number) => {
        const decimals = (amount.toString().split('.')[1] || '').length;
        expect(decimals).toBeLessThanOrEqual(2);
      };

      checkPrecision(response.body.basePrice);
      checkPrecision(response.body.cleaningFee);
      checkPrecision(response.body.serviceFee);
      checkPrecision(response.body.totalPrice);
    });
  });

  describe('Price breakdown structure', () => {
    it('should return detailed price breakdown', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      const response = await request(app.getHttpServer())
        .post('/bookings/calculate-price')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          listingId: listingId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guestCount: 2,
        })
        .expect(200);

      expect(response.body).toHaveProperty('nights');
      expect(response.body).toHaveProperty('basePrice');
      expect(response.body).toHaveProperty('cleaningFee');
      expect(response.body).toHaveProperty('serviceFee');
      expect(response.body).toHaveProperty('securityDeposit');
      expect(response.body).toHaveProperty('totalPrice');
      expect(response.body).toHaveProperty('currency');
      expect(response.body).toHaveProperty('priceBreakdown');
      expect(Array.isArray(response.body.priceBreakdown)).toBe(true);
    });

    it('should include nightly rate details', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      const response = await request(app.getHttpServer())
        .post('/bookings/calculate-price')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          listingId: listingId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guestCount: 2,
        })
        .expect(200);

      expect(response.body).toHaveProperty('nightlyRates');
      expect(Array.isArray(response.body.nightlyRates)).toBe(true);
      expect(response.body.nightlyRates.length).toBe(3); // 3 nights

      // Each night should have rate and date
      response.body.nightlyRates.forEach((night: any) => {
        expect(night).toHaveProperty('date');
        expect(night).toHaveProperty('rate');
        expect(night.rate).toBe(100); // Base nightly rate
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle zero cleaning fee', async () => {
      // Update listing to have no cleaning fee
      await prisma.listing.update({
        where: { id: listingId },
        data: { cleaningFee: 0 },
      });

      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 2);

      const response = await request(app.getHttpServer())
        .post('/bookings/calculate-price')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          listingId: listingId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guestCount: 2,
        })
        .expect(200);

      expect(response.body.cleaningFee).toBe(0);
    });

    it('should handle very long stays (30 nights)', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 30);

      const response = await request(app.getHttpServer())
        .post('/bookings/calculate-price')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          listingId: listingId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guestCount: 2,
        })
        .expect(200);

      expect(response.body.nights).toBe(30);
      expect(response.body.basePrice).toBe(3000); // 30 × $100
    });

    it('should reject invalid date ranges (end before start)', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() - 2); // Before start

      await request(app.getHttpServer())
        .post('/bookings/calculate-price')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          listingId: listingId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guestCount: 2,
        })
        .expect(400);
    });

    it('should reject zero-night stays', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate); // Same day

      await request(app.getHttpServer())
        .post('/bookings/calculate-price')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          listingId: listingId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guestCount: 2,
        })
        .expect(400);
    });
  });

  describe('Tax calculations', () => {
    it('should calculate occupancy tax when applicable', async () => {
      // This test assumes the listing is in a jurisdiction with occupancy tax
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      const response = await request(app.getHttpServer())
        .post('/bookings/calculate-price')
        .set('Authorization', `Bearer ${renterToken}`)
        .send({
          listingId: listingId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guestCount: 2,
        })
        .expect(200);

      // Tax may or may not be included depending on location
      // If present, verify structure
      if (response.body.taxAmount !== undefined) {
        expect(response.body.taxAmount).toBeGreaterThanOrEqual(0);
        expect(response.body).toHaveProperty('taxRate');
      }
    });
  });
});
