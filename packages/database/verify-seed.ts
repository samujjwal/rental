import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

config({ path: '../../.env' });

const prisma = new PrismaClient();

async function verify() {
  console.log('\n📊 Database Seed Verification Report\n');
  console.log('=====================================\n');

  // 1. Check monthly booking distribution
  console.log('1️⃣  Monthly Booking Distribution (Time-Series Data):');
  console.log('   (Should show bookings spread across 12 months)\n');
  
  const monthlyBookings = await prisma.$queryRaw<Array<{month: string, bookings: bigint, revenue: number}>>`
    SELECT 
      TO_CHAR("createdAt", 'YYYY-MM') as month,
      COUNT(*)::int as bookings,
      SUM(COALESCE("totalAmount", "totalPrice"))::numeric::integer as revenue
    FROM bookings
    GROUP BY month
    ORDER BY month DESC
    LIMIT 12
  `;
  
  console.table(monthlyBookings.map(r => ({
    Month: r.month,
    Bookings: Number(r.bookings),
    Revenue: `$${r.revenue?.toLocaleString() || 0}`
  })));

  // 2. Check listing views
  console.log('\n2️⃣  Listing Views/ViewCount Status:');
  console.log('   (Should show 100% of listings have views > 0)\n');
  
  const allListings = await prisma.listing.count();
  const listingsWithViews = await prisma.listing.count({
    where: {
      AND: [
        { views: { gt: 0 } },
        { viewCount: { gt: 0 } }
      ]
    }
  });
  
  const avgViews = await prisma.listing.aggregate({
    _avg: { views: true }
  });
  
  const percentage = allListings > 0 ? (listingsWithViews / allListings * 100).toFixed(1) : '0';
  console.log(`   Total Listings: ${allListings}`);
  console.log(`   With Views Set: ${listingsWithViews} (${percentage}%)`);
  console.log(`   Average Views: ${Math.round(avgViews._avg.views || 0)}`);

  // 3. Check payment-booking status alignment
  console.log('\n3️⃣  Payment-Booking Status Alignment:');
  console.log('   (COMPLETED/CONFIRMED bookings should have COMPLETED payments)\n');
  
  const paymentsWithBookings = await prisma.payment.findMany({
    select: {
      status: true,
      booking: {
        select: {
          status: true
        }
      }
    }
  });
  
  const alignment: Record<string, Record<string, number>> = {};
  paymentsWithBookings.forEach(p => {
    const bookingStatus = p.booking.status;
    const paymentStatus = p.status;
    if (!alignment[bookingStatus]) alignment[bookingStatus] = {};
    alignment[bookingStatus][paymentStatus] = (alignment[bookingStatus][paymentStatus] || 0) + 1;
  });
  
  const alignmentDisplay = Object.entries(alignment).flatMap(([bs, payments]) =>
    Object.entries(payments).map(([ps, count]) => ({
      'Booking Status': bs,
      'Payment Status': ps,
      'Count': count
    }))
  );
  
  console.table(alignmentDisplay);

  // 4. Check test user data richness
  console.log('\n4️⃣  E2E Test User Data:');
  console.log('   (Test users should have comprehensive data for testing)\n');
  
  const testUsers = await prisma.user.findMany({
    where: {
      email: { in: ['renter@test.com', 'owner@test.com', 'admin@test.com'] }
    },
    select: {
      email: true,
      listings: { select: { id: true } },
      bookings: { select: { id: true } },
      bookingsOwned: { select: { id: true } },
      reviewsGiven: { select: { id: true } }
    }
  });
  
  console.table(testUsers.map(u => ({
    'Email': u.email,
    'Listings': u.listings.length,
    'Bookings Made': u.bookings.length,
    'Bookings Received': u.bookingsOwned.length,
    'Reviews Given': u.reviewsGiven.length
  })));

  // 5. Check booking status distribution
  console.log('\n5️⃣  Booking Status Distribution:');
  console.log('   (Should show weighted distribution favoring COMPLETED/CONFIRMED)\n');
  
  const totalBookings = await prisma.booking.count();
  const statusGroups = await prisma.booking.groupBy({
    by: ['status'],
    _count: true
  });
  
  console.table(statusGroups.map(g => ({
    'Status': g.status,
    'Count': g._count,
    'Percentage': `${((g._count / totalBookings) * 100).toFixed(1)}%`
  })).sort((a, b) => parseInt(b.Percentage) - parseInt(a.Percentage)));

  // 6. Check ledger entry completeness
  console.log('\n6️⃣  Ledger Entry Completeness:');
  console.log('   (Should have ledger entry for every payment)\n');
  
  const paymentsCount = await prisma.payment.count();
  const ledgerCount = await prisma.ledgerEntry.count();
  
  const coverage = paymentsCount > 0 ? ((ledgerCount / paymentsCount) * 100).toFixed(1) : '0';
  console.log(`   Total Payments: ${paymentsCount}`);
  console.log(`   Ledger Entries: ${ledgerCount}`);
  console.log(`   Coverage: ${coverage}%`);

  // Summary
  console.log('\n✅ Verification Complete!\n');
  console.log('Summary:');
  console.log(`  - Time-series data: ${monthlyBookings.length} months of data`);
  console.log(`  - Listing views: ${percentage}% have views set`);
  console.log(`  - Payment alignment: ${alignmentDisplay.length} status combinations`);
  console.log(`  - Test users: ${testUsers.length} test accounts ready`);
  console.log(`  - Ledger coverage: ${coverage}%`);
  console.log('\n');
}

verify()
  .catch((e) => {
    console.error('❌ Error during verification:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
