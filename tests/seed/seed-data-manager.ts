/**
 * Centralized seed data manager for test suites.
 *
 * Usage:
 *   import { SeedDataManager } from '../../tests/seed/seed-data-manager';
 *   const seed = new SeedDataManager();
 *   const user = seed.createUser({ role: 'owner' });
 *   const listing = seed.createListing({ ownerId: user.id });
 */

const uniqueSuffix = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export interface SeedUser {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  role: 'user' | 'owner' | 'admin' | 'renter';
}

export interface SeedListing {
  id: string;
  title: string;
  description: string;
  price: number;
  categoryId: number;
  ownerId: string;
  location: {
    address: string;
    city: string;
    country: string;
    coordinates: { lat: number; lng: number };
  };
}

export interface SeedBooking {
  id: string;
  listingId: string;
  renterId: string;
  ownerId: string;
  startDate: string;
  endDate: string;
  totalPrice: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
}

export class SeedDataManager {
  private createdIds: { users: string[]; listings: string[]; bookings: string[] } = {
    users: [],
    listings: [],
    bookings: [],
  };

  createUser(overrides: Partial<SeedUser> = {}): SeedUser {
    const suffix = uniqueSuffix();
    const user: SeedUser = {
      id: `user-${suffix}`,
      email: `test-${suffix}@test.com`,
      password: 'SecurePass123!',
      firstName: 'Test',
      lastName: 'User',
      phoneNumber: `+977980000${Math.floor(1000 + Math.random() * 9000)}`,
      role: 'user',
      ...overrides,
    };
    this.createdIds.users.push(user.id);
    return user;
  }

  createOwner(overrides: Partial<SeedUser> = {}): SeedUser {
    return this.createUser({ role: 'owner', firstName: 'Owner', ...overrides });
  }

  createAdmin(overrides: Partial<SeedUser> = {}): SeedUser {
    return this.createUser({ role: 'admin', firstName: 'Admin', ...overrides });
  }

  createRenter(overrides: Partial<SeedUser> = {}): SeedUser {
    return this.createUser({ role: 'renter', firstName: 'Renter', ...overrides });
  }

  createListing(overrides: Partial<SeedListing> = {}): SeedListing {
    const suffix = uniqueSuffix();
    const listing: SeedListing = {
      id: `listing-${suffix}`,
      title: `Test Listing ${suffix}`,
      description: 'A test listing for automated tests',
      price: Math.floor(500 + Math.random() * 9500),
      categoryId: 1,
      ownerId: overrides.ownerId || `owner-${suffix}`,
      location: {
        address: 'Test Address 123',
        city: 'Kathmandu',
        country: 'Nepal',
        coordinates: { lat: 27.7172, lng: 85.324 },
      },
      ...overrides,
    };
    this.createdIds.listings.push(listing.id);
    return listing;
  }

  createBooking(overrides: Partial<SeedBooking> = {}): SeedBooking {
    const suffix = uniqueSuffix();
    const now = new Date();
    const startDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const endDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const booking: SeedBooking = {
      id: `booking-${suffix}`,
      listingId: overrides.listingId || `listing-${suffix}`,
      renterId: overrides.renterId || `renter-${suffix}`,
      ownerId: overrides.ownerId || `owner-${suffix}`,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalPrice: Math.floor(1000 + Math.random() * 9000),
      status: 'pending',
      ...overrides,
    };
    this.createdIds.bookings.push(booking.id);
    return booking;
  }

  getCreatedIds() {
    return { ...this.createdIds };
  }

  reset() {
    this.createdIds = { users: [], listings: [], bookings: [] };
  }
}
