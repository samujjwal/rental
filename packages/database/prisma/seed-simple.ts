import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { faker } from '@faker-js/faker';

// Load environment variables from root .env file
config({ path: '../../.env' });

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting simple database seeding...');

  // Clean existing data - order matters due to foreign keys
  console.log('🧹 Cleaning existing data...');
  await prisma.review.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.user.deleteMany();
  await prisma.category.deleteMany();
  await prisma.cancellationPolicy.deleteMany();

  console.log('✓ Cleaned existing data');

  // Create cancellation policies
  console.log('\n📋 Creating cancellation policies...');
  const policies = await Promise.all([
    prisma.cancellationPolicy.create({
      data: {
        name: 'Flexible',
        description: 'Free cancellation up to 24 hours before',
        type: 'flexible',
        fullRefundHours: 24,
        partialRefundHours: 48,
        partialRefundPercent: 1.0,
        noRefundHours: 0,
      },
    }),
    prisma.cancellationPolicy.create({
      data: {
        name: 'Moderate',
        description: 'Free cancellation up to 7 days before',
        type: 'moderate',
        fullRefundHours: 168,
        partialRefundHours: 336,
        partialRefundPercent: 0.5,
        noRefundHours: 24,
      },
    }),
    prisma.cancellationPolicy.create({
      data: {
        name: 'Strict',
        description: 'No refunds unless property is unavailable',
        type: 'strict',
        fullRefundHours: 0,
        partialRefundHours: 0,
        partialRefundPercent: 0,
        noRefundHours: 0,
      },
    }),
  ]);

  console.log(`✓ Created ${policies.length} cancellation policies`);

  // Create categories
  console.log('\n📂 Creating categories...');
  const categories = await Promise.all([
    prisma.category.create({
      data: {
        name: 'Apartment',
        slug: 'apartment',
        description: 'Full apartments and condos',
        icon: 'apartment',
        isActive: true,
      },
    }),
    prisma.category.create({
      data: {
        name: 'House',
        slug: 'house',
        description: 'Entire houses and villas',
        icon: 'house',
        isActive: true,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Car',
        slug: 'car',
        description: 'Cars and trucks for rent',
        icon: 'car',
        isActive: true,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Equipment',
        slug: 'equipment',
        description: 'Tools and equipment',
        icon: 'tools',
        isActive: true,
      },
    }),
  ]);

  console.log(`✓ Created ${categories.length} categories`);

  // Create users
  console.log('\n👥 Creating users...');
  const hashedPassword = await bcrypt.hash('password123', 10);

  const users = await Promise.all([
    // Admin user
    prisma.user.create({
      data: {
        email: 'admin@gharbatai.com',
        username: 'admin',
        passwordHash: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
        status: 'ACTIVE',
        emailVerified: true,
        isActive: true,
      },
    }),
    // Regular users
    ...Array.from({ length: 20 }, async (_, i) => {
      return prisma.user.create({
        data: {
          email: faker.internet.email(),
          username: faker.internet.username(),
          passwordHash: hashedPassword,
          firstName: faker.person.firstName(),
          lastName: faker.person.lastName(),
          phone: faker.phone.number(),
          profilePhotoUrl: faker.image.avatar(),
          bio: faker.lorem.sentence(),
          role: 'USER',
          status: 'ACTIVE',
          emailVerified: true,
          isActive: true,
          averageRating: faker.number.float({ min: 3, max: 5, fractionDigits: 1 }),
          totalReviews: faker.number.int({ min: 0, max: 100 }),
          responseRate: faker.number.int({ min: 80, max: 100 }),
          responseTime: '< 2 hours',
          city: faker.location.city(),
          state: faker.location.state(),
          country: 'USA',
        },
      });
    }),
  ]);

  console.log(`✓ Created ${users.length} users`);

  // Create listings
  console.log('\n🏠 Creating listings...');
  const listings = [];

  for (let i = 0; i < 50; i++) {
    const owner = users[faker.number.int({ min: 1, max: users.length - 1 })];
    const category = categories[faker.number.int({ min: 0, max: categories.length - 1 })];
    const policy = policies[faker.number.int({ min: 0, max: policies.length - 1 })];

    const listing = await prisma.listing.create({
      data: {
        title: faker.lorem.words(3),
        slug: `${category.name}-${i}-${faker.string.alphanumeric(8)}`,
        description: faker.lorem.paragraphs(2),
        address: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state(),
        zipCode: faker.location.zipCode(),
        country: 'USA',
        latitude: faker.location.latitude(),
        longitude: faker.location.longitude(),
        type: 'APARTMENT',
        status: 'AVAILABLE',
        verificationStatus: 'VERIFIED',
        condition: 'EXCELLENT',
        bookingMode: 'INSTANT_BOOK',
        basePrice: faker.number.float({ min: 25, max: 500, fractionDigits: 2 }),
        currency: 'USD',
        securityDeposit: faker.number.float({ min: 100, max: 1000, fractionDigits: 2 }),
        cleaningFee: faker.number.float({ min: 25, max: 100, fractionDigits: 2 }),
        amenities: ['WiFi', 'Kitchen', 'Parking'],
        features: ['Pet Friendly', 'Air Conditioning'],
        photos: Array.from(
          { length: faker.number.int({ min: 3, max: 8 }) },
          () => `https://picsum.photos/seed/${faker.string.alphanumeric(10)}/800/600.jpg`,
        ),
        rules: ['No smoking', 'No parties', 'Quiet hours after 10 PM'],
        ownerId: owner.id,
        categoryId: category.id,
        cancellationPolicyId: policy.id,
      },
    });

    listings.push(listing);
  }

  console.log(`✓ Created ${listings.length} listings`);

  // Create bookings
  console.log('\n📅 Creating bookings...');
  const bookings = [];

  for (let i = 0; i < 100; i++) {
    const listing = listings[faker.number.int({ min: 0, max: listings.length - 1 })];
    const renter = users[faker.number.int({ min: 1, max: users.length - 1 })];

    // Skip if renter owns the listing
    if (listing.ownerId === renter.id) continue;

    const startDate = faker.date.future({ years: 0.5 });
    const endDate = new Date(
      startDate.getTime() + faker.number.int({ min: 1, max: 7 }) * 24 * 60 * 60 * 1000,
    );

    const totalPrice =
      Number(listing.basePrice) *
      Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    try {
      const booking = await prisma.booking.create({
        data: {
          listingId: listing.id,
          ownerId: listing.ownerId,
          renterId: renter.id,
          startDate,
          endDate,
          basePrice: Number(listing.basePrice),
          totalPrice: totalPrice,
          currency: 'USD',
          status: faker.helpers.arrayElement(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']),
          createdAt: faker.date.past(),
        },
      });

      bookings.push(booking);
    } catch (error) {
      // Skip duplicate bookings
    }
  }

  console.log(`✓ Created ${bookings.length} bookings`);

  // Create reviews
  console.log('\n⭐ Creating reviews...');
  const reviews = [];

  for (let i = 0; i < 150; i++) {
    const booking = bookings[faker.number.int({ min: 0, max: bookings.length - 1 })];
    const listing = listings.find((l) => l.id === booking.listingId);

    if (!listing || booking.status !== 'COMPLETED') continue;

    try {
      const review = await prisma.review.create({
        data: {
          bookingId: booking.id,
          listingId: listing.id,
          reviewerId: booking.renterId,
          revieweeId: listing.ownerId,
          rating: faker.number.int({ min: 1, max: 5 }),
          content: faker.lorem.paragraphs(2),
          type: 'LISTING_REVIEW',
          createdAt: faker.date.past(),
        },
      });

      reviews.push(review);
    } catch (error) {
      // Skip duplicate reviews
    }
  }

  console.log(`✓ Created ${reviews.length} reviews`);

  // Summary
  console.log('\n🎉 Database seeding completed!');
  console.log('========================================');
  console.log(`Users: ${users.length}`);
  console.log(`Categories: ${categories.length}`);
  console.log(`Cancellation Policies: ${policies.length}`);
  console.log(`Listings: ${listings.length}`);
  console.log(`Bookings: ${bookings.length}`);
  console.log(`Reviews: ${reviews.length}`);
  console.log('========================================');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
