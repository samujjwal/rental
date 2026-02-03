import { config } from 'dotenv';
import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';
import { faker } from '@faker-js/faker';
import crypto from 'crypto';

config({ path: '../../.env' });

const prisma = new PrismaClient();

// Helper functions
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function generatePaymentIntentId(): string {
  return `pi_${faker.string.alphanumeric(24)}`;
}

function generateStripeId(): string {
  return `ch_${faker.string.alphanumeric(24)}`;
}

function generateRefundId(): string {
  return `re_${faker.string.alphanumeric(24)}`;
}

async function main() {
  console.log('🌱 Starting comprehensive database seeding...\n');

  // Clean existing data - order matters due to foreign keys
  console.log('🧹 Cleaning existing data...');
  await prisma.disputeResolution.deleteMany();
  await prisma.disputeTimelineEvent.deleteMany();
  await prisma.disputeResponse.deleteMany();
  await prisma.disputeEvidence.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.messageReadReceipt.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversationParticipant.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.conditionReport.deleteMany();
  await prisma.insuranceClaim.deleteMany();
  await prisma.insurancePolicy.deleteMany();
  await prisma.bookingStateHistory.deleteMany();
  await prisma.depositHold.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.payout.deleteMany();
  await prisma.refund.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.review.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.availability.deleteMany();
  await prisma.favoriteListing.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.userPreferences.deleteMany();
  await prisma.deviceToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.organizationMember.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.category.deleteMany();
  await prisma.cancellationPolicy.deleteMany();
  await prisma.emailTemplate.deleteMany();

  console.log('✓ Cleaned existing data\n');

  // Create cancellation policies
  console.log('📋 Creating cancellation policies...');
  const policies = await Promise.all([
    prisma.cancellationPolicy.create({
      data: {
        name: 'Flexible',
        description: 'Free cancellation up to 24 hours before check-in',
        type: 'flexible',
        fullRefundHours: 24,
        partialRefundHours: 48,
        partialRefundPercent: new Prisma.Decimal(1.0),
        noRefundHours: 0,
      },
    }),
    prisma.cancellationPolicy.create({
      data: {
        name: 'Moderate',
        description: 'Free cancellation up to 7 days before check-in',
        type: 'moderate',
        fullRefundHours: 168,
        partialRefundHours: 336,
        partialRefundPercent: new Prisma.Decimal(0.5),
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
        partialRefundPercent: new Prisma.Decimal(0),
        noRefundHours: 0,
      },
    }),
    prisma.cancellationPolicy.create({
      data: {
        name: 'Super Flexible',
        description: 'Free cancellation up to 48 hours before check-in',
        type: 'super_flexible',
        fullRefundHours: 48,
        partialRefundHours: 72,
        partialRefundPercent: new Prisma.Decimal(1.0),
        noRefundHours: 0,
      },
    }),
  ]);

  console.log(`✓ Created ${policies.length} cancellation policies\n`);

  // Create categories
  console.log('📂 Creating categories...');
  const categories = await Promise.all([
    prisma.category.create({
      data: {
        name: 'Apartment',
        slug: 'apartment',
        description: 'Full apartments and condos',
        icon: 'apartment',
        isActive: true,
        active: true,
        order: 1,
        pricingMode: 'PER_NIGHT',
        searchableFields: ['bedrooms', 'bathrooms', 'amenities'],
        requiredFields: ['bedrooms', 'bathrooms', 'address'],
      },
    }),
    prisma.category.create({
      data: {
        name: 'House',
        slug: 'house',
        description: 'Entire houses and villas',
        icon: 'house',
        isActive: true,
        active: true,
        order: 2,
        pricingMode: 'PER_NIGHT',
        searchableFields: ['bedrooms', 'bathrooms', 'amenities'],
        requiredFields: ['bedrooms', 'bathrooms', 'address'],
      },
    }),
    prisma.category.create({
      data: {
        name: 'Car',
        slug: 'car',
        description: 'Cars and trucks for rent',
        icon: 'car',
        isActive: true,
        active: true,
        order: 3,
        pricingMode: 'PER_NIGHT',
        searchableFields: ['make', 'model', 'year'],
        requiredFields: ['make', 'model', 'year'],
      },
    }),
    prisma.category.create({
      data: {
        name: 'Equipment',
        slug: 'equipment',
        description: 'Tools and equipment for rent',
        icon: 'tools',
        isActive: true,
        active: true,
        order: 4,
        pricingMode: 'PER_NIGHT',
        searchableFields: ['type', 'condition'],
        requiredFields: ['type'],
      },
    }),
    prisma.category.create({
      data: {
        name: 'Parking Space',
        slug: 'parking-space',
        description: 'Parking spaces and garages',
        icon: 'parking',
        isActive: true,
        active: true,
        order: 5,
        pricingMode: 'PER_MONTH',
        searchableFields: ['location', 'type'],
        requiredFields: ['location'],
      },
    }),
  ]);

  console.log(`✓ Created ${categories.length} categories\n`);

  // Create email templates
  console.log('📧 Creating email templates...');
  const emailTemplates = await Promise.all([
    prisma.emailTemplate.create({
      data: {
        name: 'booking_confirmation',
        subject: 'Booking Confirmation - {{bookingId}}',
        body: '<h1>Your booking is confirmed</h1><p>Booking ID: {{bookingId}}</p>',
        type: 'BOOKING_CONFIRMATION',
        description: 'Sent when a booking is confirmed',
        variables: ['bookingId', 'listingTitle', 'checkInDate', 'checkOutDate'],
        isActive: true,
        category: 'transactional',
      },
    }),
    prisma.emailTemplate.create({
      data: {
        name: 'booking_cancelled',
        subject: 'Booking Cancelled - {{bookingId}}',
        body: '<h1>Your booking has been cancelled</h1>',
        type: 'BOOKING_CANCELLATION',
        description: 'Sent when a booking is cancelled',
        variables: ['bookingId', 'refundAmount'],
        isActive: true,
        category: 'transactional',
      },
    }),
    prisma.emailTemplate.create({
      data: {
        name: 'payment_received',
        subject: 'Payment Received - {{amount}}',
        body: '<h1>Payment received</h1><p>Amount: {{amount}}</p>',
        type: 'PAYMENT_RECEIPT',
        description: 'Sent when payment is received',
        variables: ['amount', 'currency', 'bookingId'],
        isActive: true,
        category: 'transactional',
      },
    }),
    prisma.emailTemplate.create({
      data: {
        name: 'review_reminder',
        subject: 'Please review your recent booking',
        body: '<h1>How was your experience?</h1>',
        type: 'REVIEW_REMINDER',
        description: 'Sent to request a review',
        variables: ['listingTitle', 'bookingId'],
        isActive: true,
        category: 'transactional',
      },
    }),
  ]);

  console.log(`✓ Created ${emailTemplates.length} email templates\n`);

  // Create users
  console.log('👥 Creating users...');
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
        phone: '+1-555-0001',
        profilePhotoUrl: faker.image.avatar(),
        bio: 'Platform administrator',
        role: 'ADMIN',
        status: 'ACTIVE',
        emailVerified: true,
        phoneVerified: true,
        isActive: true,
        averageRating: 5,
        totalReviews: 0,
        responseRate: 100,
        responseTime: '< 1 hour',
        city: 'San Francisco',
        state: 'CA',
        country: 'USA',
        lastLoginAt: new Date(),
        mfaEnabled: true,
      },
    }),
    // Super admin
    prisma.user.create({
      data: {
        email: 'superadmin@gharbatai.com',
        username: 'superadmin',
        passwordHash: hashedPassword,
        firstName: 'Super',
        lastName: 'Admin',
        phone: '+1-555-0002',
        profilePhotoUrl: faker.image.avatar(),
        bio: 'Super administrator',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        emailVerified: true,
        phoneVerified: true,
        isActive: true,
        lastLoginAt: new Date(),
        mfaEnabled: true,
      },
    }),
    // Regular users and hosts
    ...Array.from({ length: 100 }, async (_, i) => {
      const isHost = i % 3 === 0; // Every 3rd user is a host
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
          role: isHost ? 'HOST' : 'USER',
          status: faker.helpers.arrayElement(['ACTIVE', 'ACTIVE', 'ACTIVE', 'SUSPENDED']),
          emailVerified: faker.datatype.boolean({ probability: 0.9 }),
          phoneVerified: faker.datatype.boolean({ probability: 0.7 }),
          isActive: true,
          averageRating: isHost ? faker.number.float({ min: 3.5, max: 5, fractionDigits: 1 }) : 0,
          totalReviews: isHost ? faker.number.int({ min: 0, max: 200 }) : 0,
          responseRate: isHost ? faker.number.int({ min: 80, max: 100 }) : 0,
          responseTime: isHost ? '< 2 hours' : undefined,
          city: faker.location.city(),
          state: faker.location.state(),
          country: 'USA',
          lastLoginAt: faker.date.recent({ days: 30 }),
          mfaEnabled: faker.datatype.boolean({ probability: 0.2 }),
          stripeCustomerId: `cus_${faker.string.alphanumeric(14)}`,
          stripeConnectId: isHost ? `acct_${faker.string.alphanumeric(16)}` : undefined,
          stripeChargesEnabled: isHost ? faker.datatype.boolean({ probability: 0.8 }) : false,
          stripePayoutsEnabled: isHost ? faker.datatype.boolean({ probability: 0.8 }) : false,
          stripeOnboardingComplete: isHost ? faker.datatype.boolean({ probability: 0.7 }) : false,
        },
      });
    }),
  ]);

  console.log(`✓ Created ${users.length} users\n`);

  // Create user preferences for all users
  console.log('⚙️  Creating user preferences...');
  const userPreferences = await Promise.all(
    users.map((user) =>
      prisma.userPreferences.create({
        data: {
          userId: user.id,
          language: faker.helpers.arrayElement(['en', 'es', 'fr']),
          currency: 'USD',
          timezone: faker.helpers.arrayElement([
            'America/New_York',
            'America/Los_Angeles',
            'America/Chicago',
          ]),
          emailNotifications: faker.datatype.boolean({ probability: 0.8 }),
          pushNotifications: faker.datatype.boolean({ probability: 0.6 }),
          smsNotifications: faker.datatype.boolean({ probability: 0.3 }),
          marketingEmails: faker.datatype.boolean({ probability: 0.4 }),
          autoAcceptBookings: faker.datatype.boolean({ probability: 0.2 }),
          instantBook: faker.datatype.boolean({ probability: 0.3 }),
          minBookingDuration: faker.number.int({ min: 1, max: 7 }),
          maxBookingDuration: faker.number.int({ min: 30, max: 365 }),
          advanceBookingNotice: faker.number.int({ min: 1, max: 48 }),
        },
      }),
    ),
  );

  console.log(`✓ Created ${userPreferences.length} user preferences\n`);

  // Create sessions for users
  console.log('🔐 Creating sessions...');
  const sessions = await Promise.all(
    users.slice(0, 50).map((user) =>
      prisma.session.create({
        data: {
          userId: user.id,
          token: generateToken(),
          refreshToken: generateToken(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          ipAddress: faker.internet.ipv4(),
          userAgent: faker.internet.userAgent(),
        },
      }),
    ),
  );

  console.log(`✓ Created ${sessions.length} sessions\n`);

  // Create device tokens
  console.log('📱 Creating device tokens...');
  const deviceTokens = await Promise.all(
    users.slice(0, 40).map((user) =>
      prisma.deviceToken.create({
        data: {
          userId: user.id,
          token: `token_${faker.string.alphanumeric(32)}`,
          platform: faker.helpers.arrayElement(['ios', 'android', 'web']),
          active: faker.datatype.boolean({ probability: 0.8 }),
        },
      }),
    ),
  );

  console.log(`✓ Created ${deviceTokens.length} device tokens\n`);

  // Create organizations
  console.log('🏢 Creating organizations...');
  const hostUsers = users.filter((u) => u.role === 'HOST');
  const organizations = await Promise.all(
    hostUsers.slice(0, 15).map((user) =>
      prisma.organization.create({
        data: {
          name: faker.company.name(),
          slug: faker.helpers.slugify(faker.company.name()).toLowerCase(),
          description: faker.lorem.paragraph(),
          logo: faker.image.url(),
          website: faker.internet.url(),
          email: faker.internet.email(),
          phone: faker.phone.number(),
          address: faker.location.streetAddress(),
          city: faker.location.city(),
          state: faker.location.state(),
          country: 'USA',
          ownerId: user.id,
          businessType: faker.helpers.arrayElement(['INDIVIDUAL', 'LLC', 'CORPORATION']),
          status: 'ACTIVE',
          verificationStatus: faker.helpers.arrayElement(['PENDING', 'VERIFIED', 'REJECTED']),
        },
      }),
    ),
  );

  console.log(`✓ Created ${organizations.length} organizations\n`);

  // Create organization members
  console.log('👥 Creating organization members...');
  const orgMembers = await Promise.all(
    organizations.flatMap((org) =>
      users
        .slice(0, 5)
        .filter((u) => u.id !== org.ownerId)
        .map(
          (user) =>
            prisma.organizationMember
              .create({
                data: {
                  organizationId: org.id,
                  userId: user.id,
                  role: faker.helpers.arrayElement(['ADMIN', 'MEMBER', 'VIEWER']),
                },
              })
              .catch(() => null), // Handle unique constraint violations
        ),
    ),
  );

  console.log(`✓ Created ${orgMembers.filter(Boolean).length} organization members\n`);

  // Create listings - 100+ per category
  console.log('🏠 Creating listings...');
  const listings: any[] = [];

  for (const category of categories) {
    const listingsPerCategory =
      category.slug === 'apartment' ? 120 : category.slug === 'house' ? 110 : 100;

    for (let i = 0; i < listingsPerCategory; i++) {
      const owner = hostUsers[Math.floor(Math.random() * hostUsers.length)];
      const policy = policies[Math.floor(Math.random() * policies.length)];
      const org = organizations[Math.floor(Math.random() * organizations.length)];

      const listing = await prisma.listing.create({
        data: {
          title: `${category.name} - ${faker.lorem.words(2)}`,
          slug: `${category.slug}-${i}-${faker.string.alphanumeric(8)}`,
          description: faker.lorem.paragraphs(3),
          address: faker.location.streetAddress(),
          city: faker.location.city(),
          state: faker.location.state(),
          zipCode: faker.location.zipCode(),
          country: 'USA',
          latitude: faker.location.latitude(),
          longitude: faker.location.longitude(),
          type: faker.helpers.arrayElement(['APARTMENT', 'HOUSE', 'VILLA', 'CONDO', 'TOWNHOUSE']),
          status: faker.helpers.arrayElement(['AVAILABLE', 'RENTED', 'MAINTENANCE']),
          verificationStatus: faker.helpers.arrayElement(['PENDING', 'VERIFIED', 'REJECTED']),
          condition: faker.helpers.arrayElement(['EXCELLENT', 'GOOD', 'FAIR']),
          bookingMode: faker.helpers.arrayElement(['REQUEST', 'INSTANT_BOOK']),
          basePrice: new Prisma.Decimal(
            faker.number.float({ min: 50, max: 500, fractionDigits: 2 }),
          ),
          currency: 'USD',
          securityDeposit: new Prisma.Decimal(
            faker.number.float({ min: 100, max: 1000, fractionDigits: 2 }),
          ),
          cleaningFee: new Prisma.Decimal(
            faker.number.float({ min: 25, max: 150, fractionDigits: 2 }),
          ),
          amenities: faker.helpers.arrayElements(
            [
              'WiFi',
              'Kitchen',
              'Parking',
              'AC',
              'Heating',
              'Washer',
              'Dryer',
              'Pool',
              'Gym',
              'Elevator',
            ],
            { min: 3, max: 8 },
          ),
          features: faker.helpers.arrayElements(
            [
              'Pet Friendly',
              'Smoking Allowed',
              'Wheelchair Accessible',
              'Furnished',
              'Unfurnished',
            ],
            { min: 1, max: 3 },
          ),
          photos: Array.from(
            { length: faker.number.int({ min: 4, max: 10 }) },
            () => `https://picsum.photos/seed/${faker.string.alphanumeric(12)}/800/600.jpg`,
          ),
          rules: faker.helpers.arrayElements(
            [
              'No smoking',
              'No parties',
              'Quiet hours after 10 PM',
              'No pets',
              'No guests after midnight',
            ],
            { min: 2, max: 4 },
          ),
          ownerId: owner.id,
          categoryId: category.id,
          cancellationPolicyId: policy.id,
          organizationId: Math.random() > 0.7 ? org.id : undefined,
          bedrooms: faker.number.int({ min: 1, max: 5 }),
          bathrooms: faker.number.float({ min: 1, max: 4, fractionDigits: 1 }),
          maxGuests: faker.number.int({ min: 2, max: 10 }),
          averageRating: faker.number.float({ min: 3, max: 5, fractionDigits: 1 }),
          totalReviews: faker.number.int({ min: 0, max: 100 }),
          totalBookings: faker.number.int({ min: 0, max: 50 }),
          views: faker.number.int({ min: 0, max: 1000 }),
          instantBookable: faker.datatype.boolean({ probability: 0.6 }),
          minStayNights: faker.number.int({ min: 1, max: 7 }),
          maxStayNights: faker.number.int({ min: 30, max: 365 }),
          checkInTime: '15:00',
          checkOutTime: '11:00',
          weeklyDiscount: faker.number.int({ min: 5, max: 20 }),
          monthlyDiscount: faker.number.int({ min: 10, max: 30 }),
          featured: faker.datatype.boolean({ probability: 0.1 }),
          isActive: true,
        },
      });

      listings.push(listing);
    }
  }

  console.log(`✓ Created ${listings.length} listings\n`);

  // Create availability for listings
  console.log('📅 Creating availability records...');
  const availabilityRecords = await Promise.all(
    listings.slice(0, 200).map((listing) =>
      prisma.availability.create({
        data: {
          propertyId: listing.id,
          startDate: faker.date.future({ years: 0.5 }),
          endDate: faker.date.future({ years: 1 }),
          status: faker.helpers.arrayElement(['available', 'booked', 'blocked']),
          price: new Prisma.Decimal(faker.number.float({ min: 50, max: 500, fractionDigits: 2 })),
          notes: faker.lorem.sentence(),
        },
      }),
    ),
  );

  console.log(`✓ Created ${availabilityRecords.length} availability records\n`);

  // Create bookings
  console.log('📅 Creating bookings...');
  const bookings: any[] = [];
  const renters = users.filter((u) => u.role === 'USER' || u.role === 'CUSTOMER');

  for (let i = 0; i < 300; i++) {
    const listing = listings[Math.floor(Math.random() * listings.length)];
    const renter = renters[Math.floor(Math.random() * renters.length)];

    if (listing.ownerId === renter.id) continue;

    const startDate = faker.date.soon({ days: 90 });
    const endDate = new Date(
      startDate.getTime() + faker.number.int({ min: 1, max: 14 }) * 24 * 60 * 60 * 1000,
    );
    const nights = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const basePrice = Number(listing.basePrice);
    const totalPrice = basePrice * nights + Number(listing.cleaningFee || 0);

    try {
      const booking = await prisma.booking.create({
        data: {
          listingId: listing.id,
          ownerId: listing.ownerId,
          renterId: renter.id,
          startDate,
          endDate,
          basePrice: new Prisma.Decimal(basePrice),
          securityDeposit: listing.securityDeposit,
          cleaningFee: listing.cleaningFee,
          serviceFee: new Prisma.Decimal(totalPrice * 0.1),
          totalPrice: new Prisma.Decimal(totalPrice),
          currency: 'USD',
          status: faker.helpers.arrayElement(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']),
          guestCount: faker.number.int({ min: 1, max: 6 }),
          specialRequests: faker.lorem.sentence(),
          guestNotes: faker.lorem.sentence(),
          ownerNotes: faker.lorem.sentence(),
          checkInTime: '15:00',
          checkOutTime: '11:00',
          ownerEarnings: new Prisma.Decimal(totalPrice * 0.9),
          platformFee: new Prisma.Decimal(totalPrice * 0.1),
        },
      });

      bookings.push(booking);
    } catch (error) {
      // Skip duplicate bookings
    }
  }

  console.log(`✓ Created ${bookings.length} bookings\n`);

  // Create booking state history
  console.log('📝 Creating booking state history...');
  const stateHistory = await Promise.all(
    bookings.slice(0, 150).map((booking) =>
      prisma.bookingStateHistory.create({
        data: {
          bookingId: booking.id,
          fromStatus: 'PENDING',
          toStatus: booking.status as any,
          reason: faker.lorem.sentence(),
          changedBy: users[0].id,
        },
      }),
    ),
  );

  console.log(`✓ Created ${stateHistory.length} booking state history records\n`);

  // Create payments
  console.log('💳 Creating payments...');
  const payments = await Promise.all(
    bookings.slice(0, 200).map((booking) =>
      prisma.payment.create({
        data: {
          bookingId: booking.id,
          amount: booking.totalPrice,
          currency: 'USD',
          status: faker.helpers.arrayElement(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED']),
          paymentMethod: faker.helpers.arrayElement(['CREDIT_CARD', 'DEBIT_CARD', 'PAYPAL']),
          paymentIntentId: generatePaymentIntentId(),
          stripePaymentIntentId: generatePaymentIntentId(),
          chargeId: generateStripeId(),
          stripeChargeId: generateStripeId(),
          fee: new Prisma.Decimal(Number(booking.totalPrice) * 0.03),
          netAmount: new Prisma.Decimal(Number(booking.totalPrice) * 0.97),
          processedAt: faker.date.recent({ days: 30 }),
          description: `Payment for booking ${booking.id}`,
        },
      }),
    ),
  );

  console.log(`✓ Created ${payments.length} payments\n`);

  // Create refunds
  console.log('💰 Creating refunds...');
  const refunds = await Promise.all(
    bookings
      .filter((b) => b.status === 'CANCELLED')
      .slice(0, 50)
      .map((booking) =>
        prisma.refund.create({
          data: {
            bookingId: booking.id,
            amount: new Prisma.Decimal(Number(booking.totalPrice) * 0.8),
            currency: 'USD',
            status: faker.helpers.arrayElement(['PENDING', 'COMPLETED', 'FAILED']),
            refundId: generateRefundId(),
            reason: faker.helpers.arrayElement([
              'Guest request',
              'Host cancellation',
              'Force majeure',
            ]),
            description: faker.lorem.sentence(),
          },
        }),
      ),
  );

  console.log(`✓ Created ${refunds.length} refunds\n`);

  // Create deposit holds
  console.log('🔒 Creating deposit holds...');
  const depositHolds = await Promise.all(
    bookings.slice(0, 100).map((booking) =>
      prisma.depositHold.create({
        data: {
          bookingId: booking.id,
          amount: booking.securityDeposit || new Prisma.Decimal(0),
          currency: 'USD',
          status: faker.helpers.arrayElement(['PENDING', 'HELD', 'RELEASED', 'CAPTURED']),
          stripeId: generateStripeId(),
          paymentIntentId: generatePaymentIntentId(),
          expiresAt: faker.date.future({ days: 30 }),
          releasedAt: faker.datatype.boolean({ probability: 0.5 })
            ? faker.date.recent({ days: 30 })
            : undefined,
          capturedAt: faker.datatype.boolean({ probability: 0.3 })
            ? faker.date.recent({ days: 30 })
            : undefined,
        },
      }),
    ),
  );

  console.log(`✓ Created ${depositHolds.length} deposit holds\n`);

  // Create payouts
  console.log('💸 Creating payouts...');
  const payouts = await Promise.all(
    hostUsers.slice(0, 30).map((user) =>
      prisma.payout.create({
        data: {
          ownerId: user.id,
          amount: new Prisma.Decimal(
            faker.number.float({ min: 100, max: 5000, fractionDigits: 2 }),
          ),
          currency: 'USD',
          status: faker.helpers.arrayElement(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']),
          stripeId: `tr_${faker.string.alphanumeric(24)}`,
          transferId: `tr_${faker.string.alphanumeric(24)}`,
          paidAt: faker.datatype.boolean({ probability: 0.7 })
            ? faker.date.recent({ days: 30 })
            : undefined,
          processedAt: faker.date.recent({ days: 30 }),
        },
      }),
    ),
  );

  console.log(`✓ Created ${payouts.length} payouts\n`);

  // Create ledger entries
  console.log('📊 Creating ledger entries...');
  const ledgerEntries = await Promise.all(
    bookings.slice(0, 150).map((booking) =>
      prisma.ledgerEntry.create({
        data: {
          bookingId: booking.id,
          accountId: booking.ownerId,
          accountType: 'REVENUE',
          side: 'CREDIT',
          transactionType: 'PAYMENT',
          amount: new Prisma.Decimal(Number(booking.totalPrice) * 0.9),
          currency: 'USD',
          description: `Payment for booking ${booking.id}`,
          status: faker.helpers.arrayElement(['PENDING', 'POSTED', 'SETTLED']),
        },
      }),
    ),
  );

  console.log(`✓ Created ${ledgerEntries.length} ledger entries\n`);

  // Create reviews
  console.log('⭐ Creating reviews...');
  const reviews = await Promise.all(
    bookings
      .filter((b) => b.status === 'COMPLETED')
      .slice(0, 150)
      .map((booking) => {
        const listing = listings.find((l) => l.id === booking.listingId);
        if (!listing) return null;

        return prisma.review.create({
          data: {
            bookingId: booking.id,
            listingId: listing.id,
            reviewerId: booking.renterId,
            revieweeId: listing.ownerId,
            type: faker.helpers.arrayElement(['LISTING_REVIEW', 'RENTER_REVIEW', 'OWNER_REVIEW']),
            rating: faker.number.int({ min: 1, max: 5 }),
            overallRating: faker.number.int({ min: 1, max: 5 }),
            accuracyRating: faker.number.int({ min: 1, max: 5 }),
            communicationRating: faker.number.int({ min: 1, max: 5 }),
            cleanlinessRating: faker.number.int({ min: 1, max: 5 }),
            valueRating: faker.number.int({ min: 1, max: 5 }),
            locationRating: faker.number.int({ min: 1, max: 5 }),
            checkInRating: faker.number.int({ min: 1, max: 5 }),
            content: faker.lorem.paragraphs(2),
            response: faker.lorem.sentence(),
            status: 'PUBLISHED',
          },
        });
      })
      .filter(Boolean),
  );

  console.log(`✓ Created ${reviews.length} reviews\n`);

  // Create favorite listings
  console.log('❤️  Creating favorite listings...');
  const favorites = await Promise.all(
    users
      .slice(0, 50)
      .flatMap((user) =>
        listings.slice(0, 10).map((listing) =>
          prisma.favoriteListing
            .create({
              data: {
                userId: user.id,
                listingId: listing.id,
              },
            })
            .catch(() => null),
        ),
      )
      .filter(Boolean),
  );

  console.log(`✓ Created ${favorites.filter(Boolean).length} favorite listings\n`);

  // Create notifications
  console.log('🔔 Creating notifications...');
  const notifications = await Promise.all(
    users.slice(0, 80).map((user) =>
      prisma.notification.create({
        data: {
          userId: user.id,
          type: faker.helpers.arrayElement([
            'BOOKING_CONFIRMED',
            'BOOKING_CANCELLED',
            'PAYMENT_RECEIVED',
            'REVIEW_RECEIVED',
            'MESSAGE_RECEIVED',
          ]),
          title: faker.lorem.words(3),
          message: faker.lorem.sentence(),
          actionUrl: '/bookings',
          read: faker.datatype.boolean({ probability: 0.6 }),
          readAt: faker.datatype.boolean({ probability: 0.6 })
            ? faker.date.recent({ days: 30 })
            : undefined,
          sentViaEmail: faker.datatype.boolean({ probability: 0.8 }),
          sentViaPush: faker.datatype.boolean({ probability: 0.5 }),
          sentViaSMS: faker.datatype.boolean({ probability: 0.2 }),
        },
      }),
    ),
  );

  console.log(`✓ Created ${notifications.length} notifications\n`);

  // Create condition reports
  console.log('📸 Creating condition reports...');
  const conditionReports = await Promise.all(
    bookings.slice(0, 80).map((booking) => {
      const listing = listings.find((l) => l.id === booking.listingId);
      if (!listing) return null;

      return prisma.conditionReport.create({
        data: {
          bookingId: booking.id,
          propertyId: listing.id,
          createdBy: booking.renterId,
          checkIn: faker.datatype.boolean({ probability: 0.8 }),
          checkOut: faker.datatype.boolean({ probability: 0.6 }),
          photos: Array.from(
            { length: faker.number.int({ min: 2, max: 6 }) },
            () => `https://picsum.photos/seed/${faker.string.alphanumeric(12)}/800/600.jpg`,
          ),
          notes: faker.lorem.paragraph(),
          status: faker.helpers.arrayElement(['DRAFT', 'SUBMITTED', 'APPROVED', 'DISPUTED']),
          reportType: faker.helpers.arrayElement(['CHECK_IN', 'CHECK_OUT']),
        },
      });
    }),
  );

  console.log(`✓ Created ${conditionReports.filter(Boolean).length} condition reports\n`);

  // Create insurance policies
  console.log('🛡️  Creating insurance policies...');
  const insurancePolicies = await Promise.all(
    bookings.slice(0, 100).map((booking) => {
      const listing = listings.find((l) => l.id === booking.listingId);
      if (!listing) return null;

      return prisma.insurancePolicy.create({
        data: {
          policyNumber: `POL-${faker.string.alphanumeric(10)}`,
          bookingId: booking.id,
          propertyId: listing.id,
          userId: booking.renterId,
          type: faker.helpers.arrayElement(['PROPERTY_DAMAGE', 'LIABILITY', 'TRIP_CANCELLATION']),
          provider: faker.helpers.arrayElement([
            'Airbnb Host Protection',
            'Custom Insurance',
            'Third-party Provider',
          ]),
          coverage: new Prisma.Decimal(Number(booking.totalPrice) * 2),
          coverageAmount: new Prisma.Decimal(Number(booking.totalPrice) * 2),
          premium: new Prisma.Decimal(Number(booking.totalPrice) * 0.05),
          currency: 'USD',
          status: faker.helpers.arrayElement(['ACTIVE', 'EXPIRED', 'CANCELLED']),
          startDate: booking.startDate,
          endDate: booking.endDate,
          documents: Array.from(
            { length: faker.number.int({ min: 1, max: 3 }) },
            () => `https://example.com/doc/${faker.string.alphanumeric(12)}.pdf`,
          ),
        },
      });
    }),
  );

  console.log(`✓ Created ${insurancePolicies.filter(Boolean).length} insurance policies\n`);

  // Create insurance claims
  console.log('📋 Creating insurance claims...');
  const insuranceClaims = await Promise.all(
    insurancePolicies
      .filter(Boolean)
      .slice(0, 30)
      .map((policy) =>
        prisma.insuranceClaim.create({
          data: {
            policyId: policy!.id,
            bookingId: policy!.bookingId,
            propertyId: policy!.propertyId,
            claimNumber: `CLM-${faker.string.alphanumeric(10)}`,
            claimAmount: new Prisma.Decimal(
              faker.number.float({ min: 100, max: 2000, fractionDigits: 2 }),
            ),
            description: faker.lorem.paragraph(),
            incidentDate: faker.date.recent({ days: 30 }),
            status: faker.helpers.arrayElement(['PENDING', 'APPROVED', 'REJECTED', 'PAID']),
            approvedAmount: new Prisma.Decimal(
              faker.number.float({ min: 50, max: 1500, fractionDigits: 2 }),
            ),
            rejectionReason: faker.datatype.boolean({ probability: 0.3 })
              ? faker.lorem.sentence()
              : undefined,
            documents: Array.from(
              { length: faker.number.int({ min: 1, max: 3 }) },
              () => `https://example.com/doc/${faker.string.alphanumeric(12)}.pdf`,
            ),
            notes: faker.lorem.sentence(),
          },
        }),
      ),
  );

  console.log(`✓ Created ${insuranceClaims.length} insurance claims\n`);

  // Create conversations
  console.log('💬 Creating conversations...');
  const conversations = await Promise.all(
    bookings.slice(0, 100).map((booking) => {
      const listing = listings.find((l) => l.id === booking.listingId);
      if (!listing) return null;

      return prisma.conversation.create({
        data: {
          bookingId: booking.id,
          listingId: listing.id,
          type: faker.helpers.arrayElement(['GENERAL', 'BOOKING', 'DISPUTE']),
          status: faker.helpers.arrayElement(['ACTIVE', 'ARCHIVED', 'CLOSED']),
          lastMessageAt: faker.date.recent({ days: 30 }),
        },
      });
    }),
  );

  console.log(`✓ Created ${conversations.filter(Boolean).length} conversations\n`);

  // Create conversation participants
  console.log('👥 Creating conversation participants...');
  const conversationParticipants = await Promise.all(
    conversations.filter(Boolean).flatMap((conv) => {
      const booking = bookings.find((b) => b.id === conv!.bookingId);
      if (!booking) return [];

      return [
        prisma.conversationParticipant.create({
          data: {
            conversationId: conv!.id,
            userId: booking.renterId,
            lastReadAt: faker.date.recent({ days: 30 }),
          },
        }),
        prisma.conversationParticipant.create({
          data: {
            conversationId: conv!.id,
            userId: booking.ownerId,
            lastReadAt: faker.date.recent({ days: 30 }),
          },
        }),
      ];
    }),
  );

  console.log(`✓ Created ${conversationParticipants.length} conversation participants\n`);

  // Create messages
  console.log('✉️  Creating messages...');
  const messages = await Promise.all(
    conversations
      .filter(Boolean)
      .slice(0, 80)
      .flatMap((conv) =>
        Array.from({ length: faker.number.int({ min: 2, max: 8 }) }, async () => {
          const booking = bookings.find((b) => b.id === conv!.bookingId);
          if (!booking) return null;

          const sender = faker.datatype.boolean() ? booking.renterId : booking.ownerId;

          return prisma.message.create({
            data: {
              conversationId: conv!.id,
              senderId: sender,
              content: faker.lorem.sentences(2),
              type: 'TEXT',
              attachments: faker.datatype.boolean({ probability: 0.2 })
                ? Array.from(
                    { length: faker.number.int({ min: 1, max: 2 }) },
                    () => `https://example.com/file/${faker.string.alphanumeric(12)}`,
                  )
                : [],
              readAt: faker.datatype.boolean({ probability: 0.7 })
                ? faker.date.recent({ days: 30 })
                : undefined,
            },
          });
        }),
      )
      .filter(Boolean),
  );

  console.log(`✓ Created ${messages.filter(Boolean).length} messages\n`);

  // Create message read receipts
  console.log('✅ Creating message read receipts...');
  const messageReadReceipts = await Promise.all(
    messages
      .filter(Boolean)
      .slice(0, 100)
      .map((msg) => {
        const booking = bookings.find(
          (b) => b.id === conversations.find((c) => c?.id === msg!.conversationId)?.bookingId,
        );
        if (!booking) return null;

        const recipientId = msg!.senderId === booking.renterId ? booking.ownerId : booking.renterId;

        return prisma.messageReadReceipt
          .create({
            data: {
              messageId: msg!.id,
              userId: recipientId,
              readAt: faker.date.recent({ days: 30 }),
            },
          })
          .catch(() => null);
      }),
  );

  console.log(`✓ Created ${messageReadReceipts.filter(Boolean).length} message read receipts\n`);

  // Create disputes
  console.log('⚖️  Creating disputes...');
  const disputes = await Promise.all(
    bookings
      .filter((b) => b.status === 'COMPLETED')
      .slice(0, 40)
      .map((booking) =>
        prisma.dispute.create({
          data: {
            bookingId: booking.id,
            initiatorId: faker.datatype.boolean() ? booking.renterId : booking.ownerId,
            defendantId: faker.datatype.boolean() ? booking.ownerId : booking.renterId,
            assignedTo: users[0].id,
            title: faker.lorem.words(4),
            type: faker.helpers.arrayElement(['PROPERTY_DAMAGE', 'PAYMENT_ISSUE', 'CANCELLATION']),
            status: faker.helpers.arrayElement([
              'OPEN',
              'UNDER_REVIEW',
              'INVESTIGATING',
              'RESOLVED',
            ]),
            priority: faker.helpers.arrayElement(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
            description: faker.lorem.paragraph(),
            amount: new Prisma.Decimal(
              faker.number.float({ min: 50, max: 1000, fractionDigits: 2 }),
            ),
            resolvedAt: faker.datatype.boolean({ probability: 0.6 })
              ? faker.date.recent({ days: 30 })
              : undefined,
          },
        }),
      ),
  );

  console.log(`✓ Created ${disputes.length} disputes\n`);

  // Create dispute evidence
  console.log('📸 Creating dispute evidence...');
  const disputeEvidence = await Promise.all(
    disputes.slice(0, 30).flatMap((dispute) =>
      Array.from({ length: faker.number.int({ min: 1, max: 4 }) }, () =>
        prisma.disputeEvidence.create({
          data: {
            disputeId: dispute.id,
            type: faker.helpers.arrayElement(['photo', 'document', 'message', 'receipt']),
            url: `https://example.com/evidence/${faker.string.alphanumeric(12)}`,
            caption: faker.lorem.sentence(),
            uploadedBy: dispute.initiatorId,
          },
        }),
      ),
    ),
  );

  console.log(`✓ Created ${disputeEvidence.length} dispute evidence records\n`);

  // Create dispute responses
  console.log('💬 Creating dispute responses...');
  const disputeResponses = await Promise.all(
    disputes.slice(0, 25).flatMap((dispute) =>
      Array.from({ length: faker.number.int({ min: 1, max: 3 }) }, () =>
        prisma.disputeResponse.create({
          data: {
            disputeId: dispute.id,
            userId: faker.datatype.boolean() ? dispute.initiatorId : dispute.defendantId,
            content: faker.lorem.paragraph(),
            type: faker.helpers.arrayElement(['statement', 'evidence', 'counter_claim']),
            attachments: faker.datatype.boolean({ probability: 0.3 })
              ? Array.from(
                  { length: faker.number.int({ min: 1, max: 2 }) },
                  () => `https://example.com/file/${faker.string.alphanumeric(12)}`,
                )
              : [],
          },
        }),
      ),
    ),
  );

  console.log(`✓ Created ${disputeResponses.length} dispute responses\n`);

  // Create dispute timeline events
  console.log('📅 Creating dispute timeline events...');
  const disputeTimelineEvents = await Promise.all(
    disputes.slice(0, 35).flatMap((dispute) =>
      Array.from({ length: faker.number.int({ min: 2, max: 5 }) }, () =>
        prisma.disputeTimelineEvent.create({
          data: {
            disputeId: dispute.id,
            event: faker.helpers.arrayElement([
              'created',
              'assigned',
              'evidence_added',
              'response_added',
              'resolved',
            ]),
            details: faker.lorem.sentence(),
          },
        }),
      ),
    ),
  );

  console.log(`✓ Created ${disputeTimelineEvents.length} dispute timeline events\n`);

  // Create dispute resolutions
  console.log('✅ Creating dispute resolutions...');
  const disputeResolutions = await Promise.all(
    disputes
      .filter((d) => d.status === 'RESOLVED')
      .slice(0, 20)
      .map((dispute) =>
        prisma.disputeResolution.create({
          data: {
            disputeId: dispute.id,
            type: faker.helpers.arrayElement(['FULL_REFUND', 'PARTIAL_REFUND', 'CHARGE_BACK']),
            outcome: faker.lorem.sentence(),
            amount: new Prisma.Decimal(faker.number.float({ min: 0, max: 500, fractionDigits: 2 })),
            details: faker.lorem.paragraph(),
            resolvedBy: users[0].id,
          },
        }),
      ),
  );

  console.log(`✓ Created ${disputeResolutions.length} dispute resolutions\n`);

  // Create audit logs
  console.log('📝 Creating audit logs...');
  const auditLogs = await Promise.all(
    users.slice(0, 50).map((user) =>
      prisma.auditLog.create({
        data: {
          userId: user.id,
          action: faker.helpers.arrayElement(['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT']),
          entityType: faker.helpers.arrayElement(['Listing', 'Booking', 'User', 'Payment']),
          entityId: listings[0].id,
          oldValues: JSON.stringify({ status: 'PENDING' }),
          newValues: JSON.stringify({ status: 'ACTIVE' }),
          ipAddress: faker.internet.ipv4(),
          userAgent: faker.internet.userAgent(),
        },
      }),
    ),
  );

  console.log(`✓ Created ${auditLogs.length} audit logs\n`);

  // Summary
  console.log('\n🎉 Database seeding completed successfully!\n');
  console.log('========================================');
  console.log('📊 SEEDING SUMMARY');
  console.log('========================================');
  console.log(`Users: ${users.length}`);
  console.log(`User Preferences: ${userPreferences.length}`);
  console.log(`Sessions: ${sessions.length}`);
  console.log(`Device Tokens: ${deviceTokens.length}`);
  console.log(`Categories: ${categories.length}`);
  console.log(`Cancellation Policies: ${policies.length}`);
  console.log(`Email Templates: ${emailTemplates.length}`);
  console.log(`Organizations: ${organizations.length}`);
  console.log(`Organization Members: ${orgMembers.filter(Boolean).length}`);
  console.log(`Listings: ${listings.length}`);
  console.log(`Availability Records: ${availabilityRecords.length}`);
  console.log(`Bookings: ${bookings.length}`);
  console.log(`Booking State History: ${stateHistory.length}`);
  console.log(`Payments: ${payments.length}`);
  console.log(`Refunds: ${refunds.length}`);
  console.log(`Deposit Holds: ${depositHolds.length}`);
  console.log(`Payouts: ${payouts.length}`);
  console.log(`Ledger Entries: ${ledgerEntries.length}`);
  console.log(`Reviews: ${reviews.length}`);
  console.log(`Favorite Listings: ${favorites.filter(Boolean).length}`);
  console.log(`Notifications: ${notifications.length}`);
  console.log(`Condition Reports: ${conditionReports.filter(Boolean).length}`);
  console.log(`Insurance Policies: ${insurancePolicies.filter(Boolean).length}`);
  console.log(`Insurance Claims: ${insuranceClaims.length}`);
  console.log(`Conversations: ${conversations.filter(Boolean).length}`);
  console.log(`Conversation Participants: ${conversationParticipants.length}`);
  console.log(`Messages: ${messages.filter(Boolean).length}`);
  console.log(`Message Read Receipts: ${messageReadReceipts.filter(Boolean).length}`);
  console.log(`Disputes: ${disputes.length}`);
  console.log(`Dispute Evidence: ${disputeEvidence.length}`);
  console.log(`Dispute Responses: ${disputeResponses.length}`);
  console.log(`Dispute Timeline Events: ${disputeTimelineEvents.length}`);
  console.log(`Dispute Resolutions: ${disputeResolutions.length}`);
  console.log(`Audit Logs: ${auditLogs.length}`);
  console.log('========================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
