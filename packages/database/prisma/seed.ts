import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clean existing data
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
  await prisma.favoriteListing.deleteMany();
  await prisma.userPreferences.deleteMany();
  await prisma.deviceToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.refund.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.review.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.property.deleteMany();
  await prisma.organizationMember.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.category.deleteMany();
  await prisma.cancellationPolicy.deleteMany();
  await prisma.user.deleteMany();

  console.log('🧹 Cleaned existing data');

  // Create cancellation policies
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
  ]);

  console.log(`📋 Created ${policies.length} cancellation policies`);

  // Create categories
  const categories = await Promise.all([
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
  ]);

  console.log(`📂 Created ${categories.length} categories`);

  // Create users
  const users = [];
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create admin user
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@rental-portal.com',
      username: 'admin',
      password: 'password123',
      passwordHash: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      status: 'ACTIVE',
      isActive: true,
      emailVerified: true,
    },
  });
  users.push(adminUser);

  // Create regular users
  for (let i = 0; i < 15; i++) {
    const user = await prisma.user.create({
      data: {
        email: faker.internet.email(),
        username: faker.internet.username(),
        password: 'password123',
        passwordHash: hashedPassword,
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        phone: faker.phone.number(),
        role: 'USER',
        status: 'ACTIVE',
        isActive: true,
        emailVerified: true,
      },
    });
    users.push(user);
  }

  console.log(`👥 Created ${users.length} users`);

  // Create organizations
  const organizations = await Promise.all([
    prisma.organization.create({
      data: {
        name: 'Premium Properties',
        slug: 'premium-properties',
        description: 'Luxury rental management company',
        email: 'contact@premium.com',
        phone: faker.phone.number(),
        address: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state(),
        zipCode: faker.location.zipCode(),
        country: 'USA',
        status: 'ACTIVE',
        verificationStatus: 'VERIFIED',
      },
    }),
    prisma.organization.create({
      data: {
        name: 'Cozy Homes',
        slug: 'cozy-homes',
        description: 'Budget-friendly rental solutions',
        email: 'info@cozyhomes.com',
        phone: faker.phone.number(),
        address: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state(),
        zipCode: faker.location.zipCode(),
        country: 'USA',
        status: 'ACTIVE',
        verificationStatus: 'VERIFIED',
      },
    }),
  ]);

  console.log(`🏢 Created ${organizations.length} organizations`);

  // Add organization members
  for (const org of organizations) {
    await Promise.all([
      prisma.organizationMember.create({
        data: {
          organizationId: org.id,
          userId: users[1].id,
          role: 'OWNER',
        },
      }),
      prisma.organizationMember.create({
        data: {
          organizationId: org.id,
          userId: users[2].id,
          role: 'ADMIN',
        },
      }),
    ]);
  }

  // Create properties
  const properties = [];
  const propertyTypes = ['APARTMENT', 'HOUSE', 'VILLA', 'STUDIO', 'CONDO', 'TOWNHOUSE', 'COTTAGE', 'CABIN', 'LOFT'];
  const amenities = [
    'WiFi', 'Kitchen', 'Parking', 'Air Conditioning', 'Heating', 'Washer', 'Dryer',
    'TV', 'Essentials', 'Hot Water', 'Shampoo', 'Workspace', 'Pool', 'Gym', 'Elevator',
    'Fire Extinguisher', 'Smoke Detector', 'First Aid Kit', 'Lock on bedroom door'
  ];

  for (let i = 0; i < 25; i++) {
    const owner = users[faker.number.int({ min: 1, max: users.length - 1 })];
    const selectedAmenities = faker.helpers.arrayElements(amenities, { min: 5, max: 15 });
    const selectedFeatures = faker.helpers.arrayElements([
      'Ocean View', 'Mountain View', 'Pet Friendly', 'Smoking Allowed', 'Wheelchair Accessible', 
      'Elevator', 'Balcony', 'Garden', 'BBQ Grill', 'Fire Pit', 'Hot Tub', 'Sauna', 
      'Gym Access', 'Pool Access', 'Parking Included', 'Air Conditioning', 'Heating', 
      'Smart Home', 'High-Speed Internet', 'Workspace'
    ], { min: 3, max: 8 });
    const category = categories[faker.number.int({ min: 0, max: categories.length - 1 })];
    const policy = policies[faker.number.int({ min: 0, max: policies.length - 1 })];
    const organization = faker.datatype.boolean() ? organizations[faker.number.int({ min: 0, max: organizations.length - 1 })] : null;
    
    const property = await prisma.property.create({
      data: {
        title: faker.helpers.arrayElement([
          'Modern Downtown Apartment',
          'Cozy Beach House',
          'Luxury Villa with Pool',
          'Charming Studio in City Center',
          'Spacious Family Home',
          'Romantic Cottage Getaway',
          'Mountain View Cabin',
          'Urban Loft with Terrace',
          'Historic Townhouse',
          'Contemporary Condo'
        ]),
        slug: faker.lorem.slug(),
        description: faker.lorem.paragraphs(3),
        address: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state(),
        zipCode: faker.location.zipCode(),
        country: 'USA',
        latitude: faker.location.latitude(),
        longitude: faker.location.longitude(),
        type: faker.helpers.arrayElement(propertyTypes) as any,
        status: 'AVAILABLE',
        verificationStatus: 'VERIFIED',
        condition: faker.helpers.arrayElement(['EXCELLENT', 'GOOD', 'FAIR']) as any,
        bedrooms: faker.number.int({ min: 1, max: 5 }),
        bathrooms: faker.number.int({ min: 1, max: 4 }),
        maxGuests: faker.number.int({ min: 1, max: 10 }),
        basePrice: parseFloat(faker.commerce.price({ min: 50, max: 500 })),
        currency: 'USD',
        securityDeposit: parseFloat(faker.commerce.price({ min: 100, max: 1000 })),
        cleaningFee: parseFloat(faker.commerce.price({ min: 25, max: 150 })),
        amenities: selectedAmenities,
        features: selectedFeatures,
        images: Array.from({ length: faker.number.int({ min: 3, max: 8 }) }, () => 
          `https://picsum.photos/seed/${faker.string.alphanumeric(10)}/800/600.jpg`
        ),
        photos: Array.from({ length: faker.number.int({ min: 3, max: 8 }) }, () => 
          `https://picsum.photos/seed/${faker.string.alphanumeric(10)}/800/600.jpg`
        ),
        rules: [
          'No smoking',
          'No parties',
          'Quiet hours after 10 PM',
          'Remove shoes indoors',
          'Respect neighbors'
        ],
        ownerId: owner.id,
        categoryId: category.id,
        cancellationPolicyId: policy.id,
        organizationId: organization?.id,
      },
    });
    properties.push(property);
  }

  console.log(`🏠 Created ${properties.length} properties`);

  // Create bookings
  const bookings = [];
  const bookingStatuses = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];

  for (let i = 0; i < 40; i++) {
    const property = properties[faker.number.int({ min: 0, max: properties.length - 1 })];
    const guest = users[faker.number.int({ min: 1, max: users.length - 1 })];
    
    // Ensure guest is not the property owner
    if (guest.id === property.ownerId) continue;

    const startDate = faker.date.past({ years: 1 });
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + faker.number.int({ min: 1, max: 14 }));

    const nights = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const basePrice = Number(property.basePrice) * nights;
    const serviceFee = basePrice * 0.1;
    const totalPrice = basePrice + serviceFee;

    try {
      const booking = await prisma.booking.create({
        data: {
          listingId: property.id,
          renterId: guest.id,
          startDate,
          endDate,
          basePrice: property.basePrice,
          securityDeposit: property.securityDeposit,
          cleaningFee: property.cleaningFee,
          serviceFee,
          totalPrice,
          currency: 'USD',
          status: faker.helpers.arrayElement(bookingStatuses) as any,
          paymentIntentId: `pi_${faker.string.alphanumeric(24)}`,
        },
      });
      bookings.push(booking);
    } catch (error) {
      // Skip if booking conflicts with existing dates
      continue;
    }
  }

  console.log(`📅 Created ${bookings.length} bookings`);

  // Create reviews for completed bookings
  const reviews = [];
  const completedBookings = bookings.filter(b => b.status === 'COMPLETED');
  const reviewTypes = ['LISTING_REVIEW', 'RENTER_REVIEW', 'OWNER_REVIEW'];

  for (const booking of completedBookings) {
    const property = properties.find(p => p.id === booking.propertyId);
    const guest = users.find(u => u.id === booking.guestId);
    const owner = users.find(u => u.id === property?.ownerId);
    
    if (!property || !guest || !owner) continue;

    // Create listing review
    const listingReview = await prisma.review.create({
      data: {
        bookingId: booking.id,
        propertyId: property.id,
        reviewerId: guest.id,
        revieweeId: owner.id,
        type: 'LISTING_REVIEW',
        rating: faker.number.int({ min: 1, max: 5 }),
        overallRating: faker.number.int({ min: 1, max: 5 }),
        cleanliness: faker.number.int({ min: 1, max: 5 }),
        communication: faker.number.int({ min: 1, max: 5 }),
        checkIn: faker.number.int({ min: 1, max: 5 }),
        accuracy: faker.number.int({ min: 1, max: 5 }),
        location: faker.number.int({ min: 1, max: 5 }),
        value: faker.number.int({ min: 1, max: 5 }),
        comment: faker.lorem.sentences(faker.number.int({ min: 1, max: 3 })),
        status: 'PUBLISHED',
      },
    });
    reviews.push(listingReview);

    // Create renter review
    const renterReview = await prisma.review.create({
      data: {
        bookingId: booking.id,
        reviewerId: owner.id,
        revieweeId: guest.id,
        type: 'RENTER_REVIEW',
        rating: faker.number.int({ min: 1, max: 5 }),
        comment: faker.lorem.sentences(faker.number.int({ min: 1, max: 2 })),
        status: 'PUBLISHED',
      },
    });
    reviews.push(renterReview);
  }

  console.log(`⭐ Created ${reviews.length} reviews`);

  // Create user preferences for some users
  for (let i = 0; i < 10; i++) {
    await prisma.userPreferences.create({
      data: {
        userId: users[i].id,
        language: 'en',
        currency: 'USD',
        timezone: 'UTC',
        emailNotifications: true,
        pushNotifications: true,
        smsNotifications: false,
        marketingEmails: false,
        autoAcceptBookings: false,
        instantBook: false,
        minBookingDuration: 1,
        maxBookingDuration: 30,
        advanceBookingNotice: 24,
      },
    });
  }

  console.log('✅ Database seeding completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`   Users: ${users.length}`);
  console.log(`   Organizations: ${organizations.length}`);
  console.log(`   Categories: ${categories.length}`);
  console.log(`   Properties: ${properties.length}`);
  console.log(`   Bookings: ${bookings.length}`);
  console.log(`   Reviews: ${reviews.length}`);
  console.log('\n🔑 Login credentials:');
  console.log('   Admin: admin@rental-portal.com / password123');
  console.log('   Users: Any email from seed / password123');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
