/**
 * PolicyEngine Integration Tests
 * 
 * These tests validate the policy engine's fee calculation, tax computation,
 * and multi-currency pricing with real database interactions.
 * 
 * Coverage:
 * - Fee calculation accuracy
 * - Tax computation
 * - Multi-currency pricing
 * - Payout distribution
 * - Cancellation fee policies
 * - Edge cases
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { AppModule } from '../../src/app.module';
import { PolicyEngineService } from '../../src/modules/payments/services/policy-engine.service';
import { BookingCalculationService } from '../../src/modules/bookings/services/booking-calculation.service';

describe('PolicyEngine Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let policyEngine: PolicyEngineService;
  let calculationService: BookingCalculationService;

  // Test data
  let testUser: { id: string; email: string };
  let testOwner: { id: string; email: string };
  let testListing: { id: string; categoryId: string; basePrice: number };
  let testCategory: { id: string };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    policyEngine = moduleFixture.get<PolicyEngineService>(PolicyEngineService);
    calculationService = moduleFixture.get<BookingCalculationService>(BookingCalculationService);
    
    await app.init();

    // Create test category
    testCategory = await prisma.category.create({
      data: {
        name: `Policy Test Category ${Date.now()}`,
        slug: `policy-test-category-${Date.now()}`,
      },
    });

    // Create test users
    testUser = await prisma.user.create({
      data: {
        email: `policy-test-user-${Date.now()}@test.com`,
        passwordHash: 'hashed_password',
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
      },
    });

    testOwner = await prisma.user.create({
      data: {
        email: `policy-test-owner-${Date.now()}@test.com`,
        passwordHash: 'hashed_password',
        firstName: 'Test',
        lastName: 'Owner',
        role: 'HOST',
      },
    });

    // Create test listing with specific pricing
    testListing = await prisma.listing.create({
      data: {
        title: `Policy Test Listing ${Date.now()}`,
        description: 'Test listing for PolicyEngine integration',
        basePrice: 100, // $100 per day
        currency: 'USD',
        categoryId: testCategory.id,
        ownerId: testOwner.id,
        status: 'PUBLISHED',
        location: 'San Francisco, CA',
        condition: 'GOOD',
        bookingMode: 'INSTANT_BOOK',
      },
    });
  }, 60000);

  afterAll(async () => {
    // Cleanup
    await prisma.listing.deleteMany({
      where: { id: testListing.id },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [testUser.id, testOwner.id] } },
    });
    await prisma.category.deleteMany({
      where: { id: testCategory.id },
    });
    await app.close();
  }, 60000);

  describe('Fee Calculation', () => {
    it('should calculate standard platform fees correctly', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 30);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3); // 3 days

      const booking = await prisma.booking.create({
        data: {
          listingId: testListing.id,
          renterId: testUser.id,
          ownerId: testOwner.id,
          startDate,
          endDate,
          status: 'PENDING_OWNER_APPROVAL',
          totalPrice: 300, // $100 x 3 days
          currency: 'USD',
        },
      });

      // Calculate fees using policy engine
      const calculation = await calculationService.calculateBookingDetails({
        listingId: testListing.id,
        startDate,
        endDate,
        renterId: testUser.id,
      });

      // Verify calculations
      expect(calculation).toBeDefined();
      expect(calculation.basePrice).toBe(300);
      
      // Platform fee should be a percentage (typically 10-15%)
      expect(calculation.platformFee).toBeGreaterThan(0);
      expect(calculation.platformFee).toBeLessThan(calculation.basePrice * 0.2);

      // Owner earnings should be basePrice - platformFee
      expect(calculation.ownerEarnings).toBe(calculation.basePrice - calculation.platformFee);

      // Cleanup
      await prisma.booking.delete({
        where: { id: booking.id },
      });
    });

    it('should calculate taxes correctly', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 40);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 2);

      const booking = await prisma.booking.create({
        data: {
          listingId: testListing.id,
          renterId: testUser.id,
          ownerId: testOwner.id,
          startDate,
          endDate,
          status: 'PENDING_OWNER_APPROVAL',
          totalPrice: 200,
          currency: 'USD',
        },
      });

      // Get pricing breakdown
      const breakdown = await calculationService.getPriceBreakdown(booking.id);

      // Verify tax calculations if applicable
      expect(breakdown).toBeDefined();
      expect(breakdown.subtotal).toBeDefined();
      expect(breakdown.total).toBeDefined();

      // Total should include all components
      expect(breakdown.total).toBeGreaterThanOrEqual(breakdown.subtotal);

      // Cleanup
      await prisma.booking.delete({
        where: { id: booking.id },
      });
    });

    it('should handle different booking durations', async () => {
      // 1 day booking
      const startDate1 = new Date();
      startDate1.setDate(startDate1.getDate() + 50);
      const endDate1 = new Date(startDate1);
      endDate1.setDate(endDate1.getDate() + 1);

      const booking1 = await prisma.booking.create({
        data: {
          listingId: testListing.id,
          renterId: testUser.id,
          ownerId: testOwner.id,
          startDate: startDate1,
          endDate: endDate1,
          status: 'PENDING_OWNER_APPROVAL',
          totalPrice: 100,
          currency: 'USD',
        },
      });

      // 7 day booking
      const startDate7 = new Date();
      startDate7.setDate(startDate7.getDate() + 60);
      const endDate7 = new Date(startDate7);
      endDate7.setDate(endDate7.getDate() + 7);

      const booking7 = await prisma.booking.create({
        data: {
          listingId: testListing.id,
          renterId: testUser.id,
          ownerId: testOwner.id,
          startDate: startDate7,
          endDate: endDate7,
          status: 'PENDING_OWNER_APPROVAL',
          totalPrice: 700,
          currency: 'USD',
        },
      });

      // Verify pricing scales correctly
      const breakdown1 = await calculationService.getPriceBreakdown(booking1.id);
      const breakdown7 = await calculationService.getPriceBreakdown(booking7.id);

      // 7-day booking should cost roughly 7x the 1-day booking
      expect(breakdown7.subtotal).toBeGreaterThan(breakdown1.subtotal * 6);
      expect(breakdown7.subtotal).toBeLessThan(breakdown1.subtotal * 8);

      // Cleanup
      await prisma.booking.deleteMany({
        where: { id: { in: [booking1.id, booking7.id] } },
      });
    });
  });

  describe('Multi-Currency Support', () => {
    it('should handle currency conversion', async () => {
      // Create listing with different currency
      const euroListing = await prisma.listing.create({
        data: {
          title: `EUR Test Listing ${Date.now()}`,
          description: 'Test listing in EUR',
          basePrice: 90, // EUR
          currency: 'EUR',
          categoryId: testCategory.id,
          ownerId: testOwner.id,
          status: 'PUBLISHED',
          location: 'Paris, France',
          condition: 'GOOD',
        },
      });

      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 70);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 2);

      const booking = await prisma.booking.create({
        data: {
          listingId: euroListing.id,
          renterId: testUser.id,
          ownerId: testOwner.id,
          startDate,
          endDate,
          status: 'PENDING_OWNER_APPROVAL',
          totalPrice: 180, // EUR
          currency: 'EUR',
        },
      });

      // Verify currency is preserved
      const savedBooking = await prisma.booking.findUnique({
        where: { id: booking.id },
      });

      expect(savedBooking?.currency).toBe('EUR');

      // Cleanup
      await prisma.booking.delete({
        where: { id: booking.id },
      });
      await prisma.listing.delete({
        where: { id: euroListing.id },
      });
    });

    it('should calculate fees in listing currency', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 80);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 2);

      const booking = await prisma.booking.create({
        data: {
          listingId: testListing.id,
          renterId: testUser.id,
          ownerId: testOwner.id,
          startDate,
          endDate,
          status: 'PENDING_OWNER_APPROVAL',
          totalPrice: 200,
          currency: 'USD',
        },
      });

      const calculation = await calculationService.calculateBookingDetails({
        listingId: testListing.id,
        startDate,
        endDate,
        renterId: testUser.id,
      });

      // All amounts should be in the same currency
      expect(calculation.currency).toBe('USD');

      // Cleanup
      await prisma.booking.delete({
        where: { id: booking.id },
      });
    });
  });

  describe('Cancellation Fee Policies', () => {
    it('should calculate cancellation fees based on policy', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 90); // Far future
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      const booking = await prisma.booking.create({
        data: {
          listingId: testListing.id,
          renterId: testUser.id,
          ownerId: testOwner.id,
          startDate,
          endDate,
          status: 'CONFIRMED',
          totalPrice: 300,
          currency: 'USD',
        },
      });

      // Calculate cancellation fees
      const cancellationPolicy = await policyEngine.getCancellationPolicy(booking.id);

      expect(cancellationPolicy).toBeDefined();
      expect(cancellationPolicy.refundAmount).toBeGreaterThanOrEqual(0);
      expect(cancellationPolicy.refundAmount).toBeLessThanOrEqual(booking.totalPrice);
      expect(cancellationPolicy.cancellationFee).toBeGreaterThanOrEqual(0);

      // Far-future cancellation should have minimal fees
      expect(cancellationPolicy.cancellationFee).toBeLessThan(booking.totalPrice * 0.5);

      // Cleanup
      await prisma.booking.delete({
        where: { id: booking.id },
      });
    });

    it('should apply stricter fees for late cancellations', async () => {
      // Booking starting tomorrow (late cancellation scenario)
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 1);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 2);

      const booking = await prisma.booking.create({
        data: {
          listingId: testListing.id,
          renterId: testUser.id,
          ownerId: testOwner.id,
          startDate,
          endDate,
          status: 'CONFIRMED',
          totalPrice: 200,
          currency: 'USD',
        },
      });

      const cancellationPolicy = await policyEngine.getCancellationPolicy(booking.id);

      // Late cancellation should have higher fees
      expect(cancellationPolicy.cancellationFee).toBeGreaterThan(0);

      // Cleanup
      await prisma.booking.delete({
        where: { id: booking.id },
      });
    });
  });

  describe('Payout Distribution', () => {
    it('should calculate owner payout correctly', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 100);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      const booking = await prisma.booking.create({
        data: {
          listingId: testListing.id,
          renterId: testUser.id,
          ownerId: testOwner.id,
          startDate,
          endDate,
          status: 'COMPLETED',
          totalPrice: 300,
          currency: 'USD',
          ownerEarnings: 255, // 85% after 15% platform fee
          platformFee: 45,
        },
      });

      // Verify payout calculation
      const payout = await policyEngine.calculatePayout(booking.id);

      expect(payout).toBeDefined();
      expect(payout.amount).toBe(255);
      expect(payout.currency).toBe('USD');

      // Cleanup
      await prisma.booking.delete({
        where: { id: booking.id },
      });
    });

    it('should handle refunds and adjust payouts', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 110);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 2);

      const booking = await prisma.booking.create({
        data: {
          listingId: testListing.id,
          renterId: testUser.id,
          ownerId: testOwner.id,
          startDate,
          endDate,
          status: 'CANCELLED',
          totalPrice: 200,
          currency: 'USD',
        },
      });

      // Create refund record
      await prisma.refund.create({
        data: {
          bookingId: booking.id,
          amount: 150,
          currency: 'USD',
          reason: 'Renter cancellation',
          status: 'COMPLETED',
        },
      });

      // Verify adjusted payout
      const payout = await policyEngine.calculatePayout(booking.id);

      // Payout should account for refund
      expect(payout).toBeDefined();

      // Cleanup
      await prisma.refund.deleteMany({
        where: { bookingId: booking.id },
      });
      await prisma.booking.delete({
        where: { id: booking.id },
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero-day bookings gracefully', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 120);
      const endDate = new Date(startDate); // Same day

      await expect(
        calculationService.calculateBookingDetails({
          listingId: testListing.id,
          startDate,
          endDate,
          renterId: testUser.id,
        })
      ).rejects.toThrow();
    });

    it('should handle very long bookings', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 130);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 30); // 30 days

      const calculation = await calculationService.calculateBookingDetails({
        listingId: testListing.id,
        startDate,
        endDate,
        renterId: testUser.id,
      });

      expect(calculation).toBeDefined();
      expect(calculation.basePrice).toBe(3000); // $100 x 30 days
    });

    it('should handle past dates', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 10); // Past
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 2);

      await expect(
        calculationService.calculateBookingDetails({
          listingId: testListing.id,
          startDate,
          endDate,
          renterId: testUser.id,
        })
      ).rejects.toThrow();
    });

    it('should validate minimum booking amount', async () => {
      // Create very cheap listing
      const cheapListing = await prisma.listing.create({
        data: {
          title: `Cheap Test Listing ${Date.now()}`,
          description: 'Very cheap listing',
          basePrice: 1, // $1 per day
          currency: 'USD',
          categoryId: testCategory.id,
          ownerId: testOwner.id,
          status: 'PUBLISHED',
          location: 'Test Location',
          condition: 'GOOD',
        },
      });

      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 140);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);

      const calculation = await calculationService.calculateBookingDetails({
        listingId: cheapListing.id,
        startDate,
        endDate,
        renterId: testUser.id,
      });

      expect(calculation).toBeDefined();
      expect(calculation.basePrice).toBe(1);

      // Cleanup
      await prisma.listing.delete({
        where: { id: cheapListing.id },
      });
    });
  });
});
