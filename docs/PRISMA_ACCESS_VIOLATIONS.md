# Prisma Access Violations in Controllers

**Date:** 2026-04-10
**Status:** Inventory Complete - Remediation In Progress

## Summary

This document inventories all controllers that directly access Prisma, violating the architectural principle that controllers should only use service layers. Direct Prisma access in controllers makes the codebase harder to maintain, test, and refactor.

## CI Check

A GitHub Actions workflow has been created at `.github/workflows/prisma-access-check.yml` to automatically detect these violations in pull requests and pushes.

## Violations Found

### 1. listing-content.controller.ts
**File:** `apps/api/src/modules/listings/controllers/listing-content.controller.ts`
**Lines:** 18, 30, 34
**Status:** ✅ FIXED - Moved `verifyOwnership` to service layer

**Before:**
```typescript
import { PrismaService } from '@/common/prisma/prisma.service';
constructor(
  private readonly contentService: ListingContentService,
  private readonly prisma: PrismaService,
) {}
private async verifyOwnership(listingId: string, userId: string): Promise<void> {
  const listing = await this.prisma.listing.findUnique({
    where: { id: listingId },
    select: { ownerId: true },
  });
  // ...
}
```

**After:**
```typescript
// No PrismaService import
constructor(
  private readonly contentService: ListingContentService,
) {}
await this.contentService.verifyOwnership(listingId, userId);
```

### 2. listing-version.controller.ts
**File:** `apps/api/src/modules/listings/controllers/listing-version.controller.ts`
**Lines:** 14, 26
**Status:** ❌ NOT FIXED

**Issue:**
```typescript
import { PrismaService } from '@/common/prisma/prisma.service';
constructor(private readonly prisma: PrismaService) {}
const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
```

**Remediation:** Move listing lookup to service layer.

### 3. bookings.controller.ts
**File:** `apps/api/src/modules/bookings/controllers/bookings.controller.ts`
**Lines:** 36, 351
**Status:** ❌ NOT FIXED

**Issue:**
```typescript
import { PrismaService } from '@/common/prisma/prisma.service';
constructor(private readonly prisma: PrismaService) {}
const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
```

**Remediation:** Move user role lookup to service layer.

### 4. bookings-dev.controller.ts
**File:** `apps/api/src/modules/bookings/controllers/bookings-dev.controller.ts`
**Lines:** 21, 46, 74
**Status:** ❌ NOT FIXED

**Issue:**
```typescript
import { PrismaService } from '@/common/prisma/prisma.service';
constructor(private readonly prisma: PrismaService) {}
const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
const result = await this.prisma.booking.updateMany({ ... });
```

**Remediation:** Move booking operations to service layer. Note: This is a dev-only controller, so urgency is lower.

### 5. payments.controller.ts
**File:** `apps/api/src/modules/payments/controllers/payments.controller.ts`
**Lines:** 23, 129, 423, 443, 521
**Status:** ❌ NOT FIXED

**Issue:**
```typescript
import { PrismaService } from '@/common/prisma/prisma.service';
constructor(private readonly prisma: PrismaService) {}
const result = await this.prisma.$transaction(async (tx: any) => { ... });
const booking = await this.prisma.booking.findUnique({ ... });
const userPrefs = await this.prisma.userPreferences.findUnique({ ... });
const refundRecord = await this.prisma.refund.create({ ... });
```

**Remediation:** Move all payment-related database operations to service layer. This is the most complex violation due to transaction usage.

## Remediation Priority

### High Priority
1. **payments.controller.ts** - Critical payment logic should be in services
2. **bookings.controller.ts** - Core booking flow

### Medium Priority
3. **listing-version.controller.ts** - Listing management
4. **listing-content.controller.ts** - ✅ Already fixed

### Low Priority
5. **bookings-dev.controller.ts** - Dev-only controller, not production code

## Remediation Pattern

For each violation, follow this pattern:

1. **Add method to service:**
```typescript
// In the service file
async verifyOwnership(listingId: string, userId: string): Promise<void> {
  const listing = await this.prisma.listing.findUnique({
    where: { id: listingId },
    select: { ownerId: true },
  });
  if (!listing) throw new NotFoundException('Listing not found');
  if (listing.ownerId !== userId) throw new ForbiddenException('Unauthorized');
}
```

2. **Update controller:**
```typescript
// Remove PrismaService import
// Remove PrismaService from constructor
// Replace direct Prisma calls with service method calls
await this.service.verifyOwnership(listingId, userId);
```

3. **Update tests:** Ensure controller tests mock the service method instead of Prisma.

## Next Steps

- [ ] Fix listing-version.controller.ts
- [ ] Fix bookings.controller.ts
- [ ] Fix payments.controller.ts (complex due to transactions)
- [ ] Fix bookings-dev.controller.ts (low priority)
- [ ] Run CI check to verify all violations are resolved
- [ ] Update architectural documentation to reinforce this principle

## Statistics

- **Total Violations:** 5
- **Fixed:** 1 (20%)
- **Remaining:** 4 (80%)
- **High Priority:** 2
- **Medium Priority:** 1
- **Low Priority:** 1
