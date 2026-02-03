import { config } from 'dotenv';
import { PrismaClient, Prisma, BookingStatus } from '@prisma/client';
import bcrypt from 'bcrypt';
import { faker } from '@faker-js/faker';

// Load environment variables from root .env file
config({ path: '../../.env' });

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting comprehensive database seeding...');

  // Clean existing data - order matters due to foreign keys
  console.log('🧹 Cleaning existing data...');
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
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();

  console.log('✓ Cleaned existing data');

  // ============= CREATE CANCELLATION POLICIES =============
  console.log('\n📋 Creating cancellation policies...');
  const policies = await Promise.all([
    prisma.cancellationPolicy.create({
      data: {
        name: 'Flexible',
        description: 'Full refund up to 24 hours before check-in',
        type: 'flexible',
        fullRefundHours: 24,
        partialRefundHours: 48,
        partialRefundPercent: 0.5,
        noRefundHours: 0,
      },
    }),
    prisma.cancellationPolicy.create({
      data: {
        name: 'Moderate',
        description: 'Full refund up to 5 days before check-in',
        type: 'moderate',
        fullRefundHours: 120,
        partialRefundHours: 168,
        partialRefundPercent: 0.5,
        noRefundHours: 24,
      },
    }),
    prisma.cancellationPolicy.create({
      data: {
        name: 'Strict',
        description: 'Full refund up to 14 days before check-in',
        type: 'strict',
        fullRefundHours: 336,
        partialRefundHours: 168,
        partialRefundPercent: 0.25,
        noRefundHours: 48,
      },
    }),
    prisma.cancellationPolicy.create({
      data: {
        name: 'Super Flexible',
        description: 'Full refund up to 48 hours before check-in',
        type: 'super_flexible',
        fullRefundHours: 48,
        partialRefundHours: 72,
        partialRefundPercent: 0.75,
        noRefundHours: 0,
      },
    }),
  ]);
  console.log(`✓ Created ${policies.length} cancellation policies`);

  // ============= CREATE CATEGORIES =============
  console.log('📂 Creating comprehensive categories...');
  const categories = await Promise.all([
    // ===== ACCOMMODATION CATEGORIES =====
    prisma.category.create({
      data: {
        name: 'Apartment',
        slug: 'apartment',
        description: 'Self-contained living units within larger buildings',
        icon: 'apartment',
      },
    }),
    prisma.category.create({
      data: {
        name: 'House',
        slug: 'house',
        description: 'Detached single-family homes',
        icon: 'house',
      },
    }),
    prisma.category.create({
      data: {
        name: 'Villa',
        slug: 'villa',
        description: 'Luxury private homes with amenities',
        icon: 'villa',
      },
    }),
    prisma.category.create({
      data: {
        name: 'Studio',
        slug: 'studio',
        description: 'Open-plan single room apartments',
        icon: 'studio',
      },
    }),
    prisma.category.create({
      data: {
        name: 'Condo',
        slug: 'condo',
        description: 'Condominiums with shared amenities',
        icon: 'condo',
      },
    }),
    prisma.category.create({
      data: {
        name: 'Townhouse',
        slug: 'townhouse',
        description: 'Multi-story urban residences',
        icon: 'townhouse',
      },
    }),
    prisma.category.create({
      data: {
        name: 'Cottage',
        slug: 'cottage',
        description: 'Charming rural or seaside retreats',
        icon: 'cottage',
      },
    }),
    // ===== VEHICLE CATEGORIES =====
    prisma.category.create({
      data: {
        name: 'Cars',
        slug: 'cars',
        description: 'Automobiles for personal transportation',
        icon: 'car',
      },
    }),
    prisma.category.create({
      data: {
        name: 'Motorcycles',
        slug: 'motorcycles',
        description: 'Two-wheeled motor vehicles',
        icon: 'motorcycle',
      },
    }),
    prisma.category.create({
      data: {
        name: 'Bicycles',
        slug: 'bicycles',
        description: 'Human-powered two-wheeled vehicles',
        icon: 'bicycle',
      },
    }),
    prisma.category.create({
      data: {
        name: 'RVs & Campers',
        slug: 'rvs-campers',
        description: 'Recreational vehicles and camping equipment',
        icon: 'rv',
      },
    }),
    prisma.category.create({
      data: {
        name: 'Boats',
        slug: 'boats',
        description: 'Watercraft for recreation and transportation',
        icon: 'boat',
      },
    }),
    // ===== INSTRUMENTS CATEGORIES =====
    prisma.category.create({
      data: {
        name: 'Musical Instruments',
        slug: 'musical-instruments',
        description: 'Instruments for making music',
        icon: 'music',
      },
    }),
    prisma.category.create({
      data: {
        name: 'Audio Equipment',
        slug: 'audio-equipment',
        description: 'Sound systems and audio gear',
        icon: 'audio',
      },
    }),
    // ===== EVENT CATEGORIES =====
    prisma.category.create({
      data: {
        name: 'Event Venues',
        slug: 'event-venues',
        description: 'Spaces for hosting events and gatherings',
        icon: 'venue',
      },
    }),
    prisma.category.create({
      data: {
        name: 'Event Equipment',
        slug: 'event-equipment',
        description: 'Equipment and furniture for events',
        icon: 'equipment',
      },
    }),
    // ===== WEARABLES CATEGORIES =====
    prisma.category.create({
      data: {
        name: 'Formal Wear',
        slug: 'formal-wear',
        description: 'Formal clothing and accessories',
        icon: 'formal',
      },
    }),
    prisma.category.create({
      data: {
        name: 'Sports Equipment',
        slug: 'sports-equipment',
        description: 'Sports gear and athletic equipment',
        icon: 'sports',
      },
    }),
    prisma.category.create({
      data: {
        name: 'Photography Equipment',
        slug: 'photography-equipment',
        description: 'Cameras and photography gear',
        icon: 'camera',
      },
    }),
    prisma.category.create({
      data: {
        name: 'Party Supplies',
        slug: 'party-supplies',
        description: 'Decorations and supplies for celebrations',
        icon: 'party',
      },
    }),
  ]);
  console.log(
    `✓ Created ${categories.length} categories (ACCOMMODATION: 7, VEHICLES: 5, INSTRUMENTS: 2, EVENTS: 2, WEARABLES: 4)`,
  );

  // ============= CREATE USERS =============
  console.log('👥 Creating users...');
  const users = [];
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Admin user
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@rental-portal.com',
      username: 'admin',
      password: 'password123',
      passwordHash: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      phone: '+1-555-0100',
      role: 'ADMIN',
      status: 'ACTIVE',
      isActive: true,
      emailVerified: true,
      phoneVerified: true,
      averageRating: 5,
      totalReviews: 10,
      responseRate: 100,
      responseTime: '< 1 hour',
      city: 'New York',
      state: 'NY',
      country: 'USA',
    },
  });
  users.push(adminUser);

  // Create diverse user profiles with ALL statuses and roles for comprehensive testing
  const userDescriptions = [
    // ACTIVE users with different roles
    { role: 'USER' as const, status: 'ACTIVE' as const, verified: true },
    { role: 'HOST' as const, status: 'ACTIVE' as const, verified: true },
    { role: 'ADMIN' as const, status: 'ACTIVE' as const, verified: true },
    { role: 'CUSTOMER' as const, status: 'ACTIVE' as const, verified: true },
    // Different user statuses
    { role: 'USER' as const, status: 'SUSPENDED' as const, verified: true },
    { role: 'USER' as const, status: 'PENDING_VERIFICATION' as const, verified: false },
    { role: 'HOST' as const, status: 'DELETED' as const, verified: true },
    // Unverified users
    { role: 'USER' as const, status: 'ACTIVE' as const, verified: false },
    { role: 'HOST' as const, status: 'ACTIVE' as const, verified: false },
  ];

  // Create a SUPER_ADMIN user explicitly
  const superAdminUser = await prisma.user.create({
    data: {
      email: 'superadmin@rental-portal.com',
      username: 'superadmin',
      password: 'password123',
      passwordHash: hashedPassword,
      firstName: 'Super',
      lastName: 'Admin',
      phone: '+1-555-0099',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      isActive: true,
      emailVerified: true,
      phoneVerified: true,
      averageRating: 5,
      totalReviews: 0,
      responseRate: 100,
      responseTime: '< 1 hour',
      city: 'San Francisco',
      state: 'CA',
      country: 'USA',
      mfaEnabled: true,
      mfaSecret: 'JBSWY3DPEHPK3PXP', // Test MFA secret
    },
  });
  users.push(superAdminUser);

  // Create a HOST user explicitly
  const hostUser = await prisma.user.create({
    data: {
      email: 'host@rental-portal.com',
      username: 'testhost',
      password: 'password123',
      passwordHash: hashedPassword,
      firstName: 'Test',
      lastName: 'Host',
      phone: '+1-555-0101',
      role: 'HOST',
      status: 'ACTIVE',
      isActive: true,
      emailVerified: true,
      phoneVerified: true,
      averageRating: 4.8,
      totalReviews: 45,
      responseRate: 98,
      responseTime: '< 1 hour',
      city: 'Miami',
      state: 'FL',
      country: 'USA',
    },
  });
  users.push(hostUser);

  // Create a user with MFA enabled
  const mfaUser = await prisma.user.create({
    data: {
      email: 'mfa-user@rental-portal.com',
      username: 'mfauser',
      password: 'password123',
      passwordHash: hashedPassword,
      firstName: 'MFA',
      lastName: 'Enabled',
      phone: '+1-555-0102',
      role: 'USER',
      status: 'ACTIVE',
      isActive: true,
      emailVerified: true,
      phoneVerified: true,
      mfaEnabled: true,
      mfaSecret: 'JBSWY3DPEHPK3PXP',
      city: 'Seattle',
      state: 'WA',
      country: 'USA',
    },
  });
  users.push(mfaUser);

  for (let i = 0; i < 50; i++) {
    const description = userDescriptions[i % userDescriptions.length];
    const user = await prisma.user.create({
      data: {
        email: faker.internet.email(),
        username: faker.internet.username(),
        password: 'password123',
        passwordHash: hashedPassword,
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        phone: faker.phone.number(),
        profilePhotoUrl: faker.image.avatar(),
        bio: faker.lorem.sentence(),
        role: description.role,
        status: description.status,
        isActive: description.status === 'ACTIVE',
        emailVerified: description.verified,
        phoneVerified: description.verified,
        averageRating: description.verified
          ? faker.number.float({ min: 3, max: 5, fractionDigits: 1 })
          : 0,
        totalReviews: description.verified ? faker.number.int({ min: 0, max: 100 }) : 0,
        responseRate: description.verified ? faker.number.int({ min: 80, max: 100 }) : 0,
        responseTime: '< 2 hours',
        city: faker.location.city(),
        state: faker.location.state(),
        country: 'USA',
        lastLoginAt: new Date(
          Date.now() - faker.number.int({ min: 0, max: 30 * 24 * 60 * 60 * 1000 }),
        ),
        mfaEnabled: faker.datatype.boolean({ probability: 0.1 }),
      },
    ]);
  } else if (categoryName.includes('event venue')) {
    // Event Venues
    selectedFeatures = faker.helpers.arrayElements(eventVenueAmenities, { min: 6, max: 12 });
    categoryDescriptor = faker.helpers.arrayElement([
      'Rooftop',
      'Ballroom',
      'Garden',
      'Conference Hall',
      'Warehouse',
      'Loft',
      'Beach Club',
      'Banquet Hall',
      'Private Estate',
      'Historic Manor',
    ]);
  } else if (categoryName.includes('event equipment')) {
    // Event Equipment
    selectedFeatures = faker.helpers.arrayElements(eventEquipmentFeatures, { min: 5, max: 10 });
    categoryDescriptor = faker.helpers.arrayElement([
      'LED Lighting',
      'Sound System',
      'DJ Booth',
      'Dance Floor',
      'Tent',
      'Heater',
      'Photo Booth',
      'Projector',
      'Screen',
      'Stage Platform',
      'Podium',
    ]);
  } else if (
    categoryName.includes('formal') ||
    categoryName.includes('sports') ||
    categoryName.includes('photography') ||
    categoryName.includes('party')
  ) {
    // Wearables & Other Items
    selectedFeatures = faker.helpers.arrayElements(sportFeatures, { min: 4, max: 10 });
    categoryDescriptor = faker.helpers.arrayElement([
      'Luxury Dress',
      'Designer Suit',
      'Running Gear',
      'Camping Equipment',
      'Camera Lens',
      'Party Decoration',
      'Costume',
      'Accessory Bundle',
      'Premium Outfit',
      'Vintage Item',
    ]);
  }

  const policy = policies[faker.number.int({ min: 0, max: policies.length - 1 })];
  const org = faker.datatype.boolean({ probability: 0.4 })
    ? organizations[faker.number.int({ min: 0, max: organizations.length - 1 })]
    : null;

  // Cycle through ALL property statuses to ensure complete coverage
  const status = allPropertyStatuses[i % allPropertyStatuses.length];
  const verificationStatus = allVerificationStatuses[i % allVerificationStatuses.length];
  const condition = allPropertyConditions[i % allPropertyConditions.length];
  const bookingMode = allBookingModes[i % allBookingModes.length];

  // Strategic price distribution for filter testing
  const priceRange = priceRanges[i % priceRanges.length];
  const basePrice = faker.number.float({
    min: priceRange.min,
    max: priceRange.max,
    fractionDigits: 2,
  });

  const listing = await prisma.listing.create({
    data: {
      title: faker.helpers
        .arrayElement([
          'Premium {{descriptor}}',
          'Luxury {{descriptor}}',
          'Modern {{descriptor}}',
          'High-Quality {{descriptor}}',
          'Professional {{descriptor}}',
          'Top-Tier {{descriptor}}',
          'Elite {{descriptor}}',
          'Premium Grade {{descriptor}}',
        ])
        .replace('{{descriptor}}', categoryDescriptor),
      slug: `${categoryName}-${i}-${faker.string.alphanumeric(8)}`,
      description: faker.lorem.paragraphs(2),
      address: faker.location.streetAddress(),
      city: faker.location.city(),
      state: faker.location.state(),
      zipCode: faker.location.zipCode(),
      country: 'USA',
      latitude: faker.location.latitude(),
      longitude: faker.location.longitude(),
      type: faker.helpers.arrayElement(propertyTypes) as any,
      status: status as any,
      verificationStatus: verificationStatus as any,
      condition: condition as any,
      bookingMode: bookingMode as any,
      bedrooms:
        categoryName.includes('apartment') || categoryName.includes('house')
          ? faker.number.int({ min: 1, max: 5 })
          : undefined,
      bathrooms:
        categoryName.includes('apartment') || categoryName.includes('house')
          ? faker.number.int({ min: 1, max: 4 })
          : undefined,
      maxGuests:
        categoryName.includes('apartment') || categoryName.includes('house')
          ? faker.number.int({ min: 2, max: 12 })
          : faker.number.int({ min: 1, max: 6 }),
      basePrice: new Prisma.Decimal(basePrice),
      currency: 'USD',
      securityDeposit: new Prisma.Decimal(basePrice * 2),
      cleaningFee: new Prisma.Decimal(Math.max(25, basePrice * 0.2)),
      amenities: selectedFeatures,
      features: faker.helpers.arrayElements(selectedFeatures, { min: 3, max: 8 }),
      images: Array.from(
        { length: faker.number.int({ min: 5, max: 12 }) },
        () => `https://picsum.photos/seed/${faker.string.alphanumeric(10)}/800/600.jpg`,
      ),
      photos: Array.from(
        { length: faker.number.int({ min: 5, max: 12 }) },
        () => `https://picsum.photos/seed/${faker.string.alphanumeric(10)}/800/600.jpg`,
      ),
      rules: [
        'Respect the item/property',
        'Return on time',
        'No damage policy',
        'Keep clean',
        faker.helpers.arrayElement([
          'Insurance required',
          'Deposit required',
          'ID verification required',
        ]),
      ],
      ownerId: owner.id,
      categoryId: category.id,
      cancellationPolicyId: policy.id,
      organizationId: org?.id,
    },
  });
  listings.push(listing);
}

// ... (rest of the code remains the same)

// ============= CREATE INSURANCE POLICIES =============
console.log('🛡️ Creating insurance policies with ALL types and statuses...');
let policyCount = 0;
// ALL insurance types and statuses for comprehensive coverage
const allInsuranceTypes = ['PROPERTY_DAMAGE', 'LIABILITY', 'TRIP_CANCELLATION', 'MEDICAL'];
const allInsuranceStatuses = ['ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING'];

for (let i = 0; i < Math.min(bookings.length, 40); i++) {
  const booking = bookings[i];
  const property = listings.find((p) => p.id === booking.listingId);
  try {
    await prisma.insurancePolicy.create({
      data: {
        bookingId: booking.id,
        listingId: property?.id || listings[0].id,
        userId: booking.renterId,
        policyNumber: `POL-${faker.string.alphanumeric(10)}`,
        provider: faker.helpers.arrayElement([
          'Airbnb Host Protection',
          'Custom Insurance',
          'Third-party Provider',
          'Platform Insurance',
        ]),
        coverage: new Prisma.Decimal(Number(booking.totalPrice) * 2),
        premium: new Prisma.Decimal(Number(booking.totalPrice) * 0.05),
        type: allInsuranceTypes[i % allInsuranceTypes.length],
        startDate: booking.startDate,
        endDate: booking.endDate,
        status: allInsuranceStatuses[i % allInsuranceStatuses.length],
        documents: [],
      },
    });
    policyCount++;
  } catch (error) {
    // Skip
  }
}
console.log(
  `✓ Created ${policyCount} insurance policies (all types: ${allInsuranceTypes.join(', ')}, statuses: ${allInsuranceStatuses.join(', ')})`,
);

// ... (rest of the code remains the same)

      // Add response
      if (faker.datatype.boolean()) {
        await prisma.disputeResponse.create({
          data: {
            disputeId: dispute.id,
            userId: dispute.defendantId,
            content: faker.lorem.paragraphs(2),
            type: 'statement',
            attachments: faker.datatype.boolean()
              ? [`https://example.com/response/${faker.string.alphanumeric(10)}.pdf`]
              : [],
          },
        });
      }

      // Add resolution for resolved/closed disputes
      if (['RESOLVED', 'CLOSED', 'DISMISSED'].includes(dispute.status)) {
        const resolutionTypes = [
          'FULL_REFUND',
          'PARTIAL_REFUND',
          'CHARGE_BACK',
          'COMPENSATION',
          'DISMISSED',
        ];
        await prisma.disputeResolution.create({
          data: {
            disputeId: dispute.id,
            resolvedBy: adminUser.id,
            resolutionType: resolutionTypes[i % resolutionTypes.length],
            refundAmount: new Prisma.Decimal(
              faker.number.float({ min: 0, max: Number(dispute.amount), fractionDigits: 2 }),
            ),
            summary: faker.lorem.paragraph(),
            notes: faker.lorem.sentence(),
          },
        });
      }

      // Add timeline event
      await prisma.disputeTimelineEvent.create({
        data: {
          disputeId: dispute.id,
          event: 'created',
          details: 'Dispute created',
        },
      });
    } catch (error) {
      // Skip
    }
  }
  console.log(
    `✓ Created ${disputeCount} disputes with ALL types (${allDisputeTypes.join(', ')}) and statuses (${allDisputeStatuses.join(', ')})`,
  );

  // ============= CREATE NOTIFICATIONS =============
  console.log('🔔 Creating notifications with ALL types...');
  let notificationCount = 0;
  // ALL notification types for comprehensive coverage
  const allNotificationTypes = [
    'BOOKING_REQUEST',
    'BOOKING_CONFIRMED',
    'BOOKING_CANCELLED',
    'BOOKING_REMINDER',
    'PAYMENT_RECEIVED',
    'REVIEW_RECEIVED',
    'MESSAGE_RECEIVED',
    'SYSTEM_UPDATE',
    'SYSTEM_ANNOUNCEMENT',
    'MARKETING',
    'PAYOUT_PROCESSED',
    'VERIFICATION_COMPLETE',
    'DISPUTE_OPENED',
    'LISTING_APPROVED',
  ];

  for (let i = 0; i < Math.min(users.length, 30); i++) {
    const numNotifications = faker.number.int({ min: 3, max: 10 });

    for (let j = 0; j < numNotifications; j++) {
      try {
        await prisma.notification.create({
          data: {
            userId: users[i].id,
            type: allNotificationTypes[(i + j) % allNotificationTypes.length] as any,
            title: faker.lorem.sentence(),
            message: faker.lorem.sentences(2),
            read: faker.datatype.boolean({ probability: 0.6 }),
            createdAt: new Date(
              Date.now() - faker.number.int({ min: 0, max: 30 * 24 * 60 * 60 * 1000 }),
            ),
          },
        });
        notificationCount++;
      } catch (error) {
        // Skip
      }
    }
  }
  console.log(
    `✓ Created ${notificationCount} notifications (all types: ${allNotificationTypes.join(', ')})`,
  );

  // ============= CREATE USER PREFERENCES =============
  console.log('⚙️ Creating user preferences...');
  let prefCount = 0;
  for (let i = 0; i < Math.min(users.length, 25); i++) {
    try {
      await prisma.userPreferences.create({
        data: {
          userId: users[i].id,
          language: faker.helpers.arrayElement(['en', 'es', 'fr', 'de']),
          currency: faker.helpers.arrayElement(['USD', 'EUR', 'GBP']),
          timezone: faker.helpers.arrayElement(['UTC', 'EST', 'CST', 'MST', 'PST']),
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
    } catch (error) {
      // Skip duplicates
    }
  }
  console.log(`✓ Created ${prefCount} user preferences`);

  // ============= CREATE SESSIONS =============
  console.log('🔐 Creating sessions...');
  let sessionCount = 0;
  for (let i = 0; i < Math.min(users.length, 15); i++) {
    try {
      await prisma.session.create({
        data: {
          userId: users[i].id,
          token: `session_${faker.string.alphanumeric(32)}`,
          userAgent: faker.internet.userAgent(),
          ipAddress: faker.internet.ipv4(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      sessionCount++;
    } catch (error) {
      // Skip
    }
  }
  console.log(`✓ Created ${sessionCount} sessions`);

  // ============= CREATE PAYOUTS =============
  console.log('💰 Creating payouts with ALL statuses...');
  let payoutCount = 0;
  const propertyOwners = [...new Set(properties.map((p) => p.ownerId))];
  // ALL payout statuses for comprehensive coverage
  const allPayoutStatuses = [
    'PENDING',
    'PROCESSING',
    'IN_TRANSIT',
    'COMPLETED',
    'PAID',
    'FAILED',
    'CANCELLED',
  ];

  for (let i = 0; i < propertyOwners.length; i++) {
    const ownerId = propertyOwners[i];
    try {
      const status = allPayoutStatuses[i % allPayoutStatuses.length];
      await prisma.payout.create({
        data: {
          ownerId,
          amount: new Prisma.Decimal(
            faker.number.float({ min: 500, max: 5000, fractionDigits: 2 }),
          ),
          currency: 'USD',
          status: status,
          transferId: `transfer_${faker.string.alphanumeric(24)}`,
          paidAt: ['COMPLETED', 'PAID'].includes(status) ? new Date() : null,
          processedAt: ['COMPLETED', 'PAID', 'IN_TRANSIT'].includes(status) ? new Date() : null,
        },
      });
      payoutCount++;
    } catch (error) {
      // Skip
    }
  }
  console.log(`✓ Created ${payoutCount} payouts (all statuses: ${allPayoutStatuses.join(', ')})`);

  // ============= CREATE DEPOSIT HOLDS =============
  console.log('🔒 Creating deposit holds with ALL statuses...');
  let depositCount = 0;
  // ALL deposit statuses for comprehensive coverage
  const allDepositStatuses = ['PENDING', 'AUTHORIZED', 'HELD', 'RELEASED', 'CAPTURED', 'FAILED'];

  for (let i = 0; i < Math.min(bookings.length, 36); i++) {
    const booking = bookings[i];
    if (booking.securityDeposit && Number(booking.securityDeposit) > 0) {
      try {
        const status = allDepositStatuses[i % allDepositStatuses.length];
        await prisma.depositHold.create({
          data: {
            bookingId: booking.id,
            amount: booking.securityDeposit,
            currency: 'USD',
            status: status,
            paymentIntentId: `pi_deposit_${faker.string.alphanumeric(24)}`,
            expiresAt: new Date(booking.endDate.getTime() + 7 * 24 * 60 * 60 * 1000),
            releasedAt: status === 'RELEASED' ? new Date() : null,
            capturedAt: status === 'CAPTURED' ? new Date() : null,
          },
        });
        depositCount++;
      } catch (error) {
        // Skip
      }
    }
  }
  console.log(
    `✓ Created ${depositCount} deposit holds (all statuses: ${allDepositStatuses.join(', ')})`,
  );

  // ============= CREATE LEDGER ENTRIES =============
  console.log('📒 Creating ledger entries with ALL types...');
  let ledgerCount = 0;
  // ALL ledger entry types and statuses for comprehensive coverage
  const allTransactionTypes = [
    'PLATFORM_FEE',
    'SERVICE_FEE',
    'PAYMENT',
    'REFUND',
    'PAYOUT',
    'DEPOSIT_HOLD',
    'OWNER_EARNING',
    'DEPOSIT_RELEASE',
    'DISPUTE',
  ];
  const allLedgerStatuses = ['PENDING', 'POSTED', 'SETTLED', 'CANCELLED'];
  const allAccountTypes = [
    'REVENUE',
    'EXPENSE',
    'LIABILITY',
    'ASSET',
    'EQUITY',
    'CASH',
    'RECEIVABLE',
    'PAYABLE',
  ];

  for (let i = 0; i < Math.min(bookings.length, 50); i++) {
    const booking = bookings[i];
    try {
      // Guest payment debit (money out from guest)
      await prisma.ledgerEntry.create({
        data: {
          bookingId: booking.id,
          accountId: booking.renterId,
          accountType: allAccountTypes[i % allAccountTypes.length],
          side: 'DEBIT',
          transactionType: allTransactionTypes[i % allTransactionTypes.length],
          amount: booking.totalPrice,
          currency: 'USD',
          description: `Payment for booking ${booking.id}`,
          status: allLedgerStatuses[i % allLedgerStatuses.length],
        },
      });
      ledgerCount++;

      // Host earnings credit (money in to host)
      await prisma.ledgerEntry.create({
        data: {
          bookingId: booking.id,
          accountId: properties.find((p) => p.id === booking.listingId)?.ownerId || users[0].id,
          accountType: 'RECEIVABLE',
          side: 'CREDIT',
          transactionType: 'OWNER_EARNING',
          amount: booking.ownerEarnings || new Prisma.Decimal(Number(booking.totalPrice) * 0.85),
          currency: 'USD',
          description: `Earnings from booking ${booking.id}`,
          status: 'POSTED',
        },
      });
      ledgerCount++;
    } catch (error) {
      console.error('Error creating ledger entry:', (error as Error).message);
    }
  }
  console.log(
    `✓ Created ${ledgerCount} ledger entries (all types: ${allTransactionTypes.join(', ')})`,
  );

  // ============= CREATE BOOKING STATE HISTORY =============
  console.log('📜 Creating booking state history...');
  let historyCount = 0;
  for (const booking of bookings) {
    try {
      // Initial state
      await prisma.bookingStateHistory.create({
        data: {
          bookingId: booking.id,
          fromStatus: null,
          toStatus: 'PENDING',
          reason: 'Booking created',
          changedBy: booking.renterId,
          createdAt: booking.createdAt,
        },
      });
      historyCount++;

      // If confirmed, add confirmation state
      if (['CONFIRMED', 'CHECKED_IN', 'COMPLETED'].includes(booking.status)) {
        await prisma.bookingStateHistory.create({
          data: {
            bookingId: booking.id,
            fromStatus: 'PENDING',
            toStatus: 'CONFIRMED',
            reason: 'Booking confirmed by host',
            changedBy: properties.find((p) => p.id === booking.listingId)?.ownerId || users[0].id,
          },
        });
        historyCount++;
      }

      // If checked in or completed, add check-in state
      if (['IN_PROGRESS', 'COMPLETED'].includes(booking.status)) {
        await prisma.bookingStateHistory.create({
          data: {
            bookingId: booking.id,
            fromStatus: 'CONFIRMED',
            toStatus: 'IN_PROGRESS',
            reason: 'Guest checked in',
            changedBy: booking.renterId,
          },
        });
        historyCount++;
      }

      // If completed, add completion state
      if (booking.status === 'COMPLETED') {
        await prisma.bookingStateHistory.create({
          data: {
            bookingId: booking.id,
            fromStatus: 'IN_PROGRESS',
            toStatus: 'COMPLETED',
            reason: 'Booking completed',
            changedBy: properties.find((p) => p.id === booking.listingId)?.ownerId || users[0].id,
          },
        });
        historyCount++;
      }

      // If cancelled, add cancellation state
      if (booking.status === 'CANCELLED') {
        await prisma.bookingStateHistory.create({
          data: {
            bookingId: booking.id,
            fromStatus: 'PENDING',
            toStatus: 'CANCELLED',
            reason: faker.helpers.arrayElement([
              'Guest requested',
              'Host cancelled',
              'Payment failed',
            ]),
            changedBy: faker.datatype.boolean()
              ? booking.renterId
              : properties.find((p) => p.id === booking.listingId)?.ownerId || users[0].id,
          },
        });
        historyCount++;
      }
    } catch (error) {
      // Skip
    }
  }
  console.log(`✓ Created ${historyCount} booking state history records`);

  // ============= CREATE CONDITION REPORTS =============
  console.log('📋 Creating condition reports...');
  let reportCount = 0;
  const checkedInBookings = bookings.filter((b) => ['IN_PROGRESS', 'COMPLETED'].includes(b.status));
  for (const booking of checkedInBookings.slice(0, 20)) {
    try {
      // Check-in report
      await prisma.conditionReport.create({
        data: {
          bookingId: booking.id,
          propertyId: booking.listingId,
          createdBy: booking.renterId,
          checkIn: true,
          checkOut: false,
          photos: Array(faker.number.int({ min: 2, max: 5 }))
            .fill(0)
            .map(() => `https://example.com/photos/${faker.string.alphanumeric(10)}.jpg`),
          notes: faker.lorem.paragraph(),
          damages: JSON.stringify([]),
          status: 'SUBMITTED',
          reportType: 'CHECK_IN',
        },
      });
      reportCount++;

      // Check-out report for completed bookings
      if (booking.status === 'COMPLETED' && faker.datatype.boolean({ probability: 0.7 })) {
        await prisma.conditionReport.create({
          data: {
            bookingId: booking.id,
            propertyId: booking.listingId,
            createdBy: properties.find((p) => p.id === booking.listingId)?.ownerId || users[0].id,
            checkIn: false,
            checkOut: true,
            photos: Array(faker.number.int({ min: 2, max: 5 }))
              .fill(0)
              .map(() => `https://example.com/photos/${faker.string.alphanumeric(10)}.jpg`),
            notes: faker.lorem.paragraph(),
            damages: faker.datatype.boolean({ probability: 0.2 })
              ? JSON.stringify([
                  {
                    item: faker.lorem.words(3),
                    severity: faker.helpers.arrayElement(['minor', 'moderate', 'severe']),
                    cost: faker.number.float({ min: 50, max: 500 }),
                  },
                ])
              : JSON.stringify([]),
            status: 'SUBMITTED',
            reportType: 'CHECK_OUT',
          },
        });
        reportCount++;
      }
    } catch (error) {
      // Skip
    }
  }
  console.log(`✓ Created ${reportCount} condition reports`);

  // ============= CREATE DEVICE TOKENS =============
  console.log('📱 Creating device tokens...');
  let tokenCount = 0;
  for (let i = 0; i < Math.min(users.length, 30); i++) {
    try {
      await prisma.deviceToken.create({
        data: {
          userId: users[i].id,
          token: `device_${faker.string.alphanumeric(64)}`,
          platform: faker.helpers.arrayElement(['ios', 'android', 'web']),
          active: faker.datatype.boolean({ probability: 0.8 }),
        },
      });
      tokenCount++;
    } catch (error) {
      // Skip
    }
  }
  console.log(`✓ Created ${tokenCount} device tokens`);

  // ============= CREATE AUDIT LOGS =============
  console.log('📝 Creating audit logs...');
  let auditCount = 0;
  const auditActions = [
    'USER_LOGIN',
    'USER_LOGOUT',
    'BOOKING_CREATE',
    'BOOKING_UPDATE',
    'PAYMENT_PROCESS',
    'PROPERTY_CREATE',
    'PROPERTY_UPDATE',
  ];
  for (let i = 0; i < 50; i++) {
    try {
      await prisma.auditLog.create({
        data: {
          userId: users[faker.number.int({ min: 0, max: users.length - 1 })].id,
          action: faker.helpers.arrayElement(auditActions),
          entityType: faker.helpers.arrayElement(['User', 'Booking', 'Property', 'Payment']),
          entityId: faker.string.uuid(),
          oldValues: JSON.stringify({ status: 'old_value' }),
          newValues: JSON.stringify({ status: 'new_value' }),
          metadata: JSON.stringify({ source: 'web', ip: faker.internet.ipv4() }),
          ipAddress: faker.internet.ipv4(),
          userAgent: faker.internet.userAgent(),
        },
      });
      auditCount++;
    } catch (error) {
      // Skip
    }
  }
  console.log(`✓ Created ${auditCount} audit logs`);

  // ============= PRINT SUMMARY =============
  console.log('\n' + '='.repeat(60));
  console.log('✅ DATABASE SEEDING COMPLETED SUCCESSFULLY!');
  console.log('='.repeat(60));
  console.log('\n📊 COMPREHENSIVE SEEDING SUMMARY:');
  console.log(`  👥 Users: ${users.length} (ALL roles & statuses covered)`);
  console.log(`  🏢 Organizations: ${organizations.length}`);
  console.log(`  📂 Categories: ${categories.length}`);
  console.log(`  🏠 Properties: ${properties.length} (ALL statuses covered)`);
  console.log(`  📅 Availability Records: ${availabilityCount}`);
  console.log(`  📆 Bookings: ${bookings.length} (ALL 12 statuses covered)`);
  console.log(`  ❤️ Favorite Listings: ${favoriteCount}`);
  console.log(`  ⭐ Reviews: ${reviews.length} (ALL types & statuses)`);
  console.log(`  💳 Payments: ${paymentCount} (ALL statuses)`);
  console.log(`  🔄 Refunds: ${refundCount} (ALL statuses)`);
  console.log(`  🛡️ Insurance Policies: ${policyCount} (ALL types & statuses)`);
  console.log(`  📋 Insurance Claims: ${claimCount} (ALL statuses)`);
  console.log(`  💬 Conversations: ${conversationCount} (ALL types)`);
  console.log(`  📨 Messages: ${messageCount} (ALL types)`);
  console.log(`  ⚖️ Disputes: ${disputeCount} (ALL types, statuses, priorities)`);
  console.log(`  🔔 Notifications: ${notificationCount} (ALL 14 types)`);
  console.log(`  📋 Cancellation Policies: ${policies.length}`);
  console.log(`  📧 Email Templates: ${emailTemplates.length}`);
  console.log(`  ⚙️ User Preferences: ${prefCount}`);
  console.log(`  🔐 Sessions: ${sessionCount}`);
  console.log(`  💰 Payouts: ${payoutCount} (ALL statuses)`);
  console.log(`  🔒 Deposit Holds: ${depositCount} (ALL statuses)`);
  console.log(`  📒 Ledger Entries: ${ledgerCount} (ALL transaction types)`);
  console.log(`  📜 Booking State History: ${historyCount}`);
  console.log(`  📋 Condition Reports: ${reportCount}`);
  console.log(`  📱 Device Tokens: ${tokenCount}`);
  console.log(`  📝 Audit Logs: ${auditCount}`);
  console.log('\n🔑 LOGIN CREDENTIALS:');
  console.log('  Super Admin: superadmin@rental-portal.com / password123');
  console.log('  Admin: admin@rental-portal.com / password123');
  console.log('  Host: host@rental-portal.com / password123');
  console.log('  MFA User: mfa-user@rental-portal.com / password123');
  console.log('  Users: Any generated email / password123');
  console.log('\n💡 COMPLETE ENUM/STATUS COVERAGE:');
  console.log('  ✓ UserRole: USER, HOST, ADMIN, SUPER_ADMIN, CUSTOMER');
  console.log('  ✓ UserStatus: ACTIVE, SUSPENDED, DELETED, PENDING_VERIFICATION');
  console.log(
    '  ✓ PropertyStatus: AVAILABLE, RENTED, MAINTENANCE, UNAVAILABLE, DRAFT, SUSPENDED, ARCHIVED',
  );
  console.log('  ✓ PropertyCondition: EXCELLENT, GOOD, FAIR, POOR');
  console.log('  ✓ VerificationStatus: PENDING, VERIFIED, REJECTED');
  console.log(
    '  ✓ BookingStatus: DRAFT, PENDING, PENDING_PAYMENT, PENDING_OWNER_APPROVAL, CONFIRMED, IN_PROGRESS, CANCELLED, DISPUTED, COMPLETED, AWAITING_RETURN_INSPECTION, REFUNDED, SETTLED',
  );
  console.log('  ✓ BookingMode: REQUEST, INSTANT_BOOK');
  console.log(
    '  ✓ PaymentStatus: PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED, REFUNDED, SUCCEEDED',
  );
  console.log('  ✓ RefundStatus: PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED, SUCCEEDED');
  console.log('  ✓ DepositStatus: PENDING, AUTHORIZED, HELD, RELEASED, CAPTURED, FAILED');
  console.log(
    '  ✓ PayoutStatus: PENDING, PROCESSING, IN_TRANSIT, COMPLETED, PAID, FAILED, CANCELLED',
  );
  console.log('  ✓ ReviewType: LISTING_REVIEW, RENTER_REVIEW, OWNER_REVIEW');
  console.log('  ✓ ReviewStatus: DRAFT, PUBLISHED, HIDDEN, FLAGGED');
  console.log('  ✓ NotificationType: ALL 14 types covered');
  console.log('  ✓ DisputeType: ALL 9 types covered');
  console.log('  ✓ DisputeStatus: ALL 6 statuses covered');
  console.log('  ✓ DisputePriority: LOW, MEDIUM, HIGH, URGENT');
  console.log('  ✓ InsuranceType: ALL 4 types covered');
  console.log('  ✓ InsuranceStatus: ALL 4 statuses covered');
  console.log('  ✓ ClaimStatus: ALL 6 statuses covered');
  console.log('  ✓ ConversationType: GENERAL, BOOKING, DISPUTE, SUPPORT');
  console.log('  ✓ MessageType: TEXT, IMAGE, DOCUMENT, LOCATION, SYSTEM');
  console.log('  ✓ LedgerEntryStatus: ALL statuses covered');
  console.log('  ✓ TransactionType: ALL types covered');
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
