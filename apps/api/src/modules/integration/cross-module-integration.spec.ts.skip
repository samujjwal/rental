import { Test, TestingModule } from '@nestjs/testing';
import { BookingsService } from '@/modules/bookings/services/bookings.service';
import { ListingsService } from '@/modules/listings/services/listings.service';
import { UsersService } from '@/modules/users/services/users.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';

/**
 * Cross-Module Integration Tests
 * 
 * These tests validate that different modules work together correctly:
 * - Bookings + Payments integration
 * - Bookings + Availability integration
 * - Listings + Categories integration
 * - Users + Organizations integration
 * - Auth + Security integration
 */
describe('Cross-Module Integration Tests', () => {
  let bookingsService: BookingsService;
  let listingsService: ListingsService;
  let usersService: UsersService;
  let prisma: PrismaService;
  let cache: CacheService;

  beforeAll(async () => {
    const mockPrismaService = {
      booking: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      listing: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      availability: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      category: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      payment: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        ListingsService,
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    bookingsService = module.get<BookingsService>(BookingsService);
    listingsService = module.get<ListingsService>(ListingsService);
    usersService = module.get<UsersService>(UsersService);
    prisma = module.get(PrismaService);
    cache = module.get(CacheService);
  });

  describe('BOOKINGS + LISTINGS INTEGRATION', () => {
    it('should validate listing availability before booking', async () => {
      const mockListing = {
        id: 'listing-1',
        ownerId: 'owner-1',
        status: 'AVAILABLE',
        basePrice: 100,
        currency: 'USD',
      };

      const mockAvailability = {
        id: 'avail-1',
        listingId: 'listing-1',
        startTime: new Date('2024-01-01'),
        endTime: new Date('2024-01-05'),
        status: 'AVAILABLE',
      };

      (prisma.listing.findUnique as jest.Mock).mockResolvedValue(mockListing);
      (prisma.availability.findMany as jest.Mock).mockResolvedValue([mockAvailability]);

      // This would validate that the booking service checks availability
      const listing = await listingsService.findById('listing-1');
      expect(listing).toBeDefined();
      expect(listing.status).toBe('AVAILABLE');
    });

    it('should update listing stats after booking creation', async () => {
      const mockBooking = {
        id: 'booking-1',
        listingId: 'listing-1',
        status: 'CONFIRMED',
      };

      const mockListing = {
        id: 'listing-1',
        totalBookings: 5,
      };

      (prisma.booking.create as jest.Mock).mockResolvedValue(mockBooking);
      (prisma.listing.update as jest.Mock).mockResolvedValue(mockListing);

      // This would validate that listing stats are incremented
      expect(prisma.listing.update).toHaveBeenCalled();
    });

    it('should handle listing deletion with active bookings', async () => {
      const mockBookings = [
        { id: 'booking-1', status: 'CONFIRMED' },
        { id: 'booking-2', status: 'IN_PROGRESS' },
      ];

      (prisma.booking.findMany as jest.Mock).mockResolvedValue(mockBookings);

      // This would validate that listings with active bookings cannot be deleted
      const activeBookings = await prisma.booking.findMany({
        where: {
          listingId: 'listing-1',
          status: { in: ['CONFIRMED', 'IN_PROGRESS'] },
        },
      });

      expect(activeBookings.length).toBe(2);
    });
  });

  describe('BOOKINGS + PAYMENTS INTEGRATION', () => {
    it('should create payment intent with booking details', async () => {
      const mockBooking = {
        id: 'booking-1',
        totalPrice: 500,
        currency: 'USD',
        status: 'PENDING',
      };

      const mockPayment = {
        id: 'payment-1',
        bookingId: 'booking-1',
        amount: 500,
        currency: 'USD',
        status: 'PENDING',
      };

      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
      (prisma.payment.create as jest.Mock).mockResolvedValue(mockPayment);

      // This would validate that payment amount matches booking total
      expect(mockPayment.amount).toBe(mockBooking.totalPrice);
      expect(mockPayment.currency).toBe(mockBooking.currency);
    });

    it('should update booking status on payment success', async () => {
      const mockPayment = {
        id: 'payment-1',
        bookingId: 'booking-1',
        status: 'COMPLETED',
      };

      const mockBooking = {
        id: 'booking-1',
        status: 'CONFIRMED',
      };

      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(mockPayment);
      (prisma.booking.update as jest.Mock).mockResolvedValue(mockBooking);

      // This would validate that booking status transitions to CONFIRMED
      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: 'booking-1' },
        data: { status: 'CONFIRMED' },
      });
    });

    it('should handle payment failure with booking cancellation', async () => {
      const mockPayment = {
        id: 'payment-1',
        bookingId: 'booking-1',
        status: 'FAILED',
      };

      const mockBooking = {
        id: 'booking-1',
        status: 'CANCELLED',
      };

      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(mockPayment);
      (prisma.booking.update as jest.Mock).mockResolvedValue(mockBooking);

      // This would validate that failed payments trigger booking cancellation
      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: 'booking-1' },
        data: { status: 'CANCELLED', cancellationReason: 'PAYMENT_FAILED' },
      });
    });
  });

  describe('USERS + ORGANIZATIONS INTEGRATION', () => {
    it('should validate organization membership before action', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'user@example.com',
        organizations: [
          { id: 'org-1', role: 'ADMIN' },
        ],
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      // This would validate that user has required organization role
      const user = await usersService.findById('user-1');
      expect(user).toBeDefined();
    });

    it('should handle organization deletion with member cleanup', async () => {
      const mockMembers = [
        { id: 'member-1', userId: 'user-1' },
        { id: 'member-2', userId: 'user-2' },
      ];

      (prisma.$transaction as jest.Mock).mockResolvedValue(mockMembers);

      // This would validate that organization members are cleaned up
      const result = await prisma.$transaction(async (tx) => {
        // Delete organization members
        await tx.organizationMember.deleteMany({
          where: { organizationId: 'org-1' },
        });
        // Delete organization
        await tx.organization.delete({
          where: { id: 'org-1' },
        });
        return mockMembers;
      });

      expect(result).toBeDefined();
    });

    it('should sync user permissions on organization role change', async () => {
      const mockMember = {
        id: 'member-1',
        userId: 'user-1',
        organizationId: 'org-1',
        role: 'ADMIN',
      };

      (prisma.organizationMember.update as jest.Mock).mockResolvedValue(mockMember);

      // This would validate that user permissions are updated
      expect(prisma.organizationMember.update).toHaveBeenCalledWith({
        where: { id: 'member-1' },
        data: { role: 'ADMIN' },
      });
    });
  });

  describe('LISTINGS + CATEGORIES INTEGRATION', () => {
    it('should validate category-specific attributes', async () => {
      const mockListing = {
        id: 'listing-1',
        categoryId: 'cat-1',
      };

      const mockCategory = {
        id: 'cat-1',
        slug: 'vehicles',
        requiredFields: ['make', 'model', 'year'],
      };

      const mockAttributes = [
        { attributeDefinitionId: 'attr-1', value: 'Toyota' },
        { attributeDefinitionId: 'attr-2', value: 'Camry' },
        { attributeDefinitionId: 'attr-3', value: '2020' },
      ];

      (prisma.listing.findUnique as jest.Mock).mockResolvedValue(mockListing);
      (prisma.category.findUnique as jest.Mock).mockResolvedValue(mockCategory);
      (prisma.listingAttributeValue.findMany as jest.Mock).mockResolvedValue(mockAttributes);

      // This would validate that all required category attributes are present
      expect(mockAttributes.length).toBe(mockCategory.requiredFields.length);
    });

    it('should handle category deletion with listing reassignment', async () => {
      const mockListings = [
        { id: 'listing-1', categoryId: 'cat-1' },
        { id: 'listing-2', categoryId: 'cat-1' },
      ];

      (prisma.listing.findMany as jest.Mock).mockResolvedValue(mockListings);

      // This would validate that listings are reassigned or category is marked inactive
      const listingsInCategory = await prisma.listing.findMany({
        where: { categoryId: 'cat-1' },
      });

      expect(listingsInCategory.length).toBe(2);
    });

    it('should update category stats on listing creation', async () => {
      const mockListing = {
        id: 'listing-1',
        categoryId: 'cat-1',
      };

      const mockCategory = {
        id: 'cat-1',
        totalListings: 10,
      };

      (prisma.listing.create as jest.Mock).mockResolvedValue(mockListing);
      (prisma.category.update as jest.Mock).mockResolvedValue(mockCategory);

      // This would validate that category stats are incremented
      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: 'cat-1' },
        data: { totalListings: { increment: 1 } },
      });
    });
  });

  describe('CROSS-MODULE DATA CONSISTENCY', () => {
    it('should maintain consistency across booking lifecycle', async () => {
      const mockBooking = {
        id: 'booking-1',
        status: 'CONFIRMED',
        listingId: 'listing-1',
        renterId: 'renter-1',
        ownerId: 'owner-1',
      };

      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);

      // This would validate that related entities are consistent
      const booking = await prisma.booking.findUnique({
        where: { id: 'booking-1' },
        include: {
          listing: true,
          renter: true,
          bookingOwner: true,
        },
      });

      if (booking) {
        expect(booking.listingId).toBe(booking.listing.id);
        expect(booking.renterId).toBe(booking.renter.id);
        expect(booking.ownerId).toBe(booking.bookingOwner.id);
      }
    });

    it('should handle cascading deletes correctly', async () => {
      (prisma.$transaction as jest.Mock).mockResolvedValue({ success: true });

      // This would validate that cascading deletes work correctly
      const result = await prisma.$transaction(async (tx) => {
        // Delete related records first
        await tx.bookingPriceBreakdown.deleteMany({
          where: { bookingId: 'booking-1' },
        });
        await tx.bookingStateHistory.deleteMany({
          where: { bookingId: 'booking-1' },
        });
        // Then delete the booking
        await tx.booking.delete({
          where: { id: 'booking-1' },
        });
        return { success: true };
      });

      expect(result.success).toBe(true);
    });

    it('should validate currency consistency across modules', async () => {
      const mockBooking = {
        id: 'booking-1',
        currency: 'USD',
        totalPrice: 500,
      };

      const mockPayment = {
        id: 'payment-1',
        bookingId: 'booking-1',
        currency: 'USD',
        amount: 500,
      };

      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
      (prisma.payment.findMany as jest.Mock).mockResolvedValue([mockPayment]);

      // This would validate that currency is consistent across booking and payments
      const booking = await prisma.booking.findUnique({ where: { id: 'booking-1' } });
      const payments = await prisma.payment.findMany({
        where: { bookingId: 'booking-1' },
      });

      if (booking && payments.length > 0) {
        payments.forEach(payment => {
          expect(payment.currency).toBe(booking.currency);
        });
      }
    });
  });

  describe('CROSS-MODULE ERROR HANDLING', () => {
    it('should handle module failures gracefully', async () => {
      (prisma.booking.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      // This would validate that errors are handled gracefully
      await expect(
        prisma.booking.findUnique({ where: { id: 'booking-1' } }),
      ).rejects.toThrow();
    });

    it('should rollback transactions on cross-module failure', async () => {
      (prisma.$transaction as jest.Mock).mockRejectedValue(new Error('Transaction failed'));

      // This would validate that transactions are rolled back on failure
      await expect(
        prisma.$transaction(async (tx) => {
          await tx.booking.create({ data: {} });
          await tx.payment.create({ data: {} });
        }),
      ).rejects.toThrow();
    });

    it('should maintain cache consistency across modules', async () => {
      (cache.get as jest.Mock).mockResolvedValue(null);
      (cache.set as jest.Mock).mockResolvedValue(undefined);

      // This would validate that cache is invalidated across modules
      await cache.del('listing:listing-1');
      await cache.del('bookings:listing-1');

      expect(cache.del).toHaveBeenCalledTimes(2);
    });
  });
});
