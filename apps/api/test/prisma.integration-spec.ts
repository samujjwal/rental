/**
 * Prisma / DB Integration Tests
 *
 * These test the data layer through PrismaService against a real PostgreSQL
 * database. They are separated from unit tests and run only when DATABASE_URL
 * is available (CI or local dev with docker-compose up).
 *
 * Run: pnpm --filter @rental-portal/api test:e2e -- --testPathPatterns integration
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { BookingStatus, PropertyStatus, PropertyType, UserRole } from '@rental-portal/database';

const DB_URL = process.env.DATABASE_URL;
const describeIf = DB_URL ? describe : describe.skip;

describeIf('Prisma Integration Tests', () => {
  let prisma: PrismaService;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({ DATABASE_URL: DB_URL })],
        }),
      ],
      providers: [PrismaService],
    }).compile();

    prisma = module.get(PrismaService);
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
    await module.close();
  });

  // ── Connection ──

  describe('connection', () => {
    it('connects to the database', async () => {
      const result = await prisma.$queryRaw`SELECT 1 as ok`;
      expect(result).toEqual([{ ok: 1 }]);
    });

    it('returns current timestamp', async () => {
      const result: any[] = await prisma.$queryRaw`SELECT NOW() as ts`;
      expect(result[0].ts).toBeInstanceOf(Date);
    });
  });

  // ── User CRUD ──

  describe('users', () => {
    const testEmail = `test-${Date.now()}@integration.np`;
    let userId: string;

    afterAll(async () => {
      if (userId) {
        await prisma.user.delete({ where: { id: userId } }).catch(() => {});
      }
    });

    it('creates a user', async () => {
      const user = await prisma.user.create({
        data: {
          email: testEmail,
          username: testEmail,
          passwordHash: 'hashed',
          firstName: 'Test',
          lastName: 'User',
          role: UserRole.USER,
        },
      });
      userId = user.id;
      expect(user.id).toBeDefined();
      expect(user.email).toBe(testEmail);
      expect(user.role).toBe(UserRole.USER);
      expect(user.createdAt).toBeInstanceOf(Date);
    });

    it('finds user by email', async () => {
      const user = await prisma.user.findUnique({ where: { email: testEmail } });
      expect(user).toBeTruthy();
      expect(user!.firstName).toBe('Test');
    });

    it('updates a user', async () => {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { firstName: 'Updated', city: 'Kathmandu' },
      });
      expect(updated.firstName).toBe('Updated');
      expect(updated.city).toBe('Kathmandu');
    });

    it('enforces unique email constraint', async () => {
      await expect(
        prisma.user.create({
          data: {
            email: testEmail,
            username: `dup-${testEmail}`,
            passwordHash: 'hashed',
            firstName: 'Dup',
            role: UserRole.USER,
          },
        }),
      ).rejects.toThrow();
    });

    it('soft-deletes a user', async () => {
      const deleted = await prisma.user.update({
        where: { id: userId },
        data: { deletedAt: new Date() },
      });
      expect(deleted.deletedAt).toBeInstanceOf(Date);
    });
  });

  // ── Category + Listing ──

  describe('listings', () => {
    let catId: string;
    let ownerId: string;
    let listingId: string;

    beforeAll(async () => {
      const ownerEmail = `owner-${Date.now()}@integration.np`;
      const owner = await prisma.user.create({
        data: {
          email: ownerEmail,
          username: ownerEmail,
          passwordHash: 'hashed',
          firstName: 'Owner',
          role: UserRole.HOST,
        },
      });
      ownerId = owner.id;

      const cat = await prisma.category.create({
        data: {
          name: `TestCat-${Date.now()}`,
          slug: `testcat-${Date.now()}`,
          description: 'Integration test category',
          searchableFields: [],
          requiredFields: [],
        },
      });
      catId = cat.id;
    });

    afterAll(async () => {
      if (listingId) await prisma.listing.delete({ where: { id: listingId } }).catch(() => {});
      if (catId) await prisma.category.delete({ where: { id: catId } }).catch(() => {});
      if (ownerId) await prisma.user.delete({ where: { id: ownerId } }).catch(() => {});
    });

    it('creates a listing with category', async () => {
      const listing = await prisma.listing.create({
        data: {
          title: 'Integration Test Bike',
          description: 'A test listing',
          slug: `int-test-${Date.now()}`,
          address: '10 Test Street',
          city: 'Kathmandu',
          state: 'Bagmati',
          zipCode: '44600',
          country: 'NP',
          type: PropertyType.OTHER,
          basePrice: 500,
          currency: 'NPR',
          amenities: [],
          features: [],
          photos: [],
          rules: [],
          status: PropertyStatus.DRAFT,
          ownerId,
          categoryId: catId,
        },
      });
      listingId = listing.id;
      expect(listing.id).toBeDefined();
      expect(Number(listing.basePrice)).toBe(500);
    });

    it('reads listing with owner relation', async () => {
      const listing = await prisma.listing.findUnique({
        where: { id: listingId },
        include: { owner: true, category: true },
      });
      expect(listing).toBeTruthy();
      expect(listing!.owner.firstName).toBe('Owner');
      expect(listing!.category!.slug).toContain('testcat');
    });

    it('filters listings by status', async () => {
      const drafts = await prisma.listing.findMany({
        where: { status: PropertyStatus.DRAFT, id: listingId },
      });
      expect(drafts.length).toBe(1);

      const available = await prisma.listing.findMany({
        where: { status: PropertyStatus.AVAILABLE, id: listingId },
      });
      expect(available.length).toBe(0);
    });

    it('updates listing status', async () => {
      const updated = await prisma.listing.update({
        where: { id: listingId },
        data: { status: PropertyStatus.AVAILABLE },
      });
      expect(updated.status).toBe(PropertyStatus.AVAILABLE);
    });

    it('enforces unique slug constraint', async () => {
      const existing = await prisma.listing.findUnique({ where: { id: listingId } });
      await expect(
        prisma.listing.create({
          data: {
            title: 'Duplicate Slug',
            description: 'Should fail',
            slug: existing!.slug,
            address: '11 Test Street',
            city: 'Kathmandu',
            state: 'Bagmati',
            zipCode: '44600',
            country: 'NP',
            type: PropertyType.OTHER,
            basePrice: 100,
            currency: 'NPR',
            amenities: [],
            features: [],
            photos: [],
            rules: [],
            status: PropertyStatus.DRAFT,
            ownerId,
            categoryId: catId,
          },
        }),
      ).rejects.toThrow();
    });
  });

  // ── Booking lifecycle ──

  describe('bookings', () => {
    let ownerId: string;
    let renterId: string;
    let listingId: string;
    let catId: string;
    let bookingId: string;

    beforeAll(async () => {
      const ownerEmail = `booking-owner-${Date.now()}@int.np`;
      const renterEmail = `booking-renter-${Date.now()}@int.np`;
      const [owner, renter] = await Promise.all([
        prisma.user.create({
          data: {
            email: ownerEmail,
            username: ownerEmail,
            passwordHash: 'h',
            firstName: 'BookOwner',
            role: UserRole.HOST,
          },
        }),
        prisma.user.create({
          data: {
            email: renterEmail,
            username: renterEmail,
            passwordHash: 'h',
            firstName: 'BookRenter',
            role: UserRole.USER,
          },
        }),
      ]);
      ownerId = owner.id;
      renterId = renter.id;

      const cat = await prisma.category.create({
        data: {
          name: `BookCat-${Date.now()}`,
          slug: `bookcat-${Date.now()}`,
          description: 'Booking test',
          searchableFields: [],
          requiredFields: [],
        },
      });
      catId = cat.id;

      const listing = await prisma.listing.create({
        data: {
          title: 'Booking Test Item',
          description: 'For booking tests',
          slug: `booking-test-${Date.now()}`,
          address: '20 Test Street',
          city: 'Kathmandu',
          state: 'Bagmati',
          zipCode: '44600',
          country: 'NP',
          type: PropertyType.OTHER,
          basePrice: 1000,
          currency: 'NPR',
          amenities: [],
          features: [],
          photos: [],
          rules: [],
          status: PropertyStatus.AVAILABLE,
          ownerId,
          categoryId: catId,
        },
      });
      listingId = listing.id;
    });

    afterAll(async () => {
      if (bookingId) await prisma.booking.delete({ where: { id: bookingId } }).catch(() => {});
      if (listingId) await prisma.listing.delete({ where: { id: listingId } }).catch(() => {});
      if (catId) await prisma.category.delete({ where: { id: catId } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: [ownerId, renterId] } } }).catch(() => {});
    });

    it('creates a booking', async () => {
      const booking = await prisma.booking.create({
        data: {
          listingId,
          renterId,
          ownerId,
          startDate: new Date('2026-03-01'),
          endDate: new Date('2026-03-05'),
          basePrice: 1000,
          totalPrice: 4000,
          currency: 'NPR',
          status: BookingStatus.PENDING_OWNER_APPROVAL,
        },
      });
      bookingId = booking.id;
      expect(booking.id).toBeDefined();
      expect(Number(booking.totalPrice)).toBe(4000);
      expect(booking.status).toBe(BookingStatus.PENDING_OWNER_APPROVAL);
    });

    it('queries bookings with listing relation', async () => {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { listing: true, renter: true },
      });
      expect(booking!.listing.title).toBe('Booking Test Item');
      expect(booking!.renter.firstName).toBe('BookRenter');
    });

    it('updates booking status', async () => {
      const updated = await prisma.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.CONFIRMED },
      });
      expect(updated.status).toBe(BookingStatus.CONFIRMED);
    });

    it('queries bookings by renter', async () => {
      const bookings = await prisma.booking.findMany({
        where: { renterId },
      });
      expect(bookings.length).toBeGreaterThanOrEqual(1);
      expect(bookings[0].renterId).toBe(renterId);
    });
  });

  // ── Transactions ──

  describe('transactions', () => {
    it('rolls back on error', async () => {
      const email = `tx-${Date.now()}@int.np`;

      try {
        await prisma.$transaction(async (tx: any) => {
          await tx.user.create({
            data: {
              email,
              username: email,
              passwordHash: 'h',
              firstName: 'TxTest',
              role: UserRole.USER,
            },
          });
          throw new Error('Intentional rollback');
        });
      } catch {
        // expected
      }

      const user = await prisma.user.findUnique({ where: { email } });
      expect(user).toBeNull();
    });

    it('commits on success', async () => {
      const email = `tx-commit-${Date.now()}@int.np`;

      await prisma.$transaction(async (tx: any) => {
        await tx.user.create({
          data: {
            email,
            username: email,
            passwordHash: 'h',
            firstName: 'TxCommit',
            role: UserRole.USER,
          },
        });
      });

      const user = await prisma.user.findUnique({ where: { email } });
      expect(user).toBeTruthy();
      expect(user!.firstName).toBe('TxCommit');

      // cleanup
      await prisma.user.delete({ where: { email } });
    });
  });

  // ── Aggregation queries ──

  describe('aggregations', () => {
    it('counts users', async () => {
      const count = await prisma.user.count();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('groups listings by status', async () => {
      const groups = await prisma.listing.groupBy({
        by: ['status'],
        _count: { id: true },
      });
      expect(Array.isArray(groups)).toBe(true);
      groups.forEach((g: any) => {
        expect(g.status).toBeDefined();
        expect(g._count.id).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
