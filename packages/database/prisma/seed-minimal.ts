import * as dotenv from 'dotenv';
import {
  PrismaClient,
  UserRole,
  UserStatus,
  VerificationStatus,
  BookingStatus,
  ListingStatus,
  PaymentStatus,
  InsuranceStatus,
  ReviewType,
  ReviewStatus,
  OrganizationStatus,
  MessageType,
  MessageStatus,
} from '../src/generated/client';
import * as bcrypt from 'bcrypt';

dotenv.config({ path: '../../.env' });

const prisma = new PrismaClient();

const firstNames = [
  'James',
  'Mary',
  'John',
  'Patricia',
  'Robert',
  'Jennifer',
  'Michael',
  'Linda',
  'William',
  'Elizabeth',
];
const lastNames = [
  'Smith',
  'Johnson',
  'Williams',
  'Brown',
  'Jones',
  'Garcia',
  'Miller',
  'Davis',
  'Rodriguez',
  'Martinez',
];
const cities = [
  'New York',
  'Los Angeles',
  'Chicago',
  'Houston',
  'Phoenix',
  'Philadelphia',
  'San Antonio',
  'San Diego',
  'Dallas',
  'San Jose',
];
const states = ['NY', 'CA', 'IL', 'TX', 'AZ', 'PA', 'TX', 'CA', 'TX', 'CA'];
const listingTitles = [
  'Professional DSLR Camera Kit',
  'Heavy-Duty Power Drill Set',
  'Luxury Camping Tent Package',
  'Event Sound System',
  'Video Production Lighting',
];

function randomChoice(arr: string[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals = 2) {
  return Number((Math.random() * (max - min) + min).toFixed(decimals));
}

function randomDate(start: Date, end: Date) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function randomEmail(firstName: string, lastName: string) {
  const providers = ['gmail', 'yahoo', 'hotmail', 'outlook', 'example'];
  const provider = randomChoice(providers);
  const num = Math.floor(Math.random() * 999);
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}${num}@${provider}.com`;
}

function randomPhone() {
  return `+1${randomInt(200, 999)}${randomInt(200, 999)}${randomInt(1000, 9999)}`;
}

function randomAddress() {
  const streets = ['Main St', 'Oak Ave', 'Pine Rd', 'Elm Dr', 'Maple Ln'];
  const number = randomInt(100, 9999);
  const street = randomChoice(streets);
  const city = randomChoice(cities);
  const state = randomChoice(states);
  const zip = randomInt(10000, 99999);
  return `${number} ${street}, ${city}, ${state} ${zip}`;
}

async function main() {
  console.log('🌱 Starting bulk database seed...');

  // Clear existing data
  console.log('🗑️  Cleaning up existing data...');
  await prisma.message.deleteMany();
  await prisma.conversationParticipant.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.favoriteListing.deleteMany();
  await prisma.insurancePolicy.deleteMany();
  await prisma.review.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.availability.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.category.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create Categories (small reference table)
  console.log('📁 Creating categories...');
  const categories = await Promise.all([
    prisma.category.create({
      data: {
        name: 'Tools & Equipment',
        slug: 'tools-equipment',
        description: 'Power tools, hand tools, and equipment',
        iconUrl: 'hammer',
        active: true,
        templateSchema: {},
        searchableFields: [],
        requiredFields: [],
      },
    }),
    prisma.category.create({
      data: {
        name: 'Camera & Photography',
        slug: 'camera-photography',
        description: 'Professional cameras, lenses, lighting',
        iconUrl: 'camera',
        active: true,
        templateSchema: {},
        searchableFields: [],
        requiredFields: [],
      },
    }),
    prisma.category.create({
      data: {
        name: 'Outdoor & Camping',
        slug: 'outdoor-camping',
        description: 'Tents, camping gear, hiking equipment',
        iconUrl: 'mountain',
        active: true,
        templateSchema: {},
        searchableFields: [],
        requiredFields: [],
      },
    }),
    prisma.category.create({
      data: {
        name: 'Party & Events',
        slug: 'party-events',
        description: 'Tables, chairs, decorations',
        iconUrl: 'party-popper',
        active: true,
        templateSchema: {},
        searchableFields: [],
        requiredFields: [],
      },
    }),
    prisma.category.create({
      data: {
        name: 'Electronics',
        slug: 'electronics',
        description: 'Audio/video equipment and electronics',
        iconUrl: 'laptop',
        active: true,
        templateSchema: {},
        searchableFields: [],
        requiredFields: [],
      },
    }),
  ]);

  // Create Users (150+ records)
  console.log('👥 Creating users...');
  const users: any[] = [];

  // Admins
  for (let i = 0; i < 3; i++) {
    const firstName = randomChoice(firstNames);
    const lastName = randomChoice(lastNames);
    const user = await prisma.user.create({
      data: {
        email: `admin${i + 1}@rental.local`,
        passwordHash: hashedPassword,
        firstName,
        lastName,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        emailVerified: true,
        phoneVerified: Math.random() > 0.5,
        phoneNumber: randomPhone(),
        addressLine1: randomAddress(),
        city: randomChoice(cities),
        state: randomChoice(states),
        country: 'USA',
        averageRating: randomFloat(4.0, 5.0),
        totalReviews: randomInt(0, 50),
        stripeCustomerId: `cus_test_${Math.random().toString(36).substring(2, 15)}`,
      },
    });
    users.push(user);
  }

  // Owners (30+)
  for (let i = 0; i < 30; i++) {
    const firstName = randomChoice(firstNames);
    const lastName = randomChoice(lastNames);
    const user = await prisma.user.create({
      data: {
        email: randomEmail(firstName, lastName),
        passwordHash: hashedPassword,
        firstName,
        lastName,
        role: UserRole.OWNER,
        status: UserStatus.ACTIVE,
        emailVerified: true,
        phoneVerified: Math.random() > 0.3,
        phoneNumber: randomPhone(),
        addressLine1: randomAddress(),
        city: randomChoice(cities),
        state: randomChoice(states),
        country: 'USA',
        averageRating: randomFloat(3.5, 5.0),
        totalReviews: randomInt(0, 100),
        stripeCustomerId: `cus_test_${Math.random().toString(36).substring(2, 15)}`,
        stripeConnectId: `acct_test_${Math.random().toString(36).substring(2, 15)}`,
      },
    });
    users.push(user);
  }

  // Customers (117+)
  for (let i = 0; i < 117; i++) {
    const firstName = randomChoice(firstNames);
    const lastName = randomChoice(lastNames);
    const user = await prisma.user.create({
      data: {
        email: randomEmail(firstName, lastName),
        passwordHash: hashedPassword,
        firstName,
        lastName,
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
        emailVerified: Math.random() > 0.2,
        phoneVerified: Math.random() > 0.6,
        phoneNumber: randomPhone(),
        addressLine1: randomAddress(),
        city: randomChoice(cities),
        state: randomChoice(states),
        country: 'USA',
        averageRating: randomFloat(3.0, 5.0),
        totalReviews: randomInt(0, 30),
        stripeCustomerId: `cus_test_${Math.random().toString(36).substring(2, 15)}`,
      },
    });
    users.push(user);
  }

  // Create Organizations (25+)
  console.log('🏢 Creating organizations...');
  for (let i = 0; i < 25; i++) {
    await prisma.organization.create({
      data: {
        name: `${randomChoice(firstNames)} ${randomChoice(lastNames)} ${randomChoice(['Enterprises', 'Group', 'Company', 'LLC', 'Inc'])}`,
        slug: `org-${i + 1}-${Math.random().toString(36).substring(2, 8)}`,
        description: 'Professional equipment rental and leasing services',
        email: `contact@org${i + 1}.example.com`,
        addressLine1: randomAddress(),
        city: randomChoice(cities),
        state: randomChoice(states),
        country: 'USA',
        postalCode: randomInt(10000, 99999).toString(),
        taxId: `TX-${randomInt(100000000, 999999999)}`,
        status: OrganizationStatus.ACTIVE,
        stripeConnectId: `acct_test_${Math.random().toString(36).substring(2, 15)}`,
      },
    });
  }

  // Create Listings (200+)
  console.log('📦 Creating listings...');
  const listings: any[] = [];
  const owners = users.filter((u: any) => u.role === UserRole.OWNER);

  for (let i = 0; i < 200; i++) {
    const owner = randomChoice(owners);
    const category = randomChoice(categories);
    const title = randomChoice(listingTitles);
    const basePrice = randomFloat(25, 500) * 100; // in cents

    const listing = await prisma.listing.create({
      data: {
        title,
        slug: `${title.toLowerCase().replace(/\s+/g, '-')}-${i + 1}`,
        description:
          'Perfect for professionals and enthusiasts alike. Well-maintained equipment with all necessary accessories included.',
        ownerId: owner.id,
        categoryId: category.id,
        basePrice: basePrice / 100, // Convert from cents to dollars
        categorySpecificData: {
          pricePerDay: basePrice / 100,
          pricePerWeek: (basePrice * 6) / 100,
          pricePerMonth: (basePrice * 20) / 100,
          securityDeposit: (basePrice * 0.2) / 100,
        },
        addressLine1: randomAddress(),
        city: randomChoice(cities),
        state: randomChoice(states),
        country: 'USA',
        postalCode: randomInt(10000, 99999).toString(),
        latitude: randomFloat(25.0, 48.0),
        longitude: randomFloat(-125.0, -66.0),
        photos: [
          {
            url: `https://images.unsplash.com/photo-${randomInt(1000000000, 9999999999)}?w=800&h=600&fit=crop`,
            order: 0,
          },
          {
            url: `https://images.unsplash.com/photo-${randomInt(1000000000, 9999999999)}?w=800&h=600&fit=crop`,
            order: 1,
          },
        ],
        status: ListingStatus.ACTIVE,
        verificationStatus: VerificationStatus.VERIFIED,
        rules: [
          randomChoice(['professional', 'heavy-duty', 'portable', 'commercial', 'residential']),
        ],
        features: [
          randomChoice(['DeWalt', 'Canon', 'Sony', 'Milwaukee', 'Nikon', 'Bosch']),
          `Model ${randomInt(100, 999)}`,
        ],
      },
    });
    listings.push(listing);
  }

  // Create Bookings (300+)
  console.log('📅 Creating bookings...');
  const bookings: any[] = [];
  const customers = users.filter((u: any) => u.role === UserRole.CUSTOMER);

  for (let i = 0; i < 300; i++) {
    const customer = randomChoice(customers);
    const listing = randomChoice(listings);
    const startDate = randomDate(new Date(2024, 0, 1), new Date(2024, 11, 31));
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + randomInt(1, 14));
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const basePrice = listing.basePrice || 25000;
    const totalPrice = basePrice * days;

    const booking = await prisma.booking.create({
      data: {
        listingId: listing.id,
        renterId: customer.id,
        ownerId: listing.ownerId,
        startDate,
        endDate,
        duration: days * 24, // Convert days to hours
        basePrice: basePrice / 100, // Convert from cents to dollars
        serviceFee: (totalPrice * 0.1) / 100,
        tax: (totalPrice * 0.08) / 100,
        depositAmount: (basePrice * 0.2) / 100,
        totalPrice: totalPrice / 100,
        totalAmount: totalPrice / 100,
        ownerEarnings: (totalPrice * 0.82) / 100,
        platformFee: (totalPrice * 0.1) / 100,
        status: BookingStatus.CONFIRMED,
        renterMessage: Math.random() > 0.7 ? 'Please deliver by 9 AM' : null,
        renterNotes: Math.random() > 0.8 ? 'Handle with care' : null,
      },
    });
    bookings.push(booking);
  }

  // Create Payments (250+)
  console.log('💳 Creating payments...');
  for (let i = 0; i < 250; i++) {
    const booking = randomChoice(bookings);
    await prisma.payment.create({
      data: {
        bookingId: booking.id,
        amount: booking.totalAmount,
        currency: 'USD',
        status: PaymentStatus.SUCCEEDED,
        stripePaymentIntentId: `pi_${Math.random().toString(36).substring(2, 15)}`,
        processedAt: randomDate(new Date(2024, 0, 1), new Date()),
      },
    });
  }

  // Create Reviews (400+)
  console.log('⭐ Creating reviews...');
  const reviewTracker = new Set(); // Track (bookingId, reviewerId, type) combinations
  for (let i = 0; i < 400; i++) {
    const booking = randomChoice(bookings);
    const reviewer = users.find((u: any) => u.id === booking.renterId || u.id === booking.ownerId);
    const reviewee = users.find(
      (u: any) => u.id === (reviewer?.id === booking.renterId ? booking.ownerId : booking.renterId),
    );

    if (reviewer && reviewee) {
      const reviewType =
        reviewer.id === booking.renterId ? ReviewType.LISTING_REVIEW : ReviewType.OWNER_REVIEW;
      const reviewKey = `${booking.id}-${reviewer.id}-${reviewType}`;

      // Skip if this review combination already exists
      if (reviewTracker.has(reviewKey)) {
        continue;
      }

      reviewTracker.add(reviewKey);

      await prisma.review.create({
        data: {
          bookingId: booking.id,
          listingId: booking.listingId,
          reviewerId: reviewer.id,
          revieweeId: reviewee.id,
          overallRating: randomInt(3, 5),
          communicationRating: randomInt(3, 5),
          cleanlinessRating: randomInt(3, 5),
          accuracyRating: randomInt(3, 5),
          valueRating: randomInt(3, 5),
          content: randomChoice([
            'Great experience! Equipment was exactly as described.',
            'Excellent service, highly recommend.',
            'Good value for money, would rent again.',
            'Professional and reliable.',
            'Equipment was in perfect condition.',
          ]),
          type: reviewType,
          status: ReviewStatus.PUBLISHED,
        },
      });
    }
  }

  // ... (rest of the code remains the same)
  console.log('💬 Creating messages...');
  for (let i = 0; i < 100; i++) {
    const participant1 = randomChoice(users);
    const participant2 = randomChoice(users.filter((u: any) => u.id !== participant1.id));

    const conversation = await prisma.conversation.create({
      data: {
        listingId: null,
        bookingId: null,
      },
    });

    await prisma.conversationParticipant.createMany({
      data: [
        { userId: participant1.id, conversationId: conversation.id },
        { userId: participant2.id, conversationId: conversation.id },
      ],
    });

    // Add 3 messages per conversation
    for (let j = 0; j < 3; j++) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: j % 2 === 0 ? participant1.id : participant2.id,
          content: randomChoice([
            'Is this item still available?',
            'Can I rent it for the weekend?',
            'What are the pickup hours?',
            'Is delivery available?',
            'Thanks for the quick response!',
          ]),
          type: MessageType.TEXT,
          status: MessageStatus.SENT,
        },
      });
    }
  }

  // Create Favorites (180+)
  console.log('❤️ Creating favorites...');
  const favoriteTracker = new Set(); // Track (userId, listingId) combinations

  for (let i = 0; i < 180; i++) {
    const customer = randomChoice(customers);
    const listing = randomChoice(listings);
    const favoriteKey = `${customer.id}-${listing.id}`;

    // Skip if this favorite combination already exists
    if (favoriteTracker.has(favoriteKey)) {
      continue;
    }

    favoriteTracker.add(favoriteKey);

    await prisma.favoriteListing.create({
      data: {
        userId: customer.id,
        listingId: listing.id,
      },
    });
  }

  // Create Insurance Policies (120+)
  console.log('🛡️ Creating insurance policies...');
  for (let i = 0; i < 120; i++) {
    const user = randomChoice(users);
    const listing = randomChoice(listings);
    await prisma.insurancePolicy.create({
      data: {
        userId: user.id,
        listingId: listing.id,
        policyNumber: `POL-${randomInt(100000, 999999)}`,
        provider: randomChoice(['State Farm', 'Allstate', 'Geico', 'Progressive', 'Nationwide']),
        type: randomChoice(['LIABILITY', 'COMPREHENSIVE', 'COLLISION', 'DAMAGE']),
        coverageAmount: randomFloat(1000, 10000) * 100,
        effectiveDate: randomDate(new Date(2024, 0, 1), new Date()),
        expirationDate: randomDate(new Date(2024, 6, 1), new Date(2025, 11, 31)),
        documentUrl: `https://example.com/policy/${Math.random().toString(36).substring(2, 15)}.pdf`,
        status: InsuranceStatus.VERIFIED,
        verificationDate: randomDate(new Date(2024, 0, 1), new Date()),
        verifiedBy: randomChoice(users.filter((u: any) => u.role === UserRole.ADMIN)).id,
        notes: Math.random() > 0.7 ? 'Policy verified successfully' : null,
      },
    });
  }

  // Create admin session for auto-login
  const adminUser = users.find((u: any) => u.role === UserRole.ADMIN);
  if (adminUser) {
    const adminSessionExpiry = new Date();
    adminSessionExpiry.setDate(adminSessionExpiry.getDate() + 7);
    await prisma.session.create({
      data: {
        userId: adminUser.id,
        token: 'dev_admin_token_' + Math.random().toString(36).substring(7),
        refreshToken: 'dev_admin_refresh_' + Math.random().toString(36).substring(7),
        expiresAt: adminSessionExpiry,
        ipAddress: '127.0.0.1',
        userAgent: 'Development Browser',
      },
    });
  }

  console.log('✅ Bulk database seed completed successfully!');
  console.log('\n📊 Database Statistics:');
  console.log(`   - Users: ${users.length}`);
  console.log(`   - Organizations: 25`);
  console.log(`   - Categories: 5`);
  console.log(`   - Listings: ${listings.length}`);
  console.log(`   - Bookings: ${bookings.length}`);
  console.log(`   - Payments: 250`);
  console.log(`   - Reviews: 400`);
  console.log(`   - Messages: 300`);
  console.log(`   - Favorites: 180`);
  console.log(`   - Insurance Policies: 120`);
  console.log('\n🔑 Admin Login:');
  console.log('   Email: admin1@rental.local');
  console.log('   Password: password123');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
