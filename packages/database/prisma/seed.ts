import { PrismaClient, UserRole, UserStatus, VerificationStatus, BookingStatus, ListingStatus, CategoryType } from '../src/generated/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clear existing data
  console.log('🗑️  Cleaning up existing data...');
  await prisma.message.deleteMany();
  await prisma.conversationParticipant.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.review.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.listingAvailability.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.category.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  // Create Categories
  console.log('📁 Creating categories...');
  const categories = await Promise.all([
    prisma.category.create({
      data: {
        name: 'Tools & Equipment',
        slug: 'tools-equipment',
        description: 'Power tools, hand tools, and equipment for DIY and professional projects',
        type: CategoryType.ITEM,
        iconName: 'Hammer',
        isActive: true,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Camera & Photography',
        slug: 'camera-photography',
        description: 'Professional cameras, lenses, lighting, and photography equipment',
        type: CategoryType.ITEM,
        iconName: 'Camera',
        isActive: true,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Outdoor & Camping',
        slug: 'outdoor-camping',
        description: 'Tents, camping gear, hiking equipment, and outdoor supplies',
        type: CategoryType.ITEM,
        iconName: 'Mountain',
        isActive: true,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Party & Events',
        slug: 'party-events',
        description: 'Tables, chairs, decorations, and equipment for events and parties',
        type: CategoryType.ITEM,
        iconName: 'PartyPopper',
        isActive: true,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Electronics',
        slug: 'electronics',
        description: 'Laptops, gaming consoles, tablets, and electronic devices',
        type: CategoryType.ITEM,
        iconName: 'Laptop',
        isActive: true,
      },
    }),
  ]);

  // Hash password for all users (password: "password123")
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create Admin User (auto-login for dev)
  console.log('👤 Creating admin user...');
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@rental.local',
      emailVerified: true,
      passwordHash: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      phoneNumber: '+1-555-0100',
      phoneVerified: true,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      idVerificationStatus: VerificationStatus.VERIFIED,
      bio: 'Platform administrator with full access rights',
      city: 'San Francisco',
      state: 'CA',
      country: 'USA',
      averageRating: 5.0,
      totalReviews: 0,
    },
  });

  // Create Support User
  console.log('👤 Creating support user...');
  const supportUser = await prisma.user.create({
    data: {
      email: 'support@rental.local',
      emailVerified: true,
      passwordHash: hashedPassword,
      firstName: 'Sarah',
      lastName: 'Support',
      phoneNumber: '+1-555-0101',
      phoneVerified: true,
      role: UserRole.SUPPORT,
      status: UserStatus.ACTIVE,
      idVerificationStatus: VerificationStatus.VERIFIED,
      bio: 'Customer support representative',
      city: 'San Francisco',
      state: 'CA',
      country: 'USA',
    },
  });

  // Create Owner User 1 (has listings)
  console.log('👤 Creating owner user 1...');
  const owner1 = await prisma.user.create({
    data: {
      email: 'john.owner@rental.local',
      emailVerified: true,
      passwordHash: hashedPassword,
      firstName: 'John',
      lastName: 'Smith',
      phoneNumber: '+1-555-0201',
      phoneVerified: true,
      role: UserRole.OWNER,
      status: UserStatus.ACTIVE,
      idVerificationStatus: VerificationStatus.VERIFIED,
      bio: 'Professional photographer renting out high-quality camera equipment. Over 10 years of experience in the industry.',
      city: 'Los Angeles',
      state: 'CA',
      country: 'USA',
      averageRating: 4.8,
      totalReviews: 24,
      stripeConnectId: 'acct_test_owner1',
      stripeOnboardingComplete: true,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
    },
  });

  // Create Owner User 2 (has listings)
  console.log('👤 Creating owner user 2...');
  const owner2 = await prisma.user.create({
    data: {
      email: 'emily.tools@rental.local',
      emailVerified: true,
      passwordHash: hashedPassword,
      firstName: 'Emily',
      lastName: 'Johnson',
      phoneNumber: '+1-555-0202',
      phoneVerified: true,
      role: UserRole.OWNER,
      status: UserStatus.ACTIVE,
      idVerificationStatus: VerificationStatus.VERIFIED,
      bio: 'DIY enthusiast and contractor. I rent out professional-grade tools and equipment for home improvement projects.',
      city: 'Seattle',
      state: 'WA',
      country: 'USA',
      averageRating: 4.9,
      totalReviews: 42,
      stripeConnectId: 'acct_test_owner2',
      stripeOnboardingComplete: true,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
    },
  });

  // Create Regular Customer User 1
  console.log('👤 Creating customer user 1...');
  const customer1 = await prisma.user.create({
    data: {
      email: 'mike.customer@rental.local',
      emailVerified: true,
      passwordHash: hashedPassword,
      firstName: 'Mike',
      lastName: 'Davis',
      phoneNumber: '+1-555-0301',
      phoneVerified: true,
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
      idVerificationStatus: VerificationStatus.VERIFIED,
      bio: 'Weekend warrior who loves DIY projects and outdoor adventures.',
      city: 'Portland',
      state: 'OR',
      country: 'USA',
      averageRating: 4.7,
      totalReviews: 8,
      stripeCustomerId: 'cus_test_customer1',
    },
  });

  // Create Regular Customer User 2
  console.log('👤 Creating customer user 2...');
  const customer2 = await prisma.user.create({
    data: {
      email: 'lisa.renter@rental.local',
      emailVerified: true,
      passwordHash: hashedPassword,
      firstName: 'Lisa',
      lastName: 'Anderson',
      phoneNumber: '+1-555-0302',
      phoneVerified: true,
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
      idVerificationStatus: VerificationStatus.VERIFIED,
      bio: 'Event planner always looking for quality equipment for special occasions.',
      city: 'Austin',
      state: 'TX',
      country: 'USA',
      averageRating: 5.0,
      totalReviews: 12,
      stripeCustomerId: 'cus_test_customer2',
    },
  });

  // Create Listings for Owner 1 (Camera Equipment)
  console.log('📦 Creating listings for owner 1...');
  const listing1 = await prisma.listing.create({
    data: {
      title: 'Canon EOS R5 Mirrorless Camera Body',
      slug: 'canon-eos-r5-mirrorless-camera',
      description: 'Professional full-frame mirrorless camera with 45MP sensor, 8K video recording, and advanced autofocus. Perfect for professional photography and videography projects. Includes battery, charger, and camera strap.',
      categoryId: categories[1].id, // Camera & Photography
      ownerId: owner1.id,
      pricePerDay: 150,
      pricePerWeek: 900,
      pricePerMonth: 3200,
      securityDeposit: 500,
      currency: 'USD',
      city: 'Los Angeles',
      state: 'CA',
      country: 'USA',
      latitude: 34.0522,
      longitude: -118.2437,
      status: ListingStatus.PUBLISHED,
      condition: 'EXCELLENT',
      availableQuantity: 1,
      minRentalPeriod: 1,
      maxRentalPeriod: 30,
      isInsuranceRequired: true,
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1606986628878-ddd62f3e0e5d?w=800',
        'https://images.unsplash.com/photo-1606980707972-7a0c4e3b7c6d?w=800',
      ]),
      instantBooking: true,
      viewCount: 245,
      favoriteCount: 32,
    },
  });

  const listing2 = await prisma.listing.create({
    data: {
      title: 'Sony A7 IV + 24-70mm f/2.8 Lens Kit',
      slug: 'sony-a7-iv-24-70mm-lens-kit',
      description: 'Complete professional photography kit with Sony A7 IV camera and versatile 24-70mm f/2.8 lens. Ideal for weddings, events, and portrait photography. Kit includes 2 batteries, charger, lens hood, and camera bag.',
      categoryId: categories[1].id,
      ownerId: owner1.id,
      pricePerDay: 180,
      pricePerWeek: 1080,
      pricePerMonth: 3800,
      securityDeposit: 600,
      currency: 'USD',
      city: 'Los Angeles',
      state: 'CA',
      country: 'USA',
      latitude: 34.0522,
      longitude: -118.2437,
      status: ListingStatus.PUBLISHED,
      condition: 'EXCELLENT',
      availableQuantity: 1,
      minRentalPeriod: 1,
      maxRentalPeriod: 30,
      isInsuranceRequired: true,
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1614853316629-951c74dce744?w=800',
        'https://images.unsplash.com/photo-1606980654336-aef85d0d2f3f?w=800',
      ]),
      instantBooking: true,
      viewCount: 189,
      favoriteCount: 28,
    },
  });

  // Create Listings for Owner 2 (Tools)
  console.log('📦 Creating listings for owner 2...');
  const listing3 = await prisma.listing.create({
    data: {
      title: 'DeWalt 20V Cordless Drill & Impact Driver Combo Kit',
      slug: 'dewalt-20v-cordless-drill-impact-driver-kit',
      description: 'Professional-grade combo kit perfect for construction, woodworking, and home improvement. Includes drill driver, impact driver, 2 batteries, charger, and carrying case. Both tools feature LED lights and ergonomic design.',
      categoryId: categories[0].id, // Tools & Equipment
      ownerId: owner2.id,
      pricePerDay: 35,
      pricePerWeek: 180,
      pricePerMonth: 600,
      securityDeposit: 150,
      currency: 'USD',
      city: 'Seattle',
      state: 'WA',
      country: 'USA',
      latitude: 47.6062,
      longitude: -122.3321,
      status: ListingStatus.PUBLISHED,
      condition: 'GOOD',
      availableQuantity: 2,
      minRentalPeriod: 1,
      maxRentalPeriod: 14,
      isInsuranceRequired: false,
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800',
        'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=800',
      ]),
      instantBooking: true,
      viewCount: 312,
      favoriteCount: 45,
    },
  });

  const listing4 = await prisma.listing.create({
    data: {
      title: 'Milwaukee M18 Table Saw',
      slug: 'milwaukee-m18-table-saw',
      description: 'Portable 10-inch table saw with excellent precision and power. Perfect for jobsite use or home workshops. Includes rip fence, miter gauge, push stick, and blade guard. Battery and charger included.',
      categoryId: categories[0].id,
      ownerId: owner2.id,
      pricePerDay: 55,
      pricePerWeek: 300,
      pricePerMonth: 1000,
      securityDeposit: 200,
      currency: 'USD',
      city: 'Seattle',
      state: 'WA',
      country: 'USA',
      latitude: 47.6062,
      longitude: -122.3321,
      status: ListingStatus.PUBLISHED,
      condition: 'GOOD',
      availableQuantity: 1,
      minRentalPeriod: 1,
      maxRentalPeriod: 14,
      isInsuranceRequired: false,
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=800',
      ]),
      instantBooking: false,
      viewCount: 178,
      favoriteCount: 22,
    },
  });

  const listing5 = await prisma.listing.create({
    data: {
      title: '4-Person Camping Tent - Waterproof',
      slug: '4-person-camping-tent-waterproof',
      description: 'Spacious 4-person camping tent with excellent weather protection. Features easy setup, rain fly, ventilation windows, and gear loft. Perfect for family camping trips or weekend getaways. Includes tent stakes and carrying bag.',
      categoryId: categories[2].id, // Outdoor & Camping
      ownerId: owner2.id,
      pricePerDay: 25,
      pricePerWeek: 120,
      pricePerMonth: 400,
      securityDeposit: 50,
      currency: 'USD',
      city: 'Seattle',
      state: 'WA',
      country: 'USA',
      latitude: 47.6062,
      longitude: -122.3321,
      status: ListingStatus.PUBLISHED,
      condition: 'EXCELLENT',
      availableQuantity: 2,
      minRentalPeriod: 2,
      maxRentalPeriod: 14,
      isInsuranceRequired: false,
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800',
      ]),
      instantBooking: true,
      viewCount: 267,
      favoriteCount: 38,
    },
  });

  // Create some bookings
  console.log('📅 Creating bookings...');
  
  // Completed booking with review
  const booking1 = await prisma.booking.create({
    data: {
      listingId: listing1.id,
      renterId: customer1.id,
      ownerId: owner1.id,
      startDate: new Date('2024-01-10'),
      endDate: new Date('2024-01-15'),
      status: BookingStatus.COMPLETED,
      totalPrice: 750,
      securityDeposit: 500,
      currency: 'USD',
      rentalDays: 5,
      pricePerDay: 150,
    },
  });

  // Active booking
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  await prisma.booking.create({
    data: {
      listingId: listing3.id,
      renterId: customer2.id,
      ownerId: owner2.id,
      startDate: tomorrow,
      endDate: nextWeek,
      status: BookingStatus.CONFIRMED,
      totalPrice: 245,
      securityDeposit: 150,
      currency: 'USD',
      rentalDays: 7,
      pricePerDay: 35,
    },
  });

  // Pending booking
  const futureDate = new Date(today);
  futureDate.setDate(futureDate.getDate() + 14);
  const futureEndDate = new Date(futureDate);
  futureEndDate.setDate(futureEndDate.getDate() + 3);

  await prisma.booking.create({
    data: {
      listingId: listing4.id,
      renterId: customer1.id,
      ownerId: owner2.id,
      startDate: futureDate,
      endDate: futureEndDate,
      status: BookingStatus.PENDING,
      totalPrice: 165,
      securityDeposit: 200,
      currency: 'USD',
      rentalDays: 3,
      pricePerDay: 55,
    },
  });

  // Create reviews
  console.log('⭐ Creating reviews...');
  await prisma.review.create({
    data: {
      bookingId: booking1.id,
      listingId: listing1.id,
      reviewerId: customer1.id,
      revieweeId: owner1.id,
      rating: 5,
      comment: 'Amazing camera! John was professional and the equipment was in perfect condition. The camera performed flawlessly throughout my shoot. Highly recommend!',
      reviewType: 'LISTING',
    },
  });

  await prisma.review.create({
    data: {
      bookingId: booking1.id,
      listingId: listing1.id,
      reviewerId: owner1.id,
      revieweeId: customer1.id,
      rating: 5,
      comment: 'Great renter! Mike took excellent care of the equipment and returned it on time in perfect condition. Would definitely rent to him again.',
      reviewType: 'USER',
    },
  });

  // Create admin session for auto-login
  console.log('🔐 Creating admin session...');
  const adminSessionExpiry = new Date();
  adminSessionExpiry.setDate(adminSessionExpiry.getDate() + 7); // 7 days

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

  console.log('✅ Database seed completed successfully!');
  console.log('\n📋 Test Users Created:');
  console.log('┌─────────────────────────────────────────────────────────┐');
  console.log('│ Admin User:                                             │');
  console.log('│   Email: admin@rental.local                             │');
  console.log('│   Password: password123                                 │');
  console.log('│   Role: ADMIN (auto-login enabled)                      │');
  console.log('├─────────────────────────────────────────────────────────┤');
  console.log('│ Support User:                                           │');
  console.log('│   Email: support@rental.local                           │');
  console.log('│   Password: password123                                 │');
  console.log('│   Role: SUPPORT                                         │');
  console.log('├─────────────────────────────────────────────────────────┤');
  console.log('│ Owner 1 (Camera Equipment):                             │');
  console.log('│   Email: john.owner@rental.local                        │');
  console.log('│   Password: password123                                 │');
  console.log('│   Listings: 2 camera listings                           │');
  console.log('├─────────────────────────────────────────────────────────┤');
  console.log('│ Owner 2 (Tools & Camping):                              │');
  console.log('│   Email: emily.tools@rental.local                       │');
  console.log('│   Password: password123                                 │');
  console.log('│   Listings: 3 tool/camping listings                     │');
  console.log('├─────────────────────────────────────────────────────────┤');
  console.log('│ Customer 1:                                             │');
  console.log('│   Email: mike.customer@rental.local                     │');
  console.log('│   Password: password123                                 │');
  console.log('│   Bookings: 2 (1 completed, 1 pending)                  │');
  console.log('├─────────────────────────────────────────────────────────┤');
  console.log('│ Customer 2:                                             │');
  console.log('│   Email: lisa.renter@rental.local                       │');
  console.log('│   Password: password123                                 │');
  console.log('│   Bookings: 1 active                                    │');
  console.log('└─────────────────────────────────────────────────────────┘');
  console.log('\n📊 Database Statistics:');
  console.log(`   - Users: 6`);
  console.log(`   - Categories: 5`);
  console.log(`   - Listings: 5`);
  console.log(`   - Bookings: 3`);
  console.log(`   - Reviews: 2`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
