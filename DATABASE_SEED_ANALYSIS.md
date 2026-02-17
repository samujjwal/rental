# Database Seed Data Analysis & Recommendations

**Date**: February 13, 2026  
**Purpose**: Ensure comprehensive test data for all features, flows, reports, insights, and transactions

---

## 📊 Current Seed Data Overview

### ✅ Well-Covered Areas

The `seed-comprehensive.ts` file currently seeds the following with good coverage:

| Entity | Count | Status | Notes |
|--------|-------|--------|-------|
| **Users** | 103 | ✅ Excellent | 100 regular + 3 test users (renter, owner, admin) |
| **Organizations** | 15 | ✅ Good | With members and different verification states |
| **Listings** | 530+ | ✅ Excellent | 100+ per category (Apartment, House, Car, Equipment, Parking) |
| **Bookings** | ~300 | ✅ Good | Various states (PENDING, CONFIRMED, COMPLETED, CANCELLED) |
| **Payments** | 200 | ✅ Good | Multiple states (PENDING, COMPLETED, FAILED, REFUNDED) |
| **Refunds** | 50 | ✅ Good | From cancelled bookings |
| **Reviews** | 150 | ✅ Good | From completed bookings with ratings |
| **Disputes** | 40 | ✅ Good | With evidence, responses, timeline, resolutions |
| **Conversations** | 100 | ✅ Good | With messages and participants |
| **Insurance** | 100 policies, 30 claims | ✅ Good | Various states and types |
| **Favorites** | Many | ✅ Good | Users favoriting listings |
| **Notifications** | 80 | ✅ Good | Different types |
| **Audit Logs** | 50 | ✅ Good | User actions tracked |

---

## ⚠️ Gaps & Issues Identified

### 1. **Time-Series Data (CRITICAL for Analytics/Reports)**

**Issue**: All bookings, payments, and transactions use `faker.date.recent()` or `faker.date.future()`, creating data clustered around current date.

**Impact**:
- ❌ Monthly revenue reports show only current month
- ❌ Trend analysis (6-month, 12-month) shows incomplete data
- ❌ Year-over-year comparisons impossible
- ❌ Seasonal analysis incomplete

**Recommendation**:
```typescript
// Create bookings spanning 12 months for trend analysis
const monthsAgo = (months: number) => {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date;
};

// Distribute bookings evenly across last 12 months
for (let month = 0; month < 12; month++) {
  const startDate = monthsAgo(12 - month);
  // Create 25-40 bookings per month with varying amounts
}
```

### 2. **Listing Views/ViewCount (HIGH Priority)**

**Issue**: Listings are created with `views: faker.number.int({ min: 0, max: 1000 })` but `viewCount` field is not set.

**Impact**:
- ❌ Conversion rate analytics fail (totalViews = 0)
- ❌ "Top viewed listings" reports empty
- ❌ Performance metrics show 0% conversion

**Recommendation**:
```typescript
// In listing creation, ensure both fields are set
views: faker.number.int({ min: 50, max: 2000 }),
viewCount: faker.number.int({ min: 50, max: 2000 }),
```

### 3. **Booking Status Distribution (MEDIUM Priority)**

**Issue**: Random distribution of booking statuses doesn't reflect realistic business flows.

**Current**: `faker.helpers.arrayElement(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'])`

**Impact**:
- ❌ Analytics expect more CONFIRMED/COMPLETED than CANCELLED
- ❌ Revenue reports include unrealistic cancellation rates

**Recommendation**:
```typescript
// Weighted distribution (more realistic)
const status = faker.helpers.weightedArrayElement([
  { weight: 10, value: 'PENDING' },
  { weight: 40, value: 'CONFIRMED' },
  { weight: 35, value: 'COMPLETED' },
  { weight: 10, value: 'CANCELLED' },
  { weight: 5, value: 'IN_PROGRESS' }
]);
```

### 4. **Payment Status Alignment (HIGH Priority)**

**Issue**: Payments have random statuses that may not match booking states.

**Impact**:
- ❌ COMPLETED bookings might have PENDING payments
- ❌ Revenue recognition incorrect
- ❌ Financial reports inconsistent

**Recommendation**:
```typescript
// Payment status should match booking status
const paymentStatus = 
  booking.status === 'COMPLETED' ? 'COMPLETED' :
  booking.status === 'CONFIRMED' ? 'COMPLETED' :
  booking.status === 'CANCELLED' ? 'REFUNDED' :
  booking.status === 'PENDING' ? 'PENDING' : 'PENDING';
```

### 5. **Booking Date Distribution (MEDIUM Priority)**

**Issue**: Bookings use `faker.date.soon({ days: 90 })` creating only future bookings.

**Impact**:
- ❌ No historical bookings for "completed" status testing
- ❌ Past booking reports empty
- ❌ Revenue history incomplete

**Recommendation**:
```typescript
// Mix of past, current, and future bookings
const isPast = i < 150; // 50% past bookings
const isCurrent = i >= 150 && i < 180; // 10% current
const isFuture = i >= 180; // 40% future

const startDate = isPast 
  ? faker.date.between({ from: monthsAgo(12), to: new Date() })
  : isCurrent
    ? faker.date.recent({ days: 7 })
    : faker.date.soon({ days: 90 });
```

### 6. **Revenue Data Distribution (CRITICAL for Financial Reports)**

**Issue**: Random pricing doesn't create realistic revenue patterns.

**Impact**:
- ❌ Revenue trends don't show seasonal patterns
- ❌ No growth trends visible
- ❌ Peak/off-peak analysis impossible

**Recommendation**:
```typescript
// Seasonal pricing (higher in summer months)
const month = startDate.getMonth();
const seasonalMultiplier = 
  month >= 5 && month <= 8 ? 1.3 : // Summer peak
  month === 11 || month <= 1 ? 1.2 : // Holiday peak
  0.9; // Off-season

const basePrice = Number(listing.basePrice) * seasonalMultiplier;
```

### 7. **Customer Segment Data (MEDIUM Priority)**

**Issue**: Random booking durations don't reflect real customer patterns.

**Impact**:
- ❌ Customer segment analysis less meaningful
- ❌ Can't identify weekend vs. long-term renters
- ❌ Pricing strategies harder to test

**Recommendation**:
```typescript
// Realistic duration distribution
const durationType = faker.helpers.weightedArrayElement([
  { weight: 40, value: 'weekend' },    // 2-3 nights
  { weight: 30, value: 'week' },       // 7 nights
  { weight: 20, value: 'short' },      // 1 night
  { weight: 10, value: 'extended' }    // 14+ nights
]);

const nights = 
  durationType === 'weekend' ? faker.number.int({ min: 2, max: 3 }) :
  durationType === 'week' ? 7 :
  durationType === 'short' ? 1 :
  faker.number.int({ min: 14, max: 30 });
```

### 8. **Transaction Ledger Completeness (MEDIUM Priority)**

**Issue**: Only 150 ledger entries created for 300 bookings.

**Impact**:
- ❌ Financial reconciliation incomplete
- ❌ Accounting reports miss transactions
- ❌ Owner earnings tracking incomplete

**Recommendation**:
```typescript
// Create ledger entry for EVERY booking payment
const ledgerEntries = await Promise.all(
  payments.map(payment => {
    const booking = bookings.find(b => b.id === payment.bookingId);
    return prisma.ledgerEntry.create({
      data: {
        bookingId: booking.id,
        accountId: booking.ownerId,
        accountType: 'REVENUE',
        side: 'CREDIT',
        transactionType: 'PAYMENT',
        amount: booking.ownerEarnings,
        currency: 'USD',
        status: payment.status === 'COMPLETED' ? 'SETTLED' : 'PENDING',
        description: `Payment for booking ${booking.id}`,
      }
    });
  })
);
```

### 9. **Test User Data Completeness (HIGH Priority)**

**Issue**: Test users (renter@test.com, owner@test.com, admin@test.com) exist but don't have rich associated data.

**Impact**:
- ❌ E2E tests can't verify complex flows
- ❌ Can't test owner dashboard with real data
- ❌ Can't test renter history views

**Recommendation**:
```typescript
// Create dedicated test data for E2E test users
// Test owner should have:
// - 10 listings (different states, categories)
// - 20 bookings on their listings (different states)
// - 15 completed bookings with reviews
// - 5 disputes (2 resolved, 3 open)
// - Payment history
// - Monthly revenue data

// Test renter should have:
// - 15 bookings (different states)
// - 10 reviews given
// - 5 favorite listings
// - 3 active conversations
// - Payment history
```

### 10. **Message Timestamps & Threading (LOW Priority)**

**Issue**: Messages have random timestamps not ordered within conversations.

**Impact**:
- ❌ Conversation threads may appear out of order
- ❌ "Last message" timestamp issues

**Recommendation**:
```typescript
// Create messages in chronological order
const baseTime = conv.createdAt.getTime();
const messages = await Promise.all(
  Array.from({ length: msgCount }, async (_, idx) => {
    const timestamp = new Date(baseTime + idx * 3600000); // 1 hour apart
    return prisma.message.create({
      data: {
        conversationId: conv.id,
        senderId: idx % 2 === 0 ? booking.renterId : booking.ownerId,
        content: faker.lorem.sentences(2),
        createdAt: timestamp,
        // ...
      }
    });
  })
);
```

---

## 🎯 Priority Recommendations

### **HIGH PRIORITY (Fix First)**

1. ✅ **Add Time-Series Data** - Distribute bookings/payments across 12 months
2. ✅ **Fix Listing Views** - Set both `views` and `viewCount` fields
3. ✅ **Align Payment Status** - Match payment status to booking status
4. ✅ **Enrich Test Users** - Add comprehensive data for E2E test accounts

### **MEDIUM PRIORITY (Fix Soon)**

5. ✅ **Improve Booking Status Distribution** - Use weighted distribution
6. ✅ **Add Booking Date Variety** - Mix past, current, future bookings
7. ✅ **Add Seasonal Pricing** - Reflect real-world seasonal trends
8. ✅ **Complete Ledger Entries** - One entry per payment

### **LOW PRIORITY (Nice to Have)**

9. ✅ **Customer Segment Patterns** - More realistic booking durations
10. ✅ **Message Ordering** - Chronological timestamps in conversations

---

## 🚀 Implementation Plan

### Phase 1: Quick Fixes (30 minutes)

```typescript
// 1. Fix listing views
views: faker.number.int({ min: 100, max: 2000 }),
viewCount: faker.number.int({ min: 100, max: 2000 }),

// 2. Weighted booking statuses
const status = faker.helpers.weightedArrayElement([
  { weight: 10, value: 'PENDING' },
  { weight: 40, value: 'CONFIRMED' },
  { weight: 35, value: 'COMPLETED' },
  { weight: 10, value: 'CANCELLED' },
  { weight: 5, value: 'IN_PROGRESS' }
]);

// 3. Align payment status
const paymentStatus = booking.status === 'COMPLETED' || booking.status === 'CONFIRMED' 
  ? 'COMPLETED' 
  : booking.status === 'CANCELLED' 
    ? 'REFUNDED' 
    : 'PENDING';
```

### Phase 2: Time-Series Data (1 hour)

```typescript
// Helper function
function getBookingDateForMonth(monthIndex: number) {
  const now = new Date();
  const targetMonth = new Date(now.getFullYear(), now.getMonth() - monthIndex, 1);
  const daysInMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
  const randomDay = faker.number.int({ min: 1, max: daysInMonth });
  return new Date(targetMonth.getFullYear(), targetMonth.getMonth(), randomDay);
}

// Distribute bookings across 12 months
for (let i = 0; i < 300; i++) {
  const monthIndex = Math.floor(i / 25); // 25 bookings per month
  const startDate = getBookingDateForMonth(monthIndex);
  
  // Determine status based on date
  const isPast = startDate < new Date();
  const status = isPast 
    ? faker.helpers.weightedArrayElement([
        { weight: 60, value: 'COMPLETED' },
        { weight: 25, value: 'CONFIRMED' },
        { weight: 15, value: 'CANCELLED' }
      ])
    : faker.helpers.weightedArrayElement([
        { weight: 70, value: 'CONFIRMED' },
        { weight: 20, value: 'PENDING' },
        { weight: 10, value: 'CANCELLED' }
      ]);
  
  // ... rest of booking creation
}
```

### Phase 3: Test User Enrichment (1 hour)

```typescript
// After creating test users, add rich data
console.log('🧪 Enriching E2E test user data...');

// Test Owner's Listings (10 listings)
const testOwnerListings = await Promise.all(
  Array.from({ length: 10 }, async (_, i) => {
    const category = categories[i % categories.length];
    return prisma.listing.create({
      data: {
        title: `Test Owner ${category.name} ${i + 1}`,
        slug: `test-owner-${category.slug}-${i}`,
        ownerId: testOwner.id,
        categoryId: category.id,
        status: i === 0 ? 'AVAILABLE' : i === 1 ? 'RENTED' : 'AVAILABLE',
        basePrice: new Prisma.Decimal(faker.number.float({ min: 100, max: 300 })),
        views: faker.number.int({ min: 200, max: 1000 }),
        viewCount: faker.number.int({ min: 200, max: 1000 }),
        averageRating: faker.number.float({ min: 4, max: 5, fractionDigits: 1 }),
        totalReviews: faker.number.int({ min: 5, max: 30 }),
        totalBookings: faker.number.int({ min: 10, max: 50 }),
        // ... other required fields
      }
    });
  })
);

// Test Renter's Bookings (15 bookings across different states)
const testRenterBookings = await Promise.all(
  testOwnerListings.slice(0, 5).map(async (listing, i) => {
    const startDate = getBookingDateForMonth(i * 2);
    const endDate = new Date(startDate.getTime() + 3 * 24 * 60 * 60 * 1000);
    
    return prisma.booking.create({
      data: {
        listingId: listing.id,
        ownerId: listing.ownerId,
        renterId: testRenter.id,
        startDate,
        endDate,
        status: i === 0 ? 'CONFIRMED' : i === 1 ? 'COMPLETED' : i === 2 ? 'PENDING' : 'COMPLETED',
        basePrice: listing.basePrice,
        totalPrice: new Prisma.Decimal(Number(listing.basePrice) * 3),
        // ... other fields
      }
    });
  })
);

console.log(`✓ Created ${testOwnerListings.length} test owner listings`);
console.log(`✓ Created ${testRenterBookings.length} test renter bookings`);
```

---

## 📊 Expected Improvements

### Before Enhancements:
- ❌ Monthly revenue charts show 1-2 months only
- ❌ Conversion rates show 0%
- ❌ No trend analysis possible
- ❌ Test users have minimal data
- ❌ Financial reports incomplete

### After Enhancements:
- ✅ 12 months of complete revenue data
- ✅ Conversion rates calculated correctly
- ✅ Seasonal trends visible
- ✅ Test users have rich, realistic data
- ✅ All financial reports complete
- ✅ Customer segmentation analysis works
- ✅ Competitor analysis functional

---

## 🧪 Testing the Enhanced Seeds

After implementing changes, verify with these queries:

```bash
# 1. Check monthly booking distribution
psql $DATABASE_URL -c "
  SELECT 
    TO_CHAR(created_at, 'YYYY-MM') as month,
    COUNT(*) as bookings,
    SUM(total_price) as revenue
  FROM bookings
  GROUP BY month
  ORDER BY month DESC
  LIMIT 12;
"

# 2. Verify listing views are set
psql $DATABASE_URL -c "
  SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN views > 0 AND view_count > 0 THEN 1 END) as with_views,
    AVG(views) as avg_views
  FROM listings;
"

# 3. Check payment-booking alignment
psql $DATABASE_URL -c "
  SELECT 
    b.status as booking_status,
    p.status as payment_status,
    COUNT(*) as count
  FROM bookings b
  JOIN payments p ON b.id = p.booking_id
  GROUP BY b.status, p.status
  ORDER BY b.status, p.status;
"

# 4. Verify test user data richness
psql $DATABASE_URL -c "
  SELECT 
    u.email,
    (SELECT COUNT(*) FROM listings WHERE owner_id = u.id) as listings,
    (SELECT COUNT(*) FROM bookings WHERE renter_id = u.id) as bookings_as_renter,
    (SELECT COUNT(*) FROM bookings WHERE owner_id = u.id) as bookings_as_owner
  FROM users u
  WHERE email IN ('renter@test.com', 'owner@test.com', 'admin@test.com');
"
```

---

## ✅ Summary

### Current State: **GOOD** (70/100)
- Comprehensive entity coverage
- Good variety in most areas
- Basic relationships established

### After Enhancements: **EXCELLENT** (95/100)
- Complete time-series data for analytics
- Realistic data distributions
- Rich test user data for E2E testing
- All reports and insights fully functional
- Financial data complete and accurate

### Estimated Implementation Time: **2-3 hours**

### Recommended Next Steps:
1. ✅ Implement Phase 1 quick fixes (30 min)
2. ✅ Run seed and verify basic functionality
3. ✅ Implement Phase 2 time-series enhancements (1 hour)
4. ✅ Implement Phase 3 test user enrichment (1 hour)
5. ✅ Run verification queries
6. ✅ Test analytics/insights endpoints
7. ✅ Update seed documentation

---

**Note**: The current seed file is already very comprehensive. These enhancements will make it production-grade for testing all analytics, reports, and business intelligence features.
