import * as dotenv from 'dotenv';
import {
  PrismaClient,
  UserRole,
  UserStatus,
  VerificationStatus,
  BookingStatus,
  ListingStatus,
} from '../src/generated/client';
import * as bcrypt from 'bcrypt';
import { faker } from '@faker-js/faker';

// Load environment variables from the root .env file
dotenv.config({ path: '../../.env' });

const prisma = new PrismaClient({});

// Helper function to generate random index
function randomIndex<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

async function main() {
  console.log('🌱 Starting database seed...');

  // Clear existing data
  console.log('🗑️  Cleaning up existing data...');
  await prisma.message.deleteMany();
  await prisma.conversationParticipant.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.review.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.availability.deleteMany();
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
        description: 'Professional cameras, lenses, lighting, and photography equipment',
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
        description: 'Tents, camping gear, hiking equipment, and outdoor supplies',
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
        description: 'Tables, chairs, decorations, and equipment for events and parties',
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
        description: 'Laptops, gaming consoles, tablets, and electronic devices',
        iconUrl: 'laptop',
        active: true,
        templateSchema: {},
        searchableFields: [],
        requiredFields: [],
      },
    }),
  ]);

  // Hash password for all users (password: "password123")
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create Users (150+ total users)
  console.log('👤 Creating 150+ users...');
  
  // Create special test users
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

  // Create 150+ regular users (mix of owners and customers)
  const users: any[] = [adminUser, supportUser];
  
  for (let i = 0; i < 150; i++) {
    const isOwner = Math.random() > 0.6; // 40% owners, 60% customers
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    
    const user = await prisma.user.create({
      data: {
        email: faker.internet.email({ firstName, lastName }).toLowerCase(),
        emailVerified: true,
        passwordHash: hashedPassword,
        firstName,
        lastName,
        phoneNumber: faker.phone.number('+1-555-####'),
        phoneVerified: Math.random() > 0.2,
        role: isOwner ? UserRole.OWNER : UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
        idVerificationStatus: randomIndex([
          VerificationStatus.VERIFIED,
          VerificationStatus.VERIFIED,
          VerificationStatus.PENDING,
        ]),
        bio: faker.person.bio(),
        city: faker.location.city(),
        state: faker.location.state({ abbreviated: true }),
        country: 'USA',
        averageRating: parseFloat((Math.random() * 5).toFixed(1)),
        totalReviews: Math.floor(Math.random() * 50),
        ...(isOwner && {
          stripeConnectId: `acct_test_${i}`,
          stripeOnboardingComplete: true,
          stripeChargesEnabled: true,
          stripePayoutsEnabled: true,
        }),
        ...(!isOwner && {
          stripeCustomerId: `cus_test_${i}`,
        }),
      },
    });
    
    users.push(user);
  }

  // Separate owners and customers
  const owners = users.filter(u => u.role === UserRole.OWNER);
  const customers = users.filter(u => u.role === UserRole.CUSTOMER);

  console.log(`   ✓ Created ${users.length} users (${owners.length} owners, ${customers.length} customers)`);

  // Create Listings (150+ listings)
  console.log('📦 Creating 150+ listings...');
  const listings: any[] = [];
  
  const listingTitles = [
    'Professional Camera',
    'Cordless Drill',
    'Camping Tent',
    'Party Supplies',
    'Laptop',
    'Photography Lens',
    'Power Saw',
    'Hiking Backpack',
    'Projector',
    'DJ Equipment',
    'Table Saw',
    'Telescope',
    'Video Camera',
    'Portable Generator',
    'Chainsaw',
  ];

  for (let i = 0; i < 150; i++) {
    const owner = randomIndex(owners);
    const category = randomIndex(categories);
    
    const listing = await prisma.listing.create({
      data: {
        title: `${randomIndex(listingTitles)} ${i + 1}`,
        slug: `listing-${i + 1}-${faker.string.alpha(8)}`,
        description: faker.lorem.paragraphs(2),
        categoryId: category.id,
        ownerId: owner.id,
        basePrice: Math.floor(Math.random() * 500) + 25,
        dailyPrice: Math.floor(Math.random() * 200) + 25,
        weeklyPrice: Math.floor(Math.random() * 800) + 150,
        monthlyPrice: Math.floor(Math.random() * 2000) + 500,
        depositAmount: Math.floor(Math.random() * 500) + 50,
        currency: 'USD',
        city: faker.location.city(),
        state: faker.location.state({ abbreviated: true }),
        country: 'USA',
        latitude: parseFloat(faker.location.latitude()),
        longitude: parseFloat(faker.location.longitude()),
        status: randomIndex([ListingStatus.ACTIVE, ListingStatus.ACTIVE, ListingStatus.INACTIVE]),
        condition: randomIndex(['EXCELLENT', 'GOOD', 'FAIR']),
        photos: JSON.stringify([
          faker.image.url({ width: 800, height: 600 }),
          faker.image.url({ width: 800, height: 600 }),
        ]),
        viewCount: Math.floor(Math.random() * 500),
        favoriteCount: Math.floor(Math.random() * 100),
        categorySpecificData: {},
      },
    });
    
    listings.push(listing);
  }

  console.log(`   ✓ Created ${listings.length} listings`);

  // Create Bookings (100+ bookings)
  console.log('📅 Creating 100+ bookings...');
  const bookings: any[] = [];
  
  for (let i = 0; i < 120; i++) {
    const listing = randomIndex(listings);
    const renter = randomIndex(customers);
    const owner = users.find(u => u.id === listing.ownerId) || randomIndex(owners);
    
    const startDate = faker.date.past();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + faker.number.int({ min: 1, max: 30 }));
    
    const duration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const basePrice = listing.dailyPrice * duration;
    const serviceFee = Math.floor(basePrice * 0.1);
    const totalPrice = basePrice + serviceFee;

    const booking = await prisma.booking.create({
      data: {
        listingId: listing.id,
        renterId: renter.id,
        ownerId: owner.id,
        startDate,
        endDate,
        status: randomIndex([
          BookingStatus.COMPLETED,
          BookingStatus.COMPLETED,
          BookingStatus.CONFIRMED,
          BookingStatus.PENDING_OWNER_APPROVAL,
          BookingStatus.CANCELLED,
        ]),
        totalPrice,
        depositAmount: listing.depositAmount,
        currency: 'USD',
        duration,
        basePrice,
        serviceFee,
        tax: 0,
        discountAmount: 0,
        totalAmount: totalPrice,
        ownerEarnings: basePrice - serviceFee,
        platformFee: serviceFee,
        guestCount: faker.number.int({ min: 1, max: 6 }),
      },
    });
    
    bookings.push(booking);
  }

  console.log(`   ✓ Created ${bookings.length} bookings`);

  // Create Reviews (100+ reviews)
  console.log('⭐ Creating 100+ reviews...');
  const reviews: any[] = [];
  
  const completedBookings = bookings.filter(b => b.status === BookingStatus.COMPLETED);
  
  for (let i = 0; i < Math.min(110, completedBookings.length); i++) {
    const booking = completedBookings[i];
    
    // Listing review
    const listingReview = await prisma.review.create({
      data: {
        bookingId: booking.id,
        listingId: booking.listingId,
        reviewerId: booking.renterId,
        revieweeId: booking.ownerId,
        overallRating: faker.number.int({ min: 3, max: 5 }),
        content: faker.lorem.sentence(),
        type: 'LISTING_REVIEW',
      },
    });
    
    reviews.push(listingReview);
    
    // Renter review (from owner)
    const renterReview = await prisma.review.create({
      data: {
        bookingId: booking.id,
        listingId: booking.listingId,
        reviewerId: booking.ownerId,
        revieweeId: booking.renterId,
        overallRating: faker.number.int({ min: 3, max: 5 }),
        content: faker.lorem.sentence(),
        type: 'RENTER_REVIEW',
      },
    });
    
    reviews.push(renterReview);
  }

  console.log(`   ✓ Created ${reviews.length} reviews`);

  // Create Sessions (105+ sessions)
  console.log('🔐 Creating 105+ sessions...');
  let sessionCount = 0;
  
  for (let i = 0; i < Math.min(105, users.length); i++) {
    const user = users[i];
    const expiresAt = faker.date.future();
    
    await prisma.session.create({
      data: {
        userId: user.id,
        token: `dev_token_${i}_${faker.string.alpha(32)}`,
        refreshToken: `dev_refresh_${i}_${faker.string.alpha(32)}`,
        expiresAt,
        ipAddress: faker.internet.ipv4(),
        userAgent: faker.internet.userAgent(),
      },
    });
    
    sessionCount++;
  }

  console.log(`   ✓ Created ${sessionCount} sessions`);

  // Create Conversations and Messages (100+ messages)
  console.log('💬 Creating conversations and 100+ messages...');
  let messageCount = 0;
  const conversations: any[] = [];
  
  for (let i = 0; i < 25; i++) {
    const booking = randomIndex(bookings);
    const user1 = randomIndex(users);
    const user2 = randomIndex(users.filter(u => u.id !== user1.id));
    
    const conversation = await prisma.conversation.create({
      data: {
        bookingId: booking.id,
        type: 'BOOKING',
        subject: faker.lorem.words({ min: 2, max: 5 }),
      },
    });
    
    conversations.push(conversation);
    
    // Add participants
    await prisma.conversationParticipant.create({
      data: {
        conversationId: conversation.id,
        userId: user1.id,
      },
    });
    
    await prisma.conversationParticipant.create({
      data: {
        conversationId: conversation.id,
        userId: user2.id,
      },
    });
    
    // Create 4-5 messages per conversation
    for (let j = 0; j < faker.number.int({ min: 4, max: 5 }); j++) {
      const sender = Math.random() > 0.5 ? user1 : user2;
      
      const message = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: sender.id,
          content: faker.lorem.sentence(),
          status: randomIndex(['SENT', 'DELIVERED']),
        },
      });
      
      // Create read receipt if message should be read
      if (Math.random() > 0.3) {
        const receiver = sender.id === user1.id ? user2 : user1;
        await prisma.messageReadReceipt.create({
          data: {
            messageId: message.id,
            userId: receiver.id,
            readAt: new Date(),
          },
        });
      }
      
      messageCount++;
    }
  }

  console.log(`   ✓ Created ${messageCount} messages in ${conversations.length} conversations`);

  console.log('\n✅ Database seed completed successfully!');
  console.log('\n📊 Database Statistics:');
  console.log(`   - Users: ${users.length} (${owners.length} owners, ${customers.length} customers, 2 admin/support)`);
  console.log(`   - Categories: ${categories.length}`);
  console.log(`   - Listings: ${listings.length}`);
  console.log(`   - Bookings: ${bookings.length}`);
  console.log(`   - Reviews: ${reviews.length}`);
  console.log(`   - Sessions: ${sessionCount}`);
  console.log(`   - Messages: ${messageCount}`);
  console.log(`   - Conversations: ${conversations.length}`);
  console.log('\n📝 Test User Accounts:');
  console.log('   Email: admin@rental.local (Admin, Password: password123)');
  console.log('   Email: support@rental.local (Support, Password: password123)');
  console.log('   + 150 additional randomly generated user accounts (all with password: password123)');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
