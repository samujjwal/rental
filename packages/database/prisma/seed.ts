import { config } from 'dotenv';
import { PrismaClient, Prisma, BookingStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import { faker } from '@faker-js/faker';

config({ path: '../../.env' });

// ─── Production guard ─────────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  console.error('ERROR: Seed script must not run in production. Aborting.');
  process.exit(1);
}
// ─────────────────────────────────────────────────────────────────────────────

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ─── Nepal Constants ─────────────────────────────────────────────────────────

const NEPAL_LOCATIONS = [
  { city: 'Kathmandu', state: 'Bagmati Province', lat: 27.7172, lng: 85.324, zip: '44600' },
  { city: 'Lalitpur', state: 'Bagmati Province', lat: 27.6588, lng: 85.3247, zip: '44700' },
  { city: 'Bhaktapur', state: 'Bagmati Province', lat: 27.672, lng: 85.4298, zip: '44800' },
  { city: 'Pokhara', state: 'Gandaki Province', lat: 28.2096, lng: 83.9856, zip: '33700' },
  { city: 'Butwal', state: 'Lumbini Province', lat: 27.7006, lng: 83.4483, zip: '32907' },
  { city: 'Biratnagar', state: 'Koshi Province', lat: 26.4525, lng: 87.2718, zip: '56613' },
  { city: 'Dharan', state: 'Koshi Province', lat: 26.8125, lng: 87.2836, zip: '56700' },
  { city: 'Janakpur', state: 'Madhesh Province', lat: 26.7271, lng: 85.9407, zip: '45600' },
  { city: 'Birgunj', state: 'Madhesh Province', lat: 27.0104, lng: 84.8778, zip: '44300' },
  { city: 'Nepalgunj', state: 'Lumbini Province', lat: 28.05, lng: 81.6167, zip: '21900' },
  { city: 'Dhangadhi', state: 'Sudurpashchim Province', lat: 28.6833, lng: 80.6, zip: '10900' },
  { city: 'Surkhet', state: 'Karnali Province', lat: 28.6047, lng: 81.636, zip: '21700' },
];

const NEPAL_TOLES = [
  'Thamel', 'Lazimpat', 'Durbar Marg', 'New Baneshwor', 'Baluwatar', 'Maharajgunj',
  'Bouddha', 'Chabahil', 'Jawalakhel', 'Kupondole', 'Pulchowk', 'Mangalbazar',
  'Sukedhara', 'Basundhara', 'Budhanilkantha', 'Lakeside', 'Bagar', 'Nadipur',
];

const NEPALI_FIRST_NAMES = [
  'Aarav', 'Aayush', 'Bibek', 'Bishal', 'Deepak', 'Dipesh', 'Ganesh', 'Hari',
  'Kiran', 'Krishna', 'Manish', 'Nabin', 'Prakash', 'Rajesh', 'Roshan', 'Sagar',
  'Sandip', 'Santosh', 'Sunil', 'Anita', 'Asha', 'Binita', 'Gita', 'Kamala',
  'Laxmi', 'Maya', 'Nirmala', 'Puja', 'Radha', 'Rashmi', 'Rita', 'Sabina',
  'Sita', 'Sunita', 'Sushma', 'Sarita', 'Usha', 'Yamuna', 'Samjhana', 'Pramod',
];

const NEPALI_LAST_NAMES = [
  'Adhikari', 'Acharya', 'Basnet', 'Bhandari', 'Bhattarai', 'Chaudhary', 'Dahal',
  'Devkota', 'Ghimire', 'Gurung', 'Joshi', 'Karki', 'Koirala', 'Lama', 'Maharjan',
  'Magar', 'Neupane', 'Pandey', 'Poudel', 'Rai', 'Regmi', 'Sapkota', 'Shah',
  'Sharma', 'Shrestha', 'Subedi', 'Tamang', 'Thapa', 'Tiwari', 'Upreti',
];

const AMENITIES = [
  'WiFi', 'Hot Water', 'Kitchen', 'Parking', 'AC', 'Washing Machine', 'TV',
  'Elevator', 'Rooftop Terrace', 'Garden', 'CCTV Security', '24-Hour Water Supply',
  'Backup Power / Inverter', 'Solar Water Heater', 'Mountain View', 'Balcony',
  'Furnished', 'Pet Friendly',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function randomLoc() { return NEPAL_LOCATIONS[Math.floor(Math.random() * NEPAL_LOCATIONS.length)]; }
function randomTole() { return NEPAL_TOLES[Math.floor(Math.random() * NEPAL_TOLES.length)]; }
function randomFirst() { return NEPALI_FIRST_NAMES[Math.floor(Math.random() * NEPALI_FIRST_NAMES.length)]; }
function randomLast() { return NEPALI_LAST_NAMES[Math.floor(Math.random() * NEPALI_LAST_NAMES.length)]; }
function randomNepalPhone(): string {
  const prefixes = ['984', '985', '986', '980', '981', '982', '974', '975', '976'];
  return `+977-${prefixes[Math.floor(Math.random() * prefixes.length)]}-${faker.string.numeric(7)}`;
}

async function main() {
  console.log('🇳🇵 Starting comprehensive Nepal database seeding...');

  // Clean existing data
  console.log('🧹 Cleaning existing data...');

  // Phase 2 tables may not exist yet (no migration); skip gracefully
  const safeDelete = async (fn: () => Promise<any>) => { try { await fn(); } catch (e: any) { if (e?.code !== 'P2021') throw e; } };
  await safeDelete(() => prisma.bookingPriceBreakdown.deleteMany());
  await safeDelete(() => prisma.fxRateSnapshot.deleteMany());
  await safeDelete(() => prisma.availabilitySlot.deleteMany());
  await safeDelete(() => prisma.inventoryUnit.deleteMany());
  await safeDelete(() => prisma.listingAttributeValue.deleteMany());
  await safeDelete(() => prisma.categoryAttributeDefinition.deleteMany());
  await safeDelete(() => prisma.listingVersion.deleteMany());
  await safeDelete(() => prisma.listingContent.deleteMany());

  await prisma.disputeResponse.deleteMany();
  await prisma.disputeTimelineEvent.deleteMany();
  await prisma.disputeEvidence.deleteMany();
  await prisma.disputeResolution.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.messageReadReceipt.deleteMany();
  await prisma.conversationParticipant.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.conditionReport.deleteMany();
  await prisma.insuranceClaim.deleteMany();
  await prisma.insurancePolicy.deleteMany();
  await prisma.bookingStateHistory.deleteMany();
  await prisma.depositHold.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.payout.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.refund.deleteMany();
  await prisma.favoriteListing.deleteMany();
  await prisma.availability.deleteMany();
  await prisma.userPreferences.deleteMany();
  await prisma.deviceToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.review.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.organizationMember.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.category.deleteMany();
  await prisma.cancellationPolicy.deleteMany();
  await prisma.emailTemplate.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
  console.log('✓ Cleaned existing data');

  // ── Cancellation Policies ──────────────────────────────────────────────────

  console.log('\n📋 Creating cancellation policies...');
  const policies = await Promise.all([
    prisma.cancellationPolicy.create({ data: { name: 'Flexible', description: 'Full refund up to 24 hours before check-in', type: 'flexible', fullRefundHours: 24, partialRefundHours: 48, partialRefundPercent: 0.5, noRefundHours: 0 } }),
    prisma.cancellationPolicy.create({ data: { name: 'Moderate', description: 'Full refund up to 5 days before check-in', type: 'moderate', fullRefundHours: 120, partialRefundHours: 168, partialRefundPercent: 0.5, noRefundHours: 24 } }),
    prisma.cancellationPolicy.create({ data: { name: 'Strict', description: 'Full refund up to 14 days before check-in', type: 'strict', fullRefundHours: 336, partialRefundHours: 168, partialRefundPercent: 0.25, noRefundHours: 48 } }),
    prisma.cancellationPolicy.create({ data: { name: 'Super Flexible', description: 'Full refund up to 48 hours before check-in', type: 'super_flexible', fullRefundHours: 48, partialRefundHours: 72, partialRefundPercent: 0.75, noRefundHours: 0 } }),
  ]);
  console.log(`✓ Created ${policies.length} cancellation policies`);

  // ── Categories (Nepal-relevant) ────────────────────────────────────────────

  console.log('📂 Creating comprehensive categories...');
  const categories = await Promise.all([
    prisma.category.create({ data: { name: 'Apartment', slug: 'apartment', description: 'Apartments and flats', icon: 'apartment' } }),
    prisma.category.create({ data: { name: 'House', slug: 'house', description: 'Entire houses', icon: 'house' } }),
    prisma.category.create({ data: { name: 'Villa', slug: 'villa', description: 'Luxury villas and resorts', icon: 'villa' } }),
    prisma.category.create({ data: { name: 'Studio', slug: 'studio', description: 'Studios and single rooms', icon: 'studio' } }),
    prisma.category.create({ data: { name: 'Condo', slug: 'condo', description: 'Condominiums', icon: 'condo' } }),
    prisma.category.create({ data: { name: 'Townhouse', slug: 'townhouse', description: 'Multi-story urban residences', icon: 'townhouse' } }),
    prisma.category.create({ data: { name: 'Cottage', slug: 'cottage', description: 'Charming rural retreats', icon: 'cottage' } }),
    prisma.category.create({ data: { name: 'Cars', slug: 'cars', description: 'Cars and SUVs', icon: 'car' } }),
    prisma.category.create({ data: { name: 'Motorcycles', slug: 'motorcycles', description: 'Bikes and scooters', icon: 'motorcycle' } }),
    prisma.category.create({ data: { name: 'Bicycles', slug: 'bicycles', description: 'Mountain bikes, road bikes', icon: 'bicycle' } }),
    prisma.category.create({ data: { name: 'RVs & Campers', slug: 'rvs-campers', description: 'Campers and trekking vehicles', icon: 'rv' } }),
    prisma.category.create({ data: { name: 'Boats', slug: 'boats', description: 'Rafting, canoeing boats', icon: 'boat' } }),
    prisma.category.create({ data: { name: 'Musical Instruments', slug: 'musical-instruments', description: 'Tabla, madal, guitar, etc.', icon: 'music' } }),
    prisma.category.create({ data: { name: 'Audio Equipment', slug: 'audio-equipment', description: 'Sound systems and audio gear', icon: 'audio' } }),
    prisma.category.create({ data: { name: 'Event Venues', slug: 'event-venues', description: 'Party palaces, banquets', icon: 'venue' } }),
    prisma.category.create({ data: { name: 'Event Equipment', slug: 'event-equipment', description: 'Mandap, decorations, lights', icon: 'equipment' } }),
    prisma.category.create({ data: { name: 'Formal Wear', slug: 'formal-wear', description: 'Formal clothing and accessories', icon: 'formal' } }),
    prisma.category.create({ data: { name: 'Sports Equipment', slug: 'sports-equipment', description: 'Trekking, rafting, sports gear', icon: 'sports' } }),
    prisma.category.create({ data: { name: 'Photography Equipment', slug: 'photography-equipment', description: 'Cameras, drones, lenses', icon: 'camera' } }),
    prisma.category.create({ data: { name: 'Party Supplies', slug: 'party-supplies', description: 'Decorations and supplies', icon: 'party' } }),
  ]);
  console.log(`✓ Created ${categories.length} categories`);

  // ── Email Templates ────────────────────────────────────────────────────────

  console.log('📧 Creating email templates...');
  const emailTemplates = await Promise.all([
    prisma.emailTemplate.create({ data: { name: 'booking_confirmation', subject: 'Booking Confirmation - {{bookingId}}', body: '<h1>Booking confirmed</h1><p>ID: {{bookingId}}</p>', type: 'BOOKING_CONFIRMATION', description: 'Sent on confirmation', variables: ['bookingId', 'listingTitle'], isActive: true, category: 'transactional' } }),
    prisma.emailTemplate.create({ data: { name: 'booking_cancelled', subject: 'Booking Cancelled - {{bookingId}}', body: '<h1>Booking cancelled</h1>', type: 'BOOKING_CANCELLATION', description: 'Sent on cancellation', variables: ['bookingId', 'refundAmount'], isActive: true, category: 'transactional' } }),
    prisma.emailTemplate.create({ data: { name: 'payment_received', subject: 'Payment Received - रु {{amount}}', body: '<h1>Payment received: रु {{amount}}</h1>', type: 'PAYMENT_RECEIPT', description: 'Sent on payment', variables: ['amount', 'currency', 'bookingId'], isActive: true, category: 'transactional' } }),
    prisma.emailTemplate.create({ data: { name: 'review_reminder', subject: 'कृपया आफ्नो अनुभव मूल्याङ्कन गर्नुहोस्', body: '<h1>How was your stay?</h1>', type: 'REVIEW_REMINDER', description: 'Sent to request review', variables: ['listingTitle'], isActive: true, category: 'transactional' } }),
  ]);
  console.log(`✓ Created ${emailTemplates.length} email templates`);

  // ── Users (Nepali names, Nepal locations) ──────────────────────────────────

  console.log('👥 Creating users...');
  const users: any[] = [];
  const hashedPassword = await bcrypt.hash('password123', 10);
  const testPassword = await bcrypt.hash('Test123!@#', 10);

  // E2E test users
  console.log('🧪 Creating E2E test users...');
  const testRenter = await prisma.user.create({
    data: {
      email: 'renter@test.com', username: 'testrenter', passwordHash: testPassword,
      firstName: 'Sagar', lastName: 'Shrestha', phone: '+977-984-1234567',
      role: 'USER', status: 'ACTIVE', isActive: true, emailVerified: true, phoneVerified: true,
      averageRating: 4.5, totalReviews: 12, responseRate: 95, responseTime: '< 2 hours',
      city: 'Kathmandu', state: 'Bagmati Province', country: 'Nepal',
    },
  });
  users.push(testRenter);

  const testOwner = await prisma.user.create({
    data: {
      email: 'owner@test.com', username: 'testowner', passwordHash: testPassword,
      firstName: 'Anita', lastName: 'Sharma', phone: '+977-985-2345678',
      role: 'HOST', status: 'ACTIVE', isActive: true, emailVerified: true, phoneVerified: true,
      averageRating: 4.8, totalReviews: 45, responseRate: 98, responseTime: '< 1 hour',
      city: 'Pokhara', state: 'Gandaki Province', country: 'Nepal',
    },
  });
  users.push(testOwner);

  const testAdmin = await prisma.user.create({
    data: {
      email: 'admin@test.com', username: 'testadmin', passwordHash: testPassword,
      firstName: 'Rajesh', lastName: 'Pandey', phone: '+977-986-3456789',
      role: 'ADMIN', status: 'ACTIVE', isActive: true, emailVerified: true, phoneVerified: true,
      averageRating: 5, totalReviews: 5, responseRate: 100, responseTime: '< 1 hour',
      city: 'Kathmandu', state: 'Bagmati Province', country: 'Nepal',
    },
  });
  users.push(testAdmin);

  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@gharbatai.com', username: 'admin', passwordHash: hashedPassword,
      firstName: 'Hari', lastName: 'Bhattarai', phone: '+977-984-0000001',
      role: 'ADMIN', status: 'ACTIVE', isActive: true, emailVerified: true, phoneVerified: true,
      averageRating: 5, totalReviews: 10, responseRate: 100, responseTime: '< 1 hour',
      city: 'Kathmandu', state: 'Bagmati Province', country: 'Nepal',
    },
  });
  users.push(adminUser);

  const superAdminUser = await prisma.user.create({
    data: {
      email: 'superadmin@gharbatai.com', username: 'superadmin', passwordHash: hashedPassword,
      firstName: 'Prakash', lastName: 'Koirala', phone: '+977-984-0000002',
      role: 'SUPER_ADMIN', status: 'ACTIVE', isActive: true, emailVerified: true, phoneVerified: true,
      averageRating: 5, totalReviews: 0, responseRate: 100, responseTime: '< 1 hour',
      city: 'Kathmandu', state: 'Bagmati Province', country: 'Nepal',
      mfaEnabled: true, mfaSecret: 'JBSWY3DPEHPK3PXP',
    },
  });
  users.push(superAdminUser);

  const hostUser = await prisma.user.create({
    data: {
      email: 'host@gharbatai.com', username: 'testhost', passwordHash: hashedPassword,
      firstName: 'Dipesh', lastName: 'Gurung', phone: '+977-986-1111111',
      role: 'HOST', status: 'ACTIVE', isActive: true, emailVerified: true, phoneVerified: true,
      averageRating: 4.8, totalReviews: 45, responseRate: 98, responseTime: '< 1 hour',
      city: 'Pokhara', state: 'Gandaki Province', country: 'Nepal',
    },
  });
  users.push(hostUser);

  const mfaUser = await prisma.user.create({
    data: {
      email: 'mfa@gharbatai.com', username: 'mfauser', passwordHash: hashedPassword,
      firstName: 'Krishna', lastName: 'Joshi', phone: '+977-980-2222222',
      role: 'USER', status: 'ACTIVE', isActive: true, emailVerified: true, phoneVerified: true,
      mfaEnabled: true, mfaSecret: 'JBSWY3DPEHPK3PXP',
      city: 'Lalitpur', state: 'Bagmati Province', country: 'Nepal',
    },
  });
  users.push(mfaUser);

  // Diverse user profiles covering ALL statuses and roles
  const userDescriptions = [
    { role: 'USER' as const, status: 'ACTIVE' as const, verified: true },
    { role: 'HOST' as const, status: 'ACTIVE' as const, verified: true },
    { role: 'ADMIN' as const, status: 'ACTIVE' as const, verified: true },
    { role: 'CUSTOMER' as const, status: 'ACTIVE' as const, verified: true },
    { role: 'USER' as const, status: 'SUSPENDED' as const, verified: true },
    { role: 'USER' as const, status: 'PENDING_VERIFICATION' as const, verified: false },
    { role: 'HOST' as const, status: 'DELETED' as const, verified: true },
    { role: 'USER' as const, status: 'ACTIVE' as const, verified: false },
    { role: 'HOST' as const, status: 'ACTIVE' as const, verified: false },
  ];

  for (let i = 0; i < 50; i++) {
    const desc = userDescriptions[i % userDescriptions.length];
    const first = randomFirst();
    const last = randomLast();
    const loc = randomLoc();
    const user = await prisma.user.create({
      data: {
        email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@gmail.com`,
        username: `${first.toLowerCase()}.${last.toLowerCase()}${i}`,
        passwordHash: hashedPassword,
        firstName: first, lastName: last, phone: randomNepalPhone(),
        profilePhotoUrl: faker.image.avatar(), bio: faker.lorem.sentence(),
        role: desc.role, status: desc.status,
        isActive: desc.status === 'ACTIVE',
        emailVerified: desc.verified, phoneVerified: desc.verified,
        averageRating: desc.verified ? faker.number.float({ min: 3, max: 5, fractionDigits: 1 }) : 0,
        totalReviews: desc.verified ? faker.number.int({ min: 0, max: 100 }) : 0,
        responseRate: desc.verified ? faker.number.int({ min: 80, max: 100 }) : 0,
        responseTime: '< 2 hours',
        city: loc.city, state: loc.state, country: 'Nepal',
        lastLoginAt: new Date(Date.now() - faker.number.int({ min: 0, max: 30 * 24 * 60 * 60 * 1000 })),
        mfaEnabled: faker.datatype.boolean({ probability: 0.1 }),
      },
    });
    users.push(user);
  }
  console.log(`✓ Created ${users.length} users (ALL roles & statuses covered)`);

  // ── User Preferences (en/ne, NPR) ─────────────────────────────────────────

  console.log('⚙️  Creating user preferences...');
  let prefCount = 0;
  for (let i = 0; i < Math.min(users.length, 25); i++) {
    try {
      await prisma.userPreferences.create({
        data: {
          userId: users[i].id,
          language: faker.helpers.arrayElement(['en', 'ne']),
          currency: faker.helpers.weightedArrayElement([{ weight: 80, value: 'NPR' }, { weight: 15, value: 'USD' }, { weight: 5, value: 'INR' }]),
          timezone: 'Asia/Kathmandu',
          emailNotifications: faker.datatype.boolean(),
          pushNotifications: faker.datatype.boolean(),
          smsNotifications: faker.datatype.boolean({ probability: 0.3 }),
          marketingEmails: faker.datatype.boolean({ probability: 0.4 }),
          autoAcceptBookings: faker.datatype.boolean({ probability: 0.2 }),
          instantBook: faker.datatype.boolean({ probability: 0.3 }),
          minBookingDuration: faker.number.int({ min: 1, max: 7 }),
          maxBookingDuration: faker.number.int({ min: 14, max: 90 }),
          advanceBookingNotice: faker.number.int({ min: 1, max: 72 }),
        },
      });
      prefCount++;
    } catch { /* skip */ }
  }
  console.log(`✓ Created ${prefCount} user preferences`);

  // ── Sessions, Device Tokens ────────────────────────────────────────────────

  console.log('🔐 Creating sessions...');
  let sessionCount = 0;
  for (let i = 0; i < Math.min(users.length, 15); i++) {
    try {
      await prisma.session.create({ data: { userId: users[i].id, token: `session_${faker.string.alphanumeric(32)}`, userAgent: faker.internet.userAgent(), ipAddress: faker.internet.ipv4(), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } });
      sessionCount++;
    } catch { /* skip */ }
  }
  console.log(`✓ Created ${sessionCount} sessions`);

  console.log('📱 Creating device tokens...');
  let tokenCount = 0;
  for (let i = 0; i < Math.min(users.length, 30); i++) {
    try {
      await prisma.deviceToken.create({ data: { userId: users[i].id, token: `device_${faker.string.alphanumeric(64)}`, platform: faker.helpers.arrayElement(['ios', 'android', 'web']), active: faker.datatype.boolean({ probability: 0.8 }) } });
      tokenCount++;
    } catch { /* skip */ }
  }
  console.log(`✓ Created ${tokenCount} device tokens`);

  // ── Organizations ──────────────────────────────────────────────────────────

  console.log('🏢 Creating organizations...');
  const hostUsers = users.filter((u) => u.role === 'HOST');
  const organizations = await Promise.all(
    hostUsers.slice(0, 5).map((user) => {
      const loc = randomLoc();
      return prisma.organization.create({
        data: {
          name: `${user.lastName} Properties`, slug: `${user.lastName.toLowerCase()}-properties`,
          description: faker.lorem.paragraph(), email: faker.internet.email(), phone: randomNepalPhone(),
          address: `Ward ${faker.number.int({ min: 1, max: 35 })}, ${randomTole()}`,
          city: loc.city, state: loc.state, country: 'Nepal', ownerId: user.id,
          businessType: 'INDIVIDUAL', status: 'ACTIVE', verificationStatus: 'VERIFIED',
        },
      });
    }),
  );
  console.log(`✓ Created ${organizations.length} organizations`);

  // ── Listings (Nepal locations, NPR pricing) ────────────────────────────────

  console.log('🏠 Creating listings...');
  const properties: any[] = [];
  const allPropertyStatuses = ['AVAILABLE', 'RENTED', 'MAINTENANCE', 'UNAVAILABLE', 'DRAFT', 'SUSPENDED', 'ARCHIVED'];
  const allVerificationStatuses = ['PENDING', 'VERIFIED', 'REJECTED'];
  const allPropertyConditions = ['EXCELLENT', 'GOOD', 'FAIR', 'POOR'];
  const allBookingModes = ['REQUEST', 'INSTANT_BOOK'];
  const propertyTypes = ['APARTMENT', 'HOUSE', 'VILLA', 'CONDO', 'TOWNHOUSE', 'STUDIO', 'COTTAGE', 'CABIN', 'LOFT', 'OTHER'];

  // Price ranges in NPR
  const priceRanges = [
    { min: 1000, max: 3000 }, { min: 3000, max: 8000 }, { min: 8000, max: 15000 },
    { min: 15000, max: 30000 }, { min: 30000, max: 80000 },
  ];

  for (let i = 0; i < categories.length * 5; i++) {
    const category = categories[i % categories.length];
    const owner = hostUsers.length > 0 ? hostUsers[i % hostUsers.length] : users[1]; // testOwner
    const policy = policies[i % policies.length];
    const org = faker.datatype.boolean({ probability: 0.4 }) ? organizations[i % organizations.length] : null;
    const loc = randomLoc();
    const tole = randomTole();

    const status = allPropertyStatuses[i % allPropertyStatuses.length];
    const verificationStatus = allVerificationStatuses[i % allVerificationStatuses.length];
    const condition = allPropertyConditions[i % allPropertyConditions.length];
    const bookingMode = allBookingModes[i % allBookingModes.length];
    const priceRange = priceRanges[i % priceRanges.length];
    const basePrice = faker.number.float({ min: priceRange.min, max: priceRange.max, fractionDigits: 0 });

    const listing = await prisma.listing.create({
      data: {
        title: faker.helpers.arrayElement([
          `Modern Apartment in ${tole}`, `Spacious Flat – ${loc.city}`,
          `Cozy House near ${tole}`, `Premium ${tole} Listing`,
          `Reliable ${faker.helpers.arrayElement(['Suzuki Alto', 'Hyundai i20', 'Honda Shine'])} for Rent`,
          `Professional ${faker.helpers.arrayElement(['DSLR Camera', 'Generator', 'Sound System'])} for Rent`,
        ]),
        slug: `${category.slug}-${i}-${faker.string.alphanumeric(8)}`,
        description: faker.lorem.paragraphs(2),
        address: `Ward ${faker.number.int({ min: 1, max: 35 })}, ${tole}`,
        city: loc.city, state: loc.state, zipCode: loc.zip, country: 'Nepal',
        latitude: loc.lat + (Math.random() - 0.5) * 0.05,
        longitude: loc.lng + (Math.random() - 0.5) * 0.05,
        type: faker.helpers.arrayElement(propertyTypes) as any,
        status: status as any, verificationStatus: verificationStatus as any,
        condition: condition as any, bookingMode: bookingMode as any,
        bedrooms: category.slug.includes('apartment') || category.slug.includes('house') ? faker.number.int({ min: 1, max: 5 }) : undefined,
        bathrooms: category.slug.includes('apartment') || category.slug.includes('house') ? faker.number.int({ min: 1, max: 4 }) : undefined,
        maxGuests: faker.number.int({ min: 2, max: 10 }),
        basePrice: new Prisma.Decimal(basePrice),
        currency: 'NPR',
        securityDeposit: new Prisma.Decimal(basePrice * 2),
        cleaningFee: new Prisma.Decimal(Math.max(500, basePrice * 0.2)),
        amenities: faker.helpers.arrayElements(AMENITIES, { min: 3, max: 8 }),
        features: faker.helpers.arrayElements(AMENITIES, { min: 3, max: 8 }),
        images: Array.from({ length: faker.number.int({ min: 5, max: 10 }) }, () => `https://picsum.photos/seed/${faker.string.alphanumeric(10)}/800/600.jpg`),
        photos: Array.from({ length: faker.number.int({ min: 5, max: 10 }) }, () => `https://picsum.photos/seed/${faker.string.alphanumeric(10)}/800/600.jpg`),
        rules: ['No smoking', 'Shoes off inside', 'Quiet hours 10 PM – 7 AM', 'Return keys at checkout'],
        ownerId: owner.id, categoryId: category.id, cancellationPolicyId: policy.id,
        organizationId: org?.id,
      },
    });
    properties.push(listing);
  }
  console.log(`✓ Created ${properties.length} listings (ALL statuses covered)`);

  // ── Bilingual Listing Content ──────────────────────────────────────────────

  console.log('🌐 Creating bilingual listing content...');
  let contentCount = 0;
  for (const listing of properties.slice(0, 50)) {
    try {
      await prisma.listingContent.create({ data: { listingId: listing.id, locale: 'en', title: listing.title, description: listing.description || '' } });
      await prisma.listingContent.create({
        data: { listingId: listing.id, locale: 'ne', title: listing.title.replace('Modern', 'आधुनिक').replace('Spacious', 'फराकिलो').replace('Cozy', 'आरामदायी'), description: 'नेपालको सुन्दर ठाउँमा अवस्थित यो सम्पत्ति।' },
      });
      contentCount += 2;
    } catch { /* skip */ }
  }
  console.log(`✓ Created ${contentCount} listing content entries (en + ne)`);

  // ── Availability ───────────────────────────────────────────────────────────

  console.log('📅 Creating availability records...');
  let availabilityCount = 0;
  for (const listing of properties.slice(0, 30)) {
    try {
      await prisma.availability.create({
        data: { propertyId: listing.id, startDate: faker.date.future({ years: 0.5 }), endDate: faker.date.future({ years: 1 }), status: faker.helpers.arrayElement(['available', 'booked', 'blocked']), price: listing.basePrice },
      });
      availabilityCount++;
    } catch { /* skip */ }
  }
  console.log(`✓ Created ${availabilityCount} availability records`);

  // ── Bookings (NPR, ALL 12 statuses) ────────────────────────────────────────

  console.log('📅 Creating bookings with ALL statuses...');
  const bookings: any[] = [];
  const allBookingStatuses: BookingStatus[] = ['DRAFT', 'PENDING', 'PENDING_PAYMENT', 'PENDING_OWNER_APPROVAL', 'CONFIRMED', 'IN_PROGRESS', 'CANCELLED', 'DISPUTED', 'COMPLETED', 'AWAITING_RETURN_INSPECTION', 'REFUNDED', 'SETTLED'];

  for (let i = 0; i < 100; i++) {
    const listing = properties[i % properties.length];
    const renter = users.filter((u) => u.role === 'USER' || u.role === 'CUSTOMER')[i % users.filter((u) => u.role === 'USER' || u.role === 'CUSTOMER').length];
    if (listing.ownerId === renter?.id) continue;
    if (!renter) continue;

    const startDate = faker.date.recent({ days: 365 });
    const nights = faker.number.int({ min: 1, max: 14 });
    const endDate = new Date(startDate.getTime() + nights * 24 * 60 * 60 * 1000);
    const base = Number(listing.basePrice);
    const total = base * nights + Number(listing.cleaningFee || 0);
    const status = allBookingStatuses[i % allBookingStatuses.length];

    try {
      const booking = await prisma.booking.create({
        data: {
          listingId: listing.id, ownerId: listing.ownerId, renterId: renter.id,
          startDate, endDate,
          basePrice: new Prisma.Decimal(base),
          securityDeposit: listing.securityDeposit,
          cleaningFee: listing.cleaningFee,
          serviceFee: new Prisma.Decimal(total * 0.1),
          totalPrice: new Prisma.Decimal(total),
          totalAmount: new Prisma.Decimal(total),
          currency: 'NPR', status,
          guestCount: faker.number.int({ min: 1, max: 6 }),
          ownerEarnings: new Prisma.Decimal(total * 0.9),
          platformFee: new Prisma.Decimal(total * 0.1),
          createdAt: startDate,
        },
      });
      bookings.push(booking);
    } catch { /* skip */ }
  }
  console.log(`✓ Created ${bookings.length} bookings (ALL 12 statuses covered)`);

  // ── Favorites ──────────────────────────────────────────────────────────────

  console.log('❤️  Creating favorites...');
  let favoriteCount = 0;
  for (let i = 0; i < 30; i++) {
    try {
      await prisma.favoriteListing.create({ data: { userId: users[i % users.length].id, listingId: properties[i % properties.length].id } });
      favoriteCount++;
    } catch { /* skip */ }
  }
  console.log(`✓ Created ${favoriteCount} favorite listings`);

  // ── Reviews ────────────────────────────────────────────────────────────────

  console.log('⭐ Creating reviews with ALL types & statuses...');
  const reviews: any[] = [];
  const allReviewTypes = ['LISTING_REVIEW', 'RENTER_REVIEW', 'OWNER_REVIEW'];
  const allReviewStatuses = ['DRAFT', 'PUBLISHED', 'HIDDEN', 'FLAGGED'];

  for (let i = 0; i < Math.min(bookings.length, 50); i++) {
    const b = bookings[i];
    const listing = properties.find((p: any) => p.id === b.listingId);
    if (!listing) continue;
    try {
      const review = await prisma.review.create({
        data: {
          bookingId: b.id, listingId: listing.id, reviewerId: b.renterId, revieweeId: listing.ownerId,
          type: allReviewTypes[i % allReviewTypes.length] as any,
          rating: faker.number.int({ min: 1, max: 5 }),
          overallRating: faker.number.int({ min: 1, max: 5 }),
          accuracyRating: faker.number.int({ min: 1, max: 5 }),
          communicationRating: faker.number.int({ min: 1, max: 5 }),
          cleanlinessRating: faker.number.int({ min: 1, max: 5 }),
          valueRating: faker.number.int({ min: 1, max: 5 }),
          locationRating: faker.number.int({ min: 1, max: 5 }),
          checkInRating: faker.number.int({ min: 1, max: 5 }),
          comment: faker.helpers.arrayElement([
            'Great stay!', 'राम्रो अनुभव!', 'Very clean.', 'Loved the view.', 'हिमालको दृश्य मन पर्यो!',
          ]),
          status: allReviewStatuses[i % allReviewStatuses.length] as any,
        },
      });
      reviews.push(review);
    } catch { /* skip */ }
  }
  console.log(`✓ Created ${reviews.length} reviews`);

  // ── Payments (NPR, ALL statuses) ───────────────────────────────────────────

  console.log('💳 Creating payments...');
  let paymentCount = 0;
  const allPaymentStatuses = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED', 'SUCCEEDED'];
  for (let i = 0; i < Math.min(bookings.length, 60); i++) {
    const b = bookings[i];
    try {
      await prisma.payment.create({
        data: {
          bookingId: b.id, amount: b.totalPrice, currency: 'NPR',
          status: allPaymentStatuses[i % allPaymentStatuses.length] as any,
          paymentMethod: faker.helpers.arrayElement(['CREDIT_CARD', 'DEBIT_CARD', 'PAYPAL']),
          paymentIntentId: `pi_${faker.string.alphanumeric(24)}`,
          stripePaymentIntentId: `pi_${faker.string.alphanumeric(24)}`,
          chargeId: `ch_${faker.string.alphanumeric(24)}`,
          fee: new Prisma.Decimal(Number(b.totalPrice) * 0.03),
          netAmount: new Prisma.Decimal(Number(b.totalPrice) * 0.97),
          description: `Payment for booking ${b.id}`, createdAt: b.createdAt,
        },
      });
      paymentCount++;
    } catch { /* skip */ }
  }
  console.log(`✓ Created ${paymentCount} payments (ALL statuses)`);

  // ── Refunds ────────────────────────────────────────────────────────────────

  console.log('💰 Creating refunds...');
  let refundCount = 0;
  const allRefundStatuses = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'SUCCEEDED'];
  for (let i = 0; i < Math.min(bookings.length, 20); i++) {
    const b = bookings[i];
    try {
      await prisma.refund.create({
        data: { bookingId: b.id, amount: new Prisma.Decimal(Number(b.totalPrice) * 0.8), currency: 'NPR', status: allRefundStatuses[i % allRefundStatuses.length] as any, refundId: `re_${faker.string.alphanumeric(24)}`, reason: 'Guest request' },
      });
      refundCount++;
    } catch { /* skip */ }
  }
  console.log(`✓ Created ${refundCount} refunds`);

  // ── Insurance ──────────────────────────────────────────────────────────────

  console.log('🛡️  Creating insurance policies and claims...');
  let policyCount = 0; let claimCount = 0;
  const allInsuranceTypes = ['PROPERTY_DAMAGE', 'LIABILITY', 'TRIP_CANCELLATION', 'MEDICAL'];
  const allInsuranceStatuses = ['ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING'];
  for (let i = 0; i < Math.min(bookings.length, 40); i++) {
    const b = bookings[i];
    const listing = properties.find((p: any) => p.id === b.listingId);
    try {
      const pol = await prisma.insurancePolicy.create({
        data: { bookingId: b.id, propertyId: listing?.id || properties[0].id, userId: b.renterId, policyNumber: `POL-${faker.string.alphanumeric(10)}`, provider: faker.helpers.arrayElement(['Nepal Insurance', 'SBI General Nepal', 'Platform Insurance']), coverage: new Prisma.Decimal(Number(b.totalPrice) * 2), coverageAmount: new Prisma.Decimal(Number(b.totalPrice) * 2), premium: new Prisma.Decimal(Number(b.totalPrice) * 0.05), currency: 'NPR', type: allInsuranceTypes[i % allInsuranceTypes.length], startDate: b.startDate, endDate: b.endDate, status: allInsuranceStatuses[i % allInsuranceStatuses.length], documents: [] },
      });
      policyCount++;
      if (i < 15) {
        await prisma.insuranceClaim.create({
          data: { policyId: pol.id, bookingId: b.id, propertyId: listing?.id || properties[0].id, claimNumber: `CLM-${faker.string.alphanumeric(10)}`, claimAmount: new Prisma.Decimal(faker.number.float({ min: 5000, max: 50000, fractionDigits: 0 })), description: faker.lorem.paragraph(), incidentDate: faker.date.recent({ days: 30 }), status: faker.helpers.arrayElement(['PENDING', 'APPROVED', 'REJECTED', 'PROCESSING', 'PAID', 'CANCELLED']) },
        });
        claimCount++;
      }
    } catch { /* skip */ }
  }
  console.log(`✓ Created ${policyCount} insurance policies, ${claimCount} claims`);

  // ── Conversations & Messages ───────────────────────────────────────────────

  console.log('💬 Creating conversations...');
  let conversationCount = 0; let messageCount = 0;
  for (let i = 0; i < Math.min(bookings.length, 30); i++) {
    const b = bookings[i];
    const listing = properties.find((p: any) => p.id === b.listingId);
    if (!listing) continue;
    try {
      const conv = await prisma.conversation.create({
        data: { bookingId: b.id, listingId: listing.id, type: faker.helpers.arrayElement(['GENERAL', 'BOOKING', 'DISPUTE', 'SUPPORT']), status: faker.helpers.arrayElement(['ACTIVE', 'ARCHIVED', 'CLOSED']), lastMessageAt: faker.date.recent({ days: 30 }) },
      });
      await prisma.conversationParticipant.create({ data: { conversationId: conv.id, userId: b.renterId } });
      await prisma.conversationParticipant.create({ data: { conversationId: conv.id, userId: listing.ownerId } });
      conversationCount++;

      for (let j = 0; j < faker.number.int({ min: 2, max: 6 }); j++) {
        await prisma.message.create({
          data: { conversationId: conv.id, senderId: faker.datatype.boolean() ? b.renterId : listing.ownerId, content: faker.helpers.arrayElement(['Namaste!', 'नमस्ते!', 'Is the property available?', 'के सम्पत्ति उपलब्ध छ?', faker.lorem.sentence()]), type: faker.helpers.arrayElement(['TEXT', 'IMAGE', 'DOCUMENT', 'LOCATION', 'SYSTEM']), attachments: [] },
        });
        messageCount++;
      }
    } catch { /* skip */ }
  }
  console.log(`✓ Created ${conversationCount} conversations, ${messageCount} messages`);

  // ── Disputes ───────────────────────────────────────────────────────────────

  console.log('⚖️  Creating disputes...');
  let disputeCount = 0;
  const allDisputeTypes = ['PROPERTY_DAMAGE', 'PAYMENT_ISSUE', 'CANCELLATION', 'CLEANING_FEE', 'RULES_VIOLATION', 'MISSING_ITEMS', 'CONDITION_MISMATCH', 'REFUND_REQUEST', 'OTHER'];
  const allDisputeStatuses = ['OPEN', 'UNDER_REVIEW', 'INVESTIGATING', 'RESOLVED', 'CLOSED', 'DISMISSED', 'WITHDRAWN'];
  for (let i = 0; i < Math.min(bookings.length, 20); i++) {
    const b = bookings[i];
    try {
      const dispute = await prisma.dispute.create({
        data: {
          bookingId: b.id, initiatorId: b.renterId, defendantId: b.ownerId, assignedTo: adminUser.id,
          title: faker.lorem.words(4), type: allDisputeTypes[i % allDisputeTypes.length] as any,
          status: allDisputeStatuses[i % allDisputeStatuses.length] as any,
          priority: faker.helpers.arrayElement(['LOW', 'MEDIUM', 'HIGH', 'URGENT']) as any,
          description: faker.lorem.paragraph(),
          amount: new Prisma.Decimal(faker.number.float({ min: 5000, max: 50000, fractionDigits: 0 })),
        },
      });
      await prisma.disputeEvidence.create({ data: { disputeId: dispute.id, type: 'photo', url: `https://example.com/evidence/${faker.string.alphanumeric(12)}`, caption: faker.lorem.sentence(), uploadedBy: b.renterId } });
      if (faker.datatype.boolean()) {
        await prisma.disputeResponse.create({ data: { disputeId: dispute.id, userId: b.ownerId, content: faker.lorem.paragraph(), type: 'statement', attachments: [] } });
      }
      if (['RESOLVED', 'CLOSED', 'DISMISSED'].includes(dispute.status)) {
        await prisma.disputeResolution.create({ data: { disputeId: dispute.id, resolvedBy: adminUser.id, type: faker.helpers.arrayElement(['FULL_REFUND', 'PARTIAL_REFUND', 'CHARGE_BACK']), outcome: faker.lorem.sentence(), amount: new Prisma.Decimal(faker.number.float({ min: 0, max: 30000, fractionDigits: 0 })), details: faker.lorem.paragraph() } });
      }
      await prisma.disputeTimelineEvent.create({ data: { disputeId: dispute.id, event: 'created', details: 'Dispute created' } });
      disputeCount++;
    } catch { /* skip */ }
  }
  console.log(`✓ Created ${disputeCount} disputes`);

  // ── Notifications ──────────────────────────────────────────────────────────

  console.log('🔔 Creating notifications...');
  let notificationCount = 0;
  const allNotificationTypes = ['BOOKING_REQUEST', 'BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'BOOKING_REMINDER', 'PAYMENT_RECEIVED', 'REVIEW_RECEIVED', 'MESSAGE_RECEIVED', 'SYSTEM_UPDATE', 'SYSTEM_ANNOUNCEMENT', 'MARKETING', 'PAYOUT_PROCESSED', 'VERIFICATION_COMPLETE', 'DISPUTE_OPENED', 'LISTING_APPROVED'];
  for (let i = 0; i < Math.min(users.length, 30); i++) {
    for (let j = 0; j < faker.number.int({ min: 3, max: 10 }); j++) {
      try {
        await prisma.notification.create({ data: { userId: users[i].id, type: allNotificationTypes[(i + j) % allNotificationTypes.length] as any, title: faker.lorem.sentence(), message: faker.lorem.sentences(2), read: faker.datatype.boolean({ probability: 0.6 }) } });
        notificationCount++;
      } catch { /* skip */ }
    }
  }
  console.log(`✓ Created ${notificationCount} notifications`);

  // ── Payouts, Deposits, Ledger, History, Condition Reports ──────────────────

  console.log('💸 Creating payouts...');
  let payoutCount = 0;
  const allPayoutStatuses = ['PENDING', 'PROCESSING', 'IN_TRANSIT', 'COMPLETED', 'PAID', 'FAILED', 'CANCELLED'];
  const propertyOwners = [...new Set(properties.map((p: any) => p.ownerId))];
  for (let i = 0; i < propertyOwners.length; i++) {
    try {
      const st = allPayoutStatuses[i % allPayoutStatuses.length];
      await prisma.payout.create({ data: { ownerId: propertyOwners[i], amount: new Prisma.Decimal(faker.number.float({ min: 10000, max: 200000, fractionDigits: 0 })), currency: 'NPR', status: st, transferId: `transfer_${faker.string.alphanumeric(24)}`, paidAt: ['COMPLETED', 'PAID'].includes(st) ? new Date() : null, processedAt: ['COMPLETED', 'PAID', 'IN_TRANSIT'].includes(st) ? new Date() : null } });
      payoutCount++;
    } catch { /* skip */ }
  }
  console.log(`✓ Created ${payoutCount} payouts`);

  console.log('🔒 Creating deposit holds...');
  let depositCount = 0;
  const allDepositStatuses = ['PENDING', 'AUTHORIZED', 'HELD', 'RELEASED', 'CAPTURED', 'FAILED'];
  for (let i = 0; i < Math.min(bookings.length, 36); i++) {
    const b = bookings[i];
    if (b.securityDeposit && Number(b.securityDeposit) > 0) {
      try {
        const st = allDepositStatuses[i % allDepositStatuses.length];
        await prisma.depositHold.create({ data: { bookingId: b.id, amount: b.securityDeposit, currency: 'NPR', status: st, paymentIntentId: `pi_dep_${faker.string.alphanumeric(24)}`, expiresAt: new Date(b.endDate.getTime() + 7 * 24 * 60 * 60 * 1000), releasedAt: st === 'RELEASED' ? new Date() : null, capturedAt: st === 'CAPTURED' ? new Date() : null } });
        depositCount++;
      } catch { /* skip */ }
    }
  }
  console.log(`✓ Created ${depositCount} deposit holds`);

  console.log('📒 Creating ledger entries...');
  let ledgerCount = 0;
  for (let i = 0; i < Math.min(bookings.length, 50); i++) {
    const b = bookings[i];
    try {
      await prisma.ledgerEntry.create({ data: { bookingId: b.id, accountId: b.renterId, accountType: 'REVENUE', side: 'DEBIT', transactionType: 'PAYMENT', amount: b.totalPrice, currency: 'NPR', description: `Payment for booking ${b.id}`, status: 'POSTED' } });
      await prisma.ledgerEntry.create({ data: { bookingId: b.id, accountId: properties.find((p: any) => p.id === b.listingId)?.ownerId || users[0].id, accountType: 'RECEIVABLE', side: 'CREDIT', transactionType: 'OWNER_EARNING', amount: b.ownerEarnings || new Prisma.Decimal(Number(b.totalPrice) * 0.85), currency: 'NPR', description: `Earnings from booking ${b.id}`, status: 'POSTED' } });
      ledgerCount += 2;
    } catch { /* skip */ }
  }
  console.log(`✓ Created ${ledgerCount} ledger entries`);

  console.log('📜 Creating booking state history...');
  let historyCount = 0;
  for (const b of bookings) {
    try {
      await prisma.bookingStateHistory.create({ data: { bookingId: b.id, fromStatus: null, toStatus: 'PENDING', reason: 'Booking created', changedBy: b.renterId, createdAt: b.createdAt } });
      historyCount++;
      if (['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(b.status)) {
        await prisma.bookingStateHistory.create({ data: { bookingId: b.id, fromStatus: 'PENDING', toStatus: 'CONFIRMED', reason: 'Confirmed by host', changedBy: b.ownerId } });
        historyCount++;
      }
      if (['IN_PROGRESS', 'COMPLETED'].includes(b.status)) {
        await prisma.bookingStateHistory.create({ data: { bookingId: b.id, fromStatus: 'CONFIRMED', toStatus: 'IN_PROGRESS', reason: 'Guest checked in', changedBy: b.renterId } });
        historyCount++;
      }
      if (b.status === 'COMPLETED') {
        await prisma.bookingStateHistory.create({ data: { bookingId: b.id, fromStatus: 'IN_PROGRESS', toStatus: 'COMPLETED', reason: 'Booking completed', changedBy: b.ownerId } });
        historyCount++;
      }
      if (b.status === 'CANCELLED') {
        await prisma.bookingStateHistory.create({ data: { bookingId: b.id, fromStatus: 'PENDING', toStatus: 'CANCELLED', reason: faker.helpers.arrayElement(['Guest request', 'Host cancelled', 'Payment failed']), changedBy: b.renterId } });
        historyCount++;
      }
    } catch { /* skip */ }
  }
  console.log(`✓ Created ${historyCount} booking state history records`);

  console.log('📋 Creating condition reports...');
  let reportCount = 0;
  for (const b of bookings.filter((b: any) => ['IN_PROGRESS', 'COMPLETED'].includes(b.status)).slice(0, 20)) {
    try {
      await prisma.conditionReport.create({ data: { bookingId: b.id, propertyId: b.listingId, createdBy: b.renterId, checkIn: true, checkOut: false, photos: Array.from({ length: 3 }, () => `https://example.com/photos/${faker.string.alphanumeric(10)}.jpg`), notes: faker.lorem.paragraph(), status: 'SUBMITTED', reportType: 'CHECK_IN' } });
      reportCount++;
    } catch { /* skip */ }
  }
  console.log(`✓ Created ${reportCount} condition reports`);

  // ── Audit Logs ─────────────────────────────────────────────────────────────

  console.log('📝 Creating audit logs...');
  let auditCount = 0;
  for (let i = 0; i < 50; i++) {
    try {
      await prisma.auditLog.create({ data: { userId: users[i % users.length].id, action: faker.helpers.arrayElement(['USER_LOGIN', 'BOOKING_CREATE', 'PAYMENT_PROCESS', 'PROPERTY_UPDATE']), entityType: faker.helpers.arrayElement(['User', 'Booking', 'Listing', 'Payment']), entityId: faker.string.uuid(), oldValues: JSON.stringify({ status: 'old' }), newValues: JSON.stringify({ status: 'new' }), ipAddress: faker.internet.ipv4(), userAgent: faker.internet.userAgent() } });
      auditCount++;
    } catch { /* skip */ }
  }
  console.log(`✓ Created ${auditCount} audit logs`);

  // ── Summary ────────────────────────────────────────────────────────────────

  console.log('\n' + '='.repeat(60));
  console.log('🇳🇵 NEPAL DATABASE SEEDING COMPLETED!');
  console.log('='.repeat(60));
  console.log(`  🌍 Country: Nepal | Currency: NPR | Locales: en, ne`);
  console.log(`  👥 Users: ${users.length} (Nepali names, ALL roles & statuses)`);
  console.log(`  ⚙️  User Preferences: ${prefCount} (en/ne, NPR)`);
  console.log(`  🔐 Sessions: ${sessionCount}`);
  console.log(`  📱 Device Tokens: ${tokenCount}`);
  console.log(`  📂 Categories: ${categories.length}`);
  console.log(`  📋 Cancellation Policies: ${policies.length}`);
  console.log(`  📧 Email Templates: ${emailTemplates.length}`);
  console.log(`  🏢 Organizations: ${organizations.length}`);
  console.log(`  🏠 Listings: ${properties.length} (Nepal, NPR, ALL statuses)`);
  console.log(`  🌐 Listing Content: ${contentCount} (en + ne bilingual)`);
  console.log(`  📅 Availability: ${availabilityCount}`);
  console.log(`  📆 Bookings: ${bookings.length} (NPR, ALL 12 statuses)`);
  console.log(`  ⭐ Reviews: ${reviews.length}`);
  console.log(`  ❤️  Favorites: ${favoriteCount}`);
  console.log(`  💳 Payments: ${paymentCount} (NPR)`);
  console.log(`  💰 Refunds: ${refundCount}`);
  console.log(`  🛡️  Insurance: ${policyCount} policies, ${claimCount} claims`);
  console.log(`  💬 Conversations: ${conversationCount}, Messages: ${messageCount}`);
  console.log(`  ⚖️  Disputes: ${disputeCount}`);
  console.log(`  🔔 Notifications: ${notificationCount}`);
  console.log(`  💸 Payouts: ${payoutCount} (NPR)`);
  console.log(`  🔒 Deposits: ${depositCount}`);
  console.log(`  📒 Ledger: ${ledgerCount}`);
  console.log(`  📜 History: ${historyCount}`);
  console.log(`  📋 Condition Reports: ${reportCount}`);
  console.log(`  📝 Audit Logs: ${auditCount}`);
  console.log('='.repeat(60));
  console.log('\n🔑 LOGIN CREDENTIALS (see .env or seed source for passwords):');
  console.log('  Test Renter: renter@test.com (Sagar Shrestha)');
  console.log('  Test Owner: owner@test.com (Anita Sharma)');
  console.log('  Test Admin: admin@test.com (Rajesh Pandey)');
  console.log('  Admin: admin@gharbatai.com');
  console.log('  Super Admin: superadmin@gharbatai.com');
  console.log('  Host: host@gharbatai.com');
  console.log('  MFA User: mfa@gharbatai.com');
  console.log('='.repeat(60) + '\n');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
