const {
  PrismaClient,
  UserRole,
  PropertyStatus,
  ListingStatus,
  BookingStatus,
  PayoutStatus,
} = require('@prisma/client');

const prisma = new PrismaClient();

async function createSampleData() {
  try {
    // Create sample users
    const user1 = await prisma.user.create({
      data: {
        email: 'alice.wilson@example.com',
        username: 'alice.wilson@example.com',
        password: 'Password123!',
        passwordHash: '$2b$10$l0ZXMCI3qlklig9D5opvs.KD8UJ4Bt2blulM4WZUKjBLZGmpPRzmW',
        firstName: 'Alice',
        lastName: 'Wilson',
        role: UserRole.USER,
        status: 'ACTIVE',
        isActive: true,
      },
    });

    const user2 = await prisma.user.create({
      data: {
        email: 'bob.johnson@example.com',
        username: 'bob.johnson@example.com',
        password: 'Password123!',
        passwordHash: '$2b$10$l0ZXMCI3qlklig9D5opvs.KD8UJ4Bt2blulM4WZUKjBLZGmpPRzmW',
        firstName: 'Bob',
        lastName: 'Johnson',
        role: UserRole.HOST,
        status: 'ACTIVE',
        isActive: true,
      },
    });

    // Create categories
    const category1 = await prisma.category.create({
      data: {
        name: 'Apartments',
        description: 'Residential apartments for rent',
        slug: 'apartments',
        isActive: true,
      },
    });

    const category2 = await prisma.category.create({
      data: {
        name: 'Houses',
        description: 'Single family houses for rent',
        slug: 'houses',
        isActive: true,
      },
    });

    // Create listings (properties)
    const property1 = await prisma.property.create({
      data: {
        title: 'Modern Downtown Apartment',
        description: 'Beautiful 2-bedroom apartment in the heart of downtown',
        price: 1500,
        status: PropertyStatus.AVAILABLE,
        categoryId: category1.id,
        ownerId: user2.id,
        addressLine1: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94102',
        country: 'USA',
        bedrooms: 2,
        bathrooms: 2,
        maxGuests: 4,
        viewCount: 145,
        averageRating: 4.5,
      },
    });

    const property2 = await prisma.property.create({
      data: {
        title: 'Cozy Suburban House',
        description: 'Perfect family home with garden',
        price: 2500,
        status: PropertyStatus.AVAILABLE,
        categoryId: category2.id,
        ownerId: user2.id,
        addressLine1: '456 Oak Ave',
        city: 'Palo Alto',
        state: 'CA',
        postalCode: '94301',
        country: 'USA',
        bedrooms: 3,
        bathrooms: 2,
        maxGuests: 6,
        viewCount: 89,
        averageRating: 4.8,
      },
    });

    // Create bookings
    const booking1 = await prisma.booking.create({
      data: {
        listingId: property1.id,
        renterId: user1.id,
        startDate: new Date('2026-02-01'),
        endDate: new Date('2026-02-07'),
        totalAmount: 9000,
        status: BookingStatus.CONFIRMED,
      },
    });

    const booking2 = await prisma.booking.create({
      data: {
        listingId: property2.id,
        renterId: user1.id,
        startDate: new Date('2026-03-15'),
        endDate: new Date('2026-03-22'),
        totalAmount: 17500,
        status: BookingStatus.PENDING,
      },
    });

    // Create payments
    await prisma.payment.create({
      data: {
        bookingId: booking1.id,
        amount: 9000,
        status: PayoutStatus.COMPLETED,
        method: 'credit_card',
        stripePaymentIntentId: 'pi_test_123',
      },
    });

    await prisma.payment.create({
      data: {
        bookingId: booking2.id,
        amount: 17500,
        status: PayoutStatus.PENDING,
        method: 'credit_card',
        stripePaymentIntentId: 'pi_test_456',
      },
    });

    console.log('Sample data created successfully!');
    console.log(`Created users: ${user1.email}, ${user2.email}`);
    console.log(`Created listings: ${listing1.title}, ${listing2.title}`);
    console.log(`Created bookings: ${booking1.id}, ${booking2.id}`);
  } catch (error) {
    console.error('Error creating sample data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createSampleData();
