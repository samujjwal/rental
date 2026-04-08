# Invariant Assertions Guide for Existing Tests

## Overview

This guide provides a systematic approach to adding invariant assertions to existing test files. Invariant assertions are checks that validate business rules and data invariants that should always hold true, regardless of the test scenario.

## What Are Invariant Assertions?

Invariant assertions validate:
- **Data integrity**: Relationships between entities remain consistent
- **Business rules**: Core business logic is never violated
- **State consistency**: System state transitions are valid
- **Type safety**: Data types and formats are correct
- **Boundary conditions**: Values stay within acceptable ranges

## Common Invariants to Add

### 1. Financial Invariants

**For payment/booking tests:**
```typescript
// Total price equals sum of components
expect(booking.totalPrice).toBe(
  booking.basePrice + 
  booking.cleaningFee + 
  booking.serviceFee + 
  booking.taxAmount
);

// Currency consistency across all monetary fields
expect(booking.currency).toBe(payment.currency);
expect(booking.currency).toBe(refund.currency);

// Amounts are never negative
expect(booking.totalPrice).toBeGreaterThanOrEqual(0);
expect(payment.amount).toBeGreaterThanOrEqual(0);
```

**For FX conversion tests:**
```typescript
// Exact validation: converted amount matches rate
const expectedAmount = originalAmount * rate;
expect(convertedAmount).toBe(expectedAmount);

// Invariant: conversion is reversible (within precision)
const reversedAmount = convertedAmount / rate;
expect(reversedAmount).toBeCloseTo(originalAmount, 2);
```

### 2. Date/Time Invariants

**For booking/availability tests:**
```typescript
// End date is always after start date
expect(booking.endDate.getTime()).toBeGreaterThan(booking.startDate.getTime());

// Duration is positive
const durationHours = (booking.endDate.getTime() - booking.startDate.getTime()) / (1000 * 60 * 60);
expect(durationHours).toBeGreaterThan(0);

// Check-in/check-out times are within booking period
expect(checkin.checkinTime.getTime()).toBeGreaterThanOrEqual(booking.startDate.getTime());
expect(checkout.checkoutTime.getTime()).toBeLessThanOrEqual(booking.endDate.getTime());
```

### 3. Relationship Invariants

**For entity relationship tests:**
```typescript
// Foreign key consistency
expect(booking.listingId).toBe(booking.listing.id);
expect(booking.renterId).toBe(booking.renter.id);
expect(booking.ownerId).toBe(booking.bookingOwner.id);

// No orphaned records
const bookingsWithInvalidListing = await prisma.booking.findMany({
  where: { listing: { is: null } },
});
expect(bookingsWithInvalidListing.length).toBe(0);
```

### 4. Status Transition Invariants

**For state machine tests:**
```typescript
// Status transitions are valid
const validTransitions = {
  'PENDING': ['CONFIRMED', 'CANCELLED'],
  'CONFIRMED': ['IN_PROGRESS', 'CANCELLED'],
  'IN_PROGRESS': ['COMPLETED', 'DISPUTED'],
};
expect(validTransitions[fromStatus]).toContain(toStatus);

// Status is never null or undefined
expect(booking.status).toBeDefined();
expect(booking.status).not.toBe('');
```

### 5. Count/Aggregation Invariants

**For listing/booking tests:**
```typescript
// Total bookings equals sum of status counts
const statusCounts = await prisma.booking.groupBy({
  by: ['status'],
  _count: true,
});
const total = statusCounts.reduce((sum, s) => sum + s._count, 0);
const allBookings = await prisma.booking.count();
expect(total).toBe(allBookings);

// Listing stats match actual bookings
const listing = await prisma.listing.findUnique({
  where: { id: 'listing-1' },
});
const actualBookings = await prisma.booking.count({
  where: { listingId: 'listing-1' },
});
expect(listing.totalBookings).toBe(actualBookings);
```

### 6. Measurement/Physical Invariants

**For vehicle/space tests:**
```typescript
// Mileage never decreases
expect(dropoff.mileage).toBeGreaterThanOrEqual(pickup.mileage);

// Fuel level is always 0-100
expect(fuelLevel).toBeGreaterThanOrEqual(0);
expect(fuelLevel).toBeLessThanOrEqual(100);

// Dimensions are positive
expect(length).toBeGreaterThan(0);
expect(width).toBeGreaterThan(0);
expect(height).toBeGreaterThan(0);
```

## Implementation Strategy

### Phase 1: Critical Financial Tests

**Priority files to enhance:**
1. `/apps/api/src/modules/payments/services/fx-rate.service.spec.ts` ✅ (Already enhanced)
2. `/apps/api/src/modules/marketplace/services/tax-policy-engine.service.spec.ts` ✅ (Already enhanced)
3. `/apps/api/src/modules/payments/services/payouts.service.spec.ts`
4. `/apps/api/src/modules/payments/services/ledger.service.spec.ts`

**Add these invariants:**
```typescript
// After each test that creates/updates payments
expect(payment.amount).toBeGreaterThanOrEqual(0);
expect(payment.currency).toMatch(/^[A-Z]{3}$/);

// For ledger entries
expect(entry.debit + entry.credit).toBe(entry.amount);
expect(entry.balanceAfter).toBe(entry.balanceBefore + entry.credit - entry.debit);
```

### Phase 2: Booking Lifecycle Tests

**Priority files to enhance:**
1. `/apps/api/src/modules/bookings/services/bookings.service.spec.ts`
2. `/apps/api/src/modules/bookings/services/booking-state-machine.service.spec.ts`
3. `/apps/api/src/modules/bookings/services/booking-availability-integration.spec.ts`

**Add these invariants:**
```typescript
// After booking creation
expect(booking.startDate).toBeInstanceOf(Date);
expect(booking.endDate).toBeInstanceOf(Date);
expect(booking.endDate.getTime()).toBeGreaterThan(booking.startDate.getTime());
expect(booking.totalPrice).toBeGreaterThan(0);

// After status transitions
expect(booking.status).toBeDefined();
expect(booking.status.length).toBeGreaterThan(0);
```

### Phase 3: Availability/Inventory Tests

**Priority files to enhance:**
1. `/apps/api/src/modules/listings/services/availability.service.spec.ts`
2. `/apps/api/src/modules/listings/services/availability.service.overlap-detection.spec.ts`

**Add these invariants:**
```typescript
// No overlapping bookings for same listing
const overlappingBookings = await prisma.booking.findMany({
  where: {
    listingId: listingId,
    status: { in: ['CONFIRMED', 'IN_PROGRESS'] },
    OR: [
      { startDate: { lte: newBooking.endDate }, endDate: { gte: newBooking.startDate } },
    ],
  },
});
expect(overlappingBookings.length).toBe(0);
```

### Phase 4: User/Organization Tests

**Priority files to enhance:**
1. `/apps/api/src/modules/users/services/users.service.spec.ts`
2. `/apps/api/src/modules/auth/services/auth.service.spec.ts`

**Add these invariants:**
```typescript
// Email format is valid
expect(user.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);

// Username is alphanumeric with allowed special chars
expect(user.username).toMatch(/^[a-zA-Z0-9_-]+$/);

// Password hash is not null for users with passwords
if (user.passwordHash) {
  expect(user.passwordHash.length).toBeGreaterThan(0);
}
```

## Testing Pattern for Invariants

### Pattern 1: Post-Action Validation
```typescript
it('should maintain invariants after booking creation', async () => {
  const booking = await bookingsService.create(createDto);
  
  // Invariant assertions
  expect(booking.totalPrice).toBeGreaterThan(0);
  expect(booking.endDate.getTime()).toBeGreaterThan(booking.startDate.getTime());
  expect(booking.currency).toMatch(/^[A-Z]{3}$/);
  expect(booking.status).toBeDefined();
});
```

### Pattern 2: State Transition Validation
```typescript
it('should maintain invariants during status transition', async () => {
  const booking = await bookingsService.transitionStatus(bookingId, 'CONFIRMED');
  
  // Invariant assertions
  expect(booking.status).toBe('CONFIRMED');
  expect(booking.updatedAt.getTime()).toBeGreaterThanOrEqual(booking.createdAt.getTime());
  expect(booking.totalPrice).toBeGreaterThan(0);
});
```

### Pattern 3: Relationship Validation
```typescript
it('should maintain referential integrity', async () => {
  const booking = await bookingsService.findById(bookingId, true);
  
  // Invariant assertions
  expect(booking.listingId).toBe(booking.listing.id);
  expect(booking.renterId).toBe(booking.renter.id);
  expect(booking.ownerId).toBe(booking.bookingOwner.id);
});
```

## Checklist for Adding Invariants

For each test file, review and add:

- [ ] Financial invariants (amounts, currencies, calculations)
- [ ] Date/time invariants (start < end, duration > 0)
- [ ] Relationship invariants (foreign key consistency)
- [ ] Status invariants (valid transitions, non-null)
- [ ] Count invariants (aggregations match actuals)
- [ ] Type invariants (correct types, formats)
- [ ] Boundary invariants (values within ranges)

## Automation Script

Create a helper utility to automatically add common invariants:

```typescript
// test-utils/invariant-assertions.ts
export const assertBookingInvariants = (booking: any) => {
  expect(booking.totalPrice).toBeGreaterThanOrEqual(0);
  expect(booking.currency).toMatch(/^[A-Z]{3}$/);
  expect(booking.startDate).toBeInstanceOf(Date);
  expect(booking.endDate).toBeInstanceOf(Date);
  expect(booking.endDate.getTime()).toBeGreaterThan(booking.startDate.getTime());
  expect(booking.status).toBeDefined();
};

export const assertPaymentInvariants = (payment: any) => {
  expect(payment.amount).toBeGreaterThanOrEqual(0);
  expect(payment.currency).toMatch(/^[A-Z]{3}$/);
  expect(payment.status).toBeDefined();
};
```

## Summary

Adding invariant assertions systematically improves test quality by:
1. **Catching regressions**: Invariants that fail indicate broken business logic
2. **Documenting assumptions**: Invariants make business rules explicit
3. **Improving confidence**: More assertions mean better test coverage
4. **Enabling refactoring**: Invariants ensure behavior is preserved

Start with critical financial tests, then move to booking lifecycle, availability, and finally user/auth tests. Use the helper utilities to maintain consistency across the codebase.
