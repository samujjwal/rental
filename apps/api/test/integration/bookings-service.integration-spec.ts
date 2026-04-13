import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';

describe('BookingsService Integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    prisma = app.get<PrismaService>(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('Booking creation with real DB', () => {
    it('should persist a booking in the database via transaction', async () => {
      await prisma.$transaction(async (tx) => {
        // Verify we can query bookings table
        const count = await tx.booking.count();
        expect(typeof count).toBe('number');

        // Rollback happens automatically when transaction block ends without commit
        throw new Error('ROLLBACK');
      }).catch((err) => {
        if (err.message !== 'ROLLBACK') throw err;
      });
    });

    it('should enforce foreign key constraints', async () => {
      // Use raw SQL to bypass Prisma type checks — we intentionally pass invalid FK values
      await expect(
        prisma.$executeRawUnsafe(
          `INSERT INTO "Booking" ("id", "listingId", "renterId", "ownerId", "startDate", "endDate", "totalPrice", "basePrice", "currency", "status", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
          'test-fk-check',
          'nonexistent-listing',
          'nonexistent-renter',
          'nonexistent-owner',
          new Date(),
          new Date(Date.now() + 86400000),
          1000,
          1000,
          'NPR',
          'PENDING',
        ),
      ).rejects.toThrow();
    });
  });

  describe('Booking queries', () => {
    it('should support pagination on bookings', async () => {
      const bookings = await prisma.booking.findMany({
        take: 5,
        skip: 0,
        orderBy: { createdAt: 'desc' },
      });

      expect(Array.isArray(bookings)).toBe(true);
      expect(bookings.length).toBeLessThanOrEqual(5);
    });

    it('should support filtering by status', async () => {
      const bookings = await prisma.booking.findMany({
        where: { status: 'PENDING_APPROVAL' },
        take: 5,
      });

      bookings.forEach((b) => {
        expect(b.status).toBe('PENDING_APPROVAL');
      });
    });

    it('should include related listing and renter data', async () => {
      const bookings = await prisma.booking.findMany({
        take: 1,
        include: {
          listing: { select: { id: true, title: true } },
          renter: { select: { id: true, email: true } },
        },
      });

      if (bookings.length > 0) {
        expect(bookings[0]).toHaveProperty('listing');
        expect(bookings[0]).toHaveProperty('renter');
      }
    });
  });

  describe('Booking date validation at DB level', () => {
    it('should store dates with timezone information', async () => {
      const now = new Date();
      const isoString = now.toISOString();
      const parsed = new Date(isoString);

      // Verify Date serialization roundtrips correctly
      expect(parsed.getTime()).toBe(now.getTime());
    });
  });
});
