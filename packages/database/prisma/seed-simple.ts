import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import { faker } from '@faker-js/faker';

// Load environment variables from root .env file
config({ path: '../../.env' });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ─── Nepal Constants ─────────────────────────────────────────────────────────

const NEPAL_LOCATIONS = [
  { city: 'Kathmandu', state: 'Bagmati Province', zip: '44600' },
  { city: 'Lalitpur', state: 'Bagmati Province', zip: '44700' },
  { city: 'Pokhara', state: 'Gandaki Province', zip: '33700' },
  { city: 'Biratnagar', state: 'Koshi Province', zip: '56613' },
  { city: 'Butwal', state: 'Lumbini Province', zip: '32907' },
  { city: 'Dhangadhi', state: 'Sudurpashchim Province', zip: '10900' },
];

const NEPALI_FIRST_NAMES = [
  'Aarav', 'Bibek', 'Deepak', 'Ganesh', 'Kiran', 'Manish', 'Prakash', 'Rajesh',
  'Sagar', 'Santosh', 'Anita', 'Binita', 'Gita', 'Kamala', 'Laxmi', 'Maya',
  'Puja', 'Radha', 'Sabina', 'Sunita',
];

const NEPALI_LAST_NAMES = [
  'Adhikari', 'Bhattarai', 'Gurung', 'Karki', 'Maharjan', 'Pandey',
  'Poudel', 'Rai', 'Sharma', 'Shrestha', 'Tamang', 'Thapa',
];

const TOLES = ['Thamel', 'Lazimpat', 'New Baneshwor', 'Jawalakhel', 'Bouddha', 'Lakeside', 'Pulchowk'];

function randomPhone(): string {
  const prefixes = ['984', '985', '986', '980', '981'];
  return `+977-${prefixes[Math.floor(Math.random() * prefixes.length)]}-${faker.string.numeric(7)}`;
}

function randomLoc() {
  return NEPAL_LOCATIONS[Math.floor(Math.random() * NEPAL_LOCATIONS.length)];
}

async function main() {
  console.log('🇳🇵 Starting simple Nepal database seeding...');

  // Clean existing data
  console.log('🧹 Cleaning existing data...');
  await prisma.review.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.user.deleteMany();
  await prisma.category.deleteMany();
  await prisma.cancellationPolicy.deleteMany();
  console.log('✓ Cleaned existing data');

  // Cancellation policies
  console.log('\n📋 Creating cancellation policies...');
  const policies = await Promise.all([
    prisma.cancellationPolicy.create({ data: { name: 'Flexible', description: 'Free cancellation up to 24 hours before', type: 'flexible', fullRefundHours: 24, partialRefundHours: 48, partialRefundPercent: 1.0, noRefundHours: 0 } }),
    prisma.cancellationPolicy.create({ data: { name: 'Moderate', description: 'Free cancellation up to 7 days before', type: 'moderate', fullRefundHours: 168, partialRefundHours: 336, partialRefundPercent: 0.5, noRefundHours: 24 } }),
    prisma.cancellationPolicy.create({ data: { name: 'Strict', description: 'No refunds unless property is unavailable', type: 'strict', fullRefundHours: 0, partialRefundHours: 0, partialRefundPercent: 0, noRefundHours: 0 } }),
  ]);
  console.log(`✓ Created ${policies.length} cancellation policies`);

  // Categories
  console.log('\n📂 Creating categories...');
  const categories = await Promise.all([
    prisma.category.create({ data: { name: 'Apartment', slug: 'apartment', description: 'Apartments and flats', icon: 'apartment', isActive: true } }),
    prisma.category.create({ data: { name: 'House', slug: 'house', description: 'Entire houses', icon: 'house', isActive: true } }),
    prisma.category.create({ data: { name: 'Car', slug: 'car', description: 'Cars and SUVs for rent', icon: 'car', isActive: true } }),
    prisma.category.create({ data: { name: 'Equipment', slug: 'equipment', description: 'Tools and equipment', icon: 'tools', isActive: true } }),
  ]);
  console.log(`✓ Created ${categories.length} categories`);

  // Users
  console.log('\n👥 Creating users...');
  const hashedPassword = await bcrypt.hash('password123', 10);

  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: 'admin@gharbatai.com', username: 'admin', passwordHash: hashedPassword,
        firstName: 'Hari', lastName: 'Bhattarai', role: 'ADMIN', status: 'ACTIVE',
        emailVerified: true, isActive: true, city: 'Kathmandu', state: 'Bagmati Province', country: 'Nepal',
      },
    }),
    ...Array.from({ length: 20 }, async () => {
      const first = NEPALI_FIRST_NAMES[Math.floor(Math.random() * NEPALI_FIRST_NAMES.length)];
      const last = NEPALI_LAST_NAMES[Math.floor(Math.random() * NEPALI_LAST_NAMES.length)];
      const loc = randomLoc();
      return prisma.user.create({
        data: {
          email: `${first.toLowerCase()}.${last.toLowerCase()}${faker.number.int({ min: 1, max: 999 })}@gmail.com`,
          username: `${first.toLowerCase()}.${last.toLowerCase()}${faker.number.int({ min: 1, max: 999 })}`,
          passwordHash: hashedPassword,
          firstName: first, lastName: last, phone: randomPhone(),
          profilePhotoUrl: faker.image.avatar(), bio: faker.lorem.sentence(),
          role: 'USER', status: 'ACTIVE', emailVerified: true, isActive: true,
          averageRating: faker.number.float({ min: 3, max: 5, fractionDigits: 1 }),
          totalReviews: faker.number.int({ min: 0, max: 100 }),
          responseRate: faker.number.int({ min: 80, max: 100 }),
          responseTime: '< 2 hours',
          city: loc.city, state: loc.state, country: 'Nepal',
        },
      });
    }),
  ]);
  console.log(`✓ Created ${users.length} users`);

  // Listings
  console.log('\n🏠 Creating listings...');
  const listings = [];
  for (let i = 0; i < 50; i++) {
    const owner = users[faker.number.int({ min: 1, max: users.length - 1 })];
    const category = categories[faker.number.int({ min: 0, max: categories.length - 1 })];
    const policy = policies[faker.number.int({ min: 0, max: policies.length - 1 })];
    const loc = randomLoc();
    const tole = TOLES[Math.floor(Math.random() * TOLES.length)];

    const listing = await prisma.listing.create({
      data: {
        title: faker.helpers.arrayElement([
          `Modern Apartment in ${tole}`, `Spacious Flat in ${loc.city}`,
          `Cozy House near ${tole}`, `Furnished Room – ${loc.city}`,
          `Reliable ${faker.helpers.arrayElement(['Suzuki Alto', 'Hyundai i20', 'Toyota Aqua'])} for Rent`,
          `Professional ${faker.helpers.arrayElement(['DSLR Camera', 'Projector', 'Generator'])} for Rent`,
        ]),
        slug: `${category.name.toLowerCase()}-${i}-${faker.string.alphanumeric(8)}`,
        description: faker.lorem.paragraphs(2),
        address: `Ward ${faker.number.int({ min: 1, max: 35 })}, ${tole}`,
        city: loc.city, state: loc.state, zipCode: loc.zip, country: 'Nepal',
        latitude: faker.location.latitude({ min: 26, max: 30 }),
        longitude: faker.location.longitude({ min: 80, max: 88 }),
        type: 'APARTMENT', status: 'AVAILABLE', verificationStatus: 'VERIFIED',
        condition: 'EXCELLENT', bookingMode: 'INSTANT_BOOK',
        basePrice: faker.number.float({ min: 1000, max: 20000, fractionDigits: 0 }),
        currency: 'NPR',
        securityDeposit: faker.number.float({ min: 2000, max: 20000, fractionDigits: 0 }),
        cleaningFee: faker.number.float({ min: 500, max: 2000, fractionDigits: 0 }),
        amenities: ['WiFi', 'Kitchen', 'Parking', 'Hot Water'],
        features: ['Furnished', 'Mountain View'],
        photos: Array.from({ length: faker.number.int({ min: 3, max: 8 }) }, () =>
          `https://picsum.photos/seed/${faker.string.alphanumeric(10)}/800/600.jpg`,
        ),
        rules: ['No smoking', 'Shoes off inside', 'Quiet hours after 10 PM'],
        ownerId: owner.id, categoryId: category.id, cancellationPolicyId: policy.id,
      },
    });
    listings.push(listing);
  }
  console.log(`✓ Created ${listings.length} listings`);

  // Bookings
  console.log('\n📅 Creating bookings...');
  const bookings = [];
  for (let i = 0; i < 100; i++) {
    const listing = listings[faker.number.int({ min: 0, max: listings.length - 1 })];
    const renter = users[faker.number.int({ min: 1, max: users.length - 1 })];
    if (listing.ownerId === renter.id) continue;

    const startDate = faker.date.future({ years: 0.5 });
    const endDate = new Date(startDate.getTime() + faker.number.int({ min: 1, max: 7 }) * 24 * 60 * 60 * 1000);
    const totalPrice = Number(listing.basePrice) * Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    try {
      const booking = await prisma.booking.create({
        data: {
          listingId: listing.id, ownerId: listing.ownerId, renterId: renter.id,
          startDate, endDate,
          basePrice: Number(listing.basePrice), totalPrice, currency: 'NPR',
          status: faker.helpers.arrayElement(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']),
          createdAt: faker.date.past(),
        },
      });
      bookings.push(booking);
    } catch { /* skip duplicates */ }
  }
  console.log(`✓ Created ${bookings.length} bookings`);

  // Reviews
  console.log('\n⭐ Creating reviews...');
  const reviews = [];
  for (let i = 0; i < 150; i++) {
    const booking = bookings[faker.number.int({ min: 0, max: bookings.length - 1 })];
    const listing = listings.find((l) => l.id === booking.listingId);
    if (!listing || booking.status !== 'COMPLETED') continue;

    try {
      const review = await prisma.review.create({
        data: {
          bookingId: booking.id, listingId: listing.id,
          reviewerId: booking.renterId, revieweeId: listing.ownerId,
          rating: faker.number.int({ min: 1, max: 5 }),
          content: faker.helpers.arrayElement([
            'Great experience!', 'Very clean and well-maintained.',
            'राम्रो अनुभव!', 'हिमालको दृश्य मन पर्यो।',
            faker.lorem.paragraphs(1),
          ]),
          type: 'LISTING_REVIEW', createdAt: faker.date.past(),
        },
      });
      reviews.push(review);
    } catch { /* skip duplicates */ }
  }
  console.log(`✓ Created ${reviews.length} reviews`);

  // Summary
  console.log('\n🇳🇵 Nepal simple seeding completed!');
  console.log('========================================');
  console.log(`  Users: ${users.length} (Nepali names)`);
  console.log(`  Categories: ${categories.length}`);
  console.log(`  Policies: ${policies.length}`);
  console.log(`  Listings: ${listings.length} (Nepal, NPR)`);
  console.log(`  Bookings: ${bookings.length} (NPR)`);
  console.log(`  Reviews: ${reviews.length}`);
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
