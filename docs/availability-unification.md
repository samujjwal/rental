# Availability Unification

## Canonical Choice: AvailabilitySlot + InventoryUnit

**Decision**: AvailabilitySlot + InventoryUnit is the canonical availability model.

## Rationale

### AvailabilitySlot (Canonical)
- **Inventory Unit Support**: Links to InventoryUnit for multi-item listings (e.g., 10 identical cameras)
- **Price Per Slot**: Stores pricing at the slot level for dynamic pricing
- **Currency Support**: Multi-currency pricing
- **Booking Reference**: Links to Booking for tracking
- **Versioning**: Includes version field for optimistic locking
- **Flexible Time Ranges**: startTime/endTime with unique constraints
- **Status Granularity**: AvailabilitySlotStatus enum with more states

### Availability (Legacy)
- **Simple Model**: Only propertyId, date range, status
- **No Inventory Support**: Cannot handle multi-item listings
- **No Price Tracking**: Requires separate pricing queries
- **No Booking Reference**: Cannot track which booking consumed availability
- **No Versioning**: Prone to race conditions

## Migration Plan

### Phase 1: Deprecate Availability Model
- Mark `Availability` model as `@deprecated` in schema
- Add comment directing to AvailabilitySlot
- Update documentation

### Phase 2: Migrate Reads
- Update `availability.service.ts` to read from AvailabilitySlot
- Update `search.service.ts` to query AvailabilitySlot
- Update `booking-validation.service.ts` to check AvailabilitySlot
- Update `checkout-orchestrator.service.ts` to use AvailabilitySlot

### Phase 3: Migrate Writes
- Update controllers to write to AvailabilitySlot
- Update bulk operations to use AvailabilitySlot
- Remove write operations to Availability table

### Phase 4: Data Migration
- Create migration script to copy Availability data to AvailabilitySlot
- Validate data integrity
- Drop Availability table after validation

### Phase 5: Cleanup
- Remove Availability model from schema
- Remove AvailabilityService
- Remove Availability controller
- Update all imports

## Current Status

- **Canonical Model**: AvailabilitySlot + InventoryUnit ✅
- **Legacy Model**: Availability (to be deprecated)
- **Migration**: Not started
- **Tests**: Need to verify availability tests use canonical model

## Implementation Notes

When migrating reads:
1. Replace `this.prisma.availability.findMany()` with `this.prisma.availabilitySlot.findMany()`
2. Map `propertyId` → `listingId`
3. Map `startDate` → `startTime`
4. Map `endDate` → `endTime`
5. Handle inventoryUnitId for multi-item listings

When migrating writes:
1. Always create InventoryUnit for listings with multiple items
2. Create AvailabilitySlot with inventoryUnitId reference
3. Set price and currency at slot level
4. Include bookingId when slot is booked
