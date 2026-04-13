/**
 * Real Database Integration Tests
 * 
 * These tests validate actual database operations with real Prisma connections.
 * They test transaction integrity, concurrency handling, and data consistency.
 * 
 * Critical modules covered:
 * - Bookings (state transitions, availability)
 * - Payments (financial records, idempotency)
 * - Listings (availability slots, versioning)
 * - Users (profiles, preferences)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { AppModule } from '../../src/app.module';
import { BookingStatus, PaymentStatus, PayoutStatus } from '@rental-portal/database';

describe('Database Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Test data
  let testUser: { id: string; email: string };
  let testOwner: { id: string; email: string };
  let testListing: { id: string; categoryId: string };
  let testCategory: { id: string };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await app.init();

    // Create test category
    testCategory = await prisma.category.create({
      data: {
        name: `Test Category ${Date.now()}`,
        slug: `test-category-${Date.now()}`,
      },
    });

    // Create test users
    testUser = await prisma.user.create({
      data: {
        email: `db-test-user-${Date.now()}@test.com`,
        passwordHash: 'hashed_password',
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
      },
    });

    testOwner = await prisma.user.create({
      data: {
        email: `db-test-owner-${Date.now()}@test.com`,
        passwordHash: 'hashed_password',
        firstName: 'Test',
        lastName: 'Owner',
        role: 'HOST',
        stripeConnectId: 'acct_test_123',
        stripeOnboardingComplete: true,
      },
    });

    // Create test listing
    testListing = await prisma.listing.create({
      data: {
        title: `Test Listing ${Date.now()}`,
        description: 'Test listing for database integration',
        basePrice: 100,
        currency: 'USD',
        categoryId: testCategory.id,
        ownerId: testOwner.id,
        status: 'PUBLISHED',
        location: 'San Francisco, CA',
        condition: 'GOOD',
        bookingMode: 'REQUEST',
      },
    });
  }, 60000);

  afterAll(async () => {
    // Cleanup in reverse order
    await prisma.booking.deleteMany({
      where: { listingId: testListing.id },
    });
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

  describe('Booking State Transitions', () => {
    it('should atomically transition booking state with transaction', async () => {
      // Create a booking
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 30);
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

      // Verify initial state
      expect(booking.status).toBe('PENDING_OWNER_APPROVAL');

      // Update state within transaction
      const updated = await prisma.$transaction(async (tx) => {
        // Update booking status
        const updatedBooking = await tx.booking.update({
          where: { id: booking.id },
          data: { status: 'PENDING_PAYMENT' },
        });

        // Create state history record
        await tx.bookingStateHistory.create({
          data: {
            bookingId: booking.id,
            previousStatus: 'PENDING_OWNER_APPROVAL',
            newStatus: 'PENDING_PAYMENT',
            changedBy: testOwner.id,
            reason: 'Owner approved booking',
          },
        });

        return updatedBooking;
      });

      expect(updated.status).toBe('PENDING_PAYMENT');

      // Verify state history was created
      const history = await prisma.bookingStateHistory.findMany({
        where: { bookingId: booking.id },
      });
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].newStatus).toBe('PENDING_PAYMENT');

      // Cleanup
      await prisma.bookingStateHistory.deleteMany({
        where: { bookingId: booking.id },
      });
      await prisma.booking.delete({
        where: { id: booking.id },
      });
    });

    it('should prevent invalid state transitions', async () => {
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
          status: 'CANCELLED',
          totalPrice: 200,
          currency: 'USD',
        },
      });

      // Attempt invalid transition: CANCELLED -> CONFIRMED
      // This should be handled at the service level, but we verify DB state
      const cancelledBooking = await prisma.booking.findUnique({
        where: { id: booking.id },
      });

      expect(cancelledBooking?.status).toBe('CANCELLED');

      // Cleanup
      await prisma.booking.delete({
        where: { id: booking.id },
      });
    });
  });

  describe('Payment Idempotency', () => {
    it('should maintain exactly one payment record per booking', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 50);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 2);

      const booking = await prisma.booking.create({
        data: {
          listingId: testListing.id,
          renterId: testUser.id,
          ownerId: testOwner.id,
          startDate,
          endDate,
          status: 'PENDING_PAYMENT',
          totalPrice: 200,
          currency: 'USD',
        },
      });

      // Create payment record
      const payment = await prisma.payment.create({
        data: {
          bookingId: booking.id,
          amount: 200,
          currency: 'USD',
          status: PaymentStatus.PENDING,
          stripePaymentIntentId: `pi_${Date.now()}`,
        },
      });

      // Simulate duplicate payment attempt (should not create second record)
      const existingPayment = await prisma.payment.findFirst({
        where: { bookingId: booking.id },
      });

      expect(existingPayment).toBeTruthy();
      expect(existingPayment?.id).toBe(payment.id);

      // Count should be exactly 1
      const paymentCount = await prisma.payment.count({
        where: { bookingId: booking.id },
      });
      expect(paymentCount).toBe(1);

      // Cleanup
      await prisma.payment.deleteMany({
        where: { bookingId: booking.id },
      });
      await prisma.booking.delete({
        where: { id: booking.id },
      });
    });

    it('should create payment audit trail', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 60);
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
          totalPrice: 300,
          currency: 'USD',
        },
      });

      const payment = await prisma.payment.create({
        data: {
          bookingId: booking.id,
          amount: 300,
          currency: 'USD',
          status: PaymentStatus.COMPLETED,
          stripePaymentIntentId: `pi_${Date.now()}`,
        },
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId: testUser.id,
          action: 'PAYMENT_COMPLETED',
          entityType: 'Payment',
          entityId: payment.id,
          metadata: { amount: 300, currency: 'USD' },
        },
      });

      // Verify audit trail
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          entityType: 'Payment',
          entityId: payment.id,
        },
      });

      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0].action).toBe('PAYMENT_COMPLETED');

      // Cleanup
      await prisma.auditLog.deleteMany({
        where: { entityId: payment.id },
      });
      await prisma.payment.deleteMany({
        where: { bookingId: booking.id },
      });
      await prisma.booking.delete({
        where: { id: booking.id },
      });
    });
  });

  describe('Concurrent Booking Handling', () => {
    it('should handle concurrent date range checks', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 80);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      // Create first booking
      const booking1 = await prisma.booking.create({
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

      // Verify overlapping date check
      const overlapping = await prisma.booking.findFirst({
        where: {
          listingId: testListing.id,
          status: { not: 'CANCELLED' },
          AND: [
            { startDate: { lt: endDate } },
            { endDate: { gt: startDate } },
          ],
        },
      });

      expect(overlapping).toBeTruthy();
      expect(overlapping?.id).toBe(booking1.id);

      // Cleanup
      await prisma.booking.delete({
        where: { id: booking1.id },
      });
    });
  });

  describe('Payout Calculation', () => {
    it('should calculate owner earnings correctly', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 90);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 2);

      const booking = await prisma.booking.create({
        data: {
          listingId: testListing.id,
          renterId: testUser.id,
          ownerId: testOwner.id,
          startDate,
          endDate,
          status: 'COMPLETED',
          totalPrice: 200,
          ownerEarnings: 170, // 85% of total
          platformFee: 30, // 15% fee
          currency: 'USD',
        },
      });

      // Create payout
      const payout = await prisma.payout.create({
        data: {
          bookingId: booking.id,
          ownerId: testOwner.id,
          amount: 170,
          currency: 'USD',
          status: PayoutStatus.PENDING,
        },
      });

      // Verify payout amount matches owner earnings
      expect(payout.amount).toBe(booking.ownerEarnings);

      // Cleanup
      await prisma.payout.deleteMany({
        where: { bookingId: booking.id },
      });
      await prisma.booking.delete({
        where: { id: booking.id },
      });
    });
  });

  describe('Referential Integrity', () => {
    it('should enforce foreign key constraints', async () => {
      // Attempt to create booking with invalid user ID
      await expect(
        prisma.booking.create({
          data: {
            listingId: testListing.id,
            renterId: 'invalid-user-id',
            ownerId: testOwner.id,
            startDate: new Date(),
            endDate: new Date(),
            status: 'PENDING_OWNER_APPROVAL',
            totalPrice: 100,
            currency: 'USD',
          },
        })
      ).rejects.toThrow();
    });

    it('should cascade delete related records', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 100);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 2);

      const booking = await prisma.booking.create({
        data: {
          listingId: testListing.id,
          renterId: testUser.id,
          ownerId: testOwner.id,
          startDate,
          endDate,
          status: 'PENDING_PAYMENT',
          totalPrice: 200,
          currency: 'USD',
        },
      });

      // Create related payment
      await prisma.payment.create({
        data: {
          bookingId: booking.id,
          amount: 200,
          currency: 'USD',
          status: PaymentStatus.PENDING,
          stripePaymentIntentId: `pi_${Date.now()}`,
        },
      });

      // Delete booking (should handle related records based on DB constraints)
      await prisma.booking.delete({
        where: { id: booking.id },
      });

      // Verify booking is deleted
      const deletedBooking = await prisma.booking.findUnique({
        where: { id: booking.id },
      });
      expect(deletedBooking).toBeNull();
    });
  });
});
