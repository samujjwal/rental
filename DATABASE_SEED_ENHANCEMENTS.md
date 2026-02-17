# Database Seed Enhancement - Implementation Guide

This guide contains code snippets to enhance the existing `seed-comprehensive.ts` file.

## Quick Fixes to Apply

### 1. Add Helper Functions (Add at top after imports)

```typescript
// Time series helpers
function monthsAgo(months: number): Date {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date;
}

function getBookingDateForMonth(monthIndex: number, endMonth: number = 0): Date {
  const now = new Date();
  const targetMonth = new Date(
    now.getFullYear(),
    now.getMonth() - monthIndex + endMonth,
    1
  );
  const daysInMonth = new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth() + 1,
    0
  ).getDate();
  const randomDay = faker.number.int({ min: 1, max: Math.max(1, daysInMonth - 7) });
  return new Date(targetMonth.getFullYear(), targetMonth.getMonth(), randomDay);
}

// Seasonal pricing multiplier
function getSeasonalMultiplier(date: Date): number {
  const month = date.getMonth();
  // Summer peak (June-August)
  if (month >= 5 && month <= 7) return 1.3;
  // Holiday peak (December-January)
  if (month === 11 || month === 0) return 1.2;
  // Off-season
  return 0.9;
}

// Weighted status selection
function getWeightedBookingStatus(isPast: boolean, isVeryCurrent: boolean): string {
  if (isVeryCurrent) {
    return faker.helpers.weightedArrayElement([
      { weight: 50, value: 'IN_PROGRESS' },
      { weight: 30, value: 'CONFIRMED' },
      { weight: 20, value: 'PENDING' },
    ]);
  }
  
  if (isPast) {
    return faker.helpers.weightedArrayElement([
      { weight: 60, value: 'COMPLETED' },
      { weight: 25, value: 'CONFIRMED' },
      { weight: 15, value: 'CANCELLED' },
    ]);
  }
  
  return faker.helpers.weightedArrayElement([
    { weight: 70, value: 'CONFIRMED' },
    { weight: 20, value: 'PENDING' },
    { weight: 10, value: 'CANCELLED' },
  ]);
}

function getPaymentStatusFromBooking(bookingStatus: string): string {
  switch (bookingStatus) {
    case 'COMPLETED':
    case 'CONFIRMED':
    case 'IN_PROGRESS':
    case 'SETTLED':
      return 'COMPLETED';
    case 'CANCELLED':
      return 'REFUNDED';
    case 'PENDING':
      return 'PENDING';
    default:
      return 'PENDING';
  }
}

function getRealisticBookingDuration(): number {
  const durationType = faker.helpers.weightedArrayElement([
    { weight: 40, value: 'weekend' },    // 2-3 nights
    { weight: 30, value: 'week' },       // 7 nights
    { weight: 20, value: 'short' },      // 1 night
    { weight: 10, value: 'extended' }    // 14+ nights
  ]);

  switch (durationType) {
    case 'weekend':
      return faker.number.int({ min: 2, max: 3 });
    case 'week':
      return 7;
    case 'short':
      return 1;
    case 'extended':
      return faker.number.int({ min: 14, max: 30 });
    default:
      return 3;
  }
}
```

### 2. Fix Listing Creation (Replace lines ~566-650)

```typescript
// Create listings - 100+ per category with VIEWS
console.log('🏠 Creating listings...');
const listings: any[] = [];

for (const category of categories) {
  const listingsPerCategory =
    category.slug === 'apartment' ? 120 : category.slug === 'house' ? 110 : 100;

  for (let i = 0; i < listingsPerCategory; i++) {
    const owner = hostUsers[Math.floor(Math.random() * hostUsers.length)];
    const policy = policies[Math.floor(Math.random() * policies.length)];
    const org = organizations[Math.floor(Math.random() * organizations.length)];
    
    // Generate realistic view counts
    const viewCount = faker.number.int({ min: 50, max: 2000 });

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
        // FIX: Set both views and viewCount
        views: viewCount,
        viewCount: viewCount,
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
```

### 3. Fix Bookings with Time-Series Data (Replace lines ~678-730)

```typescript
// Create bookings with TIME-SERIES data spanning 12 months
console.log('📅 Creating bookings with historical data...');
const bookings: any[] = [];
const renters = users.filter((u) => u.role === 'USER' || u.role === 'CUSTOMER');

// Create 300 bookings distributed over 12 months (25 per month)
for (let i = 0; i < 300; i++) {
  const listing = listings[Math.floor(Math.random() * listings.length)];
  const renter = renters[Math.floor(Math.random() * renters.length)];

  if (listing.ownerId === renter.id) continue;

  // Distribute across 12 months
  const monthIndex = Math.floor((i / 300) * 12); // 0-11
  const startDate = getBookingDateForMonth(11 - monthIndex); // 11 months ago to now
  
  // Realistic booking duration
  const nights = getRealisticBookingDuration();
  const endDate = new Date(startDate.getTime() + nights * 24 * 60 * 60 * 1000);
  
  // Apply seasonal pricing
  const seasonalMultiplier = getSeasonalMultiplier(startDate);
  const basePrice = Number(listing.basePrice) * seasonalMultiplier;
  const totalPrice = basePrice * nights + Number(listing.cleaningFee || 0);

  // Determine if booking is in the past, current, or future
  const now = new Date();
  const isPast = endDate < now;
  const isVeryCurrent = Math.abs(now.getTime() - startDate.getTime()) < 7 * 24 * 60 * 60 * 1000;
  
  // Get realistic weighted status
  const status = getWeightedBookingStatus(isPast, isVeryCurrent);

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
        totalAmount: new Prisma.Decimal(totalPrice), // Also set totalAmount
        currency: 'USD',
        status: status as any,
        guestCount: faker.number.int({ min: 1, max: 6 }),
        specialRequests: faker.lorem.sentence(),
        guestNotes: faker.lorem.sentence(),
        ownerNotes: faker.lorem.sentence(),
        checkInTime: '15:00',
        checkOutTime: '11:00',
        ownerEarnings: new Prisma.Decimal(totalPrice * 0.9),
        platformFee: new Prisma.Decimal(totalPrice * 0.1),
        createdAt: startDate, // Set creation date to match booking date
      },
    });

    bookings.push(booking);
  } catch (error) {
    // Skip duplicate bookings
  }
}

console.log(`✓ Created ${bookings.length} bookings spanning 12 months\n`);
```

### 4. Fix Payments to Match Booking Status (Replace lines ~755-780)

```typescript
// Create payments ALIGNED with booking status
console.log('💳 Creating payments...');
const payments = await Promise.all(
  bookings.slice(0, 250).map((booking) => {
    // Payment status MUST match booking status
    const paymentStatus = getPaymentStatusFromBooking(booking.status);
    
    return prisma.payment.create({
      data: {
        bookingId: booking.id,
        amount: booking.totalPrice,
        currency: 'USD',
        status: paymentStatus as any,
        paymentMethod: faker.helpers.arrayElement(['CREDIT_CARD', 'DEBIT_CARD', 'PAYPAL']),
        paymentIntentId: generatePaymentIntentId(),
        stripePaymentIntentId: generatePaymentIntentId(),
        chargeId: generateStripeId(),
        stripeChargeId: generateStripeId(),
        fee: new Prisma.Decimal(Number(booking.totalPrice) * 0.03),
        netAmount: new Prisma.Decimal(Number(booking.totalPrice) * 0.97),
        processedAt: paymentStatus === 'COMPLETED' ? booking.createdAt : faker.date.recent({ days: 30 }),
        description: `Payment for booking ${booking.id}`,
        createdAt: booking.createdAt, // Match booking creation date
      },
    });
  }),
);

console.log(`✓ Created ${payments.length} payments\n`);
```

### 5. Fix Ledger Entries to be Complete (Replace lines ~860-875)

```typescript
// Create ledger entries for ALL payments
console.log('📊 Creating ledger entries...');
const ledgerEntries = await Promise.all(
  payments.map((payment, idx) => {
    const booking = bookings.find(b => b.id === payment.bookingId);
    if (!booking) return null;
    
    return prisma.ledgerEntry.create({
      data: {
        bookingId: booking.id,
        accountId: booking.ownerId,
        accountType: 'REVENUE',
        side: 'CREDIT',
        transactionType: 'PAYMENT',
        amount: new Prisma.Decimal(Number(booking.totalPrice) * 0.9),
        currency: 'USD',
        description: `Payment for booking ${booking.id}`,
        status: payment.status === 'COMPLETED' ? 'SETTLED' : 'PENDING',
        createdAt: booking.createdAt,
      },
    });
  }),
);

console.log(`✓ Created ${ledgerEntries.filter(Boolean).length} ledger entries\n`);
```

### 6. Add Test User Enrichment (Add BEFORE summary section)

```typescript
// ===== ENRICH E2E TEST USER DATA =====
console.log('\n🧪 Enriching E2E test user data for comprehensive testing...\n');

// Test Owner's Listings (10 diverse listings)
console.log('  Creating test owner listings...');
const testOwnerListings = await Promise.all(
  categories.slice(0, 5).flatMap((category, catIdx) =>
    Array.from({ length: 2 }, async (_, i) => {
      const viewCount = faker.number.int({ min: 300, max: 1500 });
      return prisma.listing.create({
        data: {
          title: `Test Owner ${category.name} ${i + 1}`,
          slug: `test-owner-${category.slug}-${catIdx * 2 + i}`,
          description: faker.lorem.paragraphs(2),
          address: faker.location.streetAddress(),
          city: 'Austin',
          state: 'TX',
          zipCode: faker.location.zipCode(),
          country: 'USA',
          latitude: faker.location.latitude(),
          longitude: faker.location.longitude(),
          ownerId: testOwner.id,
          categoryId: category.id,
          cancellationPolicyId: policies[i % policies.length].id,
          status: i === 0 ? 'AVAILABLE' : 'RENTED',
          verificationStatus: 'VERIFIED',
          bookingMode: i % 2 === 0 ? 'INSTANT_BOOK' : 'REQUEST',
          basePrice: new Prisma.Decimal(faker.number.float({ min: 100, max: 400, fractionDigits: 2 })),
          currency: 'USD',
          securityDeposit: new Prisma.Decimal(200),
          cleaningFee: new Prisma.Decimal(50),
          amenities: ['WiFi', 'Kitchen', 'Parking', 'AC'],
          photos: Array.from({ length: 6 }, () => 
            `https://picsum.photos/seed/${faker.string.alphanumeric(12)}/800/600.jpg`
          ),
          rules: ['No smoking', 'No parties'],
          bedrooms: faker.number.int({ min: 1, max: 4 }),
          bathrooms: 2,
          maxGuests: 4,
          averageRating: faker.number.float({ min: 4.2, max: 4.9, fractionDigits: 1 }),
          totalReviews: faker.number.int({ min: 10, max: 40 }),
          totalBookings: faker.number.int({ min: 15, max: 50 }),
          views: viewCount,
          viewCount: viewCount,
          instantBookable: i % 2 === 0,
          minStayNights: 1,
          maxStayNights: 90,
          checkInTime: '15:00',
          checkOutTime: '11:00',
          featured: i === 0,
          isActive: true,
        },
      });
    })
  )
);

console.log(`  ✓ Created ${testOwnerListings.length} test owner listings`);

// Test Renter's Bookings (15 bookings across different states and times)
console.log('  Creating test renter bookings...');
const testRenterBookings = await Promise.all(
  testOwnerListings.slice(0, 10).map(async (listing, i) => {
    const monthIndex = i; // Spread across 10 months
    const startDate = getBookingDateForMonth(10 - monthIndex);
    const nights = getRealisticBookingDuration();
    const endDate = new Date(startDate.getTime() + nights * 24 * 60 * 60 * 1000);
    const isPast = endDate < new Date();
    
    const statuses = ['CONFIRMED', 'COMPLETED', 'PENDING', 'COMPLETED', 'COMPLETED', 
                     'CONFIRMED', 'COMPLETED', 'CANCELLED', 'COMPLETED', 'IN_PROGRESS'];
    const status = statuses[i % statuses.length];
    
    const basePrice = Number(listing.basePrice);
    const totalPrice = basePrice * nights + Number(listing.cleaningFee || 0);
    
    return prisma.booking.create({
      data: {
        listingId: listing.id,
        ownerId: listing.ownerId,
        renterId: testRenter.id,
        startDate,
        endDate,
        basePrice: listing.basePrice,
        securityDeposit: listing.securityDeposit,
        cleaningFee: listing.cleaningFee,
        serviceFee: new Prisma.Decimal(totalPrice * 0.1),
        totalPrice: new Prisma.Decimal(totalPrice),
        totalAmount: new Prisma.Decimal(totalPrice),
        currency: 'USD',
        status: status as any,
        guestCount: faker.number.int({ min: 1, max: 4 }),
        specialRequests: 'Test booking for E2E tests',
        checkInTime: '15:00',
        checkOutTime: '11:00',
        ownerEarnings: new Prisma.Decimal(totalPrice * 0.9),
        platformFee: new Prisma.Decimal(totalPrice * 0.1),
        createdAt: startDate,
      },
    });
  })
);

console.log(`  ✓ Created ${testRenterBookings.length} test renter bookings`);

// Test Renter's Reviews (for completed bookings)
console.log('  Creating test renter reviews...');
const testRenterReviews = await Promise.all(
  testRenterBookings
    .filter(b => b.status === 'COMPLETED')
    .map(booking =>
      prisma.review.create({
        data: {
          bookingId: booking.id,
          listingId: booking.listingId,
          reviewerId: testRenter.id,
          revieweeId: testOwner.id,
          type: 'LISTING_REVIEW',
          rating: faker.number.int({ min: 4, max: 5 }),
          overallRating: faker.number.int({ min: 4, max: 5 }),
          accuracyRating: 5,
          communicationRating: 5,
          cleanlinessRating: faker.number.int({ min: 4, max: 5 }),
          valueRating: faker.number.int({ min: 4, max: 5 }),
          locationRating: 5,
          checkInRating: 5,
          content: 'Great experience with this rental! Everything was as described.',
          status: 'PUBLISHED',
        },
      })
    )
);

console.log(`  ✓ Created ${testRenterReviews.length} test renter reviews`);

// Test Owner's Bookings on their listings (20 bookings from others)
console.log('  Creating bookings on test owner listings...');
const testOwnerBookingsReceived = await Promise.all(
  testOwnerListings.flatMap((listing, idx) =>
    renters.slice(0, 2).map(async (renter, renterIdx) => {
      const monthIndex = (idx * 2 + renterIdx) % 12;
      const startDate = getBookingDateForMonth(11 - monthIndex);
      const nights = getRealisticBookingDuration();
      const endDate = new Date(startDate.getTime() + nights * 24 * 60 * 60 * 1000);
      
      const isPast = endDate < new Date();
      const status = isPast 
        ? (renterIdx === 0 ? 'COMPLETED' : 'CONFIRMED')
        : 'CONFIRMED';
      
      const basePrice = Number(listing.basePrice);
      const totalPrice = basePrice * nights + Number(listing.cleaningFee || 0);
      
      return prisma.booking.create({
        data: {
          listingId: listing.id,
          ownerId: testOwner.id,
          renterId: renter.id,
          startDate,
          endDate,
          basePrice: listing.basePrice,
          totalPrice: new Prisma.Decimal(totalPrice),
          totalAmount: new Prisma.Decimal(totalPrice),
          currency: 'USD',
          status: status as any,
          guestCount: 2,
          ownerEarnings: new Prisma.Decimal(totalPrice * 0.9),
          platformFee: new Prisma.Decimal(totalPrice * 0.1),
          createdAt: startDate,
        },
      }).catch(() => null);
    })
  )
);

console.log(`  ✓ Created ${testOwnerBookingsReceived.filter(Boolean).length} bookings on test owner listings`);

console.log('✓ E2E test user data enrichment complete!\n');
```

---

## Verification Script

After updating the seed file, run this to verify:

```bash
# Run the enhanced seed
pnpm --filter @rental-portal/database seed

# Verify the data
psql $DATABASE_URL << EOF
-- Check monthly distribution
SELECT 
  TO_CHAR(created_at, 'YYYY-MM') as month,
  COUNT(*) as bookings,
  SUM(total_price)::numeric::integer as revenue
FROM bookings
GROUP BY month
ORDER BY month DESC
LIMIT 12;

-- Check test user data
SELECT 
  u.email,
  (SELECT COUNT(*) FROM listings WHERE owner_id = u.id) as listings_owned,
  (SELECT COUNT(*) FROM bookings WHERE renter_id = u.id) as bookings_made,
  (SELECT COUNT(*) FROM bookings WHERE owner_id = u.id) as bookings_received
FROM users u
WHERE email IN ('renter@test.com', 'owner@test.com', 'admin@test.com');

-- Check listing views
SELECT 
  COUNT(*) filter (WHERE views > 0 AND view_count > 0) as with_views,
  COUNT(*) as total,
  AVG(views)::integer as avg_views
FROM listings;

-- Check payment-booking alignment
SELECT 
  b.status as booking,
  p.status as payment,
  COUNT(*) as count
FROM bookings b
JOIN payments p ON b.id = p.booking_id
GROUP BY b.status, p.status
ORDER BY b.status;
EOF
```

---

## Expected Output After Enhancements

```
Monthly bookings: 20-30 per month over 12 months ✅
Test users: 10+ listings, 15+ bookings each ✅
Listing views: 100% with viewCount > 0 ✅
Payment alignment: 100% match booking status ✅
```
