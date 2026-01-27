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
} from '../src/generated/client';
import * as bcrypt from 'bcrypt';

// Load environment variables from the root .env file
dotenv.config({ path: '../../.env' });

const prisma = new PrismaClient();

// Fake data generators
const firstNames = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson'];
const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose'];
const states = ['NY', 'CA', 'IL', 'TX', 'AZ', 'PA', 'TX', 'CA', 'TX', 'CA'];
const streets = ['Main St', 'Oak Ave', 'Pine Rd', 'Elm Dr', 'Maple Ln', 'Cedar Ct', 'Park Blvd', 'Washington Ave', 'Lincoln Way', 'Broadway'];
const listingTitles = [
  'Professional DSLR Camera Kit', 'Heavy-Duty Power Drill Set', 'Luxury Camping Tent Package', 'Event Sound System', 'Video Production Lighting', 'Carpentry Tools Bundle', 'Outdoor Adventure Gear', 'Photography Studio Setup', 'Party Decoration Kit', 'Home Improvement Tools', 'Mountain Bike Pro', 'Kitchen Appliance Set', 'Gardening Tools Collection', 'Music Equipment Bundle', 'Fitness Equipment Pack',
];
const listingDescriptions = [
  'Perfect for professionals and enthusiasts alike. Well-maintained equipment with all necessary accessories included.',
  'High-quality gear suitable for both beginners and experienced users. Clean, tested, and ready to use.',
  'Premium equipment with excellent condition. Includes carrying case and all essential accessories.',
  'Reliable and well-maintained gear. Ideal for short-term projects or events.',
  'Top-of-the-line equipment with regular maintenance. Comes with user manual and support.',
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

function randomEmail(firstName: string, lastName: string, domain = 'example.com') {
  const providers = ['gmail', 'yahoo', 'hotmail', 'outlook', 'example'];
  const provider = randomChoice(providers);
  const num = Math.floor(Math.random() * 999);
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}${num}@${provider}.com`;
}

function randomPhone() {
  return `+1${randomInt(200, 999)}${randomInt(200, 999)}${randomInt(1000, 9999)}`;
}

function randomAddress() {
  const number = randomInt(100, 9999);
  const street = randomChoice(streets);
  const city = randomChoice(cities);
  const state = randomChoice(states);
  const zip = randomInt(10000, 99999);
  return `${number} ${street}, ${city}, ${state} ${zip}`;
}

async function generateBulkUsers(count: number) {
  console.log(`👥 Generating ${count} users...`);
  const users = [];
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create a few admins
  for (let i = 0; i < 3; i++) {
    const firstName = randomChoice(firstNames);
    const lastName = randomChoice(lastNames);
    users.push({
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
    });
  }

  // Create owners
  for (let i = 0; i < Math.floor(count * 0.2); i++) {
    const firstName = randomChoice(firstNames);
    const lastName = randomChoice(lastNames);
    users.push({
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
    });
  }

  // Create customers
  for (let i = 0; i < Math.floor(count * 0.75); i++) {
    const firstName = randomChoice(firstNames);
    const lastName = randomChoice(lastNames);
    users.push({
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
    });
  }

  return await prisma.user.createMany({ data: users });
}

async function generateOrganizations(count: number) {
  console.log(`🏢 Generating ${count} organizations...`);
  const orgs = [];
  for (let i = 0; i < count; i++) {
    orgs.push({
      name: `${randomChoice(firstNames)} ${randomChoice(lastNames)} ${randomChoice(['Enterprises', 'Group', 'Company', 'LLC', 'Inc'])}`,
      slug: `org-${i + 1}-${Math.random().toString(36).substring(2, 8)}`,
      description: 'Professional equipment rental and leasing services',
      website: `https://www.example${i + 1}.com`,
      phone: randomPhone(),
      email: `contact@org${i + 1}.example.com`,
      addressLine1: randomAddress(),
      city: randomChoice(cities),
      state: randomChoice(states),
      country: 'USA',
      postalCode: randomInt(10000, 99999).toString(),
      taxId: `TX-${randomInt(100000000, 999999999)}`,
      verificationStatus: VerificationStatus.VERIFIED,
      stripeConnectId: `acct_test_${Math.random().toString(36).substring(2, 15)}`,
    });
  }
  return await prisma.organization.createMany({ data: orgs });
}

async function generateListings(count: number, users: any[], categories: any[]) {
  console.log(`📦 Generating ${count} listings...`);
  const listings = [];
  const owners = users.filter(u => u.role === UserRole.OWNER);

  for (let i = 0; i < count; i++) {
    const owner = randomChoice(owners);
    const category = randomChoice(categories);
    const title = randomChoice(listingTitles);
    listings.push({
      title,
      slug: `${title.toLowerCase().replace(/\s+/g, '-')}-${i + 1}`,
      description: randomChoice(listingDescriptions),
      ownerId: owner.id,
      categoryId: category.id,
      basePrice: randomFloat(25, 500) * 100, // in cents
      categorySpecificData: {
        pricePerDay: randomFloat(25, 500) * 100,
        pricePerWeek: randomFloat(150, 3000) * 100,
        pricePerMonth: randomFloat(500, 8000) * 100,
        securityDeposit: randomFloat(100, 1000) * 100,
      },
      location: randomAddress(),
      city: randomChoice(cities),
      state: randomChoice(states),
      country: 'USA',
      postalCode: randomInt(10000, 99999).toString(),
      latitude: randomFloat(25.0, 48.0),
      longitude: randomFloat(-125.0, -66.0),
      images: [
        `https://images.unsplash.com/photo-${randomInt(1000000000, 9999999999)}?w=800&h=600&fit=crop`,
        `https://images.unsplash.com/photo-${randomInt(1000000000, 9999999999)}?w=800&h=600&fit=crop`,
        `https://images.unsplash.com/photo-${randomInt(1000000000, 9999999999)}?w=800&h=600&fit=crop`,
      ],
      status: randomChoice([ListingStatus.ACTIVE, ListingStatus.ACTIVE, ListingStatus.ACTIVE, ListingStatus.PENDING_REVIEW]),
      verificationStatus: VerificationStatus.VERIFIED,
      insuranceRequirement: {
        minimumCoverage: randomFloat(1000, 5000) * 100, // in cents
        policyTypes: ['LIABILITY', 'PROPERTY_DAMAGE'],
      },
      rentalTerms: 'Equipment must be returned in the same condition. Late fees apply.',
      cancellationPolicy: 'Full refund if canceled 48 hours before rental period.',
      tags: [randomChoice(['professional', 'heavy-duty', 'portable', 'commercial', 'residential'])],
      specifications: {
        weight: randomFloat(1, 100),
        dimensions: `${randomInt(1, 10)}x${randomInt(1, 10)}x${randomInt(1, 10)}`,
        brand: randomChoice(['DeWalt', 'Canon', 'Sony', 'Milwaukee', 'Nikon', 'Bosch']),
        model: `Model ${randomInt(100, 999)}`,
      },
    });
  }
  return await prisma.listing.createMany({ data: listings });
}

async function generateBookings(count: number, users: any[], listings: any[]) {
  console.log(`📅 Generating ${count} bookings...`);
  const bookings = [];
  const customers = users.filter(u => u.role === UserRole.CUSTOMER);

  for (let i = 0; i < count; i++) {
    const customer = randomChoice(customers);
    const listing = randomChoice(listings);
    const startDate = randomDate(new Date(2024, 0, 1), new Date(2024, 11, 31));
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + randomInt(1, 14));
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const basePrice = listing.basePrice || 25000; // fallback to $250 if basePrice missing
    const totalPrice = basePrice * days;

    bookings.push({
      listingId: listing.id,
      renterId: customer.id,
      startDate,
      endDate,
      duration: days,
      basePrice,
      serviceFee: Math.floor(totalPrice * 0.1),
      tax: Math.floor(totalPrice * 0.08),
      totalPrice,
      securityDeposit: Math.floor(basePrice * 0.2),
      status: randomChoice([BookingStatus.PENDING_OWNER_APPROVAL, BookingStatus.CONFIRMED, BookingStatus.CONFIRMED, BookingStatus.COMPLETED]),
      paymentStatus: randomChoice([PaymentStatus.PENDING, PaymentStatus.SUCCEEDED, PaymentStatus.SUCCEEDED, PaymentStatus.REFUNDED]),
      specialRequests: Math.random() > 0.7 ? 'Please deliver by 9 AM' : null,
      rentalAgreementAccepted: true,
      insuranceOptIn: Math.random() > 0.5,
      notes: Math.random() > 0.8 ? 'Handle with care' : null,
    });
  }
  return await prisma.booking.createMany({ data: bookings });
}

async function generatePayments(count: number, bookings: any[]) {
  console.log(`💳 Generating ${count} payments...`);
  const payments = [];

  for (let i = 0; i < count; i++) {
    const booking = randomChoice(bookings);
    payments.push({
      bookingId: booking.id,
      amount: booking.totalPrice,
      currency: 'USD',
      status: randomChoice([PaymentStatus.SUCCEEDED, PaymentStatus.SUCCEEDED, PaymentStatus.PENDING, PaymentStatus.FAILED]),
      paymentMethod: randomChoice(['STRIPE', 'PAYPAL', 'BANK_TRANSFER']),
      transactionId: `txn_${Math.random().toString(36).substring(2, 15)}`,
      stripePaymentIntentId: `pi_${Math.random().toString(36).substring(2, 15)}`,
      processedAt: randomDate(new Date(2024, 0, 1), new Date()),
      failureReason: Math.random() > 0.9 ? 'Insufficient funds' : null,
    });
  }
  return await prisma.payment.createMany({ data: payments });
}

async function generateReviews(count: number, bookings: any[], users: any[]) {
  console.log(`⭐ Generating ${count} reviews...`);
  const reviews = [];

  for (let i = 0; i < count; i++) {
    const booking = randomChoice(bookings);
    const reviewer = users.find(u => u.id === booking.renterId || u.id === booking.ownerId);
    const reviewee = users.find(u => u.id === (reviewer?.id === booking.renterId ? booking.ownerId : booking.renterId));

    if (reviewer && reviewee) {
      reviews.push({
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
        type: reviewer.id === booking.renterId ? ReviewType.LISTING_REVIEW : ReviewType.OWNER_REVIEW,
        helpfulVotes: randomInt(0, 20),
      });
    }
  }
  return await prisma.review.createMany({ data: reviews });
}

async function generateMessages(count: number, users: any[]) {
  console.log(`💬 Generating ${count} messages...`);
  const messages = [];

  // Create conversations and messages
  for (let i = 0; i < Math.floor(count / 3); i++) {
    const participant1 = randomChoice(users);
    const participant2 = randomChoice(users.filter(u => u.id !== participant1.id);
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

    // Add messages to this conversation
    for (let j = 0; j < randomInt(1, 5); j++) {
      messages.push({
        conversationId: conversation.id,
        senderId: j % 2 === 0 ? participant1.id : participant2.id,
        content: randomChoice([
          'Is this item still available?',
          'Can I rent it for the weekend?',
          'What are the pickup hours?',
          'Is delivery available?',
          'Thanks for the quick response!',
        ]),
        isRead: Math.random() > 0.3,
      });
    }
  }
  return await prisma.message.createMany({ data: messages });
}

async function generateFavorites(count: number, users: any[], listings: any[]) {
  console.log(`❤️ Generating ${count} favorites...`);
  const favorites = [];
  const customers = users.filter(u => u.role === UserRole.CUSTOMER);

  for (let i = 0; i < count; i++) {
    const customer = randomChoice(customers);
    const listing = randomChoice(listings);
    favorites.push({
      userId: customer.id,
      listingId: listing.id,
    });
  }
  return await prisma.favoriteListing.createMany({ data: favorites });
}

async function generateInsurancePolicies(count: number, users: any[], listings: any[]) {
  console.log(`🛡️ Generating ${count} insurance policies...`);
  const policies = [];

  for (let i = 0; i < count; i++) {
    const user = randomChoice(users);
    const listing = randomChoice(listings);
    policies.push({
      userId: user.id,
      listingId: listing.id,
      policyNumber: `POL-${randomInt(100000, 999999)}`,
      provider: randomChoice(['State Farm', 'Allstate', 'Geico', 'Progressive', 'Nationwide']),
      type: randomChoice(['LIABILITY', 'COMPREHENSIVE', 'COLLISION', 'DAMAGE']),
      coverageAmount: randomFloat(1000, 10000) * 100, // in cents
      effectiveDate: randomDate(new Date(2024, 0, 1), new Date()),
      expirationDate: randomDate(new Date(2024, 6, 1), new Date(2025, 11, 31)),
      documentUrl: `https://example.com/policy/${Math.random().toString(36).substring(2, 15)}.pdf`,
      status: randomChoice([InsuranceStatus.PENDING, InsuranceStatus.VERIFIED, InsuranceStatus.EXPIRED]),
      verificationDate: Math.random() > 0.5 ? randomDate(new Date(2024, 0, 1), new Date()) : null,
      verifiedBy: Math.random() > 0.5 ? randomChoice(users.filter(u => u.role === UserRole.ADMIN)).id : null,
      notes: Math.random() > 0.7 ? 'Policy verified successfully' : null,
    });
  }
  return await prisma.insurancePolicy.createMany({ data: policies });
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

  // Create base data
  const categories = await prisma.category.createMany({
    data: [
      { name: 'Tools & Equipment', slug: 'tools-equipment', description: 'Power tools, hand tools, and equipment', iconUrl: 'hammer', active: true, templateSchema: {}, searchableFields: [], requiredFields: [] },
      { name: 'Camera & Photography', slug: 'camera-photography', description: 'Professional cameras, lenses, lighting', iconUrl: 'camera', active: true, templateSchema: {}, searchableFields: [], requiredFields: [] },
      { name: 'Outdoor & Camping', slug: 'outdoor-camping', description: 'Tents, camping gear, hiking equipment', iconUrl: 'mountain', active: true, templateSchema: {}, searchableFields: [], requiredFields: [] },
      { name: 'Party & Events', slug: 'party-events', description: 'Tables, chairs, decorations', iconUrl: 'party-popper', active: true, templateSchema: {}, searchableFields: [], requiredFields: [] },
      { name: 'Electronics', slug: 'electronics', description: 'Audio/video equipment and electronics', iconUrl: 'laptop', active: true, templateSchema: {}, searchableFields: [], requiredFields: [] },
    ],
  });

  // Generate bulk data
  const users = await generateBulkUsers(150);
  const organizations = await generateOrganizations(25);
  const listings = await generateListings(200, users, await prisma.category.findMany());
  const bookings = await generateBookings(300, users, listings);
  const payments = await generatePayments(250, bookings);
  const reviews = await generateReviews(400, bookings, users);
  const messages = await generateMessages(300, users);
  const favorites = await generateFavorites(180, users, listings);
  const insurancePolicies = await generateInsurancePolicies(120, users, listings);

  // Create admin session for auto-login
  const adminUser = await prisma.user.findFirst({ where: { role: UserRole.ADMIN } });
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
  console.log(`   - Users: ${users.count}`);
  console.log(`   - Organizations: ${organizations.count}`);
  console.log(`   - Categories: 5`);
  console.log(`   - Listings: ${listings.count}`);
  console.log(`   - Bookings: ${bookings.count}`);
  console.log(`   - Payments: ${payments.count}`);
  console.log(`   - Reviews: ${reviews.count}`);
  console.log(`   - Messages: ${messages.count}`);
  console.log(`   - Favorites: ${favorites.count}`);
  console.log(`   - Insurance Policies: ${insurancePolicies.count}`);
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
