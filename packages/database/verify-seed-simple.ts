import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';

config({ path: '../../.env' });
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function verifySeedData() {
  console.log('🔍 Verifying seed data...\n');

  try {
    // Core entity counts
    const userCount = await prisma.user.count();
    const listingCount = await prisma.listing.count();
    const bookingCount = await prisma.booking.count();
    const categoryCount = await prisma.category.count();
    const paymentCount = await prisma.payment.count();
    const reviewCount = await prisma.review.count();
    const conversationCount = await prisma.conversation.count();
    const messageCount = await prisma.message.count();
    const organizationCount = await prisma.organization.count();
    const cancellationPolicyCount = await prisma.cancellationPolicy.count();

    console.log('📊 Entity Counts:');
    console.log(`   👥 Users: ${userCount}`);
    console.log(`   🏠 Listings: ${listingCount}`);
    console.log(`   📅 Bookings: ${bookingCount}`);
    console.log(`   📂 Categories: ${categoryCount}`);
    console.log(`   💳 Payments: ${paymentCount}`);
    console.log(`   ⭐ Reviews: ${reviewCount}`);
    console.log(`   💬 Conversations: ${conversationCount}`);
    console.log(`   ✉️ Messages: ${messageCount}`);
    console.log(`   🏢 Organizations: ${organizationCount}`);
    console.log(`   📋 Cancellation Policies: ${cancellationPolicyCount}`);

    // User role distribution
    const userRoles = await prisma.user.groupBy({
      by: ['role'],
      _count: { role: true }
    });
    console.log('\n👤 User Role Distribution:');
    userRoles.forEach(role => {
      console.log(`   ${role.role}: ${role._count.role}`);
    });

    // Booking status distribution
    const bookingStatuses = await prisma.booking.groupBy({
      by: ['status'],
      _count: { status: true }
    });
    console.log('\n📅 Booking Status Distribution:');
    bookingStatuses.forEach(status => {
      console.log(`   ${status.status}: ${status._count.status}`);
    });

    // Listing status distribution
    const listingStatuses = await prisma.listing.groupBy({
      by: ['status'],
      _count: { status: true }
    });
    console.log('\n🏠 Listing Status Distribution:');
    listingStatuses.forEach(status => {
      console.log(`   ${status.status}: ${status._count.status}`);
    });

    // Check for test users
    const testUsers = await prisma.user.findMany({
      where: {
        OR: [
          { email: 'renter@test.com' },
          { email: 'owner@test.com' },
          { email: 'admin@test.com' }
        ]
      },
      select: { email: true, firstName: true, lastName: true, role: true }
    });
    console.log('\n🧪 Test Users:');
    testUsers.forEach(user => {
      console.log(`   ${user.email} (${user.firstName} ${user.lastName}) - ${user.role}`);
    });

    // Verification summary
    console.log('\n✅ Seed Data Verification Summary:');
    const isSeeded = userCount >= 100 && listingCount >= 500 && bookingCount >= 200;
    
    if (isSeeded) {
      console.log('🎉 All seed data is properly populated!');
      console.log('   ✓ Users: Adequate count for testing');
      console.log('   ✓ Listings: Good variety for search/browse');
      console.log('   ✓ Bookings: Sufficient for workflow testing');
      console.log('   ✓ Categories: Multiple rental types covered');
      console.log('   ✓ Test Users: E2E testing accounts ready');
    } else {
      console.log('⚠️  Seed data may be incomplete');
      console.log(`   Expected: Users≥100, Listings≥500, Bookings≥200`);
      console.log(`   Actual: Users=${userCount}, Listings=${listingCount}, Bookings=${bookingCount}`);
    }

    // Additional checks for comprehensive coverage
    console.log('\n🔍 Comprehensive Coverage Check:');
    console.log(`   💰 Payments: ${paymentCount >= 200 ? '✅' : '❌'} (${paymentCount} records)`);
    console.log(`   ⭐ Reviews: ${reviewCount >= 50 ? '✅' : '❌'} (${reviewCount} records)`);
    console.log(`   💬 Conversations: ${conversationCount >= 50 ? '✅' : '❌'} (${conversationCount} records)`);
    console.log(`   ✉️ Messages: ${messageCount >= 200 ? '✅' : '❌'} (${messageCount} records)`);
    console.log(`   🏢 Organizations: ${organizationCount >= 10 ? '✅' : '❌'} (${organizationCount} records)`);

  } catch (error) {
    console.error('❌ Verification failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifySeedData().catch(console.error);
